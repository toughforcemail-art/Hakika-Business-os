// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { 
  Shield, 
  ArrowLeft,
  Image as ImageIcon,
  X
} from 'lucide-react';
import { motion } from 'framer-motion';
import CustomToast, { sanitizeError } from '../../components/CustomToast';
import { NotificationService } from '../../services/NotificationService';
import { activityLogger } from '../../utils/activityLogger';
import AddableSelect from '../../components/AddableSelect';
import { UnifiedStorageService } from '../../services/UnifiedStorageService';

const LogIncident: React.FC = () => {
  const navigate = useNavigate();
  const [sites, setSites] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<any>({
    type: 'Theft',
    severity: 'medium',
    description: '',
    site_id: '',
    status: 'open',
    serial_number: '',
    asset_catalog_id: '',
    notes: '',
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const generateSerialNumber = () => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(100 + Math.random() * 900);
    return `OB-${dateStr}-${random}`;
  };

  useEffect(() => {
    setFormData((prev: any) => ({ ...prev, serial_number: generateSerialNumber() }));
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const { data: sData } = await supabase.from('security_sites').select('id, name');
      if (sData) setSites(sData);

      const { data: cData } = await supabase.from('security_asset_catalog').select('id, model_name, type').order('model_name');
      if (cData) setCatalog(cData);
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user found");

      const uploadedUrls: string[] = [];
      if (selectedFiles.length > 0) {
        setToast({ message: 'Uploading evidence...', type: 'info' });
        for (const file of selectedFiles) {
          try {
            const url = await UnifiedStorageService.upload(file, {
              folder: '/incidents',
              bucket: 'incident-evidence'
            });
            uploadedUrls.push(url);
          } catch (err) {
            console.error('Failed to upload evidence', err);
          }
        }
      }

      const { asset_catalog_id, ...insertData } = formData;
      const assetNote = asset_catalog_id ? `\n\n[Related Asset ID: ${asset_catalog_id}]` : '';
      const evidenceText = uploadedUrls.length > 0 ? `\n\nEvidence Links:\n${uploadedUrls.join('\n')}` : '';
      const finalNotes = (insertData.notes + assetNote + evidenceText).trim();

      const { error } = await supabase.from('security_incidents').insert([{
        ...insertData,
        notes: finalNotes,
        employee_id: user.id,
      }]);
      
      if (error) throw error;
      
      activityLogger.log({
        actionType: 'create',
        actionCategory: 'security',
        resourceType: 'incident',
        resourceId: formData.type,
        description: `Logged a ${formData.severity} severity ${formData.type} incident at ${sites.find(s => s.id === formData.site_id)?.name}`,
        metadata: { ...formData }
      });

      NotificationService.sendNotification(
        user.id,
        'Incident Logged',
        `A new ${formData.type} incident has been reported.`,
        'error'
      );

      setToast({ message: 'Incident logged successfully', type: 'success' });
      setTimeout(() => navigate('/app/security/incidents'), 1500);
    } catch (error) {
      console.error("Save error:", error);
      activityLogger.logError(sanitizeError(error), 'LogIncident:handleSubmit');
      setToast({ message: sanitizeError(error), type: 'error' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-full w-full p-6 lg:p-10 bg-white dark:bg-dark-bg text-gray-900 dark:text-white">
      <CustomToast 
        isVisible={!!toast} 
        message={toast?.message || ''} 
        type={toast?.type} 
        onClose={() => setToast(null)} 
      />
      
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/app/security/incidents')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
            title="Go back to Incident list"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="text-brand-purple" /> Log New Incident
            </h1>
            <p className="text-sm text-gray-500 dark:text-dark-text">
              Digital Occurrence Book (OB) Entry
            </p>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-3xl p-8 shadow-xl"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AddableSelect 
                label="Incident Type"
                tableName="sec_incident_categories"
                value={formData.type}
                onChange={(val) => setFormData({...formData, type: val})}
                required
              />
              <div className="space-y-1">
                <label htmlFor="incident-severity" className="text-xs font-bold text-gray-400 uppercase">Severity Level</label>
                <select 
                  id="incident-severity"
                  title="Severity Level"
                  className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                  value={formData.severity}
                  onChange={(e) => setFormData({...formData, severity: e.target.value})}
                >
                  {['low', 'medium', 'high', 'critical'].map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label htmlFor="incident-status" className="text-xs font-bold text-gray-400 uppercase">Status</label>
                <select 
                  id="incident-status"
                  title="Status"
                  className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                >
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="under_investigation">Under Investigation</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase">Serial Number (S/N)</label>
                <input 
                  className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none opacity-70 cursor-not-allowed"
                  placeholder="Auto-generated"
                  title="Auto-generated Serial Number"
                  value={formData.serial_number}
                  readOnly
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="incident-site" className="text-xs font-bold text-gray-400 uppercase">Operating Site</label>
              <select 
                id="incident-site"
                required
                title="Operating Site"
                className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                value={formData.site_id}
                onChange={(e) => setFormData({...formData, site_id: e.target.value})}
              >
                <option value="">Select Site</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="incident-catalog" className="text-xs font-bold text-gray-400 uppercase">Asset Catalog (Related Gear)</label>
              <select 
                id="incident-catalog"
                title="Asset Catalog (Related Gear)"
                className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                value={formData.asset_catalog_id}
                onChange={(e) => setFormData({...formData, asset_catalog_id: e.target.value})}
              >
                <option value="">None / General Incident</option>
                {catalog.map(c => <option key={c.id} value={c.id}>{c.model_name} ({c.type})</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Detailed Description</label>
              <textarea 
                required
                rows={4}
                className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                placeholder="Provide a detailed account of the incident..."
                title="Full Description of Incident"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Resolutions / Recommendations (Notes)</label>
              <textarea 
                rows={2}
                className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                placeholder="What has been said or recommended?"
                title="Additional Resolutions or Recommendations"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase">Picture Evidence</label>
              <div className="mt-2 flex flex-col gap-4">
                <div className="flex flex-wrap gap-4">
                  {filePreviews.map((preview, idx) => (
                    <div key={idx} className="relative w-32 h-32 shrink-0 rounded-2xl overflow-hidden border-2 border-brand-purple shadow-lg">
                      <img src={preview} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => {
                          setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
                          setFilePreviews(prev => prev.filter((_, i) => i !== idx));
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors"
                        title="Remove photo"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}

                  <label className="w-32 h-32 shrink-0 rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10 flex flex-col items-center justify-center cursor-pointer hover:border-brand-purple/50 hover:bg-brand-purple/5 transition-all group">
                    <ImageIcon size={32} className="text-gray-400 group-hover:text-brand-purple transition-colors" />
                    <span className="text-[10px] text-gray-500 mt-2 font-bold uppercase tracking-widest text-center px-2">Add Photo(s)</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files?.length) {
                          const newFiles = Array.from(e.target.files) as File[];
                          setSelectedFiles(prev => [...prev, ...newFiles]);
                          
                          newFiles.forEach(file => {
                            const reader = new FileReader();
                            reader.onload = () => setFilePreviews(prev => [...prev, reader.result as string]);
                            reader.readAsDataURL(file);
                          });
                        }
                      }}
                    />
                  </label>
                </div>
                <div className="text-xs text-gray-400 italic max-w-[200px]">
                  Attach high-resolution photo evidence of the incident for official OB records.
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6">
              <button 
                type="button" 
                onClick={() => navigate('/app/security/incidents')} 
                title="Discard log entry and exit"
                className="px-8 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={loading} 
                title="Submit this entry to the Digital Occurrence Book"
                className="px-8 py-3 bg-brand-purple text-white text-sm font-bold rounded-xl hover:bg-opacity-90 transition shadow-lg shadow-brand-purple/20 disabled:opacity-50"
              >
                {loading ? 'Logging Entry...' : 'Submit to Digital OB'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default LogIncident;
