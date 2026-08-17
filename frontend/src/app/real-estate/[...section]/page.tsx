import { redirect } from "next/navigation";
import { RealEstateWorkspace, type RealEstatePageDefinition } from "@/components/RealEstateWorkspace";
import { requireCurrentApplication } from "@/lib/auth/applications";
import { hasPlatformSuperAdminAccess, requirePermission } from "@/lib/auth/server";

const readProperty = "real_estate.properties.read";
const readUnits = "real_estate.units.read";
const readTenants = "real_estate.tenants.read";
const readLeases = "real_estate.leases.read";
const readBilling = "real_estate.billing.read";
const readInvoices = "real_estate.invoices.read";
const readPayments = "real_estate.payments.read";
const readMpesa = "real_estate.mpesa.read";

const definitions: Record<string, RealEstatePageDefinition> = {
  properties: { title: "Properties", section: "Overview", description: "Manage the property portfolio visible to your company.", permission: readProperty, emptyTitle: "No properties yet", columns: ["Property", "Code", "Status"] },
  units: { title: "Houses and units", section: "Overview", description: "Track units using the same property and tenant scope as dashboard totals.", permission: readUnits, emptyTitle: "No units yet", columns: ["Unit", "Property", "Status"] },
  inspections: { title: "Inspections", section: "Overview", description: "Record property inspections and follow-up actions.", permission: readProperty, emptyTitle: "No inspections yet", columns: ["Property", "Inspection date", "Status"] },
  maintenance: { title: "Maintenance", section: "Overview", description: "Track maintenance requests and follow-up work across the portfolio.", permission: readProperty, emptyTitle: "No maintenance requests yet", columns: ["Request", "Property", "Status"] },
  "communication/maintenance": { title: "Maintenance communications", section: "Overview", description: "Prepare maintenance updates for tenants, caretakers, and property teams.", permission: readProperty, emptyTitle: "No maintenance communications yet", columns: ["Request", "Recipient", "Status"] },
  ledger: { title: "Global ledger", section: "Overview", description: "Review scoped operational entries across the portfolio.", permission: readBilling, emptyTitle: "No ledger entries yet", columns: ["Date", "Description", "Amount"] },
  notes: { title: "Notes and findings", section: "Overview", description: "Keep operational notes attached to the right property context.", permission: readProperty, emptyTitle: "No notes yet", columns: ["Subject", "Property", "Updated"] },
  tenants: { title: "Tenant directory", section: "Tenants", description: "View tenants belonging to the selected company scope.", permission: readTenants, emptyTitle: "No tenants yet", columns: ["Tenant", "Unit", "Status"] },
  applications: { title: "Tenant applications", section: "Tenants", description: "Review prospective tenant applications before lease creation.", permission: readTenants, emptyTitle: "No applications yet", columns: ["Applicant", "Property", "Status"] },
  "tenant-details": { title: "Tenant details", section: "Tenants", description: "Open a tenant record from the scoped directory.", permission: readTenants, emptyTitle: "Select a tenant", columns: ["Tenant", "Contact", "Lease"] },
  leases: { title: "Lease management", section: "Tenants", description: "Manage leases within the selected organization and company.", permission: readLeases, emptyTitle: "No leases yet", columns: ["Tenant", "Unit", "Term"] },
  "move-in": { title: "Move-in", section: "Tenants", description: "Prepare scoped move-in records and handover details.", permission: readLeases, emptyTitle: "No move-ins yet", columns: ["Tenant", "Unit", "Date"] },
  "move-out": { title: "Move-out", section: "Tenants", description: "Track scoped move-out and closeout workflows.", permission: readLeases, emptyTitle: "No move-outs yet", columns: ["Tenant", "Unit", "Date"] },
  deposits: { title: "Deposits", section: "Tenants", description: "Review deposits associated with visible leases.", permission: readPayments, emptyTitle: "No deposits yet", columns: ["Tenant", "Lease", "Amount"] },
  invoices: { title: "Invoices", section: "Invoices and billing", description: "Review invoices generated for visible leases and charges.", permission: readInvoices, emptyTitle: "No invoices yet", columns: ["Invoice", "Tenant", "Balance"] },
  invoice: { title: "Invoice overview", section: "Invoices and billing", description: "Review billing activity and invoice readiness for the selected company.", permission: readInvoices, emptyTitle: "No invoice data yet", columns: ["Period", "Issued", "Outstanding"] },
  "invoice/list": { title: "Invoice list", section: "Invoices and billing", description: "Review invoices generated for scoped leases and charges.", permission: readInvoices, emptyTitle: "No invoices yet", columns: ["Invoice", "Tenant", "Balance"] },
  "invoice/add-item": { title: "Add invoice item", section: "Invoices and billing", description: "Prepare a manual invoice item for the selected company.", permission: readInvoices, emptyTitle: "No invoice item draft", columns: ["Item", "Tenant", "Amount"] },
  "invoice/auto-billing": { title: "Billing automation", section: "Invoices and billing", description: "Review recurring invoice automation readiness for scoped leases.", permission: readBilling, emptyTitle: "No automation runs yet", columns: ["Period", "Schedule", "Status"] },
  "invoice/auto-billing/property": { title: "Property billing automation", section: "Invoices and billing", description: "Review property-level billing automation settings.", permission: readBilling, emptyTitle: "No property automation yet", columns: ["Property", "Schedule", "Status"] },
  "invoice/types": { title: "Invoice types", section: "Invoices and billing", description: "Review invoice type configuration for this workspace.", permission: readInvoices, emptyTitle: "No invoice types configured", columns: ["Type", "Prefix", "Status"] },
  "invoice/deleted": { title: "Deleted invoices", section: "Invoices and billing", description: "Review archived invoice records available for recovery workflows.", permission: readInvoices, emptyTitle: "No deleted invoices", columns: ["Invoice", "Deleted", "Status"] },
  "recurring-billing": { title: "Recurring billing", section: "Invoices and billing", description: "Review recurring billing runs and their idempotent status.", permission: readBilling, emptyTitle: "No recurring billing runs yet", columns: ["Billing month", "Run", "Status"] },
  "billing-schedules": { title: "Billing schedules", section: "Invoices and billing", description: "Configure and review recurring billing schedules.", permission: readBilling, emptyTitle: "No billing schedules yet", columns: ["Schedule", "Frequency", "Status"] },
  "rent-charges": { title: "Rent charges", section: "Invoices and billing", description: "Review rent charges tied to visible leases.", permission: readInvoices, emptyTitle: "No rent charges yet", columns: ["Lease", "Period", "Amount"] },
  utilities: { title: "Utilities", section: "Invoices and billing", description: "Review utility charges within the same lease scope.", permission: readInvoices, emptyTitle: "No utility charges yet", columns: ["Unit", "Period", "Amount"] },
  "bill-water/add-bill": { title: "Add water bill", section: "Invoices and billing", description: "Prepare a water bill for scoped units before connected billing is enabled.", permission: readInvoices, emptyTitle: "No water bill draft", columns: ["Unit", "Period", "Amount"] },
  "bill-water/billing-summary": { title: "Water billing summary", section: "Invoices and billing", description: "Review water billing totals for the selected company.", permission: readInvoices, emptyTitle: "No water billing data yet", columns: ["Period", "Units", "Amount"] },
  "bill-power/meter-recordings": { title: "Meter readings", section: "Invoices and billing", description: "Review power meter readings for scoped units.", permission: readInvoices, emptyTitle: "No meter readings yet", columns: ["Meter", "Reading date", "Value"] },
  "bill-power/postpaid-meters": { title: "Postpaid meters", section: "Invoices and billing", description: "Review postpaid meter configuration for scoped units.", permission: readInvoices, emptyTitle: "No postpaid meters yet", columns: ["Unit", "Meter", "Status"] },
  "bill-power/configure-houses": { title: "Configure houses", section: "Invoices and billing", description: "Prepare utility configuration for houses and units.", permission: readInvoices, emptyTitle: "No house utility configuration", columns: ["Unit", "Utility", "Status"] },
  penalties: { title: "Penalties", section: "Invoices and billing", description: "Review penalties applied to visible billing records.", permission: readInvoices, emptyTitle: "No penalties yet", columns: ["Tenant", "Reason", "Amount"] },
  "credit-notes": { title: "Credit notes", section: "Invoices and billing", description: "Review credit notes issued against visible invoices.", permission: readInvoices, emptyTitle: "No credit notes yet", columns: ["Credit note", "Invoice", "Amount"] },
  receipts: { title: "Receipts", section: "Invoices and billing", description: "Review receipts created for visible payments.", permission: readPayments, emptyTitle: "No receipts yet", columns: ["Receipt", "Payer", "Amount"] },
  statements: { title: "Statements", section: "Invoices and billing", description: "Prepare tenant and landlord statements from scoped records.", permission: readInvoices, emptyTitle: "No statement data yet", columns: ["Statement", "Period", "Balance"] },
  payments: { title: "Payment directory", section: "Payments", description: "Review payments visible to the selected company.", permission: readPayments, emptyTitle: "No payments yet", columns: ["Payment", "Payer", "Amount"] },
  "payment-allocation": { title: "Payment allocation", section: "Payments", description: "Review how visible payments are allocated to invoices.", permission: readPayments, emptyTitle: "No allocations yet", columns: ["Payment", "Invoice", "Allocated"] },
  reconciliation: { title: "Reconciliation", section: "Payments", description: "Reconcile visible payments against billing records.", permission: readPayments, emptyTitle: "Nothing to reconcile", columns: ["Payment", "Expected", "Difference"] },
  mpesa: { title: "Safaricom / M-Pesa account", section: "Payments", description: "Review the configured M-Pesa account for this company.", permission: readMpesa, emptyTitle: "No M-Pesa account configured", columns: ["Account", "Short code", "Status"] },
  "mpesa-transactions": { title: "M-Pesa transactions", section: "Payments", description: "Review callback-backed M-Pesa transactions in scope.", permission: readMpesa, emptyTitle: "No M-Pesa transactions yet", columns: ["Transaction", "Phone", "Amount"] },
  "unmatched-payments": { title: "Unmatched payments", section: "Payments", description: "Find visible payments that need allocation.", permission: readPayments, emptyTitle: "No unmatched payments", columns: ["Payment", "Received", "Amount"] },
  "split-payments": { title: "Split payments", section: "Payments", description: "Review balanced split allocations for visible payments.", permission: readPayments, emptyTitle: "No split payments yet", columns: ["Payment", "Parts", "Status"] },
  "reversals-refunds": { title: "Reversals and refunds", section: "Payments", description: "Review reversals and refunds in the current scope.", permission: readPayments, emptyTitle: "No reversals or refunds", columns: ["Reference", "Reason", "Status"] },
  collections: { title: "Collections", section: "Finance and reporting", description: "Review collection performance from scoped payments and invoices.", permission: readPayments, emptyTitle: "No collection data yet", columns: ["Period", "Collected", "Outstanding"] },
  arrears: { title: "Arrears", section: "Finance and reporting", description: "Review outstanding balances for visible leases.", permission: readInvoices, emptyTitle: "No arrears yet", columns: ["Tenant", "Invoice", "Balance"] },
  "landlord-statements": { title: "Landlord statements", section: "Finance and reporting", description: "Prepare statements from visible property and payment data.", permission: readProperty, emptyTitle: "No landlord statement data yet", columns: ["Landlord", "Period", "Net"] },
  "property-performance": { title: "Property performance", section: "Finance and reporting", description: "Review occupancy and collections by visible property.", permission: readProperty, emptyTitle: "No property performance data yet", columns: ["Property", "Occupancy", "Collections"] },
  occupancy: { title: "Occupancy", section: "Finance and reporting", description: "Compare visible units and occupancy using one tenant scope.", permission: readUnits, emptyTitle: "No occupancy data yet", columns: ["Property", "Occupied", "Vacant"] },
  "income-expenses": { title: "Income and expenses", section: "Finance and reporting", description: "Review income and expenses for the selected company.", permission: readBilling, emptyTitle: "No income or expense data yet", columns: ["Category", "Period", "Amount"] },
  exports: { title: "Exports", section: "Finance and reporting", description: "Prepare scoped exports after records exist.", permission: readBilling, emptyTitle: "No export data yet", columns: ["Export", "Scope", "Status"] },
  "reports/statement-of-rent": { title: "Statement of rent", section: "Finance and reporting", description: "Prepare a rent statement from scoped invoices and payments.", permission: readInvoices, emptyTitle: "No rent statement data yet", columns: ["Tenant", "Period", "Balance"] },
  "reports/tenant-ledger": { title: "Tenant ledger report", section: "Finance and reporting", description: "Review tenant ledger activity for the selected company.", permission: readInvoices, emptyTitle: "No tenant ledger data yet", columns: ["Tenant", "Period", "Balance"] },
  "reports/payment-reference": { title: "Payment reference report", section: "Finance and reporting", description: "Review payment references for scoped transactions.", permission: readPayments, emptyTitle: "No payment references yet", columns: ["Reference", "Date", "Amount"] },
  "reports/water-consumption": { title: "Water consumption report", section: "Finance and reporting", description: "Review water consumption once meter readings are connected.", permission: readInvoices, emptyTitle: "No consumption data yet", columns: ["Unit", "Period", "Usage"] },
  "reports/arrears": { title: "Arrears report", section: "Finance and reporting", description: "Review outstanding balances by tenant and lease.", permission: readInvoices, emptyTitle: "No arrears data yet", columns: ["Tenant", "Invoice", "Balance"] },
  "reports/expenses": { title: "Expense report", section: "Finance and reporting", description: "Review property expenses for the selected company.", permission: readBilling, emptyTitle: "No expense data yet", columns: ["Category", "Period", "Amount"] },
  yield: { title: "Financial yield", section: "Finance and reporting", description: "Review yield metrics when income and expense records are available.", permission: readBilling, emptyTitle: "No yield data yet", columns: ["Property", "Period", "Yield"] },
  users: { title: "Real Estate users", section: "Administration", description: "Review users with access to this Real Estate workspace.", permission: "admin.members.read", emptyTitle: "No users to display", columns: ["User", "Company", "Status"] },
  "roles-permissions": { title: "Roles and permissions", section: "Administration", description: "Review access assignments for this organization.", permission: "admin.roles.read", emptyTitle: "No role assignments to display", columns: ["Role", "Application", "Scope"] },
  "company-settings": { title: "Company settings", section: "Administration", description: "Review company configuration for the selected context.", permission: "admin.roles.read", emptyTitle: "Company settings are ready", columns: ["Setting", "Value", "Updated"] },
  "property-settings": { title: "Property settings", section: "Administration", description: "Review property defaults for this workspace.", permission: readProperty, emptyTitle: "No property settings configured", columns: ["Setting", "Value", "Updated"] },
  "invoice-settings": { title: "Invoice settings", section: "Administration", description: "Review invoice configuration for this company.", permission: readInvoices, emptyTitle: "No invoice settings configured", columns: ["Setting", "Value", "Updated"] },
  "payment-settings": { title: "Payment settings", section: "Administration", description: "Review payment and reconciliation configuration.", permission: readPayments, emptyTitle: "No payment settings configured", columns: ["Setting", "Value", "Updated"] },
  "notification-templates": { title: "Notification templates", section: "Administration", description: "Review communication templates available to this workspace.", permission: "admin.roles.read", emptyTitle: "No notification templates configured", columns: ["Template", "Channel", "Status"] },
  "audit-activity": { title: "Audit activity", section: "Administration", description: "Review audit activity permitted for this organization.", permission: "admin.audit.read", emptyTitle: "No audit activity yet", columns: ["Action", "Actor", "Time"] },
};

export default async function RealEstateSection({ params }: { params: Promise<{ section: string[] }> }) {
  const { section } = await params;
  const routeKey = section.join("/");
  const definition = definitions[routeKey] ?? {
    title: routeKey.split("/").at(-1)?.replaceAll("-", " ") ?? "Real Estate",
    section: "Real Estate",
    description: "This protected Real Estate workflow is ready for connected tenant-scoped data.",
    permission: routeKey.startsWith("payments") ? readPayments : routeKey.startsWith("invoices") ? readInvoices : routeKey.startsWith("leases") ? readLeases : routeKey.startsWith("tenants") ? readTenants : readProperty,
    emptyTitle: "No records yet",
    columns: ["Reference", "Status", "Updated"],
  } satisfies RealEstatePageDefinition;
  const access = await requireCurrentApplication("REAL_ESTATE");
  if (!(await hasPlatformSuperAdminAccess())) {
    try { await requirePermission(definition.permission, access.context.organizationId, access.context.companyId ?? undefined); } catch { redirect("/real-estate/dashboard"); }
  }
  return <RealEstateWorkspace definition={{ ...definition, routeKey }} />;
}
