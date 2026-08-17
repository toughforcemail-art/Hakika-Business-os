// @ts-nocheck
import React from 'react';
import { MODULES } from '../constants';
import { ModuleType } from '../types';
import { ChevronDown, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAccess } from '../context/AccessContext';
import { resolveAvailableModules } from '../utils/navigation';

interface ModuleSwitcherProps {
  currentModule: ModuleType;
  onChange: (module: ModuleType) => void;
}

const ModuleSwitcher: React.FC<ModuleSwitcherProps> = ({ currentModule, onChange }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { role, profile } = useAccess();
  const availableModules = React.useMemo(
    () => resolveAvailableModules(role, profile?.module),
    [profile?.module, role]
  );

  const dashboardAccess = React.useMemo(() => {
    const raw = profile?.dashboard_access;
    if (Array.isArray(raw)) return raw.map((item) => String(item).trim()).filter(Boolean);
    if (typeof raw === 'string') return raw.split(',').map((item) => item.trim()).filter(Boolean);
    return [];
  }, [profile?.dashboard_access]);

  const extraDashboards = React.useMemo(() => {
    const items: Array<{ id: string; label: string; description: string; path: string }> = [];

    if (dashboardAccess.includes('ADMIN_DASH')) {
      items.push({ id: 'ADMIN_DASH', label: 'Admin Dashboard', description: 'System oversight and configuration', path: '/admin/dashboards' });
    }

    if (dashboardAccess.includes('HAKIKA_DASH') || (profile?.login_scope || '') === 'hakika_portal' || (profile?.module || '').toLowerCase() === 'hakika') {
      items.push({ id: 'HAKIKA_DASH', label: 'Hakika Dashboard', description: 'Real estate management workspace', path: '/app/real-estate/dashboard' });
    }

    return items;
  }, [dashboardAccess, profile?.login_scope, profile?.module]);

  const dashboardEntries = React.useMemo(() => {
    const entries = [
      ...availableModules.map((mod) => ({
        key: `module:${mod.id}`,
        label: mod.name,
        description: mod.description,
        path: mod.id === 'REAL_ESTATE' ? '/app/real-estate/dashboard' : undefined,
        type: 'module' as const,
        moduleId: mod.id as ModuleType,
      })),
      ...extraDashboards.map((dashboard) => ({
        key: `dashboard:${dashboard.id}`,
        label: dashboard.label,
        description: dashboard.description,
        path: dashboard.path,
        type: 'dashboard' as const,
      })),
    ];

    return entries.filter((entry, index, self) => {
      if (entry.type === 'module' && entry.moduleId === 'REAL_ESTATE') {
        return !self.some((other, otherIndex) =>
          otherIndex !== index && other.type === 'dashboard' && other.path === entry.path
        );
      }
      return true;
    });
  }, [availableModules, extraDashboards]);

  const canSwitchModules = availableModules.length > 1 || extraDashboards.length > 0;
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeModule = MODULES[currentModule];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => canSwitchModules && setIsOpen(!isOpen)}
        className={`flex items-center space-x-3 px-4 py-2.5 rounded-xl bg-white/5 transition-all border border-white/10 group ${canSwitchModules ? 'hover:bg-white/10 cursor-pointer' : 'cursor-default'}`}
      >
        <div className="relative">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[#c89f5e] to-[#b8945a] text-white shadow-lg shadow-gold/20 group-hover:scale-105 transition-transform duration-300">
            <activeModule.icon size={18} />
          </div>
          <div className="absolute -inset-1 bg-[#c89f5e]/20 blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="text-left hidden sm:block">
          <p className="text-[10px] text-[#c89f5e] font-black uppercase tracking-[0.2em] leading-none mb-1">{activeModule.description}</p>
          <h2 className="text-sm font-black text-gray-100 dark:text-white leading-none uppercase tracking-tighter flex items-center gap-2">
            {activeModule.name}
            {canSwitchModules && <ChevronDown size={14} className={`text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />}
          </h2>
        </div>
        {canSwitchModules && <ChevronDown size={14} className="text-gray-400 sm:hidden" />}
      </button>

      {isOpen && canSwitchModules && (
        <div className="absolute top-full left-0 mt-3 w-72 bg-[#0b2a3c]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 overflow-hidden animate-fade-in-up">
          <div className="p-3 space-y-2">
            <div className="px-3 py-2 text-[9px] font-black text-[#c89f5e] uppercase tracking-[0.3em] opacity-70">
              Select Workspace
            </div>
            {availableModules.map((mod) => (
              <button
                key={mod.id}
                onClick={() => {
                  onChange(mod.id as ModuleType);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center p-3 rounded-xl transition-all ${
                  currentModule === mod.id
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`}
              >
                <div className={`p-2.5 rounded-xl mr-4 ${currentModule === mod.id ? 'bg-gradient-to-br from-[#c89f5e] to-[#b8945a] text-[#0b2a3c]' : 'bg-white/5'}`}>
                  <mod.icon size={20} />
                </div>
                <div className="text-left flex-1">
                  <p className="text-xs font-black uppercase tracking-tight">{mod.name}</p>
                  <p className="text-[10px] text-gray-500 font-medium">{mod.description}</p>
                </div>
                {currentModule === mod.id && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#c89f5e] shadow-[0_0_10px_#c89f5e]" />
                )}
              </button>
            ))}
            {extraDashboards
              .filter((dashboard) => !(
                dashboard.id === 'HAKIKA_DASH' &&
                availableModules.some((mod) => mod.id === 'REAL_ESTATE')
              ))
              .map((dashboard) => (
              <button
                key={dashboard.id}
                onClick={() => {
                  navigate(dashboard.path);
                  setIsOpen(false);
                }}
                className="w-full flex items-center p-3 rounded-xl transition-all text-gray-400 hover:bg-white/5 hover:text-gray-200"
              >
                <div className="p-2.5 rounded-xl mr-4 bg-white/5">
                  <LayoutDashboard size={20} />
                </div>
                <div className="text-left flex-1">
                  <p className="text-xs font-black uppercase tracking-tight">{dashboard.label}</p>
                  <p className="text-[10px] text-gray-500 font-medium">{dashboard.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModuleSwitcher;
