begin;

-- Canonical scoped authorization order:
-- 1) authenticated organization membership
-- 2) validated optional company membership
-- 3) active application permission (or validated platform operator)
create or replace function private.has_scoped_permission(target_org uuid, target_company uuid, wanted text) returns boolean
language sql stable security definer
set search_path = pg_catalog, private
as $$
  select private.has_org_access(target_org)
    and private.has_company_access(target_org, target_company)
    and (private.is_platform_operator() or private.has_permission(target_org, target_company, wanted));
$$;
revoke all on function private.has_scoped_permission(uuid,uuid,text) from public;
grant execute on function private.has_scoped_permission(uuid,uuid,text) to authenticated;

-- Remove overlapping historical policies for this table only. Data and migration history remain intact.
drop policy if exists re_properties_select on real_estate.properties;
drop policy if exists re_properties_write on real_estate.properties;
drop policy if exists re_properties_write_context on real_estate.properties;
drop policy if exists re_properties_insert_explicit on real_estate.properties;

create policy re_properties_select_v1 on real_estate.properties
  for select to authenticated
  using (private.has_scoped_permission(organization_id, company_id, 'real_estate.properties.read'));

create policy re_properties_insert_v1 on real_estate.properties
  for insert to authenticated
  with check (
    private.has_scoped_permission(organization_id, company_id, 'real_estate.properties.create')
    and created_by = auth.uid()
  );

create policy re_properties_update_v1 on real_estate.properties
  for update to authenticated
  using (
    private.has_scoped_permission(organization_id, company_id, 'real_estate.properties.update')
    or private.has_scoped_permission(organization_id, company_id, 'real_estate.properties.archive')
  )
  with check (
    private.has_scoped_permission(organization_id, company_id, 'real_estate.properties.update')
  );

comment on table real_estate.properties is 'RLS policy contract: organization membership, optional validated company, then Real Estate permission. No authenticated DELETE policy.';

commit;
