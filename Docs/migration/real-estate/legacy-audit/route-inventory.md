# Route Inventory — Real Estate

All routes extracted from `frontend/src/App.tsx` AppContent block, TenantAppContent,
LandlordAppContent, and PlatformHostedApplicationShell.

Legend: ✅ Routed | 🔒 AccessGuard | 👤 Role-specific | ⚠️ Redirect | 🚫 Dead

---

## Core Real Estate Routes (`/app/real-estate/...`)

| # | Route | Component | Guard | Purpose |
|---|-------|-----------|-------|---------|
| 1 | `/app/real-estate/dashboard` | `DashboardRealEstate` | AccessGuard | Main RE dashboard |
| 2 | `/app/real-estate/ledger` | `HakikaLedger` | AccessGuard | Global RE ledger |
| 3 | `/app/real-estate/properties` | `Properties` | AccessGuard | Property list + CRUD |
| 4 | `/app/real-estate/properties/:id` | `PropertyDetails` | AccessGuard | Property detail view |
| 5 | `/app/real-estate/houses` | `HousesUnits` | AccessGuard | Units (alias) |
| 6 | `/app/real-estate/units` | `HousesUnits` | AccessGuard | Units directory |
| 7 | `/app/real-estate/units/add` | `AddUnitPage` | AccessGuard | Add/edit unit form |
| 8 | `/app/real-estate/units/:unitId/assets` | `UnitAssetInventory` | AccessGuard | Unit asset list |
| 9 | `/app/real-estate/notes` | `NotesFindings` | AccessGuard | Notes & findings |
| 10 | `/app/real-estate/tenants` | `TenantManagement` | AccessGuard | Tenant directory |
| 11 | `/app/real-estate/tenants/:tenantId/profile` | `TenantProfilePage` | AccessGuard | Tenant full profile |
| 12 | `/app/real-estate/tenants/:tenantId/portal` | `TenantPortalDetailsPage` | AccessGuard | Tenant portal details |
| 13 | `/app/real-estate/leases` | `DigitalLeases` | AccessGuard | Lease list |
| 14 | `/app/real-estate/leases/:leaseId` | `LeaseDetailPage` | AccessGuard | Lease detail |
| 15 | `/app/real-estate/maintenance` | `MaintenanceRequest` | AccessGuard | Maintenance requests |
| 16 | `/app/real-estate/invoice` | `InvoiceOverview` | AccessGuard | Billing analytics |
| 17 | `/app/real-estate/invoice/types` | `InvoiceTypesPage` | AccessGuard | Invoice type config |
| 18 | `/app/real-estate/invoice/deleted` | `DeletedInvoicesPage` | AccessGuard | Soft-deleted invoices |
| 19 | `/app/real-estate/invoice/list` | `InvoiceList` | AccessGuard | Invoice list + STK |
| 20 | `/app/real-estate/invoice/auto-billing` | `AutoBilling` | AccessGuard | Auto-billing engine |
| 21 | `/app/real-estate/invoice/auto-billing/:id` | `AutoBillingPropertyDetail` | AccessGuard | Per-property billing |
| 22 | `/app/real-estate/invoice/add-item` | `AddInvoiceItem` | AccessGuard | Manual invoice create |
| 23 | `/app/real-estate/invoice/arrears` | `ArrearsManagement` | AccessGuard | Arrears management |
| 24 | `/app/real-estate/invoice/penalties` | `PenaltiesManagement` | AccessGuard | Penalties |
| 25 | `/app/real-estate/invoice/kra` | `KRAeTims` | AccessGuard | KRA eTIMS integration |
| 26 | `/app/real-estate/split-management` | `SplitPayment` | AccessGuard | Split payment overview |
| 27 | `/app/real-estate/split-management/queue` | `HakikaPayoutQueue` | AccessGuard | Payout queue |
| 28 | `/app/real-estate/split-management/history` | `HakikaPayoutHistory` | AccessGuard | Payout history |
| 29 | `/app/real-estate/split-management/split-audit` | `HakikaSplitAudit` | AccessGuard | Split audit log |
| 30 | `/app/real-estate/split-management/legacy` | `HakikaPayoutControl` | AccessGuard | Legacy payout control |
| 31 | `/app/real-estate/split-management/bank-join` | `HakikaBankJoin` | AccessGuard | Bank join |
| 32 | `/app/real-estate/payments/mpesa` | `MpesaPaymentTracker` | AccessGuard | M-Pesa tracker |
| 33 | `/app/real-estate/payments/manual` | `ManualPayments` | AccessGuard | Manual payments |
| 34 | `/app/real-estate/payments/pesalink` | `PesalinkTransactions` | AccessGuard | PesaLink transactions |
| 35 | `/app/real-estate/reconciliation` | `HakikaReconciliation` | AccessGuard | Reconciliation |
| 36 | `/app/real-estate/bill-water/add-bill` | `AddWaterBill` | AccessGuard | Add water bill |
| 37 | `/app/real-estate/bill-water/billing-summary` | `WaterBillingSummary` | AccessGuard | Water billing summary |
| 38 | `/app/real-estate/bill-power/meter-recordings` | `MeterReadings` | AccessGuard | Electricity meter readings |
| 39 | `/app/real-estate/bill-power/postpaid-meters` | `PostpaidMeters` | AccessGuard | Postpaid meters |
| 40 | `/app/real-estate/bill-power/configure-houses` | `ConfigureHouses` | AccessGuard | Configure houses for power |
| 41 | `/app/real-estate/reports/statement-of-rent` | `StatementOfRent` | AccessGuard | Rent statement report |
| 42 | `/app/real-estate/reports/tenant-ledger` | `TenantLedgerPage` | AccessGuard | Tenant ledger report |
| 43 | `/app/real-estate/reports/payment-reference` | `PaymentReference` | AccessGuard | Payment reference report |
| 44 | `/app/real-estate/reports/water-consumption` | `WaterConsumptionReport` | AccessGuard | Water consumption report |
| 45 | `/app/real-estate/reports/arrears` | `ArrearsReport` | AccessGuard | Arrears report |
| 46 | `/app/real-estate/reports/expenses` | `ExpenseReport` | AccessGuard | Expense report |
| 47 | `/app/real-estate/yield` | `FinancialYield` | AccessGuard | Financial yield |
| 48 | `/app/real-estate/communication/vacating-notices` | `VacatingNotices` | AccessGuard | Vacating notices |
| 49 | `/app/real-estate/communication/maintenance` | `MaintenanceCommunication` | AccessGuard | Maintenance comms |
| 50 | `/app/real-estate/communication/lease-documents` | `LeaseDocumentsComm` | AccessGuard | Lease document comms |
| 51 | `/app/real-estate/communication/hub` | `SmsCommunication` | AccessGuard | SMS/WhatsApp hub |
| 52 | `/app/real-estate/communication/email` | → hub | ⚠️ Redirect | Redirects to hub |
| 53 | `/app/real-estate/communication/sms` | → hub | ⚠️ Redirect | Redirects to hub |
| 54 | `/app/real-estate/management/caretakers` | `CaretakersManagement` | AccessGuard | Caretaker management |
| 55 | `/app/real-estate/management/landlords` | `LandlordsManagement` | AccessGuard | Landlord management |
| 56 | `/app/real-estate/management/landlords/:landlordId/portal` | `LandlordPortalDetailsPage` | AccessGuard | Landlord portal |
| 57 | `/app/real-estate/deleted/:kind` | `DeletedRealEstateRecords` | AccessGuard | Deleted records (parameterized) |
| 58 | `/app/real-estate/assets` | `AssetInventory` | AccessGuard | Asset inventory |
| 59 | `/app/real-estate/assets/management` | `AssetInventory` | AccessGuard | Asset management (alias) |
| 60 | `/app/real-estate/assets/tracking` | `AssetTracking` | AccessGuard | Asset tracking |
| 61 | `/app/real-estate/assets/add` | `REAddAsset` | AccessGuard | Add asset |
| 62 | `/app/real-estate/add-asset` | → assets/add | ⚠️ Redirect | Legacy redirect |
| 63 | `/app/real-estate/tenant-assets/:propertyId` | `TenantAssetAssignmentPage` | AccessGuard | Tenant asset assignment |
| 64 | `/app/real-estate/tenant-asset-assign/:propertyId` | `AssignAssetToTenantPage` | AccessGuard | Assign asset to tenant |
| 65 | `/app/real-estate/marketing` | → dashboard | ⚠️ Redirect | Marketing placeholder |
| 66 | `/app/real-estate/inspections` | `InspectionReports` | AccessGuard | Inspection reports |
| 67 | `/app/real-estate/total-employees` | → dashboard | ⚠️ Redirect | Dead route |
| 68 | `/app/real-estate/*` (catch-all) | `DashboardRealEstate` | none | Fallback |

