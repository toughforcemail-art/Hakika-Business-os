import { Redis } from "npm:@upstash/redis@1.38.2";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@6.2.8";

const PROJECT_REF = "upvupkuokinwqwsfxyxy";
const CHALLENGE_TTL = 300;
const STEP_UP_TTL = 900;
const MAX_ATTEMPTS = 5;
const MAX_RESENDS = 5;
const COOLDOWN = 30;
const SMS_MESSAGE = (otp: string) =>
  `Your Hakika Business OS verification code is ${otp}. It expires in 5 minutes. Do not share this code with anyone.`;
const CHALLENGE_COOKIE = "hakika_auth_challenge";
const LOGIN_COOKIE = "hakika_login_verified";
const STEP_UP_COOKIE = "hakika_step_up";
const SANDBOX_URL = "https://api.sandbox.africastalking.com/version1/messaging";
const PRODUCTION_URL = "https://api.africastalking.com/version1/messaging";

type Auth = { token: string; userId: string; sessionId?: string; user: { id: string; phone?: string; phone_confirmed_at?: string; email?: string; email_confirmed_at?: string } };
type Channel = "email" | "phone";
type Purpose = "login" | "step_up";
type Challenge = { id: string; userId: string; purpose: Purpose; channel: Channel; otpHash: string; expiresAt: number; attempts: number; resends: number; bindingHash: string; createdAt: number };
type ProviderRecipient = { number?: unknown; status?: unknown; statusCode?: unknown };

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
const safe = (status: number, code: string, message: string, retryAfter?: number): Error & { status: number; code: string; retryAfter?: number } => Object.assign(new Error(message), { status, code, ...(retryAfter ? { retryAfter } : {}) });
const env = (name: string) => Deno.env.get(name)?.trim() ?? "";
const supabaseUrl = () => env("SUPABASE_URL") || `https://${PROJECT_REF}.supabase.co`;
const apiKey = () => env("SUPABASE_PUBLISHABLE_KEY") || env("SUPABASE_ANON_KEY");
const redis = () => new Redis({ url: env("UPSTASH_REDIS_REST_URL"), token: env("UPSTASH_REDIS_REST_TOKEN") });
const prefix = () => `${env("REDIS_KEY_PREFIX") || "hakika"}:production:app_mfa`;
const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const hmac = async (value: string) => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env("HAKIKA_APP_MFA_HMAC_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const redisKey = async (resource: string, identifier: string) => `${prefix()}:${resource}:${(await sha256(identifier)).slice(0, 40)}`;
const parse = <T>(value: unknown): T | null => typeof value === "string" ? JSON.parse(value) as T : value as T | null;
const randomBytes = (length: number) => { const bytes = new Uint8Array(length); crypto.getRandomValues(bytes); return bytes; };
const randomToken = () => { const bytes = randomBytes(32); return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", ""); };
function randomOtp() {
  const limit = Math.floor(0x100000000 / 900000) * 900000;
  const bytes = new Uint8Array(4);
  let value = 0;
  do { crypto.getRandomValues(bytes); value = new DataView(bytes.buffer).getUint32(0); } while (value >= limit);
  return String(100000 + (value % 900000));
}
export function normalizeVerifiedAuthPhone(input: string): string | null {
  const compact = input.trim().replace(/[\s()-]/g, "");
  let normalized = compact;
  if (/^254\d{9}$/.test(normalized)) normalized = `+${normalized}`;
  else if (/^0\d{9}$/.test(normalized)) normalized = `+254${normalized.slice(1)}`;
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) return null;
  return normalized;
}
const maskEmail = (email: string) => { const [name, domain] = email.split("@"); return `${name?.slice(0, 1) ?? ""}***@${domain ?? ""}`; };
const cookie = (name: string, value: string, maxAge: number) => `${name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${env("DENO_DEPLOYMENT_ID") ? "; Secure" : ""}`;
const requestIp = (request: Request) => request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
const requestId = (request: Request) => {
  const incoming = request.headers.get("x-hakika-request-id")?.trim() || "";
  return /^[A-Za-z0-9-]{8,80}$/.test(incoming) ? incoming : crypto.randomUUID();
};
const logStage = (id: string, stage: string, details: Record<string, unknown> = {}) => console.log(JSON.stringify({ requestId: id, stage, ...details }));
const maskPhone = (phone: string) => `${phone.slice(0, 4)}***${phone.slice(-2)}`;
const providerHost = (environment: string) => environment === "production" ? "api.africastalking.com" : "api.sandbox.africastalking.com";
export const normalizeProviderEnvironment = (value: string | undefined) => {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized === "production" || normalized === "sandbox" ? normalized : null;
};
export const providerEndpointForEnvironment = (value: string | undefined) => {
  const normalized = normalizeProviderEnvironment(value);
  return normalized === "production" ? PRODUCTION_URL : normalized === "sandbox" ? SANDBOX_URL : null;
};

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
function jwksFor() { return jwks ??= createRemoteJWKSet(new URL(`${supabaseUrl()}/auth/v1/.well-known/jwks.json`)); }

async function auth(request: Request): Promise<Auth> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw safe(401, "AUTH_REQUIRED", "Authentication is required");
  const url = new URL(supabaseUrl());
  if (url.hostname !== `${PROJECT_REF}.supabase.co`) throw safe(500, "AUTH_USER_LOOKUP_FAILED", "Verification unavailable");
  let payload;
  try { ({ payload } = await jwtVerify(token, jwksFor(), { issuer: `${supabaseUrl()}/auth/v1`, audience: "authenticated" })); } catch { throw safe(401, "AUTH_REQUIRED", "Authentication is required"); }
  if (typeof payload.sub !== "string") throw safe(401, "AUTH_REQUIRED", "Authentication is required");
  const userResponse = await fetch(`${supabaseUrl()}/auth/v1/user`, { headers: { apikey: apiKey(), Authorization: `Bearer ${token}` } });
  if (!userResponse.ok) throw safe(401, "AUTH_USER_LOOKUP_FAILED", "Verification unavailable");
  const user = await userResponse.json();
  if (user.id !== payload.sub) throw safe(401, "AUTH_USER_LOOKUP_FAILED", "Verification unavailable");
  return { token, userId: payload.sub, sessionId: typeof payload.session_id === "string" ? payload.session_id : undefined, user };
}

