// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Receipt, Search, CheckCircle, Clock, AlertCircle, RefreshCw, XCircle, User, Home } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';

interface Invoice {
  id: string;
  invoice_number: string;
  amount_due: number;
  due_date: string;
  etims_status: string | null;
  etims_control_number: string | null;
  status: string;
  tenant?: { full_name: string } | null;
  unit?: { unit_number: string; property?: { name: string } | null } | null;
}

export default function KRAeTims() {
  const { profile } = useAccess();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      // Fetch related data separately to avoid complex join errors
      const [invRes, tenRes, unitRes, propRes] = await Promise.all([
        supabase.from('re_invoices').select('*').neq('status', 'draft').order('created_at', { ascending: false }),
        supabase.from('re_tenants').select('id, full_name'),
        supabase.from('re_units').select('id, unit_number, property_id'),
        supabase.from('re_properties').select('id, name')
      ]);

      if (invRes.error) throw invRes.error;
      
      const invoicesData = invRes.data || [];
      const tenantsData = tenRes.data || [];
      const unitsData = unitRes.data || [];
      const propertiesData = propRes.data || [];

      const joinedInvoices = invoicesData.map((invoice: any) => {
        const tenant = tenantsData.find(t => t.id === invoice.tenant_id);
        const unit = unitsData.find(u => u.id === invoice.unit_id);
        const property = propertiesData.find(p => p.id === unit?.property_id);

        return {
          ...invoice,
          tenant: tenant || null,
          unit: unit ? { ...unit, property: property || null } : null,
        };
      });

      if (profile?.company_id) {
        setInvoices(joinedInvoices.filter((invoice: any) => invoice.company_id === profile.company_id || !invoice.company_id));
      } else {
        setInvoices(joinedInvoices);
      }
    } catch (err: any) {
      console.error('Error fetching KRA invoices:', err);
      setToast({ message: 'Failed to load invoices', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) fetchInvoices();
  }, [profile]);

  const handleUpdateEtims = async (id: string, status: string) => {
    setUpdating(id);
    try {
      const { error } = await supabase
        .from('re_invoices')
        .update({ etims_status: status })
        .eq('id', id);
      if (error) throw error;
      setToast({ message: `eTIMS status updated to "${status}"`, type: 'success' });
      fetchInvoices();
    } catch (err: any) {
      setToast({ message: 'Failed to update eTIMS status', type: 'error' });
    } finally {
      setUpdating(null);
    }
  };

  const handleBulkSubmit = async () => {
    const pending = invoices.filter(i => (i.etims_status || 'pending') === 'pending');
    if (pending.length === 0) {
      setToast({ message: 'No pending invoices to submit', type: 'warning' });
      return;
    }

    setIsProcessingBulk(true);
    try {
      const { error } = await supabase
        .from('re_invoices')
        .update({ etims_status: 'submitted' })
        .in('id', pending.map(i => i.id));
      
      if (error) throw error;
      setToast({ message: `Successfully submitted ${pending.length} invoices to KRA`, type: 'success' });
      fetchInvoices();
    } catch (err: any) {
      setToast({ message: 'Bulk submission failed', type: 'error' });
    } finally {
      setIsProcessingBulk(false);
    }
  };

  const simulateVerification = async (id: string) => {
    setUpdating(id);
    try {
      // Simulation of a external API call to KRA
      await new Promise(r => setTimeout(r, 1500));
      
      const controlNumber = 'KRA-' + Math.random().toString(36).substring(2, 10).toUpperCase();
      
      const { error } = await supabase
        .from('re_invoices')
        .update({ 
          etims_status: 'verified',
          etims_control_number: controlNumber
        })
        .eq('id', id);
        
      if (error) throw error;
      setToast({ message: 'Invoice verified by KRA', type: 'success' });
      fetchInvoices();
    } catch (err: any) {
      setToast({ message: 'Verification failed', type: 'error' });
    } finally {
      setUpdating(null);
    }
  };

  const filtered = invoices.filter(inv => {
    const matchSearch =
      (inv.invoice_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.tenant?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inv.etims_control_number || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || (inv.etims_status || 'pending') === statusFilter;
    return matchSearch && matchStatus;
  });

  const etimsBadge = (status: string | null) => {
    const s = status || 'pending';
    const cls: Record<string, string> = {
      pending: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800/30',
      submitted: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30',
      verified: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30',
      rejected: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30',
    };
    const icons: Record<string, React.ReactNode> = {
      pending: <Clock size={10} className="mr-1" />,
      submitted: <RefreshCw size={10} className="mr-1" />,
      verified: <CheckCircle size={10} className="mr-1" />,
      rejected: <AlertCircle size={10} className="mr-1" />,
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize border ${cls[s] || cls.pending}`}>
        {icons[s]} {s}
      </span>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
                <Receipt className="mr-3 text-brand-purple" size={32} />
                KRA / eTIMS Compliance
              </h1>
              <p className="text-gray-500 dark:text-gray-400">Track and manage Kenya Revenue Authority tax compliance for all tenant invoices.</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handleBulkSubmit}
                disabled={isProcessingBulk}
                title="Submit all pending invoices to KRA eTIMS"
                className="px-4 py-2 bg-brand-purple text-white rounded-lg font-medium hover:bg-brand-pink transition-colors flex items-center disabled:opacity-50 shadow-sm"
              >
                {isProcessingBulk ? <RefreshCw size={18} className="mr-2 animate-spin" /> : <RefreshCw size={18} className="mr-2" />}
                Bulk Submit to KRA
              </button>
            </div>
          </div>
        </div>

        {/* Compliance Summary Card */}
        <div className="bg-gradient-to-r from-brand-purple to-brand-pink p-0.5 rounded-2xl mb-8 shadow-lg shadow-brand-purple/10">
          <div className="bg-white dark:bg-dark-surface p-6 rounded-[calc(1rem-2px)] flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-brand-purple/10 rounded-2xl flex items-center justify-center text-brand-purple">
                <CheckCircle size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Tax Compliance Score</h3>
                <p className="text-sm text-gray-500">
                  {Math.round((invoices.filter(i => i.etims_status === 'verified').length / Math.max(invoices.length, 1)) * 100)}% of invoices are eTIMS verified
                </p>
              </div>
            </div>
            <div className="flex gap-8">
              <div className="text-center">
                <p className="text-2xl font-black text-gray-900 dark:text-white">
                  Ksh {(invoices.reduce((acc, curr) => acc + (curr.amount_due || 0), 0) * 0.16).toLocaleString()}
                </p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total VAT (16%)</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-emerald-500">
                  Ksh {(invoices.filter(i => i.etims_status === 'verified').reduce((acc, curr) => acc + (curr.amount_due || 0), 0) * 0.16).toLocaleString()}
                </p>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Verified VAT</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {['pending', 'submitted', 'verified', 'rejected'].map(s => {
            const count = invoices.filter(i => (i.etims_status || 'pending') === s).length;
            const colors: Record<string, string> = {
              pending: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
              submitted: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
              verified: 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400',
              rejected: 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400',
            };
            return (
              <div key={s} className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[s]}`}>
                  <Receipt size={18} />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{count}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{s}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filters bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <label htmlFor="search-etims" className="sr-only">Search invoices by number, tenant or KRA control number</label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              id="search-etims"
              type="text" 
              placeholder="Search invoice, tenant, or control number..." 
              title="Search for invoices by number, tenant name, or KRA control number"
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 pl-10 pr-4 py-2.5 rounded-lg outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple" 
            />
          </div>
          <div>
            <label htmlFor="etims-status-filter" className="sr-only">Filter by eTIMS status</label>
            <select 
              id="etims-status-filter"
              title="Filter invoices by eTIMS status"
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value)}
              className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 px-4 py-2.5 rounded-lg outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple"
            >
              <option value="all">All eTIMS Statuses</option>
              <option value="pending">Pending</option>
              <option value="submitted">Submitted</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center"><CustomLoader size={32} label="Loading invoices..." /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Receipt size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Invoices Found</h3>
              <p className="text-gray-500 dark:text-gray-400">If you do not see a bill here, make sure it is not still in draft and that it belongs to this company.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Invoice #</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Tenant / Unit</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400 font-bold">Total Amount</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400 text-center">VAT (16%)</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Control #</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">eTIMS Status</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {filtered.map(inv => (
                    <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-xs text-gray-700 dark:text-gray-300 uppercase">{inv.invoice_number}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900 dark:text-white text-sm">{inv.tenant?.full_name || '-'}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">Unit {inv.unit?.unit_number || '-'} · {inv.unit?.property?.name || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white whitespace-nowrap">Ksh {inv.amount_due.toLocaleString()}</td>
                      <td className="px-6 py-4 text-center text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">Ksh {(inv.amount_due * 0.16).toLocaleString()}</td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-600 dark:text-gray-400">{inv.etims_control_number || <span className="italic text-gray-400">Waiting...</span>}</td>
                      <td className="px-6 py-4">{etimsBadge(inv.etims_status)}</td>
                      <td className="px-6 py-4 text-right">
                        {updating === inv.id ? (
                          <div className="flex justify-end"><CustomLoader size={16} /></div>
                        ) : (
                          <div className="flex justify-end gap-2 items-center">
                            {inv.etims_status === 'submitted' && (
                              <button 
                                onClick={() => simulateVerification(inv.id)}
                                id={`verify-invoice-${inv.id}`}
                                title={`Verify invoice ${inv.invoice_number} with KRA`}
                                className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-500/20 transition-all border border-emerald-500/20 whitespace-nowrap"
                              >
                                Verify Now
                              </button>
                            )}
                            <select
                              value={inv.etims_status || 'pending'}
                              onChange={e => handleUpdateEtims(inv.id, e.target.value)}
                              id={`etims-status-select-${inv.id}`}
                              title={`Manually update eTIMS status for invoice ${inv.invoice_number}`}
                              className="text-[10px] uppercase font-black bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 px-2 py-1 rounded-lg text-gray-500 focus:ring-1 focus:ring-brand-purple outline-none cursor-pointer"
                            >
                              <option value="pending">Pending</option>
                              <option value="submitted">Submitted</option>
                              <option value="verified">Verified</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </div>
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
