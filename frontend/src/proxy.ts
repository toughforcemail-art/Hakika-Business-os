import { NextResponse, type NextRequest } from "next/server";
import { redirectWithSupabaseCookies, updateSupabaseSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/_next/") || pathname === "/favicon.ico" || pathname === "/robots.txt" || pathname === "/sitemap.xml") {
    return NextResponse.next();
  }
  const session = await updateSupabaseSession(request);
  const protectedPath = ["/apps", "/admin/", "/platform/", "/real-estate/", "/hr/", "/finance/", "/toughforce/"].some((prefix) => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix));
  if (!protectedPath) return session.response;
  if (!session.claims?.sub) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return redirectWithSupabaseCookies(login, session.response);
  }
  return session.response;
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf)$).*)"],
};
