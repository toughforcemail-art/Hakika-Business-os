import { notFound } from "next/navigation";
import { getRealEstateTenantContext } from "@/modules/real-estate/services/tenant-context";
import { getUnit } from "@/modules/real-estate/repositories";
import { listProperties } from "@/modules/real-estate/repositories";
import { UnitForm } from "@/modules/real-estate/components/Forms";
import { ReHeader } from "@/modules/real-estate/components/Shell";
export default async function EditUnit({params}:{params:Promise<{unitId:string}>}){const {unitId}=await params; const ctx=await getRealEstateTenantContext(); const [{data},propertiesResult]=await Promise.all([getUnit(ctx.supabase,ctx,unitId),listProperties(ctx.supabase,ctx,"",{pageSize:1000,sort:"name"})]); if(!data)notFound(); const initial={...data,monthly_rent:(data.monthly_rent_minor??0)/100}; const properties=(propertiesResult.data??[]).map((property:any)=>({id:property.id,name:property.name,property_code:property.property_code})); return <main className="re-main"><ReHeader eyebrow="Units" title={`Edit ${data.unit_number}`} description="Update unit details while preserving tenant ownership."/><UnitForm id={unitId} initial={initial} propertyId={data.property_id} properties={properties}/></main>}
