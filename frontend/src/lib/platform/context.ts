import "server-only";

import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAuthenticatedUser, hasPlatformSuperAdminAccess } from "@/lib/auth/server";
import type { ApplicationKey } from "@/lib/auth/applications";

export type CompanyScopeMode = "organization_only" | "optional" | "required";
export type PlatformContext = {
  userId: string;
  organizationId: string;
  applicationId: string;
  applicationKey: ApplicationKey;
  companyId: string | null;
  organizationRoleIds: readonly string[];
  applicationRoleIds: readonly string[];
  permissions: ReadonlySet<string>;
  isPlatformSuperAdmin: boolean;
  isOrganizationAdmin: boolean;
  accessMode: "read_only" | "standard" | "custom" | "administrator";
  companyScopeMode: CompanyScopeMode;
  supabase: SupabaseClient;
  membershipId: string;
};

export type ContextErrorCode = "UNAUTHORIZED" | "ORGANIZATION_SELECTION_REQUIRED" | "ORGANIZATION_ACCESS_DENIED" | "APPLICATION_ACCESS_DENIED" | "COMPANY_SELECTION_REQUIRED" | "COMPANY_ACCESS_DENIED" | "PERMISSION_DENIED";

export class PlatformContextError extends Error {
  constructor(public readonly code: ContextErrorCode, message: string) { super(message); this.name = "PlatformContextError"; }
}

const ORG_COOKIE = "hakika-context-organization";
const COMPANY_COOKIE = "hakika-context-company";

async function readSelection(name: string) {
  try { return (await cookies()).get(name)?.value ?? null; } catch { return null; }
}

export async function persistPlatformSelection(organizationId: string, companyId: string | null) {
  const jar = await cookies();
  const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 };
  jar.set(ORG_COOKIE, organizationId, options);
  if (companyId) jar.set(COMPANY_COOKIE, companyId, options);
  else jar.delete(COMPANY_COOKIE);
}

function accessMode(permissions: ReadonlySet<string>, isOrganizationAdmin: boolean): PlatformContext["accessMode"] {
  if (isOrganizationAdmin) return "administrator";
  if ([...permissions].some((key) => /\.(create|update|delete|manage|approve|archive)$/.test(key))) return "standard";
  if (permissions.size) return "custom";
  return "read_only";
}

