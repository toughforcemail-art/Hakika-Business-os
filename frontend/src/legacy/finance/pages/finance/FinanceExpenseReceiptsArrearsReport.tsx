// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Filter, Printer, RefreshCcw, Trash2, TrendingDown } from 'lucide-react';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { useAccess } from '../../hooks/useAccess';
import financeDepositAccountsService, { type FinanceDepositAccount } from '../../services/financeDepositAccountsService';
import { resolveOrganizationScope } from '../../utils/organizationScope';
import { escapeHtml, printDocument, printWorkspacePage } from '../../utils/printHelpers';
import { supabase } from '../../utils/supabase';

interface CompanyOption {
  id: string;
  name: string;
  code: string | null;
}

interface CustomerOption {
  id: string;
  customer_name: string;
}

interface PaymentRow {
  id: string;
  payment_number: string | null;
  payment_date: string | null;
  recording_date: string | null;
  source_requisition_id: string | null;
  amount: number | string;
  quantity: number | string | null;
  unit_cost: number | string | null;
  specification: string | null;
  description: string | null;
  payment_method: string | null;
  reference_number: string | null;
  expense_group: string | null;
  entity: string | null;
  pay_from_account: string | null;
  pay_from_account_id: string | null;
  created_at: string;
  payee?: { payee_name: string | null }[] | null;
}

interface AllocationRow {
  id: string;
  payment_id: string;
  bill_date: string | null;
  invoice_number: string | null;
  particular: string | null;
  specification: string | null;
  quantity: number | string;
  unit_cost: number | string;
  payable_total: number | string;
  payment_amount: number | string;
  display_order: number | null;
}

interface ReceiptRow {
  id: string;
  receipt_number: string | null;
  receipt_date: string | null;
  amount: number | string;
  payment_method: string | null;
  received_from: string | null;
  source_module: string | null;
  category: string | null;
  currency: string | null;
  invoice_id: string | null;
  customer_id: string | null;
  deposit_account_id: string | null;
  deposit_account_type?: string | null;
  created_at: string;
}

interface InvoiceRow {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  total_amount: number | string;
  amount_paid: number | string;
  entity: string | null;
  accounts_receivable_account: string | null;
  customer_id: string | null;
  created_at: string;
}

interface FilterState {
  dateFrom: string;
  dateTo: string;
  month: string;
  year: string;
  entity: string;
  customerId: string;
  invoiceNumber: string;
  requisitionNumber: string;
  expenseGroup: string;
  bankAccountId: string;
  paymentMethod: string;
  incomeAccount: string;
  receiptNumber: string;
  payee: string;
  search: string;
}

interface ExpenseEntry {
  id: string;
  paymentId: string;
  date: string;
  description: string;
  itemDescription: string;
  specification: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  cumulative: number;
  ref: string;
  requisitionNumber: string;
  entity: string;
  expenseGroup: string;
  bankAccount: string;
  paymentMethod: string;
  payee: string;
  invoiceNumber: string;
}

interface ReceiptEntry {
  id: string;
  date: string;
  receiptNumber: string;
  payee: string;
  ref: string;
  entity: string;
  invoiceNumber: string;
  amount: number;
  paymentMethod: string;
  incomeAccount: string;
  bankAccount: string;
}

interface GroupedSection<T> {
  entity: string;
  months: Array<{
    month: string;
    rows: T[];
    subtotal: number;
  }>;
  subtotal: number;
}

interface ArrearsEntry {
  id: string;
  invoiceDate: string;
  invoiceNumber: string;
  entity: string;
  customer: string;
  amountDue: number;
  incomeAccount: string;
}

const panelCls =
  'rounded-[28px] border border-white/10 bg-[#0f3548] p-5 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.3)] backdrop-blur-sm';
const tableWrapCls =
  'rounded-[24px] border border-white/10 bg-white/5 dark:bg-white/[0.03]';
const tableHeaderCls =
  'bg-white/10 text-slate-500 dark:bg-white/5 dark:text-slate-400';
const tableRowCls =
  'text-slate-700 hover:bg-black/5 odd:bg-white/[0.03] even:bg-transparent dark:text-slate-200 dark:hover:bg-white/[0.03] dark:odd:bg-white/[0.02] dark:even:bg-transparent';
const tableCellCls = 'px-3 py-2.5 align-top text-sm';
const inputCls =
  'w-full rounded-2xl border border-white/10 bg-[#082131] px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-400 focus:border-[#ff6a00]/40 focus:bg-[#0b2a3c] focus:ring-4 focus:ring-[#ff6a00]/10';
const labelCls = 'text-[11px] font-black uppercase tracking-[0.22em] text-slate-300';
const actionButtonCls =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#0b2234] px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-[#ff6a00]/30 hover:bg-[#0f2c41]';
const primaryButtonCls =
  'inline-flex items-center justify-center gap-2 rounded-2xl bg-[#ff6a00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e85f00]';
const skeletonCls = 'animate-pulse rounded-2xl bg-white/10';

const emptyFilters = (): FilterState => ({
  dateFrom: '',
  dateTo: '',
  month: '',
  year: '',
  entity: '',
  customerId: '',
  invoiceNumber: '',
  requisitionNumber: '',
  expenseGroup: '',
  bankAccountId: '',
  paymentMethod: '',
  incomeAccount: '',
  receiptNumber: '',
  payee: '',
  search: '',
});

