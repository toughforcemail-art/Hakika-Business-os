import { ReHeader } from "@/modules/real-estate/components/Shell";
import { PaymentForm } from "@/modules/real-estate/components/FinanceForms";
export default function NewPayment() { return <main className="re-main"><ReHeader eyebrow="Payments" title="Record Payment" description="Record a payment in the current company scope. Provider references must be unique." /><PaymentForm /></main>; }
