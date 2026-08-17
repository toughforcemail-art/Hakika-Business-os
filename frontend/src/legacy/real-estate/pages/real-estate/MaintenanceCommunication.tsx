// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Building2,
  CalendarClock,
  CheckCircle2,
  History,
  Home,
  Mail,
  MessageSquare,
  Search,
  Send,
  Smartphone,
  User,
  Wrench,
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import { sendBulkEmail } from '../../services/resendService';
import { sendBulkSms } from '../../services/SMSService';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';

type Channel = 'email' | 'sms';
type StatusFilter = 'all' | 'open' | 'approved' | 'in_progress' | 'completed' | 'rejected';
type Ticket = { id: string; title: string; description: string | null; priority: string; status: string; property_id: string | null; unit_id: string | null; tenant_id: string | null; reported_by: string | null; created_by: string | null; scheduled_date: string | null; created_at: string; };
type EnrichedTicket = Ticket & { tenant_name: string; tenant_email: string | null; tenant_phone: string | null; property_name: string; unit_number: string; creator_name: string; };

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All tickets' },
  { id: 'open', label: 'Open' },
  { id: 'approved', label: 'Approved' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'rejected', label: 'Rejected' },
];

const templates = [
  { label: 'Scheduling update', detail: 'Confirm the visit window and access plan.', build: (t: EnrichedTicket) => `Hello ${t.tenant_name}, your maintenance request for Unit ${t.unit_number} at ${t.property_name} has been scheduled. We will share the confirmed visit window shortly.` },
  { label: 'Repair in progress', detail: 'Reassure the tenant while work is underway.', build: (t: EnrichedTicket) => `Hello ${t.tenant_name}, work is now in progress on "${t.title}" for Unit ${t.unit_number}. We are monitoring progress closely and will send the next update once the repair stage is complete.` },
  { label: 'Parts follow-up', detail: 'Explain the delay while preserving trust.', build: (t: EnrichedTicket) => `Hello ${t.tenant_name}, we have reviewed the maintenance issue in Unit ${t.unit_number}. Additional parts or specialist follow-up are required, and we are tracking the next step closely.` },
  { label: 'Completion check-in', detail: 'Close the loop and invite feedback.', build: (t: EnrichedTicket) => `Hello ${t.tenant_name}, the maintenance request "${t.title}" for Unit ${t.unit_number} has been marked complete. Please reply if anything still needs attention so we can follow up quickly.` },
];

