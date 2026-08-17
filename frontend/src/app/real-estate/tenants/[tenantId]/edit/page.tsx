import { notFound } from "next/navigation";
import { ReHeader } from "@/modules/real-estate/components/Shell";
import { TenantForm } from "@/modules/real-estate/components/TenantForm";
import { getScopedTenant } from "@/modules/real-estate/tenant-billing";
import { listProperties, listUnits } from "@/modules/real-estate/repositories";
import { getRealEstateTenantContext } from "@/modules/real-estate/services/tenant-context";

export default async function EditTenant({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const { data } = await getScopedTenant(tenantId);
  if (!data) notFound();
  const ctx = await getRealEstateTenantContext();
  const [{ data: propertyData }, { data: unitData }, { data: lease }] = await Promise.all([
    listProperties(ctx.supabase, ctx, "", { pageSize: 1000, sort: "name" }),
    listUnits(ctx.supabase, ctx, "", { pageSize: 1000 }),
    ctx.supabase.schema("real_estate").from("leases").select("property_id,unit_id,lease_number,start_date,end_date,rent_amount_minor,deposit_amount_minor,water_deposit_amount_minor,electricity_deposit_amount_minor").eq("tenant_id", tenantId).eq("organization_id", ctx.organizationId).eq("status", "active").is("archived_at", null).maybeSingle(),
  ]);
  const properties = (propertyData ?? []).map((property: any) => ({ id: property.id, name: property.name, property_code: property.property_code }));
  const units = (unitData ?? []).map((unit: any) => ({ id: unit.id, unit_number: unit.unit_number, property_id: unit.property_id, property_name: unit.property?.name, status: unit.status, monthly_rent_minor: unit.monthly_rent_minor, rent_deposit_amount: unit.rent_deposit_amount, water_bill_amount: unit.water_bill_amount, electricity_bill_amount: unit.electricity_bill_amount }));
  const initial = lease ? { ...data, property_id: lease.property_id, unit_id: lease.unit_id, lease_number: lease.lease_number, start_date: lease.start_date, end_date: lease.end_date, rent_amount: lease.rent_amount_minor ? lease.rent_amount_minor / 100 : "", deposit_amount: lease.deposit_amount_minor ? lease.deposit_amount_minor / 100 : "", water_deposit_amount: lease.water_deposit_amount_minor ? lease.water_deposit_amount_minor / 100 : "", electricity_deposit_amount: lease.electricity_deposit_amount_minor ? lease.electricity_deposit_amount_minor / 100 : "" } : data;
  return <main className="re-main"><ReHeader eyebrow="Tenant management" title={`Edit ${data.full_name}`} description="Update the tenant record and property assignment while preserving its history." /><TenantForm id={tenantId} initial={initial} properties={properties} units={units} /></main>;
}
