import { notFound } from "next/navigation";
import { ReHeader } from "@/modules/real-estate/components/Shell";
import { TenantDetailTabs } from "@/modules/real-estate/components/TenantDetailTabs";
import { getScopedTenant } from "@/modules/real-estate/tenant-billing";
import { getRealEstateTenantContext } from "@/modules/real-estate/services/tenant-context";

export default async function TenantDetails({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const { data: tenant } = await getScopedTenant(tenantId);
  if (!tenant) notFound();
  const ctx = await getRealEstateTenantContext();
  const [leaseResult, invoicesResult, paymentsResult, propertiesResult, unitsResult] = await Promise.all([
    ctx.supabase.schema("real_estate").from("leases").select("lease_number,start_date,end_date,rent_amount_minor,status,property_id,unit_id").eq("tenant_id", tenantId).eq("organization_id", ctx.organizationId).eq("status", "active").is("archived_at", null).maybeSingle(),
    ctx.supabase.schema("real_estate").from("invoices").select("id,invoice_number,billing_month,total_minor,balance_due_minor,status").eq("tenant_id", tenantId).eq("organization_id", ctx.organizationId).is("archived_at", null).order("billing_month", { ascending: false }).limit(50),
    ctx.supabase.schema("real_estate").from("payments").select("id,payment_reference,amount_minor,paid_at,payment_method,status").eq("tenant_id", tenantId).eq("organization_id", ctx.organizationId).is("archived_at", null).order("paid_at", { ascending: false }).limit(50),
    ctx.supabase.schema("real_estate").from("properties").select("id,name").eq("organization_id", ctx.organizationId).is("archived_at", null),
    ctx.supabase.schema("real_estate").from("units").select("id,property_id,unit_number,status,monthly_rent_minor").eq("organization_id", ctx.organizationId).is("archived_at", null),
  ]);
  const leaseData: any = leaseResult.data;
  const property = (propertiesResult.data ?? []).find((row: any) => row.id === leaseData?.property_id);
  const unit = (unitsResult.data ?? []).find((row: any) => row.id === leaseData?.unit_id);
  const lease = leaseData ? { ...leaseData, property_name: property?.name, unit_number: unit?.unit_number } : null;
  return <main className="re-main"><ReHeader eyebrow="Tenant profile" title={tenant.full_name} description="View tenant identity, property assignment, messages, ledger and wallet activity." /><TenantDetailTabs tenant={tenant} lease={lease} invoices={invoicesResult.data ?? []} payments={paymentsResult.data ?? []} properties={propertiesResult.data ?? []} units={unitsResult.data ?? []} /></main>;
}
