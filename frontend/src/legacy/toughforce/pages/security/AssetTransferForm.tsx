// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ArrowRight, 
  Shield, 
  User, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Package,
  ArrowRightLeft,
  FileText,
  DollarSign,
  PenTool
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../utils/supabase';
import CustomToast, { sanitizeError } from '../../components/CustomToast';
import CustomLoader from '../../components/CustomLoader';
import { NotificationService } from '../../services/NotificationService';
import { AssetNotificationService } from '../../services/AssetNotificationService';

const AssetTransferForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [asset, setAsset] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [authorities, setAuthorities] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [formData, setFormData] = useState({
    to_employee_id: '',
    transfer_date: new Date().toISOString().split('T')[0],
    condition: 'Good',
    is_damaged: false,
    damage_location: '',
    damage_cost: 0,
    responsible_party: 'Company',
    responsible_party_detail: '',
    authorized_by_id: '',
    notes: ''
  });

  useEffect(() => {
    fetchInitialData();
  }, [id]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: aData, error: aError } = await supabase
        .from('security_assets')
        .select(`
          *,
          security_asset_assignments!inner (
            id,
            employee_id,
            employee:profiles!employee_id ( full_name )
          )
        `)
        .eq('id', id)
        .is('security_asset_assignments.returned_at', null)
        .single();

      if (aError) {
        setToast({ message: "Could not find active assignment for this asset.", type: 'error' });
        setTimeout(() => navigate('/app/security/assets/transfer'), 2000);
        return;
      }
      setAsset(aData);

      // 2. Fetch all profiles to filter for recipients and authorities
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, role, department, is_security_guard')
        .order('full_name');

      if (profilesData) {
        // Recipients: Security personnel or guards
        const recipients = profilesData.filter(p => 
          p.department?.toLowerCase() === 'security' || 
          p.is_security_guard === true
        );
        setEmployees(recipients);

        // Authorities: Admins, Directors, Managers
        const admins = profilesData.filter(p => {
          const r = (p.role || '').toLowerCase();
          return r.includes('admin') || 
                 r.includes('director') || 
                 r.includes('manager') || 
                 r.includes('super');
        });
        setAuthorities(admins);
      }

    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentAssignment = asset.security_asset_assignments?.[0];
      const fromEmployeeName = currentAssignment?.employee?.full_name || 'Former Employee';
      const toEmployeeName = employees.find(e => e.id === formData.to_employee_id)?.full_name || 'New Employee';

      // 1. End current assignment
      await supabase.from('security_asset_assignments').update({
          returned_at: new Date(formData.transfer_date).toISOString(),
          condition_on_return: formData.condition
      }).eq('id', currentAssignment.id);

      // 2. Create new assignment
      await supabase.from('security_asset_assignments').insert([{
        asset_id: asset.id,
        employee_id: formData.to_employee_id,
        condition_on_assign: formData.condition,
        assigned_at: new Date(formData.transfer_date).toISOString(),
        assigned_by: user?.id,
        notes: `Transferred from ${fromEmployeeName}. ${formData.notes}`
      }]);

      // 3. Log the transfer
      await supabase.from('security_asset_logs').insert([{
        asset_id: asset.id,
        activity_type: 'Transfer',
        details: `Transferred from ${fromEmployeeName} to ${toEmployeeName}. Condition: ${formData.condition}. Notes: ${formData.notes}`,
        performed_by: user?.id,
        authorized_by: formData.authorized_by_id,
        damage_location: formData.is_damaged ? formData.damage_location : null,
        damage_cost: formData.is_damaged ? formData.damage_cost : 0,
        responsible_party: formData.is_damaged ? formData.responsible_party : null,
        responsible_party_detail: (formData.is_damaged && formData.responsible_party === 'Third Party') ? formData.responsible_party_detail : null,
        transfer_date: formData.transfer_date
      }]);

      setToast({ message: 'Asset handover executed successfully', type: 'success' });
      
      // 4. Automated alerts
      await AssetNotificationService.sendTransferAlert(
        formData.to_employee_id,
        asset.name,
        asset.serial_number,
        fromEmployeeName
      );

      if (user) {
        NotificationService.sendNotification(user.id, 'Asset Transfer Complete', `${asset.name} reassigned to ${toEmployeeName}.`, 'info');
      }

      setTimeout(() => navigate('/app/security/assets/transfer'), 1500);
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-dark-bg"><CustomLoader label="Loading handover data..." /></div>;

  const currentHolder = asset?.security_asset_assignments?.[0]?.employee?.full_name || 'Unknown';

  return (
    <div className="min-h-full w-full p-6 lg:p-10 bg-white dark:bg-dark-bg text-gray-900 dark:text-white font-sans">
      <CustomToast isVisible={!!toast} message={toast?.message || ''} type={toast?.type} onClose={() => setToast(null)} />

      <div className="max-w-5xl mx-auto space-y-12">
        <div className="glass-card p-10 rounded-[3rem] border border-gray-100 dark:border-white/10 bg-white/90 dark:bg-dark-surface backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-brand-purple/5 rounded-full blur-3xl"></div>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 pb-8 border-b border-gray-100 dark:border-white/5 relative z-10">
            <div className="flex items-center gap-5">
              <button 
                onClick={() => navigate('/app/security/assets/transfer')}
                className="p-3.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-2xl transition-all text-gray-400 hover:text-brand-purple"
                title="Return to Transfer list"
              >
                <ArrowLeft size={24} />
              </button>
              <div>
                <h1 className="text-3xl font-black italic tracking-tighter text-gray-900 dark:text-white uppercase leading-none">
                  Gear Handover <span className="text-brand-purple">Report</span>
                </h1>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-2">Official Chain of Custody Transfer</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 px-6 py-3 bg-brand-purple/10 rounded-2xl border border-brand-purple/20">
              <Package className="text-brand-purple" size={20} />
              <div className="flex flex-col">
                <span className="text-[8px] font-black uppercase text-brand-purple/60">Asset ID</span>
                <span className="text-xs font-black text-brand-purple">{asset?.serial_number}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 relative z-10">
            <div className="lg:col-span-1 space-y-6">
              <div className="p-6 rounded-[2rem] bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/5">
                <div className="w-14 h-14 rounded-2xl bg-brand-purple text-white flex items-center justify-center mb-6 shadow-xl shadow-brand-purple/20">
                  <Package size={28}/>
                </div>
                <h3 className="font-black text-xl mb-1 uppercase tracking-tight">{asset?.name}</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">{asset?.type} Unit</p>
                
                <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-white/5">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Current Holder</span>
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-brand-purple" />
                      <span className="text-sm font-bold">{currentHolder}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-amber-500/5 border border-amber-500/10 rounded-[2rem] flex gap-4">
                <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                <p className="text-[10px] text-amber-700/80 dark:text-amber-400/60 font-medium leading-relaxed uppercase tracking-tighter">
                  Verifying the asset's physical condition is mandatory before confirming transfer. All handovers are logged for audit compliance.
                </p>
              </div>
            </div>

            <form onSubmit={handleTransfer} className="lg:col-span-2 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="authorized-by" className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Authorized By</label>
                  <select 
                    id="authorized-by"
                    required 
                    title="Select the authority who authorized this transfer"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-purple outline-none transition-all"
                    value={formData.authorized_by_id}
                    onChange={(e) => setFormData({...formData, authorized_by_id: e.target.value})}
                  >
                    <option value="">-- Select Authority --</option>
                    {authorities.map(auth => (
                      <option key={auth.id} value={auth.id}>
                        {auth.full_name} ({auth.role?.replace('_', ' ').toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="transfer-date" className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Handover Date</label>
                  <input 
                    id="transfer-date"
                    type="date"
                    required 
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-purple outline-none transition-all"
                    value={formData.transfer_date}
                    onChange={(e) => setFormData({...formData, transfer_date: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="new-recipient" className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em] ml-2">New Recipient</label>
                <select 
                  id="new-recipient"
                  required 
                  title="Select the new recipient for this asset"
                  className="w-full bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 text-sm font-black text-emerald-600 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  value={formData.to_employee_id}
                  onChange={(e) => setFormData({...formData, to_employee_id: e.target.value})}
                >
                  <option value="">-- Select New Holder --</option>
                  {employees.filter(e => e.id !== asset?.security_asset_assignments?.[0]?.employee_id).map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="pt-6 border-t border-gray-100 dark:border-white/5 space-y-6">
                <div className="flex justify-between items-center">
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-400">Condition Tracking</h4>
                  <label className="flex items-center gap-3 px-4 py-2 bg-rose-500/5 rounded-xl cursor-pointer hover:bg-rose-500/10 transition-colors">
                    <input type="checkbox" checked={formData.is_damaged} onChange={(e) => setFormData({...formData, is_damaged: e.target.checked})} className="w-4 h-4 rounded border-gray-300 text-rose-500 focus:ring-rose-500" />
                    <span className="text-[9px] font-black uppercase text-rose-600">Report Damage</span>
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Asset Condition</label>
                  <select 
                    required 
                    title="Select current condition of the asset"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-brand-purple outline-none transition-all"
                    value={formData.condition}
                    onChange={(e) => setFormData({...formData, condition: e.target.value})}
                  >
                    <option value="New">New</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Damaged / Needs Maintenance">Damaged / Needs Maintenance</option>
                  </select>
                </div>

                <AnimatePresence>
                  {formData.is_damaged && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-4 pt-4 overflow-hidden">
                       <input 
                         required 
                         title="Describe the damage"
                         className="w-full bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4 text-sm text-rose-600 dark:text-rose-400 focus:ring-2 focus:ring-rose-500 outline-none"
                         placeholder="Describe damage details..."
                         value={formData.damage_location}
                         onChange={(e) => setFormData({...formData, damage_location: e.target.value})}
                       />
                       <div className="grid grid-cols-2 gap-4">
                         <input type="number" title="Repair cost" placeholder="Estimated Cost (KES)" className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-2xl p-4 text-sm font-bold" value={formData.damage_cost || ''} onChange={(e) => setFormData({...formData, damage_cost: parseFloat(e.target.value) || 0})} />
                         <select title="Responsible party" className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-2xl p-4 text-sm font-bold" value={formData.responsible_party} onChange={(e) => setFormData({...formData, responsible_party: e.target.value})}>
                           <option value="Company">Company</option>
                           <option value="Third Party">Third Party</option>
                         </select>
                       </div>
                       {formData.responsible_party === 'Third Party' && (
                         <input 
                            required 
                            title="Specify third party"
                            className="w-full bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4 text-sm"
                            placeholder="Specify Third Party Name..."
                            value={formData.responsible_party_detail}
                            onChange={(e) => setFormData({...formData, responsible_party_detail: e.target.value})}
                         />
                       )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Handover Notes</label>
                <textarea rows={3} className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/5 rounded-3xl p-5 text-sm font-medium focus:ring-2 focus:ring-brand-purple outline-none" placeholder="Notes for this handover..." value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})}></textarea>
              </div>

              <div className="flex justify-end gap-5 pt-6">
                <button type="button" onClick={() => navigate('/app/security/assets/transfer')} className="px-8 py-4 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-gray-600">Discard</button>
                <button type="submit" disabled={submitting} className="px-12 py-4 bg-brand-purple text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-brand-purple/30 hover:scale-105 active:scale-95 transition-all"> {submitting ? 'Executing...' : 'Confirm Transfer & Notify Holder'} </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssetTransferForm;
