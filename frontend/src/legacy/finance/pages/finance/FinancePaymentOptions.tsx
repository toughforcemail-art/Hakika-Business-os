// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Edit3, Landmark, Plus, Search, Trash2, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { useAccess } from '../../hooks/useAccess';
import { resolveOrganizationScope } from '../../utils/organizationScope';
import { supabase } from '../../utils/supabase';
import financeDepositAccountsService, { FinanceDepositAccount } from '../../services/financeDepositAccountsService';

type PaymentReferenceOptionType = 'pay_from_account' | 'payment_method';

interface PaymentReferenceOption {
  id: string;
  organization_id: string;
  option_type: PaymentReferenceOptionType;
  option_value: string;
  created_at: string;
}

interface BankAccountOption {
  id: string;
  company_id: string;
  account_kind: string;
  bank_name?: string | null;
  account_number?: string | null;
  account_holder_name?: string | null;
  account_type?: string | null;
  account_name?: string | null;
  business_name?: string | null;
  phone_number?: string | null;
  wallet_name?: string | null;
  wallet_provider?: string | null;
  wallet_identifier?: string | null;
  current_balance: number | string | null;
  currency: string | null;
  is_active: boolean;
}

interface BankAccountFormState {
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  currentBalance: string;
  currency: string;
  isActive: boolean;
}

interface OptionFormState {
  optionType: PaymentReferenceOptionType;
  optionValue: string;
}

const panelCls =
  'rounded-[28px] border border-gray-200 bg-white/95 p-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur-sm dark:border-white/10 dark:bg-dark-surface/90';
const inputCls =
  'w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#ff6a00]/40 focus:bg-white focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-[#082131] dark:text-white dark:placeholder:text-slate-400 dark:focus:border-[#ff6a00]/40 dark:focus:bg-[#0b2a3c]';
const labelCls = 'text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400';
const primaryButtonCls =
  'inline-flex items-center justify-center gap-2 rounded-2xl bg-[#ff6a00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e85f00] disabled:cursor-not-allowed disabled:opacity-60';
