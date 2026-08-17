import Link from "next/link";
import { getRealEstateTenantContext } from "@/modules/real-estate/services/tenant-context";
import { ReHeader } from "@/modules/real-estate/components/Shell";

export default async function LandlordPortalDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRealEstateTenantContext();
  const { data } = await ctx.supabase.schema("real_estate").from("portal_grants").select("id,portal_type,status,read_only,created_at").eq("organization_id", ctx.organizationId).eq("entity_id", id).eq("portal_type", "landlord").maybeSingle();
  return <main className="re-main"><ReHeader eyebrow="Landlord portal" title="Landlord access" description="Review the scoped portal grant without exposing credentials." actions={<Link className="re-button secondary" href="/real-estate/management/landlords">Back to landlords</Link>} /><section className="re-surface re-detail-card"><h2>Portal grant</h2>{data ? <dl><dt>Status</dt><dd><span className="re-badge">{data.status}</span></dd><dt>Access mode</dt><dd>{data.read_only ? "Read-only" : "Standard access"}</dd><dt>Created</dt><dd>{new Date(data.created_at).toLocaleString()}</dd></dl> : <div className="re-empty compact"><h3>No portal grant</h3><p>No landlord portal access has been created for this record yet. Credentials are never generated in the browser.</p></div>}</section></main>;
}
