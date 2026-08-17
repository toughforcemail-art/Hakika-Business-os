begin;

-- Tenant portal users can read only their own lease, invoice and payment
-- records. Management users continue through the existing scoped policies.
drop policy if exists leases_select_org_or_company on real_estate.leases;
create policy leases_select_org_or_portal on real_estate.leases
  for select to authenticated
  using (
    private.is_platform_operator()
    or (
      private.has_company_access(organization_id, company_id)
      and private.has_permission(organization_id, company_id, 'real_estate.leases.read')
    )
    or exists (
      select 1 from real_estate.portal_grants g
      where g.organization_id = real_estate.leases.organization_id
        and g.user_id = auth.uid() and g.portal_type = 'tenant'
        and g.entity_id = real_estate.leases.tenant_id and g.status = 'active'
    )
  );

drop policy if exists invoices_select_company on real_estate.invoices;
create policy invoices_select_org_or_portal on real_estate.invoices
  for select to authenticated
  using (
    private.is_platform_operator()
    or (
      private.has_company_access(organization_id, company_id)
      and private.has_permission(organization_id, company_id, 'real_estate.invoices.read')
    )
    or exists (
      select 1 from real_estate.portal_grants g
      where g.organization_id = real_estate.invoices.organization_id
        and g.user_id = auth.uid() and g.portal_type = 'tenant'
        and g.entity_id = real_estate.invoices.tenant_id and g.status = 'active'
    )
  );

drop policy if exists payments_select_company on real_estate.payments;
create policy payments_select_org_or_portal on real_estate.payments
  for select to authenticated
  using (
    private.is_platform_operator()
    or (
      private.has_company_access(organization_id, company_id)
      and private.has_permission(organization_id, company_id, 'real_estate.payments.read')
    )
    or exists (
      select 1 from real_estate.portal_grants g
      where g.organization_id = real_estate.payments.organization_id
        and g.user_id = auth.uid() and g.portal_type = 'tenant'
        and g.entity_id = real_estate.payments.tenant_id and g.status = 'active'
    )
  );

commit;