const secondaryButtonCls =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:border-[#ff6a00]/40 dark:hover:bg-white/[0.06]';

const normalizeText = (value?: string | null) => value?.trim().toLowerCase() || '';
const toNumber = (value?: number | string | null) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const optionMeta: Record<PaymentReferenceOptionType, { label: string; description: string }> = {
  pay_from_account: {
    label: 'Pay From A/C',
    description: 'Shown in requisitions and payment vouchers as the source account.',
  },
  payment_method: {
    label: 'Payment Method',
    description: 'Shown in payment forms and voucher workflows as the method used.',
  },
};

const getOptionMeta = (optionType?: string | null) =>
  optionType === 'pay_from_account'
    ? optionMeta.pay_from_account
    : optionType === 'payment_method'
      ? optionMeta.payment_method
      : {
          label: 'Unknown',
          description: 'This option type is not supported by the current UI.',
        };

const createForm = (optionType: PaymentReferenceOptionType = 'pay_from_account'): OptionFormState => ({
  optionType,
  optionValue: '',
});

const createBankAccountForm = (): BankAccountFormState => ({
  bankName: '',
  accountNumber: '',
  accountHolderName: '',
  currentBalance: '0',
  currency: 'KES',
  isActive: true,
});

const FinancePaymentOptions: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAccess();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [options, setOptions] = useState<PaymentReferenceOption[]>([]);
  const [selectedType, setSelectedType] = useState<PaymentReferenceOptionType | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingBankAccountId, setEditingBankAccountId] = useState<string | null>(null);
  const [form, setForm] = useState<OptionFormState>(createForm());
  const [bankForm, setBankForm] = useState<BankAccountFormState>(createBankAccountForm());
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const scope = await resolveOrganizationScope(profile);
      setOrganizationId(scope.organizationId);

      if (!scope.organizationId) {
        setBankAccounts([]);
        setOptions([]);
        return;
      }

      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('id')
        .eq('organization_id', scope.organizationId)
        .order('id', { ascending: true });

      if (companyError) throw companyError;

      const companyIds = ((companyData || []) as { id: string }[]).map((company) => company.id);
      const lookupCompanyIds = companyIds.length > 0
        ? companyIds
        : profile?.company_id
          ? [profile.company_id]
          : [];

      const serviceAccounts = lookupCompanyIds.length > 0
        ? await financeDepositAccountsService.listAccounts(lookupCompanyIds)
        : [];

      const fallbackAccounts = lookupCompanyIds.length > 0
        ? (await supabase
            .from('re_bank_accounts')
            .select('id, company_id, bank_name, account_number, account_holder_name, account_type, currency, current_balance, is_active')
            .in('company_id', lookupCompanyIds)
            .eq('is_active', true)
            .order('bank_name', { ascending: true })
            .order('account_number', { ascending: true })).data || []
        : [];

      const mergedAccounts = [...serviceAccounts, ...(fallbackAccounts as FinanceDepositAccount[])];
      const nextBankAccounts = mergedAccounts.filter(
        (account, index, array) => array.findIndex((entry) => entry.id === account.id) === index,
      );

      const { data, error } = await supabase
        .from('finance_payment_reference_options')
        .select('id, organization_id, option_type, option_value, created_at')
        .eq('organization_id', scope.organizationId)
        .order('option_type', { ascending: true })
        .order('option_value', { ascending: true });

      if (error) throw error;

      setBankAccounts(nextBankAccounts as BankAccountOption[]);

      setOptions(
        ((data || []) as PaymentReferenceOption[]).filter(
          (option) => option.option_type === 'pay_from_account' || option.option_type === 'payment_method',
        ),
      );
    } catch (error: any) {
      console.error('Failed to load payment options:', error);
      setToast({ message: error.message || 'Failed to load payment options.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      void loadData();
    }
  }, [profile]);

  const filteredOptions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return options.filter((option) => {
      if (option.option_type !== 'pay_from_account' && option.option_type !== 'payment_method') {
        return false;
      }
      const matchesType = selectedType === 'all' ? true : option.option_type === selectedType;
      const matchesSearch = normalizedSearch
        ? option.option_value.toLowerCase().includes(normalizedSearch)
        : true;
      return matchesType && matchesSearch;
    });
  }, [options, searchTerm, selectedType]);

  const totals = useMemo(() => {
    return {
      bankAccounts: bankAccounts.length,
      payFromAccount: options.filter((option) => option.option_type === 'pay_from_account').length,
      paymentMethod: options.filter((option) => option.option_type === 'payment_method').length,
    };
  }, [bankAccounts, options]);

  const resetForm = (optionType: PaymentReferenceOptionType = 'pay_from_account') => {
    setForm(createForm(optionType));
    setEditingOptionId(null);
  };

  const resetBankForm = () => {
    setBankForm(createBankAccountForm());
    setEditingBankAccountId(null);
  };

  const handleEdit = (option: PaymentReferenceOption) => {
    setEditingOptionId(option.id);
    setForm({
      optionType: option.option_type,
      optionValue: option.option_value,
    });
  };

  const handleEditBankAccount = (account: BankAccountOption) => {
    setEditingBankAccountId(account.id);
    setBankForm({
      bankName: account.bank_name || '',
      accountNumber: account.account_number || '',
      accountHolderName: account.account_holder_name || '',
      currentBalance: `${Number(account.current_balance ?? 0)}`,
      currency: account.currency || 'KES',
      isActive: Boolean(account.is_active),
    });
  };

  const saveOption = async () => {
    if (!organizationId) {
      setToast({ message: 'An organization is required before adding payment options.', type: 'warning' });
      return;
    }

    const optionValue = form.optionValue.trim();
    if (!optionValue) {
      setToast({ message: 'Enter a value before saving.', type: 'warning' });
      return;
    }

    setSaving(true);
    try {
      if (editingOptionId) {
        const { error } = await supabase
          .from('finance_payment_reference_options')
          .update({
            option_type: form.optionType,
            option_value: optionValue,
          })
          .eq('id', editingOptionId);
        if (error) throw error;
        setToast({ message: 'Payment option updated successfully.', type: 'success' });
      } else {
        const { error } = await supabase.from('finance_payment_reference_options').insert({
          organization_id: organizationId,
          option_type: form.optionType,
          option_value: optionValue,
          created_by: profile?.id || null,
        });
        if (error) throw error;
        setToast({ message: 'Payment option added successfully.', type: 'success' });
      }

      setEditingOptionId(null);
      setForm(createForm(form.optionType));
      await loadData();
    } catch (error: any) {
      console.error('Failed to save payment option:', error);
      setToast({ message: error.message || 'Failed to save payment option.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const saveBankAccount = async () => {
    if (!organizationId || !editingBankAccountId) {
      setToast({ message: 'Select a bank account to edit first.', type: 'warning' });
      return;
    }

    if (!bankForm.bankName.trim() || !bankForm.accountNumber.trim() || !bankForm.accountHolderName.trim()) {
      setToast({ message: 'Bank name, account number, and account holder are required.', type: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('re_bank_accounts')
        .update({
          bank_name: bankForm.bankName.trim(),
          account_number: bankForm.accountNumber.trim(),
          account_holder_name: bankForm.accountHolderName.trim(),
          current_balance: Number(bankForm.currentBalance || 0),
          currency: bankForm.currency.trim() || 'KES',
          is_active: bankForm.isActive,
        })
        .eq('id', editingBankAccountId);

      if (error) throw error;

      await loadData();
      setToast({ message: 'Bank account updated successfully.', type: 'success' });
      resetBankForm();
    } catch (error: any) {
      console.error('Failed to update bank account:', error);
      setToast({ message: error.message || 'Failed to update bank account.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const deleteBankAccount = async (account: BankAccountOption) => {
    const confirmed = window.confirm(`Delete ${account.bank_name} - ${account.account_number}?`);
    if (!confirmed) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('re_bank_accounts').delete().eq('id', account.id);
      if (error) throw error;
      await loadData();
      if (editingBankAccountId === account.id) resetBankForm();
      setToast({ message: 'Bank account deleted successfully.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to delete bank account:', error);
      setToast({ message: error.message || 'Failed to delete bank account.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const deleteOption = async (option: PaymentReferenceOption) => {
    const confirmed = window.confirm(`Delete "${option.option_value}"?`);
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('finance_payment_reference_options').delete().eq('id', option.id);
      if (error) throw error;

      if (editingOptionId === option.id) {
        resetForm(option.option_type);
      }

      setOptions((current) => current.filter((entry) => entry.id !== option.id));
      setToast({ message: 'Payment option deleted.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to delete payment option:', error);
      setToast({ message: error.message || 'Failed to delete payment option.', type: 'error' });
    }
  };

  if (loading) {
    return <CustomLoader text="Loading payment options..." />;
  }

  return (
    <div className="min-h-screen space-y-6 bg-[#f6f7fb] p-6 dark:bg-[#061723]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/app/finance/dashboard')}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
            title="Back to Finance Dashboard"
            aria-label="Back to Finance Dashboard"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <CreditCard className="text-[#ff6a00]" aria-hidden="true" /> Payment Options
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Manage the finance dropdown values used in requisitions and payments.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => resetForm()}
          className={secondaryButtonCls}
        >
          <Plus size={16} />
          New Option
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className={panelCls}>
          <p className={labelCls}>Bank Accounts</p>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{totals.bankAccounts}</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Active source accounts available for requisitions and payments.</p>
        </div>
        <div className={panelCls}>
          <p className={labelCls}>Pay From A/C</p>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{totals.payFromAccount}</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{optionMeta.pay_from_account.description}</p>
        </div>
        <div className={panelCls}>
          <p className={labelCls}>Payment Methods</p>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{totals.paymentMethod}</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{optionMeta.payment_method.description}</p>
        </div>
        <div className={panelCls}>
          <p className={labelCls}>Search</p>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className={`${inputCls} pl-11`}
              placeholder="Search payment options"
            />
          </div>
        </div>
      </div>

      <div className={panelCls}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Active Bank Accounts</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              These are the same accounts shown in payments and requisitions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/app/finance/bank-accounts')}
            className={secondaryButtonCls}
          >
            <Landmark size={16} />
            Open Bank Accounts
          </button>
        </div>
        {editingBankAccountId ? (
          <div className="mb-5 rounded-[24px] border border-[#ff6a00]/20 bg-[#fff8f3] p-4 dark:border-[#ff6a00]/20 dark:bg-[#ff6a00]/8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Edit Bank Account</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Update the bank details used across finance screens.</p>
              </div>
              <button type="button" onClick={resetBankForm} className={secondaryButtonCls}>
                Cancel Edit
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>Bank Name</label>
                <input
                  value={bankForm.bankName}
                  onChange={(event) => setBankForm((current) => ({ ...current, bankName: event.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Account Number</label>
                <input
                  value={bankForm.accountNumber}
                  onChange={(event) => setBankForm((current) => ({ ...current, accountNumber: event.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Account Holder</label>
                <input
                  value={bankForm.accountHolderName}
                  onChange={(event) => setBankForm((current) => ({ ...current, accountHolderName: event.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Currency</label>
                <input
                  value={bankForm.currency}
                  onChange={(event) => setBankForm((current) => ({ ...current, currency: event.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Current Balance</label>
                <input
                  type="number"
                  step="0.01"
                  value={bankForm.currentBalance}
                  onChange={(event) => setBankForm((current) => ({ ...current, currentBalance: event.target.value }))}
                  className={inputCls}
                />
              </div>
              <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={bankForm.isActive}
                  onChange={(event) => setBankForm((current) => ({ ...current, isActive: event.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-[#ff6a00] focus:ring-[#ff6a00]/30"
                />
                Active
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={saveBankAccount} disabled={saving} className={primaryButtonCls}>
                <Edit3 size={16} />
                Save Bank Account
              </button>
            </div>
          </div>
        ) : null}
        <div className="space-y-3">
          {bankAccounts.length > 0 ? bankAccounts.map((account) => (
            <div
              key={account.id}
              className="flex flex-col gap-3 rounded-3xl border border-gray-200 bg-white px-4 py-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03] lg:flex-row lg:items-center lg:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    Bank Account
                  </span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    {financeDepositAccountsService.formatAccountLabel(account as FinanceDepositAccount)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Balance: {String(account.currency || 'KES')} {Number(account.current_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleEditBankAccount(account)}
                className={secondaryButtonCls}
              >
                <Edit3 size={16} />
                Edit
              </button>
              <button
                type="button"
                onClick={() => void deleteBankAccount(account)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          )) : (
            <div className="rounded-3xl border border-dashed border-gray-200 px-6 py-14 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
              No active bank accounts found.
            </div>
          )}
        </div>
      </div>

      <div className={panelCls}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className={labelCls}>Option Type</label>
            <select
              value={form.optionType}
              onChange={(event) => setForm((current) => ({ ...current, optionType: event.target.value as PaymentReferenceOptionType }))}
              className={inputCls}
            >
              <option value="pay_from_account">{optionMeta.pay_from_account.label}</option>
              <option value="payment_method">{optionMeta.payment_method.label}</option>
            </select>
          </div>
          <div className="flex-[2]">
            <label className={labelCls}>Option Value</label>
            <input
              value={form.optionValue}
              onChange={(event) => setForm((current) => ({ ...current, optionValue: event.target.value }))}
              className={inputCls}
              placeholder={form.optionType === 'pay_from_account' ? 'KCB Main Account, Cash Office...' : 'Cheque, Cash, M-Pesa...'}
            />
          </div>
          <button type="button" onClick={saveOption} disabled={saving} className={primaryButtonCls}>
            {editingOptionId ? <Edit3 size={16} /> : <Plus size={16} />}
            {editingOptionId ? 'Update Option' : 'Save Option'}
          </button>
          {editingOptionId ? (
            <button
              type="button"
              onClick={() => resetForm(form.optionType)}
              className={secondaryButtonCls}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      <div className={panelCls}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedType('all')}
            className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition ${
              selectedType === 'all'
                ? 'bg-[#ff6a00] text-white'
                : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('pay_from_account')}
            className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition ${
              selectedType === 'pay_from_account'
                ? 'bg-[#ff6a00] text-white'
                : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300'
            }`}
          >
            Pay From A/C
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('payment_method')}
            className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition ${
              selectedType === 'payment_method'
                ? 'bg-[#ff6a00] text-white'
                : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300'
            }`}
          >
            Payment Method
          </button>
        </div>

        <div className="space-y-3">
          {filteredOptions.map((option) => (
            <div
              key={option.id}
              className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white px-4 py-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03] lg:flex-row lg:items-center lg:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#ff6a00]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#ff6a00] dark:bg-[#ff6a00]/15 dark:text-[#ffb37a]">
                    {getOptionMeta(option.option_type).label}
                  </span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{option.option_value}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{getOptionMeta(option.option_type).description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleEdit(option)}
                  className={secondaryButtonCls}
                >
                  <Edit3 size={16} />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteOption(option)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          ))}

          {filteredOptions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-200 px-6 py-14 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
              No payment options found.
            </div>
          ) : null}
        </div>
      </div>

      {toast ? <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </div>
  );
};

export default FinancePaymentOptions;
