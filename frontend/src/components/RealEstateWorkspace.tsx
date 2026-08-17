import Link from "next/link";
import { requireApplicationContext } from "@/lib/platform/context";
import { loadRealEstateWorkspace, type WorkspaceQueryResult } from "@/modules/real-estate/repositories/workspace";

export type RealEstatePageDefinition = { title: string; section: string; description: string; permission: string; emptyTitle: string; columns: string[]; routeKey?: string; resourceKey?: string };

const titleKeys: Record<string, string> = { "Global ledger": "ledger", "Houses and units": "units", "Tenant directory": "tenants", "Tenant applications": "applications", "Lease management": "leases", "Invoice overview": "invoices", "Invoice list": "invoice/list", "Deleted invoices": "invoices", "Payment directory": "payments", "Payment allocation": "payment-allocation", "Safaricom / M-Pesa account": "mpesa", "M-Pesa transactions": "mpesa", "Billing schedules": "billing-schedules", "Recurring billing": "recurring-billing", "Meter readings": "bill-power/meter-recordings", "Postpaid meters": "bill-power/postpaid-meters", "Audit activity": "audit-activity", "Notes and findings": "notes", Receipts: "receipts", Penalties: "penalties", Utilities: "utilities" };

function resourceKeyFor(definition: RealEstatePageDefinition) { return definition.resourceKey ?? definition.routeKey ?? titleKeys[definition.title] ?? definition.title.toLowerCase().replaceAll(" & ", "-").replaceAll(" ", "-"); }

function displayValue(row: Record<string, unknown>, column: string) {
  const normalized = column.toLowerCase();
  const keys = normalized.includes("property") ? ["name", "property_code", "property_id"] : normalized.includes("tenant") || normalized.includes("applicant") ? ["full_name", "applicant_name", "tenant_number", "tenant_id"] : normalized.includes("unit") || normalized.includes("house") ? ["unit_number", "unit_id"] : normalized.includes("invoice") ? ["invoice_number", "invoice_id"] : normalized.includes("payment") || normalized.includes("reference") ? ["payment_reference", "transaction_id", "payment_id"] : normalized.includes("amount") || normalized.includes("balance") || normalized.includes("allocated") ? ["amount_minor", "balance_due_minor", "total_minor"] : normalized.includes("date") || normalized.includes("time") || normalized.includes("period") ? ["billing_month", "scheduled_at", "paid_at", "created_at"] : normalized.includes("status") ? ["status", "outcome"] : normalized.includes("description") || normalized.includes("request") ? ["description", "title", "body"] : ["name", "title", "label", "id"];
  const key = keys.find((candidate) => row[candidate] !== null && row[candidate] !== undefined && row[candidate] !== "");
  if (!key) return "—";
  const value = row[key];
  if (typeof value === "number" && /amount|balance|allocated|total|rent/i.test(key)) return `KES ${(value / 100).toLocaleString()}`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function WorkspaceData({ definition, result }: { definition: RealEstatePageDefinition; result: WorkspaceQueryResult }) {
  if (result.error) return <section className="card panel data-empty"><h2>Live data is unavailable</h2><p>The connected table could not be read for this organization and company scope.</p><p className="muted">{result.error}</p></section>;
  if (!result.connected || result.rows.length === 0) return <section className="card panel data-empty"><div className="empty-mark">+</div><h2>{definition.emptyTitle}</h2><p>No records exist in the selected organization and company scope yet. This page will show live records as soon as the connected workflow creates them.</p>{!result.connected && <p className="muted">This route does not yet have a dedicated connected table or form.</p>}</section>;
  return <section className="card panel table-preview"><div className="panel-header"><h2>{definition.title}</h2><span>{result.rows.length} record{result.rows.length === 1 ? "" : "s"}</span></div><div className="table-head">{definition.columns.map((column) => <span key={column}>{column}</span>)}</div><div className="table-body">{result.rows.map((row, index) => <div className="table-row" key={String(row.id ?? index)}>{definition.columns.map((column) => <span key={column}>{displayValue(row, column)}</span>)}</div>)}</div></section>;
}

export async function RealEstateWorkspace({ definition }: { definition: RealEstatePageDefinition }) {
  const context = await requireApplicationContext("REAL_ESTATE");
  const result = await loadRealEstateWorkspace(context.supabase, context, resourceKeyFor(definition));
  return <><div className="topbar"><div><span className="context">Hakika Real Estate · {definition.section}</span><h1>{definition.title}</h1></div><div className="context">{context.companyId ? "Company scoped" : "Organization scoped"}</div></div><main className="workspace-main"><section className="card panel page-intro"><div><h2>{definition.title}</h2><p>{definition.description}</p></div><span className="status active">Live data</span></section><WorkspaceData definition={definition} result={result} />{!result.connected && <section className="card panel"><h2>Dedicated workflow needed</h2><p>This page is visible in the workspace navigation, but its underlying table and create/edit form have not been connected yet.</p><Link className="button primary" href="/support">Request workflow setup</Link></section>}</main></>;
}
