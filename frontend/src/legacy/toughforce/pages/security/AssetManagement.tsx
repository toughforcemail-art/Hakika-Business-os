// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  User, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Radio,
  Zap,
  Shield,
  LayoutGrid,
  List,
  MoreVertical,
  ArrowRightLeft,
  Wand2,
  Printer,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomToast, { sanitizeError } from '../../components/CustomToast';
import { NotificationService } from '../../services/NotificationService';
import AddableSelect from '../../components/AddableSelect';
import { printWorkspacePage } from '../../utils/printHelpers';
import { activityLogger } from '../../utils/activityLogger';

const AssetManagement: React.FC = () => {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');
  const [loading, setLoading] = useState(true);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('security_assets')
        .select('*, security_asset_assignments(employee_id, employee:profiles!employee_id(full_name))')
        .order('created_at', { ascending: false });
      if (data) setAssets(data);
    } catch (error) {
      console.error("Fetch error:", error);
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'available': return 'bg-emerald-500/10 text-emerald-500';
      case 'assigned': return 'bg-blue-500/10 text-blue-500';
      case 'damaged': return 'bg-rose-500/10 text-rose-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  };

  const handleDeleteAsset = async (asset: any) => {
    const confirmed = window.confirm(
      `Delete ${asset.name || 'this asset'}? This permanently removes the inventory record.`
    );
    if (!confirmed) return;

    setDeletingAssetId(asset.id);
    try {
      const { error } = await supabase.rpc('archive_record', { p_table_name: 'security_assets', p_record_id: asset.id, p_reason: 'delete' });
      if (error) throw error;
      void activityLogger.logDataAction('delete', 'security_assets', asset.id, asset.name || 'Asset');

      setToast({ message: `${asset.name || 'Asset'} deleted successfully.`, type: 'success' });
      await fetchAssets();
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setDeletingAssetId(null);
    }
  };

  return (
    <div className="min-h-full w-full p-6 lg:p-10 space-y-8 bg-white dark:bg-dark-bg text-gray-900 dark:text-white">
      <CustomToast 
        isVisible={!!toast} 
        message={toast?.message || ''} 
        type={toast?.type as any} 
        onClose={() => setToast(null)} 
      />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-200 dark:border-dark-border pb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Package className="text-brand-purple" /> Asset & Gear Inventory
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-text">
            Track and manage hardware, radios, and uniforms issued to security personnel.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl mr-2">
            <button 
              onClick={() => setViewMode('list')}
              className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 ${viewMode === 'list' ? 'bg-white dark:bg-dark-surface shadow-sm text-brand-purple' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <List size={14} /> List
            </button>
            <button 
              onClick={() => setViewMode('cards')}
              className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 ${viewMode === 'cards' ? 'bg-white dark:bg-dark-surface shadow-sm text-brand-purple' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <LayoutGrid size={14} /> Cards
            </button>
          </div>
          <button onClick={() => printWorkspacePage()} className="px-4 py-2 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition flex items-center gap-2" title="Print inventory">
            <Printer size={16} /> Print
          </button>
          <button onClick={() => navigate('/app/security/assets/new')} className="px-4 py-2 bg-brand-purple text-white text-sm font-medium rounded-xl hover:bg-opacity-90 transition flex items-center gap-2 shadow-lg shadow-brand-purple/20" title="Add new asset">
            <Plus size={16} /> Add Asset
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-dark-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 dark:bg-white/5 dark:text-gray-400">
                <tr>
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Asset</th>
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Type</th>
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Serial Number</th>
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Status</th>
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Condition</th>
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px]">Assignment</th>
                  <th className="px-6 py-4 font-black uppercase tracking-widest text-[10px] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-gray-50/80 dark:hover:bg-white/[0.03]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-purple/10 text-brand-purple overflow-hidden">
                          {asset.image_url ? (
                            <img src={asset.image_url} alt={asset.name} className="h-full w-full object-cover" />
                          ) : asset.type === 'Radio' ? (
                            <Radio size={18} />
                          ) : asset.type === 'Torch' ? (
                            <Zap size={18} />
                          ) : (
                            <Shield size={18} />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white">{asset.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Created {new Date(asset.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{asset.type}</td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-600 dark:text-gray-300">{asset.serial_number || 'Not assigned'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${getStatusBadge(asset.status)}`}>
                        {asset.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{asset.condition || 'Not recorded'}</td>
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                      {asset.status === 'assigned' ? asset.security_asset_assignments?.[0]?.employee?.full_name || 'Assigned' : 'Available'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/app/security/assets/${asset.id}/edit`)}
                          className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-700 transition hover:bg-brand-purple hover:text-white dark:bg-white/5 dark:text-gray-200 dark:hover:bg-brand-purple"
                        >
                          <Wand2 size={14} /> Edit
                        </button>
                        {asset.status === 'available' ? (
                          <button
                            onClick={() => navigate(`/app/security/assets/${asset.id}/assign`)}
                            className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-700 transition hover:bg-brand-purple hover:text-white dark:bg-white/5 dark:text-gray-200 dark:hover:bg-brand-purple"
                          >
                            <ArrowRightLeft size={14} /> Assign
                          </button>
                        ) : (
                          <span className="text-xs font-black uppercase tracking-widest text-gray-400">In Use</span>
                        )}
                        <button
                          onClick={() => void handleDeleteAsset(asset)}
                          disabled={deletingAssetId === asset.id}
                          className="inline-flex items-center gap-2 rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-black uppercase tracking-widest text-rose-600 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 size={14} /> {deletingAssetId === asset.id ? 'Deleting' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && assets.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                      No assets found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Object.entries(
            assets.reduce((acc: any, asset) => {
              if (!acc[asset.name]) acc[asset.name] = { name: asset.name, type: asset.type, items: [] };
              acc[asset.name].items.push(asset);
              return acc;
            }, {})
          ).map(([name, group]: [string, any]) => {
            const total = group.items.length;
            const available = group.items.filter((i: any) => i.status === 'available').length;
            const assigned = group.items.filter((i: any) => i.status === 'assigned').length;
            const damaged = group.items.filter((i: any) => i.status === 'damaged').length;
            
            return (
              <motion.div 
                key={name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-6 rounded-3xl border border-gray-200 dark:border-white/10 hover:border-brand-purple/40 transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-brand-purple/5 flex items-center justify-center text-brand-purple group-hover:scale-110 transition-transform overflow-hidden">
                    {group.items.find((i:any) => i.image_url)?.image_url ? (
                      <img src={group.items.find((i:any) => i.image_url).image_url} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      group.type === 'Radio' ? <Radio size={24}/> : group.type === 'Torch' ? <Zap size={24}/> : <Package size={24}/>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest">In Stock</p>
                    <p className="text-2xl font-bold text-brand-purple">{available}</p>
                  </div>
                </div>

                <h3 className="font-bold text-lg mb-1">{name}</h3>
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-4">{group.type}</p>

                <div className="space-y-2 py-4 border-t border-gray-100 dark:border-white/5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">Total Units</span>
                    <span className="font-bold">{total}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400">Deployed</span>
                    <span className="font-bold text-blue-500">{assigned}</span>
                  </div>
                  {damaged > 0 && (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400">Maintenance Required</span>
                      <span className="font-bold text-rose-500">{damaged}</span>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex gap-2">
                  <button 
                    onClick={() => setViewMode('cards')}
                    className="flex-1 py-2.5 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-all rounded-xl text-[10px] font-black uppercase tracking-widest"
                  >
                    View Units
                  </button>
                  <button
                    onClick={() => navigate(`/app/security/assets/${group.items[0].id}/edit`)}
                    className="p-2.5 bg-gray-50 dark:bg-white/5 hover:bg-brand-purple hover:text-white transition-all rounded-xl"
                    title="Edit the first unit in this asset group"
                  >
                    <Wand2 size={16}/>
                  </button>
                  <button 
                    onClick={() => navigate('/app/security/assets/new', { state: { modelName: name } })}
                    className="p-2.5 bg-brand-purple/10 text-brand-purple hover:bg-brand-purple hover:text-white transition-all rounded-xl"
                    title="Add new unit of this model"
                  >
                    <Plus size={16}/>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AssetManagement;
