import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

const staleCookiePattern = /^sb-.+-auth-token(?:\.\d+|-code-verifier)?$/;

function findDevelopmentStaleCookies(request: NextRequest, cookiePrefix: string) {
  if (process.env.NODE_ENV !== "development") return [];

  return request.cookies.getAll()
    .filter(({ name }) => staleCookiePattern.test(name) && !name.startsWith(cookiePrefix))
    .map(({ name }) => name);
}

function expireCookies(response: NextResponse, names: string[]) {
  names.forEach((name) => response.cookies.set(name, "", { path: "/", maxAge: 0 }));
}

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey, cookiePrefix } = getSupabasePublicConfig();
  const staleCookieNames = findDevelopmentStaleCookies(request, cookiePrefix);
  staleCookieNames.forEach((name) => request.cookies.delete(name));
  expireCookies(response, staleCookieNames);

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        expireCookies(response, staleCookieNames);
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  return { response, claims: error ? null : data?.claims ?? null };
}

export function redirectWithSupabaseCookies(destination: URL, response: NextResponse) {
  const redirect = NextResponse.redirect(destination);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}
