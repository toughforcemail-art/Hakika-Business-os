# Data Access Inventory — Real Estate

Every Supabase query, mutation, RPC, Edge Function, and storage operation
traced from source files.

---

## Tables Used by Real Estate

| Table | Purpose |
|-------|---------|
| `re_properties` | Property records |
| `re_units` | Unit/house records |
| `re_tenants` | Tenant records |
| `re_leases` | Lease agreements |
| `re_invoices` | Billing invoices |
| `re_payments` | Payment records |
| `re_maintenance` | Maintenance requests |
| `re_communication` | SMS/WhatsApp log |
| `re_finance_ledger` | Finance journal entries |
| `re_property_stats` | Materialized property stats view |
| `mpesa_transactions` | Raw M-Pesa callback events |
| `mpesa_stk_request_context` | STK push context snapshots |
| `mpesa_callback_audit` | Callback delivery audit |
| `companies` | Company lookup (for scope resolution) |
| `profiles` | User profiles (updated on tenant edit) |

---

## Dashboard (`DashboardRealEstate.tsx`)

| Operation | Table | Columns | Filter | Notes |
|-----------|-------|---------|--------|-------|
| SELECT count | `re_properties` | count | `company_id` (if not elevated) | |
| SELECT | `re_units` | `id, status, rent_amount` | `company_id` (if not elevated) | |
| SELECT count | `re_tenants` | count | `company_id` (if not elevated) | |
| SELECT | `re_invoices` | `amount_due, amount_paid, status` | `company_id` (if not elevated) | |
| SELECT | `re_payments` | `amount` | `company_id`, `status=confirmed` | |
| SELECT count | `re_invoices` | count | `company_id`, `status IN (unpaid,overdue,partial)` | |
| SELECT | `re_maintenance` | `*, unit:re_units(unit_number)` | `company_id` | limit 5, order created_at desc |
| SELECT | `re_properties` | `id, name, re_units(id,status,rent_amount,bedrooms)` | `company_id` | limit 5 |
| SELECT | `re_invoices` | `id, amount_due, amount_paid, due_date, status, invoice_number, created_at, unit_id` | `company_id`, `status IN (paid,partial)` | limit 5, order created_at desc |
| SELECT | `re_payments` | `id, amount, payment_date, status, reference_number, created_at, unit_id` | `company_id` | fallback if no invoices |
| SELECT | `re_invoices` | `amount_paid, created_at` | `company_id`, `status IN (paid,partial)`, `created_at >= 6 months ago` | chart data |
| SELECT | `companies` | `id, code, name` | `code = profile.company_code` | scope resolution |

**⚠️ Defect:** Elevated roles (Super Admin, Director) fetch ALL records with no company filter.

---

## Properties (`Properties.tsx`)

| Operation | Table | Columns | Filter | Notes |
|-----------|-------|---------|--------|-------|
| SELECT | `re_properties` | `*, re_units(id,status,rent_amount)` | `is_deleted=false`, `deleted_at IS NULL` | order created_at desc |
| SELECT | `re_property_stats` | `*` | `property_id IN (...)` | joined client-side |
| INSERT | `re_properties` | all form fields + `owner_id`, `created_by`, `company_id` | | |
| UPDATE | `re_properties` | all form fields | `id = editingId` | |
| RPC | `archive_record` | `p_table_name='re_properties'`, `p_record_id`, `p_reason='delete'` | | soft delete |
| STORAGE | `property-photos` bucket | upload via `UnifiedStorageService.uploadMultiple` | | |

**⚠️ Defect:** No company filter on SELECT — fetches all properties regardless of company.
(Company filter was removed per conversation history to fix missing data issue.)

---

## Property Details (`PropertyDetails.tsx`)

| Operation | Table | Columns | Filter | Notes |
|-----------|-------|---------|--------|-------|
| SELECT | `re_properties` | `*` | `id = :id` | single |
| SELECT | `re_property_stats` | `*` | `property_id = :id` | single |
| SELECT | `re_units` | `*` | `property_id = :id` | order unit_number |
| SELECT | `re_invoices` | `*` | `unit_id IN (unitIds)` | limit 5, order invoice_date desc |

---

## Units / HousesUnits (`HousesUnits.tsx`)

| Operation | Table | Columns | Filter | Notes |
|-----------|-------|---------|--------|-------|
| SELECT | `re_properties` | `id, name, planned_unit_mix` | none | order name |
| SELECT | `re_units` | `*, property:re_properties(name)` | none | order unit_number |
| INSERT | `re_units` | all form fields + `created_by`, `company_id` | | |
| UPDATE | `re_units` | all form fields | `id = editingId` | |
| DELETE | `re_units` | | `id = confirmDelete` | hard delete |

**⚠️ Defect:** No company filter on SELECT — fetches all units.

---

## Tenant Management (`TenantManagement.tsx`)

