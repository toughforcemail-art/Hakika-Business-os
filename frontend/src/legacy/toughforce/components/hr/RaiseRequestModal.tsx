// @ts-nocheck
import React, { useState } from 'react';
import { X, DollarSign, AlertCircle, CheckCircle2, Loader2, TrendingUp } from 'lucide-react';
import { supabase } from '../../utils/supabase';

interface RaiseRequestModalProps {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const RaiseRequestModal: React.FC<RaiseRequestModalProps> = ({ userId, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    current_salary: '',
    requested_salary: '',
    reason: ''
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('hr_raise_requests')
        .insert([{
          employee_id: userId,
          current_salary: parseFloat(formData.current_salary) || 0,
          requested_salary: parseFloat(formData.requested_salary),
          reason: formData.reason,
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
            <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Request Salary Raise</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Submit your career growth petition</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="current-salary" className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Current Salary (approx)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} aria-hidden="true" />
                  <input
                    id="current-salary"
                    title="Enter current salary"
                    type="number"
                    placeholder="0.00"
                    value={formData.current_salary}
                    onChange={(e) => setFormData({ ...formData, current_salary: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="requested-salary" className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Requested Salary</label>
                <div className="relative">
                  <TrendingUp className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={18} aria-hidden="true" />
                  <input
                    id="requested-salary"
                    title="Enter requested salary"
                    required
                    type="number"
                    placeholder="0.00"
                    value={formData.requested_salary}
                    onChange={(e) => setFormData({ ...formData, requested_salary: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 transition-all font-bold text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="raise-justification" className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">Justification / Reason</label>
              <textarea
                id="raise-justification"
                title="Enter justification or reason"
                required
                rows={4}
                placeholder="Briefly explain why you are requesting this adjustment (e.g. increased responsibilities, performance milestones...)"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 transition-all resize-none"
              />
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
              className="flex-1 px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-2xl font-bold hover:shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
              title="Submit Raise Request"
            >
              {loading ? <Loader2 className="animate-spin" size={20} aria-hidden="true" /> : <DollarSign size={20} aria-hidden="true" />}
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RaiseRequestModal;
