import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.2.8";

const PROJECT_REF = "upvupkuokinwqwsfxyxy";
const SMS_URLS = { sandbox: "https://api.sandbox.africastalking.com/version1/messaging", production: "https://api.africastalking.com/version1/messaging" } as const;
type Auth = { token: string; userId: string; sessionId?: string };
const env = (name: string) => Deno.env.get(name)?.trim() ?? "";
const supabaseUrl = () => env("SUPABASE_URL") || `https://${PROJECT_REF}.supabase.co`;
const apiKey = () => env("SUPABASE_PUBLISHABLE_KEY") || env("SUPABASE_ANON_KEY");
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
const fail = (status: number, message: string) => json({ error: message }, status);
const normalizePhone = (value: unknown) => { const compact = String(value ?? "").trim().replace(/[\s()-]/g, ""); const normalized = /^254[17]\d{8}$/.test(compact) ? `+${compact}` : /^0[17]\d{8}$/.test(compact) ? `+254${compact.slice(1)}` : /^[17]\d{8}$/.test(compact) ? `+254${compact}` : compact; return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null; };
const maskPhone = (phone: string) => `${phone.slice(0, 4)}***${phone.slice(-2)}`;
const providerPhone = (value: unknown) => {
  const compact = String(value ?? "").trim().replace(/[\s()-]/g, "");
  if (/^254[17]\d{8}$/.test(compact)) return `+${compact}`;
  if (/^0[17]\d{8}$/.test(compact)) return `+254${compact.slice(1)}`;
  if (/^[17]\d{8}$/.test(compact)) return `+254${compact}`;
  return compact;
};
const jwks = createRemoteJWKSet(new URL(`${supabaseUrl()}/auth/v1/.well-known/jwks.json`));

