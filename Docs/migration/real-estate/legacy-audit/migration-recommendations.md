# Migration Recommendations — Real Estate

Recommended migration order based on dependency analysis and risk assessment.

---

## Principles

1. **Data model first** — Establish all tables and RLS before any UI.
2. **Core before billing** — Properties → Units → Tenants before Invoices.
3. **Fix defects on migration** — Do not carry forward company filter gaps.
4. **Portals last** — Tenant/Landlord/Caretaker portals depend on core being stable.
5. **Payments last** — M-Pesa integration requires stable invoice model.

---

## Phase 1 — Foundation (Migrate First)

| # | Page | Route | Reason |
|---|------|-------|--------|
| 1 | Dashboard | `/app/real-estate/dashboard` | Entry point; validates data model |
| 2 | Properties | `/app/real-estate/properties` | All other entities depend on properties |
| 3 | Property Details | `/app/real-estate/properties/:id` | Needed for unit management |
| 4 | Units | `/app/real-estate/units` | Required before tenants |
| 5 | Add Unit | `/app/real-estate/units/add` | Unit creation |

**Key changes from legacy:**
- Add company filter to all queries (fix DEFECT-001 through DEFECT-005)
- Replace `re_property_stats` view dependency with computed query
- Replace `window.prompt()` for inspection items with proper input modal

---

## Phase 2 — Tenant & Lease Core

| # | Page | Route | Reason |
|---|------|-------|--------|
| 6 | Tenant Management | `/app/real-estate/tenants` | Core tenant operations |
| 7 | Tenant Profile | `/app/real-estate/tenants/:id/profile` | Full tenant view |
| 8 | Digital Leases | `/app/real-estate/leases` | Lease management |
| 9 | Lease Detail | `/app/real-estate/leases/:id` | Lease detail |
| 10 | Maintenance | `/app/real-estate/maintenance` | Maintenance requests |

**Key changes from legacy:**
- Add company filter to tenant/unit queries
- Add role gate to tenant archive action
- Replace 4-step swap dialog with cleaner flow
- Add invoice review step before tenant archive

---

## Phase 3 — Billing Core

| # | Page | Route | Reason |
|---|------|-------|--------|
| 11 | Invoice Overview | `/app/real-estate/invoice` | Billing analytics |
| 12 | Invoice List | `/app/real-estate/invoice/list` | Primary billing view |
| 13 | Add Invoice Item | `/app/real-estate/invoice/add-item` | Manual invoicing |
| 14 | Auto-Billing | `/app/real-estate/invoice/auto-billing` | Recurring billing |
| 15 | Auto-Billing Property Detail | `/app/real-estate/invoice/auto-billing/:id` | Per-property billing |
| 16 | Invoice Types | `/app/real-estate/invoice/types` | Invoice configuration |
| 17 | Deleted Invoices | `/app/real-estate/invoice/deleted` | Soft-delete recovery |

**Key changes from legacy:**
- Move company filter to DB query (fix DEFECT-002)
- Implement Export button (fix DEFECT-006)
- Implement bulk delete (fix DEFECT-007/008)
- Replace mock charts in InvoiceOverview with real data
- Fix Auto-Billing STK panel (fix DEFECT-016)

---

## Phase 4 — Payments & Reconciliation

| # | Page | Route | Reason |
|---|------|-------|--------|
| 18 | M-Pesa Tracker | `/app/real-estate/payments/mpesa` | Payment visibility |
| 19 | Manual Payments | `/app/real-estate/payments/manual` | Manual payment entry |
| 20 | PesaLink | `/app/real-estate/payments/pesalink` | PesaLink payments |
| 21 | Reconciliation | `/app/real-estate/reconciliation` | Payment reconciliation |
| 22 | Arrears Management | `/app/real-estate/invoice/arrears` | Arrears tracking |
| 23 | Penalties | `/app/real-estate/invoice/penalties` | Penalty management |

**Key changes from legacy:**
- Add company filter to mpesa_transactions query (fix DEFECT-003)
- Add company filter to auto-billing queries (fix DEFECT-004)

---

## Phase 5 — Split & Payout

