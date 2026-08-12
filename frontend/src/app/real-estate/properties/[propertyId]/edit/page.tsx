import { notFound } from "next/navigation";
import { getRealEstateTenantContext } from "@/modules/real-estate/services/tenant-context";
import { getProperty } from "@/modules/real-estate/repositories";
import { PropertyForm } from "@/modules/real-estate/components/Forms";
import { ReHeader } from "@/modules/real-estate/components/Shell";
export default async function EditProperty({params}:{params:Promise<{propertyId:string}>}){const {propertyId}=await params; const ctx=await getRealEstateTenantContext(); const {data}=await getProperty(ctx.supabase,ctx,propertyId); if(!data)notFound(); return <main className="re-main"><ReHeader eyebrow="Properties" title={`Edit ${data.name}`} description="Update operational fields without changing tenant ownership."/><PropertyForm id={propertyId} initial={data}/></main>}
