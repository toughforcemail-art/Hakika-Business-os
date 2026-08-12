import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const requiredRoutes = [
  ["/", "page"],
  ["/products", "products/page"],
  ["/products/real-estate", "products/real-estate/page"],
  ["/products/hr", "products/hr/page"],
  ["/products/finance", "products/finance/page"],
  ["/products/toughforce", "products/toughforce/page"],
  ["/pricing", "pricing/page"],
  ["/security", "security/page"],
  ["/about", "about/page"],
  ["/contact", "contact/page"],
  ["/support", "support/page"],
  ["/legal/privacy", "legal/privacy/page"],
  ["/legal/terms", "legal/terms/page"],
  ["/login", "login/page"],
  ["/apps", "apps/page"],
  ["/auth/forgot-password", "auth/forgot-password/page"],
  ["/auth/check-email", "auth/check-email/page"],
  ["/auth/confirm", "auth/confirm/page"],
  ["/auth/update-password", "auth/update-password/page"],
  ["/auth/reset-success", "auth/reset-success/page"],
];

test("required public route files exist", () => {
  for (const [url, route] of requiredRoutes) {
    assert.equal(existsSync(join(root, "src", "app", `${route}.tsx`)), true, route);
  }
});

test("authentication uses safe handoff and preserves recovery routes", () => {
  const login = readFileSync(join(root, "src", "app", "login", "page.tsx"), "utf8");
  const verify = readFileSync(join(root, "src", "components", "LoginVerificationClient.tsx"), "utf8");
  const redirects = readFileSync(join(root, "src", "lib", "auth", "redirects.ts"), "utf8");
  assert.match(login, /const destination = safeAuthDestination/);
  assert.match(login, /\/auth\/verify/);
  assert.match(login, /router\.replace/);
  assert.doesNotMatch(login, /listFactors/);
  assert.doesNotMatch(login, /router\.refresh/);
  assert.match(login, /normalizePhoneForCountry/);
  assert.match(verify, /Hakika Login Verification/);
  assert.match(verify, /safeAuthDestination/);
  assert.match(redirects, /startsWith\("\/\/"\)/);
});

test("root layout is conventional and contains no extension hydration cleanup", () => {
  const layout = readFileSync(join(root, "src", "app", "layout.tsx"), "utf8");
  assert.match(layout, /<html lang="en"><body>\{children\}<\/body><\/html>/);
  assert.doesNotMatch(layout, /MutationObserver|chrome-extension|suppressHydrationWarning|removeAttribute|beforeInteractive/);
});

test("running server serves every required public URL and its internal links", async (t) => {
  const baseUrl = process.env.ROUTE_TEST_BASE_URL;
  if (!baseUrl) {
    t.skip("Set ROUTE_TEST_BASE_URL to run HTTP route and internal-link checks");
    return;
  }

  const paths = new Set(requiredRoutes.map(([url]) => url));
  for (const path of requiredRoutes.map(([url]) => url)) {
    const response = await fetch(new URL(path, baseUrl));
    assert.ok(response.status >= 200 && response.status < 400, `${path} returned ${response.status}`);
    const html = await response.text();
    for (const href of html.matchAll(/href=["']([^"']+)["']/g)) {
      const target = href[1];
      if (!target.startsWith("/") || target.startsWith("//") || target.startsWith("/api/") || target.startsWith("/#") || target.startsWith("/_next/")) continue;
      paths.add(target.split(/[?#]/, 1)[0]);
    }
  }

  const broken = [];
  for (const path of paths) {
    const response = await fetch(new URL(path, baseUrl), { redirect: "manual" });
    if (response.status < 200 || response.status >= 400) broken.push(`${path} (${response.status})`);
  }
  assert.deepEqual(broken, [], `Broken internal links: ${broken.join(", ")}`);
});

test("launcher has all required applications and entitlement states", () => {
  const launcher = readFileSync(join(root, "src", "app", "apps", "page.tsx"), "utf8");
  const catalog = readFileSync(join(root, "src", "lib", "auth", "applications.ts"), "utf8");
  for (const app of ["Hakika Real Estate", "HR", "Finance", "ToughForce Security"]) assert.match(catalog, new RegExp(app));
  for (const state of ["active", "trial"]) assert.match(catalog, new RegExp(state));
  assert.match(launcher, /getAccessibleApplications/);
});

test("supplied brand assets and Finance missing-asset fallback exist", () => {
  for (const asset of ["hr/logo.jpg", "real-estate/logo.jpg", "toughforce/logo.jpg", "finance/fallback.svg"]) {
    assert.equal(existsSync(join(root, "public", "brands", asset)), true, asset);
  }
});

test("Real Estate foundation centralizes navigation and permissions", () => {
  const navigation = readFileSync(join(root, "src", "modules", "real-estate", "navigation", "index.ts"), "utf8");
  const permissions = readFileSync(join(root, "src", "modules", "real-estate", "permissions", "catalog.ts"), "utf8");
  const context = readFileSync(join(root, "src", "modules", "real-estate", "services", "tenant-context.ts"), "utf8");
  const shell = readFileSync(join(root, "src", "components", "AppShell.tsx"), "utf8");
  assert.match(navigation, /requiredPermission/);
  assert.match(navigation, /requiredApplication: "REAL_ESTATE"/);
  assert.match(permissions, /real_estate\.properties\.create/);
  assert.match(permissions, /real_estate\.payments\.reconcile/);
  assert.match(context, /requireAuthenticatedUser/);
  assert.match(context, /getAccessibleApplications/);
  assert.match(shell, /realEstateNavigationGroups/);
  assert.doesNotMatch(context, /body\.organization_id|body\.company_id|searchParams/);
});

test("Supabase SSR is the only auth-cookie owner and protected redirects preserve cookies", () => {
  const proxy = readFileSync(join(root, "src", "lib", "supabase", "proxy.ts"), "utf8");
  const entryProxy = readFileSync(join(root, "src", "proxy.ts"), "utf8");
  const config = readFileSync(join(root, "src", "lib", "supabase", "config.ts"), "utf8");
  assert.match(proxy, /createServerClient/);
  assert.match(proxy, /getClaims/);
  assert.match(proxy, /NextResponse\.next\(\{ request \}\)/);
  assert.match(proxy, /redirect\.cookies\.set\(cookie\)/);
  assert.match(config, /upvupkuokinwqwsfxyxy/);
  assert.doesNotMatch(entryProxy, /cookies\(\)/);
  assert.doesNotMatch(entryProxy, /auth-token/);
  assert.doesNotMatch(entryProxy, /\/login.*matcher/);
});
