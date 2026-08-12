-- Hakika Business OS - clean foundation for a NEW Supabase project.
-- Review and run first in a disposable Supabase project. Do not apply to the legacy database.
begin;

create extension if not exists pgcrypto;
create extension if not exists citext;

create schema if not exists platform;
create schema if not exists iam;
create schema if not exists billing;
create schema if not exists audit;
create schema if not exists communications;
create schema if not exists integrations;
create schema if not exists real_estate;
create schema if not exists private;

-- ---------- shared helpers ----------
create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- platform + identity ----------
create table platform.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug = lower(slug)),
  display_name text not null,
  legal_name text,
  organization_type text not null check (organization_type in ('platform_owner','customer')),
  status text not null default 'active' check (status in ('pending','active','suspended','archived')),
  billing_exempt boolean not null default false,
  timezone text not null default 'Africa/Nairobi',
  currency_code char(3) not null default 'KES',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create unique index one_platform_owner_organization
  on platform.organizations ((organization_type))
  where organization_type = 'platform_owner' and status <> 'archived';

create table platform.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references platform.organizations(id) on delete restrict,
  code text not null,
  name text not null,
  slug text not null,
  is_default boolean not null default false,
  status text not null default 'active' check (status in ('pending','active','suspended','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (organization_id, slug),
  unique (organization_id, id)
);

create unique index one_default_company_per_org
  on platform.companies (organization_id)
  where is_default and status <> 'archived';

create table iam.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  phone_e164 text,
  avatar_path text,
  status text not null default 'active' check (status in ('pending','active','suspended','disabled')),
  locale text not null default 'en-KE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table iam.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references platform.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('invited','active','suspended','revoked')),
  joined_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (organization_id, id)
);

create table iam.company_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_membership_id uuid not null,
  organization_id uuid not null,
  company_id uuid not null,
  status text not null default 'active' check (status in ('active','suspended','revoked')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, organization_membership_id)
    references iam.organization_memberships(organization_id, id) on delete cascade,
  foreign key (organization_id, company_id)
    references platform.companies(organization_id, id) on delete cascade,
  unique (organization_membership_id, company_id)
);

create table platform.applications (
  id uuid primary key default gen_random_uuid(),
  application_key text not null unique check (application_key = upper(application_key)),
  name text not null,
  description text,
  is_core boolean not null default false,
  status text not null default 'active' check (status in ('active','preview','retired')),
  launcher_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table iam.pages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references platform.applications(id) on delete cascade,
  page_key text not null,
  route_pattern text not null,
  name text not null,
  nav_group text,
  nav_order integer not null default 0,
  is_visible_in_nav boolean not null default true,
  unique (application_id, page_key),
  unique (application_id, route_pattern)
);

create table iam.permissions (
  id uuid primary key default gen_random_uuid(),
  permission_key text not null unique,
  application_id uuid references platform.applications(id) on delete cascade,
  page_id uuid references iam.pages(id) on delete cascade,
  action text not null check (action in ('read','create','update','delete','approve','export','manage','preview_portal')),
  description text
);

create table iam.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references platform.organizations(id) on delete cascade,
  application_id uuid references platform.applications(id) on delete cascade,
  role_key text not null,
  name text not null,
  scope text not null check (scope in ('platform','organization','application')),
  is_system boolean not null default false,
  is_read_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index roles_unique_platform
  on iam.roles (role_key) where organization_id is null;
create unique index roles_unique_org
  on iam.roles (organization_id, role_key) where organization_id is not null;

