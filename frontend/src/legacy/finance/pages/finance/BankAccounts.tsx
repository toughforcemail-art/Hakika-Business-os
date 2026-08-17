// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Landmark, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { activityLogger } from '../../utils/activityLogger';
import { useAccess } from '../../hooks/useAccess';
import { resolveOrganizationScope } from '../../utils/organizationScope';
import { supabase } from '../../utils/supabase';

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  account_type: string | null;
  currency: string | null;
  current_balance: number;
  is_active: boolean;
  company_id: string;
}

interface Company {
  id: string;
  name: string;
  code: string | null;
  organization_id: string | null;
}

interface BankReferenceOption {
  id: string;
  company_id: string;
  option_type: 'bank_name' | 'account_number';
  option_value: string;
}

interface BankAccountFormState {
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  account_type: string;
  current_balance: string;
}

interface BalanceAdjustFormState {
  accountId: string;
  mode: 'set' | 'increase' | 'decrease';
  amount: string;
}

const panelCls = 'rounded-[24px] border border-gray-200 bg-white/95 p-5 shadow-[0_20px_70px_-45px_rgba(15,23,42,0.35)] backdrop-blur-sm dark:border-white/10 dark:bg-dark-surface/90';
const labelCls = 'text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400';
const inputCls = 'w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#ff6a00]/40 focus:bg-white focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-[#082131] dark:text-white dark:placeholder:text-slate-400 dark:focus:border-[#ff6a00]/40 dark:focus:bg-[#0b2a3c]';
const actionButtonCls = 'inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:border-[#ff6a00]/40 dark:hover:bg-white/[0.06]';
const primaryButtonCls = 'inline-flex items-center justify-center gap-2 rounded-2xl bg-[#ff6a00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e85f00]';

const toNumber = (value?: number | string | null) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const normalizeText = (value?: string | null) => value?.trim().toLowerCase() || '';
const isDuplicateReferenceOptionError = (error: any) => {
  const message = normalizeText(`${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`);
  return (
    message.includes('duplicate key value violates unique constraint') ||
    message.includes('finance_bank_account_reference_options') ||
    message.includes('option_type_option')
  );
};

