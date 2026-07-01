import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes reachable without a session. `/login` is the sign-in page; `/api`
// routes are excluded from the session gate because they authenticate
// themselves (cron via CRON_SECRET, capture via a bearer token / their own
// getUser check). Without this, requests that carry a bearer token but no
// session cookie — the GitHub Actions crons and the iOS capture shortcut — get
// 302-redirected to /login and their handlers never run. Everything else under
// (app)/** stays gated.
const PUBLIC_PATHS = ["/login", "/api"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Refreshes the Supabase auth session on every matched request, keeps the
 * session cookies in sync between request and response, and enforces route
 * protection: unauthenticated users hitting a private route are redirected to
 * /login; authenticated users hitting /login are sent to /today.
 *
 * IMPORTANT: always return the `supabaseResponse` object (or a redirect that
 * copies its cookies) so the refreshed session survives — see the
 * @supabase/ssr Next.js guide.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getUser() — it refreshes the
  // session and any logic in between can cause hard-to-debug logout bugs.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // No session on a private route → send to /login.
  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Already signed in but sitting on /login → forward into the app.
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/today";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