create table iam.role_permissions (
  role_id uuid not null references iam.roles(id) on delete cascade,
  permission_id uuid not null references iam.permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table iam.member_app_roles (
  id uuid primary key default gen_random_uuid(),
  organization_membership_id uuid not null references iam.organization_memberships(id) on delete cascade,
  organization_id uuid not null references platform.organizations(id) on delete cascade,
  company_id uuid references platform.companies(id) on delete cascade,
  application_id uuid not null references platform.applications(id) on delete cascade,
  role_id uuid not null references iam.roles(id) on delete restrict,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique nulls not distinct (organization_membership_id, company_id, application_id, role_id)
);

create table iam.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references platform.organizations(id) on delete cascade,
  email citext not null,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null,
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table iam.invitation_company_assignments (
  invitation_id uuid not null references iam.invitations(id) on delete cascade,
  company_id uuid not null references platform.companies(id) on delete cascade,
  primary key (invitation_id, company_id)
);

create table iam.invitation_role_assignments (
  invitation_id uuid not null references iam.invitations(id) on delete cascade,
  application_id uuid not null references platform.applications(id) on delete cascade,
  role_id uuid not null references iam.roles(id) on delete restrict,
  primary key (invitation_id, application_id, role_id)
);

-- ---------- subscriptions ----------
create table billing.plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null unique,
  name text not null,
  interval text not null check (interval in ('month','year','custom')),
  price_minor bigint not null default 0 check (price_minor >= 0),
  currency_code char(3) not null default 'KES',
  status text not null default 'active' check (status in ('active','retired')),
  created_at timestamptz not null default now()
);

create table billing.application_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references platform.organizations(id) on delete cascade,
  application_id uuid not null references platform.applications(id) on delete restrict,
  plan_id uuid references billing.plans(id) on delete restrict,
  status text not null check (status in ('trial','active','grace','past_due','suspended','cancelled')),
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_ends_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, application_id)
);

-- ---------- immutable audit + controlled UI telemetry ----------
create table audit.events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  request_id uuid,
  correlation_id uuid,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name_snapshot text,
  actor_email_snapshot citext,
  actor_type text not null default 'user' check (actor_type in ('user','system','service','support_preview')),
  organization_id uuid references platform.organizations(id) on delete restrict,
  company_id uuid references platform.companies(id) on delete restrict,
  application_key text not null,
  page_key text,
  action_key text not null,
  outcome text not null default 'success' check (outcome in ('success','failure','denied')),
  entity_type text,
  entity_id uuid,
  entity_label text,
  summary text not null,
  before_data jsonb,
  after_data jsonb,
  changed_fields text[],
  ip_hash text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb
);

create index audit_events_org_time on audit.events (organization_id, occurred_at desc);
create index audit_events_actor_time on audit.events (actor_user_id, occurred_at desc);
create index audit_events_entity on audit.events (entity_type, entity_id, occurred_at desc);
create index audit_events_action on audit.events (application_key, action_key, occurred_at desc);

create table audit.ui_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  session_id uuid not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  organization_id uuid references platform.organizations(id) on delete cascade,
  company_id uuid references platform.companies(id) on delete cascade,
  application_key text not null,
  page_key text,
  event_name text not null,
  element_key text,
  properties jsonb not null default '{}'::jsonb
);

comment on table audit.events is 'Immutable business/security audit trail shown in Platform Admin and organization audit pages.';
comment on table audit.ui_events is 'Controlled product analytics. Do not send passwords, tokens, message bodies, form values, IDs, or sensitive personal data.';

create or replace view audit.platform_event_feed as
select
  e.id, e.occurred_at, e.organization_id, o.display_name as organization_name,
  e.company_id, c.name as company_name, e.actor_user_id,
  coalesce(e.actor_name_snapshot, e.actor_email_snapshot::text, 'System') as actor,
  e.application_key, e.page_key, e.action_key, e.outcome,
  e.entity_type, e.entity_id, e.entity_label, e.summary, e.metadata
from audit.events e
left join platform.organizations o on o.id = e.organization_id
left join platform.companies c on c.id = e.company_id;

create or replace function private.block_audit_mutation()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  raise exception 'audit events are immutable';
end;
$$;
create trigger audit_events_immutable
before update or delete on audit.events
for each row execute function private.block_audit_mutation();

-- ---------- Real Estate reference entities ----------
create table real_estate.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references platform.organizations(id) on delete restrict,
  company_id uuid not null,
  name text not null,
  property_code text not null,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  address jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (organization_id, company_id) references platform.companies(organization_id, id),
  unique (organization_id, company_id, property_code),
  unique (organization_id, id)
);

