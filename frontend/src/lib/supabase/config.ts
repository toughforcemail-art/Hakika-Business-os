const TARGET_PROJECT_REF = "upvupkuokinwqwsfxyxy";

export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) throw new Error("Supabase browser configuration is missing.");
  if (new URL(url).hostname !== `${TARGET_PROJECT_REF}.supabase.co`) {
    throw new Error("Supabase configuration points to an unexpected project.");
  }

  return { url, publishableKey, cookiePrefix: `sb-${TARGET_PROJECT_REF}-auth-token` };
}
