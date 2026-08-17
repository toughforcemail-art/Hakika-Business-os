// @ts-nocheck
import { FormEvent, useEffect, useState } from 'react';
import { Banknote, Plus, RefreshCw, Save, Send } from 'lucide-react';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { useAccess } from '../../context/AccessContext';
import { supabase } from '../../utils/supabase';

type BankAccount = {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  account_type: string | null;
  currency: string | null;
  current_balance: number | null;
  is_active: boolean;
};

type Draft = {
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  account_type: string;
  current_balance: string;
};

const EMPTY: Draft = {
  bank_name: '',
  account_number: '',
  account_holder_name: '',
  account_type: 'checking',
  current_balance: '0',
};

export default function HakikaBankJoin() {
  const { profile } = useAccess();
  const [items, setItems] = useState<BankAccount[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [queueingId, setQueueingId] = useState<string | null>(null);
  const [payoutDraft, setPayoutDraft] = useState<{ account: BankAccount; amount: string; confirmation: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const companyId = profile?.company_id || null;

  const refresh = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('re_bank_accounts')
        .select('id, bank_name, account_number, account_holder_name, account_type, currency, current_balance, is_active')
        .eq('company_id', companyId)
        .order('bank_name', { ascending: true })
        .order('account_holder_name', { ascending: true });
      if (error) throw error;
      setItems((data || []) as BankAccount[]);
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to load bank accounts', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [companyId]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!companyId) return;
    if (!draft.bank_name.trim() || !draft.account_number.trim() || !draft.account_holder_name.trim()) {
      setToast({ message: 'Bank name, account number, and account holder are required.', type: 'warning' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('re_bank_accounts').insert([{
        company_id: companyId,
        bank_name: draft.bank_name.trim(),
        account_number: draft.account_number.trim(),
        account_holder_name: draft.account_holder_name.trim(),
        account_type: draft.account_type,
        currency: 'KES',
        current_balance: Number(draft.current_balance || 0),
        is_active: true,
      }]);
      if (error) throw error;
      setDraft(EMPTY);
      await refresh();
      setToast({ message: 'Bank account saved.', type: 'success' });
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to save bank account', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const openPayoutReview = (account: BankAccount) => {
    setPayoutDraft({ account, amount: '', confirmation: '' });
  };

  const queuePayment = async () => {
    if (!companyId || !payoutDraft) return;
    const account = payoutDraft.account;
    const amount = Number(payoutDraft.amount || 0);
    if (!amount || amount <= 0) {
      setToast({ message: 'Enter a valid payout amount.', type: 'warning' });
      return;
    }
    const availableBalance = Number(account.current_balance || 0);
    if (amount > availableBalance) {
      setToast({ message: `Amount exceeds available balance (${availableBalance.toLocaleString()}).`, type: 'warning' });
      return;
    }
    const accountTail = account.account_number.slice(-4);
    if (payoutDraft.confirmation.trim() !== accountTail) {
      setToast({ message: `Type the last 4 digits of the account number (${accountTail}) to confirm.`, type: 'warning' });
      return;
    }
    setQueueingId(account.id);
    try {
      const { error } = await supabase.from('mpesa_payout_jobs').insert({
        company_id: companyId,
        payout_type: 'b2c',
        beneficiary_name: account.account_holder_name,
        beneficiary_phone: null,
        beneficiary_shortcode: account.account_number,
        amount,
        currency: 'KES',
        queue_source: 'manual',
        status: 'pending_approval',
        approval_status: 'pending_approval',
        idempotency_key: `bank:${account.id}:${Date.now()}`,
        request_payload: {
          source: 'split-management-bank-accounts',
          bank_account_id: account.id,
          bank_name: account.bank_name,
          account_number: account.account_number,
          account_holder_name: account.account_holder_name,
          amount,
          requires_approval: true,
        },
      });
      if (error) throw error;
      setPayoutDraft(null);
      setToast({ message: 'Payment submitted for approval.', type: 'success' });
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to queue payout', type: 'error' });
    } finally {
      setQueueingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-amber-50/30 p-6 dark:from-dark-bg dark:via-dark-bg dark:to-amber-950/20 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-dark-surface md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-600">Landlord banks</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900 dark:text-white md:text-5xl">Saved bank accounts</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
            Store real landlord bank accounts here, view them as a table, and queue a payout from the same place.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <form onSubmit={onSubmit} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-dark-surface md:p-8">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"><Plus size={22} /></div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Add bank account</p>
                <h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Register a landlord bank</h2>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <Field label="Bank name" value={draft.bank_name} onChange={(value) => setDraft((curr) => ({ ...curr, bank_name: value }))} placeholder="Equity Bank" />
              <Field label="Account number" value={draft.account_number} onChange={(value) => setDraft((curr) => ({ ...curr, account_number: value }))} placeholder="0123456789" />
              <Field label="Account holder name" value={draft.account_holder_name} onChange={(value) => setDraft((curr) => ({ ...curr, account_holder_name: value }))} placeholder="John Doe" />
              <label className="space-y-2 block">
                <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Account type</span>
                <select value={draft.account_type} onChange={(e) => setDraft((curr) => ({ ...curr, account_type: e.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white">
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="business">Business</option>
                </select>
              </label>
              <Field label="Starting balance" value={draft.current_balance} onChange={(value) => setDraft((curr) => ({ ...curr, current_balance: value }))} placeholder="0" />
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-60 dark:bg-white dark:text-slate-900">
                <Save size={16} /> {saving ? 'Saving...' : 'Save bank account'}
              </button>
            </div>
          </form>

          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-dark-surface md:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Table</p>
                <h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Saved accounts</h2>
              </div>
              <button onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                <RefreshCw size={16} /> Refresh
              </button>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
              {loading ? (
                <div className="px-6 py-10 text-sm text-slate-500">Loading bank accounts...</div>
              ) : items.length === 0 ? (
                <div className="px-6 py-10 text-sm text-slate-500">No bank accounts saved yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wider text-slate-400 dark:border-white/10">
                      <tr>
                        <th className="px-6 py-3">Bank</th>
                        <th className="px-6 py-3">Account</th>
                        <th className="px-6 py-3">Holder</th>
                        <th className="px-6 py-3">Balance</th>
                        <th className="px-6 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">{item.bank_name}</td>
                          <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{item.account_number}</td>
                          <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{item.account_holder_name}</td>
                          <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{item.currency || 'KES'} {Number(item.current_balance || 0).toLocaleString()}</td>
                          <td className="px-6 py-4">
                            <button
                              type="button"
                              onClick={() => openPayoutReview(item)}
                              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                            >
                              <Send size={14} /> Queue payout
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
      {payoutDraft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white p-6 shadow-2xl dark:bg-dark-surface md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-600">Review and confirm payout</p>
                <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Confirm before queueing</h2>
              </div>
              <button type="button" onClick={() => setPayoutDraft(null)} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Detail label="Recipient" value={payoutDraft.account.account_holder_name} />
              <Detail label="Bank" value={payoutDraft.account.bank_name} />
              <Detail label="Account number" value={payoutDraft.account.account_number} />
              <Detail label="Current balance" value={`${payoutDraft.account.currency || 'KES'} ${Number(payoutDraft.account.current_balance || 0).toLocaleString()}`} />
            </div>

            <label className="mt-6 block space-y-2">
              <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Amount to queue</span>
              <input
                type="number"
                value={payoutDraft.amount}
                onChange={(event) => setPayoutDraft((current) => current ? { ...current, amount: event.target.value } : current)}
                placeholder="1000"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </label>

            <label className="mt-4 block space-y-2">
              <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                Type last 4 digits of account number to confirm ({payoutDraft.account.account_number.slice(-4)})
              </span>
              <input
                value={payoutDraft.confirmation}
                onChange={(event) => setPayoutDraft((current) => current ? { ...current, confirmation: event.target.value } : current)}
                placeholder="1234"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </label>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              The payout will be queued as a manual job and picked up by the worker after confirmation.
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setPayoutDraft(null)} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void queuePayment()}
                disabled={queueingId === payoutDraft.account.id}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                <Send size={16} /> {queueingId === payoutDraft.account.id ? 'Submitting...' : 'Submit for approval'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {toast ? <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="space-y-2 block">
      <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
      />
    </label>
  );
}
