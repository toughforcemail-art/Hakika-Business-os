// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { 
  AlertTriangle, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Printer,
  Info,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { printWorkspacePage } from '../../utils/printHelpers';
import { motion, AnimatePresence } from 'framer-motion';
import CustomToast, { sanitizeError } from '../../components/CustomToast';

const IncidentTypes: React.FC = () => {
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingType, setEditingType] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    severity_level: 'Low',
    color_code: '#4F46E5'
  });

  useEffect(() => {
    fetchTypes();
  }, []);

  const fetchTypes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sec_incident_categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      if (data) setTypes(data);
    } catch (error: any) {
      console.error("Error fetching types:", error);
      // If table doesn't exist, we might need to handle it or show empty
      if (error.code === 'PGRST116') {
          setTypes([]);
      }
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingType) {
        const { error } = await supabase
          .from('sec_incident_categories')
          .update(formData)
          .eq('id', editingType.id);
        if (error) throw error;
        setToast({ message: 'Incident type updated successfully', type: 'success' });
      } else {
        const { error } = await supabase
          .from('sec_incident_categories')
          .insert([formData]);
        if (error) throw error;
        setToast({ message: 'Incident type created successfully', type: 'success' });
      }
      await fetchTypes();
      closeModal();
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this incident type?')) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('sec_incident_categories')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setToast({ message: 'Incident type deleted', type: 'success' });
      await fetchTypes();
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    }
    setLoading(false);
  };

  const openModal = (type: any = null) => {
    if (type) {
      setEditingType(type);
      setFormData({
        name: type.name,
        description: type.description || '',
        severity_level: type.severity_level,
        color_code: type.color_code
      });
    } else {
      setEditingType(null);
      setFormData({
        name: '',
        description: '',
        severity_level: 'Low',
        color_code: '#4F46E5'
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingType(null);
  };

  return (
    <div className="min-h-full w-full p-6 lg:p-10 space-y-8 bg-white dark:bg-dark-bg text-gray-900 dark:text-white">
      <CustomToast isVisible={!!toast} message={toast?.message || ''} type={toast?.type} onClose={() => setToast(null)} />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-200 dark:border-dark-border pb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ShieldAlert className="text-brand-purple" /> Incident Types Configuration
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-text">
            Define categories and severity levels for Digital OB reporting.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => printWorkspacePage()} title="Print incident types configuration" className="px-4 py-2 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition flex items-center gap-2">
            <Printer size={16} /> Print
          </button>
          <button 
            onClick={() => {
              if (window.confirm('Batch delete incident types?')) {
                   setToast({ message: 'Select items to delete or use individual delete.', type: 'info' });
              }
            }}
            title="Batch delete incident types"
            className="px-4 py-2 bg-rose-500/10 text-rose-500 text-sm font-medium rounded-xl hover:bg-rose-500/20 transition flex items-center gap-2"
          >
            <Trash2 size={16} /> Delete
          </button>
          <button onClick={() => openModal()} title="Add new incident type" className="px-4 py-2 bg-brand-purple text-white text-sm font-medium rounded-xl hover:bg-opacity-90 transition flex items-center gap-2 shadow-lg shadow-brand-purple/20">
            <Plus size={16} /> Add Type
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {types.map((type) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={type.id} 
            className="glass-card p-6 rounded-2xl border border-gray-200 dark:border-white/10 group relative"
          >
            <div className="flex justify-between items-start mb-4">
              <div 
                className="incident-icon-badge"
                style={{ '--badge-bg': type.color_code } as React.CSSProperties}
              >
                <AlertTriangle size={20} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => openModal(type)} title={`Edit ${type.name} config`} className="p-2 text-gray-400 hover:text-brand-purple hover:bg-brand-purple/10 rounded-lg transition-all">
                  <Edit3 size={16} />
                </button>
                <button onClick={() => handleDelete(type.id)} title={`Delete ${type.name} category`} className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            <h3 className="font-bold text-lg mb-1">{type.name}</h3>
            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 mb-4 inline-block`}>
              {type.severity_level} Severity
            </span>
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{type.description || 'No description provided.'}</p>
          </motion.div>
        ))}
        
        {types.length === 0 && !loading && (
          <div className="col-span-full py-20 text-center bg-gray-50/50 dark:bg-white/2 rounded-3xl border-2 border-dashed border-gray-200 dark:border-white/5">
            <ShieldAlert size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-400">No incident types defined</h3>
            <p className="text-sm text-gray-500 mt-2">Create custom types to categorize OB entries.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-3xl p-8 w-full max-w-md shadow-2xl">
              <h2 className="text-2xl font-bold mb-6">{editingType ? 'Edit Type' : 'New Incident Type'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Type Name</label>
                  <input required title="Type Name" className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none" placeholder="e.g. Theft, Assault, Fire" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Default Severity</label>
                  <select title="Default Severity" className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none" value={formData.severity_level} onChange={(e) => setFormData({...formData, severity_level: e.target.value})}>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">UI Color Code</label>
                  <div className="flex gap-2">
                    <input type="color" title="Color Picker" className="w-12 h-10 p-0 border-none bg-transparent cursor-pointer" value={formData.color_code} onChange={(e) => setFormData({...formData, color_code: e.target.value})} />
                    <input title="Hex Color Code" placeholder="#000000" maxLength={7} pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$" className="flex-1 bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm font-mono" value={formData.color_code} onChange={(e) => setFormData({...formData, color_code: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Description</label>
                  <textarea rows={3} title="Description" className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none" placeholder="What does this report type cover?" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                </div>

                <div className="flex justify-end gap-3 pt-6">
                  <button type="button" onClick={closeModal} title="Cancel and close modal" className="px-6 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-all">Cancel</button>
                  <button type="submit" disabled={loading} title={editingType ? 'Update incident type' : 'Create new incident type'} className="px-6 py-2 bg-brand-purple text-white text-sm font-bold rounded-xl hover:bg-opacity-90 transition shadow-lg shadow-brand-purple/20">
                    {loading ? 'Saving...' : (editingType ? 'Update Type' : 'Create Type')}
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

export default IncidentTypes;
