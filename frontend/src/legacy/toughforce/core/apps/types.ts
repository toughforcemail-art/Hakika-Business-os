// @ts-nocheck
export type ApplicationCategory = 'platform' | 'business' | 'operations' | 'finance' | 'community';

export interface AppDefinition {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  route: string;
  iconKey: string;
  subscriptionCode: string;
  requiredPermissions: readonly string[];
  defaultLandingPage: string;
  enabled: boolean;
  order: number;
  category: ApplicationCategory;
}

export interface ApplicationSubscription {
  subscriptionCode: string;
  status?: string;
}
