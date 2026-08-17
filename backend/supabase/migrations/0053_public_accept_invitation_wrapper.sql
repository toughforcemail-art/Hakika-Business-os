begin;

create or replace function public.accept_invitation(invitation_token_hash text)
returns uuid
language sql
security definer
set search_path = pg_catalog, private
as $$
  select private.accept_invitation(invitation_token_hash);
$$;

revoke all on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated;

commit;
