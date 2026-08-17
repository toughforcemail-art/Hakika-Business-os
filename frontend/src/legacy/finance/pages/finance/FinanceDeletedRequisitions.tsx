// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RotateCcw, Search, Trash2, Undo2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { useAccess } from '../../hooks/useAccess';
import { resolveOrganizationScope } from '../../utils/organizationScope';
import { supabase } from '../../utils/supabase';

type RequisitionPriority = 'low' | 'normal' | 'high' | 'urgent';
type RequisitionStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'ordered' | 'fulfilled';
type BankChargeMode = 'included_in_total' | 'additional_expense';

interface FinanceRequisition {
  id: string;
  organization_id: string;
  requisition_number: string;
  title: string;
  department: string | null;
  needed_by: string | null;
  priority: RequisitionPriority;
  status: RequisitionStatus;
  approval_stage: 'submitted' | 'accounts_approved' | 'director_approved' | 'rejected';
  justification: string | null;
  vendor_preference: string | null;
  notes: string | null;
  bank_charge_amount: number;
  bank_charge_mode: BankChargeMode;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

interface FinanceRequisitionItem {
  id: string;
  requisition_id: string;
  item_description: string;
  specification: string | null;
  quantity: number;
  unit_cost: number;
  line_total: number;
  preferred_vendor: string | null;
  display_order: number;
}

const panelCls = 'rounded-[28px] border border-gray-200 bg-white/95 p-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur-sm dark:border-white/10 dark:bg-dark-surface/90';
const subtleButtonCls = 'inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:border-[#ff6a00]/40 dark:hover:bg-white/[0.06]';
const primaryButtonCls = 'inline-flex items-center justify-center gap-2 rounded-2xl bg-[#ff6a00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e85f00] disabled:cursor-not-allowed disabled:opacity-60';

const STATUS_LABELS: Record<RequisitionStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  ordered: 'Ordered',
  fulfilled: 'Fulfilled',
};

