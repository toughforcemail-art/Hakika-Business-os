# Page Inventory — Real Estate

Each page is listed with its source file, control counts, and completeness status.

---

## RE-DASHBOARD — Real Estate Dashboard
**Route:** `/app/real-estate/dashboard`
**Source:** `frontend/src/pages/DashboardRealEstate.tsx`
**Page title:** "Real Estate Hub"

### Metrics displayed
- Properties count
- Units count
- Tenants count
- Occupancy %
- Paid Invoices (Ksh)
- Unpaid Invoices (Ksh)
- Pending invoice count

### Sections
1. Header with "Reports" button → `/app/real-estate/reports/statement-of-rent`
2. "Add Property" button → `/app/real-estate/properties`
3. Metrics grid (7 cards)
4. Split section with "Open split page" and "Split management" buttons
5. Properties table (name, units, rooms, occupancy %, rent roll) — clickable rows → property detail
6. "View All" link → `/app/real-estate/properties`
7. Occupancy status card (progress bar)
8. Revenue card (total, collected invoices, outstanding, pending)
9. Revenue Trends chart (AreaChart, last 6 months from re_invoices)
10. Pending Actions list (maintenance tasks from re_maintenance) — clickable → `/app/real-estate/maintenance`
11. Recent Payments list — "View All" → `/app/real-estate/payments/mpesa`

### Empty state
When no properties exist: shows onboarding card with "Create your first property" and "Add units next" buttons.

### Controls count
- Buttons: 6
- Links: 3
- Clickable rows: properties table rows, maintenance task rows
- Charts: 1 (AreaChart)

---

## RE-PROPERTIES — Properties List
**Route:** `/app/real-estate/properties`
**Source:** `frontend/src/pages/real-estate/Properties.tsx`
**Page title:** "Total Properties: N"

### Controls
- Search input (filters by name, address, location, county)
- "Add New Property" button → opens inline form
- Property cards grid (3 columns desktop)
  - Card click → `/app/real-estate/properties/:id`
  - Hover actions: Edit (pencil), Upload photo (camera), Delete (trash)
- Empty state: "Add Property" button

### Add/Edit Property Form (inline, slide-in)
See form-field-inventory.md → FORM-PROPERTIES

### Delete Confirmation Dialog
- "Delete Property?" modal
- "Cancel" + "Delete Permanently" buttons
- Uses `archive_record` RPC

### Controls count
- Buttons: 4 (Add, Edit per card, Upload per card, Delete per card)
- Inputs: 1 search
- Dialogs: 1 delete confirm

---

## RE-PROPERTY-DETAIL — Property Details
**Route:** `/app/real-estate/properties/:id`
**Source:** `frontend/src/pages/real-estate/PropertyDetails.tsx`
**Page title:** Property name

### Sections
1. Back arrow → `/app/real-estate/properties`
2. Property photo (clickable → lightbox)
3. "Add Unit" button → `/app/real-estate/houses?property_id=:id&action=add`
4. Stats cards: Occupancy %, Collection %, Revenue (lifetime), Arrears
5. Planned inventory cards (if planned_unit_mix set): Planned Inventory, Planned Bedrooms, Actual Units Recorded
6. Tabs: Inventory | Financials

### Inventory tab
- Unit count heading
- Search input (filters by unit_number, type)
- Unit cards grid (3 columns)
  - "View Details" link → `/app/real-estate/houses?edit=:unitId`