| Operation | Table | Columns | Filter | Notes |
|-----------|-------|---------|--------|-------|
| SELECT | `re_tenants` | full join with unit, property, profile | `is_active=true` | no company filter |
| SELECT | `re_units` | `id, unit_number, rent_amount, status, lease_type, property_id, property:re_properties(id,name)` | `status=vacant` | available units |
| SELECT | `re_units` | same | none | all units |
| SELECT | `re_properties` | `id, name` | none | for filter dropdown |
| INSERT | `re_tenants` | form fields + `company_id`, `created_by`, `is_active=true` | | |
| UPDATE | `re_tenants` | form fields (no created_by) | `id = editingTenantId` | |
| UPDATE | `profiles` | `full_name, email, phone` | `id = profile_id` | if profile_id exists |
| UPDATE | `re_units` | `status='occupied'`, `rent_amount` | `id = current_unit_id` | on assignment |
| UPDATE | `re_units` | `status='vacant'` | `id = originalUnitId` | on reassignment |
| UPDATE | `re_leases` | `status='inactive'` | `tenant_id, unit_id, status='active'` | on reassignment |
| SELECT | `re_leases` | `id` | `unit_id`, order created_at desc, limit 1 | check existing lease |
| INSERT/UPDATE | `re_leases` | lease fields | | upsert on assignment |
| SELECT | `re_invoices` | `id` | `tenant_id, unit_id, invoice_date, invoice_type='rent'` | check existing invoice |
| INSERT | `re_invoices` | initial invoice fields | | on assignment |
| SELECT | `re_invoices` | `id` | `tenant_id, unit_id, invoice_date` | backfill check |
| INSERT | `re_invoices` | backfill invoice | | syncMissingInvoices |
| UPDATE | `re_units` | `status='vacant'` | `id = current_unit_id` | on archive |
| UPDATE | `re_leases` | `status='inactive'` | `tenant_id, status='active'` | on archive |
| SELECT | `re_invoices` | `id` | `tenant_id, deleted_at IS NULL` | on archive |
| UPDATE | `re_invoices` | `deleted_at, notes` | `id IN (invoiceIds)` | on archive |
| UPDATE | `re_payments` | `deleted_at` | `invoice_id IN (invoiceIds)` | on archive |
| UPDATE | `re_tenants` | `current_unit_id=null, is_active=false` | `id = tenantId` | on archive |
| RPC | `archive_record` | `p_table_name='re_tenants'`, `p_record_id`, `p_reason='delete'` | | |
| RPC | `swap_tenant_unit` | `p_tenant_id, p_to_unit_id, p_effective_date, p_reason` | | unit transfer |
| UPDATE | `re_invoices` | `unit_id, notes` | `id = inv.id` | migrate arrears on transfer |
| UPDATE | `re_invoices` | `deleted_at, notes` | `id = inv.id` | write off arrears on transfer |
| UPDATE | `re_invoices` | `status='paid', amount_paid, notes` | `id = inv.id` | mark paid on transfer |
| EDGE FN | `admin-create-tenant-login` | `{tenant_id, resend}` | | send/resend portal login |
| EDGE FN | `admin-create-tenant-login` | `{tenant_id, reset:true}` | | reset portal login |
| EDGE FN | `real-estate-audit-tenant-created` | audit payload | | conditional on ENABLE_REAL_ESTATE_AUDIT flag |
| STORAGE | `leases` bucket | upload ID document | | |
| STORAGE | `avatars` bucket | upload profile photo | | |

**⚠️ Defect:** `fetchTenantData` has no company filter — fetches all active tenants.
**⚠️ Defect:** `fetchAvailableUnits` has no company filter.
**⚠️ Defect:** `fetchAllUnits` has no company filter.

---

## Invoice List (`InvoiceList.tsx`)

| Operation | Table | Columns | Filter | Notes |
|-----------|-------|---------|--------|-------|
| SELECT | `re_invoices` | `*` | `deleted_at IS NULL` | order invoice_date desc |
| SELECT | `re_tenants` | `id, full_name, phone, email, login_username` | none | joined client-side |
| SELECT | `re_units` | `id, unit_number, property_id` | none | joined client-side |
| SELECT | `re_properties` | `id, name, service_fee_mode, service_fee_value` | none | joined client-side |
| SELECT | `re_payments` | `invoice_id, amount, payment_method, reference_number, payment_date, created_at, status` | `payment_method='mpesa'`, `status='completed'` | |
| UPDATE | `re_invoices` | `deleted_at, deleted_by` | `id = invoice.id` | soft delete |
| UPDATE | `re_invoices` | `deleted_at, deleted_by` | `id IN (ids)` | bulk soft delete |
| SELECT | `re_invoices` | `public_invoice_token` | `id = invoiceId` | ensure public token |
| UPDATE | `re_invoices` | `public_invoice_token` | `id = invoiceId` | set public token |
| INSERT | `re_communication` | communication log | | on invoice send |
| SELECT | `re_invoices` | full join | `id = invoiceId` | STK push reload |
| INSERT | `mpesa_stk_request_context` | STK context snapshot | | |
| UPDATE | `re_invoices` | `mpesa_checkout_request_id, mpesa_last_stk_request_at, reconciliation_status` | `id = invoiceId` | |
| REALTIME | `re_invoices` | postgres_changes | `company_id = profile.company_id` | |
| REALTIME | `re_payments` | postgres_changes | `company_id = profile.company_id` | |
| REALTIME | `mpesa_transactions` | postgres_changes | `company_id = profile.company_id` | |
| SERVICE | `callDaraja(stk-push)` | | | M-Pesa STK push |
| SERVICE | `sendBulkSms` | | | SMS/WhatsApp send |
| SERVICE | `syncMpesaPayments()` | | | payment sync service |
| SERVICE | `generateMonthlyInvoices()` | | | billing service |