create table real_estate.units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  company_id uuid not null,
  property_id uuid not null,
  unit_number text not null,
  unit_type text,
  monthly_rent_minor bigint not null default 0 check (monthly_rent_minor >= 0),
  status text not null default 'vacant' check (status in ('vacant','reserved','occupied','maintenance','inactive')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (organization_id, company_id) references platform.companies(organization_id, id),
  foreign key (organization_id, property_id) references real_estate.properties(organization_id, id),
  unique (organization_id, property_id, unit_number),
  unique (organization_id, id)
);

create table real_estate.tenants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references platform.organizations(id) on delete restrict,
  company_id uuid not null,
  full_name text not null,
  email citext,
  phone_e164 text,
  status text not null default 'active' check (status in ('prospect','active','former','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (organization_id, company_id) references platform.companies(organization_id, id),
  unique (organization_id, id)
);

create table real_estate.landlords (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references platform.organizations(id) on delete restrict,
  company_id uuid not null,
  full_name text not null,
  email citext,
  phone_e164 text,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, company_id) references platform.companies(organization_id, id),
  unique (organization_id, id)
);

create table real_estate.caretakers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references platform.organizations(id) on delete restrict,
  company_id uuid not null,
  full_name text not null,
  email citext,
  phone_e164 text,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, company_id) references platform.companies(organization_id, id),
  unique (organization_id, id)
);

create table real_estate.leases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  company_id uuid not null,
  unit_id uuid not null,
  tenant_id uuid not null,
  lease_number text not null,
  start_date date not null,
  end_date date,
  monthly_rent_minor bigint not null check (monthly_rent_minor >= 0),
  due_day smallint not null default 5 check (due_day between 1 and 28),
  status text not null default 'draft' check (status in ('draft','active','notice','ended','cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, company_id) references platform.companies(organization_id, id),
  foreign key (organization_id, unit_id) references real_estate.units(organization_id, id),
  foreign key (organization_id, tenant_id) references real_estate.tenants(organization_id, id),
  unique (organization_id, lease_number),
  unique (organization_id, id),
  check (end_date is null or end_date >= start_date)
);

create unique index one_active_lease_per_unit
  on real_estate.leases (organization_id, unit_id)
  where status in ('active','notice');

-- ---------- monthly auto-billing ----------
create table real_estate.billing_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references platform.organizations(id) on delete cascade,
  company_id uuid not null,
  name text not null,
  timezone text not null default 'Africa/Nairobi',
  issue_day smallint not null check (issue_day between 1 and 28),
  issue_time time not null default '06:00',
  due_day smallint not null check (due_day between 1 and 28),
  approval_mode text not null default 'preview_required' check (approval_mode in ('preview_required','automatic')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, company_id) references platform.companies(organization_id, id),
  unique (organization_id, company_id, name)
);

create table real_estate.reminder_rules (
  id uuid primary key default gen_random_uuid(),
  billing_schedule_id uuid not null references real_estate.billing_schedules(id) on delete cascade,
  offset_days integer not null,
  send_time time not null default '09:00',
  channel text not null check (channel in ('sms','email','whatsapp','in_app')),
  template_key text not null,
  is_active boolean not null default true,
  unique (billing_schedule_id, offset_days, channel, template_key)
);

create table real_estate.invoice_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references platform.organizations(id) on delete restrict,
  company_id uuid not null,
  billing_schedule_id uuid references real_estate.billing_schedules(id) on delete restrict,
  billing_month date not null check (billing_month = date_trunc('month', billing_month)::date),
  idempotency_key text not null,
  status text not null default 'queued' check (status in ('queued','preview','approved','processing','completed','failed','cancelled')),
  started_at timestamptz,
  completed_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  error_summary text,
  created_at timestamptz not null default now(),
  foreign key (organization_id, company_id) references platform.companies(organization_id, id),
  unique (organization_id, idempotency_key),
  unique (organization_id, company_id, billing_schedule_id, billing_month)
);

