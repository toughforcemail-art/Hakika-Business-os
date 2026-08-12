import { AppShell } from "@/components/AppShell";
import { WorkspaceDashboard } from "@/components/WorkspaceDashboard";
import { requireCurrentApplication } from "@/lib/auth/applications";
export default async function PlatformAdmin() { await requireCurrentApplication("PLATFORM_ADMIN"); return <AppShell app="Platform Admin" logo="/brands/finance/fallback.svg" alt="Hakika Platform Admin mark" groups={[{label:'Overview',links:['Dashboard']},{label:'Platform',links:['Organizations','Applications','Plans']},{label:'Operations',links:[{label:'SMS delivery test',href:'/platform/sms-test'},'Provisioning','M-Pesa reconciliation']},{label:'Governance',links:['Operators','Global audit','Health']}]}><WorkspaceDashboard app="Platform Admin" eyebrow="Platform overview"/></AppShell>; }
