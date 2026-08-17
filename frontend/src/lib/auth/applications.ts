import "server-only";

import { hasPlatformSuperAdminAccess, requireAuthenticatedUser, requireHakikaLoginVerification } from "@/lib/auth/server";
import { requireHakikaStepUp } from "@/lib/auth/hakika-step-up";
import { redirect } from "next/navigation";

export type ApplicationKey = "REAL_ESTATE" | "HR" | "FINANCE" | "TOUGHFORCE" | "PLATFORM_ADMIN" | "CUSTOMER_ADMIN";
export type AccessibleApplication = { key: ApplicationKey; name: string; description: string; logo: string | null; logoAlt: string; href: string; status: "active" | "trial"; trialEndsAt: string | null };
export type WorkspaceContext = { organizationId: string; organizationName: string; companyId: string | null; companyName: string | null };

const catalog: Record<ApplicationKey, Omit<AccessibleApplication, "status" | "trialEndsAt">> = {
  REAL_ESTATE: { key: "REAL_ESTATE", name: "Real Estate", description: "Property, tenancy, billing and collections.", logo: "/brands/real-estate/logo.jpg", logoAlt: "Real Estate logo", href: "/app/real-estate/dashboard" },
  HR: { key: "HR", name: "HR", description: "People, attendance, leave and payroll.", logo: "/brands/hr/logo.jpg", logoAlt: "Hakika HR logo", href: "/app/hr/dashboard" },
  FINANCE: { key: "FINANCE", name: "Finance", description: "Ledgers, cash, invoices and reporting.", logo: null, logoAlt: "Finance logo is not yet supplied", href: "/app/finance/dashboard" },
  TOUGHFORCE: { key: "TOUGHFORCE", name: "ToughForce", description: "Guards, sites, rosters and incident operations.", logo: "/brands/toughforce/logo.jpg", logoAlt: "ToughForce logo", href: "/app/toughforce/dashboard" },
  PLATFORM_ADMIN: { key: "PLATFORM_ADMIN", name: "Platform Admin", description: "Organizations, subscriptions and platform operations.", logo: null, logoAlt: "Platform Admin logo", href: "/platform/dashboard" },
  CUSTOMER_ADMIN: { key: "CUSTOMER_ADMIN", name: "Customer Admin", description: "People, companies, permissions and workspace settings.", logo: null, logoAlt: "Customer Admin logo", href: "/admin/dashboard" },
};

function isEntitled(status: string, trialEndsAt: string | null) {
  if (status === "active" || status === "grace") return true;
  return status === "trial" && (!trialEndsAt || new Date(trialEndsAt).getTime() > Date.now());
}

