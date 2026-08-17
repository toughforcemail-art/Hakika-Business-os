// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Building2, CreditCard, Edit3, Landmark, Plus, RefreshCcw, Search, Trash2, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { useAccess } from '../../hooks/useAccess';
import { resolveOrganizationScope } from '../../utils/organizationScope';
import { supabase } from '../../utils/supabase';

type WalletKind = 'cash' | 'mpesa' | 'wallet';

interface CompanyOption {
  id: string;
  name: string;
  code: string | null;
}

interface CashWalletRecord {
  id: string;
  company_id: string;
  account_name: string;
  current_balance: number | string | null;
  is_active: boolean;
  created_at?: string;
}

interface MpesaWalletRecord {
  id: string;
  company_id: string;
  business_name: string;
  phone_number: string;
  current_balance: number | string | null;
  is_active: boolean;
  created_at?: string;
}

interface CashWalletForm {
  accountName: string;
  currentBalance: string;
  isActive: boolean;
}

interface MpesaWalletForm {
  businessName: string;
  phoneNumber: string;
  currentBalance: string;
  isActive: boolean;
}

interface GenericWalletRecord {
  id: string;
  company_id: string;
  wallet_name: string;
  wallet_provider: string | null;
  wallet_identifier: string | null;
  current_balance: number | string | null;
  currency: string | null;
  is_active: boolean;
  created_at?: string;
}

interface GenericWalletForm {
  walletName: string;
  walletProvider: string;
  walletIdentifier: string;
  currency: string;
  currentBalance: string;
  isActive: boolean;
}

type WalletBalanceMode = 'set' | 'increase' | 'decrease';

