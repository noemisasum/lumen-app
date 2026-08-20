# Lumen Web

Next.js frontend for the Lumen Treasury application shell.

The npm package name remains `lumen-app-web` to avoid unnecessary technical churn.

## Supabase env vars (Vercel integration)

This app expects these environment variables to exist (Vercel Supabase integration usually adds them automatically):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Server-side API routes that write private integration records also require:

- `SUPABASE_SERVICE_ROLE_KEY`
- `LUMEN_ADMIN_RECOVERY_EMAILS` (optional comma-separated allowlist for server-side admin access repair)

For email/password signup and login to work, the values must match the same Supabase project and the project must be active. The current production Supabase project autoconfirms new email/password users, so signup should not depend on a confirmation email. If email confirmation is re-enabled in Supabase later, password signup will send a confirmation email. In Supabase Dashboard → Authentication → URL Configuration:

- Set the site URL to the deployed Lumen origin.
- Add redirect URLs for each deployment that can receive email confirmation or password recovery callbacks, including `https://your-domain.example/auth/callback`, `https://your-domain.example/reset-password`, and local development `http://localhost:3000/auth/callback` plus `http://localhost:3000/reset-password` when testing locally.

Lumen also exposes a signed-in account recovery route at `/api/account/recovery`. It can repair access to the default `Lumen` org and `Default Entity` when a confirmed user is missing membership. It only grants owner/admin access when the default org has no owner, the user is already an owner/admin, or the user's email is listed in `LUMEN_ADMIN_RECOVERY_EMAILS`.

Do not commit Supabase keys or secrets to the repo. Configure them in the deployment environment or a local `.env.local` file.

## Xero OAuth env vars

The Xero connection routes expect these server-only environment variables:

- `XERO_CLIENT_ID`
- `XERO_CLIENT_SECRET`
- `XERO_REDIRECT_URI`
- `XERO_TOKEN_ENCRYPTION_KEY`

Set `XERO_TOKEN_ENCRYPTION_KEY` to generated key material, not a passphrase or arbitrary string. The app accepts either a 32-byte base64 key or a 64-character hex key and fails Xero connection startup if the value is missing or invalid.

Safe generation commands:

```bash
openssl rand -base64 32
openssl rand -hex 32
```

The app encrypts the Xero token set with AES-GCM before writing it to `public.xero_connections`, which is locked to server-side service-role access by the migration.

Configure the Xero app callback URLs to include:

- Production: `https://app.lumen-labs.io/api/xero/callback`
- Local development: `http://localhost:3000/api/xero/callback`

For production, set `XERO_REDIRECT_URI=https://app.lumen-labs.io/api/xero/callback`. For local development, set `XERO_REDIRECT_URI=http://localhost:3000/api/xero/callback` in `.env.local`.

Apply `supabase/xero_oauth.sql` after `supabase/schema_multi_org.sql`. The migration includes entity mapping functions and references the multi-org entity/membership tables, so it is not intended for the legacy single-user `schema.sql` path. The Xero tables have RLS enabled, no client-role grants or policies, and are intended to be accessed only by API routes using `SUPABASE_SERVICE_ROLE_KEY`. Browser code should use `/api/xero/status` rather than querying these tables directly.

## Multi-entity setup and Xero mapping

Use `/dashboard/entities` after signing in to create Lumen organisations and legal entities. Creating a new organisation also creates the first entity and grants the signed-in user owner/admin membership. Adding an entity to an existing organisation requires owner or admin access.

The same page lists connected Xero tenants and maps one tenant to one Lumen entity. Mapping and unmapping are handled by authenticated API routes with server-side authorization checks:

- `/api/orgs` lists accessible orgs/entities, Xero tenants, and current mappings; `POST` creates an org and first entity for the signed-in user.
- `/api/entities` creates an entity under an org where the signed-in user is owner/admin.
- `/api/entity-xero-mappings` maps or unmaps entities only when the signed-in user can administer that entity.

The `entity_xero_mappings` table is created by `supabase/xero_oauth.sql` because it links multi-org entities to service-only Xero connection rows. Keep applying `supabase/schema_multi_org.sql` before `supabase/xero_oauth.sql` for the multi-entity deployment. The migration also adds `entity_bank_accounts`, `bank_statement_imports`, and shared bank ledger tables so manual statement imports and Xero bank syncs can attach to an entity and mapped Xero tenant.

