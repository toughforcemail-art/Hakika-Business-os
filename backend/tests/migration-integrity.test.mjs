import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/0012_null_safe_platform_assignment_uniqueness.sql", "utf8");

test("platform assignment repair removes only null-company duplicates and adds null-safe uniqueness", () => {
  assert.match(migration, /where company_id is null/);
  assert.match(migration, /row_number\(\) over/);
  assert.match(migration, /duplicate_number > 1/);
  assert.match(migration, /member_app_roles_null_safe_unique/);
  assert.match(migration, /coalesce\(company_id/);
  assert.doesNotMatch(migration, /truncate|drop table/i);
});
