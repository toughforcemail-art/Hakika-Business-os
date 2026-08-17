// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Plus, Search, Filter, Calendar, Building2, User, Home, MoreVertical, CheckCircle, Clock, XCircle, AlertTriangle, Hammer, ClipboardList, Image as ImageIcon } from 'lucide-react';
import { IKContext, IKUpload } from 'imagekitio-react';

import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';

interface Property {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  unit_number: string;
  property?: Property;
}

interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'emergency';
  status: 'open' | 'approved' | 'in_progress' | 'completed' | 'rejected';
  property_id: string;
  unit_id: string;
  reported_by: string;
  cost_estimate: number;
  actual_cost: number;
  scheduled_date: string;
  completion_date: string;
  created_at: string;
  unit: Unit;
  property: Property;
  reporter: { full_name: string };
  attachments: string[];
}

// Format datetime in local timezone (East Africa Time - EAT, UTC+3)
const formatDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    // Format: MM/DD/YY, HH:MM:SS AM/PM in local timezone
    return date.toLocaleString('en-US', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Africa/Nairobi' // East Africa Time
    });
  } catch (error) {
    return '-';
  }
};

export default function MaintenanceRequest() {
  const { profile } = useAccess();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    property_id: '',
    unit_id: '',
    reported_by: '',
    scheduled_date: '',
    attachments: [] as string[]
  });


  const [users, setUsers] = useState<{id: string, full_name: string}[]>([]);

  const fetchMaintenanceData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('re_maintenance')
        .select('*')
        .order('created_at', { ascending: false });
      if (profile?.company_id) query = query.eq('company_id', profile.company_id);
      const { data, error } = await query;

      if (error) {
        console.error('Error fetching maintenance list:', error.message);
      }
      setRequests(data || []);
    } catch (error: any) {
      console.error('Error fetching maintenance:', error);
    } finally {
      setLoading(false);
    }
  };

  // State for all units to support cross-mapping names in the list
  const [allUnits, setAllUnits] = useState<any[]>([]);

  const fetchDropdownData = async () => {
    try {
      const propertiesQuery = profile?.company_id
        ? supabase.from('re_properties').select('id, name').eq('company_id', profile.company_id).order('name')
        : supabase.from('re_properties').select('id, name').order('name');
      const unitsQuery = profile?.company_id
        ? supabase.from('re_units').select('id, unit_number, property_id').eq('company_id', profile.company_id)
        : supabase.from('re_units').select('id, unit_number, property_id');

      const [propsRes, usersRes, allUnitsRes] = await Promise.all([
        propertiesQuery,
        supabase.from('profiles').select('id, full_name').order('full_name'),
        unitsQuery
      ]);

      if (propsRes.error) console.error('Error fetching properties:', propsRes.error.message);
      if (usersRes.error) console.error('Error fetching users:', usersRes.error.message);
      if (allUnitsRes.error) console.error('Error fetching all units:', allUnitsRes.error.message);

      setProperties(propsRes.data || []);
      setUsers(usersRes.data || []);
      setAllUnits(allUnitsRes.data || []);
    } catch (error) {
      console.error('Error in fetchDropdownData:', error);
    }
  };

  const getPropertyName = (id: string) => properties.find(p => p.id === id)?.name || 'Unknown Property';
  const getUnitNumber = (id: string) => allUnits.find(u => u.id === id)?.unit_number || 'N/A';
  const getUserName = (id: string) => users.find(u => u.id === id)?.full_name || 'System';

  const fetchUnits = async (propertyId: string) => {
    try {
      let query = supabase
        .from('re_units')
        .select('id, unit_number')
        .eq('property_id', propertyId)
        .order('unit_number');
      if (profile?.company_id) query = query.eq('company_id', profile.company_id);
      const { data, error } = await query;
      if (error) throw error;
      setUnits((data || []) as Unit[]);
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchMaintenanceData();
      fetchDropdownData();
    }
  }, [profile]);

  useEffect(() => {
    if (formData.property_id) {
      fetchUnits(formData.property_id);
    } else {
      setUnits([]);
    }
  }, [formData.property_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.property_id || !formData.unit_id) {
      setToast({ message: 'Please fill in all required fields', type: 'warning' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        property_id: formData.property_id,
        unit_id: formData.unit_id,
        reported_by: formData.reported_by || profile?.id,
        status: 'open',
        scheduled_date: formData.scheduled_date || null,
        attachments: formData.attachments
      };


      // Explicitly include company_id for multi-tenancy
      if (profile?.company_id) {
        payload.company_id = profile.company_id;
      }

      const { error } = await supabase
        .from('re_maintenance')
        .insert([payload]);

      if (error) throw error;

      setToast({ message: 'Maintenance ticket reported successfully!', type: 'success' });
      setShowModal(false);
      setFormData({ title: '', description: '', priority: 'medium', property_id: '', unit_id: '', reported_by: '', scheduled_date: '', attachments: [] });
      fetchMaintenanceData();

    } catch (error: any) {
      setToast({ message: error.message || 'Failed to report issue', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRequests = requests.filter(req => {
    const propertyName = getPropertyName(req.property_id);
    const unitNumber = getUnitNumber(req.unit_id);
    
    const matchesSearch = 
      req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      propertyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      unitNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-200';
      default: return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle size={16} className="mr-1" />;
      case 'in_progress': return <Hammer size={16} className="mr-1" />;
      case 'rejected': return <XCircle size={16} className="mr-1" />;
      default: return <Clock size={16} className="mr-1" />;
    }
  };

  const openCommunication = (requestId: string) => {
    navigate(`/app/real-estate/communication/maintenance?ticket=${requestId}`);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
              <Wrench className="mr-3 text-brand-purple" size={32} />
              Maintenance Requests
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Track and manage property maintenance tasks and repairs.
            </p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            title="Open form to report a new maintenance issue"
            className="px-4 py-2 bg-brand-purple text-white rounded-lg font-medium hover:bg-brand-pink transition-colors flex items-center shadow-sm w-fit"
          >
            <Plus size={18} className="mr-2" /> Report Issue
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Open Tickets', value: requests.filter(r => r.status === 'open').length, icon: ClipboardList, color: 'text-blue-500' },
            { label: 'In Progress', value: requests.filter(r => r.status === 'in_progress').length, icon: Hammer, color: 'text-orange-500' },
            { label: 'Critical Ops', value: requests.filter(r => r.priority === 'emergency').length, icon: AlertTriangle, color: 'text-red-500' },
            { label: 'Completed', value: requests.filter(r => r.status === 'completed').length, icon: CheckCircle, color: 'text-green-500' },
          ].map((stat, i) => (
            <div key={i} className="bg-white dark:bg-dark-surface p-4 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</span>
                <stat.icon size={18} className={stat.color} />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Search & Tabs */}
        <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
          <div className="relative flex-1 w-full">
            <label htmlFor="search-maintenance-requests" className="sr-only">Search maintenance requests by title, property or unit</label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              id="search-maintenance-requests"
              type="text"
              placeholder="Search by title, property or unit..."
              title="Search for maintenance requests by title, property name, or unit number"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 pl-10 pr-4 py-2 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex bg-white dark:bg-dark-surface p-1 rounded-lg border border-gray-200 dark:border-white/10 overflow-x-auto max-w-full">
            {['all', 'open', 'in_progress', 'completed'].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                title={`Show ${tab} tickets`}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize whitespace-nowrap ${
                  statusFilter === tab 
                    ? 'bg-brand-purple text-white shadow-sm' 
                    : 'text-gray-500 hover:text-brand-purple'
                }`}
              >
                {tab === 'in_progress' ? 'In Progress' : tab}
              </button>
            ))}
          </div>
        </div>

        {/* Requests List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {loading ? (
            <div className="col-span-full py-12 flex justify-center">
              <CustomLoader size={32} label="Loading tickets..." />
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white dark:bg-dark-surface rounded-2xl border border-dashed border-gray-300 dark:border-white/10">
              <ClipboardList className="mx-auto mb-4 text-gray-300" size={48} />
              <p className="text-gray-500">No maintenance tickets found.</p>
            </div>
          ) : (
            filteredRequests.map((req) => (
              <div key={req.id} className="bg-white dark:bg-dark-surface p-5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md transition-shadow group flex flex-col h-full">
                <div className="flex justify-between items-start mb-4">
                  <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getPriorityColor(req.priority)}`}>
                    {req.priority}
                  </div>
                  <div className="flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 capitalize bg-gray-50 dark:bg-white/5 px-2 py-1 rounded-md border border-gray-100 dark:border-white/5">
                    {getStatusIcon(req.status)}
                    {req.status.replace('_', ' ')}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openCommunication(req.id)}
                  className="mb-2 text-left"
                  title={`Open ${req.title} and reply to the tenant`}
                >
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-1 hover:text-brand-purple transition-colors">
                    {req.title}
                  </h3>
                </button>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 line-clamp-2 grow">{req.description || 'No description provided.'}</p>

                <div className="mt-auto space-y-3 pt-4 border-t border-gray-100 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                      <Building2 className="mr-2 text-brand-purple" size={16} />
                      {getPropertyName(req.property_id)}
                    </div>
                    <div className="flex items-center text-sm font-bold text-gray-900 dark:text-white">
                      <Home className="mr-2 text-brand-purple" size={16} />
                      Unit {getUnitNumber(req.unit_id)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center">
                      <User className="mr-2" size={14} /> Reported by {getUserName(req.reported_by)}
                    </div>
                    <div className="flex items-center">
                      <Calendar className="mr-2" size={14} /> {formatDateTime(req.created_at)}
                    </div>
                  </div>
                  
                  {req.attachments && req.attachments.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 pt-1">
                      {req.attachments.map((url, index) => (
                        <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 w-12 h-12 rounded-lg border border-gray-100 dark:border-white/5 overflow-hidden hover:opacity-75 transition-opacity">
                          <img src={url} alt={`Attachment ${index + 1}`} className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>


                <div className="mt-4 flex gap-2">
                   <button
                     type="button"
                     onClick={() => openCommunication(req.id)}
                     title={`Open ${req.title} and reply to the tenant`}
                     className="flex-1 py-2 bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-100 dark:hover:bg-white/10 transition-colors border border-gray-100 dark:border-white/5"
                   >
                     Open & Reply
                   </button>
                   <button title="More actions" className="px-3 py-2 bg-brand-purple/10 text-brand-purple rounded-lg hover:bg-brand-purple hover:text-white transition-all">
                     <MoreVertical size={16} />
                   </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Report Issue Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                <Plus className="mr-2 text-brand-purple" size={24} />
                Report Maintenance Issue
              </h2>
               <button onClick={() => setShowModal(false)} title="Close report issue form" className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
               <div>
                <label htmlFor="maint-title" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Issue Title *</label>
                <input 
                  id="maint-title"
                  type="text" 
                  required
                  placeholder="e.g. Leaking tap in bathroom"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                  <label htmlFor="maint-property" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Property *</label>
                  <select 
                    id="maint-property"
                    required
                    value={formData.property_id}
                    onChange={(e) => setFormData({...formData, property_id: e.target.value, unit_id: ''})}
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white"
                  >
                    <option value="">-- Select Property --</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                 <div>
                  <label htmlFor="maint-unit" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Unit *</label>
                  <select 
                    id="maint-unit"
                    required
                    disabled={!formData.property_id}
                    value={formData.unit_id}
                    onChange={(e) => setFormData({...formData, unit_id: e.target.value})}
                    className="w-full disabled:opacity-50 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white"
                  >
                    <option value="">-- Select Unit --</option>
                    {units.map(u => <option key={u.id} value={u.id}>Unit {u.unit_number}</option>)}
                  </select>
                </div>
              </div>

               <div>
                <label htmlFor="maint-reporter" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Reported By *</label>
                <select 
                  id="maint-reporter"
                  required
                  value={formData.reported_by}
                  onChange={(e) => setFormData({...formData, reported_by: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white"
                >
                  <option value="">-- Select Person --</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>

               <div>
                <p className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Urgency Level</p>
                <div className="grid grid-cols-4 gap-2">
                  {['low', 'medium', 'high', 'emergency'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setFormData({...formData, priority: p as any})}
                      title={`Set priority to ${p}`}
                      className={`py-2 rounded-lg text-xs font-bold uppercase border transition-all ${
                        formData.priority === p 
                          ? 'bg-brand-purple text-white border-brand-purple shadow-sm ring-2 ring-brand-purple/20' 
                          : 'bg-white dark:bg-white/5 text-gray-500 border-gray-200 dark:border-white/10'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

               <div>
                <label htmlFor="maint-description" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Detailed Description</label>
                <textarea 
                  id="maint-description"
                  rows={3}
                  placeholder="Describe the issue in more detail..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white resize-none"
                />
              </div>

               <div>
                <label htmlFor="maint-date" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Preferred Repair Date</label>
                <input 
                  id="maint-date"
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({...formData, scheduled_date: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white"
                />
              </div>

               <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                  <ImageIcon size={16} className="mr-2 text-brand-purple" />
                  Photo Attachments
                </label>
                <IKContext 
                  publicKey={import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY} 
                  urlEndpoint={import.meta.env.VITE_IMAGEKIT_URL_ENDPOINT} 
                  authenticationEndpoint={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/imagekit-auth`}
                >
                  <div className="space-y-3">
                    <IKUpload
                      fileName={`maintenance_${Date.now()}.jpg`}
                      tags={["maintenance"]}
                      useUniqueFileName={true}
                      folder={"/maintenance"}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-purple file:text-white hover:file:bg-brand-pink cursor-pointer"
                      onSuccess={(res: any) => {
                        setFormData(prev => ({ ...prev, attachments: [...prev.attachments, res.url] }));
                        setToast({ message: 'Image uploaded successfully!', type: 'success' });
                      }}
                      onError={(err: any) => {
                        console.error('Upload Error:', err);
                        setToast({ message: 'Failed to upload image.', type: 'error' });
                      }}
                    />
                    
                    {formData.attachments.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {formData.attachments.map((url, index) => (
                          <div key={index} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-white/10">
                            <img src={url} alt={`Attachment ${index + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              title="Remove this attachment"
                              onClick={() => setFormData(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== index) }))}
                              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >

                              <XCircle size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </IKContext>
              </div>


              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-2.5 bg-brand-purple text-white rounded-xl hover:bg-brand-pink transition-all font-semibold shadow-lg shadow-brand-purple/20 flex items-center disabled:opacity-50"
                >
                  {isSubmitting ? <><CustomLoader size={18} className="mr-2" /> Reporting...</> : 'Submit Ticket'}
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
