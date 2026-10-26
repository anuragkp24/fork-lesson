import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { NEXT_COOKIE } from "@/lib/onboarding/gate";

type CookieToSet = { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] };

const PROTECTED_ROUTES = ["/lessons", "/library", "/lesson", "/welcome"];


export async function proxy(request: NextRequest) {
  // Cookies to forward to the page (on the request) and to the browser (on
  // the response). The response is built once they're all known.
  const cookiesToSet: CookieToSet[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(supabaseCookies) {
          supabaseCookies.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.push(...supabaseCookies);
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const response = NextResponse.next({ request });
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));

  // An invalid or expired refresh token counts as "no user", but getUser()
  // never clears the dead cookie, so the browser would resend it forever.
  if (error) {
    request.cookies.getAll().forEach((cookie) => {
      if (cookie.name.startsWith("sb-")) response.cookies.delete(cookie.name);
    });
  }

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
  if (isProtected && !user) {
    const toLogin = NextResponse.redirect(new URL("/login", request.url));
    // A link to a lesson survives sign-in and onboarding (auth callback).
    if (pathname.startsWith("/lesson/")) {
      toLogin.cookies.set(NEXT_COOKIE, pathname, { path: "/", maxAge: 15 * 60, httpOnly: true, sameSite: "lax" });
    }
    return toLogin;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
