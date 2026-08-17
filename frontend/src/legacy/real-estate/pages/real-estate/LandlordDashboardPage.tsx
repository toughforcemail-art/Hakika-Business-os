// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calendar, Home, KeyRound, Mail, Phone, Send, ShieldCheck, Wallet, AlertTriangle, Users, Building2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';

type Landlord = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  login_username: string | null;
  login_sent_at: string | null;
  login_active: boolean | null;
  property_id: string | null;
  company_id?: string | null;
  status: string | null;
  property?: { name: string }[] | null;
};
type LeaseDepositRow = {
  tenant_id?: string | null;
  unit_id?: string | null;
  status?: string | null;
  property_id?: string | null;
  deposit_amount: number | null;
  water_deposit_amount: number | null;
  electricity_deposit_amount: number | null;
};
type PortfolioRow = {
  property: { id: string; name: string; address?: string | null };
  units: Array<{
    id: string;
    unit_number: string;
    status: string | null;
    rent_amount: number | null;
    tenant?: { id: string; full_name: string | null; current_unit_id: string | null } | null;
    arrears: number;
    invoiceCount: number;
    invoices: Array<{ invoice_number: string | null; amount_due: number | null; amount_paid: number | null }>;
  }>;
};
const firstRelation = <T,>(value: T[] | T | null | undefined): T | null => (Array.isArray(value) ? value[0] || null : value || null);

