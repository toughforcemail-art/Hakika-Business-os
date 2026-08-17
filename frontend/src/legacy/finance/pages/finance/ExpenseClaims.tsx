// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Receipt, Wallet } from 'lucide-react';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { useAccess } from '../../hooks/useAccess';
import { resolveOrganizationScope } from '../../utils/organizationScope';
import { supabase } from '../../utils/supabase';

interface ExpenseClaim {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  expense_date: string;
  approval_status: string | null;
  created_at?: string | null;
}

interface ClaimFormState {
  category: string;
  amount: string;
  description: string;
  expenseDate: string;
}

const panelCls = 'rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#1e293b] dark:bg-[#0f172a]';
const inputCls = 'w-full rounded-2xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-[#334155] dark:bg-[#0b1220] dark:text-white';

const createClaimForm = (): ClaimFormState => ({
  category: 'Travel',
  amount: '',
  description: '',
  expenseDate: new Date().toISOString().slice(0, 10),
});

const ExpenseClaims: React.FC = () => {
  const { profile } = useAccess();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimForm, setClaimForm] = useState<ClaimFormState>(createClaimForm());

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const scope = await resolveOrganizationScope(profile);
      setOrganizationId(scope.organizationId);

      const { data, error } = await supabase
        .from('finance_expense_claims')
        .select('id, category, amount, description, expense_date, approval_status, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClaims((data || []) as ExpenseClaim[]);
    } catch (error: any) {
      console.error('Error fetching claims:', error);
      setToast({ message: error.message || 'Failed to load expense claims.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchClaims();
  }, [profile]);

  const totalClaims = claims.length;
  const totalAmount = useMemo(() => claims.reduce((sum, claim) => sum + Number(claim.amount || 0), 0), [claims]);
  const pendingClaims = useMemo(
    () => claims.filter((claim) => (claim.approval_status || 'Pending').toLowerCase() === 'pending').length,
    [claims],
  );

  const submitClaim = async () => {
    if (!claimForm.category.trim() || Number(claimForm.amount) <= 0 || !claimForm.expenseDate) {
      setToast({ message: 'Category, amount, and expense date are required.', type: 'warning' });
      return;
    }

    setSaving(true);

    try {
      const basePayload = {
        category: claimForm.category.trim(),
        amount: Number(claimForm.amount),
        description: claimForm.description.trim() || null,
        expense_date: claimForm.expenseDate,
        approval_status: 'Pending',
      };

      let result = await supabase.from('finance_expense_claims').insert(basePayload).select('*').single();

      if (result.error && `${result.error.message || ''} ${result.error.details || ''}`.toLowerCase().includes('organization_id') && organizationId) {
        result = await supabase
          .from('finance_expense_claims')
          .insert({ ...basePayload, organization_id: organizationId })
          .select('*')
          .single();
      }

      if (result.error) throw result.error;

      setClaims((current) => [result.data as ExpenseClaim, ...current]);
      setClaimForm(createClaimForm());
      setShowClaimForm(false);
      setToast({ message: 'Expense claim submitted.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to submit expense claim:', error);
      setToast({ message: error.message || 'Failed to submit expense claim.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><CustomLoader size={40} label="Loading expense desk..." /></div>;
  }

  return (
    <div className="min-h-full w-full space-y-8 bg-white p-6 text-gray-900 dark:bg-dark-bg dark:text-white lg:p-10">
      <div className="border-b border-gray-200 pb-8 dark:border-dark-border">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Wallet className="text-brand-purple" /> Expense Claims
            </h1>
            <p className="text-sm text-gray-500 dark:text-dark-text">
              Track reimbursements, approvals, and filing history from one claims workspace.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowClaimForm(true)}
              className="flex items-center gap-2 rounded-2xl bg-brand-purple px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-brand-purple/20 transition hover:bg-opacity-90"
            >
              <Plus size={16} /> File New Claim
            </button>
          </div>
        </div>

      </div>

      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className={panelCls}>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total claims</p>
            <p className="mt-2 text-3xl font-bold">{totalClaims}</p>
          </div>
          <div className={panelCls}>
            <p className="text-sm text-gray-500 dark:text-gray-400">Claim value</p>
            <p className="mt-2 text-3xl font-bold">KES {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
          <div className={panelCls}>
            <p className="text-sm text-gray-500 dark:text-gray-400">Pending approval</p>
            <p className="mt-2 text-3xl font-bold">{pendingClaims}</p>
          </div>
        </div>

        <div className={panelCls}>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight">Expense Registry</h2>
            <button type="button" onClick={() => setShowClaimForm(true)} className="text-sm font-semibold text-brand-purple">
              Add Claim
            </button>
          </div>

          <div className="space-y-4">
            {claims.map((claim) => (
              <div key={claim.id} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-white/5 dark:bg-white/5">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-purple/10 font-bold text-brand-purple">
                    {(claim.category || 'E')[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{claim.description || claim.category}</p>
                    <p className="text-[10px] text-gray-500">{claim.expense_date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black">KES {Number(claim.amount).toLocaleString()}</p>
                  <span className={`rounded px-2 py-0.5 text-[9px] font-black uppercase ${
                    claim.approval_status === 'Approved' ? 'bg-emerald-500/10 text-emerald-500' :
                    claim.approval_status === 'Rejected' ? 'bg-rose-500/10 text-rose-500' :
                    'bg-amber-500/10 text-amber-500'
                  }`}>
                    {claim.approval_status || 'Pending'}
                  </span>
                </div>
              </div>
            ))}

            {claims.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-20 text-xs font-bold uppercase tracking-widest text-gray-400 italic">
                <Receipt size={40} className="text-gray-200 dark:text-white/5" />
                No expense claims filed yet.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {showClaimForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-[#1e293b] dark:bg-[#0f172a]">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">File New Claim</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Capture a new expense claim without leaving the expense workspace.</p>
              </div>
              <button type="button" onClick={() => setShowClaimForm(false)} className="text-sm font-semibold text-gray-500 dark:text-gray-300">
                Close
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Category</label>
                <select value={claimForm.category} onChange={(event) => setClaimForm((current) => ({ ...current, category: event.target.value }))} className={inputCls}>
                  <option value="Travel">Travel</option>
                  <option value="Meals">Meals</option>
                  <option value="Supplies">Supplies</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Repairs">Repairs</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Amount</label>
                <input type="number" min="0" step="0.01" value={claimForm.amount} onChange={(event) => setClaimForm((current) => ({ ...current, amount: event.target.value }))} className={inputCls} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Description</label>
                <textarea rows={4} value={claimForm.description} onChange={(event) => setClaimForm((current) => ({ ...current, description: event.target.value }))} className={inputCls} placeholder="Describe the expense claim" />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Expense Date</label>
                <input type="date" value={claimForm.expenseDate} onChange={(event) => setClaimForm((current) => ({ ...current, expenseDate: event.target.value }))} className={inputCls} />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={submitClaim}
                disabled={saving}
                className="rounded-2xl bg-brand-purple px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Submit Claim
              </button>
              <button
                type="button"
                onClick={() => {
                  setClaimForm(createClaimForm());
                  setShowClaimForm(false);
                }}
                className="rounded-2xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-[#334155] dark:text-gray-200 dark:hover:bg-[#111827]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <CustomToast
          message={toast.message}
          type={toast.type}
          isVisible={true}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
};

export default ExpenseClaims;
