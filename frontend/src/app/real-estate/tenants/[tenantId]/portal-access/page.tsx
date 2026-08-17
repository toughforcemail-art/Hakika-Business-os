import Link from "next/link";
import { ReHeader } from "@/modules/real-estate/components/Shell";
import { getScopedTenant } from "@/modules/real-estate/tenant-billing";
import { getRealEstateTenantContext } from "@/modules/real-estate/services/tenant-context";

export default async function PortalAccess({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const { data: tenant } = await getScopedTenant(tenantId);
  const ctx = await getRealEstateTenantContext();
  const { data: lease } = await ctx.supabase.schema("real_estate").from("leases")
    .select("lease_number,start_date,end_date,property_id,unit_id,status")
    .eq("tenant_id", tenantId).eq("organization_id", ctx.organizationId).eq("status", "active").is("archived_at", null).maybeSingle();
  const [{ data: property }, { data: unit }] = await Promise.all([
    lease?.property_id ? ctx.supabase.schema("real_estate").from("properties").select("name").eq("id", lease.property_id).maybeSingle() : Promise.resolve({ data: null }),
    lease?.unit_id ? ctx.supabase.schema("real_estate").from("units").select("unit_number").eq("id", lease.unit_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const previewUrl = `/real-estate/tenants/${tenantId}/portal-preview`;
  const displayName = tenant?.full_name || "Tenant";
  const initials = displayName.split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase();

  return <main className="re-main">
    <ReHeader eyebrow="Tenant portal" title="Manage Portal Access" description="Give this tenant a simple, secure way to view their home, lease and requests." actions={<Link className="re-button secondary" href={`/real-estate/tenants/${tenantId}`}>Back to tenant</Link>} />
    <section className="re-portal-profile re-surface">
      <div className="re-portal-avatar" aria-hidden="true">{initials}</div>
      <div className="re-portal-profile-copy"><span className="re-eyebrow">Tenant account</span><h2>{displayName}</h2><p>{tenant?.email || tenant?.phone || "Contact details not provided"}</p></div>
      <div className="re-portal-assignment"><span>Current home</span><strong>{property?.name || "No property assigned"}</strong><small>{unit?.unit_number ? `Unit ${unit.unit_number}` : "No unit assigned"}</small></div>
      <span className={`re-portal-status ${lease ? "ready" : "attention"}`}><span aria-hidden="true" />{lease ? "Portal ready" : "Assignment needed"}</span>
    </section>
    <section className="re-portal-launch re-surface">
      <div className="re-portal-launch-copy"><span className="re-eyebrow">Manager tools</span><h2>Open the tenant experience</h2><p>Preview the records this tenant will see without leaving this workspace. Both options open in a separate browser tab.</p></div>
      <div className="re-portal-launch-actions">
        <a className="re-button primary" href={previewUrl} target="_blank" rel="noopener noreferrer">Preview tenant portal</a>
        <a className="re-button secondary" href="/tenant/dashboard" target="_blank" rel="noopener noreferrer">Open signed-in portal</a>
      </div>
    </section>
    <div className="re-portal-overview-grid">
      <section className="re-portal-services re-surface"><div className="re-section-head"><div><span className="re-eyebrow">Tenant self-service</span><h2>What the portal includes</h2></div><span className="re-badge">Read-only preview</span></div><div className="re-portal-service-list"><div><strong>Lease and documents</strong><span>View lease terms, dates and shared files.</span></div><div><strong>Invoices and payments</strong><span>Review charges, balances and payment history.</span></div><div><strong>Maintenance requests</strong><span>Report an issue and follow its progress.</span></div><div><strong>Messages</strong><span>Keep property conversations in one place.</span></div></div></section>
      <aside className="re-portal-access-state re-surface"><span className="re-eyebrow">Access and security</span><h2>Access is controlled by sign-in</h2><p>Managers can preview this tenant&apos;s data. A tenant&apos;s live portal uses the normal account and verification flow.</p><dl><div><dt>Preview</dt><dd>Available</dd></div><div><dt>Live portal</dt><dd>Separate tab</dd></div><div><dt>Lease</dt><dd>{lease ? "Active" : "Not assigned"}</dd></div></dl></aside>
    </div>
  </main>;
}
