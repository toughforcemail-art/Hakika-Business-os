begin;

-- 0023 accidentally made the nullable company column part of a primary key.
-- Primary keys force every column to NOT NULL, so replace only that key with
-- a NULLS NOT DISTINCT unique constraint. Counter rows are preserved.
do $$
declare primary_key_name text;
begin
  select conname into primary_key_name
  from pg_constraint
  where conrelid = 'platform.entity_number_counters'::regclass
    and contype = 'p';
  if primary_key_name is not null then
    execute format('alter table platform.entity_number_counters drop constraint %I', primary_key_name);
  end if;
end $$;

alter table platform.entity_number_counters alter column company_id drop not null;
alter table platform.entity_number_counters
  add constraint entity_number_counters_scope_unique
  unique nulls not distinct (organization_id, company_id, entity_type);

create or replace function platform.next_entity_number(target_org uuid, target_company uuid, target_entity_type text, target_prefix text, target_padding integer default 6) returns text
language plpgsql security definer
set search_path = pg_catalog, platform, private
as $$
declare
  current_value bigint;
  counter_prefix text;
  counter_padding integer;
  org_code text;
  company_code text;
  result text;
  scope_mode text;
begin
  if auth.uid() is null or target_org is null or not private.has_org_access(target_org) then
    raise exception 'organization access denied' using errcode = '42501';
  end if;
  if target_entity_type is null or target_entity_type !~ '^[a-z][a-z0-9_]{1,63}$' then
    raise exception 'invalid entity type' using errcode = '22023';
  end if;
  if target_prefix is null or target_prefix !~ '^[A-Z][A-Z0-9]{1,15}$' then
    raise exception 'invalid entity prefix' using errcode = '22023';
  end if;
  if target_padding is null or target_padding < 1 or target_padding > 12 then
    raise exception 'invalid entity padding' using errcode = '22023';
  end if;
  select company_scope_mode into scope_mode from platform.organizations where id = target_org and status = 'active';
  if scope_mode is null then raise exception 'organization access denied' using errcode = '42501'; end if;
  if scope_mode = 'required' and target_company is null then
    raise exception 'company selection required' using errcode = '42501';
  end if;
  if target_company is not null then
    if not exists (select 1 from platform.companies c where c.id = target_company and c.organization_id = target_org and c.status = 'active') then
      raise exception 'company does not belong to organization' using errcode = '42501';
    end if;
    if not private.is_platform_operator() and not private.has_company_access(target_org, target_company) then
      raise exception 'company access denied' using errcode = '42501';
    end if;
  end if;
  if not (private.is_platform_operator() or private.has_permission(target_org, target_company, 'platform.entity_numbers.configure') or (target_entity_type = 'employee' and private.has_permission(target_org, target_company, 'hr.employees.create')) or (target_entity_type = 'tenant' and private.has_permission(target_org, target_company, 'real_estate.tenants.create'))) then
    raise exception 'entity number permission denied' using errcode = '42501';
  end if;

  insert into platform.entity_number_counters(organization_id, company_id, entity_type, prefix, next_value, padding)
  values (target_org, target_company, target_entity_type, target_prefix, 1, target_padding)
  on conflict (organization_id, company_id, entity_type) do nothing;

  select next_value, prefix, padding
    into current_value, counter_prefix, counter_padding
  from platform.entity_number_counters
  where organization_id = target_org
    and company_id is not distinct from target_company
    and entity_type = target_entity_type
  for update;
  if counter_prefix <> target_prefix then raise exception 'entity prefix is already configured' using errcode = '23514'; end if;
  if current_value is null then raise exception 'entity counter unavailable' using errcode = 'P0001'; end if;
  update platform.entity_number_counters
    set next_value = current_value + 1, updated_at = now()
    where organization_id = target_org and company_id is not distinct from target_company and entity_type = target_entity_type;
  select coalesce(nullif(metadata->>'organization_code',''),'ORG') into org_code from platform.organizations where id = target_org;
  select coalesce(nullif(metadata->>'company_code',''),'') into company_code from platform.companies where id = target_company;
  result := counter_prefix || '-' || org_code || case when target_company is null then '' else '-' || company_code end || '-' || lpad(current_value::text, counter_padding, '0');
  return result;
end;
$$;
revoke all on function platform.next_entity_number(uuid,uuid,text,text,integer) from public;
grant execute on function platform.next_entity_number(uuid,uuid,text,text,integer) to authenticated;

create or replace function hr.create_employee(
  target_org uuid, target_company uuid, requested_number text, first_name_value text, middle_name_value text, last_name_value text,
  email_value text, phone_value text, employment_type_value text, employment_status_value text, start_date_value date,
  probation_end_date_value date, pwd_status_value boolean, current_residence_value text, original_home_value text, notes_value text
) returns table(employee_id uuid, employee_number text)
language plpgsql security definer
set search_path = pg_catalog, hr, platform, private, audit
as $$
declare number_value text;
begin
  if auth.uid() is null or not private.has_permission(target_org, target_company, 'hr.employees.create') then raise exception 'employee create permission denied' using errcode = '42501'; end if;
  if target_org is null or first_name_value is null or btrim(first_name_value) = '' or last_name_value is null or btrim(last_name_value) = '' then raise exception 'employee identity is incomplete' using errcode = '22023'; end if;
  if requested_number is null or btrim(requested_number) = '' then number_value := platform.next_entity_number(target_org, target_company, 'employee', 'EMP', 6); else number_value := btrim(requested_number); end if;
  insert into hr.employees(organization_id, company_id, employee_number, first_name, middle_name, last_name, display_name, email, phone, employment_type, employment_status, employment_start_date, probation_end_date, pwd_status, current_residence, original_home, notes, created_by)
  values(target_org, target_company, number_value, btrim(first_name_value), nullif(btrim(middle_name_value),''), btrim(last_name_value), concat_ws(' ', btrim(first_name_value), nullif(btrim(middle_name_value),''), btrim(last_name_value)), nullif(lower(btrim(email_value)),''), nullif(btrim(phone_value),''), coalesce(nullif(employment_type_value,''),'permanent'), coalesce(nullif(employment_status_value,''),'draft'), start_date_value, probation_end_date_value, coalesce(pwd_status_value,false), nullif(btrim(current_residence_value),''), nullif(btrim(original_home_value),''), nullif(btrim(notes_value),''), auth.uid())
  returning id, employee_number into employee_id, employee_number;
  insert into audit.events(actor_user_id, organization_id, company_id, application_key, action_key, outcome, entity_type, entity_id, entity_label, summary)
  values(auth.uid(), target_org, target_company, 'HR', 'employee.created', 'success', 'employee', employee_id, employee_number, 'Employee created');
  return next;
end;
$$;
revoke all on function hr.create_employee(uuid,uuid,text,text,text,text,text,text,text,text,date,date,boolean,text,text,text) from public;
grant execute on function hr.create_employee(uuid,uuid,text,text,text,text,text,text,text,text,date,date,boolean,text,text,text) to authenticated;

grant usage on schema hr to authenticated;
grant select, insert, update on hr.employees to authenticated;
grant select on platform.entity_number_counters to authenticated;
revoke insert, update, delete on platform.entity_number_counters from authenticated;

commit;
