# Control Inventory — Real Estate

Every interactive control with stable ID, page, handler, and target.

Format: `RE-[PAGE]-[AREA]-[TYPE]-[NAME]`

---

## Dashboard (RE-DASH)

| ID | Label | Page | Type | Handler / Target |
|----|-------|------|------|-----------------|
| RE-DASH-HDR-BTN-REPORTS | Reports | Dashboard | button | navigate('/app/real-estate/reports/statement-of-rent') |
| RE-DASH-HDR-BTN-ADD-PROPERTY | Add Property | Dashboard | button | navigate('/app/real-estate/properties') |
| RE-DASH-SPLIT-BTN-OPEN | Open split page | Dashboard | button | navigate('/app/real-estate/split-management') |
| RE-DASH-SPLIT-BTN-MGMT | Split management | Dashboard | button | navigate('/app/real-estate/split-management') |
| RE-DASH-SPLIT-CARD-PREVIEW | Preview split | Dashboard | button | navigate('/app/real-estate/split-management') |
| RE-DASH-SPLIT-CARD-QUEUE | View queue | Dashboard | button | navigate('/app/real-estate/split-management/queue') |
| RE-DASH-PROPS-LINK-VIEWALL | View All | Dashboard | link | navigate('/app/real-estate/properties') |
| RE-DASH-PROPS-ROW-CLICK | Property row | Dashboard | row click | navigate('/app/real-estate/properties/:id') |
| RE-DASH-MAINT-ROW-CLICK | Maintenance task | Dashboard | row click | navigate('/app/real-estate/maintenance') |
| RE-DASH-PAY-LINK-VIEWALL | View All (payments) | Dashboard | link | navigate('/app/real-estate/payments/mpesa') |
| RE-DASH-EMPTY-BTN-CREATE | Create your first property | Dashboard (empty) | button | navigate('/app/real-estate/properties') |
| RE-DASH-EMPTY-BTN-UNITS | Add units next | Dashboard (empty) | button | navigate('/app/real-estate/units') |

---

## Properties List (RE-PROPS)

| ID | Label | Page | Type | Handler / Target |
|----|-------|------|------|-----------------|
| RE-PROPS-HDR-INPUT-SEARCH | Search Property | Properties | search input | filters `filteredProperties` |
| RE-PROPS-HDR-BTN-ADD | Add New Property | Properties | button | `openAddForm()` → shows inline form |
| RE-PROPS-CARD-LINK | Property card | Properties | link | `/app/real-estate/properties/:id` |
| RE-PROPS-CARD-BTN-EDIT | Edit (pencil) | Properties | hover button | `openEditForm(property)` |
| RE-PROPS-CARD-BTN-PHOTO | Update image (camera) | Properties | hover button | `openEditForm(property, {focusPhotos:true})` |
| RE-PROPS-CARD-BTN-DELETE | Delete (trash) | Properties | hover button | `setDeleteId(property.id)` → delete dialog |
| RE-PROPS-EMPTY-BTN-ADD | Add Property | Properties (empty) | button | `openAddForm()` |
| RE-PROPS-FORM-BTN-CLOSE | Close form (X) | Properties form | button | `setShowForm(false)` |
| RE-PROPS-FORM-BTN-GENMIX | Generate Inspection Template | Properties form | button | `F({inspection_config: createInspectionTemplateFromUnitMix(...)})` |
| RE-PROPS-FORM-BTN-ADDMIX | Add Mix Row | Properties form | button | `addPlannedUnitMix()` |
| RE-PROPS-FORM-MIX-BTN-REMOVE | Remove (mix row) | Properties form | button | `removePlannedUnitMix(id)` |
| RE-PROPS-FORM-INSP-BTN-TEMPLATE | + Load Standard Template | Properties form | button | loads 3 default inspection sections |
| RE-PROPS-FORM-INSP-BTN-ADDITEM | + Add Item | Properties form | button | `window.prompt()` → adds item to section |
| RE-PROPS-FORM-INSP-BTN-ADDSEC | + Add New Section | Properties form | button | appends new section to inspection_config |
| RE-PROPS-FORM-INSP-BTN-REMSEC | Remove section (trash) | Properties form | button | removes section from inspection_config |
| RE-PROPS-FORM-INSP-BTN-REMITEM | Remove item (X) | Properties form | button | removes item from section |
| RE-PROPS-FORM-PHOTO-ZONE | Add More (photo) | Properties form | click zone | `fileRef.current?.click()` |
| RE-PROPS-FORM-PHOTO-BTN-REMOVE | Remove photo (X) | Properties form | button | `removePhoto(idx)` |
| RE-PROPS-FORM-BTN-CANCEL | Cancel | Properties form | button | `setShowForm(false)` |
| RE-PROPS-FORM-BTN-SAVE | Save Property / Update Property | Properties form | submit | `handleSubmit()` → upsert `re_properties` |
| RE-PROPS-DEL-BTN-CANCEL | Cancel | Delete dialog | button | `setDeleteId(null)` |
| RE-PROPS-DEL-BTN-CONFIRM | Delete Permanently | Delete dialog | button | `handleDelete()` → `archive_record` RPC |

