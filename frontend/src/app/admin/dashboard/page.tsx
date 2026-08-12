import { AppShell } from "@/components/AppShell";
import { WorkspaceDashboard } from "@/components/WorkspaceDashboard";
import { requireCurrentApplication } from "@/lib/auth/applications";
export default async function CustomerAdmin() { await requireCurrentApplication("CUSTOMER_ADMIN"); return <AppShell app="Customer Admin" logo="/brands/finance/fallback.svg" alt="Hakika Customer Admin mark" groups={[{label:'Overview',links:['Dashboard']},{label:'Organization',links:['Companies','Members','Invitations']},{label:'Access',links:['Roles','Applications']},{label:'Billing',links:['Subscription','Invoices']},{label:'Governance',links:['Audit log','Settings']}]}><WorkspaceDashboard app="Customer Admin" eyebrow="Organization overview"/></AppShell>; }
