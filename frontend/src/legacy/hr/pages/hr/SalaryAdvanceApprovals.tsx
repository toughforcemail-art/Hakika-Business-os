// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Edit3, Link2, Loader2, RefreshCcw, Search, Trash2, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { useAccess } from '../../hooks/useAccess';
import { resolveOrganizationScope } from '../../utils/organizationScope';
import { supabase } from '../../utils/supabase';

type SalaryAdvanceStatus = 'pending' | 'approved' | 'declined';
type PayrollPeriodStatus = 'draft' | 'processing' | 'approved' | 'paid';

interface SalaryAdvanceRecord {
  id: string;
  organization_id: string | null;
  employee_id: string;
  amount: number;
  request_date: string;
  approved_date: string | null;
  approved_by: string | null;
  status: SalaryAdvanceStatus | string;
  deduction_payroll_id: string | null;
  deduction_amount: number | null;
  remaining_balance: number | null;
  reason: string | null;
  decision_reason: string | null;
  requisition_id: string | null;
  created_at: string;
}

interface EmployeeOption {
  id: string;
  employee_no?: string | null;
  full_name: string | null;
  company_code: string | null;
  module: string | null;
  role: string | null;
  salary: number | null;
}

interface PayrollPeriodOption {
  id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  status: PayrollPeriodStatus | string;
}

interface RequisitionOption {
  id: string;
  requisition_number: string;
  title: string;
}

const panelCls = 'min-w-0 rounded-[28px] border border-gray-200 bg-white/95 p-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur-sm dark:border-white/10 dark:bg-dark-surface/90';
const inputCls = 'w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#ff6a00]/40 focus:bg-white focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-[#082131] dark:text-white dark:placeholder:text-slate-400 dark:focus:border-[#ff6a00]/40 dark:focus:bg-[#0b2a3c]';
const labelCls = 'mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300';
const subtleButtonCls = 'inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:border-[#ff6a00]/40 dark:hover:bg-white/[0.06]';
const primaryButtonCls = 'inline-flex items-center justify-center gap-2 rounded-2xl bg-[#ff6a00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e85f00] disabled:cursor-not-allowed disabled:opacity-60';

