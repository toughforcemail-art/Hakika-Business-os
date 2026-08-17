// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { 
  Activity, 
  Search, 
  Filter, 
  Shield, 
  Clock, 
  AlertTriangle, 
  CheckCircle2,
  User,
  ExternalLink,
  Package,
  Wrench,
  ArrowRightLeft
} from 'lucide-react';
import { motion } from 'framer-motion';
import CustomLoader from '../../components/CustomLoader';

const SecurityActivityLog: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('security_asset_logs')
        .select('*, security_assets(name, serial_number), profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setLogs(data);
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
    setLoading(false);
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'Disposal': return <Activity size={16} className="text-rose-500"/>;
      case 'Repair': return <Wrench size={16} className="text-amber-500"/>;
      case 'Transfer': return <ArrowRightLeft size={16} className="text-brand-purple"/>;
      default: return <Clock size={16} className="text-gray-400"/>;
    }
  };

  if (loading) return <div className="h-full flex items-center justify-center"><CustomLoader size={40} label="Loading activity stream..." /></div>;

  return (
    <div className="min-h-full w-full p-6 lg:p-10 space-y-8 bg-white dark:bg-dark-bg text-gray-900 dark:text-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-200 dark:border-dark-border pb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Activity className="text-brand-purple" /> Security Operations Log
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-text">
            Audit trail for all tactical, gear, and personnel movements.
          </p>
        </div>
      </div>

      <div className="glass-card overflow-hidden rounded-3xl border border-gray-100 dark:border-white/5">
        <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/2 flex justify-between items-center">
           <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Activity Stream</h2>
           <div className="flex gap-2">
              <button onClick={() => fetchLogs()} title="Refresh activity stream" className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400"><Clock size={16}/></button>
           </div>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-white/5">
           {logs.map((log) => (
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               key={log.id} 
               className="p-4 hover:bg-gray-50 dark:hover:bg-white/2 transition-all flex gap-4"
             >
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center shrink-0">
                   {getIcon(log.activity_type)}
                </div>
                <div className="flex-1 space-y-1">
                   <div className="flex justify-between items-start">
                      <h4 className="text-sm font-bold text-gray-800 dark:text-white">
                         {log.activity_type} - {log.security_assets?.name}
                      </h4>
                      <span className="text-[10px] text-gray-400 font-medium">
                         {new Date(log.created_at).toLocaleString()}
                      </span>
                   </div>
                   <p className="text-xs text-gray-500 italic max-w-2xl">{log.details}</p>
                   <div className="flex items-center gap-3 pt-2">
                      <span className="flex items-center gap-1 text-[10px] text-gray-400">
                         <User size={12}/> {log.profiles?.full_name || 'System Admin'}
                      </span>
                      {log.cost > 0 && (
                        <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                           KES {log.cost.toLocaleString()}
                        </span>
                      )}
                   </div>
                </div>
             </motion.div>
           ))}
           {logs.length === 0 && (
             <div className="py-20 text-center text-gray-400 italic">No activity recorded yet.</div>
           )}
        </div>
      </div>
    </div>
  );
};

export default SecurityActivityLog;
