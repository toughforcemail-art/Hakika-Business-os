# Hakika Business OS UI Layout Reference

This is a portable, UI-only reference bundle for the Hakika Business OS shell. It intentionally contains no authentication, Supabase, browser storage, billing, demo data, routing dependency, or business mutation logic.

## Usage

Copy the three sections into a React/Next.js project and import `ui-layout-reference.css` (or paste the CSS into the project stylesheet). Supply the current application, page, navigation configuration, and callbacks from the host application.

## `AppShell.tsx`

```tsx
'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { AppKey, NavGroup } from './apps'

export type AppShellProps = {
  app: AppKey
  page: string
  appName: string
  accentColor: string
  groups: NavGroup[]
  children: ReactNode
  user?: { initials: string; label?: string }
  onBack?: () => void
  onNavigate?: (item: string) => void
  onNotifications?: () => void
}

export default function AppShell({
  app,
  page,
  appName,
  accentColor,
  groups,
  children,
  user = { initials: 'PK', label: 'Workspace user' },
  onBack,
  onNavigate,
  onNotifications,
}: AppShellProps) {
  const sidebarRef = useRef<HTMLElement>(null)
  const activeGroup = useMemo(() => groups.find(group => group.items.includes(page))?.label, [groups, page])
  const [openGroups, setOpenGroups] = useState<string[]>(activeGroup ? [activeGroup] : [])

  useEffect(() => {
    if (activeGroup && !openGroups.includes(activeGroup)) setOpenGroups(current => [...current, activeGroup])
  }, [activeGroup, openGroups])

  const toggleGroup = (label: string) => {
    setOpenGroups(current => current.includes(label) ? current.filter(item => item !== label) : [...current, label])
  }

  const rememberScroll = () => {
    // Host applications may persist this value if desired; the reference shell stays storage-free.
    sidebarRef.current?.scrollTop
  }

  return (
    <div className="hakika-shell" style={{ '--app-accent': accentColor } as CSSProperties} data-app={app}>
      <aside ref={sidebarRef} className="hakika-sidebar" onScroll={rememberScroll}>
        <div className="hakika-brand" aria-label="Hakika Business OS">
          <div className="hakika-brand-mark">H</div>
          <div><strong>HAKIKA</strong><span>BUSINESS OS</span></div>
        </div>

        <button className="hakika-switcher" type="button" onClick={onBack}>
          <span className="hakika-switcher-dot" />
          <span><b>{appName}</b><small>← Back to Business OS</small></span>
        </button>

        <nav className="hakika-nav" aria-label={`${appName} navigation`}>
          {groups.map(group => {
            const isOpen = openGroups.includes(group.label)
            return <section className="hakika-nav-group" key={group.label}>
              <button className="hakika-nav-group-toggle" type="button" onClick={() => toggleGroup(group.label)} aria-expanded={isOpen}>
                <span>{group.label}</span><span className={`hakika-chevron ${isOpen ? 'is-open' : ''}`}>›</span>
              </button>
              {isOpen && group.items.length > 0 && <div className="hakika-nav-items">
                {group.items.map(item => <button
                  className={`hakika-nav-item ${item === page ? 'is-active' : ''}`}
                  type="button" key={item} onClick={() => onNavigate?.(item)}
                  aria-current={item === page ? 'page' : undefined}
                ><i>•</i>{item}</button>)}
              </div>}
            </section>
          })}
        </nav>
      </aside>

      <main className="hakika-main">
        <header className="hakika-topbar">
          <div className="hakika-topbar-spacer" />
          <div className="hakika-topbar-actions">
            <button className="hakika-icon-button" type="button" aria-label="Notifications" onClick={onNotifications}>♧</button>
            <div className="hakika-profile" title={user.label}>{user.initials}</div>
          </div>
        </header>
        <div className="hakika-content">{children}</div>
      </main>
    </div>
  )
}
```

## `apps.ts`

