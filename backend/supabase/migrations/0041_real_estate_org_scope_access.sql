begin;

grant select on real_estate.portal_grants to authenticated;

-- Platform-owner users and organization-scoped records must be able to read
-- tenants and leases even when company_id is null. The previous policies only
-- covered company-scoped permission checks, so valid organization records were
-- silently omitted from the tenant directory.
drop policy if exists tenants_select_company_or_portal on real_estate.tenants;
drop policy if exists tenants_select_org_or_company on real_estate.tenants;
create policy tenants_select_org_or_company on real_estate.tenants
  for select to authenticated
  using (
    private.is_platform_operator()
    or (
      private.has_company_access(organization_id, company_id)
      and private.has_permission(organization_id, company_id, 'real_estate.tenants.read')
    )
    or exists (
      select 1
      from real_estate.portal_grants g
      where g.organization_id = real_estate.tenants.organization_id
        and g.user_id = auth.uid()
        and g.portal_type = 'tenant'
        and g.entity_id = real_estate.tenants.id
        and g.status = 'active'
    )
  );

drop policy if exists leases_select_company on real_estate.leases;
drop policy if exists leases_select_org_or_company on real_estate.leases;
create policy leases_select_org_or_company on real_estate.leases
  for select to authenticated
  using (
    private.is_platform_operator()
    or (
      private.has_company_access(organization_id, company_id)
      and private.has_permission(organization_id, company_id, 'real_estate.leases.read')
    )
  );

commit;
