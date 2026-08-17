import { ReHeader } from "@/modules/real-estate/components/Shell";
import { AllocationForm } from "@/modules/real-estate/components/FinanceForms";
export default function Allocation() { return <main className="re-main"><ReHeader eyebrow="Payments" title="Payment Allocation" description="Allocate a received payment to an eligible invoice. Database constraints prevent over-allocation." /><AllocationForm /></main>; }
