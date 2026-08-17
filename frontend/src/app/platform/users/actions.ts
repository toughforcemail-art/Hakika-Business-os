"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { requireApplicationContext } from "@/lib/platform/context";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
async function applicationOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured && !configured.includes("localhost") && !configured.includes("127.0.0.1")) return configured;
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  if (host) {
    const protocol = requestHeaders.get("x-forwarded-proto") || (process.env.NODE_ENV === "production" ? "https" : "http");
    return `${protocol}://${host}`;
  }
  return configured || "http://localhost:3000";
}
const friendlyWriteError = (error: { code?: string; message?: string } | null, fallback: string) => {
  if (error?.code === "42501" || error?.message?.toLowerCase().includes("row-level security")) return "This invitation could not be saved because your platform access policy is not enabled yet. Apply the latest Supabase migration, then try again.";
  if (error?.code === "23505") return "An active invitation already exists for this recipient. Revoke it or wait for it to expire before sending another.";
  return fallback;
};

async function deliverInvitation(ctx: any, invitationId: string, inviteUrl: string) {
  const { data: sessionResult } = await ctx.supabase.auth.getSession();
  const session = sessionResult.session;
  if (!session) throw new Error("Authentication session unavailable");
  const { url, publishableKey } = getSupabasePublicConfig();
  const response = await fetch(`${url}/functions/v1/send-invitation`, { method: "POST", headers: { apikey: publishableKey, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ invitationId, inviteUrl }), cache: "no-store" });
  const result = await response.json().catch(() => ({})) as { results?: Record<string, string>; error?: string };
  if (!response.ok) { const failedChannels = Object.entries(result.results ?? {}).filter(([, status]) => status === "failed").map(([channel]) => channel).join(" and "); throw new Error(failedChannels ? `${failedChannels} delivery failed.` : (result.error || "Automatic delivery failed.")); }
  return result.results ?? {};
}

export async function inviteOrganizationDirector(_previous: any, form: FormData) {
  const ctx = await requireApplicationContext("PLATFORM_ADMIN");
  if (!ctx.isPlatformSuperAdmin) return { error: "Platform administrator access is required" };
  const organizationId = value(form, "organization_id");
  const email = value(form, "email").toLowerCase() || null;
  const phone = value(form, "phone") || null;
  if (!organizationId || (!email && !phone)) return { error: "Select an organization and provide an email or phone number" };
  const { data: organization } = await ctx.supabase.schema("platform").from("organizations").select("id,display_name").eq("id", organizationId).eq("status", "active").maybeSingle();
  if (!organization) return { error: "Organization not found" };
  const { data: applications, error: applicationsError } = await ctx.supabase.schema("platform").from("applications").select("id,application_key,name").eq("status", "active").neq("application_key", "PLATFORM_ADMIN");
  if (applicationsError || !applications?.length) return { error: "No active applications are available" };
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const { data: invitation, error: invitationError } = await ctx.supabase.schema("iam").from("invitations").insert({ organization_id: organizationId, email, phone, token_hash: tokenHash, expires_at: expiresAt, invited_by: ctx.userId, delivery_channel: email && phone ? "both" : email ? "email" : "sms", delivery_status: "pending" }).select("id,expires_at").single();
  if (invitationError || !invitation) return { error: friendlyWriteError(invitationError, "We could not create the invitation. Check the organization and recipient details, then try again.") };
  const { data: role, error: roleError } = await ctx.supabase.schema("iam").from("roles").select("id").eq("organization_id", organizationId).eq("role_key", "director").maybeSingle();
  let roleId = role?.id;
  if (!roleId) {
    const created = await ctx.supabase.schema("iam").from("roles").insert({ organization_id: organizationId, application_id: null, role_key: "director", name: "Director", scope: "organization", is_system: false, is_read_only: false }).select("id").single();
    if (created.error || !created.data) return { error: friendlyWriteError(created.error, "We could not create the Director role for this organization. Check role-management access, then try again.") };
    roleId = created.data.id;
  }
  const { data: permissions } = await ctx.supabase.schema("iam").from("permissions").select("id,permission_key,application_id");
  const allowedPermissions = (permissions ?? []).filter((permission: any) => !permission.permission_key.startsWith("platform."));
  if (allowedPermissions.length) await ctx.supabase.schema("iam").from("role_permissions").upsert(allowedPermissions.map((permission: any) => ({ role_id: roleId, permission_id: permission.id })), { onConflict: "role_id,permission_id", ignoreDuplicates: true });
  const assignmentRows = applications.map((application: any) => ({ organization_id: organizationId, invitation_id: invitation.id, application_id: application.id, role_id: roleId }));
  const assignments = await ctx.supabase.schema("iam").from("invitation_role_assignments").insert(assignmentRows);
  if (assignments.error) return { error: friendlyWriteError(assignments.error, "The invitation was created, but its application access could not be assigned. Please try again or contact an administrator.") };
  const origin = await applicationOrigin();
  const inviteUrl = `${origin}/accept-invitation?token=${rawToken}`;
  let delivery: Record<string, string> = {};
  let deliveryWarning = "";
  try {
    delivery = await deliverInvitation(ctx, invitation.id, inviteUrl);
  } catch (error) {
    console.error("Invitation delivery failed", error);
    deliveryWarning = "The invitation was created, but automatic delivery could not be completed.";
  }
  return { success: true, organization: organization.display_name, role: "Director", applications: applications.map((app: any) => app.name), inviteUrl, expiresAt: invitation.expires_at, delivery, deliveryWarning };
}

export async function resendOrganizationInvitation(_previous: any, form: FormData) {
  const ctx = await requireApplicationContext("PLATFORM_ADMIN");
  if (!ctx.isPlatformSuperAdmin) return { error: "Platform administrator access is required" };
  const invitationId = value(form, "invitation_id");
  if (!invitationId) return { error: "Invitation could not be identified" };
  const { data: invitation, error: readError } = await ctx.supabase.schema("iam").from("invitations").select("id,organization_id,status").eq("id", invitationId).maybeSingle();
  if (readError || !invitation) return { error: "This invitation could not be found" };
  if (invitation.status === "accepted") return { error: "This invitation has already been accepted" };
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const { error: updateError } = await ctx.supabase.schema("iam").from("invitations").update({ token_hash: tokenHash, expires_at: expiresAt, status: "pending", delivery_status: "pending", sent_at: null, accepted_by: null, accepted_at: null, invited_by: ctx.userId }).eq("id", invitationId);
  if (updateError) return { error: friendlyWriteError(updateError, "The invitation could not be renewed. Try again shortly.") };
  try {
    const origin = await applicationOrigin();
    const inviteUrl = `${origin}/accept-invitation?token=${rawToken}`;
    const delivery = await deliverInvitation(ctx, invitationId, inviteUrl);
    return { success: true, delivery };
  } catch (error) {
    console.error("Invitation resend failed", error);
    return { error: `The invitation was renewed, but ${error instanceof Error ? error.message : "automatic delivery failed"} Copy the new link below or verify the provider configuration.`, inviteUrl: `${await applicationOrigin()}/accept-invitation?token=${rawToken}` };
  }
}
