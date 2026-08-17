import { ReHeader } from "@/modules/real-estate/components/Shell";
import { LeaseForm } from "@/modules/real-estate/components/FinanceForms";
export default function NewLease() { return <main className="re-main"><ReHeader eyebrow="Tenant management" title="Create Lease" description="Create a draft lease. Activation remains a separate controlled workflow." /><LeaseForm /></main>; }
