// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Grid3x3, AlertCircle } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { activityLogger } from '../../utils/activityLogger';
import CustomLoader from '../../components/CustomLoader';

interface Module {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

const Modules: React.FC = () => {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', is_active: true });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchModules();
  }, []);

  const fetchModules = async () => {
    try {
      const { data, error } = await supabase
        .from('modules')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setModules(data || []);
    } catch (error: any) {
      console.error('Error fetching modules:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        const { error } = await supabase
          .from('modules')
          .update(formData)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('modules').insert([formData]);
        if (error) throw error;
      }
      setShowModal(false);
      setFormData({ name: '', description: '', is_active: true });
      setEditingId(null);
      fetchModules();
    } catch (error: any) {
      console.error('Error saving module:', error);
      setError(error.message);
    }
  };

  const handleEdit = (mod: Module) => {
    setFormData({ name: mod.name, description: mod.description, is_active: mod.is_active });
    setEditingId(mod.id);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this module?')) return;
    try {
      const mod = modules.find((item) => item.id === id);
      const { error } = await supabase.rpc('archive_record', { p_table_name: 'modules', p_record_id: id, p_reason: 'delete' });
      if (error) throw error;
      void activityLogger.logDataAction('delete', 'modules', id, mod?.name || 'Module');
      fetchModules();
    } catch (error: any) {
      console.error('Error deleting module:', error);
      setError(error.message);
    }
  };

  const filteredModules = modules.filter(mod =>
    mod.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-[#020817]"><CustomLoader size={40} /></div>;

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-[#020817] min-h-screen">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle size={20} />
          <span className="text-sm">{error}</span>
        </div>
      )}
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Modules</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{filteredModules.length} modules</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setEditingId(null); setFormData({ name: '', description: '', is_active: true }); setError(''); }}
          className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:opacity-90 flex items-center gap-2 text-sm font-medium"
        >
          <Plus size={16} /> Add Module
        </button>
      </div>

      <div className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#1e293b] rounded-lg p-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search modules..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-[#0A1628] dark:text-white text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredModules.map((mod) => (
          <div key={mod.id} className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#1e293b] rounded-lg p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg flex items-center justify-center">
                  <Grid3x3 size={20} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{mod.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${mod.is_active ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400'}`}>
                    {mod.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{mod.description || 'No description'}</p>
            <div className="flex gap-2">
              <button 
                onClick={() => handleEdit(mod)} 
                title="Edit Module"
                aria-label="Edit"
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-[#334155] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-[#1e293b] flex items-center justify-center gap-1"
              >
                <Edit size={14} /> Edit
              </button>
              <button 
                onClick={() => handleDelete(mod.id)} 
                title="Delete Module"
                aria-label="Delete"
                className="px-3 py-1.5 text-sm border border-red-300 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredModules.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No modules found
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#1e293b] rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{editingId ? 'Edit' : 'Add'} Module</h2>
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="mod-name" className="text-xs font-medium text-gray-700 dark:text-gray-300">Name *</label>
                <input
                  id="mod-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  title="Module Name"
                  className="w-full mt-1.5 bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="mod-desc" className="text-xs font-medium text-gray-700 dark:text-gray-300">Description</label>
                <textarea
                  id="mod-desc"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  title="Module Description"
                  className="w-full mt-1.5 bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm h-20 resize-none text-gray-900 dark:text-white"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  title="Is Active"
                  className="rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
              </label>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingId(null); setError(''); }} className="flex-1 px-4 py-2 border border-gray-300 dark:border-[#334155] rounded-lg hover:bg-gray-50 dark:hover:bg-[#1e293b] text-sm font-medium text-gray-700 dark:text-gray-300">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:opacity-90 text-sm font-medium">
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Modules;
