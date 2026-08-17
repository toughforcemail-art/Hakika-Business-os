// @ts-nocheck
import { MODULES } from '../constants';
import { MenuItem, ModuleConfig, ModuleType, SidebarSection } from '../types';

const SUPER_USER_ROLES = new Set([
  'Super Admin',
  'Administrator',
  'Director',
  'Director / Super Admin',
]);

const MODULE_ALIASES: Record<ModuleType, string[]> = {
  ADMIN: ['admin', 'system admin', 'administration'],
  FINANCE: ['finance', 'accounts', 'accounting'],
  HR: ['hr', 'human resource', 'human resources'],
  ROCK_OF_AGES_CMS: ['rock of ages', 'rock of ages cms', 'church', 'church management', 'parish'],
  REAL_ESTATE: ['real estate', 'hakika', 'property', 'property management'],
  SECURITY: ['security', 'tough force', 'guarding', 'guards'],
};

export interface NavigationCommand {
  id: string;
  label: string;
  path: string;
  moduleId: ModuleType;
  moduleName: string;
  description: string;
  sectionTitle: string;
  parentLabel?: string;
  roles?: string[];
  icon?: MenuItem['icon'];
  keywords: string;
}

export type MobileNavigationTier = 'primary' | 'secondary' | 'desktop';

export interface MobileNavigationCommand extends NavigationCommand {
  mobileTier: MobileNavigationTier;
  mobileHint: string;
}

type RankedMobileNavigationCommand = MobileNavigationCommand & {
  sortIndex: number;
};

const MOBILE_PRIMARY_PATHS: Record<ModuleType, string[]> = {
  ADMIN: [
    '/admin/dashboards',
    '/admin/profile',
    '/admin/admins',
    '/admin/messaging-test',
  ],
  FINANCE: [
    '/app/finance/dashboard',
    '/app/finance/invoices',
    '/app/finance/payments',
    '/app/finance/expenses',
  ],
  HR: [
    '/app/hr/dashboard',
    '/app/hr/employee-directory',
    '/app/hr/apply-for-leave',
    '/app/hr/my-leave-requests',
  ],
  ROCK_OF_AGES_CMS: [
    '/app/rock-of-ages/dashboard',
    '/app/rock-of-ages/members',
    '/app/rock-of-ages/finance',
    '/app/rock-of-ages/requisitions',
  ],
  REAL_ESTATE: [
    '/app/real-estate/dashboard',
    '/app/real-estate/properties',
    '/app/real-estate/tenants',
    '/app/real-estate/maintenance',
  ],
  SECURITY: [
    '/app/security/tactical',
    '/app/security/incidents',
    '/app/security/roster',
    '/app/security/patrols',
  ],
};

const MOBILE_DESKTOP_HEAVY_PATTERNS = [
  /\/logs$/,
  /\/audit$/,
  /\/reconciliation$/,
  /\/yield$/,
  /\/statutory/,
  /\/reports\//,
  /\/page-visibility$/,
  /\/communication-history$/,
  /\/invoice\/list$/,
  /\/billing-summary$/,
  /\/meter-recordings$/,
  /\/configure-houses$/,
  /\/deductions-test$/,
  /\/process$/,
];

const MOBILE_DESKTOP_HEAVY_LABELS = [
  'system logs',
  'audit trail',
  'statutory returns',
  'payment reference',
  'water consumption',
  'arrears report',
  'expense report',
  'financial yield',
  'communication registry',
  'page visibility',
  'deductions calculator',
];

