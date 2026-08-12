# Table Inventory — Real Estate

Every table with columns, filters, sort, pagination, row actions, and states.

---

## TABLE-PROPS-LIST — Properties Grid
**Page:** Properties (`/app/real-estate/properties`)
**Layout:** Card grid (3 columns desktop, 2 tablet, 1 mobile)

### Card fields displayed
- Property photo (h-56 image or gradient placeholder)
- Paid % circular progress overlay
- Vacant badge overlay
- Property type badge
- Units count + Planned count + Bedrooms count
- Property name (h3)
- Address (MapPin icon)
- Components/amenities tags (up to 3 + overflow count)
- Planned Mix tags (up to 3 + overflow count)

### Filters
- Search: name, address, location, county (client-side)

### Sort
- None (order by `created_at DESC` from DB)

### Row actions (hover)
- Edit (pencil)
- Update image (camera)
- Delete (trash)

### Card click
- Navigate to `/app/real-estate/properties/:id`

### Empty state
- "No Properties Found" with "Add Property" button
- Search empty: "No matches found"

### Loading state
- `PropertyCardSkeleton` × 3

---

## TABLE-PROPDET-UNITS — Property Detail Units
**Page:** Property Details (`/app/real-estate/properties/:id`) — Inventory tab
**Layout:** Card grid (3 columns desktop)

### Card fields
- Unit number (large badge)
- Type + bedrooms
- Rent amount
- Status badge (occupied/vacant)

### Filters
- Search: unit_number, type (client-side)

### Row actions
- "View Details" link → `/app/real-estate/houses?edit=:unitId`

### Empty state
- No explicit empty state (grid just empty)

---

## TABLE-PROPDET-INVOICES — Property Detail Recent Billing
**Page:** Property Details — Financials tab
**Layout:** Standard table

### Columns
| Column | Source |
|--------|--------|
| Invoice # | `re_invoices.invoice_number` |
| Status | `re_invoices.status` (badge) |
| Due | `re_invoices.amount_due` |
| Balance | `amount_due - amount_paid` |
| Date | `re_invoices.due_date` |
| Action | ChevronRight link → `/app/real-estate/invoice/list` |

### Filters
- None

### Pagination
- Limit 5 (most recent)

### Empty state
- Calendar icon + "No billing records found" + "Generate Monthly Bills" link

---

## TABLE-UNITS — Units Directory
**Page:** Units (`/app/real-estate/units`)
**Layout:** Table (default) or Card grid (toggle)

### Table columns
| Column | Source |
|--------|--------|
| Unit Detail | unit_number + floor_number |
| Property | property.name |
| Specs & Status | type label + bed/bath + status badge |
| Rent (Ksh) | rent_amount |
| Actions | Assets link, Edit button, Delete button |

### Filters
- Search: unit_number, property.name (client-side)
- Property dropdown
- Type dropdown (12 options)
- Status dropdown (vacant, occupied, under_maintenance)

### Sort
- `unit_number ASC` from DB

### Pagination
- None (all records loaded)

### Row actions
- Assets → `/app/real-estate/units/:id/assets`
- Edit → navigate to AddUnitPage
- Delete → confirm dialog → hard delete

### Empty states
- Empty workspace (no properties/units): "Create your first property"
- No results: "Add Your First Unit"

### Loading state
- `CustomLoader` while fetching

---

## TABLE-TENANTS — Tenant Directory
**Page:** Tenant Management (`/app/real-estate/tenants`)
**Layout:** Horizontal-scroll table (min-width 1700px)

### Columns
| Column | Source |
|--------|--------|
| Tenant Name | full_name + avatar + tenant_no + national_id |
| Contact Details | phone + email (hides @tenant.local) |
| Unit Allocation | unit_number + property.name + rent_amount |
| Lease Status | is_active badge + lease_end_date |
| Portal Login | login_sent_at badge + login_username |
| Actions | 7 action buttons |

### Filters
- Search: full_name, phone, email, unit_number, property.name (client-side, deferred)
- Property dropdown
- Unit dropdown (filtered by property)
- Status: All / Active / Inactive

### Sort
- None (order from DB: default)

### Pagination
- None (all active tenants loaded)

### Row actions
- Send Login / Resend Login
- Reset
- Edit
- Profile
- Portal
- Swap Unit (conditional)
- Archive

### Row click
- Navigate to `/app/real-estate/tenants/:id/profile`

### Dual scrollbar
- Top phantom scrollbar synced with table scrollbar

### Empty states
- No tenants: "No Tenants Directory" + "Onboard Tenant" button
- No filter results: "No tenants match your filter" + "Clear filters" link

### Loading state
- Skeleton rows × 5

---