```ts
export const appNames = {
  HR: 'Hakika HR',
  Admin: 'Platform Administration',
  RealEstate: 'Hakika Real Estate',
  Finance: 'Finance',
  ToughForce: 'ToughForce',
} as const

export type AppKey = keyof typeof appNames
export type NavGroup = { label: string; items: string[] }

export const colors: Record<AppKey, string> = {
  HR: '#7c4dce',
  Admin: '#ec332f',
  RealEstate: '#2c61db',
  Finance: '#f59d35',
  ToughForce: '#174caa',
}

export const navGroups: Record<AppKey, NavGroup[]> = {
  HR: [
    { label: 'CORE', items: ['Dashboard', 'Employee directory', 'Salary advances'] },
    { label: 'ADMINISTRATION', items: ['Total employees', 'Service billing'] },
    { label: 'DATA WORKSPACE', items: ['Add employee', 'Past employees', 'Departments', 'Roles & designations', 'Modules', 'Companies'] },
    { label: 'TIME WORKSPACE', items: ['Biometric logs', 'Site deployment', 'Overtime records'] },
    { label: 'PAYROLL WORKSPACE', items: ['Payroll overview', 'Payroll', 'Payslips', 'P9A form', 'Statutory reports'] },
    { label: 'LEAVE WORKSPACE', items: ['Apply for leave', 'My leave requests', 'Leave approvals', 'Leave types'] },
  ],
  Admin: [
    { label: 'EXECUTIVE', items: ['Executive Dashboard', 'Analytics', 'Revenue', 'KPIs', 'Reports'] },
    { label: 'WORKSPACE ADMINISTRATION', items: ['Organizations', 'Companies', 'Departments', 'Branches', 'Members', 'Invitations'] },
    { label: 'IDENTITY & ACCESS', items: ['Users', 'Roles', 'Permissions', 'Sessions', 'Security', 'Application Access'] },
    { label: 'GOVERNANCE', items: ['Enterprise Audit', 'Policies', 'Compliance', 'Risk', 'Approvals'] },
    { label: 'APPLICATIONS', items: ['Application Dashboard', 'Installed Applications', 'Marketplace', 'Settings'] },
    { label: 'SETTINGS', items: ['General', 'Branding', 'Domains', 'Payments', 'Security'] },
  ],
  RealEstate: [
    { label: 'I. OVERVIEW', items: ['Dashboard', 'Properties', 'Houses / Units', 'Inspections', 'Global Ledger', 'Notes & Findings'] },
    { label: 'II. TENANTS', items: ['Tenant Management', 'Tenant Archive', 'Vacating Notices', 'Digital Leases', 'Tenant Leases', 'Maintenance'] },
    { label: 'III. INVOICE & BILLING', items: ['Add Invoice Type', 'Create Invoice', 'Invoice List', 'Auto Billing', 'Arrears', 'Penalties'] },
    { label: 'IV. UTILITIES', items: ['Add Bill', 'Billing Summary', 'Meter Readings', 'PostPaid Meters', 'Configure Houses'] },
    { label: 'V. REPORTS', items: ['Statement of Rent', 'Tenant Ledger', 'Payment Reference', 'Water Consumption', 'Arrears Report', 'Expense Report'] },
    { label: 'COMMUNICATION', items: ['Lease Documents', 'Communications Hub'] },
    { label: 'PERSONNEL', items: ['Caretakers', 'Landlords', 'Deleted Properties'] },
    { label: 'VII. ASSETS', items: ['Asset Management', 'Asset Tracking', 'Add Asset'] },
    { label: 'VIII. AUDIT', items: ['Activity Log'] },
  ],
  Finance: [
    { label: 'I. OVERSIGHT', items: ['Finance Dashboard', 'Global Ledger', 'Journal Entry', 'Bank Accounts', 'Wallets', 'Statements'] },
    { label: 'MASTER DATA', items: ['Vendors', 'Cost Centres', 'Expense Groups'] },
    { label: 'EXPENSES', items: ['Requisitions', 'Payments', 'Payment Vouchers', 'Approvals', 'Deleted'] },
    { label: 'BANK RECONCILIATION', items: ['Bank Reconciliation'] },
    { label: 'FINANCE REPORTS', items: ['Expenses Report', 'Receipts Report', 'Arrears Report'] },
    { label: 'V. COMPLIANCE', items: ['Tax & Returns', 'Audit Trail'] },
  ],
  ToughForce: [
    { label: 'ADMINISTRATION', items: ['Workforce Hub'] },
    { label: 'I. COMMAND BRANCH', items: ['Tactical Console'] },
    { label: 'INCIDENT REPORTING', items: ['Daily Occurrence Book', 'Incident Types', 'Incident Intelligence'] },
    { label: 'ROSTER MANAGEMENT', items: ['Work Roster', 'Attendance Master', 'Activity Log', 'Past Guards', 'Client Portals'] },
    { label: 'COMPLIANCE', items: ['Compliance Hub', 'Notes & Findings'] },
    { label: 'II. CCTV & SURVEILLANCE', items: ['Surveillance Command', 'Live Wall', 'Camera & NVR Devices'] },
    { label: 'IV. PERSONNEL', items: ['Guard Database'] },
  ],
}

export const navByApp = Object.fromEntries(
  Object.entries(navGroups).map(([key, groups]) => [key, groups.flatMap(group => group.items)])
) as Record<AppKey, string[]>
```

## `globals.css`

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap');

