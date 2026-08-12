begin;

-- Repair the canonical platform identity and owner access without creating duplicates.
do $$
declare
  target_user uuid;
  platform_org uuid;
  membership uuid;
  platform_app uuid;
  platform_role uuid;
  existing_canonical uuid;
  repair_request uuid := '11111111-1111-4111-8111-111111111111';
begin
  select id into target_user
  from auth.users
  where lower(email) = lower('1kihiupaul@gmail.com')
  limit 1;

  if target_user is null then
    raise exception 'required Auth user is missing';
  end if;

  if (select count(*) from platform.organizations where organization_type = 'platform_owner' and status <> 'archived') > 1 then
    raise exception 'multiple active platform-owner organizations require manual review';
  end if;

  select id into existing_canonical from platform.organizations where slug = 'hakika-platform';
  select id into platform_org from platform.organizations where organization_type = 'platform_owner' and status <> 'archived' limit 1;

  if existing_canonical is not null and platform_org is not null and existing_canonical <> platform_org then
    raise exception 'canonical platform slug belongs to another organization';
  end if;

  if platform_org is null then
    insert into platform.organizations(slug, display_name, organization_type, status, billing_exempt)
      values ('hakika-platform', 'Hakika Business OS', 'platform_owner', 'active', true)
      returning id into platform_org;
  else
    update platform.organizations
    set slug = 'hakika-platform', display_name = 'Hakika Business OS', status = 'active', billing_exempt = true
    where id = platform_org;
  end if;

  insert into iam.organization_memberships(organization_id, user_id, status, joined_at, created_by)
    values (platform_org, target_user, 'active', now(), target_user)
    on conflict (organization_id, user_id) do update
      set status = 'active', joined_at = coalesce(iam.organization_memberships.joined_at, now());

  select id into membership from iam.organization_memberships
  where organization_id = platform_org and user_id = target_user;

  select id into platform_app from platform.applications where application_key = 'PLATFORM_ADMIN' and status = 'active';
  select id into platform_role from iam.roles where role_key = 'platform_admin' and scope = 'platform' and organization_id is null;

  if platform_app is null or platform_role is null then
    raise exception 'platform catalogue or platform_admin role is incomplete';
  end if;

  insert into iam.member_app_roles(organization_membership_id, organization_id, application_id, role_id, created_by)
    values (membership, platform_org, platform_app, platform_role, target_user)
    on conflict (organization_membership_id, company_id, application_id, role_id) do nothing;

  insert into audit.events(request_id, actor_user_id, actor_type, organization_id, application_key, action_key, outcome, entity_type, entity_id, summary, metadata)
  select repair_request, target_user, 'service', platform_org, 'PLATFORM_ADMIN', 'platform_owner.access_repair', 'success', 'organization_membership', membership, 'Platform owner access repaired', jsonb_build_object('idempotent', true, 'request_key', repair_request::text)
  where not exists (
    select 1 from audit.events
    where request_id = repair_request and action_key = 'platform_owner.access_repair'
  );
end;
$$;

-- PostgREST requires table privileges in addition to schema usage and RLS policies.
grant select on platform.organizations, platform.companies, platform.applications to authenticated;
grant select on iam.organization_memberships, iam.company_memberships, iam.member_app_roles,
  iam.roles, iam.role_permissions, iam.permissions, iam.pages to authenticated;
grant select on billing.application_subscriptions, billing.plans to authenticated;

commit;
