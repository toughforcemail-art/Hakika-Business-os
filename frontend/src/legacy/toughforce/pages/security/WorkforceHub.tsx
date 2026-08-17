// @ts-nocheck
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Shield, 
  UserCheck, 
  AlertCircle, 
  TrendingUp, 
  MapPin,
  Clock,
  LayoutGrid,
  List,
  History
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cache } from '../../utils/cache';
import { StatCardSkeleton } from '../../components/Skeleton';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchWorkforceStats } from '../../services/securityRosterService';
import type { WorkforceStats } from '../../types/security';

const emptyWorkforceStats: WorkforceStats = {
  totalGuards: 0,
  activeOnDuty: 0,
  standby: 0,
  onLeave: 0,
};

const WorkforceHub: React.FC = () => {
  const navigate = useNavigate();
  const cachedStats = cache.get<WorkforceStats>('workforce_stats') ?? emptyWorkforceStats;
  const { data: stats, loading, error } = useAsyncData(fetchWorkforceStats, [], {
    initialData: cachedStats,
    immediate: true,
  });
  const [viewMode, setViewMode] = React.useState<'list' | 'overview'>('list');

  useEffect(() => {
    if (stats.totalGuards > 0) {
      cache.set('workforce_stats', stats);
    }
  }, [stats]);

  const statRows = [
    { icon: <Shield size={20}/>, label: 'Total Employees', value: stats.totalGuards, color: 'bg-brand-purple' },
    { icon: <UserCheck size={20}/>, label: 'Active Now', value: stats.activeOnDuty, color: 'bg-emerald-500' },
    { icon: <Clock size={20}/>, label: 'Standby / Offline', value: stats.standby, color: 'bg-amber-500' },
    { icon: <AlertCircle size={20}/>, label: 'Leave / Absent', value: stats.onLeave, color: 'bg-rose-500' },
  ];

  const performanceRows = [
    { label: 'Response Time', value: '98%' },
    { label: 'Roster Compliance', value: '94%' },
    { label: 'Incident Resolution', value: '89%' },
    { label: 'Asset Care', value: '96%' },
  ];

  // No longer blocking with full page loader

  return (
    <div className="min-h-full w-full p-6 lg:p-10 space-y-8 bg-white dark:bg-dark-bg text-gray-900 dark:text-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-200 dark:border-dark-border pb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="text-brand-purple" /> Workforce Hub
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-text">
            Monitor all available employees and their availability in real-time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate('/app/security/past-guards')}
            className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-white/10 transition flex items-center gap-2"
            title="View deleted guard records"
          >
            <History size={16} /> Past Guards
          </button>
          <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 ${viewMode === 'list' ? 'bg-white dark:bg-dark-surface shadow-sm text-brand-purple' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <List size={14} /> List
          </button>
          <button
            onClick={() => setViewMode('overview')}
            className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 ${viewMode === 'overview' ? 'bg-white dark:bg-dark-surface shadow-sm text-brand-purple' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <LayoutGrid size={14} /> Overview
          </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
          {error}
        </div>
      )}

      {viewMode === 'list' ? (
        <div className="space-y-6">
          <div className="rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-dark-surface">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-white/10">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Users className="text-brand-purple" size={18}/> Workforce Snapshot
              </h2>
            </div>
            {loading && stats.totalGuards === 0 ? (
              <div className="p-6">
                <StatCardSkeleton count={4} />
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {statRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-4 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-2xl ${row.color} text-white flex items-center justify-center`}>
                        {row.icon}
                      </div>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{row.label}</span>
                    </div>
                    <span className="text-lg font-black text-gray-900 dark:text-white">{row.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-dark-surface">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <MapPin className="text-brand-purple" size={20}/> Site Deployment Distribution
            </h2>
            <div className="space-y-3">
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 px-4 py-4 text-sm text-gray-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300">
                Detailed deployment list will appear here as site-level assignment data is expanded.
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/[0.03]">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Current default display</span>
                <span className="text-xs font-black uppercase tracking-widest text-brand-purple">List-first</span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-dark-surface">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="text-emerald-500" size={20}/> Performance Index
            </h2>
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {performanceRows.map((item) => (
                <div key={item.label} className="flex items-center justify-between py-4">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{item.label}</span>
                  <span className="text-sm font-black text-brand-purple">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {loading && stats.totalGuards === 0 ? (
              <StatCardSkeleton count={4} />
            ) : (
              <>
                <StatCard 
                  icon={<Shield size={24}/>} 
                  label="Total Strength" 
                  value={stats.totalGuards} 
                  color="bg-brand-purple" 
                />
                <StatCard 
                  icon={<UserCheck size={24}/>} 
                  label="On-Duty Now" 
                  value={stats.activeOnDuty} 
                  color="bg-emerald-500" 
                />
                <StatCard 
                  icon={<Clock size={24}/>} 
                  label="Standby / Off" 
                  value={stats.standby} 
                  color="bg-amber-500" 
                />
                <StatCard 
                  icon={<AlertCircle size={24}/>} 
                  label="Leave/Absent" 
                  value={stats.onLeave} 
                  color="bg-rose-500" 
                />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 glass-card p-6">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2 italic">
                <MapPin className="text-brand-purple" size={20}/> Site Deployment Distribution
              </h2>
              <div className="space-y-6">
                 <div className="flex items-center justify-center py-20 text-gray-400 italic bg-gray-50/50 dark:bg-white/2 rounded-3xl border-2 border-dashed border-gray-100 dark:border-white/5">
                    Detailed deployment map / list to be visualized here.
                 </div>
              </div>
            </div>

            <div className="glass-card p-6">
              <h2 className="text-lg font-bold mb-6 flex items-center gap-2 italic">
                <TrendingUp className="text-emerald-500" size={20}/> Performance Index
              </h2>
              <div className="space-y-4">
                 <PerformanceItem label="Response Time" value="98%" />
                 <PerformanceItem label="Roster Compliance" value="94%" />
                 <PerformanceItem label="Incident Resolv." value="89%" />
                 <PerformanceItem label="Asset Care" value="96%" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const StatCard = ({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: number | string, color: string }) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass-card p-6 flex items-center gap-4 border border-gray-100 dark:border-white/5"
  >
    <div className={`w-12 h-12 rounded-2xl ${color} text-white flex items-center justify-center shadow-lg shadow-current/20`}>
      {icon}
    </div>
    <div>
      <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{label}</p>
      <h3 className="text-2xl font-bold">{value}</h3>
    </div>
  </motion.div>
);

const PerformanceItem = ({ label, value }: { label: string, value: string }) => (
  <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/2 border border-gray-100 dark:border-white/5 flex justify-between items-center transition-all hover:bg-gray-100 dark:hover:bg-white/5">
    <span className="text-xs font-medium text-gray-500">{label}</span>
    <span className="text-sm font-bold text-brand-purple">{value}</span>
  </div>
);

export default WorkforceHub;
