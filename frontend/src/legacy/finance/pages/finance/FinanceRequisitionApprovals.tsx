// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardList, Printer, RotateCcw, Trash2, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { useAccess } from '../../hooks/useAccess';
import { resolveOrganizationScope } from '../../utils/organizationScope';
import { fetchRowsInBatches } from '../../utils/fetchRowsInBatches';
import { supabase } from '../../utils/supabase';
import { escapeHtml, printDocument } from '../../utils/printHelpers';

type RequisitionPriority = 'low' | 'normal' | 'high' | 'urgent';
type RequisitionStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'ordered' | 'fulfilled';
type ApprovalStage = 'submitted' | 'accounts_approved' | 'director_approved' | 'rejected';
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
  approval_stage: ApprovalStage;
  justification: string | null;
  vendor_preference: string | null;
  notes: string | null;
  bank_charge_amount: number;
  bank_charge_mode: BankChargeMode;
  created_at: string;
  accounts_approved_by: string | null;
  accounts_approved_at: string | null;
  director_approved_by: string | null;
  director_approved_at: string | null;
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
  pending_approval: 'Pending Accounts Review',
  approved: 'Approved',
  rejected: 'Rejected',
  ordered: 'Ordered',
  fulfilled: 'Fulfilled',
};

const STATUS_FLOW: RequisitionStatus[] = ['pending_approval', 'approved', 'ordered', 'fulfilled'];

const formatMoney = (value: number) =>
  `KES ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const errorText = (error: any) => `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
const isMissingRequisitionWorkflow = (error: any) => errorText(error).includes('finance_requisition');

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

const formatIsoDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : '-');

