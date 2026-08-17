// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { MenuItem, SidebarSection } from '../types';
import { ChevronDown, ChevronRight, Circle, Search, Home, LogOut, Building2, CreditCard, Headphones, ShieldCheck, Users, WalletCards, Activity, Bell, Cpu, KeyRound, LayoutDashboard, LockKeyhole, Package, RefreshCw, Zap, Radio } from 'lucide-react';
import { usePageVisibility } from '../hooks/usePageVisibility_fix';
import { useWorkspaceAdapter } from '../context/WorkspaceAdapter';
import { getNavigation } from '../core/navigation/navigation';
import { ENABLE_NAVIGATION_ENGINE, ENABLE_PLATFORM_PREVIEW, ENABLE_SUPPORT_CENTER } from '../config/featureFlags';
import type { NavigationItem } from '../core/navigation/types';

interface SidebarProps {
  sections: SidebarSection[];
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  userRole: string;
  currentModule?: string;
  onLogout?: () => void;
  onHover?: (label: string | null, top: number | null) => void;
}

const SubMenuItem: React.FC<{
  item: MenuItem;
  depth?: number;
  isCollapsed: boolean;
  userRole: string;
  onHover: (label: string | null, top: number | null) => void;
  canSeePage: (path: string) => boolean;
}> = ({ item, depth = 0, isCollapsed, userRole, onHover, canSeePage }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const isAllowed = !item.roles || item.roles.includes(userRole);
  const isVisible = !item.path || canSeePage(item.path);
  const isActive = item.path ? location.pathname === item.path : false;
  const hasChildren = item.children && item.children.filter(child => {
    const roleAllowed = !child.roles || child.roles.includes(userRole);
    const pageVisible = !child.path || canSeePage(child.path);
    return roleAllowed && pageVisible;
  }).length > 0;

  useEffect(() => {
    if (isAllowed && isVisible && hasChildren && item.children?.some(child => location.pathname === child.path)) {
      setIsOpen(true);
    }
  }, [location.pathname, hasChildren, item.children, isAllowed, isVisible]);

  if (!isAllowed || !isVisible) return null;

  const paddingLeft = depth * 12 + 12;

  if (hasChildren) {
    return (
      <div className={`mb-1 group relative ${isCollapsed ? 'px-1' : 'px-2'}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          onMouseEnter={(e) => isCollapsed && onHover(item.label, e.currentTarget.getBoundingClientRect().top + e.currentTarget.offsetHeight / 2)}
          onMouseLeave={() => isCollapsed && onHover(null, null)}
          title={isCollapsed ? item.label : (isOpen ? `Collapse ${item.label}` : `Expand ${item.label}`)}
          {...{ 'aria-expanded': isOpen ? 'true' : 'false' }}
          className={`w-full flex items-center p-2 rounded-md text-sm transition-all duration-200 ${
            isOpen ? 'bg-slate-800 text-white font-semibold' : 'text-slate-400 hover:bg-white/5 hover:text-white'
          } ${isCollapsed ? 'justify-center' : 'justify-between'} ${isCollapsed ? '' : (depth === 0 ? 'pl-3' : depth === 1 ? 'pl-6' : 'pl-9')}`}
        >
          <div className={`flex items-center ${isCollapsed ? '' : 'gap-3 min-w-max'}`}>
            {item.icon ? <item.icon size={18} aria-hidden="true" /> : <Circle size={6} className={isCollapsed ? '' : 'ml-1.5'} aria-hidden="true" />}
            {!isCollapsed && <span className="font-medium">{item.label}</span>}
          </div>
          {!isCollapsed && (isOpen ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />)}
        </button>
        {isOpen && !isCollapsed && (
          <div className="mt-1 space-y-1">
            {item.children!
              .filter(child => {
                const roleAllowed = !child.roles || child.roles.includes(userRole);
                const pageVisible = !child.path || canSeePage(child.path);
                return roleAllowed && pageVisible;
              })
              .map((child) => (
                <SubMenuItem
                  key={child.id}
                  item={child}
                  depth={depth + 1}
                  isCollapsed={isCollapsed}
                  userRole={userRole}
                  onHover={onHover}
                  canSeePage={canSeePage}
                />
              ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={isCollapsed ? 'px-1' : 'px-2'}>
      <NavLink
        to={item.path || '#'}
        onMouseEnter={(e) => isCollapsed && onHover(item.label, e.currentTarget.getBoundingClientRect().top + e.currentTarget.offsetHeight / 2)}
        onMouseLeave={() => isCollapsed && onHover(null, null)}
        title={item.label}
        className={() => `
          flex items-center p-2 rounded-md text-sm transition-all duration-200 mb-0.5 relative group
          ${isActive
            ? 'bg-slate-800 text-white font-semibold'
            : 'text-slate-400 hover:bg-white/5 hover:text-white'}
          ${isCollapsed ? 'justify-center w-full' : 'gap-3'}
          ${isCollapsed ? '' : (depth === 0 ? 'pl-3' : depth === 1 ? 'pl-6' : 'pl-9')}
        `}
      >
        {item.icon ? <item.icon size={18} aria-hidden="true" /> : <div className="w-4 flex justify-center"><Circle size={6} aria-hidden="true" /></div>}
        {!isCollapsed && <span className="font-medium">{item.label}</span>}
        {isActive && !isCollapsed && (
          <div className="absolute right-3 w-1 h-1 rounded-full bg-blue-500" aria-hidden="true" />
        )}
      </NavLink>
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ sections, mobileOpen, setMobileOpen, isCollapsed, setIsCollapsed, userRole, currentModule, onLogout }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredItem, setHoveredItem] = useState<{ label: string; top: number } | null>(null);
  const navigate = useNavigate();
  const visibility = usePageVisibility();
  const canSeePage = visibility.canSeePage;
  const isLoading = visibility.loading;
  const workspaceAdapter = useWorkspaceAdapter();

  const navigationIcon = (iconKey: string) => ({
    'building-2': Building2,
    'credit-card': CreditCard,
    headphones: Headphones,
    'shield-check': ShieldCheck,
    users: Users,
    'wallet-cards': WalletCards,
  }[iconKey]);

  const navigationToMenuItem = (item: NavigationItem): MenuItem => ({
    id: item.id,
    label: item.title,
    path: item.route,
    icon: navigationIcon(item.iconKey),
    children: item.children.map(navigationToMenuItem),
  });

  const handleHover = (label: string | null, top: number | null) => {
    if (label && top !== null) {
      setHoveredItem({ label, top });
    } else {
      setHoveredItem(null);
    }
  };

  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hoveredItem && tooltipRef.current) {
      tooltipRef.current.style.setProperty('--tooltip-top', `${hoveredItem.top}px`);
    }
  }, [hoveredItem]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleScroll = () => setHoveredItem(null);
    const scrollContainer = scrollRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [isCollapsed]);

  const filteredSections = sections
    .map(section => ({
      ...section,
      items: section.items.filter(item => {
        const matchesRole = !item.roles || item.roles.includes(userRole);
        const matchesVisibility = !item.path || canSeePage(item.path);
        const matchesSearch = item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.children && item.children.some(child => child.label.toLowerCase().includes(searchQuery.toLowerCase())));
        return matchesRole && matchesVisibility && matchesSearch;
      })
    }))
    .filter(section => !isLoading && section.items.length > 0 && (!section.roles || section.roles.includes(userRole)));

  const engineSections: SidebarSection[] = ENABLE_NAVIGATION_ENGINE
    ? [{
        title: 'Applications',
        items: getNavigation(workspaceAdapter)
          .filter((item) => item.visible && item.enabled)
          .map(navigationToMenuItem),
      }]
    : filteredSections;

  const platformSections: SidebarSection[] = ENABLE_PLATFORM_PREVIEW && location.pathname.startsWith('/app/platform-preview') ? [{
    title: 'PLATFORM ADMINISTRATION',
    items: [
      ['Dashboard', '', LayoutDashboard], ['Organizations', 'organizations', Building2], ['Platform Modules', 'applications', Package],
      ['Workspace Jobs', 'jobs', RefreshCw], ['Notifications', 'notifications', Bell], ['Audit Logs', 'audit', Activity],
      ['Analytics', 'analytics', Activity], ['Roles', 'roles', Users], ['Permissions', 'permissions', KeyRound],
      ['Sessions', 'sessions', LockKeyhole], ['Security Center', 'security', ShieldCheck], ['Feature Flags', 'flags', Zap], ['System Health', 'health', Cpu],
      ['Subscriptions', 'subscriptions', Package], ['Billing', 'billing', CreditCard], ['Plans', 'plans', Package], ['Usage', 'usage', Activity], ['Executive Overview', 'executive', LayoutDashboard],
      ['Platform Validation', 'platform-validation', ShieldCheck],
      ['Workflow Orchestrator', 'workflow-orchestrator', Activity],
      ['Platform Service Bus', 'platform-bus', Radio],
      ...(ENABLE_SUPPORT_CENTER ? [['Support Center', 'support-center', Headphones] as const] : []),
    ].map(([label, id, icon]) => ({
      id: `platform-${id || 'dashboard'}`,
      label: label as string,
      path: `/app/platform-preview${id ? `/${id}` : ''}`,
      icon: icon as typeof LayoutDashboard,
    })),
  }] : engineSections;

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen bg-white dark:bg-dark-surface border-r border-gray-100 dark:border-white/[0.06] transform transition-all duration-300 ease-in-out
          lg:translate-x-0 flex flex-col
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          ${isCollapsed ? 'lg:w-16' : 'lg:w-64'}
          w-[min(18rem,92vw)]
        `}
      >


        {!isCollapsed && (
          <div className="px-4 pt-4">
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-900 px-3 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-sm font-bold text-white">
                {(userRole || 'SM').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{currentModule || 'Workspace'}</p>
                <p className="truncate text-sm font-bold lowercase text-white">{userRole || 'workspace admin'}</p>
              </div>
            </div>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-dark-text group-focus-within:text-black dark:group-focus-within:text-white transition-colors" size={14} />
              <input
                type="text"
                placeholder="Filter sidebar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 outline-none transition-all focus:border-slate-600 focus:ring-1 focus:ring-slate-700"
              />
            </div>
          </div>
        )}

        {/* Branding Area */}
          <div className={`flex items-center justify-center transition-all duration-300 ${isCollapsed ? 'h-16' : 'h-18 lg:h-18 xl:h-20 mb-2 xl:mb-2 2xl:mb-3'} relative group`}>
            {['HR', 'REAL_ESTATE', 'ROCK_OF_AGES_CMS'].includes(currentModule || '') ? (
              <div className={`relative flex items-center justify-center transition-all duration-300 ${isCollapsed ? 'scale-75' : 'scale-90'}`}>
              <img 
                src="/unnamed-removebg-preview.webp" 
                alt="Logo" 
                className={`
                  relative z-10 object-contain transition-all duration-300
                  ${isCollapsed ? 'w-10 h-10' : 'w-12 h-12 lg:w-12 lg:h-12 xl:w-14 xl:h-14 2xl:w-16 2xl:h-16'}
                  dark:brightness-200
                `}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          ) : (
             <div className="h-16" />
          )}
          
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`
              hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border text-black dark:text-white items-center justify-center shadow-sm hover:scale-105 transition-all z-50
              ${isCollapsed ? 'rotate-180' : ''}
            `}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div
          ref={scrollRef}
          className={`flex-1 overflow-y-auto overscroll-contain ${isCollapsed ? 'px-1' : 'px-0'} space-y-5 lg:space-y-5 xl:space-y-6 2xl:space-y-6 scrollbar-hide mb-4`}
        >
          {/* Back to Home Button */}
          <div className={isCollapsed ? 'px-1' : 'px-2'}>
            <button
              onClick={() => navigate('/')}
              onMouseEnter={(e) => isCollapsed && handleHover('Back to Home', e.currentTarget.getBoundingClientRect().top + e.currentTarget.offsetHeight / 2)}
              onMouseLeave={() => isCollapsed && handleHover(null, null)}
              className={`
                w-full flex items-center p-2 rounded-md text-sm transition-all duration-200 mb-2
                text-gray-500 dark:text-dark-text hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-dark-surface
                ${isCollapsed ? 'justify-center' : 'gap-3'}
              `}
              title="Back to Home"
              aria-label="Back to Home"
            >
              <Home size={18} aria-hidden="true" />
              {!isCollapsed && <span className="font-medium">Back to Home</span>}
            </button>
          </div>

          {platformSections.map((section, idx) => (
            <div key={idx} className="space-y-3">
              <h3 className={`px-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition-opacity duration-300 ${isCollapsed ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <SubMenuItem
                    key={item.id}
                    item={item}
                    isCollapsed={isCollapsed}
                    userRole={userRole}
                    onHover={handleHover}
                    canSeePage={canSeePage}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {!isCollapsed && (
          <div className="mt-auto border-t border-slate-800/80 p-4">
            <button type="button" onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-900 px-3 py-2.5 text-sm text-slate-400 transition hover:border-slate-700 hover:bg-slate-800 hover:text-white">
              <LogOut size={18} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        )}



        {/* Global Floating Tooltip Component */}
        {isCollapsed && hoveredItem && (
          <div
            ref={tooltipRef}
            className="sidebar-tooltip animate-in fade-in slide-in-from-left-2 duration-200"
          >
            {hoveredItem.label}
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
