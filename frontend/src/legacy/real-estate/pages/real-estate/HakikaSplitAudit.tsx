// @ts-nocheck
import { useEffect, useState } from 'react';
import { Clock3, RefreshCw } from 'lucide-react';
import { useAccess } from '../../context/AccessContext';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { supabase } from '../../utils/supabase';

type SplitAuditRow = {
  id: string;
  receipt_no: string | null;
  transaction_type: string;
  amount: number;
  company_revenue: number;
  landlord_payable: number;
  liability_before: number;
  liability_after: number;
  split_mode: string;
  split_rate: number;
  source: string;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export default function HakikaSplitAudit() {
  const { profile } = useAccess();
  const [items, setItems] = useState<SplitAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const refresh = async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hakika_split_audit')
        .select('id, receipt_no, transaction_type, amount, company_revenue, landlord_payable, liability_before, liability_after, split_mode, split_rate, source, status, metadata, created_at')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(120);
      if (error) throw error;
      setItems((data || []) as SplitAuditRow[]);
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to load split audit', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [profile?.company_id]);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 dark:bg-dark-bg md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-dark-surface lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">Audit</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">Split audit trail</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              This view shows how each split was calculated, what status it reached, and the receipt or invoice it was tied to.
            </p>
          </div>
          <button onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">
            <RefreshCw size={16} /> Refresh audit
          </button>
        </header>

        <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white dark:border-white/10 dark:bg-dark-surface">
          {loading ? (
            <div className="px-6 py-10 text-sm text-slate-500">Loading split audit...</div>
          ) : items.length === 0 ? (
            <div className="px-6 py-12 text-sm text-slate-500">No split audit rows yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wider text-slate-400 dark:border-white/10">
                  <tr>
                    <th className="px-6 py-3">Receipt</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">Revenue</th>
                    <th className="px-6 py-3">Payable</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{item.receipt_no || '—'}</div>
                        <div className="text-xs text-slate-400">{item.split_mode} · {item.split_rate}</div>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
                        {item.transaction_type}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">KES {Number(item.amount || 0).toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-200">KES {Number(item.company_revenue || 0).toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-700 dark:text-slate-200">KES {Number(item.landlord_payable || 0).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <Badge status={item.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                        <Clock3 size={11} className="mr-1 inline" />
                        {new Date(item.created_at).toLocaleString('en-KE')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const tone =
    status === 'settled'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
      : status === 'failed'
        ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
        : status === 'queued'
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
          : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300';
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${tone}`}>{status}</span>;
}
