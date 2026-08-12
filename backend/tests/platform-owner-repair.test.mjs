import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/0011_platform_owner_access_repair.sql", "utf8");

test("platform owner repair is idempotent and canonical", () => {
  assert.match(migration, /hakika-platform/);
  assert.match(migration, /Hakika Business OS/);
  assert.match(migration, /multiple active platform-owner organizations require manual review/);
  assert.match(migration, /on conflict \(organization_id, user_id\) do update/);
  assert.match(migration, /on conflict \(organization_membership_id, company_id, application_id, role_id\) do nothing/);
  assert.match(migration, /where not exists \(\s*select 1 from audit\.events/s);
  assert.match(migration, /grant select on platform\.organizations/);
  assert.doesNotMatch(migration, /drop table|truncate|delete from/i);
});
