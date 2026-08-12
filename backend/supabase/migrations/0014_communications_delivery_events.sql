begin;

create table if not exists communications.delivery_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references platform.organizations(id) on delete restrict,
  company_id uuid references platform.companies(id) on delete restrict,
  application_key text not null,
  channel text not null check (channel in ('sms','whatsapp','email')),
  recipient text not null,
  message_body text not null check (char_length(message_body) between 1 and 320),
  status text not null check (status in ('queued','sent','failed')),
  provider text not null default 'africas_talking',
  provider_message_id text,
  error_code text,
  sent_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists delivery_events_scope_idx on communications.delivery_events (organization_id, company_id, channel, status, created_at desc);
create index if not exists delivery_events_recipient_idx on communications.delivery_events (recipient, created_at desc);

alter table communications.delivery_events enable row level security;

create policy delivery_events_select_authorized on communications.delivery_events for select to authenticated
  using (private.has_permission(organization_id, company_id, 'communications.sms.read') or private.has_permission(organization_id, company_id, 'admin.audit.read') or private.has_permission(organization_id, company_id, 'platform.audit.read'));
create policy delivery_events_insert_authorized on communications.delivery_events for insert to authenticated
  with check (sent_by = auth.uid() and (private.has_permission(organization_id, company_id, 'communications.sms.send') or private.has_permission(organization_id, company_id, 'platform.audit.read')));

do $$ begin
  insert into iam.permissions (permission_key, application_id, action, description)
    select 'communications.sms.read', null, 'read', 'Read SMS delivery history' from platform.applications a limit 1 on conflict (permission_key) do nothing;
  insert into iam.permissions (permission_key, application_id, action, description)
    select 'communications.sms.send', null, 'manage', 'Send authorized SMS notifications' from platform.applications a limit 1 on conflict (permission_key) do nothing;
end $$;

commit;
