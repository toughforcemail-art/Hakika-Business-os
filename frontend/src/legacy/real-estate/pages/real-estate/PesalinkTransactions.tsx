// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { CreditCard, Search, User, Home, CheckCircle } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';

interface Payment {
  id: string;
  reference_number: string;
  amount: number;
  payment_date: string;
  status: string;
  notes: string | null;
  tenant?: { full_name: string } | null;
  unit?: { unit_number: string; property?: { name: string } | null } | null;
}

export default function PesalinkTransactions() {
  const { profile } = useAccess();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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
        .eq('payment_method', 'pesalink')
        .order('created_at', { ascending: false });
      if (profile?.company_id) query = query.eq('company_id', profile.company_id);
      const { data, error } = await query;
      if (error) throw error;
      setPayments(data || []);
    } catch (err: any) {
      setToast({ message: 'Failed to load Pesalink transactions', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) fetchPayments();
  }, [profile]);

  const filtered = payments.filter(p =>
    (p.reference_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.tenant?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalAmount = filtered.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
            <CreditCard className="mr-3 text-brand-purple" size={32} />
            Pesalink Transactions
          </h1>
          <p className="text-gray-500 dark:text-gray-400">View all payments received via Pesalink bank transfer.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-5 flex items-center gap-4">
            <div className="w-11 h-11 bg-brand-purple/10 rounded-xl flex items-center justify-center text-brand-purple"><CreditCard size={22} /></div>
            <div><p className="text-2xl font-bold text-gray-900 dark:text-white">{filtered.length}</p><p className="text-xs text-gray-500 dark:text-gray-400">Transactions</p></div>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-5 flex items-center gap-4">
            <div className="w-11 h-11 bg-green-100 dark:bg-green-900/20 rounded-xl flex items-center justify-center text-green-600 dark:text-green-400"><CheckCircle size={22} /></div>
            <div><p className="text-2xl font-bold text-gray-900 dark:text-white">Ksh {totalAmount.toLocaleString()}</p><p className="text-xs text-gray-500 dark:text-gray-400">Total Received</p></div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input id="search-pesalink" type="text" placeholder="Search by reference or tenant..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} title="Search for Pesalink transactions by reference number or tenant name"
            className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 pl-10 pr-4 py-2.5 rounded-lg outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple" />
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center"><CustomLoader size={32} label="Loading transactions..." /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <CreditCard size={40} className="text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Pesalink Transactions</h3>
              <p className="text-gray-500 dark:text-gray-400">Pesalink payments will appear here once recorded.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Reference #</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Tenant / Unit</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Date</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Amount</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Notes</th>
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
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-white text-base">Ksh {p.amount.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize border bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30">
                          <CheckCircle size={10} className="mr-1" />{p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400 max-w-xs truncate">{p.notes || '—'}</td>
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
