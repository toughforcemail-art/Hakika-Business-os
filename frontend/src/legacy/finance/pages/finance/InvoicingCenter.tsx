// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Calendar,
  CheckCircle2,
  CreditCard,
  FileSpreadsheet,
  Mail,
  Edit3,
  Phone,
  Plus,
  Printer,
  Receipt,
  RefreshCcw,
  Search,
  Send,
  Trash2,
  Upload,
  UserRound,
  Wallet,
  X,
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../hooks/useAccess';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import ThemedConfirmDialog from '../../components/security/ThemedConfirmDialog';
import { sendBulkSms } from '../../services/SMSService';
import { sendEmail } from '../../services/emailService';
import financeDepositAccountsService, { type FinanceDepositAccount, type FinanceDepositAccountKind } from '../../services/financeDepositAccountsService';
import { generateInvoiceNumber } from '../../utils/invoiceNumbers';
import { escapeHtml, printDocument, printWorkspacePage } from '../../utils/printHelpers';

type HubTab = 'customers' | 'invoices' | 'receipts';

interface FinanceCustomer {
  id: string;
  organization_id: string;
  account_number: string;
  customer_name: string;
  service_group: string | null;
  ledger_name: string | null;
  email: string | null;
  phone: string | null;
  contact_person: string | null;
  opening_balance: number;
  billing_address: string | null;
  notes: string | null;
  is_active: boolean;
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

interface FinanceCustomerGroup {
  id: string;
  organization_id: string;
  name: string;
  created_at: string;
}

interface FinanceLandlordImportCandidate {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  login_username?: string | null;
  property?: { name?: string | null } | null;
}

type BankAccount = FinanceDepositAccount;

interface FinanceReferenceOption {
  id: string;
  company_id: string;
  option_type: 'entity' | 'receivable_account';
  option_value: string;
  created_at?: string;
}

interface FinancePaymentReferenceOption {
  id: string;
  organization_id: string;
  option_type: 'cost_center' | 'pay_from_account' | 'payment_method';
  option_value: string;
  created_at?: string;
}

interface FinanceInvoice {
  id: string;
  organization_id: string;
  customer_id: string | null;
  invoice_number: string;
  invoice_no?: string | null;
  customer_name?: string | null;
  entity?: string | null;
  transaction_class: string;
  accounts_receivable_account: string | null;
  description: string | null;
  invoice_date: string;
  due_date: string | null;
  currency: string;
  etims_enabled: boolean;
  recurring_enabled: boolean;
  recurring_frequency: string | null;
  tax_rate: number;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  status: string;
  bill_to: string | null;
  notes: string | null;
  is_recurring_template?: boolean;
  recurring_template_id?: string | null;
  next_generation_date?: string | null;
  created_at: string;
  updated_at: string;
}

interface FinanceInvoiceItem {
  id: string;
  invoice_id: string;
  expense_item: string;
  description?: string | null;
  particulars: string | null;
  income_account: string | null;
  unit_cost: number;
  quantity: number;
  line_total: number;
  display_order?: number | null;
  created_at: string;
}

interface FinanceExpenseItemTemplate {
  id: string;
  organization_id: string;
  name: string;
  default_particulars: string | null;
  default_income_account: string | null;
  default_unit_cost: number;
  default_quantity: number;
  is_recurring: boolean;
  created_at: string;
}

interface FinanceReceipt {
  id: string;
  organization_id: string;
  receipt_number: string | null;
  receipt_date: string;
  source_module: string;
  amount: number;
  description: string | null;
  category: string | null;
  payment_method: string | null;
  customer_id: string | null;
  invoice_id: string | null;
  deposit_account_id: string | null;
  deposit_account_type?: string | null;
  currency: string | null;
  cheque_number: string | null;
  received_from: string | null;
  notes: string | null;
  created_at: string;
}

interface CustomerFormState {
  account_number: string;
  customer_name: string;
  service_group: string;
  ledger_name: string;
  email: string;
  phone: string;
  contact_person: string;
  opening_balance: string;
  billing_address: string;
  notes: string;
}

interface InvoiceItemDraft {
  row_id: string;
  expense_item: string;
  description: string;
  particulars: string;
  income_account: string;
  unit_cost: string;
  quantity: string;
}

interface InvoiceFormState {
  customer_id: string;
  entity: string;
  invoice_number: string;
  transaction_class: string;
  accounts_receivable_account: string;
  description: string;
  invoice_date: string;
  due_date: string;
  currency: string;
  etims_enabled: boolean;
  recurring_enabled: boolean;
  recurring_frequency: string;
  tax_rate: string;
  bill_to: string;
  notes: string;
  status: string;
  items: InvoiceItemDraft[];
}

interface ReceiptFormState {
  receipt_number: string;
  receipt_date: string;
  customer_id: string;
  invoice_id: string;
  amount: string;
  payment_method: string;
  deposit_account_id: string;
  currency: string;
  cheque_number: string;
  received_from: string;
  notes: string;
}

interface InvoiceFilters {
  search: string;
  customerId: string;
  transactionClass: string;
  dateFrom: string;
  dateTo: string;
  recurringOnly: boolean;
}

interface ExpenseTemplateFormState {
  name: string;
  default_particulars: string;
  default_income_account: string;
  default_unit_cost: string;
  default_quantity: string;
  is_recurring: boolean;
}

interface CustomerRollup {
  totalInvoices: number;
  clearedInvoices: number;
  pendingInvoices: number;
  accountBalance: number;
  amountOverdue: number;
}

const SERVICE_GROUP_OPTIONS = [
  'Security Services',
  'Guarding',
  'Alarm Response',
  'Property Management',
  'Maintenance',
  'Cleaning',
  'Consultancy',
];

const TRANSACTION_CLASS_OPTIONS = [
  'Security Services',
  'Guarding',
  'Alarm Response',
  'Escort Services',
  'Property Management',
  'Maintenance',
  'Utilities',
  'Consultancy',
];
const DEFAULT_TRANSACTION_CLASS = TRANSACTION_CLASS_OPTIONS[0];

const DEFAULT_RECEIVABLE_ACCOUNT = 'ABSA';
const DEFAULT_RECEIVABLE_ACCOUNT_OPTIONS = [
  DEFAULT_RECEIVABLE_ACCOUNT,
  'Accounts Receivable - Trade',
  'Accounts Receivable - Security',
  'Accounts Receivable - Property',
  'Accounts Receivable - Projects',
  'Bank Transfer',
  'Cash',
  'M-Pesa',
  'Cheque',
  'Card',
];

const PAYMENT_METHOD_OPTIONS = ['Cash', 'M-Pesa', 'Bank Transfer', 'Cheque', 'Card'];
const CURRENCY_OPTIONS = ['KES', 'USD', 'EUR', 'GBP'];
const RECURRING_OPTIONS = ['monthly', 'quarterly', 'yearly'];
const DEFAULT_EXPENSE_TEMPLATE_SEED = [
  {
    name: 'CCTV Installation',
    default_particulars: 'CCTV installation, setup, and support services',
    default_income_account: DEFAULT_RECEIVABLE_ACCOUNT,
    default_unit_cost: 0,
    default_quantity: 1,
    is_recurring: true,
  },
  {
    name: 'Office Rent',
    default_particulars: 'Monthly office rental charge',
    default_income_account: DEFAULT_RECEIVABLE_ACCOUNT,
    default_unit_cost: 0,
    default_quantity: 1,
    is_recurring: true,
  },
  {
    name: 'Guards',
    default_particulars: 'Guarding services for the billing period',
    default_income_account: DEFAULT_RECEIVABLE_ACCOUNT,
    default_unit_cost: 0,
    default_quantity: 1,
    is_recurring: true,
  },
  {
    name: 'Bouncers',
    default_particulars: 'Bouncer deployment and event support',
    default_income_account: DEFAULT_RECEIVABLE_ACCOUNT,
    default_unit_cost: 0,
    default_quantity: 1,
    is_recurring: true,
  },
];

const panelCls = 'rounded-[28px] border border-gray-200 bg-white/95 p-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur-sm dark:border-white/10 dark:bg-dark-surface/90';
const inputCls = 'w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-purple/40 focus:bg-white focus:ring-4 focus:ring-brand-purple/10 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-brand-purple/40 dark:focus:bg-white/10';
const mutedButtonCls = 'inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-purple/30 hover:text-brand-purple dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:border-brand-purple/40 dark:hover:bg-white/[0.06]';
const primaryButtonCls = 'inline-flex items-center gap-2 rounded-2xl bg-brand-purple px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-purple/90 disabled:cursor-not-allowed disabled:opacity-60';
const normalizeText = (value?: string | null) => value?.trim().toLowerCase() || '';

const toMoney = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const todayIso = () => new Date().toISOString().split('T')[0];

const addDaysIso = (days: number) => {
  const next = new Date();
  next.setDate(next.getDate() + days);
  return next.toISOString().split('T')[0];
};

const parseIsoDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
};

const formatIsoDate = (value: Date) => value.toISOString().split('T')[0];

const addMonthsIso = (dateString: string, months: number) => {
  const original = parseIsoDate(dateString);
  const year = original.getUTCFullYear();
  const monthIndex = original.getUTCMonth();
  const day = original.getUTCDate();
  const targetMonth = new Date(Date.UTC(year, monthIndex + months, 1));
  const lastDayOfTargetMonth = new Date(Date.UTC(
    targetMonth.getUTCFullYear(),
    targetMonth.getUTCMonth() + 1,
    0,
  )).getUTCDate();

  targetMonth.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  return formatIsoDate(targetMonth);
};

const addRecurringIntervalIso = (dateString: string, frequency: string) => {
  if (!dateString) return '';

  switch (frequency) {
    case 'weekly':
      return formatIsoDate(new Date(parseIsoDate(dateString).getTime() + (7 * 24 * 60 * 60 * 1000)));
    case 'quarterly':
      return addMonthsIso(dateString, 3);
    case 'yearly':
      return addMonthsIso(dateString, 12);
    case 'monthly':
    default:
      return addMonthsIso(dateString, 1);
  }
};

const formatMoney = (value: number, currency = 'KES') =>
  `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatDateLabel = (value?: string | null) => {
  if (!value) return '-';

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const buildCustomerAccountNumber = () => `CUST-${Date.now().toString().slice(-6)}`;
const buildReceiptNumber = (date = todayIso()) => `RCP-${date.replaceAll('-', '')}-${Date.now().toString().slice(-5)}`;

const formatDepositAccountLabel = (
  account: Pick<
    FinanceDepositAccount,
    'account_kind' | 'bank_name' | 'account_number' | 'account_holder_name' | 'account_name' | 'business_name' | 'phone_number' | 'wallet_name' | 'wallet_provider' | 'wallet_identifier'
  >,
) => {
  if (account.account_kind === 'cash') {
    return account.account_name?.trim() || 'Cash Wallet';
  }

  if (account.account_kind === 'mpesa') {
    const parts = [account.business_name?.trim(), account.phone_number?.trim()].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : 'M-Pesa Wallet';
  }

  if (account.account_kind === 'general') {
    const parts = [account.wallet_name?.trim(), account.wallet_provider?.trim(), account.wallet_identifier?.trim()].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : 'Other Wallet';
  }

  const accountParts = [account.bank_name?.trim(), account.account_number?.trim(), account.account_holder_name?.trim()].filter(Boolean);
  return accountParts.length > 0 ? accountParts.join(' · ') : 'Bank Account';
};

const normalizeDepositAccountKind = (value?: string | null): FinanceDepositAccount['account_kind'] => {
  const normalized = value?.trim().toLowerCase() || '';
  if (normalized.includes('cash')) return 'cash';
  if (normalized.includes('mpesa') || normalized.includes('m-pesa') || normalized.includes('paybill')) return 'mpesa';
  if (normalized.includes('wallet') || normalized.includes('float') || normalized.includes('airtel')) return 'general';
  return 'bank';
};

const formatBankAccountLabel = formatDepositAccountLabel;

const resolveReceiptAccountId = (paymentMethod: string, accounts: FinanceDepositAccount[]) => {
  const expectedType = getDepositAccountKindForPaymentMethod(paymentMethod);

  return accounts.find((account) => account.account_kind === expectedType)?.id || accounts[0]?.id || '';
};

const buildReceiptDepositAccountSelection = (source: 'payment_method' | 'pay_from_account', value: string) => `${source}:${value}`;

const resolveReceiptDepositAccount = (selection: string, accounts: FinanceDepositAccount[]) => {
  const trimmedSelection = selection.trim();
  if (!trimmedSelection) return null;

  const directAccount = accounts.find((account) => account.id === trimmedSelection);
  if (directAccount) return directAccount;

  const [prefix, ...rest] = trimmedSelection.split(':');
  const rawValue = rest.join(':').trim();

  if (prefix === 'payment_method' && rawValue) {
    const expectedType = getDepositAccountKindForPaymentMethod(rawValue);
    return accounts.find((account) => account.account_kind === expectedType) || null;
  }

  if (prefix === 'pay_from_account' && rawValue) {
    const normalizedSelection = normalizeText(rawValue);
    return accounts.find((account) => {
      const labels = [
        formatBankAccountLabel(account),
        account.bank_name || '',
        account.account_name || '',
        account.business_name || '',
        account.account_number || '',
        account.phone_number || '',
      ]
        .filter(Boolean)
        .map((label) => normalizeText(label));
      return labels.includes(normalizedSelection);
    }) || null;
  }

  return null;
};

const getDepositAccountKindForPaymentMethod = (paymentMethod: string): FinanceDepositAccountKind => {
  const normalizedMethod = paymentMethod.trim().toLowerCase();
  if (normalizedMethod.includes('cash')) return 'cash';
  if (normalizedMethod.includes('mpesa') || normalizedMethod.includes('m-pesa') || normalizedMethod.includes('paybill')) return 'mpesa';
  return 'bank';
};

const updateDepositAccountBalance = async (account: FinanceDepositAccount, current_balance: number) => {
  if (account.account_kind === 'cash') {
    return supabase.from('re_cash_accounts').update({ current_balance }).eq('id', account.id);
  }

  if (account.account_kind === 'mpesa') {
    return supabase.from('re_mpesa_accounts').update({ current_balance }).eq('id', account.id);
  }

  if (account.account_kind === 'general') {
    return supabase.from('re_wallet_accounts').update({ current_balance }).eq('id', account.id);
  }

  return supabase.from('re_bank_accounts').update({ current_balance }).eq('id', account.id);
};

const createDraftItem = (overrides: Partial<InvoiceItemDraft> = {}): InvoiceItemDraft => ({
  row_id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  expense_item: '',
  description: '',
  particulars: '',
  income_account: DEFAULT_RECEIVABLE_ACCOUNT,
  unit_cost: '',
  quantity: '1',
  ...overrides,
});

const emptyCustomerForm = (): CustomerFormState => ({
  account_number: buildCustomerAccountNumber(),
  customer_name: '',
  service_group: SERVICE_GROUP_OPTIONS[0],
  ledger_name: '',
  email: '',
  phone: '',
  contact_person: '',
  opening_balance: '0',
  billing_address: '',
  notes: '',
});

const emptyInvoiceForm = (): InvoiceFormState => ({
  customer_id: '',
  entity: '',
  invoice_number: generateInvoiceNumber('FIN'),
  transaction_class: DEFAULT_TRANSACTION_CLASS,
  accounts_receivable_account: DEFAULT_RECEIVABLE_ACCOUNT,
  description: '',
  invoice_date: todayIso(),
  due_date: addDaysIso(14),
  currency: 'KES',
  etims_enabled: false,
  recurring_enabled: false,
  recurring_frequency: 'monthly',
  tax_rate: '16',
  bill_to: '',
  notes: '',
  status: 'sent',
  items: [createDraftItem()],
});

const emptyReceiptForm = (): ReceiptFormState => ({
  receipt_number: buildReceiptNumber(),
  receipt_date: todayIso(),
  customer_id: '',
  invoice_id: '',
  amount: '',
  payment_method: 'Cheque',
  deposit_account_id: '',
  currency: 'KES',
  cheque_number: '',
  received_from: '',
  notes: '',
});

const emptyInvoiceFilters = (): InvoiceFilters => ({
  search: '',
  customerId: 'all',
  transactionClass: 'all',
  dateFrom: '',
  dateTo: '',
  recurringOnly: false,
});

const emptyExpenseTemplateForm = (): ExpenseTemplateFormState => ({
  name: '',
  default_particulars: '',
  default_income_account: DEFAULT_RECEIVABLE_ACCOUNT,
  default_unit_cost: '',
  default_quantity: '1',
  is_recurring: true,
});

const normalizeExpenseTemplateName = (value: string) => value.trim().toLowerCase();
const normalizeTransactionClassName = (value: string) => value.trim().toLowerCase();
const normalizeReceivableAccountName = (value: string) => value.trim().toLowerCase();

const getExpenseTemplateCacheKey = (organizationId: string) => `finance_expense_items_${organizationId}`;
const getTransactionClassCacheKey = (organizationId: string) => `finance_transaction_classes_${organizationId || 'global'}`;
const getReceivableAccountCacheKey = (organizationId: string) => `finance_receivable_accounts_${organizationId || 'global'}`;

const readCachedExpenseTemplates = (organizationId: string): FinanceExpenseItemTemplate[] => {
  if (typeof window === 'undefined' || !organizationId) return [];

  try {
    const raw = window.localStorage.getItem(getExpenseTemplateCacheKey(organizationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeCachedExpenseTemplates = (organizationId: string, templates: FinanceExpenseItemTemplate[]) => {
  if (typeof window === 'undefined' || !organizationId) return;

  try {
    window.localStorage.setItem(getExpenseTemplateCacheKey(organizationId), JSON.stringify(templates));
  } catch {
    // Ignore browser storage failures so invoice entry is never blocked.
  }
};

const readCachedTransactionClasses = (organizationId: string) => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(getTransactionClassCacheKey(organizationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [];
  } catch {
    return [];
  }
};

const writeCachedTransactionClasses = (organizationId: string, transactionClasses: string[]) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(getTransactionClassCacheKey(organizationId), JSON.stringify(transactionClasses));
  } catch {
    // Ignore browser storage failures so invoice entry is never blocked.
  }
};

const readCachedReceivableAccounts = (organizationId: string) => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(getReceivableAccountCacheKey(organizationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [];
  } catch {
    return [];
  }
};

const writeCachedReceivableAccounts = (organizationId: string, accounts: string[]) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(getReceivableAccountCacheKey(organizationId), JSON.stringify(accounts));
  } catch {
    // Ignore browser storage failures so invoice entry is never blocked.
  }
};

const mergeTransactionClasses = (transactionClasses: string[]) => {
  const merged = new Map<string, string>();

  TRANSACTION_CLASS_OPTIONS.forEach((transactionClass) => {
    merged.set(normalizeTransactionClassName(transactionClass), transactionClass);
  });

  transactionClasses.forEach((transactionClass) => {
    const trimmed = transactionClass.trim();
    if (trimmed) {
      merged.set(normalizeTransactionClassName(trimmed), trimmed);
    }
  });

  return Array.from(merged.values()).sort((left, right) => {
    if (left === DEFAULT_TRANSACTION_CLASS) return -1;
    if (right === DEFAULT_TRANSACTION_CLASS) return 1;
    return left.localeCompare(right);
  });
};

const mergeReceivableAccounts = (accounts: string[]) => {
  const merged = new Map<string, string>();

  DEFAULT_RECEIVABLE_ACCOUNT_OPTIONS.forEach((account) => {
    merged.set(normalizeReceivableAccountName(account), account);
  });

  accounts.forEach((account) => {
    const trimmed = account.trim();
    if (trimmed) {
      merged.set(normalizeReceivableAccountName(trimmed), trimmed);
    }
  });

  return Array.from(merged.values()).sort((left, right) => {
    if (left === DEFAULT_RECEIVABLE_ACCOUNT) return -1;
    if (right === DEFAULT_RECEIVABLE_ACCOUNT) return 1;
    return left.localeCompare(right);
  });
};

const mergeExpenseTemplates = (
  organizationId: string,
  templates: FinanceExpenseItemTemplate[],
): FinanceExpenseItemTemplate[] => {
  const merged = new Map<string, FinanceExpenseItemTemplate>();

  DEFAULT_EXPENSE_TEMPLATE_SEED.forEach((template, index) => {
    merged.set(template.name.toLowerCase(), {
      id: `default-${index}-${template.name.toLowerCase().replace(/\s+/g, '-')}`,
      organization_id: organizationId,
      created_at: '',
      ...template,
    });
  });

  templates.forEach((template) => {
    merged.set(template.name.toLowerCase(), template);
  });

  return Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name));
};

const parseCsvLine = (line: string) => {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += character;
  }

  cells.push(current.trim());
  return cells;
};

const parseCsv = (text: string) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = cells[index] || '';
      return row;
    }, {});
  });
};

const findCsvValue = (row: Record<string, string>, keys: string[]) => {
  const match = keys.find((key) => row[key.toLowerCase()] !== undefined);
  return match ? row[match.toLowerCase()] : '';
};

const getInvoiceDisplayStatus = (invoice: Pick<FinanceInvoice, 'status' | 'due_date' | 'amount_paid' | 'total_amount'>) => {
  if (invoice.status === 'cancelled') return 'cancelled';
  if (invoice.status === 'draft') return 'draft';

  const total = toMoney(invoice.total_amount);
  const paid = toMoney(invoice.amount_paid);

  if (total > 0 && paid >= total) return 'paid';
  if (paid > 0) return 'partial';

  if (invoice.due_date) {
    const dueDate = new Date(invoice.due_date);
    dueDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dueDate < today) return 'overdue';
  }

  return invoice.status || 'sent';
};

const resolveInvoiceStatusForSave = (currentStatus: string, dueDate: string, totalAmount: number, amountPaid: number) => {
  if (currentStatus === 'cancelled') return 'cancelled';
  if (currentStatus === 'draft') return 'draft';
  if (totalAmount > 0 && amountPaid >= totalAmount) return 'paid';
  if (amountPaid > 0) return 'partial';

  if (dueDate) {
    const normalizedDueDate = new Date(dueDate);
    normalizedDueDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (normalizedDueDate < today) return 'overdue';
  }

  return 'sent';
};

const getInvoiceNumber = (invoice: { invoice_number?: string | null; invoice_no?: string | null }) =>
  invoice.invoice_number?.trim() || invoice.invoice_no?.trim() || '';

const getInvoiceItemName = (item: { expense_item?: string | null; description?: string | null; particulars?: string | null }) =>
  item.expense_item?.trim() || item.description?.trim() || item.particulars?.trim() || 'Service Item';

const isMissingColumnError = (error: any, columnName: string) => {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  return message.includes(columnName.toLowerCase()) && (message.includes('column') || message.includes('schema cache'));
};

const isDuplicateInvoiceNumberError = (error: any) => {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''} ${error?.code || ''} ${error?.constraint || ''}`.toLowerCase();
  return message.includes('duplicate key')
    && (
      message.includes('finance_invoices_invoice_no_key')
      || message.includes('finance_invoices_organization_invoice_number_key')
      || message.includes('invoice_no')
      || message.includes('invoice_number')
    );
};

