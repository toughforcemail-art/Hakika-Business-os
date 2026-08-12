begin;

-- Additive Real Estate vertical slice. Existing properties/units are extended in place.
alter table real_estate.properties
  add column if not exists description text,
  add column if not exists property_type text not null default 'residential',
  add column if not exists registration_number text,
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists county text,
  add column if not exists city_or_town text,
  add column if not exists location text,
  add column if not exists sub_location text,
  add column if not exists postal_code text,
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6),
  add column if not exists year_built integer,
  add column if not exists total_floors integer,
  add column if not exists planned_unit_count integer not null default 0,
  add column if not exists planned_unit_mix jsonb not null default '{}'::jsonb,
  add column if not exists base_rent_amount numeric(14,2),
  add column if not exists currency text not null default 'KES',
  add column if not exists payment_frequency text not null default 'monthly',
  add column if not exists late_payment_penalty_rate numeric(7,4) not null default 0,
  add column if not exists grace_period_days integer not null default 0,
  add column if not exists service_fee_mode text not null default 'none',
  add column if not exists service_fee_value numeric(14,2) not null default 0,
  add column if not exists water_included boolean not null default false,
  add column if not exists electricity_included boolean not null default false,
  add column if not exists internet_included boolean not null default false,
  add column if not exists security_deposit_months numeric(6,2) not null default 0,
  add column if not exists water_deposit_amount numeric(14,2) not null default 0,
  add column if not exists electricity_deposit_amount numeric(14,2) not null default 0,
  add column if not exists manager_name text,
  add column if not exists manager_phone text,
  add column if not exists manager_email text,
  add column if not exists emergency_contact text,
  add column if not exists office_hours text,
  add column if not exists amenities text[] not null default '{}',
  add column if not exists inspection_required_on_move_in boolean not null default true,
  add column if not exists inspection_required_on_move_out boolean not null default true,
  add column if not exists auto_generate_inspection_report boolean not null default false,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

alter table real_estate.units
  add column if not exists currency text not null default 'KES',
  add column if not exists floor_number integer,
  add column if not exists size_value numeric(12,2),
  add column if not exists size_unit text,
  add column if not exists bedrooms integer,
  add column if not exists bathrooms numeric(5,2),
  add column if not exists water_utility_account text,
  add column if not exists electricity_utility_account text,
  add column if not exists has_parking boolean not null default false,
  add column if not exists parking_number text,
  add column if not exists notes text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='real_estate.units'::regclass and conname='units_organization_company_id_key') then
    alter table real_estate.units add constraint units_organization_company_id_key unique (organization_id, company_id, id);
  end if;
end $$;

create table if not exists real_estate.unit_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  company_id uuid not null,
  property_id uuid not null,
  unit_id uuid not null,
  asset_name text not null,
  asset_category text,
  description text,
  serial_number text,
  condition text not null default 'good' check (condition in ('new','good','fair','poor','damaged')),
  quantity integer not null default 1 check (quantity > 0),
  acquisition_date date,
  acquisition_cost numeric(14,2),
  status text not null default 'active' check (status in ('active','missing','disposed','inactive')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references auth.users(id) on delete set null,
  foreign key (organization_id, company_id) references platform.companies(organization_id, id),
  foreign key (organization_id, property_id) references real_estate.properties(organization_id, id),
  foreign key (organization_id, company_id, unit_id) references real_estate.units(organization_id, company_id, id)
);

create table if not exists real_estate.property_photos (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, company_id uuid not null,
  property_id uuid not null, storage_path text not null, caption text, sort_order integer not null default 0,
  is_primary boolean not null default false, created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), archived_at timestamptz,
  foreign key (organization_id, company_id) references platform.companies(organization_id, id),
  foreign key (organization_id, property_id) references real_estate.properties(organization_id, id)
);

create index if not exists properties_directory_idx on real_estate.properties (organization_id, company_id, archived_at, status, created_at desc);
create index if not exists units_directory_idx on real_estate.units (organization_id, company_id, property_id, archived_at, status, created_at desc);
create index if not exists unit_assets_directory_idx on real_estate.unit_assets (organization_id, company_id, property_id, unit_id, archived_at, status);
create index if not exists property_photos_directory_idx on real_estate.property_photos (organization_id, company_id, property_id, archived_at, sort_order);
create unique index if not exists units_active_number_unique on real_estate.units (organization_id, company_id, property_id, lower(unit_number)) where archived_at is null;

