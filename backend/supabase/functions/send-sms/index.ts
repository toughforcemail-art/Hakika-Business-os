import { Webhook } from "npm:standardwebhooks@^1";

const SANDBOX_URL = "https://api.sandbox.africastalking.com/version1/messaging";
const PRODUCTION_URL = "https://api.africastalking.com/version1/messaging";
const PROVIDER_TIMEOUT_MS = 8_000;
const SMS_PREFIX = "Your Hakika Business OS verification code is ";

type ProviderFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type HookEvent = {
  user?: { phone?: unknown };
  sms?: { otp?: unknown };
};

type ProviderRecipient = {
  number?: unknown;
  status?: unknown;
  statusCode?: unknown;
  messageId?: unknown;
};

type ProviderResponse = {
  SMSMessageData?: { Recipients?: ProviderRecipient[] };
};

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function hookError(status: number, message: string): Response {
  return json({ error: { http_code: status, message } }, status);
}

export function normalizeE164(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const phone = value.trim();
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

export function maskPhone(phone: string): string {
  return phone.length <= 4
    ? "***"
    : `${phone.slice(0, 4)}${"*".repeat(Math.max(3, phone.length - 7))}${
      phone.slice(-3)
    }`;
}

function safeCategory(error: unknown): string {
  if (error instanceof Error && error.message === "configuration") {
    return "configuration";
  }
  if (
    error instanceof DOMException &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  ) {
    return "timeout";
  }
  if (error instanceof TypeError) return "network";
  return "provider_rejection";
}

function providerAccepted(response: ProviderResponse, phone: string): boolean {
  const recipients = response.SMSMessageData?.Recipients;
  if (!Array.isArray(recipients) || recipients.length === 0) return false;
  const recipient = recipients.find((item) => item?.number === phone);
  if (!recipient) return false;
  const code = String(recipient.statusCode ?? "");
  const status = String(recipient.status ?? "").toLowerCase();
  return code === "100" || status === "sent" || status === "queued" ||
    status === "accepted";
}

function providerConfig(): {
  username: string;
  apiKey: string;
  url: string;
  environment: "sandbox" | "production";
} | null {
  const username = Deno.env.get("AFRICASTALKING_USERNAME")?.trim() ?? "";
  const apiKey = Deno.env.get("AFRICASTALKING_API_KEY")?.trim() ?? "";
  const environment = Deno.env.get("AFRICASTALKING_ENVIRONMENT")?.trim()
    .toLowerCase();
  if (
    !username || !apiKey ||
    (environment !== "sandbox" && environment !== "production")
  ) return null;
  if (environment === "sandbox" && username !== "sandbox") return null;
  if (environment === "production" && username.toLowerCase() === "sandbox") {
    return null;
  }
  return {
    username,
    apiKey,
    environment,
    url: environment === "sandbox" ? SANDBOX_URL : PRODUCTION_URL,
  };
}

export async function deliverSms(
  phone: string,
  otp: string,
  providerFetch: ProviderFetch = fetch,
): Promise<"accepted"> {
  const config = providerConfig();
  if (!config) throw new Error("configuration");
  const message =
    `${SMS_PREFIX}${otp}. It expires shortly. Do not share this code with anyone.`;
  const body = new URLSearchParams({
    username: config.username,
    to: phone,
    message,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const response = await providerFetch(config.url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        apiKey: config.apiKey,
      },
      body,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("provider_http_failure");
    let payload: ProviderResponse;
    try {
      payload = await response.json() as ProviderResponse;
    } catch {
      throw new Error("provider_invalid_json");
    }
    if (!providerAccepted(payload, phone)) {
      throw new Error("provider_recipient_rejected");
    }
    return "accepted";
  } finally {
    clearTimeout(timeout);
  }
}

export async function handleRequest(
  request: Request,
  providerFetch: ProviderFetch = fetch,
): Promise<Response> {
  const requestId = crypto.randomUUID();
  if (request.method !== "POST") return hookError(405, "Method not allowed");

  const rawHookSecret = Deno.env.get("SEND_SMS_HOOK_SECRET")?.trim();
  if (!rawHookSecret) return hookError(500, "SMS service is not configured");
  const hookSecret = rawHookSecret.replace("v1,whsec_", "");
  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers);
  let event: HookEvent;
  try {
    event = new Webhook(hookSecret).verify(rawBody, headers) as HookEvent;
  } catch {
    console.warn(
      JSON.stringify({
        requestId,
        stage: "webhook_validation",
        outcome: "rejected",
      }),
    );
    return hookError(401, "Invalid webhook signature");
  }

  const phone = normalizeE164(event.user?.phone);
  const otp =
    typeof event.sms?.otp === "string" && /^\d{4,12}$/.test(event.sms.otp)
      ? event.sms.otp
      : null;
  if (!phone || !otp) return hookError(400, "Invalid SMS hook payload");
  const environment =
    Deno.env.get("AFRICASTALKING_ENVIRONMENT")?.trim().toLowerCase() ??
      "unknown";
  console.info(
    JSON.stringify({
      requestId,
      stage: "delivery_started",
      environment,
      phone: maskPhone(phone),
    }),
  );
  const started = Date.now();
  try {
    await deliverSms(phone, otp, providerFetch);
    console.info(
      JSON.stringify({
        requestId,
        stage: "delivery_completed",
        environment,
        phone: maskPhone(phone),
        outcome: "accepted",
        durationMs: Date.now() - started,
      }),
    );
    return json({}, 200);
  } catch (error) {
    const category = safeCategory(error);
    const status = category === "configuration"
      ? 500
      : category === "timeout"
      ? 504
      : 502;
    console.error(
      JSON.stringify({
        requestId,
        stage: "delivery_failed",
        environment,
        phone: maskPhone(phone),
        outcome: category,
        durationMs: Date.now() - started,
      }),
    );
    return hookError(
      status,
      status === 500
        ? "SMS service is not configured"
        : status === 504
        ? "SMS delivery timed out"
        : "SMS delivery failed",
    );
  }
}

Deno.serve((request) => handleRequest(request));
