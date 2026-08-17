# RLS policy conventions

Every scoped policy follows the same order:

1. The caller has active membership in the row organization.
2. A non-null company belongs to that organization and the caller has active membership in it. A null company is valid for organization-only scope.
3. The caller has the exact application permission, or is a validated platform operator using an explicit organization context.

Use operation-specific policies named `<table>_select_v1`, `<table>_insert_v1`, `<table>_update_v1`, and `<table>_delete_v1` only when deletion is intentionally supported. Do not use broad `FOR ALL` policies for business tables. Do not rely on a frontend permission check as an RLS substitute.

`private.has_scoped_permission` is the shared helper for organization/company/permission evaluation. Policy consolidation removes redundant policy definitions without deleting rows or migration history.
