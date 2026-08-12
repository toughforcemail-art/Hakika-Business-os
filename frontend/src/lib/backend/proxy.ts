import "server-only";

import { cookies, headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

function backendUrl() { return (process.env.BACKEND_INTERNAL_URL || "http://localhost:5000").replace(/\/$/, ""); }

async function getAuthenticatedAccessToken() {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) return { response: Response.json({ code: "SESSION_REQUIRED", message: "Authentication is required" }, { status: 401 }) } as const;
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) return { response: Response.json({ code: "SESSION_TOKEN_MISSING", message: "Please sign in again" }, { status: 401 }) } as const;
  return { supabase, accessToken: sessionData.session.access_token } as const;
}

export async function proxyToBackend(path: string, request: Request, method = request.method) {
  const authentication = await getAuthenticatedAccessToken();
  if ("response" in authentication && authentication.response) return authentication.response;
  const { accessToken } = authentication;
  const incomingHeaders = await headers();
  const browserCookies = (await cookies()).toString();
  const forwardHeaders: HeadersInit = { Authorization: `Bearer ${accessToken}`, Cookie: browserCookies };
  const userAgent = incomingHeaders.get("user-agent");
  const forwardedFor = incomingHeaders.get("x-forwarded-for");
  if (userAgent) forwardHeaders["user-agent"] = userAgent;
  if (forwardedFor) forwardHeaders["x-forwarded-for"] = forwardedFor;
  const body = method === "GET" || method === "HEAD" ? undefined : await request.text();
  const backendResponse = await fetch(`${backendUrl()}${path}`, { method, headers: { ...forwardHeaders, ...(body ? { "Content-Type": "application/json" } : {}) }, body, cache: "no-store" });
  const response = new Response(backendResponse.body, { status: backendResponse.status, headers: { "content-type": backendResponse.headers.get("content-type") || "application/json", "cache-control": "no-store" } });
  const setCookie = backendResponse.headers.get("set-cookie");
  if (setCookie) response.headers.set("set-cookie", setCookie);
  return response;
}

export async function backendStatus() {
  return proxyToBackend("/api/auth/sms-step-up/status", new Request("http://hakika.internal/api/auth/sms-step-up/status"), "GET");
}

const challengeCookie = "hakika_auth_challenge";
const loginCookie = "hakika_login_verified";
const stepUpCookie = "hakika_step_up";

function safeError(status: number, code?: string) {
  if (status === 429) return "Verification temporarily limited";
  if (status === 403) return "Verification unavailable";
  if (code === "CONFIGURATION_MISSING") return "Verification is temporarily unavailable";
  if (code === "REDIS_UNAVAILABLE" || code === "CHALLENGE_STORAGE_FAILED") return "Verification service is temporarily unavailable";
  if (code === "SMS_PROVIDER_INSUFFICIENT_BALANCE") return "SMS verification is temporarily unavailable";
  if (code === "SMS_PROVIDER_RECIPIENT_BLACKLISTED") return "SMS verification is unavailable for this phone number";
  if (code === "SMS_PROVIDER_TIMEOUT" || code === "SMS_PROVIDER_REJECTED" || code === "SMS_PROVIDER_AUTH_FAILED" || code === "SMS_PROVIDER_INVALID_RESPONSE" || code === "SMS_DELIVERY_FAILED") return "SMS delivery could not be completed";
  return "Verification could not be completed";
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || new URL(origin).host === request.headers.get("host");
}

