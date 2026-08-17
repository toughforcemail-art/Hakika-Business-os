import { ReHeader } from "@/modules/real-estate/components/Shell";
import { InvoiceForm } from "@/modules/real-estate/components/FinanceForms";
export default function NewInvoice() { return <main className="re-main"><ReHeader eyebrow="Invoice & billing" title="Create Invoice" description="Save a draft invoice; totals are calculated server-side." /><InvoiceForm /></main>; }
