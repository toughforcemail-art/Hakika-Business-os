begin;

create table if not exists real_estate.tenant_unit_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references platform.organizations(id) on delete cascade,
  company_id uuid references platform.companies(id) on delete set null,
  tenant_id uuid not null,
  lease_id uuid not null,
  from_property_id uuid,
  from_unit_id uuid,
  to_property_id uuid not null,
  to_unit_id uuid not null,
  balance_handling text not null check (balance_handling in ('with_balance','without_balance')),
  effective_date date not null,
  reason text,
  status text not null default 'completed' check (status in ('completed','cancelled')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists tenant_unit_transfers_tenant_idx
  on real_estate.tenant_unit_transfers (organization_id, tenant_id, created_at desc);

alter table real_estate.tenant_unit_transfers enable row level security;
grant select, insert on real_estate.tenant_unit_transfers to authenticated;

create policy tenant_unit_transfers_read on real_estate.tenant_unit_transfers
  for select to authenticated
  using (private.is_platform_operator() or private.has_org_access(organization_id));

create policy tenant_unit_transfers_insert on real_estate.tenant_unit_transfers
  for insert to authenticated
  with check (created_by = auth.uid() and (private.is_platform_operator() or private.has_permission(organization_id, company_id, 'real_estate.leases.update')));

commit;