export async function proxyToAppMfa(request: Request, operation: "challenge" | "verify" | "resend" | "logout" | "status", purpose: "login" | "step_up" = "step_up") {
  if (!isSameOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  const authentication = await getAuthenticatedAccessToken();
  if ("response" in authentication && authentication.response) return authentication.response;
  const { accessToken } = authentication;
  const requestId = crypto.randomUUID();
  const cookieStore = await cookies();
  const challenge = cookieStore.get(challengeCookie)?.value;
  const stepUp = cookieStore.get(stepUpCookie)?.value;
  let body: Record<string, unknown> = {};
  if ((operation === "challenge" && (purpose === "login" || request.headers.get("content-type")?.split(";", 1)[0] === "application/json")) || operation === "verify" || operation === "resend") {
    if (request.headers.get("content-type")?.split(";", 1)[0] !== "application/json") return Response.json({ error: "Invalid request" }, { status: 415 });
    try { body = await request.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
  }
  const edgeBody = operation === "challenge" ? { purpose, channel: body.channel === "email" ? "email" : "phone" } : operation === "verify" ? { purpose, challengeId: challenge, otp: typeof body.otp === "string" ? body.otp : "" } : operation === "resend" ? { purpose, challengeId: challenge } : {};
  const { url, publishableKey } = getSupabasePublicConfig();
  const edgeUrl = `${url}/functions/v1/app-mfa/${operation}${operation === "status" ? `?purpose=${purpose}` : ""}`;
  const edgeHeaders = new Headers();
  edgeHeaders.set("apikey", publishableKey);
  edgeHeaders.set("Authorization", `Bearer ${accessToken}`);
  edgeHeaders.set("Content-Type", "application/json");
  edgeHeaders.set("x-hakika-request-id", requestId);
  const forwardedCookies = [challenge && `${challengeCookie}=${challenge}`, cookieStore.get(loginCookie)?.value && `${loginCookie}=${cookieStore.get(loginCookie)?.value}`, stepUp && `${stepUpCookie}=${stepUp}`].filter(Boolean).join("; ");
  if (forwardedCookies) edgeHeaders.set("Cookie", forwardedCookies);
  const edgeResponse = await fetch(edgeUrl, { method: operation === "status" ? "GET" : "POST", headers: edgeHeaders, body: operation === "status" ? undefined : JSON.stringify(edgeBody), cache: "no-store" });
  let result: { ok?: boolean; challengeId?: string; stepUpToken?: string; purpose?: "login" | "step_up"; verified?: boolean; expiresAt?: string; retryAfter?: number; code?: string; requestId?: string } = {};
  let validJson = true;
  try { result = await edgeResponse.json(); } catch { validJson = false; }
  const stableCodes = new Set(["PHONE_MISSING", "PHONE_UNVERIFIED", "PHONE_INVALID", "EMAIL_MISSING", "EMAIL_UNVERIFIED", "CHANNEL_MISMATCH", "AUTH_USER_LOOKUP_FAILED", "AUTH_REQUIRED", "RATE_LIMITED", "REDIS_UNAVAILABLE", "CONFIGURATION_MISSING", "OTP_GENERATION_FAILED", "CHALLENGE_STORAGE_FAILED", "SMS_PROVIDER_AUTH_FAILED", "SMS_PROVIDER_INSUFFICIENT_BALANCE", "SMS_PROVIDER_RECIPIENT_BLACKLISTED", "SMS_PROVIDER_REJECTED", "SMS_PROVIDER_TIMEOUT", "SMS_PROVIDER_INVALID_RESPONSE", "SMS_DELIVERY_FAILED", "CHALLENGE_INVALID", "CHALLENGE_LOCKED", "OTP_INVALID", "PLATFORM_ACCESS_DENIED"]);
  const responseRequestId = typeof result.requestId === "string" ? result.requestId : requestId;
  if (!validJson) return Response.json({ code: "PROXY_RESPONSE_INVALID", error: "Verification response was invalid", requestId }, { status: 502, headers: { "cache-control": "no-store" } });
  if (!edgeResponse.ok) { const code = result.code && (/^[A-Z0-9_]{3,64}$/.test(result.code) || stableCodes.has(result.code)) ? result.code : edgeResponse.status === 429 ? "RATE_LIMITED" : "PROXY_RESPONSE_INVALID"; return Response.json({ code, error: safeError(edgeResponse.status, code), requestId: responseRequestId, ...(result.retryAfter ? { retryAfter: result.retryAfter } : {}) }, { status: edgeResponse.status, headers: result.retryAfter ? { "Retry-After": String(result.retryAfter) } : undefined }); }
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
  if (operation === "challenge" && result.challengeId) cookieStore.set(challengeCookie, result.challengeId, { ...options, maxAge: 300 });
  if (operation === "verify" && result.stepUpToken) { cookieStore.set(result.purpose === "login" ? loginCookie : stepUpCookie, result.stepUpToken, { ...options, maxAge: result.purpose === "login" ? 12 * 3600 : 900 }); cookieStore.set(challengeCookie, "", { ...options, maxAge: 0 }); }
  if (operation === "logout") for (const name of [challengeCookie, loginCookie, stepUpCookie]) cookieStore.set(name, "", { ...options, maxAge: 0 });
  return Response.json({ ok: result.ok, verified: result.verified, expiresAt: result.expiresAt, requestId: responseRequestId }, { status: edgeResponse.status, headers: { "cache-control": "no-store" } });
}

export async function appMfaStatus() {
  return proxyToAppMfa(new Request("http://hakika.internal/api/auth/sms-step-up/status", { headers: { host: "hakika.internal" } }), "status", "step_up");
}

export async function appMfaLoginStatus() {
  return proxyToAppMfa(new Request("http://hakika.internal/api/auth/login-verification/status", { headers: { host: "hakika.internal" } }), "status", "login");
}
