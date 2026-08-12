import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (file) => readFileSync(join(root, "src", file), "utf8");
const readBackend = (file) => readFileSync(join(root, "..", "backend", file), "utf8");

test("Hakika app_mfa endpoints exist and use server authentication", () => {
  const routes = [
    "app/api/auth/sms-challenge/route.ts",
    "app/api/auth/sms-verify/route.ts",
    "app/api/auth/sms-resend/route.ts",
    "app/api/auth/sms-step-up/logout/route.ts",
    "app/api/auth/sms-step-up/status/route.ts",
  ];
  for (const route of routes) assert.equal(existsSync(join(root, "src", route)), true, route);
  for (const route of routes.slice(0, 4)) assert.match(read(route), /proxyToAppMfa/);
  assert.match(read("app/api/auth/sms-step-up/status/route.ts"), /proxyToAppMfa/);
});

test("app_mfa does not generate or verify OTPs in the browser", () => {
  const page = read("app/auth/sms-verify/page.tsx");
  const challenge = readBackend("supabase/functions/app-mfa/index.ts");
  const verify = readBackend("supabase/functions/app-mfa/index.ts");
  assert.match(page, /fetch\("\/api\/auth\/sms-challenge"/);
  assert.match(page, /body: JSON\.stringify\(\{ otp: code \}\)/);
  assert.doesNotMatch(page, /challengeId/);
  assert.doesNotMatch(page, /Math\.random|randomInt|randomBytes|createHmac/);
  assert.match(challenge, /crypto\.getRandomValues/);
  assert.match(challenge, /otpHash/);
  assert.match(verify, /await r\.del\(await redisKey\("challenge"/);
});

test("app_mfa uses hashed Redis identifiers and a secure opaque cookie", () => {
  const library = readBackend("supabase/functions/app-mfa/index.ts");
  assert.match(library, /subtle\.sign/);
  assert.match(library, /sha256/);
  assert.match(library, /randomToken/);
  assert.match(library, /crypto\.getRandomValues/);
  assert.match(library, /HttpOnly/);
  assert.match(library, /SameSite=Lax/);
  assert.match(library, /Your Hakika Business OS verification code is/);
  assert.doesNotMatch(library, /senderId|["']from["']\s*:/);
});

test("frontend app_mfa code is a thin authenticated proxy", () => {
  const proxy = read("lib/backend/proxy.ts");
  assert.match(proxy, /functions\/v1\/app-mfa/);
  assert.match(proxy, /hakika_auth_challenge/);
  assert.match(proxy, /hakika_login_verified/);
  assert.match(proxy, /hakika_step_up/);
  assert.match(proxy, /Authorization/);
  assert.match(proxy, /edgeHeaders\.set\("apikey", publishableKey\)/);
  assert.match(proxy, /edgeHeaders\.set\("Authorization", `Bearer \$\{accessToken\}`\)/);
  assert.match(read("lib/supabase/config.ts"), /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(proxy, /cookieStore\.set/);
  assert.doesNotMatch(proxy, /AFRICASTALKING_API_KEY|UPSTASH_REDIS_REST_TOKEN|HAKIKA_APP_MFA_HMAC_SECRET|createHmac|randomInt/);
});

test("phone login normalizes Kenyan mobile numbers before Supabase Auth", () => {
  const login = read("app/login/page.tsx");
  const phone = read("lib/auth/phone.ts");
  assert.match(login, /signInWithPassword\(email \? \{ email, password \} : \{ phone: phone!, password \}\)/);
  assert.match(login, /normalizePhoneForCountry\(value, country\)/);
  assert.match(phone, /0\[17\]\\d\{8\}/);
  assert.match(phone, /254\[17\]\\d\{8\}/);
});

test("Platform Admin uses Hakika SMS Verification instead of Supabase AAL2", () => {
  const applications = read("lib/auth/applications.ts");
  const platformApi = read("app/api/platform/provision/route.ts");
  const legacy = read("app/auth/verify/page.tsx");
  assert.match(applications, /requireHakikaStepUp/);
  assert.match(applications, /\/auth\/sms-verify/);
  assert.match(platformApi, /proxyToBackend/);
  assert.match(readBackend("supabase/functions/app-mfa/index.ts"), /platformOwner/);
  assert.doesNotMatch(legacy, /aal2|AAL2/);
});
