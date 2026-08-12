import Link from "next/link";
import Image from "next/image";
import { AppSwitcher } from "@/components/AppSwitcher";
import { SignOutButton } from "@/components/SignOutButton";
import { AppNavigation, type AppNavItem } from "@/components/AppNavigation";
import { realEstateNavigationGroups } from "@/modules/real-estate/navigation";

type AppShellProps = { app: string; logo: string; alt: string; children: React.ReactNode; groups?: { label: string; links: AppNavItem[] }[] };

export function AppShell({ app, logo, alt, children, groups }: AppShellProps) {
  const navigationGroups = app === "Hakika Real Estate" ? realEstateNavigationGroups : groups ?? [{ label: "Overview", links: ["Dashboard"] }, { label: "Workspace", links: ["Directory", "Reports", "Settings"] }];
  return <div className="app-shell"><aside className="sidebar"><div className="side-brand"><Image src={logo} alt={alt} width={36} height={36} /><div><strong>{app}</strong><small>Business OS</small></div></div><Link href="/apps" className="back-link">← Back to Business OS</Link><AppNavigation groups={navigationGroups} /><AppSwitcher /><div className="side-bottom">Signed in<br /><SignOutButton /></div></aside><section className="workspace">{children}</section></div>;
}
