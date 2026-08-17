begin;

-- Additive operations foundation. No schedules are activated and no records are seeded.
create table if not exists real_estate.billing_schedules (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, company_id uuid not null,
 name text not null, description text, status text not null default 'draft' check (status in ('draft','active','paused','archived')),
 timezone text not null default 'Africa/Nairobi', frequency text not null default 'monthly', billing_day integer,
 run_time time, invoice_issue_offset_days integer not null default 0, invoice_due_offset_days integer not null default 7,
 billing_period_mode text not null default 'calendar', proration_mode text not null default 'none', duplicate_policy text not null default 'skip',
 approval_mode text not null default 'manual', auto_issue boolean not null default false, send_email boolean not null default false, send_sms boolean not null default false,
 last_run_at timestamptz, next_run_at timestamptz, created_by uuid references auth.users(id) on delete set null, updated_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
 foreign key (organization_id, company_id) references platform.companies(organization_id,id)
);
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='real_estate.billing_schedules'::regclass and conname='billing_schedules_org_id_key') then alter table real_estate.billing_schedules add constraint billing_schedules_org_id_key unique (organization_id,id); end if;
  if not exists (select 1 from pg_constraint where conrelid='real_estate.billing_products'::regclass and conname='billing_products_org_id_key') then alter table real_estate.billing_products add constraint billing_products_org_id_key unique (organization_id,id); end if;
end $$;
create table if not exists real_estate.billing_schedule_items (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, company_id uuid not null, schedule_id uuid not null,
 billing_product_id uuid not null, description text, quantity numeric(12,2) not null default 1, created_at timestamptz not null default now(),
 foreign key (organization_id,company_id) references platform.companies(organization_id,id), foreign key (organization_id,schedule_id) references real_estate.billing_schedules(organization_id,id), foreign key (organization_id,billing_product_id) references real_estate.billing_products(organization_id,id)
);
create table if not exists real_estate.billing_runs (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, company_id uuid not null, schedule_id uuid,
 billing_period date not null, idempotency_key text not null, status text not null default 'queued', invoice_count integer not null default 0,
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), completed_at timestamptz,
 foreign key (organization_id,company_id) references platform.companies(organization_id,id), foreign key (organization_id,schedule_id) references real_estate.billing_schedules(organization_id,id), unique (organization_id,company_id,idempotency_key)
);
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='real_estate.billing_runs'::regclass and conname='billing_runs_org_id_key') then alter table real_estate.billing_runs add constraint billing_runs_org_id_key unique (organization_id,id); end if;
end $$;
create table if not exists real_estate.billing_run_items (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, company_id uuid not null, billing_run_id uuid not null,
 lease_id uuid, invoice_id uuid, status text not null default 'pending', exclusion_reason text, created_at timestamptz not null default now(),
 foreign key (organization_id,company_id) references platform.companies(organization_id,id), foreign key (organization_id,billing_run_id) references real_estate.billing_runs(organization_id,id)
);
create table if not exists real_estate.penalty_rules (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, company_id uuid not null, name text not null,
 mode text not null default 'percentage', grace_period_days integer not null default 0, value numeric(14,4) not null default 0,
 maximum_amount_minor bigint, status text not null default 'active', created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), archived_at timestamptz,
 foreign key (organization_id,company_id) references platform.companies(organization_id,id)
);
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='real_estate.penalty_rules'::regclass and conname='penalty_rules_org_id_key') then alter table real_estate.penalty_rules add constraint penalty_rules_org_id_key unique (organization_id,id); end if;
end $$;
create table if not exists real_estate.invoice_penalties (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, company_id uuid not null, invoice_id uuid not null, penalty_rule_id uuid,
 amount_minor bigint not null check (amount_minor >= 0), status text not null default 'applied', reason text, created_at timestamptz not null default now(), waived_at timestamptz,
 foreign key (organization_id,company_id) references platform.companies(organization_id,id), foreign key (organization_id,invoice_id) references real_estate.invoices(organization_id,id), foreign key (organization_id,penalty_rule_id) references real_estate.penalty_rules(organization_id,id)
);
create table if not exists real_estate.collection_cases (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, company_id uuid not null, tenant_id uuid not null,
 stage text not null default 'new', oldest_due_date date, balance_due_minor bigint not null default 0, last_contacted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key (organization_id,company_id) references platform.companies(organization_id,id), foreign key (organization_id,tenant_id) references real_estate.tenants(organization_id,id)
);
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='real_estate.collection_cases'::regclass and conname='collection_cases_org_id_key') then alter table real_estate.collection_cases add constraint collection_cases_org_id_key unique (organization_id,id); end if;
end $$;
create table if not exists real_estate.collection_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, company_id uuid not null, case_id uuid not null, event_type text not null, notes text, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 foreign key (organization_id,company_id) references platform.companies(organization_id,id), foreign key (organization_id,case_id) references real_estate.collection_cases(organization_id,id)
);
create table if not exists real_estate.utility_meters (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, company_id uuid not null, meter_number text not null, utility_type text not null, scope text not null default 'unit', property_id uuid, unit_id uuid, measurement_unit text not null default 'unit', installation_date date, initial_reading numeric(14,3) not null default 0, provider text, account_number text, status text not null default 'active', created_at timestamptz not null default now(), archived_at timestamptz,
 foreign key (organization_id,company_id) references platform.companies(organization_id,id), foreign key (organization_id,property_id) references real_estate.properties(organization_id,id), foreign key (organization_id,company_id,unit_id) references real_estate.units(organization_id,company_id,id), unique (organization_id,company_id,meter_number)
);
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='real_estate.utility_meters'::regclass and conname='utility_meters_org_id_key') then alter table real_estate.utility_meters add constraint utility_meters_org_id_key unique (organization_id,id); end if;
end $$;
create table if not exists real_estate.utility_readings (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, company_id uuid not null, meter_id uuid not null, reading_date date not null, previous_reading numeric(14,3) not null, current_reading numeric(14,3) not null, consumption numeric(14,3) generated always as (current_reading - previous_reading) stored, reading_type text not null default 'actual', notes text, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), foreign key (organization_id,company_id) references platform.companies(organization_id,id), foreign key (organization_id,meter_id) references real_estate.utility_meters(organization_id,id), check (current_reading >= previous_reading), unique (organization_id,company_id,meter_id,reading_date)
);
create table if not exists real_estate.inspection_templates (id uuid primary key default gen_random_uuid(), organization_id uuid not null, company_id uuid not null, name text not null, inspection_type text not null, status text not null default 'active', created_at timestamptz not null default now(), foreign key (organization_id,company_id) references platform.companies(organization_id,id));
create table if not exists real_estate.inspections (id uuid primary key default gen_random_uuid(), organization_id uuid not null, company_id uuid not null, tenant_id uuid, property_id uuid, unit_id uuid, template_id uuid, inspection_type text not null, status text not null default 'draft', scheduled_at timestamptz, completed_at timestamptz, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), foreign key (organization_id,company_id) references platform.companies(organization_id,id));
create table if not exists real_estate.maintenance_requests (id uuid primary key default gen_random_uuid(), organization_id uuid not null, company_id uuid not null, tenant_id uuid, property_id uuid, unit_id uuid, title text not null, description text, priority text not null default 'normal', status text not null default 'new', created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), foreign key (organization_id,company_id) references platform.companies(organization_id,id));
create table if not exists real_estate_notes (id uuid primary key default gen_random_uuid(), organization_id uuid not null, company_id uuid not null, property_id uuid, unit_id uuid, tenant_id uuid, lease_id uuid, inspection_id uuid, maintenance_request_id uuid, body text not null, visibility text not null default 'internal', created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), archived_at timestamptz, foreign key (organization_id,company_id) references platform.companies(organization_id,id));

