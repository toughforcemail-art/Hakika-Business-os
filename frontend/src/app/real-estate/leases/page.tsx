import Link from "next/link";
import { getRealEstateTenantContext } from "@/modules/real-estate/services/tenant-context";
import { ReButton, ReHeader, StatCard } from "@/modules/real-estate/components/Shell";

export default async function Leases() {
  const ctx = await getRealEstateTenantContext();
  let query = ctx.supabase.schema("real_estate").from("leases").select("id,lease_number,tenant_id,unit_id,start_date,end_date,status,rent_amount_minor", { count: "exact" }).eq("organization_id", ctx.organizationId).is("archived_at", null).order("created_at", { ascending: false });
  if (ctx.companyId) query = query.eq("company_id", ctx.companyId);
  const { data, count } = await query;
  const rows = data ?? [];
  return <main className="re-main"><ReHeader eyebrow="Tenant management" title="Digital Leases" description="Review lease terms and status within your organization and company scope." actions={<ReButton href="/real-estate/leases/new">Create Lease</ReButton>} /><div className="re-stats"><StatCard label="Total leases" value={count ?? rows.length} note="Scoped records" /><StatCard label="Active" value={rows.filter((x) => x.status === "active").length} note="Current leases" /><StatCard label="Draft" value={rows.filter((x) => x.status === "draft").length} note="Needs completion" /><StatCard label="Ended" value={rows.filter((x) => ["ended", "cancelled"].includes(x.status)).length} note="Historical" /></div><section className="re-surface re-table-wrap"><table className="re-table"><thead><tr><th>Lease</th><th>Tenant</th><th>Unit</th><th>Term</th><th>Rent</th><th>Status</th><th>Action</th></tr></thead><tbody>{rows.map((x) => <tr key={x.id}><td><strong>{x.lease_number}</strong></td><td>{x.tenant_id ?? "—"}</td><td>{x.unit_id ?? "—"}</td><td>{x.start_date} – {x.end_date ?? "Open"}</td><td>KES {((x.rent_amount_minor ?? 0) / 100).toLocaleString()}</td><td><span className="re-badge">{x.status}</span></td><td><Link className="re-row-action" href={"/real-estate/leases/" + x.id}>View</Link></td></tr>)}</tbody></table>{!rows.length && <div className="re-empty"><h3>No leases yet</h3><p>Create a lease after a property, unit, and tenant are available.</p><ReButton href="/real-estate/leases/new">Create Lease</ReButton></div>}</section></main>;
}