/** Canonical server-side access source for the launcher and app switcher. */
export async function getAccessibleApplications(selectedOrganizationId?: string, selectedCompanyId?: string): Promise<{ context: WorkspaceContext; applications: AccessibleApplication[] }> {
  const { supabase, context: authContext } = await requireAuthenticatedUser();
  let membershipQuery = supabase.schema("iam").from("organization_memberships").select("id, organization_id, joined_at").eq("user_id", authContext.userId).eq("status", "active");
  if (selectedOrganizationId) membershipQuery = membershipQuery.eq("organization_id", selectedOrganizationId);
  const memberships = await membershipQuery.order("joined_at", { ascending: true });
  if (memberships.error) { console.error("[launcher] membership query failed", memberships.error.code ?? "unknown", memberships.error.message ?? "unknown"); throw new Error("Application access is unavailable"); }
  if (!memberships.data?.length) throw new Error("No active organization membership");
  const membership = memberships.data[0];
  const [organization, allCompanies, companyMemberships, assignments, subscriptions, applications] = await Promise.all([
    supabase.schema("platform").from("organizations").select("id, display_name, status").eq("id", membership.organization_id).eq("status", "active").maybeSingle(),
    supabase.schema("platform").from("companies").select("id, name, is_default, created_at").eq("organization_id", membership.organization_id).eq("status", "active").order("is_default", { ascending: false }).order("created_at", { ascending: true }),
    supabase.schema("iam").from("company_memberships").select("company_id, status").eq("organization_membership_id", membership.id).eq("organization_id", membership.organization_id).eq("status", "active"),
    supabase.schema("iam").from("member_app_roles").select("application_id, company_id, valid_from, valid_until, role_id").eq("organization_id", membership.organization_id).eq("organization_membership_id", membership.id),
    supabase.schema("billing").from("application_subscriptions").select("application_id, status, trial_ends_at").eq("organization_id", membership.organization_id),
    supabase.schema("platform").from("applications").select("id, application_key, status").eq("status", "active"),
  ]);
  const queryError = [organization.error, allCompanies.error, companyMemberships.error, assignments.error, subscriptions.error, applications.error].find(Boolean);
  if (queryError) { console.error("[launcher] access query failed", queryError.code ?? "unknown", queryError.message ?? "unknown"); throw new Error("Application access is unavailable"); }
  if (!organization.data) { console.error("[launcher] active membership organization was not visible"); throw new Error("Application access is unavailable"); }
  const isPlatformSuperAdmin = await hasPlatformSuperAdminAccess();
  const assignedCompanyIds = new Set((companyMemberships.data ?? []).map((row) => row.company_id));
  if (selectedCompanyId && !assignedCompanyIds.has(selectedCompanyId)) throw new Error("Company access denied");
  const company = (allCompanies.data ?? []).find((candidate) => candidate.id === selectedCompanyId) ?? (allCompanies.data ?? []).find((candidate) => assignedCompanyIds.has(candidate.id)) ?? null;
  if (selectedCompanyId && !company) throw new Error("Company access denied");
  const now = Date.now();
  const validAssignments = (assignments.data ?? []).filter((assignment) => (!assignment.valid_from || new Date(assignment.valid_from).getTime() <= now) && (!assignment.valid_until || new Date(assignment.valid_until).getTime() > now) && (!assignment.company_id || assignment.company_id === company?.id));
  const roleIds = [...new Set(validAssignments.map((assignment) => assignment.role_id))];
  const { data: roles, error: rolesError } = roleIds.length ? await supabase.schema("iam").from("roles").select("id, role_key, scope").in("id", roleIds) : { data: [], error: null };
  if (rolesError) throw new Error("Application access is unavailable");
  const hasOrganizationDirectorAccess = Boolean((roles ?? []).some((role) => role.scope === "organization" && /director|admin|owner/i.test(role.role_key)));
  const subscriptionsByApplication = new Map((subscriptions.data ?? []).map((subscription) => [subscription.application_id, subscription]));
  const appsById = new Map((applications.data ?? []).map((application) => [application.id, application]));
  const accessible = isPlatformSuperAdmin
    ? (applications.data ?? []).filter((application) => catalog[application.application_key as ApplicationKey]).map((application) => ({ ...catalog[application.application_key as ApplicationKey], status: "active" as const, trialEndsAt: null }))
    : validAssignments.map((assignment) => ({ assignment, application: appsById.get(assignment.application_id), subscription: subscriptionsByApplication.get(assignment.application_id) })).filter((item) => item.application && (hasOrganizationDirectorAccess || (item.subscription && isEntitled(item.subscription.status, item.subscription.trial_ends_at)))).map((item) => ({ ...catalog[item.application!.application_key as ApplicationKey], status: item.subscription?.status === "trial" ? "trial" as const : "active" as const, trialEndsAt: item.subscription?.trial_ends_at ?? null }));
  const unique = new Map(accessible.map((application) => [application.key, application]));
  return { context: { organizationId: organization.data.id, organizationName: organization.data.display_name, companyId: company?.id ?? null, companyName: company?.name ?? null }, applications: [...unique.values()] };
}

export async function requireCurrentApplication(applicationKey: ApplicationKey) {
  await requireHakikaLoginVerification();
  if (applicationKey === "PLATFORM_ADMIN") {
    try { await requireHakikaStepUp(); } catch { redirect("/auth/sms-verify?next=%2Fplatform%2Fdashboard"); }
  }
  try {
    const result = await getAccessibleApplications();
    if (!result.applications.some((application) => application.key === applicationKey)) redirect("/apps");
    return result;
  } catch { redirect("/apps"); }
}
