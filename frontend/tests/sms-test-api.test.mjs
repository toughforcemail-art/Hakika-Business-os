import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const root = process.cwd();
test("SMS test supports permission-authorized custom recipient and message", () => { const edge=readFileSync(join(root,"..","backend","supabase","functions","send-notification","index.ts"),"utf8"); const migration=readFileSync(join(root,"..","backend","supabase","migrations","0016_assign_sms_send_to_admin_roles.sql"),"utf8"); const client=readFileSync(join(root,"src","components","SmsTestClient.tsx"),"utf8"); assert.match(edge,/communications\.sms\.send/); assert.match(edge,/normalizePhone/); assert.match(edge,/message\.length > 320/); assert.match(migration,/role_permissions/); assert.match(migration,/is_read_only = false/); assert.match(client,/Phone number/); assert.match(client,/Message/); assert.match(client,/\/api\/notifications\/sms/); });
