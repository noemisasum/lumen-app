-- Lumen inherited schema v2: multiple orgs + multiple entities + invoice intake
--
-- This schema is safe-by-default:
-- - RLS enabled on all app tables
-- - Access is controlled by org membership + entity membership
--
-- Apply in Supabase SQL editor.

create extension if not exists pgcrypto;

create schema if not exists app_private;
revoke all on schema app_private from public;

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

-- Pending org user invites for emails that do not have a Supabase Auth user yet.
-- API routes use service-role access to create and accept these records.
create table if not exists public.org_user_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  email text not null,
  org_role text not null default 'member' check (org_role in ('admin','member')),
  entity_role text not null default 'admin' check (entity_role in ('admin','ap','approver','requester')),
  invited_by uuid references auth.users(id) on delete set null,
  invited_user_id uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint org_user_invites_email_normalized check (email = lower(trim(email))),
  unique (org_id, email)
);
create index if not exists org_user_invites_email_pending_idx on public.org_user_invites(email) where accepted_at is null;

create or replace function public.create_org_with_default_entity(
  p_user_id uuid,
  p_org_name text,
  p_org_slug text,
  p_entity_name text,
  p_entity_code text default null
)
returns jsonb as $$
declare
  v_org public.orgs%rowtype;
  v_entity public.entities%rowtype;
begin
  if p_user_id is null then
    raise exception 'User is required.';
  end if;

  if nullif(trim(p_org_name), '') is null or length(trim(p_org_name)) > 120 then
    raise exception 'Organisation name is invalid.';
  end if;

  if nullif(trim(p_org_slug), '') is null then
    raise exception 'Organisation slug is invalid.';
  end if;

  if nullif(trim(p_entity_name), '') is null or length(trim(p_entity_name)) > 120 then
    raise exception 'Entity name is invalid.';
  end if;

  insert into public.orgs (slug, name)
  values (trim(p_org_slug), trim(p_org_name))
  returning * into v_org;

  insert into public.org_members (org_id, user_id, role)
  values (v_org.id, p_user_id, 'owner');

  insert into public.entities (org_id, name, code)
  values (v_org.id, trim(p_entity_name), nullif(trim(p_entity_code), ''))
  returning * into v_entity;

  insert into public.entity_members (entity_id, user_id, role)
  values (v_entity.id, p_user_id, 'admin');

  return jsonb_build_object(
    'org', jsonb_build_object(
      'id', v_org.id,
      'name', v_org.name,
      'slug', v_org.slug,
      'created_at', v_org.created_at,
      'role', 'owner'
    ),
    'entity', jsonb_build_object(
      'id', v_entity.id,
      'org_id', v_entity.org_id,
      'name', v_entity.name,
      'code', v_entity.code,
      'xero_tenant_id', v_entity.xero_tenant_id,
      'created_at', v_entity.created_at,
      'role', 'admin',
      'canAdmin', true,
      'xeroMapping', null
    )
  );
end;
$$ language plpgsql
security definer
set search_path = public, pg_temp;

create or replace function public.create_entity_with_membership(
  p_org_id uuid,
  p_user_id uuid,
  p_name text,
  p_code text default null
)
returns jsonb as $$
declare
  v_entity public.entities%rowtype;
begin
  if p_org_id is null or p_user_id is null then
    raise exception 'Organisation and user are required.';
  end if;

  if nullif(trim(p_name), '') is null or length(trim(p_name)) > 120 then
    raise exception 'Entity name is invalid.';
  end if;

  if not exists (
    select 1
    from public.org_members
    where org_id = p_org_id
      and user_id = p_user_id
      and role in ('owner', 'admin')
  ) then
    raise exception 'User is not an organisation admin.';
  end if;

  insert into public.entities (org_id, name, code)
  values (p_org_id, trim(p_name), nullif(trim(p_code), ''))
  returning * into v_entity;

  insert into public.entity_members (entity_id, user_id, role)
  values (v_entity.id, p_user_id, 'admin');

  return jsonb_build_object(
    'id', v_entity.id,
    'org_id', v_entity.org_id,
    'name', v_entity.name,
    'code', v_entity.code,
    'xero_tenant_id', v_entity.xero_tenant_id,
    'created_at', v_entity.created_at,
    'role', 'admin',
    'canAdmin', true,
    'xeroMapping', null
  );
end;
$$ language plpgsql
security definer
set search_path = public, pg_temp;

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
do $$
begin
  if to_regclass('public.invoice_files_storage_object_uidx') is null then
    if exists (
      select 1
      from public.invoice_files
      group by provider, bucket, object_key
      having count(*) > 1
    ) then
      raise exception using
        message = 'Cannot create invoice_files_storage_object_uidx because duplicate invoice file storage object rows exist.',
        hint = 'Resolve duplicate invoice_files rows for the same provider, bucket, and object_key before applying this schema.';
    else
      create unique index invoice_files_storage_object_uidx
        on public.invoice_files(provider, bucket, object_key);
    end if;
  end if;
end;
$$;

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql
set search_path = public, pg_temp;

drop trigger if exists set_invoices_updated_at on public.invoices;
create trigger set_invoices_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

drop trigger if exists set_org_user_invites_updated_at on public.org_user_invites;
create trigger set_org_user_invites_updated_at
before update on public.org_user_invites
for each row execute function public.set_updated_at();

