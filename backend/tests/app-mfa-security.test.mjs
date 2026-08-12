import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { handleAppMfa, handleProvision, key, randomOtp, randomToken } from "../src/app-mfa/service.mjs";

const source = readFileSync(join(process.cwd(), "src/app-mfa/service.mjs"), "utf8");

test("unauthenticated app_mfa and provisioning requests are rejected", async () => {
  const request = new Request("http://localhost:5000/api/auth/sms-challenge", { method: "POST", body: "{}" });
  await assert.rejects(() => handleAppMfa(request), (error) => error.status === 401);
  await assert.rejects(() => handleProvision(new Request("http://localhost:5000/api/platform/provision", { method: "POST", body: "{}" })), (error) => error.status === 401);
});

test("backend app_mfa security primitives are present and identifiers are hashed", () => {
  assert.match(source, /createRemoteJWKSet/);
  assert.match(source, /jwtVerify/);
  assert.match(source, /SUPABASE_URL.*\.well-known\/jwks\.json/s);
  assert.match(source, /AFRICASTALKING_API_KEY/);
  assert.match(source, /UPSTASH_REDIS_REST_TOKEN/);
  assert.match(source, /createHmac/);
  assert.match(source, /randomInt/);
  assert.match(source, /randomBytes/);
  assert.match(source, /platformOwner/);
  assert.match(source, /bindingHash/);
  assert.match(source, /HttpOnly/);
  const userId = "user-123";
  const redisKey = key("challenge", userId);
  assert.doesNotMatch(redisKey, /user-123/);
  assert.equal(randomOtp().length, 6);
  assert.equal(randomToken().length > 30, true);
});

test("backend never accepts a browser-selected recipient or arbitrary SMS text", () => {
  assert.match(source, /auth\.user\.phone/);
  assert.match(source, /SMS_MESSAGE/);
  assert.doesNotMatch(source, /body\.phone/);
  assert.doesNotMatch(source, /body\.message/);
});
