import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../supabase/migrations/0010_renting_provisioning.sql", import.meta.url), "utf8");

test("provisioning is transactional and platform-owner AAL2 gated", () => {
  assert.match(sql, /begin;[\s\S]*commit;/i);
  assert.match(sql, /private\.is_platform_operator\(\)/);
  assert.match(sql, /auth\.jwt\(\)->>'aal'[\s\S]*aal2/);
  assert.match(sql, /set search_path = pg_catalog, platform, iam, billing, audit, private/);
  assert.match(sql, /billing_exempt\)[\s\S]*false/);
});

test("provisioning uses persistent idempotency and rejects changed payloads", () => {
  assert.match(sql, /request_key text not null unique/);
  assert.match(sql, /request_payload_hash text not null/);
  assert.match(sql, /digest\(/);
  assert.match(sql, /idempotency key was already used with a different request/);
});

test("customer provisioning cannot rent Platform Admin", () => {
  assert.match(sql, /if app_key in \('PLATFORM_ADMIN','CUSTOMER_ADMIN'\) then continue/);
});

test("migration contains no destructive data operations", () => {
  assert.doesNotMatch(sql, /\b(drop table|drop schema|truncate|delete from)\b/i);
});
