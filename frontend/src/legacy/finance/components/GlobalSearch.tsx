// @ts-nocheck
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  Command,
  FileText,
  Home,
  Loader2,
  Search,
  Shield,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { ModuleType } from '../types';
import { useAccess } from '../context/AccessContext';
import { usePageVisibility } from '../hooks/usePageVisibility_fix';
import {
  buildNavigationCommands,
  getModuleLandingPath,
  NavigationCommand,
  resolveAvailableModules,
} from '../utils/navigation';
import { MODULES } from '../constants';

interface GlobalSearchProps {
  isOpen: boolean;
  currentModule: ModuleType;
  onClose: () => void;
}

type CommandGroup = 'Quick action' | 'Page' | 'Live data';

interface PaletteResult {
  id: string;
  title: string;
  subtitle: string;
  link: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  group: CommandGroup;
  accentClass: string;
  meta?: string;
}

interface RemoteSearchResult {
  id: string;
  title: string;
  subtitle?: string;
  link: string;
  type?: string;
}

const getRemoteIcon = (type?: string) => {
  const normalized = (type || '').toLowerCase();
  if (normalized.includes('employee') || normalized.includes('guard') || normalized.includes('user')) {
    return User;
  }
  if (normalized.includes('security')) {
    return Shield;
  }
  if (normalized.includes('site') || normalized.includes('property') || normalized.includes('house')) {
    return Home;
  }
  return FileText;
};

const rankCommand = (command: NavigationCommand, query: string, currentModule: ModuleType): number => {
  if (!query) {
    return command.moduleId === currentModule ? 120 : 80;
  }

  let score = 0;
  const lowerQuery = query.toLowerCase();
  const lowerLabel = command.label.toLowerCase();

  if (lowerLabel === lowerQuery) score += 120;
  if (lowerLabel.startsWith(lowerQuery)) score += 70;
  if (command.keywords.includes(lowerQuery)) score += 35;
  if (command.moduleId === currentModule) score += 15;
  if (command.parentLabel?.toLowerCase().includes(lowerQuery)) score += 10;

  return score;
};

