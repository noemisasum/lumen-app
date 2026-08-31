# Supabase setup (MVP)

This folder contains SQL you can run in the Supabase SQL Editor to create the initial schema + RLS policies for Lumen.

## 1) Create Storage bucket

In Supabase Dashboard → Storage:
- Create a bucket named: `invoices`
- Set to **private** (recommended)

## 2) Apply schema + RLS

Choose one:

### Option A (current MVP, single-user scope)
In Supabase Dashboard → SQL Editor:
- Run `supabase/schema.sql`

### Option B (recommended, multi-org + multi-entity)
In Supabase Dashboard → SQL Editor:
- Run `supabase/schema_multi_org.sql`

After applying the multi-org schema, seed at least one org, entity, and membership row with an admin/service-role SQL session before using uploads. The app intentionally cannot create tenants from the browser.

```sql
insert into public.orgs (slug, name)
values ('lumen', 'Lumen')
on conflict (slug) do update set name = excluded.name
returning id;

-- Replace these placeholders with the org id, entity name, and auth user id.
insert into public.org_members (org_id, user_id, role)
values ('<org_id>', '<user_id>', 'owner')
on conflict (org_id, user_id) do update set role = excluded.role;

insert into public.entities (org_id, name, code)
values ('<org_id>', 'Default Entity', 'default')
on conflict (org_id, name) do update set code = excluded.code
returning id;

insert into public.entity_members (entity_id, user_id, role)
values ('<entity_id>', '<user_id>', 'admin')
on conflict (entity_id, user_id) do update set role = excluded.role;
```

## Notes

- `schema.sql` scopes invoice access to the **signed-in user** (`created_by = auth.uid()`), which is safe and simple.
- `schema_multi_org.sql` adds **orgs + entities + membership** and scopes access by membership (future-proof for real teams).
- `schema_multi_org.sql` also creates a private `invoices` storage bucket and authenticated upload/read policies scoped to each user's own top-level object folder.

## 3) Xero OAuth tables and entity mapping

Run `supabase/xero_oauth.sql` only after `supabase/schema_multi_org.sql` when enabling the Xero connection and entity mapping UI. The migration references `public.entities`, `public.org_members`, and `public.entity_members`, so it is not compatible with the legacy single-user `schema.sql` path.

The migration creates `public.xero_oauth_states`, `public.xero_connections`, `public.xero_connection_tenants`, and the multi-entity Xero mapping tables/functions. These tables are RLS-enabled, have no client-role grants or policies, and are not meant to be queried from browser code. The Next.js API routes write them with `SUPABASE_SERVICE_ROLE_KEY`; keep that key server-only.

Xero token sets are encrypted in the API route before storage. Set `XERO_TOKEN_ENCRYPTION_KEY` to generated key material, not a passphrase or arbitrary string. Use either `openssl rand -base64 32` for a 32-byte base64 key or `openssl rand -hex 32` for a 64-character hex key.

`xero_oauth.sql` also owns the shared bank ledger tables: `bank_account_transactions` and `bank_account_balances`. Uploaded statement imports and Xero bank syncs write into these same service-role-only tables. Manual CSV, XLSX, PDF, and supported legacy XLS statement uploads are parsed server-side from Supabase Storage and update the import to `imported` after durable transaction or balance rows are written. PDF support is limited to deterministic text-extracted H&W DBS current/savings, SCB current/savings, HSBC current/savings, and OSL USD/USDT layouts; unsupported PDF layouts and images stay safely unimported in `pending_parse` with a warning until a reliable parser for those formats is added. Corrupt PDFs, extraction/runtime errors, and parser crashes are marked `failed`. Statement parsing and reprocessing attempts are recorded in `bank_statement_import_processing_logs`, including trigger, start/finish timestamps, import/entity/bank account/raw file ids, final status, parsed counts, and warning/error text.

`vercel.json` schedules the internal Xero ledger route `GET /api/xero/bank-ledger-sync/daily` once daily at `0 2 * * *` UTC. Configure Vercel `CRON_SECRET` for the automatic bearer header and optionally `XERO_LEDGER_SYNC_SECRET` for a dedicated maintenance secret. The route uses the service role rather than an entity-admin user token, loads active entity-Xero mappings whose connection has not been disconnected, and calls the idempotent Xero ledger upsert path for each entity. `XERO_LEDGER_SYNC_WINDOW_DAYS` controls the transaction lookback window; it defaults to 90 and is capped at 366. The Bank Summary balance snapshot is written for the UTC `toDate` of the cron run.

After deploying new statement parsing support, use the internal maintenance route `POST /api/bank-statement-imports/reprocess` to backfill existing `bank_statement_imports`. Set `STATEMENT_REPROCESS_SECRET` server-side and send it as `x-lumen-maintenance-key` alongside an authenticated entity admin token; do not expose this route in the app UI. A single import can be run with `{"statementImportId":"<id>"}`. A bounded batch can be run with `{"entityId":"<entity_id>","limit":25}` and optionally `bankAccountId`; batches default to both `pending_parse` and `queued`, cap at 100 imports, and can target one supported status by passing `status` (`queued`, `pending_parse`, `failed`, `processing`, or `imported`). The route reuses the same Supabase Storage download and stable ledger upsert path as new uploads, so reruns are idempotent and unsupported PDF/image formats stay `pending_parse` with a warning.

`vercel.json` schedules the internal statement reprocess route `GET /api/bank-statement-imports/reprocess/hourly` once daily. Configure Vercel `CRON_SECRET` for the automatic `Authorization: Bearer ...` header; it can be the same value as `STATEMENT_REPROCESS_SECRET`. The route uses the service role, not an entity-admin bearer token, selects only due manual imports in `queued`, `pending_parse`, or `failed`, and respects `reprocess_attempt_count`, `next_reprocess_after`, and `STATEMENT_REPROCESS_MAX_ATTEMPTS` (default 3) so permanently unsupported or broken imports stop retrying. `STATEMENT_REPROCESS_CRON_LIMIT` optionally changes the default scheduled batch size of 25 up to the route cap of 50.
