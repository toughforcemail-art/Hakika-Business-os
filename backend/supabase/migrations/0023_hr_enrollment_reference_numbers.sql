begin;

alter table iam.invitations add column if not exists employee_id uuid;
alter table iam.invitations alter column email drop not null;
alter table iam.invitations add column if not exists phone text;
alter table iam.invitations add column if not exists delivery_channel text not null default 'email' check (delivery_channel in ('email','sms','both'));
alter table iam.invitations add column if not exists delivery_status text not null default 'pending' check (delivery_status in ('pending','sent','failed'));
alter table iam.invitations add column if not exists sent_at timestamptz;

create table if not exists platform.entity_number_counters (organization_id uuid not null references platform.organizations(id) on delete cascade, company_id uuid, entity_type text not null, prefix text not null, next_value bigint not null default 1, padding integer not null default 6, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key (organization_id, company_id, entity_type), foreign key (organization_id,company_id) references platform.companies(organization_id,id));
alter table platform.entity_number_counters enable row level security;
create policy entity_number_counters_select on platform.entity_number_counters for select to authenticated using (private.has_org_access(organization_id));

create or replace function platform.next_entity_number(target_org uuid, target_company uuid, target_entity_type text, target_prefix text, target_padding integer default 6) returns text language plpgsql security definer set search_path = pg_catalog, platform, private as $$
declare current_value bigint; org_code text; company_code text; result text;
begin
  if auth.uid() is null or not private.has_org_access(target_org) then raise exception 'organization access denied'; end if;
  if target_company is not null and not private.has_company_access(target_org,target_company) then raise exception 'company access denied'; end if;
  insert into platform.entity_number_counters(organization_id,company_id,entity_type,prefix,padding) values(target_org,target_company,target_entity_type,target_prefix,greatest(target_padding,1)) on conflict (organization_id,company_id,entity_type) do nothing;
  select next_value, padding into current_value, target_padding from platform.entity_number_counters where organization_id=target_org and company_id is not distinct from target_company and entity_type=target_entity_type for update;
  update platform.entity_number_counters set next_value=current_value+1, updated_at=now() where organization_id=target_org and company_id is not distinct from target_company and entity_type=target_entity_type;
  select coalesce(nullif(metadata->>'organization_code',''),'ORG') into org_code from platform.organizations where id=target_org;
  select coalesce(nullif(metadata->>'company_code',''),'') into company_code from platform.companies where id=target_company;
  result := target_prefix || '-' || org_code || case when target_company is null then '' else '-' || company_code end || '-' || lpad(current_value::text,greatest(target_padding,1),'0');
  return result;
end; $$;
revoke all on function platform.next_entity_number(uuid,uuid,text,text,integer) from public;
grant execute on function platform.next_entity_number(uuid,uuid,text,text,integer) to authenticated;

insert into iam.permissions(permission_key, action, description) values
 ('hr.employee_access.prepare_invitation','manage','Prepare employee invitation'),('hr.employee_access.send_invitation','manage','Send employee invitation'),('hr.employee_access.resend_invitation','manage','Resend employee invitation'),('hr.employee_access.revoke_invitation','manage','Revoke employee invitation'),('hr.employee_access.send_password_reset','manage','Send employee password reset'),('hr.employee_access.suspend','manage','Suspend employee sign-in'),('hr.employee_access.reactivate','manage','Reactivate employee sign-in'),('hr.employee_access.manage_apps','manage','Manage employee applications'),('hr.employee_access.manage_roles','manage','Manage employee roles'),('hr.employee_access.manage_permissions','manage','Manage employee permissions'),('hr.employee_access.view_delivery_history','read','View invitation delivery history'),('profile.self.read','read','Read own profile'),('profile.self.update','update','Update own profile'),('profile.self.security.manage','manage','Manage own security'),('platform.entity_numbers.configure','manage','Configure entity numbering')
 on conflict(permission_key) do nothing;

commit;
