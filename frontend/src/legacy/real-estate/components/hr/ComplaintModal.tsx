// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { X, MessageSquare, AlertCircle, CheckCircle2, Loader2, Building } from 'lucide-react';
import { supabase } from '../../utils/supabase';

interface ComplaintModalProps {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const ComplaintModal: React.FC<ComplaintModalProps> = ({ userId, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [formData, setFormData] = useState({
    department_id: '',
    subject: '',
    message: ''
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDepts = async () => {
      const { data } = await supabase.from('hr_departments').select('id, name').order('name');
      if (data) setDepartments(data);
    };
    fetchDepts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_code')
        .eq('id', userId)
        .single();

      const { error: insertError } = await supabase
        .from('hr_complaints')
        .insert([{
          submitted_by: userId,
          department_id: formData.department_id || null,
          subject: formData.subject,
          message: formData.message,
          company_code: profile?.company_code || '',
          status: 'pending'
        }]);

      if (insertError) throw insertError;
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
            <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Lodge a Complaint</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Safe & Secure HR Reporting</p>
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

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="target-department" className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Target Department (Optional)</label>
              <div className="relative">
                <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} aria-hidden="true" />
                <select
                  id="target-department"
                  title="Select target department"
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-red-500 transition-all appearance-none text-gray-900 dark:text-white"
                >
                  <option value="">General / Multiple Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="complaint-subject" className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Subject</label>
              <input
                id="complaint-subject"
                title="Enter complaint subject"
                required
                type="text"
                placeholder="e.g. Workplace Safety Concern"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 transition-all font-bold text-gray-900 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="complaint-message" className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Detailed Message</label>
              <textarea
                id="complaint-message"
                title="Enter detailed message"
                required
                rows={4}
                placeholder="Describe your concern or grievance clearly..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 transition-all resize-none text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
              title="Cancel complaint submission"
            >
              Cancel
            </button>
            <button
              disabled={loading}
              type="submit"
              className="flex-1 px-6 py-4 bg-red-600 text-white rounded-2xl font-bold hover:shadow-lg hover:shadow-red-500/20 transition-all flex items-center justify-center gap-2"
              title="Submit Complaint"
            >
              {loading ? <Loader2 className="animate-spin" size={20} aria-hidden="true" /> : <MessageSquare size={20} aria-hidden="true" />}
              Submit Complaint
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ComplaintModal;