:root { --ink:#152033; --muted:#718198; --canvas:#eef3f8; --line:#dfe6f0; --sidebar:#101b2b; --sidebar-muted:#9aaac0; --white:#fff; }
* { box-sizing:border-box; }
html, body { margin:0; min-height:100%; }
body { background:var(--canvas); color:var(--ink); font-family:'DM Sans',sans-serif; }
button, input, select, textarea { font:inherit; }
button { cursor:pointer; }

.hakika-shell { min-height:100vh; display:grid; grid-template-columns:280px minmax(0,1fr); background:var(--canvas); }
.hakika-sidebar { position:sticky; top:0; height:100vh; overflow-y:auto; padding:28px 18px 34px; background:var(--sidebar); color:#fff; scrollbar-color:#41516b transparent; }
.hakika-brand { display:flex; align-items:center; gap:12px; padding:0 14px 30px; }
.hakika-brand-mark { width:42px; height:42px; display:grid; place-items:center; border-radius:10px; background:#fff; color:var(--sidebar); font-size:22px; font-weight:800; }
.hakika-brand strong, .hakika-brand span { display:block; }.hakika-brand strong { letter-spacing:1px; }.hakika-brand span { margin-top:3px; color:#b9c8d7; font-size:11px; letter-spacing:1.3px; }
.hakika-switcher { width:100%; display:flex; align-items:center; gap:12px; padding:14px; border:0; border-top:1px solid #29364a; border-bottom:1px solid #29364a; background:transparent; color:#fff; text-align:left; }
.hakika-switcher-dot { width:12px; height:12px; flex:0 0 12px; border-radius:50%; background:var(--app-accent); box-shadow:0 0 0 5px color-mix(in srgb,var(--app-accent) 18%, transparent); }.hakika-switcher b,.hakika-switcher small { display:block; }.hakika-switcher small { margin-top:5px; color:var(--sidebar-muted); font-size:12px; }
.hakika-nav { padding-top:24px; }.hakika-nav-group { margin-bottom:12px; }.hakika-nav-group-toggle { width:100%; display:flex; justify-content:space-between; align-items:center; padding:8px 14px; border:0; background:transparent; color:#7186a5; font-size:11px; font-weight:800; letter-spacing:1.3px; text-align:left; }.hakika-chevron { color:#7186a5; font-size:21px; line-height:10px; transition:transform .18s ease; }.hakika-chevron.is-open { transform:rotate(90deg); }
.hakika-nav-items { display:grid; gap:3px; }.hakika-nav-item { width:100%; display:flex; align-items:center; gap:10px; padding:11px 14px; border:0; border-radius:9px; background:transparent; color:#b7c7dc; text-align:left; transition:background .16s ease,color .16s ease,transform .16s ease; }.hakika-nav-item i { color:var(--app-accent); font-style:normal; }.hakika-nav-item:hover { background:#1d2a3e; color:#fff; transform:translateX(2px); }.hakika-nav-item.is-active { background:color-mix(in srgb,var(--app-accent) 28%,#172337); color:#fff; font-weight:700; box-shadow:inset 3px 0 var(--app-accent); }
.hakika-main { min-width:0; }.hakika-topbar { height:72px; display:flex; align-items:center; justify-content:space-between; padding:0 clamp(20px,4vw,54px); border-bottom:1px solid var(--line); background:#fff; }.hakika-topbar-actions { display:flex; align-items:center; gap:18px; }.hakika-icon-button { width:38px; height:38px; border:0; background:transparent; color:#607188; font-size:22px; }.hakika-profile { width:38px; height:38px; display:grid; place-items:center; border-radius:50%; background:var(--ink); color:#fff; font-size:13px; font-weight:800; }.hakika-content { min-height:calc(100vh - 72px); padding:clamp(24px,4vw,54px); }
.panel { border:1px solid var(--line); border-radius:14px; background:#fff; box-shadow:0 12px 28px rgba(21,32,51,.06); }.page-title { margin:0; font-family:'Playfair Display',Georgia,serif; font-size:clamp(32px,4vw,54px); line-height:1.05; }.page-subtitle { color:var(--muted); line-height:1.6; }
.button-primary { border:0; border-radius:9px; padding:12px 18px; background:var(--app-accent); color:#fff; font-weight:700; }.button-secondary { border:1px solid var(--line); border-radius:9px; padding:11px 17px; background:#fff; color:var(--ink); font-weight:700; }.button-primary:hover,.button-secondary:hover { filter:brightness(.96); transform:translateY(-1px); }
.table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:14px; background:#fff; }.table-wrap table { width:100%; min-width:720px; border-collapse:collapse; }.table-wrap th,.table-wrap td { padding:15px 16px; border-bottom:1px solid #edf1f6; text-align:left; }.table-wrap th { background:#f8fafc; color:#64748a; font-size:12px; letter-spacing:.7px; text-transform:uppercase; }.table-wrap tr:last-child td { border-bottom:0; }
@media (max-width:900px) { .hakika-shell { grid-template-columns:230px minmax(0,1fr); } }
@media (max-width:680px) { .hakika-shell { display:block; }.hakika-sidebar { position:relative; height:auto; max-height:none; }.hakika-nav { padding-bottom:8px; }.hakika-topbar { height:62px; padding:0 18px; }.hakika-content { padding:22px 16px 36px; }.hakika-nav-items { grid-template-columns:repeat(2,minmax(0,1fr)); }.hakika-nav-item { font-size:13px; }.hakika-topbar-spacer { display:none; } }
```
