// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { 
  AlertTriangle, 
  MapPin, 
  User, 
  ShieldAlert, 
  CheckCircle, 
  Navigation,
  Volume2,
  VolumeX,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { NotificationService } from '../../services/NotificationService';

const SOSAlertSystem: React.FC = () => {
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    fetchActiveAlerts();
    
    // Subscribe to real-time SOS alerts
    const subscription = supabase
      .channel('public:security_sos_alerts')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'security_sos_alerts' 
      }, payload => {
        handleNewAlert(payload.new);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'security_sos_alerts',
        filter: 'status=eq.resolved'
      }, payload => {
        setActiveAlerts(prev => prev.filter(a => a.id !== payload.new.id));
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchActiveAlerts = async () => {
    const { data } = await supabase
      .from('security_sos_alerts')
      .select('*, security_sites(name), profiles(full_name)')
      .eq('status', 'active');
    if (data) setActiveAlerts(data);
  };

  const handleNewAlert = (alert: any) => {
    setActiveAlerts(prev => [alert, ...prev]);
    if (!isMuted) {
      NotificationService.playNotificationSound('error');
    }
  };

  const acknowledgeAlert = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('security_sos_alerts')
      .update({ 
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: user?.id
      })
      .eq('id', id);
    
    fetchActiveAlerts();
  };

  const resolveAlert = async (id: string) => {
    await supabase.from('security_sos_alerts')
      .update({ status: 'resolved' })
      .eq('id', id);
    
    fetchActiveAlerts();
  };

  if (activeAlerts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[60] w-full max-w-sm space-y-4 pointer-events-none">
      <AnimatePresence>
        {activeAlerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="pointer-events-auto bg-rose-600 text-white p-6 rounded-3xl shadow-2xl border-4 border-white/20 relative overflow-hidden ring-4 ring-rose-500/30"
          >
            {/* Pulsing Background */}
            <div className="absolute inset-0 bg-white/10 animate-pulse pointer-events-none" />
            
            <div className="relative flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div className="bg-white/20 p-2 rounded-xl">
                  <ShieldAlert size={32} className="text-white animate-bounce" />
                </div>
                <button 
                  onClick={() => setIsMuted(!isMuted)} 
                  title={isMuted ? "Unmute alert sounds" : "Mute alert sounds"}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  {isMuted ? <VolumeX size={20}/> : <Volume2 size={20}/>}
                </button>
              </div>

              <div>
                <h3 className="text-2xl font-black uppercase tracking-tighter leading-none mb-1 italic">SOS EMERGENCY</h3>
                <p className="text-rose-100 text-sm font-medium flex items-center gap-2">
                  <User size={14}/> {alert.profiles?.full_name || 'Guardian Alert'}
                </p>
                <p className="text-rose-100 text-sm font-medium flex items-center gap-2 mt-1">
                  <MapPin size={14}/> {alert.security_sites?.name || 'Mobile Location'}
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button 
                  onClick={() => acknowledgeAlert(alert.id)}
                  title="Acknowledge this emergency alert"
                  className="w-full py-3 bg-white text-rose-600 font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-rose-50 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                   <CheckCircle size={16}/> Acknowledge
                </button>
                <button 
                  onClick={() => window.open(`https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`, '_blank')}
                  title="View emergency location on Google Maps"
                  className="w-full py-3 bg-black/20 text-white border border-white/30 font-black rounded-2xl text-xs uppercase tracking-widest hover:bg-black/30 transition-all flex items-center justify-center gap-2"
                >
                   <Navigation size={16}/> View Location
                </button>
              </div>

              <div className="flex items-center gap-2 text-[10px] font-bold text-rose-200 uppercase tracking-widest mt-2">
                <Clock size={12}/> Triggered {new Date(alert.created_at).toLocaleTimeString()}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default SOSAlertSystem;
