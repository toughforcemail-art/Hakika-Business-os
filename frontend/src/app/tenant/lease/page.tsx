import Link from "next/link";
import { getAuthenticatedTenant } from "@/modules/real-estate/tenant-billing";

export default async function TenantLeasePage() {
  const { ctx, tenant } = await getAuthenticatedTenant();
  if (!tenant) return <main className="re-main"><section className="re-surface re-empty-state"><h1>No tenant lease</h1><p>Your portal is not linked to a tenant record.</p></section></main>;
  const { data: lease } = await ctx.supabase.schema("real_estate").from("leases").select("lease_number,start_date,end_date,rent_amount_minor,property_id,unit_id,status").eq("tenant_id", tenant.id).eq("organization_id", ctx.organizationId).eq("status", "active").is("archived_at", null).maybeSingle();
  const [{ data: property }, { data: unit }] = await Promise.all([
    ctx.supabase.schema("real_estate").from("properties").select("name,address_line1,city").eq("id", lease?.property_id ?? "00000000-0000-0000-0000-000000000000").maybeSingle(),
    ctx.supabase.schema("real_estate").from("units").select("unit_number,monthly_rent_minor").eq("id", lease?.unit_id ?? "00000000-0000-0000-0000-000000000000").maybeSingle(),
  ]);
  return <main className="re-main"><header className="re-header"><div><span className="re-eyebrow">Tenant portal</span><h1>My lease</h1><p>Review the active lease attached to your tenant profile.</p></div><Link className="re-button primary" href="/tenant/lease/download">Download lease PDF</Link></header>{lease ? <section className="re-surface"><div className="re-section-head"><div><span className="re-eyebrow">Active agreement</span><h2>{lease.lease_number}</h2></div><span className="re-badge">{lease.status}</span></div><div className="re-detail-grid"><dl><dt>Tenant</dt><dd>{tenant.full_name}</dd><dt>Property</dt><dd>{property?.name || "—"}</dd><dt>Address</dt><dd>{[property?.address_line1, property?.city].filter(Boolean).join(", ") || "—"}</dd><dt>Unit</dt><dd>{unit?.unit_number || "—"}</dd></dl><dl><dt>Start date</dt><dd>{lease.start_date}</dd><dt>End date</dt><dd>{lease.end_date || "Open-ended"}</dd><dt>Monthly rent</dt><dd>KES {(Number(lease.rent_amount_minor || unit?.monthly_rent_minor || 0) / 100).toLocaleString()}</dd><dt>Document</dt><dd><Link className="re-row-action" href="/tenant/lease/download">Download generated lease</Link></dd></dl></div></section> : <section className="re-surface re-empty-state"><h2>No active lease found</h2><p>Your property manager has not assigned an active lease yet.</p></section>}</main>;
}
