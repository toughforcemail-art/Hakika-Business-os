// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import {
  LogOut,
  Search,
  Calendar,
  User,
  Briefcase,
  Plus,
  X,
  Save,
  FileCheck,
  Archive,
  Trash2,
  ChevronDown,
  RotateCcw
} from 'lucide-react';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { getEmployeeNoDateStr, normalizeEmployeeNo, extractSequenceFromEmployeeNo } from '../../utils/employeeNo';
import { extractEdgeFunctionErrorMessage } from '../../utils/edgeFunctionError';
import { invokeEdgeFunction } from '../../utils/edgeFunctions';

interface EmpExitRecord {
  id: string;
  original_id: string;
  full_name: string;
  email: string;
  employee_no: string;
  role: string;
  department: string;
  designation: string | null;
  exit_reason: 'resigned' | 'deserted' | 'dismissed' | 'convicted' | null;
  exit_summary: string | null;
  certificate_issued: boolean;
  certificate_date: string | null;
  archive_status: 'archived' | 'marked_for_deletion';
  archived_at: string;
  deleted_by_name: string;
}

const EXIT_REASON_LABELS: Record<string, { label: string; color: string }> = {
  resigned:  { label: 'Resigned',   color: 'bg-blue-100 text-blue-700 border-blue-200' },
  deserted:  { label: 'Deserted',   color: 'bg-orange-100 text-orange-700 border-orange-200' },
  dismissed: { label: 'Dismissed',  color: 'bg-red-100 text-red-700 border-red-200' },
  convicted: { label: 'Convicted',  color: 'bg-rose-950/10 text-rose-900 border-rose-300' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  archived:            { label: 'Archived',            color: 'bg-gray-100 text-gray-600 border-gray-200' },
  marked_for_deletion: { label: 'Marked for Deletion', color: 'bg-red-50 text-red-600 border-red-200' },
};

const EMPTY_FORM = {
  full_name: '',
  employee_no: '',
  role: '',
  department: '',
  designation: '',
  exit_reason: '' as '' | 'resigned' | 'deserted' | 'dismissed' | 'convicted',
  exit_summary: '',
  certificate_issued: false,
  certificate_date: '',
  archive_status: 'archived' as 'archived' | 'marked_for_deletion',
};

const PastEmployees: React.FC = () => {
  const [employees, setEmployees] = useState<EmpExitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    fetchEmpExits();
  }, []);

  const fetchEmpExits = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .schema('hr')
        .from('employees')
        .select('id, original_id:id, full_name:display_name, email, employee_no:employee_number, role:employment_status, department, designation, exit_reason:archive_reason, exit_summary:notes, certificate_issued, certificate_date, archive_status:employment_status, archived_at')
        .eq('employment_status', 'archived')
        .order('archived_at', { ascending: false });

      if (error) {
        throw error;
      }

      setEmployees((data || []) as EmpExitRecord[]);
    } catch (error) {
      console.warn('PastEmployees: direct archived_profiles fetch failed, falling back to edge function.', error);
      try {
        const { data } = await invokeEdgeFunction<{ data: EmpExitRecord[] }>('list-archived-profiles', undefined, {
          method: 'GET',
        });
        setEmployees(data || []);
      } catch (fallbackError) {
        console.error('Error fetching emp exit records:', fallbackError);
        setEmployees([]);
        setToast({ message: 'No archived employee records are available yet', type: 'info' });
      }
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (emp: EmpExitRecord) => {
    setEditingId(emp.id);
    setFormData({
      full_name: emp.full_name || '',
      employee_no: emp.employee_no || '',
      role: emp.role || '',
      department: emp.department || '',
      designation: emp.designation || '',
      exit_reason: emp.exit_reason || '',
      exit_summary: emp.exit_summary || '',
      certificate_issued: emp.certificate_issued || false,
      certificate_date: emp.certificate_date || '',
      archive_status: emp.archive_status || 'archived',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name.trim()) {
      setToast({ message: 'Employee name is required', type: 'warning' });
      return;
    }
    setIsSubmitting(true);
    try {
      const dateStr = getEmployeeNoDateStr();
      let nextSequence = 1;
      try {
        const { data: allArchivedEmps, error: allEmpError } = await supabase
          .from('archived_profiles')
          .select('employee_no')
          .order('employee_no', { ascending: false })
          .limit(1);
        if (!allEmpError && allArchivedEmps && allArchivedEmps.length > 0) {
          const lastNo = allArchivedEmps[0]?.employee_no || '';
          const lastSeq = extractSequenceFromEmployeeNo(lastNo);
          nextSequence = lastSeq + 1;
        }
      } catch (seqError) {
        console.warn('Past employees: unable to fetch latest employee number. Falling back to local sequence.', seqError);
      }

      const normalizedEmployeeNo = normalizeEmployeeNo(formData.employee_no, dateStr, nextSequence);

      const payload: any = {
        full_name: formData.full_name,
        employee_no: normalizedEmployeeNo,
        role: formData.role || null,
        department: formData.department || null,
        designation: formData.designation || null,
        exit_reason: formData.exit_reason || null,
        exit_summary: formData.exit_summary || null,
        certificate_issued: formData.certificate_issued,
        certificate_date: formData.certificate_issued && formData.certificate_date ? formData.certificate_date : null,
        archive_status: formData.archive_status,
      };

      if (editingId) {
        const { error } = await supabase
          .from('archived_profiles')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        setToast({ message: 'Exit record updated successfully', type: 'success' });
      } else {
        payload.archived_at = new Date().toISOString();
        const { error } = await supabase
          .from('archived_profiles')
          .insert([payload]);
        if (error) throw error;
        setToast({ message: 'Exit record created successfully', type: 'success' });
      }

      setShowForm(false);
      setEditingId(null);
      setFormData({ ...EMPTY_FORM });
      fetchEmpExits();
    } catch (error: any) {
      console.error('Error saving emp exit record:', error);
      setToast({ message: error.message || 'Error saving record', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employee_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.designation?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleReinstate = async (emp: EmpExitRecord) => {
    const confirmed = window.confirm(
      `Reinstate ${emp.full_name} back to the company and recreate their login account?`
    );

    if (!confirmed) return;

    setRestoringId(emp.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Authentication required');

      const data = await invokeEdgeFunction('reinstate-user', {
        archivedProfileId: emp.id,
        sendEmail: true,
        sendSms: true,
        module: 'hr',
      }, {
        accessToken: session.access_token,
      });

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to reinstate employee.');
      }

      const deliverySummary = [
        data?.emailSent ? 'email' : null,
        data?.smsSent ? 'sms' : null,
      ].filter(Boolean).join(' and ');

      setToast({
        message: deliverySummary
          ? `${emp.full_name} reinstated successfully. New credentials sent via ${deliverySummary}.`
          : `${emp.full_name} reinstated successfully.`,
        type: 'success',
      });
      await fetchEmpExits();
    } catch (error) {
      console.error('Error reinstating employee:', error);
      setToast({
        message: extractEdgeFunctionErrorMessage(error, 'Failed to reinstate employee.'),
        type: 'error',
      });
    } finally {
      setRestoringId(null);
    }
  };

  const inputCls = "w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 px-3 py-2 rounded-lg outline-none focus:ring-2 focus:ring-brand-purple text-sm text-gray-900 dark:text-white";
  const labelCls = "block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1";

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            <LogOut className="text-brand-purple" size={24} /> Employee Exit Records
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Track and manage employee exit details, certificates of service, and archive status.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setEditingId(null); setFormData({ ...EMPTY_FORM }); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-purple text-white rounded-xl font-medium hover:bg-brand-pink transition-colors shadow-lg shadow-brand-purple/20 text-sm"
            title="Record a new employee exit"
          >
            <Plus size={16} /> Record Exit
          </button>
        )}
      </div>

      {/* Exit Record Form */}
      {showForm && (
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10 bg-brand-purple/5 dark:bg-brand-purple/10">
            <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <LogOut size={18} className="text-brand-purple" />
              {editingId ? 'Update Exit Record' : 'Record New Employee Exit'}
            </h2>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); setFormData({ ...EMPTY_FORM }); }}
              className="text-gray-400 hover:text-red-500 transition-colors"
              aria-label="Close form"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Basic Info */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 pb-2 border-b border-gray-100 dark:border-white/10">Employee Information</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>Full Name *</label>
                  <input type="text" required value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} placeholder="e.g. John Kamau" title="Employee Full Name" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Employee No.</label>
                  <input type="text" value={formData.employee_no} onChange={e => setFormData({ ...formData, employee_no: e.target.value })} placeholder="e.g. EMP-001" title="Employee Number" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Designation</label>
                  <input type="text" value={formData.designation} onChange={e => setFormData({ ...formData, designation: e.target.value })} placeholder="e.g. Security Guard" title="Employee Designation" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Department</label>
                  <input type="text" value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} placeholder="e.g. Security" title="Employee Department" className={inputCls} />
                </div>
              </div>
            </div>

            {/* Exit Details */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 pb-2 border-b border-gray-100 dark:border-white/10">Reason for Exit</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Exit Reason</label>
                  <div className="relative">
                    <select
                      value={formData.exit_reason}
                      onChange={e => setFormData({ ...formData, exit_reason: e.target.value as any })}
                      className={inputCls + ' appearance-none pr-8'}
                      aria-label="Select exit reason"
                      title="Select exit reason"
                    >
                      <option value="">— Select Reason —</option>
                      <option value="resigned">Resigned</option>
                      <option value="deserted">Deserted</option>
                      <option value="dismissed">Dismissed</option>
                      <option value="convicted">Convicted</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Archive Status</label>
                  <div className="relative">
                    <select
                      value={formData.archive_status}
                      onChange={e => setFormData({ ...formData, archive_status: e.target.value as any })}
                      className={inputCls + ' appearance-none pr-8'}
                      aria-label="Select archive status"
                      title="Select archive status"
                    >
                      <option value="archived">Archived</option>
                      <option value="marked_for_deletion">Marked for Deletion</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>
                    Exit Summary
                    {formData.exit_reason && (
                      <span className="ml-2 font-normal text-gray-400 normal-case">
                        ({EXIT_REASON_LABELS[formData.exit_reason]?.label} — briefly describe what led to exit)
                      </span>
                    )}
                  </label>
                  <textarea
                    value={formData.exit_summary}
                    onChange={e => setFormData({ ...formData, exit_summary: e.target.value })}
                    placeholder="Brief summary of circumstances leading to this exit..."
                    title="Exit Summary Details"
                    rows={3}
                    className={inputCls + ' resize-none'}
                  />
                </div>
              </div>
            </div>

            {/* Certificate of Service */}
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 pb-2 border-b border-gray-100 dark:border-white/10">Certificate of Service</p>
              <div className="flex flex-wrap items-start gap-6">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => setFormData({ ...formData, certificate_issued: !formData.certificate_issued })}
                    className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all cursor-pointer ${formData.certificate_issued ? 'bg-brand-purple border-brand-purple' : 'border-gray-300 dark:border-white/20'}`}
                  >
                    {formData.certificate_issued && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Certificate of Service Issued</span>
                </label>
                {formData.certificate_issued && (
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date Issued</label>
                    <input
                      type="date"
                      value={formData.certificate_date}
                      onChange={e => setFormData({ ...formData, certificate_date: e.target.value })}
                      className={inputCls + ' w-44'}
                      aria-label="Certificate issue date"
                      title="Certificate issue date"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-white/10">
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); setFormData({ ...EMPTY_FORM }); }}
                className="px-4 py-2 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors text-sm font-medium"
                title="Cancel and close form"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-brand-purple text-white rounded-lg hover:bg-brand-pink transition-colors flex items-center gap-2 text-sm font-bold disabled:opacity-50"
                title={editingId ? "Update exit record" : "Save exit record"}
              >
                {isSubmitting ? <CustomLoader size={16} /> : <Save size={16} />}
                {isSubmitting ? 'Saving...' : editingId ? 'Update Record' : 'Save Exit Record'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Records Table */}
      <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-100 dark:border-dark-border shadow-sm">
        <div className="p-4 border-b border-gray-100 dark:border-white/10">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by name, email, ID or designation..."
              title="Search exit records"
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-lg outline-none focus:ring-2 focus:ring-brand-purple/30 text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center">
            <CustomLoader size={40} label="Loading exit records..." />
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="py-20 text-center">
            <LogOut className="mx-auto text-gray-200 dark:text-gray-700 mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No exit records found</h3>
            <p className="text-gray-500 text-sm mt-1">
              {searchTerm ? 'No results match your search.' : 'No employee exit records have been added yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 uppercase text-xs font-semibold border-b border-gray-100 dark:border-white/10">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Designation</th>
                  <th className="px-6 py-4">Reason for Exit</th>
                  <th className="px-6 py-4">Exit Summary</th>
                  <th className="px-6 py-4">Certificate</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                    {/* Employee */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-gray-400">
                          <User size={18} />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">{emp.full_name}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            {emp.email && <span>{emp.email}</span>}
                            {emp.employee_no && <span className="font-mono">• {emp.employee_no}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Designation */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                          <Briefcase size={13} className="text-gray-400" />
                          {emp.designation || emp.role || '—'}
                        </div>
                        {emp.department && <div className="text-xs text-gray-400">{emp.department}</div>}
                      </div>
                    </td>
                    {/* Exit Reason */}
                    <td className="px-6 py-4">
                      {emp.exit_reason ? (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border capitalize ${EXIT_REASON_LABELS[emp.exit_reason]?.color}`}>
                          {EXIT_REASON_LABELS[emp.exit_reason]?.label}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic text-xs">Not specified</span>
                      )}
                    </td>
                    {/* Exit Summary */}
                    <td className="px-6 py-4 max-w-[200px]">
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                        {emp.exit_summary || <span className="text-gray-300 dark:text-gray-600 italic">—</span>}
                      </p>
                    </td>
                    {/* Certificate */}
                    <td className="px-6 py-4">
                      {emp.certificate_issued ? (
                        <div className="flex items-center gap-1.5">
                          <FileCheck size={14} className="text-green-500" />
                          <div>
                            <div className="text-xs font-bold text-green-600 dark:text-green-400">Issued</div>
                            {emp.certificate_date && (
                              <div className="text-[10px] text-gray-400 flex items-center gap-1">
                                <Calendar size={9} />
                                {new Date(emp.certificate_date).toLocaleDateString('en-KE', { dateStyle: 'medium' })}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <X size={12} className="text-gray-300" /> Not issued
                        </span>
                      )}
                    </td>
                    {/* Archive Status */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${STATUS_LABELS[emp.archive_status || 'archived']?.color}`}>
                        {emp.archive_status === 'marked_for_deletion' ? <Trash2 size={10} /> : <Archive size={10} />}
                        {STATUS_LABELS[emp.archive_status || 'archived']?.label}
                      </span>
                    </td>
                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(emp)}
                          className="text-xs font-bold text-brand-purple hover:text-brand-pink px-3 py-1.5 rounded-lg border border-brand-purple/30 hover:bg-brand-purple/5 transition-colors"
                          title="Edit Details"
                        >
                          Edit Details
                        </button>
                        <button
                          onClick={() => handleReinstate(emp)}
                          disabled={restoringId === emp.id}
                          className="text-xs font-bold text-emerald-700 dark:text-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-300/60 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                          title="Reinstate employee"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <RotateCcw size={12} />
                            {restoringId === emp.id ? 'Restoring...' : 'Reinstate'}
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && <CustomToast isVisible={!!toast} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default PastEmployees;
