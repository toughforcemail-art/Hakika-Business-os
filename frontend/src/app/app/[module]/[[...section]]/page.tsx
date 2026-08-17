import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { IntegratedModulePage } from "@/modules/platform/IntegratedModulePage";
import { moduleNames, moduleNavigation } from "@/modules/platform/module-navigation";
import { requireCurrentApplication } from "@/lib/auth/applications";

const applicationKeys: Record<string, "REAL_ESTATE" | "TOUGHFORCE" | "HR" | "FINANCE"> = { "real-estate": "REAL_ESTATE", toughforce: "TOUGHFORCE", hr: "HR", finance: "FINANCE" };
const logos: Record<string, string> = { "real-estate": "/brands/real-estate/logo.jpg", toughforce: "/brands/toughforce/logo.jpg", hr: "/brands/hr/logo.jpg", finance: "/brands/finance/fallback.svg" };

export default async function IntegratedRoute({ params }: { params: Promise<{ module: string; section?: string[] }> }) {
  const { module, section = [] } = await params;
  if (!moduleNames[module] || !moduleNavigation[module]) notFound();
  await requireCurrentApplication(applicationKeys[module]);
  // Real Estate has a tenant-scoped server implementation. Keep the ZIP-era
  // /app/real-estate entry points as aliases, but do not send them through the
  // extracted legacy renderer (which queries obsolete re_* tables).
  if (module === "real-estate") redirect(`/real-estate/${section.join("/") || "dashboard"}`);
  return <AppShell app={moduleNames[module]} logo={logos[module]} alt={`${moduleNames[module]} logo`} groups={moduleNavigation[module]}><IntegratedModulePage module={module} section={section} /></AppShell>;
}