async function rest(authenticated: Auth, path: string, options: RequestInit = {}, schema = "public") {
  const profileHeader = options.method && options.method !== "GET" ? "Content-Profile" : "Accept-Profile";
  const response = await fetch(`${supabaseUrl()}/rest/v1/${path}`, { ...options, headers: { apikey: apiKey(), Authorization: `Bearer ${authenticated.token}`, "Content-Type": "application/json", [profileHeader]: schema, ...options.headers } });
  if (!response.ok) throw safe(403, "PLATFORM_ACCESS_DENIED", "Platform access denied");
  return response.status === 204 ? null : response.json();
}
async function platformOwner(authenticated: Auth) {
  const organizations = await rest(authenticated, "organizations?organization_type=eq.platform_owner&status=eq.active&select=id", {}, "platform");
  const ids = (organizations as { id: string }[]).map((row) => row.id);
  if (!ids.length) throw safe(403, "PLATFORM_ACCESS_DENIED", "Platform access denied");
  const memberships = await rest(authenticated, `organization_memberships?user_id=eq.${authenticated.userId}&status=eq.active&organization_id=in.(${ids.join(",")})&select=id,organization_id`, {}, "iam");
  if (!(memberships as unknown[]).length) throw safe(403, "PLATFORM_ACCESS_DENIED", "Platform access denied");
  const membershipIds = (memberships as { id: string; organization_id: string }[]).map((row) => row.id);
  const apps = await rest(authenticated, "applications?application_key=eq.PLATFORM_ADMIN&status=eq.active&select=id", {}, "platform");
  if (!(apps as unknown[]).length) throw safe(403, "PLATFORM_ACCESS_DENIED", "Platform access denied");
  const assignments = await rest(authenticated, `member_app_roles?organization_membership_id=in.(${membershipIds.join(",")})&application_id=eq.${(apps as { id: string }[])[0].id}&select=role_id,valid_from,valid_until`, {}, "iam");
  const now = Date.now();
  const roleIds = (assignments as { role_id: string; valid_from: string; valid_until: string | null }[]).filter((row) => (!row.valid_from || Date.parse(row.valid_from) <= now) && (!row.valid_until || Date.parse(row.valid_until) > now)).map((row) => row.role_id);
  if (!roleIds.length) throw safe(403, "PLATFORM_ACCESS_DENIED", "Platform access denied");
  const roles = await rest(authenticated, `roles?id=in.(${roleIds.join(",")})&role_key=eq.platform_admin&scope=eq.platform&select=id`, {}, "iam");
  if (!(roles as unknown[]).length) throw safe(403, "PLATFORM_ACCESS_DENIED", "Platform access denied");
  return { organizationId: (memberships as { organization_id: string }[])[0].organization_id };
}
const binding = (authenticated: Auth, request: Request) => hmac(`${authenticated.userId}:${authenticated.sessionId || "no-session"}:${request.headers.get("user-agent") || "unknown"}`);
const fixedPath = (request: Request) => new URL(request.url).pathname.replace(/^\/functions\/v1\/app-mfa/, "").replace(/^\/app-mfa/, "");
const requestCookie = (request: Request, name: string) => request.headers.get("cookie")?.match(new RegExp(`${name}=([^;]+)`))?.[1];