### Financials tab
- "View All Invoices" link → `/app/real-estate/invoice/list`
- Recent invoices table (Invoice #, Status, Due, Balance, Date, Action chevron)
- Empty state: "Generate Monthly Bills" link → `/app/real-estate/invoice/auto-billing`

### Lightbox modal
- Close (X), Previous, Next navigation buttons
- Image counter

### Controls count
- Buttons: 3 (Add Unit, tab switches ×2)
- Links: 3 (Back, View All Invoices, Generate Monthly Bills)
- Inputs: 1 search
- Dialogs: 1 lightbox

---

## RE-UNITS — Houses & Residential Units
**Route:** `/app/real-estate/units` (also `/app/real-estate/houses`)
**Source:** `frontend/src/pages/real-estate/HousesUnits.tsx`
**Page title:** "Houses & Residential Units"

### Header controls
- Table/Grid view toggle (List icon, LayoutGrid icon)
- Print button → `printWorkspacePage()`
- Delete button (bulk — currently shows "Bulk delete functionality to be implemented" toast)
- "Add New Unit" button → `/app/real-estate/units/add`

### Filters
- Search input (unit number or property name)
- Property filter dropdown
- Type filter dropdown (12 unit types)
- Status filter dropdown (vacant, occupied, under_maintenance)
- "Clear Filters" button (conditional)

### Table view columns
- Unit Detail (unit number + floor)
- Property
- Specs & Status (type, bed/bath, status badge)
- Rent (Ksh)
- Actions: Assets link → `/app/real-estate/units/:id/assets`, Edit button, Delete button

### Grid view
- Unit cards with Assets + Edit + Delete actions

### Add/Edit Unit Modal (inline modal)
See form-field-inventory.md → FORM-UNITS

### Delete Confirmation Dialog
- "Permanently Delete?" modal
- Cancel + "Delete Now" buttons
- Hard delete via `supabase.from('re_units').delete()`

### Empty states
- Empty workspace: "Create your first property" button → `/app/real-estate/properties`
- No units found: "Add Your First Unit" button → `/app/real-estate/units/add`

### URL parameter behavior
- `?property_id=X&action=add` → auto-opens form with property pre-selected
- `?edit=X` → auto-opens edit form for unit X

### Controls count
- Buttons: 7 header + 3 per row (table) or 3 per card (grid)
- Inputs: 1 search
- Selects: 3 filters
- Dialogs: 1 add/edit modal, 1 delete confirm

---

## RE-TENANTS — Tenant Management
**Route:** `/app/real-estate/tenants`
**Source:** `frontend/src/pages/real-estate/TenantManagement.tsx`
**Page title:** "Tenant Management"

### Header controls
- Print button
- Delete button (bulk — placeholder toast)
- "Onboard Tenant" button (hidden when form or detail modal open)

### Quick nav pills
- "Tenant directory" → `/app/real-estate/tenants`
- "Archived tenants" → `/app/real-estate/deleted/tenants`
- "Backfill invoices" → `syncMissingInvoices()`

### Sticky filter bar
- Search input (name, phone, email)
- Property filter dropdown
- Unit filter dropdown
- Status filter (All / Active / Inactive)
- "Clear" button (conditional)
- "Backfill invoices" button (duplicate of pill)

### Tenant table columns
- Tenant Name (avatar + name + tenant_no + national_id)
- Contact Details (phone + email)
- Unit Allocation (unit number + property + rent)
- Lease Status (active/inactive badge + end date)
- Portal Login (sent/not sent badge + username)
- Actions (right-aligned)

### Row actions (per tenant)
- "Send Login" / "Resend Login" → `handleSendTenantLogin()` → Edge Function `admin-create-tenant-login`
- "Reset" → `handleResetTenantLogin()` → Edge Function `admin-create-tenant-login` with `reset:true`
- Edit (pencil) → opens onboarding form pre-filled
- "Profile" → `/app/real-estate/tenants/:id/profile`
- "Portal" → `/app/real-estate/tenants/:id/portal`
- "Swap Unit" (conditional: active + has unit) → opens 4-step transfer dialog
- "Archive" → `handleDeleteTenant()` (soft delete + unit release + lease deactivation + invoice soft-delete)

### Row click
- Entire row navigates to `/app/real-estate/tenants/:id/profile`

### Onboard/Edit Tenant Form (inline panel)
See form-field-inventory.md → FORM-TENANTS

### Lease Information Modal (selectedTenant)
- Tenant avatar + name + tenant_no
- Phone + email
- Unit details (unit number, property, monthly rent with inline edit)
- Lease terms (status, start date, end date, portal sent date, portal username, tenant_no)
- Emergency contacts list
- Footer: "Send/Resend Tenant Login" button, "Close Details" button

### Rent Edit (inline in modal)
- Edit pencil → shows Ksh input + Save (check) + Cancel (X) buttons
- Saves to `re_units.rent_amount`

### Swap Unit Dialog (4-step modal)
Step 1 — Location: "Same property" | "Different property"
Step 2 — Unit & Date: destination property (if different), destination unit, effective date, reason
Step 3 — Arrears review: per-invoice action (Migrate / Mark paid / Write off), bulk "All → Migrate" / "All → Mark Paid"
Step 4 — Confirm: summary table + "Confirm Swap" button → `swap_tenant_unit` RPC

### Controls count
- Buttons: 8 header/nav + 7 per row + 4 modal footer
- Inputs: 1 search
- Selects: 3 filters
- Dialogs: 1 onboard form, 1 lease modal, 1 swap dialog (4 steps)

---

## RE-INVOICE-OVERVIEW — Billing Analytics
**Route:** `/app/real-estate/invoice`
**Source:** `frontend/src/pages/real-estate/InvoiceOverview.tsx`
**Page title:** "Billing Analytics"

### Controls
- Print button → `printWorkspacePage()`
- 4 metric cards: Total Billed, Total Collected, Outstanding, Collection Rate
- Revenue Trend chart (bar chart, last 6 months — static mock data)
- Payment Distribution chart (static mock percentages: M-Pesa 75%, Bank 15%, Cash 10%)

### Data source
- `re_invoices` — selects `amount_due, amount_paid, status` — NO company filter (⚠️ defect)

### Controls count
- Buttons: 1 (Print)
- Charts: 2 (static/mock)

---

## RE-INVOICE-LIST — Invoice List
**Route:** `/app/real-estate/invoice/list`
**Source:** `frontend/src/pages/real-estate/InvoiceList.tsx`
**Page title:** "Invoice List"

### Header stats
- Invoices count, Paid count, Partial count, Balance (Ksh)

### Header actions
- "Sync Payments" → `syncMpesaPayments()` service
- "Run Monthly Billing" → `generateMonthlyInvoices()` service
- "Export" button (no handler — ⚠️ placeholder)
- "Delete All" → `handleDeleteAllFiltered()` (role-gated: Super Admin/Admin/Director)
- "New Invoice" → `/app/real-estate/invoice/add-item`

### Filters
- Search input (invoice #, tenant, unit) — 300ms debounce
- Status filter (All / Paid / Unpaid / Partial / Overdue)
- Type filter (All / Rent / Water / Electricity / Garbage / Internet / Penalty / Other)

### Table columns (min-width 1700px)
- Invoice # + match label badge
- Type
- Tenant / Unit
- Created (datetime)
- Invoice Date
- Due Date
- Amount (Ksh)
- Paid So Far (Ksh)
- Split (Fee + Landlord)
- Last Payment (receipt + callback time)
- Receipt
- Balance (Ksh)
- Status badge
- Payment Link (match source badge)
- Actions

### Row actions
- "Send STK" → opens STK draft modal
- SMS icon → `handleSendInvoice(inv, 'sms')` → `sendBulkSms`
- WhatsApp icon → `handleSendInvoice(inv, 'whatsapp')` → `sendBulkSms`
- Delete (trash) → `deleteInvoice()` (role-gated)

### STK Push Modal
- Invoice number display
- Confirmation SMS status panel
- Live status panel (real-time polling)
- Tenant name + Property/Unit display
- Phone input (editable)
- STK Amount input (editable, defaults to balance)
- Cancel button
- "Resend confirmation SMS" button (admin-only)
- "Send KES X" button → `sendStkFromList()` → `callDaraja(stk-push)`

### Realtime subscriptions
- `re_invoices` (company_id filter)
- `re_payments` (company_id filter)
- `mpesa_transactions` (company_id filter)

### Controls count
- Buttons: 6 header + 4 per row + 3 STK modal
- Inputs: 1 search
- Selects: 2 filters
- Dialogs: 1 STK modal

---

## RE-AUTO-BILLING — Auto-Billing Engine
**Route:** `/app/real-estate/invoice/auto-billing`
**Source:** `frontend/src/pages/real-estate/AutoBilling.tsx`
**Page title:** "Auto-Billing Engine"

### Controls
- Billing Cycle selectors (year + month dropdowns)
- Split Rule: interest mode (Percentage/Flat fee) + interest rate input
- Split Preview display
- "Run Global Cycle" button → `handleProcess()` → inserts to `re_invoices`
- Summary tiles: Properties, Occupied units, Vacant units, Gross invoices, Service fees, Landlord payable
- Property filter tabs (All Properties + one per property)
- Property Billing Hub grid (cards per property → navigate to `/app/real-estate/invoice/auto-billing/:id`)
- Generation Preview table (Tenant/Unit, Charge Type, Expected Date, Amount, Inspect button)
- Available Units table (Unit, Property, Rent)
- STK Push at will panel (Tenant name, Phone, Amount inputs + "Send STK Push" button)
- Notification settings (Auto-email checkbox, Send SMS reminder checkbox)
- Selected unit detail panel (conditional on Inspect click)

### Controls count
- Buttons: 5 + N property tabs + N inspect buttons
- Inputs: 3 (rate, STK name, phone, amount)
- Selects: 2 (year, month) + 1 (interest mode)
- Checkboxes: 2

---

## RE-MPESA-TRACKER — M-Pesa Payment Tracker
**Route:** `/app/real-estate/payments/mpesa`
**Source:** `frontend/src/pages/real-estate/MpesaPaymentTracker.tsx`
**Page title:** "M-Pesa Payment Tracker"

### Header controls
- "Backfill Past Payments" button (admin-only) → `backfillPastPayments()`
- "Export CSV" button → `exportCsv()`
- "Refresh" button → `fetchData()`

### Summary tiles
- Total, STK, C2B, B2C, B2B, Reversal counts

### Filters
- Search input (receipt, phone, reference, status)
- Event type filter (All / STK / C2B / B2C / B2B / Reversal / Status / Balance)
- Property filter dropdown
- Unit filter dropdown
- Time filter input (YYYY-MM or timestamp)

### Table columns
- Type badge (STK/C2B/B2C/B2B/Reversal/Status/Balance)
- Receipt / Ref
- Invoice (invoice_number + invoice_id + tenant_id + match_source)
- Property / Unit
- Phone / Customer
- Time
- Paid In (KES)
- Withdrawn (KES)
- Status
- Outcome badge
- "Details" button → opens event detail modal

### Event Detail Modal
- Type, Receipt, Invoice ID, Invoice #, Property/Unit, Tenant, Time
- Tenant history sync status panel
- Match status panel
- Callback audit trail (up to 3 entries)
- Manual Link panel (admin-only): invoice dropdown + "Force Link Payment" button
- Raw JSON display

### Controls count
- Buttons: 3 header + 1 per row + 2 modal
- Inputs: 1 search + 1 time filter
- Selects: 3 filters
- Dialogs: 1 event detail modal

---

## RE-RECONCILIATION — Hakika M-Pesa Reconciliation
**Route:** `/app/real-estate/reconciliation`
**Source:** `frontend/src/pages/real-estate/HakikaReconciliation.tsx`
**Page title:** "Hakika M-Pesa Reconciliation"

### Controls
- "Refresh" button → `fetchData()`
- "Tenant Ledger" button → `/app/real-estate/reports/tenant-ledger`
- Summary tiles: Callbacks, Ledger rows, Payouts, Pending
- Invoice Drill-down: search input + invoice select dropdown
- Invoice detail panel: Invoice #, Status, Reconciliation, Amount due/paid, STK amount, Service fee, Landlord payable, Tenant, Phone
- STK amount input (editable)
- "Send STK Push Now" button → `handleSendStk()` → `callDaraja(stk-push)`
- Landlord payout panel: Payable amount, Service fee, Landlord phone input, "Disburse landlord payable" button → `callDaraja(b2c-payment-request)`
- Raw Callbacks panel (list)
- Ledger Splits panel (list)
- Payout Status panel (list)
- Ledger income/expense summary cards

### Controls count
- Buttons: 4 header + 2 drill-down actions
- Inputs: 2 (STK amount, landlord phone) + 1 search
- Selects: 1 (invoice)

---

## RE-DASHBOARD-EMPTY — Empty Workspace State
**Route:** `/app/real-estate/dashboard` (when no properties)
**Controls:**
- "Create your first property" button → `/app/real-estate/properties`
- "Add units next" button → `/app/real-estate/units`

---

## Pages Not Fully Audited (source not read — require follow-up)

| Page | Route | Source File |
|------|-------|-------------|
| AddUnitPage | `/app/real-estate/units/add` | `AddUnitPage.tsx` |
| TenantProfilePage | `/app/real-estate/tenants/:id/profile` | `TenantProfilePage.tsx` |
| TenantPortalDetailsPage | `/app/real-estate/tenants/:id/portal` | `TenantPortalDetailsPage.tsx` |
| DigitalLeases | `/app/real-estate/leases` | `DigitalLeases.tsx` |
| LeaseDetailPage | `/app/real-estate/leases/:id` | `LeaseDetailPage.tsx` |
| MaintenanceRequest | `/app/real-estate/maintenance` | `MaintenanceRequest.tsx` |
| InvoiceTypesPage | `/app/real-estate/invoice/types` | `InvoiceTypesPage.tsx` |
| DeletedInvoicesPage | `/app/real-estate/invoice/deleted` | `DeletedInvoicesPage.tsx` |
| AddInvoiceItem | `/app/real-estate/invoice/add-item` | `AddInvoiceItem.tsx` |
| ArrearsManagement | `/app/real-estate/invoice/arrears` | `ArrearsManagement.tsx` |
| PenaltiesManagement | `/app/real-estate/invoice/penalties` | `PenaltiesManagement.tsx` |
| KRAeTims | `/app/real-estate/invoice/kra` | `KRAeTims.tsx` |
| SplitPayment | `/app/real-estate/split-management` | `SplitPayment.tsx` |
| HakikaPayoutQueue | `/app/real-estate/split-management/queue` | `HakikaPayoutQueue.tsx` |
| HakikaPayoutHistory | `/app/real-estate/split-management/history` | `HakikaPayoutHistory.tsx` |
| HakikaSplitAudit | `/app/real-estate/split-management/split-audit` | `HakikaSplitAudit.tsx` |
| HakikaPayoutControl | `/app/real-estate/split-management/legacy` | `HakikaPayoutControl.tsx` |
| HakikaBankJoin | `/app/real-estate/split-management/bank-join` | `HakikaBankJoin.tsx` |
| ManualPayments | `/app/real-estate/payments/manual` | `ManualPayments.tsx` |
| PesalinkTransactions | `/app/real-estate/payments/pesalink` | `PesalinkTransactions.tsx` |
| AddWaterBill | `/app/real-estate/bill-water/add-bill` | `AddWaterBill.tsx` |
| WaterBillingSummary | `/app/real-estate/bill-water/billing-summary` | `WaterBillingSummary.tsx` |
| MeterReadings | `/app/real-estate/bill-power/meter-recordings` | `MeterReadings.tsx` |
| PostpaidMeters | `/app/real-estate/bill-power/postpaid-meters` | `PostpaidMeters.tsx` |
| ConfigureHouses | `/app/real-estate/bill-power/configure-houses` | `ConfigureHouses.tsx` |
| StatementOfRent | `/app/real-estate/reports/statement-of-rent` | `StatementOfRent.tsx` |
| TenantLedgerPage | `/app/real-estate/reports/tenant-ledger` | `TenantLedgerPage.tsx` |
| PaymentReference | `/app/real-estate/reports/payment-reference` | `PaymentReference.tsx` |
| WaterConsumptionReport | `/app/real-estate/reports/water-consumption` | `WaterConsumptionReport.tsx` |
| ArrearsReport | `/app/real-estate/reports/arrears` | `ArrearsReport.tsx` |
| ExpenseReport | `/app/real-estate/reports/expenses` | `ExpenseReport.tsx` |
| FinancialYield | `/app/real-estate/yield` | `FinancialYield.tsx` |
| VacatingNotices | `/app/real-estate/communication/vacating-notices` | `VacatingNotices.tsx` |
| MaintenanceCommunication | `/app/real-estate/communication/maintenance` | `MaintenanceCommunication.tsx` |
| LeaseDocumentsComm | `/app/real-estate/communication/lease-documents` | `LeaseDocumentsComm.tsx` |
| SmsCommunication | `/app/real-estate/communication/hub` | `SmsCommunication.tsx` |
| CaretakersManagement | `/app/real-estate/management/caretakers` | `CaretakersManagement.tsx` |
| LandlordsManagement | `/app/real-estate/management/landlords` | `LandlordsManagement.tsx` |
| LandlordPortalDetailsPage | `/app/real-estate/management/landlords/:id/portal` | `LandlordPortalDetailsPage.tsx` |
| DeletedRealEstateRecords | `/app/real-estate/deleted/:kind` | `DeletedRealEstateRecords.tsx` |
| AssetInventory | `/app/real-estate/assets` | `AssetInventory.tsx` |
| AssetTracking | `/app/real-estate/assets/tracking` | `AssetTracking.tsx` |
| REAddAsset | `/app/real-estate/assets/add` | `AddAsset.tsx` |
| UnitAssetInventory | `/app/real-estate/units/:id/assets` | `UnitAssetInventory.tsx` |
| TenantAssetAssignmentPage | `/app/real-estate/tenant-assets/:id` | `TenantAssetAssignmentPage.tsx` |
| AssignAssetToTenantPage | `/app/real-estate/tenant-asset-assign/:id` | `AssignAssetToTenantPage.tsx` |
| InspectionReports | `/app/real-estate/inspections` | `InspectionReports.tsx` |
| HakikaLedger | `/app/real-estate/ledger` | `HakikaLedger.tsx` |
| NotesFindings | `/app/real-estate/notes` | `NotesFindings.tsx` |
| TenantDashboardPage | `/app/tenant/dashboard` | `TenantDashboardPage.tsx` |
| TenantPortalProfilePage | `/app/tenant/profile` | `TenantPortalProfilePage.tsx` |
| TenantPaymentsPage | `/app/tenant/payments` | `TenantPaymentsPage.tsx` |
| LandlordDashboardPage | `/app/landlord/dashboard` | `LandlordDashboardPage.tsx` |
| CaretakerDashboardPage | `/app/caretaker/dashboard` | `CaretakerDashboardPage.tsx` |
| AutoBillingPropertyDetail | `/app/real-estate/invoice/auto-billing/:id` | `AutoBillingPropertyDetail.tsx` |
| PublicInvoicePage | `/invoice/:token` | `PublicInvoicePage.tsx` |
