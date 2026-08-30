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

create index if not exists org_user_invites_email_pending_idx
on public.org_user_invites(email)
where accepted_at is null;

drop trigger if exists set_org_user_invites_updated_at on public.org_user_invites;
create trigger set_org_user_invites_updated_at
before update on public.org_user_invites
for each row execute function public.set_updated_at();

alter table public.org_user_invites enable row level security;

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

grant select, insert, update on public.org_user_invites to service_role;
