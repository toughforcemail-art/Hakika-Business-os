// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Plus, Search, Filter, Home, Calendar, Clock, Tag, MoreVertical, Trash2, Edit3, X, Save, Printer } from 'lucide-react';
import { printWorkspacePage } from '../../utils/printHelpers';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';

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

export default function NotesFindings() {
  const { profile } = useAccess();
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'General',
    property_id: '',
    unit_id: ''
  });

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [notesRes, propRes, unitRes] = await Promise.all([
        supabase.from('re_notes').select('*').order('created_at', { ascending: false }),
        supabase.from('re_properties').select('id, name'),
        supabase.from('re_units').select('id, unit_number, property_id')
      ]);

      setNotes(notesRes.data || []);
      setProperties(propRes.data || []);
      setUnits(unitRes.data || []);
    } catch (error) {
       console.error('Error fetching notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
     if (!formData.title || !formData.content || !formData.property_id) {
       setToast({ message: 'Title, Content and Property are required', type: 'warning' });
       return;
     }

     try {
       const { error } = await supabase.from('re_notes').insert([
         { ...formData, company_id: profile?.company_id, created_by: profile?.id }
       ]);

       if (error) throw error;
       
       setToast({ message: 'Note saved successfully', type: 'success' });
       setShowModal(false);
       setFormData({ title: '', content: '', category: 'General', property_id: '', unit_id: '' });
       fetchData();
     } catch (error) {
       setToast({ message: 'Failed to save note', type: 'error' });
     }
  };

  const filteredNotes = useMemo(() => {
    return notes.map(n => {
      const property = properties.find(p => p.id === n.property_id);
      const unit = units.find(u => u.id === n.unit_id);
      return { ...n, property_name: property?.name, unit_number: unit?.unit_number };
    }).filter(n => {
      const matchesSearch = n.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           n.content.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesProperty = propertyFilter === 'all' || n.property_id === propertyFilter;
      return matchesSearch && matchesProperty;
    });
  }, [notes, searchTerm, propertyFilter, properties, units]);

  if (loading) return <div className="flex-1 p-8 flex items-center justify-center"><CustomLoader size={40} label="Fetching records..." /></div>;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
              <FileText className="mr-3 text-brand-purple" size={32} />
              Notes & Findings
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
               Internal audit notes, property assessments, and compliance records.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
            onClick={() => printWorkspacePage()}
              title="Print current findings report"
              className="px-4 py-2 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition flex items-center gap-2"
            >
              <Printer size={16} /> Print
            </button>
            <button 
              onClick={() => {
                if (window.confirm('This will perform a batch action or clear view. Proceed?')) {
                  setToast({ message: 'Bulk delete functionality to be implemented.', type: 'info' });
                }
              }} 
              title="Perform batch delete or database maintenance"
              className="px-4 py-2 bg-rose-500/10 text-rose-500 text-sm font-medium rounded-xl hover:bg-rose-500/20 transition flex items-center gap-2"
            >
              <Trash2 size={16} /> Delete
            </button>
            <button 
              onClick={() => setShowModal(true)}
              title="Open form to add a new inspection or assessment record"
              className="px-6 py-3 bg-brand-purple text-white rounded-xl font-bold flex items-center gap-2 hover:bg-brand-pink transition-all shadow-lg shadow-brand-purple/20"
            >
              <Plus size={20} />
              Add New Record
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white dark:bg-dark-surface p-4 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm mb-6 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              id="search-findings"
              type="text" 
              placeholder="Search findings..."
              title="Search for notes and findings by title or content"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg outline-none focus:ring-2 focus:ring-brand-purple text-gray-900 dark:text-white"
            />
          </div>
          <select 
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            title="Filter findings by property location"
            aria-label="Filter by property"
            className="bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-brand-purple text-gray-700 dark:text-white text-sm"
          >
            <option value="all">All Properties</option>
            {properties.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Grid of Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNotes.length > 0 ? (
            filteredNotes.map(note => (
              <div key={note.id} className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all group overflow-hidden flex flex-col">
                <div className={`h-1.5 w-full ${
                  note.category === 'Compliance' ? 'bg-rose-500' : 
                  note.category === 'Inspection' ? 'bg-blue-500' : 'bg-brand-purple'
                }`} />
                <div className="p-5 flex-1">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      note.category === 'Compliance' ? 'bg-rose-100 text-rose-700' : 
                      note.category === 'Inspection' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {note.category}
                    </span>
                    <button 
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
                      title="More options for this record"
                      aria-label="Record options"
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2">{note.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-3 mb-4">{note.content}</p>
                  
                  <div className="mt-auto space-y-2 pt-4 border-t border-gray-50 dark:border-white/5">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Home size={12} /> {note.property_name} {note.unit_number && `(Unit ${note.unit_number})`}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Clock size={12} /> {formatDateTime(note.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full py-20 text-center">
               <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                 <FileText size={32} />
               </div>
               <h3 className="text-lg font-bold text-gray-900 dark:text-white">No records found</h3>
               <p className="text-gray-500 text-sm">Start by adding your first inspection or audit note.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-surface rounded-2xl w-full max-w-lg shadow-2xl border border-white/10 overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">New Finding</h3>
              <button 
                onClick={() => setShowModal(false)} 
                title="Discard changes and exit form"
                aria-label="Close form"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
               <div>
                  <label htmlFor="note-title" className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Title</label>
                  <input 
                    id="note-title"
                    type="text" 
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-purple"
                    placeholder="e.g. Roof Inspection Result"
                  />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="note-category" className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Category</label>
                    <select 
                      id="note-category"
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      title="Select finding category"
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-purple"
                    >
                      <option value="General">General</option>
                      <option value="Inspection">Inspection</option>
                      <option value="Compliance">Compliance</option>
                      <option value="Maintenance Root Cause">Maintenance Root Cause</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="note-property" className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Property</label>
                    <select 
                      id="note-property"
                      value={formData.property_id}
                      onChange={(e) => setFormData({...formData, property_id: e.target.value, unit_id: ''})}
                      title="Select associated property"
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-purple"
                    >
                      <option value="">-- Choose Property --</option>
                      {properties.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
               </div>
               {formData.property_id && (
                 <div>
                    <label htmlFor="note-unit" className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Unit (Optional)</label>
                    <select 
                      id="note-unit"
                      value={formData.unit_id}
                      onChange={(e) => setFormData({...formData, unit_id: e.target.value})}
                      title="Select specific unit (optional)"
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-purple"
                    >
                      <option value="">-- No specific unit --</option>
                      {units.filter(u => u.property_id === formData.property_id).map(u => (
                        <option key={u.id} value={u.id}>Unit {u.unit_number}</option>
                      ))}
                    </select>
                 </div>
               )}
               <div>
                  <label htmlFor="note-content" className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Notes</label>
                  <textarea 
                    id="note-content"
                    value={formData.content}
                    onChange={(e) => setFormData({...formData, content: e.target.value})}
                    rows={4}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-purple resize-none"
                    placeholder="Enter detailed findings..."
                  />
               </div>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-black/10 flex justify-end gap-3">
               <button 
                 onClick={() => setShowModal(false)} 
                 title="Discard record and exit"
                 className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 font-medium"
               >
                 Cancel
               </button>
               <button 
                 onClick={handleSave} 
                 title="Submit and save this record to the database"
                 className="px-6 py-2 bg-brand-purple text-white rounded-lg font-bold hover:bg-brand-pink transition-all flex items-center gap-2 shadow-lg shadow-brand-purple/20"
               >
                  <Save size={18} />
                  Save Record
               </button>
            </div>
          </div>
        </div>
      )}

      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
