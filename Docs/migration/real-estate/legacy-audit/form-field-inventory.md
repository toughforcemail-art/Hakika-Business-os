# Form Field Inventory — Real Estate

All form fields in exact order as rendered in source.

---

## FORM-PROPERTIES — Add/Edit Property
**Component:** `Properties.tsx` (inline form, slide-in panel)
**Trigger:** "Add New Property" button or card Edit hover action

### Section: General Information
| # | Field | Label | DB Column | Type | Required | Default | Placeholder | Notes |
|---|-------|-------|-----------|------|----------|---------|-------------|-------|
| 1 | name | Property Name | `re_properties.name` | text | ✅ | '' | e.g. Sunset Heights | |
| 2 | property_type | Property Type | `re_properties.property_type` | AddableSelect | ✅ | 'Residential' | Select type | Options: Residential, Commercial, Mixed Use, Industrial, Land + custom |
| 3 | lra_no | LRA Number | `re_properties.lra_no` | text | ❌ | '' | Registration No. | |
| 4 | status | Property Status | `re_properties.status` | select | ✅ | 'Active' | | Options: Active, Inactive, Under Maintenance |
| 5 | total_bedrooms | Total Bedrooms | `re_properties.total_bedrooms` | number | ❌ | 0 | e.g. 20 | |
| 6 | components | Property Components / Amenities | `re_properties.components` | textarea | ❌ | [] | e.g. Swimming Pool, Gym... (comma separated) | Stored as array |

### Section: Planned Unit Mix (repeating rows)
| # | Field | Label | DB Column | Type | Required | Default | Notes |
|---|-------|-------|-----------|------|----------|---------|-------|
| 7 | planned_unit_mix[].type | Type | `re_properties.planned_unit_mix[].type` | select | ✅ | 'single_room' | Options: single_room, studio, 1BR, 2BR, 3BR, 4BR, commercial, office, shop |
| 8 | planned_unit_mix[].count | Count | `re_properties.planned_unit_mix[].count` | number | ✅ | 0 | |
| 9 | planned_unit_mix[].bedrooms | Bedrooms | `re_properties.planned_unit_mix[].bedrooms` | number | ❌ | 0 | |
| 10 | planned_unit_mix[].bathrooms | Bathrooms | `re_properties.planned_unit_mix[].bathrooms` | number | ❌ | 0 | |
| 11 | planned_unit_mix[].default_rent | Guide Rent | `re_properties.planned_unit_mix[].default_rent` | number | ❌ | 0 | Optional |
| 12 | planned_unit_mix[].label | Label | `re_properties.planned_unit_mix[].label` | text | ❌ | '' | e.g. Courtyard Singles |
| 13 | planned_unit_mix[].notes | Notes | `re_properties.planned_unit_mix[].notes` | text | ❌ | '' | e.g. Shared balcony |

**Row actions:** "Remove" button per row
**Section actions:** "Generate Inspection Template" button, "Add Mix Row" button

### Section: Location Details
| # | Field | Label | DB Column | Type | Required | Default | Placeholder |
|---|-------|-------|-----------|------|----------|---------|-------------|
| 14 | county | County | `re_properties.county` | CountyPicker (select) | ❌ | '' | Select county |
| 15 | location | Location | `re_properties.location` | text | ❌ | '' | Area |
| 16 | sublocation | Sub-location | `re_properties.sublocation` | text | ❌ | '' | Specific area |
| 17 | village | Village / Estate | `re_properties.village` | text | ❌ | '' | Estate, block, phase |
| 18 | address | Full Address | `re_properties.address` | text | ❌ | '' | Street, Building, etc |

