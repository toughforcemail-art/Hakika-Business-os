// @ts-nocheck
import { useAccess } from '../context/AccessContext';

export const usePageVisibility = () => {
  const { role: userRole, profile, visiblePages, loading, permissions, hasServiceAccess } = useAccess();

  const normalizeAssignedModules = (assignedModules?: string | null) =>
    (assignedModules || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

  const pathMatchesAssignedModule = (path: string, assignedModules?: string | null) => {
    const modules = normalizeAssignedModules(assignedModules);
    if (modules.length === 0) return false;

    if (path.startsWith('/app/finance')) {
      return modules.some((value) => ['finance', 'accounts', 'accounting'].includes(value));
    }

    if (path.startsWith('/app/hr')) {
      return modules.some((value) => ['hr', 'human resource', 'human resources'].includes(value));
    }

    if (path.startsWith('/app/security')) {
      return modules.some((value) => ['security', 'tough_force', 'tough force'].includes(value));
    }

    if (path.startsWith('/app/real-estate')) {
      return modules.some((value) => ['real_estate', 'real estate', 'hakika', 'property', 'property management'].includes(value));
    }

    if (path.startsWith('/app/caretaker')) {
      return modules.some((value) => ['real_estate', 'real estate', 'hakika', 'property', 'property management'].includes(value));
    }

    if (path.startsWith('/app/rock-of-ages')) {
      return modules.some((value) => ['rock_of_ages_cms', 'rock of ages', 'rock of ages cms', 'church', 'church management', 'parish'].includes(value));
    }

    if (path.startsWith('/admin')) {
      return modules.some((value) => ['admin', 'system admin', 'administration'].includes(value));
    }

    return false;
  };

  const canSeePage = (path: string): boolean => {
    if (loading) return true;
    if (['Super Admin', 'Director', 'Director / Super Admin'].includes(userRole || '')) {
      return true;
    }

    const dashboardAccess = Array.isArray(profile?.dashboard_access)
      ? profile.dashboard_access.map((item) => String(item).trim())
      : typeof profile?.dashboard_access === 'string'
        ? profile.dashboard_access.split(',').map((item) => item.trim())
        : [];

    const WHITELISTED_PAGES = ['/app/dashboard', '/app/profile', '/app/notifications'];
    if (WHITELISTED_PAGES.includes(path)) return true;

    const serviceByPath: Array<{ prefix: string; serviceKey: string }> = [
      { prefix: '/app/hr', serviceKey: 'hr' },
      { prefix: '/app/security', serviceKey: 'tough_force' },
      { prefix: '/app/real-estate', serviceKey: 'hakika' },
      { prefix: '/app/caretaker', serviceKey: 'hakika' },
      { prefix: '/admin', serviceKey: 'admin' },
    ];
    const matchedService = serviceByPath.find((item) => path.startsWith(item.prefix));
    if (matchedService?.serviceKey === 'admin' && dashboardAccess.includes('ADMIN_DASH')) {
      return true;
    }
    if (matchedService && !hasServiceAccess(matchedService.serviceKey)) return false;

    // Module assignment identifies the service boundary; page_visibility is
    // still the final allow-list so admins can safely hide individual routes.
    return visiblePages.has(path) || visiblePages.has('*');
  };

  return { canSeePage, loading, userRole, visiblePages, permissions };
};
