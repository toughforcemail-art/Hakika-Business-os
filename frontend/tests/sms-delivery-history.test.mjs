import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const root = process.cwd();
test("custom SMS delivery uses the canonical communications history", () => { const sql=readFileSync(join(root,"..","backend","supabase","migrations","0014_communications_delivery_events.sql"),"utf8"); const edge=readFileSync(join(root,"..","backend","supabase","functions","send-notification","index.ts"),"utf8"); assert.match(sql,/communications\.delivery_events/); assert.match(sql,/enable row level security/); assert.match(sql,/communications\.sms\.send/); assert.match(edge,/delivery_events/); assert.match(edge,/message_body/); });
