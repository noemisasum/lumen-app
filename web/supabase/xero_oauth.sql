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

alter table public.xero_oauth_states enable row level security;
alter table public.xero_connections enable row level security;
alter table public.xero_connection_tenants enable row level security;

revoke all on public.xero_oauth_states from public;
revoke all on public.xero_connections from public;
revoke all on public.xero_connection_tenants from public;
revoke all on public.xero_oauth_states from anon;
revoke all on public.xero_connections from anon;
revoke all on public.xero_connection_tenants from anon;
revoke all on public.xero_oauth_states from authenticated;
revoke all on public.xero_connections from authenticated;
revoke all on public.xero_connection_tenants from authenticated;

grant all on public.xero_oauth_states to service_role;
grant all on public.xero_connections to service_role;
grant all on public.xero_connection_tenants to service_role;