const isMissingRpcError = (error: any, functionName: string) => {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  return error?.code === 'PGRST202' || message.includes(functionName.toLowerCase());
};

const removeMissingLegacyInvoiceColumns = <T extends Record<string, unknown>>(payload: T, error: any) => {
  let nextPayload = payload;
  let removedColumn = false;

  ['invoice_no', 'customer_name', 'entity', 'description'].forEach((columnName) => {
    if (columnName in nextPayload && isMissingColumnError(error, columnName)) {
      const { [columnName]: _removed, ...remainingPayload } = nextPayload;
      nextPayload = remainingPayload as T;
      removedColumn = true;
    }
  });

  return { nextPayload, removedColumn };
};

const removeMissingLegacyInvoiceItemColumns = <T extends Record<string, unknown>>(payload: T, error: any) => {
  let nextPayload = payload;
  let removedColumn = false;

  ['display_order', 'description'].forEach((columnName) => {
    if (columnName in nextPayload && isMissingColumnError(error, columnName)) {
      const { [columnName]: _removed, ...remainingPayload } = nextPayload;
      nextPayload = remainingPayload as T;
      removedColumn = true;
    }
  });

  return { nextPayload, removedColumn };
};

const InvoicingCenter: React.FC = () => {
  const { profile } = useAccess();
  const importRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationNotice, setOrganizationNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<HubTab>('customers');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const [customers, setCustomers] = useState<FinanceCustomer[]>([]);
  const [landlordImportCandidates, setLandlordImportCandidates] = useState<FinanceLandlordImportCandidate[]>([]);
  const [customerGroups, setCustomerGroups] = useState<FinanceCustomerGroup[]>([]);
  const [invoices, setInvoices] = useState<FinanceInvoice[]>([]);
  const [invoiceItems, setInvoiceItems] = useState<FinanceInvoiceItem[]>([]);
  const [expenseTemplates, setExpenseTemplates] = useState<FinanceExpenseItemTemplate[]>([]);
  const [receipts, setReceipts] = useState<FinanceReceipt[]>([]);
  const [entityReferenceOptions, setEntityReferenceOptions] = useState<FinanceReferenceOption[]>([]);

  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [focusedInvoiceId, setFocusedInvoiceId] = useState<string | null>(null);

  const [customerSearch, setCustomerSearch] = useState('');
  const [customerGroupFilter, setCustomerGroupFilter] = useState('all');
  const [showDeletedCustomers, setShowDeletedCustomers] = useState(false);
  const [receiptSearch, setReceiptSearch] = useState('');
  const [invoiceFilters, setInvoiceFilters] = useState<InvoiceFilters>(emptyInvoiceFilters());

  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showReceiptForm, setShowReceiptForm] = useState(false);
  const [showLandlordImportModal, setShowLandlordImportModal] = useState(false);
  const [selectedLandlordImportIds, setSelectedLandlordImportIds] = useState<string[]>([]);
  const [landlordImportSearch, setLandlordImportSearch] = useState('');
  const [importingLandlords, setImportingLandlords] = useState(false);

  const [editingCustomer, setEditingCustomer] = useState<FinanceCustomer | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<FinanceInvoice | null>(null);
  const [showAddCustomerGroup, setShowAddCustomerGroup] = useState(false);
  const [newCustomerGroupName, setNewCustomerGroupName] = useState('');
  const [savingCustomerGroup, setSavingCustomerGroup] = useState(false);
  const [selectedExpenseTemplateName, setSelectedExpenseTemplateName] = useState('');
  const [showAddExpenseTemplate, setShowAddExpenseTemplate] = useState(false);
  const [savingExpenseTemplate, setSavingExpenseTemplate] = useState(false);
  const [showAddInvoiceEntity, setShowAddInvoiceEntity] = useState(false);
  const [savingInvoiceEntity, setSavingInvoiceEntity] = useState(false);
  const [newInvoiceEntityName, setNewInvoiceEntityName] = useState('');
  const [transactionClassOptions, setTransactionClassOptions] = useState<string[]>(() => mergeTransactionClasses([]));
  const [showAddTransactionClass, setShowAddTransactionClass] = useState(false);
  const [newTransactionClassName, setNewTransactionClassName] = useState('');
  const [receivableAccountOptions, setReceivableAccountOptions] = useState<string[]>(() => mergeReceivableAccounts([]));
  const [receivableAccountReferenceOptions, setReceivableAccountReferenceOptions] = useState<FinanceReferenceOption[]>([]);
  const [paymentReferenceOptions, setPaymentReferenceOptions] = useState<FinancePaymentReferenceOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<FinanceDepositAccount[]>([]);
  const [showAddReceivableAccount, setShowAddReceivableAccount] = useState(false);
  const [newReceivableAccountName, setNewReceivableAccountName] = useState('');
  const [receivableAccountTarget, setReceivableAccountTarget] = useState<'invoice' | 'template'>('invoice');
  const [referenceOptionDeleteTarget, setReferenceOptionDeleteTarget] = useState<{ optionType: 'entity' | 'receivable_account'; optionValue: string } | null>(null);
  const [deletingReferenceOption, setDeletingReferenceOption] = useState(false);

  const [customerForm, setCustomerForm] = useState<CustomerFormState>(emptyCustomerForm());
  const [invoiceForm, setInvoiceForm] = useState<InvoiceFormState>(emptyInvoiceForm());
  const [receiptForm, setReceiptForm] = useState<ReceiptFormState>(emptyReceiptForm());
  const [expenseTemplateForm, setExpenseTemplateForm] = useState<ExpenseTemplateFormState>(emptyExpenseTemplateForm());

  const resolveOrganizationId = useCallback(async () => {
    if (profile?.organization_id) {
      setOrganizationNotice(null);
      setOrganizationId(profile.organization_id);
      return profile.organization_id;
    }

    if (profile?.company_id) {
      const { data, error } = await supabase
        .from('companies')
        .select('organization_id')
        .eq('id', profile.company_id)
        .maybeSingle();

      if (error) throw error;

      if (data?.organization_id) {
        setOrganizationNotice('Using your linked company organization while profile syncing completes.');
        setOrganizationId(data.organization_id);
        return data.organization_id;
      }
    }

    if (profile?.company_code) {
      const { data, error } = await supabase
        .from('companies')
        .select('organization_id')
        .eq('code', profile.company_code)
        .maybeSingle();

      if (error) throw error;

      if (data?.organization_id) {
        setOrganizationNotice('Using your company code mapping while profile syncing completes.');
        setOrganizationId(data.organization_id);
        return data.organization_id;
      }
    }

    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(2);

    if (error) throw error;

    if ((data || []).length === 1) {
      setOrganizationNotice('Using the only active organization in the workspace while profile syncing completes.');
      setOrganizationId(data![0].id);
      return data![0].id;
    }

    setOrganizationId(null);
    setOrganizationNotice('Your account is not linked to an organization yet, so customer and invoice posting is blocked.');
    return null;
  }, [profile?.company_code, profile?.company_id, profile?.organization_id]);

  const resolveCompanyId = useCallback(async (linkedOrganizationId?: string | null) => {
    if (profile?.company_id) {
      return profile.company_id;
    }

    if (profile?.company_code) {
      const { data, error } = await supabase
        .from('companies')
        .select('id')
        .eq('code', profile.company_code)
        .maybeSingle();

      if (error) throw error;
      if (data?.id) return data.id;
    }

    const scopedOrganizationId = linkedOrganizationId || organizationId || await resolveOrganizationId();
    if (scopedOrganizationId) {
      const { data, error } = await supabase
        .from('companies')
        .select('id')
        .eq('organization_id', scopedOrganizationId)
        .order('created_at', { ascending: true })
        .limit(1);

      if (error) throw error;
      if (data?.[0]?.id) return data[0].id;
    }

    return null;
  }, [organizationId, profile?.company_code, profile?.company_id, resolveOrganizationId]);

  const loadHubData = useCallback(async () => {
    setLoading(true);

    try {
      const scopedOrganizationId = organizationId || await resolveOrganizationId();
      const scopedCompanyId = await resolveCompanyId(scopedOrganizationId);

      if (!scopedOrganizationId) {
        setCustomers([]);
        setInvoices([]);
        setInvoiceItems([]);
        setExpenseTemplates([]);
        setReceipts([]);
        setEntityReferenceOptions([]);
        setPaymentReferenceOptions([]);
        return;
      }

      const recurringGeneration = await supabase.rpc('generate_due_recurring_finance_invoices', {
        target_organization_id: scopedOrganizationId,
      });

      if (recurringGeneration.error && !isMissingRpcError(recurringGeneration.error, 'generate_due_recurring_finance_invoices')) {
        throw recurringGeneration.error;
      }

      const [customersRes, invoicesRes, receiptsRes, customerGroupsRes, expenseTemplatesRes, referenceOptionsRes, paymentReferenceOptionsRes, depositAccountsRes, landlordsRes]: any[] = await Promise.all([
        supabase
          .from('finance_customers')
          .select('*')
          .eq('organization_id', scopedOrganizationId)
          .order('created_at', { ascending: false })
          .order('customer_name', { ascending: true })
          .limit(1000),
        supabase
          .from('finance_invoices')
          .select('*')
          .eq('organization_id', scopedOrganizationId)
          .order('invoice_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(300),
        supabase
          .from('finance_receipts')
          .select('*')
          .eq('organization_id', scopedOrganizationId)
          .order('receipt_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(300),
        supabase
          .from('finance_customer_groups')
          .select('id, organization_id, name, created_at')
          .eq('organization_id', scopedOrganizationId)
          .order('name', { ascending: true }),
        supabase
          .from('finance_expense_items')
          .select('id, organization_id, name, default_particulars, default_income_account, default_unit_cost, default_quantity, is_recurring, created_at')
          .eq('organization_id', scopedOrganizationId)
          .order('name', { ascending: true }),
        scopedCompanyId
          ? supabase
              .from('finance_bank_account_reference_options')
              .select('id, company_id, option_type, option_value, created_at')
              .eq('company_id', scopedCompanyId)
              .in('option_type', ['entity', 'receivable_account'])
              .order('option_value', { ascending: true })
          : Promise.resolve({ data: [], error: null } as any),
        scopedOrganizationId
          ? supabase
              .from('finance_payment_reference_options')
              .select('id, organization_id, option_type, option_value, created_at')
              .eq('organization_id', scopedOrganizationId)
              .order('option_value', { ascending: true })
          : Promise.resolve({ data: [], error: null } as any),
        (async () => {
          try {
            const accounts = await financeDepositAccountsService.listAccounts();
            return { data: accounts, error: null };
          } catch (error) {
            console.warn('Deposit accounts query error:', error);
            return { data: [], error };
          }
        })(),
        supabase
          .from('re_personnel')
          .select('id, full_name, email, phone, login_username, property:re_properties(name)')
          .eq('role', 'landlord')
          .order('full_name', { ascending: true }),
      ]);

      if (customersRes.error) throw customersRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      if (receiptsRes.error) throw receiptsRes.error;
      if (customerGroupsRes.error && customerGroupsRes.error.code !== 'PGRST205') throw customerGroupsRes.error;
      if (expenseTemplatesRes.error && expenseTemplatesRes.error.code !== 'PGRST205') throw expenseTemplatesRes.error;
      if (referenceOptionsRes.error && referenceOptionsRes.error.code !== 'PGRST205') throw referenceOptionsRes.error;
      if (paymentReferenceOptionsRes.error && paymentReferenceOptionsRes.error.code !== 'PGRST205') {
        console.warn('Payment reference options query failed:', paymentReferenceOptionsRes.error);
      }
      if (depositAccountsRes.error && depositAccountsRes.error.code !== 'PGRST205') {
        console.warn('Deposit accounts query failed:', depositAccountsRes.error);
      }
      if (landlordsRes.error && landlordsRes.error.code !== 'PGRST205') {
        console.warn('Landlord import query failed:', landlordsRes.error);
      }

      const loadedInvoices = (invoicesRes.data || []) as FinanceInvoice[];
      const invoiceIds = loadedInvoices.map((invoice) => invoice.id);
      const loadedCustomers = (customersRes.data || []) as FinanceCustomer[];
      const loadedCustomerGroups = (customerGroupsRes.data || []) as FinanceCustomerGroup[];
      const loadedExpenseTemplates = (expenseTemplatesRes.data || []) as FinanceExpenseItemTemplate[];
      const loadedReferenceOptions = (referenceOptionsRes.data || []) as FinanceReferenceOption[];
      const loadedPaymentReferenceOptions = (paymentReferenceOptionsRes.data || []) as FinancePaymentReferenceOption[];
      const loadedDepositAccounts = ((depositAccountsRes.data || []) as FinanceDepositAccount[]).map((account) => ({
        ...account,
        current_balance: Number(account.current_balance ?? 0) || 0,
        is_active: account.is_active ?? true,
      })) as FinanceDepositAccount[];
      const loadedLandlords = (landlordsRes.data || []) as FinanceLandlordImportCandidate[];
      const loadedEntityOptions = loadedReferenceOptions.filter((option) => option.option_type === 'entity');
      const loadedReceivableAccountReferenceOptions = loadedReferenceOptions.filter((option) => option.option_type === 'receivable_account');
      const loadedReceivableAccountOptions = loadedReceivableAccountReferenceOptions.map((option) => option.option_value);
      const loadedPayFromAccountOptions = loadedPaymentReferenceOptions
        .filter((option) => option.option_type === 'pay_from_account')
        .map((option) => option.option_value);
      const loadedPaymentMethodOptions = loadedPaymentReferenceOptions
        .filter((option) => option.option_type === 'payment_method')
        .map((option) => option.option_value);
      const depositAccountNames = loadedDepositAccounts.map((account) => financeDepositAccountsService.formatAccountLabel(account));
      console.log('Deposit accounts loaded:', { count: loadedDepositAccounts.length, names: depositAccountNames });
      setBankAccounts(loadedDepositAccounts);
      const cachedExpenseTemplates = readCachedExpenseTemplates(scopedOrganizationId);
      const cachedTransactionClasses = readCachedTransactionClasses(scopedOrganizationId);
      const cachedReceivableAccounts = readCachedReceivableAccounts(scopedOrganizationId);

      let loadedItems: FinanceInvoiceItem[] = [];

      if (invoiceIds.length > 0) {
        let itemsRes = await supabase
          .from('finance_invoice_items')
          .select('*')
          .in('invoice_id', invoiceIds)
          .order('display_order', { ascending: true });

        if (itemsRes.error && isMissingColumnError(itemsRes.error, 'display_order')) {
          itemsRes = await supabase
            .from('finance_invoice_items')
            .select('*')
            .in('invoice_id', invoiceIds)
            .order('created_at', { ascending: true });
        }

        if (itemsRes.error) throw itemsRes.error;
        loadedItems = ((itemsRes.data || []) as FinanceInvoiceItem[]).sort((left, right) => {
          const leftOrder = typeof left.display_order === 'number' ? left.display_order : Number.MAX_SAFE_INTEGER;
          const rightOrder = typeof right.display_order === 'number' ? right.display_order : Number.MAX_SAFE_INTEGER;
          if (leftOrder !== rightOrder) return leftOrder - rightOrder;
          return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
        });
      }

      const fallbackGroups = Array.from(
        new Set([
          ...SERVICE_GROUP_OPTIONS,
          ...(loadedCustomers
            .map((customer) => customer.service_group)
            .filter(Boolean) as string[]),
        ]),
      )
        .sort((left, right) => left.localeCompare(right))
        .map((name) => ({
          id: name,
          organization_id: scopedOrganizationId,
          name,
          created_at: '',
        }));

      setCustomers(loadedCustomers);
      setCustomerGroups(
        loadedCustomerGroups.length > 0
          ? [
              ...loadedCustomerGroups,
              ...fallbackGroups.filter(
                (fallbackGroup) =>
                  !loadedCustomerGroups.some(
                    (group) => group.name.toLowerCase() === fallbackGroup.name.toLowerCase(),
                  ),
              ),
            ].sort((left, right) => left.name.localeCompare(right.name))
          : fallbackGroups,
      );
      setInvoices(loadedInvoices);
      setInvoiceItems(loadedItems);
      const mergedExpenseTemplates = mergeExpenseTemplates(scopedOrganizationId, [
        ...loadedExpenseTemplates,
        ...cachedExpenseTemplates,
      ]);
      setEntityReferenceOptions(loadedEntityOptions);
      const mergedTransactionClasses = mergeTransactionClasses([
        ...cachedTransactionClasses,
        ...loadedInvoices.map((invoice) => invoice.transaction_class).filter(Boolean),
      ]);
      const mergedReceivableAccounts = mergeReceivableAccounts([
        ...loadedReceivableAccountOptions,
        ...loadedPayFromAccountOptions,
        ...cachedReceivableAccounts,
        ...depositAccountNames,
        ...loadedPaymentMethodOptions,
        ...loadedInvoices.map((invoice) => invoice.accounts_receivable_account || '').filter(Boolean),
        ...loadedItems.map((item) => item.income_account || '').filter(Boolean),
        ...loadedExpenseTemplates.map((template) => template.default_income_account || '').filter(Boolean),
      ]);
      console.log('Merged receivable accounts:', { total: mergedReceivableAccounts.length, accounts: mergedReceivableAccounts });
      setExpenseTemplates(mergedExpenseTemplates);
      writeCachedExpenseTemplates(scopedOrganizationId, mergedExpenseTemplates);
      setTransactionClassOptions(mergedTransactionClasses);
      writeCachedTransactionClasses(scopedOrganizationId, mergedTransactionClasses);
      setReceivableAccountReferenceOptions(loadedReceivableAccountReferenceOptions);
      setPaymentReferenceOptions(loadedPaymentReferenceOptions);
      setLandlordImportCandidates(loadedLandlords);
      setReceivableAccountOptions(mergedReceivableAccounts);
      writeCachedReceivableAccounts(scopedOrganizationId, mergedReceivableAccounts);
      console.log('Final receivable account options:', {
        total: mergedReceivableAccounts.length,
        options: mergedReceivableAccounts,
        bankAccounts: depositAccountNames,
        loadedFromDb: loadedReceivableAccountOptions,
        loadedPayFromAccountOptions,
        cached: cachedReceivableAccounts,
      });
      setReceipts((receiptsRes.data || []) as FinanceReceipt[]);
      console.log('Final receivable account options:', {
        total: mergedReceivableAccounts.length,
        options: mergedReceivableAccounts,
        bankAccounts: depositAccountNames,
        loadedFromDb: loadedReceivableAccountOptions,
        loadedPayFromAccountOptions,
        cached: cachedReceivableAccounts,
      });
    } catch (error: any) {
        console.error('Failed to load finance customer hub:', error);
        setToast({
          message: error.message || 'Failed to load the customer hub. Apply the latest finance migration first.',
          type: 'error',
        });
    } finally {
      setLoading(false);
    }
  }, [organizationId, resolveCompanyId, resolveOrganizationId]);

  useEffect(() => {
    if (profile) {
      loadHubData();
    }
  }, [profile, loadHubData]);

  const customerMap = useMemo(() => {
    return customers.reduce<Record<string, FinanceCustomer>>((accumulator, customer) => {
      accumulator[customer.id] = customer;
      return accumulator;
    }, {});
  }, [customers]);

  const activeCustomers = useMemo(
    () => customers.filter((customer) => !customer.is_deleted),
    [customers],
  );

  const invoiceCustomerOptions = useMemo(
    () => customers.filter((customer) => !customer.is_deleted || customer.id === invoiceForm.customer_id),
    [customers, invoiceForm.customer_id],
  );

  const receiptCustomerOptions = useMemo(
    () => customers.filter((customer) => !customer.is_deleted || customer.id === receiptForm.customer_id),
    [customers, receiptForm.customer_id],
  );

  const bankAccountMap = useMemo(() => {
    return bankAccounts.reduce<Record<string, FinanceDepositAccount>>((accumulator, account) => {
      accumulator[account.id] = account;
      return accumulator;
    }, {});
  }, [bankAccounts]);

  const receiptBankAccountOptions = useMemo(
    () => bankAccounts.filter((account) => account.is_active !== false),
    [bankAccounts],
  );

  const paymentMethodOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...paymentReferenceOptions.filter((option) => option.option_type === 'payment_method').map((option) => option.option_value),
          ...PAYMENT_METHOD_OPTIONS,
        ]),
      ).sort((left, right) => left.localeCompare(right)),
    [paymentReferenceOptions],
  );

  const receiptDepositAccountOptions = useMemo(
    () => {
      const actualAccountOptions = receiptBankAccountOptions.map((account) => ({
        value: account.id,
        label: `${formatBankAccountLabel(account)} · ${formatMoney(account.current_balance, account.currency || receiptForm.currency)}`,
      }));
      const paymentMethodAliases = paymentMethodOptions.map((option) => ({
        value: buildReceiptDepositAccountSelection('payment_method', option),
        label: `Payment Method: ${option}`,
      }));
      const payFromAccountAliases = receivableAccountOptions.map((option) => ({
        value: buildReceiptDepositAccountSelection('pay_from_account', option),
        label: `Pay From A/C: ${option}`,
      }));

      return [
        ...actualAccountOptions,
      ...paymentMethodAliases,
        ...payFromAccountAliases,
      ];
    },
    [paymentMethodOptions, receivableAccountOptions, receiptBankAccountOptions, receiptForm.currency],
  );

  const invoiceMap = useMemo(() => {
    return invoices.reduce<Record<string, FinanceInvoice>>((accumulator, invoice) => {
      accumulator[invoice.id] = invoice;
      return accumulator;
    }, {});
  }, [invoices]);

  const invoiceItemsByInvoice = useMemo(() => {
    return invoiceItems.reduce<Record<string, FinanceInvoiceItem[]>>((accumulator, item) => {
      if (!accumulator[item.invoice_id]) accumulator[item.invoice_id] = [];
      accumulator[item.invoice_id].push(item);
      return accumulator;
    }, {});
  }, [invoiceItems]);

  const invoiceDescriptionByInvoice = useMemo(() => {
    return Object.entries(invoiceItemsByInvoice).reduce<Record<string, string>>((accumulator, [invoiceId, items]) => {
      const description = items
        .map((item) => item.description?.trim() || item.particulars?.trim() || item.expense_item?.trim())
        .filter(Boolean)
        .join(' | ');
      accumulator[invoiceId] = description || '-';
      return accumulator;
    }, {});
  }, [invoiceItemsByInvoice]);

  const recurringExpenseTemplates = useMemo(
    () => expenseTemplates.filter((template) => template.is_recurring),
    [expenseTemplates],
  );

  const expenseItemSuggestions = useMemo(
    () =>
      Array.from(
        new Set([
          ...expenseTemplates.map((template) => template.name).filter(Boolean),
          ...invoiceItems.map((item) => getInvoiceItemName(item)).filter(Boolean),
          ...invoiceForm.items.map((item) => item.expense_item).filter(Boolean),
        ]),
      ).sort((left, right) => left.localeCompare(right)),
    [expenseTemplates, invoiceForm.items, invoiceItems],
  );

  const invoiceEntityOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...entityReferenceOptions.map((option) => option.option_value).filter(Boolean),
          ...invoices.map((invoice) => invoice.entity || '').filter(Boolean),
          profile?.company_code || '',
        ]),
      )
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    [entityReferenceOptions, invoices, profile?.company_code],
  );

  const selectedInvoiceEntityReference = useMemo(
    () => entityReferenceOptions.find((option) => normalizeText(option.option_value) === normalizeText(invoiceForm.entity)),
    [entityReferenceOptions, invoiceForm.entity],
  );

  const selectedReceivableAccountReference = useMemo(
    () =>
      receivableAccountReferenceOptions.find(
        (option) => normalizeText(option.option_value) === normalizeText(invoiceForm.accounts_receivable_account),
      ),
    [invoiceForm.accounts_receivable_account, receivableAccountReferenceOptions],
  );

  const invoiceIncomeAccountOptions = useMemo(
    () =>
      mergeReceivableAccounts([
        ...receivableAccountOptions,
        ...paymentMethodOptions,
      ]),
    [paymentMethodOptions, receivableAccountOptions],
  );

  const updateInvoiceDraftItem = (rowId: string, patch: Partial<InvoiceItemDraft>) => {
    setInvoiceForm((current) => ({
      ...current,
      items: current.items.map((row) => (row.row_id === rowId ? { ...row, ...patch } : row)),
    }));
  };

  const addInvoiceDraftRow = (template?: FinanceExpenseItemTemplate) => {
    setInvoiceForm((current) => ({
      ...current,
      items: [
        ...current.items,
        createDraftItem(
          template
            ? {
                expense_item: template.name,
                description: template.default_particulars || '',
                particulars: template.default_particulars || '',
                income_account: template.default_income_account || '',
                unit_cost: template.default_unit_cost ? String(template.default_unit_cost) : '',
                quantity: template.default_quantity ? String(template.default_quantity) : '1',
              }
            : {},
        ),
      ],
    }));
  };

  const addSelectedRecurringExpenseItem = () => {
    const template = recurringExpenseTemplates.find((item) => item.name === selectedExpenseTemplateName);
    if (!template) {
      setToast({ message: 'Select a recurring expense item first.', type: 'warning' });
      return;
    }

    addInvoiceDraftRow(template);
    setToast({ message: `${template.name} added to the invoice.`, type: 'success' });
  };

  const persistExpenseTemplate = async (
    draftTemplate: FinanceExpenseItemTemplate,
    options?: {
      missingNameMessage?: string;
      duplicateMessage?: string;
      successMessage?: string;
      cacheSuccessMessage?: string;
      onSaved?: (template: FinanceExpenseItemTemplate) => void;
      onDuplicate?: (template: FinanceExpenseItemTemplate) => void;
    },
  ) => {
    const scopedOrganizationId = draftTemplate.organization_id || organizationId || await resolveOrganizationId();
    if (!scopedOrganizationId) return null;

    const normalizedName = draftTemplate.name.trim();
    if (!normalizedName) {
      setToast({ message: options?.missingNameMessage || 'Expense item name is required.', type: 'warning' });
      return null;
    }

    const existingTemplate = expenseTemplates.find(
      (template) => normalizeExpenseTemplateName(template.name) === normalizeExpenseTemplateName(normalizedName),
    );
    if (existingTemplate) {
      options?.onDuplicate?.(existingTemplate);
      setSelectedExpenseTemplateName(existingTemplate.name);
      setToast({ message: options?.duplicateMessage || 'That expense item already exists.', type: 'info' });
      return existingTemplate;
    }

    setSavingExpenseTemplate(true);

    const normalizedTemplate: FinanceExpenseItemTemplate = {
      ...draftTemplate,
      id: draftTemplate.id || `local-${Date.now()}`,
      organization_id: scopedOrganizationId,
      name: normalizedName,
      default_particulars: draftTemplate.default_particulars?.trim() || null,
      default_income_account: draftTemplate.default_income_account?.trim() || null,
      default_unit_cost: toMoney(draftTemplate.default_unit_cost),
      default_quantity: toMoney(draftTemplate.default_quantity) || 1,
      is_recurring: draftTemplate.is_recurring ?? true,
      created_at: draftTemplate.created_at || new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('finance_expense_items')
        .insert([
          {
            organization_id: scopedOrganizationId,
            name: normalizedName,
            default_particulars: normalizedTemplate.default_particulars,
            default_income_account: normalizedTemplate.default_income_account,
            default_unit_cost: normalizedTemplate.default_unit_cost,
            default_quantity: normalizedTemplate.default_quantity,
            is_recurring: normalizedTemplate.is_recurring,
            created_by: profile?.id || null,
          },
        ])
        .select('id, organization_id, name, default_particulars, default_income_account, default_unit_cost, default_quantity, is_recurring, created_at')
        .single();

      if (error && error.code !== 'PGRST205') throw error;

      const savedTemplate = (data as FinanceExpenseItemTemplate | null) || normalizedTemplate;
      const nextTemplates = mergeExpenseTemplates(scopedOrganizationId, [
        ...expenseTemplates,
        savedTemplate,
      ]);

      setExpenseTemplates(nextTemplates);
      writeCachedExpenseTemplates(scopedOrganizationId, nextTemplates);
      setSelectedExpenseTemplateName(savedTemplate.name);
      options?.onSaved?.(savedTemplate);
      setToast({
        message:
          error?.code === 'PGRST205'
            ? options?.cacheSuccessMessage || 'Expense item saved in browser cache. Apply the latest finance migration to share it across users.'
            : options?.successMessage || 'Expense item saved.',
        type: 'success',
      });
      return savedTemplate;
    } catch (error: any) {
      console.error('Failed to save recurring expense item:', error);
      setToast({ message: error.message || 'Failed to save expense item.', type: 'error' });
      return null;
    } finally {
      setSavingExpenseTemplate(false);
    }
  };

  const saveExpenseTemplate = async () => {
    const saved = await persistExpenseTemplate(
      {
        id: `local-${Date.now()}`,
        organization_id: organizationId || '',
        name: expenseTemplateForm.name,
        default_particulars: expenseTemplateForm.default_particulars,
        default_income_account: expenseTemplateForm.default_income_account,
        default_unit_cost: toMoney(expenseTemplateForm.default_unit_cost),
        default_quantity: toMoney(expenseTemplateForm.default_quantity) || 1,
        is_recurring: expenseTemplateForm.is_recurring,
        created_at: new Date().toISOString(),
      },
      {
        missingNameMessage: 'Recurring expense item name is required.',
        duplicateMessage: 'That recurring expense item already exists.',
        successMessage: 'Recurring expense item saved.',
        cacheSuccessMessage: 'Recurring expense item saved in browser cache. Apply the latest finance migration to share it across users.',
        onSaved: () => {
          setShowAddExpenseTemplate(false);
          setExpenseTemplateForm(emptyExpenseTemplateForm());
        },
        onDuplicate: () => {
          setShowAddExpenseTemplate(false);
          setExpenseTemplateForm(emptyExpenseTemplateForm());
        },
      },
    );

    if (saved) {
      setSelectedExpenseTemplateName(saved.name);
    }
  };

  const saveInvoiceDraftExpenseItem = async (item: InvoiceItemDraft) => {
    const saved = await persistExpenseTemplate(
      {
        id: `local-${item.row_id}`,
        organization_id: organizationId || '',
        name: item.expense_item,
        default_particulars: item.particulars,
        default_income_account: item.income_account,
        default_unit_cost: toMoney(item.unit_cost),
        default_quantity: toMoney(item.quantity) || 1,
        is_recurring: true,
        created_at: new Date().toISOString(),
      },
      {
        missingNameMessage: 'Type an expense item before adding it to the dropdown.',
        duplicateMessage: 'That expense item is already available in the dropdown.',
        successMessage: 'Expense item added to the dropdown.',
        cacheSuccessMessage: 'Expense item added locally. Apply the latest finance migration to share it across users.',
      },
    );

    if (saved) {
      setSelectedExpenseTemplateName(saved.name);
    }
  };

  const saveInvoiceDraftIncomeAccount = async (item: InvoiceItemDraft) => {
    const normalizedName = item.income_account.trim();
    if (!normalizedName) {
      setToast({ message: 'Type an income account before adding it to the dropdown.', type: 'warning' });
      return;
    }

    const scopedOrganizationId = organizationId || await resolveOrganizationId() || 'global';
    const existingAccount = receivableAccountOptions.find(
      (option) => normalizeReceivableAccountName(option) === normalizeReceivableAccountName(normalizedName),
    );
    const mergedAccounts = mergeReceivableAccounts([
      ...receivableAccountOptions,
      normalizedName,
    ]);

    setReceivableAccountOptions(mergedAccounts);
    writeCachedReceivableAccounts(scopedOrganizationId, mergedAccounts);
    setToast({
      message: existingAccount ? 'Income account is already available in the dropdown.' : 'Income account added to the dropdown.',
      type: existingAccount ? 'info' : 'success',
    });
  };

  const customerRollups = useMemo(() => {
    const rollups: Record<string, CustomerRollup> = {};

    customers.forEach((customer) => {
      rollups[customer.id] = {
        totalInvoices: 0,
        clearedInvoices: 0,
        pendingInvoices: 0,
        accountBalance: toMoney(customer.opening_balance),
        amountOverdue: 0,
      };
    });

    invoices.forEach((invoice) => {
      if (!invoice.customer_id || !rollups[invoice.customer_id]) return;

      const rollup = rollups[invoice.customer_id];
      const invoiceStatus = getInvoiceDisplayStatus(invoice);
      const invoiceTotal = toMoney(invoice.total_amount);
      const invoiceBalance = Math.max(0, invoiceTotal - toMoney(invoice.amount_paid));

      rollup.totalInvoices += 1;
      rollup.accountBalance += invoiceTotal;

      if (invoiceStatus === 'paid') {
        rollup.clearedInvoices += 1;
      } else if (invoiceStatus !== 'cancelled' && invoiceStatus !== 'draft') {
        rollup.pendingInvoices += 1;
      }

      if (invoiceStatus === 'overdue') {
        rollup.amountOverdue += invoiceBalance;
      }
    });

    receipts.forEach((receipt) => {
      const customerId = receipt.customer_id || invoiceMap[receipt.invoice_id || '']?.customer_id;
      if (!customerId || !rollups[customerId]) return;
      rollups[customerId].accountBalance -= toMoney(receipt.amount);
    });

    return rollups;
  }, [customers, invoices, receipts, invoiceMap]);

  const filteredCustomers = useMemo(() => {
    const search = customerSearch.toLowerCase();

    return customers.filter((customer) => {
      if (!showDeletedCustomers && customer.is_deleted) return false;

      const haystack = [
        customer.account_number,
        customer.customer_name,
        customer.service_group,
        customer.ledger_name,
        customer.email,
        customer.phone,
        customer.deleted_by_name,
        customer.is_deleted ? 'deleted' : 'active',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = haystack.includes(search);
      const matchesGroup = customerGroupFilter === 'all' || customer.service_group === customerGroupFilter;
      return matchesSearch && matchesGroup;
    }).sort((left, right) => {
      if (!!left.is_deleted !== !!right.is_deleted) return left.is_deleted ? 1 : -1;
      const dateA = left.created_at || '';
      const dateB = right.created_at || '';
      if (dateA !== dateB) return dateA > dateB ? -1 : 1;
      return left.customer_name.localeCompare(right.customer_name);
    });
  }, [customerGroupFilter, customerSearch, customers, showDeletedCustomers]);

  const selectableFilteredCustomers = useMemo(
    () => filteredCustomers.filter((customer) => !customer.is_deleted),
    [filteredCustomers],
  );

  const filteredInvoices = useMemo(() => {
      return invoices.filter((invoice) => {
        const customer = invoice.customer_id ? customerMap[invoice.customer_id] : null;
        const haystack = [
          getInvoiceNumber(invoice),
          invoice.entity,
          invoice.transaction_class,
          invoice.accounts_receivable_account,
          customer?.customer_name,
          customer?.account_number,
        ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const invoiceDate = invoice.invoice_date || '';
      const matchesSearch = haystack.includes(invoiceFilters.search.toLowerCase());
      const matchesCustomer = invoiceFilters.customerId === 'all' || invoice.customer_id === invoiceFilters.customerId;
      const matchesClass = invoiceFilters.transactionClass === 'all' || invoice.transaction_class === invoiceFilters.transactionClass;
      const matchesFrom = !invoiceFilters.dateFrom || invoiceDate >= invoiceFilters.dateFrom;
      const matchesTo = !invoiceFilters.dateTo || invoiceDate <= invoiceFilters.dateTo;
      const matchesRecurring = !invoiceFilters.recurringOnly || invoice.recurring_enabled;

      return matchesSearch && matchesCustomer && matchesClass && matchesFrom && matchesTo && matchesRecurring;
    });
  }, [customerMap, invoiceFilters, invoices]);

  useEffect(() => {
    setSelectedCustomerIds((current) => current.filter((id) => !customerMap[id]?.is_deleted));
  }, [customerMap]);

  const filteredReceipts = useMemo(() => {
    return receipts.filter((receipt) => {
      const invoice = receipt.invoice_id ? invoiceMap[receipt.invoice_id] : null;
      const customerId = receipt.customer_id || invoice?.customer_id || '';
      const customer = customerId ? customerMap[customerId] : null;

      const haystack = [
        receipt.receipt_number,
        receipt.received_from,
        receipt.description,
        receipt.payment_method,
        invoice?.invoice_number,
        customer?.customer_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(receiptSearch.toLowerCase());
    });
  }, [customerMap, invoiceMap, receiptSearch, receipts]);

  const focusedInvoice = focusedInvoiceId ? invoiceMap[focusedInvoiceId] : null;
  const focusedInvoiceItems = focusedInvoice ? invoiceItemsByInvoice[focusedInvoice.id] || [] : [];
  const recurringDueDate = useMemo(() => (
    invoiceForm.recurring_enabled ? addRecurringIntervalIso(invoiceForm.invoice_date, invoiceForm.recurring_frequency) : ''
  ), [invoiceForm.invoice_date, invoiceForm.recurring_enabled, invoiceForm.recurring_frequency]);
  const nextRecurringInvoiceDate = useMemo(() => (
    invoiceForm.recurring_enabled ? addRecurringIntervalIso(invoiceForm.invoice_date, invoiceForm.recurring_frequency) : ''
  ), [invoiceForm.invoice_date, invoiceForm.recurring_enabled, invoiceForm.recurring_frequency]);

  const invoiceDraftTotals = useMemo(() => {
    const subtotal = invoiceForm.items.reduce((sum, item) => sum + toMoney(item.unit_cost) * toMoney(item.quantity), 0);
    const taxRate = toMoney(invoiceForm.tax_rate);
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  }, [invoiceForm.items, invoiceForm.tax_rate]);

  const totalOutstanding = useMemo(() => {
    return invoices.reduce((sum, invoice) => sum + Math.max(0, toMoney(invoice.total_amount) - toMoney(invoice.amount_paid)), 0);
  }, [invoices]);

  const overdueTotal = useMemo(() => {
    return invoices.reduce((sum, invoice) => {
      if (getInvoiceDisplayStatus(invoice) !== 'overdue') return sum;
      return sum + Math.max(0, toMoney(invoice.total_amount) - toMoney(invoice.amount_paid));
    }, 0);
  }, [invoices]);

  const receiptTotal = useMemo(() => {
    return receipts.reduce((sum, receipt) => sum + toMoney(receipt.amount), 0);
  }, [receipts]);

  useEffect(() => {
    if (!invoiceForm.recurring_enabled || !invoiceForm.invoice_date) return;

    if (invoiceForm.due_date !== recurringDueDate) {
      setInvoiceForm((current) => (
        current.recurring_enabled && current.invoice_date === invoiceForm.invoice_date
          ? { ...current, due_date: recurringDueDate }
          : current
      ));
    }
  }, [invoiceForm.invoice_date, invoiceForm.due_date, invoiceForm.recurring_enabled, recurringDueDate]);

  const ensureCustomerGroupExists = useCallback(async (groupName: string, scopedOrganizationId: string) => {
    const normalizedName = groupName.trim();
    if (!normalizedName) return;

    const alreadyExists = customerGroups.some((group) => group.name.toLowerCase() === normalizedName.toLowerCase());
    if (alreadyExists) return;

    const { data, error } = await supabase
      .from('finance_customer_groups')
      .upsert(
        [{
          organization_id: scopedOrganizationId,
          name: normalizedName,
          created_by: profile?.id || null,
        }],
        { onConflict: 'organization_id,name' },
      )
      .select('id, organization_id, name, created_at');

    if (error) throw error;

    if ((data || []).length > 0) {
      setCustomerGroups((current) => {
        const merged = [...current];
        data.forEach((group) => {
          if (!merged.some((entry) => entry.name.toLowerCase() === group.name.toLowerCase())) {
            merged.push(group as FinanceCustomerGroup);
          }
        });
        return merged.sort((left, right) => left.name.localeCompare(right.name));
      });
    }
  }, [customerGroups, profile?.id]);

  const handleAddCustomerGroup = async () => {
    const normalizedName = newCustomerGroupName.trim();
    if (!normalizedName) {
      setToast({ message: 'Enter a customer grouping name first.', type: 'warning' });
      return;
    }

    const scopedOrganizationId = organizationId || await resolveOrganizationId();
    if (!scopedOrganizationId) return;

    setSavingCustomerGroup(true);

    try {
      await ensureCustomerGroupExists(normalizedName, scopedOrganizationId);
      setCustomerForm((current) => ({ ...current, service_group: normalizedName }));
      setNewCustomerGroupName('');
      setShowAddCustomerGroup(false);
      setToast({ message: 'Customer grouping added.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to add customer grouping:', error);
      setToast({ message: error.message || 'Failed to add customer grouping.', type: 'error' });
    } finally {
      setSavingCustomerGroup(false);
    }
  };

  const openAddReceivableAccount = (target: 'invoice' | 'template') => {
    const currentValue = target === 'invoice'
      ? invoiceForm.accounts_receivable_account
      : expenseTemplateForm.default_income_account;
    const shouldOpen = !showAddReceivableAccount || receivableAccountTarget !== target;
    setReceivableAccountTarget(target);
    setNewReceivableAccountName(currentValue || '');
    setShowAddReceivableAccount(shouldOpen);
    setReferenceOptionDeleteTarget(null);
  };

  const handleAddTransactionClass = async () => {
    const normalizedName = newTransactionClassName.trim();
    if (!normalizedName) {
      setToast({ message: 'Enter a transaction class first.', type: 'warning' });
      return;
    }

    const existingTransactionClass = transactionClassOptions.find(
      (option) => normalizeTransactionClassName(option) === normalizeTransactionClassName(normalizedName),
    );
    if (existingTransactionClass) {
      setInvoiceForm((current) => ({ ...current, transaction_class: existingTransactionClass }));
      setNewTransactionClassName('');
      setShowAddTransactionClass(false);
      setToast({ message: 'That transaction class already exists.', type: 'info' });
      return;
    }

    const scopedOrganizationId = organizationId || await resolveOrganizationId() || 'global';
    const mergedTransactionClasses = mergeTransactionClasses([...transactionClassOptions, normalizedName]);

    setTransactionClassOptions(mergedTransactionClasses);
    writeCachedTransactionClasses(scopedOrganizationId, mergedTransactionClasses);
    setInvoiceForm((current) => ({ ...current, transaction_class: normalizedName }));
    setNewTransactionClassName('');
    setShowAddTransactionClass(false);
    setToast({ message: 'Transaction class added.', type: 'success' });
  };

  const openAddTransactionClass = () => {
    setNewTransactionClassName(invoiceForm.transaction_class || '');
    setShowAddTransactionClass((current) => !current);
  };

  const handleAddInvoiceEntity = async () => {
    const normalizedName = newInvoiceEntityName.trim();
    if (!normalizedName) {
      setToast({ message: 'Enter an entity or app name first.', type: 'warning' });
      return;
    }

    const scopedCompanyId = await resolveCompanyId();
    if (!scopedCompanyId) {
      setToast({ message: 'A company must be linked before saving entity options.', type: 'warning' });
      return;
    }

    const existingEntity = entityReferenceOptions.find(
      (option) => normalizeText(option.option_value) === normalizeText(normalizedName),
    );
    if (existingEntity) {
      setInvoiceForm((current) => ({ ...current, entity: existingEntity.option_value }));
      setShowAddInvoiceEntity(false);
      setNewInvoiceEntityName('');
      setToast({ message: 'That entity already exists.', type: 'info' });
      return;
    }

    setSavingInvoiceEntity(true);
    try {
      const { data, error } = await supabase
        .from('finance_bank_account_reference_options')
        .insert([
          {
            company_id: scopedCompanyId,
            option_type: 'entity',
            option_value: normalizedName,
            created_by: profile?.id || null,
          },
        ])
        .select('id, company_id, option_type, option_value, created_at')
        .single();

      if (error) throw error;

      const created = data as FinanceReferenceOption;
      setEntityReferenceOptions((current) => {
        const exists = current.some((option) => normalizeText(option.option_value) === normalizeText(created.option_value));
        return exists ? current : [...current, created].sort((left, right) => left.option_value.localeCompare(right.option_value));
      });
      setInvoiceForm((current) => ({ ...current, entity: created.option_value }));
      setShowAddInvoiceEntity(false);
      setNewInvoiceEntityName('');
      setToast({ message: 'Entity option saved.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to save invoice entity option:', error);
      setToast({ message: error.message || 'Failed to save entity option.', type: 'error' });
    } finally {
      setSavingInvoiceEntity(false);
    }
  };

  const handleDeleteReferenceOption = async () => {
    if (!referenceOptionDeleteTarget) {
      return;
    }

    const { optionType, optionValue } = referenceOptionDeleteTarget;
    const scopedCompanyId = await resolveCompanyId();
    if (!scopedCompanyId) {
      setToast({ message: 'A company must be linked before deleting saved options.', type: 'warning' });
      return;
    }
    const scopedOrganizationId = organizationId || await resolveOrganizationId() || 'global';

    const sourceOptions = optionType === 'entity' ? entityReferenceOptions : receivableAccountReferenceOptions;
    const optionRecord = sourceOptions.find((option) => normalizeText(option.option_value) === normalizeText(optionValue));
    if (!optionRecord) {
      setToast({ message: 'That option is not saved in the database.', type: 'info' });
      setReferenceOptionDeleteTarget(null);
      return;
    }

    setDeletingReferenceOption(true);
    try {
      const { error } = await supabase
        .from('finance_bank_account_reference_options')
        .delete()
        .eq('id', optionRecord.id);

      if (error) throw error;

      if (optionType === 'entity') {
        setEntityReferenceOptions((current) => current.filter((option) => option.id !== optionRecord.id));
        setInvoiceForm((current) =>
          normalizeText(current.entity) === normalizeText(optionRecord.option_value)
            ? { ...current, entity: '' }
            : current,
        );
      } else {
        setReceivableAccountReferenceOptions((current) => current.filter((option) => option.id !== optionRecord.id));
        const nextReceivableAccounts = mergeReceivableAccounts(
          receivableAccountReferenceOptions
            .filter((option) => option.id !== optionRecord.id)
            .map((option) => option.option_value)
            .concat(
              invoiceForm.accounts_receivable_account && normalizeText(invoiceForm.accounts_receivable_account) !== normalizeText(optionRecord.option_value)
                ? [invoiceForm.accounts_receivable_account]
                : [],
            ),
        );
        setReceivableAccountOptions(nextReceivableAccounts);
        writeCachedReceivableAccounts(scopedOrganizationId, nextReceivableAccounts);

        setInvoiceForm((current) =>
          normalizeText(current.accounts_receivable_account) === normalizeText(optionRecord.option_value)
            ? { ...current, accounts_receivable_account: DEFAULT_RECEIVABLE_ACCOUNT }
            : current,
        );
        setExpenseTemplateForm((current) =>
          normalizeText(current.default_income_account) === normalizeText(optionRecord.option_value)
            ? { ...current, default_income_account: DEFAULT_RECEIVABLE_ACCOUNT }
            : current,
        );
      }

      setToast({ message: `${optionRecord.option_value} deleted.`, type: 'success' });
      setReferenceOptionDeleteTarget(null);
    } catch (error: any) {
      console.error('Failed to delete reference option:', error);
      setToast({ message: error.message || 'Failed to delete saved option.', type: 'error' });
    } finally {
      setDeletingReferenceOption(false);
    }
  };

  const handleAddReceivableAccount = async () => {
    const normalizedName = newReceivableAccountName.trim();
    if (!normalizedName) {
      setToast({ message: 'Enter an account name first.', type: 'warning' });
      return;
    }

    const scopedOrganizationId = organizationId || await resolveOrganizationId();
    if (!scopedOrganizationId) {
      setToast({ message: 'A company must be linked before saving receivable accounts.', type: 'warning' });
      return;
    }

    const scopedCompanyId = await resolveCompanyId(scopedOrganizationId);
    if (!scopedCompanyId) {
      setToast({ message: 'A company must be linked before saving receivable accounts.', type: 'warning' });
      return;
    }

    const existingAccount = receivableAccountOptions.find(
      (option) => normalizeText(option) === normalizeText(normalizedName),
    );
    if (existingAccount) {
      if (receivableAccountTarget === 'invoice') {
        setInvoiceForm((current) => ({ ...current, accounts_receivable_account: existingAccount }));
      } else {
        setExpenseTemplateForm((current) => ({ ...current, default_income_account: existingAccount }));
      }
      setNewReceivableAccountName('');
      setShowAddReceivableAccount(false);
      setToast({ message: 'That account already exists.', type: 'info' });
      return;
    }

    setSavingInvoiceEntity(true);
    try {
      const { data, error } = await supabase
        .from('finance_bank_account_reference_options')
        .insert([
          {
            company_id: scopedCompanyId,
            option_type: 'receivable_account',
            option_value: normalizedName,
            created_by: profile?.id || null,
          },
        ])
        .select('id, company_id, option_type, option_value, created_at')
        .single();

      if (error) throw error;

      const created = data as FinanceReferenceOption;
      const mergedAccounts = mergeReceivableAccounts([...receivableAccountOptions, created.option_value]);
      setReceivableAccountOptions(mergedAccounts);
      writeCachedReceivableAccounts(scopedOrganizationId, mergedAccounts);

      if (receivableAccountTarget === 'invoice') {
        setInvoiceForm((current) => ({ ...current, accounts_receivable_account: created.option_value }));
      } else {
        setExpenseTemplateForm((current) => ({ ...current, default_income_account: created.option_value }));
      }

      setNewReceivableAccountName('');
      setShowAddReceivableAccount(false);
      setToast({ message: 'Account option saved.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to save receivable account option:', error);
      setToast({ message: error.message || 'Failed to save account option.', type: 'error' });
    } finally {
      setSavingInvoiceEntity(false);
    }
  };

  const openCreateCustomerForm = () => {
    setEditingCustomer(null);
    setCustomerForm(emptyCustomerForm());
    setShowAddCustomerGroup(false);
    setNewCustomerGroupName('');
    setShowCustomerForm(true);
  };

  const resetInvoiceComposer = () => {
    setShowInvoiceForm(false);
    setEditingInvoice(null);
    setInvoiceForm(emptyInvoiceForm());
    setSelectedExpenseTemplateName('');
    setShowAddExpenseTemplate(false);
    setExpenseTemplateForm(emptyExpenseTemplateForm());
    setShowAddTransactionClass(false);
    setNewTransactionClassName('');
    setShowAddInvoiceEntity(false);
    setNewInvoiceEntityName('');
    setSavingInvoiceEntity(false);
    setShowAddReceivableAccount(false);
    setNewReceivableAccountName('');
    setReferenceOptionDeleteTarget(null);
    setDeletingReferenceOption(false);
  };

  const resetCustomerFilters = () => {
    setCustomerSearch('');
    setCustomerGroupFilter('all');
    setShowDeletedCustomers(false);
    setSelectedCustomerIds([]);
  };

  const resetInvoiceFilters = () => {
    setInvoiceFilters(emptyInvoiceFilters());
    setSelectedInvoiceIds([]);
    setFocusedInvoiceId(null);
  };

  const resetReceiptFilters = () => {
    setReceiptSearch('');
  };

  const openEditCustomerForm = (customer: FinanceCustomer) => {
    if (customer.is_deleted) {
      setToast({ message: 'Deleted customers are read-only. Review the deletion audit in the table.', type: 'warning' });
      return;
    }

    setEditingCustomer(customer);
    setCustomerForm({
      account_number: customer.account_number,
      customer_name: customer.customer_name,
      service_group: customer.service_group || SERVICE_GROUP_OPTIONS[0],
      ledger_name: customer.ledger_name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      contact_person: customer.contact_person || '',
      opening_balance: String(toMoney(customer.opening_balance)),
      billing_address: customer.billing_address || '',
      notes: customer.notes || '',
    });
    setShowAddCustomerGroup(false);
    setNewCustomerGroupName('');
    setShowCustomerForm(true);
  };

  const openCreateInvoiceForm = () => {
    setEditingInvoice(null);
    setInvoiceForm((current) => ({
      ...emptyInvoiceForm(),
      entity: current.entity || profile?.company_code || '',
    }));
    setSelectedExpenseTemplateName('');
    setShowAddExpenseTemplate(false);
    setExpenseTemplateForm(emptyExpenseTemplateForm());
    setShowAddTransactionClass(false);
    setNewTransactionClassName('');
    setShowAddReceivableAccount(false);
    setNewReceivableAccountName('');
    setShowInvoiceForm(true);
    setActiveTab('invoices');
  };

  const openEditInvoiceForm = (invoice: FinanceInvoice) => {
    const customer = invoice.customer_id ? customerMap[invoice.customer_id] : null;
    const items = (invoiceItemsByInvoice[invoice.id] || []).map((item) => ({
      row_id: item.id,
      expense_item: getInvoiceItemName(item),
      description: item.description || '',
      particulars: item.particulars || '',
      income_account: item.income_account || '',
      unit_cost: String(item.unit_cost),
      quantity: String(item.quantity),
    }));

    setEditingInvoice(invoice);
    setInvoiceForm({
      customer_id: invoice.customer_id || '',
      entity: invoice.entity || profile?.company_code || '',
      invoice_number: getInvoiceNumber(invoice) || generateInvoiceNumber('FIN'),
      transaction_class: invoice.transaction_class,
      accounts_receivable_account: invoice.accounts_receivable_account || DEFAULT_RECEIVABLE_ACCOUNT,
      description: invoice.description || '',
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date || invoice.invoice_date,
      currency: invoice.currency || 'KES',
      etims_enabled: Boolean(invoice.etims_enabled),
      recurring_enabled: Boolean(invoice.recurring_enabled),
      recurring_frequency: invoice.recurring_frequency || 'monthly',
      tax_rate: String(toMoney(invoice.tax_rate)),
      bill_to: invoice.bill_to || customer?.billing_address || customer?.customer_name || '',
      notes: invoice.notes || '',
      status: invoice.status || 'sent',
      items: items.length > 0 ? items : [createDraftItem()],
    });
    setSelectedExpenseTemplateName('');
    setShowAddExpenseTemplate(false);
    setExpenseTemplateForm(emptyExpenseTemplateForm());
    setShowAddTransactionClass(false);
    setNewTransactionClassName('');
    setShowAddReceivableAccount(false);
    setNewReceivableAccountName('');
    setFocusedInvoiceId(invoice.id);
    setShowInvoiceForm(true);
    setActiveTab('invoices');
  };

  const openReceiptForm = (invoice?: FinanceInvoice) => {
    const linkedCustomer = invoice?.customer_id ? customerMap[invoice.customer_id] : null;
    const balanceDue = invoice ? Math.max(0, toMoney(invoice.total_amount) - toMoney(invoice.amount_paid)) : 0;
    const defaultDepositAccountId = resolveReceiptAccountId('Cheque', receiptBankAccountOptions)
      || buildReceiptDepositAccountSelection('payment_method', 'Cheque');

    setReceiptForm({
      receipt_number: buildReceiptNumber(),
      receipt_date: todayIso(),
      customer_id: invoice?.customer_id || '',
      invoice_id: invoice?.id || '',
      amount: balanceDue > 0 ? balanceDue.toFixed(2) : '',
      payment_method: 'Cheque',
      deposit_account_id: defaultDepositAccountId,
      currency: invoice?.currency || 'KES',
      cheque_number: '',
      received_from: linkedCustomer?.customer_name || '',
      notes: invoice ? `Receipt against invoice ${getInvoiceNumber(invoice)}` : '',
    });
    setShowReceiptForm(true);
    setActiveTab('receipts');
  };

  const handlePrintInvoice = (invoice: FinanceInvoice) => {
    const customer = invoice.customer_id ? customerMap[invoice.customer_id] : null;
    const invoiceItems = invoiceItemsByInvoice[invoice.id] || [];
    const balanceDue = Math.max(0, toMoney(invoice.total_amount) - toMoney(invoice.amount_paid));

    printDocument({
      title: `Invoice ${getInvoiceNumber(invoice)}`,
      subtitle: `${invoice.invoice_date} · ${invoice.transaction_class} · ${customer?.customer_name || invoice.bill_to || 'No customer'}`,
      bodyHtml: `
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;">
          ${[
            ['Invoice Number', getInvoiceNumber(invoice)],
            ['Invoice Date', invoice.invoice_date || '-'],
            ['Due Date', invoice.due_date || '-'],
            ['Entity', invoice.entity || '-'],
            ['Customer', customer?.customer_name || invoice.bill_to || '-'],
            ['Status', getInvoiceDisplayStatus(invoice)],
            ['Total Amount', formatMoney(invoice.total_amount, invoice.currency)],
            ['Balance Due', formatMoney(balanceDue, invoice.currency)],
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
        <div style="margin-top:18px;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead>
              <tr style="background:#f8fafc;text-transform:uppercase;letter-spacing:.18em;color:#64748b;">
                <th style="text-align:left;padding:12px 14px;border-bottom:1px solid #e2e8f0;">Item</th>
                <th style="text-align:left;padding:12px 14px;border-bottom:1px solid #e2e8f0;">Description</th>
                <th style="text-align:left;padding:12px 14px;border-bottom:1px solid #e2e8f0;">Income Account</th>
                <th style="text-align:right;padding:12px 14px;border-bottom:1px solid #e2e8f0;">Qty</th>
                <th style="text-align:right;padding:12px 14px;border-bottom:1px solid #e2e8f0;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${invoiceItems.length > 0
                ? invoiceItems
                    .map(
                      (item) => `
                        <tr>
                          <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;">${escapeHtml(getInvoiceItemName(item))}</td>
                          <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;">${escapeHtml(item.description || '-')}</td>
                          <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;">${escapeHtml(item.income_account || '-')}</td>
                          <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(String(item.quantity || 0))}</td>
                          <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(formatMoney(item.line_total, invoice.currency))}</td>
                        </tr>
                      `,
                    )
                    .join('')
                : '<tr><td colspan="5" style="padding:18px 14px;text-align:center;color:#64748b;">No line items found for this invoice.</td></tr>'}
            </tbody>
          </table>
        </div>
      `,
    });
  };

  const handlePrintReceipt = (receipt: FinanceReceipt) => {
    const invoice = receipt.invoice_id ? invoiceMap[receipt.invoice_id] : null;
    const customer = receipt.customer_id ? customerMap[receipt.customer_id] : invoice?.customer_id ? customerMap[invoice.customer_id] : null;
    const depositAccount = receipt.deposit_account_id ? bankAccountMap[receipt.deposit_account_id] : null;

    printDocument({
      title: `Receipt ${receipt.receipt_number || receipt.id}`,
      subtitle: `${receipt.receipt_date} · ${receipt.payment_method || 'Unspecified method'} · ${customer?.customer_name || receipt.received_from || 'No customer'}`,
      bodyHtml: `
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;">
          ${[
            ['Receipt Number', receipt.receipt_number || '-'],
            ['Receipt Date', receipt.receipt_date || '-'],
            ['Customer', customer?.customer_name || receipt.received_from || '-'],
            ['Invoice', invoice ? getInvoiceNumber(invoice) : '-'],
            ['Payment Method', receipt.payment_method || '-'],
            ['Deposit Account', depositAccount ? formatBankAccountLabel(depositAccount) : '-'],
            ['Amount', formatMoney(receipt.amount, receipt.currency || 'KES')],
            ['Cheque Number', receipt.cheque_number || '-'],
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
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.18em;color:#64748b;font-weight:700;">Notes</div>
          <div style="margin-top:6px;font-size:14px;line-height:1.6;color:#0f172a;">${escapeHtml(receipt.notes || receipt.description || 'No notes provided')}</div>
        </div>
      `,
    });
  };

  const handleCustomerSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!customerForm.customer_name.trim()) {
      setToast({ message: 'Customer name is required.', type: 'warning' });
      return;
    }

    const scopedOrganizationId = organizationId || await resolveOrganizationId();
    if (!scopedOrganizationId) return;

    setSavingCustomer(true);

    try {
      await ensureCustomerGroupExists(customerForm.service_group, scopedOrganizationId);

      const payload = {
        organization_id: scopedOrganizationId,
        account_number: customerForm.account_number.trim() || buildCustomerAccountNumber(),
        customer_name: customerForm.customer_name.trim(),
        service_group: customerForm.service_group.trim() || null,
        ledger_name: customerForm.ledger_name.trim() || null,
        email: customerForm.email.trim() || null,
        phone: customerForm.phone.trim() || null,
        contact_person: customerForm.contact_person.trim() || null,
        opening_balance: toMoney(customerForm.opening_balance),
        billing_address: customerForm.billing_address.trim() || null,
        notes: customerForm.notes.trim() || null,
        is_active: true,
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
        deleted_by_name: null,
        updated_at: new Date().toISOString(),
        updated_by: profile?.id || null,
      };

      if (editingCustomer) {
        const { error } = await supabase.from('finance_customers').update(payload).eq('id', editingCustomer.id);
        if (error) throw error;
        setToast({ message: 'Customer updated successfully.', type: 'success' });
      } else {
        const { error } = await supabase.from('finance_customers').insert([{ ...payload, created_by: profile?.id || null }]);
        if (error) throw error;
        setToast({ message: 'Customer added successfully.', type: 'success' });
      }

      setShowCustomerForm(false);
      setEditingCustomer(null);
      setCustomerForm(emptyCustomerForm());
      await loadHubData();
    } catch (error: any) {
      console.error('Failed to save customer:', error);
      setToast({ message: error.message || 'Failed to save customer.', type: 'error' });
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleImportCustomers = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rows = parseCsv(text);

      if (rows.length === 0) {
        setToast({ message: 'The import file has no customer rows.', type: 'warning' });
        return;
      }

      const scopedOrganizationId = organizationId || await resolveOrganizationId();
      if (!scopedOrganizationId) return;

      const timestampSuffix = Date.now().toString().slice(-4);

      const payload = rows
        .map((row, index) => {
          const customerName = findCsvValue(row, ['customer_name', 'name', 'customer']).trim();
          if (!customerName) return null;

          return {
            organization_id: scopedOrganizationId,
            account_number:
              findCsvValue(row, ['account_number', 'account', 'customer_a_c']).trim() ||
              `IMP-${timestampSuffix}-${index + 1}`,
            customer_name: customerName,
            service_group: findCsvValue(row, ['service_group', 'group', 'type_of_service']).trim() || null,
            ledger_name: findCsvValue(row, ['ledger_name', 'ledger', 'cost_center']).trim() || null,
            email: findCsvValue(row, ['email']).trim() || null,
            phone: findCsvValue(row, ['phone', 'mobile']).trim() || null,
            contact_person: findCsvValue(row, ['contact_person', 'contact']).trim() || null,
            opening_balance: toMoney(findCsvValue(row, ['opening_balance', 'take_on_balance', 'balance'])),
            billing_address: findCsvValue(row, ['billing_address', 'address']).trim() || null,
            notes: findCsvValue(row, ['notes']).trim() || null,
            is_active: true,
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
            deleted_by_name: null,
            created_by: profile?.id || null,
            updated_by: profile?.id || null,
          };
        })
        .filter(Boolean);

      if (payload.length === 0) {
        setToast({ message: 'No valid customer rows were found in the file.', type: 'warning' });
        return;
      }

      const importedGroups = Array.from(
        new Set(
          payload
            .map((row: any) => row.service_group)
            .filter(Boolean),
        ),
      );

      for (const groupName of importedGroups) {
        await ensureCustomerGroupExists(groupName, scopedOrganizationId);
      }

      const { error } = await supabase
        .from('finance_customers')
        .upsert(payload, { onConflict: 'organization_id,account_number' });

      if (error) throw error;

      setToast({ message: `${payload.length} customers imported successfully.`, type: 'success' });
      await loadHubData();
    } catch (error: any) {
      console.error('Failed to import customers:', error);
      setToast({ message: error.message || 'Failed to import customers.', type: 'error' });
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  };

  const openLandlordImportModal = () => {
    setLandlordImportSearch('');
    setSelectedLandlordImportIds([]);
    setShowLandlordImportModal(true);
  };

  const handleImportLandlords = async () => {
    const scopedOrganizationId = organizationId || await resolveOrganizationId();
    if (!scopedOrganizationId) return;

    const selectedLandlords = landlordImportCandidates.filter((landlord) => selectedLandlordImportIds.includes(landlord.id));
    if (selectedLandlords.length === 0) {
      setToast({ message: 'Select at least one landlord to import.', type: 'warning' });
      return;
    }

    setImportingLandlords(true);
    try {
      const payload = selectedLandlords.map((landlord, index) => ({
        organization_id: scopedOrganizationId,
        account_number: `LND-${landlord.id.substring(0, 8).toUpperCase()}`,
        customer_name: landlord.full_name?.trim() || landlord.login_username || `Landlord ${index + 1}`,
        service_group: 'Property Management',
        ledger_name: landlord.property?.name?.trim() || 'Hakika Landlords',
        email: landlord.email?.trim() || null,
        phone: landlord.phone?.trim() || null,
        contact_person: landlord.full_name?.trim() || null,
        opening_balance: 0,
        billing_address: null,
        notes: `Imported from Hakika landlord records${landlord.property?.name ? ` for ${landlord.property.name}` : ''}.`,
        is_active: true,
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
        deleted_by_name: null,
        created_by: profile?.id || null,
        updated_by: profile?.id || null,
      }));

      const { error } = await supabase
        .from('finance_customers')
        .upsert(payload, { onConflict: 'organization_id,account_number' });

      if (error) throw error;

      setToast({ message: `${selectedLandlords.length} landlord(s) imported successfully.`, type: 'success' });
      setShowLandlordImportModal(false);
      await loadHubData();
    } catch (error: any) {
      console.error('Failed to import landlords:', error);
      setToast({ message: error.message || 'Failed to import landlords.', type: 'error' });
    } finally {
      setImportingLandlords(false);
    }
  };

  const handleCustomerSms = async (includeBalances: boolean) => {
    const selectedCustomers = customers.filter((customer) => selectedCustomerIds.includes(customer.id));
    const withPhones = selectedCustomers.filter((customer) => customer.phone);

    if (withPhones.length === 0) {
      setToast({ message: 'Select at least one customer with a phone number.', type: 'warning' });
      return;
    }

    try {
      if (includeBalances) {
        for (const customer of withPhones) {
          const rollup = customerRollups[customer.id];
          const message = `Dear ${customer.customer_name}, your account balance is ${formatMoney(rollup?.accountBalance || 0)} and overdue amount is ${formatMoney(rollup?.amountOverdue || 0)}.`;
          const result = await sendBulkSms([customer.phone!], message);
          if (!result.success) {
            throw new Error(typeof result.error === 'string' ? result.error : 'Failed to send balance SMS.');
          }
        }
      } else {
        const result = await sendBulkSms(
          withPhones.map((customer) => customer.phone!).filter(Boolean),
          'Your customer account is active in the Hakika app. Contact accounts if you need invoice or balance assistance.',
        );
        if (!result.success) {
          throw new Error(typeof result.error === 'string' ? result.error : 'Failed to send SMS.');
        }
      }

      setToast({
        message: includeBalances ? 'Balance SMS sent to selected customers.' : 'SMS sent to selected customers.',
        type: 'success',
      });
    } catch (error: any) {
      console.error('Failed to send customer SMS:', error);
      setToast({ message: error.message || 'Failed to send customer SMS.', type: 'error' });
    }
  };

  const handleDeleteCustomers = async () => {
    const deletableCustomers = customers.filter(
      (customer) => selectedCustomerIds.includes(customer.id) && !customer.is_deleted,
    );

    if (deletableCustomers.length === 0) {
      setToast({ message: 'Select at least one customer to delete.', type: 'warning' });
      return;
    }

    if (!window.confirm(`Delete ${deletableCustomers.length} selected customer records?`)) return;

    try {
      const deletedAt = new Date().toISOString();
      const { error } = await supabase
        .from('finance_customers')
        .update({
          is_deleted: true,
          is_active: false,
          deleted_at: deletedAt,
          deleted_by: profile?.id || null,
          deleted_by_name: profile?.full_name || profile?.email || null,
          updated_at: deletedAt,
          updated_by: profile?.id || null,
        })
        .in('id', deletableCustomers.map((customer) => customer.id))
        .eq('is_deleted', false);

      if (error) throw error;

      setSelectedCustomerIds([]);
      setShowDeletedCustomers(true);
      setToast({ message: 'Selected customers deleted and tagged with audit details.', type: 'success' });
      await loadHubData();
    } catch (error: any) {
      console.error('Failed to delete customers:', error);
      setToast({ message: error.message || 'Failed to delete customers.', type: 'error' });
    }
  };

  const handleInvoiceSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!invoiceForm.customer_id) {
      setToast({ message: 'Choose a customer before saving the invoice.', type: 'warning' });
      return;
    }

    const validItems = invoiceForm.items.filter((item) => item.expense_item.trim() || item.description.trim() || item.particulars.trim());
    if (validItems.length === 0) {
      setToast({ message: 'Add at least one invoice line item.', type: 'warning' });
      return;
    }

    const scopedOrganizationId = organizationId || await resolveOrganizationId();
    if (!scopedOrganizationId) return;

    setSavingInvoice(true);

    try {
      const customer = customerMap[invoiceForm.customer_id];
      const subtotal = validItems.reduce((sum, item) => sum + toMoney(item.unit_cost) * toMoney(item.quantity), 0);
      const taxRate = toMoney(invoiceForm.tax_rate);
      const taxAmount = subtotal * (taxRate / 100);
      const totalAmount = subtotal + taxAmount;
      const carriedPaid = editingInvoice ? toMoney(editingInvoice.amount_paid) : 0;
      const resolvedDueDate = invoiceForm.recurring_enabled
        ? addRecurringIntervalIso(invoiceForm.invoice_date, invoiceForm.recurring_frequency)
        : invoiceForm.due_date || null;
      const resolvedStatus = resolveInvoiceStatusForSave(invoiceForm.status, resolvedDueDate || '', totalAmount, carriedPaid);
      const resolvedInvoiceNumber = invoiceForm.invoice_number.trim() || generateInvoiceNumber('FIN');
      const resolvedEntity = invoiceForm.entity.trim()
        || customer?.customer_name?.trim()
        || invoiceForm.bill_to.trim()
        || invoiceForm.transaction_class.trim()
        || 'Customer Invoice';
      const isRecurringTemplate = invoiceForm.recurring_enabled
        ? (editingInvoice?.is_recurring_template ?? true)
        : false;
      const recurringTemplateId = invoiceForm.recurring_enabled
        ? (editingInvoice?.is_recurring_template ? editingInvoice.id : editingInvoice?.recurring_template_id || null)
        : null;
      const nextGenerationDate = invoiceForm.recurring_enabled
        ? addRecurringIntervalIso(invoiceForm.invoice_date, invoiceForm.recurring_frequency)
        : null;

      const payload = {
          organization_id: scopedOrganizationId,
          customer_id: invoiceForm.customer_id,
        customer_name: customer?.customer_name || null,
        entity: resolvedEntity,
        invoice_number: resolvedInvoiceNumber,
        invoice_no: resolvedInvoiceNumber,
        transaction_class: invoiceForm.transaction_class,
        accounts_receivable_account: invoiceForm.accounts_receivable_account.trim() || null,
        description: invoiceForm.description.trim() || null,
        invoice_date: invoiceForm.invoice_date,
        due_date: resolvedDueDate,
        currency: invoiceForm.currency,
        etims_enabled: invoiceForm.etims_enabled,
        recurring_enabled: invoiceForm.recurring_enabled,
        recurring_frequency: invoiceForm.recurring_enabled ? invoiceForm.recurring_frequency : null,
        is_recurring_template: isRecurringTemplate,
        recurring_template_id: recurringTemplateId,
        next_generation_date: isRecurringTemplate ? nextGenerationDate : null,
        tax_rate: taxRate,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        status: resolvedStatus,
        bill_to: invoiceForm.bill_to.trim() || customer?.billing_address || customer?.customer_name || null,
        notes: invoiceForm.notes.trim() || null,
        updated_at: new Date().toISOString(),
        updated_by: profile?.id || null,
      };

        let invoiceId = editingInvoice?.id || '';

        if (editingInvoice) {
          let workingPayload = payload;
          let { error } = await supabase.from('finance_invoices').update(workingPayload).eq('id', editingInvoice.id);

          while (error) {
            const { nextPayload, removedColumn } = removeMissingLegacyInvoiceColumns(workingPayload, error);
            if (!removedColumn) break;
            workingPayload = nextPayload;
            ({ error } = await supabase.from('finance_invoices').update(workingPayload).eq('id', editingInvoice.id));
          }

          if (error) throw error;

          const { error: deleteItemsError } = await supabase
            .from('finance_invoice_items')
          .delete()
          .eq('invoice_id', editingInvoice.id);

        if (deleteItemsError) throw deleteItemsError;
        invoiceId = editingInvoice.id;
        } else {
          let workingPayload = payload;
          let invoiceNumberRetryCount = 0;
          let { data, error } = await supabase
            .from('finance_invoices')
            .insert([{ ...workingPayload, created_by: profile?.id || null }])
            .select('id')
            .single();

          while (error) {
            if (isDuplicateInvoiceNumberError(error) && invoiceNumberRetryCount < 5) {
              invoiceNumberRetryCount += 1;
              const nextInvoiceNumber = generateInvoiceNumber('FIN');
              workingPayload = {
                ...workingPayload,
                invoice_number: nextInvoiceNumber,
                ...(typeof workingPayload.invoice_no === 'string' ? { invoice_no: nextInvoiceNumber } : {}),
              };
              setInvoiceForm((current) => ({ ...current, invoice_number: nextInvoiceNumber }));
              ({ data, error } = await supabase
                .from('finance_invoices')
                .insert([{ ...workingPayload, created_by: profile?.id || null }])
                .select('id')
                .single());
              continue;
            }

            const { nextPayload, removedColumn } = removeMissingLegacyInvoiceColumns(workingPayload, error);
            if (!removedColumn) break;
            workingPayload = nextPayload;
            ({ data, error } = await supabase
              .from('finance_invoices')
              .insert([{ ...workingPayload, created_by: profile?.id || null }])
              .select('id')
              .single());
          }

          if (error) throw error;
          if (!data) throw new Error('Failed to retrieve invoice ID after creation.');
          invoiceId = data.id;

          if (invoiceForm.recurring_enabled) {
            const { error: recurringTemplateError } = await supabase
              .from('finance_invoices')
              .update({
                is_recurring_template: true,
                recurring_template_id: invoiceId,
                next_generation_date: nextGenerationDate,
                updated_at: new Date().toISOString(),
                updated_by: profile?.id || null,
              })
              .eq('id', invoiceId);

            if (recurringTemplateError && !isMissingColumnError(recurringTemplateError, 'is_recurring_template')) {
              throw recurringTemplateError;
            }
          }
      }

      const itemPayload = validItems.map((item, index) => ({
        invoice_id: invoiceId,
        expense_item: item.expense_item.trim() || item.description.trim() || item.particulars.trim() || 'Service Item',
        description: item.description.trim() || item.particulars.trim() || item.expense_item.trim() || 'Service Item',
        particulars: item.particulars.trim() || item.description.trim() || null,
        income_account: item.income_account.trim() || null,
        unit_cost: toMoney(item.unit_cost),
        quantity: toMoney(item.quantity) || 1,
        display_order: index,
      }));

      let workingItemPayload = itemPayload;
      let { error: itemsError } = await supabase.from('finance_invoice_items').insert(workingItemPayload);

      while (itemsError) {
        const nextPayload = workingItemPayload.map((row) => removeMissingLegacyInvoiceItemColumns(row, itemsError).nextPayload);
        const removedColumn = nextPayload.some((row, index) => Object.keys(row).length !== Object.keys(workingItemPayload[index]).length);
        if (!removedColumn) break;
        workingItemPayload = nextPayload;
        ({ error: itemsError } = await supabase.from('finance_invoice_items').insert(workingItemPayload));
      }

      if (itemsError) throw itemsError;

      setToast({ message: editingInvoice ? 'Invoice updated successfully.' : 'Invoice created successfully.', type: 'success' });
      resetInvoiceComposer();
      setFocusedInvoiceId(invoiceId);
      await loadHubData();
    } catch (error: any) {
      console.error('Failed to save invoice:', error);
      setToast({ message: error.message || 'Failed to save invoice.', type: 'error' });
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleDeleteInvoices = async () => {
    if (selectedInvoiceIds.length === 0) {
      setToast({ message: 'Select at least one invoice to delete.', type: 'warning' });
      return;
    }

    if (!window.confirm(`Delete ${selectedInvoiceIds.length} selected invoices?`)) return;

    try {
      const { error } = await supabase.from('finance_invoices').delete().in('id', selectedInvoiceIds);
      if (error) throw error;
      setSelectedInvoiceIds([]);
      setFocusedInvoiceId(null);
      setToast({ message: 'Selected invoices deleted.', type: 'success' });
      await loadHubData();
    } catch (error: any) {
      console.error('Failed to delete invoices:', error);
      setToast({ message: error.message || 'Failed to delete invoices.', type: 'error' });
    }
  };

  const handleInvoiceEmail = async () => {
    const selected = invoices.filter((invoice) => selectedInvoiceIds.includes(invoice.id));
    if (selected.length === 0) {
      setToast({ message: 'Select at least one invoice to email.', type: 'warning' });
      return;
    }

    try {
      for (const invoice of selected) {
        const customer = invoice.customer_id ? customerMap[invoice.customer_id] : null;
        if (!customer?.email) continue;

        const items = invoiceItemsByInvoice[invoice.id] || [];
        const itemsMarkup = items
          .map((item) => `<li>${getInvoiceItemName(item)}: ${formatMoney(item.line_total, invoice.currency)}</li>`)
          .join('');

          const response = await sendEmail({
            to: customer.email,
            subject: `Invoice ${getInvoiceNumber(invoice)}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px;">
              <h2 style="margin-bottom: 8px;">Invoice ${getInvoiceNumber(invoice)}</h2>
                <p>Customer: <strong>${customer.customer_name}</strong></p>
              <p>Transaction Class: <strong>${invoice.transaction_class}</strong></p>
              <p>Invoice Date: ${invoice.invoice_date}</p>
              <p>Due Date: ${invoice.due_date || '-'}</p>
              <p>Total: <strong>${formatMoney(invoice.total_amount, invoice.currency)}</strong></p>
              <p>Balance Due: <strong>${formatMoney(Math.max(0, invoice.total_amount - invoice.amount_paid), invoice.currency)}</strong></p>
              <h3 style="margin-top: 20px;">Invoice Items</h3>
              <ul>${itemsMarkup || '<li>Invoice line items are attached in the system.</li>'}</ul>
            </div>
          `,
          });

          if (!response.success) {
          throw new Error(response.error || `Failed to email invoice ${getInvoiceNumber(invoice)}.`);
          }
      }

      setToast({ message: 'Selected invoices emailed successfully.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to email invoices:', error);
      setToast({ message: error.message || 'Failed to email invoices.', type: 'error' });
    }
  };

  const handleInvoiceSms = async () => {
    const selected = invoices.filter((invoice) => selectedInvoiceIds.includes(invoice.id));
    if (selected.length === 0) {
      setToast({ message: 'Select at least one invoice to SMS.', type: 'warning' });
      return;
    }

    try {
        for (const invoice of selected) {
          const customer = invoice.customer_id ? customerMap[invoice.customer_id] : null;
          if (!customer?.phone) continue;

          const balance = Math.max(0, toMoney(invoice.total_amount) - toMoney(invoice.amount_paid));
        const message = `${customer.customer_name}, invoice ${getInvoiceNumber(invoice)} for ${formatMoney(invoice.total_amount, invoice.currency)} is now available. Balance due: ${formatMoney(balance, invoice.currency)}.`;
          const result = await sendBulkSms([customer.phone], message);
          if (!result.success) {
          throw new Error(typeof result.error === 'string' ? result.error : `Failed to SMS invoice ${getInvoiceNumber(invoice)}.`);
          }
        }

      setToast({ message: 'Selected invoices sent by SMS.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to send invoice SMS:', error);
      setToast({ message: error.message || 'Failed to send invoice SMS.', type: 'error' });
    }
  };

  const saveReceipt = useCallback(async (printAfterSave = false) => {
    if (!receiptForm.amount || toMoney(receiptForm.amount) <= 0) {
      setToast({ message: 'Enter a valid receipt amount.', type: 'warning' });
      return;
    }

    if (!receiptForm.receipt_number.trim()) {
      setToast({ message: 'Receipt number is required to issue a receipt.', type: 'warning' });
      return;
    }

    const scopedOrganizationId = organizationId || await resolveOrganizationId();
    if (!scopedOrganizationId) return;

    const linkedInvoice = receiptForm.invoice_id ? invoiceMap[receiptForm.invoice_id] : null;
    const linkedCustomerId = receiptForm.customer_id || linkedInvoice?.customer_id || '';
    const linkedCustomer = linkedCustomerId ? customerMap[linkedCustomerId] : null;
    const depositAccount = resolveReceiptDepositAccount(receiptForm.deposit_account_id, bankAccounts);
    const amount = toMoney(receiptForm.amount);
    const balanceDue = linkedInvoice ? Math.max(0, toMoney(linkedInvoice.total_amount) - toMoney(linkedInvoice.amount_paid)) : 0;

    if (linkedInvoice && amount > balanceDue + 0.01) {
      setToast({ message: 'Receipt amount cannot exceed the selected invoice balance.', type: 'warning' });
      return;
    }

    if (!depositAccount) {
      setToast({ message: 'Select the bank, cash, or wallet account that received this receipt.', type: 'warning' });
      return;
    }

    if (normalizeText(receiptForm.payment_method).includes('cheque') && !receiptForm.cheque_number.trim()) {
      setToast({ message: 'Enter the cheque number before posting a cheque receipt.', type: 'warning' });
      return;
    }

    setSavingReceipt(true);

    let createdReceipt: FinanceReceipt | null = null;
    let bankBalanceAdjusted = false;
    let invoiceBalanceAdjusted = false;

    try {
      const payload = {
        organization_id: scopedOrganizationId,
        receipt_number: receiptForm.receipt_number.trim(),
        receipt_date: receiptForm.receipt_date,
        source_module: 'Finance',
        amount,
        description: linkedInvoice ? `Receipt for invoice ${getInvoiceNumber(linkedInvoice)}` : 'Customer receipt',
        category: linkedInvoice?.transaction_class || 'Customer Receipt',
        payment_method: receiptForm.payment_method,
        customer_id: linkedCustomerId || null,
        invoice_id: linkedInvoice?.id || null,
        deposit_account_id: depositAccount.id,
        deposit_account_type: depositAccount.account_kind,
        currency: receiptForm.currency,
        cheque_number: receiptForm.cheque_number.trim() || null,
        received_from: receiptForm.received_from.trim() || linkedCustomer?.customer_name || null,
        notes: receiptForm.notes.trim() || null,
        posted_by: profile?.id || null,
      };

      const { data: receiptData, error } = await supabase.from('finance_receipts').insert([payload]).select('*').single();
      if (error) throw error;
      createdReceipt = (receiptData || null) as FinanceReceipt | null;

      const nextAccountBalance = toMoney(depositAccount.current_balance) + amount;
      const { error: bankAccountError } = await updateDepositAccountBalance(depositAccount, nextAccountBalance);

      if (bankAccountError) throw bankAccountError;
      bankBalanceAdjusted = true;

      if (linkedInvoice) {
        const nextPaid = toMoney(linkedInvoice.amount_paid) + amount;
        const nextStatus = resolveInvoiceStatusForSave(linkedInvoice.status, linkedInvoice.due_date || '', toMoney(linkedInvoice.total_amount), nextPaid);

        const { error: invoiceError } = await supabase
          .from('finance_invoices')
          .update({
            amount_paid: nextPaid,
            status: nextStatus,
            updated_at: new Date().toISOString(),
            updated_by: profile?.id || null,
          })
          .eq('id', linkedInvoice.id);

        if (invoiceError) throw invoiceError;
        invoiceBalanceAdjusted = true;
      }

      setToast({ message: 'Receipt posted successfully.', type: 'success' });
      setShowReceiptForm(false);
      setReceiptForm(emptyReceiptForm());
      await loadHubData();

      if (printAfterSave && createdReceipt) {
        handlePrintReceipt(createdReceipt);
      }
    } catch (error: any) {
      console.error('Failed to save receipt:', error);

      if (invoiceBalanceAdjusted && linkedInvoice) {
        try {
          const originalPaid = toMoney(linkedInvoice.amount_paid);
          const originalStatus = resolveInvoiceStatusForSave(
            linkedInvoice.status,
            linkedInvoice.due_date || '',
            toMoney(linkedInvoice.total_amount),
            originalPaid,
          );

          await supabase
            .from('finance_invoices')
            .update({
              amount_paid: originalPaid,
              status: originalStatus,
              updated_at: new Date().toISOString(),
              updated_by: profile?.id || null,
            })
            .eq('id', linkedInvoice.id);
        } catch (revertError) {
          console.error('Failed to revert invoice after receipt save error:', revertError);
        }
      }

      if (bankBalanceAdjusted) {
        try {
          const nextAccountBalance = toMoney(depositAccount.current_balance);
          await updateDepositAccountBalance(depositAccount, nextAccountBalance);
        } catch (revertError) {
          console.error('Failed to revert bank balance after receipt save error:', revertError);
        }
      }

      if (createdReceipt) {
        try {
          await supabase.from('finance_receipts').delete().eq('id', createdReceipt.id);
        } catch (cleanupError) {
          console.error('Failed to remove partially saved receipt:', cleanupError);
        }
      }

      setToast({ message: error.message || 'Failed to save receipt.', type: 'error' });
    } finally {
      setSavingReceipt(false);
    }
  }, [bankAccountMap, customerMap, handlePrintReceipt, invoiceMap, loadHubData, organizationId, profile?.id, receiptForm, resolveOrganizationId, setToast]);

  const handleReceiptSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await saveReceipt(false);
  };

  const handleIssueReceipt = async () => {
    await saveReceipt(true);
  };

  const handleDeleteReceipt = async (receipt: FinanceReceipt) => {
    if (!window.confirm('Delete this receipt entry?')) return;

    const linkedInvoice = receipt.invoice_id ? invoiceMap[receipt.invoice_id] : null;
    const depositAccount = receipt.deposit_account_id ? bankAccountMap[receipt.deposit_account_id] : null;
    const receiptAmount = toMoney(receipt.amount);
    let invoiceAdjusted = false;
    let bankAdjusted = false;

    try {
      if (linkedInvoice) {
        const nextPaid = Math.max(0, toMoney(linkedInvoice.amount_paid) - receiptAmount);
        const nextStatus = resolveInvoiceStatusForSave(
          linkedInvoice.status,
          linkedInvoice.due_date || '',
          toMoney(linkedInvoice.total_amount),
          nextPaid,
        );

        const { error: invoiceError } = await supabase
          .from('finance_invoices')
          .update({
            amount_paid: nextPaid,
            status: nextStatus,
            updated_at: new Date().toISOString(),
            updated_by: profile?.id || null,
          })
          .eq('id', linkedInvoice.id);

        if (invoiceError) throw invoiceError;
        invoiceAdjusted = true;
      }

      if (depositAccount) {
        const nextBalance = Math.max(0, toMoney(depositAccount.current_balance) - receiptAmount);
        const { error: bankError } = await updateDepositAccountBalance(depositAccount, nextBalance);

        if (bankError) throw bankError;
        bankAdjusted = true;
      }

      const { error } = await supabase.from('finance_receipts').delete().eq('id', receipt.id);
      if (error) throw error;
      setToast({ message: 'Receipt deleted.', type: 'success' });
      await loadHubData();
    } catch (error: any) {
      console.error('Failed to delete receipt:', error);

      if (invoiceAdjusted && linkedInvoice) {
        try {
          const originalPaid = toMoney(linkedInvoice.amount_paid);
          const originalStatus = resolveInvoiceStatusForSave(
            linkedInvoice.status,
            linkedInvoice.due_date || '',
            toMoney(linkedInvoice.total_amount),
            originalPaid,
          );

          await supabase
            .from('finance_invoices')
            .update({
              amount_paid: originalPaid,
              status: originalStatus,
              updated_at: new Date().toISOString(),
              updated_by: profile?.id || null,
            })
            .eq('id', linkedInvoice.id);
        } catch (revertError) {
          console.error('Failed to revert invoice after receipt delete error:', revertError);
        }
      }

      if (bankAdjusted && depositAccount) {
        try {
          const originalBalance = toMoney(depositAccount.current_balance);
          await updateDepositAccountBalance(depositAccount, originalBalance);
        } catch (revertError) {
          console.error('Failed to revert bank balance after receipt delete error:', revertError);
        }
      }

      setToast({ message: error.message || 'Failed to delete receipt.', type: 'error' });
    }
  };

  const allFilteredCustomersSelected =
    selectableFilteredCustomers.length > 0
    && selectableFilteredCustomers.every((customer) => selectedCustomerIds.includes(customer.id));
  const allFilteredInvoicesSelected = filteredInvoices.length > 0 && filteredInvoices.every((invoice) => selectedInvoiceIds.includes(invoice.id));

  if (loading) {
    return (
        <div className="h-full flex items-center justify-center">
          <CustomLoader size={42} label="Loading customer hub..." />
        </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6 bg-slate-50 p-6 dark:bg-dark-surface">
      {toast ? <CustomToast message={toast.message} type={toast.type} isVisible onClose={() => setToast(null)} /> : null}
      <input ref={importRef} type="file" accept=".csv" onChange={handleImportCustomers} className="hidden" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-brand-purple">Consolidated Accounts</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900 dark:text-white">Customer Hub</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-300">
            Customer onboarding, invoice generation, and receipting for finance and security operations.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={loadHubData} className={mutedButtonCls}>
            <RefreshCcw size={16} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'customers') openCreateCustomerForm();
              if (activeTab === 'invoices') openCreateInvoiceForm();
              if (activeTab === 'receipts') openReceiptForm();
            }}
            className={primaryButtonCls}
          >
            <Plus size={16} />
            {activeTab === 'customers' ? 'Add Customer' : activeTab === 'invoices' ? 'Add Invoice' : 'Post Receipt'}
          </button>
        </div>
      </div>
      {organizationNotice ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          {organizationNotice}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <SummaryCard icon={UserRound} label="Active Customers" value={String(activeCustomers.length)} accent="text-blue-600" />
        <SummaryCard icon={FileSpreadsheet} label="Outstanding Invoices" value={formatMoney(totalOutstanding)} accent="text-amber-600" />
        <SummaryCard icon={Wallet} label="Overdue Amount" value={formatMoney(overdueTotal)} accent="text-rose-600" />
        <SummaryCard icon={Receipt} label="Receipts Posted" value={formatMoney(receiptTotal)} accent="text-emerald-600" />
      </div>
      <div className={`${panelCls} p-2`}>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <TabButton active={activeTab === 'customers'} label="Customers" icon={Building2} onClick={() => setActiveTab('customers')} />
          <TabButton active={activeTab === 'invoices'} label="Invoices" icon={FileSpreadsheet} onClick={() => setActiveTab('invoices')} />
          <TabButton active={activeTab === 'receipts'} label="Receipts" icon={CreditCard} onClick={() => setActiveTab('receipts')} />
        </div>
      </div>
      {activeTab === 'customers' ? (
        <div className="space-y-6">
          <div className={panelCls}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                <input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search customer, account, ledger, email or phone..." className={`${inputCls} pl-10`} />
              </div>
              <select value={customerGroupFilter} onChange={(event) => setCustomerGroupFilter(event.target.value)} className={inputCls}>
                <option value="all">All service groups</option>
                {customerGroups.map((group) => (
                  <option key={group.id} value={group.name}>{group.name}</option>
                ))}
              </select>
              <button type="button" onClick={resetCustomerFilters} className={mutedButtonCls}>Reset</button>
              <button type="button" onClick={() => setShowDeletedCustomers((current) => !current)} className={mutedButtonCls}>
                {showDeletedCustomers ? 'Hide Deleted' : 'Show Deleted'}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={openCreateCustomerForm} className={primaryButtonCls}><Plus size={16} />Add Customer</button>
              <button type="button" onClick={() => importRef.current?.click()} className={mutedButtonCls}><Upload size={16} />Import Customer</button>
              <button type="button" onClick={openLandlordImportModal} className={mutedButtonCls}><Building2 size={16} />Import Landlords</button>
              <button type="button" onClick={() => handleCustomerSms(false)} className={mutedButtonCls}><Phone size={16} />SMS Selected Customer</button>
              <button type="button" onClick={() => handleCustomerSms(true)} className={mutedButtonCls}><Send size={16} />SMS Selected Balance</button>
              <button type="button" onClick={handleDeleteCustomers} className={mutedButtonCls}><Trash2 size={16} />Delete Customer</button>
              <button type="button" onClick={() => printWorkspacePage()} className={mutedButtonCls}><Printer size={16} />Print</button>
            </div>
          </div>
          {showCustomerForm ? (
            <div className={panelCls}>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Capture the customer account, grouping, ledger, and take-on balance used in billing.</p>
                </div>
                <button type="button" onClick={() => { setShowCustomerForm(false); setEditingCustomer(null); setCustomerForm(emptyCustomerForm()); }} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-[#1e293b] dark:hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleCustomerSubmit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Customer A/C #"><input value={customerForm.account_number} onChange={(event) => setCustomerForm((current) => ({ ...current, account_number: event.target.value }))} className={inputCls} /></Field>
                <Field label="Customer Name"><input value={customerForm.customer_name} onChange={(event) => setCustomerForm((current) => ({ ...current, customer_name: event.target.value }))} className={inputCls} required /></Field>
                <Field label="Customer Grouping">
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <select value={customerForm.service_group} onChange={(event) => setCustomerForm((current) => ({ ...current, service_group: event.target.value }))} className={inputCls}>
                        {customerGroups.map((group) => <option key={group.id} value={group.name}>{group.name}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowAddCustomerGroup((current) => !current)}
                        className="inline-flex items-center justify-center rounded-xl border border-blue-300 px-4 text-blue-600 hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-500/10"
                        title="Add new customer grouping"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    {showAddCustomerGroup ? (
                      <div className="flex gap-2">
                        <input
                          value={newCustomerGroupName}
                          onChange={(event) => setNewCustomerGroupName(event.target.value)}
                          placeholder="New grouping name"
                          className={inputCls}
                        />
                        <button type="button" onClick={handleAddCustomerGroup} disabled={savingCustomerGroup} className={primaryButtonCls}>
                          {savingCustomerGroup ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddCustomerGroup(false);
                            setNewCustomerGroupName('');
                          }}
                          className={mutedButtonCls}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}
                  </div>
                </Field>
                <Field label="Ledger / Cost Center"><input value={customerForm.ledger_name} onChange={(event) => setCustomerForm((current) => ({ ...current, ledger_name: event.target.value }))} className={inputCls} /></Field>
                <Field label="Email"><input type="email" value={customerForm.email} onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))} className={inputCls} /></Field>
                <Field label="Phone"><input value={customerForm.phone} onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))} className={inputCls} /></Field>
                <Field label="Contact Person"><input value={customerForm.contact_person} onChange={(event) => setCustomerForm((current) => ({ ...current, contact_person: event.target.value }))} className={inputCls} /></Field>
                <Field label="Take On Balance"><input type="number" min="0" step="0.01" value={customerForm.opening_balance} onChange={(event) => setCustomerForm((current) => ({ ...current, opening_balance: event.target.value }))} className={inputCls} /></Field>
                <Field label="Billing Address"><input value={customerForm.billing_address} onChange={(event) => setCustomerForm((current) => ({ ...current, billing_address: event.target.value }))} className={inputCls} /></Field>
                <Field label="Notes" className="md:col-span-2 xl:col-span-3"><textarea value={customerForm.notes} onChange={(event) => setCustomerForm((current) => ({ ...current, notes: event.target.value }))} className={`${inputCls} min-h-[110px]`} /></Field>
                <div className="flex flex-wrap gap-3 md:col-span-2 xl:col-span-3">
                  <button type="submit" disabled={savingCustomer} className={primaryButtonCls}>{savingCustomer ? 'Saving...' : editingCustomer ? 'Update Customer' : 'Save Customer'}</button>
                  <button type="button" onClick={() => { setShowCustomerForm(false); setEditingCustomer(null); setCustomerForm(emptyCustomerForm()); }} className={mutedButtonCls}>Cancel</button>
                </div>
              </form>
            </div>
          ) : null}
          <div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white/95 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur-sm dark:border-white/10 dark:bg-dark-surface/90">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5">
                  <tr>
                    <th className="px-4 py-4 text-left"><input type="checkbox" checked={allFilteredCustomersSelected} disabled={selectableFilteredCustomers.length === 0} onChange={(event) => setSelectedCustomerIds(event.target.checked ? selectableFilteredCustomers.map((customer) => customer.id) : [])} /></th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Customer A/C #</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Name</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Service Group</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Ledger</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Email</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Status</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">All Invoices</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Cleared</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Pending</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">A/C Balance</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Amount Overdue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-[#1e293b]">
                  {filteredCustomers.map((customer) => {
                    const rollup = customerRollups[customer.id];
                    return (
                      <tr key={customer.id} className={customer.is_deleted ? 'bg-rose-50/70 opacity-80 dark:bg-rose-500/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'}>
                        <td className="px-4 py-4"><input type="checkbox" disabled={customer.is_deleted} checked={selectedCustomerIds.includes(customer.id)} onChange={(event) => setSelectedCustomerIds((current) => event.target.checked ? [...current, customer.id] : current.filter((id) => id !== customer.id))} /></td>
                        <td className="px-4 py-4 font-mono text-sm text-blue-600 dark:text-blue-300">{customer.account_number}</td>
                        <td className="px-4 py-4">
                          {customer.is_deleted ? (
                            <span className="text-left font-semibold text-gray-500 dark:text-gray-300">{customer.customer_name}</span>
                          ) : (
                            <button type="button" onClick={() => openEditCustomerForm(customer)} className="text-left font-semibold text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-300">{customer.customer_name}</button>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200">{customer.service_group || '-'}</td>
                        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200">{customer.ledger_name || '-'}</td>
                        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200">{customer.email || '-'}</td>
                        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${customer.is_deleted ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'}`}>
                            {customer.is_deleted ? 'Deleted' : 'Active'}
                          </span>
                          {customer.is_deleted ? (
                            <div className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                              <div>By {customer.deleted_by_name || 'Unknown user'}</div>
                              <div>On {formatDateTime(customer.deleted_at)}</div>
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-sm font-semibold text-gray-900 dark:text-white">{rollup?.totalInvoices || 0}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-emerald-600 dark:text-emerald-400">{rollup?.clearedInvoices || 0}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-amber-600 dark:text-amber-400">{rollup?.pendingInvoices || 0}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-gray-900 dark:text-white">{formatMoney(rollup?.accountBalance || 0)}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-rose-600 dark:text-rose-400">{formatMoney(rollup?.amountOverdue || 0)}</td>
                      </tr>
                    );
                  })}
                  {filteredCustomers.length === 0 ? <tr><td colSpan={12} className="px-6 py-20 text-center text-sm text-gray-500 dark:text-gray-400">No customers match the current filters.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
          {showLandlordImportModal ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
              <div className={`${panelCls} w-full max-w-5xl`}>
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white">Import Landlords</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Choose landlords from Hakika and bring them into the finance customer hub.</p>
                  </div>
                  <button type="button" onClick={() => setShowLandlordImportModal(false)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white">
                    <X size={18} />
                  </button>
                </div>

                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                    <input
                      value={landlordImportSearch}
                      onChange={(event) => setLandlordImportSearch(event.target.value)}
                      placeholder="Search landlord, property, email, or phone..."
                      className={`${inputCls} pl-10`}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSelectedLandlordImportIds(landlordImportCandidates.map((landlord) => landlord.id))} className={mutedButtonCls}>Select All</button>
                    <button type="button" onClick={() => setSelectedLandlordImportIds([])} className={mutedButtonCls}>Clear</button>
                  </div>
                </div>

                <div className="max-h-[55vh] overflow-auto rounded-2xl border border-gray-200 dark:border-white/10">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-white/5">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-gray-500">Select</th>
                        <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-gray-500">Landlord</th>
                        <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-gray-500">Contact</th>
                        <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-gray-500">Property</th>
                      </tr>
                    </thead>
                    <tbody>
                      {landlordImportCandidates
                        .filter((landlord) => {
                          const haystack = [
                            landlord.full_name,
                            landlord.email,
                            landlord.phone,
                            landlord.login_username,
                            landlord.property?.name,
                          ].filter(Boolean).join(' ').toLowerCase();
                          return haystack.includes(landlordImportSearch.toLowerCase());
                        })
                        .map((landlord) => {
                          const selected = selectedLandlordImportIds.includes(landlord.id);
                          return (
                            <tr key={landlord.id} className="border-t border-gray-100 dark:border-white/5">
                              <td className="px-4 py-4">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={(event) => {
                                    setSelectedLandlordImportIds((current) =>
                                      event.target.checked
                                        ? [...current, landlord.id]
                                        : current.filter((id) => id !== landlord.id),
                                    );
                                  }}
                                />
                              </td>
                              <td className="px-4 py-4 text-sm font-semibold text-gray-900 dark:text-white">{landlord.full_name || 'Unnamed landlord'}</td>
                              <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                                <div>{landlord.email || 'No email'}</div>
                                <div>{landlord.phone || 'No phone'}</div>
                              </td>
                              <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{landlord.property?.name || 'No property'}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedLandlordImportIds.length} landlord(s) selected.</p>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setShowLandlordImportModal(false)} className={mutedButtonCls}>Cancel</button>
                    <button type="button" onClick={handleImportLandlords} disabled={importingLandlords} className={primaryButtonCls}>
                      {importingLandlords ? 'Importing...' : 'Import Selected'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {activeTab === 'invoices' ? (
        <div className="space-y-6">
          <div className={panelCls}>
            <div className="grid gap-4 lg:grid-cols-5">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                <input value={invoiceFilters.search} onChange={(event) => setInvoiceFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Invoice #, customer, receivable account..." className={`${inputCls} pl-10`} />
              </div>
              <select value={invoiceFilters.customerId} onChange={(event) => setInvoiceFilters((current) => ({ ...current, customerId: event.target.value }))} className={inputCls}>
                <option value="all">All customers</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.customer_name}{customer.is_deleted ? ' (Deleted)' : ''}</option>)}
              </select>
              <select value={invoiceFilters.transactionClass} onChange={(event) => setInvoiceFilters((current) => ({ ...current, transactionClass: event.target.value }))} className={inputCls}>
                <option value="all">All transaction classes</option>
                {Array.from(new Set(invoices.map((invoice) => invoice.transaction_class).filter(Boolean))).map((transactionClass) => <option key={transactionClass} value={transactionClass}>{transactionClass}</option>)}
              </select>
              <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white/80 px-4 py-3 text-sm text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                <input type="checkbox" checked={invoiceFilters.recurringOnly} onChange={(event) => setInvoiceFilters((current) => ({ ...current, recurringOnly: event.target.checked }))} />
                Recurring invoices only
              </label>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <Field label="From Date"><input type="date" value={invoiceFilters.dateFrom} onChange={(event) => setInvoiceFilters((current) => ({ ...current, dateFrom: event.target.value }))} className={inputCls} /></Field>
              <Field label="To Date"><input type="date" value={invoiceFilters.dateTo} onChange={(event) => setInvoiceFilters((current) => ({ ...current, dateTo: event.target.value }))} className={inputCls} /></Field>
              <Field label="Search / Reset"><div className="flex gap-3"><button type="button" onClick={resetInvoiceFilters} className={mutedButtonCls}>Reset</button><button type="button" onClick={openCreateInvoiceForm} className={primaryButtonCls}><Plus size={16} />Add Invoice</button></div></Field>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={handleDeleteInvoices} className={mutedButtonCls}><Trash2 size={16} />Delete Invoice</button>
              <button type="button" onClick={() => { const selected = invoices.filter((invoice) => selectedInvoiceIds.includes(invoice.id)); if (selected.length !== 1) { setToast({ message: 'Select one invoice to receipt.', type: 'warning' }); return; } openReceiptForm(selected[0]); }} className={mutedButtonCls}><Receipt size={16} />Receipt Selected Invoice</button>
              <button type="button" onClick={handleInvoiceEmail} className={mutedButtonCls}><Mail size={16} />Email Selected Invoice</button>
              <button type="button" onClick={handleInvoiceSms} className={mutedButtonCls}><Phone size={16} />SMS Selected Invoice</button>
            </div>
          </div>
          {showInvoiceForm ? (
            <div className={panelCls}>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{editingInvoice ? 'Invoice Details' : 'Add Invoice'}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Define the transaction class, receivable account, eTIMS flag, and as many invoice lines as needed.</p>
                </div>
                <button type="button" onClick={resetInvoiceComposer} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-[#1e293b] dark:hover:text-white"><X size={18} /></button>
              </div>
              <form onSubmit={handleInvoiceSubmit} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Entity / App">
                    <div className="space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                        <div className="min-w-0 flex-1">
                          <select
                            value={invoiceEntityOptions.includes(invoiceForm.entity) ? invoiceForm.entity : invoiceForm.entity || ''}
                            onChange={(event) => setInvoiceForm((current) => ({ ...current, entity: event.target.value }))}
                            className={inputCls}
                          >
                            <option value="">Select entity</option>
                            {!invoiceEntityOptions.includes(invoiceForm.entity) && invoiceForm.entity ? (
                              <option value={invoiceForm.entity}>{invoiceForm.entity} (current)</option>
                            ) : null}
                            {invoiceEntityOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddInvoiceEntity((current) => !current);
                              setNewInvoiceEntityName(invoiceForm.entity || '');
                              setReferenceOptionDeleteTarget(null);
                            }}
                            className="inline-flex items-center justify-center rounded-xl border border-blue-300 px-4 text-blue-600 hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-500/10"
                            title="Add new entity"
                          >
                            <Plus size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => selectedInvoiceEntityReference && setReferenceOptionDeleteTarget({
                              optionType: 'entity',
                              optionValue: selectedInvoiceEntityReference.option_value,
                            })}
                            className="inline-flex items-center justify-center rounded-xl border border-rose-300 px-4 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
                            title="Delete selected entity"
                            disabled={!selectedInvoiceEntityReference}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      {showAddInvoiceEntity ? (
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                          <input
                            value={newInvoiceEntityName}
                            onChange={(event) => setNewInvoiceEntityName(event.target.value)}
                            placeholder="New entity or app"
                            className={inputCls}
                          />
                          <button type="button" onClick={() => void handleAddInvoiceEntity()} className={primaryButtonCls} disabled={savingInvoiceEntity}>
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddInvoiceEntity(false);
                              setNewInvoiceEntityName('');
                            }}
                            className={mutedButtonCls}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          Saved entities appear in the dropdown below and can be reused on future invoices.
                        </p>
                      )}
                    </div>
                  </Field>
                  <Field label="Transaction Class">
                    <div className="space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                        <div className="min-w-0 flex-1">
                          <select value={invoiceForm.transaction_class} onChange={(event) => setInvoiceForm((current) => ({ ...current, transaction_class: event.target.value }))} className={inputCls}>
                            {transactionClassOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={openAddTransactionClass}
                          className="inline-flex items-center justify-center rounded-xl border border-blue-300 px-4 text-blue-600 hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-500/10"
                          title="Add transaction class"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      {showAddTransactionClass ? (
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                          <input
                            value={newTransactionClassName}
                            onChange={(event) => setNewTransactionClassName(event.target.value)}
                            placeholder="New transaction class"
                            className={inputCls}
                          />
                          <button type="button" onClick={() => void handleAddTransactionClass()} className={primaryButtonCls}>Save</button>
                          <button type="button" onClick={() => { setShowAddTransactionClass(false); setNewTransactionClassName(''); }} className={mutedButtonCls}>Cancel</button>
                        </div>
                      ) : null}
                    </div>
                  </Field>
                  <Field label="Customer Name"><select value={invoiceForm.customer_id} onChange={(event) => { const customer = customerMap[event.target.value]; setInvoiceForm((current) => ({ ...current, customer_id: event.target.value, bill_to: current.bill_to || customer?.billing_address || customer?.customer_name || '' })); }} className={inputCls} required><option value="">Select customer</option>{invoiceCustomerOptions.map((customer) => <option key={customer.id} value={customer.id}>{customer.customer_name}{customer.is_deleted ? ' (Deleted)' : ''}</option>)}</select></Field>
                  <Field label="A/C Receivable">
                    <div className="space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                        <div className="min-w-0 flex-1">
                          <select
                            value={invoiceForm.accounts_receivable_account || ''}
                            onChange={(event) => setInvoiceForm((current) => ({ ...current, accounts_receivable_account: event.target.value }))}
                            className={inputCls}
                          >
                            <option value="">Select receivable account</option>
                            {receivableAccountOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openAddReceivableAccount('invoice')}
                            className="inline-flex items-center justify-center rounded-xl border border-blue-300 px-4 text-blue-600 hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-500/10"
                            title="Add receivable account"
                          >
                            <Plus size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => selectedReceivableAccountReference && setReferenceOptionDeleteTarget({
                              optionType: 'receivable_account',
                              optionValue: selectedReceivableAccountReference.option_value,
                            })}
                            className="inline-flex items-center justify-center rounded-xl border border-rose-300 px-4 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
                            title="Delete selected receivable account"
                            disabled={!selectedReceivableAccountReference}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      {showAddReceivableAccount && receivableAccountTarget === 'invoice' ? (
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                          <input
                            value={newReceivableAccountName}
                            onChange={(event) => setNewReceivableAccountName(event.target.value)}
                            placeholder="New receivable account"
                            className={inputCls}
                          />
                          <button type="button" onClick={() => void handleAddReceivableAccount()} className={primaryButtonCls}>Save</button>
                          <button type="button" onClick={() => { setShowAddReceivableAccount(false); setNewReceivableAccountName(''); }} className={mutedButtonCls}>Cancel</button>
                        </div>
                      ) : null}
                    </div>
                  </Field>
                  <Field label="Invoice No"><input value={invoiceForm.invoice_number} onChange={(event) => setInvoiceForm((current) => ({ ...current, invoice_number: event.target.value }))} className={inputCls} /></Field>
                  <Field label="Invoice Date"><input type="date" value={invoiceForm.invoice_date} onChange={(event) => setInvoiceForm((current) => ({ ...current, invoice_date: event.target.value }))} className={inputCls} required /></Field>
                  <Field label="Due Date"><input type="date" value={invoiceForm.due_date} onChange={(event) => setInvoiceForm((current) => ({ ...current, due_date: event.target.value }))} className={inputCls} disabled={invoiceForm.recurring_enabled} /></Field>
                  <Field label="Currency"><select value={invoiceForm.currency} onChange={(event) => setInvoiceForm((current) => ({ ...current, currency: event.target.value }))} className={inputCls}>{CURRENCY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
                  <Field label="Invoice Status"><select value={invoiceForm.status} onChange={(event) => setInvoiceForm((current) => ({ ...current, status: event.target.value }))} className={inputCls}><option value="draft">Draft</option><option value="sent">Sent</option><option value="cancelled">Cancelled</option></select></Field>
                  <Field label="Sign on eTIMS"><label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white/80 px-4 py-3 text-sm text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200"><input type="checkbox" checked={invoiceForm.etims_enabled} onChange={(event) => setInvoiceForm((current) => ({ ...current, etims_enabled: event.target.checked }))} />Yes / No</label></Field>
                  <Field label="Recurring Invoice"><label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white/80 px-4 py-3 text-sm text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200"><input type="checkbox" checked={invoiceForm.recurring_enabled} onChange={(event) => setInvoiceForm((current) => ({ ...current, recurring_enabled: event.target.checked }))} />Auto invoicing</label></Field>
                  <Field label="Recurring Frequency"><select value={invoiceForm.recurring_frequency} onChange={(event) => setInvoiceForm((current) => ({ ...current, recurring_frequency: event.target.value }))} className={inputCls} disabled={!invoiceForm.recurring_enabled}>{RECURRING_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
                  <Field label="Tax %"><input type="number" min="0" step="0.01" value={invoiceForm.tax_rate} onChange={(event) => setInvoiceForm((current) => ({ ...current, tax_rate: event.target.value }))} className={inputCls} /></Field>
                </div>
                {invoiceForm.recurring_enabled ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
                    <p>Recurring schedule: invoices auto-generate every {invoiceForm.recurring_frequency} starting from {formatDateLabel(invoiceForm.invoice_date)}.</p>
                    <p>Current due date is locked to {formatDateLabel(recurringDueDate)} and the next invoice will generate on {formatDateLabel(nextRecurringInvoiceDate)}.</p>
                    <p>Tax note: {toMoney(invoiceForm.tax_rate).toFixed(2)}% is applied to the subtotal and copied to every generated recurring invoice.</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Tax note: {toMoney(invoiceForm.tax_rate).toFixed(2)}% is applied to the invoice subtotal.</p>
                )}
                <Field label="Bill To"><textarea value={invoiceForm.bill_to} onChange={(event) => setInvoiceForm((current) => ({ ...current, bill_to: event.target.value }))} className={`${inputCls} min-h-[90px]`} /></Field>
                <Field label="Description"><textarea value={invoiceForm.description} onChange={(event) => setInvoiceForm((current) => ({ ...current, description: event.target.value }))} className={`${inputCls} min-h-[90px]`} placeholder="Short invoice summary or internal description" /></Field>
                <div className="rounded-2xl border border-[#1e293b] bg-[#0A1628] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Recurring Expense Item Library</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Save reusable items like CCTV installation, office rent, guards, and bouncers, then drop them into invoices in one click.</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <div className="min-w-[240px]">
                        <select value={selectedExpenseTemplateName} onChange={(event) => setSelectedExpenseTemplateName(event.target.value)} className={inputCls}>
                          <option value="">Select recurring expense item</option>
                          {recurringExpenseTemplates.map((template) => <option key={template.id} value={template.name}>{template.name}</option>)}
                        </select>
                      </div>
                      <button type="button" onClick={addSelectedRecurringExpenseItem} className={mutedButtonCls}><Plus size={16} />Add Recurring Item</button>
                      <button type="button" onClick={() => setShowAddExpenseTemplate((current) => !current)} className={primaryButtonCls}><Plus size={16} />{showAddExpenseTemplate ? 'Close Library Form' : 'Save Recurring Item'}</button>
                    </div>
                  </div>
                  {showAddExpenseTemplate ? (
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                      <Field label="Item Name" className="xl:col-span-2"><input value={expenseTemplateForm.name} onChange={(event) => setExpenseTemplateForm((current) => ({ ...current, name: event.target.value }))} className={inputCls} placeholder="Guards, CCTV Installation, Office Rent..." /></Field>
                      <Field label="Income Account">
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <select value={expenseTemplateForm.default_income_account || ''} onChange={(event) => setExpenseTemplateForm((current) => ({ ...current, default_income_account: event.target.value }))} className={inputCls}>
                              <option value="">Select account</option>
                              {receivableAccountOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                            </select>
                            <button
                              type="button"
                              onClick={() => openAddReceivableAccount('template')}
                              className="inline-flex items-center justify-center rounded-xl border border-blue-300 px-4 text-blue-600 hover:bg-blue-50 dark:border-blue-500/40 dark:text-blue-300 dark:hover:bg-blue-500/10"
                              title="Add income account"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                          {showAddReceivableAccount && receivableAccountTarget === 'template' ? (
                            <div className="flex gap-2">
                              <input
                                value={newReceivableAccountName}
                                onChange={(event) => setNewReceivableAccountName(event.target.value)}
                                placeholder="New income account"
                                className={inputCls}
                              />
                              <button type="button" onClick={() => void handleAddReceivableAccount()} className={primaryButtonCls}>Save</button>
                              <button type="button" onClick={() => { setShowAddReceivableAccount(false); setNewReceivableAccountName(''); }} className={mutedButtonCls}>Cancel</button>
                            </div>
                          ) : null}
                        </div>
                      </Field>
                      <Field label="Default Unit Cost"><input type="number" min="0" step="0.01" value={expenseTemplateForm.default_unit_cost} onChange={(event) => setExpenseTemplateForm((current) => ({ ...current, default_unit_cost: event.target.value }))} className={inputCls} /></Field>
                      <Field label="Default Quantity"><input type="number" min="0" step="0.01" value={expenseTemplateForm.default_quantity} onChange={(event) => setExpenseTemplateForm((current) => ({ ...current, default_quantity: event.target.value }))} className={inputCls} /></Field>
                      <Field label="Recurring"><label className="flex items-center gap-3 rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-700 dark:border-[#1e293b] dark:text-gray-200"><input type="checkbox" checked={expenseTemplateForm.is_recurring} onChange={(event) => setExpenseTemplateForm((current) => ({ ...current, is_recurring: event.target.checked }))} />Reusable</label></Field>
                      <Field label="Default Particulars" className="md:col-span-2 xl:col-span-4"><input value={expenseTemplateForm.default_particulars} onChange={(event) => setExpenseTemplateForm((current) => ({ ...current, default_particulars: event.target.value }))} className={inputCls} placeholder="Describe what this recurring billing item covers" /></Field>
                      <div className="md:col-span-2 xl:col-span-2 flex items-end">
                        <button type="button" onClick={saveExpenseTemplate} disabled={savingExpenseTemplate} className={primaryButtonCls}>{savingExpenseTemplate ? 'Saving...' : 'Save Recurring Expense Item'}</button>
                      </div>
                    </div>
                  ) : null}
                </div>
                <datalist id="finance-expense-item-suggestions">
                  {expenseItemSuggestions.map((option) => <option key={option} value={option} />)}
                </datalist>
                <div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white/95 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur-sm dark:border-white/10 dark:bg-dark-surface/90">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-white/5">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Expense Item</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Description</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Income Account</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Unit Cost</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Qty</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Total</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Particulars</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-[#1e293b]">
                        {invoiceForm.items.map((item) => (
                          <tr key={item.row_id}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <input value={item.expense_item} list="finance-expense-item-suggestions" onChange={(event) => updateInvoiceDraftItem(item.row_id, { expense_item: event.target.value })} className={`${inputCls} min-w-[220px]`} placeholder="Type or pick a saved expense item" />
                                <button
                                  type="button"
                                  onClick={() => saveInvoiceDraftExpenseItem(item)}
                                  disabled={savingExpenseTemplate}
                                  title="Save this expense item to the dropdown"
                                  className="inline-flex shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-3 text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                                >
                                  <Plus size={16} />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-3"><input value={item.description} onChange={(event) => updateInvoiceDraftItem(item.row_id, { description: event.target.value })} className={inputCls} placeholder="Short line-item description" /></td>
                            <td className="px-4 py-3">
                              <select
                                value={item.income_account}
                                onChange={(event) => updateInvoiceDraftItem(item.row_id, { income_account: event.target.value })}
                                className={`${inputCls} min-w-[260px]`}
                              >
                                <option value="">Select income account</option>
                                {(item.income_account && !invoiceIncomeAccountOptions.includes(item.income_account)
                                  ? [item.income_account, ...invoiceIncomeAccountOptions]
                                  : invoiceIncomeAccountOptions
                                ).map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3"><input type="number" min="0" step="0.01" value={item.unit_cost} onChange={(event) => updateInvoiceDraftItem(item.row_id, { unit_cost: event.target.value })} className={inputCls} /></td>
                            <td className="px-4 py-3"><input type="number" min="0" step="0.01" value={item.quantity} onChange={(event) => updateInvoiceDraftItem(item.row_id, { quantity: event.target.value })} className={inputCls} /></td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">{formatMoney(toMoney(item.unit_cost) * toMoney(item.quantity), invoiceForm.currency)}</td>
                            <td className="px-4 py-3"><input value={item.particulars} onChange={(event) => updateInvoiceDraftItem(item.row_id, { particulars: event.target.value })} className={inputCls} /></td>
                            <td className="px-4 py-3"><button type="button" onClick={() => setInvoiceForm((current) => ({ ...current, items: current.items.length > 1 ? current.items.filter((row) => row.row_id !== item.row_id) : current.items }))} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 size={16} /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <button type="button" onClick={() => addInvoiceDraftRow()} className={mutedButtonCls}><Plus size={16} />Add Row</button>
                  <div className="grid gap-2 text-right text-sm text-gray-700 dark:text-gray-200">
                    <div>Subtotal: <span className="font-semibold text-gray-900 dark:text-white">{formatMoney(invoiceDraftTotals.subtotal, invoiceForm.currency)}</span></div>
                    <div>Tax Rate: <span className="font-semibold text-gray-900 dark:text-white">{toMoney(invoiceForm.tax_rate).toFixed(2)}%</span></div>
                    <div>Taxes: <span className="font-semibold text-gray-900 dark:text-white">{formatMoney(invoiceDraftTotals.taxAmount, invoiceForm.currency)}</span></div>
                    <div>Total: <span className="text-lg font-black text-gray-900 dark:text-white">{formatMoney(invoiceDraftTotals.total, invoiceForm.currency)}</span></div>
                  </div>
                </div>
                <Field label="Notes"><textarea value={invoiceForm.notes} onChange={(event) => setInvoiceForm((current) => ({ ...current, notes: event.target.value }))} className={`${inputCls} min-h-[100px]`} /></Field>
                <div className="flex flex-wrap gap-3">
                  <button type="submit" disabled={savingInvoice} className={primaryButtonCls}>{savingInvoice ? 'Saving...' : editingInvoice ? 'Update Invoice' : 'Save Invoice'}</button>
                  <button type="button" onClick={resetInvoiceComposer} className={mutedButtonCls}>Cancel</button>
                </div>
              </form>
            </div>
          ) : null}
          {focusedInvoice ? (
            <div className={panelCls}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">Invoice Details</p>
                  <h2 className="mt-2 text-2xl font-black text-gray-900 dark:text-white">{getInvoiceNumber(focusedInvoice)}</h2>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{customerMap[focusedInvoice.customer_id || '']?.customer_name || 'No customer linked'} - {focusedInvoice.transaction_class}</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Entity: {focusedInvoice.entity || 'Unspecified'}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => openEditInvoiceForm(focusedInvoice)} className={mutedButtonCls}>Edit Invoice</button>
                  <button type="button" onClick={() => openReceiptForm(focusedInvoice)} className={primaryButtonCls}><Receipt size={16} />Receipt Invoice</button>
                </div>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <SummaryCard icon={Calendar} label="Invoice Date" value={focusedInvoice.invoice_date} accent="text-blue-600" />
                <SummaryCard icon={CheckCircle2} label="Status" value={getInvoiceDisplayStatus(focusedInvoice)} accent="text-emerald-600" />
                <SummaryCard icon={Wallet} label="Total Amount" value={formatMoney(focusedInvoice.total_amount, focusedInvoice.currency)} accent="text-gray-900 dark:text-white" />
                <SummaryCard icon={Receipt} label="Balance Due" value={formatMoney(Math.max(0, focusedInvoice.total_amount - focusedInvoice.amount_paid), focusedInvoice.currency)} accent="text-rose-600" />
              </div>
              <div className="mt-6 overflow-hidden rounded-[28px] border border-gray-200 bg-white/95 dark:border-white/10 dark:bg-dark-surface/90">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-white/5">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Expense Item</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Income Account</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Particulars</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-[#1e293b]">
                    {focusedInvoiceItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{getInvoiceItemName(item)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{item.description || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{item.income_account || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">{formatMoney(item.line_total, focusedInvoice.currency)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{item.particulars || '-'}</td>
                      </tr>
                    ))}
                    {focusedInvoiceItems.length === 0 ? <tr><td colSpan={6} className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">No line items found for this invoice.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          <div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white/95 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur-sm dark:border-white/10 dark:bg-dark-surface/90">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5">
                    <tr>
                      <th className="px-4 py-4 text-left"><input type="checkbox" checked={allFilteredInvoicesSelected} onChange={(event) => setSelectedInvoiceIds(event.target.checked ? filteredInvoices.map((invoice) => invoice.id) : [])} /></th>
                      <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Invoice #</th>
                      <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Entity</th>
                      <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Customer</th>
                      <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Transaction Class</th>
                      <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Description</th>
                      <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Invoice Date</th>
                      <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Due Date</th>
                      <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Total</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Balance</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Recurring</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Status</th>
                    <th className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-[#1e293b]">
                  {filteredInvoices.map((invoice) => {
                    const customer = invoice.customer_id ? customerMap[invoice.customer_id] : null;
                    const balance = Math.max(0, toMoney(invoice.total_amount) - toMoney(invoice.amount_paid));
                    const status = getInvoiceDisplayStatus(invoice);
                    return (
                      <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-4"><input type="checkbox" checked={selectedInvoiceIds.includes(invoice.id)} onChange={(event) => setSelectedInvoiceIds((current) => event.target.checked ? [...current, invoice.id] : current.filter((id) => id !== invoice.id))} /></td>
                        <td className="px-4 py-4 font-mono text-sm text-blue-600 dark:text-blue-300">{getInvoiceNumber(invoice)}</td>
                        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200">{invoice.entity || '-'}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-gray-900 dark:text-white">{customer?.customer_name || '-'}</td>
                        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200">{invoice.transaction_class}</td>
                        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200">
                          <div className="max-w-[300px] space-y-1">
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">Invoice desc</div>
                            <div className="truncate" title={invoice.description || '-'}>
                              {invoice.description || '-'}
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">Line items</div>
                            <div className="truncate" title={invoiceDescriptionByInvoice[invoice.id] || '-'}>
                              {invoiceDescriptionByInvoice[invoice.id] || '-'}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200">{invoice.invoice_date}</td>
                        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200">{invoice.due_date || '-'}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-gray-900 dark:text-white">{formatMoney(invoice.total_amount, invoice.currency)}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-amber-600 dark:text-amber-400">{formatMoney(balance, invoice.currency)}</td>
                        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200">{invoice.recurring_enabled ? invoice.recurring_frequency || 'Yes' : 'No'}</td>
                        <td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : status === 'overdue' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' : status === 'partial' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'}`}>{status}</span></td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handlePrintInvoice(invoice)}
                              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-[#1e293b] dark:hover:text-white"
                              title="Print invoice"
                            >
                              <Printer size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFocusedInvoiceId(invoice.id);
                                openEditInvoiceForm(invoice);
                              }}
                              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-[#1e293b] dark:hover:text-white"
                              title="Invoice details"
                            >
                              Details
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFocusedInvoiceId(invoice.id);
                                openEditInvoiceForm(invoice);
                              }}
                              className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                              title="Edit invoice"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button type="button" onClick={() => openReceiptForm(invoice)} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10" title="Receipt invoice"><Receipt size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredInvoices.length === 0 ? <tr><td colSpan={13} className="px-6 py-20 text-center text-sm text-gray-500 dark:text-gray-400">No invoices match the current filters.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
      {activeTab === 'receipts' ? (
        <div className="space-y-6">
          <div className={panelCls}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                <input value={receiptSearch} onChange={(event) => setReceiptSearch(event.target.value)} placeholder="Search by receipt, customer, invoice, or payment method..." className={`${inputCls} pl-10`} />
              </div>
              <button type="button" onClick={resetReceiptFilters} className={mutedButtonCls}>Reset</button>
              <button type="button" onClick={() => openReceiptForm()} className={primaryButtonCls}><Plus size={16} />Post Receipt</button>
            </div>
          </div>
          {showReceiptForm ? (
            <div className={panelCls}>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Post Receipt</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Use this to receipt a selected invoice or capture a standalone customer payment such as the first security cheque.</p>
                </div>
                <button type="button" onClick={() => { setShowReceiptForm(false); setReceiptForm(emptyReceiptForm()); }} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-[#1e293b] dark:hover:text-white"><X size={18} /></button>
              </div>
              <form onSubmit={handleReceiptSubmit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Receipt Number"><input value={receiptForm.receipt_number} onChange={(event) => setReceiptForm((current) => ({ ...current, receipt_number: event.target.value }))} className={inputCls} required /></Field>
                <Field label="Receipt Date"><input type="date" value={receiptForm.receipt_date} onChange={(event) => setReceiptForm((current) => ({ ...current, receipt_date: event.target.value }))} className={inputCls} required /></Field>
                <Field label="Customer"><select value={receiptForm.customer_id} onChange={(event) => { const customer = customerMap[event.target.value]; setReceiptForm((current) => ({ ...current, customer_id: event.target.value, received_from: current.received_from || customer?.customer_name || '' })); }} className={inputCls}><option value="">Select customer</option>{receiptCustomerOptions.map((customer) => <option key={customer.id} value={customer.id}>{customer.customer_name}{customer.is_deleted ? ' (Deleted)' : ''}</option>)}</select></Field>
                <Field label="Selected Invoice"><select value={receiptForm.invoice_id} onChange={(event) => { const invoice = invoiceMap[event.target.value]; const customer = invoice?.customer_id ? customerMap[invoice.customer_id] : null; setReceiptForm((current) => ({ ...current, invoice_id: event.target.value, customer_id: invoice?.customer_id || current.customer_id, amount: invoice ? Math.max(0, toMoney(invoice.total_amount) - toMoney(invoice.amount_paid)).toFixed(2) : current.amount, currency: invoice?.currency || current.currency, received_from: customer?.customer_name || current.received_from, notes: invoice ? `Receipt against invoice ${getInvoiceNumber(invoice)}` : current.notes })); }} className={inputCls}><option value="">Standalone receipt</option>{invoices.filter((invoice) => Math.max(0, toMoney(invoice.total_amount) - toMoney(invoice.amount_paid)) > 0).map((invoice) => <option key={invoice.id} value={invoice.id}>{getInvoiceNumber(invoice)} - {customerMap[invoice.customer_id || '']?.customer_name || 'No customer'}</option>)}</select></Field>
                <Field label="Amount"><input type="number" min="0" step="0.01" value={receiptForm.amount} onChange={(event) => setReceiptForm((current) => ({ ...current, amount: event.target.value }))} className={inputCls} required /></Field>
                <Field label="Payment Method">
                  <select
                    value={receiptForm.payment_method}
                    onChange={(event) => setReceiptForm((current) => {
                      const nextPaymentMethod = event.target.value;
                      const expectedKind = getDepositAccountKindForPaymentMethod(nextPaymentMethod);
                      const currentDepositAccount = current.deposit_account_id ? bankAccountMap[current.deposit_account_id] : null;
                      const nextDepositAccountId =
                        resolveReceiptAccountId(nextPaymentMethod, receiptBankAccountOptions)
                        || buildReceiptDepositAccountSelection('payment_method', nextPaymentMethod);

                      return {
                        ...current,
                        payment_method: nextPaymentMethod,
                        deposit_account_id:
                          !currentDepositAccount || currentDepositAccount.account_kind !== expectedKind
                            ? nextDepositAccountId
                            : current.deposit_account_id,
                      };
                    })}
                    className={inputCls}
                  >
                    {paymentMethodOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </Field>
                <Field label="Deposit Account">
                  <select
                    value={receiptForm.deposit_account_id}
                    onChange={(event) => setReceiptForm((current) => ({ ...current, deposit_account_id: event.target.value }))}
                    className={inputCls}
                  >
                    <option value="">Select bank, cash, wallet, or payment option</option>
                    {receiptDepositAccountOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Currency"><select value={receiptForm.currency} onChange={(event) => setReceiptForm((current) => ({ ...current, currency: event.target.value }))} className={inputCls}>{CURRENCY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
                <Field label="Cheque Number"><input value={receiptForm.cheque_number} onChange={(event) => setReceiptForm((current) => ({ ...current, cheque_number: event.target.value }))} className={inputCls} placeholder="Required for cheque receipts" required={normalizeText(receiptForm.payment_method).includes('cheque')} /></Field>
                <Field label="Received From"><input value={receiptForm.received_from} onChange={(event) => setReceiptForm((current) => ({ ...current, received_from: event.target.value }))} className={inputCls} /></Field>
                <Field label="Notes" className="md:col-span-2 xl:col-span-3"><textarea value={receiptForm.notes} onChange={(event) => setReceiptForm((current) => ({ ...current, notes: event.target.value }))} className={`${inputCls} min-h-[110px]`} /></Field>
                <div className="flex flex-wrap gap-3 md:col-span-2 xl:col-span-3">
                  <button type="submit" disabled={savingReceipt} className={primaryButtonCls}>{savingReceipt ? 'Posting...' : 'Post Receipt'}</button>
                  <button type="button" onClick={() => void handleIssueReceipt()} disabled={savingReceipt} className={mutedButtonCls}>
                    <Printer size={16} />
                    {savingReceipt ? 'Issuing...' : 'Issue & Print'}
                  </button>
                  <button type="button" onClick={() => { setShowReceiptForm(false); setReceiptForm(emptyReceiptForm()); }} className={mutedButtonCls}>Cancel</button>
                </div>
              </form>
            </div>
          ) : null}
          <div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white/95 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur-sm dark:border-white/10 dark:bg-dark-surface/90">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Receipt #</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Date</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Customer</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Invoice</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Method</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Deposit Account</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Amount</th>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Notes</th>
                    <th className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-[#1e293b]">
                  {filteredReceipts.map((receipt) => {
                    const invoice = receipt.invoice_id ? invoiceMap[receipt.invoice_id] : null;
                    const customerId = receipt.customer_id || invoice?.customer_id || '';
                    const customer = customerId ? customerMap[customerId] : null;
                    const depositAccount = receipt.deposit_account_id ? bankAccountMap[receipt.deposit_account_id] : null;
                    return (
                      <tr key={receipt.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="px-4 py-4 font-mono text-sm text-blue-600 dark:text-blue-300">{receipt.receipt_number || 'Unnumbered'}</td>
                        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200">{receipt.receipt_date}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-gray-900 dark:text-white">{customer?.customer_name || receipt.received_from || '-'}</td>
                        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200">{invoice?.invoice_number || '-'}</td>
                        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200">{receipt.payment_method || '-'}</td>
                        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200">{depositAccount ? formatBankAccountLabel(depositAccount) : '-'}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatMoney(receipt.amount, receipt.currency || 'KES')}</td>
                        <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-200">{receipt.notes || receipt.description || '-'}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handlePrintReceipt(receipt)}
                              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-[#1e293b] dark:hover:text-white"
                              title="Print receipt"
                            >
                              <Printer size={16} />
                            </button>
                            <button type="button" onClick={() => handleDeleteReceipt(receipt)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10" title="Delete receipt">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredReceipts.length === 0 ? <tr><td colSpan={9} className="px-6 py-20 text-center text-sm text-gray-500 dark:text-gray-400">No receipts match the current filters.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
      <ThemedConfirmDialog
        open={Boolean(referenceOptionDeleteTarget)}
        title="Delete saved dropdown option?"
        message={
          referenceOptionDeleteTarget
            ? `Delete "${referenceOptionDeleteTarget.optionValue}" from the saved ${referenceOptionDeleteTarget.optionType === 'entity' ? 'Entity / App' : 'A/C Receivable'} dropdown?`
            : ''
        }
        confirmLabel={deletingReferenceOption ? 'Deleting...' : 'Delete'}
        cancelLabel="Cancel"
        tone="danger"
        onConfirm={() => void handleDeleteReferenceOption()}
        onClose={() => setReferenceOptionDeleteTarget(null)}
      />
    </div>
  );
};

const TabButton = ({ active, label, icon: Icon, onClick }: { active: boolean; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; onClick: () => void; }) => (
  <button type="button" onClick={onClick} className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${active ? 'bg-brand-purple text-white shadow-lg shadow-brand-purple/20' : 'bg-transparent text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5'}`}>
    <Icon size={16} />
    {label}
  </button>
);

const SummaryCard = ({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string; accent: string; }) => (
  <div className={panelCls}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className={`mt-2 text-2xl font-black ${accent}`}>{value}</p>
      </div>
      <div className="rounded-2xl bg-brand-purple/10 p-3 text-brand-purple dark:bg-brand-purple/15"><Icon size={20} className="text-current" /></div>
    </div>
  </div>
);

const Field = ({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string; }) => (
  <label className={`space-y-2 ${className}`}>
    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
    {children}
  </label>
);

export default InvoicingCenter;