| # | Page | Route | Reason |
|---|------|-------|--------|
| 24 | Split Management | `/app/real-estate/split-management` | Split overview |
| 25 | Payout Queue | `/app/real-estate/split-management/queue` | Queue management |
| 26 | Payout History | `/app/real-estate/split-management/history` | History |
| 27 | Split Audit | `/app/real-estate/split-management/split-audit` | Audit trail |
| 28 | Bank Join | `/app/real-estate/split-management/bank-join` | Bank integration |

---

## Phase 6 — Utilities & Water/Power

| # | Page | Route |
|---|------|-------|
| 29 | Add Water Bill | `/app/real-estate/bill-water/add-bill` |
| 30 | Water Billing Summary | `/app/real-estate/bill-water/billing-summary` |
| 31 | Meter Readings | `/app/real-estate/bill-power/meter-recordings` |
| 32 | Postpaid Meters | `/app/real-estate/bill-power/postpaid-meters` |
| 33 | Configure Houses | `/app/real-estate/bill-power/configure-houses` |

---

## Phase 7 — Reports

| # | Page | Route |
|---|------|-------|
| 34 | Statement of Rent | `/app/real-estate/reports/statement-of-rent` |
| 35 | Tenant Ledger | `/app/real-estate/reports/tenant-ledger` |
| 36 | Payment Reference | `/app/real-estate/reports/payment-reference` |
| 37 | Water Consumption | `/app/real-estate/reports/water-consumption` |
| 38 | Arrears Report | `/app/real-estate/reports/arrears` |
| 39 | Expense Report | `/app/real-estate/reports/expenses` |
| 40 | Financial Yield | `/app/real-estate/yield` |
| 41 | Hakika Ledger | `/app/real-estate/ledger` |

---

## Phase 8 — Communication

| # | Page | Route |
|---|------|-------|
| 42 | SMS/WhatsApp Hub | `/app/real-estate/communication/hub` |
| 43 | Vacating Notices | `/app/real-estate/communication/vacating-notices` |
| 44 | Maintenance Comms | `/app/real-estate/communication/maintenance` |
| 45 | Lease Documents | `/app/real-estate/communication/lease-documents` |

---

## Phase 9 — Management & Assets

| # | Page | Route |
|---|------|-------|
| 46 | Caretakers | `/app/real-estate/management/caretakers` |
| 47 | Landlords | `/app/real-estate/management/landlords` |
| 48 | Asset Inventory | `/app/real-estate/assets` |
| 49 | Asset Tracking | `/app/real-estate/assets/tracking` |
| 50 | Add Asset | `/app/real-estate/assets/add` |
| 51 | Unit Assets | `/app/real-estate/units/:id/assets` |
| 52 | Tenant Asset Assignment | `/app/real-estate/tenant-assets/:id` |
| 53 | Inspections | `/app/real-estate/inspections` |
| 54 | Notes & Findings | `/app/real-estate/notes` |
| 55 | Deleted Records | `/app/real-estate/deleted/:kind` |

---

## Phase 10 — Portals

| # | Page | Route |
|---|------|-------|
| 56 | Tenant Dashboard | `/app/tenant/dashboard` |
| 57 | Tenant Profile Portal | `/app/tenant/profile` |
| 58 | Tenant Payments | `/app/tenant/payments` |
| 59 | Landlord Dashboard | `/app/landlord/dashboard` |
| 60 | Landlord Portal Details | `/app/real-estate/management/landlords/:id/portal` |
| 61 | Tenant Portal Details | `/app/real-estate/tenants/:id/portal` |
| 62 | Caretaker Dashboard | `/app/caretaker/dashboard` |
| 63 | Public Invoice | `/invoice/:token` |

---

## Do Not Migrate (Legacy Placeholders)

| Item | Reason |
|------|--------|
| `UnitsManagement.tsx` | No route assigned; `HousesUnits` serves the route |
| `HakikaPayoutControl` (legacy) | Superseded by new split management |
| Mock charts in InvoiceOverview | Replace with real Recharts + real data |
| `window.prompt()` for inspection items | Replace with proper modal input |
| Bulk delete placeholder buttons | Implement properly or remove |

---

## Critical Defects to Fix Before Migration

1. Add server-side company filter to ALL RE queries (RLS + query filter)
2. Implement Export on Invoice List
3. Fix Auto-Billing STK panel handler
4. Replace `re_property_stats` view dependency
5. Add role gate to tenant archive
6. Replace mock chart data in InvoiceOverview
