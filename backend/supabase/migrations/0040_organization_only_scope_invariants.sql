begin;

-- In organization-only mode, company_id is intentionally NULL. An active unit
-- must still belong to only one active lease within the organization.
drop index if exists real_estate.leases_active_unit_unique;
create unique index if not exists leases_active_unit_org_unique
  on real_estate.leases (organization_id, unit_id)
  where archived_at is null
    and status = 'active'
    and unit_id is not null;

commit;
