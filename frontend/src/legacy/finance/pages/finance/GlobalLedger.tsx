// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Building2,
  Download,
  Landmark,
  PencilLine,
  Plus,
  Printer,
  Search,
  Trash2,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { useAccess } from '../../hooks/useAccess';
import { resolveOrganizationScope } from '../../utils/organizationScope';
import { supabase } from '../../utils/supabase';
import { printDocument } from '../../utils/printHelpers';

type LedgerSource = 'ledger' | 'payment' | 'receipt';
type LedgerDirection = 'credit' | 'debit';
type AccountType = 'bank' | 'cash' | 'mpesa' | 'general';

interface LedgerEntry {
  id: string;
  source: LedgerSource;
  direction: LedgerDirection;
  accountType: AccountType;
  reference: string;
  accountLabel: string;
  bankName: string | null;
  category: string;
  incomeGroup: string | null;
  expenseGroup: string | null;
  description: string;
  counterparty: string;
  affectedEntity: string;
  method: string;
  amount: number;
  currency: string;
  entryDate: string;
  createdAt: string;
  runningBalance: number;
}

interface FinanceLedgerRow {
  id: string;
  company_id: string | null;
  account_id: string | null;
  account_type: string | null;
  bank_name: string | null;
  transaction_type: string | null;
  category: string | null;
  income_group: string | null;
  expense_group: string | null;
  amount: number | null;
  currency: string | null;
  description: string | null;
  reference_id: string | null;
  source_module: string | null;
  transaction_date: string | null;
  payment_method: string | null;
  balance_after: number | null;
  created_at: string | null;
  notes: string | null;
}

interface PaymentRow {
  id: string;
  payment_number: string | null;
  recording_date: string | null;
  payment_date: string | null;
  amount: number;
  currency: string | null;
  payment_method: string | null;
  cost_center: string | null;
  pay_from_account: string | null;
  expense_group: string | null;
  description: string | null;
  created_at: string;
  payee?: { payee_name: string | null }[] | null;
}

interface ReceiptRow {
  id: string;
  receipt_number: string | null;
  receipt_date: string | null;
  amount: number;
  currency: string | null;
  payment_method: string | null;
  received_from: string | null;
  source_module: string | null;
  category: string | null;
  created_at: string;
  customer?: { customer_name: string | null }[] | null;
}

interface BankAccount {
  id: string;
  company_id: string;
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  account_type: string;
  currency: string | null;
  current_balance: number;
  is_active: boolean;
  module?: string | null;
  entity?: string | null;
}

interface BankReferenceOption {
  id: string;
  company_id: string;
  option_type: 'module' | 'entity' | 'bank_name' | 'account_number';
  option_value: string;
}

interface CompanyOption {
  id: string;
  name: string;
  code: string | null;
  organization_id: string | null;
}

interface LedgerFilters {
  accountType: 'all' | AccountType;
  bankName: string;
  bankAccountId: string;
  incomeGroup: string;
  expenseGroup: string;
  month: string;
  year: string;
  startDate: string;
  endDate: string;
}

