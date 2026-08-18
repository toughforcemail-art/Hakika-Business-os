"use client";

import Link from "next/link";
import { moduleNames } from "@/modules/platform/module-navigation";
import { LegacyPageRenderer, hasLegacyPage } from "@/modules/platform/LegacyPageRenderer";

const titles: Record<string, string> = {
  dashboard: "Dashboard", properties: "Properties", tenants: "Tenants", units: "Units", invoices: "Invoices", payments: "Payments", arrears: "Arrears", maintenance: "Maintenance", leases: "Leases", landlords: "Landlords", caretakers: "Caretakers", assets: "Assets", reports: "Reports", settings: "Settings", guards: "Guards", locations: "Locations", roster: "Roster", attendance: "Attendance", incidents: "Incidents", patrols: "Patrols", cctv: "CCTV", billing: "Billing", recommendations: "Recommendations", employees: "Employees", "add-employee": "Add Employee", add: "Add Employee", departments: "Departments", designations: "Designations", leave: "Leave", payroll: "Payroll", "my-payroll": "My Payroll", recruitment: "Recruitment", disciplinary: "Disciplinary", documents: "Documents", expenses: "Expenses", "salary-advances": "Salary Advances", "statutory-returns": "Statutory Returns", accounts: "Accounts", "bank-accounts": "Bank Accounts", "bank-connections": "Bank Connections", receipts: "Receipts", requisitions: "Requisitions", "requisition-approvals": "Requisition Approvals", "payment-vouchers": "Payment Vouchers", wallets: "Wallets", ledger: "Ledger", reconciliation: "Reconciliation", tax: "Tax", payees: "Payees", "payment-options": "Payment Options", "cost-centres": "Cost Centres", "expense-groups": "Expense Groups", audit: "Audit Trail",
};

export function IntegratedModulePage({ module, section }: { module: string; section: string[] }) {
  const slug = section.join("/") || "dashboard";
  const title = titles[section.at(-1) ?? "dashboard"] ?? section.at(-1)?.replaceAll("-", " ") ?? "Dashboard";
  if (hasLegacyPage(module, section)) {
    // Total Employees owns its complete reference-style header. Rendering the
    // generic migrated-page header here creates a duplicate title and actions.
    if (module === "hr" && slug === "total-employees") {
      return <main className="integrated-page legacy-integrated-page integrated-page-own-header"><LegacyPageRenderer module={module} section={section} /></main>;
    }
    return <main className="integrated-page legacy-integrated-page"><header className="integrated-header"><div><div className="eyebrow">{moduleNames[module]} workspace</div><h1>{title}</h1><p>Manage this {moduleNames[module]} workspace page.</p></div><Link className="button secondary" href={`/app/${module}/dashboard`}>Dashboard</Link></header><LegacyPageRenderer module={module} section={section} /></main>;
  }
  return <main className="integrated-page">
    <header className="integrated-header"><div><div className="eyebrow">{moduleNames[module] ?? module} workspace</div><h1>{title}</h1><p>This page is registered in the workspace navigation but its connected workflow is not available yet.</p></div><Link className="button secondary" href={`/app/${module}/dashboard`}>Dashboard</Link></header>
    <section className="card panel integrated-coming-soon" aria-labelledby="coming-soon-title"><div className="integrated-coming-soon-mark" aria-hidden="true">+</div><h2 id="coming-soon-title">Coming soon</h2><p>The live database workflow and permission-aware form for <strong>{title}</strong> have not been connected yet. Existing migrated pages and connected records remain available from the workspace navigation.</p><Link className="button primary" href="/support">Request workflow setup</Link></section>
  </main>;
}
