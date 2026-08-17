// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Banknote, Plus, Search, Calendar, User, Home, CheckCircle, Clock, XCircle, DollarSign, FileText, Landmark, Wallet } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { getTenantDisplayName } from '../../utils/tenantDisplay';

interface Tenant {
  id: string;
  full_name: string;
}

interface Unit {
  id: string;
  unit_number: string;
  property: { name: string };
}

interface Payment {
  id: string;
  reference_number: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  status: 'confirmed' | 'pending' | 'reversed';
  notes: string;
  tenant: { full_name: string };
  unit: { unit_number: string, property: { name: string } };
}

export default function ManualPayments() {
  const { profile } = useAccess();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    tenant_id: '',
    unit_id: '',
    amount: '',
    payment_method: 'bank_transfer',
    payment_date: new Date().toISOString().split('T')[0],
    reference_number: '',
    notes: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [paymentsRes, tenantsRes] = await Promise.all([
        supabase
        .from('re_payments')
        .select(`
          *,
          tenant:re_tenants!re_payments_tenant_id_fkey(full_name),
          unit:re_units!re_payments_unit_id_fkey(
            unit_number,
            property:re_properties!re_units_property_id_fkey(name)
          )
        `)
          .neq('payment_method', 'mpesa')
          .order('created_at', { ascending: false }),
        supabase.from('re_tenants').select('id, full_name').eq('is_active', true).order('full_name')
      ]);

      if (paymentsRes.error) throw paymentsRes.error;
      setPayments(paymentsRes.data || []);
      setTenants(tenantsRes.data || []);

    } catch (error: any) {
      setToast({ message: 'Failed to load payments', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchUnits = async (tenantId: string) => {
    try {
      const { data, error } = await supabase
        .from('re_tenants')
        .select(`
          current_unit_id,
          unit:re_units!current_unit_id(id, unit_number, property:re_properties(name))
        `)
        .eq('id', tenantId)
        .single();
      
      if (error) throw error;
      if (data?.unit) {
        setUnits([data.unit as any]);
        setFormData(prev => ({ ...prev, unit_id: data.current_unit_id || '' }));
      }
    } catch (error) {
       console.error('Error fetching units for tenant:', error);
    }
  };

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  useEffect(() => {
    if (formData.tenant_id) {
      fetchUnits(formData.tenant_id);
    }
  }, [formData.tenant_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tenant_id || !formData.amount || !formData.reference_number) {
       setToast({ message: 'Please fill in all required fields', type: 'warning' });
       return;
    }

    setIsSubmitting(true);
    try {
       const u = units.find(x => x.id === formData.unit_id);
       const { error } = await supabase
         .from('re_payments')
         .insert([{
            ...formData,
            amount: Number(formData.amount),
            status: 'confirmed',
            recorded_by: profile?.id,
            company_id: profile?.company_id,
            unit_id: formData.unit_id || null,
            property_id: (u as any)?.property_id || null
         }]);

       if (error) throw error;

       // Update invoice status if reference number matches? 
       // For now, just record payment.

       setToast({ message: 'Payment recorded successfully!', type: 'success' });
       setShowModal(false);
       setFormData({ tenant_id: '', unit_id: '', amount: '', payment_method: 'bank_transfer', payment_date: new Date().toISOString().split('T')[0], reference_number: '', notes: '' });
       fetchData();
    } catch (error: any) {
       setToast({ message: error.message || 'Failed to record payment', type: 'error' });
    } finally {
       setIsSubmitting(false);
    }
  };

  const filteredPayments = payments.filter(pay => 
    pay.reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pay.tenant?.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
              <Banknote className="mr-3 text-brand-purple" size={32} />
              Manual Payments
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Record payments received via Bank Transfer, Cash, or Cheque.
            </p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            title="Open form to record a new manual payment"
            className="px-4 py-2 bg-brand-purple text-white rounded-lg font-medium hover:bg-brand-pink transition-colors flex items-center shadow-sm"
          >
            <Plus size={18} className="mr-2" /> Record Payment
          </button>
        </div>

        <div className="relative mb-6">
          <label htmlFor="search-manual-payments" className="sr-only">Search manual payments by reference number or tenant name</label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            id="search-manual-payments"
            type="text"
            placeholder="Search by reference or tenant..."
            title="Search for manual payments by reference number or tenant name"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 pl-10 pr-4 py-2 rounded-lg outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple"
          />
        </div>

        {/* List */}
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
          {loading ? (
             <div className="p-12 flex justify-center">
               <CustomLoader size={32} label="Loading payment history..." />
             </div>
          ) : filteredPayments.length === 0 ? (
             <div className="p-12 text-center text-gray-500">
               <Banknote className="mx-auto mb-4 text-gray-300" size={48} />
               <p>No manual payments found.</p>
             </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-medium text-gray-500">Reference #</th>
                    <th className="px-6 py-4 font-medium text-gray-500">Tenant / Unit</th>
                    <th className="px-6 py-4 font-medium text-gray-500">Date</th>
                    <th className="px-6 py-4 font-medium text-gray-500">Method</th>
                    <th className="px-6 py-4 font-medium text-gray-500">Amount</th>
                    <th className="px-6 py-4 font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {filteredPayments.map((pay) => (
                    <tr key={pay.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-gray-900 dark:text-white uppercase">
                        {pay.reference_number}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900 dark:text-white">{pay.tenant ? getTenantDisplayName(pay.tenant as any) : 'Unknown Tenant'}</span>
                          <span className="text-xs text-gray-500">Unit {pay.unit?.unit_number} ({pay.unit?.property?.name})</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                        {new Date(pay.payment_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="flex items-center text-gray-700 dark:text-gray-300 capitalize">
                          {pay.payment_method === 'bank_transfer' ? <Landmark size={14} className="mr-2" /> : <Wallet size={14} className="mr-2" />}
                          {pay.payment_method.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-white text-base">
                        Ksh {pay.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                          <CheckCircle size={10} className="mr-1" /> {pay.status}
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

      {/* Record Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl w-full max-w-xl flex flex-col scale-in animate-fade-in">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                <Plus className="mr-2 text-brand-purple" size={24} />
                Record Manual Payment
              </h2>
               <button onClick={() => setShowModal(false)} title="Close record payment modal" className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="md:col-span-2">
                  <label htmlFor="pay-tenant" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Tenant *</label>
                  <select 
                    id="pay-tenant"
                    required
                    value={formData.tenant_id}
                    onChange={(e) => setFormData({...formData, tenant_id: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple outline-none"
                  >
                    <option value="">-- Select Tenant --</option>
                    {tenants.map(t => <option key={t.id} value={t.id}>{getTenantDisplayName(t as any)}</option>)}
                  </select>
                </div>

                 <div>
                  <label htmlFor="pay-method" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Payment Method *</label>
                  <select 
                    id="pay-method"
                    required
                    value={formData.payment_method}
                    onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple outline-none"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                 <div>
                  <label htmlFor="pay-amount" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Amount (Ksh) *</label>
                  <input 
                    id="pay-amount"
                    type="number" 
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    placeholder="e.g. 15000"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple outline-none"
                  />
                </div>

                 <div>
                  <label htmlFor="pay-date" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Date Paid *</label>
                  <input 
                    id="pay-date"
                    type="date" 
                    required
                    value={formData.payment_date}
                    onChange={(e) => setFormData({...formData, payment_date: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple outline-none"
                  />
                </div>

                 <div>
                  <label htmlFor="pay-reference" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Reference # *</label>
                  <input 
                    id="pay-reference"
                    type="text" 
                    required
                    placeholder="e.g. TRN123456"
                    value={formData.reference_number}
                    onChange={(e) => setFormData({...formData, reference_number: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple outline-none"
                  />
                </div>

                 <div className="md:col-span-2">
                  <label htmlFor="pay-notes" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Notes / Description</label>
                  <textarea 
                    id="pay-notes"
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple outline-none resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-2.5 bg-brand-purple text-white rounded-xl hover:bg-brand-pink transition-all font-semibold shadow-lg shadow-brand-purple/20 flex items-center disabled:opacity-50"
                >
                  {isSubmitting ? <><CustomLoader size={18} className="mr-2" /> Saving...</> : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
