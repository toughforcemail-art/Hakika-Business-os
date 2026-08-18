import { notFound, redirect } from "next/navigation";
import { IntegratedModulePage } from "@/modules/platform/IntegratedModulePage";
import { moduleNames, moduleNavigation } from "@/modules/platform/module-navigation";

export default async function IntegratedRoute({ params }: { params: Promise<{ module: string; section?: string[] }> }) {
  const { module, section = [] } = await params;
  if (!moduleNames[module] || !moduleNavigation[module]) notFound();
  // Real Estate has a tenant-scoped server implementation. Keep the ZIP-era
  // /app/real-estate entry points as aliases, but do not send them through the
  // extracted legacy renderer (which queries obsolete re_* tables).
  if (module === "real-estate") redirect(`/real-estate/${section.join("/") || "dashboard"}`);
  return <IntegratedModulePage module={module} section={section} />;
}
