// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { 
  FileCheck, 
  Upload, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  User,
  Shield,
  Download,
  Trash2,
  ExternalLink,
  LayoutGrid,
  List,
  Search,
  BadgeCheck,
  CalendarClock,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomToast, { sanitizeError } from '../../components/CustomToast';
import { NotificationService } from '../../services/NotificationService';
import AddableSelect from '../../components/AddableSelect';
import { UnifiedStorageService } from '../../services/UnifiedStorageService';

interface ComplianceUploadEntry {
  id: string;
  type: string;
  expiry_date: string;
  document_url: string;
  file: File | null;
}

const createEmptyEntry = (): ComplianceUploadEntry => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type: 'PSRA',
  expiry_date: '',
  document_url: '',
  file: null
});

const ComplianceHub: React.FC = () => {
  const [docs, setDocs] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [documentEntries, setDocumentEntries] = useState<ComplianceUploadEntry[]>([createEmptyEntry()]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'renewing' | 'expired'>('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: eData } = await supabase.from('profiles').select('id, full_name').or('is_security_guard.eq.true,department.eq.Security');
      if (eData) setEmployees(eData);
      await fetchDocs();
    } catch (error) {
      console.error("Fetch error:", error);
    }
    setLoading(false);
  };

  const fetchDocs = async () => {
    const { data } = await supabase
      .from('security_compliance_docs')
      .select('*, profiles(full_name)')
      .order('expiry_date', { ascending: true });
    if (data) setDocs(data);
  };

  const resetUploadForm = () => {
    setSelectedEmployeeId('');
    setDocumentEntries([createEmptyEntry()]);
    setShowUpload(false);
  };

  const getDocumentStatus = (expiry: string) => {
    const today = new Date();
    const expiryDate = new Date(expiry);
    const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'expired';
    if (diffDays < 30) return 'renewing';
    return 'valid';
  };

  const handleEntryChange = (entryId: string, field: 'type' | 'expiry_date' | 'document_url', value: string) => {
    setDocumentEntries((current) =>
      current.map((entry) => (
        entry.id === entryId ? { ...entry, [field]: value } : entry
      ))
    );
  };

  const handleEntryFileChange = (entryId: string, file: File | null) => {
    setDocumentEntries((current) =>
      current.map((entry) => (
        entry.id === entryId ? { ...entry, file } : entry
      ))
    );
  };

  const handleAddDocumentRow = () => {
    setDocumentEntries((current) => [...current, createEmptyEntry()]);
  };

  const handleRemoveDocumentRow = (entryId: string) => {
    setDocumentEntries((current) => (
      current.length === 1 ? current : current.filter((entry) => entry.id !== entryId)
    ));
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) {
      setToast({ message: 'Please select personnel first.', type: 'error' });
      return;
    }

    const invalidEntry = documentEntries.find((entry) => !entry.expiry_date || (!entry.file && !entry.document_url.trim()));
    if (invalidEntry) {
      setToast({ message: 'Each compliance document needs an expiry date and a file or document link.', type: 'error' });
      return;
    }

    setLoading(true);
    setUploadProgress(true);
    try {
      const records = [];

      for (let index = 0; index < documentEntries.length; index += 1) {
        const entry = documentEntries[index];
        let finalUrl = entry.document_url.trim();

        if (entry.file) {
          setToast({ message: `Uploading document ${index + 1} of ${documentEntries.length}...`, type: 'info' });
          finalUrl = await UnifiedStorageService.upload(entry.file, {
            folder: '/compliance_docs',
            bucket: 'vetting-docs'
          });
        }

        records.push({
          employee_id: selectedEmployeeId,
          type: entry.type,
          expiry_date: entry.expiry_date,
          document_url: finalUrl,
          status: getDocumentStatus(entry.expiry_date)
        });
      }

      const { error } = await supabase.from('security_compliance_docs').insert(records);

      if (error) throw error;
      
      await fetchDocs();
      resetUploadForm();
      setToast({
        message: records.length === 1 ? 'Compliance document saved successfully.' : `${records.length} compliance documents saved successfully.`,
        type: 'success'
      });
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        NotificationService.sendNotification(
          user.id,
          'Compliance Document Recorded',
          records.length === 1
            ? 'A compliance document has been saved successfully.'
            : `${records.length} compliance documents have been saved successfully.`,
          'success'
        );
      }
    } catch (error: any) {
      console.error("Management error:", error);
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setLoading(false);
      setUploadProgress(false);
    }
  };

  const getStatus = (expiry: string) => {
    const today = new Date();
    const expiryDate = new Date(expiry);
    const diffDays = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { label: 'Expired', color: 'bg-rose-500 text-white', icon: <AlertCircle size={14}/> };
    if (diffDays < 30) return { label: 'Expiring Soon', color: 'bg-amber-500 text-white', icon: <Clock size={14}/> };
    return { label: 'Valid', color: 'bg-emerald-500 text-white', icon: <CheckCircle2 size={14}/> };
  };

  const filteredDocs = docs.filter((doc) => {
    const status = getDocumentStatus(doc.expiry_date);
    const haystack = `${doc.type} ${doc.profiles?.full_name || ''} ${doc.expiry_date} ${doc.document_url}`.toLowerCase();
    const matchesSearch = !searchTerm.trim() || haystack.includes(searchTerm.trim().toLowerCase());
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const complianceStats = {
    total: docs.length,
    valid: docs.filter((doc) => getDocumentStatus(doc.expiry_date) === 'valid').length,
    renewing: docs.filter((doc) => getDocumentStatus(doc.expiry_date) === 'renewing').length,
    expired: docs.filter((doc) => getDocumentStatus(doc.expiry_date) === 'expired').length,
  };

  return (
    <div className="min-h-full w-full p-6 lg:p-10 space-y-8 bg-white dark:bg-dark-bg text-gray-900 dark:text-white">
      <CustomToast 
        isVisible={!!toast} 
        message={toast?.message || ''} 
        type={toast?.type} 
        onClose={() => setToast(null)} 
      />
      <div className="relative overflow-hidden rounded-[32px] border border-gray-200 bg-gradient-to-br from-white via-[#fffaf5] to-[#f5f7ff] p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.35)] dark:border-white/10 dark:from-dark-surface dark:via-[#091922] dark:to-[#0c2431]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,106,0,0.12),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(107,57,164,0.16),transparent_28%)]" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#ff6a00]/20 bg-white/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-[#ff6a00] dark:border-[#ff6a00]/30 dark:bg-white/5">
              <Shield className="h-3.5 w-3.5" />
              Compliance hub
            </div>
            <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              <FileCheck className="text-[#ff6a00]" />
              Security Compliance Hub
            </h1>
            <p className="max-w-2xl text-sm text-gray-600 dark:text-slate-300">
              Track guard certifications, PSRA licenses, vetting documents, and renewal status in one operational view built for quick review and audit readiness.
            </p>
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="rounded-full border border-gray-200 bg-white px-3 py-1.5 dark:border-white/10 dark:bg-white/[0.03]">Total: {complianceStats.total}</span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">Valid: {complianceStats.valid}</span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">Expiring Soon: {complianceStats.renewing}</span>
              <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">Expired: {complianceStats.expired}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white/90 p-1 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 ${viewMode === 'list' ? 'bg-[#ff6a00] text-white shadow-lg shadow-[#ff6a00]/20' : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white'}`}
              >
                <List size={14} /> List
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2 ${viewMode === 'cards' ? 'bg-[#ff6a00] text-white shadow-lg shadow-[#ff6a00]/20' : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white'}`}
              >
                <LayoutGrid size={14} /> Cards
              </button>
            </div>
            <button onClick={() => setShowUpload(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#ff6a00] px-5 py-3 text-sm font-bold text-white shadow-[0_18px_50px_-18px_rgba(255,106,0,0.65)] transition hover:bg-[#e85f00]">
              <Upload size={16} /> Upload Document
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-dark-surface">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2 lg:col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Search compliance docs</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-10 py-3 text-sm outline-none transition focus:border-[#ff6a00]/40 focus:bg-white focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-[#082131] dark:text-white dark:focus:bg-[#0b2a3c]"
                placeholder="Search by document type, personnel, expiry date, or link"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Status</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-[#ff6a00]/40 focus:bg-white focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-[#082131] dark:text-white dark:focus:bg-[#0b2a3c]"
            >
              <option value="all">All statuses</option>
              <option value="valid">Valid</option>
              <option value="renewing">Expiring Soon</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
      </div>

      {viewMode === 'list' ? (
        <div className="overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-dark-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 dark:bg-white/5 dark:text-gray-400">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Document Type</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Personnel</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Expiry Date</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Document</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {filteredDocs.map((doc) => {
                  const status = getStatus(doc.expiry_date);
                  return (
                    <tr key={doc.id} className="hover:bg-gray-50/80 dark:hover:bg-white/[0.03]">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-purple/10 text-brand-purple">
                            <Shield size={18} />
                          </div>
                          <span className="font-bold text-gray-900 dark:text-white">{doc.type}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{doc.profiles?.full_name || 'Unknown personnel'}</td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-700 dark:text-gray-300">{new Date(doc.expiry_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${status.color}`}>
                          {status.icon} {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => window.open(doc.document_url, '_blank', 'noopener,noreferrer')}
                          className="inline-flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-700 transition hover:bg-gray-200 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                        >
                          <Download size={14} /> Open
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            const confirmed = window.confirm(`Revoke ${doc.type} for ${doc.profiles?.full_name || 'this personnel'}?`);
                            if (!confirmed) return;

                            const { error } = await supabase
                              .from('security_compliance_docs')
                              .delete()
                              .eq('id', doc.id);

                            if (error) {
                              setToast({ message: sanitizeError(error), type: 'error' });
                              return;
                            }

                            setToast({ message: 'Compliance document revoked.', type: 'success' });
                            await fetchDocs();
                          }}
                          className="inline-flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-black uppercase tracking-widest text-rose-600 transition hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
                        >
                          <Trash2 size={14} /> Revoke
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!loading && filteredDocs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                      No compliance documents match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocs.map((doc) => {
            const status = getStatus(doc.expiry_date);
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={doc.id}
                className="glass-card p-6 rounded-3xl border border-gray-200 dark:border-white/10 hover:border-brand-purple/40 transition-all group shadow-sm hover:shadow-xl"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-white/5 flex items-center justify-center text-brand-purple group-hover:scale-110 transition-transform">
                     <Shield size={20}/>
                  </div>
                  <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${status.color}`}>
                     {status.icon} {status.label}
                  </div>
                </div>

                <h3 className="font-bold text-lg mb-1">{doc.type}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-4 flex items-center gap-2">
                   <User size={12}/> {doc.profiles?.full_name}
                </p>

                <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-white/5">
                  <div className="flex justify-between items-center text-xs">
                     <span className="text-gray-400 font-bold uppercase tracking-widest">Expires On</span>
                     <span className="font-bold font-mono">{new Date(doc.expiry_date).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-6">
                   <button
                      type="button"
                      onClick={() => window.open(doc.document_url, '_blank', 'noopener,noreferrer')}
                      className="py-2.5 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-all rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                      title="Open document"
                   >
                      <Download size={14}/> Download
                   </button>
                   <button
                      type="button"
                      onClick={async () => {
                        const confirmed = window.confirm(`Revoke ${doc.type} for ${doc.profiles?.full_name || 'this personnel'}?`);
                        if (!confirmed) return;

                        const { error } = await supabase
                          .from('security_compliance_docs')
                          .delete()
                          .eq('id', doc.id);

                        if (error) {
                          setToast({ message: sanitizeError(error), type: 'error' });
                          return;
                        }

                        setToast({ message: 'Compliance document revoked.', type: 'success' });
                        await fetchDocs();
                      }}
                      className="py-2.5 bg-gray-50 dark:bg-white/5 hover:bg-rose-500/10 hover:text-rose-500 transition-all rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                      title="Revoke document"
                   >
                      <Trash2 size={14}/> Revoke
                   </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showUpload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-3xl p-8 w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold italic tracking-tight uppercase">Upload Compliance Documents</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Add one or more compliance documents for the same personnel in one submission.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetUploadForm}
                  className="px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
                >
                  Close
                </button>
              </div>
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="compliance-personnel" className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Personnel</label>
                  <select 
                    id="compliance-personnel"
                    required 
                    title="Select Employee"
                    className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  >
                    <option value="">Select Employee</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                  </select>
                </div>

                <div className="space-y-4">
                  {documentEntries.map((entry, index) => (
                    <div key={entry.id} className="rounded-3xl border border-gray-200 dark:border-dark-border p-5 bg-gray-50/80 dark:bg-white/[0.03] space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-gray-400">
                            Compliance Document {index + 1}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Add the document type, expiry date, and file or direct document link.
                          </p>
                        </div>
                        {documentEntries.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDocumentRow(entry.id)}
                            className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10 transition-all"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <AddableSelect 
                          label="Document Type"
                          tableName="hr_document_types"
                          value={entry.type}
                          onChange={(val) => handleEntryChange(entry.id, 'type', val)}
                          required
                        />
                        <div className="space-y-1">
                          <label htmlFor={`expiry-date-${entry.id}`} className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Expiry Date</label>
                          <input 
                            id={`expiry-date-${entry.id}`}
                            title="Expiry Date"
                            required 
                            type="date" 
                            className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                            value={entry.expiry_date}
                            onChange={(e) => handleEntryChange(entry.id, 'expiry_date', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label htmlFor={`document-url-${entry.id}`} className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Document Link</label>
                          <div className="relative">
                            <ExternalLink size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                              id={`document-url-${entry.id}`}
                              type="url"
                              title="Document Link"
                              placeholder="https://..."
                              className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl py-3 pl-10 pr-3 text-sm focus:ring-2 focus:ring-brand-purple outline-none"
                              value={entry.document_url}
                              onChange={(e) => handleEntryChange(entry.id, 'document_url', e.target.value)}
                            />
                          </div>
                        </div>

                        <label className="p-5 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center text-center bg-white dark:bg-white/2 hover:border-brand-purple/40 transition-all cursor-pointer group min-h-[138px]">
                          {entry.file ? (
                            <>
                              <FileCheck size={30} className="text-emerald-500 mb-2" />
                              <p className="text-xs font-bold text-gray-700 dark:text-gray-300 break-all">{entry.file.name}</p>
                              <p className="text-[10px] text-gray-500 mt-1">{(entry.file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </>
                          ) : (
                            <>
                              <Upload size={30} className="mx-auto text-gray-300 group-hover:text-brand-purple transition-colors bg-gray-50 dark:bg-white/5 p-2 rounded-lg shadow-sm mb-2" />
                              <p className="text-xs font-bold text-gray-400 group-hover:text-brand-purple transition-colors">Click to attach a file</p>
                              <p className="text-[10px] text-gray-300 mt-1 font-black uppercase tracking-widest leading-none">PDF or Image</p>
                            </>
                          )}
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,image/*"
                            onChange={(e) => handleEntryFileChange(entry.id, e.target.files?.[0] || null)}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddDocumentRow}
                  className="w-full md:w-auto px-5 py-3 rounded-2xl border border-brand-purple/30 bg-brand-purple/5 text-brand-purple text-xs font-black uppercase tracking-widest hover:bg-brand-purple hover:text-white transition-all"
                >
                  Add Another Document
                </button>

                <div className="flex justify-end gap-3 pt-6">
                  <button type="button" onClick={resetUploadForm} className="px-6 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all">Cancel</button>
                  <button type="submit" disabled={loading || uploadProgress} className="px-6 py-2 bg-brand-purple text-white text-sm font-bold rounded-xl hover:bg-opacity-90 transition shadow-lg shadow-brand-purple/20">
                    {uploadProgress ? 'Uploading...' : (loading ? 'Processing...' : `Save ${documentEntries.length > 1 ? `${documentEntries.length} Documents` : 'Document'}`)}
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

export default ComplianceHub;
