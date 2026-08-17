// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  ArrowLeft,
  Home,
  LogOut,
  Moon,
  Printer,
  Receipt,
  ShieldCheck,
  Sun,
  User,
  Wallet,
  Activity,
  X,
  Wrench,
  FileSpreadsheet,
  TrendingDown,
  TrendingUp,
  CreditCard,
  CalendarDays,
  Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccess } from '../../context/AccessContext';
import { supabase, SUPABASE_URL } from '../../utils/supabase';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { getTenantDisplayName } from '../../utils/tenantDisplay';
import { callDaraja } from '../../services/darajaService';
import { fetchTenantForPortalUser } from '../../utils/tenantLookup';

type Invoice = {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  amount_due: number | string | null;
  amount_paid: number | string | null;
  total_amount?: number | string | null;
  status: string | null;
  unit_id?: string | null;
};

type Payment = {
  id: string;
  payment_date: string | null;
  amount: number | string | null;
  payment_method: string | null;
  reference_number: string | null;
  status: string | null;
};

type ReceiptPreview = {
  payment: Payment;
  amount: number;
};

type StatementRow = {
  date: string;
  type: 'invoice' | 'payment';
  reference: string;
  invoiceNo: string;
  invoiceDate: string;
  invoiceAmount: number;
  paymentDate: string;
  paymentAmount: number;
  mpesaRef: string;
  balance: number;
};

type ActiveTab = 'billing' | 'statement' | 'maintenance' | 'moveout';

// ─── Tenant Maintenance Panel ────────────────────────────────────────────────
interface MaintenanceTicket {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'emergency';
  status: 'open' | 'approved' | 'in_progress' | 'completed' | 'rejected';
  created_at: string;
}

