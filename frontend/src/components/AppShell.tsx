import Link from "next/link";
import Image from "next/image";
import { AppNavigation, type AppNavItem } from "@/components/AppNavigation";
import { realEstateNavigationGroups } from "@/modules/real-estate/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NotificationBell } from "@/components/NotificationBell";
import { Suspense } from "react";
import { SessionTimeoutMonitor } from "@/components/SessionTimeoutMonitor";

type AppShellProps = { app: string; logo: string; alt: string; children: React.ReactNode; groups?: { label: string; links: AppNavItem[] }[] };
async function AppShellAccount() {
  const supabase = await createSupabaseServerClient();
  const { data: user } = await supabase.auth.getUser();
  const [{ count: unreadCount, data: recent }, { data: profile }] = user.user ? await Promise.all([
    supabase.schema("platform").from("notifications").select("id,title,message,severity,action_url", { count: "exact" }).eq("recipient_user_id", user.user.id).is("read_at", null).is("dismissed_at", null).order("created_at", { ascending: false }).limit(5),
    supabase.schema("iam").from("profiles").select("display_name").eq("user_id", user.user.id).maybeSingle(),
  ]) : [{ count: 0, data: [] }, { data: null }];
  const displayName = profile?.display_name?.trim() || user.user?.email || "Account";
  const initials = displayName.split(/\s+/).map((part: string) => part[0]).join("").slice(0, 2).toUpperCase();
  return <><NotificationBell unreadCount={unreadCount ?? 0} recent={recent ?? []}/><details className="account-menu"><summary><span className="account-avatar">{initials}</span><span className="account-name">{displayName}</span></summary><div className="account-menu-panel"><strong>{displayName}</strong><span>{user.user?.email}</span><Link href="/settings/profile">Edit profile</Link><Link href="/settings/notifications">Notification preferences</Link></div></details></>;
}

function AppShellAccountFallback() {
  return <><div className="notification-widget notification-widget-loading" aria-hidden="true" /><details className="account-menu"><summary><span className="account-avatar">…</span><span className="account-name">Account</span></summary></details></>;
}

export function AppShell({ app, logo, alt, children, groups }: AppShellProps) {
  const navigationGroups = app === "Hakika Real Estate" ? realEstateNavigationGroups : groups ?? [{ label: "Overview", links: [{ label: "Dashboard", href: "/dashboard" }] }];
  return <div className="app-shell"><aside className="sidebar"><div className="side-brand"><Image src={logo} alt={alt} width={36} height={36} /><div><strong>{app}</strong><small>Business OS</small></div></div><Link href="/apps" className="back-link">Back to Business OS</Link><AppNavigation groups={navigationGroups} /></aside><section className="workspace"><div className="global-notification-bar"><Suspense fallback={<AppShellAccountFallback />}><AppShellAccount /></Suspense></div>{children}</section><SessionTimeoutMonitor /></div>;
}