const formatMoney = (value: number, currency = 'KES') =>
  `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const accountKey = (account: Pick<BankAccount, 'bank_name' | 'account_number' | 'account_holder_name'>) =>
  [account.bank_name?.trim().toLowerCase(), account.account_number?.trim(), account.account_holder_name?.trim().toLowerCase()]
    .filter(Boolean)
    .join('|');

const bankReferenceOptionMeta: Record<
  BankReferenceOption['option_type'],
  { label: string; placeholder: string; successMessage: string }
> = {
  bank_name: {
    label: 'Bank Name',
    placeholder: 'Equity Bank, KCB, ABSA...',
    successMessage: 'Bank name saved.',
  },
  account_number: {
    label: 'Account Number',
    placeholder: '0123456789',
    successMessage: 'Account number saved.',
  },
};

const BankAccounts: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAccess();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankReferenceOptions, setBankReferenceOptions] = useState<BankReferenceOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [showReferenceOptionForm, setShowReferenceOptionForm] = useState<BankReferenceOption['option_type'] | null>(null);
  const [referenceOptionValue, setReferenceOptionValue] = useState('');
  const [showBalanceAdjust, setShowBalanceAdjust] = useState(false);
  const [balanceAdjustForm, setBalanceAdjustForm] = useState<BalanceAdjustFormState>({
    accountId: '',
    mode: 'set',
    amount: '',
  });
  const [formData, setFormData] = useState<BankAccountFormState>({
    bank_name: '',
    account_number: '',
    account_holder_name: '',
    account_type: 'checking',
    current_balance: '0',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const scope = await resolveOrganizationScope(profile);
      setOrganizationId(scope.organizationId);

      if (!scope.organizationId) {
        setCompanies([]);
        setBankAccounts([]);
        setSelectedCompanyId('');
        return;
      }

      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, name, code, organization_id')
        .eq('organization_id', scope.organizationId)
        .order('name', { ascending: true });

      if (companiesError) throw companiesError;

      const nextCompanies = (companiesData || []) as Company[];
      setCompanies(nextCompanies);
      if (nextCompanies.length === 0) {
        setSelectedCompanyId('');
        setBankAccounts([]);
        setBankReferenceOptions([]);
      }
    } catch (error: any) {
      console.error('Failed to load data:', error);
      setToast({ message: error.message || 'Failed to load data.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadBankAccounts = async (companyId: string) => {
    if (!companyId) {
      setBankAccounts([]);
      setBankReferenceOptions([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('re_bank_accounts')
        .select('id, company_id, bank_name, account_number, account_holder_name, account_type, currency, current_balance, is_active')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('bank_name', { ascending: true })
        .order('account_number', { ascending: true });

      if (error) throw error;

      const normalizedAccounts = ((data || []) as BankAccount[])
        .map((account) => ({
          ...account,
          current_balance: toNumber(account.current_balance),
        }))
        .filter((account, index, array) => {
          const key = accountKey(account);
          return array.findIndex((item) => accountKey(item) === key) === index;
        })
        .sort((left, right) => {
          const nameCompare = left.bank_name.localeCompare(right.bank_name);
          if (nameCompare !== 0) return nameCompare;
          return left.account_number.localeCompare(right.account_number);
        });

      setBankAccounts(normalizedAccounts);
    } catch (error: any) {
      console.error('Failed to load bank accounts:', error);
      setToast({ message: error.message || 'Failed to load bank accounts.', type: 'error' });
      setBankAccounts([]);
    }
  };

  const loadBankReferenceOptions = async (companyId: string) => {
    if (!companyId) {
      setBankReferenceOptions([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('finance_bank_account_reference_options')
        .select('id, company_id, option_type, option_value')
        .eq('company_id', companyId)
        .in('option_type', ['bank_name', 'account_number'])
        .order('option_value', { ascending: true });

      if (error) throw error;

      setBankReferenceOptions((data || []) as BankReferenceOption[]);
    } catch (error: any) {
      console.error('Failed to load bank account reference options:', error);
      setBankReferenceOptions([]);
    }
  };

  useEffect(() => {
    if (profile) {
      void loadData();
    }
  }, [profile]);

  useEffect(() => {
    if (!companies.length) {
      return;
    }

    const selectedExists = companies.some((company) => company.id === selectedCompanyId);
    if (!selectedCompanyId || !selectedExists) {
      setSelectedCompanyId(companies[0].id);
    }
  }, [companies, selectedCompanyId]);

  useEffect(() => {
    if (selectedCompanyId) {
      void Promise.all([loadBankAccounts(selectedCompanyId), loadBankReferenceOptions(selectedCompanyId)]);
    } else {
      setBankAccounts([]);
      setBankReferenceOptions([]);
    }
  }, [selectedCompanyId]);

  const companyOptions = useMemo(
    () =>
      companies.map((company) => ({
        value: company.id,
        label: company.code ? `${company.name} (${company.code})` : company.name,
      })),
    [companies],
  );

  const bankNameOptionsList = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...bankReferenceOptions
              .filter((option) => option.option_type === 'bank_name')
              .map((option) => option.option_value),
            ...bankAccounts.map((account) => account.bank_name),
          ]
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [bankAccounts, bankReferenceOptions],
  );

  const accountNumberOptionsList = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...(formData.bank_name
              ? bankAccounts
                  .filter((account) => normalizeText(account.bank_name) === normalizeText(formData.bank_name))
                  .map((account) => account.account_number)
              : [
                  ...bankReferenceOptions
                    .filter((option) => option.option_type === 'account_number')
                    .map((option) => option.option_value),
                  ...bankAccounts.map((account) => account.account_number),
                ]),
            formData.account_number,
          ]
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [bankAccounts, bankReferenceOptions, formData.account_number, formData.bank_name],
  );

  const openReferenceOptionForm = (type: BankReferenceOption['option_type']) => {
    setShowReferenceOptionForm(type);
    setReferenceOptionValue('');
  };

  const createReferenceOption = async () => {
    if (!selectedCompanyId || !showReferenceOptionForm) {
      setToast({ message: 'Select a company first so the option is saved in the right list.', type: 'warning' });
      return;
    }

    const optionValue = referenceOptionValue.trim();
    if (!optionValue) {
      setToast({ message: `Enter a ${bankReferenceOptionMeta[showReferenceOptionForm].label.toLowerCase()} first.`, type: 'warning' });
      return;
    }

    try {
      const existingOption = bankReferenceOptions.find(
        (option) =>
          option.option_type === showReferenceOptionForm &&
          option.option_value.trim().toLowerCase() === optionValue.toLowerCase(),
      );

      if (existingOption) {
        setFormData((current) =>
          showReferenceOptionForm === 'bank_name'
            ? { ...current, bank_name: existingOption.option_value }
            : { ...current, account_number: existingOption.option_value },
        );
        setToast({ message: bankReferenceOptionMeta[showReferenceOptionForm].successMessage, type: 'success' });
        setShowReferenceOptionForm(null);
        setReferenceOptionValue('');
        return;
      }

      const { data, error } = await supabase
        .from('finance_bank_account_reference_options')
        .insert([
          {
            company_id: selectedCompanyId,
            option_type: showReferenceOptionForm,
            option_value: optionValue,
            created_by: profile?.id || null,
          },
        ])
        .select('id, company_id, option_type, option_value')
        .single();

      if (error) throw error;

      const created = data as BankReferenceOption;
      setBankReferenceOptions((current) => {
        const exists = current.some(
          (option) =>
            option.option_type === created.option_type &&
            option.option_value.trim().toLowerCase() === created.option_value.trim().toLowerCase(),
        );
        return exists ? current : [...current, created].sort((left, right) => left.option_value.localeCompare(right.option_value));
      });

      setFormData((current) =>
        created.option_type === 'bank_name'
          ? { ...current, bank_name: created.option_value }
          : { ...current, account_number: created.option_value },
      );
      setToast({ message: bankReferenceOptionMeta[created.option_type].successMessage, type: 'success' });
      setShowReferenceOptionForm(null);
      setReferenceOptionValue('');
    } catch (error: any) {
      if (isDuplicateReferenceOptionError(error)) {
        await loadBankReferenceOptions(selectedCompanyId);
        setFormData((current) =>
          showReferenceOptionForm === 'bank_name'
            ? { ...current, bank_name: optionValue }
            : { ...current, account_number: optionValue },
        );
        setToast({ message: bankReferenceOptionMeta[showReferenceOptionForm!].successMessage, type: 'success' });
        setShowReferenceOptionForm(null);
        setReferenceOptionValue('');
        return;
      }

      console.error('Failed to save bank account reference option:', error);
      setToast({ message: error.message || 'Failed to save option.', type: 'error' });
    }
  };

  const handleAddBankAccount = async () => {
    if (!selectedCompanyId) {
      setToast({ message: 'Select a company before adding a bank account.', type: 'warning' });
      return;
    }

    if (!formData.bank_name.trim() || !formData.account_number.trim() || !formData.account_holder_name.trim()) {
      setToast({ message: 'Bank name, account number, and account holder are required.', type: 'warning' });
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from('re_bank_accounts')
        .insert([
          {
            company_id: selectedCompanyId,
            bank_name: formData.bank_name.trim(),
            account_number: formData.account_number.trim(),
            account_holder_name: formData.account_holder_name.trim(),
            account_type: formData.account_type,
            current_balance: toNumber(formData.current_balance),
            is_active: true,
          },
        ])
        .select('id, company_id, bank_name, account_number, account_holder_name, account_type, currency, current_balance, is_active')
        .single();

      if (error) throw error;

      const createdAccount = data as BankAccount;
      setBankAccounts((current) =>
        [...current, createdAccount].sort((left, right) => left.bank_name.localeCompare(right.bank_name)),
      );
      setFormData({
        bank_name: '',
        account_number: '',
        account_holder_name: '',
        account_type: 'checking',
        current_balance: '0',
      });
      setShowForm(false);
      setToast({ message: 'Bank account added successfully.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to add bank account:', error);
      setToast({ message: error.message || 'Failed to add bank account.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBankAccount = async (id: string) => {
    const confirmed = window.confirm('Delete this bank account from the register?');
    if (!confirmed) return;

    try {
      const account = bankAccounts.find((item) => item.id === id);
      const { error } = await supabase.rpc('archive_record', { p_table_name: 're_bank_accounts', p_record_id: id, p_reason: 'delete' });
      if (error) throw error;
      void activityLogger.logDataAction('delete', 're_bank_accounts', id, account?.bank_name || 'Bank Account');
      setToast({ message: 'Bank account removed successfully.', type: 'success' });
      await loadBankAccounts(selectedCompanyId);
    } catch (error: any) {
      console.error('Failed to delete bank account:', error);
      setToast({ message: error.message || 'Failed to delete bank account.', type: 'error' });
    }
  };

  const openRequisitionWithBankAccount = (accountId: string) => {
    navigate(`/app/finance/requisitions?chargeBankAccountId=${encodeURIComponent(accountId)}`);
  };


  const openBalanceAdjust = (account: BankAccount) => {
    setBalanceAdjustForm({
      accountId: account.id,
      mode: 'set',
      amount: `${account.current_balance ?? 0}`,
    });
    setShowBalanceAdjust(true);
  };

  const applyBalanceAdjust = async () => {
    if (!balanceAdjustForm.accountId) {
      setToast({ message: 'Select an account before updating the balance.', type: 'warning' });
      return;
    }

    const amount = toNumber(balanceAdjustForm.amount);
    if (!Number.isFinite(amount)) {
      setToast({ message: 'Enter a valid amount.', type: 'warning' });
      return;
    }

    const account = bankAccounts.find((item) => item.id === balanceAdjustForm.accountId);
    if (!account) {
      setToast({ message: 'Selected account is no longer available.', type: 'warning' });
      return;
    }

    const newBalance =
      balanceAdjustForm.mode === 'set'
        ? amount
        : balanceAdjustForm.mode === 'increase'
          ? account.current_balance + amount
          : account.current_balance - amount;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('re_bank_accounts')
        .update({ current_balance: newBalance })
        .eq('id', account.id);
      if (error) throw error;

      const delta = newBalance - account.current_balance;
      if (Math.abs(delta) > 0) {
        const ledgerPayload = {
          company_id: account.company_id,
          account_id: account.id,
          account_type: 'bank',
          bank_name: account.bank_name,
          transaction_type: delta >= 0 ? 'income' : 'expense',
          category: 'Manual Balance Adjustment',
          amount: Math.abs(delta),
          currency: account.currency || 'KES',
          description: 'Manual balance adjustment',
          reference_id: 'MANUAL-BAL',
          source_module: 'finance',
          transaction_date: new Date().toISOString().slice(0, 10),
          created_by: profile?.id || null,
          payment_method: 'manual',
          balance_after: newBalance,
          notes: `Adjusted from ${formatMoney(account.current_balance, account.currency || 'KES')} to ${formatMoney(newBalance, account.currency || 'KES')}`,
        };

        const { error: ledgerError } = await supabase.from('re_finance_ledger').insert([ledgerPayload]);
        if (ledgerError) {
          console.error('Failed to write manual balance audit trail:', ledgerError);
          setToast({ message: 'Balance updated, but ledger audit entry failed. Check finance ledger migration.', type: 'warning' });
        }
      }

      setShowBalanceAdjust(false);
      setBalanceAdjustForm({ accountId: '', mode: 'set', amount: '' });
      await loadBankAccounts(selectedCompanyId);
      setToast({ message: 'Bank balance updated.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to update bank balance:', error);
      setToast({ message: error.message || 'Failed to update bank balance.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <CustomLoader text="Loading bank accounts..." />;
  }

  return (
    <div className="min-h-screen space-y-6 bg-[#f6f7fb] p-6 dark:bg-[#061723]">
      <div className="flex items-center justify-between">
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
              <Landmark className="text-[#ff6a00]" aria-hidden="true" /> Bank Accounts
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Manage bank accounts for your organization.</p>
          </div>
        </div>
        <button type="button" onClick={() => setShowForm((current) => !current)} className={primaryButtonCls}>
          <Plus size={16} />
          Add Bank Account
        </button>
      </div>

      <div className={panelCls}>
        <label className={labelCls}>Select Company</label>
        <select
          value={selectedCompanyId}
          onChange={(event) => {
            setSelectedCompanyId(event.target.value);
            setFormData((current) => ({
              ...current,
              bank_name: '',
              account_number: '',
            }));
          }}
          className={inputCls}
        >
          <option value="">Select company to view bank accounts</option>
          {companyOptions.map((company) => (
            <option key={company.value} value={company.value}>
              {company.label}
            </option>
          ))}
        </select>
      </div>

      {showForm ? (
        <div className={`${panelCls} space-y-4`}>
          <div>
            <p className={labelCls}>Bank Register</p>
            <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-white">Add New Bank Account</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Use this when one entity has multiple accounts under the same bank. Each account number is stored separately.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>Bank Name</label>
              <div className="flex gap-2">
                <select
                  value={formData.bank_name}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      bank_name: event.target.value,
                      account_number: '',
                    }))
                  }
                  className={inputCls}
                >
                  <option value="">Select bank name</option>
                  {bankNameOptionsList.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => openReferenceOptionForm('bank_name')}
                  className={actionButtonCls}
                  title="Add new bank name"
                  aria-label="Add new bank name"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Account Number</label>
              <div className="flex gap-2">
                <select
                  value={formData.account_number}
                  onChange={(event) => setFormData((current) => ({ ...current, account_number: event.target.value }))}
                  className={inputCls}
                >
                  <option value="">Select account number</option>
                  {accountNumberOptionsList.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => openReferenceOptionForm('account_number')}
                  className={actionButtonCls}
                  title="Add new account number"
                  aria-label="Add new account number"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Account Holder</label>
              <input
                value={formData.account_holder_name}
                onChange={(event) => setFormData((current) => ({ ...current, account_holder_name: event.target.value }))}
                className={inputCls}
                placeholder="Hakika HQ, Toughforce..."
              />
            </div>
            <div>
              <label className={labelCls}>Account Type</label>
              <select
                value={formData.account_type}
                onChange={(event) => setFormData((current) => ({ ...current, account_type: event.target.value }))}
                className={inputCls}
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="business">Business</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Current Balance</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.current_balance}
                onChange={(event) => setFormData((current) => ({ ...current, current_balance: event.target.value }))}
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={handleAddBankAccount} className={primaryButtonCls} disabled={saving}>
              Save Account
            </button>
            <button type="button" onClick={() => setShowForm(false)} className={actionButtonCls}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {bankAccounts.map((account) => (
          <div
            key={account.id}
            className={`${panelCls} cursor-pointer transition hover:border-[#ff6a00]/25 hover:shadow-[0_24px_80px_-48px_rgba(255,106,0,0.35)]`}
            role="button"
            tabIndex={0}
            onClick={() => openRequisitionWithBankAccount(account.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openRequisitionWithBankAccount(account.id);
              }
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Landmark size={16} className="text-[#ff6a00]" />
                  <p className="text-sm font-black text-slate-900 dark:text-white">{account.bank_name}</p>
                </div>
                <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 dark:text-slate-400">{account.account_number}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{account.account_holder_name}</p>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleDeleteBankAccount(account.id);
                }}
                className="text-rose-500 transition hover:text-rose-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="mt-4 border-t border-gray-200 pt-4 dark:border-white/10">
              <p className={labelCls}>Current Balance</p>
              <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                {formatMoney(toNumber(account.current_balance), account.currency || 'KES')}
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {account.account_type} - {account.is_active ? 'Active' : 'Inactive'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={(event) => {
                  event.stopPropagation();
                  openBalanceAdjust(account);
                }} className={actionButtonCls}>
                  Update Balance
                </button>
                <button type="button" onClick={(event) => {
                  event.stopPropagation();
                  openRequisitionWithBankAccount(account.id);
                }} className={actionButtonCls}>
                  Use in Requisition
                </button>
              </div>
            </div>
          </div>
        ))}

        {bankAccounts.length === 0 ? (
          <div className={`${panelCls} md:col-span-2 xl:col-span-3`}>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No bank accounts have been added yet. Use the add button to register bank accounts for the selected company.
            </p>
          </div>
        ) : null}
      </div>

      {showReferenceOptionForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[32px] border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#071b27]">
            <div className="border-b border-gray-200 bg-gradient-to-r from-[#fff3eb] via-white to-[#fff9f4] px-6 py-5 dark:border-white/10 dark:from-[#0b2a3c] dark:via-[#082131] dark:to-[#071b27]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Bank Setup</p>
                  <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">
                    Add New {bankReferenceOptionMeta[showReferenceOptionForm].label}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    This will be saved to the database and appear in the dropdown immediately.
                  </p>
                </div>
                <button type="button" onClick={() => setShowReferenceOptionForm(null)} className={actionButtonCls}>
                  Close
                </button>
              </div>
            </div>

            <div className="p-6">
              <label className={labelCls}>{bankReferenceOptionMeta[showReferenceOptionForm].label}</label>
              <input
                value={referenceOptionValue}
                onChange={(event) => setReferenceOptionValue(event.target.value)}
                className={inputCls}
                placeholder={bankReferenceOptionMeta[showReferenceOptionForm].placeholder}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3 px-6 pb-6">
              <button type="button" onClick={createReferenceOption} className={primaryButtonCls}>
                <Plus size={16} />
                Save {bankReferenceOptionMeta[showReferenceOptionForm].label}
              </button>
              <button type="button" onClick={() => setReferenceOptionValue('')} className={actionButtonCls}>
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showBalanceAdjust ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[32px] border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#071b27]">
            <div className="border-b border-gray-200 bg-gradient-to-r from-[#fff3eb] via-white to-[#fff9f4] px-6 py-5 dark:border-white/10 dark:from-[#0b2a3c] dark:via-[#082131] dark:to-[#071b27]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00]">Manual Balance</p>
                  <h3 className="mt-2 text-xl font-black">Update Bank Balance</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Use this to set or adjust the current balance manually.
                  </p>
                </div>
                <button type="button" onClick={() => setShowBalanceAdjust(false)} className={actionButtonCls}>
                  Close
                </button>
              </div>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelCls}>Bank Account</label>
                <select
                  value={balanceAdjustForm.accountId}
                  onChange={(event) => setBalanceAdjustForm((current) => ({ ...current, accountId: event.target.value }))}
                  className={inputCls}
                >
                  <option value="">Select bank account</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.bank_name} - {account.account_number}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Adjustment Type</label>
                <select
                  value={balanceAdjustForm.mode}
                  onChange={(event) =>
                    setBalanceAdjustForm((current) => ({ ...current, mode: event.target.value as BalanceAdjustFormState['mode'] }))
                  }
                  className={inputCls}
                >
                  <option value="set">Set Balance</option>
                  <option value="increase">Increase</option>
                  <option value="decrease">Decrease</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={balanceAdjustForm.amount}
                  onChange={(event) => setBalanceAdjustForm((current) => ({ ...current, amount: event.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 px-6 pb-6">
              <button type="button" onClick={applyBalanceAdjust} className={primaryButtonCls} disabled={saving}>
                Save Balance
              </button>
              <button type="button" onClick={() => setBalanceAdjustForm({ accountId: '', mode: 'set', amount: '' })} className={actionButtonCls}>
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </div>
  );
};

export default BankAccounts;


