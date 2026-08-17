begin;
grant select, insert, update on iam.profiles to authenticated;
drop policy if exists profiles_insert_self on iam.profiles;
drop policy if exists profiles_update_self on iam.profiles;
create policy profiles_insert_self on iam.profiles for insert to authenticated
  with check (user_id = auth.uid());
create policy profiles_update_self on iam.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
commit;
