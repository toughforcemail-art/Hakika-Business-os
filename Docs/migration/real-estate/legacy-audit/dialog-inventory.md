# Dialog Inventory — Real Estate

Every modal, drawer, confirmation dialog, and overlay.

---

## DIALOG-PROPS-DELETE — Delete Property Confirmation
**Page:** Properties
**Trigger:** Delete hover button on property card
**Type:** Centered modal overlay

### Content
- Title: "Delete Property?"
- Body: "This will permanently remove the property and all associated history. This action cannot be undone."
- Cancel button → `setDeleteId(null)`
- "Delete Permanently" button → `handleDelete()` → `archive_record` RPC

### Behavior
- If property has linked units: shows warning toast "Delete the linked units first, then delete this property."
- On success: toast "Property archived."

---

## DIALOG-PROPS-LIGHTBOX — Property Photo Lightbox
**Page:** Property Details
**Trigger:** Click on property photo or gallery thumbnail
**Type:** Full-screen overlay

### Content
- Close (X) button
- Previous / Next navigation buttons (if multiple photos)
- Full-size image
- Photo counter (N / Total)

---

## DIALOG-UNITS-FORM — Add/Edit Unit Modal
**Page:** Units (HousesUnits)
**Trigger:** "Add New Unit" button or Edit row action
**Type:** Centered modal (max-w-2xl, max-h-80vh scrollable)

### Content
- Title: "Configure New Unit" or "Edit Residential Unit"
- Close (X) button
- Full form (see FORM-UNITS in form-field-inventory.md)
- Cancel + Save/Update buttons

### Behavior
- Opened via URL params: `?property_id=X&action=add` or `?edit=X`
- Edit navigates to `/app/real-estate/units/add` (AddUnitPage) instead of opening modal

---

## DIALOG-UNITS-DELETE — Delete Unit Confirmation
**Page:** Units
**Trigger:** Delete row/card action
**Type:** Centered modal

### Content
- AlertTriangle icon
- Title: "Permanently Delete?"
- Body: "Are you sure you want to remove unit [unit_number]? This action cannot be undone."
- Cancel + "Delete Now" buttons → hard delete `re_units`

---

## DIALOG-TENANTS-LEASE — Lease Information Modal
**Page:** Tenant Management
**Trigger:** (legacy — was triggered by row click before profile page was added; now row click goes to profile page)
**Type:** Centered modal (max-w-2xl, max-h-90vh)

### Content
- Tenant avatar + name + tenant_no
- Phone + email
- Unit details panel (unit number, property, monthly rent with inline edit)
- Lease terms panel (status, start/end dates, portal sent date, portal username, tenant_no)
- Emergency contacts list
- Footer: "Send/Resend Tenant Login" button + "Close Details" button

### Inline rent edit
- Edit pencil → shows Ksh input + Save (check) + Cancel (X)
- Saves to `re_units.rent_amount`

---

## DIALOG-TENANTS-SWAP — Swap Unit Dialog (4-step)
**Page:** Tenant Management
**Trigger:** "Swap Unit" row action
**Type:** Centered modal (max-w-xl, max-h-92vh)

### Steps
1. Location choice (Same property / Different property)
2. Unit & Date (property select if different, unit select, date, reason)
3. Arrears review (per-invoice action toggles)
4. Confirm (summary + "Confirm Swap" button)

### Step indicator
- 4 numbered circles with labels: Location, Unit & Date, Arrears, Confirm
- Progress line between steps

### Footer navigation
- Back / Cancel button
- Continue → / Confirm Swap button

---

## DIALOG-INVLIST-STK — STK Push Modal
**Page:** Invoice List
**Trigger:** "Send STK" row action
**Type:** Centered modal (max-w-xl, scrollable)

### Content
- Title: "Send payment request"
- Invoice number display
- Confirmation SMS status panel (with status badge)
- Live status panel (real-time polling)
- Tenant name display
- Property / Unit display
- Phone input (editable)
- STK Amount input (editable)
- Cancel button
- "Resend confirmation SMS" button (admin-only)
- "Send KES X" button

### Realtime behavior
- Polls `fetchData()` at 1.5s, 3.5s, 6.5s, 10s after STK send
- Polls every 2.5s while payment pending
- Updates SMS status badge live

---

## DIALOG-MPESA-EVENT — M-Pesa Event Detail Modal
**Page:** M-Pesa Tracker
**Trigger:** "Details" row button
**Type:** Centered modal (max-w-3xl, max-h-90vh)

### Content
- Type, Receipt, Invoice ID, Invoice #, Property/Unit, Tenant, Time info cards
- Tenant history sync status panel
- Match status panel
- Callback audit trail (up to 3 entries)
- Manual Link panel (admin-only): invoice dropdown + "Force Link Payment" button
- Raw JSON display (pre-formatted)

---

## DIALOG-AUTOBILL-UNIT — Auto-Billing Unit Detail Panel
**Page:** Auto-Billing
**Trigger:** "Inspect" button on preview row
**Type:** Inline panel (not a modal overlay)

### Content
- Unit number + property name
- Tenant name
- "Open Property Page" button
- "Close" button
- 4 summary tiles: Unit Status, Billing Mode, Fee, Landlord
- STK push inputs (phone, amount, name) + "Send STK" button

---

## DIALOG-CONFIRM-GENERIC — Generic window.confirm() Dialogs
**Used in:** Multiple pages

| Location | Message |
|----------|---------|
| Properties delete | "Delete Property?" (via custom modal, not window.confirm) |
| Units bulk delete | "Delete selected units?" |
| Tenants bulk delete | "This will perform a batch action or clear view. Proceed?" |
| Tenant archive | "Archive [name] and clear their remaining unit assignment and open invoices?" |
| Invoice delete | "Are you sure you want to delete invoice [number]? This action cannot be undone." |
| Invoice bulk delete | "Are you sure you want to delete all N currently displayed invoices? This action cannot be undone." |
| Auto-billing run | "Generate invoices for all occupied units for the current month?" |
| Backfill payments | "Backfill past M-Pesa payments into invoices now? ..." |
| Force link payment | "Force link receipt [X] to invoice [Y]?" |
| Resend confirmation SMS | "Resend the confirmation SMS for invoice [X]?" |
| Inspection item add | `window.prompt('Add item to [section]:')` |
