import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    });
  }
  return client;
}

export async function loginWith(provider: 'google' | 'facebook') {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Missing Supabase public environment variables in .env.local');
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) throw error;
}

/** One-time recovery for redirects from the previous implicit-flow release.
 * Always remove tokens from the visible browser address immediately.
 */
export async function recoverLegacyOAuthFragment() {
  if (typeof window === 'undefined') return;
  const fragment = window.location.hash;
  if (!fragment.includes('access_token=')) return;
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  window.history.replaceState({}, '', window.location.pathname + window.location.search);
  if (!access_token || !refresh_token) throw new Error('OAuth returned an incomplete session. Please sign in again.');
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase has not been configured.');
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
}