async function authenticate(request: Request): Promise<Auth> { const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]; if (!token) throw new Error("unauthorized"); let payload; try { ({ payload } = await jwtVerify(token, jwks, { issuer: `${supabaseUrl()}/auth/v1`, audience: "authenticated" })); } catch { throw new Error("unauthorized"); } if (typeof payload.sub !== "string") throw new Error("unauthorized"); return { token, userId: payload.sub, sessionId: typeof payload.session_id === "string" ? payload.session_id : undefined }; }
async function rest(auth: Auth, path: string, options: RequestInit = {}, schema = "public") { const profile = options.method && options.method !== "GET" ? "Content-Profile" : "Accept-Profile"; const response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, { ...options, headers: { apikey: apiKey(), Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json", [profile]: schema, ...options.headers } }); if (!response.ok) throw new Error("authorization lookup failed"); return response.status === 204 ? null : response.json(); }
async function authorize(auth: Auth, organizationId: string, companyId: string | null) { const memberships = await rest(auth, `organization_memberships?user_id=eq.${auth.userId}&organization_id=eq.${encodeURIComponent(organizationId)}&status=eq.active&select=id,organization_id`, {}, "iam") as { id: string; organization_id: string }[]; if (memberships.length !== 1) throw new Error("organization access denied"); if (companyId) { const companies = await rest(auth, `company_memberships?organization_id=eq.${organizationId}&company_id=eq.${encodeURIComponent(companyId)}&status=eq.active&select=id`, {}, "iam") as unknown[]; if (!companies.length) throw new Error("company access denied"); } const permissions = await rest(auth, "permissions?permission_key=eq.communications.sms.send&select=id", {}, "iam") as { id: string }[]; if (!permissions.length) throw new Error("SMS permission is not configured"); const assignments = await rest(auth, `member_app_roles?organization_id=eq.${organizationId}&organization_membership_id=eq.${memberships[0].id}&select=role_id,company_id,valid_from,valid_until`, {}, "iam") as { role_id: string; company_id: string | null; valid_from: string; valid_until: string | null }[]; const now = Date.now(); const roleIds = assignments.filter((row) => (!companyId || row.company_id === null || row.company_id === companyId) && (!row.valid_from || Date.parse(row.valid_from) <= now) && (!row.valid_until || Date.parse(row.valid_until) > now)).map((row) => row.role_id); if (!roleIds.length) throw new Error("SMS permission denied"); const links = await rest(auth, `role_permissions?permission_id=eq.${permissions[0].id}&role_id=in.(${roleIds.join(",")})&select=role_id`, {}, "iam") as unknown[]; if (!links.length) throw new Error("SMS permission denied"); }
async function sendProvider(to: string, message: string) {
  const environment = env("AFRICASTALKING_ENVIRONMENT").toLowerCase() as keyof typeof SMS_URLS;
  const username = env("AFRICASTALKING_USERNAME");
  const providerKey = env("AFRICASTALKING_API_KEY");
  if (!username || !providerKey || !SMS_URLS[environment]) throw new Error("SMS service is not configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(SMS_URLS[environment], {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", apiKey: providerKey },
      body: new URLSearchParams({ username, to, message }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`SMS_PROVIDER_HTTP_${response.status}`);
    const recipients = Array.isArray(payload?.SMSMessageData?.Recipients) ? payload.SMSMessageData.Recipients : [];
    const recipient = recipients.find((item: { number?: unknown }) => providerPhone(item.number) === to);
    const status = String(recipient?.status ?? "").toLowerCase();
    const accepted = String(recipient?.statusCode ?? "") === "100" || ["sent", "queued", "accepted"].includes(status);
    if (!recipient || !accepted) { const code = String(recipient?.statusCode ?? "unknown"); const providerStatus = String(recipient?.status ?? "unknown"); throw new Error(`SMS_PROVIDER_REJECTED_${code}_${providerStatus}`); }
    return recipient;
  } finally {
    clearTimeout(timeout);
  }
}
async function record(auth: Auth, organizationId: string, companyId: string | null, to: string, message: string, status: "sent" | "failed") { try { await rest(auth, "delivery_events", { method: "POST", headers: { "Content-Profile": "communications", Prefer: "return=minimal" }, body: JSON.stringify({ organization_id: organizationId, company_id: companyId, application_key: "SYSTEM", channel: "sms", recipient: to, message_body: message, status, provider: "africas_talking", sent_by: auth.userId, sent_at: status === "sent" ? new Date().toISOString() : null }) }, "communications"); } catch { /* delivery logging must not expose provider details */ } }

export async function handleRequest(request: Request) { if (request.method !== "POST") return fail(405, "Method not allowed"); let auth: Auth; try { auth = await authenticate(request); } catch { return fail(401, "Authentication required"); } const body = await request.json().catch(() => ({})); const organizationId = typeof body.organizationId === "string" ? body.organizationId : ""; const companyId = typeof body.companyId === "string" && body.companyId ? body.companyId : null; const to = normalizePhone(body.to); const message = typeof body.message === "string" ? body.message.trim() : ""; if (!organizationId) return fail(400, "Organization context is required"); if (!to) return fail(400, "Enter a valid phone number"); if (!message || message.length > 320) return fail(400, "Message is required and must be 320 characters or fewer"); try { await authorize(auth, organizationId, companyId); } catch (error) { return fail(403, error instanceof Error ? error.message : "SMS permission denied"); } try { await sendProvider(to, message); await record(auth, organizationId, companyId, to, message, "sent"); console.info(JSON.stringify({ event: "sms.sent", organizationId, userId: auth.userId, recipient: maskPhone(to) })); return json({ ok: true, recipient: maskPhone(to) }); } catch (error) { await record(auth, organizationId, companyId, to, message, "failed"); const detail = error instanceof Error ? error.message : ""; const safeDetail = detail.startsWith("SMS_PROVIDER_REJECTED_") ? `SMS provider rejected the recipient (${detail.replace("SMS_PROVIDER_REJECTED_", "")})` : detail.startsWith("SMS_PROVIDER_HTTP_") ? `SMS provider returned HTTP ${detail.replace("SMS_PROVIDER_HTTP_", "")}` : detail === "SMS service is not configured" ? detail : detail.includes("aborted") ? "SMS delivery timed out" : "SMS delivery failed"; console.error(JSON.stringify({ event: "sms.failed", organizationId, userId: auth.userId, recipient: maskPhone(to), reason: safeDetail })); return fail(safeDetail === "SMS service is not configured" ? 500 : safeDetail === "SMS delivery timed out" ? 504 : 502, safeDetail); } }
Deno.serve(handleRequest);
