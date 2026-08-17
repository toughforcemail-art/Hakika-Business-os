begin;

drop policy if exists invitations_write_org_admin on iam.invitations;
create policy invitations_write_org_admin on iam.invitations for all to authenticated
  using (private.is_platform_operator() or private.has_permission(organization_id, null, 'admin.members.invite') or private.has_permission(organization_id, null, 'hr.employee_access.prepare_invitation'))
  with check (invited_by = auth.uid() and (private.is_platform_operator() or private.has_permission(organization_id, null, 'admin.members.invite') or private.has_permission(organization_id, null, 'hr.employee_access.prepare_invitation')));

create or replace function hr.create_employee(
  target_org uuid, target_company uuid, requested_number text, first_name_value text, middle_name_value text, last_name_value text,
  email_value text, phone_value text, date_of_birth_value date, employment_type_value text, employment_status_value text,
  start_date_value date, probation_end_date_value date, pwd_status_value boolean, current_residence_value text, original_home_value text, notes_value text
) returns table(employee_id uuid, employee_number text)
language plpgsql security definer
set search_path = pg_catalog, hr, platform, private, audit
as $$
begin
  select e.employee_id, e.employee_number into employee_id, employee_number
  from hr.create_employee(target_org, target_company, requested_number, first_name_value, middle_name_value, last_name_value, email_value, phone_value, employment_type_value, employment_status_value, start_date_value, probation_end_date_value, pwd_status_value, current_residence_value, original_home_value, notes_value) e;
  update hr.employees set date_of_birth = date_of_birth_value where id = employee_id and organization_id = target_org;
  return next;
end;
$$;

revoke all on function hr.create_employee(uuid,uuid,text,text,text,text,text,text,date,text,text,date,date,boolean,text,text,text) from public;
grant execute on function hr.create_employee(uuid,uuid,text,text,text,text,text,text,date,text,text,date,date,boolean,text,text,text) to authenticated;

commit;
