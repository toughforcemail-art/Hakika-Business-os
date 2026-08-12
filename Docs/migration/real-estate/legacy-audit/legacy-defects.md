# Legacy Defects — Real Estate

Known bugs, placeholder behavior, and data integrity issues found during audit.

---

## DEFECT-001 — Missing Company Filter on Tenant Queries
**Severity:** High
**Location:** `TenantManagement.tsx` — `fetchTenantData`, `fetchAvailableUnits`, `fetchAllUnits`
**Description:** All three fetch functions query `re_tenants` and `re_units` without a `company_id` filter. Any authenticated user with `hakika` service access can see all tenants and units across all companies.
**Evidence:** No `.eq('company_id', ...)` in any of the three fetch functions.
**Impact:** Cross-tenant data exposure.
**Mitigation in new system:** Enforce company scope via RLS policies server-side.

---

## DEFECT-002 — Missing Company Filter on Invoice Queries
**Severity:** High
**Location:** `InvoiceList.tsx` — `fetchData`
**Description:** `re_invoices` is fetched without a company filter. Company filtering is applied client-side: `joinedInvoices.filter(i => i.company_id === profile.company_id)`. This means all invoices are transferred over the network before filtering.
**Evidence:** `supabase.from('re_invoices').select('*').is('deleted_at', null)` — no company filter.
**Impact:** Performance + data exposure.

---

## DEFECT-003 — Missing Company Filter on M-Pesa Transactions
**Severity:** High
**Location:** `MpesaPaymentTracker.tsx` — `fetchData`
**Description:** `mpesa_transactions` fetched without company filter (limit 1000). All M-Pesa events visible to any authenticated user.
**Evidence:** `supabase.from('mpesa_transactions').select('*').limit(1000)` — no filter.

---

## DEFECT-004 — Missing Company Filter on Auto-Billing Queries
**Severity:** Medium
**Location:** `AutoBilling.tsx` — `fetchData`
**Description:** `re_properties`, `re_leases`, `re_units`, `re_tenants` all fetched without company filter. Auto-billing preview shows all active leases across all companies.
**Evidence:** No `.eq('company_id', ...)` in any of the four parallel queries.

---

## DEFECT-005 — Properties Fetch Has No Company Filter
**Severity:** Medium
**Location:** `Properties.tsx` — `fetchProperties`
**Description:** `re_properties` fetched without company filter (only `is_deleted=false` and `deleted_at IS NULL`). All properties visible to any authenticated user.
**Note:** Company filter was intentionally removed per conversation history to fix a missing data issue. The root cause was `resolveCompanyScope` returning wrong ID.

---

## DEFECT-006 — Export Button Has No Handler
**Severity:** Low
**Location:** `InvoiceList.tsx` — "Export" button
**Description:** The "Export" button in the Invoice List header has no click handler. It renders as a button with no `onClick`.
**Evidence:** `<button title="Export invoice list" className="..."><Download size={16} /> Export</button>` — no onClick.
**Status:** Legacy placeholder / non-functional.

---

## DEFECT-007 — Bulk Delete Placeholder (Units)
**Severity:** Low
**Location:** `HousesUnits.tsx` — "Delete" header button
**Description:** Clicking "Delete" shows `window.confirm('Delete selected units?')` then a toast "Bulk delete functionality to be implemented." No actual deletion occurs.
**Status:** Legacy placeholder / non-functional.

---

## DEFECT-008 — Bulk Delete Placeholder (Tenants)
**Severity:** Low
**Location:** `TenantManagement.tsx` — "Delete" header button
**Description:** Clicking "Delete" shows `window.confirm(...)` then a toast "Bulk delete functionality to be implemented." No actual deletion occurs.
**Status:** Legacy placeholder / non-functional.

---

## DEFECT-009 — InvoiceOverview Uses No Company Filter
**Severity:** Medium
**Location:** `InvoiceOverview.tsx` — `fetchStats`
**Description:** `re_invoices` fetched with only `amount_due, amount_paid, status` — no company filter. Billing analytics show totals across all companies.
**Evidence:** `supabase.from('re_invoices').select('amount_due, amount_paid, status')` — no filter.

---

## DEFECT-010 — Revenue Trend Chart Uses Mock Data
**Severity:** Low
**Location:** `InvoiceOverview.tsx` — Revenue Trend chart
**Description:** The bar chart uses hardcoded heights `[45, 60, 55, 80, 70, 90]` and labels `['Jan','Feb','Mar','Apr','May','Jun']`. Not connected to real data.
**Status:** Legacy placeholder.

---

## DEFECT-011 — Payment Distribution Chart Uses Mock Data
**Severity:** Low
**Location:** `InvoiceOverview.tsx` — Payment Distribution chart
**Description:** M-Pesa 75%, Bank 15%, Cash 10% are hardcoded. Not connected to real data.
**Status:** Legacy placeholder.

---

## DEFECT-012 — UnitsManagement Component Has No Route
**Severity:** Low
**Location:** `App.tsx` — `UnitsManagement` lazy import
**Description:** `UnitsManagement` is imported but never assigned to any route. `/app/real-estate/units` renders `HousesUnits` instead.
**Impact:** Dead code. Any work done in `UnitsManagement.tsx` is unreachable.

---

## DEFECT-013 — Session Race Condition (Fixed)
**Severity:** Resolved
**Location:** `TenantManagement.tsx`, `HousesUnits.tsx`
**Description:** Previously, fetches fired before Supabase JWT was confirmed, causing RLS failures. Fixed by gating on `authLoading` from `AccessContext`.
**Status:** Fixed per conversation history.

---

## DEFECT-014 — Elevated Roles See All Data (Intentional but Risky)
**Severity:** Medium
**Location:** `DashboardRealEstate.tsx`
**Description:** `Super Admin`, `Director`, `Director / Super Admin` roles have `companyId = null`, causing all queries to run without company filter. This is intentional for admin oversight but means admins see all tenant/financial data.
**Recommendation:** Add explicit admin scope selection in new system.

---

## DEFECT-015 — Inspection Item Add Uses window.prompt
**Severity:** Low
**Location:** `Properties.tsx` — inspection config section
**Description:** Adding an inspection item uses `window.prompt()` which is not styleable and blocks the UI thread.
**Status:** Legacy UX issue.

---

## DEFECT-016 — Auto-Billing STK "Send STK Push" Button is Non-Functional
**Severity:** Low
**Location:** `AutoBilling.tsx` — `handleSendStk` in "STK Push at will" panel
**Description:** `handleSendStk()` only shows a toast with the prepared data. It does NOT call `callDaraja`. The actual STK call is only in the unit detail panel's inline button.
**Evidence:** `handleSendStk` body: `setToast({message: 'STK push prepared for...', type: 'success'})` — no Daraja call.
**Status:** Legacy placeholder / non-functional for the main STK panel.

---

## DEFECT-017 — Tenant Archive Does Not Check for Active Invoices Before Archiving
**Severity:** Medium
**Location:** `TenantManagement.tsx` — `handleDeleteTenant`
**Description:** The archive flow soft-deletes all invoices and payments for the tenant without checking if any are partially paid or disputed. This is irreversible.
**Recommendation:** Add invoice review step before archive (similar to swap unit arrears review).

---

## DEFECT-018 — `re_property_stats` View May Not Exist
**Severity:** Unknown
**Location:** `PropertyDetails.tsx`, `Properties.tsx`
**Description:** Both pages query `re_property_stats` view. If this view does not exist in the new database, stats will silently fail (error is caught and ignored in PropertyDetails).
**Recommendation:** Verify view exists or replace with computed query.
