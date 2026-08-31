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

  insert into public.entity_members (entity_id, user_id, role)
  select
    v_entity.id,
    m.user_id,
    case
      when i.entity_role in ('admin','ap','approver','requester') then i.entity_role
      when m.role in ('owner','admin') then 'admin'
      else 'requester'
    end
  from public.org_members m
  left join lateral (
    select invite.entity_role
    from public.org_user_invites invite
    where invite.org_id = p_org_id
      and invite.invited_user_id = m.user_id
      and invite.accepted_at is not null
    order by invite.accepted_at desc, invite.updated_at desc, invite.created_at desc
    limit 1
  ) i on true
  where m.org_id = p_org_id
  on conflict (entity_id, user_id) do nothing;

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

revoke execute on function public.create_entity_with_membership(uuid, uuid, text, text) from public;
revoke execute on function public.create_entity_with_membership(uuid, uuid, text, text) from anon;
revoke execute on function public.create_entity_with_membership(uuid, uuid, text, text) from authenticated;
grant execute on function public.create_entity_with_membership(uuid, uuid, text, text) to service_role;
