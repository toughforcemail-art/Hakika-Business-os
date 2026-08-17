// @ts-nocheck
import React, { useEffect, useMemo, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Grid2x2,
  Search,
  Sparkles,
  TabletSmartphone,
  X,
} from 'lucide-react';
import { MODULES } from '../constants';
import { ModuleType } from '../types';
import { useAccess } from '../context/AccessContext';
import { usePageVisibility } from '../hooks/usePageVisibility_fix';
import {
  buildMobileNavigationCommands,
  MobileNavigationCommand,
} from '../utils/navigation';

interface MobileWorkspaceNavProps {
  currentModule: ModuleType;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onOpenSearch: () => void;
}

const tierBadgeClasses: Record<MobileNavigationCommand['mobileTier'], string> = {
  primary:
    'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  secondary:
    'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  desktop:
    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
};

const tierTitles: Record<MobileNavigationCommand['mobileTier'], string> = {
  primary: 'Pinned',
  secondary: 'More tools',
  desktop: 'Desktop-heavy',
};

const MobileWorkspaceNav: React.FC<MobileWorkspaceNavProps> = ({
  currentModule,
  isOpen,
  onOpen,
  onClose,
  onOpenSearch,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useAccess();
  const { canSeePage } = usePageVisibility();
  const currentModuleConfig = MODULES[currentModule];
  const previousLocationRef = useRef(location.pathname);
  const previousModuleRef = useRef(currentModule);

  const mobileCommands = useMemo(
    () =>
      buildMobileNavigationCommands(
        currentModule,
        (command) => (!command.roles || command.roles.includes(role || '')) && canSeePage(command.path)
      ),
    [canSeePage, currentModule, role]
  );

  const primaryCommands = mobileCommands.filter((command) => command.mobileTier === 'primary');
  const secondaryCommands = mobileCommands.filter((command) => command.mobileTier === 'secondary');
  const desktopCommands = mobileCommands.filter((command) => command.mobileTier === 'desktop');
  const pinnedCommands = [...primaryCommands, ...secondaryCommands].slice(0, 3);

  const openCommand = (path: string) => {
    navigate(path);
    onClose();
  };

  useEffect(() => {
    const routeChanged = previousLocationRef.current !== location.pathname;
    const moduleChanged = previousModuleRef.current !== currentModule;

    if (isOpen && (routeChanged || moduleChanged)) {
      onClose();
    }

    previousLocationRef.current = location.pathname;
    previousModuleRef.current = currentModule;
  }, [currentModule, isOpen, location.pathname, onClose]);

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-[90] px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:px-3 lg:hidden">
        <div className="grid grid-cols-5 gap-1 rounded-[22px] border border-gray-200 bg-white/95 p-1 shadow-[0_18px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0b2a3c]/95 sm:gap-1.5 sm:p-1.5">
          {pinnedCommands.map((command) => {
            const Icon = command.icon || currentModuleConfig.icon;
            const isActive = location.pathname === command.path;

            return (
              <NavLink
                key={command.id}
                to={command.path}
                className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-center transition sm:min-h-[58px] sm:px-2 ${
                  isActive
                    ? 'bg-[#ff6a00]/12 text-[#ff6a00]'
                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'
                }`}
              >
                <Icon size={18} />
                <span className="line-clamp-2 text-[10px] font-semibold leading-tight">{command.label}</span>
              </NavLink>
            );
          })}

          <button
            type="button"
            onClick={onOpenSearch}
            className="flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-center text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10 sm:min-h-[58px] sm:px-2"
          >
            <Search size={18} />
            <span className="text-[10px] font-semibold">Search</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (isOpen) onClose();
              else onOpen();
            }}
            className="flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-center text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10 sm:min-h-[58px] sm:px-2"
          >
            <Grid2x2 size={18} />
            <span className="text-[10px] font-semibold">Tools</span>
          </button>
        </div>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-[110] bg-[#071824]/78 backdrop-blur-md lg:hidden" onClick={onClose}>
          <div className="absolute inset-x-0 bottom-0 max-h-[84vh] overflow-hidden rounded-t-[32px] border border-white/10 bg-white text-slate-900 shadow-[0_-24px_60px_rgba(15,23,42,0.28)] dark:bg-[#0b2a3c] dark:text-white">
            <div className="border-b border-gray-200 px-5 py-4 dark:border-white/10" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#c89f5e]">
                    Mobile Workspace
                  </p>
                  <div>
                    <h3 className="text-2xl font-black tracking-tight">{currentModuleConfig.name}</h3>
                    <p className="mt-1 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                      Only high-frequency actions stay pinned on mobile. Everything else lives in
                      one searchable tools sheet, so you do not have to duplicate the whole
                      desktop sidebar.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 text-slate-500 transition hover:border-[#ff6a00]/40 hover:text-[#ff6a00] dark:border-white/10 dark:text-slate-300"
                >
                  <X size={18} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSearch();
                }}
                className="mt-4 flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-slate-50 px-4 py-3 text-left text-sm transition hover:border-[#ff6a00]/40 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/[0.08]"
              >
                <span className="flex items-center gap-3">
                  <Search size={16} className="text-[#ff6a00]" />
                  Search any page, record, or action
                </span>
                <Sparkles size={16} className="text-slate-400" />
              </button>
            </div>

            <div className="max-h-[calc(84vh-144px)] overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5" onClick={(event) => event.stopPropagation()}>
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <TabletSmartphone size={16} className="text-[#ff6a00]" />
                  <h4 className="text-sm font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                    Pinned for Mobile
                  </h4>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {pinnedCommands.map((command) => {
                    const Icon = command.icon || currentModuleConfig.icon;

                    return (
                      <button
                        key={command.id}
                        type="button"
                        onClick={() => openCommand(command.path)}
                        className="rounded-[24px] border border-gray-200 bg-gradient-to-br from-white to-slate-50 p-4 text-left transition hover:border-[#ff6a00]/40 hover:shadow-[0_16px_36px_rgba(255,106,0,0.12)] dark:border-white/10 dark:from-white/8 dark:to-white/[0.03]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ff6a00]/12 text-[#ff6a00]">
                            <Icon size={20} />
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${tierBadgeClasses.primary}`}>
                            {tierTitles.primary}
                          </span>
                        </div>
                        <h5 className="mt-4 text-base font-bold tracking-tight">{command.label}</h5>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{command.mobileHint}</p>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="mt-8">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h4 className="text-sm font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                    More Tools
                  </h4>
                  <span className="text-xs text-slate-400">{secondaryCommands.length} pages</span>
                </div>
                <div className="space-y-3">
                  {secondaryCommands.map((command) => {
                    const Icon = command.icon || currentModuleConfig.icon;

                    return (
                      <button
                        key={command.id}
                        type="button"
                        onClick={() => openCommand(command.path)}
                        className="flex w-full items-start gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left transition hover:border-sky-500/30 hover:bg-sky-50/60 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-sky-500/10"
                      >
                        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-300">
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">{command.label}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${tierBadgeClasses.secondary}`}>
                              {tierTitles.secondary}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{command.mobileHint}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {desktopCommands.length > 0 ? (
                <section className="mt-8">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="text-sm font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                      Desktop-Heavy
                    </h4>
                    <span className="text-xs text-slate-400">{desktopCommands.length} pages</span>
                  </div>
                  <div className="space-y-3">
                    {desktopCommands.map((command) => {
                      const Icon = command.icon || currentModuleConfig.icon;

                      return (
                        <button
                          key={command.id}
                          type="button"
                          onClick={() => openCommand(command.path)}
                          className="flex w-full items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-50/70 px-4 py-3 text-left transition hover:border-amber-500/40 dark:bg-amber-500/10"
                        >
                          <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/12 text-amber-700 dark:text-amber-300">
                            <Icon size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold">{command.label}</span>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${tierBadgeClasses.desktop}`}>
                                {tierTitles.desktop}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{command.mobileHint}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default MobileWorkspaceNav;
