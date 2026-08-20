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

`xero_oauth.sql` also owns the shared bank ledger tables: `bank_account_transactions` and `bank_account_balances`. Uploaded statement imports and Xero bank syncs write into these same service-role-only tables. Manual CSV statement uploads are parsed server-side from Supabase Storage and update the import to `imported` after durable transaction or balance rows are written. Unsupported formats such as PDF, image, and Excel files stay `pending_parse` with a warning until a reliable parser for those formats is added.

After deploying new statement parsing support, use the app route `POST /api/bank-statement-imports/reprocess` with an authenticated entity admin token to backfill existing `bank_statement_imports`. A single import can be run with `{"statementImportId":"<id>"}`. A bounded batch can be run with `{"entityId":"<entity_id>","limit":25}` and optionally `bankAccountId`; batches default to both `pending_parse` and `queued`, cap at 100 imports, and can target one supported status by passing `status` (`queued`, `pending_parse`, `failed`, `processing`, or `imported`). The route reuses the same Supabase Storage download and stable ledger upsert path as new uploads, so reruns are idempotent and unsupported formats remain queued with a warning.
