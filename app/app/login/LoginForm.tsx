'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  next?: string;
  serverError?: string;
}

export default function LoginForm({ next, serverError }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(
    serverError === 'missing_auth_params'
      ? 'Auth callback received no token. Check Supabase → Authentication → URL Configuration: Site URL and Redirect URLs must include http://localhost:3000.'
      : (serverError ? decodeURIComponent(serverError) : ''),
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`;

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  const s: Record<string, React.CSSProperties> = {
    wrap: {
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: 24,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: 32,
    },
    label: {
      display: 'block',
      fontSize: 10,
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
      color: 'var(--text-muted)',
      marginBottom: 20,
    },
    title: {
      fontSize: 15,
      fontWeight: 600,
      color: 'var(--text)',
      marginBottom: 6,
    },
    sub: {
      fontSize: 12,
      color: 'var(--text-muted)',
      marginBottom: 24,
    },
    input: {
      width: '100%',
      fontFamily: 'inherit',
      fontSize: 13,
      padding: '9px 12px',
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      color: 'var(--text)',
      outline: 'none',
      marginBottom: 12,
      boxSizing: 'border-box' as const,
    },
    btn: {
      width: '100%',
      fontFamily: 'inherit',
      fontSize: 12,
      letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
      padding: '9px 0',
      background: 'var(--accent)',
      border: 'none',
      borderRadius: 6,
      color: '#fff',
      cursor: 'pointer',
      opacity: loading ? 0.6 : 1,
    },
    err: {
      fontSize: 11,
      color: '#c94a4a',
      marginBottom: 12,
    },
    check: {
      fontSize: 13,
      color: 'var(--text-muted)',
      textAlign: 'center' as const,
      lineHeight: 1.6,
    },
  };

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.label}>Dynamo — Liquidity Terminal</div>

        {sent ? (
          <div style={s.check}>
            <div style={{ fontSize: 22, marginBottom: 12 }}>✉</div>
            <div style={{ color: 'var(--text)', marginBottom: 6 }}>Check your email</div>
            Magic link sent to <strong>{email}</strong>.<br />
            Click the link to sign in.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={s.title}>Sign in</div>
            <div style={s.sub}>We&apos;ll email you a magic link.</div>

            {error && <div style={s.err}>{error}</div>}

            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              style={s.input}
            />
            <button type="submit" disabled={loading} style={s.btn}>
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
