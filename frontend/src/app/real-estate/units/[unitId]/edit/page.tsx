import { notFound } from "next/navigation";
import { getRealEstateTenantContext } from "@/modules/real-estate/services/tenant-context";
import { getUnit } from "@/modules/real-estate/repositories";
import { UnitForm } from "@/modules/real-estate/components/Forms";
import { ReHeader } from "@/modules/real-estate/components/Shell";
export default async function EditUnit({params}:{params:Promise<{unitId:string}>}){const {unitId}=await params; const ctx=await getRealEstateTenantContext(); const {data}=await getUnit(ctx.supabase,ctx,unitId); if(!data)notFound(); const initial={...data,monthly_rent:(data.monthly_rent_minor??0)/100}; return <main className="re-main"><ReHeader eyebrow="Units" title={`Edit ${data.unit_number}`} description="Update unit details while preserving tenant ownership."/><UnitForm id={unitId} initial={initial}/></main>}
