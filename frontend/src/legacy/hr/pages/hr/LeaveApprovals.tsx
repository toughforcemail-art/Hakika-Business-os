// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, CheckCircle, Eye, Filter, Search, TimerReset, XCircle } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { fetchRosterShifts, fetchSecurityGuards, getReassignmentCandidates, reassignShift, sendShiftNotification } from '../../services/securityRosterService';
import type { SecurityGuard, SecurityShift } from '../../types/security';

type LeaveUrgency = 'normal' | 'urgent' | 'emergency';

interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_email: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  urgency: LeaveUrgency;
  status: string;
  created_at: string;
}

interface ShiftReassignmentPlan {
  shift: SecurityShift;
  candidates: SecurityGuard[];
  selectedReplacementId: string;
}

const LeaveApprovals: React.FC = () => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewModal, setViewModal] = useState<{ show: boolean; request: LeaveRequest | null }>({ show: false, request: null });
  const [actionModal, setActionModal] = useState<{ show: boolean; request: LeaveRequest | null; action: 'approve' | 'reject' | null }>({ show: false, request: null, action: null });
  const [comment, setComment] = useState('');
  const [processing, setProcessing] = useState(false);
  const [loadingReplacementPlan, setLoadingReplacementPlan] = useState(false);
  const [replacementPlan, setReplacementPlan] = useState<ShiftReassignmentPlan[]>([]);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data } = await supabase
        .from('leave_requests')
        .select(`
          id,
          employee_id,
          leave_type_id,
          start_date,
          end_date,
          total_days,
          reason,
          urgency,
          status,
          created_at,
          profiles!leave_requests_employee_id_fkey(full_name, email),
          leave_types(name)
        `)
        .order('created_at', { ascending: false });

      const formatted = (data || []).map((request: any) => ({
        id: request.id,
        employee_id: request.employee_id,
        employee_name: request.profiles?.full_name || 'Unknown',
        employee_email: request.profiles?.email || '',
        leave_type_name: request.leave_types?.name || 'Unknown',
        start_date: request.start_date,
        end_date: request.end_date,
        total_days: request.total_days,
        reason: request.reason,
        urgency: request.urgency || 'normal',
        status: request.status,
        created_at: request.created_at,
      }));

      setRequests(formatted);
    } catch (error) {
      console.error('Error fetching requests:', error);
      setToast({ message: 'Unable to load leave approvals right now.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadReplacementPlan = async (request: LeaveRequest) => {
    setLoadingReplacementPlan(true);
    try {
      const [guards, shifts] = await Promise.all([fetchSecurityGuards(), fetchRosterShifts()]);
      const start = new Date(request.start_date);
      start.setHours(0, 0, 0, 0);
      const endExclusive = new Date(request.end_date);
      endExclusive.setHours(0, 0, 0, 0);
      endExclusive.setDate(endExclusive.getDate() + 1);

      const overlappingShifts = shifts.filter((shift) => {
        const shiftStart = new Date(shift.start_time);
        const shiftEnd = new Date(shift.end_time);
        return (
          shift.employee_id === request.employee_id &&
          shiftStart < endExclusive &&
          shiftEnd > start &&
          shift.status !== 'cancelled'
        );
      });

      const plan = overlappingShifts.map((shift) => {
        const candidates = getReassignmentCandidates(shift, guards, shifts).slice(0, 6);
        return {
          shift,
          candidates,
          selectedReplacementId: candidates[0]?.id || '',
        };
      });

      setReplacementPlan(plan);
    } catch (error) {
      console.error('Error loading replacement plan:', error);
      setToast({ message: 'Unable to load shift replacements for this leave request.', type: 'error' });
      setReplacementPlan([]);
    } finally {
      setLoadingReplacementPlan(false);
    }
  };

  useEffect(() => {
    if (actionModal.show && actionModal.action === 'approve' && actionModal.request) {
      void loadReplacementPlan(actionModal.request);
    } else {
      setReplacementPlan([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionModal.show, actionModal.action, actionModal.request?.id]);

  const getDaysUntilStart = (startDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    return Math.round((start.getTime() - today.getTime()) / 86400000);
  };

  const getQueueUrgency = (request: LeaveRequest) => {
    if (request.status !== 'pending') {
      return 'settled';
    }

    const hoursWaiting = (Date.now() - new Date(request.created_at).getTime()) / 3600000;
    const daysUntilStart = getDaysUntilStart(request.start_date);

    if (request.urgency === 'emergency') {
      return 'critical';
    }

    if (request.urgency === 'urgent' && (daysUntilStart <= 5 || hoursWaiting >= 24)) {
      return 'critical';
    }

    if (daysUntilStart <= 1 || hoursWaiting >= 72) {
      return 'critical';
    }

    if (request.urgency === 'urgent' || daysUntilStart <= 5 || hoursWaiting >= 24) {
      return 'attention';
    }

    return 'planned';
  };

  const getQueueUrgencyClasses = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300';
      case 'attention':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
      case 'planned':
        return 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300';
      default:
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
    }
  };

  const getQueueUrgencyLabel = (request: LeaveRequest) => {
    const urgency = getQueueUrgency(request);
    if (urgency === 'critical') return 'Needs Action';
    if (urgency === 'attention') return 'Review Soon';
    if (urgency === 'planned') return 'Upcoming';
    return 'Settled';
  };

  const getRequestUrgencyClasses = (urgency: LeaveUrgency) => {
    switch (urgency) {
      case 'emergency':
        return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300';
      case 'urgent':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
      default:
        return 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300';
    }
  };

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return requests
      .filter((request) => (statusFilter === 'all' ? true : request.status === statusFilter))
      .filter((request) => {
        if (!normalizedSearch) {
          return true;
        }

        return [
          request.employee_name,
          request.employee_email,
          request.leave_type_name,
          request.reason,
        ].some((value) => value?.toLowerCase().includes(normalizedSearch));
      })
      .sort((left, right) => {
        const urgencyOrder = { critical: 0, attention: 1, planned: 2, settled: 3 } as const;
        const urgencyDiff = urgencyOrder[getQueueUrgency(left) as keyof typeof urgencyOrder] - urgencyOrder[getQueueUrgency(right) as keyof typeof urgencyOrder];
        if (urgencyDiff !== 0) {
          return urgencyDiff;
        }

        return new Date(left.start_date).getTime() - new Date(right.start_date).getTime();
      });
  }, [requests, searchTerm, statusFilter]);

  const queueSummary = useMemo(() => {
    const pending = requests.filter((request) => request.status === 'pending');
    const needsAttention = pending.filter((request) => getQueueUrgency(request) === 'critical').length;
    const startingThisWeek = pending.filter((request) => {
      const daysUntilStart = getDaysUntilStart(request.start_date);
      return daysUntilStart >= 0 && daysUntilStart <= 7;
    }).length;
    const approvedThisCycle = requests.filter((request) => request.status === 'approved').length;

    return {
      totalPending: pending.length,
      needsAttention,
      startingThisWeek,
      approvedThisCycle,
      watchlist: pending.slice().sort((left, right) => new Date(left.start_date).getTime() - new Date(right.start_date).getTime()).slice(0, 3),
    };
  }, [requests]);

  const handleAction = async () => {
    if (!actionModal.request || !actionModal.action) return;

    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const newStatus = actionModal.action === 'approve' ? 'approved' : 'rejected';

      if (actionModal.action === 'approve' && replacementPlan.length > 0) {
        for (const item of replacementPlan) {
          if (item.selectedReplacementId) {
            const reassignedShift = await reassignShift(item.shift, item.selectedReplacementId);
            await sendShiftNotification(reassignedShift);
          }
        }
      }

      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: newStatus,
          approver_id: user.id,
          approver_comment: comment || null,
          approved_at: new Date().toISOString(),
        })
        .eq('id', actionModal.request.id);

      if (error) throw error;

      setToast({
        message: `Leave request ${newStatus} successfully`,
        type: 'success',
      });

      setActionModal({ show: false, request: null, action: null });
      setComment('');
      setReplacementPlan([]);
      fetchRequests();
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to process request', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-dark-bg">
        <CustomLoader size={40} label="Loading requests..." />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-8 dark:bg-dark-bg">
      <div className="mx-auto max-w-7xl space-y-8">
        {toast && <CustomToast isVisible={!!toast} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900 dark:text-white">
              <Calendar className="text-brand-purple" size={32} /> Leave Approvals
            </h1>
            <p className="mt-1 text-gray-500 dark:text-gray-400">
              {queueSummary.totalPending} pending requests, {queueSummary.needsAttention} needing immediate action.
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
            Approval SLA is healthiest when urgent requests are cleared before the employee&apos;s leave start date.
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            { label: 'Pending Queue', value: queueSummary.totalPending, tone: 'text-brand-purple bg-brand-purple/10' },
            { label: 'Needs Action', value: queueSummary.needsAttention, tone: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10' },
            { label: 'Starting This Week', value: queueSummary.startingThisWeek, tone: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10' },
            { label: 'Approved This Cycle', value: queueSummary.approvedThisCycle, tone: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-dark-surface">
              <div className={`mb-3 inline-flex rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.18em] ${card.tone}`}>
                {card.label}
              </div>
              <p className="text-3xl font-black text-gray-900 dark:text-white">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-dark-surface">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <Filter className="h-5 w-5 text-gray-400" />
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    aria-label="Filter requests by status"
                    title="Filter requests by status"
                    className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-brand-purple dark:border-white/10 dark:bg-black/20 dark:text-white"
                  >
                    <option value="all">All Requests</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="relative w-full lg:w-80">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search employee, leave type, or reason"
                    title="Search leave requests"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-brand-purple dark:border-white/10 dark:bg-black/20 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-dark-surface">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-300">Employee</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-300">Leave Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-300">Dates</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-300">Priority</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-300">Queue</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-300">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500 dark:text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-[#1e293b]">
                    {filteredRequests.map((request) => (
                      <tr key={request.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{request.employee_name}</p>
                            <p className="text-xs text-gray-500">{request.employee_email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{request.leave_type_name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                          <p>{new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}</p>
                          <p className="mt-1 text-xs text-gray-400">{request.total_days} day(s) requested</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${getRequestUrgencyClasses(request.urgency)}`}>
                            {request.urgency}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.16em] ${getQueueUrgencyClasses(getQueueUrgency(request))}`}>
                            {getQueueUrgencyLabel(request)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full px-2 py-1 text-xs ${getStatusColor(request.status)}`}>
                            {request.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setViewModal({ show: true, request })}
                              className="rounded p-1 transition-colors hover:bg-gray-100 dark:hover:bg-white/10"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                            </button>
                            {request.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => setActionModal({ show: true, request, action: 'approve' })}
                                  className="rounded p-1 transition-colors hover:bg-gray-100 dark:hover:bg-white/10"
                                  title="Approve"
                                >
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                </button>
                                <button
                                  onClick={() => setActionModal({ show: true, request, action: 'reject' })}
                                  className="rounded p-1 transition-colors hover:bg-gray-100 dark:hover:bg-white/10"
                                  title="Reject"
                                >
                                  <XCircle className="h-4 w-4 text-red-600" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredRequests.length === 0 && (
                <div className="py-10 text-center">
                  <p className="text-gray-400">No requests match the current filters.</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-dark-surface">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-2xl bg-brand-purple/10 p-3 text-brand-purple">
                  <TimerReset size={20} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Approval Watchlist</p>
                  <h2 className="text-lg font-black text-gray-900 dark:text-white">Who needs a decision</h2>
                </div>
              </div>
              <div className="space-y-3">
                {queueSummary.watchlist.map((request) => (
                  <div key={request.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{request.employee_name}</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{request.leave_type_name} starting {new Date(request.start_date).toLocaleDateString()}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${getRequestUrgencyClasses(request.urgency)}`}>
                          {request.urgency}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${getQueueUrgencyClasses(getQueueUrgency(request))}`}>
                          {getQueueUrgencyLabel(request)}
                        </span>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{request.reason}</p>
                  </div>
                ))}
                {queueSummary.watchlist.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
                    Nothing is waiting in the urgent queue right now.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm dark:border-rose-400/20 dark:bg-rose-500/10">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 text-rose-500" size={18} />
                <div>
                  <h3 className="text-sm font-black text-rose-700 dark:text-rose-200">Coverage Risk Reminder</h3>
                  <p className="mt-2 text-sm text-rose-700/80 dark:text-rose-100/80">
                    Requests starting in the next 48 hours should be approved or escalated quickly so teams can rebalance staffing before the absence begins.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {viewModal.show && viewModal.request && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-dark-surface">
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Leave Request Details</h3>
              <div className="space-y-3">
                <div><span className="font-medium">Employee:</span> {viewModal.request.employee_name}</div>
                <div><span className="font-medium">Leave Type:</span> {viewModal.request.leave_type_name}</div>
                <div><span className="font-medium">Duration:</span> {new Date(viewModal.request.start_date).toLocaleDateString()} - {new Date(viewModal.request.end_date).toLocaleDateString()}</div>
                <div><span className="font-medium">Total Days:</span> {viewModal.request.total_days}</div>
                <div>
                  <span className="font-medium">Priority:</span>{' '}
                  <span className={`ml-2 rounded-full px-2 py-1 text-xs ${getRequestUrgencyClasses(viewModal.request.urgency)}`}>
                    {viewModal.request.urgency}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Queue Status:</span>{' '}
                  <span className={`ml-2 rounded-full px-2 py-1 text-xs ${getQueueUrgencyClasses(getQueueUrgency(viewModal.request))}`}>
                    {getQueueUrgencyLabel(viewModal.request)}
                  </span>
                </div>
                <div><span className="font-medium">Reason:</span> <p className="mt-1 text-gray-600 dark:text-gray-300">{viewModal.request.reason}</p></div>
                <div>
                  <span className="font-medium">Status:</span>{' '}
                  <span className={`ml-2 rounded-full px-2 py-1 text-xs ${getStatusColor(viewModal.request.status)}`}>
                    {viewModal.request.status.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setViewModal({ show: false, request: null })}
                  className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-pink"
                  title="Close details view"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {actionModal.show && actionModal.request && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-dark-surface">
              <h3 className={`mb-4 text-lg font-semibold ${actionModal.action === 'approve' ? 'text-green-600' : 'text-red-600'}`}>
                {actionModal.action === 'approve' ? 'Approve' : 'Reject'} Leave Request
              </h3>
              <p className="mb-4 text-gray-600 dark:text-gray-300">
                {actionModal.action === 'approve' ? 'Approve' : 'Reject'} leave request for <strong>{actionModal.request.employee_name}</strong>?
              </p>

              {actionModal.action === 'approve' && (
                <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-gray-400">Shift coverage reassignment</p>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                        Reassign shifts that overlap the leave window
                      </h4>
                    </div>
                    {loadingReplacementPlan && <span className="text-xs text-gray-500">Loading replacements...</span>}
                  </div>

                  {replacementPlan.length === 0 && !loadingReplacementPlan ? (
                    <p className="text-sm text-gray-500">
                      No scheduled shifts overlap this leave request. Approval can proceed without reassigning coverage.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {replacementPlan.map((item, index) => (
                        <div key={item.shift.id} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-dark-surface">
                          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {item.shift.security_sites?.name || 'Site'} - {item.shift.security_posts?.name || 'Post'}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(item.shift.start_time).toLocaleString()} to {new Date(item.shift.end_time).toLocaleString()}
                              </p>
                            </div>
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                              Shift {index + 1}
                            </span>
                          </div>

                          <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-400">
                            Off Duty Releaver
                          </label>
                          <select
                            value={item.selectedReplacementId}
                            onChange={(event) => {
                              const value = event.target.value;
                              setReplacementPlan((current) =>
                                current.map((entry) =>
                                  entry.shift.id === item.shift.id
                                    ? { ...entry, selectedReplacementId: value }
                                    : entry
                                )
                              );
                            }}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-purple dark:border-white/10 dark:bg-black/20 dark:text-white"
                          >
                            <option value="">No releaver selected</option>
                            {item.candidates.map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.full_name || 'Unknown Guard'}
                              </option>
                            ))}
                          </select>
                          {item.candidates.length === 0 && (
                            <p className="mt-2 text-xs text-rose-500">
                              No conflict-free releaver candidates are available for this shift, so approval can continue without one.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Comment (Optional)</label>
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-brand-purple dark:border-white/10 dark:bg-black/20 dark:text-white"
                  rows={3}
                  placeholder="Add a comment..."
                  title="Optional approver comment"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setActionModal({ show: false, request: null, action: null });
                    setComment('');
                    setReplacementPlan([]);
                  }}
                  disabled={processing}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10"
                  title="Cancel and close"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAction}
                  disabled={processing || (actionModal.action === 'approve' && loadingReplacementPlan)}
                  className={`rounded-lg px-4 py-2 text-white disabled:opacity-50 ${actionModal.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                          title={actionModal.action === 'approve' ? 'Approve the leave request and reassign any affected shifts if needed' : 'Reject the leave request'}
                >
                  {processing ? 'Processing...' : actionModal.action === 'approve' ? 'Approve & Reassign' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaveApprovals;
