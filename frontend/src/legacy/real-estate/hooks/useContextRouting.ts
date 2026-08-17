// @ts-nocheck
/**
 * Context Routing Hook
 * 
 * Handles all routing logic based on user contexts.
 * Implements the priority system:
 * 1. New service (< 24 hours)
 * 2. Last used context
 * 3. Primary context (staff)
 * 4. Fallback (welcome page)
 */

import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from './useAuth';
import { decodeJWT, Context, UserContexts } from '@/legacy/real-estate/utils/auth';
import { ServiceWelcomeModal, useWelcomeModal } from '@/legacy/real-estate/components/ServiceWelcomeModal';

const SERVICE_ROUTES: Record<string, string> = {
  hr: '/services/hr/dashboard',
  hakika: '/services/hakika/dashboard',
  tough_force: '/services/tough-force/dashboard',
  rock_of_ages: '/services/rock-of-ages/dashboard',
};

const CONTEXT_ROUTES: Record<string, string> = {
  staff: '/staff/dashboard',
  landlord: '/landlord/dashboard',
  tenant: '/tenant/dashboard',
  admin: '/admin/dashboard',
};

export interface UseContextRoutingReturn {
  isLoading: boolean;
  activeContext: Context | null;
  allContexts: Context[];
  switchContext: (context: Context) => Promise<void>;
  canShowWelcomeModal: boolean;
}

export function useContextRouting(): UseContextRoutingReturn {
  const router = useRouter();
  const { token, user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [activeContext, setActiveContext] = useState<Context | null>(null);
  const [allContexts, setAllContexts] = useState<Context[]>([]);
  const { showModal, serviceInfo, openModal, closeModal } = useWelcomeModal();

  /**
   * Determine which context to route to (Priority system)
   */
  const determineActiveContext = useCallback(async () => {
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const decoded = decodeJWT(token) as UserContexts;
      
      if (!decoded.contexts || decoded.contexts.length === 0) {
        setIsLoading(false);
        router.push('/welcome');
        return;
      }

      setAllContexts(decoded.contexts);
      const active = decoded.active_context;

      // Priority 1: Is there a NEW service? (activated < 24h ago)
      const newServiceContext = decoded.contexts.find(ctx => {
        if (ctx.type !== 'service_admin') return false;
        if (!ctx.activated_at) return false;
        const ageMs = Date.now() - new Date(ctx.activated_at).getTime();
        return ageMs < 24 * 60 * 60 * 1000; // 24 hours
      });

      if (newServiceContext && newServiceContext.service_key) {
        setActiveContext(newServiceContext);
        
        // Show welcome modal and route after
        openModal({
          serviceName: capitalizeFirstLetter(newServiceContext.service_key.replace(/_/g, ' ')),
          serviceKey: newServiceContext.service_key,
          serviceIcon: getServiceIcon(newServiceContext.service_key),
          description: getServiceDescription(newServiceContext.service_key),
          features: getServiceFeatures(newServiceContext.service_key),
          onNavigate: () => {
            const route = SERVICE_ROUTES[newServiceContext.service_key!];
            if (route) router.push(route);
          },
          onDismiss: closeModal,
        });

        setIsLoading(false);
        return;
      }

      // Priority 2: Use the active_context from JWT (remembers last used)
      if (active) {
        setActiveContext(active as Context);
        routeByContext(active as Context);
        setIsLoading(false);
        return;
      }

      // Priority 3: Default to primary context (staff)
      const primaryContext = decoded.contexts.find(c => c.type === 'staff');
      if (primaryContext) {
        setActiveContext(primaryContext);
        routeByContext(primaryContext);
        setIsLoading(false);
        return;
      }

      // Priority 4: Fallback to any available context
      if (decoded.contexts.length > 0) {
        setActiveContext(decoded.contexts[0]);
        routeByContext(decoded.contexts[0]);
        setIsLoading(false);
        return;
      }

      // No contexts found
      setIsLoading(false);
      router.push('/welcome');
    } catch (error) {
      console.error('Error determining context:', error);
      setIsLoading(false);
      router.push('/login');
    }
  }, [token, router]);

  /**
   * Route user to appropriate dashboard based on context
   */
  const routeByContext = useCallback((context: Context) => {
    if (context.type === 'service_admin' && context.service_key) {
      const route = SERVICE_ROUTES[context.service_key];
      if (route && !router.pathname.startsWith(route)) {
        router.push(route);
      }
    } else {
      const route = CONTEXT_ROUTES[context.type];
      if (route && router.pathname !== route) {
        router.push(route);
      }
    }
  }, [router]);

  /**
   * Switch to a different context
   */
  const switchContext = useCallback(async (context: Context) => {
    setIsLoading(true);
    try {
      // Call backend to update active context
      const response = await fetch('/api/auth/switch-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          context_type: context.type,
          service_key: context.service_key,
          company_code: context.company_code,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to switch context');
      }

      const { token: newToken } = await response.json();
      
      // Update auth token
      localStorage.setItem('authToken', newToken);
      
      // Update active context and route
      setActiveContext(context);
      routeByContext(context);
    } catch (error) {
      console.error('Error switching context:', error);
      // Re-throw for component to handle
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [token, routeByContext]);

  /**
   * Initialize routing on mount
   */
  useEffect(() => {
    if (token) {
      determineActiveContext();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  return {
    isLoading,
    activeContext,
    allContexts,
    switchContext,
    canShowWelcomeModal: showModal,
  };
}

/**
 * Utility Functions
 */

function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getServiceIcon(serviceKey: string): string {
  const icons: Record<string, string> = {
    hr: '👥',
    hakika: '🏢',
    tough_force: '🔒',
    rock_of_ages: '⛪',
  };
  return icons[serviceKey] || '📱';
}

function getServiceDescription(serviceKey: string): string {
  const descriptions: Record<string, string> = {
    hr: 'Manage payroll, leave requests, and your team all in one place.',
    hakika: 'Streamline property management, rent collection, and tenant communications.',
    tough_force: 'Coordinate security operations, shifts, and incident reporting.',
    rock_of_ages: 'Connect with your congregation, manage events, and track contributions.',
  };
  return descriptions[serviceKey] || 'Your service is ready to use!';
}

function getServiceFeatures(serviceKey: string): string[] {
  const features: Record<string, string[]> = {
    hr: [
      'Employee profiles & payroll',
      'Leave management & approvals',
      'Attendance tracking',
    ],
    hakika: [
      'Property & unit management',
      'Tenant profiles & leases',
      'Rent collection & invoicing',
    ],
    tough_force: [
      'Guard scheduling & rosters',
      'Shift management',
      'Incident tracking',
    ],
    rock_of_ages: [
      'Member directory',
      'Event management',
      'Donation tracking',
    ],
  };
  return features[serviceKey] || ['Full access to all features'];
}
