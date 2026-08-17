// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { activityLogger } from '../../utils/activityLogger';
import CustomLoader from '../../components/CustomLoader';
import Toast from '../../components/Toast';

interface LeaveType {
  id: string;
  name: string;
  description: string;
  max_days_per_year: number;
  requires_approval: boolean;
  is_paid: boolean;
  is_active: boolean;
  requires_balance_check: boolean;
  min_notice_days: number;
  allow_negative_balance: boolean;
  document_required: boolean;
  document_after_days: number | null;
  gender_restriction: 'any' | 'male' | 'female';
}

const LeaveTypesManagement: React.FC = () => {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    max_days_per_year: 0,
    requires_approval: true,
    is_paid: true,
    is_active: true,
    requires_balance_check: true,
    min_notice_days: 7,
    allow_negative_balance: false,
    document_required: false,
    document_after_days: null as number | null,
    gender_restriction: 'any' as 'any' | 'male' | 'female'
  });

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  const fetchLeaveTypes = async () => {
    try {
      const { data } = await supabase.from('leave_types').select('*').order('name');
      setLeaveTypes(data || []);
    } catch (error) {
      console.error('Error fetching leave types:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingType) {
        const { error } = await supabase
          .from('leave_types')
          .update(formData)
          .eq('id', editingType.id);
        if (error) throw error;
        setToast({ message: 'Leave type updated successfully', type: 'success' });
      } else {
        const { error } = await supabase.from('leave_types').insert(formData);
        if (error) throw error;
        setToast({ message: 'Leave type created successfully', type: 'success' });
      }

      setShowModal(false);
      setEditingType(null);
      setFormData({
        name: '',
        description: '',
        max_days_per_year: 0,
        requires_approval: true,
        is_paid: true,
        is_active: true,
        requires_balance_check: true,
        min_notice_days: 7,
        allow_negative_balance: false,
        document_required: false,
        document_after_days: null,
        gender_restriction: 'any',
      });
      fetchLeaveTypes();
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to save leave type', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (type: LeaveType) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      description: type.description,
      max_days_per_year: type.max_days_per_year,
      requires_approval: type.requires_approval,
      is_paid: type.is_paid,
      is_active: type.is_active,
      requires_balance_check: type.requires_balance_check,
      min_notice_days: type.min_notice_days,
      allow_negative_balance: type.allow_negative_balance,
      document_required: type.document_required,
      document_after_days: type.document_after_days,
      gender_restriction: type.gender_restriction,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this leave type?')) return;

    try {
      const leaveType = leaveTypes.find((item) => item.id === id);
      const { error } = await supabase.rpc('archive_record', { p_table_name: 'leave_types', p_record_id: id, p_reason: 'delete' });
      if (error) throw error;
      void activityLogger.logDataAction('delete', 'leave_types', id, leaveType?.name || 'Leave Type');
      setToast({ message: 'Leave type deleted successfully', type: 'success' });
      fetchLeaveTypes();
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to delete leave type', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <CustomLoader size={40} label="Loading leave types..." />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-[#020817] min-h-screen">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Leave Types</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">Manage leave types and policies</p>
        </div>
        <button
          onClick={() => {
            setEditingType(null);
            setFormData({
              name: '',
              description: '',
              max_days_per_year: 0,
              requires_approval: true,
              is_paid: true,
              is_active: true,
              requires_balance_check: true,
              min_notice_days: 7,
              allow_negative_balance: false,
              document_required: false,
              document_after_days: null,
              gender_restriction: 'any',
            });
            setShowModal(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          title="Create a new leave type category"
        >
          <Plus className="w-4 h-4" />
          Add Leave Type
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {leaveTypes.map((type) => (
          <div key={type.id} className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#1e293b] rounded-lg p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{type.name}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{type.description}</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleEdit(type)}
                  title="Edit Leave Type"
                  aria-label="Edit"
                  className="p-1 hover:bg-gray-100 dark:hover:bg-[#1e293b] rounded"
                >
                  <Edit className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                </button>
                <button
                  onClick={() => handleDelete(type.id)}
                  title="Delete Leave Type"
                  aria-label="Delete"
                  className="p-1 hover:bg-gray-100 dark:hover:bg-[#1e293b] rounded"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Max Days/Year:</span>
                <span className="font-medium text-gray-900 dark:text-white">{type.max_days_per_year}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Notice:</span>
                <span className="font-medium text-gray-900 dark:text-white">{type.min_notice_days} day(s)</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {type.is_paid && <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 rounded text-xs">Paid</span>}
                {type.requires_approval && <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 rounded text-xs">Requires Approval</span>}
                {type.requires_balance_check ? (
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400 rounded text-xs">Checks Balance</span>
                ) : (
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400 rounded text-xs">No Balance Check</span>
                )}
                {type.document_required && <span className="px-2 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400 rounded text-xs">Document Required</span>}
                {type.gender_restriction !== 'any' && <span className="px-2 py-1 bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/20 dark:text-fuchsia-400 rounded text-xs">{type.gender_restriction} only</span>}
                {type.is_active ? (
                  <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 rounded text-xs">Active</span>
                ) : (
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400 rounded text-xs">Inactive</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#1e293b] rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingType ? 'Edit Leave Type' : 'Add Leave Type'}
              </h3>
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
                <label htmlFor="leave-type-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input
                  id="leave-type-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Annual Leave"
                  title="Leave Type Name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg dark:bg-[#0A1628] dark:text-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="leave-type-desc" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  id="leave-type-desc"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Briefly describe this leave category..."
                  title="Leave Type Description"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg dark:bg-[#0A1628] dark:text-white"
                  rows={2}
                />
              </div>

              <div>
                <label htmlFor="leave-type-days" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Days Per Year</label>
                <input
                  id="leave-type-days"
                  type="number"
                  value={formData.max_days_per_year}
                  onChange={(e) => setFormData({ ...formData, max_days_per_year: parseInt(e.target.value) })}
                  title="Max Days Per Year"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg dark:bg-[#0A1628] dark:text-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="leave-type-notice" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Minimum Notice Days</label>
                <input
                  id="leave-type-notice"
                  type="number"
                  value={formData.min_notice_days}
                  onChange={(e) => setFormData({ ...formData, min_notice_days: parseInt(e.target.value || '0', 10) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg dark:bg-[#0A1628] dark:text-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="leave-type-gender" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gender Restriction</label>
                <select
                  id="leave-type-gender"
                  value={formData.gender_restriction}
                  onChange={(e) => setFormData({ ...formData, gender_restriction: e.target.value as 'any' | 'male' | 'female' })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg dark:bg-[#0A1628] dark:text-white"
                >
                  <option value="any">Any</option>
                  <option value="female">Female only</option>
                  <option value="male">Male only</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.requires_approval}
                    onChange={(e) => setFormData({ ...formData, requires_approval: e.target.checked })}
                    title="Requires Approval"
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Requires Approval</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_paid}
                    onChange={(e) => setFormData({ ...formData, is_paid: e.target.checked })}
                    title="Paid Leave"
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Paid Leave</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.requires_balance_check}
                    onChange={(e) => setFormData({ ...formData, requires_balance_check: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Requires Balance Check</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allow_negative_balance}
                    onChange={(e) => setFormData({ ...formData, allow_negative_balance: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Allow Negative Balance</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.document_required}
                    onChange={(e) => setFormData({ ...formData, document_required: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Supporting Document Required</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    title="Is Active"
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
                </label>
              </div>

              {formData.document_required && (
                <div>
                  <label htmlFor="leave-type-document-after" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Document Required After Days</label>
                  <input
                    id="leave-type-document-after"
                    type="number"
                    min="1"
                    value={formData.document_after_days ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        document_after_days: e.target.value ? parseInt(e.target.value, 10) : null,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg dark:bg-[#0A1628] dark:text-white"
                  />
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  className="px-4 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg hover:bg-gray-50 dark:hover:bg-[#1e293b]"
                  title="Cancel and close modal"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  title={editingType ? "Update leave type" : "Create leave type"}
                >
                  {submitting ? 'Saving...' : editingType ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveTypesManagement;
