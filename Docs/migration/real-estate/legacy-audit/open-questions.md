# Open Questions — Real Estate

Items requiring clarification before migration can be marked complete.

---

## OQ-001 — Pages Not Yet Source-Audited
The following 50+ pages were identified by route but their source was not read during this audit session. Each requires a follow-up read pass:

- AddUnitPage, TenantProfilePage, TenantPortalDetailsPage
- DigitalLeases, LeaseDetailPage
- MaintenanceRequest
- InvoiceTypesPage, DeletedInvoicesPage, AddInvoiceItem
- ArrearsManagement, PenaltiesManagement, KRAeTims
- SplitPayment, HakikaPayoutQueue, HakikaPayoutHistory, HakikaSplitAudit, HakikaPayoutControl, HakikaBankJoin
- ManualPayments, PesalinkTransactions
- AddWaterBill, WaterBillingSummary, MeterReadings, PostpaidMeters, ConfigureHouses
- StatementOfRent, TenantLedgerPage, PaymentReference, WaterConsumptionReport, ArrearsReport, ExpenseReport
- FinancialYield
- VacatingNotices, MaintenanceCommunication, LeaseDocumentsComm, SmsCommunication
- CaretakersManagement, LandlordsManagement, LandlordPortalDetailsPage
- DeletedRealEstateRecords
- AssetInventory, AssetTracking, REAddAsset, UnitAssetInventory, TenantAssetAssignmentPage, AssignAssetToTenantPage
- InspectionReports, HakikaLedger, NotesFindings
- TenantDashboardPage, TenantPortalProfilePage, TenantPaymentsPage
- LandlordDashboardPage, CaretakerDashboardPage
- AutoBillingPropertyDetail, PublicInvoicePage

---

## OQ-002 — Navigation Config Not Read
`frontend/src/core/navigation/resolver.ts` was not read. The sidebar navigation items for Real Estate are defined there. Need to confirm:
- Which sidebar items exist for Real Estate module
- What roles/permissions gate each sidebar item
- Whether sidebar items match the route inventory

---

## OQ-003 — re_property_stats View Definition
Does `re_property_stats` exist as a database view or materialized view?
What columns does it expose?
If it doesn't exist in the new DB, what query should replace it?

---

## OQ-004 — "Add Product" Meaning
The audit prompt asks about "Add Product" buttons. No "Add Product" button was found in the audited pages. The closest concept is:
- "Add Mix Row" in the property form (adds a planned unit type)
- "Add Item" in the inspection config (adds a checklist item)
- `AddInvoiceItem` page (adds a manual invoice line item)

**Question:** Does "Add Product" refer to `AddInvoiceItem`? Or is there a product/service catalog not yet found?

---

## OQ-005 — Tenant Portal Behavior
`TenantDashboardPage`, `TenantPortalProfilePage`, `TenantPaymentsPage` were not read.
Questions:
- What data does the tenant portal show?
- Can tenants raise maintenance requests from the portal?
- Can tenants view/download their lease?
- Can tenants make payments from the portal?

---

## OQ-006 — Landlord Portal Behavior
`LandlordDashboardPage` was not read.
Questions:
- What financial data does the landlord see?
- Can landlords see split/payout details?
- Can landlords see tenant information?

---

## OQ-007 — Caretaker Portal Behavior
`CaretakerDashboardPage` was not read.
Questions:
- What does the caretaker see?
- Can caretakers log maintenance requests?
- Can caretakers view unit occupancy?

---

## OQ-008 — Digital Leases / Lease Detail
`DigitalLeases` and `LeaseDetailPage` were not read.
Questions:
- Can leases be downloaded as PDF?
- Is there a digital signature feature?
- What lease fields are editable after creation?
- Is there a lease renewal flow?
- Is there a lease termination flow?

---

## OQ-009 — Inspection Reports
`InspectionReports.tsx` was not read.
Questions:
- Can inspections be created from this page?
- Does it use the `inspection_config` from the property?
- Can inspection reports be exported/printed?

---

## OQ-010 — Water/Power Billing Detail
`AddWaterBill`, `WaterBillingSummary`, `MeterReadings`, `PostpaidMeters`, `ConfigureHouses` were not read.
Questions:
- How are meter readings entered?
- How is the water bill calculated (reading delta × rate)?
- What is the difference between prepaid and postpaid meters?
- Does water billing auto-generate invoices?

---

## OQ-011 — Split Management Detail
`SplitPayment`, `HakikaPayoutQueue`, `HakikaPayoutHistory`, `HakikaSplitAudit`, `HakikaPayoutControl`, `HakikaBankJoin` were not read.
Questions:
- What is the full split workflow?
- How are payouts queued and processed?
- What is the bank join feature?
- Is the legacy payout control (`HakikaPayoutControl`) still used?

---

## OQ-012 — KRA eTIMS Integration
`KRAeTims.tsx` was not read.
Questions:
- What does the KRA eTIMS page do?
- Does it submit invoices to KRA?
- Is it functional or a placeholder?

---

## OQ-013 — Communication Hub Detail
`SmsCommunication`, `VacatingNotices`, `MaintenanceCommunication`, `LeaseDocumentsComm` were not read.
Questions:
- Can bulk SMS be sent to all tenants?
- Can vacating notices be generated and sent?
- Can lease documents be sent via email/WhatsApp?

---

## OQ-014 — Asset Management Scope
`AssetInventory`, `AssetTracking`, `REAddAsset`, `UnitAssetInventory`, `TenantAssetAssignmentPage`, `AssignAssetToTenantPage` were not read.
Questions:
- What types of assets are tracked (furniture, appliances, keys)?
- Can assets be assigned to units AND tenants separately?
- Is there depreciation tracking?

---

## OQ-015 — Hakika Ledger vs Finance Ledger
`HakikaLedger.tsx` was not read.
Questions:
- Is this the same as `re_finance_ledger`?
- Does it show income + expense splits?
- Is it different from the Finance module's GlobalLedger?

---

## OQ-016 — Public Invoice Page
`PublicInvoicePage.tsx` was not read.
Questions:
- What does the public invoice show?
- Can tenants pay from the public invoice page?
- Is there an M-Pesa payment button on the public page?
- Does it require authentication?

---

## OQ-017 — Deleted Records Page
`DeletedRealEstateRecords.tsx` was not read.
The route is `/app/real-estate/deleted/:kind` — parameterized.
Questions:
- What values does `:kind` accept? (tenants, properties, units, invoices?)
- Can records be restored from this page?

---

## OQ-018 — Notes & Findings
`NotesFindings.tsx` was not read.
Questions:
- Are notes per-property, per-unit, or global?
- Can notes be categorized?
- Are findings linked to inspections?
