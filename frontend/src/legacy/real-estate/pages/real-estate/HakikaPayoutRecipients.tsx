// @ts-nocheck
import { useEffect, useState } from 'react';
import { Phone, RefreshCw, Wallet } from 'lucide-react';
import { useAccess } from '../../context/AccessContext';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { loadPayoutRecipients, PayoutRecipient } from './hakikaPayoutData';

export default function HakikaPayoutRecipients() {
  const { profile } = useAccess();
  const [items, setItems] = useState<PayoutRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const refresh = async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try { setItems(await loadPayoutRecipients(profile.company_id)); } catch (error: any) { setToast({ message: error?.message || 'Failed to load recipients', type: 'error' }); } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, [profile?.company_id]);
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 dark:bg-dark-bg md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-dark-surface lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-600">Recipients</p><h1 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">Saved payout recipients</h1></div>
          <button onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"><RefreshCw size={16} /> Refresh</button>
        </header>
        <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white dark:border-white/10 dark:bg-dark-surface">
          {loading ? <div className="px-6 py-10 text-sm text-slate-500">Loading recipients...</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wider text-slate-400 dark:border-white/10"><tr><th className="px-6 py-3">Name</th><th className="px-6 py-3">Type</th><th className="px-6 py-3">Phone / shortcode</th><th className="px-6 py-3">Status</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">{items.map((item) => <tr key={item.id}><td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{item.recipient_name}</td><td className="px-6 py-4"><Badge label={item.payout_type.toUpperCase()} /></td><td className="px-6 py-4 text-slate-500 dark:text-slate-400">{item.recipient_phone || item.recipient_shortcode || '—'}</td><td className="px-6 py-4"><Badge label={item.is_active ? 'ACTIVE' : 'INACTIVE'} tone={item.is_active ? 'green' : 'slate'} /></td></tr>)}</tbody>
              </table>
            </div>
          )}
        </section>
        <section className="grid gap-4 md:grid-cols-2"><Tip icon={Phone} title="B2C" text="Phone recipients are used for landlord and agent mobile payouts." /><Tip icon={Wallet} title="B2B" text="Shortcode recipients stay separate so business payouts do not mix with personal numbers." /></section>
      </div>
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
function Badge({ label, tone = 'slate' }: { label: string; tone?: 'slate' | 'green' }) { const styles = tone === 'green' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'; return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${styles}`}>{label}</span>; }
function Tip({ icon: Icon, title, text }: { icon: any; title: string; text: string }) { return <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-dark-surface"><div className="flex items-start gap-3"><div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><Icon size={18} /></div><div><h3 className="font-bold text-slate-900 dark:text-white">{title}</h3><p className="mt-1 text-sm leading-7 text-slate-500 dark:text-slate-400">{text}</p></div></div></article>; }