const fmt = (v?: string | null, time = false) => !v ? 'Not scheduled' : new Date(v).toLocaleString('en-KE', time ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short', year: 'numeric' });
const clean = (v?: string) => (v || '').replace(/_/g, ' ');
const priorityCls = (v?: string) => v === 'emergency' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/30' : v === 'high' ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800/30' : v === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/30' : 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800/30';
const statusCls = (v?: string) => v === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/30' : v === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/30' : v === 'approved' ? 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800/30' : v === 'rejected' ? 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-700' : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/30';

export default function MaintenanceCommunication() {
  const { profile } = useAccess();
  const [searchParams] = useSearchParams();
  const requestedTicketId = searchParams.get('ticket');
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [channel, setChannel] = useState<Channel>('email');
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => { if (profile?.id) void fetchData(); }, [profile?.id, profile?.company_id]);

  async function fetchData() {
    setLoading(true);
    try {
      const companyId = profile?.company_id;
      let ticketQ = supabase.from('re_maintenance').select('*').order('created_at', { ascending: false });
      let tenantQ = supabase.from('re_tenants').select('id, full_name, email, phone');
      let unitQ = supabase.from('re_units').select('id, unit_number, property_id');
      let propertyQ = supabase.from('re_properties').select('id, name').order('name');
      let staffQ = supabase.from('profiles').select('id, full_name').order('full_name');
      if (companyId) {
        ticketQ = ticketQ.eq('company_id', companyId);
        tenantQ = tenantQ.eq('company_id', companyId);
        unitQ = unitQ.eq('company_id', companyId);
        propertyQ = propertyQ.eq('company_id', companyId);
        staffQ = staffQ.eq('company_id', companyId);
      }
      const [a, b, c, d, e] = await Promise.all([ticketQ, tenantQ, unitQ, propertyQ, staffQ]);
      setTickets((a.data || []) as Ticket[]);
      setTenants(b.data || []);
      setUnits(c.data || []);
      setProperties(d.data || []);
      setStaff(e.data || []);
    } catch (error) {
      console.error(error);
      setToast({ message: 'Failed to load maintenance communication data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  const ticketData = useMemo<EnrichedTicket[]>(() => tickets.map((ticket) => {
    const tenant = tenants.find((x) => x.id === ticket.tenant_id);
    const unit = units.find((x) => x.id === ticket.unit_id);
    const property = properties.find((x) => x.id === (ticket.property_id || unit?.property_id || ''));
    const creator = staff.find((x) => x.id === ticket.created_by || x.id === ticket.reported_by);
    return { ...ticket, tenant_name: tenant?.full_name || 'Tenant not linked', tenant_email: tenant?.email || null, tenant_phone: tenant?.phone || null, property_name: property?.name || 'Unknown property', unit_number: unit?.unit_number || 'N/A', creator_name: creator?.full_name || 'Operations team' };
  }), [tickets, tenants, units, properties, staff]);

  const filteredTickets = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return ticketData.filter((t) => (statusFilter === 'all' || t.status === statusFilter) && (!q || t.title.toLowerCase().includes(q) || t.tenant_name.toLowerCase().includes(q) || t.property_name.toLowerCase().includes(q) || t.unit_number.toLowerCase().includes(q)));
  }, [ticketData, searchTerm, statusFilter]);

  useEffect(() => {
    if (!requestedTicketId || !ticketData.length) return;
    const requested = ticketData.find((ticket) => ticket.id === requestedTicketId);
    if (!requested) return;
    setSearchTerm('');
    setStatusFilter('all');
    setSelectedTicketId(requested.id);
  }, [requestedTicketId, ticketData]);

  useEffect(() => {
    if (!filteredTickets.length) return void setSelectedTicketId(null);
    if (!filteredTickets.some((ticket) => ticket.id === selectedTicketId)) setSelectedTicketId(filteredTickets[0].id);
  }, [filteredTickets, selectedTicketId]);

  const selectedTicket = filteredTickets.find((ticket) => ticket.id === selectedTicketId) || null;
  const metrics = useMemo(() => ({ open: ticketData.filter((t) => t.status === 'open').length, active: ticketData.filter((t) => t.status === 'in_progress').length, completed: ticketData.filter((t) => t.status === 'completed').length, risk: ticketData.filter((t) => !t.tenant_email && !t.tenant_phone).length }), [ticketData]);

  useEffect(() => { if (selectedTicketId) void fetchHistory(selectedTicketId); else setHistory([]); }, [selectedTicketId, profile?.company_id]);

  async function fetchHistory(ticketId: string) {
    setLoadingHistory(true);
    try {
      let query = supabase.from('re_communication').select('id, message, channel, sent_at, sent_by').eq('maintenance_id', ticketId).order('sent_at', { ascending: true });
      if (profile?.company_id) query = query.eq('company_id', profile.company_id);
      const { data, error } = await query;
      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error(error);
      setToast({ message: 'Failed to load maintenance history', type: 'error' });
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleSend() {
    if (!selectedTicket) return setToast({ message: 'Select a maintenance ticket first', type: 'warning' });
    if (!message.trim()) return setToast({ message: 'Write an update before sending', type: 'warning' });
    setSending(true);
    try {
      if (channel === 'email') {
        if (!selectedTicket.tenant_email) return setToast({ message: 'This tenant does not have an email address on file', type: 'error' });
        const { success } = await sendBulkEmail([selectedTicket.tenant_email], `Maintenance update: ${selectedTicket.title}`, `Hello ${selectedTicket.tenant_name},\n\n${message.trim()}\n\nProperty: ${selectedTicket.property_name}\nUnit: ${selectedTicket.unit_number}\n\nThank you.`);
        if (!success) throw new Error('Email failed');
      } else {
        if (!selectedTicket.tenant_phone) return setToast({ message: 'This tenant does not have a phone number on file', type: 'error' });
        const { success } = await sendBulkSms([selectedTicket.tenant_phone], `Maintenance update for Unit ${selectedTicket.unit_number}: ${message.trim()}`);
        if (!success) throw new Error('SMS failed');
      }

      const { error } = await supabase.from('re_communication').insert([{ company_id: profile?.company_id, subject: `Maintenance update: ${selectedTicket.title}`, message: message.trim(), recipient_type: 'individual', tenant_id: selectedTicket.tenant_id, unit_id: selectedTicket.unit_id, property_id: selectedTicket.property_id, channel, maintenance_id: selectedTicket.id, sent_by: profile?.id, status: 'sent', sent_at: new Date().toISOString() }]);
      if (error) throw error;
      setToast({ message: `${channel.toUpperCase()} update sent successfully`, type: 'success' });
      setMessage('');
      await fetchHistory(selectedTicket.id);
    } catch (error) {
      console.error(error);
      setToast({ message: `Failed to send ${channel.toUpperCase()} update`, type: 'error' });
    } finally {
      setSending(false);
    }
  }

  if (loading) return <div className="flex-1 p-8 flex items-center justify-center"><CustomLoader size={40} label="Loading maintenance communication workspace..." /></div>;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center"><MessageSquare className="mr-3 text-brand-purple" size={32} />Maintenance Communications</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Review maintenance tickets, open one conversation at a time, and send tenant updates from the same reply workspace.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {[{ label: 'Open Queue', value: metrics.open, icon: MessageSquare, tone: 'text-amber-500' }, { label: 'In Progress', value: metrics.active, icon: Wrench, tone: 'text-blue-500' }, { label: 'Completed', value: metrics.completed, icon: CheckCircle2, tone: 'text-emerald-500' }, { label: 'Contact Risk', value: metrics.risk, icon: AlertCircle, tone: 'text-rose-500' }].map((item) => (
            <div key={item.label} className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-4 flex items-center gap-3 shadow-sm">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gray-50 dark:bg-black/20 ${item.tone}`}><item.icon size={18} /></div>
              <div><p className="text-2xl font-bold text-gray-900 dark:text-white">{item.value}</p><p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{item.label}</p></div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden flex flex-col h-[560px]">
              <div className="p-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Wrench size={18} className="text-brand-purple" />Maintenance Tickets ({filteredTickets.length})</h3>
                {selectedTicket && <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase border ${statusCls(selectedTicket.status)}`}>{clean(selectedTicket.status)}</span>}
              </div>
              <div className="p-3 bg-gray-50 dark:bg-black/20 border-b border-gray-100 dark:border-white/5 space-y-2">
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} /><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search tickets..." className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-purple" /></div>
                <div className="flex flex-wrap gap-2">{FILTERS.map((item) => <button key={item.id} type="button" onClick={() => setStatusFilter(item.id)} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${statusFilter === item.id ? 'bg-brand-purple text-white shadow-sm' : 'bg-white dark:bg-dark-surface text-gray-500 border border-gray-200 dark:border-white/10 hover:text-brand-purple'}`}>{item.label}</button>)}</div>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-white/5">
                {filteredTickets.length > 0 ? filteredTickets.map((ticket) => (
                  <button key={ticket.id} type="button" onClick={() => setSelectedTicketId(ticket.id)} className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-l-4 ${selectedTicketId === ticket.id ? 'bg-brand-purple/5 dark:bg-brand-purple/10 border-brand-purple' : 'border-transparent'}`}>
                    <div className="flex items-start justify-between gap-3"><span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase border ${priorityCls(ticket.priority)}`}>{ticket.priority}</span>{!ticket.tenant_email && !ticket.tenant_phone && <span className="text-[10px] font-bold uppercase text-rose-500">Missing contact</span>}</div>
                    <p className="mt-2 text-sm font-bold text-gray-900 dark:text-white truncate">{ticket.title}</p>
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                      <p className="flex items-center gap-2"><Building2 size={12} />{ticket.property_name}</p>
                      <p className="flex items-center gap-2"><Home size={12} />Unit {ticket.unit_number}</p>
                      <p className="flex items-center gap-2"><User size={12} />{ticket.tenant_name}</p>
                    </div>
                  </button>
                )) : <div className="p-8 text-center text-gray-400 text-sm">No maintenance tickets found</div>}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 shadow-sm p-6 flex flex-col gap-5 min-h-[560px]">
              {!selectedTicket ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center">
                  <Wrench size={40} className="text-gray-300 dark:text-gray-600 mb-4" />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Select a maintenance ticket</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">Pick a ticket from the list to review the issue and reply to the tenant from this workspace.</p>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-3"><span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase border ${priorityCls(selectedTicket.priority)}`}>{selectedTicket.priority}</span><span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase border ${statusCls(selectedTicket.status)}`}>{clean(selectedTicket.status)}</span></div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedTicket.title}</h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{selectedTicket.description || 'No additional issue description was captured for this ticket.'}</p>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-500 dark:text-gray-400">
                      <p className="flex items-center gap-2"><Building2 size={14} />{selectedTicket.property_name}</p>
                      <p className="flex items-center gap-2"><Home size={14} />Unit {selectedTicket.unit_number}</p>
                      <p className="flex items-center gap-2"><CalendarClock size={14} />{fmt(selectedTicket.scheduled_date)}</p>
                      <p className="flex items-center gap-2"><User size={14} />{selectedTicket.tenant_name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-gray-50 dark:bg-black/20 p-1.5 rounded-xl border border-gray-200 dark:border-white/10 w-fit">
                    <button onClick={() => setChannel('sms')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${channel === 'sms' ? 'bg-white dark:bg-dark-surface text-brand-purple shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}><Smartphone size={16} /> SMS Text</button>
                    <button onClick={() => setChannel('email')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${channel === 'email' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}><Mail size={16} /> Email</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {templates.map((item) => <button key={item.label} type="button" onClick={() => setMessage(item.build(selectedTicket))} className="rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 p-4 text-left hover:border-brand-purple transition-colors"><p className="text-sm font-bold text-gray-900 dark:text-white">{item.label}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.detail}</p></button>)}
                  </div>

                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-end mb-1.5"><label htmlFor="maintenance-message" className="text-sm font-medium text-gray-700 dark:text-gray-300">Message Content</label><span className="text-xs text-gray-400">{message.length} chars</span></div>
                    <textarea id="maintenance-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type your tenant update here..." className="flex-1 w-full px-4 py-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple text-gray-900 dark:text-white resize-none shadow-inner min-h-[220px]" />
                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="text-xs text-gray-500 dark:text-gray-400">{channel === 'email' ? `Sending to ${selectedTicket.tenant_email || 'no email on file'}` : `Sending to ${selectedTicket.tenant_phone || 'no phone number on file'}`}</div>
                    <button onClick={handleSend} disabled={sending || !message.trim()} className={`px-8 py-3 text-white rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg disabled:opacity-50 disabled:shadow-none ${channel === 'email' ? 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20' : 'bg-brand-purple hover:bg-brand-pink shadow-brand-purple/20'}`}>{sending ? <CustomLoader size={20} /> : <Send size={20} />}{sending ? 'Sending...' : `Send ${channel === 'email' ? 'Email' : 'SMS'} Now`}</button>
                  </div>
                </>
              )}
            </div>

            <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-white/10 flex items-center justify-between"><h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><History size={18} className="text-brand-purple" />Update History</h3><span className="text-xs text-gray-400">{history.length} records</span></div>
              {loadingHistory ? <div className="p-10 flex justify-center"><CustomLoader size={24} label="Loading timeline..." /></div> : !selectedTicket ? <div className="p-10 text-center text-sm text-gray-400">Select a ticket to view message history.</div> : history.length === 0 ? <div className="p-10 text-center text-sm text-gray-400">No updates sent yet for this ticket.</div> : (
                <div className="divide-y divide-gray-100 dark:divide-white/5">
                  {history.map((entry) => (
                    <div key={entry.id} className="p-5">
                      <div className="flex items-center justify-between gap-3 mb-2"><span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase border ${entry.channel === 'email' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800/30'}`}>{entry.channel}</span><span className="text-xs text-gray-400">{fmt(entry.sent_at, true)}</span></div>
                      <p className="text-sm text-gray-700 dark:text-gray-200">{entry.message}</p>
                      <p className="mt-2 text-[11px] text-gray-400 uppercase tracking-wider">Sent by {staff.find((x) => x.id === entry.sent_by)?.full_name || 'Operations team'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
