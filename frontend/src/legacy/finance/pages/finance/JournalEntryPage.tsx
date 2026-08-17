// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, BookOpen, PencilLine, Plus, Printer, RefreshCcw, Trash2, X } from 'lucide-react';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { useAccess } from '../../hooks/useAccess';
import { resolveOrganizationScope } from '../../utils/organizationScope';
import { supabase } from '../../utils/supabase';
import { escapeHtml, printDocument } from '../../utils/printHelpers';
import bankAccountsService from '../../services/bankAccountsService';
import financeDepositAccountsService, { FinanceDepositAccount } from '../../services/financeDepositAccountsService';

interface CompanyOption {
  id: string;
  name: string;
  code: string | null;
  organization_id: string | null;
}

type BankAccount = FinanceDepositAccount;

const normalizeAccountType = (value?: string | null) => (value || '').trim().toLowerCase();

interface JournalLedgerRow {
  id: string;
  company_id: string | null;
  account_id: string | null;
  debit_account_id: string | null;
  credit_account_id: string | null;
  account_type: string | null;
  bank_name: string | null;
  transaction_type: string | null;
  category: string | null;
  income_group: string | null;
  amount: number | null;
  currency: string | null;
  description: string | null;
  reference_id: string | null;
  transaction_date: string | null;
  payment_method: string | null;
  balance_after: number | null;
  created_at: string | null;
  notes: string | null;
}

interface JournalFormState {
  account_id: string;
  debit_account_id: string;
  credit_account_id: string;
  income_group: string;
  details: string;
  debit: string;
  credit: string;
}

const panelCls =
  'rounded-[24px] border border-gray-200 bg-white/95 p-5 shadow-[0_20px_70px_-45px_rgba(15,23,42,0.35)] backdrop-blur-sm dark:border-white/10 dark:bg-dark-surface/90';
const labelCls = 'text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400';
const inputCls =
  'w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#ff6a00]/40 focus:bg-white focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-[#082131] dark:text-white dark:placeholder:text-slate-400 dark:focus:border-[#ff6a00]/40 dark:focus:bg-[#0b2a3c]';
