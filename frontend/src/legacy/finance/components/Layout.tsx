// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Command, Menu, Moon, Search, Sun, Wifi, WifiOff, PanelLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import ModuleSwitcher from './ModuleSwitcher';
import UserDropdown from './UserDropdown';
import CustomToast, { ToastType } from './CustomToast';
import Breadcrumbs from './Breadcrumbs';
import GlobalSearch from './GlobalSearch';
import MobileWorkspaceNav from './MobileWorkspaceNav';
import { ModuleType } from '../types';
import { MODULES } from '../constants';
import { useAccess } from '../context/AccessContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useInternetStatus } from '../hooks/useInternetStatus';

interface LayoutProps {
  children: React.ReactNode;
  currentModule: ModuleType;
  onModuleChange: (module: ModuleType) => void;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentModule, onModuleChange, onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar_collapsed');
      return saved === 'true';
    }
    return false;
  });

  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved ? saved === 'dark' : true;
    }
    return true;
  });

  const [toast, setToast] = useState<{ message: string; type: ToastType; isVisible: boolean }>({
    message: '',
    type: 'info',
    isVisible: false
  });
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    const body = window.document.body;
    if (isDark) {
      root.classList.add('dark');
      body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const { profile, role } = useAccess();
  const isInternetConnected = useInternetStatus();
  const dashboardAccess = Array.isArray(profile?.dashboard_access)
    ? profile.dashboard_access.map((item) => String(item).trim())
    : typeof profile?.dashboard_access === 'string'
      ? profile.dashboard_access.split(',').map((item) => item.trim())
      : [];
  const includeAdminMenu = currentModule === 'REAL_ESTATE' && dashboardAccess.includes('ADMIN_DASH');
  const sidebarSections = includeAdminMenu
    ? [...MODULES[currentModule].menu, ...MODULES.ADMIN.menu]
    : MODULES[currentModule].menu;

  // Track online status
  useOnlineStatus(profile?.id);

  // Derive userData from Supabase profile (via AccessContext)
  const userData = {
    name: profile?.full_name || profile?.email?.split('@')[0] || 'User',
    role: role || 'Guest',
    profileImage: profile?.avatar_url || null,
    isOnline: isInternetConnected,
  };

  useEffect(() => {
    const handleToast = (e: any) => {
      setToast({
        message: e.detail.message,
        type: e.detail.type || 'info',
        isVisible: true
      });
    };
    window.addEventListener('show-toast' as any, handleToast);
    return () => window.removeEventListener('show-toast' as any, handleToast);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close mobile sidebar on navigation (pattern from Kimi Header.tsx line 33)
  useEffect(() => {
    if (mobileOpen) {
      setMobileOpen(false);
    }
  }, [location.pathname, mobileOpen]);

  return (
    <div className="min-h-screen bg-white dark:bg-dark-surface text-black dark:text-white flex flex-col lg:flex-row font-sans transition-colors duration-200 overflow-x-hidden">

      <Sidebar
        sections={sidebarSections}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={(collapsed) => {
          setIsSidebarCollapsed(collapsed);
          localStorage.setItem('sidebar_collapsed', String(collapsed));
        }}
        userRole={userData.role}
        currentModule={currentModule}
        onLogout={onLogout}
      />

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarCollapsed ? 'lg:ml-16' : 'lg:ml-56 xl:ml-60 2xl:ml-64'}`}>
        {/* Clean Header */}
        <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/80 px-2.5 backdrop-blur-xl dark:border-white/[0.06] dark:bg-dark-surface/80 sm:px-4 md:px-5 xl:px-6 2xl:px-8">
          <div className="flex min-h-12 flex-wrap items-center justify-between gap-1.5 py-1 sm:min-h-14 sm:gap-2 xl:gap-4">

            <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3 md:gap-4 xl:gap-6">
              <div className="flex items-center lg:hidden">
                <button
                  onClick={() => setMobileOpen(true)}
                  className="rounded-xl p-1.5 text-gray-500 hover:text-[#ff6a00]"
                  title="Open Sidebar"
                  aria-label="Open Sidebar"
                >
                  <PanelLeft size={20} aria-hidden="true" />
                </button>
                <div className="mx-1 h-4 w-[1px] bg-gray-200 dark:bg-dark-border" />
                <button
                  onClick={() => setIsMobileToolsOpen(true)}
                  className="rounded-xl p-1.5 text-gray-500 hover:text-[#ff6a00]"
                  title="Open Mobile Tools"
                  aria-label="Open Mobile Tools"
                >
                  <Menu size={20} aria-hidden="true" />
                </button>
              </div>

              <ModuleSwitcher currentModule={currentModule} onChange={onModuleChange} />

              <button
                type="button"
                onClick={() => setIsCommandPaletteOpen(true)}
                className="hidden min-w-[180px] items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-left text-sm text-gray-500 transition hover:border-[#ff6a00]/40 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-[#ff6a00]/40 dark:hover:bg-white/[0.08] xl:flex xl:min-w-[220px] 2xl:min-w-[260px]"
                aria-label="Open command palette"
              >
                <span className="flex items-center gap-3 truncate">
                  <Search size={16} className="text-[#ff6a00]" />
                  <span className="truncate">Search pages, records, and actions</span>
                </span>
                <span className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                  <Command size={12} />
                  K
                </span>
              </button>
            </div>

            <div className="ml-auto flex items-center gap-1 sm:gap-2 md:gap-3 xl:gap-3 2xl:gap-4">
              <button
                type="button"
                onClick={() => setIsCommandPaletteOpen(true)}
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 p-2 text-gray-500 transition hover:border-[#ff6a00]/40 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:border-[#ff6a00]/40 dark:hover:text-white xl:hidden"
                aria-label="Open command palette"
              >
                <Search size={18} aria-hidden="true" />
              </button>

              <div
                className={`hidden items-center gap-2 rounded-full px-2.5 py-1.5 text-xs font-semibold 2xl:flex ${
                  isInternetConnected
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                }`}
                aria-live="polite"
              >
                {isInternetConnected ? <Wifi size={14} aria-hidden="true" /> : <WifiOff size={14} aria-hidden="true" />}
                {isInternetConnected ? 'Live connection' : 'Offline mode'}
              </div>

              <button
                onClick={() => setIsDark(!isDark)}
                className="rounded-xl p-1.5 text-gray-400 transition-colors hover:text-black dark:text-dark-text dark:hover:text-white"
                title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
              </button>

              <UserDropdown
                userData={userData}
                onLogout={onLogout}
              />
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="relative flex-1 min-w-0 overflow-x-hidden p-3 pb-28 sm:p-4 sm:pb-24 md:p-6 md:pb-8 lg:p-8">
          <div className="app-page-shell mx-auto w-full max-w-[96rem] min-w-0">
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>

      <CustomToast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
      <GlobalSearch
        isOpen={isCommandPaletteOpen}
        currentModule={currentModule}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
      <MobileWorkspaceNav
        currentModule={currentModule}
        isOpen={isMobileToolsOpen}
        onOpen={() => setIsMobileToolsOpen(true)}
        onClose={() => setIsMobileToolsOpen(false)}
        onOpenSearch={() => {
          setIsMobileToolsOpen(false);
          setIsCommandPaletteOpen(true);
        }}
      />
    </div>
  );
};

export default Layout;