export async function getPlatformContext(options: { applicationKey: ApplicationKey; selectedOrganizationId?: string; selectedCompanyId?: string | null; companyScopeMode?: CompanyScopeMode } ): Promise<PlatformContext> {
  const auth = await requireAuthenticatedUser();
  const { supabase, context: authContext } = auth;
  const isPlatformSuperAdmin = await hasPlatformSuperAdminAccess(auth);
  const [membershipsResult, applicationsResult] = await Promise.all([
    supabase.schema("iam").from("organization_memberships").select("id, organization_id, joined_at").eq("user_id", authContext.userId).eq("status", "active").order("joined_at", { ascending: true }),
    supabase.schema("platform").from("applications").select("id, application_key, status").eq("application_key", options.applicationKey).eq("status", "active").maybeSingle(),
  ]);
  if (membershipsResult.error || !membershipsResult.data?.length) {
    console.error("[platform.context] membership lookup failed", { userId: authContext.userId, code: membershipsResult.error?.code, message: membershipsResult.error?.message });
    throw new PlatformContextError("ORGANIZATION_ACCESS_DENIED", "No active organization membership is available. If you are a platform operator, apply the platform context visibility migration and sign in again.");
  }
  if (applicationsResult.error || !applicationsResult.data) throw new PlatformContextError("APPLICATION_ACCESS_DENIED", "Application context is unavailable.");
  const storedOrg = await readSelection(ORG_COOKIE);
  const requestedOrg = options.selectedOrganizationId ?? storedOrg;
  const platformOwner = isPlatformSuperAdmin ? (await supabase.schema("platform").from("organizations").select("id").eq("organization_type", "platform_owner").eq("status", "active").maybeSingle()).data?.id : null;
  const membership = membershipsResult.data.find((item) => item.organization_id === requestedOrg) ?? (platformOwner ? membershipsResult.data.find((item) => item.organization_id === platformOwner) : null) ?? (membershipsResult.data.length === 1 ? membershipsResult.data[0] : null);
  if (!membership) throw new PlatformContextError("ORGANIZATION_SELECTION_REQUIRED", "Select an organization to continue.");
  const [organizationResult, companiesResult, companyMembershipsResult, assignmentsResult, subscriptionsResult] = await Promise.all([
    supabase.schema("platform").from("organizations").select("id, display_name, organization_type, company_scope_mode").eq("id", membership.organization_id).eq("status", "active").maybeSingle(),
    supabase.schema("platform").from("companies").select("id, name, status").eq("organization_id", membership.organization_id).eq("status", "active"),
    supabase.schema("iam").from("company_memberships").select("company_id").eq("organization_membership_id", membership.id).eq("organization_id", membership.organization_id).eq("status", "active"),
    supabase.schema("iam").from("member_app_roles").select("role_id, company_id, valid_from, valid_until").eq("organization_membership_id", membership.id).eq("organization_id", membership.organization_id).eq("application_id", applicationsResult.data.id),
    supabase.schema("billing").from("application_subscriptions").select("status, trial_ends_at").eq("organization_id", membership.organization_id).eq("application_id", applicationsResult.data.id).maybeSingle(),
  ]);
  if (organizationResult.error || !organizationResult.data || companiesResult.error || companyMembershipsResult.error || assignmentsResult.error) throw new PlatformContextError("ORGANIZATION_ACCESS_DENIED", "Organization context is unavailable.");
  const roleIds = [...new Set((assignmentsResult.data ?? []).map((row) => row.role_id))];
  const rolesResult = roleIds.length ? await supabase.schema("iam").from("roles").select("id, role_key, scope").in("id", roleIds) : { data: [], error: null };
  if (rolesResult.error) throw new PlatformContextError("APPLICATION_ACCESS_DENIED", "Role access is unavailable.");
  const hasOrganizationDirectorAccess = Boolean((rolesResult.data ?? []).some((role) => role.scope === "organization" && /director|admin|owner/i.test(role.role_key)));
  const subscriptionRequired = options.applicationKey !== "PLATFORM_ADMIN" && options.applicationKey !== "CUSTOMER_ADMIN" && !isPlatformSuperAdmin && !hasOrganizationDirectorAccess;
  if (subscriptionRequired && (!subscriptionsResult.data || !["active", "trial", "grace"].includes(subscriptionsResult.data.status) || (subscriptionsResult.data.status === "trial" && subscriptionsResult.data.trial_ends_at && new Date(subscriptionsResult.data.trial_ends_at).getTime() <= Date.now()))) throw new PlatformContextError("APPLICATION_ACCESS_DENIED", "This application is not active for the organization.");
  const now = Date.now();
  const assignments = (assignmentsResult.data ?? []).filter((row) => (!row.valid_from || new Date(row.valid_from).getTime() <= now) && (!row.valid_until || new Date(row.valid_until).getTime() > now));
  if (!isPlatformSuperAdmin && !assignments.length) throw new PlatformContextError("APPLICATION_ACCESS_DENIED", "You do not have access to this application.");
  const permissionIds = roleIds.length ? await supabase.schema("iam").from("role_permissions").select("permission_id").in("role_id", roleIds) : { data: [], error: null };
  const ids = [...new Set((permissionIds.data ?? []).map((row) => row.permission_id))];
  const permissionsResult = ids.length ? await supabase.schema("iam").from("permissions").select("permission_key").in("id", ids) : { data: [], error: null };
  if (rolesResult.error || permissionIds.error || permissionsResult.error) throw new PlatformContextError("APPLICATION_ACCESS_DENIED", "Role access is unavailable.");
  const permissions = new Set((permissionsResult.data ?? []).map((row) => row.permission_key));
  const isOrganizationAdmin = Boolean(hasOrganizationDirectorAccess || permissions.has("admin.organizations.manage") || permissions.has("admin.members.invite"));
  const mode = (options.companyScopeMode ?? organizationResult.data.company_scope_mode ?? "organization_only") as CompanyScopeMode;
  const assignedCompanyIds = new Set((companyMembershipsResult.data ?? []).map((row) => row.company_id));
  const selectedCompany = options.selectedCompanyId ?? await readSelection(COMPANY_COOKIE);
  const company = selectedCompany ? (companiesResult.data ?? []).find((row) => row.id === selectedCompany && assignedCompanyIds.has(row.id)) : null;
  if (selectedCompany && !company) throw new PlatformContextError("COMPANY_ACCESS_DENIED", "The selected company is not available to you.");
  if (mode === "required" && !company) throw new PlatformContextError("COMPANY_SELECTION_REQUIRED", "Select a company to continue.");
  return { userId: authContext.userId, organizationId: membership.organization_id, applicationId: applicationsResult.data.id, applicationKey: options.applicationKey, companyId: company?.id ?? null, organizationRoleIds: (rolesResult.data ?? []).filter((role) => role.scope === "organization").map((role) => role.id), applicationRoleIds: roleIds, permissions, isPlatformSuperAdmin, isOrganizationAdmin, accessMode: accessMode(permissions, isOrganizationAdmin), companyScopeMode: mode, supabase, membershipId: membership.id };
}

export async function requireApplicationContext(applicationKey: ApplicationKey) { return getPlatformContext({ applicationKey }); }
export async function requirePageAccess(applicationKey: ApplicationKey, permission: string) { const context = await getPlatformContext({ applicationKey }); if (!context.permissions.has(permission) && !context.isPlatformSuperAdmin) throw new PlatformContextError("PERMISSION_DENIED", "You do not have access to this page."); return context; }
export async function requireActionPermission(applicationKey: ApplicationKey, permission: string) { return requirePageAccess(applicationKey, permission); }
export async function requireMutationContext(applicationKey: ApplicationKey, permission: string) { return requireActionPermission(applicationKey, permission); }
