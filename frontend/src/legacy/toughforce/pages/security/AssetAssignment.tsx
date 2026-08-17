// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { 
  Package, 
  User, 
  Calendar, 
  CheckCircle2, 
  Trash2, 
  MoreVertical,
  Plus,
  ArrowRight,
  Shield,
  Search,
  Box,
  ClipboardCheck,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomToast, { sanitizeError } from '../../components/CustomToast';
import { NotificationService } from '../../services/NotificationService';
import { UnifiedStorageService } from '../../services/UnifiedStorageService';
import { AssetNotificationService } from '../../services/AssetNotificationService';
import { Upload } from 'lucide-react';

const AssetAssignment: React.FC = () => {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [formData, setFormData] = useState({
    asset_id: '',
    employee_id: '',
    condition_on_assign: 'Good',
    notes: '',
    is_accepted: false,
    consent_doc_url: ''
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: aData } = await supabase.from('security_assets').select('id, serial_number, name').eq('status', 'available');
      const { data: eData } = await supabase.from('profiles').select('id, full_name').or('is_security_guard.eq.true,department.eq.Security');
      
      if (aData) setAssets(aData);
      if (eData) setEmployees(eData);
      
      await fetchAssignments();
    } catch (error) {
      console.error("Fetch error:", error);
    }
    setLoading(false);
  };

  const fetchAssignments = async () => {
    const { data } = await supabase
      .from('security_asset_assignments')
      .select(`
        *,
        security_assets ( 
          serial_number,
          name
        ),
        employee:profiles!employee_id ( full_name ),
        issuer:profiles!assigned_by ( full_name )
      `)
      .is('returned_at', null)
      .order('assigned_at', { ascending: false });
    if (data) setAssignments(data);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setUploading(true);
    try {
      setToast({ message: 'Uploading to secure storage...', type: 'success' });
      const url = await UnifiedStorageService.upload(file, {
        folder: '/asset_consent',
        bucket: 'asset-documents'
      });
      
      setFormData(prev => ({ ...prev, consent_doc_url: url }));
      setToast({ message: 'File uploaded successfully', type: 'success' });
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
      setSelectedFile(null);
    }
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.is_accepted) {
       setToast({ message: "Guard must accept the asset to proceed.", type: 'error' });
       return;
    }
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('security_asset_assignments').insert([{
        asset_id: formData.asset_id,
        employee_id: formData.employee_id,
        condition_on_assign: formData.condition_on_assign,
        notes: formData.notes,
        assigned_at: new Date().toISOString(),
        consent_doc_url: formData.consent_doc_url,
        assigned_by: user?.id
      }]);

      if (error) throw error;

      // Update asset status
      await supabase.from('security_assets').update({ status: 'assigned' }).eq('id', formData.asset_id);

      setToast({ message: 'Asset issued successfully', type: 'success' });
      
      // Automated SMS & Email Alerts
      const asset = assets.find(a => a.id === formData.asset_id);
      if (asset) {
        await AssetNotificationService.sendAssignmentAlert(
          formData.employee_id,
          asset.name,
          asset.serial_number
        );
      }

      await fetchInitialData();
      setShowModal(false);
      setSelectedFile(null);
      setFormData({ asset_id: '', employee_id: '', condition_on_assign: 'Good', notes: '', is_accepted: false, consent_doc_url: '' });
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    }
    setLoading(false);
  };

  const handleReturn = async (assignmentId: string, assetId: string) => {
    if (!window.confirm("Confirm asset return to inventory?")) return;
    setLoading(true);
    try {
      const { error: asgnError } = await supabase.from('security_asset_assignments').update({ returned_at: new Date().toISOString() }).eq('id', assignmentId);
      if (asgnError) throw asgnError;

      const { error: assetError } = await supabase.from('security_assets').update({ status: 'available' }).eq('id', assetId);
      if (assetError) throw assetError;

      setToast({ message: 'Asset successfully returned to inventory', type: 'success' });
      await fetchInitialData();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        NotificationService.sendNotification(user.id, 'Asset Returned', 'An asset has been returned and is now available.', 'success');
      }
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-full w-full p-6 lg:p-10 space-y-8 bg-white dark:bg-dark-bg text-gray-900 dark:text-white">
      <CustomToast isVisible={!!toast} message={toast?.message || ''} type={toast?.type} onClose={() => setToast(null)} />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-200 dark:border-dark-border pb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="text-brand-purple" /> Asset Issuance & Tracking
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-text">
            Assign security equipment and assets to guards with digital acceptance.
          </p>
        </div>
        <button 
          onClick={() => setShowModal(true)} 
          title="Issue a new equipment asset to a security guard"
          className="px-4 py-2 bg-brand-purple text-white text-sm font-medium rounded-xl hover:bg-opacity-90 transition flex items-center gap-2 shadow-lg shadow-brand-purple/20"
        >
          <Plus size={16} /> Issue New Asset
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {assignments.map((asgn) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={asgn.id} 
            className="glass-card p-6 rounded-[2rem] border border-gray-100 dark:border-white/10 bg-white/90 dark:bg-dark-surface backdrop-blur-md shadow-xl hover:shadow-2xl transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-purple/10 flex items-center justify-center text-brand-purple">
                <Box size={20} />
              </div>
              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 text-[10px] font-black uppercase rounded-md">Issued</span>
            </div>
            
            <h3 className="font-bold text-lg mb-1">{asgn.security_assets?.name}</h3>
            <p className="text-xs text-gray-500 mb-4 font-mono">{asgn.security_assets?.serial_number}</p>
            
            <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-2 text-sm">
                <User size={14} className="text-gray-400" />
                <span className="text-gray-600 dark:text-gray-300">Assigned to: <strong>{asgn.employee?.full_name}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-gray-400">
                <Shield size={12} />
                <span>Issued by: {asgn.issuer?.full_name || 'System Admin'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar size={14} className="text-gray-400" />
                <span className="text-gray-600 dark:text-gray-300">Date: {new Date(asgn.assigned_at).toLocaleDateString()}</span>
              </div>
              {asgn.consent_doc_url && (
                <div 
                  className="flex items-center gap-2 text-sm text-brand-purple hover:underline cursor-pointer" 
                  onClick={() => window.open(asgn.consent_doc_url, '_blank')}
                  title="Open the signed digital consent and acceptance document"
                >
                  <FileText size={14} />
                  <span>View Consent Document</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-sm">
                  <Shield size={14} className="text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-300">Condition: {asgn.condition_on_assign}</span>
                </div>
                <button 
                  onClick={() => handleReturn(asgn.id, asgn.asset_id)}
                  className="px-3 py-1.5 bg-brand-purple/10 text-brand-purple hover:bg-brand-purple/20 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 rounded-lg text-xs font-bold transition-colors uppercase tracking-widest"
                >
                  Return Asset
                </button>
              </div>
            </div>
          </motion.div>
        ))}
        {assignments.length === 0 && !loading && (
          <div className="col-span-full py-20 text-center bg-gray-50/50 dark:bg-white/2 rounded-3xl border-2 border-dashed border-gray-200 dark:border-white/5">
            <Package size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-400">No active assignments</h3>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-3xl p-8 w-full max-w-lg shadow-2xl">
              <h2 className="text-2xl font-bold mb-6">Issue Asset to Guard</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Select Guard</label>
                  <select 
                    required 
                    title="Select the security guard for asset assignment"
                    className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none" 
                    value={formData.employee_id} 
                    onChange={(e) => setFormData({...formData, employee_id: e.target.value})}
                  >
                    <option value="">Choose Employee...</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Select Asset (Digital Register)</label>
                  <select 
                    required 
                    title="Select the specific asset from the digital register"
                    className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none" 
                    value={formData.asset_id} 
                    onChange={(e) => setFormData({...formData, asset_id: e.target.value})}
                  >
                    <option value="">Choose Asset...</option>
                    {assets.map(a => <option key={a.id} value={a.id}>{a.name} - {a.serial_number}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase">Condition</label>
                    <select 
                      title="State the current visible condition of the asset"
                      className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none" 
                      value={formData.condition_on_assign} 
                      onChange={(e) => setFormData({...formData, condition_on_assign: e.target.value})}
                    >
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                      <option value="Poor">Poor</option>
                      <option value="Brand New">Brand New</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Consent Document (Optional)</label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                       <input                         type="file" 
                         id="consent-upload"
                         className="hidden" 
                         disabled={uploading}
                         onChange={handleFileChange}
                      />
                      <label 
                        htmlFor="consent-upload"
                        className={`flex items-center justify-between bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm transition-all ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-brand-purple'}`}
                      >
                        <span className="text-gray-400 truncate">
                          {uploading ? 'Uploading to secure server...' : selectedFile ? selectedFile.name : 'Upload signed consent form...'}
                        </span>
                        <Upload size={16} className={uploading ? 'animate-bounce text-gray-400' : 'text-brand-purple'} />
                      </label>
                    </div>
                     {selectedFile && (
                      <button 
                        type="button" 
                        disabled={uploading}
                        onClick={() => {
                          setSelectedFile(null);
                          setFormData(prev => ({ ...prev, consent_doc_url: '' }));
                        }}
                        title="Remove selected document"
                        className="px-3 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50"
                      >
                        <Trash2 size={16}/>
                      </button>
                    )}
                  </div>
                </div>

                <label className="flex items-center gap-3 p-4 bg-brand-purple/5 border border-brand-purple/10 rounded-xl cursor-pointer hover:bg-brand-purple/10 transition-colors">
                  <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-brand-purple focus:ring-brand-purple" checked={formData.is_accepted} onChange={(e) => setFormData({...formData, is_accepted: e.target.checked})} />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300 italic">I confirm the guard has inspected and accepted this asset in the stated condition.</span>
                </label>

                <div className="flex justify-end gap-3 pt-6">
                  <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-all">Cancel</button>
                   <button type="submit" disabled={loading || uploading} className="px-6 py-2 bg-brand-purple text-white text-sm font-bold rounded-xl hover:bg-opacity-90 transition shadow-lg shadow-brand-purple/20 disabled:opacity-50 min-w-[120px]">
                    {loading ? 'Processing...' : 'Issue Asset'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AssetAssignment;
