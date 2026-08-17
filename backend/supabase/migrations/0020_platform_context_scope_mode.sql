begin;

alter table platform.organizations
  add column if not exists company_scope_mode text not null default 'organization_only';

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'platform.organizations'::regclass and conname = 'organizations_company_scope_mode_check') then
    alter table platform.organizations add constraint organizations_company_scope_mode_check check (company_scope_mode in ('organization_only','optional','required'));
  end if;
end $$;

comment on column platform.organizations.company_scope_mode is 'Canonical scope policy for application context resolution.';

-- Organization-only mode must be able to persist records without inventing a company.
alter table real_estate.properties alter column company_id drop not null;
alter table real_estate.units alter column company_id drop not null;

do $$ declare item record; begin
  for item in select table_schema, table_name from information_schema.columns where table_schema = 'real_estate' and column_name = 'company_id' loop
    execute format('alter table %I.%I alter column company_id drop not null', item.table_schema, item.table_name);
  end loop;
end $$;

create or replace function private.has_company_access(target_org uuid, target_company uuid) returns boolean language sql stable security definer set search_path = pg_catalog, iam as $$
  select private.has_org_access(target_org) and (target_company is null or exists(select 1 from iam.company_memberships cm join iam.organization_memberships om on om.id=cm.organization_membership_id where om.organization_id=target_org and om.user_id=auth.uid() and om.status='active' and cm.company_id=target_company and cm.status='active'));
$$;

commit;