### Section: Financial Settings
| # | Field | Label | DB Column | Type | Required | Default | Notes |
|---|-------|-------|-----------|------|----------|---------|-------|
| 19 | deposit_paid_to | Deposit Paid To | `re_properties.deposit_paid_to` | radio | ✅ | 'landlord' | Options: Landlord, Agent |
| 20 | rent_paid_to | Rent Paid To | `re_properties.rent_paid_to` | radio | ✅ | 'landlord' | Options: Landlord, Agent |
| 21 | late_penalty_enabled | Late Penalty | `re_properties.late_penalty_enabled` | toggle | ❌ | false | |
| 22 | late_penalty_pct | Penalty % | `re_properties.late_penalty_pct` | number | conditional | 10 | Visible when late_penalty_enabled=true |
| 23 | billing_repeat_every | Billing Frequency | `re_properties.billing_repeat_every` | select | ✅ | 'monthly' | Options: Monthly, Quarterly, Yearly, Custom |
| 24 | billing_day | Billing Day | `re_properties.billing_day` | number | ✅ | 1 | 1–31 |
| 25 | billing_time | Billing Time | `re_properties.billing_time` | time | ✅ | '08:00' | |
| 26 | due_day_rule | Due Day Rule | `re_properties.due_day_rule` | select | ✅ | 'invoice_day' | Options: On invoice day, Days after invoice, Same day next month, End of invoice month |
| 27 | due_day_offset | Due Offset (days) | `re_properties.due_day_offset` | number | ❌ | 0 | |
| 28 | due_month_mode | Due Month Mode | `re_properties.due_month_mode` | select | ✅ | 'same_month' | Options: Same month, Next month |
| 29 | service_fee_mode | Service Fee Mode | `re_properties.service_fee_mode` | select | ✅ | 'percent' | Options: Percentage, Flat amount |
| 30 | service_fee_value | Service Fee Value | `re_properties.service_fee_value` | number | ✅ | 10 | |
| 31 | service_fee_name | Service Fee Name | `re_properties.service_fee_name` | text | ❌ | 'Service Fee' | |
| 32 | billing_effective_from | Billing Start | `re_properties.billing_effective_from` | date | ❌ | '' | |
| 33 | billing_effective_to | Billing End | `re_properties.billing_effective_to` | date | ❌ | '' | |

### Section: Utilities & Services
| # | Field | Label | DB Column | Type | Required | Default | Notes |
|---|-------|-------|-----------|------|----------|---------|-------|
| 34 | water_config | Water Billing | `re_properties.water_config` | select | ✅ | 'not_charged' | Options: Not Charged, Metered, Fixed Rate |
| 35 | water_fixed_amount | Water Monthly Amount | `re_properties.water_fixed_amount` | number | conditional | 0 | Visible when water_config='fixed' |
| 36 | electricity_config | Electricity | `re_properties.electricity_config` | select | ✅ | 'not_charged' | Options: Not Charged, Metered, Fixed Rate |
| 37 | electricity_fixed_amount | Electricity Monthly Amount | `re_properties.electricity_fixed_amount` | number | conditional | 0 | Visible when electricity_config='fixed' |
| 38 | garbage_config | Garbage Collection | `re_properties.garbage_config` | select | ✅ | 'not_charged' | Options: Not Charged, Fixed Rate |
| 39 | garbage_fixed_amount | Garbage Monthly Amount | `re_properties.garbage_fixed_amount` | number | conditional | 0 | Visible when garbage_config='fixed' |
| 40 | internet_config | Internet | `re_properties.internet_config` | select | ✅ | 'not_charged' | Options: Not Charged, Fixed Rate |
| 41 | internet_fixed_amount | Internet Monthly Amount | `re_properties.internet_fixed_amount` | number | conditional | 0 | Visible when internet_config='fixed' |
| 42 | service_charge_notes | Service Charge Notes | `re_properties.service_charge_notes` | textarea | ❌ | '' | Notes about garbage, security, etc. |

### Section: Communication
| # | Field | Label | DB Column | Type | Required | Default | Notes |
|---|-------|-------|-----------|------|----------|---------|-------|
| 43 | notify_email | Email (Auto Notifications) | `re_properties.notify_email` | checkbox | ❌ | true | |
| 44 | notify_sms | SMS (Auto Notifications) | `re_properties.notify_sms` | checkbox | ❌ | false | |
| 45 | invoice_channels | Invoice Delivery Channels | `re_properties.invoice_channels` | multi-toggle buttons | ❌ | 'email' | Options: email, sms, whatsapp (stored as comma-separated string) |

