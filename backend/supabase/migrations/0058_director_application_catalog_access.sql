begin;

-- Let organization Directors read the application catalog. Without this,
-- platform.applications RLS hides applications before the launcher can render
-- them, even when the Director role has been assigned all applications.
create or replace function private.has_application_access(target_org uuid, wanted_app text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, iam, platform, billing
as $$
  select
    private.is_platform_operator()
    or exists (
      select 1
      from iam.organization_memberships om
      join iam.roles r
        on r.organization_id = om.organization_id
       and r.scope = 'organization'
       and r.role_key = 'director'
      where om.user_id = auth.uid()
        and om.status = 'active'
        and (target_org is null or om.organization_id = target_org)
    )
    or exists (
      select 1
      from iam.organization_memberships om
      join platform.applications a on a.application_key = wanted_app
      left join billing.application_subscriptions s
        on s.organization_id = om.organization_id
       and s.application_id = a.id
      where om.user_id = auth.uid()
        and om.status = 'active'
        and (target_org is null or om.organization_id = target_org)
        and ((a.is_core and wanted_app <> 'PLATFORM_ADMIN') or s.status in ('trial','active','grace'))
    );
$$;

revoke all on function private.has_application_access(uuid, text) from public;
grant execute on function private.has_application_access(uuid, text) to authenticated;

commit;