-- Helper: check org membership
create or replace function app_private.is_org_member(_org_id uuid)
returns boolean as $$
  select exists(
    select 1
    from public.org_members m
    where m.org_id = _org_id
      and m.user_id = auth.uid()
  );
$$ language sql stable
security definer
set search_path = public, pg_temp;

-- Helper: check entity membership
create or replace function app_private.is_entity_member(_entity_id uuid)
returns boolean as $$
  select exists(
    select 1
    from public.entity_members m
    where m.entity_id = _entity_id
      and m.user_id = auth.uid()
  );
$$ language sql stable
security definer
set search_path = public, pg_temp;

revoke all on function app_private.is_org_member(uuid) from public;
revoke all on function app_private.is_entity_member(uuid) from public;
revoke all on function public.create_org_with_default_entity(uuid, text, text, text, text) from public;
revoke all on function public.create_entity_with_membership(uuid, uuid, text, text) from public;
grant usage on schema app_private to authenticated;
grant execute on function app_private.is_org_member(uuid) to authenticated;
grant execute on function app_private.is_entity_member(uuid) to authenticated;
grant execute on function public.create_org_with_default_entity(uuid, text, text, text, text) to service_role;
grant execute on function public.create_entity_with_membership(uuid, uuid, text, text) to service_role;
grant select, insert, update on public.org_user_invites to service_role;
grant select, insert, update, delete on public.invoices, public.invoice_files to service_role;
grant select, insert, update on public.invoices to authenticated;
grant select, insert on public.invoice_files to authenticated;

-- RLS
alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.entities enable row level security;
alter table public.entity_members enable row level security;
alter table public.org_user_invites enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_files enable row level security;

-- orgs: can view orgs you are a member of
drop policy if exists orgs_select_member on public.orgs;
create policy orgs_select_member on public.orgs
for select to authenticated
using (app_private.is_org_member(id));

-- org_members: can view org memberships for your orgs
drop policy if exists org_members_select_member on public.org_members;
create policy org_members_select_member on public.org_members
for select to authenticated
using (app_private.is_org_member(org_id));

-- entities: can view entities under your orgs
drop policy if exists entities_select_member on public.entities;
create policy entities_select_member on public.entities
for select to authenticated
using (app_private.is_org_member(org_id));

-- entity_members: can view entity memberships for entities in your org
drop policy if exists entity_members_select_member on public.entity_members;
create policy entity_members_select_member on public.entity_members
for select to authenticated
using (
  exists(
    select 1
    from public.entities e
    where e.id = entity_members.entity_id
      and app_private.is_org_member(e.org_id)
  )
);

-- org_user_invites: owners can view pending/accepted invites for their org.
drop policy if exists org_user_invites_select_owner on public.org_user_invites;
create policy org_user_invites_select_owner on public.org_user_invites
for select to authenticated
using (
  exists(
    select 1
    from public.org_members m
    where m.org_id = org_user_invites.org_id
      and m.user_id = auth.uid()
      and m.role = 'owner'
  )
);

-- invoices: can select invoices in entities you are a member of
drop policy if exists invoices_select_entity_member on public.invoices;
create policy invoices_select_entity_member on public.invoices
for select to authenticated
using (app_private.is_entity_member(entity_id));

-- invoices: can insert invoices only into entities you belong to AND org matches entity
drop policy if exists invoices_insert_entity_member on public.invoices;
create policy invoices_insert_entity_member on public.invoices
for insert to authenticated
with check (
  created_by = auth.uid()
  and app_private.is_entity_member(entity_id)
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
using (app_private.is_entity_member(entity_id))
with check (
  created_by = auth.uid()
  and app_private.is_entity_member(entity_id)
  and exists(
    select 1 from public.entities e
    where e.id = invoices.entity_id
      and e.org_id = invoices.org_id
  )
);

-- invoice_files: select only for invoices in entities you belong to
drop policy if exists invoice_files_select_entity_member on public.invoice_files;
create policy invoice_files_select_entity_member on public.invoice_files
for select to authenticated
using (app_private.is_entity_member(entity_id));

-- invoice_files: insert only into entities you belong to AND org matches entity
drop policy if exists invoice_files_insert_entity_member on public.invoice_files;
create policy invoice_files_insert_entity_member on public.invoice_files
for insert to authenticated
with check (
  created_by = auth.uid()
  and app_private.is_entity_member(entity_id)
  and exists(
    select 1 from public.entities e
    where e.id = invoice_files.entity_id
      and e.org_id = invoice_files.org_id
  )
  and exists(
    select 1 from public.invoices i
    where i.id = invoice_files.invoice_id
      and i.org_id = invoice_files.org_id
      and i.entity_id = invoice_files.entity_id
  )
);

-- Private invoice storage bucket + direct-upload policies.
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do update set public = false;

drop policy if exists invoices_storage_insert_own_folder on storage.objects;
create policy invoices_storage_insert_own_folder on storage.objects
for insert to authenticated
with check (
  bucket_id = 'invoices'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists invoices_storage_select_own_folder on storage.objects;
create policy invoices_storage_select_own_folder on storage.objects
for select to authenticated
using (
  bucket_id = 'invoices'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- If Supabase's RLS auto-enable helper exists, keep it trigger-only.
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
      and p.pronargs = 0
  ) then
    execute 'revoke execute on function public.rls_auto_enable() from public';
    execute 'revoke execute on function public.rls_auto_enable() from anon';
    execute 'revoke execute on function public.rls_auto_enable() from authenticated';
  end if;
end;
$$;