create table real_estate.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  company_id uuid not null,
  lease_id uuid not null,
  tenant_id uuid not null,
  invoice_run_id uuid references real_estate.invoice_runs(id) on delete restrict,
  invoice_number text not null,
  billing_month date not null check (billing_month = date_trunc('month', billing_month)::date),
  issue_date date not null,
  due_date date not null,
  currency_code char(3) not null default 'KES',
  subtotal_minor bigint not null default 0,
  total_minor bigint not null default 0,
  balance_minor bigint not null default 0,
  status text not null default 'draft' check (status in ('draft','issued','part_paid','paid','overdue','void')),
  issued_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, company_id) references platform.companies(organization_id, id),
  foreign key (organization_id, lease_id) references real_estate.leases(organization_id, id),
  foreign key (organization_id, tenant_id) references real_estate.tenants(organization_id, id),
  unique (organization_id, invoice_number),
  unique (organization_id, lease_id, billing_month),
  unique (organization_id, id),
  check (due_date >= issue_date),
  check (subtotal_minor >= 0 and total_minor >= 0 and balance_minor >= 0)
);

create table real_estate.invoice_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  invoice_id uuid not null,
  item_type text not null,
  description text not null,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit_amount_minor bigint not null,
  line_total_minor bigint not null,
  service_period_start date,
  service_period_end date,
  metadata jsonb not null default '{}'::jsonb,
  foreign key (organization_id, invoice_id) references real_estate.invoices(organization_id, id) on delete cascade
);

-- ---------- Safaricom Business One Account / Daraja ----------
create table integrations.mpesa_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references platform.organizations(id) on delete restrict,
  account_name text not null,
  shortcode text not null,
  account_type text not null check (account_type in ('business_one_account','paybill','till')),
  environment text not null check (environment in ('sandbox','production')),
  collection_enabled boolean not null default true,
  disbursement_enabled boolean not null default false,
  status text not null default 'pending' check (status in ('pending','active','suspended','retired')),
  secret_reference text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shortcode, environment)
);

create table integrations.mpesa_account_references (
  id uuid primary key default gen_random_uuid(),
  mpesa_account_id uuid not null references integrations.mpesa_accounts(id) on delete cascade,
  organization_id uuid not null references platform.organizations(id) on delete cascade,
  company_id uuid references platform.companies(id) on delete cascade,
  application_key text not null,
  entity_type text not null,
  entity_id uuid not null,
  customer_reference text not null,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  unique (mpesa_account_id, customer_reference),
  unique (mpesa_account_id, entity_type, entity_id)
);

create table integrations.mpesa_callbacks (
  id uuid primary key default gen_random_uuid(),
  mpesa_account_id uuid references integrations.mpesa_accounts(id) on delete restrict,
  callback_type text not null,
  provider_request_id text,
  received_at timestamptz not null default now(),
  payload_hash text not null,
  raw_payload jsonb not null,
  processing_status text not null default 'received' check (processing_status in ('received','processed','duplicate','rejected','failed')),
  processed_at timestamptz,
  failure_reason text,
  unique (callback_type, payload_hash)
);

create table integrations.mpesa_transactions (
  id uuid primary key default gen_random_uuid(),
  mpesa_account_id uuid not null references integrations.mpesa_accounts(id) on delete restrict,
  callback_id uuid references integrations.mpesa_callbacks(id) on delete restrict,
  provider_receipt text not null,
  provider_request_id text,
  transaction_type text not null check (transaction_type in ('c2b','stk','b2c','b2b','reversal','adjustment')),
  direction text not null check (direction in ('credit','debit')),
  occurred_at timestamptz not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency_code char(3) not null default 'KES',
  payer_phone_masked text,
  customer_reference text,
  status text not null check (status in ('pending','completed','failed','reversed','unknown')),
  raw_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (mpesa_account_id, provider_receipt),
  unique (mpesa_account_id, id)
);

