-- Lumen App inherited schema v2: multiple orgs + multiple entities + invoice intake
--
-- This schema is safe-by-default:
-- - RLS enabled on all app tables
-- - Access is controlled by org membership + entity membership
--
-- Apply in Supabase SQL editor.

create extension if not exists pgcrypto;

-- Orgs (top-level tenant)
create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

-- Org members
create table if not exists public.org_members (
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists org_members_user_id_idx on public.org_members(user_id);

-- Entities (legal entities / Xero tenants) under an org
create table if not exists public.entities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  code text,
  xero_tenant_id text,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);
create index if not exists entities_org_id_idx on public.entities(org_id);

-- Entity members (fine-grained access)
create table if not exists public.entity_members (
  entity_id uuid not null references public.entities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'requester' check (role in ('admin','ap','approver','requester')),
  created_at timestamptz not null default now(),
  primary key (entity_id, user_id)
);
create index if not exists entity_members_user_id_idx on public.entity_members(user_id);

-- Invoices
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,

  status text not null default 'UPLOADED',
  vendor_name text,
  description text,
  currency text default 'USD',
  total numeric,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists invoices_org_id_idx on public.invoices(org_id);
create index if not exists invoices_entity_id_idx on public.invoices(entity_id);
create index if not exists invoices_created_at_idx on public.invoices(created_at desc);

-- Invoice files (object storage reference)
create table if not exists public.invoice_files (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,

  provider text not null check (provider in ('supabase','s3','r2')),
  bucket text not null,
  object_key text not null,

  mime_type text,
  size_bytes bigint,
  sha256 text,

  created_at timestamptz not null default now()
);
create index if not exists invoice_files_invoice_id_idx on public.invoice_files(invoice_id);
create index if not exists invoice_files_entity_id_idx on public.invoice_files(entity_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_invoices_updated_at on public.invoices;
create trigger set_invoices_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

-- Helper: check org membership
create or replace function public.is_org_member(_org_id uuid)
returns boolean as $$
  select exists(
    select 1
    from public.org_members m
    where m.org_id = _org_id
      and m.user_id = auth.uid()
  );
$$ language sql stable;

-- Helper: check entity membership
create or replace function public.is_entity_member(_entity_id uuid)
returns boolean as $$
  select exists(
    select 1
    from public.entity_members m
    where m.entity_id = _entity_id
      and m.user_id = auth.uid()
  );
$$ language sql stable;

-- RLS
alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.entities enable row level security;
alter table public.entity_members enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_files enable row level security;

-- orgs: can view orgs you are a member of
drop policy if exists orgs_select_member on public.orgs;
create policy orgs_select_member on public.orgs
for select to authenticated
using (public.is_org_member(id));

-- org_members: can view org memberships for your orgs
drop policy if exists org_members_select_member on public.org_members;
create policy org_members_select_member on public.org_members
for select to authenticated
using (public.is_org_member(org_id));

-- entities: can view entities under your orgs
drop policy if exists entities_select_member on public.entities;
create policy entities_select_member on public.entities
for select to authenticated
using (public.is_org_member(org_id));

-- entity_members: can view entity memberships for entities in your org
drop policy if exists entity_members_select_member on public.entity_members;
create policy entity_members_select_member on public.entity_members
for select to authenticated
using (
  exists(
    select 1
    from public.entities e
    where e.id = entity_members.entity_id
      and public.is_org_member(e.org_id)
  )
);

-- invoices: can select invoices in entities you are a member of
drop policy if exists invoices_select_entity_member on public.invoices;
create policy invoices_select_entity_member on public.invoices
for select to authenticated
using (public.is_entity_member(entity_id));

-- invoices: can insert invoices only into entities you belong to AND org matches entity
drop policy if exists invoices_insert_entity_member on public.invoices;
create policy invoices_insert_entity_member on public.invoices
for insert to authenticated
with check (
  created_by = auth.uid()
  and public.is_entity_member(entity_id)
  and exists(
    select 1 from public.entities e
    where e.id = invoices.entity_id
      and e.org_id = invoices.org_id
  )
);

-- invoices: can update invoices in entities you belong to
drop policy if exists invoices_update_entity_member on public.invoices;
create policy invoices_update_entity_member on public.invoices
for update to authenticated
using (public.is_entity_member(entity_id))
with check (public.is_entity_member(entity_id));

-- invoice_files: select only for invoices in entities you belong to
drop policy if exists invoice_files_select_entity_member on public.invoice_files;
create policy invoice_files_select_entity_member on public.invoice_files
for select to authenticated
using (public.is_entity_member(entity_id));

-- invoice_files: insert only into entities you belong to AND org matches entity
drop policy if exists invoice_files_insert_entity_member on public.invoice_files;
create policy invoice_files_insert_entity_member on public.invoice_files
for insert to authenticated
with check (
  created_by = auth.uid()
  and public.is_entity_member(entity_id)
  and exists(
    select 1 from public.entities e
    where e.id = invoice_files.entity_id
      and e.org_id = invoice_files.org_id
  )
);
