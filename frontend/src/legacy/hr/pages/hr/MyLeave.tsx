// @ts-nocheck
import React from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  History, 
  CalendarPlus, 
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronRight,
  Sparkles
} from 'lucide-react';

const MyLeave: React.FC = () => {
  return (
    <div className="p-6 lg:p-10 space-y-10 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">My Availability</h1>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest italic">Personal Portal • Leave Planner</p>
        </div>
        <button className="px-6 py-2.5 bg-brand-purple text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-brand-purple/20 flex items-center gap-2">
            Request Time Off <CalendarPlus size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-indigo-600 p-8 rounded-[32px] text-white shadow-xl shadow-indigo-600/20 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 blur-3xl group-hover:bg-white/20 transition-all rounded-full"></div>
            <h3 className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-2">Annual Leave Balance</h3>
            <p className="text-4xl font-black mb-1">18.5 <span className="text-lg text-indigo-200 font-bold">Days</span></p>
            <p className="text-[10px] text-indigo-200 font-medium">Expires Dec 31, 2026</p>
          </div>
          
          <div className="bg-white/70 dark:bg-black/20 backdrop-blur-xl border border-gray-200/50 dark:border-white/5 p-8 rounded-[32px] shadow-xl">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Sick Leave</h3>
            <p className="text-4xl font-black text-gray-900 dark:text-white mb-1">10 <span className="text-lg text-gray-400 font-bold">Days</span></p>
            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-tight italic">Fully Accrued</p>
          </div>

          <div className="bg-white/70 dark:bg-black/20 backdrop-blur-xl border border-gray-200/50 dark:border-white/5 p-8 rounded-[32px] shadow-xl">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Next Approved Off</h3>
            <p className="text-3xl font-black text-gray-900 dark:text-white mb-1">Nov 24</p>
            <div className="flex items-center gap-2 text-indigo-500 text-[10px] font-black uppercase">
                <Sparkles size={12} /> 4 Days Duration
            </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white/70 dark:bg-black/20 backdrop-blur-2xl border border-gray-200/50 dark:border-white/5 rounded-[32px] shadow-2xl">
            <div className="p-8 border-b border-gray-100 dark:border-white/5">
                <h2 className="text-md font-black text-gray-900 dark:text-white tracking-tight uppercase tracking-widest">Leave Request History</h2>
            </div>
            <div className="p-4 space-y-2">
                {[
                    { type: 'Annual Leave', dates: 'Oct 12 - Oct 16', status: 'Approved', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                    { type: 'Sick Off', dates: 'Sep 04 - Sep 05', status: 'Verified', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
                    { type: 'Compassionate', dates: 'Jun 10 - Jun 11', status: 'Completed', color: 'text-gray-400', bg: 'bg-gray-100' },
                ].map((lv, i) => (
                    <div key={i} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 rounded-2xl transition-all group border border-transparent hover:border-gray-100 dark:hover:border-white/5">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-400 group-hover:text-brand-purple transition-all">
                                <History size={18} />
                            </div>
                            <div>
                                <h4 className="text-xs font-black text-gray-900 dark:text-white">{lv.type}</h4>
                                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{lv.dates}</p>
                            </div>
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${lv.bg} ${lv.color} px-3 py-1 rounded-full`}>{lv.status}</span>
                    </div>
                ))}
            </div>
        </div>

        <div className="bg-white/70 dark:bg-black/20 backdrop-blur-2xl border border-gray-200/50 dark:border-white/5 rounded-[32px] p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-8">
                <AlertCircle className="text-brand-purple" size={20} />
                <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-widest">Policy Reminders</h3>
            </div>
            <div className="space-y-6">
                <div className="space-y-2 text-[11px] leading-relaxed">
                    <p className="font-bold text-gray-900 dark:text-white">Annual leave requires 14 days notice.</p>
                    <p className="text-gray-500">Medical certificates are mandatory for sick leave exceeding 2 days.</p>
                </div>
                <div className="h-px bg-gray-100 dark:bg-white/5 w-full"></div>
                <button className="w-full py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all">
                    View Employee Handbook
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default MyLeave;
