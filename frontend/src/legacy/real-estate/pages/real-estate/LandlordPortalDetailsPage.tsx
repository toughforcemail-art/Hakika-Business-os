// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Calendar, KeyRound, Mail, Phone, ShieldCheck, RefreshCw, Send } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { invokeEdgeFunction } from '../../utils/edgeFunctions';

type Landlord = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  login_username: string | null;
  login_sent_at: string | null;
  login_resend_count: number | null;
  login_active: boolean | null;
  property_id: string | null;
  property?: {
    name: string | null;
  }[] | null;
};

type LeaseDepositRow = {
  deposit_amount: number | null;
  water_deposit_amount: number | null;
  electricity_deposit_amount: number | null;
  deposit_paid_to: string | null;
};

type LoginEvent = {
  id: string;
  created_at: string;
  description: string | null;
  action_type: string | null;
  module: string | null;
  metadata: Record<string, unknown> | null;
};

export default function LandlordPortalDetailsPage() {
  const navigate = useNavigate();
  const { landlordId } = useParams();
  const { profile } = useAccess();
  const [loading, setLoading] = useState(true);
  const [landlord, setLandlord] = useState<Landlord | null>(null);
  const [depositSummary, setDepositSummary] = useState<{ rent: number; water: number; electricity: number; total: number; paidTo: Record<string, number> } | null>(null);
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [busy, setBusy] = useState<'send' | 'reset' | null>(null);

  const load = async () => {
    if (!landlordId) return;
    setLoading(true);
    try {
      const [landlordRes, eventRes] = await Promise.all([
        supabase.from('re_personnel').select('id, full_name, email, phone, login_username, login_sent_at, login_resend_count, login_active, property_id, property:re_properties(name)').eq('id', landlordId).eq('role', 'landlord').maybeSingle(),
        supabase.from('activity_logs').select('id, created_at, description, action_type, module, metadata').eq('resource_id', landlordId).or(`action_type.ilike.%login%,description.ilike.%login%`).order('created_at', { ascending: false }).limit(12),
      ]);

      if (landlordRes.error) throw landlordRes.error;
      if (eventRes.error) throw eventRes.error;
      const nextLandlord = landlordRes.data || null;
      setLandlord(nextLandlord);
      setEvents((eventRes.data || []) as LoginEvent[]);
      if (nextLandlord?.property_id) {
        const [leaseRes] = await Promise.all([
          supabase.from('re_leases').select('deposit_amount, water_deposit_amount, electricity_deposit_amount, deposit_paid_to').eq('property_id', nextLandlord.property_id),
        ]);
        if (!leaseRes.error) {
          const leases = (leaseRes.data || []) as LeaseDepositRow[];
          const paidTo = leases.reduce<Record<string, number>>((acc, lease) => {
            const key = lease.deposit_paid_to || 'landlord';
            acc[key] = (acc[key] || 0) + Number(lease.deposit_amount || 0) + Number(lease.water_deposit_amount || 0) + Number(lease.electricity_deposit_amount || 0);
            return acc;
          }, {});
          setDepositSummary({
            rent: leases.reduce((sum, lease) => sum + Number(lease.deposit_amount || 0), 0),
            water: leases.reduce((sum, lease) => sum + Number(lease.water_deposit_amount || 0), 0),
            electricity: leases.reduce((sum, lease) => sum + Number(lease.electricity_deposit_amount || 0), 0),
            total: leases.reduce((sum, lease) => sum + Number(lease.deposit_amount || 0) + Number(lease.water_deposit_amount || 0) + Number(lease.electricity_deposit_amount || 0), 0),
            paidTo,
          });
        }
      }
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to load landlord portal details', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) void load();
  }, [profile, landlordId]);

  const loginStatus = useMemo(() => {
    if (!landlord) return 'unknown';
    return landlord.login_sent_at ? 'sent' : 'not_sent';
  }, [landlord]);

  const runAction = async (reset = false) => {
    if (!landlord) return;
    setBusy(reset ? 'reset' : 'send');
    try {
      await invokeEdgeFunction('admin-create-landlord-login', {
        landlord_id: landlord.id,
        ...(reset ? { reset: true } : { resend: Boolean(landlord.login_sent_at) }),
      });
      setToast({ message: reset ? 'Landlord login reset and re-sent.' : 'Landlord login sent.', type: 'success' });
      await load();
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to update landlord login', type: 'error' });
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><CustomLoader label="Loading landlord portal details..." /></div>;
  if (!landlord) return <div className="min-h-screen flex items-center justify-center text-gray-500">Landlord not found.</div>;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff_0%,_#f5f7fb_35%,_#e9eef7_100%)] p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-2xl shadow-slate-200/60 backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-brand-purple">Landlord Portal Details</p>
              <h1 className="mt-2 text-3xl font-black text-slate-900">{landlord.full_name || 'Landlord'}</h1>
              <p className="mt-1 text-sm text-slate-500">Portal credentials, delivery history, and quick actions in one place.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => navigate('/app/landlord/dashboard')} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">Back</button>
              <button onClick={() => void runAction(false)} disabled={busy !== null} className="rounded-2xl bg-brand-purple px-4 py-3 text-sm font-black text-white disabled:opacity-50">
                <Send className="mr-2 inline h-4 w-4" /> {busy === 'send' ? 'Sending...' : 'Send Login'}
              </button>
              <button onClick={() => void runAction(true)} disabled={busy !== null} className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
                <RefreshCw className="mr-2 inline h-4 w-4" /> {busy === 'reset' ? 'Resetting...' : 'Reset Login'}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <Card label="Status" value={loginStatus === 'sent' ? 'Sent' : 'Not sent yet'} />
            <Card label="Username" value={landlord.login_username || 'Not set'} />
            <Card label="Last Sent" value={landlord.login_sent_at ? new Date(landlord.login_sent_at).toLocaleString() : 'Never'} />
            <Card label="Resends" value={String(landlord.login_resend_count || 0)} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-lg shadow-slate-200/50">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="text-brand-purple" size={20} />
              <h2 className="text-xl font-black text-slate-900">Contact Methods</h2>
            </div>
            <div className="space-y-3 text-sm text-slate-700">
              <Row icon={<Mail size={16} />} label="Email" value={landlord.email || 'Not set'} />
              <Row icon={<Phone size={16} />} label="Phone" value={landlord.phone || 'Not set'} />
              <Row icon={<KeyRound size={16} />} label="Portal" value={landlord.login_active ? 'Active' : 'Inactive'} />
              <div className="rounded-3xl bg-slate-50 p-4 text-xs text-slate-500">
                If the landlord needs login again later, use Reset Login to generate fresh credentials and resend by SMS and email when available.
              </div>
            </div>
            {depositSummary && (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <Card label="Rent Deposit" value={`Ksh ${depositSummary.rent.toLocaleString()}`} />
                <Card label="Utility Deposits" value={`Ksh ${(depositSummary.water + depositSummary.electricity).toLocaleString()}`} />
                <Card label="Total Deposits" value={`Ksh ${depositSummary.total.toLocaleString()}`} />
                <Card label="Deposit To" value={Object.entries(depositSummary.paidTo).length > 0 ? Object.entries(depositSummary.paidTo).map(([key, value]) => `${key}: Ksh ${value.toLocaleString()}`).join(' | ') : 'landlord: Ksh 0'} />
                <Card label="Property" value={Array.isArray(landlord.property) ? landlord.property[0]?.name || 'N/A' : landlord.property?.name || 'N/A'} />
              </div>
            )}
          </div>

          <div className="rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-lg shadow-slate-200/50">
            <div className="mb-4 flex items-center gap-2">
              <Calendar className="text-brand-purple" size={20} />
              <h2 className="text-xl font-black text-slate-900">Recent Login Activity</h2>
            </div>
            <div className="space-y-3">
              {events.length > 0 ? events.map((event) => (
                <div key={event.id} className="rounded-3xl border border-slate-200 p-4">
                  <p className="font-bold text-slate-900">{event.description || event.action_type || 'Login event'}</p>
                  <p className="mt-1 text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</p>
                </div>
              )) : (
                <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                  No login activity logged yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {toast && <CustomToast message={toast.message} type={toast.type} isVisible={true} onClose={() => setToast(null)} />}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 break-words font-black text-slate-900">{value}</p>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-3xl border border-slate-200 p-4">
      <div className="mt-0.5 rounded-2xl bg-brand-purple/10 p-2 text-brand-purple">{icon}</div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="mt-1 font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