const normalizeAssignedModules = (assignedModules: string | null | undefined): string[] =>
  (assignedModules || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

const matchesAssignedModule = (value: string, module: ModuleConfig): boolean => {
  const normalizedName = module.name.toLowerCase();
  const normalizedId = module.id.toLowerCase();

  if (value === normalizedId || value === normalizedName) {
    return true;
  }

  return MODULE_ALIASES[module.id].some((alias) => value.includes(alias));
};

export const isSuperUserRole = (role: string | null | undefined): boolean =>
  SUPER_USER_ROLES.has(role || '');

export const getModuleLandingPath = (module: ModuleType): string => {
  switch (module) {
    case 'ADMIN':
      return '/admin/dashboards';
    case 'FINANCE':
      return '/app/finance/dashboard';
    case 'ROCK_OF_AGES_CMS':
      return '/app/rock-of-ages/dashboard';
    case 'REAL_ESTATE':
      return '/app/real-estate/dashboard';
    case 'SECURITY':
      return '/app/security/tactical';
    case 'HR':
    default:
      return '/app/hr/dashboard';
  }
};

export const resolveAvailableModules = (
  role: string | null | undefined,
  assignedModules: string | null | undefined
): ModuleConfig[] => {
  const allModules = Object.values(MODULES) as ModuleConfig[];

  if (isSuperUserRole(role)) {
    return allModules;
  }

  const normalizedAssignments = normalizeAssignedModules(assignedModules);
  if (normalizedAssignments.length === 0) {
    return [];
  }

  return allModules.filter((module) =>
    normalizedAssignments.some((value) => matchesAssignedModule(value, module))
  );
};

const addCommand = (
  commands: NavigationCommand[],
  item: MenuItem,
  module: ModuleConfig,
  section: SidebarSection,
  inheritedRoles?: string[],
  parentLabel?: string,
  inheritedIcon?: MenuItem['icon']
) => {
  const effectiveRoles = item.roles || inheritedRoles || section.roles;
  const icon = item.icon || inheritedIcon;

  if (item.path) {
    commands.push({
      id: `${module.id}:${item.id}`,
      label: item.label,
      path: item.path,
      moduleId: module.id,
      moduleName: module.name,
      description: `${module.name} | ${section.title}${parentLabel ? ` | ${parentLabel}` : ''}`,
      sectionTitle: section.title,
      parentLabel,
      roles: effectiveRoles,
      icon,
      keywords: [
        item.label,
        item.path,
        module.name,
        module.description,
        section.title,
        parentLabel,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase(),
    });
  }

  item.children?.forEach((child) =>
    addCommand(commands, child, module, section, effectiveRoles, item.label, icon)
  );
};

export const buildNavigationCommands = (
  modules: ModuleConfig[] = Object.values(MODULES) as ModuleConfig[]
): NavigationCommand[] => {
  const commands: NavigationCommand[] = [];

  modules.forEach((module) => {
    module.menu.forEach((section) => {
      section.items.forEach((item) => addCommand(commands, item, module, section));
    });

    const landingPath = getModuleLandingPath(module.id);
    const hasLandingCommand = commands.some(
      (command) => command.moduleId === module.id && command.path === landingPath
    );

    if (!hasLandingCommand) {
      commands.push({
        id: `${module.id}:landing`,
        label: `${module.name} Dashboard`,
        path: landingPath,
        moduleId: module.id,
        moduleName: module.name,
        description: `${module.name} | Overview`,
        sectionTitle: 'Overview',
        icon: module.icon,
        keywords: `${module.name} dashboard ${landingPath} ${module.description}`.toLowerCase(),
      });
    }
  });

  return commands;
};

const inferMobileTier = (command: NavigationCommand): MobileNavigationTier => {
  if (MOBILE_PRIMARY_PATHS[command.moduleId].includes(command.path)) {
    return 'primary';
  }

  const haystack = `${command.label} ${command.parentLabel || ''} ${command.sectionTitle}`.toLowerCase();
  if (
    MOBILE_DESKTOP_HEAVY_PATTERNS.some((pattern) => pattern.test(command.path)) ||
    MOBILE_DESKTOP_HEAVY_LABELS.some((label) => haystack.includes(label))
  ) {
    return 'desktop';
  }

  return 'secondary';
};

const getMobileHint = (tier: MobileNavigationTier): string => {
  switch (tier) {
    case 'primary':
      return 'Pinned for fast mobile access';
    case 'desktop':
      return 'Better suited to larger screens, but still available here';
    case 'secondary':
    default:
      return 'Available from mobile tools when needed';
  }
};

export const buildMobileNavigationCommands = (
  moduleId: ModuleType,
  canAccess?: (command: NavigationCommand) => boolean
): MobileNavigationCommand[] =>
  (buildNavigationCommands([MODULES[moduleId]])
    .filter((command) => (canAccess ? canAccess(command) : true))
    .map((command, index): RankedMobileNavigationCommand => {
      const mobileTier = inferMobileTier(command);

      return {
        ...command,
        sortIndex: index,
        mobileTier,
        mobileHint: getMobileHint(mobileTier),
      };
    })
    .sort((left, right) => {
      const tierOrder: Record<MobileNavigationTier, number> = {
        primary: 0,
        secondary: 1,
        desktop: 2,
      };

      if (tierOrder[left.mobileTier] !== tierOrder[right.mobileTier]) {
        return tierOrder[left.mobileTier] - tierOrder[right.mobileTier];
      }

      if (left.mobileTier === 'primary' && right.mobileTier === 'primary') {
        return (
          MOBILE_PRIMARY_PATHS[moduleId].indexOf(left.path) -
          MOBILE_PRIMARY_PATHS[moduleId].indexOf(right.path)
        );
      }

      return left.sortIndex - right.sortIndex;
    }) as MobileNavigationCommand[]);
