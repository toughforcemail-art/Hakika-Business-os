begin;

drop policy if exists profiles_select_self on iam.profiles;
create policy profiles_select_self_or_platform on iam.profiles
  for select to authenticated
  using (user_id = auth.uid() or private.is_platform_operator());

drop policy if exists organizations_select_member on platform.organizations;
create policy organizations_select_member_or_platform on platform.organizations
  for select to authenticated
  using (private.is_platform_operator() or private.has_org_access(id));

drop policy if exists member_app_roles_select_scoped on iam.member_app_roles;
create policy member_app_roles_select_scoped_or_platform on iam.member_app_roles
  for select to authenticated
  using (private.is_platform_operator() or (private.has_org_access(organization_id) and (organization_membership_id in (select id from iam.organization_memberships where user_id = auth.uid()) or private.has_permission(organization_id, company_id, 'admin.roles.read'))));

commit;
