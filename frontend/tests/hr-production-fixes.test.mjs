import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const migration = fs.readFileSync(path.join(root, "../backend/supabase/migrations/0028_hr_counter_and_atomic_employee_creation.sql"), "utf8");
const directory = fs.readFileSync(path.join(root, "src/app/hr/employees/page.tsx"), "utf8");
const action = fs.readFileSync(path.join(root, "src/modules/hr/actions.ts"), "utf8");

test("entity numbering supports organization-only and company scopes safely", () => {
  assert.match(migration, /alter column company_id drop not null/i);
  assert.match(migration, /unique nulls not distinct \(organization_id, company_id, entity_type\)/i);
  assert.match(migration, /company_id is not distinct from target_company/i);
  assert.match(migration, /create or replace function hr\.create_employee/i);
  assert.match(migration, /for update/i);
});

test("employee directory remains an array query and atomic action sanitizes failures", () => {
  assert.doesNotMatch(directory, /\.single\(\)|\.maybeSingle\(\)/);
  assert.match(directory, /data\?\?\[\]/);
  assert.match(action, /No employee was created/);
  assert.doesNotMatch(action, /error\?\.message.*Could not create employee/);
});
