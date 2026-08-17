// @ts-nocheck
export function extractEdgeFunctionErrorMessage(error: any, fallback = 'Request failed'): string {
  if (!error) return fallback;

  const contextBody = error?.context?.body;
  if (contextBody) {
    if (typeof contextBody === 'string') {
      const trimmed = contextBody.trim();
      if (trimmed.length > 0) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed?.error) return String(parsed.error);
          if (parsed?.message) return String(parsed.message);
          if (parsed?.details) return typeof parsed.details === 'string' ? parsed.details : JSON.stringify(parsed.details);
          return trimmed;
        } catch {
          return trimmed;
        }
      }
    } else if (typeof contextBody === 'object') {
      if (contextBody?.error) return String(contextBody.error);
      if (contextBody?.message) return String(contextBody.message);
      if (contextBody?.details) return typeof contextBody.details === 'string' ? contextBody.details : JSON.stringify(contextBody.details);
    }
  }

  if (error?.message) return String(error.message);
  return fallback;
}
