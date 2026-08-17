// @ts-nocheck
import { supabase } from './supabase';

export interface TenantLookupResult {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  company_id: string | null;
  current_unit_id: string | null;
  id_document_url?: string | null;
  profile_image_url?: string | null;
  unit?: any;
}

/**
 * Resolve a tenant row for a portal user using indexed lookups.
 * We try login_username first, then fall back to email.
 */
export async function fetchTenantForPortalUser(email?: string | null) {
  if (!email) return null;

  const username = email.split('@')[0];

  const lookupAttempts = [
    { column: 'login_username', value: username },
    { column: 'email', value: email },
  ] as const;

  for (const attempt of lookupAttempts) {
    const { data, error } = await supabase
      .from('re_tenants')
      .select('id, full_name, phone, email, company_id, current_unit_id, id_document_url, profile_image_url, unit:re_units!current_unit_id(id, unit_number, property_id, property:re_properties(name))')
      .eq(attempt.column, attempt.value)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as TenantLookupResult;
  }

  return null;
}
