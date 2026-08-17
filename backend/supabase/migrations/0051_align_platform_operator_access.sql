begin;

create or replace function private.is_platform_operator() returns boolean
language sql stable security definer
set search_path = pg_catalog, iam, platform
as $$
  select exists (
    select 1
    from iam.organization_memberships om
    join platform.organizations o
      on o.id = om.organization_id
     and o.organization_type = 'platform_owner'
     and o.status = 'active'
    join iam.member_app_roles mar
      on mar.organization_membership_id = om.id
     and mar.valid_from <= now()
     and (mar.valid_until is null or mar.valid_until > now())
    join platform.applications a
      on a.id = mar.application_id
     and a.application_key = 'PLATFORM_ADMIN'
     and a.status = 'active'
    join iam.roles r
      on r.id = mar.role_id
     and r.role_key = 'platform_admin'
     and r.scope = 'platform'
    where om.user_id = auth.uid()
      and om.status = 'active'
  );
$$;

revoke all on function private.is_platform_operator() from public;
grant execute on function private.is_platform_operator() to authenticated;

commit;
