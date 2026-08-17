import Link from "next/link";

export function PortalShell({ children, role, baseHref = "" }: { children: React.ReactNode; role: "Tenant" | "Landlord" | "Caretaker"; baseHref?: string }) {
  const home = role === "Tenant" ? "/tenant/dashboard" : role === "Landlord" ? "/landlord/dashboard" : "/caretaker/dashboard";
  const link = (path: string) => baseHref ? `${baseHref}?tab=${encodeURIComponent(path)}` : path;
  const tenantItems = [["Profile", "My profile"], ["Lease", "My lease"], ["Invoices", "My invoices"], ["Payments", "Payments"], ["Receipts", "Receipts"], ["Statement", "My statement"], ["Maintenance", "Maintenance requests"], ["Messages", "Messages"]];
  return <div className="re-layout"><aside className="re-shell-sidebar"><div className="re-app-identity"><span className="re-app-mark">H</span><div><strong>Hakika Real Estate</strong><small>{role} portal</small></div></div><Link className="re-back-link" href={baseHref || "/apps"}>← {baseHref ? "Back to tenant" : "Business OS"}</Link><nav className="re-shell-nav"><Link href={baseHref ? link("Dashboard") : home}>Overview</Link>{role === "Tenant" && tenantItems.map(([tab, label]) => <Link href={link(tab)} key={tab}>{label}</Link>)}{role === "Landlord" && <Link href="/real-estate/management/landlords">Properties & statements</Link>}{role === "Caretaker" && <Link href="/real-estate/management/caretakers">Assigned work</Link>}</nav></aside><section className="re-layout-workspace"><div className="re-mobile-topbar"><span>Hakika · {role} portal</span></div>{children}</section></div>;
}