alter table real_estate.unit_assets enable row level security;
alter table real_estate.property_photos enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='real_estate' and tablename='properties' and policyname='re_properties_write') then
    create policy re_properties_write on real_estate.properties for all to authenticated
      using (private.has_company_access(organization_id, company_id) and (private.has_permission(organization_id, company_id, 'real_estate.properties.update') or private.has_permission(organization_id, company_id, 'real_estate.properties.archive')))
      with check (private.has_company_access(organization_id, company_id) and (private.has_permission(organization_id, company_id, 'real_estate.properties.update') or private.has_permission(organization_id, company_id, 'real_estate.properties.create')));
  end if;
  if not exists (select 1 from pg_policies where schemaname='real_estate' and tablename='units' and policyname='re_units_write') then
    create policy re_units_write on real_estate.units for all to authenticated
      using (private.has_company_access(organization_id, company_id) and (private.has_permission(organization_id, company_id, 'real_estate.units.update') or private.has_permission(organization_id, company_id, 'real_estate.units.archive')))
      with check (private.has_company_access(organization_id, company_id) and (private.has_permission(organization_id, company_id, 'real_estate.units.update') or private.has_permission(organization_id, company_id, 'real_estate.units.create')));
  end if;
end $$;

create policy unit_assets_select on real_estate.unit_assets for select to authenticated using (private.has_company_access(organization_id, company_id) and private.has_permission(organization_id, company_id, 'real_estate.unit_assets.read'));
create policy unit_assets_write on real_estate.unit_assets for all to authenticated using (private.has_company_access(organization_id, company_id) and (private.has_permission(organization_id, company_id, 'real_estate.unit_assets.update') or private.has_permission(organization_id, company_id, 'real_estate.unit_assets.archive'))) with check (private.has_company_access(organization_id, company_id) and (private.has_permission(organization_id, company_id, 'real_estate.unit_assets.create') or private.has_permission(organization_id, company_id, 'real_estate.unit_assets.update')));
create policy property_photos_select on real_estate.property_photos for select to authenticated using (private.has_company_access(organization_id, company_id) and private.has_permission(organization_id, company_id, 'real_estate.properties.read'));

do $$ begin
  insert into iam.pages (application_id,page_key,route_pattern,name,nav_group,nav_order)
    select id,'properties','/real-estate/properties','Properties','Portfolio',10 from platform.applications where application_key='REAL_ESTATE' on conflict (application_id,page_key) do nothing;
  insert into iam.pages (application_id,page_key,route_pattern,name,nav_group,nav_order)
    select id,'units','/real-estate/units','Units','Portfolio',20 from platform.applications where application_key='REAL_ESTATE' on conflict (application_id,page_key) do nothing;
  insert into iam.permissions (permission_key,application_id,page_id,action,description)
    select v.permission_key,a.id,p.id,v.action,v.description from platform.applications a cross join (values
      ('real_estate.dashboard.read','dashboard','read','Read Real Estate dashboard'),('real_estate.properties.read','properties','read','Read scoped properties'),('real_estate.properties.create','properties','create','Create properties'),('real_estate.properties.update','properties','update','Update properties'),('real_estate.properties.archive','properties','manage','Archive properties'),('real_estate.units.read','units','read','Read scoped units'),('real_estate.units.create','units','create','Create units'),('real_estate.units.update','units','update','Update units'),('real_estate.units.archive','units','manage','Archive units'),('real_estate.unit_assets.read','units','read','Read unit assets'),('real_estate.unit_assets.create','units','create','Create unit assets'),('real_estate.unit_assets.update','units','update','Update unit assets'),('real_estate.unit_assets.archive','units','manage','Archive unit assets')
    ) as v(permission_key,page_key,action,description) join iam.pages p on p.application_id=a.id and p.page_key=v.page_key where a.application_key='REAL_ESTATE' on conflict (permission_key) do nothing;
end $$;

revoke delete on real_estate.properties, real_estate.units, real_estate.unit_assets from authenticated;

commit;
