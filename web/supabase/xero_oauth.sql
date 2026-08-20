-- Xero OAuth connection storage and multi-entity mapping.
--
-- Apply after schema_multi_org.sql. The entity mapping and bank-statement
-- placeholders require public.entities and the multi-org membership tables.
-- API routes write through SUPABASE_SERVICE_ROLE_KEY. Browser clients should not
-- receive grants or RLS policies on these token-bearing tables and should use
-- /api/xero/status instead.

create extension if not exists pgcrypto;

create table if not exists public.xero_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  redirect_after text not null default '/dashboard',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.xero_oauth_states_state_hash_key') is null
    and to_regclass('public.xero_oauth_states_state_hash_uidx') is null then
    if exists (
      select 1
      from public.xero_oauth_states
      group by state_hash
      having count(*) > 1
    ) then
      raise exception using
        message = 'Cannot create xero_oauth_states_state_hash_uidx because duplicate Xero OAuth state hashes exist.',
        hint = 'Resolve duplicate xero_oauth_states rows for the same state_hash before applying this schema.';
    end if;

    create unique index xero_oauth_states_state_hash_uidx
      on public.xero_oauth_states(state_hash);
  end if;
end;
$$;

create index if not exists xero_oauth_states_user_id_idx on public.xero_oauth_states(user_id);
create index if not exists xero_oauth_states_expires_at_idx on public.xero_oauth_states(expires_at);

create table if not exists public.xero_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  xero_user_id text,
  xero_email text,
  token_ciphertext text not null,
  scopes text[] not null default '{}',
  expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disconnected_at timestamptz
);

do $$
begin
  if to_regclass('public.xero_connections_user_id_key') is null
    and to_regclass('public.xero_connections_user_id_uidx') is null then
    if exists (
      select 1
      from public.xero_connections
      group by user_id
      having count(*) > 1
    ) then
      raise exception using
        message = 'Cannot create xero_connections_user_id_uidx because duplicate Xero connection users exist.',
        hint = 'Resolve duplicate xero_connections rows for the same user_id before applying this schema.';
    end if;

    create unique index xero_connections_user_id_uidx
      on public.xero_connections(user_id);
  end if;
end;
$$;

create index if not exists xero_connections_user_id_idx on public.xero_connections(user_id);
create index if not exists xero_connections_active_idx on public.xero_connections(user_id) where disconnected_at is null;

