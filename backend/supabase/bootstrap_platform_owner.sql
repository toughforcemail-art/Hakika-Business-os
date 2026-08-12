begin;

do $$
declare
  target_user uuid;
  platform_org uuid;
  membership uuid;
  platform_app uuid;
  platform_role uuid;
  audit_permission uuid;
begin
  select id into target_user from auth.users where lower(email)=lower('1kihiupaul@gmail.com') limit 1;
  if target_user is null then raise exception 'required Auth user is missing'; end if;

  select id into platform_org from platform.organizations where organization_type='platform_owner' and status <> 'archived' limit 1;
  if platform_org is null then
    insert into platform.organizations(slug,display_name,organization_type,status,billing_exempt)
      values ('hakika-platform-owner','Hakika Platform','platform_owner','active',true)
      returning id into platform_org;
  else
    update platform.organizations set billing_exempt=true,status='active' where id=platform_org;
  end if;

  insert into iam.organization_memberships(organization_id,user_id,status,joined_at,created_by)
    values (platform_org,target_user,'active',now(),target_user)
    on conflict (organization_id,user_id) do update set status='active',joined_at=coalesce(iam.organization_memberships.joined_at,now())
    returning id into membership;

  select id into platform_app from platform.applications where application_key='PLATFORM_ADMIN' limit 1;
  select id into platform_role from iam.roles where role_key='platform_admin' and organization_id is null limit 1;
  select id into audit_permission from iam.permissions where permission_key='platform.audit.read' limit 1;
  if platform_app is null or platform_role is null or audit_permission is null then raise exception 'platform catalogue is incomplete'; end if;

  insert into iam.role_permissions(role_id,permission_id) values (platform_role,audit_permission) on conflict do nothing;
  insert into iam.member_app_roles(organization_membership_id,organization_id,application_id,role_id,created_by)
    values (membership,platform_org,platform_app,platform_role,target_user) on conflict do nothing;

  insert into audit.events(actor_user_id,actor_type,organization_id,application_key,action_key,outcome,entity_type,entity_id,summary,metadata)
    values (target_user,'service',platform_org,'PLATFORM_ADMIN','platform_owner.bootstrap','success','organization_membership',membership,'Platform owner bootstrap completed',jsonb_build_object('idempotent',true));
end;
$$;

commit;
