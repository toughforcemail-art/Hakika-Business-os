// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, BookOpen, Building, Download, Printer, Search, Plus, Trash2 } from 'lucide-react';
import { printWorkspacePage } from '../../utils/printHelpers';
import { supabase } from '../../utils/supabase';
import CustomLoader from '../../components/CustomLoader';
import { useAccess } from '../../hooks/useAccess';
import { resolveOrganizationScope } from '../../utils/organizationScope';
import CustomToast, { ToastType } from '../../components/CustomToast';

type LedgerSource = 'payment' | 'receipt';
type LedgerDirection = 'credit' | 'debit';

interface LedgerEntry {
  id: string;
  source: LedgerSource;
  direction: LedgerDirection;
  reference: string;
  counterparty: string;
  affectedEntity: string;
  method: string;
  amount: number;
  currency: string;
  entryDate: string;
  createdAt: string;
  runningBalance: number;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  account_type: string;
  current_balance: number;
  is_active: boolean;
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

const panelCls = 'rounded-[24px] border border-gray-200 bg-white/95 p-5 shadow-[0_20px_70px_-45px_rgba(15,23,42,0.35)] backdrop-blur-sm dark:border-white/10 dark:bg-dark-surface/90';
const labelCls = 'text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400';
const ledgerRowCls = 'cursor-pointer text-gray-900 transition-colors hover:bg-slate-50/90 dark:text-white dark:hover:bg-[rgba(18,73,96,0.88)]';

const parseDate = (value?: string | null) => (value ? new Date(value).getTime() : 0);
const formatMoney = (value: number, currency = 'KES') =>
  `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const resolveAffectedEntity = (primary?: string | null, secondary?: string | null, fallback = 'General') => {
  const first = primary?.trim();
  const second = secondary?.trim();
  if (first && second && first !== second) return `${first} / ${second}`;
  return first || second || fallback;
};

const GlobalLedgerEnhanced: React.FC = () => {
  const { profile } = useAccess();
  const [loading, setLoading] = useState(true);
  const [organizationNotice, setOrganizationNotice] = useState<string | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [showBankForm, setShowBankForm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [bankFormData, setBankFormData] = useState({
    bank_name: '',
    account_number: '',
    account_holder_name: '',
    account_type: 'checking',
    current_balance: 0,
    module: '',
    entity: ''
  });

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const scope = await resolveOrganizationScope(profile);
      setOrganizationNotice(scope.notice);

      if (!scope.organizationId) {
        setEntries([]);
        return;
      }

      const [paymentsResponse, receiptsResponse] = await Promise.all([
        supabase
          .from('finance_payments')
          .select('id, payment_number, recording_date, payment_date, amount, currency, payment_method, cost_center, pay_from_account, created_at, payee:finance_payees(payee_name)')
          .eq('organization_id', scope.organizationId)
          .order('recording_date', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase
          .from('finance_receipts')
          .select('id, receipt_number, receipt_date, amount, currency, payment_method, received_from, source_module, category, created_at, customer:finance_customers(customer_name)')
          .eq('organization_id', scope.organizationId)
          .order('receipt_date', { ascending: true })
          .order('created_at', { ascending: true }),
      ]);

      if (paymentsResponse.error) throw paymentsResponse.error;
      if (receiptsResponse.error) throw receiptsResponse.error;

      const payments = (paymentsResponse.data || []) as PaymentRow[];
      const receipts = (receiptsResponse.data || []) as ReceiptRow[];

      const paymentEntries: LedgerEntry[] = payments.map((payment) => ({
        id: `payment-${payment.id}`,
        source: 'payment',
        direction: 'debit',
        reference: payment.payment_number || 'PAYMENT',
        counterparty: payment.payee?.[0]?.payee_name || 'Vendor',
        affectedEntity: resolveAffectedEntity(payment.cost_center, payment.pay_from_account, 'Payment account'),
        method: payment.payment_method || 'Unspecified',
        amount: Number(payment.amount || 0),
        currency: payment.currency || 'KES',
        entryDate: payment.recording_date || payment.payment_date || payment.created_at,
        createdAt: payment.created_at,
        runningBalance: 0,
      }));

      const receiptEntries: LedgerEntry[] = receipts.map((receipt) => ({
        id: `receipt-${receipt.id}`,
        source: 'receipt',
        direction: 'credit',
        reference: receipt.receipt_number || 'RECEIPT',
        counterparty: receipt.customer?.[0]?.customer_name || receipt.received_from || 'Customer',
        affectedEntity: resolveAffectedEntity(receipt.source_module, receipt.category, 'Receipt account'),
        method: receipt.payment_method || 'Unspecified',
        amount: Number(receipt.amount || 0),
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
      const withBalances = combined.map((entry) => {
        running += entry.direction === 'credit' ? entry.amount : -entry.amount;
        return { ...entry, runningBalance: running };
      });

      setEntries(withBalances);
    } catch (error) {
      console.error('Error fetching ledger:', error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBankAccounts = async () => {
    if (!profile?.company_id) return;
    try {
      const { data, error } = await supabase
        .from('re_bank_accounts')
        .select()
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBankAccounts(data || []);
    } catch (err) {
      console.error('Error fetching bank accounts:', err);
    }
  };

  const handleAddBankAccount = async () => {
    if (!profile?.company_id || !bankFormData.bank_name || !bankFormData.account_number || !bankFormData.account_holder_name || !bankFormData.module || !bankFormData.entity) {
      setToast({ message: 'Please fill in all required fields', type: 'warning' });
      return;
    }

    try {
      const { error } = await supabase.from('re_bank_accounts').insert([{
        company_id: profile.company_id,
        bank_name: bankFormData.bank_name,
        account_number: bankFormData.account_number,
        account_holder_name: bankFormData.account_holder_name,
        account_type: bankFormData.account_type,
        current_balance: Number(bankFormData.current_balance),
        module: bankFormData.module,
        entity: bankFormData.entity
      }]);

      if (error) throw error;
      setToast({ message: 'Bank account added successfully', type: 'success' });
      setBankFormData({
        bank_name: '',
        account_number: '',
        account_holder_name: '',
        account_type: 'checking',
        current_balance: 0,
        module: '',
        entity: ''
      });
      setShowBankForm(false);
      fetchBankAccounts();
    } catch (err: any) {
      setToast({ message: err.message || 'Error adding account', type: 'error' });
    }
  };

  const handleDeleteBankAccount = async (id: string) => {
    if (!confirm('Are you sure you want to delete this account?')) return;

    try {
      const { error } = await supabase.from('re_bank_accounts').delete().eq('id', id);
      if (error) throw error;
      setToast({ message: 'Account deleted successfully', type: 'success' });
      fetchBankAccounts();
    } catch (err: any) {
      setToast({ message: err.message || 'Error deleting account', type: 'error' });
    }
  };

  useEffect(() => {
    if (profile) {
      fetchLedger();
      fetchBankAccounts();
    }
  }, [profile]);

  const filteredEntries = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) {
      return [...entries].sort((left, right) => parseDate(right.entryDate) - parseDate(left.entryDate));
    }

    const filtered = entries.filter((entry) => {
      const haystack = `${entry.reference} ${entry.counterparty} ${entry.affectedEntity} ${entry.method} ${entry.source} ${entry.direction}`.toLowerCase();
      return haystack.includes(search);
    });

    return filtered.sort((left, right) => parseDate(right.entryDate) - parseDate(left.entryDate));
  }, [entries, searchTerm]);

  const totals = useMemo(() => {
    const totalReceipts = entries.filter((entry) => entry.source === 'receipt').reduce((sum, entry) => sum + entry.amount, 0);
    const totalPayments = entries.filter((entry) => entry.source === 'payment').reduce((sum, entry) => sum + entry.amount, 0);
    const runningBalance = entries.length > 0 ? entries[entries.length - 1].runningBalance : 0;
    return { totalReceipts, totalPayments, runningBalance };
  }, [entries]);

  const handlePrint = () => {
    printWorkspacePage();
  };

  const exportLedger = () => {
    if (filteredEntries.length === 0) return;

    const lines = [
      ['Reference', 'Counterparty', 'Entity Debited / Credited', 'Entry Type', 'Method', 'Amount', 'Currency', 'Date', 'Balance'].join(','),
      ...filteredEntries.map((entry) =>
        [
          `"${entry.reference}"`,
          `"${entry.counterparty}"`,
          `"${entry.affectedEntity}"`,
          `"${entry.direction === 'credit' ? 'Receipt Credit' : 'Payment Debit'}"`,
          `"${entry.method}"`,
          entry.direction === 'credit' ? entry.amount : -entry.amount,
          entry.currency,
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
  };

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
            Combined view of receipts and payments with running balances for your organization.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-white/5"
            title="Print Ledger"
            aria-label="Print Ledger"
          >
            <Printer size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={exportLedger}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-white/5"
            title="Download Ledger"
            aria-label="Download Ledger"
          >
            <Download size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {organizationNotice ? (
        <div className="rounded-[20px] border border-amber-200 bg-amber-50/90 px-5 py-4 text-sm text-amber-900 shadow-sm dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
          {organizationNotice}
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

      {/* Bank Accounts Section */}
      <div className="space-y-4 border-t border-gray-200 dark:border-dark-border pt-8">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Bank Accounts</h2>
          <button
            onClick={() => setShowBankForm(!showBankForm)}
            className="flex items-center gap-2 bg-brand-purple text-white px-4 py-2 rounded-lg hover:bg-brand-purple/90"
          >
            <Plus size={20} /> Add Account
          </button>
        </div>

        {showBankForm && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">* Required fields</p>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Bank Name *"
                value={bankFormData.bank_name}
                onChange={(e) => setBankFormData({ ...bankFormData, bank_name: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
              <input
                type="text"
                placeholder="Account Number *"
                value={bankFormData.account_number}
                onChange={(e) => setBankFormData({ ...bankFormData, account_number: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
              <input
                type="text"
                placeholder="Account Holder Name *"
                value={bankFormData.account_holder_name}
                onChange={(e) => setBankFormData({ ...bankFormData, account_holder_name: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
              <select
                value={bankFormData.account_type}
                onChange={(e) => setBankFormData({ ...bankFormData, account_type: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="business">Business</option>
              </select>
              <input
                type="number"
                placeholder="Current Balance"
                value={bankFormData.current_balance}
                onChange={(e) => setBankFormData({ ...bankFormData, current_balance: parseFloat(e.target.value) || 0 })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
              <select
                value={bankFormData.module}
                onChange={(e) => setBankFormData({ ...bankFormData, module: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select Module *</option>
                <option value="real_estate">Real Estate</option>
                <option value="hr">HR</option>
                <option value="security">Security</option>
                <option value="finance">Finance</option>
              </select>
              <input
                type="text"
                placeholder="Entity Debited / Credited *"
                value={bankFormData.entity}
                onChange={(e) => setBankFormData({ ...bankFormData, entity: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddBankAccount}
                className="px-4 py-2 bg-brand-purple text-white rounded-lg hover:bg-brand-purple/90"
              >
                Save Account
              </button>
              <button
                onClick={() => setShowBankForm(false)}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-700 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bankAccounts.map((account: any) => (
            <div key={account.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{account.bank_name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{account.account_number}</p>
                </div>
                <button
                  onClick={() => handleDeleteBankAccount(account.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{account.account_holder_name}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Type: {account.account_type}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Module: {account.module}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Entity: {account.entity}</p>
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <p className="text-xs text-gray-600 dark:text-gray-400">Current Balance</p>
                <p className="text-2xl font-bold text-brand-purple">KES {account.current_balance.toLocaleString()}</p>
              </div>
              <div className="mt-3">
                <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${account.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {account.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <label htmlFor="ledger-search" className="sr-only">
            Search transactions
          </label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} aria-hidden="true" />
          <input
            id="ledger-search"
            type="text"
            placeholder="Search by reference, counterparty, debited or credited entity, or method..."
            title="Search transactions"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full rounded-xl border border-gray-100 bg-gray-50 py-2 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-brand-purple dark:border-white/5 dark:bg-white/2"
          />
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:border-white/5 dark:bg-white/5">
              <th className="px-6 py-4">Reference</th>
              <th className="px-6 py-4">Counterparty</th>
              <th className="px-6 py-4">Entity Debited / Credited</th>
              <th className="px-6 py-4">Entry</th>
              <th className="px-6 py-4">Method</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {filteredEntries.map((entry) => (
              <tr key={entry.id} className={ledgerRowCls}>
                <td className="px-6 py-4 font-mono text-[10px] font-bold text-brand-purple">{entry.reference}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-slate-300">
                      <Building size={12} />
                    </div>
                    <span className="text-xs font-bold">{entry.counterparty}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-xs">
                  <div className="space-y-1">
                    <span className="font-bold text-slate-700 dark:text-slate-100">{entry.affectedEntity}</span>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      {entry.direction === 'credit' ? 'Credited entity' : 'Debited entity'}
                    </p>
                  </div>
                </td>
                <td className="px-6 py-4 text-xs">
                  <span className={`flex items-center gap-1 font-bold ${entry.direction === 'credit' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {entry.direction === 'credit' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {entry.direction === 'credit' ? 'Credit' : 'Debit'}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-gray-500 dark:text-dark-text-muted">{entry.method}</td>
                <td className={`px-6 py-4 text-xs font-black ${entry.direction === 'credit' ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
                  {entry.direction === 'credit' ? '+' : '-'}
                  {formatMoney(entry.amount, entry.currency)}
                </td>
                <td className="px-6 py-4 text-[10px] text-gray-400 dark:text-slate-400">{entry.entryDate}</td>
                <td className="px-6 py-4 text-xs font-black text-slate-900 dark:text-white">{formatMoney(entry.runningBalance, entry.currency)}</td>
              </tr>
            ))}
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-300">
                  No ledger entries found for the selected filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default GlobalLedgerEnhanced;
