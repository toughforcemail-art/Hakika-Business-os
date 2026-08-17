// @ts-nocheck
import type { AppDefinition } from '../types';

export const HAKIKA: AppDefinition = {
  id: 'hakika', slug: 'hakika', displayName: 'Hakika',
  description: 'Hakika platform operations and workspace management.',
  route: '/app/dashboard', iconKey: 'layout-dashboard', subscriptionCode: 'hakika',
  requiredPermissions: [], defaultLandingPage: '/app/dashboard', enabled: true, order: 1, category: 'platform',
};
