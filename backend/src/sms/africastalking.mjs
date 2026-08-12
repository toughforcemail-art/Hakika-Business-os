import { normalizeSmsPhone } from "./phone.mjs";

const AFRICA_TALKING_SMS_URL = "https://api.africastalking.com/version1/messaging";

/**
 * Server-only Africa's Talking SMS adapter.
 * Credentials are read at call time and are never returned to callers.
 */
export async function sendSms({ to, message, senderId }) {
  const username = process.env.AFRICASTALKING_USERNAME;
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  const destination = normalizeSmsPhone(to);
  if (!username || !apiKey) throw new Error("Africa's Talking SMS is not configured.");
  if (!destination) throw new Error("SMS destination must be a valid E.164 number.");
  if (!message?.trim()) throw new Error("SMS message is required.");

  const body = new URLSearchParams({ username, to: destination, message: message.trim() });
  if (senderId) body.set("from", senderId);
  const response = await fetch(AFRICA_TALKING_SMS_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", apiKey },
    body,
  });
  if (!response.ok) throw new Error(`Africa's Talking SMS request failed (${response.status}).`);
  return response.json();
}
