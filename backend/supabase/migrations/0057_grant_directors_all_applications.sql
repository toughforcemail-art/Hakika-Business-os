begin;

-- Organization Directors receive an assignment for every active application.
-- The assignment remains organization-scoped; it does not make the member a
-- platform operator or grant cross-organization data access.
do $$
declare
  organization_record record;
  director_role_id uuid;
begin
  for organization_record in
    select distinct om.organization_id
    from iam.organization_memberships om
    join iam.roles r
      on r.organization_id = om.organization_id
     and r.scope = 'organization'
     and r.role_key = 'director'
    where om.status = 'active'
  loop
    select id into director_role_id
    from iam.roles
    where organization_id = organization_record.organization_id
      and scope = 'organization'
      and role_key = 'director'
    order by is_system desc, id
    limit 1;

    insert into iam.role_permissions (role_id, permission_id)
    select director_role_id, p.id
    from iam.permissions p
    on conflict (role_id, permission_id) do nothing;

    insert into iam.member_app_roles
      (organization_membership_id, organization_id, company_id, application_id, role_id)
    select om.id, om.organization_id, null, a.id, director_role_id
    from iam.organization_memberships om
    cross join platform.applications a
    where om.organization_id = organization_record.organization_id
      and om.status = 'active'
      and a.status = 'active'
    on conflict (organization_membership_id, company_id, application_id, role_id) do nothing;
  end loop;
end;
$$;

commit;
