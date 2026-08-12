import { createHash, createHmac, randomBytes, randomInt, randomUUID } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Redis } from "@upstash/redis";
import { normalizeSmsPhone } from "../sms/phone.mjs";

const CHALLENGE_TTL = 300;
const STEP_UP_TTL = 900;
const COOKIE_NAME = "hakika_app_mfa";
const SMS_MESSAGE = (otp) => `Your Hakika Business OS verification code is ${otp}. It expires in 5 minutes. Do not share this code.`;
const projectRef = () => process.env.SUPABASE_PROJECT_REF || "upvupkuokinwqwsfxyxy";
const config = () => {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const hmacSecret = process.env.HAKIKA_APP_MFA_HMAC_SECRET;
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const username = process.env.AFRICASTALKING_USERNAME;
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  const environment = process.env.AFRICASTALKING_ENVIRONMENT?.toLowerCase();
  if (!url || !publishableKey || !hmacSecret || !redisUrl || !redisToken || !username || !apiKey || !["sandbox", "production"].includes(environment)) throw new Error("Backend app_mfa configuration is unavailable");
  if ((environment === "sandbox" && username !== "sandbox") || (environment === "production" && username === "sandbox")) throw new Error("Backend app_mfa configuration is unavailable");
  return { url, publishableKey, hmacSecret, username, apiKey, environment };
};
const redis = () => { const c = config(); return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN }); };
const sha = (value) => createHash("sha256").update(value).digest("hex");
const hmac = (value) => createHmac("sha256", config().hmacSecret).update(value).digest("hex");
const key = (resource, identifier) => `${process.env.REDIS_KEY_PREFIX || "hakika"}:${process.env.NODE_ENV || "development"}:app_mfa:${resource}:${sha(identifier).slice(0, 40)}`;
const parseJson = (value) => typeof value === "string" ? JSON.parse(value) : value;
const safeError = (status, message) => Object.assign(new Error(message), { status });
const json = (body, status, headers = {}) => ({ status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers }, body: JSON.stringify(body) });

let jwks;
function jwksFor(c) { return jwks ||= createRemoteJWKSet(new URL(`${c.url}/auth/v1/.well-known/jwks.json`)); }

async function verifyAccessToken(request, requirePhone = true) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw safeError(401, "Unauthorized");
  const c = config();
  let payload;
  try { ({ payload } = await jwtVerify(token, jwksFor(c), { issuer: `${c.url}/auth/v1`, audience: "authenticated" })); } catch { throw safeError(401, "Unauthorized"); }
  if (typeof payload.sub !== "string") throw safeError(401, "Unauthorized");
  const userResponse = await fetch(`${c.url}/auth/v1/user`, { headers: { apikey: c.publishableKey, Authorization: `Bearer ${token}` } });
  if (!userResponse.ok) throw safeError(401, "Unauthorized");
  const user = await userResponse.json();
  if (user.id !== payload.sub || (requirePhone && (!user.phone || !user.phone_confirmed_at))) throw safeError(403, "Verification unavailable");
  return { token, user, claims: payload, userId: payload.sub, sessionId: typeof payload.session_id === "string" ? payload.session_id : undefined };
}

