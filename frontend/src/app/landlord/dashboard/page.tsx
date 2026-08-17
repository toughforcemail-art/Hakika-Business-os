import Link from "next/link";
import { getRealEstateTenantContext } from "@/modules/real-estate/services/tenant-context";
import { ReHeader, StatCard } from "@/modules/real-estate/components/Shell";

export default async function LandlordDashboard() {
  const ctx = await getRealEstateTenantContext();
  let query = ctx.supabase.schema("real_estate").from("properties").select("id,name,status", { count: "exact" }).eq("organization_id", ctx.organizationId).is("archived_at", null);
  if (ctx.companyId) query = query.eq("company_id", ctx.companyId);
  const { data, count } = await query;
  const rows = data ?? [];
  return <main className="re-main"><ReHeader eyebrow="Landlord portal" title="Portfolio overview" description="Review the property portfolio currently available in your authorized Real Estate scope." actions={<Link className="re-button secondary" href="/real-estate/management/landlords">Landlord management</Link>} /><div className="re-stats"><StatCard label="Properties" value={count ?? rows.length} note="Scoped portfolio" /><StatCard label="Active" value={rows.filter((x) => x.status === "active").length} note="Current properties" /><StatCard label="Rent roll" value="—" note="From issued invoices" /><StatCard label="Statements" value="—" note="Available after payments" /></div><section className="re-surface re-dashboard-panel"><div className="re-section-head"><h2>Properties</h2><Link href="/real-estate/properties">Open directory</Link></div><div className="re-list">{rows.map((x) => <Link className="re-list-row" href={"/real-estate/properties/" + x.id} key={x.id}><span><strong>{x.name}</strong><small>Property portfolio record</small></span><b>{x.status}</b></Link>)}</div>{!rows.length && <div className="re-empty"><h3>No properties available</h3><p>Portfolio records will appear here when they are assigned to this scope.</p></div>}</section></main>;
}
