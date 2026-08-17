// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { 
  Package, 
  ArrowLeft,
  User,
  ChevronRight,
  Shield,
  ArrowRightLeft
} from 'lucide-react';
import { motion } from 'framer-motion';
import CustomToast, { sanitizeError } from '../../components/CustomToast';
import { NotificationService } from '../../services/NotificationService';

const AssignAsset: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [asset, setAsset] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch asset
      const { data: aData, error: aError } = await supabase
        .from('security_assets')
        .select('*')
        .eq('id', id)
        .single();
      
      if (aError) throw aError;
      setAsset(aData);

      // Fetch all profiles and filter for security personnel
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, role, department, is_security_guard')
        .order('full_name');

      if (profilesData) {
        const securityPersonnel = profilesData.filter(p => 
          p.department?.toLowerCase() === 'security' || 
          p.is_security_guard === true ||
          (p.role || '').toLowerCase().includes('admin') ||
          (p.role || '').toLowerCase().includes('director')
        );
        setEmployees(securityPersonnel);
      }
    } catch (error) {
      console.error("Fetch error:", error);
      setToast({ message: 'Failed to load asset details', type: 'error' });
    }
    setLoading(false);
  };

  const handleAssign = async (employeeId: string) => {
    if (!asset) return;
    setSubmitting(true);
    try {
      // 1. Create assignment
      const { error: assignError } = await supabase.from('security_asset_assignments').insert([{
        asset_id: asset.id,
        employee_id: employeeId,
        condition_on_assign: asset.condition
      }]);
      if (assignError) throw assignError;

      // 2. Update asset status
      const { error: assetError } = await supabase.from('security_assets')
        .update({ status: 'assigned' })
        .eq('id', asset.id);
      if (assetError) throw assetError;

      setToast({ message: 'Asset assigned successfully', type: 'success' });
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        NotificationService.sendNotification(
          user.id,
          'Asset Assigned',
          `${asset.name} has been assigned to a guard.`,
          'info'
        );
      }

      setTimeout(() => navigate('/app/security/assets'), 1500);
    } catch (error) {
      console.error("Assign error:", error);
      setToast({ message: sanitizeError(error), type: 'error' });
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-full w-full flex items-center justify-center bg-white dark:bg-dark-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-purple"></div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="min-h-full w-full p-10 bg-white dark:bg-dark-bg text-center">
        <h2 className="text-xl font-bold">Asset not found</h2>
        <button onClick={() => navigate('/app/security/assets')} className="mt-4 text-brand-purple hover:underline">Back to Inventory</button>
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
      
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/app/security/assets')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
            title="Go back to Assets list"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ArrowRightLeft className="text-brand-purple" /> Assign Asset
            </h1>
            <p className="text-sm text-gray-500 dark:text-dark-text">
              Assign <span className="font-bold text-brand-purple uppercase">{asset.name}</span> ({asset.serial_number}) to a personnel
            </p>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-3xl overflow-hidden shadow-xl"
        >
          <div className="p-6 bg-brand-purple/5 border-b border-gray-100 dark:border-white/5">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-purple/10 flex items-center justify-center text-brand-purple shadow-inner">
                   <Shield size={24} />
                </div>
                <div>
                   <h3 className="font-bold">{asset.name}</h3>
                   <p className="text-xs text-gray-400 font-mono">{asset.serial_number}</p>
                </div>
             </div>
          </div>

          <div className="p-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 px-4 pt-2">Available Personnel</h4>
            <div className="space-y-1">
              {employees.map(emp => (
                <button 
                  key={emp.id}
                  disabled={submitting}
                  onClick={() => handleAssign(emp.id)}
                  className="w-full p-4 text-left hover:bg-brand-purple/5 dark:hover:bg-white/5 rounded-2xl transition-all flex justify-between items-center group border border-transparent hover:border-brand-purple/10 disabled:opacity-50"
                >
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-xs font-bold shadow-sm">
                         {emp.full_name?.substring(0,2).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-sm font-bold block">{emp.full_name}</span>
                        <span className="text-[10px] text-gray-400 uppercase tracking-tighter">Security Personnel</span>
                      </div>
                   </div>
                   <ChevronRight size={20} className="text-gray-300 group-hover:text-brand-purple group-hover:translate-x-1 transition-all"/>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
        
        <div className="text-center">
           <p className="text-xs text-gray-400 italic">
              * Assigning this asset will update its status to 'Assigned' and create a digital record of issuance.
           </p>
        </div>
      </div>
    </div>
  );
};

export default AssignAsset;
