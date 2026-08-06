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

## Notes

- `schema.sql` scopes invoice access to the **signed-in user** (`created_by = auth.uid()`), which is safe and simple.
- `schema_multi_org.sql` adds **orgs + entities + membership** and scopes access by membership (future-proof for real teams).
