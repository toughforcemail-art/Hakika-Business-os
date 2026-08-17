// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { ZapOff, Search, DollarSign, CheckCircle, Clock, AlertTriangle, XCircle, Zap } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';

interface PostpaidBill {
  id: string;
  bill_month: string;
  meter_reading_open: number;
  meter_reading_close: number;
  units_consumed: number;
  rate_per_unit: number;
  amount_due: number;
  amount_paid: number;
  status: string;
  unit?: { unit_number: string; property?: { name: string } | null; water_utility_account?: string | null; electricity_utility_account?: string | null } | null;
  tenant?: { full_name: string } | null;
}

export default function PostpaidMeters() {
  const { profile } = useAccess();
  const [bills, setBills] = useState<PostpaidBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchBills = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('re_bills_power')
        .select(`
          *,
          unit:re_units(unit_number, property:re_properties(name)),
          tenant:re_tenants(full_name)
        `)
        .in('status', ['unpaid', 'partial', 'overdue'])
        .order('bill_month', { ascending: false });
      if (profile?.company_id) query = query.eq('company_id', profile.company_id);
      const { data, error } = await query;
      if (error) throw error;
      setBills(data || []);
    } catch (err: any) {
      setToast({ message: 'Failed to load postpaid meter bills', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) fetchBills();
  }, [profile]);

  const handlePay = async (id: string, amountDue: number, amountPaid: number) => {
    setUpdating(id);
    try {
      const { error } = await supabase
        .from('re_bills_power')
        .update({ amount_paid: amountDue, status: 'paid' })
        .eq('id', id);
      if (error) throw error;
      setToast({ message: 'Payment recorded!', type: 'success' });
      fetchBills();
    } catch {
      setToast({ message: 'Failed to record payment', type: 'error' });
    } finally {
      setUpdating(null);
    }
  };

  const filtered = bills.filter(b => {
    const matchSearch =
      (b.unit?.unit_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.tenant?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.unit?.property?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalOwed = filtered.reduce((sum, b) => sum + (b.amount_due - b.amount_paid), 0);

  const statusBadge = (status: string) => {
    const cls: Record<string, string> = {
      unpaid: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/30',
      partial: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800/30',
      overdue: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30',
    };
    return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize border ${cls[status] || ''}`}>{status}</span>;
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
            <ZapOff className="mr-3 text-brand-purple" size={32} />
            Postpaid Meters
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Manage outstanding postpaid power meter bills across all units.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-5 flex items-center gap-4">
            <div className="w-11 h-11 bg-brand-purple/10 rounded-xl flex items-center justify-center text-brand-purple"><ZapOff size={22} /></div>
            <div><p className="text-2xl font-bold text-gray-900 dark:text-white">{filtered.length}</p><p className="text-xs text-gray-500 dark:text-gray-400">Pending Bills</p></div>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-5 flex items-center gap-4">
            <div className="w-11 h-11 bg-red-100 dark:bg-red-900/20 rounded-xl flex items-center justify-center text-red-600 dark:text-red-400"><AlertTriangle size={22} /></div>
            <div><p className="text-2xl font-bold text-gray-900 dark:text-white">{bills.filter(b => b.status === 'overdue').length}</p><p className="text-xs text-gray-500 dark:text-gray-400">Overdue</p></div>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-5 flex items-center gap-4">
            <div className="w-11 h-11 bg-orange-100 dark:bg-orange-900/20 rounded-xl flex items-center justify-center text-orange-600 dark:text-orange-400"><DollarSign size={22} /></div>
            <div><p className="text-2xl font-bold text-gray-900 dark:text-white">Ksh {totalOwed.toLocaleString()}</p><p className="text-xs text-gray-500 dark:text-gray-400">Total Owed</p></div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input id="search-postpaid" type="text" placeholder="Search by unit, property or tenant..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} title="Search for postpaid meter bills by unit number, property name, or tenant"
              className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 pl-10 pr-4 py-2.5 rounded-lg outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter by status" className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 px-4 py-2.5 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-purple">
            <option value="all">All Statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center"><CustomLoader size={32} label="Loading bills..." /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Zap size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Pending Bills</h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">All postpaid meter bills are up to date.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Unit / Property</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Utility Accounts</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Tenant</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Bill Month</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Units (kWh)</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Amount Due</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Balance</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {filtered.map(b => (
                    <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900 dark:text-white">Unit {b.unit?.unit_number}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{b.unit?.property?.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-300">
                        <div className="flex flex-col gap-1">
                          <span>Water: {b.unit?.water_utility_account || 'N/A'}</span>
                          <span>Electricity: {b.unit?.electricity_utility_account || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{b.tenant?.full_name || '—'}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(b.bill_month).toLocaleDateString('en-KE', { month: 'short', year: 'numeric' })}</td>
                      <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{b.units_consumed}</td>
                      <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">Ksh {b.amount_due.toLocaleString()}</td>
                      <td className="px-6 py-4 font-bold text-red-600 dark:text-red-400">Ksh {(b.amount_due - b.amount_paid).toLocaleString()}</td>
                      <td className="px-6 py-4">{statusBadge(b.status)}</td>
                      <td className="px-6 py-4">
                        {updating === b.id ? (
                          <CustomLoader size={16} />
                        ) : (
                          <button onClick={() => handlePay(b.id, b.amount_due, b.amount_paid)}
                            title={`Mark bill for unit ${b.unit?.unit_number} as paid`}
                            className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1">
                            <CheckCircle size={12} />Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