const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, currentModule, onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { role, profile } = useAccess();
  const { canSeePage } = usePageVisibility();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [remoteResults, setRemoteResults] = useState<PaletteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query.trim());

  const availableModules = useMemo(
    () => resolveAvailableModules(role, profile?.module),
    [profile?.module, role]
  );

  const quickActions = useMemo<PaletteResult[]>(() => {
    const moduleActions = availableModules.map((module) => ({
      id: `module:${module.id}`,
      title: `${module.name} Dashboard`,
      subtitle: `${module.description} workspace`,
      link: getModuleLandingPath(module.id),
      icon: module.icon,
      group: 'Quick action' as const,
      accentClass: 'text-[#ff6a00] bg-[#ff6a00]/10',
      meta: module.description,
    }));

    return [
      {
        id: 'quick:home',
        title: 'Go to Home',
        subtitle: 'Return to the public landing page',
        link: '/',
        icon: Home,
        group: 'Quick action',
        accentClass: 'text-sky-400 bg-sky-400/10',
        meta: 'Home',
      },
      {
        id: 'quick:profile',
        title: 'My Profile',
        subtitle: 'Open your account profile',
        link: '/app/profile',
        icon: User,
        group: 'Quick action',
        accentClass: 'text-emerald-400 bg-emerald-400/10',
        meta: 'Account',
      },
      {
        id: 'quick:notifications',
        title: 'Notifications',
        subtitle: 'Review alerts and updates',
        link: '/app/notifications',
        icon: Bell,
        group: 'Quick action',
        accentClass: 'text-violet-400 bg-violet-400/10',
        meta: 'Inbox',
      },
      ...moduleActions,
    ];
  }, [availableModules]);

  const localResults = useMemo<PaletteResult[]>(() => {
    const commands = buildNavigationCommands(availableModules)
      .filter((command) => (!command.roles || command.roles.includes(role || '')) && canSeePage(command.path))
      .map((command) => ({
        command,
        score: rankCommand(command, deferredQuery, currentModule),
      }))
      .filter(({ command, score }) => !deferredQuery || score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, deferredQuery ? 18 : 8)
      .map(({ command }) => ({
        id: command.id,
        title: command.label,
        subtitle: command.description,
        link: command.path,
        icon: MODULES[command.moduleId]?.icon || Home,
        group: 'Page' as const,
        accentClass: 'text-slate-300 bg-white/5',
        meta: command.moduleName,
      }));

    const filteredQuickActions = quickActions
      .filter((item) => {
        if (!deferredQuery) return true;
        const haystack = `${item.title} ${item.subtitle} ${item.meta || ''}`.toLowerCase();
        return haystack.includes(deferredQuery.toLowerCase());
      })
      .slice(0, deferredQuery ? 6 : 4);

    return [...filteredQuickActions, ...commands];
  }, [availableModules, canSeePage, currentModule, deferredQuery, quickActions, role]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setRemoteResults([]);
      setRemoteError(null);
      setSelectedIndex(0);
      return;
    }

    const raf = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(raf);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || deferredQuery.length < 2) {
      setRemoteResults([]);
      setRemoteError(null);
      return;
    }

    let isCancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setRemoteError(null);

      try {
        const { data, error } = await supabase.rpc('global_search', {
          query_text: deferredQuery,
        });

        if (error) {
          throw error;
        }

        if (isCancelled) {
          return;
        }

        const mappedResults = ((data || []) as RemoteSearchResult[]).slice(0, 6).map((result) => ({
          id: `live:${result.id}:${result.link}`,
          title: result.title,
          subtitle: result.subtitle || 'Open matching record',
          link: result.link,
          icon: getRemoteIcon(result.type),
          group: 'Live data' as const,
          accentClass: 'text-cyan-300 bg-cyan-400/10',
          meta: result.type || 'Live result',
        }));

        setRemoteResults(mappedResults);
      } catch (error) {
        if (!isCancelled) {
          console.error('Global command search failed:', error);
          setRemoteError('Live records are temporarily unavailable.');
          setRemoteResults([]);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }, 220);

    return () => {
      isCancelled = true;
      window.clearTimeout(timer);
    };
  }, [deferredQuery, isOpen]);

  const results = useMemo(() => {
    const combined: PaletteResult[] = [...localResults];
    const seenLinks = new Set(combined.map((result) => result.link));

    remoteResults.forEach((result) => {
      if (!seenLinks.has(result.link)) {
        combined.push(result);
        seenLinks.add(result.link);
      }
    });

    return combined;
  }, [localResults, remoteResults]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [deferredQuery, results.length]);

  useEffect(() => {
    if (!isOpen || results.length === 0) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((current) => (current + 1) % results.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((current) => (current - 1 + results.length) % results.length);
      } else if (event.key === 'Enter') {
        const activeResult = results[selectedIndex];
        if (!activeResult) {
          return;
        }

        event.preventDefault();
        navigate(activeResult.link);
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, navigate, onClose, results, selectedIndex]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] bg-[#071824]/78 backdrop-blur-md" onClick={onClose}>
      <div className="mx-auto flex min-h-screen max-w-4xl items-start justify-center px-4 pt-[10vh] sm:px-6">
        <div
          className="w-full overflow-hidden rounded-[28px] border border-white/10 bg-[#0b2a3c]/95 shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-white/10 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <Search size={18} className="text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search pages, guards, properties, incidents, reports..."
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              />
              <div className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400 sm:flex">
                <Command size={12} />
                K
              </div>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[1.5fr_0.9fr]">
            <div className="min-h-[420px] border-b border-white/10 lg:border-b-0 lg:border-r">
              <div className="max-h-[520px] overflow-y-auto p-3">
                {results.length > 0 ? (
                  <div className="space-y-2">
                    {results.map((result, index) => {
                      const Icon = result.icon;
                      const isSelected = index === selectedIndex;

                      return (
                        <button
                          key={result.id}
                          type="button"
                          onMouseEnter={() => setSelectedIndex(index)}
                          onClick={() => {
                            navigate(result.link);
                            onClose();
                          }}
                          className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                            isSelected
                              ? 'border-[#ff6a00]/60 bg-[#ff6a00]/10'
                              : 'border-transparent bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.05]'
                          }`}
                        >
                          <div
                            className={`mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl ${result.accentClass}`}
                          >
                            <Icon size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-bold tracking-tight text-white">
                                {result.title}
                              </span>
                              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                                {result.group}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-400">{result.subtitle}</p>
                          </div>
                          <ArrowRight size={16} className="mt-1 shrink-0 text-slate-500" />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center">
                    <Sparkles size={28} className="text-slate-500" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-white">No matches yet</p>
                      <p className="text-sm text-slate-400">
                        Try a page name, site, incident, guard, report, or property.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#c89f5e]">
                  Command Center
                </p>
                <h3 className="text-2xl font-black tracking-tight text-white">
                  Navigate the whole workspace
                </h3>
                <p className="text-sm leading-6 text-slate-400">
                  Search routes, jump to dashboards, and query live records without opening the
                  sidebar first.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Live Search
                  </span>
                  {loading ? (
                    <Loader2 size={14} className="animate-spin text-[#ff6a00]" />
                  ) : (
                    <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                      Ready
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm text-slate-400">
                  Supabase-backed results join your local navigation commands whenever a record
                  matches your search.
                </p>
                {remoteError ? (
                  <p className="mt-3 rounded-2xl bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                    {remoteError}
                  </p>
                ) : null}
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Shortcut Tips
                </p>
                <div className="mt-3 space-y-2 text-sm text-slate-400">
                  <p>Use `Ctrl/⌘ + K` from any internal page.</p>
                  <p>Arrow keys move between results.</p>
                  <p>Press `Enter` to jump instantly.</p>
                  <p>Press `Esc` to close.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
