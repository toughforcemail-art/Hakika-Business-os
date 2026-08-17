begin;

grant select, insert on iam.invitation_role_assignments, iam.role_permissions, iam.member_app_roles to authenticated;

drop policy if exists invitation_roles_insert_platform_or_admin on iam.invitation_role_assignments;
create policy invitation_roles_insert_platform_or_admin on iam.invitation_role_assignments
  for insert to authenticated
  with check (
    private.is_platform_operator()
    or private.has_permission(organization_id, null, 'admin.members.invite')
  );

drop policy if exists role_permissions_insert_platform_or_admin on iam.role_permissions;
create policy role_permissions_insert_platform_or_admin on iam.role_permissions
  for insert to authenticated
  with check (
    exists (
      select 1 from iam.roles r
      where r.id = role_permissions.role_id
        and (private.is_platform_operator() or private.has_permission(r.organization_id, null, 'admin.roles.manage'))
    )
  );

drop policy if exists member_app_roles_insert_platform_or_admin on iam.member_app_roles;
create policy member_app_roles_insert_platform_or_admin on iam.member_app_roles
  for insert to authenticated
  with check (
    private.is_platform_operator()
    or private.has_permission(organization_id, company_id, 'admin.members.invite')
  );

commit;
