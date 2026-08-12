begin;

create table platform.provisioning_events (
  id uuid primary key default gen_random_uuid(),
  request_key text not null unique,
  request_payload_hash text not null,
  organization_id uuid references platform.organizations(id) on delete restrict,
  event_type text not null check (event_type in ('started','completed','failed')),
  status text not null check (status in ('pending','completed','failed')),
  result jsonb not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index provisioning_events_org_time on platform.provisioning_events (organization_id, created_at desc);
alter table platform.provisioning_events enable row level security;
create policy provisioning_events_platform_owner on platform.provisioning_events for select to authenticated using (private.is_platform_operator());
revoke insert, update, delete on platform.provisioning_events from anon, authenticated;
grant select on platform.provisioning_events to authenticated;

create or replace function platform.provision_organization(
  p_organization_name text,
  p_company_name text,
  p_organization_slug text default null,
  p_company_code text default null,
  p_owner_user_id uuid default null,
  p_application_keys text[] default '{}',
  p_plan_key text default null,
  p_trial_days integer default 14,
  p_request_key text default null
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, platform, iam, billing, audit, private
as $$
declare
  actor uuid := auth.uid();
  new_org_id uuid;
  new_company_id uuid;
  new_membership_id uuid;
  event_id uuid;
  existing_org_id uuid;
  existing_status text;
  app_key text;
  app_record record;
  plan_id uuid;
  event_result jsonb;
  payload_hash text;
begin
  if actor is null or not private.is_platform_operator() or coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'platform AAL2 authorization required';
  end if;
  if nullif(trim(p_organization_name), '') is null or nullif(trim(p_company_name), '') is null then
    raise exception 'organization and company names are required';
  end if;
  if nullif(trim(p_request_key), '') is null then raise exception 'idempotency key is required'; end if;
  if p_trial_days < 0 or p_trial_days > 90 then raise exception 'trial days out of range'; end if;
  payload_hash := encode(digest(convert_to(jsonb_build_object('organization_name',trim(p_organization_name),'company_name',trim(p_company_name),'organization_slug',p_organization_slug,'company_code',p_company_code,'owner_user_id',p_owner_user_id,'application_keys',p_application_keys,'plan_key',p_plan_key,'trial_days',p_trial_days)::text,'UTF8'),'sha256'),'hex');

  select id, organization_id, status, result into event_id, existing_org_id, existing_status, event_result
    from platform.provisioning_events where request_key=p_request_key for update;
  if event_id is not null then
    if exists (select 1 from platform.provisioning_events where id=event_id and request_payload_hash <> payload_hash) then raise exception 'idempotency key was already used with a different request'; end if;
    if existing_status='completed' then return event_result; end if;
  end if;
  if event_id is null then
    insert into platform.provisioning_events(request_key,request_payload_hash,event_type,status,created_by)
      values (p_request_key,payload_hash,'started','pending',actor)
      returning id into event_id;
  end if;

  if p_organization_slug is null then p_organization_slug := lower(regexp_replace(trim(p_organization_name), '[^a-zA-Z0-9]+', '-', 'g')); end if;
  if p_company_code is null then p_company_code := upper(left(regexp_replace(trim(p_company_name), '[^a-zA-Z0-9]+', '', 'g'), 12)); end if;
  if p_organization_slug = '' or p_company_code = '' then raise exception 'organization slug and company code are required'; end if;

  insert into platform.organizations(slug,display_name,organization_type,status,billing_exempt)
    values (p_organization_slug,trim(p_organization_name),'customer','active',false)
    returning id into new_org_id;
  insert into platform.companies(organization_id,code,name,slug,is_default)
    values (new_org_id,p_company_code,trim(p_company_name),p_organization_slug,true)
    returning id into new_company_id;

  if p_owner_user_id is not null then
    insert into iam.organization_memberships(organization_id,user_id,status,joined_at,created_by)
      values (new_org_id,p_owner_user_id,'active',now(),actor)
      returning id into new_membership_id;
    insert into iam.company_memberships(organization_membership_id,organization_id,company_id,status,created_by)
      values (new_membership_id,new_org_id,new_company_id,'active',actor);
  end if;

  select id into app_record from platform.applications where application_key='CUSTOMER_ADMIN' and status='active';
  if app_record.id is null then raise exception 'Customer Administration catalogue entry is missing'; end if;
  insert into billing.application_subscriptions(organization_id,application_id,status,current_period_start)
    values (new_org_id,app_record.id,'active',now());

  if p_plan_key is not null then select id into plan_id from billing.plans where plan_key=p_plan_key and status='active'; end if;
  foreach app_key in array coalesce(p_application_keys,'{}'::text[]) loop
    app_key := upper(trim(app_key));
    if app_key in ('PLATFORM_ADMIN','CUSTOMER_ADMIN') then continue; end if;
    select id into app_record from platform.applications where application_key=app_key and status='active';
    if app_record.id is null then raise exception 'Unknown or inactive application: %', app_key; end if;
    insert into billing.application_subscriptions(organization_id,application_id,plan_id,status,trial_ends_at,current_period_start)
      values (new_org_id,app_record.id,plan_id,case when p_trial_days > 0 then 'trial' else 'active' end,case when p_trial_days > 0 then now() + make_interval(days => p_trial_days) end,now());
    if p_owner_user_id is not null then
      insert into iam.roles(organization_id,application_id,role_key,name,scope,is_system,is_read_only)
        values (new_org_id,app_record.id,lower(app_key)||'_admin',app_key||' Administrator','application',true,false)
        on conflict do nothing;
      insert into iam.member_app_roles(organization_membership_id,organization_id,company_id,application_id,role_id)
        select new_membership_id,new_org_id,new_company_id,app_record.id,r.id from iam.roles r where r.organization_id=new_org_id and r.application_id=app_record.id and r.role_key=lower(app_key)||'_admin' on conflict do nothing;
    end if;
  end loop;

  event_result := jsonb_build_object('organization_id',new_org_id,'company_id',new_company_id,'owner_membership_id',new_membership_id,'status','completed');
  update platform.provisioning_events pe set organization_id=new_org_id,event_type='completed',status='completed',result=event_result,updated_at=now() where pe.id=event_id;
  insert into audit.events(actor_user_id,organization_id,application_key,action_key,outcome,entity_type,entity_id,summary,after_data)
    values (actor,new_org_id,'PLATFORM_ADMIN','organization.provisioned','success','organization',new_org_id,'Customer organization provisioned',event_result);
  return event_result;
end;
$$;

create or replace function platform.set_application_subscription_status(
  p_organization_id uuid,
  p_application_key text,
  p_status text,
  p_trial_days integer default null
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, platform, billing, audit, private
as $$
declare
  app_id uuid;
  subscription_id uuid;
  changed jsonb;
begin
  if auth.uid() is null or not private.is_platform_operator() or coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then raise exception 'platform AAL2 authorization required'; end if;
  if p_status not in ('pending','trial','active','past_due','suspended','cancelled') then raise exception 'invalid subscription status'; end if;
  select id into app_id from platform.applications where application_key=upper(p_application_key) and application_key <> 'PLATFORM_ADMIN';
  if app_id is null then raise exception 'application not found'; end if;
  update billing.application_subscriptions set status=p_status, trial_ends_at=case when p_status='trial' and p_trial_days is not null then now() + make_interval(days => p_trial_days) else trial_ends_at end, updated_at=now() where organization_id=p_organization_id and application_id=app_id returning id into subscription_id;
  if subscription_id is null then raise exception 'subscription not found'; end if;
  changed := jsonb_build_object('subscription_id',subscription_id,'organization_id',p_organization_id,'application_key',upper(p_application_key),'status',p_status);
  insert into audit.events(actor_user_id,organization_id,application_key,action_key,outcome,entity_type,entity_id,summary,after_data) values (auth.uid(),p_organization_id,'PLATFORM_ADMIN','subscription.status_changed','success','application_subscription',subscription_id,'Application subscription status changed',changed);
  return changed;
end;
$$;

revoke all on function platform.provision_organization(text,text,text,text,uuid,text[],text,integer,text) from public;
grant execute on function platform.provision_organization(text,text,text,text,uuid,text[],text,integer,text) to authenticated;
revoke all on function platform.set_application_subscription_status(uuid,text,text,integer) from public;
grant execute on function platform.set_application_subscription_status(uuid,text,text,integer) to authenticated;

commit;
