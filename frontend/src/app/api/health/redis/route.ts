import { NextResponse } from "next/server";
import { checkRedisHealth } from "@/lib/redis/health";

export async function GET() {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  const result = await checkRedisHealth();
  return NextResponse.json({ ok: result.ok, service: result.service }, { status: result.ok ? 200 : 503 });
}
