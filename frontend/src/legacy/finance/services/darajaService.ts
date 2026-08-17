// @ts-nocheck
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '../utils/supabase';

export type DarajaAction =
  | 'auth'
  | 'stk-push'
  | 'stk-query'
  | 'c2b-register-url'
  | 'c2b-simulate'
  | 'b2c-payment-request'
  | 'transaction-status-query'
  | 'account-balance-query'
  | 'pull-register'
  | 'pull-query'
  | 'b2b-payment-request'
  | 'reversal-request'
  | 'dynamic-qr-generate';

export type DarajaPayload = Record<string, unknown> & { action: DarajaAction };

export async function callDaraja<T = any>(payload: DarajaPayload): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  const response = await fetch(`${SUPABASE_URL}/functions/v1/mpesa-daraja`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const parsed = (() => {
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  })();

  if (!response.ok) {
    throw new Error(parsed?.error || parsed?.message || parsed?.hint || text || 'Daraja request failed');
  }

  return parsed as T;
}

export async function postMpesaCallback<T = any>(
  payload: Record<string, unknown>,
  headers: Record<string, string> = {},
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  const response = await fetch(`${SUPABASE_URL}/functions/v1/payment-callback-ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const parsed = (() => {
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  })();

  if (!response.ok) {
    throw new Error(parsed?.error || parsed?.message || parsed?.hint || text || 'Callback ingest failed');
  }

  return parsed as T;
}
