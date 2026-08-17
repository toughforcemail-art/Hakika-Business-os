begin;

-- Keep the permission registry application-aware. Older seed rows were created
-- before application_id was populated, so backfill them from their namespace.
update iam.permissions p
set application_id = a.id
from platform.applications a
where p.application_id is null
  and (
    (p.permission_key like 'real_estate.%' and a.application_key = 'REAL_ESTATE')
    or (p.permission_key like 'hr.%' and a.application_key = 'HR')
    or (p.permission_key like 'finance.%' and a.application_key = 'FINANCE')
    or (p.permission_key like 'toughforce.%' and a.application_key = 'TOUGHFORCE')
    or (p.permission_key like 'admin.%' and a.application_key = 'CUSTOMER_ADMIN')
    or (p.permission_key like 'platform.%' and a.application_key = 'PLATFORM_ADMIN')
  );

create index if not exists member_app_roles_access_lookup
  on iam.member_app_roles (organization_membership_id, organization_id, application_id, company_id, valid_from, valid_until);

create index if not exists permissions_application_lookup
  on iam.permissions (application_id, permission_key);

-- Canonical authorization check for all application RLS policies and server
-- actions. Use this instead of repeating joins in each app's tables.
create or replace function private.has_application_permission(
  target_org uuid,
  target_company uuid,
  wanted_app text,
  wanted_permission text
) returns boolean
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
      join platform.applications a
        on a.application_key = wanted_app
       and a.status = 'active'
      join iam.member_app_roles mar
        on mar.organization_membership_id = om.id
       and mar.organization_id = target_org
       and mar.application_id = a.id
       and (mar.company_id is null or mar.company_id = target_company)
       and mar.valid_from <= now()
       and (mar.valid_until is null or mar.valid_until > now())
      join iam.roles r
        on r.id = mar.role_id
       and (r.application_id is null or r.application_id = a.id)
      join iam.role_permissions rp on rp.role_id = r.id
      join iam.permissions p
        on p.id = rp.permission_id
       and p.permission_key = wanted_permission
       and (p.application_id is null or p.application_id = a.id)
      left join billing.application_subscriptions s
        on s.organization_id = target_org
       and s.application_id = a.id
      where om.organization_id = target_org
        and om.user_id = auth.uid()
        and om.status = 'active'
        and (a.is_core or s.status in ('trial', 'active', 'grace'))
    );
$$;

revoke all on function private.has_application_permission(uuid, uuid, text, text) from public;
grant execute on function private.has_application_permission(uuid, uuid, text, text) to authenticated;

commit;
