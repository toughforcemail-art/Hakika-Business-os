begin;

alter table real_estate.tenants
  add column if not exists profile_image_url text;

insert into storage.buckets (id, name, public)
values ('tenant-avatars', 'tenant-avatars', true)
on conflict (id) do update set public = true;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'tenant_avatars_insert') then
    create policy tenant_avatars_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'tenant-avatars');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'tenant_avatars_update') then
    create policy tenant_avatars_update on storage.objects for update to authenticated
      using (bucket_id = 'tenant-avatars') with check (bucket_id = 'tenant-avatars');
  end if;
end $$;

commit;
