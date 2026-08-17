// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Briefcase, AlertCircle } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { activityLogger } from '../../utils/activityLogger';
import CustomLoader from '../../components/CustomLoader';

interface Designation {
  id: string;
  title: string;
  description: string;
  department_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface Department {
  id: string;
  name: string;
}

const Designations: React.FC = () => {
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: '', description: '', department_id: '', is_active: true });
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [desigRes, deptRes] = await Promise.all([
        supabase.schema('hr').from('designations').select('id,title:name,description,department_id,is_active:status,created_at').order('name', { ascending: true }),
        supabase.schema('hr').from('departments').select('id, name, is_active:status').eq('status', 'active')
      ]);

      if (desigRes.error) throw desigRes.error;
      if (deptRes.error) throw deptRes.error;

      setDesignations(desigRes.data || []);
      setDepartments(deptRes.data || []);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const payload = { ...formData, department_id: formData.department_id || null };
      if (editingId) {
        const { error } = await supabase.from('designations').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('designations').insert([payload]);
        if (error) throw error;
      }
      setShowModal(false);
      setFormData({ title: '', description: '', department_id: '', is_active: true });
      setEditingId(null);
      fetchData();
    } catch (error: any) {
      console.error('Error saving designation:', error);
      setError(error.message);
    }
  };

  const handleEdit = (desig: Designation) => {
    setFormData({ title: desig.title, description: desig.description, department_id: desig.department_id || '', is_active: desig.is_active });
    setEditingId(desig.id);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const designation = designations.find((item) => item.id === id);
      const { error } = await supabase.rpc('archive_record', { p_table_name: 'designations', p_record_id: id, p_reason: 'delete' });
      if (error) throw error;
      void activityLogger.logDataAction('delete', 'designations', id, designation?.title || 'Designation');
      fetchData();
      setDeleteConfirm(null);
    } catch (error: any) {
      console.error('Error deleting designation:', error);
      setError(error.message);
    }
  };

  const getDepartmentName = (deptId: string | null) => {
    if (!deptId) return 'General';
    return departments.find(d => d.id === deptId)?.name || 'Unknown';
  };

  const filteredDesignations = designations.filter(desig =>
    desig.title.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Roles & Designations</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{filteredDesignations.length} roles</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setEditingId(null); setFormData({ title: '', description: '', department_id: '', is_active: true }); setError(''); }}
          className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:opacity-90 flex items-center gap-2 text-sm font-medium"
          title="Add a new role or designation"
        >
          <Plus size={16} /> Add Role
        </button>
      </div>

      <div className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#1e293b] rounded-lg p-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search roles..."
            title="Search for specific roles or designations"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-[#0A1628] dark:text-white text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDesignations.map((desig) => (
          <div key={desig.id} className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#1e293b] rounded-lg p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Briefcase size={20} className="text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{desig.title}</h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{getDepartmentName(desig.department_id)}</span>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${desig.is_active ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400'}`}>
                {desig.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{desig.description || 'No description'}</p>
            <div className="flex gap-2">
              <button 
                onClick={() => handleEdit(desig)} 
                title="Edit Role"
                aria-label="Edit"
                className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-[#334155] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-[#1e293b] flex items-center justify-center gap-1"
              >
                <Edit size={14} /> Edit
              </button>
              <button 
                onClick={() => setDeleteConfirm(desig.id)} 
                title="Delete Role"
                aria-label="Delete"
                className="px-3 py-1.5 text-sm border border-red-300 dark:border-red-500/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredDesignations.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No roles found
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#1e293b] rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{editingId ? 'Edit' : 'Add'} Role</h2>
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="role-title" className="text-xs font-medium text-gray-700 dark:text-gray-300">Title *</label>
                <input
                  id="role-title"
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Senior Guard"
                  title="Role Title"
                  className="w-full mt-1.5 bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="role-dept" className="text-xs font-medium text-gray-700 dark:text-gray-300">Department</label>
                <select
                  id="role-dept"
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  title="Select Department"
                  className="w-full mt-1.5 bg-white dark:bg-[#0A1628] border border-gray-300 dark:border-[#1e293b] px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900 dark:text-white"
                >
                  <option value="">General</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="role-desc" className="text-xs font-medium text-gray-700 dark:text-gray-300">Description</label>
                <textarea
                  id="role-desc"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the responsibilities of this role..."
                  title="Role Description"
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
                <button type="button" onClick={() => { setShowModal(false); setEditingId(null); setError(''); }} className="flex-1 px-4 py-2 border border-gray-300 dark:border-[#334155] rounded-lg hover:bg-gray-50 dark:hover:bg-[#1e293b] text-sm font-medium text-gray-700 dark:text-gray-300" title="Cancel and close">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:opacity-90 text-sm font-medium" title={editingId ? "Update role details" : "Create new role"}>
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#1e293b] rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Role</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Are you sure you want to delete this role? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-[#334155] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-[#1e293b] transition-colors text-sm font-medium"
                title="Cancel deletion"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                title="Confirm deletion"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Designations;
