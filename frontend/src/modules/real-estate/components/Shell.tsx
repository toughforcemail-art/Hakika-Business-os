import Link from "next/link";
import Image from "next/image";
import { AppSwitcher } from "@/components/AppSwitcher";
import { SignOutButton } from "@/components/SignOutButton";
import { realEstateNavigationGroups } from "../navigation";
import { MobileNav } from "./MobileNav";

export function RealEstateShell({ children }: { children: React.ReactNode }) {
  return <div className="re-layout"><aside className="re-shell-sidebar"><div className="re-brand"><Image src="/brands/real-estate/logo.jpg" alt="Hakika Real Estate" width={40} height={40}/><div><strong>Hakika Real Estate</strong><small>Business OS application</small></div></div><Link href="/apps" className="re-shell-back">← Back to Business OS</Link><nav className="re-shell-nav">{realEstateNavigationGroups.map((group, index) => <details className="re-nav-group" key={group.label} open={index === 0}><summary>{group.label}</summary>{group.links.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}</details>)}</nav><AppSwitcher/><div className="re-shell-bottom">Signed in<br/><SignOutButton/></div></aside><section className="re-layout-workspace"><div className="re-mobile-topbar"><MobileNav/><span>Hakika Real Estate</span></div>{children}</section></div>;
}

export function ReHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: string; actions?: React.ReactNode }) { return <header className="re-header"><div><span className="re-eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="re-actions">{actions}</div>}</header>; }
export function ReButton({ children, href, variant = "primary" }: { children: React.ReactNode; href?: string; variant?: "primary"|"secondary"|"danger" }) { return href ? <Link className={`re-button ${variant}`} href={href}>{children}</Link> : <button className={`re-button ${variant}`} type="submit">{children}</button>; }
export function StatCard({ label, value, note }: { label: string; value: string|number; note: string }) { return <div className="re-stat"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>; }