const actionButtonCls =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:border-[#ff6a00]/40 dark:hover:bg-white/[0.06]';
const primaryButtonCls =
  'inline-flex items-center justify-center gap-2 rounded-2xl bg-[#ff6a00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e85f00]';

const emptyForm = (): JournalFormState => ({
  account_id: '',
  debit_account_id: '',
  credit_account_id: '',
  income_group: '',
  details: '',
  debit: '',
  credit: '',
});

const formatMoney = (value: number, currency = 'KES') =>
  `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateLabel = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const toNumber = (value?: number | string | null) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeText = (value?: string | null) => value?.trim().toLowerCase() || '';

const accountKey = (account: FinanceDepositAccount | { id: string; company_id: string; account_kind?: string | null; bank_name?: string | null; account_number?: string | null; account_holder_name?: string | null; account_type?: string | null; account_name?: string | null; business_name?: string | null; phone_number?: string | null; wallet_name?: string | null; wallet_provider?: string | null; wallet_identifier?: string | null }) => {
  const base = [account.company_id, account.account_kind];
  if (account.account_kind === 'bank') {
    base.push(account.bank_name || '', account.account_number || '', account.account_holder_name || '');
  } else if (account.account_kind === 'cash') {
    base.push(account.account_name || '');
  } else if (account.account_kind === 'mpesa') {
    base.push(account.business_name || '', account.phone_number || '');
  } else {
    base.push(account.wallet_name || '', account.wallet_provider || '', account.wallet_identifier || '');
  }
  return base.join(':').toLowerCase();
};

const JournalEntryPage: React.FC = () => {
  const { profile } = useAccess();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [company, setCompany] = useState<CompanyOption | null>(null);
  const [bankAccounts, setBankAccounts] = useState<FinanceDepositAccount[]>([]);
  const [journalRows, setJournalRows] = useState<JournalLedgerRow[]>([]);
  const [form, setForm] = useState<JournalFormState>(emptyForm());
  const [editingJournal, setEditingJournal] = useState<JournalLedgerRow | null>(null);

  const journalIncomeGroupOptions = useMemo(
    () =>
      ['Journal Entry', 'Bank Transfer', 'Cash Adjustment', 'M-Pesa Float', 'General Adjustment', 'Opening Balance'].sort((a, b) =>
        a.localeCompare(b),
      ),
    [],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const scope = await resolveOrganizationScope(profile);
      if (!scope.organizationId) {
        setCompanies([]);
        setCompany(null);
        setBankAccounts([]);
        setJournalRows([]);
        return;
      }

      const [companiesResponse, journalResponse]: any[] = await Promise.all([
        supabase
          .from('companies')
          .select('id, name, code, organization_id')
          .eq('organization_id', scope.organizationId)
          .order('name', { ascending: true }),
        supabase
          .from('re_finance_ledger')
          .select(
            'id, company_id, account_id, debit_account_id, credit_account_id, account_type, bank_name, transaction_type, category, income_group, amount, currency, description, reference_id, transaction_date, payment_method, balance_after, created_at, notes',
          )
          .eq('source_module', 'journal')
          .order('transaction_date', { ascending: false })
          .order('created_at', { ascending: false }),
      ]);

      if (companiesResponse.error) throw companiesResponse.error;
      let nextJournalResponse = journalResponse;
      if (journalResponse.error) {
        const legacyJournalResponse = await supabase
          .from('re_finance_ledger')
          .select(
            'id, company_id, account_id, account_type, bank_name, transaction_type, category, income_group, amount, currency, description, reference_id, transaction_date, payment_method, balance_after, created_at, notes',
          )
          .eq('source_module', 'journal')
          .order('transaction_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (legacyJournalResponse.error) throw journalResponse.error;
        nextJournalResponse = legacyJournalResponse;
      }

      const nextCompanies = (companiesResponse.data || []) as CompanyOption[];
      setCompanies(nextCompanies);

      const nextCompany = nextCompanies[0] || null;
      setCompany(nextCompany ? (nextCompany as CompanyOption) : null);

      const [bankRows, walletRows] = await Promise.all([
        bankAccountsService.listAccounts(),
        financeDepositAccountsService.listAccounts(),
      ]);

      const nextAccounts = [...bankRows, ...walletRows].reduce<FinanceDepositAccount[]>((accumulator, account) => {
        if (!accumulator.some((existing) => accountKey(existing) === accountKey(account))) {
          accumulator.push(account);
        }
        return accumulator;
      }, []);

      setBankAccounts(nextAccounts);
      if (nextAccounts.length === 1) {
        setForm((current) => (current.account_id ? current : { ...current, account_id: nextAccounts[0].id }));
      }

      const rows = (nextJournalResponse.data || []) as JournalLedgerRow[];
      setJournalRows(rows);
      setEditingJournal((current) => (current && rows.some((row) => row.id === current.id) ? current : null));
    } catch (error: any) {
      console.error('Failed to load journal page:', error);
      setToast({ message: error.message || 'Failed to load journal page.', type: 'error' });
      setJournalRows([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      void loadData();
    }
  }, [profile, loadData]);

  const accountOptions = useMemo(
    () =>
      bankAccounts.map((account) => {
        const label =
          account.account_kind === 'bank'
            ? `${financeDepositAccountsService.formatAccountLabel(account)} - ${formatMoney(toNumber(account.current_balance), account.currency || 'KES')}`
            : `${financeDepositAccountsService.formatAccountLabel(account)} - ${formatMoney(
                toNumber(account.current_balance),
                account.currency || 'KES',
              )}`;

        return { ...account, label };
      }),
    [bankAccounts],
  );

  const accountById = useCallback(
    (accountId?: string | null) => bankAccounts.find((account) => account.id === accountId) || null,
    [bankAccounts],
  );

  const normalizeJournalEffect = useCallback((direction: 'credit' | 'debit', amount: number) => {
    return direction === 'credit' ? amount : -amount;
  }, []);

  const populateFormFromJournal = useCallback(
    (row: JournalLedgerRow) => {
      const amount = toNumber(row.amount);
      const isCredit = normalizeText(row.transaction_type) === 'income';
      setEditingJournal(row);
      setForm({
        account_id: row.account_id || row.debit_account_id || row.credit_account_id || '',
        debit_account_id: isCredit ? '' : row.debit_account_id || row.account_id || '',
        credit_account_id: isCredit ? row.credit_account_id || row.account_id || '' : '',
        income_group: row.income_group || row.category || '',
        details: row.description || row.notes || '',
        debit: isCredit ? '' : amount.toFixed(2),
        credit: isCredit ? amount.toFixed(2) : '',
      });
    },
    [],
  );

  const clearJournalEditor = useCallback(() => {
    setEditingJournal(null);
    setForm(emptyForm());
  }, []);

  const handleSubmit = useCallback(async () => {
    const debit = toNumber(form.debit);
    const credit = toNumber(form.credit);
    if ((debit > 0 && credit > 0) || (debit <= 0 && credit <= 0)) {
      setToast({ message: 'Enter either a debit or a credit amount, not both.', type: 'warning' });
      return;
    }

    const activeAccountId = form.account_id || (debit > 0 ? form.debit_account_id : form.credit_account_id);
    const account = bankAccounts.find((item) => item.id === activeAccountId);
    if (!account) {
      setToast({
        message: 'Select the journal account first.',
        type: 'warning',
      });
      return;
    }

    const details = form.details.trim();
    if (!details) {
      setToast({ message: 'Add the journal narrative before saving.', type: 'warning' });
      return;
    }

    if (debit > 0 && !bankAccounts.find((item) => item.id === (form.debit_account_id || form.account_id))) {
      setToast({ message: 'Select the account to debit first.', type: 'warning' });
      return;
    }

    if (credit > 0 && !bankAccounts.find((item) => item.id === (form.credit_account_id || form.account_id))) {
      setToast({ message: 'Select the account to credit first.', type: 'warning' });
      return;
    }

    const amount = credit > 0 ? credit : debit;
    const direction = credit > 0 ? 'credit' : 'debit';
    const nextEffect = normalizeJournalEffect(direction, amount);
    const companyId =
      (account.company_id && companies.some((item) => item.id === account.company_id) ? account.company_id : '') ||
      editingJournal?.company_id ||
      company?.id ||
      companies[0]?.id ||
      null;
    if (!companyId) {
      setToast({ message: 'No company could be resolved for this journal entry.', type: 'warning' });
      return;
    }

    const reference = `JOURNAL-${Date.now().toString(36).toUpperCase()}`;

    setSaving(true);
    try {
      const ledgerPayload = {
        company_id: companyId,
        account_id: account.id,
        debit_account_id: form.debit_account_id || (debit > 0 ? account.id : null),
        credit_account_id: form.credit_account_id || (credit > 0 ? account.id : null),
        account_type: normalizeAccountType(account.account_type),
        bank_name: account.bank_name,
        transaction_type: direction === 'credit' ? 'income' : 'expense',
        category: form.income_group || 'Journal Entry',
        income_group: form.income_group || null,
        amount,
        currency: account.currency || 'KES',
        description: details,
        reference_id: editingJournal?.reference_id || reference,
        source_module: 'journal',
        transaction_date: new Date().toISOString().slice(0, 10),
        created_by: profile?.id || null,
        payment_method: account.account_type || 'manual',
        balance_after: account.current_balance + nextEffect,
        notes: details,
      };

      if (editingJournal) {
        const originalAccount = accountById(editingJournal.account_id || editingJournal.debit_account_id || editingJournal.credit_account_id) || account;
        const originalAmount = toNumber(editingJournal.amount);
        const originalDirection = normalizeText(editingJournal.transaction_type) === 'income' ? 'credit' : 'debit';
        const originalEffect = normalizeJournalEffect(originalDirection, originalAmount);
        const originalAccountBefore = originalAccount.current_balance;
        const targetAccountBefore = account.current_balance;
        const targetAccountAfter = account.id === originalAccount.id ? targetAccountBefore + (nextEffect - originalEffect) : targetAccountBefore + nextEffect;
        const originalAccountAfter = originalAccount.id === account.id ? targetAccountAfter : originalAccountBefore - originalEffect;
        const updates = [];

        if (originalAccount.id === account.id) {
          updates.push(
            supabase
              .from('re_bank_accounts')
              .update({ current_balance: targetAccountAfter })
              .eq('id', account.id),
          );
          const [balanceUpdate] = await Promise.all(updates);
          if (balanceUpdate.error) throw balanceUpdate.error;
        } else {
          const sourceBalanceUpdate = await supabase
            .from('re_bank_accounts')
            .update({ current_balance: originalAccountAfter })
            .eq('id', originalAccount.id);
          if (sourceBalanceUpdate.error) throw sourceBalanceUpdate.error;

          const targetBalanceUpdate = await supabase
            .from('re_bank_accounts')
            .update({ current_balance: targetAccountAfter })
            .eq('id', account.id);
          if (targetBalanceUpdate.error) {
            await supabase.from('re_bank_accounts').update({ current_balance: originalAccountBefore }).eq('id', originalAccount.id);
            throw targetBalanceUpdate.error;
          }
        }

        const { error: ledgerError } = await supabase.from('re_finance_ledger').update(ledgerPayload).eq('id', editingJournal.id);
        if (ledgerError) {
          if (originalAccount.id === account.id) {
            await supabase.from('re_bank_accounts').update({ current_balance: originalAccountBefore }).eq('id', account.id);
          } else {
            await supabase.from('re_bank_accounts').update({ current_balance: originalAccountBefore }).eq('id', originalAccount.id);
            await supabase.from('re_bank_accounts').update({ current_balance: targetAccountBefore }).eq('id', account.id);
          }
          throw ledgerError;
        }
      } else {
        const nextBalance = account.current_balance + nextEffect;
        const balanceUpdate = await supabase
          .from('re_bank_accounts')
          .update({ current_balance: nextBalance })
          .eq('id', account.id);
        if (balanceUpdate.error) throw balanceUpdate.error;

        ledgerPayload.balance_after = nextBalance;
        const { error: ledgerError } = await supabase.from('re_finance_ledger').insert([ledgerPayload]);
        if (ledgerError) {
          await supabase.from('re_bank_accounts').update({ current_balance: account.current_balance }).eq('id', account.id);
          throw ledgerError;
        }
      }

      setToast({ message: editingJournal ? 'Journal entry updated.' : 'Journal entry saved.', type: 'success' });
      clearJournalEditor();
      await loadData();
    } catch (error: any) {
      console.error('Failed to save journal entry:', error);
      setToast({ message: error.message || 'Failed to save journal entry.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }, [accountById, bankAccounts, clearJournalEditor, companies, company?.id, editingJournal, form, loadData, normalizeJournalEffect, profile?.id]);

  const handleDeleteJournal = useCallback(
    async (row: JournalLedgerRow) => {
      const confirmed = window.confirm('Delete this journal entry and reverse its balance impact?');
      if (!confirmed) return;

      let linkedAccount = accountById(row.debit_account_id || row.credit_account_id || row.account_id);
      if (!linkedAccount && row.account_id) {
      const { data } = await supabase
          .from('re_bank_accounts')
          .select('id, company_id, bank_name, account_number, account_holder_name, account_type, currency, current_balance, is_active')
          .eq('id', row.account_id)
          .maybeSingle();
        linkedAccount = (data as BankAccount) || null;
      }
      if (!linkedAccount && row.company_id) {
        linkedAccount =
          bankAccounts.find(
            (account) =>
              account.company_id === row.company_id &&
              normalizeText(account.bank_name) === normalizeText(row.bank_name) &&
              normalizeAccountType(account.account_type) === normalizeAccountType(row.account_type),
          ) || null;
      }
      if (!linkedAccount && row.company_id && row.bank_name) {
        const { data } = await supabase
          .from('re_bank_accounts')
          .select('id, company_id, bank_name, account_number, account_holder_name, account_type, currency, current_balance, is_active')
          .eq('company_id', row.company_id)
          .ilike('bank_name', row.bank_name)
          .maybeSingle();
        linkedAccount = (data as BankAccount) || null;
      }
      if (!linkedAccount) {
        setToast({ message: 'The linked account for this journal entry could not be found.', type: 'warning' });
        return;
      }

      const amount = toNumber(row.amount);
      const direction = normalizeText(row.transaction_type) === 'income' ? 'credit' : 'debit';
      const effect = normalizeJournalEffect(direction, amount);
      const balanceBefore = linkedAccount.current_balance;
      const balanceAfter = balanceBefore - effect;

      setSaving(true);
      try {
        const balanceUpdate = await supabase
          .from('re_bank_accounts')
          .update({ current_balance: balanceAfter })
          .eq('id', linkedAccount.id);
        if (balanceUpdate.error) throw balanceUpdate.error;

        const { error } = await supabase.from('re_finance_ledger').delete().eq('id', row.id);
        if (error) {
          await supabase.from('re_bank_accounts').update({ current_balance: balanceBefore }).eq('id', linkedAccount.id);
          throw error;
        }

        if (editingJournal?.id === row.id) {
          clearJournalEditor();
        }
        setToast({ message: 'Journal entry deleted.', type: 'success' });
        await loadData();
      } catch (error: any) {
        console.error('Failed to delete journal entry:', error);
        setToast({ message: error.message || 'Failed to delete journal entry.', type: 'error' });
      } finally {
        setSaving(false);
      }
    },
    [accountById, clearJournalEditor, editingJournal?.id, loadData, normalizeJournalEffect],
  );

  const handlePrintJournal = useCallback((row: JournalLedgerRow) => {
    printDocument({
      title: `Journal ${row.reference_id || row.id}`,
      subtitle: `${formatDateLabel(row.transaction_date || row.created_at)} · ${normalizeText(row.transaction_type) === 'income' ? 'Credit' : 'Debit'} account`,
      bodyHtml: `
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;">
          ${[
            ['Reference', row.reference_id || 'JOURNAL'],
            ['Date', formatDateLabel(row.transaction_date || row.created_at)],
            ['Account', row.bank_name || row.category || 'Journal Account'],
            ['Side', normalizeText(row.transaction_type) === 'income' ? 'Credit account' : 'Debit account'],
            ['Debit Account', row.debit_account_id ? accountById(row.debit_account_id)?.bank_name || row.debit_account_id : '-'],
            ['Credit Account', row.credit_account_id ? accountById(row.credit_account_id)?.bank_name || row.credit_account_id : '-'],
            ['Category', row.category || '-'],
            ['Income Group', row.income_group || '-'],
            ['Amount', formatMoney(toNumber(row.amount), row.currency || 'KES')],
            ['Balance After', row.balance_after != null ? formatMoney(toNumber(row.balance_after), row.currency || 'KES') : '-'],
          ]
            .map(
              ([label, value]) => `
                <div style="border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px;">
                  <div style="font-size:11px;text-transform:uppercase;letter-spacing:.18em;color:#64748b;font-weight:700;">${escapeHtml(label)}</div>
                  <div style="margin-top:6px;font-size:15px;font-weight:700;color:#0f172a;">${escapeHtml(String(value))}</div>
                </div>
              `,
            )
            .join('')}
        </div>
        <div style="margin-top:16px;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.18em;color:#64748b;font-weight:700;">Narrative</div>
          <div style="margin-top:6px;font-size:14px;line-height:1.6;color:#0f172a;">${escapeHtml(row.description || row.notes || 'No narrative available')}</div>
        </div>
      `,
    });
  }, [accountById]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <CustomLoader size={40} label="Loading journal entries..." />
      </div>
    );
  }

  return (
    <div
      className="min-h-full w-full space-y-8 bg-white p-6 text-gray-900 dark:bg-dark-bg dark:text-white lg:p-10"
      data-print-company-name={company ? `${company.name}${company.code ? ` (${company.code})` : ''}` : 'Hakika app'}
      data-print-company-logo="/tough_force_logo.webp"
    >
      <div className="flex flex-col gap-6 border-b border-gray-200 pb-8 dark:border-dark-border md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BookOpen className="text-brand-purple" aria-hidden="true" /> Journal Entry
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-text">
            Direct adjustments, transfers, and balance corrections for bank, cash, and wallet accounts.
          </p>
        </div>
        <button type="button" onClick={loadData} className={actionButtonCls}>
          <RefreshCcw size={16} />
          Refresh
        </button>
      </div>

      <div className={panelCls}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              {editingJournal ? 'Edit Journal Entry' : 'Create Journal Entry'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {editingJournal
                ? `Updating ${editingJournal.reference_id || 'journal entry'}`
                : 'Post a new journal entry and the linked account balance will update automatically.'}
            </p>
          </div>
          {editingJournal ? (
            <button type="button" onClick={clearJournalEditor} className={actionButtonCls}>
              <X size={16} />
              Cancel Edit
            </button>
          ) : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="md:col-span-2">
            <label className={labelCls}>Account</label>
            <select
              value={form.account_id}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  account_id: event.target.value,
                }))
              }
              className={inputCls}
            >
              <option value="">Select bank, cash, or wallet account</option>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Debit Account</label>
            <select
              value={form.debit_account_id}
              onChange={(event) => setForm((current) => ({ ...current, debit_account_id: event.target.value }))}
              className={inputCls}
            >
              <option value="">Select account to debit</option>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Credit Account</label>
            <select
              value={form.credit_account_id}
              onChange={(event) => setForm((current) => ({ ...current, credit_account_id: event.target.value }))}
              className={inputCls}
            >
              <option value="">Select account to credit</option>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Income Group</label>
            <select
              value={form.income_group}
              onChange={(event) => setForm((current) => ({ ...current, income_group: event.target.value }))}
              className={inputCls}
            >
              <option value="">Select income group</option>
              {journalIncomeGroupOptions.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Debit</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.debit}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  debit: event.target.value,
                  credit: '',
                }))
              }
              className={inputCls}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className={labelCls}>Credit</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.credit}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  credit: event.target.value,
                  debit: '',
                }))
              }
              className={inputCls}
              placeholder="0.00"
            />
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <label className={labelCls}>Details</label>
            <textarea
              value={form.details}
              onChange={(event) => setForm((current) => ({ ...current, details: event.target.value }))}
              className={`${inputCls} min-h-[120px]`}
              placeholder="Narrate the reason for the adjustment or transfer"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={handleSubmit} className={primaryButtonCls} disabled={saving}>
            <Plus size={16} />
            {editingJournal ? 'Update Journal Entry' : 'Save Journal Entry'}
          </button>
          <button type="button" onClick={clearJournalEditor} className={actionButtonCls}>
            Clear
          </button>
        </div>
      </div>

      <div className={panelCls}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Journal History</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Recent journal entries are listed here with their debit, credit, and running balance.
            </p>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {company ? `${company.name}${company.code ? ` (${company.code})` : ''}` : 'No company detected'}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:border-white/5 dark:bg-white/5">
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Income Group</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">Debit</th>
                <th className="px-4 py-3">Credit</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {journalRows.map((row) => {
                const isCredit = normalizeText(row.transaction_type) === 'income';
                const amount = toNumber(row.amount);
                const accountLabel =
                  accountById(row.debit_account_id || row.credit_account_id || row.account_id)?.bank_name ||
                  row.bank_name ||
                  row.category ||
                  'Journal Account';
                const debitAccountLabel = row.debit_account_id
                  ? accountById(row.debit_account_id)?.bank_name || row.debit_account_id
                  : '-';
                const creditAccountLabel = row.credit_account_id
                  ? accountById(row.credit_account_id)?.bank_name || row.credit_account_id
                  : '-';
                const isEditing = editingJournal?.id === row.id;
                return (
                  <tr key={row.id} className={`text-gray-900 dark:text-white ${isEditing ? 'bg-amber-50/70 dark:bg-amber-400/10' : ''}`}>
                    <td className="px-4 py-3 font-mono text-[10px] font-bold text-brand-purple">{row.reference_id || 'JOURNAL'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {isCredit ? <ArrowUpRight size={14} className="text-emerald-500" /> : <ArrowDownRight size={14} className="text-rose-500" />}
                        <div>
                          <p className="text-sm font-semibold">{accountLabel}</p>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{row.account_type || 'journal'}</p>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                            {isCredit ? `Credit account: ${creditAccountLabel}` : `Debit account: ${debitAccountLabel}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{row.income_group || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{row.description || row.notes || '-'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-rose-600 dark:text-rose-300">
                      {isCredit ? '-' : formatMoney(amount, row.currency || 'KES')}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                      {isCredit ? formatMoney(amount, row.currency || 'KES') : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{formatDateLabel(row.transaction_date || row.created_at)}</td>
                    <td className="px-4 py-3 text-sm font-black text-slate-900 dark:text-white">
                      {row.balance_after != null ? formatMoney(toNumber(row.balance_after), row.currency || 'KES') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => handlePrintJournal(row)} className={actionButtonCls} disabled={saving}>
                          <Printer size={14} />
                          Print
                        </button>
                        <button type="button" onClick={() => populateFormFromJournal(row)} className={actionButtonCls} disabled={saving}>
                          <PencilLine size={14} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteJournal(row)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200 dark:hover:bg-rose-400/20"
                          disabled={saving}
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {journalRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No journal entries have been posted yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {toast ? <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </div>
  );
};

export default JournalEntryPage;
