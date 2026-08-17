import Link from "next/link";
import { getRealEstateTenantContext } from "@/modules/real-estate/services/tenant-context";
import { ReHeader, StatCard } from "@/modules/real-estate/components/Shell";

export default async function CaretakerDashboard() {
  const ctx = await getRealEstateTenantContext();
  let query = ctx.supabase.schema("real_estate").from("maintenance_requests").select("id,title,status,priority,created_at", { count: "exact" }).eq("organization_id", ctx.organizationId).order("created_at", { ascending: false });
  if (ctx.companyId) query = query.eq("company_id", ctx.companyId);
  const { data, count } = await query;
  const rows = data ?? [];
  return <main className="re-main"><ReHeader eyebrow="Caretaker portal" title="Assigned work" description="Review maintenance and inspection work in the authorized property scope." actions={<Link className="re-button secondary" href="/real-estate/maintenance">Open maintenance</Link>} /><div className="re-stats"><StatCard label="Work requests" value={count ?? rows.length} note="Scoped requests" /><StatCard label="New" value={rows.filter((x) => x.status === "new").length} note="Needs attention" /><StatCard label="High priority" value={rows.filter((x) => x.priority === "high").length} note="Review first" /><StatCard label="Completed" value={rows.filter((x) => x.status === "completed").length} note="Closed work" /></div><section className="re-surface re-dashboard-panel"><div className="re-section-head"><h2>Recent work</h2><Link href="/real-estate/maintenance">View all</Link></div><div className="re-list">{rows.slice(0, 10).map((x) => <div className="re-list-row" key={x.id}><span><strong>{x.title}</strong><small>{new Date(x.created_at).toLocaleDateString()}</small></span><b>{x.status}</b></div>)}</div>{!rows.length && <div className="re-empty"><h3>No assigned work</h3><p>Maintenance requests will appear here when created for this scope.</p></div>}</section></main>;
}
