begin;

-- PostgREST needs table privileges in addition to the existing RLS policies.
grant usage on schema finance to authenticated;
grant select, insert, update on finance.requisitions to authenticated;
grant select, insert, update on real_estate.properties, real_estate.units, real_estate.unit_assets to authenticated;
grant select, insert, update on real_estate.tenants, real_estate.leases, real_estate.invoices, real_estate.payments, real_estate.payment_allocations to authenticated;
grant select, insert, update on real_estate.inspections to authenticated;
grant select, insert, update on iam.roles, iam.role_restrictions, iam.invitations to authenticated;

insert into iam.permissions (permission_key, action, description) values
  ('admin.roles.manage', 'manage', 'Create and manage organization roles'),
  ('real_estate.payments.allocate', 'update', 'Allocate payments to invoices'),
  ('real_estate.payments.reconcile', 'manage', 'Reconcile payment records'),
  ('real_estate.inspections.update', 'update', 'Update inspection records')
on conflict (permission_key) do nothing;

-- The role editor exposes company/self scopes used by the current admin pages.
alter table iam.roles drop constraint if exists roles_scope_check;
alter table iam.roles add constraint roles_scope_check check (scope in ('platform','organization','application','company','self'));

drop policy if exists re_tenants_write on real_estate.tenants;
create policy re_tenants_write on real_estate.tenants for all to authenticated
  using (private.has_company_access(organization_id, company_id) and (private.has_permission(organization_id, company_id, 'real_estate.tenants.update') or private.has_permission(organization_id, company_id, 'real_estate.tenants.archive')))
  with check (private.has_company_access(organization_id, company_id) and (private.has_permission(organization_id, company_id, 'real_estate.tenants.create') or private.has_permission(organization_id, company_id, 'real_estate.tenants.update')));

drop policy if exists re_leases_write on real_estate.leases;
create policy re_leases_write on real_estate.leases for all to authenticated
  using (private.has_company_access(organization_id, company_id) and (private.has_permission(organization_id, company_id, 'real_estate.leases.update') or private.has_permission(organization_id, company_id, 'real_estate.leases.activate') or private.has_permission(organization_id, company_id, 'real_estate.leases.terminate')))
  with check (private.has_company_access(organization_id, company_id) and (private.has_permission(organization_id, company_id, 'real_estate.leases.create') or private.has_permission(organization_id, company_id, 'real_estate.leases.update')));

drop policy if exists re_invoices_write on real_estate.invoices;
create policy re_invoices_write on real_estate.invoices for all to authenticated
  using (private.has_company_access(organization_id, company_id) and (private.has_permission(organization_id, company_id, 'real_estate.invoices.update_draft') or private.has_permission(organization_id, company_id, 'real_estate.invoices.issue')))
  with check (private.has_company_access(organization_id, company_id) and (private.has_permission(organization_id, company_id, 'real_estate.invoices.create') or private.has_permission(organization_id, company_id, 'real_estate.invoices.update_draft')));

drop policy if exists re_payments_write on real_estate.payments;
create policy re_payments_write on real_estate.payments for all to authenticated
  using (private.has_company_access(organization_id, company_id) and (private.has_permission(organization_id, company_id, 'real_estate.payments.record') or private.has_permission(organization_id, company_id, 'real_estate.payments.reconcile')))
  with check (private.has_company_access(organization_id, company_id) and (private.has_permission(organization_id, company_id, 'real_estate.payments.record') or private.has_permission(organization_id, company_id, 'real_estate.payments.reconcile')));

drop policy if exists re_payment_allocations_write on real_estate.payment_allocations;
create policy re_payment_allocations_write on real_estate.payment_allocations for insert to authenticated
  with check (private.has_company_access(organization_id, company_id) and private.has_permission(organization_id, company_id, 'real_estate.payments.allocate'));

drop policy if exists re_inspections_select on real_estate.inspections;
create policy re_inspections_select on real_estate.inspections for select to authenticated
  using (private.has_company_access(organization_id, company_id) and private.has_permission(organization_id, company_id, 'real_estate.inspections.read'));
drop policy if exists re_inspections_write on real_estate.inspections;
create policy re_inspections_write on real_estate.inspections for all to authenticated
  using (private.has_company_access(organization_id, company_id) and (private.has_permission(organization_id, company_id, 'real_estate.inspections.create') or private.has_permission(organization_id, company_id, 'real_estate.inspections.update')))
  with check (private.has_company_access(organization_id, company_id) and (private.has_permission(organization_id, company_id, 'real_estate.inspections.create') or private.has_permission(organization_id, company_id, 'real_estate.inspections.update')));

drop policy if exists invitations_write_org_admin on iam.invitations;
create policy invitations_write_org_admin on iam.invitations for all to authenticated
  using (private.has_permission(organization_id, null, 'admin.members.invite'))
  with check (invited_by = auth.uid() and private.has_permission(organization_id, null, 'admin.members.invite'));

drop policy if exists roles_insert_platform_admin on iam.roles;
create policy roles_insert_platform_admin on iam.roles for insert to authenticated
  with check ((organization_id is null and private.is_platform_operator()) or (organization_id is not null and private.has_permission(organization_id, null, 'admin.roles.manage')));

drop policy if exists role_restrictions_write_admin on iam.role_restrictions;
create policy role_restrictions_write_admin on iam.role_restrictions for all to authenticated
  using (exists (select 1 from iam.roles r where r.id = role_restrictions.role_id and ((r.organization_id is null and private.is_platform_operator()) or (r.organization_id is not null and private.has_permission(r.organization_id, null, 'admin.roles.manage')))))
  with check (exists (select 1 from iam.roles r where r.id = role_restrictions.role_id and ((r.organization_id is null and private.is_platform_operator()) or (r.organization_id is not null and private.has_permission(r.organization_id, null, 'admin.roles.manage')))));

commit;