## Tenant Portal Routes (`/app/tenant/...`)

| # | Route | Component | Purpose |
|---|-------|-----------|---------|
| 69 | `/app/tenant/dashboard` | `TenantDashboardPage` | Tenant self-service dashboard |
| 70 | `/app/tenant/profile` | `TenantPortalProfilePage` | Tenant profile |
| 71 | `/app/tenant/payments` | `TenantPaymentsPage` | Tenant payment history |

## Landlord Portal Routes (`/app/landlord/...`)

| # | Route | Component | Purpose |
|---|-------|-----------|---------|
| 72 | `/app/landlord/dashboard` | `LandlordDashboardPage` | Landlord dashboard |

## Caretaker Route

| # | Route | Component | Purpose |
|---|-------|-----------|---------|
| 73 | `/app/caretaker/dashboard` | `CaretakerDashboardPage` | Caretaker dashboard |

## Public Routes (RE-related)

| # | Route | Component | Purpose |
|---|-------|-----------|---------|
| 74 | `/invoice/:token` | `PublicInvoicePage` | Public invoice view (no auth) |

## Dead / Placeholder Routes
- `/app/real-estate/total-employees` → redirects to dashboard (dead)
- `/app/real-estate/marketing` → redirects to dashboard (placeholder)
- `/app/real-estate/communication/email` → redirects to hub
- `/app/real-estate/communication/sms` → redirects to hub
- `/app/real-estate/add-asset` → redirects to assets/add

## Unrouted Components (imported but no route)
- `UnitsManagement` — lazy-loaded in App.tsx but no route assigned. `HousesUnits` serves `/app/real-estate/units` instead.

## AccessGuard Service Check
All `/app/real-estate/*` routes require `hasServiceAccess('hakika')`.
Roles exempt from service check: `Super Admin`, `Director`, `Director / Super Admin`, `Administrator`.
Non-exempt users without `hakika` subscription are redirected to `/app/account/billing?service=hakika`.

## Page Visibility Check
All routes wrapped in `AccessGuard` also call `canSeePage(path)` from `usePageVisibility`.
If `canSeePage` returns false, user is redirected to `/app/dashboard` (or `/app/tenant/dashboard` for Tenant role).
