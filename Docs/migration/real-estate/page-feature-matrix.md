# Page and feature matrix

Every future record must capture inputs, buttons, row/bulk actions, dialogs, tabs, filters, exports, API calls, tables, permissions, tenant fields, validation, loading/empty/error states, responsive behavior, evidence and open questions.

Current foundation status: `Scaffolded` only. No legacy feature is marked implemented.
# Production vertical slice update (2026-08-12)

The first production-oriented slice is implemented at `/real-estate/dashboard`, `/real-estate/properties/**`, and `/real-estate/units/**`. The new pages use the shared shell, server-derived tenant context, repository/service/action flow, and additive migration `0013_real_estate_vertical_slice.sql`. Tenant assignment, leases, billing, photo storage uploads, and destructive deletion remain deferred.
