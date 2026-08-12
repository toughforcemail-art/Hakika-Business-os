import "server-only";

import { createHash } from "node:crypto";

function hash(value: string) { return createHash("sha256").update(value).digest("hex").slice(0, 32); }

export function redisKey(resource: string, identifier: string, context?: { environment?: string; organizationId?: string; companyId?: string }) {
  const prefix = process.env.REDIS_KEY_PREFIX || "hakika";
  const environment = context?.environment || process.env.NODE_ENV || "development";
  return [prefix, environment, context?.organizationId || "global", context?.companyId || "global", resource, hash(identifier)].join(":");
}
