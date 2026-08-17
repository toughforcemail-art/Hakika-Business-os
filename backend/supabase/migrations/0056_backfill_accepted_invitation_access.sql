begin;

-- Repair invitations accepted before the idempotent provisioning function was
-- deployed. Those users already have an auth account and membership, but may
-- be missing their application-role rows.
do $$
declare
  invitation_record record;
  membership_id uuid;
begin
  for invitation_record in
    select id, organization_id, accepted_by
    from iam.invitations
    where status = 'accepted'
      and accepted_by is not null
  loop
    insert into iam.organization_memberships (organization_id, user_id, status, joined_at)
    values (invitation_record.organization_id, invitation_record.accepted_by, 'active', now())
    on conflict (organization_id, user_id) do update set status = 'active'
    returning id into membership_id;

    insert into iam.member_app_roles (organization_membership_id, organization_id, company_id, application_id, role_id)
    select membership_id, invitation_record.organization_id, ica.company_id, ira.application_id, ira.role_id
    from iam.invitation_role_assignments ira
    left join iam.invitation_company_assignments ica on ica.invitation_id = ira.invitation_id
    where ira.invitation_id = invitation_record.id
      and (ica.company_id is not null or not exists (
        select 1 from iam.invitation_company_assignments x
        where x.invitation_id = ira.invitation_id
      ))
      and exists (
        select 1 from iam.roles r
        where r.id = ira.role_id
          and (r.organization_id is null or r.organization_id = invitation_record.organization_id)
          and (r.application_id is null or r.application_id = ira.application_id)
      )
    on conflict (organization_membership_id, company_id, application_id, role_id) do nothing;
  end loop;
end;
$$;

commit;