---

## Property Details (RE-PROPDET)

| ID | Label | Page | Type | Handler / Target |
|----|-------|------|------|-----------------|
| RE-PROPDET-HDR-LINK-BACK | Back arrow | Property Detail | link | `/app/real-estate/properties` |
| RE-PROPDET-HDR-PHOTO-CLICK | Property photo | Property Detail | click | `setSelectedImage(allPhotos[0])` → lightbox |
| RE-PROPDET-HDR-BTN-ADDUNIT | Add Unit | Property Detail | link-button | `/app/real-estate/houses?property_id=:id&action=add` |
| RE-PROPDET-GALLERY-BTN | Gallery thumbnail | Property Detail | button | `setSelectedImage(photo)` → lightbox |
| RE-PROPDET-TAB-INVENTORY | Inventory tab | Property Detail | tab | `setActiveTab('units')` |
| RE-PROPDET-TAB-FINANCIALS | Financials tab | Property Detail | tab | `setActiveTab('financials')` |
| RE-PROPDET-INV-INPUT-SEARCH | Search units | Property Detail | search input | filters `filteredUnits` |
| RE-PROPDET-INV-UNIT-LINK | View Details (unit card) | Property Detail | link | `/app/real-estate/houses?edit=:unitId` |
| RE-PROPDET-FIN-LINK-INVOICES | View All Invoices | Property Detail | link | `/app/real-estate/invoice/list` |
| RE-PROPDET-FIN-EMPTY-LINK | Generate Monthly Bills | Property Detail | link | `/app/real-estate/invoice/auto-billing` |
| RE-PROPDET-FIN-ROW-LINK | Invoice row chevron | Property Detail | link | `/app/real-estate/invoice/list` |
| RE-PROPDET-LIGHTBOX-BTN-CLOSE | Close lightbox (X) | Property Detail | button | `setSelectedImage(null)` |
| RE-PROPDET-LIGHTBOX-BTN-PREV | Previous image | Property Detail | button | navigate to previous photo |
| RE-PROPDET-LIGHTBOX-BTN-NEXT | Next image | Property Detail | button | navigate to next photo |

---

## Units / Houses (RE-UNITS)

