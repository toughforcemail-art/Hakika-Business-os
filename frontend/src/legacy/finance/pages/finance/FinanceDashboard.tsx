// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  BarChart2, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight,
  PieChart,
  Target,
  AlertCircle,
  Clock,
  Filter,
  Download,
  Building,
  Landmark
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../../utils/supabase';
import CustomLoader from '../../components/CustomLoader';
import { useAccess } from '../../context/AccessContext';

const FinanceDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const { profile } = useAccess();
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netProfit: 0,
    growthRate: 0
  });

  const abortControllerRef = React.useRef<AbortController | null>(null);

  useEffect(() => {
    fetchFinancialStats();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const fetchFinancialStats = async () => {
    // 1. Cancel previous
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    try {
      const userRole = (profile?.role || '').toLowerCase();
      const isElevated = ['super admin', 'director', 'director / super admin', 'administrator', 'accountant'].includes(userRole);

      let query = supabase
        .from('finance_ledger')
        .select('debit, credit, category')
        .abortSignal(controller.signal);

      if (!isElevated) {
        if (profile?.company_id) {
          query = query.eq('company_id', profile.company_id);
        } else if (profile?.company_code) {
          query = query.eq('company_code', profile.company_code);
        }
      }

      let { data, error } = await query;
      if (isElevated && (!data || data.length === 0) && !error) {
        const fallback = await supabase
          .from('finance_ledger')
          .select('debit, credit, category')
          .abortSignal(controller.signal)
          .limit(1000);
        data = fallback.data;
        error = fallback.error;
      }

      if (controller.signal.aborted) return;
      if (error) throw error;

      let revenue = 0;
      let expenses = 0;

      data?.forEach(entry => {
        if (entry.category === 'Income') revenue += Number(entry.credit);
        if (entry.category === 'Expense') expenses += Number(entry.debit);
      });

      setStats({
        totalRevenue: revenue,
        totalExpenses: expenses,
        netProfit: revenue - expenses,
        growthRate: 15.4
      });
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching financial stats:', error);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center"><CustomLoader size={40} label="Consolidating group accounts..." /></div>;

  return (
    <div className="min-h-full w-full p-6 lg:p-10 space-y-8 bg-white dark:bg-dark-bg text-gray-900 dark:text-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-200 dark:border-dark-border pb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Landmark className="text-brand-purple" /> Finance Command Center
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-text">
            Consolidated financial oversight for Hakika and its business units.
          </p>
        </div>
        <div className="flex gap-3">
           <button 
             title="Export financial report to PDF/Excel"
             className="px-4 py-2 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition flex items-center gap-2"
           >
              <Download size={14} /> Export Report
           </button>
           <button 
             title="Log a new transaction entry"
             className="px-4 py-2 bg-brand-purple text-white text-xs font-bold rounded-xl hover:bg-opacity-90 transition shadow-lg shadow-brand-purple/20"
           >
              New Transaction
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Total Group Revenue" 
          value={`KES ${(stats.totalRevenue / 1000000).toFixed(1)}M`} 
          trend="+14.2%" 
          trendUp={true} 
          icon={<ArrowUpRight size={20}/>}
          color="bg-emerald-500"
        />
        <StatCard 
          label="Total Group Expenses" 
          value={`KES ${(stats.totalExpenses / 1000000).toFixed(1)}M`} 
          trend="+5.8%" 
          trendUp={false} 
          icon={<ArrowDownRight size={20}/>}
          color="bg-rose-500"
        />
        <StatCard 
          label="Net Operating Profit" 
          value={`KES ${(stats.netProfit / 1000000).toFixed(1)}M`} 
          trend="+18.4%" 
          trendUp={true} 
          icon={<TrendingUp size={20}/>}
          color="bg-brand-purple"
        />
        <StatCard 
          label="Budget Overhead" 
          value="42%" 
          trend="-2.1%" 
          trendUp={true} 
          icon={<PieChart size={20}/>}
          color="bg-amber-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card p-6">
           <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold flex items-center gap-2 italic">
                <BarChart2 className="text-brand-purple" size={20}/> Monthly Revenue Streams
              </h2>
              <select 
                title="Filter streams by company"
                className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg p-1.5 text-[10px] font-bold outline-none"
              >
                 <option>All Companies</option>
                 <option>Hakika Security</option>
                 <option>Hakika Real Estate</option>
              </select>
           </div>
           <div className="h-64 flex items-end justify-between gap-2 px-4">
              {[65, 45, 75, 55, 85, 95, 80, 70, 90, 100, 85, 90].map((val, i) => (
                <div key={i} className="flex-1 space-y-2 group cursor-pointer">
                   <div className="relative h-full flex items-end justify-center">
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${val}%` }}
                        className={`w-full rounded-t-lg ${i % 2 === 0 ? 'bg-brand-purple/40 group-hover:bg-brand-purple' : 'bg-emerald-500/40 group-hover:bg-emerald-500'} transition-all`}
                      />
                   </div>
                   <p className="text-[9px] text-center font-black text-gray-400 rotate-45 md:rotate-0">
                      {['J','F','M','A','M','J','J','A','S','O','N','D'][i]}
                   </p>
                </div>
              ))}
           </div>
        </div>

        <div className="glass-card p-6">
           <h2 className="text-lg font-bold mb-6 flex items-center gap-2 italic">
             <Building className="text-amber-500" size={20}/> Entity Performance
           </h2>
           <div className="space-y-6">
              <EntityStat label="Hakika Security" value="KES 3.2M" percentage={60} color="bg-brand-purple" />
              <EntityStat label="Hakika Real Estate" value="KES 1.8M" percentage={35} color="bg-emerald-500" />
              <EntityStat label="Group Services" value="KES 240K" percentage={5} color="bg-amber-500" />
           </div>
           
           <div className="mt-10 p-4 bg-gray-50 dark:bg-white/2 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
              <div className="flex items-center gap-3 mb-2">
                 <AlertCircle size={16} className="text-rose-500" />
                 <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500">Tax Deadline</h4>
              </div>
              <p className="text-[10px] text-gray-400 font-bold uppercase">PAYE & VAT filing due in 4 days.</p>
           </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, trend, trendUp, icon, color }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass-card p-6 border border-gray-100 dark:border-white/5"
  >
    <div className="flex justify-between items-start mb-4">
      <div className={`p-2.5 rounded-xl ${color} text-white shadow-lg shadow-current/20`}>
        {icon}
      </div>
      <span className={`text-[10px] font-black ${trendUp ? 'text-emerald-500' : 'text-rose-500'} bg-gray-50 dark:bg-white/5 px-2 py-1 rounded-lg`}>
        {trend}
      </span>
    </div>
    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest leading-none mb-1">{label}</p>
    <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
  </motion.div>
);

const EntityStat = ({ label, value, percentage, color }: any) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 dark:text-white">{value}</span>
    </div>
    <div className="h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        className={`h-full ${color}`}
      />
    </div>
  </div>
);

export default FinanceDashboard;
