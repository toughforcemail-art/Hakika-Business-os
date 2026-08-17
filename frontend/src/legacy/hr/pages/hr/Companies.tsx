// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { Building2, Plus, Edit2, Trash2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CustomToast, { sanitizeError } from '../../components/CustomToast';
import { motion } from 'framer-motion';

interface Company {
  id: string;
  name: string;
  code?: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: string;
  deleted_at?: string | null;
  created_at?: string;
}

const Companies: React.FC = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [formData, setFormData] = useState<Omit<Company, 'id' | 'created_at'>>({
    name: '',
    code: '',
    email: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .not('status', 'eq', 'deleted')
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      setToast({ message: `Failed to load companies: ${sanitizeError(error)}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setToast({ message: 'Company name is required', type: 'error' });
      return;
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('companies')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;
        setToast({ message: 'Company updated successfully', type: 'success' });
      } else {
        const { error } = await supabase
          .from('companies')
          .insert([formData]);

        if (error) throw error;
        setToast({ message: 'Company added successfully', type: 'success' });
      }

      setFormData({ name: '', code: '', email: '', phone: '', address: '' });
      setEditingId(null);
      setShowForm(false);
      await fetchCompanies();
    } catch (error) {
      setToast({ message: `Failed to save company: ${sanitizeError(error)}`, type: 'error' });
    }
  };

  const handleEdit = (company: Company) => {
    setFormData({
      name: company.name,
      code: company.code || '',
      email: company.email || '',
      phone: company.phone || '',
      address: company.address || ''
    });
    setEditingId(company.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this company?')) return;

    try {
      const { error } = await supabase
        .rpc('archive_company', { p_company_id: id });

      if (error) throw error;
      setToast({ message: 'Company deleted successfully', type: 'success' });
      await fetchCompanies();
    } catch (error) {
      setToast({ message: `Failed to delete company: ${sanitizeError(error)}`, type: 'error' });
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: '', code: '', email: '', phone: '', address: '' });
  };

  return (
    <div className="min-h-full w-full p-6 lg:p-10 bg-white dark:bg-dark-bg text-gray-900 dark:text-white">
      <CustomToast
        isVisible={!!toast}
        message={toast?.message || ''}
        type={toast?.type}
        onClose={() => setToast(null)}
      />

      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/app/hr')} 
              className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
              title="Go back"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Building2 className="text-brand-purple" /> Companies Management
              </h1>
              <p className="text-sm text-gray-500 dark:text-dark-text mt-1">
                Manage all companies in your organization
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-6 py-3 bg-brand-purple text-white rounded-xl hover:bg-opacity-90 transition shadow-lg shadow-brand-purple/20"
          >
            <Plus size={20} /> Add Company
          </button>
        </div>

        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-3xl p-8 shadow-xl"
          >
            <h2 className="text-xl font-bold mb-6">
              {editingId ? 'Edit Company' : 'Add New Company'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Company Name *</label>
                  <input
                    required
                    type="text"
                    className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Acme Corporation"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Company Code</label>
                  <input
                    type="text"
                    className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                    value={formData.code || ''}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g. ACM001"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Email</label>
                  <input
                    type="email"
                    className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="company@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Phone</label>
                  <input
                    type="tel"
                    className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+254 700 000 000"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase">Address</label>
                <textarea
                  className="w-full bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Company address"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-3 pt-6">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-8 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-brand-purple text-white text-sm font-bold rounded-xl hover:bg-opacity-90 transition shadow-lg shadow-brand-purple/20"
                >
                  {editingId ? 'Update Company' : 'Add Company'}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-purple"></div>
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-12">
            <Building2 size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No companies found. Add one to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {companies.map((company) => (
              <motion.div
                key={company.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-2xl p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-purple/10 flex items-center justify-center text-brand-purple">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{company.name}</h3>
                      {company.code && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{company.code}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(company)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors text-blue-600"
                      title="Edit"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(company.id)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors text-rose-600"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {company.email && (
                    <p className="text-gray-600 dark:text-gray-400">
                      <span className="font-semibold">Email:</span> {company.email}
                    </p>
                  )}
                  {company.phone && (
                    <p className="text-gray-600 dark:text-gray-400">
                      <span className="font-semibold">Phone:</span> {company.phone}
                    </p>
                  )}
                  {company.address && (
                    <p className="text-gray-600 dark:text-gray-400">
                      <span className="font-semibold">Address:</span> {company.address}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Companies;
