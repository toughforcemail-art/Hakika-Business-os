// @ts-nocheck
import { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, TimerReset } from 'lucide-react';
import { useAccess } from '../../context/AccessContext';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { loadPayoutJobs, PayoutJob } from './hakikaPayoutData';
import { supabase } from '../../utils/supabase';

export default function HakikaPayoutQueue() {
  const { profile } = useAccess();
  const [items, setItems] = useState<PayoutJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const refresh = async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      setItems(await loadPayoutJobs(profile.company_id));
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to load queue', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [profile?.company_id]);

  const approve = async (jobId: string) => {
    setApprovingId(jobId);
    try {
      const { error } = await supabase.rpc('approve_mpesa_payout_job', { p_job_id: jobId });
      if (error) throw error;
      setToast({ message: 'Payout job approved and queued for processing.', type: 'success' });
      await refresh();
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to approve payout job', type: 'error' });
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-6 dark:from-dark-bg dark:via-dark-bg dark:to-emerald-950/20 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-dark-surface">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">Execution queue</p>
              <h1 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">Queued payout jobs</h1>
            </div>
            <button onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">
              <RefreshCw size={16} /> Refresh queue
            </button>
          </div>
        </header>

        <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white dark:border-white/10 dark:bg-dark-surface">
          {loading ? (
            <div className="px-6 py-10 text-sm text-slate-500">Loading queue...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wider text-slate-400 dark:border-white/10">
                  <tr>
                    <th className="px-6 py-3">Job</th>
                    <th className="px-6 py-3">Beneficiary</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Attempts</th>
                    <th className="px-6 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{item.payout_type.toUpperCase()}</div>
                        <div className="text-xs text-slate-400">{item.queue_source}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{item.beneficiary_name || '—'}</div>
                        <div className="text-xs text-slate-400">{item.beneficiary_phone || item.beneficiary_shortcode || '—'}</div>
                      </td>
                      <td className="px-6 py-4"><Badge status={item.status} /></td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{item.attempts}</td>
                      <td className="px-6 py-4">
                        {item.status === 'pending_approval' ? (
                          <button
                            type="button"
                            onClick={() => void approve(item.id)}
                            disabled={approvingId === item.id}
                            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                          >
                            <CheckCircle2 size={14} /> {approvingId === item.id ? 'Approving...' : 'Approve'}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">No action</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
          <div className="flex items-start gap-3">
            <TimerReset size={18} className="mt-0.5 text-emerald-600" />
            <p>Pending approval jobs stay blocked until a reviewer approves them, then the worker can process the queue.</p>
          </div>
        </section>
      </div>
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const tone = status === 'succeeded' || status === 'sent'
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
    : status === 'failed'
      ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
      : status === 'pending_approval'
        ? 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300'
        : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${tone}`}>{status}</span>;
}
