# Permission Inventory — Real Estate

All access control rules extracted from source code.

---

## Access Control Architecture

### Layers (in order of evaluation)
1. **ProtectedRoute** — requires authenticated session (role present)
2. **AccessGuard** — checks `canSeePage(path)` + `hasServiceAccess('hakika')`
3. **Role-based UI hiding** — controls hidden/disabled based on `profile.role`
4. **Feature flags** — `ENABLE_REAL_ESTATE_AUDIT` etc.

---

## Service Access Gate

All `/app/real-estate/*` routes require `hasServiceAccess('hakika')`.

**Exempt roles (bypass service check):**
- `Super Admin`
- `Director`
- `Director / Super Admin`
- `Administrator`

**Non-exempt behavior:** Redirect to `/app/account/billing?service=hakika`

---

## Page Visibility Gate

`canSeePage(path)` from `usePageVisibility` hook.
Reads from `page_visibility` / `profile_page_visibility` tables.
If false: redirect to `/app/dashboard` (or `/app/tenant/dashboard` for Tenant role).

---

## Role-Based Redirects

| Role | Default redirect |
|------|-----------------|
| `Tenant` | `/app/tenant/dashboard` |
| `Landlord` | `/app/landlord/dashboard` |
| `Caretaker` | `/app/caretaker/dashboard` |
| All others | Module landing path |

---

## Invoice Operations — Role Gate

**Roles allowed to delete invoices:**
- `Super Admin`
- `Administrator`
- `Director`
- `Director / Super Admin`

Defined as `ADMIN_ROLES` constant in `InvoiceList.tsx` and `MpesaPaymentTracker.tsx`.

**Roles allowed to bulk-delete invoices:** Same as above.
**Roles allowed to backfill payments:** Same as above.
**Roles allowed to force-link payments:** Same as above.
**Roles allowed to resend confirmation SMS:** Same as above.

---

## Tenant Portal Login — No Role Gate
`handleSendTenantLogin` and `handleResetTenantLogin` have no explicit role check in UI.
The Edge Function `admin-create-tenant-login` may enforce its own checks server-side.

---

## Tenant Archive — No Role Gate
`handleDeleteTenant` uses `window.confirm()` but no role check in UI.

---

## Swap Unit — Conditional Visibility
"Swap Unit" button only visible when `tenant.is_active && tenant.current_unit_id`.
No role restriction.

---

## Auto-Billing — No Role Gate
`handleProcess()` has no role check. Any authenticated user with service access can run billing.

---

## STK Push — No Role Gate
`sendStkFromList()`, `handleSendStk()` have no role check.

---

## B2C Payout — No Role Gate in UI
`handleDisburseLandlord()` checks B2C env vars but no role check.

---

## Role Names (exact as used in legacy code)

| Role string | Used in |
|-------------|---------|
| `Super Admin` | ADMIN_ROLES, AccessGuard, ModuleRedirector |
| `Administrator` | ADMIN_ROLES, AccessGuard |
| `Director` | ADMIN_ROLES, AccessGuard, ModuleRedirector |
| `Director / Super Admin` | ADMIN_ROLES, AccessGuard, ModuleRedirector |
| `Tenant` | ModuleRedirector, AccessGuard redirect |
| `Landlord` | ModuleRedirector |
| `Caretaker` | ModuleRedirector |

---

## Feature Flags Affecting Real Estate

| Flag | Effect |
|------|--------|
| `ENABLE_REAL_ESTATE_AUDIT` | Enables `real-estate-audit-tenant-created` Edge Function call on tenant create |
| `ENABLE_PLATFORM_PREVIEW` | Redirects some admin routes to platform preview |
| `ENABLE_PLATFORM_IDENTITY` | Redirects credentials/users/roles routes |
| `ENABLE_NAVIGATION_ENGINE` | Replaces sidebar with navigation engine |

---

## Dashboard Access (`dashboard_access` profile field)

Tenants with `dashboard_access` containing `/app/landlord/dashboard` or `/app/tenant/dashboard`
get redirected to those portals by `ModuleRedirector`.

---

## Sidebar Visibility

`SubMenuItem` in `Sidebar.tsx` filters items by:
1. `item.roles` — if set, must include `userRole`
2. `canSeePage(item.path)` — page visibility check

Real Estate sidebar items are defined in the navigation config (not fully audited — requires reading `core/navigation/resolver.ts`).

---

## ⚠️ Security Risks

| Risk | Location | Severity |
|------|----------|----------|
| No company filter on `re_tenants` SELECT | TenantManagement.tsx | High — all tenants visible to any authenticated user |
| No company filter on `re_units` SELECT | HousesUnits.tsx, TenantManagement.tsx | High |
| No company filter on `re_properties` SELECT | Properties.tsx | Medium (company_id set on write) |
| No company filter on `mpesa_transactions` SELECT | MpesaPaymentTracker.tsx | High |
| No company filter on `re_invoices` SELECT | InvoiceList.tsx (client-side filter only) | High |
| Client-supplied `company_id` on INSERT | HousesUnits.tsx, TenantManagement.tsx | Medium — should be server-enforced |
| `handleDeleteTenant` no role check | TenantManagement.tsx | Medium |
| Auto-billing no role check | AutoBilling.tsx | Medium |
| Export button no handler | InvoiceList.tsx | Low (placeholder) |
| Bulk delete placeholder | HousesUnits.tsx, TenantManagement.tsx | Low (not functional) |
