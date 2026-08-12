# Phase 1 security review

- Environment secrets remain outside source control; root `.env.example` contains only the new project URL and publishable key.
- The linked project ref was verified as `upvupkuokinwqwsfxyxy`; no legacy ref was used.
- No service-role or Daraja credentials are present in the frontend or migrations. `integrations.mpesa_accounts.secret_reference` is a reference to a server-side secret, not secret material.
- Organization and company access use fixed-search-path `security definer` helpers and explicit memberships.
- Operational tables have RLS enabled before user-facing use; writes are not granted by the Phase 1 baseline except audited inserts.
- Audit mutation triggers make `audit.events` append-only; UI telemetry is separate and documented as allowlisted.
- Finance is not entitled in the launcher fixture and its missing supplied logo is visible as unavailable; no unrelated page redirects to billing.
- Before push, add full RLS coverage for every supplied domain table, portal-grant policies, invitation RPCs, provisioning, billing idempotency, allocation invariants and two-tenant isolation tests.
