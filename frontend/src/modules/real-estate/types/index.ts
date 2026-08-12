export type RealEstateAccessLevel = "hidden" | "read" | "create" | "update" | "approve" | "archive" | "export" | "manage";

export type RealEstateNavigationItem = {
  id: string;
  label: string;
  href: string;
  requiredPermission: string;
  requiredApplication: "REAL_ESTATE";
  children?: RealEstateNavigationItem[];
};

export type RealEstateTenantContext = {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
  organizationId: string;
  companyId: string | null;
  applicationId: string;
  isPlatformSuperAdmin: boolean;
  permissions: ReadonlySet<string>;
};

export type RealEstatePageStatus = "Not audited" | "Audited" | "Mapped" | "Scaffolded" | "In progress" | "Implemented" | "Verified" | "Blocked" | "Intentionally removed";

export type RealEstateMigrationRecord = {
  legacyApplication: string;
  legacyRoute: string;
  legacySourceFile: string;
  newRoute: string;
  pageTitle: string;
  purpose: string;
  permissions: string[];
  tenantFields: string[];
  migrationStatus: RealEstatePageStatus;
  evidence: string[];
  openQuestions: string[];
};
