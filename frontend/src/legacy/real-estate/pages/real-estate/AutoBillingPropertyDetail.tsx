// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Calendar, CheckCircle2, Clock3, DollarSign, Home, Play, Send, Settings2, User, WalletCards } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { calculateHakikaSplit } from '../../utils/hakikaLedger';
import { getTenantDisplayName } from '../../utils/tenantDisplay';
import { callDaraja } from '../../services/darajaService';
import { generateInvoiceNumber } from '../../utils/invoiceNumbers';

type Property = {
  id: string;
  name: string;
  status?: string | null;
  billing_repeat_every?: string | null;
  billing_day?: number | null;
  billing_time?: string | null;
  billing_effective_from?: string | null;
  billing_effective_to?: string | null;
  due_day_rule?: string | null;
  due_day_offset?: number | null;
  due_month_mode?: string | null;
  service_fee_mode?: string | null;
  service_fee_value?: number | null;
};

type Unit = {
  id: string;
  unit_number: string;
  status: string;
  rent_amount: number | null;
  property_id: string;
  tenant_id?: string | null;
};

type Lease = {
  id: string;
  tenant_id: string;
  unit_id: string;
  rent_amount: number | null;
  payment_day?: number | null;
};

type Tenant = { id: string; full_name: string | null; phone?: string | null };
type AuditLog = {
  id: string;
  created_at: string;
  run_date: string;
  run_time: string;
  tenant_name: string | null;
  unit_number: string | null;
  invoice_number: string | null;
  amount: number | null;
  notification_email_sent: boolean | null;
  notification_sms_sent: boolean | null;
  notification_email_error: string | null;
  notification_sms_error: string | null;
  status: string | null;
  notes: string | null;
};
type DetailTab = 'schedule' | 'preview' | 'audit';

