// @ts-nocheck
import type { ComponentType } from 'react';

export type PlatformRouteStatus = 'HOSTED' | 'FALLBACK' | 'REDIRECT' | 'FUTURE';

export type PlatformRouteDefinition = {
  id: string;
  application: 'real-estate' | 'finance' | 'hr' | 'toughforce' | 'platform';
  productionRoute: string;
  previewRoute: string;
  title: string;
  status: PlatformRouteStatus;
  component?: ComponentType;
  featureFlag?: string;
};

/**
 * Shared route metadata for Platform Preview tooling. Components are attached
 * by the application adapter so this registry never creates a second page.
 */
export const platformRouteRegistry: PlatformRouteDefinition[] = [];

export const registerPlatformRoutes = (routes: PlatformRouteDefinition[]) => {
  platformRouteRegistry.splice(0, platformRouteRegistry.length, ...routes);
  return platformRouteRegistry;
};

export const findPlatformRoute = (productionRoute: string) =>
  platformRouteRegistry.find((route) => route.productionRoute === productionRoute);
