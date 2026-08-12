import { assert, assertEquals, assertMatch } from "jsr:@std/assert@^1";
import { handleRequest, normalizeProviderEnvironment, normalizeVerifiedAuthPhone, providerEndpointForEnvironment } from "./index.ts";

Deno.test("normalizes confirmed Auth phone values structurally", () => {
  assertEquals(normalizeVerifiedAuthPhone("+254 112 081 866"), "+254112081866");
  assertEquals(normalizeVerifiedAuthPhone("254112081866"), "+254112081866");
  assertEquals(normalizeVerifiedAuthPhone("0112081866"), "+254112081866");
  assertEquals(normalizeVerifiedAuthPhone("not-a-phone"), null);
});

Deno.test("strictly selects the African's Talking environment and endpoint", () => {
  assertEquals(normalizeProviderEnvironment(" Production "), "production");
  assertEquals(normalizeProviderEnvironment("SANDBOX"), "sandbox");
  assertEquals(normalizeProviderEnvironment("product"), null);
  assertEquals(normalizeProviderEnvironment("prod"), null);
  assertEquals(normalizeProviderEnvironment("live"), null);
  assertEquals(normalizeProviderEnvironment(""), null);
  assertEquals(normalizeProviderEnvironment(undefined), null);
  assertEquals(providerEndpointForEnvironment("production"), "https://api.africastalking.com/version1/messaging");
  assertEquals(providerEndpointForEnvironment("sandbox"), "https://api.sandbox.africastalking.com/version1/messaging");
  assertEquals(providerEndpointForEnvironment("prod"), null);
});

Deno.test("app_mfa rejects missing JWTs before any provider or Redis work", async () => {
  const response = await handleRequest(new Request("https://example.test/functions/v1/app-mfa/status", { method: "GET" }));
  assertEquals(response.status, 401);
  const body = await response.json();
  assertEquals(body.code, "AUTH_REQUIRED");
  assertEquals(body.message, "Authentication is required");
  assertEquals(typeof body.requestId, "string");
});

Deno.test("app_mfa rejects unsupported methods with a generic response", async () => {
  const response = await handleRequest(new Request("https://example.test/functions/v1/app-mfa/status", { method: "PUT" }));
  assertEquals(response.status, 405);
  assertMatch(await response.text(), /Method not allowed/);
});

Deno.test("app_mfa source keeps secrets and OTP state server-side", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assert(source.includes("HAKIKA_APP_MFA_HMAC_SECRET"));
  assert(source.includes("UPSTASH_REDIS_REST_TOKEN"));
  assert(source.includes("AFRICASTALKING_API_KEY"));
  assert(source.includes("verify"));
  assert(!source.includes("Math.random"));
});
