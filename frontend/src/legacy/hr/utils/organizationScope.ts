// @ts-nocheck
import { supabase } from './supabase';

export interface OrganizationScopedProfile {
  organization_id?: string | null;
  company_id?: string | null;
  company_code?: string | null;
}

export interface OrganizationScopeResolution {
  organizationId: string | null;
  notice: string | null;
}

export const resolveOrganizationScope = async (
  profile?: OrganizationScopedProfile | null,
): Promise<OrganizationScopeResolution> => {
  if (profile?.organization_id) {
    return {
      organizationId: profile.organization_id,
      notice: null,
    };
  }

  if (profile?.company_id) {
    const { data, error } = await supabase
      .from('companies')
      .select('organization_id')
      .eq('id', profile.company_id)
      .maybeSingle();

    if (error) {
      console.warn('resolveOrganizationScope: company lookup failed, trying fallback scope.', error);
    }

    if (data?.organization_id) {
      return {
        organizationId: data.organization_id,
        notice: 'Using your linked company organization until your profile finishes syncing.',
      };
    }
  }

  if (profile?.company_code) {
    const { data, error } = await supabase
      .from('companies')
      .select('organization_id')
      .eq('code', profile.company_code)
      .maybeSingle();

    if (error) {
      console.warn('resolveOrganizationScope: company code lookup failed, trying fallback scope.', error);
    }

    if (data?.organization_id) {
      return {
        organizationId: data.organization_id,
        notice: 'Using your company code mapping until your profile finishes syncing.',
      };
    }
  }

  // Fail closed. Selecting an arbitrary organization can expose another
  // customer's data during first login or profile synchronization.
  return {
    organizationId: null,
    notice: 'No organization mapping was found. Workspace data is unavailable until your account is provisioned.',
  };
};
