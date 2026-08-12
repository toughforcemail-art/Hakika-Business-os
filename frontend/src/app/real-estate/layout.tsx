import { requireCurrentApplication } from "@/lib/auth/applications";
import { RealEstateShell } from "@/modules/real-estate/components/Shell";
export default async function RealEstateLayout({ children }: { children: React.ReactNode }) { await requireCurrentApplication("REAL_ESTATE"); return <RealEstateShell>{children}</RealEstateShell>; }
