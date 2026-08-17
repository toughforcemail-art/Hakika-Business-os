begin;

drop policy if exists hr_employees_select on hr.employees;
create policy hr_employees_select on hr.employees
  for select to authenticated
  using (private.has_org_access(organization_id) and (private.is_platform_operator() or private.has_permission(organization_id, company_id, 'hr.employees.read')));

drop policy if exists hr_employees_insert on hr.employees;
create policy hr_employees_insert on hr.employees
  for insert to authenticated
  with check (created_by = auth.uid() and (private.is_platform_operator() or private.has_permission(organization_id, company_id, 'hr.employees.create')));

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
  if auth.uid() is null or target_org is null or not private.has_org_access(target_org) or not (private.is_platform_operator() or private.has_permission(target_org, target_company, 'hr.employees.create')) then raise exception 'employee create permission denied' using errcode = '42501'; end if;
  if first_name_value is null or btrim(first_name_value) = '' or last_name_value is null or btrim(last_name_value) = '' then raise exception 'employee identity is incomplete' using errcode = '22023'; end if;
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

commit;
