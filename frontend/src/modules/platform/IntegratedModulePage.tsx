"use client";

import Link from "next/link";
import { moduleNames } from "@/modules/platform/module-navigation";
import { LegacyPageRenderer, hasLegacyPage } from "@/modules/platform/LegacyPageRenderer";

const titles: Record<string, string> = {
  dashboard: "Dashboard", properties: "Properties", tenants: "Tenants", units: "Units", invoices: "Invoices", payments: "Payments", arrears: "Arrears", maintenance: "Maintenance", leases: "Leases", landlords: "Landlords", caretakers: "Caretakers", assets: "Assets", reports: "Reports", settings: "Settings", guards: "Guards", locations: "Locations", roster: "Roster", attendance: "Attendance", incidents: "Incidents", patrols: "Patrols", cctv: "CCTV", billing: "Billing", recommendations: "Recommendations", employees: "Employees", departments: "Departments", designations: "Designations", leave: "Leave", payroll: "Payroll", "my-payroll": "My Payroll", recruitment: "Recruitment", disciplinary: "Disciplinary", documents: "Documents", expenses: "Expenses", "salary-advances": "Salary Advances", "statutory-returns": "Statutory Returns", accounts: "Accounts", "bank-accounts": "Bank Accounts", "bank-connections": "Bank Connections", receipts: "Receipts", requisitions: "Requisitions", "requisition-approvals": "Requisition Approvals", "payment-vouchers": "Payment Vouchers", wallets: "Wallets", ledger: "Ledger", reconciliation: "Reconciliation", tax: "Tax", payees: "Payees", "payment-options": "Payment Options", "cost-centres": "Cost Centres", "expense-groups": "Expense Groups", audit: "Audit Trail",
};

export function IntegratedModulePage({ module, section }: { module: string; section: string[] }) {
  const slug = section.join("/") || "dashboard";
  const title = titles[section.at(-1) ?? "dashboard"] ?? section.at(-1)?.replaceAll("-", " ") ?? "Dashboard";
  const isDashboard = slug === "dashboard";
  if (hasLegacyPage(module, section)) return <main className="integrated-page legacy-integrated-page"><header className="integrated-header"><div><div className="eyebrow">{moduleNames[module]} workspace</div><h1>{title}</h1><p>Manage this {moduleNames[module]} workspace page.</p></div><Link className="button secondary" href={`/app/${module}/dashboard`}>Dashboard</Link></header><LegacyPageRenderer module={module} section={section} /></main>;
  const stats = isDashboard ? ["Total records", "Active this month", "Pending review", "Needs attention"] : ["Records", "Active", "Pending", "Completed"];
  return <main className="integrated-page">
    <header className="integrated-header"><div><div className="eyebrow">{moduleNames[module] ?? module} workspace</div><h1>{title}</h1><p>{isDashboard ? "A visual overview of your operations, ready for live business data." : `Manage ${title.toLowerCase()} in the ${moduleNames[module] ?? module} workspace.`}</p></div><div className="integrated-actions"><Link className="button secondary" href={`/app/${module}/dashboard`}>Dashboard</Link><button className="button" type="button">+ Add record</button></div></header>
    <section className="integrated-stats">{stats.map((label, i) => <article className="card integrated-stat" key={label}><span>{label}</span><strong>{[24, 18, 7, 3][i]}</strong><small>{i === 0 ? "Mocked compatibility data" : "Awaiting data adapter"}</small></article>)}</section>
    <section className="integrated-grid"><article className="card integrated-panel"><div className="panel-header"><h2>{isDashboard ? "Recent activity" : `${title} directory`}</h2><span>Preview data</span></div><div className="integrated-table">{["Operations overview", "Monthly activity", "Workflow queue", "Account review"].map((row, i) => <div className="integrated-row" key={row}><span><b>{row}</b><small>Compatibility placeholder for extracted OmniGuard page content</small></span><em>{i % 2 ? "In review" : "Ready"}</em></div>)}</div></article><aside className="card integrated-panel"><div className="panel-header"><h2>Quick actions</h2></div><div className="integrated-actions-list"><Link href="#">Import records</Link><Link href="#">Export report</Link><Link href="#">Configure workflow</Link><Link href={`/app/${module}/settings`}>Open settings</Link></div><p className="integrated-note">TODO: connect this view to the migrated Supabase services and permissions.</p></aside></section>
  </main>;
}
