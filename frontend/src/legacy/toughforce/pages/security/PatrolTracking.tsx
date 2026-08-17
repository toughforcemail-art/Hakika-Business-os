// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { 
  Map as MapIcon, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  QrCode, 
  Smartphone,
  ChevronRight,
  Shield,
  Activity,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PatrolTracking: React.FC = () => {
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [patrolLogs, setPatrolLogs] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCheckpoint, setShowAddCheckpoint] = useState(false);
  const [newCheckpoint, setNewCheckpoint] = useState({
    site_id: '',
    name: '',
    location_description: '',
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: sData } = await supabase.from('security_sites').select('id, name');
      if (sData) setSites(sData);
      await fetchCheckpoints();
      await fetchLogs();
    } catch (error) {
      console.error("Fetch error:", error);
    }
    setLoading(false);
  };

  const fetchCheckpoints = async () => {
    const { data } = await supabase
      .from('security_patrol_checkpoints')
      .select('*, security_sites(name)');
    if (data) setCheckpoints(data);
  };

  const fetchLogs = async () => {
    const { data } = await supabase
      .from('security_patrol_logs')
      .select('*, security_patrol_checkpoints(name, security_sites(name)), profiles(full_name)')
      .order('scanned_at', { ascending: false })
      .limit(20);
    if (data) setPatrolLogs(data);
  };

  const handleAddCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('security_patrol_checkpoints').insert([newCheckpoint]);
      if (error) throw error;
      await fetchCheckpoints();
      setShowAddCheckpoint(false);
      setNewCheckpoint({ site_id: '', name: '', location_description: '' });
    } catch (error) {
      console.error("Add error:", error);
      alert("Error adding checkpoint");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-full w-full p-6 lg:p-10 space-y-8 bg-white dark:bg-dark-bg text-gray-900 dark:text-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-200 dark:border-dark-border pb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <MapIcon className="text-brand-purple" /> Real-Time Patrol Tracking
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-text">
            Monitor guard rounds, checkpoint hits, and patrol completion across all sites.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowAddCheckpoint(true)} 
            title="Open form to add a new patrol checkpoint"
            className="px-4 py-2 bg-brand-purple text-white text-sm font-medium rounded-xl hover:bg-opacity-90 transition flex items-center gap-2 shadow-lg shadow-brand-purple/20"
          >
            <Plus size={16} /> Add Checkpoint
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Checkpoints List */}
        <div className="xl:col-span-1 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <MapPin size={20} className="text-brand-purple" /> Active Checkpoints
            </h2>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{checkpoints.length} Registered</span>
          </div>
          
          <div className="space-y-4">
            {checkpoints.map(cp => (
              <div key={cp.id} className="glass-card p-4 rounded-2xl border border-gray-100 dark:border-white/5 hover:border-brand-purple/30 transition-all group">
                <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-brand-purple transition-all">
                       <QrCode size={20}/>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">{cp.name}</h4>
                      <p className="text-[10px] text-gray-400 uppercase font-black">{cp.security_sites?.name}</p>
                      <p className="text-xs text-gray-500 mt-1 italic">"{cp.location_description}"</p>
                    </div>
                  </div>
                  <button 
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-all"
                    title="View QR or mobile scanning details for this checkpoint"
                    aria-label="Scan details"
                  >
                    <Smartphone size={16} className="text-gray-300"/>
                  </button>
                </div>
              </div>
            ))}
            {checkpoints.length === 0 && (
              <div className="py-12 text-center bg-gray-50 dark:bg-white/2 rounded-2xl border-2 border-dashed border-gray-100 dark:border-white/5">
                <p className="text-sm text-gray-400 italic">No checkpoints defined.</p>
              </div>
            )}
          </div>
        </div>

        {/* Live Patrol Log */}
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Activity size={20} className="text-emerald-500" /> Live Patrol Feed
            </h2>
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
               <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"/>
               <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Live Updates</span>
            </div>
          </div>

          <div className="glass-card rounded-3xl border border-gray-200 dark:border-white/10 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <th className="p-4 text-xs font-black uppercase tracking-widest text-gray-400">Checkpoint</th>
                  <th className="p-4 text-xs font-black uppercase tracking-widest text-gray-400">Security Officer</th>
                  <th className="p-4 text-xs font-black uppercase tracking-widest text-gray-400 text-center">Time</th>
                  <th className="p-4 text-xs font-black uppercase tracking-widest text-gray-400 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {patrolLogs.map((log, idx) => (
                  <tr key={log.id} className={`border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/2 transition-colors ${idx === 0 ? 'bg-emerald-500/5' : ''}`}>
                    <td className="p-4">
                      <div className="font-bold text-sm">{log.security_patrol_checkpoints?.name}</div>
                      <div className="text-[10px] text-gray-400 uppercase">{log.security_patrol_checkpoints?.security_sites?.name}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-brand-purple/10 text-brand-purple flex items-center justify-center text-[10px] font-bold">
                           {log.profiles?.full_name?.substring(0,2).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium">{log.profiles?.full_name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                       <span className="text-xs font-mono text-gray-500">{new Date(log.scanned_at).toLocaleTimeString()}</span>
                    </td>
                    <td className="p-4 text-right">
                       <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${log.status === 'on-time' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                          {log.status}
                       </span>
                    </td>
                  </tr>
                ))}
                {patrolLogs.length === 0 && (
                   <tr>
                     <td colSpan={4} className="p-20 text-center">
                        <Clock size={48} className="mx-auto text-gray-200 mb-4"/>
                        <p className="text-sm text-gray-400 font-medium italic">Waiting for incoming patrol data...</p>
                     </td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Checkpoint Modal */}
      <AnimatePresence>
        {showAddCheckpoint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <h2 className="text-2xl font-bold mb-6 font-display">Add Patrol Checkpoint</h2>
              <form onSubmit={handleAddCheckpoint} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Assigned Site</label>
                  <select 
                    required
                    title="Target Operating Site"
                    className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none transition-all"
                    value={newCheckpoint.site_id}
                    onChange={(e) => setNewCheckpoint({...newCheckpoint, site_id: e.target.value})}
                  >
                    <option value="">Select Site</option>
                    {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Checkpoint Name</label>
                  <input 
                    required 
                    placeholder="e.g. North Gate Entry"
                    title="Checkpoint Identification Name"
                    className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none transition-all" 
                    value={newCheckpoint.name} 
                    onChange={(e) => setNewCheckpoint({...newCheckpoint, name: e.target.value})} 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Placement Description</label>
                  <input 
                    required 
                    placeholder="e.g. On the main pillar near shipping dock"
                    title="Placement Description / Instructions"
                    className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none transition-all" 
                    value={newCheckpoint.location_description} 
                    onChange={(e) => setNewCheckpoint({...newCheckpoint, location_description: e.target.value})} 
                  />
                </div>

                <div className="flex justify-end gap-3 pt-6">
                  <button 
                    type="button" 
                    onClick={() => setShowAddCheckpoint(false)} 
                    title="Cancel and close form"
                    className="px-6 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    title="Register new checkpoint"
                    className="px-6 py-2 bg-emerald-500 text-white text-sm font-bold rounded-xl hover:bg-opacity-90 transition shadow-lg shadow-emerald-500/20"
                  >
                    Create Point
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

export default PatrolTracking;
