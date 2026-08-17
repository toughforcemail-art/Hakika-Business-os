// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { FileText, DollarSign, TrendingUp, AlertCircle, CheckCircle, PieChart, ShoppingBag, ArrowUpRight, ArrowDownRight, Printer } from 'lucide-react';
import { printWorkspacePage } from '../../utils/printHelpers';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';

export default function InvoiceOverview() {
  const { profile } = useAccess();
  const [stats, setStats] = useState({
    totalBilled: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    overdueCount: 0,
    collectionRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('re_invoices')
        .select('amount_due, amount_paid, status');

      if (error) throw error;

      if (data) {
        const billed = data.reduce((sum, inv) => sum + inv.amount_due, 0);
        const paid = data.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);
        const outstanding = billed - paid;
        const overdue = data.filter(inv => inv.status === 'overdue').length;
        const rate = billed > 0 ? (paid / billed) * 100 : 0;

        setStats({
          totalBilled: billed,
          totalPaid: paid,
          totalOutstanding: outstanding,
          overdueCount: overdue,
          collectionRate: rate
        });
      }
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      setToast({ message: 'Failed to load financial metrics', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) fetchStats();
  }, [profile]);

  const cards = [
    { label: 'Total Billed', value: `Ksh ${stats.totalBilled.toLocaleString()}`, icon: DollarSign, color: 'text-brand-purple', bg: 'bg-brand-purple/10' },
    { label: 'Total Collected', value: `Ksh ${stats.totalPaid.toLocaleString()}`, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10', trend: '+12.5%' },
    { label: 'Outstanding', value: `Ksh ${stats.totalOutstanding.toLocaleString()}`, icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-500/10', trend: '-2.3%' },
    { label: 'Collection Rate', value: `${stats.collectionRate.toFixed(1)}%`, icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
              <PieChart className="mr-3 text-brand-purple" size={32} />
              Billing Analytics
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              High-level overview of revenue, collections, and outstanding payments.
            </p>
          </div>
          <button title="Print billing analytics report" className="p-2 bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 transition-colors" onClick={() => printWorkspacePage()}>
            <Printer size={20} />
          </button>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <CustomLoader size={40} label="Calculating financial metrics..." />
          </div>
        ) : (
          <>
            {/* Main Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {cards.map((card, i) => (
                <div key={i} className="bg-white dark:bg-dark-surface p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`${card.bg} ${card.color} p-3 rounded-xl`}>
                      <card.icon size={24} />
                    </div>
                    {card.trend && (
                      <span className={`flex items-center text-xs font-bold ${card.trend.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                        {card.trend.startsWith('+') ? <ArrowUpRight size={14} className="mr-0.5" /> : <ArrowDownRight size={14} className="mr-0.5" />}
                        {card.trend}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{card.label}</h3>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
                </div>
              ))}
            </div>

            {/* Charts Placeholder/Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white dark:bg-dark-surface p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Revenue Trend (Last 6 Months)</h3>
                <div className="h-64 flex items-end justify-between gap-2 px-4">
                  {[45, 60, 55, 80, 70, 90].map((height, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                       <div 
                         className="w-full bg-brand-purple/20 group-hover:bg-brand-purple/40 transition-colors rounded-t-lg relative"
                         style={{ height: `${height}%` }}
                       >
                         <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                           Ksh {(height * 1000).toLocaleString()}
                         </div>
                       </div>
                       <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                         {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i]}
                       </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-dark-surface p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Payment Distribution</h3>
                <div className="space-y-6">
                   {[
                     { label: 'M-Pesa Receipts', percentage: 75, color: 'bg-[#29B036]' },
                     { label: 'Bank Transfers', percentage: 15, color: 'bg-blue-500' },
                     { label: 'Cash/Manual', percentage: 10, color: 'bg-orange-500' },
                   ].map((item, i) => (
                     <div key={i}>
                       <div className="flex justify-between text-sm mb-2">
                         <span className="text-gray-600 dark:text-gray-400 font-medium">{item.label}</span>
                         <span className="text-gray-900 dark:text-white font-bold">{item.percentage}%</span>
                       </div>
                       <div className="w-full h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                         <div className={`h-full ${item.color}`} style={{ width: `${item.percentage}%` }}></div>
                       </div>
                     </div>
                   ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
