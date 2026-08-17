// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { AlertOctagon, Plus, Search, XCircle, User, Calendar, DollarSign } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';

interface Tenant {
  id: string;
  full_name: string;
}

interface Penalty {
  id: string;
  reference_number: string;
  amount: number;
  payment_date: string;
  notes: string | null;
  status: string;
  tenant?: { full_name: string } | null;
}

const emptyForm = {
  tenant_id: '',
  amount: '',
  notes: '',
  payment_date: new Date().toISOString().split('T')[0],
};

export default function PenaltiesManagement() {
  const { profile } = useAccess();
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [penRes, tenRes] = await Promise.all([
        supabase
          .from('re_payments')
          .select('*')
          .eq('payment_type', 'penalty')
          .order('created_at', { ascending: false }),
        supabase.from('re_tenants').select('id, full_name').eq('is_active', true).order('full_name'),
      ]);
      
      if (penRes.error) throw penRes.error;
      
      const penaltiesData = penRes.data || [];
      const tenantsData = tenRes.data || [];

      const joinedPenalties = penaltiesData.map((p: any) => ({
        ...p,
        tenant: tenantsData.find(t => t.id === p.tenant_id) || null
      }));

      setPenalties(joinedPenalties);
      setTenants(tenantsData);
    } catch (err: any) {
      console.error('Error fetching penalties:', err);
      setToast({ message: 'Failed to load penalties', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tenant_id || !formData.amount) {
      setToast({ message: 'Tenant and amount are required', type: 'warning' });
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('re_payments').insert([{
        tenant_id: formData.tenant_id,
        amount: Number(formData.amount),
        payment_date: formData.payment_date,
        notes: formData.notes || null,
        payment_type: 'penalty',
        payment_method: 'manual',
        status: 'confirmed',
        recorded_by: profile?.id,
        company_id: profile?.company_id,
      }]);
      if (error) throw error;
      setToast({ message: 'Penalty recorded successfully!', type: 'success' });
      setShowModal(false);
      setFormData(emptyForm);
      fetchData();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to record penalty', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = penalties.filter(p =>
    (p.tenant?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.reference_number || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPenalties = filtered.reduce((sum, p) => sum + p.amount, 0);

  const inputCls = 'w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple outline-none';

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
              <AlertOctagon className="mr-3 text-red-500" size={32} />
              Penalties Management
            </h1>
            <p className="text-gray-500 dark:text-gray-400">Track and record late payment penalties imposed on tenants.</p>
          </div>
          <button onClick={() => setShowModal(true)} title="Open modal to add a new penalty payment" className="px-4 py-2 bg-brand-purple text-white rounded-lg font-medium hover:bg-brand-pink transition-colors flex items-center shadow-sm">
            <Plus size={18} className="mr-2" /> Add Penalty
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-5 flex items-center gap-4">
            <div className="w-11 h-11 bg-red-100 dark:bg-red-900/20 rounded-xl flex items-center justify-center text-red-600 dark:text-red-400"><AlertOctagon size={22} /></div>
            <div><p className="text-2xl font-bold text-gray-900 dark:text-white">{filtered.length}</p><p className="text-xs text-gray-500 dark:text-gray-400">Total Penalties</p></div>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-5 flex items-center gap-4">
            <div className="w-11 h-11 bg-orange-100 dark:bg-orange-900/20 rounded-xl flex items-center justify-center text-orange-600 dark:text-orange-400"><DollarSign size={22} /></div>
            <div><p className="text-2xl font-bold text-gray-900 dark:text-white">Ksh {totalPenalties.toLocaleString()}</p><p className="text-xs text-gray-500 dark:text-gray-400">Total Penalty Amount</p></div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <label htmlFor="search-penalties" className="sr-only">Search penalties by tenant or reference</label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input id="search-penalties" type="text" placeholder="Search by tenant or reference..." title="Search penalties" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 pl-10 pr-4 py-2.5 rounded-lg outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple" />
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center"><CustomLoader size={32} label="Loading penalties..." /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <AlertOctagon size={40} className="text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Penalties Found</h3>
              <p className="text-gray-500 dark:text-gray-400">Use the "Add Penalty" button to record a late fee.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Reference</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Tenant</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Date</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Amount</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Notes</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {filtered.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-xs text-gray-700 dark:text-gray-300 uppercase">{p.reference_number}</td>
                      <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{p.tenant?.full_name || '—'}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{new Date(p.payment_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 font-bold text-red-600 dark:text-red-400">Ksh {p.amount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400 max-w-xs truncate">{p.notes || '—'}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize border bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30">{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center"><AlertOctagon className="mr-2 text-red-500" size={22} /> Add Penalty</h2>
              <button onClick={() => setShowModal(false)} title="Close modal" className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><XCircle size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label htmlFor="penalty-tenant" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Tenant *</label>
                <select id="penalty-tenant" required value={formData.tenant_id} onChange={e => setFormData({...formData, tenant_id: e.target.value})} title="Select tenant to penalize" className={inputCls}>
                  <option value="">-- Select Tenant --</option>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="penalty-amount" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Penalty Amount (Ksh) *</label>
                <input id="penalty-amount" required type="number" min="1" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="e.g. 2000" title="Penalty Amount in Ksh" className={inputCls} />
              </div>
              <div>
                <label htmlFor="penalty-date" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Date</label>
                <input id="penalty-date" type="date" value={formData.payment_date} onChange={e => setFormData({...formData, payment_date: e.target.value})} title="Penalty Date" className={inputCls} />
              </div>
              <div>
                <label htmlFor="penalty-notes" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Reason / Notes</label>
                <textarea id="penalty-notes" rows={2} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="e.g. Late payment for January 2026" title="Penalty Reason or Notes" className={`${inputCls} resize-none`} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition-colors font-semibold">Cancel</button>
                <button type="submit" disabled={isSubmitting} title="Record the penalty in the system" className="px-8 py-2.5 bg-brand-purple text-white rounded-xl hover:bg-brand-pink transition-all font-semibold shadow-lg shadow-brand-purple/20 flex items-center disabled:opacity-50">
                  {isSubmitting ? <><CustomLoader size={18} className="mr-2" />Saving...</> : 'Record Penalty'}
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
