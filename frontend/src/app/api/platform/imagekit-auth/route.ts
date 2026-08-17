import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/server";

export async function GET() {
  await requireAuthenticatedUser();
  const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;
  const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!publicKey || !urlEndpoint || !privateKey) return NextResponse.json({ error: "Image uploads are not configured" }, { status: 501 });
  const token = crypto.randomUUID().replaceAll("-", "");
  const expire = Math.floor(Date.now() / 1000) + 10 * 60;
  const signature = await crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", new TextEncoder().encode(privateKey), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]), new TextEncoder().encode(token + expire));
  const signatureHex = [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return NextResponse.json({ token, expire, signature: signatureHex, publicKey, urlEndpoint });
}
