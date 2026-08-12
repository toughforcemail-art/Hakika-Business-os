import "server-only";

import { getRedis, isRedisConfigured } from "@/lib/redis/server";

export async function checkRedisHealth() {
  if (!isRedisConfigured()) return { ok: false, service: "redis" as const, reason: "missing_configuration" };
  try { await getRedis().ping(); return { ok: true, service: "redis" as const }; }
  catch { return { ok: false, service: "redis" as const, reason: "unavailable" }; }
}
