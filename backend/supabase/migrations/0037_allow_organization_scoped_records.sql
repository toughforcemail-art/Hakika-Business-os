create or replace function private.has_company_access(target_org uuid, target_company uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, iam
as $$
  select
    (target_company is null and exists (
      select 1 from iam.organization_memberships om
      where om.organization_id = target_org
        and om.user_id = auth.uid()
        and om.status = 'active'
    ))
    or exists (
      select 1
      from iam.company_memberships cm
      join iam.organization_memberships om on om.id = cm.organization_membership_id
      where om.organization_id = target_org
        and om.user_id = auth.uid()
        and om.status = 'active'
        and cm.company_id = target_company
        and cm.status = 'active'
    );
$$;
revoke all on function private.has_company_access(uuid, uuid) from public;
grant execute on function private.has_company_access(uuid, uuid) to authenticated;
