// @ts-nocheck
import { useState } from 'react';
import { MODULES } from '../constants';
import { MenuItem, SidebarSection } from '../types';
import { useAccess } from '../context/AccessContext';

const getAllPagesWithRoles = (): Map<string, string[] | undefined> => {
  const pagesWithRoles = new Map<string, string[] | undefined>();
  
  Object.entries(MODULES).forEach(([_, module]) => {
    const sections = Array.isArray(module.menu) ? module.menu : [module.menu];
    sections.forEach((section: SidebarSection) => {
      section.items.forEach((item: MenuItem) => {
        extractPageRoles(item, pagesWithRoles, section.roles);
      });
    });
  });
  
  return pagesWithRoles;
};

const extractPageRoles = (item: MenuItem, map: Map<string, string[] | undefined>, parentRoles?: string[]) => {
  if (item.path) {
    map.set(item.path, item.roles || parentRoles);
  }
  if (item.children) {
    item.children.forEach(child => extractPageRoles(child, map, item.roles || parentRoles));
  }
};

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
    return modules.includes('security');
  }

  if (path.startsWith('/app/real-estate')) {
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

export const usePageVisibility = () => {
  const { role: userRole, profile, visiblePages, loading, permissions, hasServiceAccess } = useAccess();
  const [pageRoles] = useState(() => getAllPagesWithRoles());

  const canSeePage = (path: string): boolean => {
    if (loading) return true;
    
    const allowedRoles = pageRoles.get(path);
    if (allowedRoles && !allowedRoles.includes(userRole || '')) {
      return false;
    }
    
    const WHITELISTED_PAGES = ['/app/dashboard', '/app/profile', '/app/notifications', '/app/hr/past-employees', '/app/real-estate/properties', '/app/real-estate/houses'];
    if (WHITELISTED_PAGES.includes(path)) return true;

    if (pathMatchesAssignedModule(path, profile?.module)) return true;

    const serviceByPath: Array<{ prefix: string; serviceKey: string }> = [
      { prefix: '/app/hr', serviceKey: 'hr' },
      { prefix: '/app/security', serviceKey: 'tough_force' },
      { prefix: '/app/real-estate', serviceKey: 'hakika' },
      { prefix: '/admin', serviceKey: 'admin' },
    ];
    const matchedService = serviceByPath.find((item) => path.startsWith(item.prefix));
    if (matchedService && !hasServiceAccess(matchedService.serviceKey)) return false;
    
    if (visiblePages.has('*')) return true;
    return visiblePages.has(path);
  };

  return { canSeePage, loading, userRole, visiblePages, permissions };
};
