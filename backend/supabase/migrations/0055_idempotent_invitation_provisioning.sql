begin;

create or replace function private.accept_invitation(invitation_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, iam, platform, audit
as $$
declare
  accepted_id uuid;
  membership_id uuid;
  invitation_org uuid;
begin
  if auth.uid() is null then
    raise exception 'authenticated user required';
  end if;

  update iam.invitations
  set status = 'accepted', accepted_by = auth.uid(), accepted_at = coalesce(accepted_at, now())
  where token_hash = invitation_token_hash
    and ((status = 'pending' and expires_at > now()) or (status = 'accepted' and accepted_by = auth.uid()))
  returning id, organization_id into accepted_id, invitation_org;

  if accepted_id is null then
    raise exception 'invitation is invalid, expired, revoked or already accepted';
  end if;

  insert into iam.organization_memberships (organization_id, user_id, status, joined_at)
  values (invitation_org, auth.uid(), 'active', now())
  on conflict (organization_id, user_id) do update set status = 'active'
  returning id into membership_id;

  insert into iam.company_memberships (organization_membership_id, organization_id, company_id, status)
  select membership_id, invitation_org, ica.company_id, 'active'
  from iam.invitation_company_assignments ica
  where ica.invitation_id = accepted_id
  on conflict (organization_membership_id, company_id) do update set status = 'active';

  insert into iam.member_app_roles (organization_membership_id, organization_id, company_id, application_id, role_id)
  select membership_id, invitation_org, ica.company_id, ira.application_id, ira.role_id
  from iam.invitation_role_assignments ira
  left join iam.invitation_company_assignments ica on ica.invitation_id = ira.invitation_id
  where ira.invitation_id = accepted_id
    and (ica.company_id is not null or not exists (select 1 from iam.invitation_company_assignments x where x.invitation_id = ira.invitation_id))
    and exists (
      select 1 from iam.roles r
      where r.id = ira.role_id
        and (r.organization_id is null or r.organization_id = invitation_org)
        and (r.application_id is null or r.application_id = ira.application_id)
    )
  on conflict (organization_membership_id, company_id, application_id, role_id) do nothing;

  insert into audit.events (actor_user_id, organization_id, application_key, action_key, outcome, entity_type, entity_id, summary)
  values (auth.uid(), invitation_org, 'CUSTOMER_ADMIN', 'invitation.accepted', 'success', 'invitation', accepted_id, 'Invitation accepted and access assignments provisioned');
  return accepted_id;
end;
$$;

commit;
