// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { UserCheck, Plus, Search, Edit2, Trash2, XCircle, Home, Phone, Mail, Calendar, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { activityLogger } from '../../utils/activityLogger';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { formatPhoneInput, normalizePhoneNumber } from '../../utils/phoneNumbers';

interface Property {
  id: string;
  name: string;
}

interface Caretaker {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  id_number?: string | null;
  status: string;
  start_date: string | null;
  property_id: string | null;
  property?: { name: string } | null;
  profile_image_url?: string | null;
}

const createEmptyForm = () => ({
  full_name: '',
  email: '',
  phone: formatPhoneInput(''),
  id_number: '',
  property_id: '',
  status: 'active',
  start_date: new Date().toISOString().split('T')[0],
});

export default function CaretakersManagement() {
  const navigate = useNavigate();
  const { profile } = useAccess();
  const isSuperAdmin = ['super admin', 'super_admin', 'director / super admin'].includes((profile?.role || '').trim().toLowerCase());
  const [caretakers, setCaretakers] = useState<Caretaker[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(createEmptyForm);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ctRes, propRes] = await Promise.all([
        supabase
          .from('re_personnel')
          .select('*, property:re_properties(name), profile_image_url')
          .eq('role', 'caretaker')
          .order('created_at', { ascending: false }),
        supabase.from('re_properties').select('id, name').order('name'),
      ]);
      if (ctRes.error) throw ctRes.error;
      setCaretakers(ctRes.data || []);
      setProperties(propRes.data || []);
    } catch (err: any) {
      setToast({ message: 'Failed to load caretakers', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  const openAdd = () => {
    setEditingId(null);
    setFormData(createEmptyForm());
    setShowModal(true);
  };

  const openEdit = (ct: Caretaker) => {
    setEditingId(ct.id);
      setFormData({
        full_name: ct.full_name,
        email: ct.email || '',
        phone: formatPhoneInput(ct.phone),
        id_number: ct.id_number || '',
        property_id: ct.property_id || '',
      status: ct.status,
      start_date: ct.start_date || new Date().toISOString().split('T')[0],
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name.trim()) {
      setToast({ message: 'Full name is required', type: 'warning' });
      return;
    }
    setIsSubmitting(true);
    try {
      const payload: any = {
        ...formData,
        role: 'caretaker',
        company_id: profile?.company_id,
        created_by: profile?.id,
        property_id: formData.property_id || null,
        email: formData.email || null,
        phone: normalizePhoneNumber(formData.phone),
        id_number: formData.id_number?.trim() || null,
      };
      if (editingId) {
        const { error } = await supabase.from('re_personnel').update(payload).eq('id', editingId);
        if (error) throw error;
        setToast({ message: 'Caretaker updated successfully!', type: 'success' });
      } else {
        const { error } = await supabase.from('re_personnel').insert([payload]);
        if (error) throw error;
        setToast({ message: 'Caretaker added successfully!', type: 'success' });
      }
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      setToast({ message: err.message || 'Operation failed', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this caretaker?')) return;
    try {
      const caretaker = caretakers.find((item) => item.id === id);
      const { error } = await supabase.rpc('archive_record', { p_table_name: 're_personnel', p_record_id: id, p_reason: 'delete' });
      if (error) throw error;
      void activityLogger.logDataAction('delete', 're_personnel', id, caretaker?.full_name || 'Caretaker');
      setToast({ message: 'Caretaker archived', type: 'success' });
      fetchData();
    } catch (err: any) {
      setToast({ message: 'Delete failed', type: 'error' });
    }
  };

  const filtered = caretakers.filter(c =>
    c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone || '').includes(searchTerm) ||
    (c.id_number || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const inputCls = 'w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple outline-none';

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
              <UserCheck className="mr-3 text-brand-purple" size={32} />
              Caretakers Management
            </h1>
            <p className="text-gray-500 dark:text-gray-400">Manage property caretakers and on-site staff.</p>
          </div>
          <button onClick={openAdd} title="Open modal to add a new property caretaker" className="px-4 py-2 bg-brand-purple text-white rounded-lg font-medium hover:bg-brand-pink transition-colors flex items-center shadow-sm">
            <Plus size={18} className="mr-2" /> Add Caretaker
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            id="search-caretakers"
            type="text"
            placeholder="Search by name, email, phone or ID number..."
            title="Search for caretakers by name, email, phone or ID number"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 pl-10 pr-4 py-2.5 rounded-lg outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple"
          />
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center"><CustomLoader size={32} label="Loading caretakers..." /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-brand-purple/10 text-brand-purple rounded-full flex items-center justify-center mb-4">
                <UserCheck size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Caretakers Found</h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">Add your first caretaker to get started.</p>
              <button onClick={openAdd} title="Add your first caretaker" className="px-4 py-2 bg-brand-purple text-white rounded-lg hover:bg-brand-pink transition-colors">Add Caretaker</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm text-left">
                <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Name</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Contact</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">ID Number</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Property</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Start Date</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {filtered.map(ct => (
                    <tr key={ct.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                        {ct.profile_image_url ? (
                          <img src={ct.profile_image_url} alt={ct.full_name} className="w-9 h-9 rounded-full object-cover border border-gray-200 dark:border-white/10 shrink-0" />
                        ) : (
                          <div className="w-9 h-9 bg-brand-purple/10 rounded-full flex items-center justify-center text-brand-purple font-bold text-sm shrink-0">
                            {ct.full_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                          <span className="font-semibold text-gray-900 dark:text-white">{ct.full_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          {ct.email && <span className="flex items-center text-gray-600 dark:text-gray-300 text-xs"><Mail size={11} className="mr-1" />{ct.email}</span>}
                          {ct.phone && <span className="flex items-center text-gray-600 dark:text-gray-300 text-xs"><Phone size={11} className="mr-1" />{ct.phone}</span>}
                          {!ct.email && !ct.phone && <span className="text-gray-400 italic text-xs">No contact</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                        {ct.id_number || <span className="text-gray-400 italic text-sm">Not set</span>}
                      </td>
                      <td className="px-6 py-4">
                        {ct.property ? (
                          <span className="flex items-center text-gray-700 dark:text-gray-300 text-sm"><Home size={13} className="mr-1.5 text-brand-purple" />{ct.property.name}</span>
                        ) : (
                          <span className="text-gray-400 italic text-sm">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                        {ct.start_date ? new Date(ct.start_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize border ${
                          ct.status === 'active'
                            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30'
                            : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10'
                        }`}>{ct.status}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(ct)} title={`Edit details for ${ct.full_name}`} className="p-1.5 text-gray-400 hover:text-brand-purple transition-colors rounded-lg hover:bg-brand-purple/10"><Edit2 size={15} /></button>
                          {isSuperAdmin && <button onClick={() => window.open(`/app/caretaker/dashboard?caretakerId=${encodeURIComponent(ct.id)}`, '_blank', 'noopener,noreferrer')} title={`View dashboard for ${ct.full_name} in a new tab`} className="p-1.5 text-gray-400 hover:text-brand-purple transition-colors rounded-lg hover:bg-brand-purple/10"><LayoutDashboard size={15} /></button>}
                          <button onClick={() => handleDelete(ct.id)} title={`Remove ${ct.full_name} from personnel`} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{editingId ? 'Edit Caretaker' : 'Add Caretaker'}</h2>
              <button onClick={() => setShowModal(false)} title="Close modal" className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><XCircle size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="ct-full-name" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Full Name *</label>
                  <input id="ct-full-name" required type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} placeholder="e.g. John Kamau" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="ct-email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
                  <input id="ct-email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="john@example.com" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="ct-phone" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Phone</label>
                  <input id="ct-phone" type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: formatPhoneInput(e.target.value)})} placeholder="+254712345678" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="ct-id-number" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">ID Number</label>
                  <input
                    id="ct-id-number"
                    type="text"
                    value={formData.id_number}
                    onChange={e => setFormData({...formData, id_number: e.target.value})}
                    placeholder="National ID / Passport No."
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="ct-property" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Property</label>
                  <select id="ct-property" title="Select property the caretaker manages" value={formData.property_id} onChange={e => setFormData({...formData, property_id: e.target.value})} className={inputCls}>
                    <option value="">-- Unassigned --</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="ct-start-date" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Start Date</label>
                  <input id="ct-start-date" type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className={inputCls} />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="ct-status" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Status</label>
                  <select id="ct-status" title="Current employment status" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className={inputCls}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="on_leave">On Leave</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition-colors font-semibold">Cancel</button>
                <button type="submit" disabled={isSubmitting} title={editingId ? 'Update caretaker information' : 'Register new caretaker'} className="px-8 py-2.5 bg-brand-purple text-white rounded-xl hover:bg-brand-pink transition-all font-semibold shadow-lg shadow-brand-purple/20 flex items-center disabled:opacity-50">
                  {isSubmitting ? <><CustomLoader size={18} className="mr-2" /> Saving...</> : (editingId ? 'Update' : 'Add Caretaker')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
