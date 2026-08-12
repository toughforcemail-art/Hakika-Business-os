import { assert, assertEquals, assertMatch } from "jsr:@std/assert@^1";
import { handleRequest } from "./index.ts";

const rawSecret = "test-hook-secret";
const encodedSecret = `v1,whsec_${btoa(rawSecret)}`;
const phone = "+254712345678";
const otp = "123456";

async function signedRequest(
  body: unknown,
  method = "POST",
  secret = encodedSecret,
): Promise<Request> {
  const raw = JSON.stringify(body);
  const id = "msg_test_123";
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const key = Uint8Array.from(
    atob(secret.replace("v1,whsec_", "")),
    (char) => char.charCodeAt(0),
  );
  const data = new TextEncoder().encode(`${id}.${timestamp}.${raw}`);
  const signature = await crypto.subtle.sign(
    "HMAC",
    await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    ),
    data,
  );
  const encoded = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return new Request("https://example.test/functions/v1/send-sms", {
    method,
    body: method === "POST" ? raw : undefined,
    headers: {
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${encoded}`,
    },
  });
}

function setup(environment = "sandbox", username = "sandbox") {
  Deno.env.set("SEND_SMS_HOOK_SECRET", encodedSecret);
  Deno.env.set("AFRICASTALKING_USERNAME", username);
  Deno.env.set("AFRICASTALKING_API_KEY", "fake-key");
  Deno.env.set("AFRICASTALKING_ENVIRONMENT", environment);
}

const validEvent = { user: { phone }, sms: { otp } };

Deno.test("rejects unsigned, invalid-signature and non-POST requests", async () => {
  setup();
  assertEquals(
    (await handleRequest(
      new Request("https://example.test", {
        method: "POST",
        body: JSON.stringify(validEvent),
      }),
      fetch,
    )).status,
    401,
  );
  assertEquals(
    (await handleRequest(
      await signedRequest(validEvent, "POST", `v1,whsec_${btoa("wrong")}`),
      fetch,
    )).status,
    401,
  );
  assertEquals(
    (await handleRequest(await signedRequest(validEvent, "GET"), fetch)).status,
    405,
  );
});

Deno.test("rejects malformed signed payloads", async () => {
  setup();
  assertEquals(
    (await handleRequest(
      await signedRequest({ user: { phone: "071234" }, sms: { otp } }),
      fetch,
    )).status,
    400,
  );
  assertEquals(
    (await handleRequest(
      await signedRequest({ user: { phone }, sms: {} }),
      fetch,
    )).status,
    400,
  );
});

Deno.test("validates sandbox and production configuration", async () => {
  setup("sandbox", "wrong");
  assertEquals(
    (await handleRequest(
      await signedRequest(validEvent),
      async () => new Response("unused"),
    )).status,
    500,
  );
  setup("production", "sandbox");
  assertEquals(
    (await handleRequest(
      await signedRequest(validEvent),
      async () => new Response("unused"),
    )).status,
    500,
  );
  setup("production", "hakika");
  let called = "";
  const result = await handleRequest(
    await signedRequest(validEvent),
    async (url, init) => {
      called = `${url}|${String(init?.body)}`;
      return new Response(
        JSON.stringify({
          SMSMessageData: {
            Recipients: [{ number: phone, statusCode: 100, status: "Sent" }],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  );
  assertEquals(result.status, 200);
  assertMatch(called, /api\.africastalking\.com\/version1\/messaging/);
  assertMatch(
    called,
    /Your\+Hakika\+Business\+OS\+verification\+code\+is\+123456/,
  );
});

Deno.test("rejects provider failures, malformed JSON, and rejected recipients", async () => {
  setup();
  const request = await signedRequest(validEvent);
  assertEquals(
    (await handleRequest(
      request,
      async () => new Response("no", { status: 500 }),
    )).status,
    502,
  );
  assertEquals(
    (await handleRequest(
      await signedRequest(validEvent),
      async () => new Response("no", { status: 200 }),
    )).status,
    502,
  );
  assertEquals(
    (await handleRequest(
      await signedRequest(validEvent),
      async () =>
        new Response(
          JSON.stringify({
            SMSMessageData: {
              Recipients: [{
                number: phone,
                statusCode: 406,
                status: "Rejected",
              }],
            },
          }),
          { status: 200 },
        ),
    )).status,
    502,
  );
});

Deno.test("provider timeout is sanitized", async () => {
  setup();
  const response = await handleRequest(
    await signedRequest(validEvent),
    async (_url, init) => {
      await new Promise<void>((resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("timed out", "TimeoutError")),
        );
      });
      return new Response();
    },
  );
  assertEquals(response.status, 504);
  assert((await response.text()).includes("SMS delivery timed out"));
});

Deno.test("missing provider configuration returns 500 and logs are sanitized", async () => {
  setup();
  Deno.env.delete("AFRICASTALKING_API_KEY");
  assertEquals(
    (await handleRequest(
      await signedRequest(validEvent),
      async () => new Response("unused"),
    )).status,
    500,
  );

  setup("production", "hakika");
  const lines: string[] = [];
  const originalInfo = console.info;
  const originalError = console.error;
  console.info = (...args: unknown[]) => lines.push(args.join(" "));
  console.error = (...args: unknown[]) => lines.push(args.join(" "));
  try {
    await handleRequest(
      await signedRequest(validEvent),
      async () =>
        new Response(
          JSON.stringify({
            SMSMessageData: {
              Recipients: [{ number: phone, statusCode: 100, status: "Sent" }],
            },
          }),
          { status: 200 },
        ),
    );
  } finally {
    console.info = originalInfo;
    console.error = originalError;
  }
  const output = lines.join("\n");
  assert(!output.includes(otp));
  assert(!output.includes(phone));
  assert(output.includes("+254******678"));
});
