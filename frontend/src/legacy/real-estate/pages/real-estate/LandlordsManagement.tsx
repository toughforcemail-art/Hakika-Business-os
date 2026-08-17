// @ts-nocheck
import React, { useMemo, useState, useEffect } from 'react';
import { User, Plus, Search, Edit2, Trash2, XCircle, Home, Phone, Mail, Building2, KeyRound, LayoutDashboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { activityLogger } from '../../utils/activityLogger';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { formatPhoneInput, normalizePhoneNumber } from '../../utils/phoneNumbers';
import { invokeEdgeFunction } from '../../utils/edgeFunctions';

interface Property {
  id: string;
  name: string;
}

interface Landlord {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  id_number?: string | null;
  login_username?: string | null;
  login_sent_at?: string | null;
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

export default function LandlordsManagement() {
  const navigate = useNavigate();
  const { profile } = useAccess();
  const isSuperAdmin = ['super admin', 'super_admin', 'director / super admin'].includes((profile?.role || '').trim().toLowerCase());
  const [landlords, setLandlords] = useState<Landlord[]>([]);
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
      const [ldRes, propRes] = await Promise.all([
        supabase
          .from('re_personnel')
          .select('*, property:re_properties(name)')
          .eq('role', 'landlord')
          .order('created_at', { ascending: false }),
        supabase.from('re_properties').select('id, name').order('name'),
      ]);
      if (ldRes.error) throw ldRes.error;
      setLandlords(ldRes.data || []);
      setProperties(propRes.data || []);
    } catch (err: any) {
      setToast({ message: 'Failed to load landlords', type: 'error' });
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

  const openEdit = (ld: Landlord) => {
    setEditingId(ld.id);
      setFormData({
        full_name: ld.full_name,
        email: ld.email || '',
        phone: formatPhoneInput(ld.phone),
        id_number: ld.id_number || '',
        property_id: ld.property_id || '',
      status: ld.status,
      start_date: ld.start_date || new Date().toISOString().split('T')[0],
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
        role: 'landlord',
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
        setToast({ message: 'Landlord updated successfully!', type: 'success' });
      } else {
        const { error } = await supabase.from('re_personnel').insert([payload]);
        if (error) throw error;
        setToast({ message: 'Landlord added successfully!', type: 'success' });
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
    if (!window.confirm('Remove this landlord?')) return;
    try {
      const landlord = landlords.find((item) => item.id === id);
      const { error } = await supabase.rpc('archive_record', { p_table_name: 're_personnel', p_record_id: id, p_reason: 'delete' });
      if (error) throw error;
      void activityLogger.logDataAction('delete', 're_personnel', id, landlord?.full_name || 'Landlord');
      setToast({ message: 'Landlord archived', type: 'success' });
      fetchData();
    } catch (err: any) {
      setToast({ message: 'Delete failed', type: 'error' });
    }
  };

  const handleSendLandlordLogin = async (landlord: Landlord) => {
    try {
      await invokeEdgeFunction('admin-create-landlord-login', {
        landlord_id: landlord.id,
        resend: Boolean(landlord.login_sent_at),
      });
      setToast({
        message: landlord.login_sent_at
          ? `Landlord login re-sent to ${landlord.full_name}`
          : `Landlord login created for ${landlord.full_name}`,
        type: 'success',
      });
      fetchData();
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to send landlord login', type: 'error' });
    }
  };

  const filtered = landlords.filter(l =>
    l.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.phone || '').includes(searchTerm) ||
    (l.id_number || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  const sortedFiltered = useMemo(() => filtered, [filtered]);

  const inputCls = 'w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple outline-none';

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 px-3 py-4 dark:bg-dark-bg sm:px-4 sm:py-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="mb-2 flex items-center text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
              <User className="mr-3 text-brand-purple" size={32} />
              Landlords Management
            </h1>
            <p className="max-w-2xl text-sm text-gray-500 dark:text-gray-400 sm:text-base">
              Manage landlord profiles and property ownership records.
            </p>
          </div>
          <button
            onClick={openAdd}
            title="Add a new property landlord"
            className="inline-flex w-full items-center justify-center rounded-xl bg-brand-purple px-4 py-3 font-medium text-white shadow-sm transition-colors hover:bg-brand-pink sm:w-auto sm:px-5 sm:py-2.5"
          >
            <Plus size={18} className="mr-2" /> Add Landlord
          </button>
        </div>

        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: 'Total Landlords', value: landlords.length, icon: User },
            { label: 'Active', value: landlords.filter(l => l.status === 'active').length, icon: Building2 },
            { label: 'With Property', value: landlords.filter(l => l.property_id).length, icon: Home },
          ].map(card => (
            <div key={card.label} className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-dark-surface sm:p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-purple/10 text-brand-purple sm:h-11 sm:w-11">
                <card.icon size={22} />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">{card.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="relative mb-6">
          <label htmlFor="search-landlords" className="sr-only">Search landlords by name, email, phone or ID number</label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            id="search-landlords"
            type="text"
            placeholder="Search by name, email, phone or ID number..."
            title="Search for landlords by name, email, phone number, or ID number"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-gray-900 outline-none focus:ring-2 focus:ring-brand-purple dark:border-white/10 dark:bg-dark-surface dark:text-white"
          />
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-dark-surface">
          {loading ? (
            <div className="flex justify-center p-10 sm:p-12"><CustomLoader size={32} label="Loading landlords..." /></div>
          ) : sortedFiltered.length === 0 ? (
            <div className="flex flex-col items-center p-10 text-center sm:p-12">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-purple/10 text-brand-purple">
                <User size={32} />
              </div>
              <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">No Landlords Found</h3>
              <p className="mb-6 max-w-sm text-gray-500 dark:text-gray-400">Add your first landlord to get started.</p>
              <button onClick={openAdd} title="Add your first landlord" className="rounded-xl bg-brand-purple px-4 py-2.5 text-white transition-colors hover:bg-brand-pink">Add Landlord</button>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Name</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Contact</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">ID Number</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Property</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Since</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {filtered.map(ld => (
                    <tr key={ld.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {ld.profile_image_url ? (
                            <img src={ld.profile_image_url} alt={ld.full_name} className="w-9 h-9 rounded-full object-cover border border-gray-200 dark:border-white/10 shrink-0" />
                          ) : (
                            <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm shrink-0">
                              {ld.full_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-semibold text-gray-900 dark:text-white">{ld.full_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          {ld.email && <span className="flex items-center text-gray-600 dark:text-gray-300 text-xs"><Mail size={11} className="mr-1" />{ld.email}</span>}
                          {ld.phone && <span className="flex items-center text-gray-600 dark:text-gray-300 text-xs"><Phone size={11} className="mr-1" />{ld.phone}</span>}
                          {!ld.email && !ld.phone && <span className="text-gray-400 italic text-xs">No contact</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                        {ld.id_number || <span className="text-gray-400 italic text-sm">Not set</span>}
                      </td>
                      <td className="px-6 py-4">
                        {ld.property ? (
                          <span className="flex items-center text-gray-700 dark:text-gray-300 text-sm"><Home size={13} className="mr-1.5 text-brand-purple" />{ld.property.name}</span>
                        ) : (
                          <span className="text-gray-400 italic text-sm">None assigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                        {ld.start_date ? new Date(ld.start_date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize border ${
                          ld.status === 'active'
                            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30'
                            : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10'
                        }`}>{ld.status}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(ld)} title={`Edit profile for ${ld.full_name}`} className="p-1.5 text-gray-400 hover:text-brand-purple transition-colors rounded-lg hover:bg-brand-purple/10"><Edit2 size={15} /></button>
                          <button onClick={() => void handleSendLandlordLogin(ld)} title={ld.login_sent_at ? 'Resend landlord login' : 'Send landlord login'} className="p-1.5 text-gray-400 hover:text-brand-purple transition-colors rounded-lg hover:bg-brand-purple/10"><KeyRound size={15} /></button>
                          <button onClick={() => navigate(`/app/real-estate/management/landlords/${ld.id}/portal`)} title={`Open portal details for ${ld.full_name}`} className="p-1.5 text-gray-400 hover:text-brand-purple transition-colors rounded-lg hover:bg-brand-purple/10"><Mail size={15} /></button>
                          {isSuperAdmin && <button onClick={() => window.open(`/app/landlord/dashboard?landlordId=${encodeURIComponent(ld.id)}`, '_blank', 'noopener,noreferrer')} title={`View dashboard for ${ld.full_name} in a new tab`} className="p-1.5 text-gray-400 hover:text-brand-purple transition-colors rounded-lg hover:bg-brand-purple/10"><LayoutDashboard size={15} /></button>}
                          <button onClick={() => handleDelete(ld.id)} title={`Remove landlord ${ld.full_name}`} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              <div className="space-y-3 p-3 md:hidden">
                {sortedFiltered.map((ld) => (
                  <div key={ld.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          {ld.profile_image_url ? (
                            <img src={ld.profile_image_url} alt={ld.full_name} className="h-10 w-10 rounded-full object-cover border border-gray-200 dark:border-white/10 shrink-0" />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                              {ld.full_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-gray-900 dark:text-white">{ld.full_name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{ld.status}</p>
                          </div>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium capitalize ${
                        ld.status === 'active'
                          ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800/30 dark:bg-green-900/20 dark:text-green-400'
                          : 'border-gray-200 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-400'
                      }`}>{ld.status}</span>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="shrink-0 text-brand-purple" />
                        <span className="truncate">{ld.email || 'No email'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="shrink-0 text-brand-purple" />
                        <span>{ld.phone || 'No phone'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Home size={14} className="shrink-0 text-brand-purple" />
                        <span className="truncate">{ld.property?.name || 'No property assigned'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="shrink-0 text-brand-purple" />
                        <span>{ld.id_number || 'ID not set'}</span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => openEdit(ld)} title={`Edit profile for ${ld.full_name}`} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-brand-purple/40 hover:text-brand-purple dark:border-white/10 dark:text-gray-200">
                        <Edit2 size={14} /> Edit
                      </button>
                      <button onClick={() => void handleSendLandlordLogin(ld)} title={ld.login_sent_at ? 'Resend landlord login' : 'Send landlord login'} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-brand-purple/40 hover:text-brand-purple dark:border-white/10 dark:text-gray-200">
                        <KeyRound size={14} /> Login
                      </button>
                      <button onClick={() => navigate(`/app/real-estate/management/landlords/${ld.id}/portal`)} title={`Open portal details for ${ld.full_name}`} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-brand-purple/40 hover:text-brand-purple dark:border-white/10 dark:text-gray-200">
                        <Mail size={14} /> Portal
                      </button>
                      {isSuperAdmin && <button onClick={() => window.open(`/app/landlord/dashboard?landlordId=${encodeURIComponent(ld.id)}`, '_blank', 'noopener,noreferrer')} title={`View dashboard for ${ld.full_name} in a new tab`} className="inline-flex items-center gap-1.5 rounded-xl border border-brand-purple/20 bg-brand-purple/10 px-3 py-2 text-xs font-semibold text-brand-purple transition hover:bg-brand-purple/20 dark:text-orange-300">
                        <LayoutDashboard size={14} /> Dashboard
                      </button>}
                      <button onClick={() => handleDelete(ld.id)} title={`Remove landlord ${ld.full_name}`} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900/30 dark:text-red-300 dark:hover:bg-red-900/20">
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{editingId ? 'Edit Landlord' : 'Add Landlord'}</h2>
              <button onClick={() => setShowModal(false)} title="Close landlord modal" className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><XCircle size={24} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="ld-full-name" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Full Name *</label>
                  <input id="ld-full-name" required type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} placeholder="e.g. Peter Mwangi" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="ld-email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
                  <input id="ld-email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="landlord@email.com" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="ld-phone" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Phone</label>
                  <input id="ld-phone" type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: formatPhoneInput(e.target.value)})} placeholder="+254712345678" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="ld-id-number" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">ID Number</label>
                  <input
                    id="ld-id-number"
                    type="text"
                    value={formData.id_number}
                    onChange={e => setFormData({...formData, id_number: e.target.value})}
                    placeholder="National ID / Passport No."
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="ld-property" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Property Owned</label>
                  <select id="ld-property" value={formData.property_id} onChange={e => setFormData({...formData, property_id: e.target.value})} className={inputCls}>
                    <option value="">-- Select Property --</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="ld-start-date" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Start Date</label>
                  <input id="ld-start-date" type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className={inputCls} />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="ld-status" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Status</label>
                  <select id="ld-status" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className={inputCls}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition-colors font-semibold">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-8 py-2.5 bg-brand-purple text-white rounded-xl hover:bg-brand-pink transition-all font-semibold shadow-lg shadow-brand-purple/20 flex items-center disabled:opacity-50">
                  {isSubmitting ? <><CustomLoader size={18} className="mr-2" /> Saving...</> : (editingId ? 'Update' : 'Add Landlord')}
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
