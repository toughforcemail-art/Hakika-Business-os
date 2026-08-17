// @ts-nocheck
import type { AppDefinition } from '../types';

export const CHURCH: AppDefinition = {
  id: 'church', slug: 'church', displayName: 'Church Management',
  description: 'Church and community program management.',
  route: '/app/church', iconKey: 'church', subscriptionCode: 'church',
  requiredPermissions: [], defaultLandingPage: '/app/church/dashboard', enabled: true, order: 6, category: 'community',
};