create table real_estate.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references platform.organizations(id) on delete restrict,
  company_id uuid not null,
  tenant_id uuid references real_estate.tenants(id) on delete restrict,
  external_transaction_id uuid references integrations.mpesa_transactions(id) on delete restrict,
  payment_reference text not null,
  paid_at timestamptz not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency_code char(3) not null default 'KES',
  status text not null default 'received' check (status in ('received','part_allocated','allocated','reversed','refunded')),
  created_at timestamptz not null default now(),
  foreign key (organization_id, company_id) references platform.companies(organization_id, id),
  unique (organization_id, payment_reference),
  unique (organization_id, id)
);

create table real_estate.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  payment_id uuid not null,
  invoice_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  allocated_by uuid references auth.users(id) on delete set null,
  allocated_at timestamptz not null default now(),
  reversal_of uuid references real_estate.payment_allocations(id) on delete restrict,
  foreign key (organization_id, payment_id) references real_estate.payments(organization_id, id),
  foreign key (organization_id, invoice_id) references real_estate.invoices(organization_id, id)
);

create table real_estate.split_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references platform.organizations(id) on delete cascade,
  company_id uuid not null,
  property_id uuid references real_estate.properties(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft','active','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, company_id) references platform.companies(organization_id, id),
  unique (organization_id, company_id, name),
  unique (organization_id, id)
);

create table real_estate.split_rule_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  split_rule_id uuid not null,
  version_no integer not null,
  effective_from timestamptz not null,
  effective_until timestamptz,
  rule_definition jsonb not null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id, split_rule_id) references real_estate.split_rules(organization_id, id) on delete cascade,
  unique (split_rule_id, version_no),
  unique (organization_id, id),
  check (effective_until is null or effective_until > effective_from)
);

create table real_estate.split_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  payment_allocation_id uuid not null references real_estate.payment_allocations(id) on delete restrict,
  split_rule_version_id uuid not null,
  beneficiary_type text not null check (beneficiary_type in ('landlord','organization','supplier','tax','other')),
  beneficiary_id uuid,
  amount_minor bigint not null check (amount_minor >= 0),
  status text not null default 'pending' check (status in ('pending','approved','queued','paid','failed','reversed')),
  created_at timestamptz not null default now(),
  foreign key (organization_id, split_rule_version_id) references real_estate.split_rule_versions(organization_id, id)
);

create table integrations.mpesa_payout_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references platform.organizations(id) on delete restrict,
  mpesa_account_id uuid not null references integrations.mpesa_accounts(id) on delete restrict,
  idempotency_key text not null,
  beneficiary_type text not null,
  beneficiary_id uuid,
  phone_e164 text,
  amount_minor bigint not null check (amount_minor > 0),
  purpose text not null,
  status text not null default 'queued' check (status in ('queued','submitted','completed','failed','unknown','reversed')),
  provider_conversation_id text,
  attempts integer not null default 0,
  next_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mpesa_account_id, idempotency_key)
);

-- ---------- portals + messaging ----------
create table real_estate.portal_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references platform.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  portal_type text not null check (portal_type in ('tenant','landlord','caretaker')),
  entity_id uuid not null,
  status text not null default 'active' check (status in ('invited','active','suspended','revoked')),
  read_only boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, portal_type, entity_id)
);

create table real_estate.portal_preview_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references platform.organizations(id) on delete cascade,
  portal_type text not null check (portal_type in ('tenant','landlord','caretaker')),
  entity_id uuid not null,
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table communications.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references platform.organizations(id) on delete cascade,
  company_id uuid references platform.companies(id) on delete cascade,
  application_key text not null,
  subject text,
  status text not null default 'open' check (status in ('open','closed','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table communications.conversation_participants (
  conversation_id uuid not null references communications.conversations(id) on delete cascade,
  participant_type text not null check (participant_type in ('user','tenant','landlord','caretaker','team')),
  participant_id uuid not null,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (conversation_id, participant_type, participant_id)
);

create table communications.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  conversation_id uuid not null,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_type text not null check (sender_type in ('user','tenant','landlord','caretaker','system')),
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  foreign key (organization_id, conversation_id) references communications.conversations(organization_id, id),
  unique (organization_id, id)
);

