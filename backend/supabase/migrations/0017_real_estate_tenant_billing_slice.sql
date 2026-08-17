begin;

-- Additive tenant, portal and billing contracts. Existing records remain valid.
alter table real_estate.tenants
  add column if not exists tenant_number text,
  add column if not exists phone text,
  add column if not exists national_id text,
  add column if not exists date_of_birth date,
  add column if not exists gender text,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_phone text,
  add column if not exists emergency_contact_relationship text,
  add column if not exists notes text,
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists portal_status text not null default 'not_invited',
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

alter table real_estate.leases
  add column if not exists tenant_id uuid,
  add column if not exists property_id uuid,
  add column if not exists unit_id uuid,
  add column if not exists rent_amount_minor bigint,
  add column if not exists currency text not null default 'KES',
  add column if not exists billing_frequency text not null default 'monthly',
  add column if not exists payment_day integer,
  add column if not exists deposit_amount_minor bigint not null default 0,
  add column if not exists water_deposit_amount_minor bigint not null default 0,
  add column if not exists electricity_deposit_amount_minor bigint not null default 0,
  add column if not exists grace_period_days integer not null default 0,
  add column if not exists penalty_mode text not null default 'none',
  add column if not exists penalty_value numeric(14,4) not null default 0,
  add column if not exists signed_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists terminated_at timestamptz,
  add column if not exists termination_reason text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references auth.users(id) on delete set null;

alter table real_estate.invoices
  add column if not exists invoice_number text,
  add column if not exists tenant_id uuid,
  add column if not exists property_id uuid,
  add column if not exists unit_id uuid,
  add column if not exists issue_date date,
  add column if not exists due_date date,
  add column if not exists currency text not null default 'KES',
  add column if not exists subtotal_minor bigint not null default 0,
  add column if not exists tax_total_minor bigint not null default 0,
  add column if not exists penalty_total_minor bigint not null default 0,
  add column if not exists allocated_total_minor bigint not null default 0,
  add column if not exists balance_due_minor bigint not null default 0,
  add column if not exists notes text,
  add column if not exists issued_at timestamptz,
  add column if not exists voided_at timestamptz,
  add column if not exists void_reason text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists archived_at timestamptz;

alter table real_estate.payments
  add column if not exists payment_number text,
  add column if not exists tenant_id uuid,
  add column if not exists payment_method text not null default 'other',
  add column if not exists provider_reference text,
  add column if not exists payer_reference text,
  add column if not exists currency text not null default 'KES',
  add column if not exists unallocated_amount_minor bigint not null default 0,
  add column if not exists recorded_by uuid references auth.users(id) on delete set null,
  add column if not exists confirmed_by uuid references auth.users(id) on delete set null,
  add column if not exists reversed_at timestamptz,
  add column if not exists reversal_reason text,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists archived_at timestamptz;

create table if not exists real_estate.tenant_documents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, company_id uuid not null,
  tenant_id uuid not null, document_type text not null, storage_path text, document_number text,
  issued_at date, expires_at date, verification_status text not null default 'pending',
  uploaded_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), archived_at timestamptz,
  foreign key (organization_id, company_id) references platform.companies(organization_id, id),
  foreign key (organization_id, tenant_id) references real_estate.tenants(organization_id, id)
);

create table if not exists real_estate.tenant_portal_invitations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, company_id uuid not null,
  tenant_id uuid not null, email citext, phone text, channel text not null default 'email', token_hash text not null unique,
  status text not null default 'pending', expires_at timestamptz not null, accepted_at timestamptz, revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
  foreign key (organization_id, company_id) references platform.companies(organization_id, id),
  foreign key (organization_id, tenant_id) references real_estate.tenants(organization_id, id)
);

create table if not exists real_estate.billing_products (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, company_id uuid not null,
  code text not null, name text not null, description text, category text not null default 'other',
  default_amount_minor bigint not null default 0, currency text not null default 'KES', tax_mode text not null default 'none',
  tax_rate numeric(7,4) not null default 0, is_recurring boolean not null default false,
  status text not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz,
  foreign key (organization_id, company_id) references platform.companies(organization_id, id),
  unique (organization_id, company_id, code)
);

create table if not exists real_estate.payment_references (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, company_id uuid not null,
  payment_id uuid not null, provider text, reference text not null, raw_metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  foreign key (organization_id, company_id) references platform.companies(organization_id, id),
  foreign key (organization_id, payment_id) references real_estate.payments(organization_id, id),
  unique (organization_id, company_id, provider, reference)
);

