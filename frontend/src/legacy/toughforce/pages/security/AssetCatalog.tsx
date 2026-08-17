// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { 
  Library, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Radio, 
  Zap, 
  Shield, 
  Package,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomToast, { sanitizeError } from '../../components/CustomToast';
import { NotificationService } from '../../services/NotificationService';
import { activityLogger } from '../../utils/activityLogger';

const AssetCatalog: React.FC = () => {
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    model_name: '',
    type: 'Radio',
    default_condition: 'New'
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('security_asset_catalog')
      .select('*')
      .order('model_name', { ascending: true });
    if (data) setModels(data);
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('security_asset_catalog').upsert([formData]);
      if (error) throw error;
      await fetchModels();
      setShowAddModal(false);
      setToast({ message: 'Catalog item saved successfully', type: 'success' });
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        NotificationService.sendNotification(
          user.id,
          'Catalog Updated',
          `${formData.model_name} has been saved to the asset catalog.`,
          'success'
        );
      }

      setFormData({ model_name: '', type: 'Radio', default_condition: 'New' });
    } catch (error) {
      console.error("Save error:", error);
      setToast({ message: sanitizeError(error), type: 'error' });
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? This will not delete existing assets using this name, but it will remove the template.")) return;
    try {
      const model = models.find((item) => item.id === id);
      const { error } = await supabase.rpc('archive_record', { p_table_name: 'security_asset_catalog', p_record_id: id, p_reason: 'delete' });
      if (error) throw error;
      void activityLogger.logDataAction('delete', 'security_asset_catalog', id, model?.model_name || 'Asset Catalog Item');
      setToast({ message: 'Catalog item deleted', type: 'success' });
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        NotificationService.sendNotification(
          user.id,
          'Catalog Item Removed',
          'A model template has been removed from the asset catalog.',
          'warning'
        );
      }

      fetchModels();
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
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
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Library className="text-brand-purple" /> Asset Catalog
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-text">
            Pre-define equipment models and templates to simplify inventory registration.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowAddModal(true)} 
            title="Add a new equipment model template to the catalog"
            className="px-4 py-2 bg-brand-purple text-white text-sm font-medium rounded-xl hover:bg-opacity-90 transition flex items-center gap-2 shadow-lg shadow-brand-purple/20"
          >
            <Plus size={16} /> New Model
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {models.map((model) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={model.id}
            className="glass-card p-6 rounded-3xl border border-gray-200 dark:border-white/10 hover:border-brand-purple/40 transition-all group relative"
          >
             <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-purple/10 flex items-center justify-center text-brand-purple">
                   {model.type === 'Radio' ? <Radio size={24}/> : model.type === 'Torch' ? <Zap size={24}/> : <Package size={24}/>}
                </div>
                <button 
                  onClick={() => handleDelete(model.id)} 
                  title={`Delete the ${model.model_name} template from catalog`}
                  aria-label="Delete template"
                  className="p-2 text-gray-300 hover:text-rose-500 transition-colors"
                >
                   <Trash2 size={16}/>
                </button>
             </div>

             <h3 className="font-bold text-lg mb-1">{model.model_name}</h3>
             <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                <span className="bg-gray-100 dark:bg-white/5 px-2 py-1 rounded uppercase font-black tracking-widest">{model.type}</span>
                <span className="text-gray-300">•</span>
                <span>Default: {model.default_condition}</span>
             </div>

             <div className="flex justify-end pt-4 border-t border-gray-50 dark:border-white/5">
                <button 
                  onClick={() => { setFormData(model); setShowAddModal(true); }}
                  title={`Edit specific details for the ${model.model_name} model`}
                  className="text-[10px] font-black uppercase text-brand-purple tracking-widest hover:underline"
                >
                   Edit details
                </button>
             </div>
          </motion.div>
        ))}

        {models.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-gray-100 dark:border-white/5 rounded-3xl">
             <AlertCircle size={48} className="mx-auto text-gray-200 mb-4"/>
             <p className="text-gray-400 italic">The catalog is empty. Add equipment models to get started.</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <h2 className="text-2xl font-bold mb-6 italic tracking-tight uppercase">Define Equipment Model</h2>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Asset Name (Model)</label>
                  <input 
                    required 
                    placeholder="e.g. Motorola CP200 Radio"
                    title="The specific name or model of the equipment"
                    className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none transition-all" 
                    value={formData.model_name} 
                    onChange={(e) => setFormData({...formData, model_name: e.target.value})} 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Type</label>
                    <select 
                      title="The category of the asset (e.g. Radio, Torch, Uniform)"
                      className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value})}
                    >
                      <option value="Radio">Radio</option>
                      <option value="Torch">Torch</option>
                      <option value="Uniform">Uniform</option>
                      <option value="Body Armour">Body Armour</option>
                      <option value="Smartphone">Smartphone</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Default Condition</label>
                    <select 
                      title="Choose the standard condition for this model when issued new"
                      className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                      value={formData.default_condition}
                      onChange={(e) => setFormData({...formData, default_condition: e.target.value})}
                    >
                      <option value="New">New</option>
                      <option value="Excellent">Excellent</option>
                      <option value="Good">Good</option>
                      <option value="Fair">Fair</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6">
                  <button type="button" onClick={() => setShowAddModal(false)} className="px-6 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all" title="Discard changes">Cancel</button>
                  <button type="submit" disabled={loading} className="px-6 py-2 bg-brand-purple text-white text-sm font-bold rounded-xl hover:bg-opacity-90 transition shadow-lg shadow-brand-purple/20" title="Save this model to the catalog">
                    {loading ? 'Saving...' : 'Save to Catalog'}
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

export default AssetCatalog;
