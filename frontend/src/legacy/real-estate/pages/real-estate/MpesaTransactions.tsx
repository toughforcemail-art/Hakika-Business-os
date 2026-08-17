// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Smartphone, Search, Filter, Calendar, User, Home, Download, CheckCircle, Clock, XCircle, CreditCard, ExternalLink, RefreshCw } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';

interface Payment {
  id: string;
  reference_number: string;
  amount: number;
  payment_date: string;
  status: 'confirmed' | 'pending' | 'reversed';
  payment_type: string;
  tenant: { full_name: string, phone: string };
  unit: { unit_number: string, property: { name: string } };
}

export default function MpesaTransactions() {
  const { profile } = useAccess();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('re_payments')
        .select(`
          *,
          tenant:re_tenants!re_payments_tenant_id_fkey(full_name, phone),
          unit:re_units!re_payments_unit_id_fkey(
            unit_number,
            property:re_properties!re_units_property_id_fkey(name)
          )
        `)
        .eq('payment_method', 'mpesa')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error: any) {
      setToast({ message: 'Failed to load M-PESA transactions', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  const filteredPayments = payments.filter(pay => 
    pay.reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pay.tenant?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pay.tenant?.phone?.includes(searchTerm)
  );

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
              <Smartphone className="mr-3 text-[#29B036]" size={32} />
              M-PESA Transactions
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Real-time log of all mobile money payments through M-PESA.
            </p>
          </div>
          <button 
            onClick={fetchData}
            title="Refresh transaction list from M-PESA"
            className="p-2 bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-lg text-gray-600 hover:text-brand-purple transition-colors"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-dark-surface p-4 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm mb-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              id="search-mpesa-transactions"
              type="text"
              placeholder="Search by receipt #, name or phone..."
              title="Search for M-PESA transactions by receipt number, name, or phone number"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 pl-10 pr-4 py-2 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white"
            />
          </div>
          <button title="Export M-PESA transaction history to CSV file" className="px-4 py-2 bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
            <Download size={16} /> Export CSV
          </button>
        </div>

        {/* List */}
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center">
              <CustomLoader size={32} label="Syncing with M-PESA gatekeeper..." />
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Smartphone className="mx-auto mb-4 text-gray-300" size={48} />
              <p>No M-PESA transactions found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#29B036]/5 dark:bg-[#29B036]/10 border-b border-[#29B036]/10">
                  <tr>
                    <th className="px-6 py-4 font-bold text-gray-600 dark:text-gray-300">Receipt #</th>
                    <th className="px-6 py-4 font-bold text-gray-600 dark:text-gray-300">Tenant / Phone</th>
                    <th className="px-6 py-4 font-bold text-gray-600 dark:text-gray-300">Property / Unit</th>
                    <th className="px-6 py-4 font-bold text-gray-600 dark:text-gray-300">Payment Date</th>
                    <th className="px-6 py-4 font-bold text-gray-600 dark:text-gray-300">Amount</th>
                    <th className="px-6 py-4 font-bold text-gray-600 dark:text-gray-300">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {filteredPayments.map((pay) => (
                    <tr key={pay.id} className="hover:bg-[#29B036]/5 dark:hover:bg-[#29B036]/5 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                        {pay.reference_number}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900 dark:text-white">{pay.tenant?.full_name}</span>
                          <span className="text-xs text-gray-500">{pay.tenant?.phone}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-gray-900 dark:text-white font-medium">{pay.unit?.property?.name}</span>
                          <span className="text-xs text-brand-purple font-bold">Unit {pay.unit?.unit_number}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                        {new Date(pay.payment_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 font-extrabold text-[#29B036] text-base">
                        Ksh {pay.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          pay.status === 'confirmed' ? 'bg-[#29B036]/10 text-[#29B036]' : 'bg-orange-100 text-orange-600'
                        }`}>
                          {pay.status === 'confirmed' ? <CheckCircle size={10} className="mr-1" /> : <Clock size={10} className="mr-1" />}
                          {pay.status}
                        </span>
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
