# Supabase setup (MVP)

This folder contains SQL you can run in the Supabase SQL Editor to create the initial schema + RLS policies for Lumen App.

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
