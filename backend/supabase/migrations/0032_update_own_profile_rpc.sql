begin;
create or replace function iam.update_own_profile(p_display_name text, p_phone_e164 text, p_locale text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, iam
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;
  if nullif(btrim(p_display_name), '') is null then
    raise exception 'Display name is required';
  end if;
  insert into iam.profiles (user_id, display_name, phone_e164, locale)
  values (auth.uid(), btrim(p_display_name), nullif(btrim(p_phone_e164), ''), coalesce(nullif(btrim(p_locale), ''), 'en-KE'))
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    phone_e164 = excluded.phone_e164,
    locale = excluded.locale;
end;
$$;
revoke all on function iam.update_own_profile(text, text, text) from public;
grant execute on function iam.update_own_profile(text, text, text) to authenticated;
commit;
