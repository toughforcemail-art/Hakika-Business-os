// @ts-nocheck
import type { AppDefinition } from '../types';

export const HR: AppDefinition = {
  id: 'hr', slug: 'hr', displayName: 'Human Resources',
  description: 'Human resources, payroll, leave, and employee operations.',
  route: '/app/hr', iconKey: 'users', subscriptionCode: 'hr',
  requiredPermissions: [], defaultLandingPage: '/app/hr/dashboard', enabled: true, order: 2, category: 'business',
};
