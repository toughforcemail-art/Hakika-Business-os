import { REAL_ESTATE_PERMISSIONS as P } from "../permissions/catalog";
import type { RealEstateNavigationItem } from "../types";

const item = (id: string, label: string, slug: string, requiredPermission: string): RealEstateNavigationItem => ({
  id,
  label,
  href: `/real-estate/${slug}`,
  requiredPermission,
  requiredApplication: "REAL_ESTATE",
});

export const REAL_ESTATE_NAVIGATION: ReadonlyArray<{ id: string; label: string; items: ReadonlyArray<RealEstateNavigationItem> }> = [
  { id: "core", label: "Portfolio", items: [
    item("dashboard", "Dashboard", "dashboard", P.dashboardRead),
    item("properties", "Properties", "properties", P.propertiesRead),
    item("units", "Houses & Units", "units", P.unitsRead),
    item("ledger", "Global Ledger", "ledger", P.dashboardRead),
    item("notes", "Notes & Findings", "notes", P.propertiesRead),
    item("inspections", "Inspections", "inspections", P.propertiesRead),
    item("maintenance", "Maintenance", "maintenance", P.propertiesRead),
  ] },
  { id: "people", label: "People & Leases", items: [
    item("tenants", "Tenant Management", "tenants", P.tenantsRead),
    item("leases", "Digital Leases", "leases", P.leasesRead),
    item("move-in", "Move In", "move-in", P.leasesRead),
    item("move-out", "Move Out", "move-out", P.leasesRead),
    item("landlords", "Landlords", "management/landlords", P.propertiesRead),
    item("caretakers", "Caretakers", "management/caretakers", P.propertiesRead),
  ] },
  { id: "billing", label: "Invoices & Billing", items: [
    item("invoice-overview", "Billing Analytics", "invoice", P.invoicesRead),
    item("invoice-list", "Invoice List", "invoice/list", P.invoicesRead),
    item("add-invoice-item", "Add Invoice Item", "invoice/add-item", P.invoicesCreate),
    item("auto-billing", "Auto-Billing", "invoice/auto-billing", P.invoicesRead),
    item("invoice-types", "Invoice Types", "invoice/types", P.invoicesRead),
    item("deleted-invoices", "Deleted Invoices", "invoice/deleted", P.invoicesRead),
    item("arrears", "Arrears", "invoice/arrears", P.invoicesRead),
    item("penalties", "Penalties", "invoice/penalties", P.invoicesRead),
    item("water-add", "Add Water Bill", "bill-water/add-bill", P.invoicesRead),
    item("water-summary", "Water Billing Summary", "bill-water/billing-summary", P.invoicesRead),
    item("meter-readings", "Meter Readings", "bill-power/meter-recordings", P.invoicesRead),
    item("postpaid-meters", "Postpaid Meters", "bill-power/postpaid-meters", P.invoicesRead),
    item("configure-houses", "Configure Houses", "bill-power/configure-houses", P.invoicesRead),
  ] },
  { id: "payments", label: "Payments & Splits", items: [
    item("payments", "Payment Directory", "payments", P.paymentsRead),
    item("manual-payments", "Manual Payments", "payments/manual", P.paymentsCreate),
    item("mpesa", "M-Pesa Tracker", "payments/mpesa", P.paymentsRead),
    item("pesalink", "PesaLink Transactions", "payments/pesalink", P.paymentsRead),
    item("reconciliation", "Reconciliation", "reconciliation", P.paymentsReconcile),
    item("split-management", "Split Management", "split-management", P.paymentsAllocate),
    item("split-queue", "Payout Queue", "split-management/queue", P.paymentsAllocate),
    item("split-history", "Payout History", "split-management/history", P.paymentsAllocate),
    item("split-audit", "Split Audit", "split-management/split-audit", P.paymentsRead),
    item("bank-join", "Bank Join", "split-management/bank-join", P.paymentsAllocate),
  ] },
  { id: "reports", label: "Reports & Insights", items: [
    item("statement-of-rent", "Statement of Rent", "reports/statement-of-rent", P.invoicesRead),
    item("tenant-ledger", "Tenant Ledger", "reports/tenant-ledger", P.invoicesRead),
    item("payment-reference", "Payment Reference", "reports/payment-reference", P.paymentsRead),
    item("water-consumption", "Water Consumption", "reports/water-consumption", P.invoicesRead),
    item("arrears-report", "Arrears Report", "reports/arrears", P.invoicesRead),
    item("expense-report", "Expense Report", "reports/expenses", P.dashboardRead),
    item("yield", "Financial Yield", "yield", P.dashboardRead),
  ] },
  { id: "communication", label: "Communication", items: [
    item("communication-hub", "SMS / WhatsApp Hub", "communication/hub", P.propertiesRead),
    item("vacating-notices", "Vacating Notices", "communication/vacating-notices", P.propertiesRead),
    item("maintenance-communication", "Maintenance Communications", "communication/maintenance", P.propertiesRead),
    item("lease-documents", "Lease Documents", "communication/lease-documents", P.leasesRead),
  ] },
  { id: "assets", label: "Assets", items: [
    item("assets", "Asset Inventory", "assets", P.unitAssetsRead),
    item("asset-tracking", "Asset Tracking", "assets/tracking", P.unitAssetsRead),
    item("add-asset", "Add Asset", "assets/add", P.unitAssetsCreate),
  ] },
  { id: "administration", label: "Administration", items: [
    item("deleted-records", "Deleted Records", "deleted/all", P.propertiesRead),
    item("company-settings", "Company Settings", "company-settings", P.settingsManage),
    item("property-settings", "Property Settings", "property-settings", P.settingsManage),
    item("audit", "Audit Activity", "audit-activity", "admin.audit.read"),
  ] },
];

export const realEstateNavigationGroups = REAL_ESTATE_NAVIGATION.map((group) => ({ label: group.label, links: group.items.map(({ label, href }) => ({ label, href })) }));
export const realEstateNavigationItems = REAL_ESTATE_NAVIGATION.flatMap((group) => group.items);
