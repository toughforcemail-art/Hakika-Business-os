// @ts-nocheck
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase';

const parseRpcResponse = async <T>(response: Response): Promise<T> => {
  const rawText = await response.text();
  
  if (!response.ok) {
    let errorMessage = 'We could not complete that request right now.';
    try {
      const errorData = JSON.parse(rawText);
      if (errorData?.message) {
        errorMessage = errorData.message;
      }
    } catch {
      errorMessage = rawText || errorMessage;
    }
    console.error(`RPC Error (${response.status}):`, errorMessage);
    throw new Error(errorMessage);
  }

  const parsed = rawText ? JSON.parse(rawText) : null;
  return parsed as T;
};

const callPublicRpc = async <T>(functionName: string, payload: Record<string, unknown>): Promise<T> => {
  if (!SUPABASE_ANON_KEY) {
    throw new Error('Supabase anonymous key is not configured');
  }
  if (!SUPABASE_URL) {
    throw new Error('Supabase URL is not configured');
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${functionName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return parseRpcResponse<T>(response);
  } catch (error) {
    console.error(`Failed to call RPC ${functionName}:`, error);
    throw error;
  }
};

export const lookupEmailByUsername = async (username: string): Promise<string | null> => {
  return callPublicRpc<string | null>('get_email_by_username', {
    username_input: username.trim(),
  });
};

export const createTwoFactorCode = async (userId: string, code: string): Promise<void> => {
  await callPublicRpc<null>('create_2fa_code', {
    user_id_uuid: userId,
    code_text: code.trim(),
  });
};

export const verifyTwoFactorCode = async (userId: string, code: string): Promise<boolean> => {
  return callPublicRpc<boolean>('verify_2fa_code', {
    user_id_uuid: userId,
    code_text: code.trim(),
  });
};

export interface TenantContactInfo {
  tenant_id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  login_username?: string | null;
}

export const lookupTenantContactByEmail = async (email: string): Promise<TenantContactInfo | null> => {
  return callPublicRpc<TenantContactInfo | null>('get_tenant_contact_by_email', {
    email_input: email.trim(),
  });
};

export const lookupProfileContactByEmail = async (email: string): Promise<TenantContactInfo | null> => {
  return callPublicRpc<TenantContactInfo | null>('get_profile_contact_by_email', {
    email_input: email.trim(),
  });
};
