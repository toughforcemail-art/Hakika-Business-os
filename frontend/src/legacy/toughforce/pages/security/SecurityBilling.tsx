// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { 
  DollarSign, 
  Building, 
  Clock, 
  FileText, 
  Receipt, 
  TrendingUp, 
  AlertCircle,
  Download,
  Plus,
  BarChart2,
  Calendar
} from 'lucide-react';
import { motion } from 'framer-motion';

const SecurityBilling: React.FC = () => {
  const [summaries, setSummaries] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: sData } = await supabase.from('security_sites').select('id, name, hourly_rate');
      if (sData) setSites(sData);
      await fetchBilling();
    } catch (error) {
      console.error("Fetch error:", error);
    }
    setLoading(false);
  };

  const fetchBilling = async () => {
    const { data } = await supabase
      .from('security_billing_summaries')
      .select('*, security_sites(name, hourly_rate)')
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    if (data) setSummaries(data);
  };

  const generateBilling = async () => {
    setLoading(true);
    try {
      for (const site of sites) {
        // Calculate total hours from shifts
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 1);
        
        const { data: shifts } = await supabase
          .from('security_shifts')
          .select('start_time, end_time')
          .eq('site_id', site.id)
          .gte('start_time', startDate.toISOString())
          .lt('start_time', endDate.toISOString());

        let totalHours = 0;
        shifts?.forEach(s => {
          const diff = new Date(s.end_time).getTime() - new Date(s.start_time).getTime();
          totalHours += diff / (1000 * 60 * 60);
        });

        const totalAmount = totalHours * (site.hourly_rate || 0);

        await supabase.from('security_billing_summaries').upsert({
          site_id: site.id,
          month,
          year,
          total_hours: totalHours,
          total_amount: totalAmount,
          status: 'draft'
        }, { onConflict: 'site_id, month, year' });
      }
      await fetchBilling();
      setShowGenerate(false);
    } catch (error) {
      console.error("Billing error:", error);
      alert("Error generating billing summaries");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-full w-full p-6 lg:p-10 space-y-8 bg-white dark:bg-dark-bg text-gray-900 dark:text-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-200 dark:border-dark-border pb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <DollarSign className="text-brand-purple" /> Security Revenue & Billing
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-text">
            Automated site invoicing based on guard deployment and hourly service rates.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowGenerate(true)} 
            title="Open monthly billing generator"
            className="px-4 py-2 bg-brand-purple text-white text-sm font-medium rounded-xl hover:bg-opacity-90 transition flex items-center gap-2 shadow-lg shadow-brand-purple/20"
          >
            <Plus size={16} /> Generate Monthly Billing
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <div className="glass-card p-6 bg-brand-purple/5 border-brand-purple/20">
            <TrendingUp size={24} className="text-brand-purple mb-4"/>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">MTD Revenue</h3>
            <div className="text-2xl font-black italic tracking-tighter">KES {summaries.reduce((acc, s) => acc + (s.month === month ? s.total_amount : 0), 0).toLocaleString()}</div>
         </div>
         <div className="glass-card p-6">
            <Clock size={24} className="text-emerald-500 mb-4"/>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-1">Total Guard Hours</h3>
            <div className="text-2xl font-black italic tracking-tighter">{summaries.reduce((acc, s) => acc + (s.month === month ? s.total_hours : 0), 0).toFixed(1)} hrs</div>
         </div>
      </div>

      <div className="glass-card rounded-3xl border border-gray-200 dark:border-white/10 overflow-hidden shadow-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Site / Customer</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Period</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-center">Hours</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Total Amount</th>
              <th className="p-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map(s => (
              <tr key={s.id} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-all group">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-white/10 flex items-center justify-center text-brand-purple font-black">
                       <Building size={20}/>
                    </div>
                    <div>
                       <div className="font-bold text-sm tracking-tight">{s.security_sites?.name}</div>
                       <div className="text-[10px] text-gray-400 uppercase font-bold tracking-widest italic leading-none">Rate: KES {s.security_sites?.hourly_rate}/hr</div>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-center">
                   <div className="text-xs font-black text-gray-500 bg-gray-100 dark:bg-white/5 px-3 py-1 rounded-full border border-gray-200 dark:border-white/10 uppercase tracking-tighter">
                      {new Date(0, s.month-1).toLocaleString('default', { month: 'long' })} {s.year}
                   </div>
                </td>
                <td className="p-4 text-center">
                   <span className="text-sm font-bold font-mono text-emerald-500">{s.total_hours.toFixed(1)}</span>
                </td>
                <td className="p-4 text-right">
                   <span className="text-sm font-black italic tracking-tighter">KES {s.total_amount.toLocaleString()}</span>
                </td>
                <td className="p-4 text-right">
                   <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${s.status === 'paid' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                      {s.status}
                   </span>
                </td>
              </tr>
            ))}
            {summaries.length === 0 && (
              <tr>
                <td colSpan={5} className="p-20 text-center">
                   <AlertCircle size={48} className="mx-auto text-gray-200 mb-4 opacity-50"/>
                   <p className="text-xs font-black uppercase tracking-widest text-gray-300">No billing summaries generated yet</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-3xl p-8 w-full max-w-sm">
             <h2 className="text-2xl font-black uppercase tracking-tighter mb-4 italic">Confirm Billing Sync</h2>
             <p className="text-sm text-gray-500 mb-6">This will calculate total deployment hours for <span className="text-brand-purple font-bold italic underline">all sites</span> for the selected period.</p>
             
             <div className="flex flex-col gap-4 mb-8">
                <div className="flex items-center gap-4">
                   <Calendar size={20} className="text-brand-purple"/>
                   <select 
                     className="flex-1 bg-gray-50 dark:bg-dark-surface p-2 rounded-xl text-sm" 
                     aria-label="Select month" 
                     title="Select month for billing"
                     value={month} 
                     onChange={e => setMonth(parseInt(e.target.value))}
                   >
                      {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>)}
                   </select>
                   <select 
                     className="flex-1 bg-gray-50 dark:bg-dark-surface p-2 rounded-xl text-sm" 
                     aria-label="Select year" 
                     title="Select year for billing"
                     value={year} 
                     onChange={e => setYear(parseInt(e.target.value))}
                   >
                      {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                   </select>
                </div>
             </div>

             <div className="flex flex-col gap-3">
                 <button 
                  onClick={generateBilling}
                  disabled={loading}
                  title="Initialize billing calculation for all sites"
                  className="w-full py-3 bg-brand-purple text-white font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-opacity-90 transition shadow-lg shadow-brand-purple/20"
                >
                   {loading ? 'Re-calculating...' : 'Start Revenue Run'}
                </button>
                 <button 
                  onClick={() => setShowGenerate(false)} 
                  title="Close generator and return"
                  className="text-xs font-black text-gray-400 uppercase tracking-widest pt-2"
                >
                  Cancel
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecurityBilling;
