// @ts-nocheck
import type { AppDefinition } from '../types';

export const REAL_ESTATE: AppDefinition = {
  id: 'real-estate', slug: 'real-estate', displayName: 'Real Estate',
  description: 'Property, tenant, lease, landlord, and maintenance operations.',
  route: '/app/real-estate', iconKey: 'building-2', subscriptionCode: 'hakika',
  requiredPermissions: [], defaultLandingPage: '/app/real-estate/dashboard', enabled: true, order: 4, category: 'business',
};
