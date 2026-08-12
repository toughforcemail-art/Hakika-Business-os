import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { appMfaLoginStatus } from "@/lib/backend/proxy";
import { redirect } from "next/navigation";

export type AssuranceLevel = "aal1" | "aal2";
export type VerifiedRequestContext = { userId: string; sessionId?: string; assuranceLevel: AssuranceLevel; membershipId?: string; organizationId?: string; companyId?: string; applicationKey?: string };

export async function requireAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) throw new Error("Unauthorized");
  return { supabase, claims, context: { userId: claims.sub, sessionId: claims.session_id, assuranceLevel: claims.aal === "aal2" ? "aal2" : "aal1" as AssuranceLevel } };
}

export async function requireHakikaLoginVerification(nextPath = "/apps") {
  try {
    await requireAuthenticatedUser();
    const response = await appMfaLoginStatus();
    if (response.ok && (await response.json() as { verified?: boolean }).verified) return;
  } catch { /* resolve below to the controlled verification route */ }
  redirect(`/auth/verify?next=${encodeURIComponent(nextPath)}`);
}

export async function requireAssuranceLevel(required: AssuranceLevel = "aal2") {
  const result = await requireAuthenticatedUser();
  if (required === "aal2" && result.context.assuranceLevel !== "aal2") throw new Error("MFA required");
  return result;
}

export async function requireOrganizationAccess(organizationId: string) {
  const result = await requireAuthenticatedUser();
  const { data, error } = await result.supabase.schema("iam").from("organization_memberships").select("id, organization_id, status").eq("organization_id", organizationId).eq("user_id", result.context.userId).eq("status", "active").maybeSingle();
  if (error || !data) throw new Error("Organization access denied");
  return { ...result, context: { ...result.context, membershipId: data.id, organizationId } };
}

export async function requireCompanyAccess(organizationId: string, companyId: string) {
  const result = await requireOrganizationAccess(organizationId);
  const { data, error } = await result.supabase.schema("iam").from("company_memberships").select("id").eq("organization_id", organizationId).eq("company_id", companyId).eq("organization_membership_id", result.context.membershipId!).eq("status", "active").maybeSingle();
  if (error || !data) throw new Error("Company access denied");
  return { ...result, context: { ...result.context, companyId } };
}