## TABLE-INVLIST — Invoice List
**Page:** Invoice List (`/app/real-estate/invoice/list`)
**Layout:** Horizontal-scroll table (min-width 1700px)

### Columns
| Column | Source |
|--------|--------|
| Invoice # | invoice_number + match label badge |
| Type | invoice_type |
| Tenant / Unit | tenant.full_name + unit.property.name + unit.unit_number |
| Created | created_at (datetime) |
| Invoice Date | invoice_date |
| Due Date | due_date |
| Amount | amount_due |
| Paid So Far | amount_paid (from payments) |
| Split | service_fee_amount + landlord_payable_amount |
| Last Payment | mpesa_receipt_no + mpesa_last_callback_at |
| Receipt | (same as last payment) |
| Balance | amount_due - amount_paid |
| Status | status badge |
| Payment Link | payment_match_source badge |
| Actions | Send STK, SMS, WhatsApp, Delete |

### Filters
- Search: invoice_number, tenant.full_name, unit.unit_number (300ms debounce)
- Status: All / Paid / Unpaid / Partial / Overdue
- Type: All / Rent / Water / Electricity / Garbage / Internet / Penalty / Other

### Sort
- `invoice_date DESC` from DB

### Pagination
- None (all non-deleted invoices loaded)

### Headline totals
- Invoices count, Paid count, Partial count, Balance — all from `filteredInvoices` (filtered set)

### Row actions
- Send STK → STK modal
- SMS → send invoice via SMS
- WhatsApp → send invoice via WhatsApp
- Delete → soft delete (role-gated)

### Empty state
- FileText icon + "No invoices found matching your criteria"

### Loading state
- `CustomLoader`

### Realtime
- Subscribed to re_invoices, re_payments, mpesa_transactions changes

---

## TABLE-AUTOBILL-PREVIEW — Auto-Billing Generation Preview
**Page:** Auto-Billing (`/app/real-estate/invoice/auto-billing`)
**Layout:** Standard table

### Columns
| Column | Source |
|--------|--------|
| Tenant / Unit | tenant_name + property_name + unit_number |
| Charge Type | 'Rent & Service Charge' |
| Expected Date | calculated due_date |
| Amount | rent_amount |

### Row actions
- "Inspect" button → shows unit detail panel

### Empty state
- AlertCircle icon + "No pending invoices match your criteria"

---

## TABLE-AUTOBILL-AVAILABLE — Available Units
**Page:** Auto-Billing
**Layout:** Standard table

### Columns
- Unit, Property, Rent

### Empty state
- "No available units found for the current scope"

---

## TABLE-MPESA — M-Pesa Payment Tracker
**Page:** M-Pesa Tracker (`/app/real-estate/payments/mpesa`)
**Layout:** Standard table

### Columns
| Column | Source |
|--------|--------|
| Type | callback_type/mpesa_source badge |
| Receipt / Ref | receipt_no or checkout_request_id |
| Invoice | invoice_number + invoice_id + tenant_id + match_source |
| Property / Unit | property_name + unit_number |
| Phone / Customer | customer_name + phone_number |
| Time | completion_time (EAT timezone) |
| Paid In | paid_in (KES) |
| Withdrawn | withdrawn (KES) |
| Status | transaction_status |
| Outcome | outcome badge |
| View | "Details" button |

### Filters
- Search: receipt, phone, reference, status, customer_name
- Event type: All / STK / C2B / B2C / B2B / Reversal / Status / Balance
- Property dropdown (derived from data)
- Unit dropdown (derived from data)
- Time filter (text input, YYYY-MM or timestamp)

### Sort
- completion_time DESC, then created_at DESC (client-side)

### Pagination
- Limit 1000 from DB

### Summary tiles
- Total, STK, C2B, B2C, B2B, Reversal counts

### Empty state
- Clock3 icon + "No payment events found"

### Loading state
- `CustomLoader`

---

## TABLE-RECON-CALLBACKS — Reconciliation Raw Callbacks
**Page:** Reconciliation (`/app/real-estate/reconciliation`)
**Layout:** Card list

### Fields per card
- receipt_no / originator_conversation_id
- callback_type / mpesa_source
- transaction_status badge
- phone_number, paid_in, withdrawn, completion_time

---

## TABLE-RECON-LEDGER — Reconciliation Ledger Splits
**Page:** Reconciliation
**Layout:** Card list

### Fields per card
- category
- transaction_type + payment_method
- amount
- description / notes
- reference_id

---

## TABLE-DASH-PROPS — Dashboard Properties Table
**Page:** Dashboard
**Layout:** Standard table

### Columns
- Property, Units, Rooms, Occupancy %, Rent Roll

### Row click
- Navigate to `/app/real-estate/properties/:id`

### Pagination
- Limit 5 from DB
