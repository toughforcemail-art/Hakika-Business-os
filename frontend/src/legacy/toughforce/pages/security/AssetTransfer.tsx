// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRightLeft, 
  Shield, 
  User, 
  Package,
  History,
  ArrowRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../../utils/supabase';
import CustomToast from '../../components/CustomToast';

const AssetTransfer: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assignedAssets, setAssignedAssets] = useState<any[]>([]);
  const [transferLogs, setTransferLogs] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch currently assigned assets
      const { data: aData } = await supabase
        .from('security_assets')
        .select(`
          *, 
          security_asset_assignments!inner ( 
            id, 
            employee_id,
            employee:profiles!employee_id ( full_name ) 
          )
        `)
        .eq('status', 'assigned')
        .is('security_asset_assignments.returned_at', null)
        .order('name');
      if (aData) setAssignedAssets(aData);

      // 2. Fetch transfer history
      const { data: lData } = await supabase
        .from('security_asset_logs')
        .select('*, security_assets(name, serial_number)')
        .eq('activity_type', 'Transfer')
        .order('created_at', { ascending: false })
        .limit(10);
      if (lData) setTransferLogs(lData);
    } catch (error) {
      console.error("Data fetch error:", error);
    }
    setLoading(false);
  };

  const handleInitiateTransfer = (assetId: string) => {
    navigate(`/app/security/assets/transfer/${assetId}`);
  };

  return (
    <div className="min-h-full w-full p-6 lg:p-10 space-y-8 bg-white dark:bg-dark-bg text-gray-900 dark:text-white font-sans">
      <CustomToast 
        isVisible={!!toast} 
        message={toast?.message || ''} 
        type={toast?.type} 
        onClose={() => setToast(null)} 
      />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-200 dark:border-dark-border pb-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-black italic tracking-tighter text-brand-purple flex items-center gap-3 uppercase">
            <ArrowRightLeft size={36} /> Workforce Asset Transfer
          </h1>
          <p className="text-sm text-gray-500 font-medium">Reassign equipment between personnel and track chain of custody.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Active Assignments */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2 italic">
            <Shield className="text-brand-purple" size={24}/> Assets In Active Field Service
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {assignedAssets.map((asset) => (
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                key={asset.id} 
                className="glass-card p-6 rounded-[2.5rem] border border-gray-100 dark:border-white/10 bg-white/80 dark:bg-dark-surface backdrop-blur-md hover:border-brand-purple/40 hover:shadow-2xl hover:shadow-brand-purple/10 transition-all flex flex-col justify-between group h-full relative overflow-hidden"
              >
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-purple/10 rounded-full z-0 group-hover:scale-150 transition-transform duration-700 opacity-50"></div>
                
                <div className="flex gap-5 items-start relative z-10 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-purple/20 to-brand-purple/5 flex items-center justify-center text-brand-purple shadow-inner group-hover:rotate-6 transition-transform">
                    <Package size={28}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-extrabold text-lg tracking-tight mb-1 group-hover:text-brand-purple transition-colors truncate">{asset.name}</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[9px] uppercase font-black px-2 py-0.5 bg-gray-100 dark:bg-white/10 rounded text-gray-500 dark:text-dark-text-muted font-mono tracking-tighter">SN: {asset.serial_number}</span>
                      {asset.type && <span className="text-[9px] uppercase font-black px-2 py-0.5 bg-brand-purple/10 text-brand-purple rounded tracking-tighter">{asset.type}</span>}
                    </div>
                  </div>
                </div>
                
                <div className="relative z-10 space-y-4 pt-4 border-t border-gray-100 dark:border-white/10 mt-auto">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <User size={14} className="text-brand-purple/60" />
                       <div className="flex flex-col">
                         <span className="text-[8px] font-black text-gray-400 dark:text-dark-text-muted uppercase tracking-widest">Active Holder</span>
                         <span className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-brand-purple transition-colors">{asset.security_asset_assignments?.[0]?.employee?.full_name}</span>
                       </div>
                     </div>
                     <ArrowRight size={16} className="text-gray-300 dark:text-dark-text-muted group-hover:text-brand-purple group-hover:translate-x-1 transition-all" />
                   </div>
                   
                   <button 
                     onClick={() => handleInitiateTransfer(asset.id)}
                     className="w-full py-3.5 bg-brand-purple text-white text-[10px] font-black uppercase tracking-widest rounded-2xl opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 shadow-[0_10px_20px_-5px_rgba(255,106,0,0.3)] flex items-center justify-center gap-2"
                   >
                     Initiate Official Handover <ArrowRightLeft size={14}/>
                   </button>
                </div>
              </motion.div>
            ))}
          </div>
          {assignedAssets.length === 0 && !loading && (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-gray-100 dark:border-white/5 rounded-4xl">
              <Package size={56} className="mx-auto text-gray-200 mb-6"/>
              <p className="text-gray-400 italic font-medium">No assigned assets currently in the field.</p>
            </div>
          )}
        </div>

        {/* Transfer History */}
        <div className="lg:col-span-1">
          <div className="glass-card p-8 rounded-4xl border border-gray-200 dark:border-white/10 sticky top-8">
            <h2 className="text-xl font-bold mb-8 flex items-center gap-2 italic text-gray-500 uppercase tracking-tighter">
              <History size={24}/> Handover History
            </h2>
            <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {transferLogs.map((log) => (
                <div key={log.id} className="p-4 border-l-4 border-brand-purple/30 bg-gray-50/30 dark:bg-white/1 rounded-r-2xl group hover:bg-white dark:hover:bg-white/5 transition-all">
                   <div className="flex justify-between items-start mb-2">
                     <h4 className="text-xs font-black uppercase tracking-tight text-gray-600 dark:text-gray-300 group-hover:text-brand-purple">{log.security_assets?.name}</h4>
                     <span className="text-[9px] font-bold text-gray-400">{new Date(log.created_at).toLocaleDateString()}</span>
                   </div>
                   <p className="text-[10px] text-gray-500 italic leading-relaxed">{log.details}</p>
                   <div className="mt-2 text-[8px] font-black uppercase tracking-widest text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">SN: {log.security_assets?.serial_number}</div>
                </div>
              ))}
              {transferLogs.length === 0 && !loading && (
                <p className="text-center py-10 text-gray-400 italic text-[11px]">No transfer records found.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetTransfer;
