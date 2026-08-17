// @ts-nocheck
import React from 'react';
import { 
  Shield, 
  AlertTriangle, 
  Clock, 
  MapPin, 
  Activity,
  Zap,
  Users
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchTacticalConsoleData } from '../../services/securityRosterService';
import type { TacticalConsoleData } from '../../types/security';

const emptyTacticalData: TacticalConsoleData = {
  activeShifts: [],
  onDuty: 0,
  required: 0,
  alerts: 0,
  completion: 0,
};

const TacticalConsole: React.FC = () => {
  const { data, error } = useAsyncData(fetchTacticalConsoleData, [], {
    initialData: emptyTacticalData,
    immediate: true,
  });

  const activityData = [
    { time: '06:00', shifts: 12 },
    { time: '09:00', shifts: 18 },
    { time: '12:00', shifts: 15 },
    { time: '15:00', shifts: 22 },
    { time: '18:00', shifts: 30 },
    { time: '21:00', shifts: 25 },
    { time: '00:00', shifts: 10 },
  ];

  return (
    <div className="min-h-full w-full p-6 lg:p-10 space-y-8 bg-white dark:bg-dark-bg text-gray-900 dark:text-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-200 dark:border-dark-border pb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Shield className="text-brand-purple" /> Tactical Console
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-text">
            Real-time operational oversight and deployment tracking.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-500/20 flex items-center gap-2">
             <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
             System Live
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Guards On Duty', value: data.onDuty, icon: Users, color: 'brand-purple' },
          { label: 'Coverage Rate', value: `${data.completion}%`, icon: Zap, color: 'blue-500' },
          { label: 'Active Alerts', value: data.alerts, icon: AlertTriangle, color: 'rose-500' },
          { label: 'Posts Required', value: data.required, icon: MapPin, color: 'amber-500' },
        ].map((s, idx) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            key={idx} 
            className="glass-card p-6 rounded-2xl border border-gray-200 dark:border-white/10 relative overflow-hidden group"
          >
             <div className={`absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity`}>
                <s.icon size={64}/>
             </div>
             <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{s.label}</p>
             <h3 className="text-3xl font-bold">{s.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Activity Chart */}
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl border border-gray-200 dark:border-white/10">
          <div className="flex items-center justify-between mb-8">
             <h3 className="font-bold flex items-center gap-2"><Activity size={18}/> Deployment Activity (24h)</h3>
          </div>
          <div className="h-[300px] w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={activityData}>
                <defs>
                  <linearGradient id="colorShifts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#111', border: 'none', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ color: '#8b5cf6' }}
                />
                <Area type="monotone" dataKey="shifts" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorShifts)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Real-time Feed */}
        <div className="glass-card p-6 rounded-2xl border border-gray-200 dark:border-white/10 space-y-6">
           <h3 className="font-bold flex items-center gap-2"><Clock size={18}/> Live Operations Feed</h3>
           <div className="space-y-4">
              {data.activeShifts.slice(0, 5).map((as, idx) => (
                <div key={idx} className="flex gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-l-2 border-brand-purple">
                   <div className="w-10 h-10 rounded-full bg-brand-purple/10 flex items-center justify-center text-brand-purple font-bold shrink-0">
                      {as.profiles?.full_name?.substring(0,1)}
                   </div>
                   <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{as.profiles?.full_name}</p>
                      <p className="text-xs text-gray-500">Deployed at <span className="text-brand-purple font-medium">{as.security_sites?.name}</span></p>
                      <p className="text-[10px] text-gray-400 mt-1">Today {new Date(as.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                   </div>
                </div>
              ))}
              {data.activeShifts.length === 0 && <p className="text-sm text-gray-500 text-center py-8">No active deployment data.</p>}
           </div>
        </div>
      </div>
    </div>
  );
};

export default TacticalConsole;
