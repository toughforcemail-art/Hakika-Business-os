// @ts-nocheck
import type { AppDefinition } from '../types';

export const HAKIKA_PAY: AppDefinition = {
  id: 'hakika-pay', slug: 'hakika-pay', displayName: 'HakikaPay',
  description: 'Payment collection and payment operations.',
  route: '/app/hakika-pay', iconKey: 'credit-card', subscriptionCode: 'hakika_pay',
  requiredPermissions: [], defaultLandingPage: '/app/hakika-pay/dashboard', enabled: true, order: 8, category: 'finance',
};