async function reserveSend(authenticated: Auth, request: Request) {
  let r: Redis;
  try {
    if (!env("UPSTASH_REDIS_REST_URL") || !env("UPSTASH_REDIS_REST_TOKEN")) throw new Error("missing redis configuration");
    r = redis();
  } catch { throw safe(500, "CONFIGURATION_MISSING", "Verification service is not configured"); }
  const userKey = await redisKey("user-hour", authenticated.userId);
  const ipKey = await redisKey("ip-hour", requestIp(request));
  try {
    if (await r.set(await redisKey("cooldown", authenticated.userId), "1", { ex: COOLDOWN, nx: true }) !== "OK") throw safe(429, "RATE_LIMITED", "Verification temporarily limited", COOLDOWN);
    const userCount = await r.incr(userKey); if (userCount === 1) await r.expire(userKey, 3600);
    const ipCount = await r.incr(ipKey); if (ipCount === 1) await r.expire(ipKey, 3600);
    if (userCount > 10 || ipCount > 20) throw safe(429, "RATE_LIMITED", "Verification temporarily limited", 3600);
  } catch (error) {
    if ((error as { code?: string }).code === "RATE_LIMITED") throw error;
    throw safe(503, "REDIS_UNAVAILABLE", "Verification service is temporarily unavailable");
  }
}
async function sendSms(phone: string, otp: string, id: string) {
  const environment = normalizeProviderEnvironment(Deno.env.get("AFRICASTALKING_ENVIRONMENT"));
  const username = env("AFRICASTALKING_USERNAME");
  const apiKeyValue = env("AFRICASTALKING_API_KEY");
  if (!username || !apiKeyValue || !environment) throw safe(500, "SMS_PROVIDER_CONFIGURATION_ERROR", "SMS service is not configured");
  if ((environment === "sandbox" && username !== "sandbox") || (environment === "production" && username.toLowerCase() === "sandbox")) throw safe(500, "SMS_PROVIDER_CONFIGURATION_ERROR", "SMS service is not configured");
  const endpoint = providerEndpointForEnvironment(environment)!;
  logStage(id, "provider_request", { channel: "phone", environment, providerHost: providerHost(environment), recipient: maskPhone(phone) });
  let response: Response;
  try {
    response = await fetch(endpoint, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", apiKey: apiKeyValue }, body: new URLSearchParams({ username, to: phone, message: SMS_MESSAGE(otp) }), signal: AbortSignal.timeout(8000) });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    throw safe(502, name === "TimeoutError" || name === "AbortError" ? "SMS_PROVIDER_TIMEOUT" : "SMS_DELIVERY_FAILED", "SMS delivery failed");
  }
  logStage(id, "provider_response", { environment, providerHost: providerHost(environment), httpStatus: response.status });
  if (response.status === 401 || response.status === 403) throw safe(502, "SMS_PROVIDER_AUTH_FAILED", "SMS delivery failed");
  if (response.status === 402) throw safe(502, "SMS_PROVIDER_BALANCE_ERROR", "SMS delivery failed");
  if (response.status >= 500) throw safe(503, "SMS_PROVIDER_UNAVAILABLE", "SMS delivery failed");
  let payload: { SMSMessageData?: { Recipients?: ProviderRecipient[] } };
  try { payload = await response.json(); } catch { throw safe(502, "SMS_PROVIDER_INVALID_RESPONSE", "SMS delivery failed"); }
  if (!response.ok) throw safe(502, "SMS_PROVIDER_RECIPIENT_REJECTED", "SMS delivery failed");
  const recipient = payload.SMSMessageData?.Recipients?.find((item) => item.number === phone);
  const status = String(recipient?.status || "").toLowerCase();
  const providerResultCode = recipient ? String(recipient.statusCode ?? "unknown").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || "unknown" : "missing_recipient";
  logStage(id, "provider_result", { environment, providerHost: providerHost(environment), providerResultCode, providerStatus: status || "unknown", recipientFound: Boolean(recipient) });
  if (!recipient) throw safe(502, "SMS_PROVIDER_INVALID_RESPONSE", "SMS delivery failed");
  if (status === "userinblacklist") throw safe(502, "SMS_PROVIDER_RECIPIENT_BLACKLISTED", "SMS delivery failed");
  if (!(String(recipient.statusCode) === "100" || ["sent", "queued", "accepted"].includes(status))) throw safe(502, "SMS_PROVIDER_REJECTED", "SMS delivery failed");
}
async function sendEmail(email: string, otp: string) {
  const key = env("RESEND_API_KEY"); const from = env("AUTH_EMAIL_FROM");
  if (!key || !from) throw safe(500, "EMAIL_CONFIG_MISSING", "Email verification is not configured");
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [email], subject: "Your Hakika Business OS verification code", text: `Your Hakika Business OS verification code is ${otp}.\n\nIt expires in 5 minutes and can be used only once.\n\nDo not share this code with anyone. Hakika staff will never ask you for it.`, html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#152238"><p style="color:#087466;font-weight:700">HAKIKA BUSINESS OS</p><h1>Your verification code</h1><p style="font-size:42px;letter-spacing:10px;font-weight:700">${otp}</p><p>This code expires in 5 minutes and can be used only once.</p><p><strong>Do not share this code.</strong> Hakika staff will never ask you for it.</p></div>` }), signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw safe(502, "EMAIL_DELIVERY_FAILED", "Email delivery failed");
}
async function sendVerification(channel: Channel, user: Auth["user"], otp: string, id: string) {
  if (channel === "email") { if (!user.email) throw safe(403, "EMAIL_MISSING", "Verification unavailable"); if (!user.email_confirmed_at) throw safe(403, "EMAIL_UNVERIFIED", "Verification unavailable"); await sendEmail(user.email, otp); return; }
  if (!user.phone) throw safe(403, "PHONE_MISSING", "Verification unavailable"); if (!user.phone_confirmed_at) throw safe(403, "PHONE_UNVERIFIED", "Verification unavailable"); const phone = normalizeVerifiedAuthPhone(user.phone); if (!phone) throw safe(403, "PHONE_INVALID", "Verification unavailable"); await sendSms(phone, otp, id);
}

export async function handleRequest(request: Request): Promise<Response> {
  const id = requestId(request);
  logStage(id, "request_received", { method: request.method, path: fixedPath(request) });
  try {
    if (!["GET", "POST"].includes(request.method)) return json({ code: "METHOD_NOT_ALLOWED", message: "Method not allowed", requestId: id }, 405);
    const authenticated = await auth(request); logStage(id, "jwt_verified", { user: "authenticated" }); logStage(id, "auth_user_loaded");
    const path = fixedPath(request);
    const r = redis();
    if (path === "/logout" && request.method === "POST") {
      for (const name of [LOGIN_COOKIE, STEP_UP_COOKIE]) { const token = requestCookie(request, name); if (token) await r.del(await redisKey("step-up", token)); }
      return json({ ok: true, requestId: id });
    }
    const requestBody = request.method === "POST" ? await request.clone().json().catch(() => ({})) as Record<string, unknown> : {};
    const purpose: Purpose = requestBody.purpose === "step_up" ? "step_up" : "login";
    const platform = purpose === "step_up" ? await platformOwner(authenticated) : null;
    if (path === "/status" && request.method === "GET") {
      const statusPurpose = new URL(request.url).searchParams.get("purpose") === "login" ? "login" : "step_up";
      const token = requestCookie(request, statusPurpose === "login" ? LOGIN_COOKIE : STEP_UP_COOKIE); const record = token ? parse<Challenge & { sessionId?: string; userId: string; bindingHash: string; expiresAt: number; purpose?: Purpose }>(await r.get(await redisKey("step-up", token))) : null;
      const verified = Boolean(record && record.userId === authenticated.userId && record.sessionId === authenticated.sessionId && record.bindingHash === await binding(authenticated, request) && record.expiresAt > Date.now());
      return json(verified ? { verified: true, expiresAt: new Date(record!.expiresAt).toISOString() } : { verified: false }, verified ? 200 : 401);
    }
    if (path === "/challenge" && request.method === "POST") {
      const channel = requestBody.channel === "phone" ? "phone" : requestBody.channel === "email" ? "email" : null; if (!channel) throw safe(400, "CHANNEL_MISMATCH", "Verification could not be completed");
      await reserveSend(authenticated, request); logStage(id, "redis_rate_limit_checked");
      let otp: string; try { otp = randomOtp(); } catch { throw safe(500, "OTP_GENERATION_FAILED", "Verification could not be completed"); }
      logStage(id, "otp_generated"); const challengeId = crypto.randomUUID();
      const challenge: Challenge = { id: challengeId, userId: authenticated.userId, purpose, channel, otpHash: await hmac(`${challengeId}:${otp}`), expiresAt: Date.now() + CHALLENGE_TTL * 1000, attempts: 0, resends: 0, bindingHash: await binding(authenticated, request), createdAt: Date.now() };
      try { await r.set(await redisKey("challenge", challengeId), JSON.stringify(challenge), { ex: CHALLENGE_TTL }); } catch { throw safe(503, "CHALLENGE_STORAGE_FAILED", "Verification could not be completed"); }
      logStage(id, "challenge_stored", { ttl: CHALLENGE_TTL });
      try { await sendVerification(channel, authenticated.user, otp, id); } catch (error) { try { await r.del(await redisKey("challenge", challengeId)); } catch { /* best effort cleanup */ } throw error; }
      logStage(id, "challenge_returned"); return json({ ok: true, challengeId, requestId: id });
    }
    if (path === "/verify" && request.method === "POST") {
      const body = requestBody; const id = typeof body.challengeId === "string" ? body.challengeId : ""; const otp = typeof body.otp === "string" ? body.otp : "";
      const challenge = parse<Challenge>(await r.get(await redisKey("challenge", id)));
      if (!challenge || challenge.userId !== authenticated.userId || challenge.bindingHash !== await binding(authenticated, request) || challenge.expiresAt <= Date.now()) throw safe(400, "CHALLENGE_INVALID", "Verification could not be completed");
      if (challenge.attempts >= MAX_ATTEMPTS) { await r.del(await redisKey("challenge", id)); throw safe(400, "CHALLENGE_LOCKED", "Verification could not be completed"); }
      if (!/^\d{6}$/.test(otp) || await hmac(`${id}:${otp}`) !== challenge.otpHash) { challenge.attempts += 1; if (challenge.attempts >= MAX_ATTEMPTS) await r.del(await redisKey("challenge", id)); else await r.set(await redisKey("challenge", id), JSON.stringify(challenge), { ex: Math.max(1, Math.ceil((challenge.expiresAt - Date.now()) / 1000)) }); throw safe(400, "OTP_INVALID", "Verification could not be completed"); }
      await r.del(await redisKey("challenge", id)); const token = randomToken(); const session = { userId: authenticated.userId, sessionId: authenticated.sessionId, bindingHash: await binding(authenticated, request), expiresAt: Date.now() + (challenge.purpose === "login" ? 12 * 3600 : STEP_UP_TTL) * 1000, purpose: challenge.purpose };
      const sessionTtl = challenge.purpose === "login" ? 12 * 3600 : STEP_UP_TTL;
      session.expiresAt = Date.now() + sessionTtl * 1000;
      await r.set(await redisKey("step-up", token), JSON.stringify(session), { ex: sessionTtl }); if (platform) await audit(authenticated, platform.organizationId, "app_mfa.verified");
      return json({ ok: true, stepUpToken: token, purpose: challenge.purpose });
    }
    if (path === "/resend" && request.method === "POST") {
      const body = requestBody; const id = typeof body.challengeId === "string" ? body.challengeId : ""; const challenge = parse<Challenge>(await r.get(await redisKey("challenge", id)));
      if (!challenge || challenge.userId !== authenticated.userId || challenge.bindingHash !== await binding(authenticated, request) || challenge.expiresAt <= Date.now() || challenge.resends >= MAX_RESENDS) throw safe(400, "CHALLENGE_INVALID", "Verification could not be completed");
      await reserveSend(authenticated, request); const otp = randomOtp(); challenge.otpHash = await hmac(`${id}:${otp}`); challenge.resends += 1; challenge.attempts = 0; challenge.expiresAt = Date.now() + CHALLENGE_TTL * 1000;
      try { await r.set(await redisKey("challenge", id), JSON.stringify(challenge), { ex: CHALLENGE_TTL }); } catch { throw safe(503, "CHALLENGE_STORAGE_FAILED", "Verification could not be completed"); }
      try { await sendVerification(challenge.channel, authenticated.user, otp, requestId(request)); } catch (error) { try { await r.del(await redisKey("challenge", id)); } catch { /* best effort cleanup */ } throw error; }
      return json({ ok: true, requestId: id });
    }
    return json({ code: "METHOD_NOT_ALLOWED", message: "Method not allowed", requestId: id }, 405);
  } catch (error) { const typed = error as { status?: unknown; code?: unknown; retryAfter?: unknown; message?: string }; const status = typeof typed.status === "number" ? typed.status : 500; const retryAfter = typeof typed.retryAfter === "number" ? typed.retryAfter : undefined; const code = typeof typed.code === "string" ? typed.code : "REQUEST_FAILED"; logStage(id, "request_failed", { code, status }); return json({ code, message: status >= 500 ? "Request could not be completed" : typed.message, requestId: id, ...(retryAfter ? { retryAfter } : {}) }, status, retryAfter ? { "Retry-After": String(retryAfter) } : {}); }
}
async function audit(authenticated: Auth, organizationId: string, action: string) { try { await rest(authenticated, "events", { method: "POST", headers: { "Content-Profile": "audit", Prefer: "return=minimal" }, body: JSON.stringify({ actor_user_id: authenticated.userId, actor_type: "service", organization_id: organizationId, application_key: "PLATFORM_ADMIN", action_key: action, outcome: "success", summary: "Hakika SMS Verification event", metadata: { mechanism: "app_mfa" } }) }); } catch { /* audit failure is intentionally non-disclosing */ } }
Deno.serve(handleRequest);
