import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.2.8";

const projectRef = "upvupkuokinwqwsfxyxy";
const supabaseUrl = () => Deno.env.get("SUPABASE_URL") || `https://${projectRef}.supabase.co`;
const env = (name: string) => Deno.env.get(name)?.trim() || "";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const jwks = createRemoteJWKSet(new URL(`${supabaseUrl()}/auth/v1/.well-known/jwks.json`));
const normalizePhone = (value: string) => { const compact = value.trim().replace(/[\s()-]/g, ""); if (/^0[17]\d{8}$/.test(compact)) return `+254${compact.slice(1)}`; if (/^254[17]\d{8}$/.test(compact)) return `+${compact}`; if (/^[17]\d{8}$/.test(compact)) return `+254${compact}`; return compact; };

async function callerId(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new Error("unauthorized");
  const { payload } = await jwtVerify(token, jwks, { issuer: `${supabaseUrl()}/auth/v1`, audience: "authenticated" });
  if (typeof payload.sub !== "string") throw new Error("unauthorized");
  return { token, userId: payload.sub };
}

async function scopedRest(token: string, path: string, options: RequestInit = {}, schema = "iam") {
  const key = env("SUPABASE_PUBLISHABLE_KEY") || env("SUPABASE_ANON_KEY");
  if (!key) throw new Error("service configuration");
  const response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, { ...options, headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Accept-Profile": schema, "Content-Profile": schema, ...options.headers } });
  if (!response.ok) throw new Error(`database_${response.status}`);
  return response.status === 204 ? null : response.json();
}

async function sendEmail(to: string, inviteUrl: string, organizationName: string) {
  const key = env("RESEND_API_KEY");
  const from = env("AUTH_EMAIL_FROM") || env("RESEND_FROM");
  if (!key || !from) throw new Error("email configuration");
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [to], subject: `You are invited to ${organizationName} on Hakika Business OS`, text: `You have been invited to join ${organizationName} on Hakika Business OS. Set up your account here: ${inviteUrl}\n\nThis invitation expires in 48 hours. Do not forward this link.`, html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#152238"><p style="color:#087466;font-weight:700">HAKIKA BUSINESS OS</p><h1>You have been invited</h1><p>You have been invited to join <strong>${organizationName}</strong>.</p><p><a href="${inviteUrl}" style="display:inline-block;background:#2f63dc;color:white;padding:13px 18px;border-radius:8px;text-decoration:none;font-weight:700">Accept invitation</a></p><p>This secure link expires in 48 hours. You will create your own password; Hakika never sends passwords by email.</p></div>` }), signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`email_provider_${response.status}`);
}

async function sendSms(to: string, inviteUrl: string, organizationName: string) {
  const username = env("AFRICASTALKING_USERNAME");
  const apiKey = env("AFRICASTALKING_API_KEY");
  const environment = env("AFRICASTALKING_ENVIRONMENT").toLowerCase();
  const endpoint = environment === "sandbox" ? "https://api.sandbox.africastalking.com/version1/messaging" : environment === "production" ? "https://api.africastalking.com/version1/messaging" : "";
  if (!username || !apiKey || !endpoint) throw new Error("sms configuration");
  const normalizedTo = normalizePhone(to);
  const response = await fetch(endpoint, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", apiKey }, body: new URLSearchParams({ username, to: normalizedTo, message: `Hakika: You are invited to ${organizationName}. Set up your account: ${inviteUrl} Link expires in 48 hours.` }), signal: AbortSignal.timeout(8000) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`sms_provider_http_${response.status}`);
  const recipients = Array.isArray(payload?.SMSMessageData?.Recipients) ? payload.SMSMessageData.Recipients : [];
  const recipient = recipients.find((item: { number?: string }) => normalizePhone(String(item.number ?? "")) === normalizedTo) ?? (recipients.length === 1 ? recipients[0] : null);
  const accepted = String(recipient?.statusCode) === "100" || ["sent", "queued", "accepted"].includes(String(recipient?.status).toLowerCase());
  if (!recipient || !accepted) throw new Error(`sms_provider_rejected_${String(recipient?.statusCode ?? "unknown")}_${String(recipient?.status ?? "unknown")}`);
}

export async function handleRequest(request: Request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let caller: { token: string; userId: string };
  try { caller = await callerId(request); } catch { return json({ error: "Authentication required" }, 401); }
  const body = await request.json().catch(() => ({}));
  const invitationId = typeof body.invitationId === "string" ? body.invitationId : "";
  const inviteUrl = typeof body.inviteUrl === "string" ? body.inviteUrl : "";
  if (!invitationId || !inviteUrl) return json({ error: "Invitation details are required" }, 400);
  try {
    const rows = await scopedRest(caller.token, `invitations?id=eq.${encodeURIComponent(invitationId)}&select=id,organization_id,invited_by,email,phone,status,expires_at`, {}, "iam") as { id: string; organization_id: string; invited_by: string; email: string | null; phone: string | null; status: string; expires_at: string }[];
    const invitation = rows[0];
    if (!invitation || invitation.status !== "pending" || new Date(invitation.expires_at).getTime() <= Date.now()) return json({ error: "Invitation is no longer deliverable" }, 400);
    const organizations = await scopedRest(caller.token, `organizations?id=eq.${encodeURIComponent(invitation.organization_id)}&select=display_name`, {}, "platform") as { display_name: string }[];
    const organizationName = organizations[0]?.display_name || "your organization";
    const results: Record<string, string> = {};
    const details: Record<string, string> = {};
    if (invitation.email) { try { await sendEmail(invitation.email, inviteUrl, organizationName); results.email = "sent"; } catch (error) { results.email = "failed"; details.email = error instanceof Error ? error.message : "email_delivery_failed"; } }
    if (invitation.phone) { try { await sendSms(invitation.phone, inviteUrl, organizationName); results.sms = "sent"; } catch (error) { results.sms = "failed"; details.sms = error instanceof Error ? error.message : "sms_delivery_failed"; } }
    const delivered = Object.values(results).some((value) => value === "sent");
    await scopedRest(caller.token, `invitations?id=eq.${encodeURIComponent(invitationId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ delivery_status: delivered ? "sent" : "failed", sent_at: delivered ? new Date().toISOString() : null }) }, "iam");
    return json({ ok: delivered, results, details }, delivered ? 200 : 502);
  } catch (error) { console.error("send-invitation failed", error); return json({ error: "Invitation delivery failed" }, 502); }
}

Deno.serve(handleRequest);