const formatMoney = (value: number) =>
  `KES ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getStatusClasses = (status?: string | null) => {
  switch (status) {
    case 'approved':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
    case 'rejected':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300';
    case 'ordered':
      return 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300';
    case 'fulfilled':
      return 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300';
    case 'draft':
      return 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200';
    default:
      return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
  }
};

const getPriorityClasses = (priority?: string | null) => {
  switch (priority) {
    case 'urgent':
      return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300';
    case 'high':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300';
    case 'normal':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-300';
  }
};

const FinanceDeletedRequisitions: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAccess();

  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [organizationNotice, setOrganizationNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [requisitions, setRequisitions] = useState<FinanceRequisition[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);

    try {
      const scope = await resolveOrganizationScope(profile);
      setOrganizationNotice(scope.notice);

      if (!scope.organizationId) {
        setRequisitions([]);
        setOrganizationNotice('Your profile is not linked to an organization yet.');
        return;
      }

      // Try to fetch deleted requisitions
      let requisitionData: any;
      let requisitionError: any;
      
      try {
        const result = await supabase
          .from('finance_requisitions')
          .select('id, organization_id, requisition_number, title, department, needed_by, priority, status, approval_stage, justification, vendor_preference, notes, bank_charge_amount, bank_charge_mode, created_at, deleted_at, deleted_by')
          .eq('organization_id', scope.organizationId)
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false });
        
        requisitionData = result.data;
        requisitionError = result.error;
      } catch (err) {
        // If deleted_at column doesn't exist, show empty list
        console.warn('Soft delete columns not yet available:', err);
        setRequisitions([]);
        setOrganizationNotice('Soft delete feature is not yet available. Please apply the latest migration.');
        return;
      }

      if (requisitionError) throw requisitionError;

      setRequisitions((requisitionData || []) as FinanceRequisition[]);
    } catch (error: any) {
      console.error('Failed to load deleted requisitions:', error);
      setToast({ message: error.message || 'Failed to load deleted requisitions.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      void loadData();
    }
  }, [profile]);

  const filteredRequisitions = useMemo(
    () =>
      requisitions.filter((entry) => {
        const search = searchTerm.toLowerCase();
        return (
          entry.requisition_number.toLowerCase().includes(search) ||
          entry.title.toLowerCase().includes(search) ||
          (entry.department || '').toLowerCase().includes(search)
        );
      }),
    [requisitions, searchTerm],
  );

  const restoreRequisition = async (requisitionId: string) => {
    if (!window.confirm('Are you sure you want to restore this requisition?')) return;

    setRestoring(true);

    try {
      const { error } = await supabase
        .from('finance_requisitions')
        .update({
          deleted_at: null,
          deleted_by: null,
        })
        .eq('id', requisitionId);

      if (error) throw error;

      await loadData();
      setToast({ message: 'Requisition restored successfully.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to restore requisition:', error);
      setToast({ message: error.message || 'Failed to restore requisition.', type: 'error' });
    } finally {
      setRestoring(false);
    }
  };

  const permanentlyDeleteRequisition = async (requisitionId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this requisition? This action cannot be undone.')) return;

    setRestoring(true);

    try {
      const { error } = await supabase
        .from('finance_requisitions')
        .delete()
        .eq('id', requisitionId);

      if (error) throw error;

      await loadData();
      setToast({ message: 'Requisition permanently deleted.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to permanently delete requisition:', error);
      setToast({ message: error.message || 'Failed to permanently delete requisition.', type: 'error' });
    } finally {
      setRestoring(false);
    }
  };

  if (loading) {
    return <CustomLoader label="Loading deleted requisitions..." />;
  }

  return (
    <div className="min-h-screen space-y-6 bg-[#f6f7fb] p-6 dark:bg-[#061723]">
      <div className={`${panelCls} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/app/finance/expenses')}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
            title="Back to Requisitions"
            aria-label="Back to Requisitions"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Deleted Requisitions</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">View and restore deleted requisitions or permanently remove them.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void loadData()} className={subtleButtonCls}>
            <RotateCcw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {organizationNotice ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50/90 px-5 py-4 text-sm text-amber-900 shadow-sm dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
          {organizationNotice}
        </div>
      ) : null}

      <div className={panelCls}>
        <div className="mb-4 flex flex-col gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Trash</p>
            <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Deleted Requisitions</h2>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by number, title, or department..."
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-[#ff6a00]/40 focus:bg-white focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-[#082131] dark:text-white dark:focus:border-[#ff6a00]/40 dark:focus:bg-[#0b2a3c]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10">
                <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Requisition #</th>
                <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Title</th>
                <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 hidden md:table-cell">Department</th>
                <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Priority</th>
                <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 hidden lg:table-cell">Deleted</th>
                <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/10">
              {filteredRequisitions.map((requisition) => (
                <tr key={requisition.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 text-sm font-semibold text-slate-900 dark:text-white">{requisition.requisition_number}</td>
                  <td className="px-5 py-3 text-sm text-slate-700 dark:text-slate-200 max-w-xs truncate">{requisition.title}</td>
                  <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-300 hidden md:table-cell">{requisition.department || '-'}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] whitespace-nowrap ${getStatusClasses(requisition.status)}`}>
                      {STATUS_LABELS[requisition.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] whitespace-nowrap ${getPriorityClasses(requisition.priority)}`}>
                      {requisition.priority}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400 hidden lg:table-cell">
                    {requisition.deleted_at ? new Date(requisition.deleted_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void restoreRequisition(requisition.id)}
                        disabled={restoring}
                        title="Restore requisition"
                        className="rounded-lg bg-emerald-600 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors inline-flex items-center gap-1"
                      >
                        <Undo2 size={12} />
                        <span className="hidden sm:inline">Restore</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void permanentlyDeleteRequisition(requisition.id)}
                        disabled={restoring}
                        title="Permanently delete requisition"
                        className="rounded-lg bg-red-600 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors inline-flex items-center gap-1"
                      >
                        <Trash2 size={12} />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRequisitions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                    {searchTerm ? 'No deleted requisitions match your search.' : 'No deleted requisitions found.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {toast ? <CustomToast message={toast.message} type={toast.type} isVisible={true} onClose={() => setToast(null)} /> : null}
    </div>
  );
};

export default FinanceDeletedRequisitions;
