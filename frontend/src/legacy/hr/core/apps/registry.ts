// @ts-nocheck
import type { AppDefinition, ApplicationSubscription } from './types';
import { CHURCH } from './applications/church';
import { CONTACT_CENTRE } from './applications/contactCentre';
import { FINANCE } from './applications/finance';
import { HAKIKA_PAY } from './applications/hakikaPay';
import { HAKIKA } from './applications/hakika';
import { HR } from './applications/hr';
import { REAL_ESTATE } from './applications/realEstate';
import { TOUGHFORCE } from './applications/toughforce';

export const APPLICATIONS: readonly AppDefinition[] = [
  HAKIKA,
  HR,
  FINANCE,
  REAL_ESTATE,
  TOUGHFORCE,
  CHURCH,
  CONTACT_CENTRE,
  HAKIKA_PAY,
].sort((left, right) => left.order - right.order);

export function getApplication(idOrSlug: string): AppDefinition | undefined {
  return APPLICATIONS.find((application) => application.id === idOrSlug || application.slug === idOrSlug);
}

export function getApplications(): readonly AppDefinition[] {
  return APPLICATIONS;
}

export function getApplicationByRoute(route: string): AppDefinition | undefined {
  return APPLICATIONS.find((application) => route === application.route || route.startsWith(`${application.route}/`));
}

export function getSubscribedApplications(
  subscriptions: readonly ApplicationSubscription[],
): AppDefinition[] {
  const activeCodes = new Set(
    subscriptions
      .filter((subscription) => !subscription.status || subscription.status === 'active' || subscription.status === 'trialing')
      .map((subscription) => subscription.subscriptionCode),
  );
  return APPLICATIONS.filter((application) => application.enabled && activeCodes.has(application.subscriptionCode));
}
