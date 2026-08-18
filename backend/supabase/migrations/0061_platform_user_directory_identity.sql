create or replace function platform.list_user_directory()
returns table (
  membership_id uuid,
  user_id uuid,
  organization_id uuid,
  membership_status text,
  joined_at timestamptz,
  display_name text,
  email text,
  phone_e164 text,
  profile_status text
)
language sql stable security definer
set search_path = pg_catalog, platform, iam, auth
as $$
  select m.id, m.user_id, m.organization_id, m.status, m.joined_at,
    coalesce(nullif(btrim(p.display_name), ''), nullif(btrim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1), 'Unnamed user'),
    u.email, p.phone_e164, coalesce(p.status, 'active')
  from iam.organization_memberships m
  join auth.users u on u.id = m.user_id
  left join iam.profiles p on p.user_id = m.user_id
  where private.is_platform_operator()
  order by m.created_at desc;
$$;

revoke all on function platform.list_user_directory() from public;
grant execute on function platform.list_user_directory() to authenticated;
