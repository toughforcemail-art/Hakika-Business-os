begin;

-- The tenant RLS policy checks portal grants as a fallback. PostgREST must
-- have table privilege before PostgreSQL can evaluate that policy.
grant select on real_estate.portal_grants to authenticated;

commit;
