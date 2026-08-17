// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { BookOpen, RefreshCw, Filter, ReceiptText } from 'lucide-react';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';

interface LedgerRow {
  id: string;
  transaction_date: string;
  transaction_type: string;
  category: string;
  description: string | null;
  amount: number;
  balance_after: number | null;
  payment_method: string | null;
  reference_id: string | null;
  source_module: string | null;
}

export default function HakikaLedger() {
  const { profile } = useAccess();
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [filter, setFilter] = useState('all');

  const fetchRows = async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      let query = supabase.from('re_finance_ledger').select('*').eq('company_id', profile.company_id).order('created_at', { ascending: false }).limit(200);
      if (filter !== 'all') query = query.eq('payment_method', filter);
      const { data, error } = await query;
      if (error) throw error;
      setRows((data || []) as LedgerRow[]);
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to load Hakika ledger', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [profile?.company_id, filter]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <BookOpen className="text-brand-purple" size={32} />
              Hakika Ledger
            </h1>
            <p className="text-gray-500 dark:text-gray-400">Callback ingests and manual journal entries from Daraja land here.</p>
          </div>
          <button onClick={fetchRows} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-purple text-white font-semibold">
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-white/10 p-4 flex items-center gap-3">
          <Filter size={18} className="text-gray-400" />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 px-4 py-2.5 rounded-xl outline-none text-gray-900 dark:text-white">
            <option value="all">All methods</option>
            <option value="mpesa">M-Pesa</option>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank</option>
          </select>
        </div>

        <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center"><CustomLoader size={32} label="Loading Hakika ledger..." /></div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <ReceiptText className="mx-auto mb-4 text-gray-300" size={48} />
              <p>No ledger entries yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="px-6 py-4 text-left font-medium text-gray-500">Date</th>
                    <th className="px-6 py-4 text-left font-medium text-gray-500">Type</th>
                    <th className="px-6 py-4 text-left font-medium text-gray-500">Category</th>
                    <th className="px-6 py-4 text-left font-medium text-gray-500">Description</th>
                    <th className="px-6 py-4 text-left font-medium text-gray-500">Ref</th>
                    <th className="px-6 py-4 text-right font-medium text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{new Date(row.transaction_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 capitalize">{row.transaction_type}</td>
                      <td className="px-6 py-4">{row.category}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{row.description || '-'}</td>
                      <td className="px-6 py-4 text-xs font-mono">{row.reference_id || '-'}</td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900 dark:text-white">KES {Number(row.amount || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
