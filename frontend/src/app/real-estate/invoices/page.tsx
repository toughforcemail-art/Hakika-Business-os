import Link from "next/link";
import { getRealEstateTenantContext } from "@/modules/real-estate/services/tenant-context";
import { ReButton, ReHeader, StatCard } from "@/modules/real-estate/components/Shell";

export default async function Invoices() {
  const ctx = await getRealEstateTenantContext();
  let query = ctx.supabase.schema("real_estate").from("invoices").select("id,invoice_number,tenant_id,lease_id,billing_month,total_minor,allocated_total_minor,balance_due_minor,status,due_date", { count: "exact" }).eq("organization_id", ctx.organizationId).is("archived_at", null).order("billing_month", { ascending: false });
  if (ctx.companyId) query = query.eq("company_id", ctx.companyId);
  const { data, count } = await query;
  const rows = data ?? [];
  const total = rows.reduce((sum, row) => sum + Number(row.total_minor ?? 0), 0);
  const balance = rows.reduce((sum, row) => sum + Number(row.balance_due_minor ?? 0), 0);
  return <main className="re-main"><ReHeader eyebrow="Invoice & billing" title="Invoices" description="Review invoices, balances, due dates, and payment allocation in the selected scope." actions={<ReButton href="/real-estate/invoices/new">Create Invoice</ReButton>} /><div className="re-stats"><StatCard label="Invoices" value={count ?? rows.length} note="Scoped records" /><StatCard label="Paid" value={rows.filter((x) => x.status === "paid").length} note="Settled" /><StatCard label="Outstanding" value={"KES " + (balance / 100).toLocaleString()} note="Current balance" /><StatCard label="Billed" value={"KES " + (total / 100).toLocaleString()} note="Loaded records" /></div><section className="re-surface re-table-wrap"><table className="re-table"><thead><tr><th>Invoice</th><th>Tenant</th><th>Billing month</th><th>Due date</th><th>Total</th><th>Balance</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map((x) => <tr key={x.id}><td><strong>{x.invoice_number ?? x.id}</strong></td><td>{x.tenant_id ?? "—"}</td><td>{x.billing_month}</td><td>{x.due_date ?? "—"}</td><td>KES {(Number(x.total_minor ?? 0) / 100).toLocaleString()}</td><td>KES {(Number(x.balance_due_minor ?? 0) / 100).toLocaleString()}</td><td><span className="re-badge">{x.status}</span></td><td><Link className="re-row-action" href={"/real-estate/invoices/" + x.id}>View</Link></td></tr>)}</tbody></table>{!rows.length && <div className="re-empty"><h3>No invoices yet</h3><p>Invoices will appear after a lease or billing run creates them.</p><ReButton href="/real-estate/invoices/new">Create Invoice</ReButton></div>}</section></main>;
}
