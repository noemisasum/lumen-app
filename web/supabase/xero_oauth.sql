-- Xero OAuth connection storage.
--
-- Apply after either schema.sql or schema_multi_org.sql.
-- API routes write through SUPABASE_SERVICE_ROLE_KEY. Browser clients should not
-- receive grants or RLS policies on these token-bearing tables and should use
-- /api/xero/status instead.

create extension if not exists pgcrypto;

create table if not exists public.xero_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  redirect_after text not null default '/dashboard',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

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
  disconnected_at timestamptz,
  unique (user_id)
);

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
  updated_at timestamptz not null default now(),
  unique (connection_id, tenant_id)
);

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
  updated_at timestamptz not null default now(),
  unique (entity_id),
  unique (connection_tenant_id)
);
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
  updated_at timestamptz not null default now(),
  unique (entity_id, xero_bank_account_id)
);
create index if not exists entity_bank_accounts_entity_id_idx on public.entity_bank_accounts(entity_id);

create table if not exists public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities(id) on delete cascade,
  bank_account_id uuid references public.entity_bank_accounts(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  source text not null default 'manual' check (source in ('manual','xero','bank_feed')),
  status text not null default 'queued' check (status in ('queued','processing','imported','failed')),
  statement_period_start date,
  statement_period_end date,
  raw_file_id uuid references public.invoice_files(id) on delete set null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bank_statement_imports_entity_id_idx on public.bank_statement_imports(entity_id);
create index if not exists bank_statement_imports_status_idx on public.bank_statement_imports(status);

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

alter table public.xero_oauth_states enable row level security;
alter table public.xero_connections enable row level security;
alter table public.xero_connection_tenants enable row level security;
alter table public.entity_xero_mappings enable row level security;
alter table public.entity_bank_accounts enable row level security;
alter table public.bank_statement_imports enable row level security;

revoke all on public.xero_oauth_states from public;
revoke all on public.xero_connections from public;
revoke all on public.xero_connection_tenants from public;
revoke all on public.entity_xero_mappings from public;
revoke all on public.entity_bank_accounts from public;
revoke all on public.bank_statement_imports from public;
revoke all on public.xero_oauth_states from anon;
revoke all on public.xero_connections from anon;
revoke all on public.xero_connection_tenants from anon;
revoke all on public.entity_xero_mappings from anon;
revoke all on public.entity_bank_accounts from anon;
revoke all on public.bank_statement_imports from anon;
revoke all on public.xero_oauth_states from authenticated;
revoke all on public.xero_connections from authenticated;
revoke all on public.xero_connection_tenants from authenticated;
revoke all on public.entity_xero_mappings from authenticated;
revoke all on public.entity_bank_accounts from authenticated;
revoke all on public.bank_statement_imports from authenticated;

grant all on public.xero_oauth_states to service_role;
grant all on public.xero_connections to service_role;
grant all on public.xero_connection_tenants to service_role;
grant all on public.entity_xero_mappings to service_role;
grant all on public.entity_bank_accounts to service_role;
grant all on public.bank_statement_imports to service_role;
