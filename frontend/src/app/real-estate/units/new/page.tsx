import { ReHeader } from "@/modules/real-estate/components/Shell";
import { UnitForm } from "@/modules/real-estate/components/Forms";
export default async function NewUnit({searchParams}:{searchParams:Promise<{propertyId?:string}>}){const {propertyId}=await searchParams; return <main className="re-main"><ReHeader eyebrow="Units" title="Add unit" description="Create an actual unit record. Planned counts remain planning data only."/><UnitForm propertyId={propertyId}/></main>}
