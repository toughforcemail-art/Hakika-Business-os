// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { AlertTriangle, Search, Home, User, Filter, TrendingDown, Send, Settings2, ArrowRightLeft } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import { useNavigate } from 'react-router-dom';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { formatInvoiceDate, getDerivedArrearsStatus, getInvoiceBalance, toMoney } from '../../utils/arrears';
import { callDaraja } from '../../services/darajaService';
import { summarizeHakikaSplit } from '../../utils/hakikaLedger';
import { getTenantDisplayName } from '../../utils/tenantDisplay';

interface ArrearsItem {
  id: string;
  invoice_number?: string | null;
  amount_due: number;
  amount_paid: number;
  service_fee_mode?: string | null;
  service_fee_value?: number | null;
  service_fee_amount?: number | null;
  landlord_payable_amount?: number | null;
  due_date?: string | null;
  status: string;
  tenant?: { id: string; full_name?: string | null; profile?: { full_name?: string | null; email?: string | null } | null } | null;
  unit?: { unit_number?: string | null; property?: { name?: string | null } | null } | null;
}

export default function ArrearsManagement() {
  const { profile } = useAccess();
  const navigate = useNavigate();
  const [arrears, setArrears] = useState<ArrearsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [interestRate, setInterestRate] = useState(() => Number(localStorage.getItem('hakika_interest_rate') || '10'));
  const [interestMode, setInterestMode] = useState<'percent' | 'flat'>((localStorage.getItem('hakika_interest_mode') as 'percent' | 'flat') || 'percent');
  const [stkTarget, setStkTarget] = useState<ArrearsItem | null>(null);
  const [stkAmount, setStkAmount] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    localStorage.setItem('hakika_interest_rate', String(interestRate));
    localStorage.setItem('hakika_interest_mode', interestMode);
  }, [interestRate, interestMode]);

  const fetchArrears = async () => {
    setLoading(true);
    try {
      // Fetch invoices, tenants, and units separately to avoid complex join errors
      const [invRes, tenRes, unitRes, propRes] = await Promise.all([
        supabase.from('re_invoices').select('*').is('deleted_at', null).order('due_date', { ascending: true }),
        supabase.from('re_tenants').select('id, full_name, profile:profiles(full_name, email)'),
        supabase.from('re_units').select('id, unit_number, property_id'),
        supabase.from('re_properties').select('id, name, service_fee_mode, service_fee_value')
      ]);

      if (invRes.error) throw invRes.error;
      
      const invoicesData = invRes.data || [];
      const tenantsData = tenRes.data || [];
      const unitsData = unitRes.data || [];
      const propertiesData = propRes.data || [];

      const joinedData = invoicesData.map((item: any) => {
        const tenant = tenantsData.find(t => t.id === item.tenant_id);
        const unit = unitsData.find(u => u.id === item.unit_id);
        const property = propertiesData.find(p => p.id === unit?.property_id);
        const splitMode = (item.service_fee_mode || property?.service_fee_mode || interestMode) as 'percent' | 'flat';
        const splitRate = Number(item.service_fee_value ?? property?.service_fee_value ?? interestRate) || 0;
        const gross = Number(item.amount_due || 0);
        const serviceFee = item.service_fee_amount != null
          ? Number(item.service_fee_amount || 0)
          : (splitMode === 'flat' ? Math.min(gross, splitRate) : Math.round((gross * splitRate / 100) * 100) / 100);

        return {
          ...item,
          invoice_number: item.invoice_number || `INV-${String(item.id || '').slice(0, 8).toUpperCase()}`,
          amount_due: toMoney(item.amount_due),
          amount_paid: toMoney(item.amount_paid),
          service_fee_mode: splitMode,
          service_fee_value: splitRate,
          service_fee_amount: serviceFee,
          landlord_payable_amount: item.landlord_payable_amount != null ? Number(item.landlord_payable_amount || 0) : Math.max(0, gross - serviceFee),
          status: getDerivedArrearsStatus(item),
          tenant: tenant || null,
          unit: unit ? { ...unit, property: property || null } : null,
        };
      });

      setArrears(joinedData.filter((item: ArrearsItem) => getInvoiceBalance(item) > 0));
    } catch (err: any) {
      console.error('Error fetching arrears:', err);
      setToast({ message: 'Failed to load arrears', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) fetchArrears();
  }, [profile?.company_id]);

  const filtered = arrears.filter(item => {
    const matchesSearch =
      (item.tenant ? getTenantDisplayName(item.tenant).toLowerCase() : '').includes(searchTerm.toLowerCase()) ||
      (item.invoice_number || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalOwed = filtered.reduce((sum, i) => sum + getInvoiceBalance(i), 0);
  const totalCount = filtered.length;

  const statusBadge = (status: string) => {
    const cls: Record<string, string> = {
      overdue: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30',
      partial: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800/30',
      unpaid: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/30',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize border ${cls[status] || 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10'}`}>
        {status}
      </span>
    );
  };

  const openStkDialog = (item: ArrearsItem) => {
    setStkTarget(item);
    setStkAmount(String(getInvoiceBalance(item)));
  };

  const sendStkNow = async () => {
    if (!stkTarget) return;
    try {
      const amount = Number(stkAmount || getInvoiceBalance(stkTarget));
      const response = await callDaraja({
        action: 'stk-push',
        amount,
        phoneNumber: stkTarget.tenant?.phone || '',
        accountReference: stkTarget.invoice_number || 'HAKIKA',
        transactionDesc: `Hakika STK for ${stkTarget.tenant ? getTenantDisplayName(stkTarget.tenant) : 'tenant'}`,
        service_key: 'hakika',
        company_code: profile?.company_code || null,
      });

      const summary = summarizeHakikaSplit({ amount, rate: Number(localStorage.getItem('hakika_interest_rate') || '10'), mode: (localStorage.getItem('hakika_interest_mode') as 'percent' | 'flat') || 'percent' });
      setToast({
        message: `${response?.response?.CustomerMessage || 'STK sent successfully'}. ${summary}`,
        type: 'success',
      });
      navigate('/app/real-estate/reconciliation', {
        state: {
          invoiceId: stkTarget.id,
          invoiceNumber: stkTarget.invoice_number,
          balance: amount,
        },
      });
      setStkTarget(null);
      setStkAmount('');
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to send STK', type: 'error' });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
            <AlertTriangle className="mr-3 text-orange-500" size={32} />
            Arrears Management
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Track all outstanding and overdue invoices across your portfolio.</p>
        </div>

        <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-white/10 p-5 mb-6 flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-brand-purple/10 text-brand-purple rounded-xl flex items-center justify-center">
              <Settings2 size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Interest adjustment</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Applies to automatic split after M-Pesa STK callback.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 lg:ml-auto">
            <select
              value={interestMode}
              onChange={(e) => setInterestMode(e.target.value as 'percent' | 'flat')}
              className="bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 px-3 py-2 rounded-lg text-sm outline-none text-gray-900 dark:text-white"
            >
              <option value="percent">Percentage</option>
              <option value="flat">Flat fee</option>
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              value={interestRate}
              onChange={(e) => setInterestRate(Number(e.target.value))}
              className="w-28 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 px-3 py-2 rounded-lg text-sm outline-none text-gray-900 dark:text-white"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">{interestMode === 'percent' ? '%' : 'KES'}</span>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-5 flex items-center gap-4">
            <div className="w-11 h-11 bg-red-100 dark:bg-red-900/20 rounded-xl flex items-center justify-center text-red-600 dark:text-red-400">
              <AlertTriangle size={22} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Invoices in Arrears</p>
            </div>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-5 flex items-center gap-4">
            <div className="w-11 h-11 bg-orange-100 dark:bg-orange-900/20 rounded-xl flex items-center justify-center text-orange-600 dark:text-orange-400">
              <TrendingDown size={22} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">Ksh {totalOwed.toLocaleString()}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Balance Owed</p>
            </div>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-5 flex items-center gap-4">
            <div className="w-11 h-11 bg-red-100 dark:bg-red-900/20 rounded-xl flex items-center justify-center text-red-600 dark:text-red-400">
              <AlertTriangle size={22} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{arrears.filter(a => a.status === 'overdue').length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Overdue Invoices</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <label htmlFor="search-arrears" className="sr-only">Search arrears by tenant or invoice number</label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              id="search-arrears"
              type="text"
              placeholder="Search by tenant or invoice number..."
              title="Search by tenant name or invoice number"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 pl-10 pr-4 py-2.5 rounded-lg outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="status-filter" className="text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Filter Status</label>
            <select
              id="status-filter"
              title="Filter by invoice status"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 px-4 py-2.5 rounded-lg outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple"
            >
              <option value="all">All Statuses</option>
              <option value="overdue">Overdue</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center"><CustomLoader size={32} label="Loading arrears..." /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 text-green-600 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Arrears Found</h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm">All invoices are up to date.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Invoice #</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Tenant / Unit</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Due Date</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Amount Due</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Split</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Paid</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Balance</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">STK</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {filtered.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">{item.invoice_number}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="flex items-center font-semibold text-gray-900 dark:text-white text-sm"><User size={12} className="mr-1.5 text-brand-purple" />{item.tenant ? getTenantDisplayName(item.tenant) : '-'}</span>
                          <span className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-0.5"><Home size={11} className="mr-1" />Unit {item.unit?.unit_number || 'N/A'} - {item.unit?.property?.name || 'Unassigned Property'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {formatInvoiceDate(item.due_date)}
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">Ksh {item.amount_due.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <div className="text-xs">
                          <p className="font-semibold text-gray-900 dark:text-white">Fee: Ksh {Number(item.service_fee_amount || 0).toLocaleString()}</p>
                          <p className="text-gray-500">Landlord: Ksh {Number(item.landlord_payable_amount || 0).toLocaleString()}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-green-600 dark:text-green-400 font-semibold">
                        {item.amount_paid > 0 ? `Ksh ${item.amount_paid.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-6 py-4 font-bold text-red-600 dark:text-red-400">
                        Ksh {getInvoiceBalance(item).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">{statusBadge(item.status)}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => openStkDialog(item)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-purple text-white font-semibold hover:bg-brand-pink transition-colors"
                        >
                          <Send size={14} />
                          Send STK
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {stkTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 shadow-2xl">
            <div className="p-5 border-b border-gray-200 dark:border-white/10">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Send STK Push</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {stkTarget.tenant ? getTenantDisplayName(stkTarget.tenant) : 'Tenant'} - {stkTarget.invoice_number}
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-gray-50 dark:bg-black/20 p-3">
                  <p className="text-xs uppercase text-gray-400 font-bold">Invoice balance</p>
                  <p className="font-bold text-gray-900 dark:text-white">Ksh {getInvoiceBalance(stkTarget).toLocaleString()}</p>
                </div>
                <div className="rounded-xl bg-gray-50 dark:bg-black/20 p-3">
                  <p className="text-xs uppercase text-gray-400 font-bold">Interest</p>
                  <p className="font-bold text-gray-900 dark:text-white">{interestRate}{interestMode === 'percent' ? '%' : ' KES'}</p>
                </div>
                <div className="rounded-xl bg-gray-50 dark:bg-black/20 p-3 sm:col-span-2">
                  <p className="text-xs uppercase text-gray-400 font-bold">Split preview</p>
                  <p className="font-bold text-gray-900 dark:text-white">
                    Fee Ksh {Number(stkTarget.service_fee_amount || 0).toLocaleString()} | Landlord Ksh {Number(stkTarget.landlord_payable_amount || 0).toLocaleString()}
                  </p>
                </div>
              </div>
              <label className="block">
                <span className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Amount to request</span>
                <input
                  type="number"
                  value={stkAmount}
                  onChange={(e) => setStkAmount(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 px-4 py-2.5 rounded-xl outline-none text-gray-900 dark:text-white"
                />
              </label>
            </div>
            <div className="p-5 border-t border-gray-200 dark:border-white/10 flex justify-end gap-3">
              <button
                onClick={() => { setStkTarget(null); setStkAmount(''); }}
                className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={sendStkNow}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold inline-flex items-center gap-2"
              >
                <Send size={14} />
                Queue STK
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
