import "server-only";
import { requireApplicationContext } from "@/lib/platform/context";
import type { RealEstateTenantContext } from "../types";

/** @deprecated Compatibility shim for legacy page imports. Resolution is centralized in PlatformContext. */
// requireAuthenticatedUser is enforced by the centralized resolver.
// getAccessibleApplications remains the launcher-facing compatibility source; PlatformContext validates organizationId server-side.
// companyId is optional and is resolved only after server-side membership validation.
export async function getRealEstateTenantContext(): Promise<RealEstateTenantContext> {
  return requireApplicationContext("REAL_ESTATE");
}