## Manual bank statement parsing

Manual bank statement uploads now parse CSV and XLSX files server-side when `/api/statement-upload-finalize` links the uploaded Supabase Storage object, and when the legacy `/api/bank-statement-imports` route can access the raw Supabase file. The parser supports quoted CSV fields, embedded commas/newlines in quoted fields, common transaction date headers, description/payee/reference headers, signed amount columns, debit/credit columns, optional currency columns, and optional running balance columns. XLSX workbooks are parsed by selecting the first worksheet that can be mapped to the same row model and header semantics as CSV. Parsed transactions are upserted into `bank_account_transactions`; running balance values are stored in `bank_account_balances`. Each parse/reparse attempt also writes `bank_statement_import_processing_logs` with the import, entity, bank account, trigger, start/finish timestamps, final status, transaction/balance counts, and any warning or error.

Idempotency is based on bank-provided external transaction IDs when present, otherwise on the statement import id plus source row identity. CSV keeps the existing statement import plus row number identity; XLSX uses statement import id plus worksheet id and row number. Repeated imports update the same rows while duplicate same-day/same-amount statement rows remain distinct. Currency comes from the file when present, then the selected bank account, then `USD`.

PDF, image, and legacy XLS statement files are not parsed automatically yet. They remain in `pending_parse` with a concise warning instead of pretending ingestion succeeded. XLSX parsing is bounded to small workbooks so very large spreadsheets are left for manual parser support rather than loaded blindly.

After deploying a parser change, an internal maintenance operator can reprocess existing queued statement imports through `POST /api/bank-statement-imports/reprocess`. This is not a user-facing workflow and should not be wired into the app UI. Set `STATEMENT_REPROCESS_SECRET` server-side, then send both an authenticated Supabase bearer token for an entity admin and the matching `x-lumen-maintenance-key` header. To reprocess one import:

```bash
curl -X POST "$APP_URL/api/bank-statement-imports/reprocess" \
  -H "authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "x-lumen-maintenance-key: $STATEMENT_REPROCESS_SECRET" \
  -H "content-type: application/json" \
  -d '{"statementImportId":"<bank_statement_import_id>"}'
```

To backfill a bounded batch of queued or pending-parser imports for an entity:

```bash
curl -X POST "$APP_URL/api/bank-statement-imports/reprocess" \
  -H "authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "x-lumen-maintenance-key: $STATEMENT_REPROCESS_SECRET" \
  -H "content-type: application/json" \
  -d '{"entityId":"<entity_id>","limit":25}'
```

The batch defaults to both `pending_parse` and `queued`, caps `limit` at 100, can be narrowed with `bankAccountId`, or can target one supported status by passing `status` (`queued`, `pending_parse`, `failed`, `processing`, or `imported`). It returns a per-import summary and writes processing-log rows for every attempted import, including validation skips. CSV and XLSX rows are upserted through the same stable hashes used by new uploads, so reruns do not duplicate transactions or balances. Unsupported PDF, image, and legacy XLS files remain `pending_parse` with a warning.

The app also defines an internal Vercel cron in `vercel.json` for `GET /api/bank-statement-imports/reprocess/hourly` once daily on `0 0 * * *`. This route does not require a human bearer token and must not be linked from UI. It requires either Vercel `CRON_SECRET` in the `Authorization: Bearer ...` header or `STATEMENT_REPROCESS_SECRET` via bearer or `x-lumen-maintenance-key`; for one-secret deployments, set `CRON_SECRET` to the same value as `STATEMENT_REPROCESS_SECRET`. The cron batch defaults to 25 imports, caps at 50, and only selects manual imports in `queued`, `pending_parse`, or `failed` whose `next_reprocess_after` is due and whose `reprocess_attempt_count` is below `STATEMENT_REPROCESS_MAX_ATTEMPTS` (default 3, max 10). Optional `STATEMENT_REPROCESS_CRON_LIMIT` can lower or raise the cron batch size within the cap.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000
