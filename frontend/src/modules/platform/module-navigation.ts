import type { AppNavGroup } from "@/components/AppNavigation";
import { financePages, hrPages, realEstatePages, toughforcePages } from "@/modules/manifests";

const group = (label: string, items: Array<[string, string]>, module: string): AppNavGroup => ({
  label,
  links: items.map(([name, path]) => ({ label: name, href: `/app/${module}/${path}` })),
});

export const moduleNavigation: Record<string, AppNavGroup[]> = {
  "real-estate": [
    group("PORTFOLIO", [["Dashboard", "dashboard"], ["Properties", "properties"], ["Houses & Units", "units"], ["Global Ledger", "ledger"], ["Notes & Findings", "notes"], ["Inspections", "inspections"], ["Maintenance", "maintenance"]], "real-estate"),
    group("PEOPLE & LEASES", [["Tenant Management", "tenants"], ["Digital Leases", "leases"], ["Move In", "move-in"], ["Move Out", "move-out"], ["Landlords", "management/landlords"], ["Caretakers", "management/caretakers"]], "real-estate"),
    group("INVOICES & BILLING", [["Billing Analytics", "invoice"], ["Invoice List", "invoice/list"], ["Add Invoice Item", "invoice/add-item"], ["Auto-Billing", "invoice/auto-billing"], ["Invoice Types", "invoice/types"], ["Deleted Invoices", "invoice/deleted"], ["Arrears", "invoice/arrears"], ["Penalties", "invoice/penalties"], ["Add Water Bill", "bill-water/add-bill"], ["Water Billing Summary", "bill-water/billing-summary"], ["Meter Readings", "bill-power/meter-recordings"], ["Postpaid Meters", "bill-power/postpaid-meters"], ["Configure Houses", "bill-power/configure-houses"]], "real-estate"),
    group("PAYMENTS & SPLITS", [["Payment Directory", "payments"], ["Manual Payments", "payments/manual"], ["M-Pesa Tracker", "payments/mpesa"], ["PesaLink Transactions", "payments/pesalink"], ["Reconciliation", "reconciliation"], ["Split Management", "split-management"], ["Payout Queue", "split-management/queue"], ["Payout History", "split-management/history"], ["Split Audit", "split-management/split-audit"], ["Bank Join", "split-management/bank-join"]], "real-estate"),
    group("REPORTS & INSIGHTS", [["Statement of Rent", "reports/statement-of-rent"], ["Tenant Ledger", "reports/tenant-ledger"], ["Payment Reference", "reports/payment-reference"], ["Water Consumption", "reports/water-consumption"], ["Arrears Report", "reports/arrears"], ["Expense Report", "reports/expenses"], ["Financial Yield", "yield"]], "real-estate"),
    group("COMMUNICATION", [["SMS / WhatsApp Hub", "communication/hub"], ["Vacating Notices", "communication/vacating-notices"], ["Maintenance Communications", "communication/maintenance"], ["Lease Documents", "communication/lease-documents"]], "real-estate"),
    group("ASSETS", [["Asset Inventory", "assets"], ["Asset Tracking", "assets/tracking"], ["Add Asset", "assets/add"]], "real-estate"),
    group("ADMINISTRATION", [["Deleted Records", "deleted/all"], ["Company Settings", "company-settings"], ["Property Settings", "property-settings"], ["Audit Activity", "audit-activity"]], "real-estate"),
  ],
  toughforce: [
    group("Overview", [["Dashboard", "dashboard"], ["Guards", "guards"], ["Locations", "locations"]], "toughforce"),
    group("Workforce", [["Roster", "roster"], ["Attendance", "attendance"], ["Patrols", "patrols"]], "toughforce"),
    group("Safety & assets", [["Incidents", "incidents"], ["CCTV", "cctv"], ["Assets", "assets"]], "toughforce"),
    group("Business", [["Billing", "billing"], ["Recommendations", "recommendations"], ["Reports", "reports"], ["Settings", "settings"]], "toughforce"),
  ],
  hr: [
    group("I. CORE", [["Dashboard", "dashboard"], ["Employee Directory", "employees"], ["Salary Advances", "salary-advances"], ["Salary Advance Approvals", "salary-advances/approvals"]], "hr"),
    group("II. DATA WORKSPACE", [["Add Employee", "employees/add"], ["Total Employees", "total-employees"], ["Past Employees", "past-employees"], ["Departments", "departments"], ["Roles & Designations", "designations"], ["Modules", "modules"], ["Companies", "companies"]], "hr"),
    group("TIME WORKSPACE", [["Biometric Logs", "biometric-logs"], ["Site Deployment", "site-deployment"], ["Overtime Records", "overtime-records"]], "hr"),
    group("EXPENSES WORKSPACE", [["Expense Reports", "expenses"]], "hr"),
    group("ASSETS WORKSPACE", [["Add Asset", "assets/add"], ["Asset Assignment", "assets/assignment"], ["Asset Tracking", "assets"]], "hr"),
    group("PAYROLL WORKSPACE", [["Payroll Overview", "payroll/process"], ["Payroll", "payroll/paye-csv"], ["Payslips", "my-payroll"], ["P9A Form", "payroll/p9a"], ["Salary Advances", "salary-advances"], ["Salary Advance Approvals", "salary-advances/approvals"], ["Statutory Reports", "statutory-returns"], ["Deductions Calculator", "payroll/deductions-test"]], "hr"),
    group("LEAVE WORKSPACE", [["Apply for Leave", "leave/apply"], ["My Leave Requests", "my-leave-requests"], ["Leave Approvals", "leave/approvals"], ["Leave Types", "leave-types"], ["Sick Leave Requests", "sick-leave-requests"]], "hr"),
    group("RECRUITMENT (ATS)", [["Recruitment", "recruitment"]], "hr"),
    group("III. MANAGEMENT", [["Disciplinary Cases", "disciplinary"], ["Document Expiry", "documents"]], "hr"),
    group("INSIGHTS & ADMINISTRATION", [["Reports", "reports"], ["Settings", "settings"]], "hr"),
  ],
  finance: [
    group("Overview", [["Dashboard", "dashboard"], ["Accounts", "accounts"], ["Ledger", "ledger"]], "finance"),
    group("Banking & money", [["Bank accounts", "bank-accounts"], ["Bank connections", "bank-connections"], ["Payments", "payments"], ["Receipts", "receipts"], ["Wallets", "wallets"]], "finance"),
    group("Controls", [["Invoices", "invoices"], ["Requisitions", "requisitions"], ["Requisition approvals", "requisition-approvals"], ["Payment vouchers", "payment-vouchers"], ["Reconciliation", "reconciliation"], ["Tax", "tax"]], "finance"),
    group("Administration", [["Payees", "payees"], ["Payment options", "payment-options"], ["Cost centres", "cost-centres"], ["Expense groups", "expense-groups"], ["Reports", "reports"], ["Audit", "audit"], ["Settings", "settings"]], "finance"),
  ],
};

export const moduleNames: Record<string, string> = { "real-estate": "Real Estate", toughforce: "ToughForce", hr: "HR", finance: "Finance" };

// Keep the curated navigation above, but expose every extracted ZIP screen as
// a reachable page as well. Existing links are preserved and are not replaced.
const extractedPages: Record<string, readonly { name: string; slug: string }[]> = {
  finance: financePages,
  hr: hrPages,
  "real-estate": realEstatePages,
  toughforce: toughforcePages,
};

for (const [module, pages] of Object.entries(extractedPages)) {
  const groups = moduleNavigation[module] ?? [];
  const existing = new Set(groups.flatMap((group) => group.links.map((link) => typeof link === "string" ? link.split("/").pop() : link.href.split("/").pop())));
  const missing = pages.filter((page) => !existing.has(page.slug));
  if (missing.length) groups.push(group("MIGRATED PAGES", missing.map((page) => [page.name, page.slug] as [string, string]), module));
}
