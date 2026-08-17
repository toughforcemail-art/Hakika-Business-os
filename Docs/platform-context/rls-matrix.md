# RLS matrix

Every business table is organization-scoped. Company-scoped rows additionally use validated company membership when `company_id` is non-null. Organization-only rows use organization membership and organization-level permissions. The shared `private.has_company_access` function now treats null company scope as organization-wide while still validating a non-null company.
