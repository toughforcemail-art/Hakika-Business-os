# Phase 4 route migration matrix

Date: 2026-08-11

The repository contains no Omniguard source tree or Git metadata, so an old-route/source comparison cannot be completed from this checkout. The current new Business OS sidebar was the available source of truth. The routes below are implemented by the protected dynamic route `frontend/src/app/real-estate/[...section]/page.tsx`; they are real server-rendered pages with scoped permission checks and intentional empty states, not sidebar-only labels.

| Application | Section | New route family | Old route/source | Status | Database/permission dependency |
|---|---|---|---|---|---|
| Real Estate | Overview | `/real-estate/properties`, `/units`, `/inspections`, `/ledger`, `/notes` | Not present in checkout | Implemented empty-state pages | `real_estate.properties.read` or `real_estate.units.read`; organization/company RLS |
| Real Estate | Tenants | `/real-estate/tenants`, `/applications`, `/tenant-details`, `/leases`, `/move-in`, `/move-out`, `/deposits` | Not present in checkout | Implemented empty-state pages | Tenant/lease/payment read permissions; organization/company RLS |
| Real Estate | Invoices and billing | `/real-estate/invoices`, `/recurring-billing`, `/billing-schedules`, `/rent-charges`, `/utilities`, `/penalties`, `/credit-notes`, `/receipts`, `/statements` | Not present in checkout | Implemented empty-state pages | Billing, invoice and payment read permissions; idempotent billing backend still required |
| Real Estate | Payments | `/real-estate/payments`, `/payment-allocation`, `/reconciliation`, `/mpesa`, `/mpesa-transactions`, `/unmatched-payments`, `/split-payments`, `/reversals-refunds` | Not present in checkout | Implemented empty-state pages | Payment/M-Pesa read permissions; integration workflows still required |
| Real Estate | Finance and reporting | `/real-estate/collections`, `/arrears`, `/landlord-statements`, `/property-performance`, `/occupancy`, `/income-expenses`, `/exports` | Not present in checkout | Implemented empty-state pages | Scoped billing/property/payment reads; reporting queries still required |
| Real Estate | Administration | `/real-estate/users`, `/roles-permissions`, `/company-settings`, `/property-settings`, `/invoice-settings`, `/payment-settings`, `/notification-templates`, `/audit-activity` | Not present in checkout | Implemented read-only empty-state pages | Admin member/role/audit permissions; mutations still required |
| Platform Admin | Core | `/platform/dashboard`, `/platform/provisioning` | Not present in checkout | Dashboard and provisioning UI exist | Platform-owner membership, platform role, AAL2 for provisioning |

The page template deliberately does not invent records or claim that mutations exist. The next implementation slice should connect each page to tenant-scoped repositories/RPCs and add action-specific permissions before enabling writes.
