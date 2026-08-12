import { ReHeader } from "@/modules/real-estate/components/Shell";
import { PropertyForm } from "@/modules/real-estate/components/Forms";
export default function NewProperty(){return <main className="re-main"><ReHeader eyebrow="Properties" title="Add property" description="Create a property record for the current tenant context."/><PropertyForm/></main>}
