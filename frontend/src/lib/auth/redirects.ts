export function safeAuthDestination(value: string | null | undefined, fallback = "/apps") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
