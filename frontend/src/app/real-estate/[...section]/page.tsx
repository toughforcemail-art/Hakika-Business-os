import { notFound, redirect } from "next/navigation";
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
  "recurring-billing": { title: "Recurring billing", section: "Invoices and billing", description: "Review recurring billing runs and their idempotent status.", permission: readBilling, emptyTitle: "No recurring billing runs yet", columns: ["Billing month", "Run", "Status"] },
  "billing-schedules": { title: "Billing schedules", section: "Invoices and billing", description: "Configure and review recurring billing schedules.", permission: readBilling, emptyTitle: "No billing schedules yet", columns: ["Schedule", "Frequency", "Status"] },
  "rent-charges": { title: "Rent charges", section: "Invoices and billing", description: "Review rent charges tied to visible leases.", permission: readInvoices, emptyTitle: "No rent charges yet", columns: ["Lease", "Period", "Amount"] },
  utilities: { title: "Utilities", section: "Invoices and billing", description: "Review utility charges within the same lease scope.", permission: readInvoices, emptyTitle: "No utility charges yet", columns: ["Unit", "Period", "Amount"] },
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
  const definition = definitions[section.join("/")];
  if (!definition) notFound();
  const access = await requireCurrentApplication("REAL_ESTATE");
  if (!(await hasPlatformSuperAdminAccess())) {
    try { await requirePermission(definition.permission, access.context.organizationId, access.context.companyId ?? undefined); } catch { redirect("/real-estate/dashboard"); }
  }
  return <RealEstateWorkspace definition={definition} />;
}
