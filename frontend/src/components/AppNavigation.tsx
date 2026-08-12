"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type AppNavItem = string | { label: string; href: string };
export type AppNavGroup = { label: string; links: AppNavItem[] };

export function AppNavigation({ groups }: { groups: AppNavGroup[] }) {
  const pathname = usePathname();
  return <>{groups.map((group) => <div className="nav-group" key={group.label}>
    <div className="nav-group-label">{group.label}</div>
    {group.links.map((item, index) => {
      const label = typeof item === "string" ? item : item.label;
      const href = typeof item === "string" ? undefined : item.href;
      const active = href ? pathname === href : false;
      if (!href) return <span key={label} className={`side-link${index === 0 ? " active" : ""}`} aria-disabled="true" title="Available in the next application slice"><span>{label}</span><b aria-hidden="true">{index === 0 ? "◼" : "•"}</b></span>;
      return <Link key={label} href={href} className={`side-link${active ? " active" : ""}`} aria-current={active ? "page" : undefined}><span>{label}</span><b aria-hidden="true">{active ? "◼" : "•"}</b></Link>;
    })}
  </div>)}</>;
}
