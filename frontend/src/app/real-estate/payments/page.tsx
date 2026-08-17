import Link from "next/link";
import { getRealEstateTenantContext } from "@/modules/real-estate/services/tenant-context";
import { ReButton, ReHeader, StatCard } from "@/modules/real-estate/components/Shell";

export default async function Payments() {
  const ctx = await getRealEstateTenantContext();
  let query = ctx.supabase.schema("real_estate").from("payments").select("id,payment_reference,tenant_id,amount_minor,status,paid_at,payment_method", { count: "exact" }).eq("organization_id", ctx.organizationId).is("archived_at", null).order("paid_at", { ascending: false });
  if (ctx.companyId) query = query.eq("company_id", ctx.companyId);
  const { data, count } = await query;
  const rows = data ?? [];
  return <main className="re-main"><ReHeader eyebrow="Payments" title="Payment Directory" description="Review confirmed payments and their allocation status in the selected company scope." actions={<ReButton href="/real-estate/payments/new">Record Payment</ReButton>} /><div className="re-stats"><StatCard label="Payments" value={count ?? rows.length} note="Scoped records" /><StatCard label="Received" value={rows.filter((x) => x.status === "received").length} note="Awaiting allocation" /><StatCard label="Allocated" value={rows.filter((x) => x.status === "allocated").length} note="Applied to invoices" /><StatCard label="Total" value={"KES " + (rows.reduce((n, x) => n + Number(x.amount_minor ?? 0), 0) / 100).toLocaleString()} note="Loaded records" /></div><section className="re-surface re-table-wrap"><table className="re-table"><thead><tr><th>Reference</th><th>Tenant</th><th>Method</th><th>Paid</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map((x) => <tr key={x.id}><td><strong>{x.payment_reference}</strong></td><td>{x.tenant_id ?? "—"}</td><td>{x.payment_method}</td><td>{new Date(x.paid_at).toLocaleDateString()}</td><td>KES {(Number(x.amount_minor ?? 0) / 100).toLocaleString()}</td><td><span className="re-badge">{x.status}</span></td><td><Link className="re-row-action" href={"/real-estate/payments/allocation?payment=" + x.id}>Allocate</Link></td></tr>)}</tbody></table>{!rows.length && <div className="re-empty"><h3>No payments yet</h3><p>Recorded payments will appear here after the payment workflow is connected.</p><ReButton href="/real-estate/payments/new">Record Payment</ReButton></div>}</section></main>;
}
