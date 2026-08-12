import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSmsPhone } from "../src/sms/phone.mjs";

test("normalizes Kenyan SMS destinations to +254 E.164", () => {
  assert.equal(normalizeSmsPhone("0712 345 678"), "+254712345678");
  assert.equal(normalizeSmsPhone("0787654321"), "+254787654321");
  assert.equal(normalizeSmsPhone("0112345678"), "+254112345678");
  assert.equal(normalizeSmsPhone("712345678"), "+254712345678");
  assert.equal(normalizeSmsPhone("254712345678"), "+254712345678");
  assert.equal(normalizeSmsPhone("254787654321"), "+254787654321");
  assert.equal(normalizeSmsPhone("+254712345678"), "+254712345678");
  assert.equal(normalizeSmsPhone("+254787654321"), "+254787654321");
  assert.equal(normalizeSmsPhone("01-1234 (5678)"), "+254112345678");
});

test("preserves explicit international SMS destinations", () => {
  assert.equal(normalizeSmsPhone("+447911123456"), "+447911123456");
  assert.equal(normalizeSmsPhone("00447911123456"), "+447911123456");
});

test("rejects malformed SMS destinations", () => {
  assert.equal(normalizeSmsPhone("071234"), null);
  assert.equal(normalizeSmsPhone("071234567890"), null);
  assert.equal(normalizeSmsPhone("hello"), null);
});