const formatMoney = (value: number) => `KES ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const isOpenPayrollPeriod = (status: string) => ['draft', 'processing'].includes(status);

const SalaryAdvanceApprovals: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAccess();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationNotice, setOrganizationNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [advances, setAdvances] = useState<SalaryAdvanceRecord[]>([]);
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriodOption[]>([]);
  const [requisitions, setRequisitions] = useState<RequisitionOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | SalaryAdvanceStatus>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decisionForm, setDecisionForm] = useState({
    payrollPeriodId: '',
    decisionReason: '',
  });

  const payrollPeriodMap = useMemo(() => new Map(payrollPeriods.map((period) => [period.id, period])), [payrollPeriods]);
  const requisitionMap = useMemo(() => new Map(requisitions.map((requisition) => [requisition.id, requisition])), [requisitions]);
  const employeeMap = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);

  const loadData = async () => {
    setLoading(true);
    try {
      const scope = await resolveOrganizationScope(profile);
      setOrganizationId(scope.organizationId);
      setOrganizationNotice(scope.notice);

      if (!scope.organizationId) {
        setEmployees([]);
        setAdvances([]);
        setPayrollPeriods([]);
        setRequisitions([]);
        setOrganizationNotice('Your profile is not linked to an organization yet, so salary advances cannot be loaded.');
        return;
      }

      const [employeeRes, advancesRes, periodsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, employee_no, company_code, module, role, salary')
          .eq('organization_id', scope.organizationId)
          .order('full_name', { ascending: true }),
        supabase
          .from('salary_advances')
          .select('id, organization_id, employee_id, amount, request_date, approved_date, approved_by, status, deduction_payroll_id, deduction_amount, remaining_balance, reason, decision_reason, requisition_id, created_at')
          .eq('organization_id', scope.organizationId)
          .order('created_at', { ascending: false }),
        supabase
          .from('payroll_periods')
          .select('id, period_name, start_date, end_date, status')
          .eq('organization_id', scope.organizationId)
          .order('created_at', { ascending: false }),
      ]);

      if (employeeRes.error) throw employeeRes.error;
      if (advancesRes.error) throw advancesRes.error;
      if (periodsRes.error) throw periodsRes.error;

      const nextEmployees = (employeeRes.data || []) as EmployeeOption[];
      const nextAdvances = (advancesRes.data || []) as SalaryAdvanceRecord[];
      const nextPeriods = (periodsRes.data || []) as PayrollPeriodOption[];
      const requisitionIds = nextAdvances.map((advance) => advance.requisition_id).filter(Boolean) as string[];

      let nextRequisitions: RequisitionOption[] = [];
      if (requisitionIds.length > 0) {
        const { data: requisitionData, error: requisitionError } = await supabase
          .from('finance_requisitions')
          .select('id, requisition_number, title')
          .in('id', requisitionIds);
        if (requisitionError) throw requisitionError;
        nextRequisitions = (requisitionData || []) as RequisitionOption[];
      }

      setEmployees(nextEmployees);
      setAdvances(nextAdvances);
      setPayrollPeriods(nextPeriods);
      setRequisitions(nextRequisitions);

      setSelectedId((current) => current || nextAdvances.find((advance) => advance.status === 'pending')?.id || nextAdvances[0]?.id || null);
      const defaultPayrollPeriod = nextPeriods.find((period) => isOpenPayrollPeriod(period.status)) || nextPeriods[0] || null;
      setDecisionForm((current) => ({
        ...current,
        payrollPeriodId:
          defaultPayrollPeriod?.id ||
          (current.payrollPeriodId && nextPeriods.some((period) => period.id === current.payrollPeriodId) ? current.payrollPeriodId : '') ||
          '',
      }));
    } catch (error: any) {
      console.error('Failed to load salary advances:', error);
      setToast({ message: error.message || 'Failed to load salary advances.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      void loadData();
    }
  }, [profile]);

  const filteredAdvances = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return advances.filter((advance) => {
      if (statusFilter !== 'all' && advance.status !== statusFilter) return false;
      if (!query) return true;
      const employee = employeeMap.get(advance.employee_id);
      const haystack = [
        advance.reason,
        advance.decision_reason,
        advance.request_date,
        advance.amount,
        employee?.employee_no,
        employee?.full_name,
        employee?.company_code,
        employee?.module,
        employee?.role,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [advances, employeeMap, searchTerm, statusFilter]);

  const totals = useMemo(
    () => ({
      pending: advances.filter((advance) => advance.status === 'pending').length,
      approved: advances.filter((advance) => advance.status === 'approved').length,
      declined: advances.filter((advance) => advance.status === 'declined').length,
      totalValue: advances.reduce((sum, advance) => sum + Number(advance.amount || 0), 0),
    }),
    [advances]
  );

  const selectedAdvance = advances.find((advance) => advance.id === selectedId) || null;
  const selectedEmployee = selectedAdvance ? employeeMap.get(selectedAdvance.employee_id) || null : null;
  const selectedRequisition = selectedAdvance?.requisition_id ? requisitionMap.get(selectedAdvance.requisition_id) || null : null;
  const selectedPayrollPeriod = selectedAdvance?.deduction_payroll_id ? payrollPeriodMap.get(selectedAdvance.deduction_payroll_id) || null : null;

  const processAdvance = async (advance: SalaryAdvanceRecord, status: 'approved' | 'declined') => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        p_salary_advance_id: advance.id,
        p_status: status,
        p_actor_id: profile?.id || advance.employee_id,
        p_decision_reason: decisionForm.decisionReason.trim() || null,
        p_deduction_payroll_id: status === 'approved' ? decisionForm.payrollPeriodId || advance.deduction_payroll_id || null : null,
        p_create_requisition: status === 'approved',
      };

      const { data, error } = await supabase.rpc('process_salary_advance_request', payload as any);
      if (error) throw error;

      if (status === 'approved' && data?.requisition_id) {
        setToast({ message: 'Salary advance approved and linked to a payment requisition.', type: 'success' });
      } else if (status === 'approved') {
        setToast({ message: 'Salary advance approved.', type: 'success' });
      } else {
        setToast({ message: 'Salary advance declined.', type: 'success' });
      }

      await loadData();
      setSelectedId(advance.id);
    } catch (error: any) {
      console.error('Failed to process salary advance:', error);
      setToast({ message: error.message || 'Failed to update salary advance.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const deleteAdvance = async (advance: SalaryAdvanceRecord) => {
    if (!window.confirm('Delete this salary advance? This will be recorded in the delete audit log.')) return;
    try {
      const { error } = await supabase.from('salary_advances').delete().eq('id', advance.id);
      if (error) throw error;
      setToast({ message: 'Salary advance deleted and audited.', type: 'success' });
      await loadData();
    } catch (error: any) {
      console.error('Failed to delete salary advance:', error);
      setToast({ message: error.message || 'Failed to delete salary advance.', type: 'error' });
    }
  };

  if (loading) {
    return <CustomLoader label="Loading salary advance approvals..." />;
  }

  const table = (
    <div className={`${panelCls} space-y-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Advance Requests</p>
          <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">Request table</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search employee or reason"
              className={`${inputCls} pl-10`}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | SalaryAdvanceStatus)}
            className={inputCls}
          >
            <option value="pending">Pending</option>
            <option value="all">All statuses</option>
            <option value="approved">Approved</option>
            <option value="declined">Declined</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-gray-200 dark:border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-white/10">
            <thead className="bg-slate-50 dark:bg-white/5">
              <tr className="text-left text-[10px] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">
                <th className="px-4 py-3">Emp No</th>
                <th className="px-4 py-3">Employee Name</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Advance Req</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">App</th>
                <th className="px-4 py-3">Declined</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-white/10 dark:bg-transparent">
              {filteredAdvances.map((advance) => {
                const employee = employeeMap.get(advance.employee_id);
                const requisition = advance.requisition_id ? requisitionMap.get(advance.requisition_id) : null;
                return (
                  <tr
                    key={advance.id}
                    onClick={() => setSelectedId(advance.id)}
                    className={`cursor-pointer text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5 ${selectedId === advance.id ? 'bg-slate-50 dark:bg-white/5' : ''}`}
                  >
                    <td className="px-4 py-4 font-semibold">{employee?.employee_no || 'N/A'}</td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{employee?.full_name || 'Unknown employee'}</div>
                      <div className="text-[11px] text-slate-400">{[employee?.module, employee?.company_code, employee?.role].filter(Boolean).join(' • ')}</div>
                    </td>
                    <td className="px-4 py-4">{advance.request_date}</td>
                    <td className="px-4 py-4 font-semibold">{formatMoney(Number(advance.amount || 0))}</td>
                    <td className="px-4 py-4">
                      <div className="max-w-[260px] truncate" title={advance.reason || ''}>
                        {advance.reason || 'No reason provided'}
                      </div>
                      {requisition && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate('/app/finance/expenses');
                          }}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[#ff6a00] hover:underline"
                        >
                          <Link2 size={12} />
                          {requisition.requisition_number}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${advance.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : advance.status === 'declined' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'}`}>
                        {advance.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {advance.status === 'declined' ? (
                        <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-300">
                          {advance.decision_reason || 'Declined'}
                        </span>
                      ) : advance.status === 'approved' ? (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-300">
                          {advance.deduction_payroll_id
                            ? payrollPeriodMap.get(advance.deduction_payroll_id)?.period_name || advance.deduction_payroll_id
                            : 'Approved'}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Pending review</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate('/app/hr/payroll/loans-advances');
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-bold text-sky-700 transition hover:bg-sky-100 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200"
                        >
                          <Edit3 size={12} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void deleteAdvance(advance);
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredAdvances.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400" colSpan={8}>
                    No salary advance requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const actionPanel = (
    <div className={`${panelCls} space-y-4`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Action panel</p>
          <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-white">Approve or decline</h3>
        </div>
        <button
          type="button"
          onClick={() => selectedAdvance && processAdvance(selectedAdvance, 'approved')}
          disabled={!selectedAdvance || selectedAdvance.status !== 'pending' || saving}
          className={primaryButtonCls}
        >
          <CheckCircle2 size={16} />
          Approve
        </button>
      </div>

      <div>
        <label className={labelCls}>Payroll period for deduction</label>
        <p className="mb-2 text-[11px] text-slate-500 dark:text-slate-400">
          {payrollPeriods.length > 0
            ? 'Choose the payroll period that should carry the deduction.'
            : 'No payroll periods are available yet. Open Payroll to create one first.'}
        </p>
        <select
          value={decisionForm.payrollPeriodId}
          onChange={(e) => setDecisionForm((current) => ({ ...current, payrollPeriodId: e.target.value }))}
          className={inputCls}
          disabled={payrollPeriods.length === 0}
        >
          <option value="">{payrollPeriods.length === 0 ? 'No payroll periods available' : 'Use selected payroll period'}</option>
          {payrollPeriods.map((period) => (
            <option key={period.id} value={period.id}>
              {period.period_name} ({period.status})
            </option>
          ))}
        </select>
        {payrollPeriods.length === 0 ? (
          <button
            type="button"
            onClick={() => navigate('/app/hr/payroll/process')}
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-2xl border border-[#ff6a00]/20 bg-[#ff6a00]/5 px-4 py-2 text-sm font-semibold text-[#ff6a00] transition hover:border-[#ff6a00]/30 hover:bg-[#ff6a00]/10"
          >
            <CheckCircle2 size={16} />
            Open Payroll
          </button>
        ) : null}
      </div>

      <div>
        <label className={labelCls}>Decision note</label>
        <textarea
          value={decisionForm.decisionReason}
          onChange={(e) => setDecisionForm((current) => ({ ...current, decisionReason: e.target.value }))}
          rows={4}
          className={inputCls}
          placeholder="Optional note for approval or decline"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => selectedAdvance && processAdvance(selectedAdvance, 'declined')}
          disabled={!selectedAdvance || selectedAdvance.status !== 'pending' || saving}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
        >
          <XCircle size={16} />
          Decline selected
        </button>
        <button
          type="button"
          onClick={() => selectedAdvance && setSelectedId(selectedAdvance.id)}
          className={subtleButtonCls}
        >
          Select current row
        </button>
      </div>

      {selectedAdvance ? (
        <div className="rounded-[24px] border border-gray-200 bg-slate-50 p-4 text-sm dark:border-white/10 dark:bg-white/5">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Selected advance</p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Employee</span>
              <span className="font-semibold text-slate-900 dark:text-white">{selectedEmployee?.full_name || 'Unknown'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Amount</span>
              <span className="font-semibold text-slate-900 dark:text-white">{formatMoney(Number(selectedAdvance.amount || 0))}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Status</span>
              <span className="font-semibold text-slate-900 dark:text-white">{selectedAdvance.status}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Payroll link</span>
              <span className="font-semibold text-slate-900 dark:text-white">{selectedPayrollPeriod?.period_name || 'Not linked'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Requisition</span>
              <span className="font-semibold text-slate-900 dark:text-white">{selectedRequisition?.requisition_number || 'Not created yet'}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="min-h-screen space-y-6 bg-[#f6f7fb] p-6 dark:bg-[#061723]">
      <CustomToast isVisible={!!toast} message={toast?.message || ''} type={toast?.type || 'info'} onClose={() => setToast(null)} />

      <div className={`${panelCls} flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between`}>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/app/hr/payroll/loans-advances')}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
            title="Back to Salary Advances"
            aria-label="Back to Salary Advances"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Salary Advance Approvals</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Review pending advances, assign the payroll deduction period, and approve or decline requests.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void loadData()} className={subtleButtonCls}>
            <RefreshCcw size={16} />
            Refresh
          </button>
          <button type="button" onClick={() => navigate('/app/hr/payroll/loans-advances')} className={primaryButtonCls}>
            <CheckCircle2 size={16} />
            New advance requests
          </button>
        </div>
      </div>

      {organizationNotice ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50/90 px-5 py-4 text-sm text-amber-900 shadow-sm dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
          {organizationNotice}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          { label: 'Pending', value: totals.pending, tone: 'text-amber-600' },
          { label: 'Approved', value: totals.approved, tone: 'text-emerald-600' },
          { label: 'Declined', value: totals.declined, tone: 'text-rose-600' },
          { label: 'Total Requested', value: formatMoney(totals.totalValue), tone: 'text-slate-800 dark:text-slate-100' },
        ].map((card) => (
          <div key={card.label} className={`${panelCls} p-4`}>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{card.label}</p>
            <p className={`mt-2 text-2xl font-black ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {actionPanel}
        {table}
      </div>
    </div>
  );
};

export default SalaryAdvanceApprovals;
