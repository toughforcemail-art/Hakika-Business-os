// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { 
  Trash2, 
  Search, 
  Package, 
  Calendar, 
  AlertTriangle, 
  FileText, 
  CheckCircle2,
  MoreVertical,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomToast, { sanitizeError } from '../../components/CustomToast';
import { NotificationService } from '../../services/NotificationService';

const AssetDisposal: React.FC = () => {
  const [assets, setAssets] = useState<any[]>([]);
  const [disposedLogs, setDisposedLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [formData, setFormData] = useState({
    reason: '',
    disposal_date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch assets that are available or damaged (not already disposed)
      const { data: aData } = await supabase
        .from('security_assets')
        .select('*')
        .neq('status', 'disposed')
        .order('name');
      if (aData) setAssets(aData);

      // Fetch disposal history
      const { data: lData } = await supabase
        .from('security_asset_logs')
        .select('*, security_assets(name, serial_number)')
        .eq('activity_type', 'Disposal')
        .order('created_at', { ascending: false });
      if (lData) setDisposedLogs(lData);
    } catch (error) {
      console.error("Fetch error:", error);
    }
    setLoading(false);
  };

  const handleDisposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Update asset status
      const { error: assetError } = await supabase
        .from('security_assets')
        .update({ status: 'disposed' })
        .eq('id', selectedAssetId);
      if (assetError) throw assetError;

      // 2. Log the activity
      const { error: logError } = await supabase
        .from('security_asset_logs')
        .insert([{
          asset_id: selectedAssetId,
          activity_type: 'Disposal',
          details: `Reason: ${formData.reason}. Notes: ${formData.notes}`,
          performed_by: user?.id
        }]);
      if (logError) throw logError;

      setToast({ message: 'Asset marked as disposed successfully', type: 'success' });
      
      if (user) {
        NotificationService.sendNotification(
          user.id,
          'Asset Disposed',
          `Asset has been permanently removed from inventory.`,
          'warning'
        );
      }

      await fetchData();
      setShowModal(false);
      setSelectedAssetId('');
      setFormData({ reason: '', disposal_date: new Date().toISOString().split('T')[0], notes: '' });
    } catch (error) {
      console.error("Disposal error:", error);
      setToast({ message: sanitizeError(error), type: 'error' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-full w-full p-6 lg:p-10 space-y-8 bg-white dark:bg-dark-bg text-gray-900 dark:text-white">
      <CustomToast 
        isVisible={!!toast} 
        message={toast?.message || ''} 
        type={toast?.type} 
        onClose={() => setToast(null)} 
      />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-200 dark:border-dark-border pb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2 text-rose-500">
            <Trash2 /> Asset Disposal Registry
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-text">
            Permanently retire and track equipment removal from active inventory.
          </p>
        </div>
        <button 
          onClick={() => setShowModal(true)} 
          title="Submit a request to permanently retire an asset"
          className="px-4 py-2 bg-rose-500 text-white text-sm font-medium rounded-xl hover:bg-rose-600 transition flex items-center gap-2 shadow-lg shadow-rose-500/20"
        >
          <Trash2 size={16} /> Dispose Asset
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 italic">
            <AlertTriangle className="text-amber-500" size={20}/> Active Disposal Log
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/5 text-gray-400 font-black uppercase text-[10px] tracking-widest">
                  <th className="py-4 px-4">Asset Name</th>
                  <th className="py-4 px-4">Serial Number</th>
                  <th className="py-4 px-4">Reason / Details</th>
                  <th className="py-4 px-4">Disposed On</th>
                  <th className="py-4 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {disposedLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/2 transition-colors">
                    <td className="py-4 px-4 font-bold">{log.security_assets?.name}</td>
                    <td className="py-4 px-4 font-mono text-xs opacity-60">{log.security_assets?.serial_number}</td>
                    <td className="py-4 px-4 max-w-xs truncate opacity-70 italic">{log.details}</td>
                    <td className="py-4 px-4 text-xs">{new Date(log.created_at).toLocaleDateString()}</td>
                    <td className="py-4 px-4 text-right">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-500">
                        RETIRED
                      </span>
                    </td>
                  </tr>
                ))}
                {disposedLogs.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-gray-400 italic">No asset disposal records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <h2 className="text-2xl font-bold mb-6 italic tracking-tight uppercase text-rose-500">Authorize Disposal</h2>
              <form onSubmit={handleDisposal} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Select Asset to Retire</label>
                  <select 
                    required 
                    title="Select the specific asset to be permanently retired"
                    className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm"
                    value={selectedAssetId}
                    onChange={(e) => setSelectedAssetId(e.target.value)}
                  >
                    <option value="">-- Choose Equipment --</option>
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.serial_number}) - {a.status}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Reason for Disposal</label>
                  <select 
                    required 
                    title="State the primary reason for retiring this asset"
                    className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm"
                    value={formData.reason}
                    onChange={(e) => setFormData({...formData, reason: e.target.value})}
                  >
                    <option value="">-- Select Reason --</option>
                    <option value="Damaged beyond repair">Damaged beyond repair</option>
                    <option value="End of life reached">End of life reached</option>
                    <option value="Lost / Missing">Lost / Missing</option>
                    <option value="Upgraded / Replaced">Upgraded / Replaced</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Additional Notes</label>
                  <textarea 
                    rows={3}
                    title="Any final comments or disposal method details"
                    className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm"
                    placeholder="Details about the condition or disposal method..."
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  />
                </div>

                <div className="bg-rose-500/5 p-4 rounded-2xl border border-rose-500/10 flex gap-3">
                  <AlertTriangle className="text-rose-500 shrink-0" size={20}/>
                  <p className="text-[10px] text-rose-500/70 font-medium">
                    Warning: This action is permanent. The asset status will be set to 'Disposed' and it will be removed from active inventory registry.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-6">
                  <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all">Cancel</button>
                  <button type="submit" disabled={loading} className="px-6 py-2 bg-rose-500 text-white text-sm font-bold rounded-xl hover:bg-rose-600 transition shadow-lg shadow-rose-500/20">
                    {loading ? 'Processing...' : 'Confirm Disposal'}
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

export default AssetDisposal;
