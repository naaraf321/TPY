'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase, recoverLegacyOAuthFragment } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const once = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (once.current) return;
    once.current = true;
    async function finish() {
      const supabase = getSupabase();
      if (!supabase) throw new Error('Supabase is not configured in .env.local');
      if (window.location.hash.includes('access_token=')) {
        await recoverLegacyOAuthFragment();
      } else {
        const params = new URLSearchParams(window.location.search);
        const oauthError = params.get('error_description') || params.get('error');
        if (oauthError) throw new Error(oauthError);
        const code = params.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }
      }
      window.history.replaceState({}, '', '/auth/callback');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error(sessionError?.message || 'Sign-in did not produce a session. Try again.');
      router.replace('/');
    }
    finish().catch((e: unknown) => {
      // Do not leave one-time OAuth codes or errors in browser history.
      window.history.replaceState({}, '', '/auth/callback');
      setError(e instanceof Error ? e.message : 'Unable to complete sign-in.');
    });
  }, [router]);

  return <main className="auth-callback">
    <div className="gate-card">
      <h1>{error ? 'Sign-in needs attention' : 'Signing you in…'}</h1>
      <p>{error || 'Your Google or Facebook session is being verified securely.'}</p>
      {error && <a className="primary" href="/">Back to sign in</a>}
    </div>
  </main>;
}
