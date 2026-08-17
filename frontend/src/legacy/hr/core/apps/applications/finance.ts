// @ts-nocheck
import type { AppDefinition } from '../types';

export const FINANCE: AppDefinition = {
  id: 'finance', slug: 'finance', displayName: 'Finance',
  description: 'Finance, accounting, payments, and reporting operations.',
  route: '/app/finance', iconKey: 'wallet-cards', subscriptionCode: 'finance',
  requiredPermissions: [], defaultLandingPage: '/app/finance/dashboard', enabled: true, order: 3, category: 'finance',
};
