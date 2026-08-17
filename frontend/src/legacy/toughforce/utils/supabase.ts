// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import { isAbortError } from './abortErrors';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase URL or Key");
}

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseKey;

export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
    },
    global: {
        headers: {
            apikey: supabaseKey
        }
    }
});

declare global {
  interface Window {
    __hakikaSupabaseAuthSyncUnsubscribe?: (() => void) | null;
    __hakikaInvalidRefreshHandlerInstalled?: boolean;
  }
}

// Ensure Edge Functions always receive the latest auth token
const syncFunctionsAuth = (accessToken?: string | null) => {
  if (accessToken) {
    supabase.functions.setAuth(accessToken);
  } else {
    supabase.functions.setAuth('');
  }
};

// Avoid forcing a session refresh during app bootstrap.
// The auth state listener below will sync the token once the client has one.
syncFunctionsAuth(null);

if (typeof window !== 'undefined') {
  window.__hakikaSupabaseAuthSyncUnsubscribe?.();
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    syncFunctionsAuth(session?.access_token ?? null);
  });
  window.__hakikaSupabaseAuthSyncUnsubscribe = () => subscription.unsubscribe();

  if (!window.__hakikaInvalidRefreshHandlerInstalled) {
    window.__hakikaInvalidRefreshHandlerInstalled = true;

    const clearSupabaseLocalState = () => {
      Object.keys(localStorage)
        .filter((key) => key.startsWith('sb-') || key.startsWith('supabase.'))
        .forEach((key) => localStorage.removeItem(key));

      Object.keys(sessionStorage)
        .filter((key) => key.startsWith('sb-') || key.startsWith('supabase.'))
        .forEach((key) => sessionStorage.removeItem(key));
    };

    const isInvalidRefreshTokenError = (value: unknown) => {
      const message = value instanceof Error
        ? value.message
        : typeof value === 'string'
          ? value
          : typeof value === 'object' && value !== null && 'message' in value
            ? String((value as { message?: unknown }).message ?? '')
            : '';

      return /invalid refresh token|refresh token not found/i.test(message);
    };

    const recoverFromInvalidRefreshToken = async () => {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        // Ignore sign-out failures; local cleanup still prevents the refresh loop.
      } finally {
        clearSupabaseLocalState();
        window.location.reload();
      }
    };

    window.addEventListener('unhandledrejection', (event) => {
      if (isInvalidRefreshTokenError(event.reason)) {
        event.preventDefault();
        void recoverFromInvalidRefreshToken();
      }
    });

    window.addEventListener('error', (event) => {
      if (isInvalidRefreshTokenError(event.error ?? event.message)) {
        void recoverFromInvalidRefreshToken();
      }
    });
  }
}

export default supabase;
