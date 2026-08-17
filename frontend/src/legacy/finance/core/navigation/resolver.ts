// @ts-nocheck
import type { WorkspaceAdapterValue } from '../../context/WorkspaceAdapter';
import { getApplications } from '../apps/registry';
import type { AppDefinition } from '../apps/types';
import type { NavigationItem } from './types';

const hasRequiredPermissions = (application: AppDefinition, adapter: WorkspaceAdapterValue) => (
  application.requiredPermissions.every((permission) => adapter.hasPermission(permission))
);

const isSubscribed = (application: AppDefinition, adapter: WorkspaceAdapterValue) => (
  !application.subscriptionCode || adapter.isSubscribed(application.subscriptionCode)
);

const toNavigationItem = (application: AppDefinition, adapter: WorkspaceAdapterValue): NavigationItem => {
  const enabled = application.enabled;
  const visible = enabled && hasRequiredPermissions(application, adapter) && isSubscribed(application, adapter);

  return {
    id: application.id,
    title: application.displayName,
    iconKey: application.iconKey,
    route: application.route,
    applicationId: application.id,
    requiredPermissions: application.requiredPermissions,
    requiredSubscription: application.subscriptionCode || null,
    visible,
    enabled,
    badge: null,
    children: [],
    order: application.order,
  };
};

export function getApplicationNavigation(
  application: AppDefinition,
  adapter: WorkspaceAdapterValue,
): NavigationItem {
  return toNavigationItem(application, adapter);
}

export function getNavigation(
  adapter: WorkspaceAdapterValue,
  applications: readonly AppDefinition[] = getApplications(),
): NavigationItem[] {
  return applications
    .map((application) => toNavigationItem(application, adapter))
    .sort((left, right) => left.order - right.order);
}

export function filterNavigation(
  navigation: readonly NavigationItem[],
): NavigationItem[] {
  return navigation
    .filter((item) => item.visible && item.enabled)
    .map((item) => ({
      ...item,
      children: filterNavigation(item.children),
    }));
}
