# Real Estate vertical slice pre-implementation report

## Existing schema

- `real_estate.properties` and `real_estate.units` exist in migration `0005_real_estate_integrations_communications.sql`.
- Existing records use `organization_id`, `company_id`, UUID keys, composite tenant foreign keys, and legacy `deleted_at`/`monthly_rent_minor` fields.
- `0006` enables RLS and adds read policies through `private.has_company_access` and `private.has_permission`.
- `audit.events`, applications, pages, permissions, subscriptions, memberships, and canonical access helpers already exist.
- `unit_assets`, `property_photos`, and a Real Estate-specific notes table were not found.

## Missing and selected migration

Migration `0013_real_estate_vertical_slice.sql` was selected after local history inspection (`0001` through `0012`). Local Supabase migration status and remote history could not be connected because the local Postgres container is not running; no hosted push was attempted.

The migration is additive: it extends existing tables, adds `unit_assets` and `property_photos`, indexes, a partial active-unit uniqueness index, permissions/pages, and RLS policies. No customer/demo data is seeded.

## Files to modify

- `backend/supabase/migrations/0013_real_estate_vertical_slice.sql`
- Real Estate module repositories, services, actions, schemas, components, and routes under `frontend/src`.
- Real Estate migration matrices and status documents.

## Risks and preserved behavior

- Existing `address` and `monthly_rent_minor` fields remain for compatibility; the new normalized fields are additive.
- No hard deletes are introduced. Unit/property lifecycle uses archive fields.
- Hosted SQL dry-run, remote history, and RLS tests remain pending until a linked Supabase project is available.

## Defects corrected

- Replaces placeholder directory pages with tenant-scoped repository-backed pages.
- Separates planned unit count from actual unit records.
- Adds explicit unit-asset tenant integrity and active unit-number uniqueness.
- Adds mutation permission policies and archive-safe behavior.
