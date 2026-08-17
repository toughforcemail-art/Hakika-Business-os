// @ts-nocheck
import type { AppDefinition } from '../types';

export const CONTACT_CENTRE: AppDefinition = {
  id: 'contact-centre', slug: 'contact-centre', displayName: 'Contact Centre',
  description: 'Customer communications and contact centre operations.',
  route: '/app/contact-centre', iconKey: 'headphones', subscriptionCode: 'contact_centre',
  requiredPermissions: [], defaultLandingPage: '/app/contact-centre/dashboard', enabled: true, order: 7, category: 'operations',
};
