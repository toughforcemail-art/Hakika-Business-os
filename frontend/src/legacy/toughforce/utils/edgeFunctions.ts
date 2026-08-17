// @ts-nocheck
import supabase, { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase';

type InvokeEdgeOptions = {
  accessToken?: string | null;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  signal?: AbortSignal;
  allowAnon?: boolean;
};

const parseResponseBody = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const base64UrlDecode = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
  if (typeof atob !== 'undefined') {
    return atob(padded);
  }
  return Buffer.from(padded, 'base64').toString('utf-8');
};

const getJwtExp = (token: string) => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(base64UrlDecode(payload));
    return typeof decoded?.exp === 'number' ? decoded.exp : null;
  } catch {
    return null;
  }
};

const isTokenStale = (token: string, bufferMs = 30000) => {
  const exp = getJwtExp(token);
  if (!exp) return false;
  return exp * 1000 <= Date.now() + bufferMs;
};

const getFreshAccessToken = async (forceRefresh = false): Promise<string | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
};

const isAuthError = (status: number, data: any) => {
  if (status !== 400 && status !== 401 && status !== 403) return false;
  const message = (typeof data === 'object' && (data?.error || data?.message)) || (typeof data === 'string' ? data : '');
  if (!message) return status === 401;
  return /invalid|expired|authorization|jwt/i.test(String(message));
};

export const invokeEdgeFunction = async <T = any>(
  functionName: string,
  body?: any,
  options?: InvokeEdgeOptions
): Promise<T> => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase URL or anon key');
  }

  const method = options?.method ?? 'POST';
  const allowAnon = options?.allowAnon ?? false;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 8000);

  if (options?.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener('abort', () => controller.abort());
    }
  }

  try {
    let token = options?.accessToken;
    try {
      if (token === undefined) {
        token = await getFreshAccessToken();
      } else if (token && isTokenStale(token)) {
        token = await getFreshAccessToken(true);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError' || String(error?.message || '').includes('aborted')) {
        throw new Error(`Edge Function ${functionName} request was aborted`);
      }
      throw error;
    }

    if (!token && !allowAnon) {
      throw new Error('Authentication required. Please sign in again.');
    }

    const makeHeaders = (authToken: string | null): Record<string, string> => {
      const headers: Record<string, string> = {
        'x-client-info': 'supabase-js-web',
        ...options?.headers,
      };
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      } else {
        headers.apikey = SUPABASE_ANON_KEY;
      }
      if (method !== 'GET') {
        headers['Content-Type'] = 'application/json';
      }
      return headers;
    };

    const makeRequest = async (authToken: string | null) => {
      try {
        return await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
          method,
          headers: makeHeaders(authToken),
          body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
          signal: controller.signal,
        });
      } catch (error: any) {
        if (error?.name === 'AbortError' || String(error?.message || '').includes('aborted')) {
          throw new Error(`Edge Function ${functionName} request was aborted`);
        }
        throw error;
      }
    };

    let response = await makeRequest(token);
    let data = await parseResponseBody(response);

    if (!response.ok && isAuthError(response.status, data) && !allowAnon) {
      const refreshedToken = await getFreshAccessToken(true);
      if (refreshedToken && refreshedToken !== token) {
        token = refreshedToken;
        response = await makeRequest(token);
        data = await parseResponseBody(response);
      }
    }

    if (!response.ok) {
      const message =
        (typeof data === 'object' && data?.error) ||
        (typeof data === 'object' && data?.message) ||
        (typeof data === 'string' && data) ||
        `Edge Function ${functionName} failed with ${response.status}`;
      const error = new Error(message);
      (error as any).status = response.status;
      (error as any).data = data;
      throw error;
    }

    return data as T;
  } finally {
    clearTimeout(timeoutId);
  }
};
