import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get('code');           // PKCE flow
  const tokenHash = searchParams.get('token_hash'); // email OTP / magic link flow
  const type = searchParams.get('type') as
    | 'signup'
    | 'recovery'
    | 'invite'
    | 'email'
    | 'magiclink'
    | null;
  const next = searchParams.get('next') ?? '/portfolio';

  const cookieStore = await cookies();

  function makeClient() {
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          },
        },
      },
    );
  }

  // ── PKCE flow: Supabase sends ?code= after verifying the magic link ──────────
  if (code) {
    const supabase = makeClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error('[auth/callback] exchangeCodeForSession failed:', error.message);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  // ── Token hash flow: Supabase sends ?token_hash=&type= directly ──────────────
  // Used when the email link bypasses Supabase's own auth UI and points
  // straight at the app (common with signInWithOtp on some project configs).
  if (tokenHash && type) {
    const supabase = makeClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error('[auth/callback] verifyOtp failed:', error.message);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  // ── No usable params ─────────────────────────────────────────────────────────
  // Log the full URL so we can see what Supabase actually sent.
  console.error(
    '[auth/callback] No code or token_hash in URL. Full URL:',
    request.url,
  );
  return NextResponse.redirect(`${origin}/login?error=missing_auth_params`);
}
