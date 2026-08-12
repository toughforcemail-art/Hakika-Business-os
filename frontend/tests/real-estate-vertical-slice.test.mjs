import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
const root = process.cwd();
const src = join(root, "src");
test("Real Estate vertical slice routes resolve", () => {
  for (const route of ["dashboard/page.tsx","properties/page.tsx","properties/new/page.tsx","properties/[propertyId]/page.tsx","properties/[propertyId]/edit/page.tsx","units/page.tsx","units/new/page.tsx","units/[unitId]/page.tsx","units/[unitId]/edit/page.tsx","units/[unitId]/assets/page.tsx"]) assert.equal(existsSync(join(src,"app","real-estate",route)), true, route);
});
test("Real Estate mutation path is server-only and tenant-derived", () => {
  const actions = readFileSync(join(src,"modules","real-estate","actions","index.ts"),"utf8");
  const context = readFileSync(join(src,"modules","real-estate","services","tenant-context.ts"),"utf8");
  assert.match(actions, /use server/); assert.match(actions, /getRealEstateTenantContext/); assert.match(actions, /requirePermission/);
  assert.match(context, /organizationId/); assert.match(context, /companyId/); assert.doesNotMatch(actions, /organizationId: input|companyId: input/);
});
test("Real Estate migration is additive and separates planned from actual units", () => {
  const sql = readFileSync(join(root,"..","backend","supabase","migrations","0013_real_estate_vertical_slice.sql"),"utf8").toLowerCase();
  assert.match(sql, /planned_unit_count/); assert.match(sql, /unit_assets/); assert.match(sql, /enable row level security/); assert.match(sql, /units_active_number_unique/);
  assert.doesNotMatch(sql, /\bdrop\b|\btruncate\b|\bdelete\s+from\b|disable\s+row\s+level\s+security/);
});
