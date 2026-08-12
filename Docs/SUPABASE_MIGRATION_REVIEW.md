# Supabase migration review

## Deployment gate

- Working project: `C:\Users\evince\Projects\Hakika-Business-OS`
- Expected project reference: `upvupkuokinwqwsfxyxy`
- Expected environment: not proven to be staging or disposable
- CLI: Supabase 2.113.0
- Remote project access: blocked; the authenticated CLI account did not list the expected reference
- Real push: not performed
- Linked migration history: unavailable because this copy has no linked project metadata

The local migrations are therefore classified as pending for this workspace only. They must not be applied to the unverified remote project.

## Detailed review matrix

| Migration | Purpose | Tables created/changed | Functions / triggers | RLS policies | Data changes | Destructive statements | Expected result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0001 | Extensions, schemas and timestamp helper | Schemas/extensions only | `private.set_updated_at` | None | None | None | Base namespaces available. |
| 0002 | Platform tenancy foundation | Organizations, companies, profiles, organization/company memberships | Updated-at triggers | RLS enabled later by 0006 | None | No drops/truncates | Tenant hierarchy and composite ownership keys exist. |
| 0003 | Application catalogue and IAM/billing primitives | Applications, pages, permissions, roles, role permissions, member app roles, plans, subscriptions | Updated-at triggers | RLS enabled later by 0006/0009 | None | No drops/truncates | Catalogue and entitlement primitives exist. |
| 0004 | Immutable audit foundation | `audit.events`, `audit.ui_events` | `block_audit_mutation` trigger | RLS enabled later | None | No drops/truncates | Audit rows cannot be updated/deleted. |
| 0005 | Real Estate and integration foundations | Properties, units, M-Pesa accounts/callbacks, communications | Updated-at triggers | RLS enabled later | None | No drops/truncates | Operational tables exist without customer fixture data. |
| 0006 | Access helpers and baseline policies | Existing tables altered for RLS | Organization/company/permission helpers | Baseline tenant policies | None | No drops/truncates | RLS is enabled with scoped access helpers. |
| 0007 | Safe global catalogue seed | Existing application, page, role and permission rows | None | Existing policies apply | Global catalogue only; no properties, tenants, invoices, payments or employees | No destructive statements | Required catalogue is repeatably seeded. |
| 0008 | Billing, portal and invariant foundation | Invitations, leases, invoices, payments, allocations, portal grants/previews, M-Pesa transaction/payout tables | Allocation and preview expiry checks/triggers | RLS enabled for new tables in 0009 | None | No drops/truncates | Billing totals, portal scope and idempotency constraints exist. |
| 0009 | Complete entitlement and operational RLS | Existing tables altered for RLS/grants | Entitlement, invitation acceptance and audited Real Estate RPCs | Entitlement, portal, audit, integration and mutation policies | None | No drops/truncates | Cross-tenant access is denied and sensitive mutations are audited. |
| 0010 | Renting/provisioning service | `platform.provisioning_events`; subscription lifecycle RPC | `provision_organization`, `set_application_subscription_status` | Platform-owner-only provisioning event reads | None | No drops/truncates | Atomic, AAL2-gated provisioning with persistent idempotency. Not deployed. |

## Migration classification

| Migration | Classification | Review |
| --- | --- | --- |
| 0001_extensions_schemas_helpers.sql | Pending / safe additive | Extensions, schemas and helper functions; review grants before staging. |
| 0002_platform_tenancy.sql | Pending / staging required | Organizations, companies, profiles and memberships; RLS boundary foundation. |
| 0003_applications_iam_billing.sql | Pending / staging required | Applications, roles, plans and subscriptions; entitlement dependencies. |
| 0004_audit.sql | Pending / staging required | Audit tables and immutable event controls. |
| 0005_real_estate_integrations_communications.sql | Pending / staging required | Operational tables and integration boundaries. |
| 0006_rls_and_access_functions.sql | Pending / staging required | Security functions and policies; requires isolation tests. |
| 0007_seed_registry.sql | Pending / do not include in production push | Registry metadata only; no `--include-seed` push is authorized. |
| 0008_billing_portals_invariants.sql | Pending / staging required | Billing, portals and constraints; requires data-shape tests. |
| 0009_complete_rls_and_entitlements.sql | Pending / staging required | Entitlement and portal policies/RPCs; highest security review priority. |
| 0010_renting_provisioning.sql | Pending / staging required | Transactional organization/company/application provisioning RPC with persistent idempotency event; not applied in this deployment because post-push CLI verification is returning HTTP 403. |

## Static safety scan

The local review must be repeated against the exact remote baseline before deployment. No migration is authorized based only on directory presence. Search targets include destructive DDL/DML, broad policies, RLS disabling, unfiltered updates/deletes and locking changes. The deployment gate remains closed because project environment and remote history are unverified.

## Required next sequence

1. Authenticate with the Supabase account that owns `upvupkuokinwqwsfxyxy`.
2. Confirm the reference appears in `supabase projects list`.
3. Link only that reference from `backend/`.
4. Run `supabase migration list` and, if needed, a reviewed `supabase db pull`.
5. Establish a disposable local/staging baseline and run RLS tests.
6. Run `supabase db push --dry-run` and review the exact list.
7. Obtain explicit approval before any real push.
