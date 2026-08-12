import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { redisKey } from "@/lib/redis/keys";
import { getRedis } from "@/lib/redis/server";

const limiters = new Map<string, Ratelimit>();

export function getRateLimiter(policy: string, limit: number, window: `${number} s` | `${number} m` | `${number} h`) {
  const cacheKey = `${policy}:${limit}:${window}`;
  const existing = limiters.get(cacheKey);
  if (existing) return existing;
  const limiter = new Ratelimit({ redis: getRedis(), limiter: Ratelimit.slidingWindow(limit, window), prefix: `${process.env.REDIS_KEY_PREFIX || "hakika"}:ratelimit:${policy}` });
  limiters.set(cacheKey, limiter);
  return limiter;
}

export async function enforceRateLimit(policy: string, identifier: string, limit: number, window: `${number} s` | `${number} m` | `${number} h`, context?: { organizationId?: string; companyId?: string }) {
  return getRateLimiter(policy, limit, window).limit(redisKey(policy, identifier, context));
}
