drop policy if exists re_units_select on real_estate.units;
drop policy if exists re_units_write on real_estate.units;

create policy re_units_select_v2 on real_estate.units
  for select to authenticated
  using (
    private.is_platform_operator()
    or (private.has_company_access(organization_id, company_id)
      and private.has_permission(organization_id, company_id, 'real_estate.units.read'))
  );

create policy re_units_write_v2 on real_estate.units
  for all to authenticated
  using (
    private.is_platform_operator()
    or (private.has_company_access(organization_id, company_id)
      and (private.has_permission(organization_id, company_id, 'real_estate.units.update')
        or private.has_permission(organization_id, company_id, 'real_estate.units.archive')))
  )
  with check (
    private.is_platform_operator()
    or (private.has_company_access(organization_id, company_id)
      and (private.has_permission(organization_id, company_id, 'real_estate.units.create')
        or private.has_permission(organization_id, company_id, 'real_estate.units.update')))
  );