function TenantMaintenancePanel({
  tenantId,
  unitId,
  propertyId,
  companyId,
}: {
  tenantId?: string;
  unitId?: string;
  propertyId?: string;
  companyId?: string;
}) {
  const { profile } = useAccess();
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' });

  const fetchTickets = async () => {
    if (!tenantId) return;
    setLoadingTickets(true);
    try {
      const { data, error } = await supabase
        .from('re_maintenance')
        .select('id, title, description, priority, status, created_at')
        .eq('unit_id', unitId || '')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTickets((data || []) as MaintenanceTicket[]);
    } catch (e: any) {
      console.error('Failed to load maintenance tickets', e);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => { void fetchTickets(); }, [tenantId, unitId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      const payload: any = {
        title: form.title,
        description: form.description,
        priority: form.priority,
        status: 'open',
        reported_by: profile?.id,
        unit_id: unitId || null,
        property_id: propertyId || null,
        company_id: companyId || null,
        attachments: [],
      };
      const { error } = await supabase.from('re_maintenance').insert([payload]);
      if (error) throw error;
      setToast({ message: 'Maintenance request submitted successfully!', type: 'success' });
      setShowForm(false);
      setForm({ title: '', description: '', priority: 'medium' });
      void fetchTickets();
    } catch (e: any) {
      setToast({ message: e?.message || 'Failed to submit request', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const priorityColor = (p: string) => {
    if (p === 'emergency') return 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30';
    if (p === 'high') return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/30';
    if (p === 'medium') return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/30';
    return 'text-gray-500 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10';
  };

  const statusColor = (s: string) => {
    if (s === 'completed') return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30';
    if (s === 'in_progress') return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/30';
    if (s === 'approved') return 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/30';
    if (s === 'rejected') return 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30';
    return 'text-gray-500 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10';
  };

  return (
    <div className="space-y-4">
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/20"
        >
          <Wrench size={14} /> New Maintenance Request
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 p-4 space-y-3">
          <h3 className="text-sm font-black uppercase tracking-widest text-gray-700 dark:text-white/70">New Request</h3>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Issue Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Leaking tap in bathroom"
              required
              className="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-400 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the issue in detail..."
              rows={3}
              className="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-400 text-gray-900 dark:text-white resize-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-400 text-gray-900 dark:text-white"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 transition-all font-black text-xs"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loadingTickets ? (
        <div className="text-center py-8 text-gray-400 text-xs font-bold uppercase tracking-widest">Loading...</div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-100 dark:border-white/5 rounded-2xl">
          <Wrench size={24} className="mx-auto mb-2 text-gray-300 dark:text-white/20" />
          <p className="text-[10px] text-gray-400 dark:text-white/20 font-black uppercase tracking-[0.3em]">No maintenance requests yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="p-4 bg-gray-50/40 dark:bg-white/[0.02] rounded-2xl border border-gray-100/50 dark:border-white/5 hover:border-amber-300/30 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-gray-800 dark:text-white truncate">{ticket.title}</p>
                  {ticket.description && (
                    <p className="text-[10px] text-gray-400 dark:text-white/30 mt-0.5 line-clamp-2">{ticket.description}</p>
                  )}
                  <p className="text-[9px] text-gray-300 dark:text-white/20 mt-1 font-bold uppercase tracking-widest">
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-col gap-1 items-end shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${priorityColor(ticket.priority)}`}>
                    {ticket.priority}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${statusColor(ticket.status)}`}>
                    {ticket.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && <CustomToast message={toast.message} type={toast.type} isVisible onClose={() => setToast(null)} />}
    </div>
  );
}

export default function TenantDashboardPage() {
  const navigate = useNavigate();
  const { profile } = useAccess();
  const [searchParams] = useSearchParams();
  const requestedTenantId = searchParams.get('tenantId');
  const isSuperAdmin = ['super admin', 'super_admin', 'director / super admin'].includes((profile?.role || '').trim().toLowerCase());
  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<any>(null);
  const [unit, setUnit] = useState<any>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<ReceiptPreview | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('billing');
  const [moveOutDate, setMoveOutDate] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [moveOutReason, setMoveOutReason] = useState('');
  const [moveOutSummary, setMoveOutSummary] = useState<any>(null);
  const [moveOutRequest, setMoveOutRequest] = useState<any>(null);
  const [submittingMoveOut, setSubmittingMoveOut] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  useEffect(() => {
    const load = async () => {
      if (!profile?.email) {
        setTenant(null);
        setUnit(null);
        setInvoices([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        let tenantData;
        if (requestedTenantId && isSuperAdmin) {
          let tenantQuery = supabase
            .from('re_tenants')
            .select('id, full_name, phone, email, company_id, current_unit_id, id_document_url, profile_image_url, unit:re_units!current_unit_id(id, unit_number, property_id, property:re_properties(name))')
            .eq('id', requestedTenantId);

          if (profile.company_id) {
            tenantQuery = tenantQuery.eq('company_id', profile.company_id);
          }

          const { data, error } = await tenantQuery.maybeSingle();
          if (error) throw error;
          tenantData = data;
        } else {
          tenantData = await fetchTenantForPortalUser(profile.email);
        }

        setTenant(tenantData || null);
        setUnit(tenantData?.unit || null);

        if (tenantData?.id) {
          const [invoiceRes, paymentRes] = await Promise.all([
            supabase
              .from('re_invoices')
              .select('id, invoice_number, invoice_date, due_date, amount_due, amount_paid, status, unit_id')
              .eq('tenant_id', tenantData.id)
              .order('invoice_date', { ascending: false }),
            supabase
              .from('re_payments')
              .select('id, payment_date, amount, payment_method, reference_number, status')
              .eq('tenant_id', tenantData.id)
              .order('payment_date', { ascending: false }),
          ]);

          if (invoiceRes.error) throw invoiceRes.error;
          if (paymentRes.error) throw paymentRes.error;
          setInvoices((invoiceRes.data || []) as Invoice[]);
          setPayments((paymentRes.data || []) as Payment[]);
          const [summaryRes, requestRes] = await Promise.all([
            supabase.rpc('get_tenant_move_out_summary', { p_tenant_id: tenantData.id }),
            supabase.from('re_tenant_move_out_requests').select('*').eq('tenant_id', tenantData.id).order('requested_at', { ascending: false }).limit(1).maybeSingle(),
          ]);
          if (!summaryRes.error) setMoveOutSummary(Array.isArray(summaryRes.data) ? summaryRes.data[0] : summaryRes.data);
          if (!requestRes.error) setMoveOutRequest(requestRes.data);
        }
      } catch (error: any) {
        console.error('Tenant dashboard load failed', error);
        setToast({ message: error?.message || 'Failed to load dashboard', type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [isSuperAdmin, profile?.company_id, profile?.email, requestedTenantId]);

  const currentBalance = useMemo(
    () => invoices.reduce((sum, inv) => sum + Math.max(0, Number(inv.amount_due || 0) - Number(inv.amount_paid || 0)), 0),
    [invoices],
  );

  const activeInvoicesCount = useMemo(
    () => invoices.filter((inv) => Math.max(0, Number(inv.amount_due || 0) - Number(inv.amount_paid || 0)) > 0).length,
    [invoices],
  );

  // Build account statement rows with running balance
  // Positive balance = tenant owes money; negative = overpayment (credit)
  const statementRows = useMemo<StatementRow[]>(() => {
    type RawEntry = { date: string; type: 'invoice' | 'payment'; data: Invoice | Payment };
    const entries: RawEntry[] = [
      ...invoices.map((inv) => ({ date: inv.invoice_date || '', type: 'invoice' as const, data: inv })),
      ...payments.map((pay) => ({ date: pay.payment_date || '', type: 'payment' as const, data: pay })),
    ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    let runningBalance = 0;
    return entries.map((entry) => {
      if (entry.type === 'invoice') {
        const inv = entry.data as Invoice;
        const amt = Number(inv.amount_due || 0);
        runningBalance += amt;
        return {
          date: inv.invoice_date || '',
          type: 'invoice',
          reference: inv.invoice_number || '',
          invoiceNo: inv.invoice_number || '',
          invoiceDate: inv.invoice_date || '',
          invoiceAmount: amt,
          paymentDate: '',
          paymentAmount: 0,
          mpesaRef: '',
          balance: runningBalance,
        };
      } else {
        const pay = entry.data as Payment;
        const amt = Number(pay.amount || 0);
        runningBalance -= amt;
        return {
          date: pay.payment_date || '',
          type: 'payment',
          reference: pay.reference_number || '',
          invoiceNo: '',
          invoiceDate: '',
          invoiceAmount: 0,
          paymentDate: pay.payment_date || '',
          paymentAmount: amt,
          mpesaRef: pay.reference_number || '',
          balance: runningBalance,
        };
      }
    });
  }, [invoices, payments]);

  const recentPayments = useMemo(() => payments.slice(0, 5), [payments]);

  const sendStk = async (invoice: Invoice, customPhone?: string) => {
    const phoneToUse = (customPhone || tenant?.phone || '').trim();
    if (!phoneToUse) {
      setToast({ message: 'Tenant phone number missing.', type: 'error' });
      return;
    }
    setSendingId(invoice.id);
    try {
      const balance = Math.max(0, Number(invoice.amount_due || 0) - Number(invoice.amount_paid || 0));
      const response = await callDaraja({
        action: 'stk-push',
        amount: Math.round(balance),
        phoneNumber: phoneToUse,
        callbackUrl: `${SUPABASE_URL}/functions/v1/mpesa-callback-ingest`,
        accountReference: invoice.invoice_number || 'HAKIKA',
        transactionDesc: `Invoice ${invoice.invoice_number}`,
        service_key: 'hakika',
        company_code: profile?.company_code || null,
      } as any);
      const checkoutRequestId = response?.response?.CheckoutRequestID || response?.response?.checkoutRequestID || response?.response?.CheckoutRequestId || null;
      if (checkoutRequestId) {
        await supabase
          .from('re_invoices')
          .update({
            mpesa_checkout_request_id: checkoutRequestId,
            mpesa_last_stk_request_at: new Date().toISOString(),
            reconciliation_status: 'pending',
          })
          .eq('id', invoice.id);
        setInvoices((current) =>
          current.map((item) =>
            item.id === invoice.id
              ? { ...item, mpesa_checkout_request_id: checkoutRequestId } as Invoice
              : item,
          ),
        );
      }
      setToast({ message: response?.response?.CustomerMessage || 'STK sent.', type: 'success' });
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to send', type: 'error' });
    } finally {
      setSendingId(null);
    }
  };

  const printInvoice = (invoice: Invoice) => window.print();
  const openReceiptPreview = (payment: Payment) => setReceiptPreview({ payment, amount: Number(payment.amount || 0) });
  const printReceipt = (payment: Payment) => window.print();

  const submitMoveOut = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenant?.id) return;
    setSubmittingMoveOut(true);
    try {
      const { data, error } = await supabase.rpc('submit_tenant_move_out_request', {
        p_tenant_id: tenant.id,
        p_requested_move_out_date: moveOutDate,
        p_reason: moveOutReason || null,
      });
      if (error) throw error;
      setMoveOutRequest(data);
      setToast({ message: 'Move-out request submitted. Your final invoice, arrears, and deposit settlement are summarized below.', type: 'success' });
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to submit move-out request', type: 'error' });
    } finally {
      setSubmittingMoveOut(false);
    }
  };

  const downloadHistory = () => {
    if (!tenant) return;
    const rows = [
      ['Tenant', getTenantDisplayName(tenant)],
      ['Property', unit?.property?.name || ''],
      ['Current unit', unit?.unit_number || ''],
      ['Closing balance', String(statementRows[statementRows.length - 1]?.balance || 0)],
      [],
      ['Date', 'Type', 'Reference', 'Invoice amount', 'Payment amount', 'Balance'],
      ...statementRows.map((row) => [row.date, row.type, row.reference, String(row.invoiceAmount), String(row.paymentAmount), String(row.balance)]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `tenant-history-${tenant.tenant_no || tenant.id.slice(0, 8)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#0b2a3c] transition-colors duration-300">
        <CustomLoader label="Initializing Portal..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b2a3c] text-gray-900 dark:text-white selection:bg-[#c89f5e]/30 font-inter transition-colors duration-300 no-print overflow-x-hidden">
      <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8 space-y-6">
        {/* Header */}
        {/* Mobile: two-row stacked layout. md+: original single-row layout */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between border-b border-gray-200 dark:border-white/5 pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="absolute inset-0 bg-[#c89f5e]/20 blur-xl rounded-full" />
                <img
                  src="/unnamed-removebg-preview.webp"
                  alt="Hakika Logo"
                  className="relative w-14 h-14 md:w-40 md:h-40 object-contain dark:brightness-200"
                />
              </div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight">
                Welcome, <span className="text-[#c89f5e]">{tenant ? getTenantDisplayName(tenant).split(' ')[0] : 'Tenant'}</span>
              </h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-white/40 font-medium hidden md:block">
              Manage your residence, invoices, and payments in one secure place.
            </p>
          </div>

          {/* Desktop buttons: original row. Mobile: full-width grid */}
          <div className="flex items-center gap-2 md:gap-3 flex-wrap md:flex-nowrap">
            {isSuperAdmin && requestedTenantId ? (
              <button
                type="button"
                onClick={() => navigate('/app/real-estate/tenants')}
                className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-[#c89f5e]/10 border border-[#c89f5e]/30 text-[#9a763f] dark:text-[#e4bd78] font-black text-xs hover:bg-[#c89f5e]/20 transition-all flex items-center justify-center gap-2"
                title="Return to tenant management"
              >
                <ArrowLeft size={14} /> Return to management
              </button>
            ) : null}
            <button
              onClick={toggleTheme}
              title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              className="p-3 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 transition-all shadow-sm"
            >
              {isDark ? <Sun size={18} className="text-[#c89f5e]" /> : <Moon size={18} className="text-gray-500" />}
            </button>
            <div className="h-8 w-px bg-gray-200 dark:bg-white/10 mx-1 hidden md:block" />
            <button
              onClick={() => navigate('/app/tenant/payments')}
              className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 transition-all font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
            >
              <Activity size={14} className="text-blue-500" />
              Payments
            </button>
            <button
              onClick={() => navigate('/app/tenant/profile')}
              className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 transition-all font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
            >
              <User size={14} className="text-[#c89f5e]" />
              Profile
            </button>
            <button
              onClick={() => navigate('/portal')}
              className="flex-1 md:flex-none px-5 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black text-xs hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-gray-900/10 dark:shadow-none"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Current Unit', value: unit?.unit_number || 'N/A', sub: unit?.property?.name || 'Property', icon: Home, color: 'text-blue-500' },
            {
              label: statementRows.length > 0 && statementRows[statementRows.length - 1].balance < 0 ? 'Overpayment (Credit)' : 'Outstanding Balance',
              value: `Ksh ${Math.abs(currentBalance).toLocaleString()}`,
              sub: statementRows.length > 0 && statementRows[statementRows.length - 1].balance < 0
                ? 'Credit on account'
                : `${activeInvoicesCount} Pending`,
              icon: statementRows.length > 0 && statementRows[statementRows.length - 1].balance < 0 ? TrendingDown : Wallet,
              color: statementRows.length > 0 && statementRows[statementRows.length - 1].balance < 0 ? 'text-emerald-500' : 'text-[#c89f5e]',
            },
            { label: 'Recent Invoice', value: invoices[0]?.invoice_number || 'N/A', sub: invoices[0]?.status || 'No history', icon: Receipt, color: 'text-purple-500' },
            { label: 'Account Security', value: 'Verified', sub: profile?.email || 'Secured', icon: ShieldCheck, color: 'text-emerald-500' }
          ].map((stat, i) => (
            <div key={i} className="bg-white dark:bg-white/5 p-5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm hover:border-[#c89f5e]/30 transition-all group">
              <div className="flex justify-between items-start mb-3">
                <div className={`p-2 rounded-lg bg-gray-50 dark:bg-white/5 ${stat.color}`}>
                  <stat.icon size={16} />
                </div>
                <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 group-hover:text-[#c89f5e] transition-colors">Live</div>
              </div>
              <div className="space-y-0.5">
                <h3 className="text-gray-500 dark:text-white/30 text-[10px] font-black uppercase tracking-[0.2em]">{stat.label}</h3>
                <div className="text-lg md:text-xl font-black tracking-tight break-all">{stat.value}</div>
                <p className="text-[9px] font-bold text-gray-400 dark:text-white/20 uppercase tracking-[0.2em] truncate">{stat.sub}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          {/* Main Content: Tabs */}
          <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#c89f5e]/5 blur-3xl -z-10" />

            {/* Tab Bar */}
            <div className="flex gap-1 mb-6 bg-gray-50 dark:bg-white/5 p-1 rounded-xl border border-gray-100 dark:border-white/5">
              {([
                { key: 'billing', label: 'Billing History', shortLabel: 'Billing', icon: Receipt },
                { key: 'statement', label: 'Account Statement', shortLabel: 'Statement', icon: FileSpreadsheet },
                { key: 'maintenance', label: 'Maintenance', shortLabel: 'Maintenance', icon: Wrench },
                { key: 'moveout', label: 'Move Out', shortLabel: 'Move Out', icon: LogOut },
              ] as { key: ActiveTab; label: string; shortLabel: string; icon: React.ElementType }[]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeTab === tab.key
                      ? 'bg-white dark:bg-white/10 text-[#c89f5e] shadow-sm border border-gray-100 dark:border-white/10'
                      : 'text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/50'
                  }`}
                >
                  <tab.icon size={12} />
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Billing History Tab */}
            {activeTab === 'billing' && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#c89f5e]/10 flex items-center justify-center text-[#c89f5e]">
                      <Receipt size={18} />
                    </div>
                    <div>
                      <h2 className="text-lg font-black tracking-tight">Billing History</h2>
                      <p className="text-[10px] text-gray-400 dark:text-white/30 font-black uppercase tracking-widest mt-0.5">Property service & rent invoices</p>
                    </div>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 text-[9px] font-black uppercase tracking-widest text-gray-500 dark:text-white/40">
                    {invoices.length} Items
                  </div>
                </div>
                <div className="space-y-3">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-4 bg-gray-50/40 dark:bg-white/[0.02] rounded-2xl border border-gray-100/50 dark:border-white/5 hover:border-[#c89f5e]/30 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shadow-sm ${
                          invoice.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                        }`}>
                          {invoice.status === 'paid' ? '✓' : '!'}
                        </div>
                        <div>
                          <h4 className="text-sm font-black tracking-tight group-hover:text-[#c89f5e] transition-colors">#{invoice.invoice_number}</h4>
                          <p className="text-[9px] text-gray-400 dark:text-white/20 font-black uppercase tracking-widest mt-1">{invoice.due_date || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-black tracking-tight">Ksh {Number(invoice.amount_due || 0).toLocaleString()}</p>
                          <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${
                            invoice.status === 'paid' ? 'text-emerald-500' : 'text-rose-500'
                          }`}>{invoice.status}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => printInvoice(invoice)}
                            className="p-2.5 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 transition-all text-gray-400 dark:text-white/20 hover:text-[#c89f5e] dark:hover:text-[#c89f5e]"
                          >
                            <Printer size={16} />
                          </button>
                          {invoice.status !== 'paid' && (
                            <button
                              onClick={() => void sendStk(invoice)}
                              disabled={sendingId === invoice.id}
                              className="px-5 py-2.5 rounded-xl bg-gray-900 dark:bg-gradient-to-br dark:from-[#c89f5e] dark:to-[#9b7133] text-white dark:text-[#07151f] text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-md active:scale-95 disabled:opacity-50"
                            >
                              {sendingId === invoice.id ? '...' : 'Pay'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {invoices.length === 0 && (
                    <div className="text-center py-16 border-2 border-dashed border-gray-100 dark:border-white/5 rounded-2xl">
                      <p className="text-[10px] text-gray-400 dark:text-white/20 font-black uppercase tracking-[0.3em]">No billing history found</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Account Statement Tab */}
            {activeTab === 'statement' && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                      <FileSpreadsheet size={18} />
                    </div>
                    <div>
                      <h2 className="text-lg font-black tracking-tight">Account Statement</h2>
                      <p className="text-[10px] text-gray-400 dark:text-white/30 font-black uppercase tracking-widest mt-0.5">Full transaction history with running balance</p>
                    </div>
                  </div>
                  {/* Running balance summary */}
                  {statementRows.length > 0 && (
                    <div className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                      statementRows[statementRows.length - 1].balance <= 0
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30'
                        : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/30'
                    }`}>
                      {statementRows[statementRows.length - 1].balance <= 0
                        ? `Credit: Ksh ${Math.abs(statementRows[statementRows.length - 1].balance).toLocaleString()}`
                        : `Owed: Ksh ${statementRows[statementRows.length - 1].balance.toLocaleString()}`}
                    </div>
                  )}
                </div>

                {statementRows.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed border-gray-100 dark:border-white/5 rounded-2xl">
                    <p className="text-[10px] text-gray-400 dark:text-white/20 font-black uppercase tracking-[0.3em]">No transactions found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-2">
                    <table className="w-full text-xs min-w-[600px]">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-white/5">
                          <th className="text-left py-2 px-2 text-[9px] font-black uppercase tracking-widest text-gray-400">Invoice Date</th>
                          <th className="text-left py-2 px-2 text-[9px] font-black uppercase tracking-widest text-gray-400">Invoice No</th>
                          <th className="text-right py-2 px-2 text-[9px] font-black uppercase tracking-widest text-gray-400">Invoice Amt</th>
                          <th className="text-left py-2 px-2 text-[9px] font-black uppercase tracking-widest text-gray-400">Payment Date</th>
                          <th className="text-right py-2 px-2 text-[9px] font-black uppercase tracking-widest text-gray-400">Payment Amt</th>
                          <th className="text-left py-2 px-2 text-[9px] font-black uppercase tracking-widest text-gray-400">M-Pesa Ref</th>
                          <th className="text-right py-2 px-2 text-[9px] font-black uppercase tracking-widest text-gray-400">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                        {statementRows.map((row, i) => (
                          <tr key={i} className={`hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors ${
                            row.type === 'payment' ? 'bg-emerald-50/30 dark:bg-emerald-900/5' : ''
                          }`}>
                            <td className="py-2.5 px-2 text-gray-600 dark:text-white/50">{row.invoiceDate || '—'}</td>
                            <td className="py-2.5 px-2 font-bold text-gray-800 dark:text-white/80">{row.invoiceNo || '—'}</td>
                            <td className="py-2.5 px-2 text-right font-bold text-rose-600 dark:text-rose-400">
                              {row.invoiceAmount > 0 ? `Ksh ${row.invoiceAmount.toLocaleString()}` : '—'}
                            </td>
                            <td className="py-2.5 px-2 text-gray-600 dark:text-white/50">{row.paymentDate || '—'}</td>
                            <td className="py-2.5 px-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              {row.paymentAmount > 0 ? `Ksh ${row.paymentAmount.toLocaleString()}` : '—'}
                            </td>
                            <td className="py-2.5 px-2 text-gray-500 dark:text-white/40 font-mono text-[10px]">{row.mpesaRef || '—'}</td>
                            <td className={`py-2.5 px-2 text-right font-black ${
                              row.balance < 0 ? 'text-emerald-600 dark:text-emerald-400' : row.balance === 0 ? 'text-gray-500' : 'text-rose-600 dark:text-rose-400'
                            }`}>
                              {row.balance < 0
                                ? `(${Math.abs(row.balance).toLocaleString()})`
                                : `Ksh ${row.balance.toLocaleString()}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-200 dark:border-white/10">
                          <td colSpan={6} className="py-3 px-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                            Closing Balance
                            {statementRows[statementRows.length - 1]?.balance < 0 && (
                              <span className="ml-2 text-emerald-600 dark:text-emerald-400 text-[9px]">(Overpayment — credit on account)</span>
                            )}
                          </td>
                          <td className={`py-3 px-2 text-right font-black text-sm ${
                            statementRows[statementRows.length - 1]?.balance < 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {statementRows[statementRows.length - 1]?.balance < 0
                              ? `(Ksh ${Math.abs(statementRows[statementRows.length - 1].balance).toLocaleString()})`
                              : `Ksh ${(statementRows[statementRows.length - 1]?.balance || 0).toLocaleString()}`}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* Maintenance Tab */}
            {activeTab === 'maintenance' && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                      <Wrench size={18} />
                    </div>
                    <div>
                      <h2 className="text-lg font-black tracking-tight">Maintenance Requests</h2>
                      <p className="text-[10px] text-gray-400 dark:text-white/30 font-black uppercase tracking-widest mt-0.5">Report and track repair issues</p>
                    </div>
                  </div>
                </div>
                <TenantMaintenancePanel tenantId={tenant?.id} unitId={unit?.id} propertyId={unit?.property_id} companyId={tenant?.company_id} />
              </>
            )}

            {activeTab === 'moveout' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500"><LogOut size={18} /></div>
                    <div><h2 className="text-lg font-black tracking-tight">Move Out Request</h2><p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-white/30">30-day notice and deposit settlement</p></div>
                  </div>
                  <button type="button" onClick={downloadHistory} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-600 hover:border-[#c89f5e] dark:border-white/10 dark:text-white/60"><Download size={14} /> Download history</button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ['Arrears', `Ksh ${Number(moveOutSummary?.arrears ?? currentBalance).toLocaleString()}`],
                    ['Deposit received', `Ksh ${Number(moveOutSummary?.deposit_received || 0).toLocaleString()}`],
                    ['Estimated refundable', `Ksh ${Number(moveOutSummary?.refundable_deposit || 0).toLocaleString()}`],
                  ].map(([label, value]) => <div key={label} className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-white/5 dark:bg-white/[0.03]"><p className="text-[9px] font-black uppercase tracking-widest text-gray-400">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>)}
                </div>
                {moveOutRequest ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 text-sm dark:border-emerald-900/30 dark:bg-emerald-900/10"><p className="font-black text-emerald-700 dark:text-emerald-400">Request submitted · {moveOutRequest.status}</p><p className="mt-1 text-gray-600 dark:text-white/60">Requested date: {moveOutRequest.requested_move_out_date}. Earliest eligible date: {moveOutRequest.eligible_move_out_date}.</p><p className="mt-2 text-xs text-gray-500 dark:text-white/40">Final refund is subject to inspection and settlement of confirmed arrears.</p></div>
                ) : (
                  <form onSubmit={submitMoveOut} className="space-y-4 rounded-2xl border border-gray-100 p-5 dark:border-white/5">
                    <div className="rounded-xl bg-blue-50/70 p-4 text-sm text-blue-800 dark:bg-blue-900/10 dark:text-blue-300">A 30-day notice is required. You may request an earlier date, but the system will show the contractual eligible date for deposit settlement.</div>
                    <div><label htmlFor="move-out-date" className="mb-1 block text-xs font-black uppercase tracking-widest text-gray-500">Requested move-out date</label><div className="relative"><CalendarDays size={16} className="absolute left-3 top-3 text-gray-400" /><input id="move-out-date" type="date" required value={moveOutDate} onChange={(e) => setMoveOutDate(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm dark:border-white/10 dark:bg-white/5" /></div></div>
                    <div><label htmlFor="move-out-reason" className="mb-1 block text-xs font-black uppercase tracking-widest text-gray-500">Reason (optional)</label><textarea id="move-out-reason" rows={3} value={moveOutReason} onChange={(e) => setMoveOutReason(e.target.value)} placeholder="Tell property management anything they should know" className="w-full resize-none rounded-xl border border-gray-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-white/5" /></div>
                    <button type="submit" disabled={submittingMoveOut} className="rounded-xl bg-gray-900 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50 dark:bg-[#c89f5e] dark:text-[#07151f]">{submittingMoveOut ? 'Submitting...' : 'Submit move-out request'}</button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -z-10" />
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <Activity size={20} />
                  </div>
                  <h3 className="text-lg font-black tracking-tight">Recent Activity</h3>
                </div>
                <button 
                  onClick={() => navigate('/app/tenant/payments')}
                  className="text-[9px] font-black uppercase tracking-widest text-blue-500 hover:underline"
                >
                  View All
                </button>
              </div>
              <div className="space-y-6">
                {recentPayments.map((payment) => (
                  <div key={payment.id} className="relative pl-6 before:absolute before:left-0 before:top-2 before:bottom-0 before:w-px before:bg-gray-200 dark:before:bg-white/10">
                    <div className="absolute left-[-3.5px] top-2 w-1.5 h-1.5 rounded-full bg-[#c89f5e]" />
                    <div className="space-y-1">
                      <p className="font-bold text-xs">{payment.reference_number || 'Payment'}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{payment.payment_date || 'N/A'}</p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-sm font-black text-blue-500">Ksh {Number(payment.amount || 0).toLocaleString()}</p>
                        <button 
                          onClick={() => openReceiptPreview(payment)}
                          className="text-[10px] font-black uppercase tracking-widest text-[#c89f5e] hover:underline"
                        >
                          Receipt
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {payments.length === 0 && (
                  <p className="text-center text-gray-400 text-xs py-8 font-bold uppercase tracking-widest">No recent payments</p>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm relative overflow-hidden">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#c89f5e]/5 rounded-full blur-2xl" />
              <div className="relative space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-500">
                    <ShieldCheck size={16} />
                  </div>
                  <h3 className="text-base font-black tracking-tight">Quick Actions</h3>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-white/30 leading-relaxed font-bold">
                  Update your profile or change security credentials.
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => setActiveTab('statement')}
                    className="w-full py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/20 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-all font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400"
                  >
                    <FileSpreadsheet size={12} />
                    Account Statement
                  </button>
                  <button
                    onClick={() => setActiveTab('maintenance')}
                    className="w-full py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/20 hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-all font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400"
                  >
                    <Wrench size={12} />
                    Request Maintenance
                  </button>
                  <button
                    onClick={() => navigate('/app/tenant/profile')}
                    className="w-full py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-all font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    Edit Profile
                    <ArrowRight size={12} />
                  </button>
                  <button
                    onClick={() => navigate('/reset-password')}
                    className="w-full py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-all font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    Change Password
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Modal */}
      <AnimatePresence>
        {receiptPreview && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReceiptPreview(null)}
              className="absolute inset-0 bg-gray-900/60 dark:bg-[#07151f]/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-[#0b2233] border border-gray-200 dark:border-white/10 rounded-[32px] overflow-hidden shadow-2xl printable-card"
            >
              <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
                <h3 className="text-xl font-black tracking-tight">Payment Receipt</h3>
                <button onClick={() => setReceiptPreview(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors text-gray-400">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Amount Paid</p>
                  <p className="text-3xl font-black text-[#c89f5e]">Ksh {receiptPreview.amount.toLocaleString()}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    { label: 'Reference', value: receiptPreview.payment.reference_number || 'N/A' },
                    { label: 'Date', value: receiptPreview.payment.payment_date || 'N/A' },
                    { label: 'Method', value: receiptPreview.payment.payment_method || 'N/A' },
                    { label: 'Status', value: receiptPreview.payment.status || 'Confirmed' },
                  ].map((item, i) => (
                    <div key={i} className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">{item.label}</p>
                      <p className="text-xs font-bold">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-6 bg-gray-50 dark:bg-white/5 flex gap-3">
                <button
                  onClick={() => { printReceipt(receiptPreview.payment); setReceiptPreview(null); }}
                  className="flex-1 py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black text-xs hover:opacity-90 transition-all flex items-center justify-center gap-2"
                >
                  <Printer size={14} /> Print Receipt
                </button>
                <button
                  onClick={() => setReceiptPreview(null)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 transition-all font-black text-xs"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {toast && (
        <CustomToast 
          message={toast.message} 
          type={toast.type} 
          isVisible={true} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  );
}
