begin;

-- Platform operators may select the memberships needed to build the platform
-- context. The existing self policy remains in place for ordinary users.
drop policy if exists memberships_select_platform_operator on iam.organization_memberships;
create policy memberships_select_platform_operator on iam.organization_memberships
  for select to authenticated
  using (private.is_platform_operator());

drop policy if exists company_memberships_select_platform_operator on iam.company_memberships;
create policy company_memberships_select_platform_operator on iam.company_memberships
  for select to authenticated
  using (private.is_platform_operator());

commit;
