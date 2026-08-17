begin;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='real_estate' and tablename='properties' and policyname='re_properties_insert_explicit') then
    create policy re_properties_insert_explicit on real_estate.properties for insert to authenticated
      with check (
        private.has_org_access(organization_id)
        and private.has_company_access(organization_id, company_id)
        and (private.is_platform_operator() or private.has_permission(organization_id, company_id, 'real_estate.properties.create'))
        and created_by = auth.uid()
      );
  end if;
end $$;

commit;
