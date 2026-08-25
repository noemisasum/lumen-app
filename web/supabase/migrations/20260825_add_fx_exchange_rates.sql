create table if not exists public.fx_exchange_rates (
  id uuid primary key default gen_random_uuid(),
  base_currency text not null,
  quote_currency text not null default 'USD',
  rate_date date not null,
  rate numeric not null check (rate > 0),
  source text not null default 'frankfurter' check (source in ('frankfurter','xe','manual')),
  as_of timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fx_exchange_rates_currency_check
    check (base_currency ~ '^[A-Z]{3}$' and quote_currency ~ '^[A-Z]{3}$')
);

alter table public.fx_exchange_rates
  alter column source set default 'frankfurter';
alter table public.fx_exchange_rates
  drop constraint if exists fx_exchange_rates_source_check;
alter table public.fx_exchange_rates
  add constraint fx_exchange_rates_source_check
  check (source in ('frankfurter','xe','manual'));

create unique index if not exists fx_exchange_rates_currency_date_source_uidx
  on public.fx_exchange_rates(base_currency, quote_currency, rate_date, source);
create index if not exists fx_exchange_rates_latest_idx
  on public.fx_exchange_rates(base_currency, quote_currency, rate_date desc, as_of desc);

drop trigger if exists set_fx_exchange_rates_updated_at on public.fx_exchange_rates;
create trigger set_fx_exchange_rates_updated_at
before update on public.fx_exchange_rates
for each row execute function public.set_updated_at();

alter table public.fx_exchange_rates enable row level security;

revoke all on public.fx_exchange_rates from public;
revoke all on public.fx_exchange_rates from anon;
revoke all on public.fx_exchange_rates from authenticated;
grant all on public.fx_exchange_rates to service_role;
