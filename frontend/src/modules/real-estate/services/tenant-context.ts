import "server-only";

import { getAccessibleApplications } from "@/lib/auth/applications";
import { hasPlatformSuperAdminAccess, requireAuthenticatedUser } from "@/lib/auth/server";
import type { RealEstateTenantContext } from "../types";

/** Trusted server context for future Real Estate services and actions. Browser-supplied scope IDs are never accepted. */
export async function getRealEstateTenantContext(): Promise<RealEstateTenantContext> {
  const [{ supabase, context: auth }, access, isPlatformSuperAdmin] = await Promise.all([
    requireAuthenticatedUser(),
    getAccessibleApplications(),
    hasPlatformSuperAdminAccess(),
  ]);
  const application = await supabase.schema("platform").from("applications").select("id").eq("application_key", "REAL_ESTATE").eq("status", "active").maybeSingle();
  if (application.error || !application.data) throw new Error("Real Estate application context unavailable");
  return {
    supabase,
    userId: auth.userId,
    organizationId: access.context.organizationId,
    companyId: access.context.companyId,
    applicationId: application.data.id,
    isPlatformSuperAdmin,
    permissions: new Set<string>(),
  };
}