| ID | Label | Page | Type | Handler / Target |
|----|-------|------|------|-----------------|
| RE-UNITS-HDR-BTN-TABLE | Table view | Units | toggle button | `setViewMode('table')` |
| RE-UNITS-HDR-BTN-GRID | Grid view | Units | toggle button | `setViewMode('grid')` |
| RE-UNITS-HDR-BTN-PRINT | Print | Units | button | `printWorkspacePage()` |
| RE-UNITS-HDR-BTN-DELETE | Delete (bulk) | Units | button | `window.confirm()` → placeholder toast |
| RE-UNITS-HDR-BTN-ADD | Add New Unit | Units | button | navigate('/app/real-estate/units/add') |
| RE-UNITS-FILTER-INPUT-SEARCH | Search | Units | search input | filters `filteredUnits` |
| RE-UNITS-FILTER-SEL-PROPERTY | All Properties | Units | select | `setPropertyFilter()` |
| RE-UNITS-FILTER-SEL-TYPE | All Types | Units | select | `setTypeFilter()` |
| RE-UNITS-FILTER-SEL-STATUS | All Statuses | Units | select | `setStatusFilter()` |
| RE-UNITS-FILTER-BTN-CLEAR | Clear Filters | Units | button | resets all filters |
| RE-UNITS-TABLE-ROW-BTN-ASSETS | Assets (package icon) | Units table | link | `/app/real-estate/units/:id/assets` |
| RE-UNITS-TABLE-ROW-BTN-EDIT | Edit | Units table | button | `handleEdit(unit)` → navigate to AddUnitPage |
| RE-UNITS-TABLE-ROW-BTN-DELETE | Delete | Units table | button | `setConfirmDelete(unit.id)` |
| RE-UNITS-GRID-ROW-BTN-ASSETS | Assets | Units grid | link | `/app/real-estate/units/:id/assets` |
| RE-UNITS-GRID-ROW-BTN-EDIT | Edit | Units grid | button | `handleEdit(unit)` |
| RE-UNITS-GRID-ROW-BTN-DELETE | Delete | Units grid | button | `setConfirmDelete(unit.id)` |
| RE-UNITS-EMPTY-BTN-CREATE | Create your first property | Units (empty workspace) | button | navigate('/app/real-estate/properties') |
| RE-UNITS-NORESULT-BTN-ADD | Add Your First Unit | Units (no results) | button | navigate('/app/real-estate/units/add') |
| RE-UNITS-FORM-BTN-CLOSE | Close modal (X) | Units form | button | `setShowForm(false)` |
| RE-UNITS-FORM-BTN-CANCEL | Cancel | Units form | button | `setShowForm(false)` |
| RE-UNITS-FORM-BTN-SAVE | Save Unit / Update Unit | Units form | submit | `handleSubmit()` → upsert `re_units` |
| RE-UNITS-DEL-BTN-CANCEL | Cancel | Delete dialog | button | `setConfirmDelete(null)` |
| RE-UNITS-DEL-BTN-CONFIRM | Delete Now | Delete dialog | button | `handleDelete()` → hard delete `re_units` |

---

## Tenant Management (RE-TENANTS)