**⚠️ Defect:** Company filter applied client-side after fetch (`profile.company_id` filter in JS), not in query.

---

## Auto-Billing (`AutoBilling.tsx`)

| Operation | Table | Columns | Filter | Notes |
|-----------|-------|---------|--------|-------|
| SELECT | `re_properties` | billing config fields | none | no company filter |
| SELECT | `re_leases` | `*` | `status='active'` | no company filter |
| SELECT | `re_units` | `id, unit_number, property_id, rent_amount` | none | |
| SELECT | `re_tenants` | `id, full_name` | none | |
| SELECT | `re_invoices` | `id, tenant_id, unit_id` | `company_id`, `invoice_type='rent'`, `deleted_at IS NULL`, date range | dedup check |
| INSERT | `re_invoices` | invoice batch | | bulk insert |
| SERVICE | `callDaraja(stk-push)` | | | manual STK |

**⚠️ Defect:** No company filter on properties, leases, units, tenants queries.

---

## M-Pesa Tracker (`MpesaPaymentTracker.tsx`)

| Operation | Table | Columns | Filter | Notes |
|-----------|-------|---------|--------|-------|
| SELECT | `mpesa_transactions` | `*` | none | limit 1000, order completion_time desc |
| SELECT | `re_invoices` | full join with tenant, unit, property | none | limit 1000 |
| SELECT | `mpesa_callback_audit` | audit fields | none | limit 200, order delivered_at desc |
| UPDATE | `re_invoices` | `amount_paid, reconciliation_status, mpesa_receipt_no, mpesa_checkout_request_id, mpesa_last_callback_at` | `id = invoice.id` | backfill |
| UPDATE | `re_invoices` | same | `id = invoice.id` | force link |

**⚠️ Defect:** No company filter on mpesa_transactions or re_invoices queries.

---

## Reconciliation (`HakikaReconciliation.tsx`)

| Operation | Table | Columns | Filter | Notes |
|-----------|-------|---------|--------|-------|
| SELECT | `mpesa_transactions` | `*` | none | limit 100 |
| SELECT | `re_finance_ledger` | `*` | `company_id` | limit 100 |
| SELECT | `re_invoices` | full join with tenant | `company_id` | limit 100 |
| SELECT | `re_tenants` | `id, full_name, phone` | `company_id` | |
| INSERT | `re_finance_ledger` | landlord payout entry | | on B2C disburse |
| SERVICE | `callDaraja(stk-push)` | | | STK push |
| SERVICE | `callDaraja(b2c-payment-request)` | | | landlord payout |

---

## RPCs Used

| RPC | Parameters | Called From |
|-----|-----------|-------------|
| `archive_record` | `p_table_name, p_record_id, p_reason` | Properties delete, Tenant archive |
| `swap_tenant_unit` | `p_tenant_id, p_to_unit_id, p_effective_date, p_reason` | Tenant swap unit |

---

## Edge Functions Used

| Function | Payload | Called From |
|----------|---------|-------------|
| `admin-create-tenant-login` | `{tenant_id, resend?, reset?}` | TenantManagement send/resend/reset login |
| `real-estate-audit-tenant-created` | audit payload | TenantManagement on create (feature-flagged) |

---

## Storage Buckets Used

| Bucket | Purpose | Called From |
|--------|---------|-------------|
| `property-photos` | Property photos | Properties form |
| `leases` | Tenant ID documents | TenantManagement form |
| `avatars` | Tenant profile photos | TenantManagement form |

---

## External Services

| Service | Action | Called From |
|---------|--------|-------------|
| Daraja (M-Pesa) | `stk-push` | InvoiceList, AutoBilling, Reconciliation |
| Daraja (M-Pesa) | `b2c-payment-request` | Reconciliation (landlord payout) |
| SMS/WhatsApp | `sendBulkSms` | InvoiceList (send invoice) |
| `syncMpesaPayments` | payment sync | InvoiceList |
| `generateMonthlyInvoices` | billing | InvoiceList |
