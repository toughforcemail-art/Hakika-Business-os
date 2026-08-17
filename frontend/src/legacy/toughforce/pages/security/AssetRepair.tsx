// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { 
  Wrench, 
  Search, 
  Package, 
  Calendar, 
  Clock, 
  FileText, 
  CheckCircle2,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomToast, { sanitizeError } from '../../components/CustomToast';
import { NotificationService } from '../../services/NotificationService';

const AssetRepair: React.FC = () => {
  const [assets, setAssets] = useState<any[]>([]);
  const [repairLogs, setRepairLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [formData, setFormData] = useState({
    issue_description: '',
    repair_cost: 0,
    technician_notes: '',
    status: 'repairing' // defaulting to repairing when logged
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch assets that are not disposed
      const { data: aData } = await supabase
        .from('security_assets')
        .select('*')
        .neq('status', 'disposed')
        .order('name');
      if (aData) setAssets(aData);

      // Fetch repair/service history
      const { data: lData } = await supabase
        .from('security_asset_logs')
        .select('*, security_assets(name, serial_number)')
        .eq('activity_type', 'Repair')
        .order('created_at', { ascending: false });
      if (lData) setRepairLogs(lData);
    } catch (error) {
      console.error("Fetch error:", error);
    }
    setLoading(false);
  };

  const handleRepairLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Update asset status
      const { error: assetError } = await supabase
        .from('security_assets')
        .update({ status: formData.status })
        .eq('id', selectedAssetId);
      if (assetError) throw assetError;

      // 2. Log the activity
      const { error: logError } = await supabase
        .from('security_asset_logs')
        .insert([{
          asset_id: selectedAssetId,
          activity_type: 'Repair',
          details: `Issue: ${formData.issue_description}. Tech Notes: ${formData.technician_notes}`,
          cost: formData.repair_cost,
          performed_by: user?.id,
          damage_cost: formData.repair_cost // Map to both for redundancy
        }]);
      if (logError) throw logError;

      setToast({ message: 'Repair/Service activity logged successfully', type: 'success' });
      
      if (user) {
        NotificationService.sendNotification(
          user.id,
          'Equipment Service Logged',
          `Repair activity for asset has been recorded. Current status: ${formData.status}.`,
          'info'
        );
      }

      await fetchData();
      setShowModal(false);
      setSelectedAssetId('');
      setFormData({ issue_description: '', repair_cost: 0, technician_notes: '', status: 'repairing' });
    } catch (error) {
      console.error("Repair log error:", error);
      setToast({ message: sanitizeError(error), type: 'error' });
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'repairing': return 'bg-amber-500/10 text-amber-500';
      case 'available': return 'bg-emerald-500/10 text-emerald-500';
      case 'damaged': return 'bg-rose-500/10 text-rose-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
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
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2 text-amber-500">
            <Wrench /> Equipment Repair & Service
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-text">
            Track maintenance history, repair costs, and equipment serviceability status.
          </p>
        </div>
        <button 
          onClick={() => setShowModal(true)} 
          title="Log a new equipment service or repair activity"
          className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-xl hover:bg-amber-600 transition flex items-center gap-2 shadow-lg shadow-amber-500/20"
        >
          <Plus size={16} /> Log Service/Repair
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 italic">
            <Clock className="text-brand-purple" size={20}/> Maintenance History Log
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/5 text-gray-400 font-black uppercase text-[10px] tracking-widest">
                  <th className="py-4 px-4">Asset Name</th>
                  <th className="py-4 px-4">Serial Number</th>
                  <th className="py-4 px-4">Maintenance Details</th>
                  <th className="py-4 px-4">Cost</th>
                  <th className="py-4 px-4">Date</th>
                  <th className="py-4 px-4 text-right">Activity</th>
                </tr>
              </thead>
              <tbody>
                {repairLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-50 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/2 transition-colors">
                    <td className="py-4 px-4 font-bold">{log.security_assets?.name}</td>
                    <td className="py-4 px-4 font-mono text-xs opacity-60">{log.security_assets?.serial_number}</td>
                    <td className="py-4 px-4 max-w-xs truncate opacity-70 italic">{log.details}</td>
                    <td className="py-4 px-4 font-bold text-emerald-600">KES {log.cost?.toLocaleString()}</td>
                    <td className="py-4 px-4 text-xs">{new Date(log.created_at).toLocaleDateString()}</td>
                    <td className="py-4 px-4 text-right">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500">
                        SERVICE
                      </span>
                    </td>
                  </tr>
                ))}
                {repairLogs.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-gray-400 italic">No maintenance history found.</td>
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
              <h2 className="text-2xl font-bold mb-6 italic tracking-tight uppercase text-amber-500">Log Equipment Service</h2>
              <form onSubmit={handleRepairLog} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Select Equipment</label>
                  <select 
                    required 
                    title="Select the piece of equipment to log service for"
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Repair Cost (KES)</label>
                    <input 
                      type="number"
                      required 
                      title="Total repair cost in KES"
                      className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm"
                      value={formData.repair_cost}
                      onChange={(e) => setFormData({...formData, repair_cost: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">New Status</label>
                    <select 
                      required 
                      title="Update the operational status of the equipment"
                      className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm"
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                    >
                      <option value="repairing">Still Repairing</option>
                      <option value="available">Returned (Good Condition)</option>
                      <option value="damaged">Damaged (Needs further attention)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Issue Description</label>
                  <input 
                    required 
                    placeholder="e.g. Screen cracked, Battery replacement"
                    title="Brief summary of the issue or service needed"
                    className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm"
                    value={formData.issue_description}
                    onChange={(e) => setFormData({...formData, issue_description: e.target.value})}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Technician Notes</label>
                  <textarea 
                    rows={3}
                    title="Detailed notes from the technician or service center"
                    className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm"
                    placeholder="Details from the technician or service center..."
                    value={formData.technician_notes}
                    onChange={(e) => setFormData({...formData, technician_notes: e.target.value})}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-6">
                  <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all">Cancel</button>
                  <button type="submit" disabled={loading} className="px-6 py-2 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 transition shadow-lg shadow-amber-500/20">
                    {loading ? 'Logging...' : 'Record Activity'}
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

export default AssetRepair;
