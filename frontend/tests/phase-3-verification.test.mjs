import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

test("Phase 3 proxy excludes Next internals and allows the configured LAN origin", () => {
  const proxy = readFileSync(join(root, "src", "proxy.ts"), "utf8");
  const config = readFileSync(join(root, "next.config.ts"), "utf8");
  assert.match(proxy, /pathname\.startsWith\("\/_next\/"\)/);
  assert.match(proxy, /matcher: \["\/\(\(\?!_next\//);
  assert.match(config, /allowedDevOrigins: \["192\.168\.100\.110"\]/);
});

test("current development assets are not blocked and protected pages redirect", async (t) => {
  const baseUrl = process.env.ROUTE_TEST_BASE_URL;
  if (!baseUrl) return t.skip("Set ROUTE_TEST_BASE_URL to run development asset checks");
  const login = await fetch(new URL("/login", baseUrl));
  assert.equal(login.status, 200);
  const html = await login.text();
  const assets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map((match) => match[1]).filter((asset) => asset.startsWith("/_next/") || asset.includes(".woff2")).slice(0, 12);
  assert.ok(assets.length > 0, "login page should expose current Next assets");
  for (const asset of assets) {
    const response = await fetch(new URL(asset, baseUrl));
    assert.notEqual(response.status, 403, `${asset} was forbidden`);
    assert.ok(response.status >= 200 && response.status < 400, `${asset} returned ${response.status}`);
  }
  const protectedResponse = await fetch(new URL("/apps", baseUrl), { redirect: "manual" });
  assert.equal(protectedResponse.status, 307);
  const hmr = await fetch(new URL("/_next/hmr", baseUrl));
  assert.notEqual(hmr.status, 403);
});

test("application routes use the canonical access decision", () => {
  const access = readFileSync(join(root, "src", "lib", "auth", "applications.ts"), "utf8");
  assert.match(access, /requireAuthenticatedUser/);
  assert.match(access, /organization_memberships/);
  assert.match(access, /application_subscriptions/);
  assert.match(access, /member_app_roles/);
  assert.match(access, /hasPlatformSuperAdminAccess/);
  assert.match(access, /isPlatformSuperAdmin/);
  assert.match(access, /trial/);
  assert.match(access, /valid_until/);
  for (const route of ["real-estate", "hr", "finance", "toughforce", "admin", "platform"]) {
    const source = readFileSync(join(root, "src", "app", route, "dashboard", "page.tsx"), "utf8");
    assert.match(source, /requireCurrentApplication/);
  }
});

test("Real Estate Phase 4 route family is implemented behind app and page authorization", () => {
  const route = readFileSync(join(root, "src", "app", "real-estate", "[...section]", "page.tsx"), "utf8");
  const shell = readFileSync(join(root, "src", "components", "AppShell.tsx"), "utf8");
  for (const slug of ["properties", "units", "tenants", "leases", "invoices", "payments", "mpesa", "occupancy", "users", "audit-activity"]) assert.match(route, new RegExp(slug));
  assert.match(route, /requireCurrentApplication/);
  assert.match(route, /requirePermission/);
  assert.match(shell, /realEstateNavigationGroups/);
  assert.match(readFileSync(join(root, "src", "modules", "real-estate", "navigation", "index.ts"), "utf8"), /\/real-estate\/\$\{slug\}/);
});
