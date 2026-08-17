// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Calendar, Clock, FileText, Plus, X } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import CustomLoader from '../../components/CustomLoader';
import Toast from '../../components/Toast';

interface LeaveType {
  id: string;
  name: string;
  description: string;
  max_days_per_year: number;
  requires_approval: boolean;
  is_paid: boolean;
  requires_balance_check: boolean;
  min_notice_days: number;
  allow_negative_balance: boolean;
  document_required: boolean;
  document_after_days: number | null;
  gender_restriction: 'any' | 'male' | 'female';
}

type LeaveUrgency = 'normal' | 'urgent' | 'emergency';

interface LeaveBalance {
  leave_type_id: string;
  leave_type_name: string;
  total_days: number;
  used_days: number;
  remaining_days: number;
}

interface LeaveRequest {
  id: string;
  leave_type_id: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  urgency: LeaveUrgency;
  status: string;
  approver_comment: string | null;
  created_at: string;
}

const MyLeaveRequests: React.FC = () => {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  const [employmentStartDate, setEmploymentStartDate] = useState<string | null>(null);
  const [employeeGender, setEmployeeGender] = useState('');

  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    urgency: 'normal' as LeaveUrgency
  });

  const currentYearStart = `${new Date().getFullYear()}-01-01`;
  const minStartDate = employmentStartDate && employmentStartDate > currentYearStart
    ? employmentStartDate
    : currentYearStart;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('employment_start_date, gender')
        .eq('id', user.id)
        .single();
      setEmploymentStartDate(profile?.employment_start_date || null);
      setEmployeeGender((profile?.gender || '').toLowerCase());

      // Fetch leave types
      const { data: types } = await supabase.from('leave_types').select('*').eq('is_active', true);
      setLeaveTypes(types || []);

      // Fetch balances
      const { data: balData } = await supabase
        .from('leave_balances')
        .select(`
          leave_type_id,
          total_days,
          used_days,
          remaining_days,
          leave_types(name)
        `)
        .eq('employee_id', user.id)
        .eq('year', new Date().getFullYear());

      const formattedBalances = (balData || []).map((b: any) => ({
        leave_type_id: b.leave_type_id,
        leave_type_name: b.leave_types.name,
        total_days: b.total_days,
        used_days: b.used_days,
        remaining_days: b.remaining_days
      }));
      setBalances(formattedBalances);

      // Fetch requests
      const { data: reqData } = await supabase
        .from('leave_requests')
        .select(`
          id,
          leave_type_id,
          start_date,
          end_date,
          total_days,
          reason,
          urgency,
          status,
          approver_comment,
          created_at,
          leave_types(name)
        `)
        .eq('employee_id', user.id)
        .order('created_at', { ascending: false });

      const formattedRequests = (reqData || []).map((r: any) => ({
        ...r,
        leave_type_name: r.leave_types.name
      }));
      setRequests(formattedRequests);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDays = (start: string, end: string): number => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    let days = 0;
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) days++;
    }
    return days;
  };

  const selectedType = leaveTypes.find((type) => type.id === formData.leave_type_id) || null;
  const requestedDays = formData.start_date && formData.end_date ? calculateDays(formData.start_date, formData.end_date) : 0;

  const parseDate = (value: string) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const daysInMonth = (year: number, monthIndex: number) => {
    return new Date(year, monthIndex + 1, 0).getDate();
  };

  const getCadence = (name: string) => {
    const normalized = name.toLowerCase();
    if (normalized.includes('monthly')) return 'monthly' as const;
    if (normalized.includes('quarterly')) return 'quarterly' as const;
    if (normalized.includes('yearly')) return 'yearly' as const;
    return null;
  };

  const isAlignedToEmploymentStart = (leaveStart: Date, employmentStart: Date, cadence: 'monthly' | 'quarterly' | 'yearly') => {
    const targetDay = employmentStart.getDate();
    const maxDayInMonth = daysInMonth(leaveStart.getFullYear(), leaveStart.getMonth());
    const normalizedStartDay = Math.min(targetDay, maxDayInMonth);

    if (leaveStart.getDate() !== normalizedStartDay) return false;

    if (cadence === 'yearly') {
      return leaveStart.getMonth() === employmentStart.getMonth();
    }

    if (cadence === 'quarterly') {
      const monthDiff = (leaveStart.getMonth() - employmentStart.getMonth() + 12) % 12;
      return monthDiff % 3 === 0;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!formData.leave_type_id) throw new Error('Please select a leave type');

      if (!employmentStartDate) {
        throw new Error('Employment start date not found. Please contact HR.');
      }

      const startDate = parseDate(formData.start_date);
      const endDate = parseDate(formData.end_date);
      const employmentDate = parseDate(employmentStartDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysUntilLeave = Math.floor((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      const selectedType = leaveTypes.find(type => type.id === formData.leave_type_id);
      if (!selectedType) throw new Error('Selected leave type was not found');

      if (selectedType.min_notice_days > 0 && daysUntilLeave < selectedType.min_notice_days) {
        throw new Error(`${selectedType.name} must be applied at least ${selectedType.min_notice_days} days in advance`);
      }

      if (startDate < employmentDate || endDate < employmentDate) {
        throw new Error('Leave dates cannot be before your employment start date');
      }

      if (selectedType.gender_restriction !== 'any' && employeeGender && selectedType.gender_restriction !== employeeGender) {
        throw new Error(`${selectedType.name} is only available to ${selectedType.gender_restriction} employees`);
      }

      const cadence = getCadence(selectedType?.name || '');
      if (cadence) {
        const aligned = isAlignedToEmploymentStart(startDate, employmentDate, cadence);
        if (!aligned) {
          throw new Error(`For ${selectedType?.name}, the leave start date must align with your employment start day`);
        }
      }

      const totalDays = calculateDays(formData.start_date, formData.end_date);
      if (selectedType.max_days_per_year > 0 && totalDays > selectedType.max_days_per_year) {
        throw new Error(`${selectedType.name} is limited to ${selectedType.max_days_per_year} day(s).`);
      }

      if (selectedType.requires_balance_check) {
        const balance = balances.find(b => b.leave_type_id === formData.leave_type_id);
        if (!balance) throw new Error(`Leave balance not found for ${selectedType.name}`);

        if (!selectedType.allow_negative_balance && totalDays > balance.remaining_days) {
          throw new Error(`Insufficient leave balance. You have ${balance.remaining_days} days remaining.`);
        }
      }

      const { error } = await supabase.from('leave_requests').insert({
        employee_id: user.id,
        leave_type_id: formData.leave_type_id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        total_days: totalDays,
        reason: formData.reason,
        urgency: formData.urgency,
        status: 'pending'
      });

      if (error) throw error;

      setToast({ message: 'Leave request submitted successfully', type: 'success' });
      setShowModal(false);
      setFormData({ leave_type_id: '', start_date: '', end_date: '', reason: '', urgency: 'normal' });
      fetchData();
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to submit request', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this request?')) return;

    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('status', 'pending');

      if (error) throw error;

      setToast({ message: 'Request cancelled successfully', type: 'success' });
      fetchData();
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to cancel request', type: 'error' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'cancelled': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
    }
  };

  const getUrgencyColor = (urgency: LeaveUrgency) => {
    switch (urgency) {
      case 'emergency':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'urgent':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <CustomLoader size={40} label="Loading leave data..." />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-[#020817] min-h-screen">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Leave Requests</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Manage your leave applications</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Request Leave
        </button>
      </div>

      {/* Leave Balances */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {balances.map((balance) => (
          <div key={balance.leave_type_id} className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#1e293b] rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">{balance.leave_type_name}</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{balance.remaining_days}</span>
              <span className="text-sm text-gray-500">/ {balance.total_days} days</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Used: {balance.used_days} days</p>
          </div>
        ))}
      </div>

      {/* Leave Requests */}
      <div className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#1e293b] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-[#0A1628] border-b border-gray-200 dark:border-[#1e293b]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Leave Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Start Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">End Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Days</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-[#1e293b]">
              {requests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50 dark:hover:bg-[#1e293b]/50">
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{request.leave_type_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{new Date(request.start_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{new Date(request.end_date).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{request.total_days}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${getUrgencyColor(request.urgency)}`}>
                      {request.urgency.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(request.status)}`}>
                      {request.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {request.status === 'pending' && (
                      <button
                        onClick={() => handleCancel(request.id)}
                        title="Cancel Request"
                        aria-label="Cancel"
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {requests.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No leave requests found</p>
          </div>
        )}
      </div>

      {/* Request Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#1e293b] rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Request Leave</h3>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-gray-400 hover:text-gray-600"
                title="Close Modal"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="leave-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Leave Type</label>
                <select
                  id="leave-type"
                  value={formData.leave_type_id}
                  onChange={(e) => setFormData({ ...formData, leave_type_id: e.target.value })}
                  title="Select Leave Type"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg dark:bg-[#0A1628] dark:text-white"
                  required
                >
                  <option value="">Select leave type</option>
                  {leaveTypes.map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
                {selectedType?.requires_balance_check && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Balance checked before submission.
                  </p>
                )}
                {selectedType && !selectedType.requires_balance_check && (
                  <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                    This leave type does not use your normal leave balance.
                  </p>
                )}
                {(() => {
                  const cadence = getCadence(selectedType?.name || '');
                  if (!cadence) return null;
                  return (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      {selectedType?.name} must start on your employment start day.
                    </p>
                  );
                })()}
                {selectedType && (
                  <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-200">
                    <p className="font-semibold">{selectedType.name} policy</p>
                    <p className="mt-1">Minimum notice: {selectedType.min_notice_days} day(s).</p>
                    <p className="mt-1">{selectedType.is_paid ? 'Paid leave.' : 'Unpaid leave.'}</p>
                    <p className="mt-1">
                      {selectedType.requires_balance_check ? 'Balance will be checked before submission.' : 'Balance will not be checked before submission.'}
                    </p>
                    {selectedType.gender_restriction !== 'any' && (
                      <p className="mt-1">Eligibility: {selectedType.gender_restriction} employees only.</p>
                    )}
                    {selectedType.document_required && (
                      <p className="mt-1">
                        Supporting document required
                        {selectedType.document_after_days ? ` after ${selectedType.document_after_days} day(s)` : ''}.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                <input
                  id="start-date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  title="Start Date"
                  min={minStartDate}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg dark:bg-[#0A1628] dark:text-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="end-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                <input
                  id="end-date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  title="End Date"
                  min={formData.start_date || minStartDate}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg dark:bg-[#0A1628] dark:text-white"
                  required
                />
              </div>

              {formData.start_date && formData.end_date && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Total working days: {requestedDays}
                  </p>
                  {selectedType?.requires_balance_check && (() => {
                    const balance = balances.find((entry) => entry.leave_type_id === formData.leave_type_id);
                    if (!balance || requestedDays <= balance.remaining_days) return null;
                    return <p className="mt-1 text-xs text-red-600 dark:text-red-400">Exceeds available balance</p>;
                  })()}
                  {selectedType?.document_required && requestedDays >= (selectedType.document_after_days || 1) && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      Supporting documentation will be required for this request.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="leave-priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Request Priority</label>
                <select
                  id="leave-priority"
                  value={formData.urgency}
                  onChange={(e) => setFormData({ ...formData, urgency: e.target.value as LeaveUrgency })}
                  title="Select Request Priority"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg dark:bg-[#0A1628] dark:text-white"
                >
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  This helps approvers prioritize genuinely time-sensitive leave requests.
                </p>
              </div>

              <div>
                <label htmlFor="leave-reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                <textarea
                  id="leave-reason"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  title="Reason for Leave"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg dark:bg-[#0A1628] dark:text-white"
                  rows={3}
                  required
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  className="px-4 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg hover:bg-gray-50 dark:hover:bg-[#1e293b]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyLeaveRequests;
