import "server-only";

import { appMfaStatus } from "@/lib/backend/proxy";
import { requireAuthenticatedUser } from "@/lib/auth/server";

export async function requireHakikaStepUp() {
  const auth = await requireAuthenticatedUser();
  const response = await appMfaStatus();
  if (!response.ok) throw new Error("Hakika step-up required");
  const result = await response.json() as { verified?: boolean };
  if (!result.verified) throw new Error("Hakika step-up required");
  return auth;
}
