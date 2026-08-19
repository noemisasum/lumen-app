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

Apply `supabase/xero_oauth.sql` after the base Supabase schema. The Xero tables have RLS enabled, no client-role grants or policies, and are intended to be accessed only by API routes using `SUPABASE_SERVICE_ROLE_KEY`. Browser code should use `/api/xero/status` rather than querying these tables directly.

## Multi-entity setup and Xero mapping

Use `/dashboard/entities` after signing in to create Lumen organisations and legal entities. Creating a new organisation also creates the first entity and grants the signed-in user owner/admin membership. Adding an entity to an existing organisation requires owner or admin access.

The same page lists connected Xero tenants and maps one tenant to one Lumen entity. Mapping and unmapping are handled by authenticated API routes with server-side authorization checks:

- `/api/orgs` lists accessible orgs/entities, Xero tenants, and current mappings; `POST` creates an org and first entity for the signed-in user.
- `/api/entities` creates an entity under an org where the signed-in user is owner/admin.
- `/api/entity-xero-mappings` maps or unmaps entities only when the signed-in user can administer that entity.

The `entity_xero_mappings` table is created by `supabase/xero_oauth.sql` because it links multi-org entities to service-only Xero connection rows. Keep applying `supabase/schema_multi_org.sql` before `supabase/xero_oauth.sql` for the multi-entity deployment. The migration also adds low-risk `entity_bank_accounts` and `bank_statement_imports` placeholders so the later bank statement importer can attach to an entity and its mapped Xero tenant.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000
