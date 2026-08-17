// @ts-nocheck
import React, { useState } from 'react';
import { Users, Shield, Building, Activity, TrendingUp, Clock, AlertCircle, CheckCircle2, BarChart2, Zap } from 'lucide-react';

type Tab = 'hr' | 'security' | 'real-estate';

const tabs: { id: Tab; label: string; icon: React.ElementType; color: string; accent: string }[] = [
  { id: 'hr', label: 'HR Module', icon: Users, color: 'text-brand-purple', accent: 'bg-brand-purple' },
  { id: 'security', label: 'Security Module', icon: Shield, color: 'text-cyan-400', accent: 'bg-cyan-400' },
  { id: 'real-estate', label: 'Real Estate Module', icon: Building, color: 'text-amber-400', accent: 'bg-amber-400' },
];

// --- HR Dashboard Preview ---
const HRPreview: React.FC = () => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    {[
      { label: 'Total Employees', value: '284', icon: Users, delta: '+4 this month', color: 'text-brand-purple' },
      { label: 'On Duty Today', value: '211', icon: CheckCircle2, delta: '74% attendance', color: 'text-green-400' },
      { label: 'Pending Leave', value: '12', icon: Clock, delta: 'Needs approval', color: 'text-amber-400' },
      { label: 'Payroll Ready', value: '96%', icon: BarChart2, delta: '7 exceptions', color: 'text-blue-400' },
    ].map((stat, i) => (
      <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className={`${stat.color} mb-2`}><stat.icon size={20} /></div>
        <div className="text-2xl font-black text-white">{stat.value}</div>
        <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-1">{stat.label}</div>
        <div className="text-[10px] text-gray-500 mt-1">{stat.delta}</div>
      </div>
    ))}
    <div className="col-span-2 md:col-span-4 bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-3">Payroll Processing — Last 6 Months</div>
      <div className="flex items-end gap-2 h-16">
        {[65, 72, 68, 80, 75, 96].map((val, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-brand-purple/40 to-brand-purple transition-all"
              style={{ height: `${val}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// --- Security Dashboard Preview ---
const SecurityPreview: React.FC = () => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    {[
      { label: 'Active Sites', value: '34', icon: Shield, delta: '2 on alert', color: 'text-cyan-400' },
      { label: 'Guards On Duty', value: '189', icon: Users, delta: '94% coverage', color: 'text-green-400' },
      { label: 'Incidents Today', value: '3', icon: AlertCircle, delta: '1 escalated', color: 'text-red-400' },
      { label: 'Patrols Done', value: '47', icon: Activity, delta: 'of 52 planned', color: 'text-blue-400' },
    ].map((stat, i) => (
      <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className={`${stat.color} mb-2`}><stat.icon size={20} /></div>
        <div className="text-2xl font-black text-white">{stat.value}</div>
        <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-1">{stat.label}</div>
        <div className="text-[10px] text-gray-500 mt-1">{stat.delta}</div>
      </div>
    ))}
    <div className="col-span-2 md:col-span-4 bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-3">Live Incident Feed</div>
      <div className="space-y-2">
        {[
          { time: '20:44', msg: 'Gate B — Unauthorised access attempt', color: 'text-red-400' },
          { time: '19:12', msg: 'Site 7 — Patrol completed on schedule', color: 'text-green-400' },
          { time: '18:55', msg: 'Control room — Shift handover logged', color: 'text-cyan-400' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span className="text-gray-500 font-mono text-xs w-12">{item.time}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${item.color.replace('text', 'bg')}`} />
            <span className="text-gray-300">{item.msg}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// --- Real Estate Dashboard Preview ---
const RealEstatePreview: React.FC = () => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    {[
      { label: 'Total Units', value: '312', icon: Building, delta: '91% occupied', color: 'text-amber-400' },
      { label: 'Revenue (MoM)', value: 'KES 4.2M', icon: TrendingUp, delta: '+11% vs last', color: 'text-green-400' },
      { label: 'Pending Invoices', value: '18', icon: AlertCircle, delta: 'KES 280K overdue', color: 'text-red-400' },
      { label: 'Maintenance', value: '5 open', icon: Zap, delta: '2 escalated', color: 'text-blue-400' },
    ].map((stat, i) => (
      <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className={`${stat.color} mb-2`}><stat.icon size={20} /></div>
        <div className="text-2xl font-black text-white">{stat.value}</div>
        <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-1">{stat.label}</div>
        <div className="text-[10px] text-gray-500 mt-1">{stat.delta}</div>
      </div>
    ))}
    <div className="col-span-2 md:col-span-4 bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-3">Occupancy Rate — Last 6 Months</div>
      <div className="flex items-end gap-2 h-16">
        {[78, 82, 85, 88, 90, 91].map((val, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md bg-gradient-to-t from-amber-400/40 to-amber-400 transition-all"
              style={{ height: `${val}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const previewMap: Record<Tab, React.ReactNode> = {
  hr: <HRPreview />,
  security: <SecurityPreview />,
  'real-estate': <RealEstatePreview />,
};

const DashboardShowcase: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('hr');
  const active = tabs.find(t => t.id === activeTab)!;

  return (
    <div className="rounded-3xl bg-white/5 dark:bg-white/[0.03] border border-white/10 overflow-hidden shadow-2xl shadow-black/20 backdrop-blur-sm">
      {/* Tab Bar */}
      <div className="flex items-center gap-1 p-4 border-b border-white/10 bg-white/5">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === tab.id
                ? `${tab.color} bg-white/10`
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
        {/* Window chrome dots */}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-2 h-2 rounded-full ${active.accent} animate-pulse`} />
          <span className={`text-xs font-black uppercase tracking-[0.2em] ${active.color}`}>
            {active.label} — Live Preview
          </span>
        </div>
        {previewMap[activeTab]}
      </div>
    </div>
  );
};

export default DashboardShowcase;