interface WalletBalanceAdjustForm {
  kind: WalletKind;
  accountId: string;
  mode: WalletBalanceMode;
  amount: string;
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
const formatMoney = (value: number, currency = 'KES') =>
  `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const createCashForm = (): CashWalletForm => ({
  accountName: '',
  currentBalance: '0',
  isActive: true,
});

const createMpesaForm = (): MpesaWalletForm => ({
  businessName: '',
  phoneNumber: '',
  currentBalance: '0',
  isActive: true,
});

const createGenericWalletForm = (): GenericWalletForm => ({
  walletName: '',
  walletProvider: '',
  walletIdentifier: '',
  currency: 'KES',
  currentBalance: '0',
  isActive: true,
});

const FinanceWallets: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAccess();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [cashWallets, setCashWallets] = useState<CashWalletRecord[]>([]);
  const [mpesaWallets, setMpesaWallets] = useState<MpesaWalletRecord[]>([]);
  const [genericWallets, setGenericWallets] = useState<GenericWalletRecord[]>([]);
  const [cashSearch, setCashSearch] = useState('');
  const [mpesaSearch, setMpesaSearch] = useState('');
  const [genericSearch, setGenericSearch] = useState('');
  const [editingCashId, setEditingCashId] = useState<string | null>(null);
  const [editingMpesaId, setEditingMpesaId] = useState<string | null>(null);
  const [cashForm, setCashForm] = useState<CashWalletForm>(createCashForm());
  const [mpesaForm, setMpesaForm] = useState<MpesaWalletForm>(createMpesaForm());
  const [genericForm, setGenericForm] = useState<GenericWalletForm>(createGenericWalletForm());
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const cashFormRef = useRef<HTMLDivElement | null>(null);
  const mpesaFormRef = useRef<HTMLDivElement | null>(null);
  const [activeFormSection, setActiveFormSection] = useState<'cash' | 'mpesa' | null>(null);
  const [showAddWalletChooser, setShowAddWalletChooser] = useState(false);
  const [showBalanceAdjust, setShowBalanceAdjust] = useState(false);
  const [balanceAdjustForm, setBalanceAdjustForm] = useState<WalletBalanceAdjustForm>({
    kind: 'cash',
    accountId: '',
    mode: 'set',
    amount: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const scope = await resolveOrganizationScope(profile);
      setOrganizationId(scope.organizationId);

      if (!scope.organizationId) {
        setCompanies([]);
        setCashWallets([]);
        setMpesaWallets([]);
        setGenericWallets([]);
        return;
      }

      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('id, name, code')
        .eq('organization_id', scope.organizationId)
        .order('name', { ascending: true });

      if (companyError) throw companyError;

      const nextCompanies = (companyData || []) as CompanyOption[];
      const companyIds = nextCompanies.map((company) => company.id);

      const [cashResponse, mpesaResponse, genericResponse] = await Promise.all([
        companyIds.length > 0
          ? supabase
            .from('re_cash_accounts')
            .select('id, company_id, account_name, current_balance, is_active, created_at')
            .in('company_id', companyIds)
            .order('account_name', { ascending: true })
          : Promise.resolve({ data: [], error: null } as any),
        companyIds.length > 0
          ? supabase
            .from('re_mpesa_accounts')
            .select('id, company_id, business_name, phone_number, current_balance, is_active, created_at')
            .in('company_id', companyIds)
            .order('business_name', { ascending: true })
            .order('phone_number', { ascending: true })
          : Promise.resolve({ data: [], error: null } as any),
        companyIds.length > 0
          ? supabase
            .from('re_wallet_accounts')
            .select('id, company_id, wallet_name, wallet_provider, wallet_identifier, current_balance, currency, is_active, created_at')
            .in('company_id', companyIds)
            .order('wallet_name', { ascending: true })
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (cashResponse.error) throw cashResponse.error;
      if (mpesaResponse.error) throw mpesaResponse.error;
      if (genericResponse.error) throw genericResponse.error;

      setCompanies(nextCompanies);
      setSelectedCompanyId((current) => current && companyIds.includes(current) ? current : nextCompanies[0]?.id || '');
      setCashWallets(((cashResponse.data || []) as CashWalletRecord[]).map((account) => ({
        ...account,
        current_balance: toNumber(account.current_balance),
        is_active: account.is_active !== false,
      })));
      setMpesaWallets(((mpesaResponse.data || []) as MpesaWalletRecord[]).map((account) => ({
        ...account,
        current_balance: toNumber(account.current_balance),
        is_active: account.is_active !== false,
      })));
      setGenericWallets(((genericResponse.data || []) as GenericWalletRecord[]).map((account) => ({
        ...account,
        current_balance: toNumber(account.current_balance),
        is_active: account.is_active !== false,
        currency: account.currency || 'KES',
      })));
    } catch (error: any) {
      console.error('Failed to load finance wallets:', error);
      setToast({ message: error.message || 'Failed to load wallet accounts.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      void loadData();
    }
  }, [profile]);

  const companyLabel = useMemo(() => {
    if (!organizationId) return 'No organization detected';
    if (companies.length === 0) return 'No companies found';
    return `${companies.length} company${companies.length === 1 ? '' : 's'}`;
  }, [companies.length, organizationId]);

  const cashFiltered = useMemo(() => {
    const normalizedSearch = cashSearch.trim().toLowerCase();
    return cashWallets.filter((wallet) => {
      if (!normalizedSearch) return true;
      return [wallet.account_name, wallet.company_id].join(' ').toLowerCase().includes(normalizedSearch);
    });
  }, [cashSearch, cashWallets]);

  const mpesaFiltered = useMemo(() => {
    const normalizedSearch = mpesaSearch.trim().toLowerCase();
    return mpesaWallets.filter((wallet) => {
      if (!normalizedSearch) return true;
      return [wallet.business_name, wallet.phone_number, wallet.company_id].join(' ').toLowerCase().includes(normalizedSearch);
    });
  }, [mpesaSearch, mpesaWallets]);

  const genericFiltered = useMemo(() => {
    const normalizedSearch = genericSearch.trim().toLowerCase();
    return genericWallets.filter((wallet) => {
      if (!normalizedSearch) return true;
      return [
        wallet.wallet_name,
        wallet.wallet_provider,
        wallet.wallet_identifier,
        wallet.currency,
        wallet.company_id,
      ].join(' ').toLowerCase().includes(normalizedSearch);
    });
  }, [genericSearch, genericWallets]);

  const resetCashForm = () => {
    setCashForm(createCashForm());
    setEditingCashId(null);
  };

  const resetMpesaForm = () => {
    setMpesaForm(createMpesaForm());
    setEditingMpesaId(null);
  };

  const resetGenericForm = () => {
    setGenericForm(createGenericWalletForm());
  };

  const openBalanceAdjust = (kind: WalletKind, accountId: string, currentBalance: number | string | null) => {
    setBalanceAdjustForm({
      kind,
      accountId,
      mode: 'set',
      amount: `${toNumber(currentBalance)}`,
    });
    setShowBalanceAdjust(true);
  };

  const saveBalanceAdjust = async () => {
    const amount = toNumber(balanceAdjustForm.amount);
    if (!balanceAdjustForm.accountId || !Number.isFinite(amount)) {
      setToast({ message: 'Select a wallet and enter a valid amount.', type: 'warning' });
      return;
    }

    setSaving(true);
    try {
      if (balanceAdjustForm.kind === 'cash') {
        const wallet = cashWallets.find((item) => item.id === balanceAdjustForm.accountId);
        if (!wallet) throw new Error('Selected cash wallet is no longer available.');
        const newBalance =
          balanceAdjustForm.mode === 'set'
            ? amount
            : balanceAdjustForm.mode === 'increase'
              ? toNumber(wallet.current_balance) + amount
              : toNumber(wallet.current_balance) - amount;
        const { error } = await supabase.from('re_cash_accounts').update({ current_balance: newBalance }).eq('id', wallet.id);
        if (error) throw error;
      } else if (balanceAdjustForm.kind === 'mpesa') {
        const wallet = mpesaWallets.find((item) => item.id === balanceAdjustForm.accountId);
        if (!wallet) throw new Error('Selected M-Pesa wallet is no longer available.');
        const newBalance =
          balanceAdjustForm.mode === 'set'
            ? amount
            : balanceAdjustForm.mode === 'increase'
              ? toNumber(wallet.current_balance) + amount
              : toNumber(wallet.current_balance) - amount;
        const { error } = await supabase.from('re_mpesa_accounts').update({ current_balance: newBalance }).eq('id', wallet.id);
        if (error) throw error;
      } else {
        const wallet = genericWallets.find((item) => item.id === balanceAdjustForm.accountId);
        if (!wallet) throw new Error('Selected Airtel Money wallet is no longer available.');
        const newBalance =
          balanceAdjustForm.mode === 'set'
            ? amount
            : balanceAdjustForm.mode === 'increase'
              ? toNumber(wallet.current_balance) + amount
              : toNumber(wallet.current_balance) - amount;
        const { error } = await supabase.from('re_wallet_accounts').update({ current_balance: newBalance }).eq('id', wallet.id);
        if (error) throw error;
      }

      setShowBalanceAdjust(false);
      setBalanceAdjustForm({ kind: 'cash', accountId: '', mode: 'set', amount: '' });
      await loadData();
      setToast({ message: 'Wallet balance updated.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to update wallet balance:', error);
      setToast({ message: error.message || 'Failed to update wallet balance.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const focusCashForm = () => {
    setShowAddWalletChooser(false);
    resetCashForm();
    setActiveFormSection('cash');
    cashFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => setActiveFormSection((current) => (current === 'cash' ? null : current)), 1800);
  };

  const focusMpesaForm = () => {
    setShowAddWalletChooser(false);
    resetMpesaForm();
    setActiveFormSection('mpesa');
    mpesaFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => setActiveFormSection((current) => (current === 'mpesa' ? null : current)), 1800);
  };

  const saveGenericWallet = async () => {
    if (!organizationId) {
      setToast({ message: 'Select an organization before adding wallets.', type: 'warning' });
      return;
    }
    if (!genericForm.walletName.trim()) {
      setToast({ message: 'Wallet name is required.', type: 'warning' });
      return;
    }

    const companyId = selectedCompanyId || companies[0]?.id || null;
    if (!companyId) {
      setToast({ message: 'Create or link a company before adding wallets.', type: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('re_wallet_accounts').insert({
        company_id: companyId,
        wallet_name: genericForm.walletName.trim(),
        wallet_provider: genericForm.walletProvider.trim() || null,
        wallet_identifier: genericForm.walletIdentifier.trim() || null,
        current_balance: toNumber(genericForm.currentBalance),
        currency: genericForm.currency.trim() || 'KES',
        is_active: genericForm.isActive,
      });
      if (error) throw error;
      setToast({ message: 'Wallet added successfully.', type: 'success' });
      await loadData();
      resetGenericForm();
    } catch (error: any) {
      console.error('Failed to save generic wallet:', error);
      setToast({ message: error.message || 'Failed to save wallet.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const saveCashWallet = async () => {
    if (!organizationId) {
      setToast({ message: 'Select an organization before adding wallets.', type: 'warning' });
      return;
    }

    if (!cashForm.accountName.trim()) {
      setToast({ message: 'Cash wallet name is required.', type: 'warning' });
      return;
    }

    const companyId = selectedCompanyId || companies[0]?.id || null;
    if (!companyId) {
      setToast({ message: 'Create or link a company before adding cash wallets.', type: 'warning' });
      return;
    }

    setSaving(true);
    try {
      if (editingCashId) {
        const { error } = await supabase
          .from('re_cash_accounts')
          .update({
            account_name: cashForm.accountName.trim(),
            current_balance: toNumber(cashForm.currentBalance),
            is_active: cashForm.isActive,
          })
          .eq('id', editingCashId);
        if (error) throw error;
        setToast({ message: 'Cash wallet updated successfully.', type: 'success' });
      } else {
        const { error } = await supabase.from('re_cash_accounts').insert({
          company_id: companyId,
          account_name: cashForm.accountName.trim(),
          current_balance: toNumber(cashForm.currentBalance),
          is_active: cashForm.isActive,
        });
        if (error) throw error;
        setToast({ message: 'Cash wallet added successfully.', type: 'success' });
      }

      await loadData();
      resetCashForm();
    } catch (error: any) {
      console.error('Failed to save cash wallet:', error);
      setToast({ message: error.message || 'Failed to save cash wallet.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const saveMpesaWallet = async () => {
    if (!organizationId) {
      setToast({ message: 'Select an organization before adding wallets.', type: 'warning' });
      return;
    }

    if (!mpesaForm.businessName.trim() || !mpesaForm.phoneNumber.trim()) {
      setToast({ message: 'Business name and phone number are required.', type: 'warning' });
      return;
    }

    const companyId = selectedCompanyId || companies[0]?.id || null;
    if (!companyId) {
      setToast({ message: 'Create or link a company before adding Mpesa wallets.', type: 'warning' });
      return;
    }

    setSaving(true);
    try {
      if (editingMpesaId) {
        const { error } = await supabase
          .from('re_mpesa_accounts')
          .update({
            business_name: mpesaForm.businessName.trim(),
            phone_number: mpesaForm.phoneNumber.trim(),
            current_balance: toNumber(mpesaForm.currentBalance),
            is_active: mpesaForm.isActive,
          })
          .eq('id', editingMpesaId);
        if (error) throw error;
        setToast({ message: 'Mpesa wallet updated successfully.', type: 'success' });
      } else {
        const { error } = await supabase.from('re_mpesa_accounts').insert({
          company_id: companyId,
          business_name: mpesaForm.businessName.trim(),
          phone_number: mpesaForm.phoneNumber.trim(),
          current_balance: toNumber(mpesaForm.currentBalance),
          is_active: mpesaForm.isActive,
        });
        if (error) throw error;
        setToast({ message: 'Mpesa wallet added successfully.', type: 'success' });
      }

      await loadData();
      resetMpesaForm();
    } catch (error: any) {
      console.error('Failed to save Mpesa wallet:', error);
      setToast({ message: error.message || 'Failed to save Mpesa wallet.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const deleteCashWallet = async (wallet: CashWalletRecord) => {
    if (!window.confirm(`Delete cash wallet "${wallet.account_name}"?`)) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('re_cash_accounts').delete().eq('id', wallet.id);
      if (error) throw error;
      setToast({ message: 'Cash wallet deleted.', type: 'success' });
      if (editingCashId === wallet.id) resetCashForm();
      await loadData();
    } catch (error: any) {
      console.error('Failed to delete cash wallet:', error);
      setToast({ message: error.message || 'Failed to delete cash wallet.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const deleteMpesaWallet = async (wallet: MpesaWalletRecord) => {
    if (!window.confirm(`Delete Mpesa wallet "${wallet.business_name}"?`)) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('re_mpesa_accounts').delete().eq('id', wallet.id);
      if (error) throw error;
      setToast({ message: 'Mpesa wallet deleted.', type: 'success' });
      if (editingMpesaId === wallet.id) resetMpesaForm();
      await loadData();
    } catch (error: any) {
      console.error('Failed to delete Mpesa wallet:', error);
      setToast({ message: error.message || 'Failed to delete Mpesa wallet.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <CustomLoader text="Loading wallets..." />;
  }

  return (
    <div className="min-h-screen space-y-6 bg-[#0b2f43] p-6 text-white">
      {toast ? <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={() => navigate('/app/finance/dashboard')}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00]"
            title="Back to Finance Dashboard"
            aria-label="Back to Finance Dashboard"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#ffb37a]">Consolidated Accounts</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Wallet Accounts</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              Manage cash tills and M-Pesa wallets used in receipting, requisitions, and payment workflows.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={loadData} className={secondaryButtonCls}>
            <RefreshCcw size={16} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowAddWalletChooser(true)}
            className={primaryButtonCls}
          >
            <Plus size={16} />
            Add Wallet Account
          </button>
          <button type="button" onClick={() => navigate('/app/finance/bank-accounts')} className={secondaryButtonCls}>
            <Landmark size={16} />
            Open Bank Accounts
          </button>
        </div>
      </div>

      {showAddWalletChooser ? (
        <div className={panelCls}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">New Wallet</p>
              <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-white">Choose the wallet type to create</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Cash wallets and M-Pesa wallets are created separately so they can be used correctly in receipts and reconciliations.
              </p>
            </div>
            <button type="button" onClick={() => setShowAddWalletChooser(false)} className={secondaryButtonCls}>
              Close
            </button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={focusCashForm}
              className="rounded-3xl border border-[#ff6a00]/20 bg-[#ff6a00]/10 p-5 text-left transition hover:border-[#ff6a00]/40 hover:bg-[#ff6a00]/15"
            >
              <p className="text-sm font-black uppercase tracking-[0.22em] text-[#ffb37a]">Cash Wallet</p>
              <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">Add a till or petty cash account</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Use this for physical cash balances and receipt posting.</p>
            </button>
            <button
              type="button"
              onClick={focusMpesaForm}
              className="rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-5 text-left transition hover:border-cyan-300/40 hover:bg-cyan-300/15"
            >
              <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">M-Pesa Wallet</p>
              <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">Add a mobile money float</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Use this for wallet balances, receipts, and reconciliation.</p>
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className={panelCls}>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Companies</p>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{companyLabel}</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Wallets are scoped to the selected finance organization.</p>
        </div>
        <div className={panelCls}>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Petty Cash Wallets</p>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{cashWallets.length}</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Petty cash and till balances available for posting receipts.</p>
        </div>
        <div className={panelCls}>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Mpesa Wallets</p>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{mpesaWallets.length}</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Mobile money floats shown in receipting and account pickers.</p>
        </div>
      </div>

      <div className={panelCls}>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Wallet Scope</p>
            <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-white">Choose the company to attach new wallets to</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Existing wallets from all companies remain visible below, but new wallets will be created in the selected company.
            </p>
          </div>
          <div className="min-w-[280px]">
            <label className={labelCls}>Company</label>
            <select
              value={selectedCompanyId}
              onChange={(event) => setSelectedCompanyId(event.target.value)}
              className={inputCls}
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.code ? `${company.name} (${company.code})` : company.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {showBalanceAdjust ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-[32px] border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#071b27]">
            <div className="border-b border-gray-200 bg-gradient-to-r from-[#fff3eb] via-white to-[#fff9f4] px-6 py-5 dark:border-white/10 dark:from-[#0b2a3c] dark:via-[#082131] dark:to-[#071b27]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00]">Manual Balance</p>
                  <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">Update Wallet Balance</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Set a new balance or adjust the current wallet amount.
                  </p>
                </div>
                <button type="button" onClick={() => setShowBalanceAdjust(false)} className={secondaryButtonCls}>
                  Close
                </button>
              </div>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelCls}>Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={balanceAdjustForm.amount}
                  onChange={(event) => setBalanceAdjustForm((current) => ({ ...current, amount: event.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Action</label>
                <select
                  value={balanceAdjustForm.mode}
                  onChange={(event) => setBalanceAdjustForm((current) => ({ ...current, mode: event.target.value as WalletBalanceMode }))}
                  className={inputCls}
                >
                  <option value="set">Set Balance</option>
                  <option value="increase">Increase</option>
                  <option value="decrease">Decrease</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Wallet Type</label>
                <select
                  value={balanceAdjustForm.kind}
                  onChange={(event) => setBalanceAdjustForm((current) => ({ ...current, kind: event.target.value as WalletKind }))}
                  className={inputCls}
                >
                  <option value="cash">Petty Cash</option>
                  <option value="mpesa">M-Pesa</option>
                  <option value="wallet">Airtel Money</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 px-6 pb-6">
              <button type="button" onClick={saveBalanceAdjust} className={primaryButtonCls} disabled={saving}>
                Save Balance
              </button>
              <button
                type="button"
                onClick={() => setBalanceAdjustForm({ kind: 'cash', accountId: '', mode: 'set', amount: '' })}
                className={secondaryButtonCls}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className={panelCls}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Cash Wallets</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Create or update cash accounts used when receipting cash payments.</p>
            </div>
          <button
            type="button"
            onClick={focusCashForm}
            className={secondaryButtonCls}
          >
              <Plus size={16} />
              Add Cash Wallet
            </button>
          </div>

          <div className="mb-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>Wallet Name</label>
              <input
                value={cashForm.accountName}
                onChange={(event) => setCashForm((current) => ({ ...current, accountName: event.target.value }))}
                className={inputCls}
                placeholder="Main Till"
              />
            </div>
            <div>
              <label className={labelCls}>Current Balance</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={cashForm.currentBalance}
                onChange={(event) => setCashForm((current) => ({ ...current, currentBalance: event.target.value }))}
                className={inputCls}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">Active</p>
              <p className="text-xs text-slate-400">Inactive wallets remain in history but stop appearing in selectors.</p>
            </div>
            <button
              type="button"
              onClick={() => setCashForm((current) => ({ ...current, isActive: !current.isActive }))}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                cashForm.isActive ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-slate-300'
              }`}
            >
              {cashForm.isActive ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={saveCashWallet} className={primaryButtonCls} disabled={saving}>
              {editingCashId ? <Edit3 size={16} /> : <Plus size={16} />}
              {editingCashId ? 'Update Cash Wallet' : 'Save Cash Wallet'}
            </button>
            <button type="button" onClick={resetCashForm} className={secondaryButtonCls}>
              Clear
            </button>
          </div>

          <div className="relative mt-6">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={cashSearch}
              onChange={(event) => setCashSearch(event.target.value)}
              className={`${inputCls} pl-11`}
              placeholder="Search cash wallets"
            />
          </div>

          <div className="mt-5 grid gap-4">
            {cashFiltered.map((wallet) => {
              const isDeficit = toNumber(wallet.current_balance) < 0;
              return (
                <div key={wallet.id} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Wallet size={16} className="text-[#ff6a00]" />
                        <p className="text-sm font-black text-white">{wallet.account_name}</p>
                      </div>
                      <p className="text-xs text-slate-400">Petty Cash Wallet</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void deleteCashWallet(wallet)}
                      className="text-rose-400 transition hover:text-rose-300"
                      disabled={saving}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className={labelCls}>{isDeficit ? 'Credit Position' : 'Available Balance'}</p>
                    <p className={`mt-2 text-2xl font-black ${isDeficit ? 'text-rose-300' : 'text-emerald-300'}`}>
                      {formatMoney(toNumber(wallet.current_balance))}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${wallet.is_active ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-200 text-slate-700'}`}>
                      {wallet.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${isDeficit ? 'bg-rose-500/15 text-rose-200' : 'bg-sky-500/15 text-sky-200'}`}>
                      {isDeficit ? 'On Credit' : 'Healthy'}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openBalanceAdjust('wallet', wallet.id, wallet.current_balance)}
                      className={secondaryButtonCls}
                    >
                      Update Balance
                    </button>
                  </div>
                </div>
              );
            })}
            {cashFiltered.length === 0 ? (
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-400">
                No cash wallets found.
              </div>
            ) : null}
          </div>
        </div>

        <div className={panelCls}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">M-Pesa Wallets</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Create or update mobile money wallets used for receipts and reconciliations.</p>
            </div>
            <button type="button" onClick={focusMpesaForm} className={secondaryButtonCls}>
              <Plus size={16} />
              Add M-Pesa Wallet
            </button>
          </div>

          <div className="mb-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>Business Name</label>
              <input
                value={mpesaForm.businessName}
                onChange={(event) => setMpesaForm((current) => ({ ...current, businessName: event.target.value }))}
                className={inputCls}
                placeholder="Tough Force Security Solutions"
              />
            </div>
            <div>
              <label className={labelCls}>Phone Number</label>
              <input
                value={mpesaForm.phoneNumber}
                onChange={(event) => setMpesaForm((current) => ({ ...current, phoneNumber: event.target.value }))}
                className={inputCls}
                placeholder="2547..."
              />
            </div>
            <div>
              <label className={labelCls}>Current Balance</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={mpesaForm.currentBalance}
                onChange={(event) => setMpesaForm((current) => ({ ...current, currentBalance: event.target.value }))}
                className={inputCls}
                placeholder="0.00"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setMpesaForm((current) => ({ ...current, isActive: !current.isActive }))}
                className={`mt-6 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  mpesaForm.isActive ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-slate-300'
                }`}
              >
                {mpesaForm.isActive ? 'Active' : 'Inactive'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={saveMpesaWallet} className={primaryButtonCls} disabled={saving}>
              {editingMpesaId ? <Edit3 size={16} /> : <Plus size={16} />}
              {editingMpesaId ? 'Update Mpesa Wallet' : 'Save Mpesa Wallet'}
            </button>
            <button type="button" onClick={resetMpesaForm} className={secondaryButtonCls}>
              Clear
            </button>
          </div>

          <div className="relative mt-6">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={mpesaSearch}
              onChange={(event) => setMpesaSearch(event.target.value)}
              className={`${inputCls} pl-11`}
              placeholder="Search Mpesa wallets"
            />
          </div>

          <div className="mt-5 grid gap-4">
            {mpesaFiltered.map((wallet) => {
              const isDeficit = toNumber(wallet.current_balance) < 0;
              return (
                <div key={wallet.id} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CreditCard size={16} className="text-cyan-300" />
                        <p className="text-sm font-black text-white">{wallet.business_name}</p>
                      </div>
                      <p className="text-xs text-slate-400">{wallet.phone_number}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void deleteMpesaWallet(wallet)}
                      className="text-rose-400 transition hover:text-rose-300"
                      disabled={saving}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className={labelCls}>{isDeficit ? 'Credit Position' : 'Available Balance'}</p>
                    <p className={`mt-2 text-2xl font-black ${isDeficit ? 'text-rose-300' : 'text-emerald-300'}`}>
                      {formatMoney(toNumber(wallet.current_balance))}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${wallet.is_active ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-200 text-slate-700'}`}>
                      {wallet.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${isDeficit ? 'bg-rose-500/15 text-rose-200' : 'bg-sky-500/15 text-sky-200'}`}>
                      {isDeficit ? 'On Credit' : 'Healthy'}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openBalanceAdjust('mpesa', wallet.id, wallet.current_balance)}
                      className={secondaryButtonCls}
                    >
                      Update Balance
                    </button>
                  </div>
                </div>
              );
            })}
            {mpesaFiltered.length === 0 ? (
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-400">
                No Mpesa wallets found.
              </div>
            ) : null}
          </div>
        </div>

        <div className="hidden">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Airtel Money Wallets</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Airtel Money floats used for payments and reconciliation.</p>
            </div>
          </div>

          <div className="mb-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>Wallet Name</label>
              <input
                value={genericForm.walletName}
                onChange={(event) => setGenericForm((current) => ({ ...current, walletName: event.target.value }))}
                className={inputCls}
                placeholder="Airtel Float"
              />
            </div>
            <div>
              <label className={labelCls}>Provider</label>
              <input
                value={genericForm.walletProvider}
                onChange={(event) => setGenericForm((current) => ({ ...current, walletProvider: event.target.value }))}
                className={inputCls}
                placeholder="Airtel Money"
              />
            </div>
            <div>
              <label className={labelCls}>Identifier</label>
              <input
                value={genericForm.walletIdentifier}
                onChange={(event) => setGenericForm((current) => ({ ...current, walletIdentifier: event.target.value }))}
                className={inputCls}
                placeholder="0740 123 456"
              />
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <input
                value={genericForm.currency}
                onChange={(event) => setGenericForm((current) => ({ ...current, currency: event.target.value }))}
                className={inputCls}
                placeholder="KES"
              />
            </div>
            <div>
              <label className={labelCls}>Current Balance</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={genericForm.currentBalance}
                onChange={(event) => setGenericForm((current) => ({ ...current, currentBalance: event.target.value }))}
                className={inputCls}
                placeholder="0.00"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setGenericForm((current) => ({ ...current, isActive: !current.isActive }))}
                className={`mt-6 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  genericForm.isActive ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-slate-300'
                }`}
              >
                {genericForm.isActive ? 'Active' : 'Inactive'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
              <button type="button" onClick={saveGenericWallet} className={primaryButtonCls} disabled={saving}>
              <Plus size={16} />
              Save Airtel Money Wallet
            </button>
            <button type="button" onClick={resetGenericForm} className={secondaryButtonCls}>
              Clear
            </button>
          </div>
        </div>

        <div className={panelCls}>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Custom Wallet Registry</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Wallets created here are listed separately from cash and M-Pesa.</p>
            </div>
            <div className="rounded-2xl border border-[#ff6a00]/20 bg-[#ff6a00]/10 px-4 py-2 text-sm font-semibold text-[#ff6a00]">
              {genericWallets.length} total
            </div>
          </div>

          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={genericSearch}
              onChange={(event) => setGenericSearch(event.target.value)}
              className={`${inputCls} pl-11`}
              placeholder="Search custom wallets"
            />
          </div>

          <div className="mt-5 grid gap-4">
            {genericFiltered.map((wallet) => {
              const isDeficit = toNumber(wallet.current_balance) < 0;
              return (
                <div key={wallet.id} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Wallet size={16} className="text-[#ffb37a]" />
                        <p className="text-sm font-black text-white">Airtel Money</p>
                      </div>
                      <p className="text-xs text-slate-400">
                        {[wallet.wallet_provider, wallet.wallet_identifier].filter(Boolean).join(' · ') || 'No identifier'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className={labelCls}>{isDeficit ? 'Credit Position' : 'Available Balance'}</p>
                    <p className={`mt-2 text-2xl font-black ${isDeficit ? 'text-rose-300' : 'text-emerald-300'}`}>
                      {formatMoney(toNumber(wallet.current_balance), wallet.currency || 'KES')}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${wallet.is_active ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-200 text-slate-700'}`}>
                      {wallet.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${isDeficit ? 'bg-rose-500/15 text-rose-200' : 'bg-sky-500/15 text-sky-200'}`}>
                      {isDeficit ? 'On Credit' : 'Healthy'}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openBalanceAdjust('wallet', wallet.id, wallet.current_balance)}
                      className={secondaryButtonCls}
                    >
                      Update Balance
                    </button>
                  </div>
                </div>
              );
            })}
            {genericFiltered.length === 0 ? (
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-400">
                No Airtel Money wallets found.
              </div>
            ) : null}
          </div>
        </div>
      </div>

        <div
          ref={mpesaFormRef}
          className={`${panelCls} transition ${
            activeFormSection === 'mpesa' ? 'ring-4 ring-cyan-300/25 shadow-[0_0_0_1px_rgba(103,232,249,0.18),0_24px_80px_-48px_rgba(34,211,238,0.45)]' : ''
          }`}
        >
        <div className="flex items-center gap-3">
          <Building2 className="text-[#ff6a00]" size={20} />
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Bank Accounts</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Bank accounts are still managed on the existing bank accounts page and will appear in receipting alongside wallets.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinanceWallets;
