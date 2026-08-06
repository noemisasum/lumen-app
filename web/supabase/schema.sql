-- Lumen App inherited MVP schema (invoice intake)
-- Safe-by-default: RLS enabled; user can only see their own records.

-- Extensions
create extension if not exists pgcrypto;

-- Invoices
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'UPLOADED',
  vendor_name text,
  description text,
  currency text default 'USD',
  total numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_created_by_idx on public.invoices(created_by);
create index if not exists invoices_created_at_idx on public.invoices(created_at desc);

-- Invoice files (object storage reference)
create table if not exists public.invoice_files (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
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
create index if not exists invoice_files_created_by_idx on public.invoice_files(created_by);

-- Updated-at trigger
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

-- RLS
alter table public.invoices enable row level security;
alter table public.invoice_files enable row level security;

-- Policies: invoices
drop policy if exists "invoices_select_own" on public.invoices;
create policy "invoices_select_own" on public.invoices
for select
to authenticated
using (created_by = auth.uid());

drop policy if exists "invoices_insert_own" on public.invoices;
create policy "invoices_insert_own" on public.invoices
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "invoices_update_own" on public.invoices;
create policy "invoices_update_own" on public.invoices
for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

-- Policies: invoice_files
drop policy if exists "invoice_files_select_own" on public.invoice_files;
create policy "invoice_files_select_own" on public.invoice_files
for select
to authenticated
using (created_by = auth.uid());

drop policy if exists "invoice_files_insert_own" on public.invoice_files;
create policy "invoice_files_insert_own" on public.invoice_files
for insert
to authenticated
with check (created_by = auth.uid());

-- Optional: disallow delete for now (auditability)
