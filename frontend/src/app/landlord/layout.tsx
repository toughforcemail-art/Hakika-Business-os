import { requireAuthenticatedUser } from "@/lib/auth/server";
import { PortalShell } from "@/modules/real-estate/components/PortalShell";
export default async function LandlordLayout({ children }: { children: React.ReactNode }) { await requireAuthenticatedUser(); return <PortalShell role="Landlord">{children}</PortalShell>; }
