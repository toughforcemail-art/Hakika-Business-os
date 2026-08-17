// @ts-nocheck
import { useEffect, useState } from 'react';
import { Clock3, RefreshCw } from 'lucide-react';
import { useAccess } from '../../context/AccessContext';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { loadPayoutRequests, PayoutRequest } from './hakikaPayoutData';

export default function HakikaPayoutHistory() {
  const { profile } = useAccess();
  const [items, setItems] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const refresh = async () => { if (!profile?.company_id) return; setLoading(true); try { setItems(await loadPayoutRequests(profile.company_id)); } catch (error: any) { setToast({ message: error?.message || 'Failed to load payout history', type: 'error' }); } finally { setLoading(false); } };
  useEffect(() => { void refresh(); }, [profile?.company_id]);
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 dark:bg-dark-bg md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-dark-surface lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">History</p><h1 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">Payout request history</h1></div><button onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"><RefreshCw size={16} /> Refresh history</button></header>
        <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white dark:border-white/10 dark:bg-dark-surface">{loading ? <div className="px-6 py-10 text-sm text-slate-500">Loading history...</div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wider text-slate-400 dark:border-white/10"><tr><th className="px-6 py-3">Recipient</th><th className="px-6 py-3">Type</th><th className="px-6 py-3">Amount</th><th className="px-6 py-3">Status</th><th className="px-6 py-3">Reference</th><th className="px-6 py-3">Date</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-white/5">{items.map((item) => <tr key={item.id}><td className="px-6 py-4"><div className="font-semibold text-slate-900 dark:text-white">{item.recipient_name || '—'}</div><div className="text-xs text-slate-400">{item.recipient_phone || item.recipient_shortcode || '—'}</div></td><td className="px-6 py-4"><Badge label={item.request_type.toUpperCase()} /></td><td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">KSh {Number(item.amount || 0).toLocaleString()}</td><td className="px-6 py-4"><Badge label={item.request_status} tone={item.request_status === 'failed' ? 'red' : item.request_status === 'sent' || item.request_status === 'success' ? 'green' : 'slate'} /></td><td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">{item.daraja_reference || '—'}</td><td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400"><Clock3 size={11} className="mr-1 inline" />{new Date(item.created_at).toLocaleString('en-KE')}</td></tr>)}</tbody></table></div>}</section>
      </div>
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
function Badge({ label, tone = 'slate' }: { label: string; tone?: 'slate' | 'green' | 'red' }) { const styles = tone === 'green' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : tone === 'red' ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'; return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${styles}`}>{label}</span>; }