create table if not exists public.xero_connection_tenants (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.xero_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id text not null,
  tenant_name text,
  tenant_type text,
  xero_connection_id text,
  raw_metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.xero_connection_tenants_connection_id_tenant_id_key') is null
    and to_regclass('public.xero_connection_tenants_connection_tenant_uidx') is null then
    if exists (
      select 1
      from public.xero_connection_tenants
      group by connection_id, tenant_id
      having count(*) > 1
    ) then
      raise exception using
        message = 'Cannot create xero_connection_tenants_connection_tenant_uidx because duplicate Xero tenant connections exist.',
        hint = 'Resolve duplicate xero_connection_tenants rows for the same connection_id and tenant_id before applying this schema.';
    end if;

    create unique index xero_connection_tenants_connection_tenant_uidx
      on public.xero_connection_tenants(connection_id, tenant_id);
  end if;
end;
$$;

create index if not exists xero_connection_tenants_user_id_idx on public.xero_connection_tenants(user_id);
create index if not exists xero_connection_tenants_tenant_id_idx on public.xero_connection_tenants(tenant_id);

-- Explicit mapping from a Lumen legal entity to one connected Xero tenant.
-- `entities.xero_tenant_id` remains as a compatibility mirror for older app code.
create table if not exists public.entity_xero_mappings (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  connection_id uuid not null references public.xero_connections(id) on delete cascade,
  connection_tenant_id uuid not null references public.xero_connection_tenants(id) on delete restrict,
  xero_tenant_id text not null,
  mapped_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
do $$
begin
  if to_regclass('public.entity_xero_mappings_entity_id_key') is null
    and to_regclass('public.entity_xero_mappings_entity_id_uidx') is null then
    if exists (
      select 1
      from public.entity_xero_mappings
      group by entity_id
      having count(*) > 1
    ) then
      raise exception using
        message = 'Cannot create entity_xero_mappings_entity_id_uidx because duplicate entity Xero mappings exist.',
        hint = 'Resolve duplicate entity_xero_mappings rows for the same entity_id before applying this schema.';
    end if;

    create unique index entity_xero_mappings_entity_id_uidx
      on public.entity_xero_mappings(entity_id);
  end if;

  if to_regclass('public.entity_xero_mappings_connection_tenant_id_key') is null
    and to_regclass('public.entity_xero_mappings_connection_tenant_uidx') is null then
    if exists (
      select 1
      from public.entity_xero_mappings
      group by connection_tenant_id
      having count(*) > 1
    ) then
      raise exception using
        message = 'Cannot create entity_xero_mappings_connection_tenant_uidx because duplicate Xero tenant entity mappings exist.',
        hint = 'Resolve duplicate entity_xero_mappings rows for the same connection_tenant_id before applying this schema.';
    end if;

    create unique index entity_xero_mappings_connection_tenant_uidx
      on public.entity_xero_mappings(connection_tenant_id);
  end if;
end;
$$;
create index if not exists entity_xero_mappings_connection_id_idx on public.entity_xero_mappings(connection_id);
create index if not exists entity_xero_mappings_xero_tenant_id_idx on public.entity_xero_mappings(xero_tenant_id);

-- Bank-statement ingestion placeholders. These keep the upcoming importer tied to
-- explicit entity/Xero tenant mappings without implementing ingestion yet.
create table if not exists public.entity_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  entity_xero_mapping_id uuid references public.entity_xero_mappings(id) on delete set null,
  xero_bank_account_id text,
  account_name text not null,
  currency text,
  status text not null default 'pending' check (status in ('pending','active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
do $$
begin
  if to_regclass('public.entity_bank_accounts_entity_id_xero_bank_account_id_key') is null
    and to_regclass('public.entity_bank_accounts_entity_xero_account_uidx') is null then
    if exists (
      select 1
      from public.entity_bank_accounts
      where xero_bank_account_id is not null
      group by entity_id, xero_bank_account_id
      having count(*) > 1
    ) then
      raise exception using
        message = 'Cannot create entity_bank_accounts_entity_xero_account_uidx because duplicate Xero bank accounts exist.',
        hint = 'Resolve duplicate entity_bank_accounts rows for the same entity_id and xero_bank_account_id before applying this schema.';
    end if;

    create unique index entity_bank_accounts_entity_xero_account_uidx
      on public.entity_bank_accounts(entity_id, xero_bank_account_id);
  end if;
end;
$$;
create index if not exists entity_bank_accounts_entity_id_idx on public.entity_bank_accounts(entity_id);

create table if not exists public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  bank_account_id uuid references public.entity_bank_accounts(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  source text not null default 'manual' check (source in ('manual','xero','bank_feed')),
  status text not null default 'queued',
  statement_period_start date,
  statement_period_end date,
  raw_file_id uuid references public.invoice_files(id) on delete set null,
  error_message text,
  reprocess_attempt_count integer not null default 0 check (reprocess_attempt_count >= 0),
  last_reprocess_attempt_at timestamptz,
  next_reprocess_after timestamptz,
  last_reprocess_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bank_statement_imports
  add column if not exists reprocess_attempt_count integer not null default 0;
alter table public.bank_statement_imports
  add column if not exists last_reprocess_attempt_at timestamptz;
alter table public.bank_statement_imports
  add column if not exists next_reprocess_after timestamptz;
alter table public.bank_statement_imports
  add column if not exists last_reprocess_error text;
alter table public.bank_statement_imports
  alter column reprocess_attempt_count set default 0;
update public.bank_statement_imports
  set reprocess_attempt_count = 0
  where reprocess_attempt_count is null;
alter table public.bank_statement_imports
  alter column reprocess_attempt_count set not null;
alter table public.bank_statement_imports
  drop constraint if exists bank_statement_imports_reprocess_attempt_count_check;
alter table public.bank_statement_imports
  add constraint bank_statement_imports_reprocess_attempt_count_check
  check (reprocess_attempt_count >= 0);
alter table public.bank_statement_imports
  drop constraint if exists bank_statement_imports_status_check;
alter table public.bank_statement_imports
  add constraint bank_statement_imports_status_check
  check (status in ('queued','pending_parse','processing','imported','failed'));
create index if not exists bank_statement_imports_entity_id_idx on public.bank_statement_imports(entity_id);
create index if not exists bank_statement_imports_status_idx on public.bank_statement_imports(status);
create index if not exists bank_statement_imports_reprocess_due_idx
  on public.bank_statement_imports(next_reprocess_after, reprocess_attempt_count, created_at)
  where source = 'manual' and status in ('queued','pending_parse','failed');
do $$
begin
  if to_regclass('public.bank_statement_imports_manual_raw_file_account_uidx') is null then
    if exists (
      select 1
      from public.bank_statement_imports
      where raw_file_id is not null and bank_account_id is not null
      group by raw_file_id, bank_account_id, source
      having count(*) > 1
    ) then
      raise exception using
        message = 'Cannot create bank_statement_imports_manual_raw_file_account_uidx because duplicate manual statement imports exist.',
        hint = 'Resolve duplicate bank_statement_imports rows for the same raw_file_id, bank_account_id, and source before applying this schema.';
    else
      create unique index bank_statement_imports_manual_raw_file_account_uidx
        on public.bank_statement_imports(raw_file_id, bank_account_id, source)
        where raw_file_id is not null and bank_account_id is not null;
    end if;
  end if;
end;
$$;

create table if not exists public.bank_statement_import_processing_logs (
  id uuid primary key default gen_random_uuid(),
  statement_import_id uuid not null references public.bank_statement_imports(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  bank_account_id uuid references public.entity_bank_accounts(id) on delete set null,
  raw_file_id uuid references public.invoice_files(id) on delete set null,
  trigger text not null check (trigger in ('manual_upload','maintenance_reprocess','maintenance_cron')),
  status text not null default 'started' check (status in ('started','imported','pending_parse','failed','skipped')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  transaction_count integer not null default 0 check (transaction_count >= 0),
  balance_count integer not null default 0 check (balance_count >= 0),
  warning_message text,
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists bank_statement_import_processing_logs_import_idx
  on public.bank_statement_import_processing_logs(statement_import_id, started_at desc);
create index if not exists bank_statement_import_processing_logs_entity_idx
  on public.bank_statement_import_processing_logs(entity_id, started_at desc);
create index if not exists bank_statement_import_processing_logs_status_idx
  on public.bank_statement_import_processing_logs(status, started_at desc);

-- Shared bank ledger tables. Manual statement parsing and Xero sync both write
-- here so downstream reconciliation code has one transaction/balance model.
create table if not exists public.bank_account_transactions (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  bank_account_id uuid not null references public.entity_bank_accounts(id) on delete cascade,
  statement_import_id uuid references public.bank_statement_imports(id) on delete set null,
  entity_xero_mapping_id uuid references public.entity_xero_mappings(id) on delete set null,
  source text not null check (source in ('manual','xero','bank_feed')),
  source_record_type text,
  transaction_date date not null,
  posted_date date,
  description text not null default '',
  payee text,
  reference text,
  amount numeric not null,
  signed_amount numeric not null,
  direction text not null default 'unknown' check (direction in ('inflow','outflow','unknown')),
  currency text not null,
  external_id text,
  external_hash text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  status text not null default 'posted' check (status in ('pending','posted','reconciled','voided','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
do $$
begin
  if to_regclass('public.bank_account_transactions_account_source_hash_uidx') is null then
    if exists (
      select 1
      from public.bank_account_transactions
      group by bank_account_id, source, external_hash
      having count(*) > 1
    ) then
      raise exception using
        message = 'Cannot create bank_account_transactions_account_source_hash_uidx because duplicate bank transaction hashes exist.',
        hint = 'Resolve duplicate bank_account_transactions rows for the same bank_account_id, source, and external_hash before applying this schema.';
    end if;

    create unique index bank_account_transactions_account_source_hash_uidx
      on public.bank_account_transactions(bank_account_id, source, external_hash);
  end if;

  if to_regclass('public.bank_account_transactions_external_id_uidx') is null then
    if exists (
      select 1
      from public.bank_account_transactions
      where external_id is not null
      group by bank_account_id, source, external_id
      having count(*) > 1
    ) then
      raise exception using
        message = 'Cannot create bank_account_transactions_external_id_uidx because duplicate bank transaction external IDs exist.',
        hint = 'Resolve duplicate bank_account_transactions rows for the same bank_account_id, source, and external_id before applying this schema.';
    end if;

    create unique index bank_account_transactions_external_id_uidx
      on public.bank_account_transactions(bank_account_id, source, external_id)
      where external_id is not null;
  end if;
end;
$$;
create index if not exists bank_account_transactions_account_date_idx
  on public.bank_account_transactions(bank_account_id, transaction_date desc);
create index if not exists bank_account_transactions_entity_date_idx
  on public.bank_account_transactions(entity_id, transaction_date desc);
create index if not exists bank_account_transactions_import_id_idx
  on public.bank_account_transactions(statement_import_id)
  where statement_import_id is not null;

create table if not exists public.bank_account_balances (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  bank_account_id uuid not null references public.entity_bank_accounts(id) on delete cascade,
  statement_import_id uuid references public.bank_statement_imports(id) on delete set null,
  entity_xero_mapping_id uuid references public.entity_xero_mappings(id) on delete set null,
  source text not null check (source in ('manual','xero','bank_feed')),
  source_record_type text,
  balance_date date not null,
  as_of timestamptz not null default now(),
  balance_type text not null default 'reported' check (balance_type in ('opening','closing','available','current','statement','reported')),
  amount numeric not null,
  currency text not null,
  external_id text,
  external_hash text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
do $$
begin
  if to_regclass('public.bank_account_balances_account_source_hash_uidx') is null then
    if exists (
      select 1
      from public.bank_account_balances
      group by bank_account_id, source, external_hash
      having count(*) > 1
    ) then
      raise exception using
        message = 'Cannot create bank_account_balances_account_source_hash_uidx because duplicate bank balance hashes exist.',
        hint = 'Resolve duplicate bank_account_balances rows for the same bank_account_id, source, and external_hash before applying this schema.';
    end if;

    create unique index bank_account_balances_account_source_hash_uidx
      on public.bank_account_balances(bank_account_id, source, external_hash);
  end if;

  if to_regclass('public.bank_account_balances_external_id_uidx') is null then
    if exists (
      select 1
      from public.bank_account_balances
      where external_id is not null
      group by bank_account_id, source, external_id
      having count(*) > 1
    ) then
      raise exception using
        message = 'Cannot create bank_account_balances_external_id_uidx because duplicate bank balance external IDs exist.',
        hint = 'Resolve duplicate bank_account_balances rows for the same bank_account_id, source, and external_id before applying this schema.';
    end if;

    create unique index bank_account_balances_external_id_uidx
      on public.bank_account_balances(bank_account_id, source, external_id)
      where external_id is not null;
  end if;
end;
$$;
create index if not exists bank_account_balances_account_date_idx
  on public.bank_account_balances(bank_account_id, balance_date desc, balance_type);
create index if not exists bank_account_balances_entity_date_idx
  on public.bank_account_balances(entity_id, balance_date desc);

create or replace function public.map_entity_to_xero_tenant(
  p_entity_id uuid,
  p_connection_tenant_id uuid,
  p_user_id uuid
)
returns public.entity_xero_mappings as $$
declare
  v_entity public.entities%rowtype;
  v_tenant public.xero_connection_tenants%rowtype;
  v_mapping public.entity_xero_mappings%rowtype;
begin
  if p_entity_id is null or p_connection_tenant_id is null or p_user_id is null then
    raise exception 'Entity, Xero tenant, and user are required.';
  end if;

  select * into v_entity
  from public.entities
  where id = p_entity_id;

  if not found then
    raise exception 'Entity not found.';
  end if;

  if not exists (
    select 1
    from public.org_members
    where org_id = v_entity.org_id
      and user_id = p_user_id
      and role in ('owner', 'admin')
  ) and not exists (
    select 1
    from public.entity_members
    where entity_id = p_entity_id
      and user_id = p_user_id
      and role = 'admin'
  ) then
    raise exception 'User is not an entity admin.';
  end if;

  select t.* into v_tenant
  from public.xero_connection_tenants t
  join public.xero_connections c on c.id = t.connection_id
  where t.id = p_connection_tenant_id
    and t.user_id = p_user_id
    and c.user_id = p_user_id
    and c.disconnected_at is null;

  if not found then
    raise exception 'Xero tenant not found for this user.';
  end if;

  insert into public.entity_xero_mappings (
    entity_id,
    connection_id,
    connection_tenant_id,
    xero_tenant_id,
    mapped_by,
    updated_at
  )
  values (
    p_entity_id,
    v_tenant.connection_id,
    v_tenant.id,
    v_tenant.tenant_id,
    p_user_id,
    now()
  )
  on conflict (entity_id) do update
    set connection_id = excluded.connection_id,
        connection_tenant_id = excluded.connection_tenant_id,
        xero_tenant_id = excluded.xero_tenant_id,
        mapped_by = excluded.mapped_by,
        updated_at = now()
  returning * into v_mapping;

  update public.entities
  set xero_tenant_id = v_tenant.tenant_id
  where id = p_entity_id;

  return v_mapping;
end;
$$ language plpgsql
security definer
set search_path = public, pg_temp;

create or replace function public.unmap_entity_from_xero_tenant(
  p_entity_id uuid,
  p_user_id uuid
)
returns void as $$
declare
  v_entity public.entities%rowtype;
begin
  if p_entity_id is null or p_user_id is null then
    raise exception 'Entity and user are required.';
  end if;

  select * into v_entity
  from public.entities
  where id = p_entity_id;

  if not found then
    raise exception 'Entity not found.';
  end if;

  if not exists (
    select 1
    from public.org_members
    where org_id = v_entity.org_id
      and user_id = p_user_id
      and role in ('owner', 'admin')
  ) and not exists (
    select 1
    from public.entity_members
    where entity_id = p_entity_id
      and user_id = p_user_id
      and role = 'admin'
  ) then
    raise exception 'User is not an entity admin.';
  end if;

  delete from public.entity_xero_mappings
  where entity_id = p_entity_id;

  update public.entities
  set xero_tenant_id = null
  where id = p_entity_id;
end;
$$ language plpgsql
security definer
set search_path = public, pg_temp;

create or replace function public.cleanup_stale_xero_connection_tenants(
  p_connection_id uuid,
  p_current_tenant_ids text[]
)
returns integer as $$
declare
  v_removed_count integer;
begin
  if p_connection_id is null then
    raise exception 'Connection is required.';
  end if;

  with stale_tenants as (
    select id
    from public.xero_connection_tenants
    where connection_id = p_connection_id
      and not (tenant_id = any(coalesce(p_current_tenant_ids, array[]::text[])))
  ),
  deleted_mappings as (
    delete from public.entity_xero_mappings m
    using stale_tenants st
    where m.connection_tenant_id = st.id
    returning m.entity_id, m.xero_tenant_id
  ),
  cleared_entities as (
    update public.entities e
    set xero_tenant_id = null
    from deleted_mappings dm
    where e.id = dm.entity_id
      and e.xero_tenant_id = dm.xero_tenant_id
    returning e.id
  ),
  deleted_tenants as (
    delete from public.xero_connection_tenants t
    using stale_tenants st
    where t.id = st.id
    returning t.id
  )
  select count(*) into v_removed_count from deleted_tenants;

  return v_removed_count;
end;
$$ language plpgsql
security definer
set search_path = public, pg_temp;

drop trigger if exists set_entity_xero_mappings_updated_at on public.entity_xero_mappings;
create trigger set_entity_xero_mappings_updated_at
before update on public.entity_xero_mappings
for each row execute function public.set_updated_at();

drop trigger if exists set_entity_bank_accounts_updated_at on public.entity_bank_accounts;
create trigger set_entity_bank_accounts_updated_at
before update on public.entity_bank_accounts
for each row execute function public.set_updated_at();

drop trigger if exists set_bank_statement_imports_updated_at on public.bank_statement_imports;
create trigger set_bank_statement_imports_updated_at
before update on public.bank_statement_imports
for each row execute function public.set_updated_at();

drop trigger if exists set_bank_account_transactions_updated_at on public.bank_account_transactions;
create trigger set_bank_account_transactions_updated_at
before update on public.bank_account_transactions
for each row execute function public.set_updated_at();

drop trigger if exists set_bank_account_balances_updated_at on public.bank_account_balances;
create trigger set_bank_account_balances_updated_at
before update on public.bank_account_balances
for each row execute function public.set_updated_at();

alter table public.xero_oauth_states enable row level security;
alter table public.xero_connections enable row level security;
alter table public.xero_connection_tenants enable row level security;
alter table public.entity_xero_mappings enable row level security;
alter table public.entity_bank_accounts enable row level security;
alter table public.bank_statement_imports enable row level security;
alter table public.bank_statement_import_processing_logs enable row level security;
alter table public.bank_account_transactions enable row level security;
alter table public.bank_account_balances enable row level security;

revoke all on public.xero_oauth_states from public;
revoke all on public.xero_connections from public;
revoke all on public.xero_connection_tenants from public;
revoke all on public.entity_xero_mappings from public;
revoke all on public.entity_bank_accounts from public;
revoke all on public.bank_statement_imports from public;
revoke all on public.bank_statement_import_processing_logs from public;
revoke all on public.bank_account_transactions from public;
revoke all on public.bank_account_balances from public;
revoke all on public.xero_oauth_states from anon;
revoke all on public.xero_connections from anon;
revoke all on public.xero_connection_tenants from anon;
revoke all on public.entity_xero_mappings from anon;
revoke all on public.entity_bank_accounts from anon;
revoke all on public.bank_statement_imports from anon;
revoke all on public.bank_statement_import_processing_logs from anon;
revoke all on public.bank_account_transactions from anon;
revoke all on public.bank_account_balances from anon;
revoke all on public.xero_oauth_states from authenticated;
revoke all on public.xero_connections from authenticated;
revoke all on public.xero_connection_tenants from authenticated;
revoke all on public.entity_xero_mappings from authenticated;
revoke all on public.entity_bank_accounts from authenticated;
revoke all on public.bank_statement_imports from authenticated;
revoke all on public.bank_statement_import_processing_logs from authenticated;
revoke all on public.bank_account_transactions from authenticated;
revoke all on public.bank_account_balances from authenticated;

grant all on public.xero_oauth_states to service_role;
grant all on public.xero_connections to service_role;
grant all on public.xero_connection_tenants to service_role;
grant all on public.entity_xero_mappings to service_role;
grant all on public.entity_bank_accounts to service_role;
grant all on public.bank_statement_imports to service_role;
grant all on public.bank_statement_import_processing_logs to service_role;
grant all on public.bank_account_transactions to service_role;
grant all on public.bank_account_balances to service_role;

revoke all on function public.map_entity_to_xero_tenant(uuid, uuid, uuid) from public;
revoke all on function public.unmap_entity_from_xero_tenant(uuid, uuid) from public;
revoke all on function public.cleanup_stale_xero_connection_tenants(uuid, text[]) from public;
grant execute on function public.map_entity_to_xero_tenant(uuid, uuid, uuid) to service_role;
grant execute on function public.unmap_entity_from_xero_tenant(uuid, uuid) to service_role;
grant execute on function public.cleanup_stale_xero_connection_tenants(uuid, text[]) to service_role;
