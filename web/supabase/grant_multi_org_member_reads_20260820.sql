-- Production follow-up for the multi-org schema.
-- RLS policies already restrict rows by the signed-in user; these grants let
-- PostgREST reach the tables before RLS is evaluated.

grant usage on schema public to authenticated, service_role;
grant select on public.orgs, public.org_members, public.entities, public.entity_members to authenticated;
grant all on public.orgs, public.org_members, public.entities, public.entity_members to service_role;

grant usage on schema app_private to authenticated, service_role;
grant execute on function app_private.is_org_member(uuid) to authenticated, service_role;
grant execute on function app_private.is_entity_member(uuid) to authenticated, service_role;
