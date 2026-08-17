// @ts-nocheck
import type { AppDefinition } from '../types';

export const TOUGHFORCE: AppDefinition = {
  id: 'toughforce', slug: 'toughforce', displayName: 'ToughForce',
  description: 'Security operations, rostering, and field workforce management.',
  route: '/app/security', iconKey: 'shield-check', subscriptionCode: 'tough_force',
  requiredPermissions: [], defaultLandingPage: '/app/security/dashboard', enabled: true, order: 5, category: 'operations',
};
