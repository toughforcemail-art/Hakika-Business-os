import type { RealEstateAccessLevel } from "../types";

export const REAL_ESTATE_PERMISSIONS = {
  dashboardRead: "real_estate.dashboard.read",
  propertiesRead: "real_estate.properties.read",
  propertiesCreate: "real_estate.properties.create",
  propertiesUpdate: "real_estate.properties.update",
  propertiesArchive: "real_estate.properties.archive",
  unitsRead: "real_estate.units.read",
  unitsArchive: "real_estate.units.archive",
  unitAssetsRead: "real_estate.unit_assets.read",
  unitAssetsCreate: "real_estate.unit_assets.create",
  unitAssetsUpdate: "real_estate.unit_assets.update",
  unitAssetsArchive: "real_estate.unit_assets.archive",
  unitsCreate: "real_estate.units.create",
  unitsUpdate: "real_estate.units.update",
  tenantsRead: "real_estate.tenants.read",
  tenantsCreate: "real_estate.tenants.create",
  leasesRead: "real_estate.leases.read",
  leasesApprove: "real_estate.leases.approve",
  invoicesRead: "real_estate.invoices.read",
  invoicesCreate: "real_estate.invoices.create",
  invoicesIssue: "real_estate.invoices.issue",
  billingProductsRead: "real_estate.billing_products.read",
  billingProductsManage: "real_estate.billing_products.manage",
  paymentsRead: "real_estate.payments.read",
  paymentsCreate: "real_estate.payments.record",
  paymentsAllocate: "real_estate.payments.allocate",
  paymentsReconcile: "real_estate.payments.reconcile",
  reportsExport: "real_estate.reports.export",
  settingsManage: "real_estate.settings.manage",
} as const satisfies Record<string, string>;

export type RealEstatePermission = typeof REAL_ESTATE_PERMISSIONS[keyof typeof REAL_ESTATE_PERMISSIONS];
export const REAL_ESTATE_ACCESS_LEVELS: Readonly<Record<RealEstateAccessLevel, string>> = {
  hidden: "Not shown in navigation",
  read: "View records without mutation access",
  create: "Create records after server authorization",
  update: "Update records after server authorization",
  approve: "Approve workflow transitions after server authorization",
  archive: "Archive records after server authorization",
  export: "Export scoped records after server authorization",
  manage: "Manage configuration after server authorization",
};