const FinanceRequisitionApprovals: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAccess();
  const inspectorRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [workflowReady, setWorkflowReady] = useState(true);
  const [organizationNotice, setOrganizationNotice] = useState<string | null>(null);
  const [dataNotice, setDataNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [requisitions, setRequisitions] = useState<FinanceRequisition[]>([]);
  const [items, setItems] = useState<FinanceRequisitionItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | RequisitionStatus>('pending_approval');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);

    try {
      const scope = await resolveOrganizationScope(profile);
      setOrganizationNotice(scope.notice);
      setDataNotice(null);

      if (!scope.organizationId) {
        setWorkflowReady(false);
        setRequisitions([]);
        setItems([]);
        setOrganizationNotice('Your profile is not linked to an organization yet, so requisition approvals cannot be loaded.');
        return;
      }

      // Try to fetch with deleted_at filter first (if migration is applied)
      let requisitionData: any;
      let requisitionError: any;
      
      try {
        const result = await supabase
          .from('finance_requisitions')
          .select('id, organization_id, requisition_number, title, department, needed_by, priority, status, approval_stage, justification, vendor_preference, notes, bank_charge_amount, bank_charge_mode, accounts_approved_by, accounts_approved_at, director_approved_by, director_approved_at, created_at')
          .eq('organization_id', scope.organizationId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });
        
        requisitionData = result.data;
        requisitionError = result.error;
      } catch (err) {
        // If deleted_at column doesn't exist, fetch without the filter
        const result = await supabase
          .from('finance_requisitions')
          .select('id, organization_id, requisition_number, title, department, needed_by, priority, status, approval_stage, justification, vendor_preference, notes, bank_charge_amount, bank_charge_mode, accounts_approved_by, accounts_approved_at, director_approved_by, director_approved_at, created_at')
          .eq('organization_id', scope.organizationId)
          .order('created_at', { ascending: false });
        
        requisitionData = result.data;
        requisitionError = result.error;
      }

      if (requisitionError) {
        if (isMissingRequisitionWorkflow(requisitionError)) {
          setWorkflowReady(false);
          setRequisitions([]);
          setItems([]);
          setDataNotice('Apply the requisitions migration before using approvals.');
          return;
        }

        throw requisitionError;
      }

      const nextRequisitions = (requisitionData || []) as FinanceRequisition[];
      const requisitionIds = nextRequisitions.map((entry) => entry.id);
      if (requisitionIds.length > 0) {
        setItemsLoading(true);
        void (async () => {
          try {
            const nextItems = await fetchRowsInBatches<FinanceRequisitionItem>({
              ids: requisitionIds,
              batchSize: 50,
              fetchBatch: (batchIds) =>
                supabase
                  .from('finance_requisition_items')
                  .select('id, requisition_id, item_description, specification, quantity, unit_cost, line_total, preferred_vendor, display_order')
                  .in('requisition_id', batchIds)
                  .order('display_order', { ascending: true }),
            });
            setItems(nextItems);
          } catch (itemError: any) {
            if (isMissingRequisitionWorkflow(itemError)) {
              setWorkflowReady(false);
              setRequisitions([]);
              setItems([]);
              setDataNotice('Apply the requisitions migration before using approvals.');
              return;
            }

            console.error('Failed to load requisition approval items:', itemError);
          } finally {
            setItemsLoading(false);
          }
        })();
      }

      setWorkflowReady(true);
      setRequisitions(nextRequisitions);
      setSelectedId((current) => current || nextRequisitions[0]?.id || null);
    } catch (error: any) {
      console.error('Failed to load requisition approvals:', error);
      setToast({ message: error.message || 'Failed to load requisition approvals.', type: 'error' });
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
    () => requisitions.filter((entry) => statusFilter === 'all' || entry.status === statusFilter),
    [requisitions, statusFilter],
  );
  const pendingCount = useMemo(
    () => requisitions.filter((entry) => entry.status === 'pending_approval').length,
    [requisitions],
  );
  const approvedCount = useMemo(
    () => requisitions.filter((entry) => entry.status === 'approved').length,
    [requisitions],
  );
  const fulfilledCount = useMemo(
    () => requisitions.filter((entry) => entry.status === 'fulfilled').length,
    [requisitions],
  );
  const selectedRequisition = requisitions.find((entry) => entry.id === selectedId) || null;
  const selectedItems = useMemo(
    () => items.filter((entry) => entry.requisition_id === selectedId),
    [items, selectedId],
  );
  const selectedTotal = useMemo(
    () => selectedItems.reduce((sum, item) => sum + Number(item.line_total || 0), 0) + Number(selectedRequisition?.bank_charge_amount || 0),
    [selectedItems, selectedRequisition?.bank_charge_amount],
  );

  const buildRequisitionPrintHtml = (requisition: FinanceRequisition, requisitionItems: FinanceRequisitionItem[]) => {
    const itemsTotal = requisitionItems.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
    const grandTotal = itemsTotal + Number(requisition.bank_charge_amount || 0);
    const approvedBy = requisition.director_approved_by || requisition.accounts_approved_by || 'Pending approval';
    const approvedAt = requisition.director_approved_at || requisition.accounts_approved_at || null;

    return `
      <section style="border:1px solid #e2e8f0;border-radius:24px;padding:20px;background:#fff;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:18px;border-bottom:1px solid #e2e8f0;padding-bottom:16px;margin-bottom:16px;">
          <div>
            <div style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#64748b;font-weight:800;">Finance Requisition</div>
            <h1 style="margin:8px 0 4px;font-size:24px;line-height:1.2;color:#0f172a;">${escapeHtml(requisition.title)}</h1>
            <div style="font-size:12px;color:#475569;">${escapeHtml(requisition.requisition_number)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#64748b;font-weight:800;">Status</div>
            <div style="margin-top:6px;font-size:14px;font-weight:800;color:#0f172a;">${escapeHtml(STATUS_LABELS[requisition.status] || requisition.status)}</div>
            <div style="margin-top:4px;font-size:12px;color:#64748b;">Stage: ${escapeHtml(requisition.approval_stage.replace('_', ' '))}</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
          <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;font-weight:800;">Department</div>
            <div style="margin-top:6px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(requisition.department || '-')}</div>
          </div>
          <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;font-weight:800;">Needed By</div>
            <div style="margin-top:6px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(requisition.needed_by || '-')}</div>
          </div>
          <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;font-weight:800;">Vendor</div>
            <div style="margin-top:6px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(requisition.vendor_preference || '-')}</div>
          </div>
          <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;font-weight:800;">Approved By</div>
            <div style="margin-top:6px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(approvedBy || '-')}</div>
            <div style="margin-top:4px;font-size:12px;color:#64748b;">${approvedAt ? escapeHtml(formatIsoDateTime(approvedAt)) : 'Not approved yet'}</div>
          </div>
        </div>

        <div style="margin-top:18px;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="text-align:left;padding:12px 14px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#64748b;">Item</th>
                <th style="text-align:left;padding:12px 14px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#64748b;">Specification</th>
                <th style="text-align:right;padding:12px 14px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#64748b;">Qty</th>
                <th style="text-align:right;padding:12px 14px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#64748b;">Unit Cost</th>
                <th style="text-align:right;padding:12px 14px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#64748b;">Total</th>
                <th style="text-align:left;padding:12px 14px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#64748b;">Vendor</th>
              </tr>
            </thead>
            <tbody>
              ${requisitionItems.map((item) => `
                <tr>
                  <td style="padding:12px 14px;border-top:1px solid #e2e8f0;color:#0f172a;font-weight:700;">${escapeHtml(item.item_description)}</td>
                  <td style="padding:12px 14px;border-top:1px solid #e2e8f0;color:#334155;">${escapeHtml(item.specification || '-')}</td>
                  <td style="padding:12px 14px;border-top:1px solid #e2e8f0;text-align:right;color:#0f172a;">${Number(item.quantity || 0).toLocaleString()}</td>
                  <td style="padding:12px 14px;border-top:1px solid #e2e8f0;text-align:right;color:#0f172a;">${formatMoney(Number(item.unit_cost || 0))}</td>
                  <td style="padding:12px 14px;border-top:1px solid #e2e8f0;text-align:right;color:#0f172a;font-weight:700;">${formatMoney(Number(item.line_total || 0))}</td>
                  <td style="padding:12px 14px;border-top:1px solid #e2e8f0;color:#334155;">${escapeHtml(item.preferred_vendor || '-')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div style="display:flex;justify-content:flex-end;margin-top:16px;">
          <div style="min-width:280px;border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;">
            <div style="display:flex;justify-content:space-between;gap:12px;"><span style="color:#64748b;">Items Total</span><strong style="color:#0f172a;">${formatMoney(itemsTotal)}</strong></div>
            <div style="display:flex;justify-content:space-between;gap:12px;margin-top:8px;"><span style="color:#64748b;">Bank Charges</span><strong style="color:#0f172a;">${formatMoney(Number(requisition.bank_charge_amount || 0))}</strong></div>
            <div style="display:flex;justify-content:space-between;gap:12px;margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0;"><span style="color:#64748b;font-weight:700;">Grand Total</span><strong style="color:#0f172a;font-size:16px;">${formatMoney(grandTotal)}</strong></div>
          </div>
        </div>

        ${requisition.justification ? `<div style="margin-top:16px;border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;font-weight:800;">Justification</div><div style="margin-top:6px;color:#334155;line-height:1.6;">${escapeHtml(requisition.justification)}</div></div>` : ''}
      </section>
    `;
  };

  const printSelectedRequisition = () => {
    if (!selectedRequisition) return;

    printDocument({
      title: `${selectedRequisition.requisition_number} - Requisition`,
      subtitle: `Printed ${new Date().toLocaleString()}`,
      bodyHtml: buildRequisitionPrintHtml(selectedRequisition, selectedItems),
      footerHtml: `Printed requisition ${escapeHtml(selectedRequisition.requisition_number)}.`,
    });
  };

  const printFilteredRequisitions = () => {
    if (filteredRequisitions.length === 0) {
      setToast({ message: 'There are no requisitions to print with the current filters.', type: 'warning' });
      return;
    }

    const bodyHtml = filteredRequisitions
      .map((requisition, index) => {
        const requisitionItems = items.filter((entry) => entry.requisition_id === requisition.id);
        return `
          <section style="page-break-after:${index === filteredRequisitions.length - 1 ? 'auto' : 'always'};margin-bottom:24px;">
            ${buildRequisitionPrintHtml(requisition, requisitionItems)}
          </section>
        `;
      })
      .join('');

    printDocument({
      title: 'Requisition Approvals',
      subtitle: `${filteredRequisitions.length} requisition(s) in the approval queue`,
      bodyHtml,
    });
  };

  useEffect(() => {
    if (selectedRequisition && inspectorRef.current) {
      inspectorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedRequisition]);

  const updateRequisitionStatus = async (status: RequisitionStatus) => {
    if (!selectedRequisition) return;

    setSaving(true);

    try {
      const payload: Record<string, any> = {
        status,
        updated_by: profile?.id || null,
      };

      // Accounts approval (first stage)
      if (status === 'pending_approval' && selectedRequisition.approval_stage === 'submitted') {
        payload.accounts_approved_by = profile?.id || null;
        payload.accounts_approved_at = new Date().toISOString();
        payload.approval_stage = 'accounts_approved';
      }

      // Director/CEO approval (second stage)
      if (status === 'approved' && selectedRequisition.approval_stage === 'accounts_approved') {
        payload.director_approved_by = profile?.id || null;
        payload.director_approved_at = new Date().toISOString();
        payload.approval_stage = 'director_approved';
      }

      // Rejection at any stage
      if (status === 'rejected') {
        payload.approval_stage = 'rejected';
      }

      const { error } = await supabase
        .from('finance_requisitions')
        .update(payload)
        .eq('id', selectedRequisition.id);

      if (error) throw error;

      await loadData();
      setSelectedId(selectedRequisition.id);
      setToast({ message: `Requisition moved to ${STATUS_LABELS[status]}.`, type: 'success' });
    } catch (error: any) {
      console.error('Failed to update requisition status:', error);
      setToast({ message: error.message || 'Failed to update requisition status.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const deleteRequisition = async (requisitionId: string) => {
    if (!window.confirm('Are you sure you want to delete this requisition? It will be moved to trash.')) return;

    setDeleting(true);

    try {
      const { error } = await supabase
        .from('finance_requisitions')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: profile?.id || null,
        })
        .eq('id', requisitionId);

      if (error) throw error;

      await loadData();
      setToast({ message: 'Requisition moved to trash.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to delete requisition:', error);
      setToast({ message: error.message || 'Failed to delete requisition.', type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <CustomLoader label="Loading requisition approvals..." />;
  }

  return (
    <div className="min-h-screen space-y-6 bg-[#f6f7fb] p-6 dark:bg-[#061723]">
      <div className={`${panelCls} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/app/finance/dashboard')}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
            title="Back to Finance Dashboard"
            aria-label="Back to Finance Dashboard"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Requisition Approvals</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Accounts review comes first. Director or CEO gives the final approval before payment can be posted.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void loadData()} className={subtleButtonCls}>
            <RotateCcw size={16} />
            Refresh
          </button>
          <button type="button" onClick={printFilteredRequisitions} className={subtleButtonCls}>
            <Printer size={16} />
            Print All
          </button>
          <button type="button" onClick={() => navigate('/app/finance/deleted-requisitions')} className={subtleButtonCls}>
            <Trash2 size={16} />
            Deleted
          </button>
          <button type="button" onClick={() => navigate('/app/finance/payments')} className={primaryButtonCls}>
            <CheckCircle2 size={16} />
            Open Payments
          </button>
        </div>
      </div>

      {organizationNotice ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50/90 px-5 py-4 text-sm text-amber-900 shadow-sm dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
          {organizationNotice}
        </div>
      ) : null}

      {dataNotice ? (
        <div className="rounded-[24px] border border-[#ff6a00]/20 bg-[#fff3eb] px-5 py-4 text-sm text-[#9a3f00] shadow-sm dark:border-[#ff6a00]/25 dark:bg-[#ff6a00]/10 dark:text-[#ffd3b5]">
          {dataNotice}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className={panelCls}>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Pending Accounts Review</p>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{pendingCount}</p>
        </div>
        <div className={panelCls}>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Approved</p>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{approvedCount}</p>
        </div>
        <div className={panelCls}>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Fulfilled</p>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{fulfilledCount}</p>
        </div>
      </div>

      {selectedRequisition && (
        <div ref={inspectorRef} className={panelCls}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ff6a00]/10 text-[#ff6a00] dark:bg-[#ff6a00]/12 dark:text-[#ffb37a]">
                <ClipboardList size={20} />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Inspector</p>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Selected Requisition</h2>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white text-slate-700 transition hover:border-red-300 hover:text-red-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-red-400/30 dark:hover:text-red-400"
              title="Close inspector"
              aria-label="Close inspector"
            >
              <XCircle size={18} />
            </button>
          </div>

          <div className="mb-4 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={printSelectedRequisition}
              className={subtleButtonCls}
              disabled={!selectedRequisition}
            >
              <Printer size={16} />
              Print Selected
            </button>
          </div>

          {selectedRequisition ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
                <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedRequisition.title}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{selectedRequisition.requisition_number}</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Department</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{selectedRequisition.department || '-'}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Needed By</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{selectedRequisition.needed_by || '-'}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Vendor</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{selectedRequisition.vendor_preference || '-'}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Bank Charges</p>
                  <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{formatMoney(Number(selectedRequisition.bank_charge_amount || 0))}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Estimated Value</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{formatMoney(selectedTotal)}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Bank Charge Posting</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                    {selectedRequisition.bank_charge_mode === 'additional_expense' ? 'Post as additional expense' : 'Include in main transaction'}
                  </p>
                </div>
                <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Total With Charge</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{formatMoney(selectedTotal)}</p>
                </div>
              </div>

              <div className="rounded-[24px] border border-gray-200 p-4 dark:border-white/10">
                <div className="mb-4 rounded-[20px] border border-dashed border-gray-300 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:text-slate-300">
                  <p className="font-semibold mb-2">Two-Stage Approval Process:</p>
                  <p>1. Accounts team approves the requisition</p>
                  <p>2. Director or CEO approves payment before voucher creation</p>
                </div>

                {/* Approval Stage Indicator */}
                <div className="mb-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${selectedRequisition.approval_stage === 'submitted' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'}`}>
                      1
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Accounts Review</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {selectedRequisition.accounts_approved_at
                          ? `Approved by ${selectedRequisition.accounts_approved_by ? 'Accounts' : 'Unknown'} on ${new Date(selectedRequisition.accounts_approved_at).toLocaleDateString()}`
                          : 'Pending accounts approval'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${selectedRequisition.approval_stage === 'director_approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : selectedRequisition.approval_stage === 'accounts_approved' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-gray-200 text-gray-600 dark:bg-white/10 dark:text-slate-400'}`}>
                      2
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Director/CEO Approval</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {selectedRequisition.director_approved_at
                          ? `Approved on ${new Date(selectedRequisition.director_approved_at).toLocaleDateString()}`
                          : selectedRequisition.approval_stage === 'accounts_approved'
                            ? 'Ready for director approval'
                            : 'Awaiting accounts approval'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  {selectedRequisition.approval_stage === 'submitted' && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Stage 1: Accounts Review</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void updateRequisitionStatus('pending_approval')}
                          disabled={saving || !workflowReady}
                          className={primaryButtonCls}
                        >
                          <CheckCircle2 size={16} />
                          Approve (Accounts)
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateRequisitionStatus('rejected')}
                          disabled={saving || !workflowReady}
                          className={subtleButtonCls}
                        >
                          <XCircle size={16} />
                          Reject
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedRequisition.approval_stage === 'accounts_approved' && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Stage 2: Director/CEO Approval</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void updateRequisitionStatus('approved')}
                          disabled={saving || !workflowReady}
                          className={primaryButtonCls}
                        >
                          <CheckCircle2 size={16} />
                          Approve (Director/CEO)
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateRequisitionStatus('rejected')}
                          disabled={saving || !workflowReady}
                          className={subtleButtonCls}
                        >
                          <XCircle size={16} />
                          Reject
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedRequisition.approval_stage === 'director_approved' && selectedRequisition.status === 'approved' && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-300">✓ Fully Approved - Ready for Payment</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void updateRequisitionStatus('ordered')}
                          disabled={saving || !workflowReady}
                          className={primaryButtonCls}
                        >
                          Mark as Ordered
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateRequisitionStatus('fulfilled')}
                          disabled={saving || !workflowReady}
                          className={primaryButtonCls}
                        >
                          Mark as Fulfilled
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedRequisition.approval_stage === 'rejected' && (
                    <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300">
                      This requisition has been rejected and cannot be approved.
                    </div>
                  )}
                </div>
              </div>

              {selectedRequisition.justification ? (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Justification</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{selectedRequisition.justification}</p>
                </div>
              ) : null}

              <div className="space-y-3">
                {selectedItems.length > 0 ? (
                  selectedItems.map((item) => (
                    <div key={item.id} className="rounded-[24px] border border-gray-200 p-4 dark:border-white/10">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{item.item_description}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            {item.preferred_vendor ? (
                              <span className="rounded-full bg-[#ff6a00]/10 px-3 py-1 font-bold text-[#c95500] dark:bg-[#ff6a00]/15 dark:text-[#ffb37a]">
                                Vendor: {item.preferred_vendor}
                              </span>
                            ) : null}
                            {item.specification ? (
                              <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600 dark:bg-white/5 dark:text-slate-300">
                                {item.specification}
                              </span>
                            ) : null}
                            {!item.specification && !item.preferred_vendor ? (
                              <span className="text-slate-500 dark:text-slate-400">No extra detail provided</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{formatMoney(item.line_total)}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.quantity} x {formatMoney(item.unit_cost)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : itemsLoading ? (
                  <div className="rounded-[24px] border border-dashed border-gray-300 px-4 py-3 text-sm text-slate-500 dark:border-white/10 dark:text-slate-300">
                    Loading requisition line items in the background...
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-dashed border-gray-300 px-4 py-3 text-sm text-slate-500 dark:border-white/10 dark:text-slate-300">
                    No line items found for this requisition.
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between rounded-[24px] border border-dashed border-gray-300 px-4 py-3 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200">
                <span>Requisition total</span>
                <span>{formatMoney(selectedTotal)}</span>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className={panelCls}>
        <div className="mb-6">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Queue</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Approval Inbox</h2>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 dark:border-white/10">
          {(['pending_approval', 'approved', 'ordered', 'fulfilled', 'rejected', 'all'] as const).map((tab) => {
            const tabLabel = tab === 'all' ? 'All Statuses' : STATUS_LABELS[tab as RequisitionStatus] || tab;
            const tabCount = tab === 'all' ? requisitions.length : requisitions.filter((r) => r.status === tab).length;
            const isActive = statusFilter === tab;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab as 'all' | RequisitionStatus)}
                className={`px-4 py-3 text-sm font-semibold transition border-b-2 ${
                  isActive
                    ? 'border-[#ff6a00] text-[#ff6a00] dark:text-[#ffb37a]'
                    : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {tabLabel}
                <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-slate-700 dark:bg-white/10 dark:text-slate-300">
                  {tabCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10">
                <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Requisition #</th>
                <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Title</th>
                <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 hidden md:table-cell">Category</th>
                <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Approval Stage</th>
                <th className="px-5 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 hidden lg:table-cell">Needed By</th>
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
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 capitalize">{requisition.approval_stage.replace('_', ' ')}</span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400 hidden lg:table-cell">{requisition.needed_by || '-'}</td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedId(requisition.id)}
                        className="rounded-lg bg-blue-600 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
                      >
                        View
                      </button>
                      {(requisition.status === 'pending_approval' || requisition.status === 'approved') && (
                        <button
                          type="button"
                          onClick={() => void deleteRequisition(requisition.id)}
                          disabled={deleting}
                          title="Delete requisition"
                          className="rounded-lg bg-red-600 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors inline-flex items-center gap-1"
                        >
                          <Trash2 size={12} />
                          <span className="hidden sm:inline">Delete</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRequisitions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                    No requisitions match this approval filter.
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

export default FinanceRequisitionApprovals;
