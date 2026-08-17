// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Hash, Search, Printer, Calendar, TrendingUp, DollarSign } from 'lucide-react';
import { printWorkspacePage } from '../../utils/printHelpers';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';

interface Payment {
  id: string;
  reference_number: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  payment_type: string;
  status: string;
  tenant?: { full_name: string } | null;
  unit?: { unit_number: string; property?: { name: string } | null } | null;
}

export default function PaymentReference() {
  const { profile } = useAccess();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('re_payments')
        .select(`
          *,
          tenant:re_tenants!re_payments_tenant_id_fkey(full_name),
          unit:re_units!re_payments_unit_id_fkey(
            unit_number,
            property:re_properties!re_units_property_id_fkey(name)
          )
        `)
        .order('payment_date', { ascending: false });
      if (profile?.company_id) query = query.eq('company_id', profile.company_id);
      const { data, error } = await query;
      if (error) throw error;
      setPayments(data || []);
    } catch (err: any) {
      setToast({ message: 'Failed to load payment references', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (profile) fetchPayments(); }, [profile]);

  const filtered = payments.filter(p => {
    const matchSearch =
      (p.reference_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.tenant?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchMethod = methodFilter === 'all' || p.payment_method === methodFilter;
    const date = new Date(p.payment_date);
    const afterStart = !startDate || date >= new Date(startDate);
    const beforeEnd = !endDate || date <= new Date(endDate);
    return matchSearch && matchMethod && afterStart && beforeEnd;
  });

  const totalAmount = filtered.reduce((sum, p) => sum + p.amount, 0);

  const methodBadge = (method: string) => {
    const colors: Record<string, string> = {
      mpesa: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30',
      bank_transfer: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30',
      pesalink: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800/30',
      cash: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800/30',
      cheque: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10',
    };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${colors[method] || colors.cash}`}>{method.replace('_', ' ')}</span>;
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
              <Hash className="mr-3 text-brand-purple" size={32} />
              Payment Reference Report
            </h1>
            <p className="text-gray-500 dark:text-gray-400">Complete payment reference tracker for all transactions.</p>
          </div>
          <button onClick={() => printWorkspacePage()} title="Print or export the current payment reference report" className="px-4 py-2 bg-gray-800 dark:bg-white/10 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors flex items-center gap-2 shadow-sm">
            <Printer size={18} /> Print / Export
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-5 flex items-center gap-4">
            <div className="w-11 h-11 bg-brand-purple/10 rounded-xl flex items-center justify-center text-brand-purple"><Hash size={22} /></div>
            <div><p className="text-2xl font-bold text-gray-900 dark:text-white">{filtered.length}</p><p className="text-xs text-gray-500 dark:text-gray-400">Total Transactions</p></div>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-5 flex items-center gap-4">
            <div className="w-11 h-11 bg-green-100 dark:bg-green-900/20 rounded-xl flex items-center justify-center text-green-600 dark:text-green-400"><DollarSign size={22} /></div>
            <div><p className="text-2xl font-bold text-gray-900 dark:text-white">Ksh {totalAmount.toLocaleString()}</p><p className="text-xs text-gray-500 dark:text-gray-400">Total Collected</p></div>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-5 flex items-center gap-4">
            <div className="w-11 h-11 bg-blue-100 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400"><TrendingUp size={22} /></div>
            <div><p className="text-2xl font-bold text-gray-900 dark:text-white">Ksh {filtered.length > 0 ? Math.round(totalAmount / filtered.length).toLocaleString() : 0}</p><p className="text-xs text-gray-500 dark:text-gray-400">Average Payment</p></div>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input id="search-payments" type="text" placeholder="Search reference or tenant..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} title="Search for payment records by reference number or tenant name"
              className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 pl-10 pr-4 py-2.5 rounded-lg outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple" />
          </div>
          <input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 px-4 py-2.5 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-purple" placeholder="From date" title="Filter payments from this start date" />
          <input id="end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 px-4 py-2.5 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-purple" placeholder="To date" title="Filter payments until this end date" />
        </div>
        <div className="mb-6">
          <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)} aria-label="Filter by payment method" className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 px-4 py-2.5 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-purple">
            <option value="all">All Methods</option>
            <option value="mpesa">Mpesa</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="pesalink">Pesalink</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden print:shadow-none">
          {loading ? (
            <div className="p-12 flex justify-center"><CustomLoader size={32} label="Loading..." /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center"><Hash size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" /><p className="text-gray-500 dark:text-gray-400">No payment records found.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Reference #</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Tenant / Unit</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Date</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Method</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Type</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Amount</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {filtered.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-xs uppercase text-gray-800 dark:text-gray-200">{p.reference_number}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900 dark:text-white text-sm">{p.tenant?.full_name || '—'}</span>
                          {p.unit && <span className="text-xs text-gray-500 dark:text-gray-400">Unit {p.unit.unit_number} · {p.unit.property?.name}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(p.payment_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">{methodBadge(p.payment_method)}</td>
                      <td className="px-6 py-4 capitalize text-gray-600 dark:text-gray-400">{p.payment_type}</td>
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">Ksh {p.amount.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize border bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30">{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-white/5 border-t border-gray-200 dark:border-white/10">
                  <tr>
                    <td colSpan={5} className="px-6 py-4 font-bold text-gray-700 dark:text-gray-300">Total ({filtered.length} transactions)</td>
                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white text-base">Ksh {totalAmount.toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
