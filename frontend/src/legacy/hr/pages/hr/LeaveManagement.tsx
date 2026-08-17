// @ts-nocheck
import React from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  UserCheck, 
  CalendarDays, 
  Shield, 
  Clock,
  CheckCircle,
  XCircle,
  Search,
  ChevronRight
} from 'lucide-react';

const LeaveManagement: React.FC = () => {
  return (
    <div className="p-6 lg:p-10 space-y-10 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">Availability Control</h1>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest italic">Operations • Leave Master</p>
        </div>
        <button className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xl flex items-center gap-2" title="Open the organization-wide leave calendar">
            View Unified Calendar <CalendarDays size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-[32px] flex items-center justify-between group cursor-pointer hover:bg-emerald-500/20 transition-all">
            <div>
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">On Duty</p>
                <p className="text-3xl font-black text-emerald-900 dark:text-emerald-400">1,180</p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
                <UserCheck size={24} />
            </div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-[32px] flex items-center justify-between group cursor-pointer hover:bg-amber-500/20 transition-all">
            <div>
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Active Leave</p>
                <p className="text-3xl font-black text-amber-900 dark:text-amber-400">42</p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/20">
                <Calendar size={24} />
            </div>
        </div>
        <div className="bg-pink-500/10 border border-pink-500/20 p-6 rounded-[32px] flex items-center justify-between group cursor-pointer hover:bg-pink-500/20 transition-all">
            <div>
                <p className="text-[10px] font-black text-pink-600 uppercase tracking-widest mb-1">Late Today</p>
                <p className="text-3xl font-black text-pink-900 dark:text-pink-400">26</p>
            </div>
            <div className="p-4 rounded-2xl bg-pink-500 text-white shadow-lg shadow-pink-500/20">
                <Clock size={24} />
            </div>
        </div>
      </div>

      <div className="bg-white/70 dark:bg-black/20 backdrop-blur-2xl border border-gray-200/50 dark:border-white/5 rounded-[32px] shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-gray-100 dark:border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-md font-black text-gray-900 dark:text-white tracking-tight uppercase tracking-widest">Pending Approvals Hub</h2>
            <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search approvals..." title="Search leave approvals" className="w-full bg-gray-50 dark:bg-white/5 border border-transparent focus:border-brand-purple rounded-xl py-2 pl-9 pr-4 text-xs outline-none transition-all" />
            </div>
        </div>
        <div className="p-4">
            {[
                { name: 'Elite Team Zulu • Staff Sergeant', type: 'Annual Leave', duration: 'Oct 12 - Oct 24', status: 'Pending Command' },
                { name: 'Branch Ops • Lead Technician', type: 'Sick Off', duration: 'Oct 15 - Oct 17', status: 'Verifying Medical' },
                { name: 'Internal Logistics • Admin', type: 'Compassionate', duration: 'Oct 14 - Oct 14', status: 'Critical Action' },
            ].map((req, i) => (
                <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-white/5 rounded-2xl transition-all group">
                    <div className="flex items-center gap-4 mb-4 sm:mb-0">
                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-400 font-black text-[10px]">
                            {req.name.charAt(0)}
                        </div>
                        <div>
                            <h4 className="text-xs font-black text-gray-900 dark:text-white group-hover:text-brand-purple transition-colors">{req.name}</h4>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{req.type}</span>
                                <span className="text-[9px] text-gray-300">•</span>
                                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{req.duration}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                        <span className="text-[9px] font-black text-brand-purple uppercase tracking-widest bg-brand-purple/10 px-2 py-1 rounded-full">{req.status}</span>
                        <div className="flex items-center gap-2">
                            <button title="Approve Leave Request" aria-label="Approve Leave Request" className="p-2 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-all"><CheckCircle size={16} /></button>
                            <button title="Reject Leave Request" aria-label="Reject Leave Request" className="p-2 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"><XCircle size={16} /></button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
        <div className="bg-gray-50/50 dark:bg-white/2 p-4 text-center">
            <button className="text-[10px] font-black text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all uppercase tracking-widest flex items-center justify-center gap-2 mx-auto" title="Navigate to the full leave approvals page">
                View Full Approvals Queue <ChevronRight size={12} />
            </button>
        </div>
      </div>
    </div>
  );
};

export default LeaveManagement;
