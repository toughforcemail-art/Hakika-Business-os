import type { ApplicationKey } from "@/lib/auth/applications";

export type ApplicationDefinition = {
  key: ApplicationKey;
  name: string;
  href: string;
  companyScopeMode: "organization_only" | "optional" | "required";
};

export const APPLICATION_REGISTRY: Readonly<Record<ApplicationKey, ApplicationDefinition>> = {
  PLATFORM_ADMIN: { key: "PLATFORM_ADMIN", name: "Platform Admin", href: "/platform/dashboard", companyScopeMode: "organization_only" },
  CUSTOMER_ADMIN: { key: "CUSTOMER_ADMIN", name: "Customer Admin", href: "/admin/dashboard", companyScopeMode: "organization_only" },
  REAL_ESTATE: { key: "REAL_ESTATE", name: "Real Estate", href: "/app/real-estate/dashboard", companyScopeMode: "organization_only" },
  HR: { key: "HR", name: "HR", href: "/app/hr/dashboard", companyScopeMode: "optional" },
  FINANCE: { key: "FINANCE", name: "Finance", href: "/app/finance/dashboard", companyScopeMode: "optional" },
  TOUGHFORCE: { key: "TOUGHFORCE", name: "ToughForce", href: "/app/toughforce/dashboard", companyScopeMode: "optional" },
};
