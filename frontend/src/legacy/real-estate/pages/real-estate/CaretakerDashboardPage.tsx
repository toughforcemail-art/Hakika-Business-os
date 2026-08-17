// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Building2, CheckCircle2, ClipboardList, Home, LogOut, Plus, RefreshCw, ShieldCheck, UserCheck, Users, Wrench } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';

type Caretaker = { id: string; full_name: string | null; email: string | null; phone: string | null; property_id: string | null; status: string | null; property?: any };
type Maintenance = { id: string; title: string; priority: string; status: string; created_at: string; unit_id: string | null };

const elevatedRoles = ['super admin', 'super_admin', 'director / super admin'];

export default function CaretakerDashboardPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { profile } = useAccess();
  const requestedId = params.get('caretakerId');
  const isElevated = elevatedRoles.includes((profile?.role || '').trim().toLowerCase());
  const [caretaker, setCaretaker] = useState<Caretaker | null>(null);
  const [tickets, setTickets] = useState<Maintenance[]>([]);
  const [unitCount, setUnitCount] = useState(0);
  const [tenantCount, setTenantCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      let caretakerQuery = supabase.from('re_personnel').select('id, full_name, email, phone, property_id, status, property:re_properties(name)').eq('role', 'caretaker');
      if (requestedId && isElevated) {
        caretakerQuery = caretakerQuery.eq('id', requestedId);
        if (profile?.company_id) caretakerQuery = caretakerQuery.eq('company_id', profile.company_id);
      } else if (profile?.email) {
        caretakerQuery = caretakerQuery.eq('email', profile.email);
      }
      const { data: caretakerRows, error } = await caretakerQuery.limit(1);
      if (error) throw error;
      const current = ((caretakerRows || [])[0] || null) as Caretaker | null;
      setCaretaker(current);
      const propertyId = current?.property_id;
      if (!propertyId) {
        setUnitCount(0);
        setTenantCount(0);
        setTickets([]);
        return;
      }

      const { data: unitRows, error: unitsError } = await supabase
        .from('re_units')
        .select('id')
        .eq('property_id', propertyId);
      if (unitsError) throw unitsError;
      const unitIds = (unitRows || []).map((row: { id: string }) => row.id);

      const [tenants, maintenance] = await Promise.all([
        unitIds.length
          ? supabase.from('re_tenants').select('id', { count: 'exact', head: true }).eq('is_active', true).in('current_unit_id', unitIds)
          : Promise.resolve({ count: 0, error: null } as any),
        supabase.from('re_maintenance').select('id, title, priority, status, created_at, unit_id').eq('property_id', propertyId).order('created_at', { ascending: false }).limit(8),
      ]);
      if (tenants.error || maintenance.error) throw tenants.error || maintenance.error;
      setUnitCount(unitIds.length);
      setTenantCount(tenants.count || 0);
      setTickets((maintenance.data || []) as Maintenance[]);
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to load caretaker dashboard', type: 'error' });
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [isElevated, profile?.company_id, profile?.email, requestedId]);

  const openTickets = useMemo(() => tickets.filter(ticket => !['completed', 'rejected'].includes(ticket.status)).length, [tickets]);
  const urgentTickets = useMemo(() => tickets.filter(ticket => ['high', 'emergency'].includes(ticket.priority) && !['completed', 'rejected'].includes(ticket.status)).length, [tickets]);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-slate-950"><CustomLoader label="Loading caretaker workspace..." /></div>;

  const propertyName = Array.isArray(caretaker?.property) ? caretaker?.property?.[0]?.name : caretaker?.property?.name;

  return <div className="min-h-screen bg-[#071521] px-4 py-6 text-white md:px-8 md:py-8">
    {toast ? <CustomToast message={toast.message} type={toast.type} isVisible onClose={() => setToast(null)} /> : null}
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-5 rounded-[30px] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 md:flex-row md:items-end md:justify-between">
        <div><p className="text-sm font-semibold text-cyan-300">Operations workspace</p><h1 className="mt-2 text-3xl font-black tracking-tight">{caretaker?.full_name || 'Caretaker Dashboard'}</h1><p className="mt-2 text-sm text-slate-300">Keep the assigned property safe, occupied, and moving.</p><div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300"><span className="rounded-full bg-white/10 px-3 py-1.5"><Building2 className="mr-1 inline" size={13} />{propertyName || 'No property assigned'}</span><span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-emerald-300"><ShieldCheck className="mr-1 inline" size={13} />{caretaker?.status || 'Active'}</span></div></div>
        <div className="flex flex-wrap gap-2">{isElevated && requestedId ? <button onClick={() => navigate('/app/real-estate/management/caretakers')} className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2.5 text-sm font-bold text-cyan-200 hover:bg-cyan-300/20"><ArrowLeft className="mr-2 inline" size={16} />Return to management</button> : null}<button onClick={() => void load()} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-slate-200 hover:bg-white/10"><RefreshCw className="mr-2 inline" size={16} />Refresh</button><button onClick={() => navigate('/app/real-estate/communication/maintenance')} className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-cyan-300"><Plus className="mr-2 inline" size={16} />Log issue</button></div>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[
        { label: 'Units under care', value: unitCount, icon: Home, tone: 'text-cyan-300' },
        { label: 'Active tenants', value: tenantCount, icon: Users, tone: 'text-emerald-300' },
        { label: 'Open work orders', value: openTickets, icon: ClipboardList, tone: 'text-amber-300' },
        { label: 'Urgent attention', value: urgentTickets, icon: AlertTriangle, tone: 'text-rose-300' },
      ].map(item => <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.05] p-5"><item.icon className={item.tone} size={20} /><p className="mt-5 text-3xl font-black">{item.value}</p><p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">{item.label}</p></div>)}</section>
      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-6"><div className="flex items-center justify-between"><div><h2 className="text-xl font-black">Property work queue</h2><p className="mt-1 text-sm text-slate-400">Prioritised maintenance and resident issues.</p></div><Wrench className="text-cyan-300" /></div><div className="mt-5 space-y-3">{tickets.length ? tickets.map(ticket => <div key={ticket.id} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/10 p-4"><div className="min-w-0"><p className="truncate font-bold">{ticket.title}</p><p className="mt-1 text-xs text-slate-400">{new Date(ticket.created_at).toLocaleDateString()} · {ticket.status.replace('_', ' ')}</p></div><span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase ${ticket.priority === 'emergency' ? 'bg-rose-400/15 text-rose-300' : ticket.priority === 'high' ? 'bg-amber-400/15 text-amber-300' : 'bg-white/10 text-slate-300'}`}>{ticket.priority}</span></div>) : <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-slate-400">No maintenance issues assigned to this property.</div>}</div></div>
        <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-6"><h2 className="text-xl font-black">Quick actions</h2><div className="mt-5 space-y-3">{[[Home, 'Open property register', '/app/real-estate/properties'], [UserCheck, 'Review tenant directory', '/app/real-estate/tenants'], [ClipboardList, 'Open maintenance hub', '/app/real-estate/communication/maintenance'], [LogOut, 'View notices', '/app/real-estate/communication/vacating-notices']].map(([Icon, label, path]: any) => <button key={label} onClick={() => navigate(path)} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 p-4 text-left transition hover:border-cyan-300/40 hover:bg-cyan-300/5"><Icon size={18} className="text-cyan-300" /><span className="text-sm font-bold">{label}</span></button>)}</div></div>
      </section>
    </div>
  </div>;
}
