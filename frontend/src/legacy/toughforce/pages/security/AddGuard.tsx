// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { 
  UserPlus, 
  Shield, 
  ArrowLeft,
  Save,
  FileText,
  BadgeCheck,
  Building2,
  Trash2
} from 'lucide-react';
import { motion } from 'framer-motion';
import CustomToast, { sanitizeError } from '../../components/CustomToast';
import { NotificationService } from '../../services/NotificationService';
import { formatPhoneInput, normalizePhoneNumber } from '../../utils/phoneNumbers';

const AddGuard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!!id);
  const [formData, setFormData] = useState<any>({
    full_name: '',
    email: '',
    phone: formatPhoneInput(''),
    psra_number: '',
    uniform_size: 'M',
    department: 'Security',
    designation: 'Security Guard',
    is_security_guard: true,
    status: 'Active'
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (id) {
      fetchGuardData();
    }
  }, [id]);

  const fetchGuardData = async () => {
    setInitialLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      if (data) {
        setFormData({
          ...data,
          phone: formatPhoneInput(data.phone),
        });
      }
    } catch (error) {
      console.error("Fetch error:", error);
      setToast({ message: 'Failed to load guard data', type: 'error' });
    }
    setInitialLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const normalizedPhone = normalizePhoneNumber(formData.phone);
      const payload = {
        ...formData,
        phone: normalizedPhone,
      };

      if (id) {
        const { error } = await supabase
          .from('profiles')
          .update(payload)
          .eq('id', id);
        if (error) throw error;
        setToast({ message: 'Guard profile updated successfully!', type: 'success' });
      } else {
        // For new guards, we might need auth signup or just profile creation
        // Assuming we just create profile for now as per previous patterns
        const { error } = await supabase
          .from('profiles')
          .insert([payload]);
        if (error) throw error;
        setToast({ message: 'Guard profile created successfully!', type: 'success' });
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        NotificationService.sendNotification(
          user.id,
          id ? 'Guard Profile Updated' : 'New Guard Registered',
          `${formData.full_name} has been processed in the guard database.`,
          'success'
        );
      }

      setTimeout(() => navigate('/app/security/guards'), 1500);
    } catch (error) {
      console.error("Save error:", error);
      setToast({ message: sanitizeError(error), type: 'error' });
    }
    setLoading(false);
  };

  if (initialLoading) {
    return (
      <div className="min-h-full w-full flex items-center justify-center bg-white dark:bg-dark-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-purple"></div>
      </div>
    );
  }

  return (
    <div className="min-h-full w-full p-6 lg:p-10 bg-white dark:bg-dark-bg text-gray-900 dark:text-white">
      <CustomToast 
        isVisible={!!toast} 
        message={toast?.message || ''} 
        type={toast?.type} 
        onClose={() => setToast(null)} 
      />
      
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/app/security/guards')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
            title="Go back"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="text-brand-purple" />
              {id ? 'Edit Guard Profile' : 'Register New Guard'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-dark-text">
              {id ? 'Update credentials and information' : 'Onboard a new security operative to the system'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-3xl p-8 shadow-xl space-y-6"
            >
              <h2 className="text-lg font-bold flex items-center gap-2 border-b border-gray-100 dark:border-white/5 pb-4">
                <FileText className="text-brand-purple" size={20}/> Personal Information
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Full Name</label>
                  <input 
                    required
                    title="Full Name"
                    className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Email Address</label>
                  <input 
                    type="email"
                    title="Email Address"
                    className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Phone Number</label>
                  <input 
                    title="Phone Number"
                    className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({...formData, phone: formatPhoneInput(e.target.value)})}
                    placeholder="+254..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Uniform Size</label>
                  <select 
                    title="Uniform Size"
                    className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                    value={formData.uniform_size || 'M'}
                    onChange={(e) => setFormData({...formData, uniform_size: e.target.value})}
                  >
                    <option value="S">Small (S)</option>
                    <option value="M">Medium (M)</option>
                    <option value="L">Large (L)</option>
                    <option value="XL">Extra Large (XL)</option>
                    <option value="XXL">Double Extra Large (XXL)</option>
                  </select>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-3xl p-8 shadow-xl space-y-6"
            >
              <h2 className="text-lg font-bold flex items-center gap-2 border-b border-gray-100 dark:border-white/5 pb-4">
                <BadgeCheck className="text-brand-purple" size={20}/> Professional Credentials
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">PSRA Number</label>
                  <input 
                    title="PSRA Number"
                    className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none font-mono"
                    value={formData.psra_number || ''}
                    onChange={(e) => setFormData({...formData, psra_number: e.target.value})}
                    placeholder="PSRA-XXXXXX"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Designation</label>
                  <input 
                    title="Designation"
                    className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                    value={formData.designation || ''}
                    onChange={(e) => setFormData({...formData, designation: e.target.value})}
                    placeholder="e.g. Senior Guard"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Department</label>
                  <input 
                    title="Department"
                    className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                    value={formData.department || ''}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Operation Status</label>
                  <select 
                    title="Status"
                    className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                    value={formData.status || 'Active'}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Terminated">Terminated</option>
                  </select>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="space-y-6">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-brand-purple/5 border border-brand-purple/20 rounded-3xl p-6 space-y-4"
            >
              <h3 className="font-bold text-brand-purple flex items-center gap-2">
                <Shield size={18}/> Guard Policy
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Registering a guard profile makes them available for deployment, rostering, and attendance tracking. Ensure PSRA credentials are valid.
              </p>
              <div className="flex items-center gap-3 p-3 bg-white dark:bg-dark-surface rounded-xl border border-brand-purple/10">
                <input 
                   type="checkbox" 
                   id="is_guard"
                   title="Is Security Guard"
                   checked={formData.is_security_guard}
                   onChange={(e) => setFormData({...formData, is_security_guard: e.target.checked})}
                   className="w-4 h-4 rounded text-brand-purple focus:ring-brand-purple"
                />
                <label htmlFor="is_guard" className="text-xs font-medium cursor-pointer">Mark as Active Personnel</label>
              </div>
            </motion.div>

            <div className="flex flex-col gap-3">
              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-4 bg-brand-purple text-white font-bold rounded-2xl hover:bg-opacity-90 transition shadow-xl shadow-brand-purple/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save size={18}/> {id ? 'Update Profile' : 'Register Guard'}
                  </>
                )}
              </button>
              <button 
                type="button" 
                onClick={() => navigate('/app/security/guards')}
                className="w-full py-4 bg-gray-100 dark:bg-white/5 text-gray-500 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-white/10 transition"
              >
                Cancel
              </button>
            </div>

            {id && (
              <button 
                type="button"
                className="w-full py-3 bg-rose-500/10 text-rose-500 text-xs font-bold rounded-xl hover:bg-rose-500/20 transition flex items-center justify-center gap-2"
                onClick={async () => {
                  if (window.confirm("Are you sure you want to delete this guard? This action cannot be undone.")) {
                    try {
                      const { error } = await supabase.from('profiles').delete().eq('id', id);
                      if (error) throw error;
                      setToast({ message: 'Guard deleted successfully', type: 'success' });
                      setTimeout(() => navigate('/app/security/guards'), 1500);
                    } catch (err) {
                      setToast({ message: sanitizeError(err), type: 'error' });
                    }
                  }
                }}
              >
                <Trash2 size={14}/> Delete Permanent Record
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddGuard;
