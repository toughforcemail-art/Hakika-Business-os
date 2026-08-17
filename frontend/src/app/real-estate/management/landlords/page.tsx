import { getRealEstateTenantContext } from "@/modules/real-estate/services/tenant-context";
import { ReHeader, StatCard } from "@/modules/real-estate/components/Shell";

export default async function LandlordsManagement() {
  const ctx = await getRealEstateTenantContext();
  let query = ctx.supabase.schema("real_estate").from("landlords").select("id,full_name,email,status,created_at", { count: "exact" }).eq("organization_id", ctx.organizationId).order("created_at", { ascending: false });
  if (ctx.companyId) query = query.eq("company_id", ctx.companyId);
  const { data, count } = await query;
  const rows = data ?? [];
  return <main className="re-main"><ReHeader eyebrow="Management" title="Landlords" description="Review landlord records and their property relationships in the selected scope." /><div className="re-stats"><StatCard label="Landlords" value={count ?? rows.length} note="Scoped records" /><StatCard label="Active" value={rows.filter((x) => x.status === "active").length} note="Current records" /><StatCard label="Inactive" value={rows.filter((x) => x.status !== "active").length} note="Review needed" /><StatCard label="Portal" value="—" note="Portal access status" /></div><section className="re-surface re-table-wrap"><table className="re-table"><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Created</th></tr></thead><tbody>{rows.map((x) => <tr key={x.id}><td><strong>{x.full_name}</strong></td><td>{x.email ?? "—"}</td><td><span className="re-badge">{x.status}</span></td><td>{new Date(x.created_at).toLocaleDateString()}</td></tr>)}</tbody></table>{!rows.length && <div className="re-empty"><h3>No landlords yet</h3><p>Landlord records will appear here when created in the connected workflow.</p></div>}</section></main>;
}
