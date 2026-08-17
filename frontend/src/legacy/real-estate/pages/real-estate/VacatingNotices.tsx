// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { LogOut, Plus, Search, Send, XCircle, User, MessageSquare, Calendar, Building2, Users } from 'lucide-react';
import { activityLogger } from '../../utils/activityLogger';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { getTenantDisplayName } from '../../utils/tenantDisplay';

interface Tenant {
  id: string;
  full_name: string | null;
}

interface Property {
  id: string;
  name: string;
}

interface VacatingNotice {
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
  channel: 'sms',
  message: '',
  recipient_type: 'individual',
};

export default function VacatingNotices() {
  const { profile } = useAccess();
  const [notices, setNotices] = useState<VacatingNotice[]>([]);
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
      const [notRes, tenRes, propRes] = await Promise.all([
        supabase
          .from('re_communication')
          .select('id, subject, message, channel, recipient_type, status, sent_at, tenant_id, property_id')
          .ilike('subject', '%vacating%')
          .order('sent_at', { ascending: false }),
        supabase.from('re_tenants').select('id, full_name').eq('is_active', true).order('full_name'),
        supabase.from('re_properties').select('id, name').order('name'),
      ]);
      if (notRes.error) throw notRes.error;
      const tenantMap = new Map((tenRes.data || []).map((tenant: Tenant) => [tenant.id, tenant]));
      const propertyMap = new Map((propRes.data || []).map((property: Property) => [property.id, property]));
      setNotices((notRes.data || []).map((notice: VacatingNotice) => ({
        ...notice,
        tenant: notice.tenant_id ? (tenantMap.get(notice.tenant_id) ? { full_name: tenantMap.get(notice.tenant_id)!.full_name } : null) : null,
        property: notice.property_id ? (propertyMap.get(notice.property_id) ? { name: propertyMap.get(notice.property_id)!.name } : null) : null,
      })));
      setTenants(tenRes.data || []);
      setProperties(propRes.data || []);
    } catch {
      setToast({ message: 'Failed to load notices', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (profile) fetchData(); }, [profile]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.message.trim()) {
      setToast({ message: 'Message is required', type: 'warning' });
      return;
    }
    setIsSubmitting(true);
    try {
      const tenant = tenants.find(t => t.id === formData.tenant_id);
      const { error } = await supabase.from('re_communication').insert([{
        subject: formData.recipient_type === 'individual' ? `Vacating Notice — ${tenant?.full_name}` : `Bulk Vacating Notice — ${formData.recipient_type}`,
        message: formData.message,
        channel: formData.channel,
        recipient_type: formData.recipient_type,
        tenant_id: formData.recipient_type === 'individual' ? formData.tenant_id : null,
        property_id: formData.recipient_type === 'property_tenants' ? formData.property_id : null,
        status: 'sent',
        sent_by: profile?.id,
        company_id: profile?.company_id,
      }]);
      if (error) throw error;

      // Log to Global Communication History
      await supabase.from('communication_history').insert([{
        sender_id: profile?.id,
        recipient: formData.recipient_type === 'individual' ? (tenant ? getTenantDisplayName(tenant as any) : 'Individual Tenant') : `Bulk: ${formData.recipient_type}`,
        channel: formData.channel,
        content: formData.message,
        status: 'sent',
        module: 'real_estate',
        metadata: { 
          recipient_type: formData.recipient_type, 
          property_id: formData.property_id === '' ? null : formData.property_id
        }
      }]);

      await activityLogger.log({
        resourceId: formData.tenant_id || formData.property_id || 'bulk',
        resourceType: 'communication',
        actionType: 'sent',
        actionCategory: 'real_estate',
        description: `Sent ${formData.recipient_type} vacating notice via ${formData.channel}`,
        metadata: { ...formData }
      });
      setToast({ message: 'Vacating notice sent!', type: 'success' });
      setShowModal(false);
      setFormData(emptyForm);
      fetchData();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to send notice', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = notices.filter(n =>
    n.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (n.tenant ? getTenantDisplayName(n.tenant as any).toLowerCase() : '').includes(searchTerm.toLowerCase())
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
              <LogOut className="mr-3 text-brand-purple" size={32} />
              Vacating Notices
            </h1>
            <p className="text-gray-500 dark:text-gray-400">Send and track vacating notices to tenants.</p>
          </div>
          <button onClick={() => setShowModal(true)} title="Open modal to send a new vacating notice" className="px-4 py-2 bg-brand-purple text-white rounded-lg font-medium hover:bg-brand-pink transition-colors flex items-center shadow-sm">
            <Plus size={18} className="mr-2" /> Send Notice
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            id="vacating-search"
            type="text" 
            placeholder="Search notices..." 
            title="Search vacating notices" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 pl-10 pr-4 py-2.5 rounded-lg outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple" 
          />
        </div>

        {/* List */}
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center"><CustomLoader size={32} label="Loading notices..." /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center">
              <LogOut size={40} className="text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Vacating Notices</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">Send a notice using the button above.</p>
              <button onClick={() => setShowModal(true)} title="Send a new notice" className="px-4 py-2 bg-brand-purple text-white rounded-lg hover:bg-brand-pink transition-colors">Send Notice</button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-white/10">
              {filtered.map(n => (
                <div key={n.id} className="p-5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5">
                        <LogOut size={18} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{n.subject}</p>
                        {n.tenant && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5"><User size={12} />{getTenantDisplayName(n.tenant as any)}</p>
                        )}
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{n.message}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {channelBadge(n.channel)}
                      <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(n.sent_at).toLocaleDateString()}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase border bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30">{n.status}</span>
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
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center"><LogOut className="mr-2 text-brand-purple" size={20} /> Send Vacating Notice</h2>
              <button onClick={() => setShowModal(false)} title="Close modal" className="text-gray-400 hover:text-gray-600 dark:hover:text-white"><XCircle size={24} /></button>
            </div>
            <form onSubmit={handleSend} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 text-[10px] uppercase font-black text-gray-400">Target Segment</label>
                <div className="flex bg-gray-50 dark:bg-black/20 p-1 rounded-xl border border-gray-200 dark:border-white/10 mb-4">
                  {(['individual', 'property_tenants', 'all_tenants'] as const).map((type) => (
                    <button 
                      key={type}
                      type="button"
                      onClick={() => setFormData({...formData, recipient_type: type})}
                      title={`Send to ${type.replace('_', ' ')}`}
                      className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${formData.recipient_type === type ? 'bg-brand-purple text-white shadow-sm' : 'text-gray-400'}`}
                    >
                      {type.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {formData.recipient_type === 'individual' && (
                <div>
                  <label htmlFor="notice-tenant" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Select Tenant</label>
                  <select id="notice-tenant" required value={formData.tenant_id} onChange={e => setFormData({...formData, tenant_id: e.target.value})} title="Select tenant recipient" className={inputCls}>
                    <option value="">-- Choose Tenant --</option>
                    {tenants.map(t => <option key={t.id} value={t.id}>{getTenantDisplayName(t as any)}</option>)}
                  </select>
                </div>
              )}

              {formData.recipient_type === 'property_tenants' && (
                <div>
                  <label htmlFor="notice-property" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Select Property</label>
                  <select id="notice-property" required value={formData.property_id} onChange={e => setFormData({...formData, property_id: e.target.value})} title="Select property recipient" className={inputCls}>
                    <option value="">-- Choose Property --</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="notice-channel" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Channel</label>
                <select id="notice-channel" value={formData.channel} onChange={e => setFormData({...formData, channel: e.target.value})} title="Select communication channel" className={inputCls}>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                  <option value="both">SMS & Email</option>
                  <option value="in_app">In-App</option>
                </select>
              </div>
              <div>
                <label htmlFor="notice-message" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Message *</label>
                <textarea id="notice-message" required rows={4} value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})}
                  title="Notice message content"
                  placeholder="Dear Tenant, please be advised that your vacating date has been confirmed as..." className={`${inputCls} resize-none`} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition-colors font-semibold">Cancel</button>
                <button type="submit" disabled={isSubmitting} title="Send the vacating notice" className="px-8 py-2.5 bg-brand-purple text-white rounded-xl hover:bg-brand-pink transition-all font-semibold shadow-lg shadow-brand-purple/20 flex items-center disabled:opacity-50">
                  {isSubmitting ? <><CustomLoader size={18} className="mr-2" />Sending...</> : <><Send size={16} className="mr-2" />Send Notice</>}
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
