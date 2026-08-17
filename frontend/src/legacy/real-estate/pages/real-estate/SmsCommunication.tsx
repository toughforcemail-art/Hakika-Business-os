// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageSquare, Search, CheckSquare, Square, Send, Users, Info,
  AlertCircle, Smartphone, History, FileText, Building2
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import { sendBulkSms } from '../../services/SMSService';
import { sendBulkEmail } from '../../services/resendService';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { Mail } from 'lucide-react';
import { getTenantDisplayName } from '../../utils/tenantDisplay';

type Tab = 'all' | 'by_property' | 'send_invoices' | 'sent';
type Channel = 'sms' | 'whatsapp' | 'email';

// ── Sub-tab list ───────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'all', label: 'Send to All Tenants', icon: Users },
  { id: 'by_property', label: 'Send to Specific Property', icon: Building2 },
  { id: 'send_invoices', label: 'Send Invoices', icon: FileText },
  { id: 'sent', label: 'View All Sent', icon: History },
];

// ── Shared Composer + Tenant List ──────────────────────────────────────────
function ComposerPanel({
  label,
  tenants,
  selectedTenants,
  toggleTenant,
  toggleAll,
  channel,
  setChannel,
  message,
  setMessage,
  sending,
  handleSend,
  subject,
  setSubject,
  filterSlot,
}: {
  label: string;
  tenants: any[];
  selectedTenants: string[];
  toggleTenant: (id: string) => void;
  toggleAll: () => void;
  channel: Channel;
  setChannel: (c: Channel) => void;
  message: string;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  sending: boolean;
  handleSend: () => void;
  subject: string;
  setSubject: React.Dispatch<React.SetStateAction<string>>;
  filterSlot?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left: Recipients */}
      <div className="lg:col-span-1">
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden flex flex-col h-[560px]">
          <div className="p-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Users size={18} className="text-brand-purple" />
              Recipients ({selectedTenants.length})
            </h3>
            <button onClick={toggleAll} className="text-xs text-brand-purple font-medium hover:underline">
              {selectedTenants.length === tenants.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          {filterSlot && <div className="p-3 bg-gray-50 dark:bg-black/20 border-b border-gray-100 dark:border-white/5">{filterSlot}</div>}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-white/5">
            {tenants.length > 0 ? tenants.map(t => (
              <label
                key={t.id}
                className={`w-full text-left p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-3 ${selectedTenants.includes(t.id) ? 'bg-brand-purple/5 dark:bg-brand-purple/10 border-l-4 border-brand-purple' : 'border-l-4 border-transparent'}`}
                title={`Select ${getTenantDisplayName(t as any)}`}
              >
                <input 
                  type="checkbox"
                  className="sr-only"
                  checked={selectedTenants.includes(t.id)}
                  onChange={() => toggleTenant(t.id)}
                />
                {selectedTenants.includes(t.id)
                  ? <CheckSquare className="text-brand-purple shrink-0" size={18} />
                  : <Square className="text-gray-300 shrink-0" size={18} />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{getTenantDisplayName(t as any)}</p>
                  <p className="text-xs text-gray-500 truncate">{t.phone || 'No phone number'}</p>
                  {t.property_name && <p className="text-[10px] text-brand-purple/70 font-medium uppercase mt-0.5">{t.property_name} – Unit {t.unit_number}</p>}
                </div>
              </label>
            )) : <div className="p-8 text-center text-gray-400 text-sm">No tenants found</div>}
          </div>
        </div>
      </div>

      {/* Right: Composer */}
      <div className="lg:col-span-2 flex flex-col gap-4">
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 shadow-sm p-6 flex flex-col gap-5 h-[560px]">
          {/* Channel selector */}
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-black/20 p-1.5 rounded-xl border border-gray-200 dark:border-white/10 w-fit">
            <button onClick={() => setChannel('sms')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${channel === 'sms' ? 'bg-white dark:bg-dark-surface text-brand-purple shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
              <Smartphone size={16} /> SMS Text
            </button>
            <button onClick={() => setChannel('whatsapp')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${channel === 'whatsapp' ? 'bg-[#25D366] text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
              <MessageSquare size={16} /> WhatsApp
            </button>
            <button onClick={() => setChannel('email')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${channel === 'email' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>
              <Mail size={16} /> Email
            </button>
          </div>

          {/* Subject Field for Email */}
          {channel === 'email' && (
            <div className="flex flex-col gap-1.5 animate-fade-in">
              <label htmlFor="email-subject" className="text-sm font-medium text-gray-700 dark:text-gray-300">Email Subject</label>
              <input
                id="email-subject"
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Type your email subject here..."
                className="w-full px-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple text-gray-900 dark:text-white shadow-inner"
              />
            </div>
          )}

          {/* Message */}
          <div className="flex-1 flex flex-col">
            <div className="flex justify-between items-end mb-1.5">
              <label htmlFor="message-content" className="text-sm font-medium text-gray-700 dark:text-gray-300">Message Content</label>
              <span className={`text-xs ${message.length > 160 && channel === 'sms' ? 'text-orange-500 font-bold' : 'text-gray-400'}`}>
                {message.length} chars {channel === 'sms' && message.length > 160 && '(Multiple SMS segments)'}
              </span>
            </div>
            <textarea
              id="message-content"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={`Type your ${channel === 'sms' ? 'text' : 'WhatsApp'} message here...`}
              className="flex-1 w-full px-4 py-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple text-gray-900 dark:text-white resize-none shadow-inner min-h-[200px]"
            />
            <div className="flex gap-2 mt-2 flex-wrap">
              {['{TenantName}', '{UnitNo}', '{Balance}', '{Invoice}'].map(p => (
                <button key={p} type="button" onClick={() => setMessage(prev => prev + ` ${p} `)} className="text-xs bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-gray-300 px-2 py-1 rounded transition-colors">
                  + {p}
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-400 text-xs">
              <Info size={14} />
              <span>~Ksh {channel === 'sms' ? selectedTenants.length * 1 : selectedTenants.length * 2.5} est. cost</span>
            </div>
            <button
              onClick={handleSend}
              disabled={sending || !selectedTenants.length}
              className={`px-8 py-3 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg disabled:opacity-50 disabled:shadow-none ${channel === 'whatsapp' ? 'bg-[#25D366] hover:bg-[#20bd5a] shadow-[#25D366]/20' : channel === 'email' ? 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20' : 'bg-brand-purple hover:bg-brand-pink shadow-brand-purple/20'}`}
            >
              {sending ? <CustomLoader size={20} /> : <Send size={20} />}
              {sending ? 'Sending...' : `Send ${channel === 'sms' ? 'SMS' : channel === 'whatsapp' ? 'WhatsApp' : 'Email'} Now`}
            </button>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/20 p-4 rounded-xl flex gap-3">
          <AlertCircle className="text-blue-500 shrink-0" size={20} />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Pro Tip:</strong> Use placeholders like <code>{'{TenantName}'}</code> or <code>{'{Balance}'}</code> to personalize messages. The system automatically replaces them per recipient.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function SmsCommunication() {
  const { profile } = useAccess();
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [channel, setChannel] = useState<Channel>('sms');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const [tenants, setTenants] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [sentMessages, setSentMessages] = useState<any[]>([]);
  const [loadingSent, setLoadingSent] = useState(false);

  useEffect(() => { if (profile) fetchData(); }, [profile]);
  useEffect(() => { if (activeTab === 'sent' && profile) fetchSent(); }, [activeTab, profile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [{ data: tenRes }, { data: unitRes }, { data: propRes }] = await Promise.all([
        supabase.from('re_tenants').select('id, full_name, phone, current_unit_id, profile:profiles(full_name, email)').eq('is_active', true).order('full_name'),
        supabase.from('re_units').select('id, unit_number, property_id'),
        supabase.from('re_properties').select('id, name'),
      ]);
      setTenants(tenRes || []); setUnits(unitRes || []); setProperties(propRes || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchSent = async () => {
    setLoadingSent(true);
    try {
      const { data, error } = await supabase
        .from('re_communication')
        .select('*, tenant:re_tenants(full_name, phone, profile:profiles(full_name, email))')
        .in('channel', ['sms', 'whatsapp', 'email'])
        .order('sent_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      setSentMessages(data || []);
    } catch (err) { console.error(err); }
    finally { setLoadingSent(false); }
  };

  // Tag each tenant with their property/unit info
  const enrichedTenants = useMemo(() => {
    return tenants.map(t => {
      const unit = units.find(u => u.id === t.current_unit_id);
      const property = properties.find(p => p.id === unit?.property_id);
      return { ...t, unit_number: unit?.unit_number, property_name: property?.name, property_id: unit?.property_id };
    });
  }, [tenants, units, properties]);

  // Filtered tenant list based on active tab + search
  const filteredTenants = useMemo(() => {
    let base = enrichedTenants;

    if (activeTab === 'by_property' || activeTab === 'send_invoices') {
      if (propertyFilter !== 'all') base = base.filter(t => t.property_id === propertyFilter);
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      base = base.filter(t => getTenantDisplayName(t as any).toLowerCase().includes(q) || (t.phone && t.phone.includes(q)));
    }
    return base;
  }, [enrichedTenants, activeTab, propertyFilter, searchTerm]);

  const toggleTenant = (id: string) => setSelectedTenants(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  const toggleAll = () => {
    if (selectedTenants.length === filteredTenants.length) setSelectedTenants([]);
    else setSelectedTenants(filteredTenants.map(t => t.id));
  };

  const handleSend = async () => {
    if (!selectedTenants.length) { setToast({ message: 'Select at least one tenant', type: 'warning' }); return; }
    if (!message.trim()) { setToast({ message: 'Message content is required', type: 'warning' }); return; }

    setSending(true);
    const phones = tenants.filter(t => selectedTenants.includes(t.id)).map(t => t.phone).filter(p => p && p.length >= 9);

    if (!phones.length && channel !== 'email') {
      setToast({ message: 'Selected tenants have no valid phone numbers', type: 'error' });
      setSending(false); return;
    }

    const emails = tenants
      .filter(t => selectedTenants.includes(t.id))
      .map(t => t.email)
      .filter(e => e && e.includes('@'));

    if (!emails.length && channel === 'email') {
      setToast({ message: 'Selected tenants have no valid email addresses', type: 'error' });
      setSending(false); return;
    }

    if (channel === 'email' && !subject.trim()) {
      setToast({ message: 'Subject is required for email', type: 'warning' });
      setSending(false); return;
    }

    let success = false;
    let error: unknown = null;
    try {
      const result = channel === 'email'
        ? await sendBulkEmail(emails, subject, message)
        : await sendBulkSms(phones, message, channel);
      success = Boolean((result as any)?.success ?? result);
      error = (result as any)?.error ?? null;
    } catch (err) {
      error = err;
    }

    if (success) {
      try {
        const payload = tenants
          .filter(t => selectedTenants.includes(t.id) && t.phone)
          .map(t => ({
            tenant_id: t.id,
            sender_id: profile?.id,
            channel,
            message_content: message,
            message_type: activeTab === 'send_invoices' ? 'invoice' : 'general',
            recipient_type: 'individual',
            status: 'sent',
            subject: channel === 'email' ? subject : null,
            sent_at: new Date().toISOString(),
          }));
        await supabase.from('re_communication').insert(payload);
        
        // Log to Global Communication History
        const globalPayload = tenants
          .filter(t => selectedTenants.includes(t.id) && (channel === 'email' ? t.email : t.phone))
          .map(t => ({
            sender_id: profile?.id,
            recipient: getTenantDisplayName(t as any),
            channel: channel,
            content: message,
            subject: channel === 'email' ? subject : null,
            status: 'sent',
            module: 'real_estate',
            metadata: { tenant_id: t.id, type: activeTab === 'send_invoices' ? 'invoice' : 'general' }
          }));
        await supabase.from('communication_history').insert(globalPayload);
      } catch (e) { console.error('Log error', e); }
      setToast({ message: `${channel.toUpperCase()} sent to ${channel === 'email' ? emails.length : phones.length} recipients`, type: 'success' });
      setMessage(''); setSubject(''); setSelectedTenants([]);
    } else {
      const errorMessage =
        error instanceof Error ? error.message :
        typeof error === 'string' ? error :
        `Failed to send ${channel.toUpperCase()}`;
      setToast({ message: errorMessage, type: 'error' });
      console.error('SMS/email send failed:', error);
    }
    setSending(false);
  };

  // ── Property filter slot for "by_property" and "send_invoices" tabs ──
  const propertyFilterSlot = (
    <select
      id="comm-property-filter"
      value={propertyFilter}
      onChange={e => { setPropertyFilter(e.target.value); setSelectedTenants([]); }}
      title="Filter tenants by property"
      className="w-full px-3 py-1.5 bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-purple text-gray-900 dark:text-white"
    >
      <option value="all">All Properties</option>
      {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );

  const searchSlot = (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
      <input
        id="comm-tenant-search"
        type="text"
        placeholder="Search tenants..."
        title="Search tenants by name or phone number"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-purple"
      />
    </div>
  );

  if (loading) return <div className="flex-1 p-8 flex items-center justify-center"><CustomLoader size={40} label="Loading SMS hub..." /></div>;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">

        {/* Page Header */}
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
          <MessageSquare className="mr-3 text-brand-purple" size={32} />
          Communications Hub
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Send bulk emails, SMS, WhatsApp messages, or invoices to your tenants. View your full history below.
        </p>

        {/* Sub-tabs */}
        <div className="flex gap-1 bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-1.5 mb-8 overflow-x-auto shadow-sm">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSelectedTenants([]); setSearchTerm(''); setPropertyFilter('all'); }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${active ? 'bg-brand-purple text-white shadow-md shadow-brand-purple/25' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5'}`}
              >
                <Icon size={16} /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ── */}

        {/* ALL TENANTS */}
        {activeTab === 'all' && (
          <ComposerPanel
            label="All Tenants"
            tenants={filteredTenants}
            selectedTenants={selectedTenants}
            toggleTenant={toggleTenant}
            toggleAll={toggleAll}
            channel={channel}
            setChannel={setChannel}
            message={message}
            setMessage={setMessage}
            subject={subject}
            setSubject={setSubject}
            sending={sending}
            handleSend={handleSend}
            filterSlot={searchSlot}
          />
        )}

        {/* BY PROPERTY */}
        {activeTab === 'by_property' && (
          <ComposerPanel
            label="Property Tenants"
            tenants={filteredTenants}
            selectedTenants={selectedTenants}
            toggleTenant={toggleTenant}
            toggleAll={toggleAll}
            channel={channel}
            setChannel={setChannel}
            message={message}
            setMessage={setMessage}
            subject={subject}
            setSubject={setSubject}
            sending={sending}
            handleSend={handleSend}
            filterSlot={
              <div className="space-y-2">
                {propertyFilterSlot}
                {searchSlot}
              </div>
            }
          />
        )}

        {/* SEND INVOICES */}
        {activeTab === 'send_invoices' && (
          <div className="space-y-6">
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/20 p-4 rounded-xl flex gap-3">
              <AlertCircle className="text-amber-500 shrink-0" size={20} />
              <div className="text-sm text-amber-800 dark:text-amber-300">
                <strong>Send Invoice Notifications</strong> — Select tenants and send them a notification that their invoice/statement is ready. Filter by property to target specific buildings.
              </div>
            </div>
            <ComposerPanel
              label="Invoice Recipients"
              tenants={filteredTenants}
              selectedTenants={selectedTenants}
              toggleTenant={toggleTenant}
              toggleAll={toggleAll}
              channel={channel}
              setChannel={setChannel}
              message={message}
              setMessage={setMessage}
              subject={subject}
              setSubject={setSubject}
              sending={sending}
              handleSend={handleSend}
              filterSlot={
                <div className="space-y-2">
                  {propertyFilterSlot}
                  {searchSlot}
                </div>
              }
            />
          </div>
        )}

        {/* VIEW ALL SENT */}
        {activeTab === 'sent' && (
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <History size={18} className="text-brand-purple" />
                All Sent Messages
              </h3>
              <span className="text-xs text-gray-400">{sentMessages.length} records</span>
            </div>

            {loadingSent ? (
              <div className="p-12 flex justify-center"><CustomLoader size={32} label="Loading message history..." /></div>
            ) : sentMessages.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-brand-purple/10 text-brand-purple rounded-full flex items-center justify-center mb-4 mx-auto">
                  <History size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Messages Sent Yet</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Messages you send will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                    <tr>
                      {['Date & Time', 'Recipient', 'Channel', 'Type', 'Message', 'Status'].map(h => (
                        <th key={h} className="px-6 py-3 font-medium text-gray-500 uppercase tracking-wider text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {sentMessages.map((msg) => (
                      <tr key={msg.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-6 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400 text-xs">
                          {new Date(msg.sent_at).toLocaleString('en-KE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-3">
                          <p className="font-bold text-gray-900 dark:text-white text-sm">{msg.tenant?.full_name || 'Unknown'}</p>
                          <p className="text-xs text-gray-400">{msg.tenant?.phone || '—'}</p>
                        </td>
                         <td className="px-6 py-3">
                          <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                            msg.channel === 'whatsapp' ? 'bg-[#25D366]/10 text-[#25D366]' : 
                            msg.channel === 'email' ? 'bg-blue-500/10 text-blue-500' : 'bg-brand-purple/10 text-brand-purple'
                          }`}>
                            {msg.channel}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <span className="capitalize text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-white/10 px-2 py-1 rounded">
                            {msg.message_type || 'general'}
                          </span>
                        </td>
                        <td className="px-6 py-3 max-w-xs">
                          <p className="text-sm text-gray-700 dark:text-gray-300 truncate" title={msg.message_content}>{msg.message_content}</p>
                        </td>
                        <td className="px-6 py-3">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${msg.status === 'sent' ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-gray-100 text-gray-500'}`}>
                            {msg.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      {toast && <CustomToast message={toast.message} type={toast.type} isVisible={!!toast} onClose={() => setToast(null)} />}
    </div>
  );
}
