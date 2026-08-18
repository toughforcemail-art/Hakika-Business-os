-- Resolve PL/pgSQL variable/column collisions in the onboarding RPC.
create or replace function hr.create_employee_onboarding(payload jsonb)
returns table(employee_id uuid, employee_number text)
language plpgsql security definer
set search_path = pg_catalog, hr, iam, platform, private, audit
as $function$
#variable_conflict use_column
declare
  target_org uuid;
  target_company uuid;
  requested_company uuid;
  department_value uuid;
  designation_value uuid;
  number_value text;
  created_employee_number text;
  employment_type_value text;
  detail_payload jsonb := coalesce(payload, '{}'::jsonb);
  dependant jsonb;
begin
  if auth.uid() is null or jsonb_typeof(detail_payload) <> 'object' then raise exception 'employee onboarding payload is invalid' using errcode = '22023'; end if;
  target_org := nullif(detail_payload->>'organization_id', '')::uuid;
  if target_org is null then
    select om.organization_id into target_org from iam.organization_memberships om where om.user_id = auth.uid() and om.status = 'active' order by om.joined_at asc, om.created_at asc limit 1;
  end if;
  if target_org is null or not private.has_org_access(target_org) then raise exception 'organization access denied' using errcode = '42501'; end if;
  requested_company := nullif(detail_payload->>'company_id', '')::uuid;
  if requested_company is not null then
    if not exists (select 1 from platform.companies c where c.id = requested_company and c.organization_id = target_org and c.status = 'active' and (private.is_platform_operator() or private.has_company_access(target_org, requested_company))) then raise exception 'company access denied' using errcode = '42501'; end if;
    target_company := requested_company;
  else
    select c.id into target_company from platform.companies c where c.organization_id = target_org and c.status = 'active' and (private.is_platform_operator() or private.has_company_access(target_org, c.id)) order by c.is_default desc, c.created_at asc limit 1;
  end if;
  if not (private.is_platform_operator() or private.has_permission(target_org, target_company, 'hr.employees.create')) then raise exception 'employee create permission denied' using errcode = '42501'; end if;
  select d.id into department_value from hr.departments d where d.organization_id = target_org and d.status = 'active' and lower(d.name) = lower(nullif(detail_payload->>'department', '')) limit 1;
  select d.id into designation_value from hr.designations d where d.organization_id = target_org and d.status = 'active' and lower(d.name) = lower(nullif(detail_payload->>'designation', '')) limit 1;
  employment_type_value := lower(replace(coalesce(detail_payload->>'employmentType', 'permanent'), ' ', '_'));
  if employment_type_value not in ('permanent', 'contract', 'casual', 'intern', 'part_time', 'consultant') then employment_type_value := 'permanent'; end if;
  number_value := nullif(btrim(detail_payload->>'employeeNumber'), '');
  if number_value is null then number_value := platform.next_entity_number(target_org, target_company, 'employee', 'EMP', 6); end if;

  insert into hr.employees (organization_id, company_id, employee_number, first_name, middle_name, last_name, display_name, email, phone, id_number, date_of_birth, gender, marital_status, religion, department_id, designation_id, employment_type, employment_status, employment_start_date, pwd_status, current_residence, original_home, created_by)
  values (target_org, target_company, number_value, btrim(detail_payload->>'firstName'), nullif(btrim(detail_payload->>'secondName'), ''), btrim(detail_payload->>'lastName'), concat_ws(' ', btrim(detail_payload->>'firstName'), nullif(btrim(detail_payload->>'secondName'), ''), btrim(detail_payload->>'lastName')), nullif(lower(btrim(detail_payload->>'email')), ''), nullif(btrim(detail_payload->>'phoneNumber'), ''), nullif(btrim(detail_payload->>'idNumber'), ''), nullif(detail_payload->>'dateOfBirth', '')::date, nullif(detail_payload->>'gender', ''), nullif(detail_payload->>'maritalStatus', ''), nullif(detail_payload->>'religion', ''), department_value, designation_value, employment_type_value, case when lower(coalesce(detail_payload->>'employmentStatus', 'active')) in ('draft','active','probation','on_leave','suspended','terminated','resigned','retired','archived') then lower(detail_payload->>'employmentStatus') else 'active' end, nullif(detail_payload->>'employmentStartDate', '')::date, lower(coalesce(detail_payload->>'pwdStatus', '')) in ('yes','true'), nullif(detail_payload->>'currentResidence', ''), nullif(detail_payload->>'originalHome', ''), auth.uid())
  returning hr.employees.id, hr.employees.employee_number into employee_id, created_employee_number;
  employee_number := created_employee_number;

  insert into hr.employee_onboarding_details (organization_id, company_id, employee_id, onboarding_data, created_by) values (target_org, target_company, employee_id, detail_payload, auth.uid());
  if jsonb_typeof(detail_payload->'dependants') = 'array' then
    for dependant in select value from jsonb_array_elements(detail_payload->'dependants') loop
      if nullif(btrim(dependant->>'name'), '') is not null then
        insert into hr.employee_contacts (organization_id, company_id, employee_id, contact_type, full_name, relationship, phone, email, address, is_dependent, created_by) values (target_org, target_company, employee_id, 'dependant', btrim(dependant->>'name'), coalesce(nullif(btrim(dependant->>'relationship'), ''), 'Dependant'), coalesce(nullif(btrim(dependant->>'phone'), ''), 'Not provided'), nullif(lower(btrim(dependant->>'email')), ''), nullif(btrim(dependant->>'address'), ''), true, auth.uid());
      end if;
    end loop;
  end if;
  insert into hr.employee_statutory_details (organization_id, company_id, employee_id, kra_pin, nssf_number, sha_number, created_by) values (target_org, target_company, employee_id, nullif(detail_payload->>'kraPin',''), nullif(detail_payload->>'nssf',''), nullif(detail_payload->>'sha',''), auth.uid()) on conflict (employee_id) do update set kra_pin = excluded.kra_pin, nssf_number = excluded.nssf_number, sha_number = excluded.sha_number, updated_by = auth.uid(), updated_at = now();
  insert into audit.events (actor_user_id, organization_id, company_id, application_key, action_key, outcome, entity_type, entity_id, entity_label, summary) values (auth.uid(), target_org, target_company, 'HR', 'employee.created', 'success', 'employee', employee_id, created_employee_number, 'Employee onboarding record created');
  return next;
end;
$function$;

revoke all on function hr.create_employee_onboarding(jsonb) from public;
grant execute on function hr.create_employee_onboarding(jsonb) to authenticated;