do $$ declare t text; begin foreach t in array array['billing_schedules','billing_schedule_items','billing_runs','billing_run_items','penalty_rules','invoice_penalties','collection_cases','collection_events','utility_meters','utility_readings','inspection_templates','inspections','maintenance_requests'] loop execute format('alter table real_estate.%I enable row level security',t); end loop; alter table real_estate_notes enable row level security; end $$;

insert into iam.permissions(permission_key,action,description) values
 ('real_estate.billing_schedules.read','read','Read billing schedules'),('real_estate.billing_schedules.manage','manage','Manage billing schedules'),('real_estate.billing_runs.preview','read','Preview billing runs'),('real_estate.billing_runs.execute','approve','Execute billing runs'),('real_estate.billing_runs.retry','manage','Retry failed billing items'),('real_estate.penalties.read','read','Read penalties'),('real_estate.penalties.manage','manage','Manage penalties'),('real_estate.penalties.waive','manage','Waive penalties'),('real_estate.collections.read','read','Read collections'),('real_estate.collections.manage','manage','Manage collections'),('real_estate.utilities.read','read','Read utilities'),('real_estate.utilities.meters.manage','manage','Manage meters'),('real_estate.utilities.readings.create','create','Create readings'),('real_estate.utilities.billing.execute','approve','Execute utility billing'),('real_estate.inspections.read','read','Read inspections'),('real_estate.inspections.create','create','Create inspections'),('real_estate.inspections.complete','update','Complete inspections'),('real_estate.inspections.approve','approve','Approve inspections'),('real_estate.inspection_templates.manage','manage','Manage inspection templates'),('real_estate.maintenance.read','read','Read maintenance'),('real_estate.maintenance.create','create','Create maintenance requests'),('real_estate.maintenance.assign','manage','Assign maintenance'),('real_estate.maintenance.complete','update','Complete maintenance'),('real_estate.notes.read','read','Read notes'),('real_estate.notes.create','create','Create notes'),('real_estate.reports.read','read','Read reports'),('real_estate.reports.export','export','Export reports'),('real_estate.communications.send','manage','Send communications') on conflict(permission_key) do nothing;
commit;