create table communications.message_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  message_id uuid not null,
  recipient_type text not null check (recipient_type in ('user','tenant','landlord','caretaker')),
  recipient_id uuid not null,
  channel text not null check (channel in ('in_app','email','sms','whatsapp')),
  status text not null default 'queued' check (status in ('queued','sent','delivered','failed','read')),
  provider_message_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failure_reason text,
  foreign key (organization_id, message_id) references communications.messages(organization_id, id),
  unique (message_id, recipient_type, recipient_id, channel)
);

-- ---------- authorization helpers ----------
create or replace function private.has_org_access(target_org uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, iam as $$
  select exists (
    select 1 from iam.organization_memberships m
    where m.organization_id = target_org
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function private.has_company_access(target_org uuid, target_company uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, iam as $$
  select exists (
    select 1
    from iam.company_memberships cm
    join iam.organization_memberships om on om.id = cm.organization_membership_id
    where om.organization_id = target_org and om.user_id = auth.uid()
      and om.status = 'active' and cm.company_id = target_company and cm.status = 'active'
  );
$$;

create or replace function private.has_permission(target_org uuid, target_company uuid, wanted text)
returns boolean language sql stable security definer
set search_path = pg_catalog, iam, platform as $$
  select exists (
    select 1
    from iam.organization_memberships om
    join iam.member_app_roles mar on mar.organization_membership_id = om.id
    join iam.role_permissions rp on rp.role_id = mar.role_id
    join iam.permissions p on p.id = rp.permission_id
    where om.organization_id = target_org and om.user_id = auth.uid() and om.status = 'active'
      and mar.organization_id = target_org
      and (mar.company_id is null or mar.company_id = target_company)
      and mar.valid_from <= now() and (mar.valid_until is null or mar.valid_until > now())
      and p.permission_key = wanted
  );
$$;

-- ---------- RLS baseline examples; repeat equivalent policy patterns for all domain tables ----------
alter table platform.organizations enable row level security;
alter table platform.companies enable row level security;
alter table iam.profiles enable row level security;
alter table iam.organization_memberships enable row level security;
alter table iam.company_memberships enable row level security;
alter table billing.application_subscriptions enable row level security;
alter table audit.events enable row level security;
alter table audit.ui_events enable row level security;
alter table real_estate.properties enable row level security;
alter table real_estate.units enable row level security;
alter table real_estate.tenants enable row level security;
alter table real_estate.leases enable row level security;
alter table real_estate.invoices enable row level security;
alter table real_estate.payments enable row level security;
alter table communications.conversations enable row level security;
alter table communications.messages enable row level security;

create policy organizations_select_member on platform.organizations
for select to authenticated using (private.has_org_access(id));

create policy companies_select_member on platform.companies
for select to authenticated using (private.has_company_access(organization_id, id));

create policy profiles_select_self on iam.profiles
for select to authenticated using (user_id = auth.uid());

create policy memberships_select_self on iam.organization_memberships
for select to authenticated using (user_id = auth.uid());

create policy company_memberships_select_self on iam.company_memberships
for select to authenticated using (
  exists (select 1 from iam.organization_memberships om
          where om.id = organization_membership_id and om.user_id = auth.uid())
);

create policy subscriptions_select_member on billing.application_subscriptions
for select to authenticated using (private.has_org_access(organization_id));

create policy audit_select_org_authorized on audit.events
for select to authenticated using (
  private.has_permission(organization_id, company_id, 'admin.audit.read')
  or private.has_permission(organization_id, company_id, 'platform.audit.read')
);

create policy audit_insert_authenticated on audit.events
for insert to authenticated with check (
  actor_user_id = auth.uid() and private.has_org_access(organization_id)
);

create policy ui_event_insert_self on audit.ui_events
for insert to authenticated with check (
  actor_user_id = auth.uid() and private.has_org_access(organization_id)
);

create policy re_properties_select on real_estate.properties
for select to authenticated using (
  private.has_company_access(organization_id, company_id)
  and private.has_permission(organization_id, company_id, 'real_estate.properties.read')
);
create policy re_properties_insert on real_estate.properties
for insert to authenticated with check (
  private.has_company_access(organization_id, company_id)
  and private.has_permission(organization_id, company_id, 'real_estate.properties.create')
);
create policy re_properties_update on real_estate.properties
for update to authenticated
using (private.has_permission(organization_id, company_id, 'real_estate.properties.update'))
with check (private.has_company_access(organization_id, company_id));

create policy re_units_select on real_estate.units
for select to authenticated using (
  private.has_company_access(organization_id, company_id)
  and private.has_permission(organization_id, company_id, 'real_estate.units.read')
);
create policy re_tenants_select on real_estate.tenants
for select to authenticated using (
  private.has_company_access(organization_id, company_id)
  and private.has_permission(organization_id, company_id, 'real_estate.tenants.read')
);
create policy re_leases_select on real_estate.leases
for select to authenticated using (
  private.has_company_access(organization_id, company_id)
  and private.has_permission(organization_id, company_id, 'real_estate.leases.read')
);
create policy re_invoices_select on real_estate.invoices
for select to authenticated using (
  private.has_company_access(organization_id, company_id)
  and private.has_permission(organization_id, company_id, 'real_estate.invoices.read')
);
create policy re_payments_select on real_estate.payments
for select to authenticated using (
  private.has_company_access(organization_id, company_id)
  and private.has_permission(organization_id, company_id, 'real_estate.payments.read')
);

-- ---------- updated_at triggers ----------
do $$
declare t regclass;
begin
  foreach t in array array[
    'platform.organizations'::regclass, 'platform.companies'::regclass,
    'iam.profiles'::regclass, 'iam.organization_memberships'::regclass,
    'iam.company_memberships'::regclass, 'iam.roles'::regclass,
    'billing.application_subscriptions'::regclass,
    'real_estate.properties'::regclass, 'real_estate.units'::regclass,
    'real_estate.tenants'::regclass, 'real_estate.landlords'::regclass,
    'real_estate.caretakers'::regclass, 'real_estate.leases'::regclass,
    'real_estate.billing_schedules'::regclass, 'real_estate.invoices'::regclass,
    'real_estate.split_rules'::regclass, 'integrations.mpesa_accounts'::regclass,
    'integrations.mpesa_payout_jobs'::regclass, 'real_estate.portal_grants'::regclass,
    'communications.conversations'::regclass
  ]
  loop
    execute format('create trigger set_updated_at before update on %s for each row execute function private.set_updated_at()', t);
  end loop;
end $$;

-- ---------- seed stable application keys ----------
insert into platform.applications (application_key, name, description, is_core, launcher_path)
values
  ('CUSTOMER_ADMIN','Customer Admin','Organization administration',true,'/admin'),
  ('REAL_ESTATE','Hakika Real Estate','Rental and property operations',false,'/real-estate'),
  ('HR','HR','Workforce operations',false,'/hr'),
  ('FINANCE','Finance','Finance and accounting',false,'/finance'),
  ('TOUGHFORCE','ToughForce','Security workforce operations',false,'/toughforce'),
  ('PLATFORM_ADMIN','Platform Admin','Hakika platform operations',true,'/platform');

commit;

-- Follow-up migrations must add:
-- 1. complete permission/page seeds and policies for every table/action;
-- 2. atomic provisioning, invitation acceptance, billing-run and allocation RPCs;
-- 3. M-PESA callback verification, status-query, reconciliation and payout Edge Functions;
-- 4. tenant/landlord/caretaker portal policies based on portal_grants;
-- 5. audit trigger helpers that capture approved business mutations without secrets;
-- 6. constraint triggers for payment allocation totals and split totals;
-- 7. pgTAP two-tenant isolation tests and rollback scripts.
