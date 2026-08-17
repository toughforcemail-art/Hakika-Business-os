import { requireAuthenticatedUser } from "@/lib/auth/server";
import { PortalShell } from "@/modules/real-estate/components/PortalShell";
export default async function TenantLayout({ children }: { children: React.ReactNode }) { await requireAuthenticatedUser(); return <PortalShell role="Tenant">{children}</PortalShell>; }