| ID | Label | Page | Type | Handler / Target |
|----|-------|------|------|-----------------|
| RE-TENANTS-HDR-BTN-PRINT | Print | Tenants | button | `printWorkspacePage()` |
| RE-TENANTS-HDR-BTN-DELETE | Delete (bulk) | Tenants | button | `window.confirm()` → placeholder toast |
| RE-TENANTS-HDR-BTN-ONBOARD | Onboard Tenant | Tenants | button | `setShowForm(true)` |
| RE-TENANTS-NAV-BTN-DIRECTORY | Tenant directory | Tenants | button | navigate('/app/real-estate/tenants') |
| RE-TENANTS-NAV-BTN-ARCHIVED | Archived tenants | Tenants | button | navigate('/app/real-estate/deleted/tenants') |
| RE-TENANTS-NAV-BTN-BACKFILL | Backfill invoices | Tenants | button | `syncMissingInvoices()` |
| RE-TENANTS-FILTER-INPUT-SEARCH | Search | Tenants | search input | filters `filteredTenants` |
| RE-TENANTS-FILTER-SEL-PROPERTY | All Properties | Tenants | select | `setPropertyFilter()` |
| RE-TENANTS-FILTER-SEL-UNIT | All Units | Tenants | select | `setUnitFilter()` |
| RE-TENANTS-FILTER-SEL-STATUS | All Statuses | Tenants | select | `setStatusFilter()` |
| RE-TENANTS-FILTER-BTN-CLEAR | Clear | Tenants | button | resets all filters |
| RE-TENANTS-FILTER-BTN-BACKFILL2 | Backfill invoices | Tenants filter bar | button | `syncMissingInvoices()` |
| RE-TENANTS-TABLE-ROW-CLICK | Tenant row | Tenants table | row click | navigate('/app/real-estate/tenants/:id/profile') |
| RE-TENANTS-ROW-BTN-SENDLOGIN | Send Login / Resend Login | Tenants row | button | `handleSendTenantLogin(tenant, resend)` → Edge Fn `admin-create-tenant-login` |
| RE-TENANTS-ROW-BTN-RESET | Reset | Tenants row | button | `handleResetTenantLogin(tenant)` → Edge Fn `admin-create-tenant-login` with reset:true |
| RE-TENANTS-ROW-BTN-EDIT | Edit (pencil) | Tenants row | button | opens form pre-filled with tenant data + lease data |
| RE-TENANTS-ROW-BTN-PROFILE | Profile | Tenants row | button | navigate('/app/real-estate/tenants/:id/profile') |
| RE-TENANTS-ROW-BTN-PORTAL | Portal | Tenants row | button | navigate('/app/real-estate/tenants/:id/portal') |
| RE-TENANTS-ROW-BTN-SWAP | Swap Unit | Tenants row | button | `openTransferDialog(tenant)` (conditional: active + has unit) |
| RE-TENANTS-ROW-BTN-ARCHIVE | Archive | Tenants row | button | `handleDeleteTenant(tenant)` → soft delete cascade |
| RE-TENANTS-FORM-BTN-ADDCONTACT | Add Contact | Tenants form | button | `addEmergencyContact()` |
| RE-TENANTS-FORM-BTN-REMCONTACT | Remove contact (−) | Tenants form | button | `removeEmergencyContact(idx)` |
| RE-TENANTS-FORM-BTN-CANCEL | Cancel | Tenants form | button | `setShowForm(false)` |
| RE-TENANTS-FORM-BTN-SAVE | Save Tenant | Tenants form | submit | `handleSubmit()` |
| RE-TENANTS-MODAL-BTN-SENDLOGIN | Send/Resend Tenant Login | Lease modal | button | `handleSendTenantLogin()` |
| RE-TENANTS-MODAL-BTN-CLOSE | Close Details | Lease modal | button | `setSelectedTenant(null)` |
| RE-TENANTS-MODAL-RENT-BTN-EDIT | Edit rent (pencil) | Lease modal | button | `setIsEditingRent(true)` |
| RE-TENANTS-MODAL-RENT-BTN-SAVE | Save rent (check) | Lease modal | button | `handleUpdateRent()` → update `re_units.rent_amount` |
| RE-TENANTS-MODAL-RENT-BTN-CANCEL | Cancel rent edit (X) | Lease modal | button | `setIsEditingRent(false)` |
| RE-TENANTS-SWAP-BTN-SAMEPROP | Same property | Swap dialog step 1 | button | sets transferSameProperty=true, advances to step 2 |
| RE-TENANTS-SWAP-BTN-DIFFPROP | Different property | Swap dialog step 1 | button | sets transferSameProperty=false, advances to step 2 |
| RE-TENANTS-SWAP-BTN-ALLMIGATE | All → Migrate | Swap dialog step 3 | button | sets all open invoices to 'migrate' |
| RE-TENANTS-SWAP-BTN-ALLPAID | All → Mark Paid | Swap dialog step 3 | button | sets all open invoices to 'paid' |
| RE-TENANTS-SWAP-INV-BTN-MIGRATE | ↗ Migrate | Swap dialog step 3 | button | sets invoice action to 'migrate' |
| RE-TENANTS-SWAP-INV-BTN-PAID | ✓ Mark paid | Swap dialog step 3 | button | sets invoice action to 'paid' |
| RE-TENANTS-SWAP-INV-BTN-CLEAR | ✕ Write off | Swap dialog step 3 | button | sets invoice action to 'clear' |
| RE-TENANTS-SWAP-BTN-BACK | ← Back / Cancel | Swap dialog footer | button | goes back one step or closes |
| RE-TENANTS-SWAP-BTN-CONTINUE | Continue → | Swap dialog footer | button | advances to next step |
| RE-TENANTS-SWAP-BTN-CONFIRM | Confirm Swap | Swap dialog step 4 | button | `submitUnitTransfer()` → `swap_tenant_unit` RPC |