export default function AutoBillingPropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAccess();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [stkBusy, setStkBusy] = useState<string | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeTab, setActiveTab] = useState<DetailTab>('schedule');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [form, setForm] = useState({
    billing_repeat_every: 'monthly',
    billing_day: 1,
    billing_time: '08:00',
    billing_effective_from: '',
    billing_effective_to: '',
    due_day_rule: 'invoice_day',
    due_day_offset: 0,
    due_month_mode: 'same_month',
    service_fee_mode: 'percent',
    service_fee_value: 10,
  });

  const fetchData = async () => {
    if (!id || !profile?.company_id) return;
    setLoading(true);
    try {
      const [propRes, unitRes, leaseRes, tenantRes] = await Promise.all([
        supabase.from('re_properties').select('*').eq('id', id).single(),
        supabase.from('re_units').select('id, unit_number, status, rent_amount, property_id').eq('property_id', id).order('unit_number'),
        supabase.from('re_leases').select('id, tenant_id, unit_id, rent_amount, payment_day').eq('status', 'active'),
        supabase.from('re_tenants').select('id, full_name, phone').eq('company_id', profile.company_id),
      ]);

      if (propRes.error) throw propRes.error;
      if (unitRes.error) throw unitRes.error;
      if (leaseRes.error) throw leaseRes.error;
      if (tenantRes.error) throw tenantRes.error;

      setProperty(propRes.data as Property);
      setUnits((unitRes.data || []) as Unit[]);
      setLeases((leaseRes.data || []).filter((lease: Lease) => (unitRes.data || []).some((u: Unit) => u.id === lease.unit_id)) as Lease[]);
      setTenants((tenantRes.data || []) as Tenant[]);
      const auditRes = await supabase
        .from('re_billing_audit_logs')
        .select('id, created_at, run_date, run_time, tenant_name, unit_number, invoice_number, amount, notification_email_sent, notification_sms_sent, notification_email_error, notification_sms_error, status, notes')
        .eq('property_id', id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!auditRes.error) setAuditLogs((auditRes.data || []) as AuditLog[]);
      setForm({
        billing_repeat_every: propRes.data?.billing_repeat_every || 'monthly',
        billing_day: Number(propRes.data?.billing_day || 1),
        billing_time: propRes.data?.billing_time || '08:00',
        billing_effective_from: propRes.data?.billing_effective_from || '',
        billing_effective_to: propRes.data?.billing_effective_to || '',
        due_day_rule: propRes.data?.due_day_rule || 'invoice_day',
        due_day_offset: Number(propRes.data?.due_day_offset || 0),
        due_month_mode: propRes.data?.due_month_mode || 'same_month',
        service_fee_mode: propRes.data?.service_fee_mode || 'percent',
        service_fee_value: Number(propRes.data?.service_fee_value ?? 10),
      });
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to load property billing details', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, profile?.company_id]);

  const leasedUnitIds = useMemo(() => new Set(leases.map((lease) => lease.unit_id)), [leases]);
  const occupiedUnits = useMemo(() => units.filter((unit) => unit.status === 'occupied'), [units]);
  const vacantUnits = useMemo(() => units.filter((unit) => unit.status === 'vacant'), [units]);
  const eligibleUnits = useMemo(() => units.filter((unit) => unit.status !== 'deleted'), [units]);

  const previewRows = useMemo(() => {
    return units.map((unit) => {
      const lease = leases.find((item) => item.unit_id === unit.id);
      const tenant = lease ? tenants.find((t) => t.id === lease.tenant_id) : null;
      const amount = Number(lease?.rent_amount || unit.rent_amount || 0);
      const split = calculateHakikaSplit({
        amount,
        rate: Number(form.service_fee_value || 0),
        mode: form.service_fee_mode as 'percent' | 'flat',
      });
      const dueDay = Number(form.billing_day || lease?.payment_day || 1);
      const baseDate = new Date();
      const dueDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), dueDay);

      return {
        unit,
        lease,
        tenant,
        amount,
        dueDate: dueDate.toISOString().split('T')[0],
        split,
      };
    });
  }, [units, leases, tenants, form.billing_day, form.service_fee_mode, form.service_fee_value]);

  const saveSchedule = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('re_properties').update({
        billing_repeat_every: form.billing_repeat_every,
        billing_day: form.billing_day,
        billing_time: form.billing_time,
        billing_effective_from: form.billing_effective_from || null,
        billing_effective_to: form.billing_effective_to || null,
        due_day_rule: form.due_day_rule,
        due_day_offset: form.due_day_offset,
        due_month_mode: form.due_month_mode,
        service_fee_mode: form.service_fee_mode,
        service_fee_value: form.service_fee_value,
      }).eq('id', id);
      if (error) throw error;
      setToast({ message: 'Billing schedule saved.', type: 'success' });
      fetchData();
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to save billing schedule', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const runBilling = async () => {
    if (!id || !profile?.company_id) return;
    setRunning(true);
    try {
      const payload = previewRows.filter((row) => row.unit.status === 'occupied' && row.lease && row.tenant).map((row) => ({
        invoice_number: generateInvoiceNumber(),
        company_id: profile.company_id,
        tenant_id: row.lease?.tenant_id,
        unit_id: row.unit.id,
        invoice_type: 'rent',
        amount_due: row.amount,
        service_fee_mode: form.service_fee_mode,
        service_fee_value: form.service_fee_value,
        service_fee_amount: row.split.companyRevenue,
        landlord_payable_amount: row.split.landlordPayable,
        split_liability_amount: row.amount,
        split_rule_snapshot: {
          billing_day: form.billing_day,
          billing_time: form.billing_time,
          billing_repeat_every: form.billing_repeat_every,
          due_month_mode: form.due_month_mode,
          due_day_rule: form.due_day_rule,
        },
        due_date: row.dueDate,
        invoice_date: new Date().toISOString().split('T')[0],
        notes: `Auto-generated for ${property?.name || 'property'} (${form.billing_time})`,
        status: 'unpaid',
        created_by: profile.id,
      }));

      if (payload.length === 0) {
        setToast({ message: 'No occupied units with leases found to bill.', type: 'warning' });
        return;
      }

      const { error } = await supabase.from('re_invoices').insert(payload);
      if (error) throw error;
      setToast({ message: `Generated ${payload.length} invoices.`, type: 'success' });
      await fetchData();
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to generate invoices', type: 'error' });
    } finally {
      setRunning(false);
    }
  };

  const sendStk = async (row: typeof previewRows[number]) => {
    const phone = row.tenant?.phone;
    if (!phone) {
      setToast({ message: 'Tenant has no phone number for STK push.', type: 'warning' });
      return;
    }
    setStkBusy(row.unit.id);
    try {
      const balance = Math.max(0, row.amount - Number(row.lease?.rent_amount || 0));
      const response = await callDaraja({
        action: 'stk-push',
        amount: Math.round(row.amount),
        phoneNumber: phone,
        accountReference: row.lease ? `UNIT-${row.unit.unit_number}` : row.unit.unit_number,
        transactionDesc: `Hakika billing for ${row.tenant ? getTenantDisplayName(row.tenant) : 'tenant'}`,
        service_key: 'hakika',
        company_code: profile?.company_code || null,
      } as any);
      setToast({ message: response?.response?.CustomerMessage || `STK push sent for ${row.unit.unit_number}`, type: 'success' });
      void balance;
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to send STK push', type: 'error' });
    } finally {
      setStkBusy(null);
    }
  };

  if (loading) return <div className="p-12 flex justify-center"><CustomLoader size={40} label="Loading property billing..." /></div>;
  if (!property) return <div className="p-12 text-center text-gray-500">Property not found.</div>;

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Link to="/app/real-estate/invoice/auto-billing" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-14 h-14 rounded-2xl bg-brand-purple/10 text-brand-purple flex items-center justify-center">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white">{property.name}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Property billing workspace with schedules, units, tenants, and STK.</p>
          </div>
        </div>
      <div className="flex gap-3">
          <button onClick={saveSchedule} disabled={saving} className="px-4 py-2 rounded-xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 font-bold">
            {saving ? 'Saving...' : 'Save Schedule'}
          </button>
          <button onClick={runBilling} disabled={running} className="px-4 py-2 rounded-xl bg-brand-purple text-white font-black">
            {running ? 'Running...' : 'Run Billing'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['schedule', 'preview', 'audit'] as DetailTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest border ${
              activeTab === tab
                ? 'bg-brand-purple text-white border-brand-purple'
                : 'bg-white dark:bg-dark-surface border-gray-200 dark:border-white/10'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-3xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 p-5">
          <p className="text-[10px] uppercase tracking-[0.22em] text-gray-400 font-black">Billing Day</p>
          <p className="mt-2 text-3xl font-black">{form.billing_day}</p>
        </div>
        <div className="rounded-3xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 p-5">
          <p className="text-[10px] uppercase tracking-[0.22em] text-gray-400 font-black">Billing Time</p>
          <p className="mt-2 text-3xl font-black">{form.billing_time}</p>
        </div>
        <div className="rounded-3xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 p-5">
          <p className="text-[10px] uppercase tracking-[0.22em] text-gray-400 font-black">Occupied Units</p>
          <p className="mt-2 text-3xl font-black">{occupiedUnits.length}</p>
        </div>
        <div className="rounded-3xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 p-5">
          <p className="text-[10px] uppercase tracking-[0.22em] text-gray-400 font-black">Vacant Units</p>
          <p className="mt-2 text-3xl font-black">{vacantUnits.length}</p>
        </div>
      </div>

      {activeTab !== 'audit' && (
        <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
        <div className="rounded-3xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 p-5 space-y-4">
          <div className="flex items-center gap-2 text-brand-purple font-black uppercase tracking-[0.18em] text-[11px]">
            <Settings2 className="w-4 h-4" /> Billing Settings
          </div>
          <div className="grid grid-cols-1 gap-3">
            <label className="text-xs font-black uppercase text-gray-400">Billing frequency</label>
            <select value={form.billing_repeat_every} onChange={(e) => setForm((f) => ({ ...f, billing_repeat_every: e.target.value }))} className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-transparent">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom</option>
            </select>
            <label className="text-xs font-black uppercase text-gray-400">Billing day</label>
            <input type="number" min={1} max={31} value={form.billing_day} onChange={(e) => setForm((f) => ({ ...f, billing_day: Number(e.target.value) }))} className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-transparent" />
            <label className="text-xs font-black uppercase text-gray-400">Billing time</label>
            <input type="time" value={form.billing_time} onChange={(e) => setForm((f) => ({ ...f, billing_time: e.target.value }))} className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-transparent" />
            <label className="text-xs font-black uppercase text-gray-400">Effective from</label>
            <input type="date" value={form.billing_effective_from} onChange={(e) => setForm((f) => ({ ...f, billing_effective_from: e.target.value }))} className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-transparent" />
            <label className="text-xs font-black uppercase text-gray-400">Effective to</label>
            <input type="date" value={form.billing_effective_to} onChange={(e) => setForm((f) => ({ ...f, billing_effective_to: e.target.value }))} className="px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-transparent" />
          </div>
        </div>

        <div className="rounded-3xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 overflow-hidden">
          <div className="p-5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black">Units and Tenants</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Run billing for the whole property or send STK for a single tenant.</p>
            </div>
            <div className="text-sm font-bold text-gray-500">{eligibleUnits.length} units</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 dark:bg-black/10 text-[10px] uppercase font-black tracking-widest text-gray-400">
                <tr>
                  <th className="px-6 py-4">Unit</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Tenant</th>
                  <th className="px-6 py-4">Rent</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {previewRows.map((row) => (
                  <tr key={row.unit.id}>
                    <td className="px-6 py-4 font-black">{row.unit.unit_number}</td>
                    <td className="px-6 py-4">{row.unit.status}</td>
                    <td className="px-6 py-4">{row.tenant ? getTenantDisplayName(row.tenant) : 'Unassigned'}</td>
                    <td className="px-6 py-4">Ksh {Number(row.amount || 0).toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => navigate(`/app/real-estate/invoice/auto-billing/${property.id}`)} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 text-xs font-black">Open</button>
                        <button onClick={() => sendStk(row)} disabled={stkBusy === row.unit.id || !row.tenant?.phone} className="px-3 py-2 rounded-lg bg-brand-purple text-white text-xs font-black disabled:opacity-50">
                          {stkBusy === row.unit.id ? 'Sending...' : 'Send STK'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}

      {activeTab === 'preview' && (
        <div className="rounded-3xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 p-5">
        <div className="flex items-center gap-2 mb-4 text-brand-purple font-black uppercase tracking-[0.18em] text-[11px]">
          <WalletCards className="w-4 h-4" /> Billing Preview
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {previewRows.map((row) => (
            <div key={row.unit.id} className="rounded-2xl border border-gray-200 dark:border-white/10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-black">{row.tenant ? getTenantDisplayName(row.tenant) : 'Unassigned'}</p>
                  <p className="text-xs text-gray-500">{row.unit.unit_number} {row.unit.status === 'occupied' ? 'occupied' : 'vacant'}</p>
                </div>
                <span className="text-xs font-black">{row.dueDate}</span>
              </div>
              <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                <p>Amount: Ksh {row.amount.toLocaleString()}</p>
                <p>Fee: Ksh {row.split.companyRevenue.toLocaleString()}</p>
                <p>Landlord: Ksh {row.split.landlordPayable.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="rounded-3xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 overflow-hidden">
          <div className="p-5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
            <div>
              <h4 className="font-black text-xs uppercase tracking-widest text-gray-400 mb-1">Billing Audit</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Recent invoice runs, notifications, and skips.</p>
            </div>
            <div className="text-xs font-black uppercase tracking-widest text-brand-purple">{auditLogs.length} rows</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 dark:bg-black/10 text-[10px] uppercase font-black tracking-widest text-gray-400">
                <tr>
                  <th className="px-6 py-4">Run</th>
                  <th className="px-6 py-4">Tenant / Unit</th>
                  <th className="px-6 py-4">Invoice</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Notifications</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {auditLogs.length > 0 ? auditLogs.map((row) => (
                  <tr key={row.id}>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                      <div>{row.run_date}</div>
                      <div className="text-xs text-gray-400">{row.run_time}</div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-bold text-gray-900 dark:text-white">{row.tenant_name || '-'}</div>
                      <div className="text-xs text-gray-400">{row.unit_number || '-'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono">{row.invoice_number || '-'}</td>
                    <td className="px-6 py-4 text-sm font-bold text-brand-purple">Ksh {Number(row.amount || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 text-xs text-gray-600 dark:text-gray-300">
                      <div>Email: {row.notification_email_sent ? 'Sent' : row.notification_email_error ? 'Failed' : 'Skipped'}</div>
                      <div>SMS: {row.notification_sms_sent ? 'Sent' : row.notification_sms_error ? 'Failed' : 'Skipped'}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-black uppercase tracking-widest">{row.status || 'generated'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-sm text-gray-500">
                      No billing audit records yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
