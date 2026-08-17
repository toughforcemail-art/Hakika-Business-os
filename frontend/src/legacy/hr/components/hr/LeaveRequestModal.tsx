// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { sendEmail, EmailTemplates } from '../../services/emailService';

interface LeaveRequestModalProps {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const LeaveRequestModal: React.FC<LeaveRequestModalProps> = ({ userId, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<{ id: string; name: string }[]>([]);
  const [formData, setFormData] = useState({
    leave_type: '',
    start_date: '',
    end_date: '',
    reason: ''
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  const fetchLeaveTypes = async () => {
    const { data } = await supabase.from('hr_leave_types').select('id, name');
    setLeaveTypes(data || []);
    if (data && data.length > 0) {
      setFormData(prev => ({ ...prev, leave_type: data[0].name }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const start = new Date(formData.start_date);
    const end = new Date(formData.end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    try {
      const { error: insertError } = await supabase
        .from('hr_leaves')
        .insert([{
          employee_id: userId,
          leave_type: formData.leave_type,
          start_date: formData.start_date,
          end_date: formData.end_date,
          days: diffDays,
          reason: formData.reason,
          status: 'pending'
        }]);

      if (insertError) throw insertError;

      // Send Notification Email
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('id', userId).single();
        
        if (profile) {
          const template = EmailTemplates.leaveApplied(profile.full_name, {
            type: formData.leave_type,
            start: formData.start_date,
            end: formData.end_date,
            days: diffDays
          });

          await sendEmail({
            to: profile.email || user?.email || '',
            subject: template.subject,
            html: template.html
          });
        }
      } catch (emailErr) {
        console.error('Failed to send leave application email:', emailErr);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-dark-surface w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-modal-pop">
        <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-white/5">
          <div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Apply for Leave</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Submit your leave petition</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors"
            title="Close"
            aria-label="Close"
          >
            <X size={20} className="text-gray-500" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-sm">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="leave-type" className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Leave Type</label>
              <select
                id="leave-type"
                title="Select leave type"
                required
                value={formData.leave_type}
                onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-500 transition-all"
              >
                {leaveTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                {leaveTypes.length === 0 && <option value="Annual">Annual Leave</option>}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="leave-reason" className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Reason</label>
              <input
                id="leave-reason"
                title="Enter reason for leave"
                required
                type="text"
                placeholder="e.g. Personal reasons"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-500 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="leave-start-date" className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} aria-hidden="true" />
                <input
                  id="leave-start-date"
                  title="Select start date"
                  required
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-pink-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="leave-end-date" className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} aria-hidden="true" />
                <input
                  id="leave-end-date"
                  title="Select end date"
                  required
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-pink-500 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
              title="Cancel and close"
            >
              Cancel
            </button>
            <button
              disabled={loading}
              type="submit"
              className="flex-1 px-6 py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-2xl font-bold hover:shadow-lg hover:shadow-pink-500/20 transition-all flex items-center justify-center gap-2"
              title="Submit Leave Petition"
            >
              {loading ? <Loader2 className="animate-spin" size={20} aria-hidden="true" /> : <CheckCircle2 size={20} aria-hidden="true" />}
              Submit Petition
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LeaveRequestModal;
