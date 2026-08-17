import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkspaceScope = { organizationId: string; companyId: string | null };
type ResourceDefinition = { schema?: string; table: string; select: string; companyScoped?: boolean };

// Explicit registry: route input can never become an arbitrary table name.
const resources: Record<string, ResourceDefinition> = {
  properties: { table: "properties", select: "id,name,property_code,status,address,created_at,updated_at" },
  units: { table: "units", select: "id,unit_number,property_id,unit_type,monthly_rent_minor,status,created_at,updated_at" },
  landlords: { table: "landlords", select: "id,full_name,email,status,created_at" },
  caretakers: { table: "caretakers", select: "id,full_name,email,status,created_at" },
  assets: { table: "unit_assets", select: "id,property_id,unit_id,asset_name,asset_category,condition,quantity,status,created_at" },
  "assets/tracking": { table: "unit_assets", select: "id,property_id,unit_id,asset_name,condition,status,updated_at" },
  "unit-assets": { table: "unit_assets", select: "id,property_id,unit_id,asset_name,asset_category,condition,quantity,status,created_at" },
  "split-management": { table: "split_allocations", select: "id,payment_allocation_id,beneficiary_type,amount_minor,status" },
  "split-management/queue": { table: "split_allocations", select: "id,payment_allocation_id,beneficiary_type,amount_minor,status" },
  "split-management/history": { table: "split_allocations", select: "id,payment_allocation_id,beneficiary_type,amount_minor,status" },
  "split-management/split-audit": { table: "split_allocations", select: "id,payment_allocation_id,beneficiary_type,amount_minor,status" },
  inspections: { table: "inspections", select: "id,property_id,unit_id,inspection_type,status,scheduled_at,completed_at,created_at" },
  maintenance: { table: "maintenance_requests", select: "id,title,property_id,unit_id,priority,status,created_at,updated_at" },
  tenants: { table: "tenants", select: "id,full_name,tenant_number,email,phone,status,created_at" },
  leases: { table: "leases", select: "id,lease_number,tenant_id,unit_id,start_date,end_date,status,created_at" },
  invoices: { table: "invoices", select: "id,lease_id,billing_month,total_minor,balance_due_minor,status,created_at" },
  "invoice/list": { table: "invoices", select: "id,lease_id,billing_month,total_minor,balance_due_minor,status,created_at" },
  payments: { table: "payments", select: "id,payment_reference,tenant_id,amount_minor,status,paid_at,created_at" },
  "payment-allocation": { table: "payment_allocations", select: "id,payment_id,invoice_id,amount_minor,created_at" },
  "billing-schedules": { table: "billing_schedules", select: "id,name,frequency,status,created_at,updated_at" },
  "recurring-billing": { table: "billing_runs", select: "id,billing_period,status,completed_at,created_at" },
  "rent-charges": { table: "invoice_items", select: "id,invoice_id,item_type,description,amount_minor,created_at" },
  utilities: { table: "utility_readings", select: "id,meter_id,reading_date,current_reading,consumption,created_at" },
  "bill-power/meter-recordings": { table: "utility_readings", select: "id,meter_id,reading_date,current_reading,consumption,created_at" },
  "bill-power/postpaid-meters": { table: "utility_meters", select: "id,unit_id,meter_number,utility_type,status,created_at" },
  penalties: { table: "invoice_penalties", select: "id,invoice_id,reason,amount_minor,status,created_at" },
  receipts: { table: "receipts", select: "id,receipt_number,payment_id,amount_minor,status,created_at" },
  notes: { table: "real_estate_notes", select: "id,property_id,unit_id,tenant_id,lease_id,body,visibility,created_at" },
  mpesa: { schema: "integrations", table: "mpesa_transactions", select: "id,provider_receipt,transaction_type,direction,amount_minor,status,occurred_at", companyScoped: false },
  "audit-activity": { schema: "audit", table: "events", select: "id,action_key,entity_type,entity_label,outcome,occurred_at,summary" },
};

export type WorkspaceQueryResult = { rows: Record<string, unknown>[]; table: string | null; error: string | null; connected: boolean };

export async function loadRealEstateWorkspace(db: SupabaseClient, scope: WorkspaceScope, resourceKey: string): Promise<WorkspaceQueryResult> {
  const resource = resources[resourceKey];
  if (!resource) return { rows: [], table: null, error: null, connected: false };
  const schema = resource.schema ?? "real_estate";
  let query = db.schema(schema).from(resource.table).select(resource.select).eq("organization_id", scope.organizationId).limit(50);
  if (scope.companyId && resource.companyScoped !== false) query = query.eq("company_id", scope.companyId);
  const result = await query;
  if (result.error) return { rows: [], table: resource.table, error: result.error.message, connected: true };
  return { rows: (result.data ?? []) as unknown as Record<string, unknown>[], table: resource.table, error: null, connected: true };
}