create table if not exists real_estate.receipts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, company_id uuid not null,
  receipt_number text not null, payment_id uuid not null, tenant_id uuid, issued_at timestamptz not null default now(),
  amount_minor bigint not null check (amount_minor > 0), currency text not null default 'KES', status text not null default 'issued',
  storage_path text, created_by uuid references auth.users(id) on delete set null, voided_at timestamptz, void_reason text,
  foreign key (organization_id, company_id) references platform.companies(organization_id, id),
  foreign key (organization_id, payment_id) references real_estate.payments(organization_id, id),
  unique (organization_id, company_id, receipt_number)
);

create table if not exists real_estate.reconciliation_sessions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, company_id uuid not null,
  provider text, payment_method text, start_date date not null, end_date date not null,
  imported_total_minor bigint not null default 0, recorded_total_minor bigint not null default 0,
  allocated_total_minor bigint not null default 0, unmatched_total_minor bigint not null default 0,
  difference_minor bigint not null default 0, status text not null default 'draft',
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), closed_at timestamptz,
  foreign key (organization_id, company_id) references platform.companies(organization_id, id),
  check (end_date >= start_date)
);

create unique index if not exists tenants_company_number_unique on real_estate.tenants (organization_id, company_id, tenant_number) where archived_at is null and tenant_number is not null;
create unique index if not exists tenants_auth_user_unique on real_estate.tenants (organization_id, auth_user_id) where auth_user_id is not null;
create unique index if not exists leases_active_unit_unique on real_estate.leases (organization_id, company_id, unit_id) where archived_at is null and status = 'active' and unit_id is not null;
create unique index if not exists invoices_company_number_unique on real_estate.invoices (organization_id, company_id, invoice_number) where invoice_number is not null;
create unique index if not exists payments_provider_reference_unique on real_estate.payments (organization_id, company_id, provider_reference) where provider_reference is not null;

alter table real_estate.tenant_documents enable row level security;
alter table real_estate.tenant_portal_invitations enable row level security;
alter table real_estate.billing_products enable row level security;
alter table real_estate.payment_references enable row level security;
alter table real_estate.receipts enable row level security;
alter table real_estate.reconciliation_sessions enable row level security;

create policy tenant_documents_select on real_estate.tenant_documents for select to authenticated using (private.has_company_access(organization_id, company_id) and private.has_permission(organization_id, company_id, 'real_estate.tenants.read'));
create policy portal_invitations_select on real_estate.tenant_portal_invitations for select to authenticated using (private.has_company_access(organization_id, company_id) and private.has_permission(organization_id, company_id, 'real_estate.tenants.portal.manage'));
create policy billing_products_select on real_estate.billing_products for select to authenticated using (private.has_company_access(organization_id, company_id) and private.has_permission(organization_id, company_id, 'real_estate.billing_products.read'));
create policy payment_references_select on real_estate.payment_references for select to authenticated using (private.has_company_access(organization_id, company_id) and private.has_permission(organization_id, company_id, 'real_estate.payments.read'));
create policy receipts_select on real_estate.receipts for select to authenticated using (private.has_company_access(organization_id, company_id) and private.has_permission(organization_id, company_id, 'real_estate.receipts.read'));
create policy reconciliation_select on real_estate.reconciliation_sessions for select to authenticated using (private.has_company_access(organization_id, company_id) and private.has_permission(organization_id, company_id, 'real_estate.payments.reconcile'));

insert into iam.permissions (permission_key, action, description) values
  ('real_estate.tenants.create','create','Create scoped tenants'),
  ('real_estate.tenants.update','update','Update scoped tenants'),
  ('real_estate.tenants.archive','manage','Archive scoped tenants'),
  ('real_estate.tenants.portal.manage','manage','Manage tenant portal access'),
  ('real_estate.tenants.portal.preview','preview_portal','Preview a tenant portal read-only'),
  ('real_estate.leases.create','create','Create scoped leases'),
  ('real_estate.leases.update','update','Update draft leases'),
  ('real_estate.leases.activate','approve','Activate leases'),
  ('real_estate.leases.terminate','manage','Terminate leases'),
  ('real_estate.billing_products.read','read','Read billing products'),
  ('real_estate.billing_products.manage','manage','Manage billing products'),
  ('real_estate.invoices.create','create','Create invoices'),
  ('real_estate.invoices.update_draft','update','Update draft invoices'),
  ('real_estate.invoices.issue','approve','Issue invoices'),
  ('real_estate.invoices.void','manage','Void invoices'),
  ('real_estate.payments.record','create','Record payments'),
  ('real_estate.payments.confirm','approve','Confirm payments'),
  ('real_estate.payments.reverse','manage','Reverse payments'),
  ('real_estate.receipts.read','read','Read receipts'),
  ('real_estate.receipts.issue','create','Issue receipts'),
  ('real_estate.receipts.void','manage','Void receipts'),
  ('real_estate.statements.read','read','Read statements'),
  ('real_estate.statements.export','export','Export statements'),
  ('real_estate.statements.send','manage','Send statements')
on conflict (permission_key) do nothing;

commit;
