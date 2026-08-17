begin;

-- Keep organization isolation authoritative while allowing a validated platform
-- operator to work across a customer's companies. Non-platform users still
-- require an active company membership whenever a company is supplied.
create or replace function private.has_scoped_permission(target_org uuid, target_company uuid, wanted text) returns boolean
language sql stable security definer
set search_path = pg_catalog, private
as $$
  select private.has_org_access(target_org)
    and (target_company is null or private.is_platform_operator() or private.has_company_access(target_org, target_company))
    and (private.is_platform_operator() or private.has_permission(target_org, target_company, wanted));
$$;
revoke all on function private.has_scoped_permission(uuid,uuid,text) from public;
grant execute on function private.has_scoped_permission(uuid,uuid,text) to authenticated;

comment on function private.has_scoped_permission(uuid,uuid,text) is 'Canonical property scope check: authenticated organization context, optional company membership, and application permission. Platform operators remain organization-scoped.';

commit;