---

## Invoice List (RE-INVLIST)

| ID | Label | Page | Type | Handler / Target |
|----|-------|------|------|-----------------|
| RE-INVLIST-HDR-BTN-SYNC | Sync Payments | Invoice List | button | `handleSyncPayments()` → `syncMpesaPayments()` |
| RE-INVLIST-HDR-BTN-GENERATE | Run Monthly Billing | Invoice List | button | `handleGenerateInvoices()` → `generateMonthlyInvoices()` |
| RE-INVLIST-HDR-BTN-EXPORT | Export | Invoice List | button | ⚠️ No handler — placeholder |
| RE-INVLIST-HDR-BTN-DELETEALL | Delete All | Invoice List | button | `handleDeleteAllFiltered()` (role-gated) |
| RE-INVLIST-HDR-BTN-NEW | New Invoice | Invoice List | button | navigate('/app/real-estate/invoice/add-item') |
| RE-INVLIST-FILTER-INPUT-SEARCH | Search | Invoice List | search input | debounced filter |
| RE-INVLIST-FILTER-SEL-STATUS | Status filter | Invoice List | select | `setStatusFilter()` |
| RE-INVLIST-FILTER-SEL-TYPE | Type filter | Invoice List | select | `setTypeFilter()` |
| RE-INVLIST-ROW-BTN-STK | Send STK | Invoice List row | button | `openStkDraft(inv)` → STK modal |
| RE-INVLIST-ROW-BTN-SMS | SMS icon | Invoice List row | button | `handleSendInvoice(inv, 'sms')` |
| RE-INVLIST-ROW-BTN-WHATSAPP | WhatsApp icon | Invoice List row | button | `handleSendInvoice(inv, 'whatsapp')` |
| RE-INVLIST-ROW-BTN-DELETE | Delete (trash) | Invoice List row | button | `deleteInvoice(inv)` (role-gated) |
| RE-INVLIST-STK-BTN-CLOSE | Close STK modal (×) | STK modal | button | `setStkDraft(null)` |
| RE-INVLIST-STK-BTN-CANCEL | Cancel | STK modal | button | `setStkDraft(null)` |
| RE-INVLIST-STK-BTN-RESEND-SMS | Resend confirmation SMS | STK modal | button | `sendConfirmationSms()` (admin-only) |
| RE-INVLIST-STK-BTN-SEND | Send KES X | STK modal | button | `sendStkFromList()` → `callDaraja(stk-push)` |

---

## Auto-Billing (RE-AUTOBILL)

