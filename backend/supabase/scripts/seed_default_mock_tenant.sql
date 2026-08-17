-- Development/test data only.
-- Creates one Mock Tenant in the first active customer organization and assigns
-- the first vacant/reserved unit in that organization's first property.

begin;

do $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_property_id uuid;
  v_company_id uuid;
  v_property_company_id uuid;
  v_unit_company_id uuid;
  v_unit_id uuid;
  v_tenant_id uuid;
  v_rent_minor bigint;
  v_rent_deposit_minor bigint;
  v_water_deposit_minor bigint;
  v_electricity_deposit_minor bigint;
  v_unit_number text := 'MOCK-UNIT-001';
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower('1kihiupaul@gmail.com')
  limit 1;

  -- Prefer the organization the signed-in operator actually uses. This keeps
  -- the seeded record visible in the current application context. If the
  -- operator has no membership, fall back to the first active customer org.
  select organization_id into v_org_id
  from iam.organization_memberships
  where user_id = v_user_id
    and status = 'active'
  order by joined_at nulls last, created_at
  limit 1;

  if v_org_id is null then
    select id into v_org_id
    from platform.organizations
    where status = 'active'
    order by case when organization_type = 'customer' then 0 else 1 end, created_at
    limit 1;
  end if;

  select cm.company_id into v_company_id
  from iam.organization_memberships om
  join iam.company_memberships cm
    on cm.organization_membership_id = om.id
   and cm.organization_id = om.organization_id
   and cm.status = 'active'
  where om.user_id = v_user_id
    and om.organization_id = v_org_id
    and om.status = 'active'
  order by cm.created_at
  limit 1;

  -- Select the only/first property first. Its company scope, if any, becomes
  -- the scope of the tenant and lease. This also supports company_id = NULL.
  select id, company_id into v_property_id, v_property_company_id
  from real_estate.properties
  where organization_id = v_org_id
    and (v_company_id is null or company_id = v_company_id)
    and archived_at is null
  order by created_at
  limit 1;

  select id into v_tenant_id
  from real_estate.tenants
  where organization_id = v_org_id
    and tenant_number = 'MOCK-TNT-001'
    and archived_at is null
  limit 1;

  if v_tenant_id is not null then
    raise notice 'Mock tenant already exists: %', v_tenant_id;
    return;
  end if;

  select
    id,
    company_id,
    monthly_rent_minor,
    round(coalesce(rent_deposit_amount, 0) * 100),
    round(coalesce(water_bill_amount, 0) * 100),
    round(coalesce(electricity_bill_amount, 0) * 100)
  into
    v_unit_id,
    v_unit_company_id,
    v_rent_minor,
    v_rent_deposit_minor,
    v_water_deposit_minor,
    v_electricity_deposit_minor
  from real_estate.units
  where organization_id = v_org_id
    and property_id = v_property_id
    and status not in ('occupied', 'maintenance', 'inactive')
    and archived_at is null
    and not exists (
      select 1
      from real_estate.leases l
      where l.organization_id = v_org_id
        and l.unit_id = real_estate.units.id
        and l.status = 'active'
        and l.archived_at is null
    )
  order by created_at
  limit 1;

  v_company_id := coalesce(v_unit_company_id, v_property_company_id);

  if v_user_id is null then raise exception 'User 1kihiupaul@gmail.com was not found'; end if;
  if v_org_id is null then raise exception 'No active organization found'; end if;
  if v_property_id is null then raise exception 'No property found in the default organization'; end if;
  if v_unit_id is null then
    while exists (
      select 1
      from real_estate.units
      where organization_id = v_org_id
        and property_id = v_property_id
        and unit_number = v_unit_number
    ) loop
      v_unit_number := 'MOCK-UNIT-' || (substring(v_unit_number from '[0-9]+')::integer + 1)::text;
    end loop;

    insert into real_estate.units (
      organization_id,
      company_id,
      property_id,
      unit_number,
      unit_type,
      monthly_rent_minor,
      status,
      rent_deposit_amount,
      water_bill_amount,
      electricity_bill_amount,
      created_at,
      updated_at
    ) values (
      v_org_id,
      v_company_id,
      v_property_id,
      v_unit_number,
      'mock_unit',
      2500000,
      'vacant',
      25000,
      0,
      0,
      now(),
      now()
    ) returning id into v_unit_id;

    v_rent_minor := 2500000;
    v_rent_deposit_minor := 2500000;
    v_water_deposit_minor := 0;
    v_electricity_deposit_minor := 0;
  end if;

  insert into real_estate.tenants (
    organization_id, company_id, full_name, tenant_number, email, phone,
    id_type, national_id, status, notes, created_by
  ) values (
    v_org_id, v_company_id, 'Mock Tenant', 'MOCK-TNT-001',
    'mock.tenant@example.com', '+254700000001', 'national_id',
    'MOCK-ID-001', 'active', 'TEST DATA — safe to archive or delete.', v_user_id
  ) returning id into v_tenant_id;

  insert into real_estate.leases (
    organization_id, company_id, tenant_id, property_id, unit_id,
    lease_number, start_date, status, rent_amount_minor, currency,
    deposit_amount_minor, water_deposit_amount_minor,
    electricity_deposit_amount_minor, activated_at, created_by
  ) values (
    v_org_id, v_company_id, v_tenant_id, v_property_id, v_unit_id,
    'MOCK-LEASE-001', current_date, 'active', coalesce(v_rent_minor, 0), 'KES',
    coalesce(v_rent_deposit_minor, 0), coalesce(v_water_deposit_minor, 0),
    coalesce(v_electricity_deposit_minor, 0), now(), v_user_id
  );

  update real_estate.units
  set status = 'occupied', updated_at = now()
  where id = v_unit_id and organization_id = v_org_id;

  raise notice 'Mock tenant created: %', v_tenant_id;
end $$;

commit;
