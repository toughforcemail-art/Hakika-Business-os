import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { moduleNames, moduleNavigation } from "@/modules/platform/module-navigation";
import { requireCurrentApplication, type ApplicationKey } from "@/lib/auth/applications";

const applicationKeys: Record<string, ApplicationKey> = {
  "real-estate": "REAL_ESTATE",
  toughforce: "TOUGHFORCE",
  hr: "HR",
  finance: "FINANCE",
};

const logos: Record<string, string> = {
  "real-estate": "/brands/real-estate/logo.jpg",
  toughforce: "/brands/toughforce/logo.jpg",
  hr: "/brands/hr/logo.jpg",
  finance: "/brands/finance/fallback.svg",
};

export default async function IntegratedModuleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ module: string }> }) {
  const { module } = await params;
  const applicationKey = applicationKeys[module];
  if (!moduleNames[module] || !moduleNavigation[module] || !applicationKey) notFound();
  await requireCurrentApplication(applicationKey);
  return <AppShell app={moduleNames[module]} logo={logos[module]} alt={`${moduleNames[module]} logo`} groups={moduleNavigation[module]}>{children}</AppShell>;
}