| ID | Label | Page | Type | Handler / Target |
|----|-------|------|------|-----------------|
| RE-AUTOBILL-HDR-BTN-RUN | Run Global Cycle | Auto-Billing | button | `handleProcess()` → insert `re_invoices` |
| RE-AUTOBILL-FILTER-BTN-ALL | All Properties | Auto-Billing | tab button | `setPropertyFilter('all')` |
| RE-AUTOBILL-FILTER-BTN-PROP | [Property name] | Auto-Billing | tab button | `setPropertyFilter(p.id)` |
| RE-AUTOBILL-HUB-CARD | Property card | Auto-Billing hub | button | navigate('/app/real-estate/invoice/auto-billing/:id') |
| RE-AUTOBILL-HUB-LINK-PROPS | Manage properties | Auto-Billing hub | link | `/app/real-estate/properties` |
| RE-AUTOBILL-PREVIEW-BTN-INSPECT | Inspect | Auto-Billing preview row | button | `setSelectedUnitId(prev.unit_id)` |
| RE-AUTOBILL-STK-BTN-SEND | Send STK Push | Auto-Billing STK panel | button | `handleSendStk()` → `callDaraja(stk-push)` |
| RE-AUTOBILL-UNIT-BTN-OPENPROP | Open Property Page | Auto-Billing unit detail | button | navigate('/app/real-estate/invoice/auto-billing/:id') |
| RE-AUTOBILL-UNIT-BTN-CLOSE | Close | Auto-Billing unit detail | button | `setSelectedUnitId(null)` |
| RE-AUTOBILL-UNIT-BTN-STK | Send STK | Auto-Billing unit detail | button | `callDaraja(stk-push)` |

---

## M-Pesa Tracker (RE-MPESA)

| ID | Label | Page | Type | Handler / Target |
|----|-------|------|------|-----------------|
| RE-MPESA-HDR-BTN-BACKFILL | Backfill Past Payments | M-Pesa Tracker | button | `backfillPastPayments()` (admin-only) |
| RE-MPESA-HDR-BTN-EXPORT | Export CSV | M-Pesa Tracker | button | `exportCsv()` |
| RE-MPESA-HDR-BTN-REFRESH | Refresh | M-Pesa Tracker | button | `fetchData()` |
| RE-MPESA-FILTER-INPUT-SEARCH | Search | M-Pesa Tracker | search input | filters `filtered` |
| RE-MPESA-FILTER-SEL-TYPE | Event type | M-Pesa Tracker | select | `setFilter()` |
| RE-MPESA-FILTER-SEL-PROPERTY | Property | M-Pesa Tracker | select | `setPropertyFilter()` |
| RE-MPESA-FILTER-SEL-UNIT | Unit | M-Pesa Tracker | select | `setUnitFilter()` |
| RE-MPESA-FILTER-INPUT-TIME | Time filter | M-Pesa Tracker | text input | `setTimeFilter()` |
| RE-MPESA-ROW-BTN-DETAILS | Details | M-Pesa Tracker row | button | `setSelectedEvent(row)` → event detail modal |
| RE-MPESA-MODAL-BTN-CLOSE | Close (X) | Event detail modal | button | `setSelectedEvent(null)` |
| RE-MPESA-MODAL-BTN-FORCELINK | Force Link Payment | Event detail modal | button | `forceLinkPayment()` (admin-only) |

---

## Reconciliation (RE-RECON)

| ID | Label | Page | Type | Handler / Target |
|----|-------|------|------|-----------------|
| RE-RECON-HDR-BTN-REFRESH | Refresh | Reconciliation | button | `fetchData()` |
| RE-RECON-HDR-BTN-LEDGER | Tenant Ledger | Reconciliation | button | navigate('/app/real-estate/reports/tenant-ledger') |
| RE-RECON-DRILL-INPUT-SEARCH | Filter invoices | Reconciliation | search input | filters invoice select |
| RE-RECON-DRILL-SEL-INVOICE | Invoice select | Reconciliation | select | `setSelectedInvoiceId()` |
| RE-RECON-DRILL-BTN-STK | Send STK Push Now | Reconciliation | button | `handleSendStk()` → `callDaraja(stk-push)` |
| RE-RECON-DRILL-BTN-DISBURSE | Disburse landlord payable | Reconciliation | button | `handleDisburseLandlord()` → `callDaraja(b2c-payment-request)` |