export async function requireApplicationAccess(organizationId: string, applicationKey: string) {
  const result = await requireOrganizationAccess(organizationId);
  const { data: application, error: applicationError } = await result.supabase.schema("platform").from("applications").select("id").eq("application_key", applicationKey.toUpperCase()).eq("status", "active").maybeSingle();
  if (applicationError || !application) throw new Error("Application access denied");
  const { data: subscription, error: subscriptionError } = await result.supabase.schema("billing").from("application_subscriptions").select("id, status, trial_ends_at").eq("organization_id", organizationId).eq("application_id", application.id).in("status", ["trial", "active", "grace"]).maybeSingle();
  if (subscriptionError || !subscription) throw new Error("Application subscription unavailable");
  if (subscription.status === "trial" && subscription.trial_ends_at && new Date(subscription.trial_ends_at).getTime() <= Date.now()) throw new Error("Application subscription unavailable");
  const now = new Date().toISOString();
  const { data: assignment, error: assignmentError } = await result.supabase.schema("iam").from("member_app_roles").select("id").eq("organization_id", organizationId).eq("organization_membership_id", result.context.membershipId!).eq("application_id", application.id).lte("valid_from", now).or(`valid_until.is.null,valid_until.gt.${now}`).limit(1).maybeSingle();
  if (assignmentError || !assignment) throw new Error("Application role access denied");
  return { ...result, context: { ...result.context, applicationKey: applicationKey.toUpperCase() } };
}
export async function requirePermission(permissionKey: string, organizationId: string, companyId?: string) {
  const result = await requireOrganizationAccess(organizationId);
  const { data: permission, error: permissionError } = await result.supabase.schema("iam").from("permissions").select("id").eq("permission_key", permissionKey).maybeSingle();
  if (permissionError || !permission) throw new Error("Permission denied");
  let query = result.supabase.schema("iam").from("member_app_roles").select("id, role_id, company_id").eq("organization_id", organizationId).eq("organization_membership_id", result.context.membershipId!);
  if (companyId) query = query.or(`company_id.is.null,company_id.eq.${companyId}`);
  const { data: assignments, error: assignmentError } = await query;
  const roleIds = (assignments ?? []).map((row) => row.role_id);
  const { data: links, error: linkError } = roleIds.length ? await result.supabase.schema("iam").from("role_permissions").select("role_id").in("role_id", roleIds).eq("permission_id", permission.id) : { data: [], error: null };
  if (assignmentError || linkError || !links?.length) throw new Error("Permission denied");
  return { ...result, context: { ...result.context, companyId } };
}
export async function requirePlatformOwner() {
  const result = await requireAuthenticatedUser();
  const { data: organizations } = await result.supabase.schema("platform").from("organizations").select("id").eq("organization_type", "platform_owner").neq("status", "archived");
  const organizationIds = (organizations ?? []).map((row) => row.id);
  if (!organizationIds.length) throw new Error("Platform access denied");
  const { data: memberships } = await result.supabase.schema("iam").from("organization_memberships").select("id, organization_id").eq("user_id", result.context.userId).eq("status", "active").in("organization_id", organizationIds);
  if (!memberships?.length) throw new Error("Platform access denied");
  const membershipIds = memberships.map((row) => row.id);
  const { data: app } = await result.supabase.schema("platform").from("applications").select("id").eq("application_key", "PLATFORM_ADMIN").maybeSingle();
  if (!app) throw new Error("Platform access denied");
  const now = new Date().toISOString();
  const { data: assignments } = await result.supabase.schema("iam").from("member_app_roles").select("role_id").in("organization_membership_id", membershipIds).eq("application_id", app.id).lte("valid_from", now).or(`valid_until.is.null,valid_until.gt.${now}`);
  const roleIds = (assignments ?? []).map((row) => row.role_id);
  const { data: roles } = roleIds.length ? await result.supabase.schema("iam").from("roles").select("id").in("id", roleIds).eq("role_key", "platform_admin").eq("scope", "platform") : { data: [] };
  if (!roles?.length) throw new Error("Platform access denied");
  const { data: permission } = await result.supabase.schema("iam").from("permissions").select("id").eq("permission_key", "platform.audit.read").maybeSingle();
  const { data: permissionLinks } = permission ? await result.supabase.schema("iam").from("role_permissions").select("role_id").in("role_id", roles.map((row) => row.id)).eq("permission_id", permission.id) : { data: [] };
  if (!permissionLinks?.length) throw new Error("Platform access denied");
  return result;
}

export async function hasPlatformSuperAdminAccess() {
  try {
    const result = await requireAuthenticatedUser();
    const { data: organizations } = await result.supabase.schema("platform").from("organizations").select("id").eq("organization_type", "platform_owner").eq("status", "active");
    const organizationIds = (organizations ?? []).map((row) => row.id);
    if (!organizationIds.length) return false;
    const { data: memberships } = await result.supabase.schema("iam").from("organization_memberships").select("id").eq("user_id", result.context.userId).eq("status", "active").in("organization_id", organizationIds);
    const membershipIds = (memberships ?? []).map((row) => row.id);
    if (!membershipIds.length) return false;
    const { data: application } = await result.supabase.schema("platform").from("applications").select("id").eq("application_key", "PLATFORM_ADMIN").maybeSingle();
    if (!application) return false;
    const now = new Date().toISOString();
    const { data: assignments } = await result.supabase.schema("iam").from("member_app_roles").select("role_id").in("organization_membership_id", membershipIds).eq("application_id", application.id).lte("valid_from", now).or(`valid_until.is.null,valid_until.gt.${now}`);
    const roleIds = (assignments ?? []).map((row) => row.role_id);
    if (!roleIds.length) return false;
    const { data: roles } = await result.supabase.schema("iam").from("roles").select("id").in("id", roleIds).eq("role_key", "platform_admin").eq("scope", "platform");
    return Boolean(roles?.length);
  } catch {
    return false;
  }
}