export default function LandlordDashboardPage() {
  const navigate = useNavigate();
  const { profile } = useAccess();
  const [searchParams] = useSearchParams();
  const requestedLandlordId = searchParams.get('landlordId');
  const isSuperAdmin = ['super admin', 'super_admin', 'director / super admin'].includes((profile?.role || '').trim().toLowerCase());
  const [loading, setLoading] = useState(true);
  const [landlord, setLandlord] = useState<Landlord | null>(null);
  const [propertyCount, setPropertyCount] = useState(0);
  const [unitCount, setUnitCount] = useState(0);
  const [tenantCount, setTenantCount] = useState(0);
  const [depositSummary, setDepositSummary] = useState<{ rent: number; water: number; electricity: number; total: number } | null>(null);
  const [portfolioRows, setPortfolioRows] = useState<PortfolioRow[]>([]);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const authUser = (await supabase.auth.getUser()).data.user;
        const username = String(authUser?.user_metadata?.username || '').trim();
        const email = authUser?.email || profile?.email || '';

        let landlordQuery = supabase
            .from('re_personnel')
            .select('id, full_name, email, phone, login_username, login_sent_at, login_active, property_id, status, company_id, property:re_properties(name)')
            .eq('role', 'landlord');

        if (requestedLandlordId && isSuperAdmin) {
          landlordQuery = landlordQuery.eq('id', requestedLandlordId);
          if (profile?.company_id) landlordQuery = landlordQuery.eq('company_id', profile.company_id);
        }

        const [landlordRes, propRes, unitRes, tenantRes, leaseRes, invoiceRes] = await Promise.all([
          landlordQuery,
          supabase.from('re_properties').select('id, name, address, owner_id'),
          supabase.from('re_units').select('id, unit_number, status, rent_amount, property_id'),
          supabase.from('re_tenants').select('id, full_name, current_unit_id, is_active'),
          supabase.from('re_leases').select('tenant_id, unit_id, property_id, status, deposit_amount, water_deposit_amount, electricity_deposit_amount'),
          supabase.from('re_invoices').select('tenant_id, unit_id, invoice_number, amount_due, amount_paid, deleted_at').is('deleted_at', null),
        ]);

        if (cancelled) return;
        if (landlordRes.error) throw landlordRes.error;
        const rows = (landlordRes.data || []) as unknown as Landlord[];
        const nextLandlord = requestedLandlordId && isSuperAdmin
          ? rows[0] || null
          : rows.find((row) => email && row.email?.toLowerCase() === email.toLowerCase()) ||
            rows.find((row) => username && row.login_username?.toLowerCase() === username.toLowerCase()) ||
            rows[0] ||
            null;

        setLandlord(nextLandlord);
        const allProperties = (propRes.data || []) as Array<{ id: string; name: string; address?: string | null; owner_id?: string | null }>;
        const propertyIds = new Set(allProperties.filter((property) => property.id === nextLandlord?.property_id || property.owner_id === nextLandlord?.id).map((property) => property.id));
        const scopedProperties = allProperties.filter((property) => propertyIds.has(property.id));
        const allUnits = (unitRes.data || []) as Array<{ id: string; unit_number: string; status: string | null; rent_amount: number | null; property_id: string }>;
        const allTenants = (tenantRes.data || []) as Array<{ id: string; full_name: string | null; current_unit_id: string | null; is_active: boolean | null }>;
        const allInvoices = (invoiceRes.data || []) as Array<{ tenant_id: string | null; unit_id: string | null; invoice_number: string | null; amount_due: number | null; amount_paid: number | null }>;
        const portfolioRowsNext: PortfolioRow[] = scopedProperties.map((property) => ({
          property,
          units: allUnits.filter((unit) => unit.property_id === property.id).map((unit) => {
            const tenant = allTenants.find((item) => item.current_unit_id === unit.id && item.is_active) || null;
            const unitInvoices = allInvoices.filter((invoice) => invoice.unit_id === unit.id || (tenant && invoice.tenant_id === tenant.id));
            return {
              ...unit,
              tenant,
              arrears: unitInvoices.reduce((sum, invoice) => sum + Math.max(0, Number(invoice.amount_due || 0) - Number(invoice.amount_paid || 0)), 0),
              invoiceCount: unitInvoices.length,
              invoices: unitInvoices,
            };
          }),
        }));
        setPortfolioRows(portfolioRowsNext);
        setPropertyCount(portfolioRowsNext.length);
        setUnitCount(portfolioRowsNext.reduce((sum, row) => sum + row.units.length, 0));
        setTenantCount(portfolioRowsNext.reduce((sum, row) => sum + row.units.filter((unit) => unit.tenant).length, 0));
        const leases = ((leaseRes.data || []) as LeaseDepositRow[]).filter((lease) => !lease.property_id || propertyIds.has(lease.property_id));
        setDepositSummary({
          rent: leases.reduce((sum, lease) => sum + Number(lease.deposit_amount || 0), 0),
          water: leases.reduce((sum, lease) => sum + Number(lease.water_deposit_amount || 0), 0),
          electricity: leases.reduce((sum, lease) => sum + Number(lease.electricity_deposit_amount || 0), 0),
          total: leases.reduce((sum, lease) => sum + Number(lease.deposit_amount || 0) + Number(lease.water_deposit_amount || 0) + Number(lease.electricity_deposit_amount || 0), 0),
        });
      } catch (error: any) {
        if (!cancelled) {
          setToast({ message: error?.message || 'Failed to load landlord dashboard.', type: 'error' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, profile?.company_id, profile?.email, requestedLandlordId]);

  const dashboardTitle = useMemo(() => landlord?.full_name || profile?.full_name || 'Landlord Dashboard', [landlord?.full_name, profile?.full_name]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950"><CustomLoader label="Loading landlord dashboard..." /></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800 p-6 md:p-10 transition-colors">
      {toast ? <CustomToast message={toast.message} type={toast.type} isVisible={true} onClose={() => setToast(null)} /> : null}
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-[32px] border border-white/80 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/80 p-6 shadow-2xl shadow-slate-200/60 dark:shadow-slate-900/60 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-brand-purple dark:text-orange-400">Landlord Portal</p>
              <h1 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{dashboardTitle}</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">A focused dashboard for ownership, credentials, and property oversight.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {isSuperAdmin && requestedLandlordId ? (
                <button
                  type="button"
                  onClick={() => navigate('/app/real-estate/management/landlords')}
                  className="rounded-2xl border border-brand-purple/20 bg-brand-purple/10 px-4 py-3 text-sm font-black text-brand-purple transition hover:bg-brand-purple/20 dark:border-orange-400/20 dark:text-orange-300"
                >
                  <ArrowLeft size={16} className="mr-2 inline" /> Return to management
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => navigate('/app/real-estate/management/landlords')}
                className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-black text-slate-700 dark:text-slate-200 transition hover:border-brand-purple/30 hover:text-brand-purple dark:hover:border-orange-400/30 dark:hover:text-orange-400"
              >
                Open Landlord Register
              </button>
              <button
                type="button"
                onClick={() => navigate('/app/real-estate/management/landlords')}
                className="rounded-2xl bg-brand-purple dark:bg-orange-500 px-4 py-3 text-sm font-black text-white transition hover:bg-brand-pink dark:hover:bg-orange-600"
              >
                Manage Login
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <Stat icon={<Home size={18} />} label="Properties" value={propertyCount.toLocaleString()} />
            <Stat icon={<Wallet size={18} />} label="Units" value={unitCount.toLocaleString()} />
            <Stat icon={<ShieldCheck size={18} />} label="Tenants" value={tenantCount.toLocaleString()} />
            <Stat icon={<KeyRound size={18} />} label="Login" value={landlord?.login_active ? 'Active' : 'Inactive'} />
          </div>
          {depositSummary ? (
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Stat icon={<Wallet size={18} />} label="Rent Deposit" value={`Ksh ${depositSummary.rent.toLocaleString()}`} />
              <Stat icon={<Wallet size={18} />} label="Utility Deposits" value={`Ksh ${(depositSummary.water + depositSummary.electricity).toLocaleString()}`} />
              <Stat icon={<Wallet size={18} />} label="Total Deposits" value={`Ksh ${depositSummary.total.toLocaleString()}`} />
            </div>
          ) : null}
        </div>

        <section className="rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-lg shadow-slate-200/50 dark:border-slate-700/50 dark:bg-slate-800/80 dark:shadow-slate-900/50">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-[11px] font-black uppercase tracking-[0.24em] text-brand-purple dark:text-orange-400">Property portfolio</p><h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Properties, units, tenants and billing</h2></div>
            <div className="flex gap-2 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400"><span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Occupied</span><span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-700">Vacant</span></div>
          </div>
          {portfolioRows.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">No properties are assigned to this landlord.</p> : (
            <div className="space-y-5">
              {portfolioRows.map((row) => (
                <div key={row.property.id} className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-4 py-3 dark:bg-slate-900/40"><div className="flex items-center gap-3"><Building2 size={18} className="text-brand-purple dark:text-orange-400" /><div><p className="font-black text-slate-900 dark:text-white">{row.property.name}</p><p className="text-xs text-slate-500 dark:text-slate-400">{row.property.address || 'Address not set'} · {row.units.length} units</p></div></div><p className="text-xs font-black text-slate-500 dark:text-slate-400">{row.units.filter((unit) => unit.tenant).length} occupied · {row.units.filter((unit) => !unit.tenant).length} vacant</p></div>
                  <div className="overflow-x-auto">
                    <table className="min-w-[1100px] w-full text-left text-sm"><thead className="border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-500 dark:border-slate-700"><tr><th className="px-4 py-3">Unit</th><th className="px-4 py-3">Occupancy</th><th className="px-4 py-3">Tenant</th><th className="px-4 py-3">Arrears</th><th className="px-4 py-3">Invoices and balances</th><th className="px-4 py-3">Rent</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-700">{row.units.map((unit) => <tr key={unit.id}><td className="px-4 py-3 font-black text-slate-900 dark:text-white">{unit.unit_number}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${unit.tenant ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{unit.tenant ? 'Occupied' : 'Vacant'}</span></td><td className="px-4 py-3 text-slate-700 dark:text-slate-200">{unit.tenant?.full_name || '—'}</td><td className={`px-4 py-3 font-black ${unit.arrears > 0 ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'}`}>{unit.arrears > 0 ? `Ksh ${unit.arrears.toLocaleString()}` : 'Clear'}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-300"><div className="space-y-1">{unit.invoices.slice(-4).reverse().map((invoice, index) => <div key={`${invoice.invoice_number || 'invoice'}-${index}`}><span className="font-mono text-xs">{invoice.invoice_number || 'Invoice'}</span> · Ksh {Number(invoice.amount_due || 0).toLocaleString()} due · <span className={Number(invoice.amount_due || 0) - Number(invoice.amount_paid || 0) > 0 ? 'font-bold text-rose-600' : 'text-emerald-600'}>{Number(invoice.amount_due || 0) - Number(invoice.amount_paid || 0) > 0 ? `Ksh ${(Number(invoice.amount_due || 0) - Number(invoice.amount_paid || 0)).toLocaleString()} owing` : 'Paid'}</span></div>)}{unit.invoices.length > 4 ? <div className="text-xs italic">+ {unit.invoices.length - 4} older invoices</div> : null}{unit.invoices.length === 0 ? 'No invoices' : null}</div></td><td className="px-4 py-3 font-bold text-slate-900 dark:text-white">Ksh {Number(unit.rent_amount || 0).toLocaleString()}</td></tr>)}</tbody></table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[32px] border border-white/80 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/80 p-6 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50">
            <div className="mb-4 flex items-center gap-2">
              <Mail className="text-brand-purple dark:text-orange-400" size={20} />
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Account Snapshot</h2>
            </div>
            <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
              <Row icon={<Mail size={16} />} label="Email" value={landlord?.email || 'Not set'} />
              <Row icon={<Phone size={16} />} label="Phone" value={landlord?.phone || 'Not set'} />
              <Row icon={<KeyRound size={16} />} label="Username" value={landlord?.login_username || 'Not set'} />
              <Row icon={<ShieldCheck size={16} />} label="Status" value={landlord?.status || 'unknown'} />
            </div>
          </div>

          <div className="rounded-[32px] border border-white/80 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/80 p-6 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50">
            <div className="mb-4 flex items-center gap-2">
              <Calendar className="text-brand-purple dark:text-orange-400" size={20} />
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Quick Actions</h2>
            </div>
            <div className="space-y-3">
              <Action
                title="Open portal details"
                description="Review the login credentials and resend options for this landlord."
                onClick={() => navigate('/app/real-estate/management/landlords')}
              />
              <Action
                title="View property record"
                description={firstRelation(landlord?.property)?.name ? `Assigned property: ${firstRelation(landlord?.property)?.name}` : 'Check ownership assignment and status.'}
                onClick={() => navigate('/app/real-estate/management/landlords')}
              />
              <Action
                title="Go to real-estate dashboard"
                description="Use the broader property dashboard when you need portfolio-wide reporting."
                onClick={() => navigate('/app/real-estate/dashboard')}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-4">
      <div className="flex items-center justify-between">
        <div className="rounded-2xl bg-brand-purple/10 dark:bg-orange-400/10 p-2 text-brand-purple dark:text-orange-400">{icon}</div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</p>
      </div>
      <p className="mt-4 text-2xl font-black text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-3xl border border-slate-200 dark:border-slate-700 p-4 dark:bg-slate-900/30">
      <div className="mt-0.5 rounded-2xl bg-brand-purple/10 dark:bg-orange-400/10 p-2 text-brand-purple dark:text-orange-400">{icon}</div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{label}</p>
        <p className="mt-1 font-bold text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

function Action({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-3xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-4 text-left transition hover:border-brand-purple/30 dark:hover:border-orange-400/30 hover:bg-white dark:hover:bg-slate-800/50"
    >
      <p className="font-black text-slate-900 dark:text-white">{title}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      <p className="mt-2 text-xs font-black uppercase tracking-[0.2em] text-brand-purple dark:text-orange-400">Open</p>
    </button>
  );
}
