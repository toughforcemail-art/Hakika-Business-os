begin;

-- Organization Directors are organization-scoped and therefore inherit access
-- to every active application, company, page, and permission in that organization.
-- The role is deliberately non-system so the customer can refine it later.
update iam.roles
set is_system = false,
    is_read_only = false,
    description = coalesce(description, 'Organization-wide operating access; editable by the organization administrator.')
where organization_id is not null and role_key = 'director';
create or replace function private.ensure_organization_director()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, iam
as $$
declare
  director_role_id uuid;
begin
  if new.status <> 'active' then
    return new;
  end if;

  if not exists (
    select 1 from iam.roles
    where organization_id = new.organization_id
      and scope = 'organization'
      and role_key ~* '(director|admin|owner)'
  ) then
    insert into iam.roles (organization_id, role_key, name, description, scope, is_system, is_read_only)
    values (new.organization_id, 'director', 'Director', 'Organization-wide operating access; editable by the organization administrator.', 'organization', false, false)
    on conflict do nothing;
    select id into director_role_id from iam.roles
    where organization_id = new.organization_id and role_key = 'director';

    insert into iam.member_app_roles (
      organization_membership_id, organization_id, application_id, role_id, created_by
    )
    values (new.id, new.organization_id, (
      select id from platform.applications where application_key = 'CUSTOMER_ADMIN' limit 1
    ), director_role_id, new.created_by)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists organization_membership_director_access on iam.organization_memberships;
create trigger organization_membership_director_access
after insert on iam.organization_memberships
for each row execute function private.ensure_organization_director();

-- Repair existing customer organizations that have an active membership but no
-- organization administrator/director role. The earliest active member is the
-- provisioned owner in the current organization model.
do $$
declare
  org record;
  owner_membership uuid;
  director_role_id uuid;
  customer_admin_id uuid;
begin
  select id into customer_admin_id
  from platform.applications
  where application_key = 'CUSTOMER_ADMIN'
  limit 1;

  for org in
    select o.id
    from platform.organizations o
    where o.organization_type = 'customer'
      and not exists (
        select 1 from iam.roles r
        where r.organization_id = o.id
          and r.scope = 'organization'
          and r.role_key ~* '(director|admin|owner)'
      )
  loop
    select id into owner_membership
    from iam.organization_memberships
    where organization_id = org.id and status = 'active'
    order by joined_at asc, created_at asc, id asc
    limit 1;

    if owner_membership is not null then
      insert into iam.roles (organization_id, role_key, name, description, scope, is_system, is_read_only)
      values (org.id, 'director', 'Director', 'Organization-wide operating access; editable by the organization administrator.', 'organization', false, false)
      on conflict do nothing;
      select id into director_role_id from iam.roles
      where organization_id = org.id and role_key = 'director';

      insert into iam.member_app_roles (
        organization_membership_id, organization_id, application_id, role_id
      ) values (owner_membership, org.id, customer_admin_id, director_role_id)
      on conflict do nothing;
    end if;
  end loop;
end;
$$;

-- These functions are redefined here because the later entitlement migration
-- replaces the earlier versions in the migration history.
create or replace function private.has_company_access(target_org uuid, target_company uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, iam
as $$
  select exists (
    select 1 from iam.organization_memberships om
    join iam.company_memberships cm on cm.organization_membership_id = om.id
    where om.organization_id = target_org and om.user_id = auth.uid()
      and om.status = 'active' and cm.company_id = target_company and cm.status = 'active'
  ) or exists (
    select 1 from iam.organization_memberships om
    join iam.roles r on r.organization_id = om.organization_id and r.scope = 'organization'
    where om.organization_id = target_org and om.user_id = auth.uid()
      and om.status = 'active' and r.role_key ~* '(director|admin|owner)'
  );
$$;

create or replace function private.has_permission(target_org uuid, target_company uuid, wanted text)
returns boolean language sql stable security definer
set search_path = pg_catalog, iam, platform, billing
as $$
  select exists (
    select 1 from iam.organization_memberships om
    join iam.member_app_roles mar on mar.organization_membership_id = om.id
    join iam.role_permissions rp on rp.role_id = mar.role_id
    join iam.permissions p on p.id = rp.permission_id
    join platform.applications a on a.id = mar.application_id
    left join billing.application_subscriptions s
      on s.organization_id = target_org and s.application_id = a.id
    where om.organization_id = target_org and om.user_id = auth.uid()
      and om.status = 'active' and (mar.company_id is null or mar.company_id = target_company)
      and mar.valid_from <= now() and (mar.valid_until is null or mar.valid_until > now())
      and (a.application_key = 'PLATFORM_ADMIN' and private.is_platform_operator()
        or a.application_key <> 'PLATFORM_ADMIN' and (a.is_core or s.status in ('trial','active','grace')))
      and p.permission_key = wanted
  ) or exists (
    select 1 from iam.organization_memberships om
    join iam.roles r on r.organization_id = om.organization_id and r.scope = 'organization'
    where om.organization_id = target_org and om.user_id = auth.uid()
      and om.status = 'active' and r.role_key ~* '(director|admin|owner)'
  );
$$;

commit;