export async function rest(auth, path, options = {}, schema = "public") {
  const c = config();
  const profileHeader = options.method && options.method !== "GET" ? "Content-Profile" : "Accept-Profile";
  const response = await fetch(`${c.url}/rest/v1/${path}`, { ...options, headers: { apikey: c.publishableKey, Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json", [profileHeader]: schema, ...options.headers } });
  if (!response.ok) throw new Error("Supabase authorization lookup failed");
  return response.status === 204 ? null : response.json();
}

async function platformOwner(auth) {
  const organizations = await rest(auth, "organizations?organization_type=eq.platform_owner&status=eq.active&select=id");
  const organizationIds = organizations.map((row) => row.id);
  if (!organizationIds.length) throw safeError(403, "Platform access denied");
  const memberships = await rest(auth, `organization_memberships?user_id=eq.${auth.userId}&status=eq.active&organization_id=in.(${organizationIds.join(",")})&select=id,organization_id`);
  if (!memberships.length) throw safeError(403, "Platform access denied");
  const membershipIds = memberships.map((row) => row.id);
  const applications = await rest(auth, "applications?application_key=eq.PLATFORM_ADMIN&status=eq.active&select=id");
  if (!applications.length) throw safeError(403, "Platform access denied");
  const assignments = await rest(auth, `member_app_roles?organization_membership_id=in.(${membershipIds.join(",")})&application_id=eq.${applications[0].id}&select=role_id,valid_from,valid_until`);
  const now = Date.now();
  const roleIds = assignments.filter((row) => (!row.valid_from || Date.parse(row.valid_from) <= now) && (!row.valid_until || Date.parse(row.valid_until) > now)).map((row) => row.role_id);
  if (!roleIds.length) throw safeError(403, "Platform access denied");
  const roles = await rest(auth, `roles?id=in.(${roleIds.join(",")})&role_key=eq.platform_admin&scope=eq.platform&select=id`);
  if (!roles.length) throw safeError(403, "Platform access denied");
  return { organizationId: memberships[0].organization_id };
}

function binding(auth, request) { return hmac(`${auth.userId}:${auth.sessionId || "no-session"}:${request.headers.get("user-agent") || "unknown"}`); }
function maskedIp(request) { return sha(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown"); }
function challengeHash(id, otp) { return hmac(`${id}:${otp}`); }
function randomOtp() { return String(randomInt(100000, 1000000)); }
function randomToken() { return randomBytes(32).toString("base64url"); }
function cookieValue(request) { return request.headers.get("cookie")?.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))?.[1]; }
function cookie(token, maxAge) { const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""; return `${COOKIE_NAME}=${token}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure}`; }
async function audit(auth, request, organizationId, action, outcome, summary) {
  try { await rest(auth, "events", { method: "POST", headers: { "Content-Profile": "audit", Prefer: "return=minimal" }, body: JSON.stringify({ actor_user_id: auth.userId, organization_id: organizationId, application_key: "PLATFORM_ADMIN", action_key: action, outcome, summary, ip_hash: maskedIp(request), user_agent: request.headers.get("user-agent") || null, metadata: { mechanism: "app_mfa" } }) }); } catch { /* Audit failure must not disclose security data. */ }
}

async function reserveSend(auth, request, challengeId, resend) {
  const r = redis();
  if (await r.set(key("cooldown", auth.userId), "1", { ex: 60, nx: true }) !== "OK") throw safeError(429, "Verification temporarily limited");
  const userCount = await r.incr(key("hourly", auth.userId)); if (userCount === 1) await r.expire(key("hourly", auth.userId), 3600);
  const ipCount = await r.incr(key("ip", request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown")); if (ipCount === 1) await r.expire(key("ip", request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"), 3600);
  if (userCount > 5 || ipCount > 10) throw safeError(429, "Verification temporarily limited");
  if (resend) { const challenge = parseJson(await r.get(key("challenge", challengeId))); if (!challenge || challenge.resends >= 3) throw safeError(400, "Verification could not be completed"); }
}

async function sendVerificationSms(auth, phone, otp) {
  const c = config();
  const response = await fetch(c.environment === "sandbox" ? "https://api.sandbox.africastalking.com/version1/messaging" : "https://api.africastalking.com/version1/messaging", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", apiKey: c.apiKey }, body: new URLSearchParams({ username: c.username, to: phone, message: SMS_MESSAGE(otp) }), signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw safeError(502, "SMS delivery failed");
  let payload; try { payload = await response.json(); } catch { throw safeError(502, "SMS delivery failed"); }
  const recipient = payload?.SMSMessageData?.Recipients?.find((item) => item.number === phone);
  const status = String(recipient?.status || "").toLowerCase();
  if (!recipient || !(String(recipient.statusCode) === "100" || ["sent", "queued", "accepted"].includes(status))) throw safeError(502, "SMS delivery failed");
}

async function validStepUp(auth, request, r) {
  const token = cookieValue(request);
  const record = token ? parseJson(await r.get(key("session", token))) : null;
  return record && record.userId === auth.userId && record.sessionId === auth.sessionId && record.bindingHash === binding(auth, request) && record.expiresAt > Date.now() ? record : null;
}

async function validEdgeStepUp(auth, request) {
  const c = config();
  const response = await fetch(`${c.url}/functions/v1/app-mfa/status`, { headers: { apikey: c.publishableKey, Authorization: `Bearer ${auth.token}`, Cookie: request.headers.get("cookie") || "" } });
  if (!response.ok) return false;
  const result = await response.json().catch(() => ({}));
  return result.verified === true;
}

export async function handleProvision(request) {
  const auth = await verifyAccessToken(request);
  const platform = await platformOwner(auth);
  if (!await validEdgeStepUp(auth, request)) throw safeError(403, "Platform access denied");
  const body = await request.json();
  const organizationName = typeof body.organizationName === "string" ? body.organizationName.trim() : "";
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
  const applicationKeys = Array.isArray(body.applicationKeys) ? body.applicationKeys.filter((value) => typeof value === "string") : [];
  if (!organizationName || !companyName || !applicationKeys.length) throw safeError(400, "Organization, company and applications are required");
  const result = await rest(auth, "rpc/provision_organization", { method: "POST", headers: { "Content-Profile": "platform", Prefer: "return=representation" }, body: JSON.stringify({ p_organization_name: organizationName, p_company_name: companyName, p_organization_slug: typeof body.organizationSlug === "string" ? body.organizationSlug : null, p_company_code: typeof body.companyCode === "string" ? body.companyCode : null, p_owner_user_id: typeof body.ownerUserId === "string" ? body.ownerUserId : null, p_application_keys: applicationKeys, p_plan_key: typeof body.planKey === "string" ? body.planKey : null, p_trial_days: typeof body.trialDays === "number" ? body.trialDays : 14, p_request_key: typeof body.requestKey === "string" ? body.requestKey : randomUUID() }) });
  await audit(auth, request, platform.organizationId, "platform.provision", "success", "Platform organization provisioning completed");
  return json(result, 201);
}


export async function handleAppMfa(request) {
  const path = new URL(request.url).pathname;
  const auth = await verifyAccessToken(request);
  const platform = path.endsWith("/logout") ? null : await platformOwner(auth);
  const r = redis();
  if (path.endsWith("/sms-challenge") && request.method === "POST") {
    const id = randomUUID(); const otp = randomOtp(); const bind = binding(auth, request);
    await reserveSend(auth, request, id, false);
    await r.set(key("challenge", id), JSON.stringify({ id, userId: auth.userId, otpHash: challengeHash(id, otp), expiresAt: Date.now() + CHALLENGE_TTL * 1000, attempts: 0, resends: 0, bindingHash: bind }), { ex: CHALLENGE_TTL });
    const phone = normalizeSmsPhone(auth.user.phone);
    if (!phone) { await r.del(key("challenge", id)); throw safeError(403, "Verification unavailable"); }
    try { await sendVerificationSms(auth, phone, otp); } catch (error) { await r.del(key("challenge", id)); throw error; }
    await audit(auth, request, platform.organizationId, "app_mfa.challenge.created", "success", "Hakika SMS verification challenge created");
    return json({ ok: true, challengeId: id }, 200);
  }
  if (path.endsWith("/sms-verify") && request.method === "POST") {
    const body = await request.json(); const id = typeof body.challengeId === "string" ? body.challengeId : ""; const otp = typeof body.otp === "string" ? body.otp : ""; const challenge = parseJson(await r.get(key("challenge", id)));
    if (!challenge || challenge.userId !== auth.userId || challenge.bindingHash !== binding(auth, request) || challenge.expiresAt <= Date.now()) throw safeError(400, "Verification could not be completed");
    if (challenge.attempts >= 5) { await r.del(key("challenge", id)); throw safeError(400, "Verification could not be completed"); }
    if (!/^\d{6}$/.test(otp) || challengeHash(id, otp) !== challenge.otpHash) { challenge.attempts += 1; if (challenge.attempts >= 5) await r.del(key("challenge", id)); else await r.set(key("challenge", id), JSON.stringify(challenge), { ex: Math.max(1, Math.ceil((challenge.expiresAt - Date.now()) / 1000)) }); throw safeError(400, "Verification could not be completed"); }
    await r.del(key("challenge", id)); const token = randomToken(); const expiresAt = Date.now() + STEP_UP_TTL * 1000;
    await r.set(key("session", token), JSON.stringify({ userId: auth.userId, sessionId: auth.sessionId, bindingHash: binding(auth, request), expiresAt }), { ex: STEP_UP_TTL });
    await audit(auth, request, platform.organizationId, "app_mfa.verified", "success", "Hakika SMS verification completed");
    return json({ ok: true }, 200, { "set-cookie": cookie(token, STEP_UP_TTL) });
  }
  if (path.endsWith("/sms-resend") && request.method === "POST") {
    const body = await request.json(); const id = typeof body.challengeId === "string" ? body.challengeId : ""; const challenge = parseJson(await r.get(key("challenge", id)));
    if (!challenge || challenge.userId !== auth.userId || challenge.bindingHash !== binding(auth, request) || challenge.expiresAt <= Date.now() || challenge.resends >= 3) throw safeError(400, "Verification could not be completed");
    await reserveSend(auth, request, id, true); const otp = randomOtp(); challenge.otpHash = challengeHash(id, otp); challenge.resends += 1; challenge.attempts = 0; challenge.expiresAt = Date.now() + CHALLENGE_TTL * 1000;
    await r.set(key("challenge", id), JSON.stringify(challenge), { ex: CHALLENGE_TTL });
    const phone = normalizeSmsPhone(auth.user.phone);
    if (!phone) { await r.del(key("challenge", id)); throw safeError(403, "Verification unavailable"); }
    try { await sendVerificationSms(auth, phone, otp); } catch (error) { await r.del(key("challenge", id)); throw error; }
    return json({ ok: true }, 200);
  }
  if (path.endsWith("/status") && request.method === "GET") {
    const token = cookieValue(request); const record = token ? parseJson(await r.get(key("session", token))) : null; const verified = Boolean(record && record.userId === auth.userId && record.sessionId === auth.sessionId && record.bindingHash === binding(auth, request) && record.expiresAt > Date.now());
    return json(verified ? { verified: true, expiresAt: new Date(record.expiresAt).toISOString() } : { verified: false }, verified ? 200 : 401);
  }
  if (path.endsWith("/logout") && request.method === "POST") {
    const token = cookieValue(request); if (token) await r.del(key("session", token)); return json({ ok: true }, 200, { "set-cookie": cookie("", 0) });
  }
  throw safeError(405, "Method not allowed");
}

export { COOKIE_NAME, STEP_UP_TTL, CHALLENGE_TTL, key, challengeHash, binding, randomOtp, randomToken, verifyAccessToken, platformOwner, validStepUp, safeError, redis, audit, json };