const normalizeText = (value?: string | null) => value?.trim().toLowerCase() || '';
const toNumber = (value?: number | string | null) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const toDateTime = (value?: string | null) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};
const compareDateDesc = (left?: string | null, right?: string | null) => {
  const leftTime = toDateTime(left);
  const rightTime = toDateTime(right);
  if (leftTime !== null && rightTime !== null && leftTime !== rightTime) {
    return rightTime - leftTime;
  }
  return (right || '').localeCompare(left || '');
};
const formatMoney = (value: number, currency = 'KES') =>
  `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};
const formatMonthKey = (value?: string | null) => {
  if (!value) return 'Unknown month';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown month';
  return date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
};
const companyLabel = (company?: CompanyOption | null) =>
  company ? (company.code ? `${company.name} (${company.code})` : company.name) : 'Finance Reports';
const dateInWindow = (date: string | null | undefined, filters: FilterState) => {
  if (!date) return false;
  if (filters.dateFrom && date < filters.dateFrom) return false;
  if (filters.dateTo && date > filters.dateTo) return false;
  if (filters.month && String(new Date(date).getMonth() + 1) !== filters.month) return false;
  if (filters.year && String(new Date(date).getFullYear()) !== filters.year) return false;
  return true;
};

type FinanceReportView = 'all' | 'expenses' | 'receipts' | 'arrears';

interface FinanceExpenseReceiptsArrearsReportProps {
  view?: FinanceReportView;
}

const FinanceExpenseReceiptsArrearsReport: React.FC<FinanceExpenseReceiptsArrearsReportProps> = ({ view = 'all' }) => {
  const { profile } = useAccess();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [organizationNotice, setOrganizationNotice] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyOption | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<FinanceDepositAccount[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [requisitionDepartments, setRequisitionDepartments] = useState<Record<string, string>>({});
  const [secondaryLoading, setSecondaryLoading] = useState(false);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const scope = await resolveOrganizationScope(profile);
      setOrganizationNotice(scope.notice);
      if (!scope.organizationId) {
        setCompany(null);
        setCompanies([]);
        setCustomers([]);
        setBankAccounts([]);
        setPayments([]);
        setAllocations([]);
        setReceipts([]);
        setInvoices([]);
        setRequisitionDepartments({});
        setOrganizationNotice('Your account is not linked to an organization yet, so finance reports cannot be loaded.');
        return;
      }

      const [companiesRes, customersRes, bankAccountsRes, paymentsRes, requisitionsRes] = await Promise.all([
        supabase.from('companies').select('id, name, code, organization_id').eq('organization_id', scope.organizationId).order('name', { ascending: true }),
        supabase.from('finance_customers').select('id, customer_name').eq('organization_id', scope.organizationId).order('customer_name', { ascending: true }),
        financeDepositAccountsService.listAccounts(),
        supabase.from('finance_payments').select('id, payment_number, payment_date, recording_date, source_requisition_id, amount, quantity, unit_cost, specification, description, payment_method, reference_number, expense_group, entity, pay_from_account, pay_from_account_id, created_at, payee:finance_payees(payee_name)').eq('organization_id', scope.organizationId).order('recording_date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('finance_requisitions').select('id, department').eq('organization_id', scope.organizationId),
      ]);

      if (companiesRes.error) throw companiesRes.error;
      if (customersRes.error) throw customersRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (requisitionsRes.error) throw requisitionsRes.error;

      const nextCompanies = (companiesRes.data || []) as CompanyOption[];
      setCompanies(nextCompanies);
      setCompany(null);
      setCustomers((customersRes.data || []) as CustomerOption[]);
      setBankAccounts((bankAccountsRes || []) as FinanceDepositAccount[]);
      setPayments((paymentsRes.data || []) as PaymentRow[]);
      setRequisitionDepartments(
        Object.fromEntries(
          ((requisitionsRes.data || []) as { id: string; department: string | null }[])
            .map((requisition) => [requisition.id, requisition.department?.trim() || ''] as const)
            .filter(([, department]) => Boolean(department)),
        ),
      );

      setLoading(false);
      setSecondaryLoading(true);

      void (async () => {
        try {
          const [receiptsRes, invoicesRes] = await Promise.all([
            supabase
              .from('finance_receipts')
              .select('id, receipt_number, receipt_date, amount, payment_method, received_from, source_module, category, currency, invoice_id, customer_id, deposit_account_id, deposit_account_type, created_at')
              .eq('organization_id', scope.organizationId)
              .order('receipt_date', { ascending: false })
              .order('created_at', { ascending: false }),
            supabase
              .from('finance_invoices')
              .select('id, invoice_number, invoice_date, total_amount, amount_paid, entity, accounts_receivable_account, customer_id, created_at')
              .eq('organization_id', scope.organizationId)
              .order('invoice_date', { ascending: false })
              .order('created_at', { ascending: false }),
          ]);

          if (receiptsRes.error) throw receiptsRes.error;
          if (invoicesRes.error) throw invoicesRes.error;

          setReceipts((receiptsRes.data || []) as ReceiptRow[]);
          setInvoices((invoicesRes.data || []) as InvoiceRow[]);

          const paymentIds = ((paymentsRes.data || []) as PaymentRow[]).map((row) => row.id);
          if (paymentIds.length > 0) {
            const { data, error } = await supabase
              .from('finance_payment_allocations')
              .select('id, payment_id, bill_date, invoice_number, particular, specification, quantity, unit_cost, payable_total, wht_tax, paid_to_date, amount_due, payment_amount, new_balance, display_order')
              .in('payment_id', paymentIds)
              .order('display_order', { ascending: true });
            if (error) throw error;
            setAllocations((data || []) as AllocationRow[]);
          } else {
            setAllocations([]);
          }
        } catch (secondaryError: any) {
          console.error('Failed to load secondary finance report data:', secondaryError);
          setToast({ message: secondaryError.message || 'Some finance report data loaded slowly or failed to load.', type: 'warning' });
        } finally {
          setSecondaryLoading(false);
        }
      })();
    } catch (error: any) {
      console.error('Failed to load finance report:', error);
      setToast({ message: error.message || 'Failed to load finance report data.', type: 'error' });
      setLoading(false);
    } finally {
      // primary load now handled above for faster first paint
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      void loadData();
    }
  }, [profile, loadData]);

  const customerMap = useMemo(
    () => Object.fromEntries(customers.map((customer) => [customer.id, customer])),
    [customers],
  );
  const bankAccountMap = useMemo(
    () => Object.fromEntries(bankAccounts.map((account) => [account.id, account])),
    [bankAccounts],
  );
  const invoiceMap = useMemo(
    () => Object.fromEntries(invoices.map((invoice) => [invoice.id, invoice])),
    [invoices],
  );
  const selectedCompanyTokens = useMemo(() => {
    if (!company) return [];
    return [company.name, company.code].filter((value): value is string => Boolean(value));
  }, [company]);
  const matchesSelectedCompany = useCallback(
    (value?: string | null) => {
      if (!company) return true;
      const normalized = normalizeText(value);
      if (!normalized) return false;
      return selectedCompanyTokens.some((token) => normalized.includes(normalizeText(token)));
    },
    [company, selectedCompanyTokens],
  );

  const expenseEntries = useMemo(() => {
    const rows: ExpenseEntry[] = [];
    const sortedPayments = [...payments].sort((a, b) =>
      compareDateDesc(a.recording_date || a.payment_date || a.created_at, b.recording_date || b.payment_date || b.created_at),
    );

    sortedPayments.forEach((payment) => {
      const lines = allocations.filter((item) => item.payment_id === payment.id);
      const payee = payment.payee?.[0]?.payee_name || '-';
      const bankAccount = payment.pay_from_account_id ? bankAccountMap[payment.pay_from_account_id] : null;
      const bankLabel = bankAccount
        ? financeDepositAccountsService.formatAccountLabel(bankAccount)
        : payment.pay_from_account || '-';
      const entity = payment.entity || (payment.source_requisition_id ? requisitionDepartments[payment.source_requisition_id] : null) || '-';
      const requisitionNumber = payment.source_requisition_id || '-';

      if (lines.length > 0) {
        lines.forEach((line) => {
          rows.push({
            id: `${payment.id}-${line.id}`,
            paymentId: payment.id,
            date: line.bill_date || payment.payment_date || payment.recording_date || payment.created_at,
            description: line.particular || line.specification || payment.description || 'Expense voucher line',
            itemDescription: line.particular || payment.description || 'Expense voucher line',
            specification: line.specification || payment.specification || '-',
            quantity: toNumber(line.quantity) || 1,
            unitCost: toNumber(line.unit_cost),
            totalCost: toNumber(line.payment_amount || line.payable_total || toNumber(line.quantity) * toNumber(line.unit_cost)),
            cumulative: 0,
            ref: payment.payment_number || payment.reference_number || payment.id,
            requisitionNumber,
            entity,
            expenseGroup: payment.expense_group || '-',
            bankAccount: bankLabel,
            paymentMethod: payment.payment_method || '-',
            payee,
            invoiceNumber: line.invoice_number || '-',
          });
        });
      } else {
        const qty = toNumber(payment.quantity) || 1;
        const unitCost = toNumber(payment.unit_cost);
        const totalCost = toNumber(payment.amount) || qty * unitCost;
        rows.push({
          id: payment.id,
          paymentId: payment.id,
          date: payment.recording_date || payment.payment_date || payment.created_at,
          description: payment.description || payment.specification || 'Expense voucher',
          itemDescription: payment.description || 'Expense voucher',
          specification: payment.specification || '-',
          quantity: qty,
          unitCost,
          totalCost,
          cumulative: 0,
          ref: payment.payment_number || payment.reference_number || payment.id,
          requisitionNumber,
          entity,
          expenseGroup: payment.expense_group || '-',
          bankAccount: payment.pay_from_account || (payment.pay_from_account_id ? bankAccountMap[payment.pay_from_account_id]?.bank_name || '-' : '-'),
          paymentMethod: payment.payment_method || '-',
          payee,
          invoiceNumber: '-',
        });
      }
    });

    let running = 0;
    return rows.map((row) => {
      running += row.totalCost;
      return { ...row, cumulative: running };
    });
  }, [allocations, bankAccountMap, payments, requisitionDepartments]);

  const receiptEntries = useMemo(() => {
    return receipts
      .map<ReceiptEntry>((receipt) => {
        const invoice = receipt.invoice_id ? invoiceMap[receipt.invoice_id] : null;
        const customer = receipt.customer_id ? customerMap[receipt.customer_id] : invoice?.customer_id ? customerMap[invoice.customer_id] : null;
        const bankAccount = receipt.deposit_account_id ? bankAccountMap[receipt.deposit_account_id] : null;
        return {
          id: receipt.id,
          date: receipt.receipt_date || receipt.created_at,
          receiptNumber: receipt.receipt_number || '-',
          payee: customer?.customer_name || receipt.received_from || '-',
          ref: receipt.receipt_number || receipt.id,
          entity: invoice?.entity || receipt.source_module || '-',
          invoiceNumber: invoice?.invoice_number || '-',
          amount: toNumber(receipt.amount),
          paymentMethod: receipt.payment_method || '-',
          incomeAccount: invoice?.accounts_receivable_account || receipt.category || '-',
          bankAccount: bankAccount ? financeDepositAccountsService.formatAccountLabel(bankAccount) : '-',
        };
      })
      .filter((entry) => {
        if (!dateInWindow(entry.date, filters)) return false;
        if (filters.entity && normalizeText(entry.entity) !== normalizeText(filters.entity)) return false;
        if (filters.customerId) {
          const customer = customerMap[filters.customerId];
          if (customer && normalizeText(entry.payee) !== normalizeText(customer.customer_name)) return false;
        }
        if (filters.invoiceNumber && !normalizeText(entry.invoiceNumber).includes(normalizeText(filters.invoiceNumber))) return false;
        if (filters.receiptNumber && !normalizeText(entry.receiptNumber).includes(normalizeText(filters.receiptNumber))) return false;
        if (filters.paymentMethod && normalizeText(entry.paymentMethod) !== normalizeText(filters.paymentMethod)) return false;
        if (filters.incomeAccount && !normalizeText(entry.incomeAccount).includes(normalizeText(filters.incomeAccount))) return false;
        if (filters.payee && !normalizeText(entry.payee).includes(normalizeText(filters.payee))) return false;
        return true;
      })
      .sort((left, right) => compareDateDesc(left.date, right.date));
  }, [customerMap, filters, invoiceMap, bankAccountMap, receipts]);

  const arrearsEntries = useMemo(() => {
    return invoices
      .map<ArrearsEntry>((invoice) => {
        const customer = invoice.customer_id ? customerMap[invoice.customer_id] : null;
        const invoiceDate = invoice.invoice_date || invoice.created_at;
        return {
          id: invoice.id,
          invoiceDate,
          invoiceNumber: invoice.invoice_number || '-',
          entity: invoice.entity || '-',
          customer: customer?.customer_name || '-',
          amountDue: Math.max(0, toNumber(invoice.total_amount) - toNumber(invoice.amount_paid)),
          incomeAccount: invoice.accounts_receivable_account || '-',
        };
      })
      .filter((entry) => entry.amountDue > 0)
      .filter((entry) => {
        if (!dateInWindow(entry.invoiceDate, filters)) return false;
        if (filters.entity && normalizeText(entry.entity) !== normalizeText(filters.entity)) return false;
        if (filters.customerId) {
          const customer = customerMap[filters.customerId];
          if (customer && normalizeText(entry.customer) !== normalizeText(customer.customer_name)) return false;
        }
        if (filters.invoiceNumber && !normalizeText(entry.invoiceNumber).includes(normalizeText(filters.invoiceNumber))) return false;
        if (filters.incomeAccount && !normalizeText(entry.incomeAccount).includes(normalizeText(filters.incomeAccount))) return false;
        return true;
      })
      .sort((left, right) => compareDateDesc(left.invoiceDate, right.invoiceDate));
  }, [customerMap, filters, invoices]);

  const filteredExpenses = useMemo(() => {
    return expenseEntries.filter((entry) => {
      if (!dateInWindow(entry.date, filters)) return false;
      if (!matchesSelectedCompany(entry.entity)) return false;
      if (filters.entity && normalizeText(entry.entity) !== normalizeText(filters.entity)) return false;
      if (filters.invoiceNumber && !normalizeText(entry.invoiceNumber).includes(normalizeText(filters.invoiceNumber))) return false;
      if (filters.requisitionNumber && !normalizeText(entry.requisitionNumber).includes(normalizeText(filters.requisitionNumber))) return false;
      if (filters.expenseGroup && normalizeText(entry.expenseGroup) !== normalizeText(filters.expenseGroup)) return false;
      if (filters.bankAccountId) {
        const account = bankAccountMap[filters.bankAccountId];
        const haystack = [entry.bankAccount, entry.payee, entry.ref].join(' ').toLowerCase();
        const needle = account ? financeDepositAccountsService.formatAccountLabel(account).toLowerCase() : '';
        if (!haystack.includes(needle)) return false;
      }
      if (filters.paymentMethod && normalizeText(entry.paymentMethod) !== normalizeText(filters.paymentMethod)) return false;
      if (filters.payee && !normalizeText(entry.payee).includes(normalizeText(filters.payee))) return false;
      if (filters.search) {
        const haystack = [
          entry.date,
          entry.description,
          entry.itemDescription,
          entry.specification,
          entry.requisitionNumber,
          entry.ref,
          entry.entity,
          entry.expenseGroup,
          entry.bankAccount,
          entry.paymentMethod,
          entry.payee,
          entry.invoiceNumber,
        ].join(' ').toLowerCase();
        if (!haystack.includes(normalizeText(filters.search))) return false;
      }
      return true;
    });
  }, [bankAccountMap, expenseEntries, filters, matchesSelectedCompany]);

  const expenseTotal = useMemo(() => filteredExpenses.reduce((sum, row) => sum + row.totalCost, 0), [filteredExpenses]);
  const receiptTotal = useMemo(() => receiptEntries.reduce((sum, row) => sum + row.amount, 0), [receiptEntries]);
  const arrearsTotal = useMemo(() => arrearsEntries.reduce((sum, row) => sum + row.amountDue, 0), [arrearsEntries]);

  const entityOptions = useMemo(() => {
    const values = new Set<string>();
    companies.forEach((item) => values.add(companyLabel(item)));
    payments.forEach((item) => item.entity && values.add(item.entity));
    Object.values(requisitionDepartments).forEach((value) => value && values.add(value));
    receipts.forEach((item) => {
      const invoice = item.invoice_id ? invoiceMap[item.invoice_id] : null;
      if (invoice?.entity) values.add(invoice.entity);
    });
    invoices.forEach((item) => item.entity && values.add(item.entity));
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [companies, invoiceMap, invoices, payments, receipts, requisitionDepartments]);
  const customerOptions = useMemo(() => [...customers].sort((a, b) => a.customer_name.localeCompare(b.customer_name)), [customers]);
  const expenseGroupOptions = useMemo(
    () => Array.from(new Set(payments.map((row) => row.expense_group || '').filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [payments],
  );
  const incomeAccountOptions = useMemo(
    () => Array.from(new Set(invoices.map((row) => row.accounts_receivable_account || '').filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [invoices],
  );
  const bankAccountOptions = useMemo(
    () => bankAccounts.map((account) => ({ id: account.id, label: `${account.bank_name} - ${account.account_number}` })),
    [bankAccounts],
  );
  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    [...payments, ...receipts, ...invoices].forEach((row: any) => {
      const date = row.recording_date || row.payment_date || row.receipt_date || row.invoice_date || row.created_at;
      if (date) years.add(String(new Date(date).getFullYear()));
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [invoices, payments, receipts]);

  const showExpenses = view === 'all' || view === 'expenses';
  const showReceipts = view === 'all' || view === 'receipts';
  const showArrears = view === 'all' || view === 'arrears';

  const updateFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(emptyFilters);
  }, []);

  const onPrint = useCallback(() => {
    void printWorkspacePage();
  }, []);

  const renderSkeletonRows = (columns: number, rows = 4) =>
    Array.from({ length: rows }, (_, rowIndex) => (
      <tr key={rowIndex} className="rounded-2xl bg-slate-900/60 ring-1 ring-white/5">
        {Array.from({ length: columns }, (_, columnIndex) => (
          <td key={columnIndex} className="px-3 py-3">
            <div className={skeletonCls} style={{ height: 16, width: columnIndex === 0 ? 80 : 120 }} />
          </td>
        ))}
      </tr>
    ));

  const buildExpenseRowPrintHtml = useCallback((row: ExpenseEntry) => {
    return `
      <div style="border:1px solid #e2e8f0;border-radius:20px;padding:18px 20px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
          <div>
            <div style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#64748b;font-weight:800;">Expense Voucher</div>
            <h2 style="margin:6px 0 4px;font-size:22px;line-height:1.2;color:#0f172a;">${escapeHtml(row.description)}</h2>
            <div style="font-size:12px;color:#475569;">Ref: ${escapeHtml(row.ref)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#64748b;font-weight:800;">Date</div>
            <div style="margin-top:6px;font-size:14px;font-weight:800;color:#0f172a;">${escapeHtml(formatDate(row.date))}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px;">
          <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;font-weight:800;">Entity</div><div style="margin-top:6px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(row.entity)}</div></div>
          <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;font-weight:800;">Expense Group</div><div style="margin-top:6px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(row.expenseGroup)}</div></div>
          <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;font-weight:800;">Payee</div><div style="margin-top:6px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(row.payee)}</div></div>
          <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;font-weight:800;">Bank A/C</div><div style="margin-top:6px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(row.bankAccount)}</div></div>
          <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;font-weight:800;">Payment Method</div><div style="margin-top:6px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(row.paymentMethod)}</div></div>
          <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;font-weight:800;">Invoice No</div><div style="margin-top:6px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(row.invoiceNumber)}</div></div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:18px;">
          <div style="min-width:220px;border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;">
            <div style="display:flex;justify-content:space-between;gap:12px;"><span style="color:#64748b;">Quantity</span><strong style="color:#0f172a;">${Number(row.quantity || 0).toLocaleString()}</strong></div>
            <div style="display:flex;justify-content:space-between;gap:12px;margin-top:8px;"><span style="color:#64748b;">Unit Cost</span><strong style="color:#0f172a;">${formatMoney(row.unitCost)}</strong></div>
            <div style="display:flex;justify-content:space-between;gap:12px;margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0;"><span style="color:#64748b;font-weight:700;">Total</span><strong style="color:#0f172a;font-size:16px;">${formatMoney(row.totalCost)}</strong></div>
          </div>
        </div>
      </div>
    `;
  }, []);

  const buildReceiptRowPrintHtml = useCallback((row: ReceiptEntry) => {
    return `
      <div style="border:1px solid #e2e8f0;border-radius:20px;padding:18px 20px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
          <div>
            <div style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#64748b;font-weight:800;">Receipt</div>
            <h2 style="margin:6px 0 4px;font-size:22px;line-height:1.2;color:#0f172a;">${escapeHtml(row.receiptNumber)}</h2>
            <div style="font-size:12px;color:#475569;">Ref: ${escapeHtml(row.ref)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#64748b;font-weight:800;">Date</div>
            <div style="margin-top:6px;font-size:14px;font-weight:800;color:#0f172a;">${escapeHtml(formatDate(row.date))}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px;">
          <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;font-weight:800;">Entity</div><div style="margin-top:6px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(row.entity)}</div></div>
          <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;font-weight:800;">Payee</div><div style="margin-top:6px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(row.payee)}</div></div>
          <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;font-weight:800;">Invoice No</div><div style="margin-top:6px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(row.invoiceNumber)}</div></div>
          <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;font-weight:800;">Income Account</div><div style="margin-top:6px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(row.incomeAccount)}</div></div>
          <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;font-weight:800;">Payment Method</div><div style="margin-top:6px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(row.paymentMethod)}</div></div>
          <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;font-weight:800;">Bank A/C</div><div style="margin-top:6px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(row.bankAccount)}</div></div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:18px;">
          <div style="min-width:220px;border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;">
            <div style="display:flex;justify-content:space-between;gap:12px;"><span style="color:#64748b;font-weight:700;">Amount</span><strong style="color:#0f172a;font-size:16px;">${formatMoney(row.amount)}</strong></div>
          </div>
        </div>
      </div>
    `;
  }, []);

  const buildArrearsRowPrintHtml = useCallback((row: ArrearsEntry) => {
    return `
      <div style="border:1px solid #e2e8f0;border-radius:20px;padding:18px 20px;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
          <div>
            <div style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#64748b;font-weight:800;">Arrears</div>
            <h2 style="margin:6px 0 4px;font-size:22px;line-height:1.2;color:#0f172a;">${escapeHtml(row.invoiceNumber)}</h2>
            <div style="font-size:12px;color:#475569;">Customer: ${escapeHtml(row.customer)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#64748b;font-weight:800;">Invoice Date</div>
            <div style="margin-top:6px;font-size:14px;font-weight:800;color:#0f172a;">${escapeHtml(formatDate(row.invoiceDate))}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px;">
          <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;font-weight:800;">Entity</div><div style="margin-top:6px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(row.entity)}</div></div>
          <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;font-weight:800;">Income Account</div><div style="margin-top:6px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(row.incomeAccount)}</div></div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:18px;">
          <div style="min-width:220px;border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;">
            <div style="display:flex;justify-content:space-between;gap:12px;"><span style="color:#64748b;font-weight:700;">Amount Due</span><strong style="color:#0f172a;font-size:16px;">${formatMoney(row.amountDue)}</strong></div>
          </div>
        </div>
      </div>
    `;
  }, []);

  const expenseCsv = useMemo(() => {
    const header = [
      'Date',
      'Entity',
      'It Affects',
      'Item Description',
      'Specification',
      'Requisition Number',
      'Payee/Vendor',
      'Amount',
      'Total',
      'Running Total',
      'Expense Group',
      'Bank Account',
      'Payment Method',
      'Reference',
      'Quantity',
      'Unit Cost',
    ];

    const rows = filteredExpenses.map((row) => [
      row.date,
      row.entity,
      row.expenseGroup,
      row.itemDescription,
      row.specification,
      row.requisitionNumber,
      row.payee,
      row.unitCost,
      row.totalCost,
      row.cumulative,
      row.expenseGroup,
      row.expenseGroup,
      row.paymentMethod,
      row.ref,
      row.quantity,
      row.unitCost,
    ].map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','));

    return [header.map((value) => `"${value}"`).join(','), ...rows].join('\n');
  }, [filteredExpenses]);

  const exportExpenseCsv = useCallback(() => {
    if (filteredExpenses.length === 0) return;
    const blob = new Blob([expenseCsv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finance_expenses_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, [expenseCsv, filteredExpenses.length]);

  const printExpenseRow = useCallback((row: ExpenseEntry) => {
    printDocument({
      title: `Expense ${row.ref}`,
      subtitle: `${companyLabel(company)} • Printed ${new Date().toLocaleString()}`,
      bodyHtml: buildExpenseRowPrintHtml(row),
      footerHtml: `Generated from the finance expense report.`,
    });
  }, [buildExpenseRowPrintHtml, company]);

  const printReceiptRow = useCallback((row: ReceiptEntry) => {
    printDocument({
      title: `Receipt ${row.receiptNumber}`,
      subtitle: `${companyLabel(company)} â€¢ Printed ${new Date().toLocaleString()}`,
      bodyHtml: buildReceiptRowPrintHtml(row),
      footerHtml: `Generated from the finance receipts report.`,
    });
  }, [buildReceiptRowPrintHtml, company]);

  const printArrearsRow = useCallback((row: ArrearsEntry) => {
    printDocument({
      title: `Arrears ${row.invoiceNumber}`,
      subtitle: `${companyLabel(company)} â€¢ Printed ${new Date().toLocaleString()}`,
      bodyHtml: buildArrearsRowPrintHtml(row),
      footerHtml: `Generated from the finance arrears report.`,
    });
  }, [buildArrearsRowPrintHtml, company]);

  const printFilteredReceiptReport = useCallback(() => {
    const bodyHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #0f172a;">
        <h1 style="margin:0 0 12px;font-size:22px;">Filtered Receipts Report</h1>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead>
            <tr>
              ${['Date', 'Receipt No', 'Payee', 'Ref', 'Entity', 'Inv No', 'Amount', 'Method', 'Income Account'].map((heading) => `<th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:8px 6px;">${heading}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${receiptEntries.map((row) => `
              <tr>
                <td style="border-bottom:1px solid #e2e8f0;padding:8px 6px;">${escapeHtml(formatDate(row.date))}</td>
                <td style="border-bottom:1px solid #e2e8f0;padding:8px 6px;">${escapeHtml(row.receiptNumber)}</td>
                <td style="border-bottom:1px solid #e2e8f0;padding:8px 6px;">${escapeHtml(row.payee)}</td>
                <td style="border-bottom:1px solid #e2e8f0;padding:8px 6px;">${escapeHtml(row.ref)}</td>
                <td style="border-bottom:1px solid #e2e8f0;padding:8px 6px;">${escapeHtml(row.entity)}</td>
                <td style="border-bottom:1px solid #e2e8f0;padding:8px 6px;">${escapeHtml(row.invoiceNumber)}</td>
                <td style="border-bottom:1px solid #e2e8f0;padding:8px 6px;">${formatMoney(row.amount)}</td>
                <td style="border-bottom:1px solid #e2e8f0;padding:8px 6px;">${escapeHtml(row.paymentMethod)}</td>
                <td style="border-bottom:1px solid #e2e8f0;padding:8px 6px;">${escapeHtml(row.incomeAccount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    printDocument({
      title: 'Receipts Report',
      subtitle: `${companyLabel(company)} â€¢ Filtered ${new Date().toLocaleString()}`,
      bodyHtml,
      footerHtml: 'Generated from the finance receipts report.',
    });
  }, [company, receiptEntries]);

  const printFilteredArrearsReport = useCallback(() => {
    const bodyHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #0f172a;">
        <h1 style="margin:0 0 12px;font-size:22px;">Filtered Arrears Report</h1>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead>
            <tr>
              ${['Invoice Date', 'Inv No', 'Entity', 'Customer', 'Amount Due', 'Income Account'].map((heading) => `<th style="text-align:left;border-bottom:1px solid #cbd5e1;padding:8px 6px;">${heading}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${arrearsEntries.map((row) => `
              <tr>
                <td style="border-bottom:1px solid #e2e8f0;padding:8px 6px;">${escapeHtml(formatDate(row.invoiceDate))}</td>
                <td style="border-bottom:1px solid #e2e8f0;padding:8px 6px;">${escapeHtml(row.invoiceNumber)}</td>
                <td style="border-bottom:1px solid #e2e8f0;padding:8px 6px;">${escapeHtml(row.entity)}</td>
                <td style="border-bottom:1px solid #e2e8f0;padding:8px 6px;">${escapeHtml(row.customer)}</td>
                <td style="border-bottom:1px solid #e2e8f0;padding:8px 6px;">${formatMoney(row.amountDue)}</td>
                <td style="border-bottom:1px solid #e2e8f0;padding:8px 6px;">${escapeHtml(row.incomeAccount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    printDocument({
      title: 'Arrears Report',
      subtitle: `${companyLabel(company)} â€¢ Filtered ${new Date().toLocaleString()}`,
      bodyHtml,
      footerHtml: 'Generated from the finance arrears report.',
    });
  }, [arrearsEntries, company]);

  const deleteExpenseRow = useCallback(async (row: ExpenseEntry) => {
    if (!window.confirm(`Delete expense ${row.ref}? This will remove the voucher and its allocations.`)) {
      return;
    }

    try {
      const { error: allocationError } = await supabase
        .from('finance_payment_allocations')
        .delete()
        .eq('payment_id', row.paymentId);
      if (allocationError) throw allocationError;

      const { error: paymentError } = await supabase
        .from('finance_payments')
        .delete()
        .eq('id', row.paymentId);
      if (paymentError) throw paymentError;

      setToast({ message: 'Expense voucher deleted successfully.', type: 'success' });
      await loadData();
    } catch (error: any) {
      console.error('Failed to delete expense voucher:', error);
      setToast({ message: error.message || 'Failed to delete expense voucher.', type: 'error' });
    }
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f3042] p-6 text-slate-100 lg:p-10">
        <div className="mx-auto max-w-[1800px] space-y-6">
          <div className="rounded-[32px] border border-white/10 bg-[#0f3548] p-6 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.3)]">
            <div className="h-3 w-32 rounded-full bg-white/10" />
            <div className="mt-5 h-10 w-96 max-w-full rounded-2xl bg-white/10" />
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-2xl border border-white/10 bg-[#0b2234] p-4">
                  <div className="h-3 w-20 rounded-full bg-white/10" />
                  <div className="mt-4 h-8 w-24 rounded-2xl bg-white/10" />
                  <div className="mt-3 h-3 w-32 rounded-full bg-white/10" />
                </div>
              ))}
            </div>
          </div>

          {Array.from({ length: 3 }).map((_, sectionIndex) => (
            <div key={sectionIndex} className="rounded-[28px] border border-white/10 bg-[#0f3548] p-5">
              <div className="mb-4 h-8 w-56 rounded-2xl bg-white/10" />
              <div className="mb-3 h-10 w-full rounded-2xl bg-white/10" />
              <div className="space-y-3 overflow-hidden">
                {Array.from({ length: 4 }).map((__, rowIndex) => (
                  <div key={rowIndex} className="grid grid-cols-5 gap-3 rounded-2xl bg-slate-900/60 p-3">
                    <div className="h-4 rounded-full bg-white/10" />
                    <div className="h-4 rounded-full bg-white/10" />
                    <div className="h-4 rounded-full bg-white/10" />
                    <div className="h-4 rounded-full bg-white/10" />
                    <div className="h-4 rounded-full bg-white/10" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#0f3042] text-slate-100"
      data-print-company-name={companyLabel(company)}
      data-print-company-logo="/tough_force_logo.webp"
    >
      <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 rounded-[28px] border border-white/10 bg-[#0f3548] p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#6b39a4]/20 text-[#e8b9ff] ring-1 ring-[#e8b9ff]/20">
                <TrendingDown className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-fuchsia-200/80">Finance report</p>
                <h1 className="text-3xl font-black text-white sm:text-4xl">
                  {view === 'expenses' ? 'Expense Report' : view === 'receipts' ? 'Receipts Report' : view === 'arrears' ? 'Arrears Report' : 'Expense, Receipts & Arrears'}
                </h1>
              </div>
            </div>
            <p className="max-w-4xl text-sm text-slate-300">
              {view === 'expenses'
                ? 'Review expense vouchers with date, entity, account, and payment-method filters.'
                : view === 'receipts'
                  ? 'Review receipts with date, receipt number, payee, entity, and income-account filters.'
                  : view === 'arrears'
                    ? 'Review outstanding invoices and arrears with date, customer, entity, and income-account filters.'
                    : 'Review expenses, receipts, and outstanding arrears side by side with date, entity, account, and payment-method filters.'}
            </p>
            <div className="flex flex-wrap gap-3 text-xs text-slate-200">
              <span className="rounded-full border border-white/10 bg-[#0b2234] px-3 py-1.5">Company: {companyLabel(company)}</span>
              {showExpenses ? <span className="rounded-full border border-white/10 bg-[#0b2234] px-3 py-1.5">Expenses: {filteredExpenses.length}</span> : null}
              {showReceipts ? <span className="rounded-full border border-white/10 bg-[#0b2234] px-3 py-1.5">Receipts: {receiptEntries.length}</span> : null}
              {showArrears ? <span className="rounded-full border border-white/10 bg-[#0b2234] px-3 py-1.5">Arrears: {arrearsEntries.length}</span> : null}
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={resetFilters} className={actionButtonCls}>
              <RefreshCcw className="h-4 w-4" />
              Reset
            </button>
            <button type="button" onClick={onPrint} className={primaryButtonCls}>
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
        </div>

        {organizationNotice ? (
          <div className="mb-6 rounded-2xl border border-amber-400/30 bg-[#2a2018] px-4 py-3 text-sm text-amber-100">
            {organizationNotice}
          </div>
        ) : null}

        <div className={`${panelCls} mb-6 space-y-5`}>
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-[#e8b9ff]" />
              <h2 className="text-lg font-semibold text-white">Filters</h2>
            </div>
          {secondaryLoading ? (
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
              Loading receipt and arrears details in the background...
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-4">
            <label className="space-y-2">
              <span className={labelCls}>Company</span>
              <select
                className={inputCls}
                value={company?.id || ''}
                onChange={(event) => {
                  const selected = companies.find((item) => item.id === event.target.value) || null;
                  setCompany(selected);
                }}
              >
                <option value="">All companies</option>
                {companies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {companyLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className={labelCls}>Entity</span>
              <select className={inputCls} value={filters.entity} onChange={(event) => updateFilter('entity', event.target.value)}>
                <option value="">All entities</option>
                {entityOptions.map((entity) => (
                  <option key={entity} value={entity}>
                    {entity}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className={labelCls}>Customer</span>
              <select className={inputCls} value={filters.customerId} onChange={(event) => updateFilter('customerId', event.target.value)}>
                <option value="">All customers</option>
                {customerOptions.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.customer_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className={labelCls}>Expense Group</span>
              <select className={inputCls} value={filters.expenseGroup} onChange={(event) => updateFilter('expenseGroup', event.target.value)}>
                <option value="">All groups</option>
                {expenseGroupOptions.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-6">
            <label className="space-y-2">
              <span className={labelCls}>Date From</span>
              <input type="date" className={inputCls} value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} />
            </label>
            <label className="space-y-2">
              <span className={labelCls}>Date To</span>
              <input type="date" className={inputCls} value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} />
            </label>
            <label className="space-y-2">
              <span className={labelCls}>Month</span>
              <select className={inputCls} value={filters.month} onChange={(event) => updateFilter('month', event.target.value)}>
                <option value="">All months</option>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                  <option key={month} value={String(month)}>
                    {new Date(2024, month - 1, 1).toLocaleString(undefined, { month: 'long' })}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className={labelCls}>Year</span>
              <select className={inputCls} value={filters.year} onChange={(event) => updateFilter('year', event.target.value)}>
                <option value="">All years</option>
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className={labelCls}>Bank A/C</span>
              <select className={inputCls} value={filters.bankAccountId} onChange={(event) => updateFilter('bankAccountId', event.target.value)}>
                <option value="">All bank accounts</option>
                {bankAccountOptions.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className={labelCls}>Payment Method</span>
              <select className={inputCls} value={filters.paymentMethod} onChange={(event) => updateFilter('paymentMethod', event.target.value)}>
                <option value="">All methods</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="m-pesa">M-Pesa</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <label className="space-y-2">
              <span className={labelCls}>Invoice No</span>
              <input
                className={inputCls}
                value={filters.invoiceNumber}
                onChange={(event) => updateFilter('invoiceNumber', event.target.value)}
                placeholder="Search invoice number"
              />
            </label>
            <label className="space-y-2">
              <span className={labelCls}>Requisition No</span>
              <input
                className={inputCls}
                value={filters.requisitionNumber}
                onChange={(event) => updateFilter('requisitionNumber', event.target.value)}
                placeholder="Search requisition number"
              />
            </label>
            <label className="space-y-2">
              <span className={labelCls}>Receipt No</span>
              <input
                className={inputCls}
                value={filters.receiptNumber}
                onChange={(event) => updateFilter('receiptNumber', event.target.value)}
                placeholder="Search receipt number"
              />
            </label>
            <label className="space-y-2">
              <span className={labelCls}>Payee</span>
              <input
                className={inputCls}
                value={filters.payee}
                onChange={(event) => updateFilter('payee', event.target.value)}
                placeholder="Search payee"
              />
            </label>
            <label className="space-y-2">
              <span className={labelCls}>Search All</span>
              <input
                className={inputCls}
                value={filters.search}
                onChange={(event) => updateFilter('search', event.target.value)}
                placeholder="Search description, entity, vendor, ref"
              />
            </label>
            <label className="space-y-2">
              <span className={labelCls}>Income Account</span>
              <select className={inputCls} value={filters.incomeAccount} onChange={(event) => updateFilter('incomeAccount', event.target.value)}>
                <option value="">All income accounts</option>
                {incomeAccountOptions.map((account) => (
                  <option key={account} value={account}>
                    {account}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className={`grid gap-4 ${view === 'all' ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
          {showExpenses ? (
            <div className={`${panelCls} border-emerald-400/20`}>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200/80">Expenses total</p>
              <p className="mt-3 text-3xl font-black text-white">{formatMoney(expenseTotal)}</p>
              <p className="mt-2 text-sm text-slate-300">{filteredExpenses.length} expense line(s)</p>
            </div>
          ) : null}
          {showReceipts ? (
            <div className={`${panelCls} border-cyan-400/20`}>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200/80">Receipts total</p>
              <p className="mt-3 text-3xl font-black text-white">{formatMoney(receiptTotal)}</p>
              <p className="mt-2 text-sm text-slate-300">{receiptEntries.length} receipt(s)</p>
            </div>
          ) : null}
          {showArrears ? (
            <div className={`${panelCls} border-amber-400/20`}>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-200/80">Arrears total</p>
              <p className="mt-3 text-3xl font-black text-white">{formatMoney(arrearsTotal)}</p>
              <p className="mt-2 text-sm text-slate-300">{arrearsEntries.length} outstanding invoice(s)</p>
            </div>
          ) : null}
        </div>

        <div className="mt-6 space-y-6">
          {showExpenses ? <section className={panelCls}>
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Expenses</h2>
                <p className="text-sm text-slate-300">Item description, entity, what it affects, requisition number, amount, total, and the full voucher context.</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm text-slate-300">{filteredExpenses.length} row(s)</p>
                <button type="button" onClick={exportExpenseCsv} className={actionButtonCls}>
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
              </div>
            </div>
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-[#0b2234] px-4 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Grand Total</div>
                <div className="mt-1 text-2xl font-black text-white">{formatMoney(expenseTotal)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0b2234] px-4 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Entities</div>
                <div className="mt-1 text-2xl font-black text-white">{new Set(filteredExpenses.map((row) => row.entity || 'Unspecified entity')).size}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0b2234] px-4 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Lines</div>
                <div className="mt-1 text-2xl font-black text-white">{filteredExpenses.length}</div>
              </div>
            </div>
            <div className={tableWrapCls}>
              <div className="overflow-x-auto">
                <table className="min-w-[1550px] w-full border-collapse text-sm">
                <thead className={tableHeaderCls}>
                  <tr className="text-left text-xs uppercase tracking-[0.3em]">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Entity</th>
                    <th className="px-3 py-2">It Affects</th>
                    <th className="px-3 py-2">Item Description</th>
                    <th className="px-3 py-2">Specification</th>
                    <th className="px-3 py-2">Requisition No</th>
                    <th className="px-3 py-2">Payee/Vendor</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Running Total</th>
                    <th className="px-3 py-2">Expense group</th>
                    <th className="px-3 py-2">Payment Method</th>
                    <th className="px-3 py-2">Reference</th>
                    <th className="px-3 py-2">Bank A/C</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.length > 0 ? filteredExpenses.map((row) => (
                    <tr key={row.id} className={tableRowCls}>
                      <td className={tableCellCls}>{formatDate(row.date)}</td>
                      <td className={tableCellCls}>{row.entity}</td>
                      <td className={tableCellCls}>{row.expenseGroup}</td>
                      <td className={tableCellCls}>
                        <div className="font-medium text-slate-900 dark:text-white">{row.itemDescription}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{row.description}</div>
                      </td>
                      <td className={tableCellCls}>{row.specification}</td>
                      <td className={tableCellCls}>{row.requisitionNumber}</td>
                      <td className={tableCellCls}>{row.payee}</td>
                      <td className={tableCellCls}>{formatMoney(row.unitCost)}</td>
                      <td className={tableCellCls}>{formatMoney(row.totalCost)}</td>
                      <td className={tableCellCls}>{formatMoney(row.cumulative)}</td>
                      <td className={tableCellCls}>{row.paymentMethod}</td>
                      <td className={tableCellCls}>{row.ref}</td>
                      <td className={tableCellCls}>{row.bankAccount}</td>
                      <td className={tableCellCls}>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => printExpenseRow(row)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[#ff6a00]/30 hover:bg-white dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/[0.1]">
                            <Printer className="h-3.5 w-3.5" />
                            Print
                          </button>
                          <button type="button" onClick={() => deleteExpenseRow(row)} className="inline-flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-500/20 dark:text-rose-200">
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={15} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">
                        No expense records match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
                </table>
              </div>
            </div>
          </section> : null}

          {showReceipts ? <section className={panelCls}>
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Receipts</h2>
                <p className="text-sm text-slate-300">Receipt number, payee, entity, invoice reference, and payment channel.</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm text-slate-300">{receiptEntries.length} row(s)</p>
                <button type="button" onClick={printFilteredReceiptReport} className={actionButtonCls}>
                  <Printer className="h-4 w-4" />
                  Print Filtered
                </button>
              </div>
            </div>
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-[#0b2234] px-4 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Grand Total</div>
                <div className="mt-1 text-2xl font-black text-white">{formatMoney(receiptTotal)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0b2234] px-4 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Entities</div>
                <div className="mt-1 text-2xl font-black text-white">{new Set(receiptEntries.map((row) => row.entity || 'Unspecified entity')).size}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0b2234] px-4 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Lines</div>
                <div className="mt-1 text-2xl font-black text-white">{receiptEntries.length}</div>
              </div>
            </div>
            <div className={tableWrapCls}>
              <div className="overflow-x-auto">
                <table className="min-w-[1100px] w-full border-collapse text-sm">
                <thead className={tableHeaderCls}>
                  <tr className="text-left text-xs uppercase tracking-[0.3em]">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Receipt No</th>
                    <th className="px-3 py-2">Payee</th>
                    <th className="px-3 py-2">Ref</th>
                    <th className="px-3 py-2">Entity</th>
                    <th className="px-3 py-2">Inv No</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Method</th>
                    <th className="px-3 py-2">Income Account</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptEntries.length > 0 ? receiptEntries.map((row) => (
                    <tr key={row.id} className={tableRowCls}>
                      <td className={tableCellCls}>{formatDate(row.date)}</td>
                      <td className={tableCellCls}>{row.receiptNumber}</td>
                      <td className={tableCellCls}>{row.payee}</td>
                      <td className={tableCellCls}>{row.ref}</td>
                      <td className={tableCellCls}>{row.entity}</td>
                      <td className={tableCellCls}>{row.invoiceNumber}</td>
                      <td className={tableCellCls}>{formatMoney(row.amount)}</td>
                      <td className={tableCellCls}>{row.paymentMethod}</td>
                      <td className={tableCellCls}>{row.incomeAccount}</td>
                      <td className={tableCellCls}>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => printReceiptRow(row)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[#ff6a00]/30 hover:bg-white dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/[0.1]">
                            <Printer className="h-3.5 w-3.5" />
                            Print
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={10} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">
                        No receipt records match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
                </table>
              </div>
            </div>
          </section> : null}

          {showArrears ? <section className={panelCls}>
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Arrears</h2>
                <p className="text-sm text-slate-300">Outstanding invoices with entity, customer, and income account context.</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm text-slate-300">{arrearsEntries.length} row(s)</p>
                <button type="button" onClick={printFilteredArrearsReport} className={actionButtonCls}>
                  <Printer className="h-4 w-4" />
                  Print Filtered
                </button>
              </div>
            </div>
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-[#0b2234] px-4 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Grand Total</div>
                <div className="mt-1 text-2xl font-black text-white">{formatMoney(arrearsTotal)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0b2234] px-4 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Entities</div>
                <div className="mt-1 text-2xl font-black text-white">{new Set(arrearsEntries.map((row) => row.entity || 'Unspecified entity')).size}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#0b2234] px-4 py-3">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Lines</div>
                <div className="mt-1 text-2xl font-black text-white">{arrearsEntries.length}</div>
              </div>
            </div>
            <div className={tableWrapCls}>
              <div className="overflow-x-auto">
                <table className="min-w-[1000px] w-full border-collapse text-sm">
                <thead className={tableHeaderCls}>
                  <tr className="text-left text-xs uppercase tracking-[0.3em]">
                    <th className="px-3 py-2">Date of inv</th>
                    <th className="px-3 py-2">Inv No</th>
                    <th className="px-3 py-2">Entity</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Income Account</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {arrearsEntries.length > 0 ? arrearsEntries.map((row) => (
                    <tr key={row.id} className={tableRowCls}>
                      <td className={tableCellCls}>{formatDate(row.invoiceDate)}</td>
                      <td className={tableCellCls}>{row.invoiceNumber}</td>
                      <td className={tableCellCls}>{row.entity}</td>
                      <td className={tableCellCls}>{row.customer}</td>
                      <td className={tableCellCls}>{formatMoney(row.amountDue)}</td>
                      <td className={tableCellCls}>{row.incomeAccount}</td>
                      <td className={tableCellCls}>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => printArrearsRow(row)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[#ff6a00]/30 hover:bg-white dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/[0.1]">
                            <Printer className="h-3.5 w-3.5" />
                            Print
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">
                        No arrears records match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
                </table>
              </div>
            </div>
          </section> : null}
        </div>

        {toast ? <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
      </div>
    </div>
  );
};

export default FinanceExpenseReceiptsArrearsReport;
