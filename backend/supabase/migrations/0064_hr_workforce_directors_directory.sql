-- Expose only organization directors that the current authorized HR user may
-- see. Directors are IAM members, not duplicate rows in hr.employees.
create or replace function hr.list_workforce_directors()
returns table (
  user_id uuid,
  membership_id uuid,
  organization_id uuid,
  organization_name text,
  membership_status text,
  joined_at timestamptz,
  display_name text,
  email text,
  phone_e164 text,
  profile_status text,
  access_label text
)
language sql
stable
security definer
set search_path = pg_catalog, hr, iam, platform, auth
as $$
  select
    m.user_id,
    m.id,
    m.organization_id,
    o.display_name,
    m.status,
    m.joined_at,
    coalesce(
      nullif(btrim(p.display_name), ''),
      nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
      split_part(u.email, '@', 1),
      'Unnamed director'
    ),
    u.email,
    p.phone_e164,
    coalesce(p.status, 'active'),
    access.applications
  from iam.organization_memberships m
  join auth.users u on u.id = m.user_id
  join platform.organizations o on o.id = m.organization_id
  left join iam.profiles p on p.user_id = m.user_id
  left join lateral (
    select string_agg(distinct a.name, ', ' order by a.name) as applications
    from iam.member_app_roles mar
    join iam.roles r on r.id = mar.role_id and r.role_key = 'director'
    join platform.applications a on a.id = mar.application_id and a.status = 'active'
    where mar.organization_membership_id = m.id
  ) access on true
  where m.status = 'active'
    and exists (
      select 1
      from iam.member_app_roles mar
      join iam.roles r on r.id = mar.role_id
      where mar.organization_membership_id = m.id
        and r.organization_id = m.organization_id
        and r.scope = 'organization'
        and r.role_key = 'director'
    )
    and (
      private.is_platform_operator()
      or (
        private.has_org_access(m.organization_id)
        and private.has_permission(m.organization_id, null, 'hr.employees.read')
      )
    )
  order by m.joined_at desc nulls last, m.created_at desc;
$$;

revoke all on function hr.list_workforce_directors() from public;
grant execute on function hr.list_workforce_directors() to authenticated;
