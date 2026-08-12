import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const root = process.cwd();
test("SMS test page uses the shared authenticated communications flow", () => { const page=readFileSync(join(root,"src","app","platform","sms-test","page.tsx"),"utf8"); const client=readFileSync(join(root,"src","components","SmsTestClient.tsx"),"utf8"); assert.match(page,/requireHakikaLoginVerification/); assert.match(page,/getAccessibleApplications/); assert.match(page,/maskPhone/); assert.match(client,/\/api\/notifications\/sms/); assert.match(client,/Phone number/); assert.match(client,/Message/); assert.doesNotMatch(client,/AFRICASTALKING_API_KEY/); });