interface JournalEntryFormState {
  account_id: string;
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
const iconActionButtonCls =
  'inline-flex h-[50px] w-[50px] items-center justify-center rounded-2xl border border-[#ff6a00]/15 bg-[#ff6a00]/8 text-[#ff6a00] transition hover:bg-[#ff6a00]/14 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#ff6a00]/25 dark:bg-[#ff6a00]/10 dark:text-[#ffb37a] dark:hover:bg-[#ff6a00]/20';

const emptyFilters: LedgerFilters = {
  accountType: 'all',
  bankName: '',
  bankAccountId: '',
  incomeGroup: '',
  expenseGroup: '',
  month: '',
  year: '',
  startDate: '',
  endDate: '',
};

const emptyJournalEntryForm = (): JournalEntryFormState => ({
  account_id: '',
  income_group: '',
  details: '',
  debit: '',
  credit: '',
});

const parseDate = (value?: string | null) => {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const toNumber = (value?: number | string | null) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeText = (value?: string | null) => value?.trim().toLowerCase() || '';

const formatMoney = (value: number, currency = 'KES') =>
  `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateLabel = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const buildEntryKey = (entry: Pick<LedgerEntry, 'source' | 'reference' | 'amount' | 'direction' | 'entryDate' | 'accountLabel' | 'description'>) =>
  [
    entry.source,
    normalizeText(entry.reference),
    entry.direction,
    entry.amount.toFixed(2),
    normalizeText(entry.entryDate),
    normalizeText(entry.accountLabel),
    normalizeText(entry.description),
  ].join('|');

const escapeHtmlText = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const bankReferenceOptionMeta: Record<
  BankReferenceOption['option_type'],
  { label: string; placeholder: string; successMessage: string }
> = {
  module: {
    label: 'Module',
    placeholder: 'finance, security, real_estate...',
    successMessage: 'Module option saved.',
  },
  entity: {
    label: 'Entity',
    placeholder: 'Hakika HQ, Toughforce...',
    successMessage: 'Entity option saved.',
  },
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

const resolveAffectedEntity = (primary?: string | null, secondary?: string | null, fallback = 'General') => {
  const first = primary?.trim();
  const second = secondary?.trim();
  if (first && second && first !== second) return `${first} / ${second}`;
  return first || second || fallback;
};

const normalizeAccountType = (value?: string | null): AccountType => {
  const normalized = normalizeText(value);
  if (normalized === 'bank' || normalized === 'cash' || normalized === 'mpesa') return normalized;
  return 'general';
};

const resolveBankAccountMatch = (entry: LedgerEntry, bankAccount?: BankAccount | null) => {
  if (!bankAccount) return true;

  const haystack = [entry.bankName, entry.accountLabel, entry.description, entry.affectedEntity, entry.reference]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return [bankAccount.bank_name, bankAccount.account_number, bankAccount.account_holder_name, bankAccount.entity, bankAccount.module]
    .filter(Boolean)
    .some((value) => haystack.includes(String(value).toLowerCase()));
};

const isMissingBankAccountMetaColumn = (error: any) => {
  const message = normalizeText(`${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`);
  return (
    message.includes('re_bank_accounts.module') ||
    message.includes('re_bank_accounts.entity') ||
    (message.includes('re_bank_accounts') && message.includes(`'module' column`)) ||
    (message.includes('re_bank_accounts') && message.includes(`'entity' column`)) ||
    (message.includes('schema cache') && message.includes('re_bank_accounts') && message.includes('module')) ||
    (message.includes('schema cache') && message.includes('re_bank_accounts') && message.includes('entity'))
  );
};

const resolveEffectiveCompanyId = async (
  profile?: { company_id?: string | null; company_code?: string | null; organization_id?: string | null } | null,
) => {
  if (profile?.company_id) return profile.company_id;

  if (profile?.company_code) {
    const { data, error } = await supabase
      .from('companies')
      .select('id')
      .ilike('code', profile.company_code.trim())
      .maybeSingle();

    if (error) throw error;
    if (data?.id) return data.id;
  }

  if (profile?.organization_id) {
    const { data, error } = await supabase
      .from('companies')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: true })
      .limit(2);

    if (error) throw error;
    if ((data || []).length === 1) return data![0].id;
  }

  const { data: workspaceCompanies, error: workspaceError } = await supabase
    .from('companies')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(2);

  if (workspaceError) throw workspaceError;
  if ((workspaceCompanies || []).length === 1) return workspaceCompanies![0].id;

  return null;
};

const resolveCompanyScope = async (
  profile?: { company_id?: string | null; company_code?: string | null; organization_id?: string | null } | null,
) => {
  if (profile?.organization_id) {
    const { data, error } = await supabase
      .from('companies')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    const companyIds = ((data || []) as { id: string }[]).map((company) => company.id);
    return companyIds;
  }

  const singleCompanyId = await resolveEffectiveCompanyId(profile);
  return singleCompanyId ? [singleCompanyId] : [];
};

const GlobalLedger: React.FC = () => {
  const { profile } = useAccess();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [organizationNotice, setOrganizationNotice] = useState<string | null>(null);
  const [dataNotice, setDataNotice] = useState<string | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [ledgerRows, setLedgerRows] = useState<FinanceLedgerRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<LedgerFilters>(emptyFilters);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankReferenceOptions, setBankReferenceOptions] = useState<BankReferenceOption[]>([]);
  const [selectedBankCompanyId, setSelectedBankCompanyId] = useState('');
  const [showBankForm, setShowBankForm] = useState(false);
  const [showJournalForm, setShowJournalForm] = useState(false);
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [showBankReferenceOptionForm, setShowBankReferenceOptionForm] =
    useState<BankReferenceOption['option_type'] | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [savingJournal, setSavingJournal] = useState(false);
  const bankFormRef = useRef<HTMLDivElement | null>(null);
  const journalFormRef = useRef<HTMLDivElement | null>(null);
  const companyFormRef = useRef<HTMLDivElement | null>(null);
  const [bankFormData, setBankFormData] = useState({
    company_id: '',
    bank_name: '',
    account_number: '',
    account_holder_name: '',
    account_type: 'checking',
    current_balance: '0',
    module: 'finance',
    entity: '',
  });
  const [journalFormData, setJournalFormData] = useState<JournalEntryFormState>(emptyJournalEntryForm());
  const [editingJournal, setEditingJournal] = useState<FinanceLedgerRow | null>(null);
  const [bankReferenceOptionValue, setBankReferenceOptionValue] = useState('');
  const [companyFormData, setCompanyFormData] = useState({
    name: '',
    code: '',
  });
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setFilter = useCallback(<K extends keyof LedgerFilters>(key: K, value: LedgerFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchTerm]);

  const fetchCompanies = async () => {
    try {
      let query = supabase.from('companies').select('id, name, code, organization_id').order('name', { ascending: true });

      if (profile?.organization_id) {
        query = query.eq('organization_id', profile.organization_id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const nextCompanies = (data || []) as CompanyOption[];
      setCompanies(nextCompanies);

      const resolvedCompanyId = await resolveEffectiveCompanyId(profile);
      setSelectedBankCompanyId((current) => {
        if (current) return current;
        if (nextCompanies.length === 1) return nextCompanies[0].id;
        return '';
      });
      setBankFormData((current) => {
        if (current.company_id) return current;
        if (resolvedCompanyId) return { ...current, company_id: resolvedCompanyId };
        if (nextCompanies.length === 1) return { ...current, company_id: nextCompanies[0].id };
        return current;
      });
    } catch (error: any) {
      console.error('Error fetching companies:', error);
      setCompanies([]);
    }
  };

  const fetchBankAccounts = async (companyOverride?: string | null) => {
    const companyId = companyOverride || '';
    const companyIds = companyId && companyId !== 'all'
      ? [companyId]
      : companies.length > 0
        ? companies.map((company) => company.id)
        : profile?.organization_id
          ? ((await supabase.from('companies').select('id').eq('organization_id', profile.organization_id)).data || []).map((company: any) => company.id)
          : [];

    if (companyIds.length === 0) {
      setBankAccounts([]);
      return;
    }

    try {
      let response: any = await supabase
        .from('re_bank_accounts')
        .select('id, company_id, bank_name, account_number, account_holder_name, account_type, currency, current_balance, is_active')
        .in('company_id', companyIds)
        .order('bank_name', { ascending: true })
        .order('account_number', { ascending: true });

      if (response.error && isMissingBankAccountMetaColumn(response.error)) {
        response = await supabase
          .from('re_bank_accounts')
          .select('id, company_id, bank_name, account_number, account_holder_name, account_type, currency, current_balance, is_active')
          .eq('company_id', companyId)
          .order('bank_name', { ascending: true })
          .order('account_number', { ascending: true });
      }

      if (response.error) throw response.error;

      const normalizedAccounts = ((response.data || []) as Partial<BankAccount>[]).map((account) => ({
        ...account,
        company_id: account.company_id || companyId || '',
        module: account.module ?? null,
        entity: account.entity ?? null,
      }));

      setBankAccounts(normalizedAccounts as BankAccount[]);
    } catch (error: any) {
      console.error('Error fetching bank accounts:', error);
      setToast({ message: error.message || 'Failed to load bank accounts.', type: 'error' });
      setBankAccounts([]);
    }
  };

  const fetchBankReferenceOptions = async (companyOverride?: string | null) => {
    const companyId = companyOverride || (await resolveEffectiveCompanyId(profile));

    if (!companyId) {
      setBankReferenceOptions([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('finance_bank_account_reference_options')
        .select('id, company_id, option_type, option_value')
        .eq('company_id', companyId)
        .order('option_value', { ascending: true });

      if (error) throw error;
      setBankReferenceOptions((data || []) as BankReferenceOption[]);
    } catch (error: any) {
      console.error('Error fetching bank account reference options:', error);
      setBankReferenceOptions([]);
    }
  };

  const fetchFallbackEntries = async (organizationId: string) => {
      let paymentsResponse: any = await supabase
      .from('finance_payments')
      .select('id, payment_number, recording_date, payment_date, amount, currency, payment_method, cost_center, pay_from_account, expense_group, description, created_at, payee:finance_payees(payee_name)')
      .eq('organization_id', organizationId)
      .order('recording_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (paymentsResponse.error && normalizeText(paymentsResponse.error.message).includes('expense_group')) {
      paymentsResponse = await supabase
        .from('finance_payments')
        .select('id, payment_number, recording_date, payment_date, amount, currency, payment_method, cost_center, pay_from_account, description, created_at, payee:finance_payees(payee_name)')
        .eq('organization_id', organizationId)
        .order('recording_date', { ascending: true })
        .order('created_at', { ascending: true });
    }

    const receiptsResponse: any = await supabase
      .from('finance_receipts')
      .select('id, receipt_number, receipt_date, amount, currency, payment_method, received_from, source_module, category, created_at, customer:finance_customers(customer_name)')
      .eq('organization_id', organizationId)
      .order('receipt_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (paymentsResponse.error) throw paymentsResponse.error;
    if (receiptsResponse.error) throw receiptsResponse.error;

    const payments = (paymentsResponse.data || []) as PaymentRow[];
    const receipts = (receiptsResponse.data || []) as ReceiptRow[];

    const paymentEntries: LedgerEntry[] = payments.map((payment) => ({
      id: `payment-${payment.id}`,
      source: 'payment',
      direction: 'debit',
      accountType: normalizeAccountType(payment.payment_method === 'Cash' ? 'cash' : payment.payment_method === 'M-Pesa' ? 'mpesa' : 'bank'),
      reference: payment.payment_number || 'PAYMENT',
      accountLabel: payment.pay_from_account || payment.payment_method || 'Payment account',
      bankName: payment.pay_from_account || null,
      category: payment.cost_center || payment.expense_group || 'Payment',
      incomeGroup: null,
      expenseGroup: payment.expense_group || null,
      description: payment.description || `Payment to ${payment.payee?.[0]?.payee_name || 'vendor'}`,
      counterparty: payment.payee?.[0]?.payee_name || 'Vendor',
      affectedEntity: resolveAffectedEntity(payment.cost_center, payment.pay_from_account, 'Payment account'),
      method: payment.payment_method || 'Unspecified',
      amount: toNumber(payment.amount),
      currency: payment.currency || 'KES',
      entryDate: payment.recording_date || payment.payment_date || payment.created_at,
      createdAt: payment.created_at,
      runningBalance: 0,
    }));

    const receiptEntries: LedgerEntry[] = receipts.map((receipt) => ({
      id: `receipt-${receipt.id}`,
      source: 'receipt',
      direction: 'credit',
      accountType: normalizeAccountType(receipt.payment_method === 'Cash' ? 'cash' : receipt.payment_method === 'M-Pesa' ? 'mpesa' : 'bank'),
      reference: receipt.receipt_number || 'RECEIPT',
      accountLabel: receipt.payment_method || 'Receipt account',
      bankName: null,
      category: receipt.category || receipt.source_module || 'Receipt',
      incomeGroup: receipt.category || null,
      expenseGroup: null,
      description: `Receipt from ${receipt.customer?.[0]?.customer_name || receipt.received_from || 'customer'}`,
      counterparty: receipt.customer?.[0]?.customer_name || receipt.received_from || 'Customer',
      affectedEntity: resolveAffectedEntity(receipt.source_module, receipt.category, 'Receipt account'),
      method: receipt.payment_method || 'Unspecified',
      amount: toNumber(receipt.amount),
      currency: receipt.currency || 'KES',
      entryDate: receipt.receipt_date || receipt.created_at,
      createdAt: receipt.created_at,
      runningBalance: 0,
    }));

    const combined = [...paymentEntries, ...receiptEntries].sort((left, right) => {
      const dateDiff = parseDate(left.entryDate) - parseDate(right.entryDate);
      if (dateDiff !== 0) return dateDiff;
      return parseDate(left.createdAt) - parseDate(right.createdAt);
    });

    let running = 0;
    return combined.map((entry) => {
      running += entry.direction === 'credit' ? entry.amount : -entry.amount;
      return { ...entry, runningBalance: running };
    });
  };

  const fetchLedger = async () => {
    setLoading(true);

    try {
      const scope = await resolveOrganizationScope(profile);
      setOrganizationNotice(scope.notice);
      setDataNotice(null);

      const companyIds = await resolveCompanyScope(profile);

      if (!scope.organizationId && companyIds.length === 0) {
        setEntries([]);
        setOrganizationNotice('Unable to determine organization scope.');
        return;
      }

      let nextEntries: LedgerEntry[] = [];
      let usedFallback = false;
      let fallbackReason: 'empty' | 'error' | 'no_company' | null = null;
      let fallbackEntries: LedgerEntry[] = [];

      if (companyIds.length > 0) {
        const { data, error } = await supabase
          .from('re_finance_ledger')
          .select('id, company_id, account_id, account_type, bank_name, transaction_type, category, income_group, expense_group, amount, currency, description, reference_id, source_module, transaction_date, payment_method, balance_after, created_at, notes')
          .in('company_id', companyIds)
          .order('transaction_date', { ascending: true })
          .order('created_at', { ascending: true });

        if (!error && (data || []).length > 0) {
          const rows = (data || []) as FinanceLedgerRow[];
          setLedgerRows(rows);
          setEditingJournal((current) => (current && rows.some((row) => row.id === current.id) ? current : null));
          let running = 0;
          nextEntries = rows.map((row) => {
            const direction: LedgerDirection = normalizeText(row.transaction_type) === 'income' ? 'credit' : 'debit';
            running += direction === 'credit' ? toNumber(row.amount) : -toNumber(row.amount);
            const providedBalance = row.balance_after;

            return {
              id: `ledger-${row.id}`,
              source: 'ledger',
              direction,
              accountType: normalizeAccountType(row.account_type),
              reference: row.reference_id || row.category || row.source_module || 'LEDGER',
              accountLabel:
                row.account_type === 'bank'
                  ? `${row.bank_name || 'Bank'}`
                  : row.account_type === 'cash'
                    ? 'Cash'
                    : row.account_type === 'mpesa'
                      ? 'M-Pesa'
                      : row.bank_name || 'General',
              bankName: row.bank_name,
              category: row.category || 'General',
              incomeGroup: row.income_group,
              expenseGroup: row.expense_group,
              description: row.description || row.notes || row.category || 'Ledger entry',
              counterparty: row.source_module || row.bank_name || 'Ledger source',
              affectedEntity: row.bank_name || row.account_type || 'Ledger account',
              method: row.payment_method || row.account_type || 'Unspecified',
              amount: toNumber(row.amount),
              currency: row.currency || 'KES',
              entryDate: row.transaction_date || row.created_at || '',
              createdAt: row.created_at || row.transaction_date || '',
              runningBalance: typeof providedBalance === 'number' ? providedBalance : running,
            };
          });
        } else if (error) {
          console.warn('Falling back to payments/receipts ledger source:', error);
          usedFallback = true;
          fallbackReason = 'error';
          setLedgerRows([]);
          setEditingJournal(null);
        } else {
          usedFallback = true;
          fallbackReason = 'empty';
          setLedgerRows([]);
          setEditingJournal(null);
        }
      } else {
        usedFallback = true;
        fallbackReason = 'no_company';
        setLedgerRows([]);
        setEditingJournal(null);
      }

      if (scope.organizationId) {
        fallbackEntries = await fetchFallbackEntries(scope.organizationId);
      }

      if (nextEntries.length === 0 && fallbackEntries.length > 0) {
        nextEntries = fallbackEntries;
      } else if (nextEntries.length > 0 && fallbackEntries.length > 0) {
        const seen = new Set(nextEntries.map(buildEntryKey));
        const mergedFallback = fallbackEntries.filter((entry) => {
          const key = buildEntryKey(entry);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        nextEntries = [...nextEntries, ...mergedFallback].sort((left, right) => {
          const dateDiff = parseDate(left.entryDate) - parseDate(right.entryDate);
          if (dateDiff !== 0) return dateDiff;
          return parseDate(left.createdAt) - parseDate(right.createdAt);
        });
      }

      if (fallbackReason === 'error') {
        setDataNotice('Showing finance receipts and payments because the consolidated account ledger is not available yet.');
      } else if (fallbackEntries.length > 0 && usedFallback) {
        setDataNotice('Showing finance receipts and payments alongside consolidated ledger rows so older activity stays visible.');
      }

      setEntries(nextEntries);
    } catch (error: any) {
      console.error('Error fetching ledger:', error);
      setDataNotice('Unable to load the global ledger right now.');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPage = async () => {
    await fetchCompanies();
    await fetchLedger();
  };

  const accountById = useCallback(
    (accountId?: string | null) => bankAccounts.find((account) => account.id === accountId) || null,
    [bankAccounts],
  );

  const normalizeJournalEffect = useCallback((direction: LedgerDirection, amount: number) => {
    return direction === 'credit' ? amount : -amount;
  }, []);

  const clearJournalEditor = useCallback(() => {
    setEditingJournal(null);
    setJournalFormData(emptyJournalEntryForm());
  }, []);

  const populateJournalFromRow = useCallback(
    (row: FinanceLedgerRow) => {
      const account = accountById(row.account_id);
      if (!account) {
        setToast({ message: 'The linked account for this journal entry is no longer available.', type: 'warning' });
        return;
      }

      const amount = toNumber(row.amount);
      const isCredit = normalizeText(row.transaction_type) === 'income';
      setEditingJournal(row);
      setJournalFormData({
        account_id: account.id,
        income_group: row.income_group || row.category || '',
        details: row.description || row.notes || '',
        debit: isCredit ? '' : amount.toFixed(2),
        credit: isCredit ? amount.toFixed(2) : '',
      });
      setShowJournalForm(true);
    },
    [accountById],
  );

  useEffect(() => {
    if (profile) {
      void loadPage();
    }
  }, [profile]);

  useEffect(() => {
    if (showBankForm) {
      window.setTimeout(() => {
        bankFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  }, [showBankForm]);

  useEffect(() => {
    if (showCompanyForm) {
      window.setTimeout(() => {
        companyFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  }, [showCompanyForm]);

  useEffect(() => {
    if (location.pathname.endsWith('/finance/journal-entry') || new URLSearchParams(location.search).get('journal') === '1') {
      setShowJournalForm(true);
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (showJournalForm) {
      window.setTimeout(() => {
        journalFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  }, [showJournalForm]);

  useEffect(() => {
    if (!profile) return;

    void Promise.all([fetchBankAccounts(selectedBankCompanyId), fetchBankReferenceOptions(selectedBankCompanyId)]);
  }, [selectedBankCompanyId, profile, companies]);

  const bankAccountOptions = useMemo(
    () =>
      bankAccounts.map((account) => ({
        ...account,
        label: `${account.bank_name} - ${account.account_number}${account.entity ? ` - ${account.entity}` : ''}`,
      })),
    [bankAccounts],
  );

  const journalAccountOptions = useMemo(
    () =>
      bankAccounts.map((account) => ({
        ...account,
        label: `${account.bank_name} - ${account.account_number}${account.entity ? ` - ${account.entity}` : ''} - ${formatMoney(
          toNumber(account.current_balance),
          account.currency || 'KES',
        )}`,
      })),
    [bankAccounts],
  );
  const companyOptions = useMemo(
    () =>
      companies.map((company) => ({
        value: company.id,
        label: company.code ? `${company.name} (${company.code})` : company.name,
      })),
    [companies],
  );

  const bankNameOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [...bankAccounts.map((account) => account.bank_name), ...entries.map((entry) => entry.bankName || '')].filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [bankAccounts, entries],
  );

  const moduleOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            'finance',
            'security',
            'real_estate',
            'hr',
            'rock_of_ages',
            ...bankReferenceOptions
              .filter((option) => option.option_type === 'module')
              .map((option) => option.option_value),
            ...bankAccounts.map((account) => account.module || '').filter(Boolean),
          ].map((value) => value.trim()).filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [bankAccounts, bankReferenceOptions],
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
            ...(bankFormData.bank_name
              ? bankAccounts
                  .filter((account) => normalizeText(account.bank_name) === normalizeText(bankFormData.bank_name))
                  .map((account) => account.account_number)
              : [
                  ...bankReferenceOptions
                    .filter((option) => option.option_type === 'account_number')
                    .map((option) => option.option_value),
                  ...bankAccounts.map((account) => account.account_number),
                ]),
            bankFormData.account_number,
          ]
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [bankAccounts, bankFormData.account_number, bankFormData.bank_name, bankReferenceOptions],
  );

  const entityOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...bankReferenceOptions
              .filter((option) => option.option_type === 'entity')
              .map((option) => option.option_value),
            ...bankAccounts.map((account) => account.entity || '').filter(Boolean),
          ].map((value) => value.trim()).filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [bankAccounts, bankReferenceOptions],
  );

  const incomeGroupOptions = useMemo(
    () =>
      Array.from(new Set(entries.map((entry) => entry.incomeGroup || '').filter(Boolean))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [entries],
  );

  const journalIncomeGroupOptions = useMemo(
    () =>
      Array.from(
        new Set([
          'Journal Entry',
          'Bank Transfer',
          'Cash Adjustment',
          'M-Pesa Float',
          'General Adjustment',
          ...entries.map((entry) => entry.incomeGroup || '').filter(Boolean),
        ]),
      ).sort((left, right) => left.localeCompare(right)),
    [entries],
  );
  const expenseGroupOptions = useMemo(
    () =>
      Array.from(new Set(entries.map((entry) => entry.expenseGroup || '').filter(Boolean))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [entries],
  );

  const yearOptions = useMemo(
    () =>
      Array.from(
        new Set(
          entries
            .map((entry) => {
              const date = new Date(entry.entryDate);
              return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}`;
            })
            .filter(Boolean),
        ),
      ).sort((left, right) => Number(right) - Number(left)),
    [entries],
  );

  const filteredEntries = useMemo(() => {
    const search = normalizeText(debouncedSearchTerm);
    const selectedBankAccount = bankAccounts.find((account) => account.id === filters.bankAccountId) || null;
    const hasDateFilters = filters.month || filters.year || filters.startDate || filters.endDate;
    const startDateMs = parseDate(filters.startDate);
    const endDateMs = parseDate(filters.endDate);

    return [...entries]
      .filter((entry) => {
        if (filters.accountType !== 'all' && entry.accountType !== filters.accountType) return false;
        if (filters.bankName && normalizeText(entry.bankName) !== normalizeText(filters.bankName)) return false;
        if (selectedBankAccount && !resolveBankAccountMatch(entry, selectedBankAccount)) return false;
        if (filters.incomeGroup && normalizeText(entry.incomeGroup) !== normalizeText(filters.incomeGroup)) return false;
        if (filters.expenseGroup && normalizeText(entry.expenseGroup) !== normalizeText(filters.expenseGroup)) return false;

        if (hasDateFilters) {
          const entryDate = new Date(entry.entryDate);
          const entryTime = entryDate.getTime();
          if (!Number.isNaN(entryTime)) {
            if (filters.month && `${entryDate.getMonth() + 1}` !== filters.month) return false;
            if (filters.year && `${entryDate.getFullYear()}` !== filters.year) return false;
            if (startDateMs && entryTime < startDateMs) return false;
            if (endDateMs && entryTime > endDateMs) return false;
          }
        }

        if (!search) return true;

        const haystack = [
          entry.reference,
          entry.accountLabel,
          entry.bankName,
          entry.category,
          entry.incomeGroup,
          entry.expenseGroup,
          entry.description,
          entry.counterparty,
          entry.affectedEntity,
          entry.method,
        ]
          .filter(Boolean)
          .join(' ');

        return normalizeText(haystack).includes(search);
      })
      .sort((left, right) => {
        const dateDiff = parseDate(right.entryDate) - parseDate(left.entryDate);
        if (dateDiff !== 0) return dateDiff;
        return parseDate(right.createdAt) - parseDate(left.createdAt);
      });
  }, [bankAccounts, entries, filters, debouncedSearchTerm]);

  const totals = useMemo(() => {
    const totalReceipts = filteredEntries
      .filter((entry) => entry.direction === 'credit')
      .reduce((sum, entry) => sum + entry.amount, 0);
    const totalPayments = filteredEntries
      .filter((entry) => entry.direction === 'debit')
      .reduce((sum, entry) => sum + entry.amount, 0);

    const normalizedBankName = normalizeText(filters.bankName);
    const filteredBankAccounts = bankAccounts.filter((account) => {
      if (filters.bankAccountId && account.id !== filters.bankAccountId) return false;
      if (normalizedBankName && !normalizeText(account.bank_name).includes(normalizedBankName)) return false;
      return true;
    });

    const bankBalanceTotal =
      filteredBankAccounts.length > 0
        ? filteredBankAccounts.reduce((sum, account) => sum + toNumber(account.current_balance), 0)
        : bankAccounts.reduce((sum, account) => sum + toNumber(account.current_balance), 0);

    const runningBalance =
      bankBalanceTotal > 0
        ? bankBalanceTotal
        : filteredEntries.length > 0
          ? filteredEntries[0].runningBalance
          : totalReceipts - totalPayments;

    return { totalReceipts, totalPayments, runningBalance };
  }, [bankAccounts, filteredEntries, filters.bankAccountId, filters.bankName]);

  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setFilters(emptyFilters);
  }, []);

  const handlePrint = useCallback(() => {
    const title = 'Global Ledger Statement';
    const today = new Date();
    const dateLabel = today.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const accountFilter =
      filters.accountType === 'all'
        ? 'All Accounts'
        : filters.accountType === 'bank'
          ? 'Bank'
          : filters.accountType === 'cash'
            ? 'Cash'
            : 'M-Pesa';
    const bankFilterLabel = filters.bankName ? `Bank: ${filters.bankName}` : 'All Banks';
    const periodLabel =
      filters.startDate || filters.endDate
        ? `${filters.startDate || 'Start'} - ${filters.endDate || 'End'}`
        : filters.month || filters.year
          ? `${filters.month || 'All months'} ${filters.year || ''}`.trim()
          : 'All Dates';

    const bankBalances = bankAccounts.map((account) => ({
      label: `${account.bank_name} - ${account.account_number}`,
      balance: formatMoney(toNumber(account.current_balance), account.currency || 'KES'),
    }));

    const rowsHtml =
      filteredEntries.length > 0
        ? filteredEntries
            .map(
              (entry) => `
            <tr>
              <td>${escapeHtmlText(entry.reference)}</td>
              <td>${escapeHtmlText(entry.accountLabel)}</td>
              <td>${escapeHtmlText(entry.category)}</td>
              <td>${escapeHtmlText(entry.description)}</td>
              <td>${escapeHtmlText(entry.method)}</td>
              <td class="amount ${entry.direction === 'credit' ? 'credit' : 'debit'}">
                ${entry.direction === 'credit' ? '+' : '-'}${escapeHtmlText(formatMoney(entry.amount, entry.currency))}
              </td>
              <td>${escapeHtmlText(formatDateLabel(entry.entryDate))}</td>
              <td class="balance">${escapeHtmlText(formatMoney(entry.runningBalance, entry.currency))}</td>
            </tr>
          `,
            )
            .join('')
        : `
          <tr>
            <td colspan="8" class="empty">No ledger entries found for the selected filters.</td>
          </tr>
        `;

    const bankBalancesHtml =
      bankBalances.length > 0
        ? bankBalances
            .map(
              (bank) => `
            <div class="bank-row">
              <span>${escapeHtmlText(bank.label)}</span>
              <strong>${escapeHtmlText(bank.balance)}</strong>
            </div>
          `,
            )
            .join('')
        : `<div class="bank-row"><span>No bank balances available.</span></div>`;

    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>${escapeHtmlText(title)}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 32px; color: #0f172a; }
            h1 { font-size: 24px; margin: 0 0 6px; }
            .meta { font-size: 12px; color: #475569; margin-bottom: 16px; }
            .summary { display: flex; gap: 16px; margin-bottom: 18px; }
            .summary-card { flex: 1; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; }
            .summary-card p { margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: .2em; color: #64748b; }
            .summary-card strong { display: block; margin-top: 8px; font-size: 18px; }
            .bank-list { margin-bottom: 18px; }
            .bank-list h3 { margin: 0 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: .2em; color: #64748b; }
            .bank-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #e2e8f0; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            thead { background: #f8fafc; }
            th, td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
            th { font-size: 10px; text-transform: uppercase; letter-spacing: .2em; color: #64748b; }
            .amount { font-weight: 700; }
            .credit { color: #059669; }
            .debit { color: #e11d48; }
            .balance { font-weight: 700; }
            .empty { text-align: center; padding: 20px 8px; color: #64748b; }
            @media print {
              body { padding: 20px; }
              .summary { gap: 10px; }
            }
          </style>
        </head>
        <body>
          <h1>${escapeHtmlText(title)}</h1>
          <div class="meta">Generated ${escapeHtmlText(dateLabel)} | ${escapeHtmlText(accountFilter)} | ${escapeHtmlText(bankFilterLabel)} | ${escapeHtmlText(periodLabel)}</div>
          <div class="summary">
            <div class="summary-card">
              <p>Total Receipts</p>
              <strong>${escapeHtmlText(formatMoney(totals.totalReceipts))}</strong>
            </div>
            <div class="summary-card">
              <p>Total Payments</p>
              <strong>${escapeHtmlText(formatMoney(totals.totalPayments))}</strong>
            </div>
            <div class="summary-card">
              <p>Running Balance</p>
              <strong>${escapeHtmlText(formatMoney(totals.runningBalance))}</strong>
            </div>
          </div>
          <div class="bank-list">
            <h3>Bank Balances</h3>
            ${bankBalancesHtml}
          </div>
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Account</th>
                <th>Category</th>
                <th>Description</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }, [bankAccounts, filters, filteredEntries, totals]);

  const exportLedger = useCallback(() => {
    if (filteredEntries.length === 0) {
      setToast({ message: 'There are no ledger rows to export for the selected filters.', type: 'warning' });
      return;
    }

    const lines = [
      ['Reference', 'Account', 'Category', 'Income Group', 'Expense Group', 'Description', 'Method', 'Amount', 'Date', 'Balance'].join(','),
      ...filteredEntries.map((entry) =>
        [
          `"${entry.reference}"`,
          `"${entry.accountLabel}"`,
          `"${entry.category}"`,
          `"${entry.incomeGroup || ''}"`,
          `"${entry.expenseGroup || ''}"`,
          `"${entry.description}"`,
          `"${entry.method}"`,
          entry.direction === 'credit' ? entry.amount : -entry.amount,
          `"${entry.entryDate}"`,
          entry.runningBalance,
        ].join(','),
      ),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `global_ledger_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, [filteredEntries]);


  const handleJournalEntry = useCallback(async () => {
    const account = bankAccounts.find((item) => item.id === journalFormData.account_id);
    if (!account) {
      setToast({ message: 'Select a bank, cash, or wallet account first.', type: 'warning' });
      return;
    }

    const debit = toNumber(journalFormData.debit);
    const credit = toNumber(journalFormData.credit);
    if ((debit > 0 && credit > 0) || (debit <= 0 && credit <= 0)) {
      setToast({ message: 'Enter either a debit or a credit amount, not both.', type: 'warning' });
      return;
    }

    const details = journalFormData.details.trim();
    if (!details) {
      setToast({ message: 'Add the journal narrative before saving.', type: 'warning' });
      return;
    }

    const amount = credit > 0 ? credit : debit;
    const direction: LedgerDirection = credit > 0 ? 'credit' : 'debit';
    const companyId = account.company_id || editingJournal?.company_id || selectedBankCompanyId || (await resolveEffectiveCompanyId(profile));

    if (!companyId) {
      setToast({ message: 'Select a company before posting a journal entry.', type: 'warning' });
      return;
    }

    const reference = `JOURNAL-${Date.now().toString(36).toUpperCase()}`;
    const nextEffect = normalizeJournalEffect(direction, amount);

    setSavingJournal(true);
    try {
      const ledgerPayload = {
        company_id: companyId,
        account_id: account.id,
        account_type: normalizeAccountType(account.account_type),
        bank_name: account.bank_name,
        transaction_type: direction === 'credit' ? 'income' : 'expense',
        category: journalFormData.income_group || 'Journal Entry',
        income_group: journalFormData.income_group || null,
        amount,
        currency: account.currency || 'KES',
        description: details,
        reference_id: editingJournal?.reference_id || reference,
        source_module: 'journal',
        transaction_date: new Date().toISOString().slice(0, 10),
        created_by: profile?.id || null,
        payment_method: account.account_type || 'manual',
        notes: details,
      };

      if (editingJournal) {
        const originalAccount = accountById(editingJournal.account_id) || account;
        const originalAmount = toNumber(editingJournal.amount);
        const originalDirection: LedgerDirection = normalizeText(editingJournal.transaction_type) === 'income' ? 'credit' : 'debit';
        const originalEffect = normalizeJournalEffect(originalDirection, originalAmount);
        const sameAccount = originalAccount.id === account.id;
        const originalBalanceBefore = originalAccount.current_balance;
        const targetBalanceBefore = account.current_balance;
        const originalBalanceAfter = sameAccount ? targetBalanceBefore - originalEffect + nextEffect : originalBalanceBefore - originalEffect;
        const targetBalanceAfter = sameAccount ? originalBalanceAfter : targetBalanceBefore + nextEffect;

        if (sameAccount) {
          const balanceUpdate = await supabase.from('re_bank_accounts').update({ current_balance: targetBalanceAfter }).eq('id', account.id);
          if (balanceUpdate.error) throw balanceUpdate.error;
        } else {
          const sourceBalanceUpdate = await supabase
            .from('re_bank_accounts')
            .update({ current_balance: originalBalanceAfter })
            .eq('id', originalAccount.id);
          if (sourceBalanceUpdate.error) throw sourceBalanceUpdate.error;

          const targetBalanceUpdate = await supabase
            .from('re_bank_accounts')
            .update({ current_balance: targetBalanceAfter })
            .eq('id', account.id);
          if (targetBalanceUpdate.error) {
            await supabase.from('re_bank_accounts').update({ current_balance: originalBalanceBefore }).eq('id', originalAccount.id);
            throw targetBalanceUpdate.error;
          }
        }

        const { error: ledgerError } = await supabase
          .from('re_finance_ledger')
          .update({ ...ledgerPayload, balance_after: targetBalanceAfter })
          .eq('id', editingJournal.id);
        if (ledgerError) {
          if (sameAccount) {
            await supabase.from('re_bank_accounts').update({ current_balance: originalBalanceBefore }).eq('id', account.id);
          } else {
            await supabase.from('re_bank_accounts').update({ current_balance: originalBalanceBefore }).eq('id', originalAccount.id);
            await supabase.from('re_bank_accounts').update({ current_balance: targetBalanceBefore }).eq('id', account.id);
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

        const { error: ledgerError } = await supabase
          .from('re_finance_ledger')
          .insert([{ ...ledgerPayload, balance_after: nextBalance }]);
        if (ledgerError) {
          await supabase.from('re_bank_accounts').update({ current_balance: account.current_balance }).eq('id', account.id);
          throw ledgerError;
        }
      }

      setToast({ message: editingJournal ? 'Journal entry updated.' : 'Journal entry saved.', type: 'success' });
      clearJournalEditor();
      setShowJournalForm(false);
      await Promise.all([fetchBankAccounts(selectedBankCompanyId), fetchLedger()]);
    } catch (error: any) {
      console.error('Error saving journal entry:', error);
      setToast({ message: error.message || 'Failed to save journal entry.', type: 'error' });
    } finally {
      setSavingJournal(false);
    }
  }, [
    accountById,
    bankAccounts,
    clearJournalEditor,
    editingJournal,
    fetchBankAccounts,
    fetchLedger,
    journalFormData,
    normalizeJournalEffect,
    profile,
    selectedBankCompanyId,
  ]);

  const handleDeleteJournal = useCallback(
    async (entry: LedgerEntry) => {
      if (!entry.id.startsWith('ledger-')) {
        return;
      }

      const rawId = entry.id.replace(/^ledger-/, '');
      const rawRow = ledgerRows.find((row) => row.id === rawId);
      if (!rawRow) {
        setToast({ message: 'The selected journal entry could not be found.', type: 'warning' });
        return;
      }

      let account = accountById(rawRow.account_id);
      if (!account && rawRow.account_id) {
        const { data } = await supabase
          .from('re_bank_accounts')
          .select('id, company_id, bank_name, account_number, account_holder_name, account_type, currency, current_balance, is_active')
          .eq('id', rawRow.account_id)
          .maybeSingle();
        account = (data as BankAccount) || null;
      }
      if (!account && rawRow.company_id) {
        account =
          bankAccounts.find(
              (item) =>
                item.company_id === rawRow.company_id &&
                normalizeText(item.bank_name) === normalizeText(rawRow.bank_name) &&
              normalizeAccountType(item.account_type) === normalizeAccountType(rawRow.account_type),
          ) || null;
      }
      if (!account && rawRow.company_id && rawRow.bank_name) {
        const { data } = await supabase
          .from('re_bank_accounts')
          .select('id, company_id, bank_name, account_number, account_holder_name, account_type, currency, current_balance, is_active')
          .eq('company_id', rawRow.company_id)
          .ilike('bank_name', rawRow.bank_name)
          .maybeSingle();
        account = (data as BankAccount) || null;
      }
      if (!account) {
        setToast({ message: 'The linked account for this journal entry could not be found.', type: 'warning' });
        return;
      }

      const confirmed = window.confirm('Delete this journal entry and reverse its balance impact?');
      if (!confirmed) return;

      const amount = toNumber(rawRow.amount);
      const direction: LedgerDirection = normalizeText(rawRow.transaction_type) === 'income' ? 'credit' : 'debit';
      const effect = normalizeJournalEffect(direction, amount);
      const balanceBefore = account.current_balance;
      const balanceAfter = balanceBefore - effect;

      setSavingJournal(true);
      try {
        const balanceUpdate = await supabase.from('re_bank_accounts').update({ current_balance: balanceAfter }).eq('id', account.id);
        if (balanceUpdate.error) throw balanceUpdate.error;

        const { error } = await supabase.from('re_finance_ledger').delete().eq('id', rawRow.id);
        if (error) {
          await supabase.from('re_bank_accounts').update({ current_balance: balanceBefore }).eq('id', account.id);
          throw error;
        }

        if (editingJournal?.id === rawRow.id) {
          clearJournalEditor();
        }
        setToast({ message: 'Journal entry deleted.', type: 'success' });
        await Promise.all([fetchBankAccounts(selectedBankCompanyId), fetchLedger()]);
      } catch (error: any) {
        console.error('Error deleting journal entry:', error);
        setToast({ message: error.message || 'Failed to delete journal entry.', type: 'error' });
      } finally {
        setSavingJournal(false);
      }
    },
    [accountById, clearJournalEditor, editingJournal?.id, fetchBankAccounts, fetchLedger, ledgerRows, normalizeJournalEffect, selectedBankCompanyId],
  );

  const handlePrintJournal = useCallback((entry: LedgerEntry) => {
    const rawRow = ledgerRows.find((row) => `ledger-${row.id}` === entry.id);
    if (!rawRow) return;

    printDocument({
      title: `Journal ${rawRow.reference_id || rawRow.id}`,
      subtitle: `${formatDateLabel(rawRow.transaction_date || rawRow.created_at)} · ${entry.direction === 'credit' ? 'Credit' : 'Debit'} account`,
      bodyHtml: `
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;">
          ${[
            ['Reference', rawRow.reference_id || 'JOURNAL'],
            ['Date', formatDateLabel(rawRow.transaction_date || rawRow.created_at)],
            ['Account', rawRow.bank_name || rawRow.category || 'Journal Account'],
            ['Side', entry.direction === 'credit' ? 'Credit account' : 'Debit account'],
            ['Category', rawRow.category || '-'],
            ['Income Group', rawRow.income_group || '-'],
            ['Amount', formatMoney(toNumber(rawRow.amount), rawRow.currency || 'KES')],
            ['Balance After', rawRow.balance_after != null ? formatMoney(toNumber(rawRow.balance_after), rawRow.currency || 'KES') : '-'],
          ]
            .map(
              ([label, value]) => `
                <div style="border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px;">
                  <div style="font-size:11px;text-transform:uppercase;letter-spacing:.18em;color:#64748b;font-weight:700;">${escapeHtmlText(label)}</div>
                  <div style="margin-top:6px;font-size:15px;font-weight:700;color:#0f172a;">${escapeHtmlText(String(value))}</div>
                </div>
              `,
            )
            .join('')}
        </div>
        <div style="margin-top:16px;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.18em;color:#64748b;font-weight:700;">Narrative</div>
          <div style="margin-top:6px;font-size:14px;line-height:1.6;color:#0f172a;">${escapeHtmlText(rawRow.description || rawRow.notes || 'No narrative available')}</div>
        </div>
      `,
    });
  }, [ledgerRows]);
  const handleAddBankAccount = useCallback(async () => {
    if (!bankFormData.bank_name.trim() || !bankFormData.account_number.trim() || !bankFormData.account_holder_name.trim()) {
      setToast({ message: 'Bank name, account number, and account holder are required.', type: 'warning' });
      return;
    }

    const companyId = bankFormData.company_id || (await resolveEffectiveCompanyId(profile));
    if (!companyId) {
      setToast({ message: 'Select the company this bank account belongs to before saving.', type: 'warning' });
      return;
    }

    try {
      const basePayload = {
        company_id: companyId,
        bank_name: bankFormData.bank_name.trim(),
        account_number: bankFormData.account_number.trim(),
        account_holder_name: bankFormData.account_holder_name.trim(),
        account_type: bankFormData.account_type,
        current_balance: toNumber(bankFormData.current_balance),
      };

      let insertResult = await supabase.from('re_bank_accounts').insert([
        {
          ...basePayload,
          module: bankFormData.module.trim() || null,
          entity: bankFormData.entity.trim() || null,
        },
      ]);

      if (insertResult.error && isMissingBankAccountMetaColumn(insertResult.error)) {
        insertResult = await supabase.from('re_bank_accounts').insert([basePayload]);
      }

      if (insertResult.error) throw insertResult.error;

      setBankFormData({
        company_id: companyId,
        bank_name: '',
        account_number: '',
        account_holder_name: '',
        account_type: 'checking',
        current_balance: '0',
        module: 'finance',
        entity: '',
      });
      setSelectedBankCompanyId(companyId);
      setShowBankForm(false);
      setToast({ message: 'Bank account added successfully.', type: 'success' });
      await fetchBankAccounts(companyId);
    } catch (error: any) {
      console.error('Error adding bank account:', error);
      setToast({ message: error.message || 'Failed to add bank account.', type: 'error' });
    }
  }, [bankFormData, profile, setToast, fetchBankAccounts]);

  const handleDeleteBankAccount = useCallback(async (id: string) => {
    const confirmed = window.confirm('Delete this bank account from the register?');
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('re_bank_accounts').delete().eq('id', id);
      if (error) throw error;
      setToast({ message: 'Bank account removed successfully.', type: 'success' });
      await fetchBankAccounts(selectedBankCompanyId || bankFormData.company_id || undefined);
    } catch (error: any) {
      console.error('Error deleting bank account:', error);
      setToast({ message: error.message || 'Failed to delete bank account.', type: 'error' });
    }
  }, [bankFormData.company_id, selectedBankCompanyId]);

  const openBankReferenceOptionForm = useCallback((type: BankReferenceOption['option_type']) => {
    setShowBankReferenceOptionForm(type);
    setBankReferenceOptionValue('');
  }, []);

  const createCompany = useCallback(async () => {
    const name = companyFormData.name.trim();
    const code = companyFormData.code.trim().toUpperCase();

    if (!name || !code) {
      setToast({ message: 'Company name and company code are required.', type: 'warning' });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('companies')
        .insert([
          {
            name,
            code,
            organization_id: profile?.organization_id || null,
          },
        ])
        .select('id, name, code, organization_id')
        .single();

      if (error) throw error;

      const createdCompany = data as CompanyOption;
      setSelectedBankCompanyId(createdCompany.id);
      setBankFormData((current) => ({ ...current, company_id: createdCompany.id }));
      setCompanyFormData({ name: '', code: '' });
      setShowCompanyForm(false);
      await fetchCompanies();
      setToast({ message: 'Company added successfully.', type: 'success' });
    } catch (error: any) {
      console.error('Error creating company:', error);
      setToast({ message: error.message || 'Failed to add company.', type: 'error' });
    }
  }, [profile, setToast, fetchCompanies]);

  const createBankReferenceOption = useCallback(async () => {
    const companyId = bankFormData.company_id || (await resolveEffectiveCompanyId(profile));
    if (!companyId || !showBankReferenceOptionForm) {
      setToast({ message: 'Choose the company first so the new option is saved in the right dropdown.', type: 'warning' });
      return;
    }

    const optionValue = bankReferenceOptionValue.trim();
    if (!optionValue) {
      setToast({ message: `Enter a ${showBankReferenceOptionForm} value first.`, type: 'warning' });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('finance_bank_account_reference_options')
        .insert([
          {
            company_id: companyId,
            option_type: showBankReferenceOptionForm,
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
            normalizeText(option.option_value) === normalizeText(created.option_value),
        );
        return exists ? current : [...current, created].sort((left, right) => left.option_value.localeCompare(right.option_value));
      });

      setBankFormData((current) => {
        if (created.option_type === 'module') return { ...current, module: created.option_value };
        if (created.option_type === 'entity') return { ...current, entity: created.option_value };
        if (created.option_type === 'bank_name') return { ...current, bank_name: created.option_value };
        return { ...current, account_number: created.option_value };
      });

      setToast({ message: bankReferenceOptionMeta[created.option_type].successMessage, type: 'success' });
      setShowBankReferenceOptionForm(null);
      setBankReferenceOptionValue('');
    } catch (error: any) {
      console.error('Error creating bank account reference option:', error);
      setToast({ message: error.message || 'Failed to save option.', type: 'error' });
    }
  }, [bankFormData, profile, bankReferenceOptionValue, showBankReferenceOptionForm, setToast]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <CustomLoader size={40} label="Loading master ledger..." />
      </div>
    );
  }

  return (
    <div className="min-h-full w-full space-y-8 bg-white p-6 text-gray-900 dark:bg-dark-bg dark:text-white lg:p-10">
      <div className="flex flex-col gap-6 border-b border-gray-200 pb-8 dark:border-dark-border md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <BookOpen className="text-brand-purple" aria-hidden="true" /> Global Transaction Ledger
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-text">
            Combined balances across bank, cash, and M-Pesa accounts with filterable finance activity.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={handlePrint} className={actionButtonCls}>
            <Printer size={16} />
            Print
          </button>
          <button type="button" onClick={exportLedger} className={actionButtonCls}>
            <Download size={16} />
            Export
          </button>
          <button type="button" onClick={() => window.location.assign('/app/finance/bank-accounts')} className={actionButtonCls}>
            <Landmark size={16} />
            Bank Accounts
          </button>
          <button type="button" onClick={() => setShowJournalForm((current) => !current)} className={actionButtonCls}>
            <Plus size={16} />
            Journal Entry
          </button>
          <button type="button" onClick={() => setShowCompanyForm((current) => !current)} className={actionButtonCls}>
            <Plus size={16} />
            New Company
          </button>
          <button type="button" onClick={() => setShowBankForm((current) => !current)} className={primaryButtonCls}>
            <Plus size={16} />
            Add Bank Account
          </button>
        </div>
      </div>

      {organizationNotice ? (
        <div className="rounded-[20px] border border-amber-200 bg-amber-50/90 px-5 py-4 text-sm text-amber-900 shadow-sm dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
          {organizationNotice}
        </div>
      ) : null}

      {dataNotice ? (
        <div className="rounded-[20px] border border-[#ff6a00]/20 bg-[#fff3eb] px-5 py-4 text-sm text-[#9a3f00] shadow-sm dark:border-[#ff6a00]/25 dark:bg-[#ff6a00]/10 dark:text-[#ffd3b5]">
          {dataNotice}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className={panelCls}>
          <p className={labelCls}>Total Receipts</p>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{formatMoney(totals.totalReceipts)}</p>
        </div>
        <div className={panelCls}>
          <p className={labelCls}>Total Payments</p>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{formatMoney(totals.totalPayments)}</p>
        </div>
        <div className={panelCls}>
          <p className={labelCls}>Running Balance</p>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{formatMoney(totals.runningBalance)}</p>
        </div>
      </div>

      <div className={`${panelCls} space-y-4`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative flex-1 xl:max-w-lg">
            <label htmlFor="ledger-search" className="sr-only">
              Search transactions
            </label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} aria-hidden="true" />
            <input
              id="ledger-search"
              type="text"
              placeholder="Search by reference, account, description, entity, or method..."
              title="Search transactions"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className={`${inputCls} pl-10`}
            />
          </div>
          <button type="button" onClick={resetFilters} className={actionButtonCls}>
            Clear Filters
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className={labelCls}>Account Type</label>
            <select value={filters.accountType} onChange={(event) => setFilter('accountType', event.target.value as LedgerFilters['accountType'])} className={inputCls}>
              <option value="all">All account types</option>
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
              <option value="mpesa">M-Pesa</option>
              <option value="general">General</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Bank Name</label>
            <select value={filters.bankName} onChange={(event) => setFilter('bankName', event.target.value)} className={inputCls}>
              <option value="">All banks</option>
              {bankNameOptions.map((bankName) => (
                <option key={bankName} value={bankName}>
                  {bankName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Account</label>
            <select value={filters.bankAccountId} onChange={(event) => setFilter('bankAccountId', event.target.value)} className={inputCls}>
              <option value="">All accounts</option>
              {bankAccountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Expense Group</label>
            <select value={filters.expenseGroup} onChange={(event) => setFilter('expenseGroup', event.target.value)} className={inputCls}>
              <option value="">All expense groups</option>
              {expenseGroupOptions.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Income Group</label>
            <select value={filters.incomeGroup} onChange={(event) => setFilter('incomeGroup', event.target.value)} className={inputCls}>
              <option value="">All income groups</option>
              {incomeGroupOptions.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Month</label>
            <select value={filters.month} onChange={(event) => setFilter('month', event.target.value)} className={inputCls}>
              <option value="">All months</option>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <option key={month} value={`${month}`}>
                  {new Date(2026, month - 1, 1).toLocaleString(undefined, { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Year</label>
            <select value={filters.year} onChange={(event) => setFilter('year', event.target.value)} className={inputCls}>
              <option value="">All years</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Start Date</label>
            <input type="date" value={filters.startDate} onChange={(event) => setFilter('startDate', event.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>End Date</label>
            <input type="date" value={filters.endDate} onChange={(event) => setFilter('endDate', event.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

      <div className={`${panelCls} space-y-4`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="w-full md:max-w-md">
            <label className={labelCls}>Bank Register Company</label>
            <select
              value={selectedBankCompanyId}
              onChange={(event) => {
                const nextCompanyId = event.target.value;
                setSelectedBankCompanyId(nextCompanyId);
                setBankFormData((current) => ({
                  ...current,
                  company_id: nextCompanyId === 'all' ? current.company_id : nextCompanyId,
                  bank_name: '',
                  account_number: '',
                }));
              }}
              className={inputCls}
            >
              <option value="">Select company to view bank accounts</option>
              <option value="all">All companies</option>
              {companyOptions.map((company) => (
                <option key={company.value} value={company.value}>
                  {company.label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Bank accounts for the selected company, or all companies, will appear below and in the bank-account filter list.
          </p>
        </div>
      </div>

      {showJournalForm ? (
        <div ref={journalFormRef} className={`${panelCls} space-y-4`}>
          <div>
            <p className={labelCls}>Ledger Journals</p>
            <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-white">
              {editingJournal ? 'Edit Journal Entry' : 'Add Journal Entry'}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {editingJournal
                ? `Updating ${editingJournal.reference_id || 'this journal entry'}`
                : 'Use this to directly add, reduce, adjust, or transfer money between bank, cash, and wallet accounts.'}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="md:col-span-2">
              <label className={labelCls}>Account</label>
              <select
                value={journalFormData.account_id}
                onChange={(event) => setJournalFormData((current) => ({ ...current, account_id: event.target.value }))}
                className={inputCls}
              >
                <option value="">Select bank, cash, or wallet account</option>
                {journalAccountOptions.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Income Group</label>
              <select
                value={journalFormData.income_group}
                onChange={(event) => setJournalFormData((current) => ({ ...current, income_group: event.target.value }))}
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
                value={journalFormData.debit}
                onChange={(event) =>
                  setJournalFormData((current) => ({
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
                value={journalFormData.credit}
                onChange={(event) =>
                  setJournalFormData((current) => ({
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
                value={journalFormData.details}
                onChange={(event) => setJournalFormData((current) => ({ ...current, details: event.target.value }))}
                className={`${inputCls} min-h-[120px]`}
                placeholder="Narrate the reason for the adjustment or transfer"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={handleJournalEntry} className={primaryButtonCls} disabled={savingJournal}>
              <Plus size={16} />
              {editingJournal ? 'Update Journal Entry' : 'Save Journal Entry'}
            </button>
            <button
              type="button"
              onClick={() => {
                clearJournalEditor();
                setShowJournalForm(false);
              }}
              className={actionButtonCls}
            >
              {editingJournal ? 'Cancel Edit' : 'Cancel'}
            </button>
          </div>
        </div>
      ) : null}
      {showCompanyForm ? (
        <div ref={companyFormRef} className={`${panelCls} space-y-4`}>
          <div>
            <p className={labelCls}>Company Register</p>
            <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-white">Add New Company</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Save a company once and it will appear in the company dropdown for bank account setup right away.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>Company Name</label>
              <input
                value={companyFormData.name}
                onChange={(event) => setCompanyFormData((current) => ({ ...current, name: event.target.value }))}
                className={inputCls}
                placeholder="Hakika app"
              />
            </div>
            <div>
              <label className={labelCls}>Company Code</label>
              <input
                value={companyFormData.code}
                onChange={(event) => setCompanyFormData((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                className={inputCls}
                placeholder="OMG-001"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={createCompany} className={primaryButtonCls}>
              <Plus size={16} />
              Save Company
            </button>
            <button type="button" onClick={() => setShowCompanyForm(false)} className={actionButtonCls}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {showBankForm ? (
        <div ref={bankFormRef} className={`${panelCls} space-y-4`}>
          <div>
            <p className={labelCls}>Bank Register</p>
            <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-white">Add Another Bank Account</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Use this when one entity has multiple accounts under the same bank. Each account number is stored separately.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className={labelCls}>Company</label>
              <div className="flex gap-2">
                <select
                  value={bankFormData.company_id}
                  onChange={(event) => {
                    const nextCompanyId = event.target.value;
                    setBankFormData((current) => ({
                      ...current,
                      company_id: nextCompanyId,
                      bank_name: '',
                      account_number: '',
                    }));
                    setSelectedBankCompanyId(nextCompanyId);
                  }}
                  className={inputCls}
                >
                  <option value="">Select company</option>
                  {companyOptions.map((company) => (
                    <option key={company.value} value={company.value}>
                      {company.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowCompanyForm(true)}
                  className={iconActionButtonCls}
                  title="Add new company"
                  aria-label="Add new company"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Bank Name</label>
              <div className="flex gap-2">
                <select
                  value={bankFormData.bank_name}
                  onChange={(event) =>
                    setBankFormData((current) => ({
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
                  onClick={() => openBankReferenceOptionForm('bank_name')}
                  className={iconActionButtonCls}
                  title="Add new bank name"
                  aria-label="Add new bank name"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Account Number</label>
              <div className="flex gap-2">
                <select
                  value={bankFormData.account_number}
                  onChange={(event) => setBankFormData((current) => ({ ...current, account_number: event.target.value }))}
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
                  onClick={() => openBankReferenceOptionForm('account_number')}
                  className={iconActionButtonCls}
                  title="Add new account number"
                  aria-label="Add new account number"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Account Holder</label>
              <input value={bankFormData.account_holder_name} onChange={(event) => setBankFormData((current) => ({ ...current, account_holder_name: event.target.value }))} className={inputCls} placeholder="Hakika HQ, Toughforce..." />
            </div>
            <div>
              <label className={labelCls}>Account Type</label>
              <select value={bankFormData.account_type} onChange={(event) => setBankFormData((current) => ({ ...current, account_type: event.target.value }))} className={inputCls}>
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="business">Business</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Current Balance</label>
              <input type="number" min="0" step="0.01" value={bankFormData.current_balance} onChange={(event) => setBankFormData((current) => ({ ...current, current_balance: event.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Module</label>
              <div className="flex gap-2">
                <select value={bankFormData.module} onChange={(event) => setBankFormData((current) => ({ ...current, module: event.target.value }))} className={inputCls}>
                  <option value="">Select module</option>
                  {moduleOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => openBankReferenceOptionForm('module')}
                  className={iconActionButtonCls}
                  title="Add new module"
                  aria-label="Add new module"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
            <div className="md:col-span-2 xl:col-span-3">
              <label className={labelCls}>Entity</label>
              <div className="flex gap-2">
                <select value={bankFormData.entity} onChange={(event) => setBankFormData((current) => ({ ...current, entity: event.target.value }))} className={inputCls}>
                  <option value="">Select entity</option>
                  {entityOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => openBankReferenceOptionForm('entity')}
                  className={iconActionButtonCls}
                  title="Add new entity"
                  aria-label="Add new entity"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={handleAddBankAccount} className={primaryButtonCls}>
              Save Account
            </button>
            <button type="button" onClick={() => setShowBankForm(false)} className={actionButtonCls}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {bankAccounts.map((account) => (
          <div key={account.id} className={panelCls}>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Landmark size={16} className="text-[#ff6a00]" />
                  <p className="text-sm font-black text-slate-900 dark:text-white">{account.bank_name}</p>
                </div>
                <p className="text-xs font-semibold tracking-[0.16em] text-slate-500 dark:text-slate-400">{account.account_number}</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">{account.account_holder_name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {account.module || 'finance'}{account.entity ? ` ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ ${account.entity}` : ''}
                </p>
              </div>
              <button type="button" onClick={() => handleDeleteBankAccount(account.id)} className="text-rose-500 transition hover:text-rose-600">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="mt-4 border-t border-gray-200 pt-4 dark:border-white/10">
              <p className={labelCls}>Current Balance</p>
              <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                {formatMoney(toNumber(account.current_balance), account.currency || 'KES')}
              </p>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {account.account_type} ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ {account.is_active ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>
        ))}

        {bankAccounts.length === 0 ? (
          <div className={`${panelCls} md:col-span-2 xl:col-span-3`}>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No bank accounts have been added here yet. Use the add button to register multiple accounts for the same bank and entity.
            </p>
          </div>
        ) : null}
      </div>

      <div className="glass-card overflow-hidden rounded-[28px] border border-gray-200 dark:border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:border-white/5 dark:bg-white/5">
                <th className="px-6 py-4">Reference</th>
                <th className="px-6 py-4">Account</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Groups</th>
                <th className="px-6 py-4">Method</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Balance</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {filteredEntries.map((entry) => (
                <tr
                  key={entry.id}
                  className={`text-gray-900 transition-colors hover:bg-slate-50/90 dark:text-white dark:hover:bg-[rgba(18,73,96,0.88)] ${
                    editingJournal && entry.id === `ledger-${editingJournal.id}` ? 'bg-amber-50/70 dark:bg-amber-400/10' : ''
                  }`}
                >
                  <td className="px-6 py-4 font-mono text-[10px] font-bold text-brand-purple">{entry.reference}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-slate-300">
                        <Building2 size={13} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{entry.accountLabel}</p>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{entry.accountType}</p>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                          {entry.direction === 'credit' ? 'Credit account' : 'Debit account'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <p className="font-bold text-slate-700 dark:text-slate-100">{entry.category}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      {entry.counterparty}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-300">
                    <p>{entry.description}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{entry.affectedEntity}</p>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{entry.incomeGroup || '-'}</p>
                    <p className="mt-1 text-slate-500 dark:text-slate-400">{entry.expenseGroup || '-'}</p>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500 dark:text-dark-text-muted">{entry.method}</td>
                  <td className={`px-6 py-4 text-xs font-black ${entry.direction === 'credit' ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
                    <span className="inline-flex items-center gap-1">
                      {entry.direction === 'credit' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      {entry.direction === 'credit' ? '+' : '-'}
                      {formatMoney(entry.amount, entry.currency)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[10px] text-gray-400 dark:text-slate-400">{formatDateLabel(entry.entryDate)}</td>
                  <td className="px-6 py-4 text-xs font-black text-slate-900 dark:text-white">{formatMoney(entry.runningBalance, entry.currency)}</td>
                  <td className="px-6 py-4">
                    {entry.source === 'ledger' ? (
                      <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handlePrintJournal(entry)}
                            className={actionButtonCls}
                            disabled={savingJournal}
                          >
                            <Printer size={14} />
                            Print
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const rawRow = ledgerRows.find((row) => `ledger-${row.id}` === entry.id);
                              if (rawRow) {
                                populateJournalFromRow(rawRow);
                                setShowJournalForm(true);
                            }
                          }}
                          className={actionButtonCls}
                          disabled={savingJournal}
                        >
                          <PencilLine size={14} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteJournal(entry)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200 dark:hover:bg-rose-400/20"
                          disabled={savingJournal}
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-300">
                    No ledger entries found for the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {showBankReferenceOptionForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[32px] border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#071b27]">
            <div className="border-b border-gray-200 bg-gradient-to-r from-[#fff3eb] via-white to-[#fff9f4] px-6 py-5 dark:border-white/10 dark:from-[#0b2a3c] dark:via-[#082131] dark:to-[#071b27]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Bank Setup</p>
                  <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">
                    Add New {showBankReferenceOptionForm ? bankReferenceOptionMeta[showBankReferenceOptionForm].label : 'Option'}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    This will be saved to the database and appear in the dropdown immediately.
                  </p>
                </div>
                <button type="button" onClick={() => setShowBankReferenceOptionForm(null)} className={actionButtonCls}>
                  Close
                </button>
              </div>
            </div>

            <div className="p-6">
              <label className={labelCls}>
                {showBankReferenceOptionForm ? bankReferenceOptionMeta[showBankReferenceOptionForm].label : 'Option'}
              </label>
              <input
                value={bankReferenceOptionValue}
                onChange={(event) => setBankReferenceOptionValue(event.target.value)}
                className={inputCls}
                placeholder={showBankReferenceOptionForm ? bankReferenceOptionMeta[showBankReferenceOptionForm].placeholder : 'Enter value'}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3 px-6 pb-6">
              <button type="button" onClick={createBankReferenceOption} className={primaryButtonCls}>
                <Plus size={16} />
                Save {showBankReferenceOptionForm ? bankReferenceOptionMeta[showBankReferenceOptionForm].label : 'Option'}
              </button>
              <button type="button" onClick={() => setBankReferenceOptionValue('')} className={actionButtonCls}>
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

export default GlobalLedger;
