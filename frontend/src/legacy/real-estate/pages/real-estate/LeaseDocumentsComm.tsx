// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { FileText, Plus, Search, Send, XCircle, User, Building2 } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import { sendBulkEmail } from '../../services/resendService';
import { sendBulkSms } from '../../services/SMSService';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { getTenantDisplayName } from '../../utils/tenantDisplay';

interface Tenant {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
}

interface Property {
  id: string;
  name: string;
}

interface LeaseComm {
  id: string;
  subject: string;
  message: string;
  channel: string;
  recipient_type: string;
  status: string;
  sent_at: string;
  tenant_id?: string | null;
  property_id?: string | null;
  tenant?: { full_name: string } | null;
  property?: { name: string } | null;
}

const emptyForm = {
  tenant_id: '',
  property_id: '',
  channel: 'email',
  message: '',
  document_type: 'lease_renewal',
};

export default function LeaseDocumentsComm() {
  const { profile } = useAccess();
  const [comms, setComms] = useState<LeaseComm[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(emptyForm);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [commRes, tenRes, propRes] = await Promise.all([
        supabase
          .from('re_communication')
          .select('id, subject, message, channel, recipient_type, status, sent_at, tenant_id, property_id')
          .ilike('subject', '%lease%')
          .order('sent_at', { ascending: false }),
        supabase.from('re_tenants').select('id, full_name, email, phone').eq('is_active', true).order('full_name'),
        supabase.from('re_properties').select('id, name').order('name'),
      ]);
      if (commRes.error) throw commRes.error;
      const tenantMap = new Map((tenRes.data || []).map((tenant: Tenant) => [tenant.id, tenant]));
      const propertyMap = new Map((propRes.data || []).map((property: Property) => [property.id, property]));
      setComms((commRes.data || []).map((comm: LeaseComm) => ({
        ...comm,
        tenant: comm.tenant_id ? (tenantMap.get(comm.tenant_id) ? { full_name: tenantMap.get(comm.tenant_id)!.full_name } : null) : null,
        property: comm.property_id ? (propertyMap.get(comm.property_id) ? { name: propertyMap.get(comm.property_id)!.name } : null) : null,
      })));
      setTenants(tenRes.data || []);
      setProperties(propRes.data || []);
    } catch {
      setToast({ message: 'Failed to load lease communications', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (profile) fetchData(); }, [profile]);

  const docTypeLabels: Record<string, string> = {
    lease_renewal: 'Lease Renewal',
    lease_termination: 'Lease Termination',
    lease_amendment: 'Lease Amendment',
    new_lease: 'New Lease',
    lease_reminder: 'Lease Expiry Reminder',
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.message.trim()) {
      setToast({ message: 'Message is required', type: 'warning' });
      return;
    }
    setIsSubmitting(true);
    try {
      const tenant = tenants.find(t => t.id === formData.tenant_id);
      const docLabel = docTypeLabels[formData.document_type] || formData.document_type;
      const subject = `Lease Document: ${docLabel}${tenant ? ` — ${getTenantDisplayName(tenant as any)}` : ''}`;
      
      // Perform Actual Send
      if (formData.channel === 'email' || formData.channel === 'both') {
        const recipients = tenant ? [tenant.email] : tenants.map(t => t.email).filter(e => e && e.includes('@'));
        if (recipients.length > 0) {
          await sendBulkEmail(recipients as string[], subject, formData.message);
        }
      }
      
      if (formData.channel === 'sms' || formData.channel === 'both') {
        const recipients = tenant ? [tenant.phone] : tenants.map(t => t.phone).filter(p => p && p.length >= 9);
        if (recipients.length > 0) {
          await sendBulkSms(recipients as string[], formData.message);
        }
      }

      const { error } = await supabase.from('re_communication').insert([{
        subject: subject,
        message: formData.message,
        channel: formData.channel,
        recipient_type: formData.tenant_id ? 'individual' : 'all_tenants',
        tenant_id: formData.tenant_id || null,
        property_id: formData.property_id || null,
        status: 'sent',
        sent_by: profile?.id,
        company_id: profile?.company_id,
      }]);
      if (error) throw error;
      setToast({ message: 'Lease document communication sent via ' + formData.channel.toUpperCase(), type: 'success' });
      setShowModal(false);
      setFormData(emptyForm);
      fetchData();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to send', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = comms.filter(c =>
    c.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.tenant?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const inputCls = 'w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple outline-none';

  const channelBadge = (channel: string) => {
    const cls: Record<string, string> = {
      sms: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30',
      email: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30',
      both: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/30',
    };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${cls[channel] || ''}`}>{channel}</span>;
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
              <FileText className="mr-3 text-brand-purple" size={32} />
              Lease Documents Communication
            </h1>
            <p className="text-gray-500 dark:text-gray-400">Send and track lease-related document communications to tenants.</p>
          </div>
          <button onClick={() => setShowModal(true)} title="Compose and send a new lease document communication" className="px-4 py-2 bg-brand-purple text-white rounded-lg font-medium hover:bg-brand-pink transition-colors flex items-center shadow-sm">
            <Plus size={18} className="mr-2" /> Send Document
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {['lease renewal', 'lease termination', 'lease reminder'].map(keyword => {
            const count = comms.filter(c => c.subject.toLowerCase().includes(keyword)).length;
            return (
              <div key={keyword} className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-purple/10 rounded-xl flex items-center justify-center text-brand-purple"><FileText size={18} /></div>
                <div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{count}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{keyword}s</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="relative mb-6">
          <label htmlFor="loan-comm-search" className="sr-only">Search lease communications by subject or tenant name</label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" id="loan-comm-search" placeholder="Search lease communications..." title="Search for lease communications by subject or tenant name" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 pl-10 pr-4 py-2.5 rounded-lg outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple" />
        </div>

        {/* List */}
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center"><CustomLoader size={32} label="Loading..." /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <FileText size={40} className="text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Lease Communications</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">Send lease documents to tenants using the button above.</p>
              <button onClick={() => setShowModal(true)} title="Send your first lease document" className="px-4 py-2 bg-brand-purple text-white rounded-lg hover:bg-brand-pink transition-colors">Send Document</button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-white/10">
              {filtered.map(c => (
                <div key={c.id} className="p-5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-brand-purple/10 rounded-full flex items-center justify-center text-brand-purple flex-shrink-0 mt-0.5">
                        <FileText size={18} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{c.subject}</p>
                        {c.tenant && <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5"><User size={12} />{getTenantDisplayName(c.tenant as any)}</p>}
                        {c.property && <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1"><Building2 size={12} />{c.property.name}</p>}
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{c.message}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {channelBadge(c.channel)}
                      <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(c.sent_at).toLocaleDateString()}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30">{c.status}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center"><FileText className="mr-2 text-brand-purple" size={20} /> Send Lease Document</h2>
              <button onClick={() => setShowModal(false)} title="Close send document modal" className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><XCircle size={24} /></button>
            </div>
            <form onSubmit={handleSend} className="p-6 space-y-4">
              <div>
                <label htmlFor="doc-type" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Document Type</label>
                <select id="doc-type" value={formData.document_type} onChange={e => setFormData({...formData, document_type: e.target.value})} className={inputCls}>
                  {Object.entries(docTypeLabels).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="comm-tenant" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Tenant</label>
                  <select id="comm-tenant" value={formData.tenant_id} onChange={e => setFormData({...formData, tenant_id: e.target.value})} className={inputCls}>
                    <option value="">-- All Tenants --</option>
                    {tenants.map(t => <option key={t.id} value={t.id}>{getTenantDisplayName(t as any)}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="comm-property" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Property</label>
                  <select id="comm-property" value={formData.property_id} onChange={e => setFormData({...formData, property_id: e.target.value})} className={inputCls}>
                    <option value="">-- All --</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="comm-channel" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Channel</label>
                <select id="comm-channel" value={formData.channel} onChange={e => setFormData({...formData, channel: e.target.value})} className={inputCls}>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="both">SMS & Email</option>
                </select>
              </div>
              <div>
                <label htmlFor="comm-message" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Message *</label>
                <textarea id="comm-message" required rows={4} value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})}
                  placeholder="Dear Tenant, please find attached your lease renewal document..." className={`${inputCls} resize-none`} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition-colors font-semibold">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-8 py-2.5 bg-brand-purple text-white rounded-xl hover:bg-brand-pink transition-all font-semibold shadow-lg shadow-brand-purple/20 flex items-center disabled:opacity-50">
                  {isSubmitting ? <><CustomLoader size={18} className="mr-2" />Sending...</> : <><Send size={16} className="mr-2" />Send</>}
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
