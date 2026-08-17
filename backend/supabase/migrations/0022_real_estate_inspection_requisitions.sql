begin;

alter table real_estate.tenants
  add column if not exists id_type text,
  add column if not exists occupation text,
  add column if not exists employer text,
  add column if not exists postal_address text,
  add column if not exists preferred_contact_method text,
  add column if not exists move_in_date date,
  add column if not exists lease_preference text;

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='real_estate.inspections'::regclass and conname='inspections_org_id_key') then alter table real_estate.inspections add constraint inspections_org_id_key unique (organization_id,id); end if;
end $$;

create table if not exists finance.requisitions (id uuid primary key default gen_random_uuid(), organization_id uuid not null references platform.organizations(id), company_id uuid, requisition_number text not null, source_application text not null, source_type text not null, source_id uuid not null, property_id uuid, inspection_id uuid, title text not null, description text, status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled','paid')), estimated_amount_minor bigint, currency text not null default 'KES', requested_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,requisition_number), foreign key (organization_id,company_id) references platform.companies(organization_id,id), foreign key (organization_id,property_id) references real_estate.properties(organization_id,id), foreign key (organization_id,inspection_id) references real_estate.inspections(organization_id,id));
alter table finance.requisitions enable row level security;
create policy finance_requisitions_select on finance.requisitions for select to authenticated using (private.has_org_access(organization_id) and (private.is_platform_operator() or private.has_permission(organization_id,company_id,'finance.requisitions.read')));
create policy finance_requisitions_insert on finance.requisitions for insert to authenticated with check (requested_by=auth.uid() and private.has_org_access(organization_id) and (private.is_platform_operator() or private.has_permission(organization_id,company_id,'real_estate.inspections.create')));
create policy finance_requisitions_update on finance.requisitions for update to authenticated using (private.is_platform_operator() or private.has_permission(organization_id,company_id,'finance.requisitions.manage')) with check (private.has_org_access(organization_id));

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='real_estate' and tablename='properties' and policyname='re_properties_write_context') then
    create policy re_properties_write_context on real_estate.properties for all to authenticated
      using (private.has_company_access(organization_id,company_id) and (private.is_platform_operator() or private.has_permission(organization_id,company_id,'real_estate.properties.update') or private.has_permission(organization_id,company_id,'real_estate.properties.archive')))
      with check (private.has_company_access(organization_id,company_id) and (private.is_platform_operator() or private.has_permission(organization_id,company_id,'real_estate.properties.create') or private.has_permission(organization_id,company_id,'real_estate.properties.update')));
  end if;
end $$;

create policy inspections_select_context on real_estate.inspections for select to authenticated using (private.has_company_access(organization_id,company_id) and (private.is_platform_operator() or private.has_permission(organization_id,company_id,'real_estate.inspections.read')));
create policy inspections_insert_context on real_estate.inspections for insert to authenticated with check (created_by=auth.uid() and private.has_company_access(organization_id,company_id) and (private.is_platform_operator() or private.has_permission(organization_id,company_id,'real_estate.inspections.create')));
create policy inspections_update_context on real_estate.inspections for update to authenticated using (private.has_company_access(organization_id,company_id) and (private.is_platform_operator() or private.has_permission(organization_id,company_id,'real_estate.inspections.complete'))) with check (private.has_company_access(organization_id,company_id));

insert into iam.permissions(permission_key, action, description) values ('finance.requisitions.read','read','Read finance requisitions'),('finance.requisitions.manage','manage','Manage finance requisitions') on conflict(permission_key) do nothing;

commit;
