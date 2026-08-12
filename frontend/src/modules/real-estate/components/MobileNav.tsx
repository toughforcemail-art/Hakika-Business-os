"use client";
import Link from "next/link";
import { useState } from "react";
import { realEstateNavigationGroups } from "../navigation";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return <div className="re-mobile-nav"><button className="re-menu-button" aria-expanded={open} aria-controls="re-mobile-drawer" onClick={() => setOpen(!open)}>☰ <span>Menu</span></button>{open && <><button className="re-drawer-scrim" aria-label="Close menu" onClick={() => setOpen(false)} /><aside id="re-mobile-drawer" className="re-drawer"><div className="re-drawer-head"><strong>Real Estate</strong><button onClick={() => setOpen(false)} aria-label="Close menu">×</button></div>{realEstateNavigationGroups.map((group) => <details className="re-nav-group" key={group.label}><summary>{group.label}</summary>{group.links.map((link) => <Link href={link.href} onClick={() => setOpen(false)} key={link.href}>{link.label}</Link>)}</details>)}</aside></>}</div>;
}
