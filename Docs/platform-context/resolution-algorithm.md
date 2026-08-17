# Resolution algorithm

1. Authenticate the user.
2. Load all active organization memberships.
3. Use a valid requested or secure-cookie organization; use the verified platform-owner organization for a platform super-admin when appropriate; require a chooser when multiple organizations remain.
4. Validate the application registry entry, active application, entitlement, and role assignment.
5. Read the organization `company_scope_mode`.
6. Validate a requested/cookie company against active company membership. Required mode fails without one; optional mode may remain organization-wide; organization-only always clears company scope.
7. Resolve roles, permissions, access mode, and return the typed context.