### Section: Property Photos
| # | Field | Label | DB Column | Type | Notes |
|---|-------|-------|-----------|------|-------|
| 46 | photos | Property Photos | `re_properties.photos` (array) + `photo_url` (first) | file (multiple, image/*) | Upload via UnifiedStorageService to `property-photos` bucket |

**Photo actions:** Remove per photo (X button), "Add More" click zone

### Section: Inspection Checklist Configuration
| # | Field | Label | DB Column | Type | Notes |
|---|-------|-------|-----------|------|-------|
| 47 | inspection_config[].section | Section Name | `re_properties.inspection_config[].section` | text (inline edit) | |
| 48 | inspection_config[].items[] | Item | `re_properties.inspection_config[].items[]` | text (via window.prompt) | |

**Section actions:** Remove section (trash), "+ Add Item" button (window.prompt), "+ Add New Section" button
**Template actions:** "+ Load Standard Template" button (loads 3 default sections), "Generate Inspection Template" button (from planned_unit_mix)

### Form footer
- "Cancel" button → closes form
- "Save Property" / "Update Property" button → `handleSubmit()`

### Validation
- `name` required (toast warning if empty)
- Numeric fields validated with `isNaN` check

### Create vs Edit differences
- Create: sets `owner_id` and `created_by` to `profile.id`
- Edit: does not set `owner_id`/`created_by`
- Both: sets `company_id` if `resolvedCompanyId` is set

---

## FORM-UNITS — Add/Edit Unit
**Component:** `HousesUnits.tsx` (modal) + `AddUnitPage.tsx` (dedicated page)
**Trigger:** "Add New Unit" button, Edit row action, URL params

### Fields (in order)
| # | Field | Label | DB Column | Type | Required | Default | Placeholder | Notes |
|---|-------|-------|-----------|------|----------|---------|-------------|-------|
| 1 | property_id | Target Property | `re_units.property_id` | select | ✅ | '' | -- Select Property -- | Loads planned_unit_mix on selection |
| 2 | unit_number | Unit Number/Name | `re_units.unit_number` | text | ✅ | '' | e.g. House 04, Apt A7 | |
| 3 | type | Unit Type | `re_units.type` | select | ✅ | '1BR' | | 12 options; single_room auto-sets bathrooms=0 |
| 4 | bedrooms | Bedrooms | `re_units.bedrooms` | number | ❌ | '1' | | |
| 5 | bathrooms | Bathrooms | `re_units.bathrooms` | number | ❌ | '1' | | Auto-set to 0 for single_room |
| 6 | rent_amount | Rent Amount (Ksh) | `re_units.rent_amount` | number | ✅ | '' | | |
| 7 | status | Occupancy Status | `re_units.status` | select | ✅ | 'vacant' | | Options: Vacant, Occupied, Under Maintenance |
| 8 | floor_number | Floor/Location | `re_units.floor_number` | text | ❌ | '' | e.g. Ground Floor, 4th Floor East Wing | |
| 9 | last_water_reading | Initial Water Meter | `re_units.last_water_reading` | number | ❌ | '0' | | |
| 10 | last_electricity_reading | Initial Electricity Meter | `re_units.last_electricity_reading` | number | ❌ | '0' | | |
| 11 | garbage_amount | Unit Garbage Charge (Monthly) | `re_units.garbage_amount` | number | ❌ | '0' | | |
| 12 | internet_amount | Unit Internet Charge (Monthly) | `re_units.internet_amount` | number | ❌ | '0' | | |
| 13 | features | Distinctive Features | `re_units.features` | text | ❌ | '' | e.g. Master ensuite, Lake view, Balcony | |
| 14 | description | Internal Description / Notes | `re_units.description` | textarea | ❌ | '' | Any specific notes... | |

**Dynamic behavior:** Selecting property shows planned_unit_mix summary panel.
**Validation:** property_id, unit_number, rent_amount required; numeric fields validated.

---

## FORM-TENANTS — Onboard/Edit Tenant
**Component:** `TenantManagement.tsx` (inline panel)
**Trigger:** "Onboard Tenant" button or row Edit action

### Fields (in order)
| # | Field | Label | DB Column | Type | Required | Default | Placeholder | Notes |
|---|-------|-------|-----------|------|----------|---------|-------------|-------|
| 1 | full_name | Full Name | `re_tenants.full_name` | text | ❌ | '' | e.g. Jane Doe | Defaults to 'Unnamed Tenant' if empty |
| 2 | phone | Phone Number | `re_tenants.phone` | text | ❌ | '' | e.g. +254712345678 | Formatted via `formatPhoneInput`, normalized via `normalizePhoneNumber` |
| 3 | email | Email Address | `re_tenants.email` | email | ❌ | '' | e.g. jane@example.com | |
| 4 | profile_image_url | Profile Image | `re_tenants.profile_image_url` | file (image/*, capture=environment) | ❌ | '' | Upload or capture profile photo | Uploads to `avatars` bucket |
| 5 | national_id | National ID / Passport | `re_tenants.national_id` | text | ❌ | '' | ID Number | |
| 6 | id_document_url | ID Document | `re_tenants.id_document_url` | file (image/*,pdf, capture=environment) | ❌ | '' | Upload or capture ID document | Uploads to `leases` bucket |
| 7 | property_id | Property | (filter only, not stored) | select | ❌ | '' | -- Select Property -- | Filters unit dropdown; resets current_unit_id on change |
| 8 | lease_type | Lease Type Override | `re_leases.lease_type` | select | ✅ | 'residential' | | Options: Residential/Tenant Lease, Commercial Lease |
| 9 | current_unit_id | Assign Unit | `re_tenants.current_unit_id` | select | ❌ | '' | -- No Unit (Waitlist) -- | Shows vacant units filtered by property; auto-fills rent_amount and lease_type |
| 10 | rent_amount | Agreed Rent Amount (Ksh) | `re_leases.rent_amount` + `re_units.rent_amount` | number | conditional | '' | e.g. 15000 | Visible only when current_unit_id is set |
| 11 | deposit_amount | Gate Key Deposit | `re_leases.deposit_amount` | number | ❌ | '' | e.g. 15000 | |
| 12 | water_deposit_amount | Water Deposit (Ksh) | `re_leases.water_deposit_amount` | number | ❌ | '' | Optional | |
| 13 | electricity_deposit_amount | Electricity Deposit (Ksh) | `re_leases.electricity_deposit_amount` | number | ❌ | '' | Optional | |
| 14 | deposit_paid_to | Deposit Paid To | `re_leases.deposit_paid_to` | select | ✅ | 'landlord' | | Options: Landlord, Agent, Both |
| 15 | lease_start_date | Lease Start Date | `re_tenants.lease_start_date` + `re_leases.start_date` | date | ❌ | '' | | |
| 16 | lease_end_date | Lease End Date | `re_tenants.lease_end_date` + `re_leases.end_date` | date | ❌ | '' | | |

### Emergency Contacts (repeating section)
| # | Field | Label | DB Column | Type | Notes |
|---|-------|-------|-----------|------|-------|
| 17 | emergency_contacts[].name | Name | `re_tenants.emergency_contacts[].name` | text | |
| 18 | emergency_contacts[].relationship | Relationship | `re_tenants.emergency_contacts[].relationship` | text | |
| 19 | emergency_contacts[].phone | Telephone | `re_tenants.emergency_contacts[].phone` | text | Formatted via formatPhoneInput |

**Emergency contact actions:** "+ Add Contact" button, "−" remove button per contact (hidden when only 1)

### Form footer
- "Cancel" button
- "Save Tenant" button → `handleSubmit()`

### Create vs Edit differences
- Create: sets `created_by`, `is_active=true`, `company_id`
- Edit: does not set `created_by`; updates linked `profiles` record if `profile_id` exists
- Both: creates/updates `re_leases` record; creates initial `re_invoices` record if unit assigned

### Dynamic behavior
- Selecting property filters unit dropdown to vacant units in that property
- Selecting unit auto-fills `rent_amount` and `lease_type` from unit record
- `login_username` intentionally NOT updated on edit (stable portal credential)

---

## FORM-STK-PUSH — STK Push (Invoice List modal)
**Component:** `InvoiceList.tsx` (modal)
**Trigger:** "Send STK" row action

| # | Field | Label | Type | Default | Notes |
|---|-------|-------|------|---------|-------|
| 1 | phone | Phone | text | tenant phone | Editable |
| 2 | stkAmountValue | STK Amount | number | invoice balance | Editable |

---

## FORM-RECONCILIATION-STK — STK Push (Reconciliation)
**Component:** `HakikaReconciliation.tsx`

| # | Field | Label | Type | Default | Notes |
|---|-------|-------|------|---------|-------|
| 1 | stkAmount | STK amount to charge | number | invoice balance | Editable |
| 2 | landlordPhone | Landlord phone number | text | '' | For B2C payout |

---

## FORM-AUTO-BILLING — Auto-Billing Settings
**Component:** `AutoBilling.tsx`

| # | Field | Label | Type | Default | Notes |
|---|-------|-------|------|---------|-------|
| 1 | billingMonth (year) | Billing Year | select | current year | Options: 2024, 2025, 2026 |
| 2 | billingMonth (month) | Billing Month | select | current month | Options: 01–12 |
| 3 | interestMode | Interest mode | select | 'percent' | Options: Percentage, Flat fee |
| 4 | interestRate | Interest amount | number | 10 | Persisted to localStorage |
| 5 | autoEmail | Auto-email tenants | checkbox | true | Persisted to localStorage |
| 6 | autoSms | Send SMS reminder | checkbox | true | Persisted to localStorage |
| 7 | manualStkName | Tenant name (STK at will) | text | '' | |
| 8 | manualStkPhone | Phone number (STK at will) | text | '' | |
| 9 | manualStkAmount | Amount (STK at will) | number | '' | |

---

## FORM-UNIT-TRANSFER — Swap Unit (4-step dialog)
**Component:** `TenantManagement.tsx`

### Step 1 — Location
- "Same property" button
- "Different property" button

### Step 2 — Unit & Date
| # | Field | Label | Type | Notes |
|---|-------|-------|------|-------|
| 1 | transferPropertyId | Destination property | select | Visible only when "Different property" chosen |
| 2 | transferUnitId | Destination unit | select | Filtered to vacant units in selected property |
| 3 | transferDate | Effective date | date | Defaults to today |
| 4 | transferReason | Reason | textarea | Optional |

### Step 3 — Arrears review
Per unpaid invoice: Migrate / Mark paid / Write off toggle buttons
Bulk: "All → Migrate" / "All → Mark Paid" buttons

### Step 4 — Confirm
Summary display only, no inputs.
