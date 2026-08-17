// @ts-nocheck
import { supabase } from './supabase';

export interface CompanyScopedProfile {
  company_id?: string | null;
  company_code?: string | null;
}

export interface CompanyScopeResolution {
  companyId: string | null;
  notice: string | null;
}

export const resolveCompanyScope = async (
  profile?: CompanyScopedProfile | null,
): Promise<CompanyScopeResolution> => {
  // UUID is authoritative. Code is retained only as a compatibility fallback
  // for profiles that have not completed the migration yet.
  if (profile?.company_id) {
    const { data, error } = await supabase
      .from('companies')
      .select('id')
      .eq('id', profile.company_id)
      .maybeSingle();

    if (error) {
      console.warn('resolveCompanyScope: company code lookup failed, trying fallback scope.', error);
    }

    if (data?.id) {
      return {
        companyId: data.id,
        notice: null,
      };
    }
  }

  if (profile?.company_code) {
    const { data, error } = await supabase
      .from('companies')
      .select('id')
      .eq('code', profile.company_code)
      .maybeSingle();

    if (error) {
      console.warn('resolveCompanyScope: company id lookup failed, trying fallback scope.', error);
    }

    if (data?.id) {
      return {
        companyId: data.id,
        notice: 'Using the compatibility company code until your profile finishes syncing.',
      };
    }
  }

  return {
    companyId: null,
    notice: 'No company mapping was found yet.',
  };
};
