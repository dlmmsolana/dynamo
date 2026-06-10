import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write cookies onto both the request (for downstream Server Components)
          // and the response (so the browser receives them).
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the session — this is required on every request so tokens don't expire.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Guard: only /portfolio requires auth
  if (!user && request.nextUrl.pathname.startsWith('/portfolio')) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect logged-in users away from the login page
  if (user && request.nextUrl.pathname === '/login') {
    const portfolioUrl = request.nextUrl.clone();
    portfolioUrl.pathname = '/portfolio';
    portfolioUrl.search = '';
    return NextResponse.redirect(portfolioUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // Skip static assets and Next.js internals; run on everything else
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
