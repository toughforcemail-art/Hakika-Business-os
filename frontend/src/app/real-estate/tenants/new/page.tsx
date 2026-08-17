import { ReHeader } from "@/modules/real-estate/components/Shell";
import { TenantForm } from "@/modules/real-estate/components/TenantForm";
import { listProperties, listUnits } from "@/modules/real-estate/repositories";
import { getRealEstateTenantContext } from "@/modules/real-estate/services/tenant-context";

export default async function NewTenant() {
  const ctx = await getRealEstateTenantContext();
  const [{ data: propertyData }, { data: unitData }] = await Promise.all([
    listProperties(ctx.supabase, ctx, "", { pageSize: 1000, sort: "name" }),
    listUnits(ctx.supabase, ctx, "", { pageSize: 1000 }),
  ]);
  const properties = (propertyData ?? []).map((property: any) => ({ id: property.id, name: property.name, property_code: property.property_code }));
  const units = (unitData ?? []).map((unit: any) => ({ id: unit.id, unit_number: unit.unit_number, property_id: unit.property_id, property_name: unit.property?.name, status: unit.status, monthly_rent_minor: unit.monthly_rent_minor, rent_deposit_amount: unit.rent_deposit_amount, water_bill_amount: unit.water_bill_amount, electricity_bill_amount: unit.electricity_bill_amount }));
  return <main className="re-main"><ReHeader eyebrow="Tenant management" title="Add New Tenant" description="Create a tenant and optionally assign them to a property unit." /><TenantForm properties={properties} units={units} /></main>;
}
