// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Activity, Printer, X, Wallet, Receipt, ShieldCheck,
  BadgeCheck, Sun, Moon, Wrench, CreditCard, TrendingDown, TrendingUp,
  Plus, CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccess } from '../../context/AccessContext';
import { supabase, SUPABASE_URL } from '../../utils/supabase';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { callDaraja } from '../../services/darajaService';
import { fetchTenantForPortalUser } from '../../utils/tenantLookup';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Invoice = {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  amount_due: number | string | null;
  amount_paid: number | string | null;
  status: string | null;
};

type Payment = {
  id: string;
  payment_date: string | null;
  amount: number | string | null;
  payment_method: string | null;
  reference_number: string | null;
  status: string | null;
  invoice_id?: string | null;
  notes?: string | null;
};

type MaintenanceTicket = {
  id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'emergency';
  status: 'open' | 'approved' | 'in_progress' | 'completed' | 'rejected';
  created_at: string;
};

type ActiveTab = 'payments' | 'invoices' | 'maintenance';

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function TenantPaymentsPage() {
  const navigate = useNavigate();
  const { profile } = useAccess();

  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<any>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('payments');

  // Pay invoice
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Prepay / top-up
  const [showPrepay, setShowPrepay] = useState(false);
  const [prepayAmount, setPrepayAmount] = useState('');
  const [prepayPhone, setPrepayPhone] = useState('');
  const [prepaying, setPrepaying] = useState(false);

  useEffect(() => {
    if (tenant?.phone && !prepayPhone) {
      setPrepayPhone(tenant.phone);
    }
  }, [tenant]);

  // Receipt modal
  const [receiptPreview, setReceiptPreview] = useState<{ payment: Payment; amount: number } | null>(null);

  // Maintenance form
  const [showMaintForm, setShowMaintForm] = useState(false);
  const [maintForm, setMaintForm] = useState({ title: '', description: '', priority: 'medium' });
  const [submittingMaint, setSubmittingMaint] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceLoaded, setMaintenanceLoaded] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

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

  // â”€â”€â”€ Load data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const loadData = async () => {
    if (!profile?.email) { setLoading(false); return; }
    setLoading(true);
    try {
      const tenantData = await fetchTenantForPortalUser(profile.email);

      setTenant(tenantData || null);

      if (tenantData?.id) {
        const [payRes, invRes] = await Promise.all([
          supabase
            .from('re_payments')
            .select('id, payment_date, amount, payment_method, reference_number, status, invoice_id, notes')
            .eq('tenant_id', tenantData.id)
            .order('payment_date', { ascending: false }),
          supabase
            .from('re_invoices')
            .select('id, invoice_number, invoice_date, due_date, amount_due, amount_paid, status')
            .eq('tenant_id', tenantData.id)
            .order('invoice_date', { ascending: false }),
        ]);

        if (payRes.error) throw payRes.error;
        if (invRes.error) throw invRes.error;

        setPayments((payRes.data || []) as Payment[]);
        setInvoices((invRes.data || []) as Invoice[]);
        setTickets([]);
        setMaintenanceLoaded(false);
      }
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to load data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, [profile?.email]);

  const loadMaintenance = async () => {
    if (!tenant?.current_unit_id || maintenanceLoading || maintenanceLoaded) return;
    setMaintenanceLoading(true);
    try {
      const { data, error } = await supabase
        .from('re_maintenance')
        .select('id, title, description, priority, status, created_at')
        .eq('unit_id', tenant.current_unit_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTickets((data || []) as MaintenanceTicket[]);
      setMaintenanceLoaded(true);
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to load maintenance requests', type: 'error' });
    } finally {
      setMaintenanceLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'maintenance') {
      void loadMaintenance();
    }
  }, [activeTab, tenant?.current_unit_id]);

  // â”€â”€â”€ Derived state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Build invoice map for payment context
  const invoiceMap = useMemo(() => {
    const m: Record<string, Invoice> = {};
    invoices.forEach((inv) => { m[inv.id] = inv; });
    return m;
  }, [invoices]);

  // Running balance: sum of invoices minus sum of payments
  const runningBalance = useMemo(() => {
    const totalInvoiced = invoices.reduce((s, inv) => s + Number(inv.amount_due || 0), 0);
    const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    return totalInvoiced - totalPaid; // negative = credit/overpayment
  }, [invoices, payments]);

  const unpaidInvoices = useMemo(
    () => invoices.filter((inv) => {
      const balance = Number(inv.amount_due || 0) - Number(inv.amount_paid || 0);
      return balance > 0;
    }),
    [invoices],
  );

  // â”€â”€â”€ Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Pay invoice — phone confirmation modal
  const [payConfirm, setPayConfirm] = useState<{ invoice: Invoice; phone: string; amount: number } | null>(null);

  const openPayConfirm = (invoice: Invoice) => {
    const balance = Math.max(0, Number(invoice.amount_due || 0) - Number(invoice.amount_paid || 0));
    if (balance <= 0) return;
    setPayConfirm({ invoice, phone: tenant?.phone || '', amount: balance });
  };

  const payInvoice = async () => {
    if (!payConfirm) return;
    const { invoice, phone, amount } = payConfirm;
    if (!phone.trim()) { setToast({ message: 'Enter a phone number to receive the STK push.', type: 'error' }); return; }
    setSendingId(invoice.id);
    setPayConfirm(null);
    try {
      const res = await callDaraja({
        action: 'stk-push',
        amount: Math.round(amount),
        phoneNumber: phone.trim(),
        callbackUrl: `${SUPABASE_URL}/functions/v1/mpesa-callback-ingest`,
        accountReference: invoice.invoice_number || 'HAKIKA',
        transactionDesc: `Invoice ${invoice.invoice_number}`,
        service_key: 'hakika',
        company_code: profile?.company_code || null,
      } as any);
      const checkoutRequestId = res?.response?.CheckoutRequestID || res?.response?.checkoutRequestID || res?.response?.CheckoutRequestId || null;
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
      setToast({ message: res?.response?.CustomerMessage || 'STK push sent. Check your phone.', type: 'success' });
    } catch (err: any) {
      setToast({ message: err?.message || 'Payment failed', type: 'error' });
    } finally {
      setSendingId(null);
    }
  };

  const submitPrepay = async () => {
    const amount = Number(prepayAmount);
    if (!amount || amount <= 0) { setToast({ message: 'Enter a valid amount.', type: 'error' }); return; }
    const phone = prepayPhone.trim() || tenant?.phone;
    if (!phone) { setToast({ message: 'Enter a phone number.', type: 'error' }); return; }
    setPrepaying(true);
    try {
      const res = await callDaraja({
        action: 'stk-push',
        amount: Math.round(amount),
        phoneNumber: phone,
        callbackUrl: `${SUPABASE_URL}/functions/v1/mpesa-callback-ingest`,
        accountReference: 'PREPAY',
        transactionDesc: 'Account prepayment',
        service_key: 'hakika',
        company_code: profile?.company_code || null,
      } as any);
      setToast({ message: res?.response?.CustomerMessage || 'STK push sent. Check your phone.', type: 'success' });
      setShowPrepay(false);
      setPrepayAmount('');
      setPrepayPhone('');
    } catch (err: any) {
      setToast({ message: err?.message || 'Payment failed', type: 'error' });
    } finally {
      setPrepaying(false);
    }
  };

  const submitMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintForm.title.trim()) return;
    setSubmittingMaint(true);
    try {
      const { error } = await supabase.from('re_maintenance').insert([{
        title: maintForm.title,
        description: maintForm.description || null,
        priority: maintForm.priority,
        status: 'open',
        reported_by: profile?.id,
        unit_id: tenant?.current_unit_id || null,
        property_id: tenant?.unit?.property_id || null,
        company_id: tenant?.company_id || null,
        attachments: [],
      }]);
      if (error) throw error;
      setToast({ message: 'Maintenance request submitted.', type: 'success' });
      setShowMaintForm(false);
      setMaintForm({ title: '', description: '', priority: 'medium' });
      setMaintenanceLoaded(false);
      void loadMaintenance();
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to submit', type: 'error' });
    } finally {
      setSubmittingMaint(false);
    }
  };

  // â”€â”€â”€ Loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#0b2a3c]">
        <CustomLoader label="Loading..." />
      </div>
    );
  }
  // --- Download / Print helpers ------------------------------------------------

  const downloadCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const escape = (v: string | number) => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printHTML = (title: string, html: string) => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>
        body{font-family:sans-serif;padding:32px;color:#111;font-size:13px}
        h1{font-size:20px;font-weight:900;margin-bottom:4px}
        p.sub{font-size:11px;color:#666;margin-bottom:24px}
        table{width:100%;border-collapse:collapse}
        th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#666;padding:8px 10px;border-bottom:2px solid #eee}
        td{padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:12px}
        tr:last-child td{border-bottom:none}
        .badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;text-transform:uppercase}
        .paid{background:#d1fae5;color:#065f46} .unpaid{background:#fee2e2;color:#991b1b}
        .credit{background:#d1fae5;color:#065f46} .owed{background:#fee2e2;color:#991b1b}
        .footer{margin-top:32px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:12px}
        @media print{body{padding:16px}}
      </style></head><body>${html}
      <div class="footer">Generated by HAKIKA · ${new Date().toLocaleString()}</div>
      <script>window.onload=()=>{window.print();}<\/script></body></html>`);
    win.document.close();
  };

  const downloadPaymentsCSV = () => {
    downloadCSV(
      `payments-${tenant?.full_name || 'tenant'}-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Date', 'Reference', 'Method', 'Amount (Ksh)', 'Status', 'Invoice'],
      payments.map((p) => [
        p.payment_date || '',
        p.reference_number || '',
        p.payment_method || 'M-Pesa',
        Number(p.amount || 0),
        p.status || 'confirmed',
        p.invoice_id ? (invoiceMap[p.invoice_id]?.invoice_number || p.invoice_id) : (p.notes === 'prepayment' ? 'Prepayment' : ''),
      ]),
    );
  };

  const printPayments = () => {
    const rows = payments.map((p) => {
      const inv = p.invoice_id ? invoiceMap[p.invoice_id] : null;
      return `<tr>
        <td>${p.payment_date || '—'}</td>
        <td>${p.reference_number || '—'}</td>
        <td>${p.payment_method || 'M-Pesa'}</td>
        <td><strong>Ksh ${Number(p.amount || 0).toLocaleString()}</strong></td>
        <td><span class="badge paid">${p.status || 'confirmed'}</span></td>
        <td>${inv ? `#${inv.invoice_number}` : p.notes === 'prepayment' ? 'Prepayment' : '—'}</td>
      </tr>`;
    }).join('');
    const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    printHTML('Payment History', `
      <h1>Payment History</h1>
      <p class="sub">${tenant?.full_name || ''} · ${tenant?.unit?.unit_number ? `Unit ${tenant.unit.unit_number}` : ''} · ${tenant?.unit?.property?.name || ''}</p>
      <table><thead><tr><th>Date</th><th>Reference</th><th>Method</th><th>Amount</th><th>Status</th><th>Invoice</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="3"><strong>Total Paid</strong></td><td colspan="3"><strong>Ksh ${totalPaid.toLocaleString()}</strong></td></tr></tfoot>
      </table>`);
  };

  const downloadInvoicesCSV = () => {
    downloadCSV(
      `invoices-${tenant?.full_name || 'tenant'}-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Invoice No', 'Invoice Date', 'Due Date', 'Amount Due (Ksh)', 'Amount Paid (Ksh)', 'Balance (Ksh)', 'Status'],
      invoices.map((inv) => {
        const balance = Math.max(0, Number(inv.amount_due || 0) - Number(inv.amount_paid || 0));
        return [
          inv.invoice_number || '',
          inv.invoice_date || '',
          inv.due_date || '',
          Number(inv.amount_due || 0),
          Number(inv.amount_paid || 0),
          balance,
          inv.status || '',
        ];
      }),
    );
  };

  const printInvoices = () => {
    const rows = invoices.map((inv) => {
      const balance = Math.max(0, Number(inv.amount_due || 0) - Number(inv.amount_paid || 0));
      const isPaid = balance === 0;
      return `<tr>
        <td><strong>#${inv.invoice_number}</strong></td>
        <td>${inv.invoice_date || '—'}</td>
        <td>${inv.due_date || '—'}</td>
        <td>Ksh ${Number(inv.amount_due || 0).toLocaleString()}</td>
        <td>Ksh ${Number(inv.amount_paid || 0).toLocaleString()}</td>
        <td><strong>${isPaid ? '—' : `Ksh ${balance.toLocaleString()}`}</strong></td>
        <td><span class="badge ${isPaid ? 'paid' : 'unpaid'}">${inv.status || ''}</span></td>
      </tr>`;
    }).join('');
    const totalDue = invoices.reduce((s, inv) => s + Number(inv.amount_due || 0), 0);
    const totalPaid = invoices.reduce((s, inv) => s + Number(inv.amount_paid || 0), 0);
    const balance = totalDue - totalPaid;
    printHTML('Invoice Statement', `
      <h1>Invoice Statement</h1>
      <p class="sub">${tenant?.full_name || ''} · ${tenant?.unit?.unit_number ? `Unit ${tenant.unit.unit_number}` : ''} · ${tenant?.unit?.property?.name || ''}</p>
      <table><thead><tr><th>Invoice No</th><th>Invoice Date</th><th>Due Date</th><th>Amount Due</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="3"><strong>Totals</strong></td>
        <td><strong>Ksh ${totalDue.toLocaleString()}</strong></td>
        <td><strong>Ksh ${totalPaid.toLocaleString()}</strong></td>
        <td><strong class="${balance < 0 ? 'credit' : balance > 0 ? 'owed' : ''}">${balance < 0 ? `Credit Ksh ${Math.abs(balance).toLocaleString()}` : balance === 0 ? 'Settled' : `Owed Ksh ${balance.toLocaleString()}`}</strong></td>
        <td></td></tr>
      </tfoot></table>`);
  };

  const downloadStatementCSV = () => {
    // Combined chronological statement
    type Row = { date: string; type: string; ref: string; debit: number; credit: number; balance: number };
    const rows: Row[] = [];
    let bal = 0;
    const entries = [
      ...invoices.map((inv) => ({ date: inv.invoice_date || '', type: 'Invoice', ref: `#${inv.invoice_number}`, debit: Number(inv.amount_due || 0), credit: 0 })),
      ...payments.map((p) => ({ date: p.payment_date || '', type: 'Payment', ref: p.reference_number || '', debit: 0, credit: Number(p.amount || 0) })),
    ].sort((a, b) => (a.date < b.date ? -1 : 1));
    entries.forEach((e) => { bal += e.debit - e.credit; rows.push({ ...e, balance: bal }); });
    downloadCSV(
      `statement-${tenant?.full_name || 'tenant'}-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Date', 'Type', 'Reference', 'Debit (Ksh)', 'Credit (Ksh)', 'Balance (Ksh)'],
      rows.map((r) => [r.date, r.type, r.ref, r.debit || '', r.credit || '', r.balance]),
    );
  };

  const printStatement = () => {
    type Row = { date: string; type: string; ref: string; debit: number; credit: number; balance: number };
    const rows: Row[] = [];
    let bal = 0;
    const entries = [
      ...invoices.map((inv) => ({ date: inv.invoice_date || '', type: 'Invoice', ref: `#${inv.invoice_number}`, debit: Number(inv.amount_due || 0), credit: 0 })),
      ...payments.map((p) => ({ date: p.payment_date || '', type: 'Payment', ref: p.reference_number || '', debit: 0, credit: Number(p.amount || 0) })),
    ].sort((a, b) => (a.date < b.date ? -1 : 1));
    entries.forEach((e) => { bal += e.debit - e.credit; rows.push({ ...e, balance: bal }); });
    const tableRows = rows.map((r) => `<tr>
      <td>${r.date || '—'}</td>
      <td><span class="badge ${r.type === 'Payment' ? 'paid' : 'unpaid'}">${r.type}</span></td>
      <td>${r.ref}</td>
      <td class="owed">${r.debit > 0 ? `Ksh ${r.debit.toLocaleString()}` : '—'}</td>
      <td class="paid">${r.credit > 0 ? `Ksh ${r.credit.toLocaleString()}` : '—'}</td>
      <td><strong class="${r.balance < 0 ? 'credit' : r.balance > 0 ? 'owed' : ''}">${r.balance < 0 ? `(Ksh ${Math.abs(r.balance).toLocaleString()})` : `Ksh ${r.balance.toLocaleString()}`}</strong></td>
    </tr>`).join('');
    printHTML('Account Statement', `
      <h1>Account Statement</h1>
      <p class="sub">${tenant?.full_name || ''} · ${tenant?.unit?.unit_number ? `Unit ${tenant.unit.unit_number}` : ''} · ${tenant?.unit?.property?.name || ''}</p>
      <table><thead><tr><th>Date</th><th>Type</th><th>Reference</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
      <tbody>${tableRows}</tbody></table>`);
  };
  // --- Render -------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b2a3c] text-gray-900 dark:text-white selection:bg-[#c89f5e]/30 font-inter transition-colors duration-300 no-print overflow-x-hidden">
      <div className="mx-auto max-w-5xl p-4 md:p-6 lg:p-8 space-y-6">

        {/* -- Header -- */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-gray-200 dark:border-white/5 pb-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/app/tenant/dashboard')}
              className="shrink-0 p-2 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 transition-all"
            >
              <ArrowLeft size={16} className="text-gray-500" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-black tracking-tight truncate">
                Payments &amp; <span className="text-[#c89f5e]">Account</span>
              </h1>
              <p className="text-[10px] text-gray-400 dark:text-white/30 font-bold uppercase tracking-widest mt-0.5 truncate">
                {tenant?.unit?.unit_number ? `Unit ${tenant.unit.unit_number} · ` : ''}{tenant?.unit?.property?.name || ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Balance badge */}
            <div className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
              runningBalance < 0
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30'
                : runningBalance === 0
                ? 'bg-gray-50 dark:bg-white/5 text-gray-500 border-gray-200 dark:border-white/10'
                : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/30'
            }`}>
              {runningBalance < 0
                ? `Credit Ksh ${Math.abs(runningBalance).toLocaleString()}`
                : runningBalance === 0
                ? 'Fully Paid'
                : `Owed Ksh ${runningBalance.toLocaleString()}`}
            </div>
            {/* Prepay button */}
            <button
              onClick={() => setShowPrepay(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#c89f5e] hover:bg-[#b08a4a] text-white font-black text-[10px] uppercase tracking-widest transition-all shadow-md shadow-[#c89f5e]/20"
            >
              <Plus size={12} /> Prepay
            </button>
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 transition-all"
            >
              {isDark ? <Sun size={15} className="text-[#c89f5e]" /> : <Moon size={15} className="text-gray-500" />}
            </button>
          </div>
        </div>

        {/* -- Tab Bar -- */}
        <div className="flex gap-1 bg-gray-50 dark:bg-white/5 p-1 rounded-xl border border-gray-100 dark:border-white/5">
          {([
            { key: 'payments', label: 'Payments', icon: Wallet },
            { key: 'invoices', label: 'Invoices', icon: Receipt },
            { key: 'maintenance', label: 'Maintenance', icon: Wrench },
          ] as { key: ActiveTab; label: string; icon: React.ElementType }[]).map((tab) => (
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
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* -- Payments Tab -- */}
        {activeTab === 'payments' && (
          <div className="bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <Activity size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-black tracking-tight">Payment History</h2>
                  <p className="text-[9px] text-gray-400 dark:text-white/30 font-bold uppercase tracking-widest">{payments.length} transactions</p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {payments.map((payment) => {
                const linkedInvoice = payment.invoice_id ? invoiceMap[payment.invoice_id] : null;
                return (
                  <div key={payment.id} className="flex items-center justify-between p-4 hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-all group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <CheckCircle2 size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black truncate group-hover:text-blue-500 transition-colors">
                          {payment.reference_number || 'Payment'}
                        </p>
                        <p className="text-[9px] text-gray-400 dark:text-white/30 font-bold uppercase tracking-widest mt-0.5">
                          {payment.payment_date || 'N/A'} · {payment.payment_method || 'M-Pesa'}
                          {linkedInvoice ? ` · Inv #${linkedInvoice.invoice_number}` : payment.notes === 'prepayment' ? ' · Prepayment' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                          Ksh {Number(payment.amount || 0).toLocaleString()}
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{payment.status || 'confirmed'}</p>
                      </div>
                      <button
                        onClick={() => setReceiptPreview({ payment, amount: Number(payment.amount || 0) })}
                        className="px-3 py-1.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
                      >
                        Receipt
                      </button>
                    </div>
                  </div>
                );
              })}
              {payments.length === 0 && (
                <div className="text-center py-16">
                  <Activity size={24} className="mx-auto mb-3 text-gray-200 dark:text-white/10" />
                  <p className="text-[10px] text-gray-400 dark:text-white/20 font-black uppercase tracking-[0.3em]">No payments yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* -- Invoices Tab -- */}
        {activeTab === 'invoices' && (
          <div className="bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#c89f5e]/10 flex items-center justify-center text-[#c89f5e]">
                  <Receipt size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-black tracking-tight">Invoices</h2>
                  <p className="text-[9px] text-gray-400 dark:text-white/30 font-bold uppercase tracking-widest">
                    {unpaidInvoices.length} unpaid · {invoices.length} total
                  </p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-white/5">
              {invoices.map((invoice) => {
                const balance = Math.max(0, Number(invoice.amount_due || 0) - Number(invoice.amount_paid || 0));
                const isPaid = balance === 0;
                return (
                  <div key={invoice.id} className="flex items-center justify-between p-4 hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-all group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center font-black text-xs ${
                        isPaid ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                      }`}>
                        {isPaid ? '?' : '!'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black truncate">#{invoice.invoice_number}</p>
                        <p className="text-[9px] text-gray-400 dark:text-white/30 font-bold uppercase tracking-widest mt-0.5">
                          Due {invoice.due_date || 'N/A'} · Total Ksh {Number(invoice.amount_due || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className={`text-sm font-black ${isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {isPaid ? 'Paid' : `Ksh ${balance.toLocaleString()} due`}
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">{invoice.status}</p>
                      </div>
                      {!isPaid && (
                        <button
                          onClick={() => openPayConfirm(invoice)}
                          disabled={sendingId === invoice.id}
                          className="px-3 py-1.5 rounded-xl bg-gray-900 dark:bg-gradient-to-br dark:from-[#c89f5e] dark:to-[#9b7133] text-white dark:text-[#07151f] text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                        >
                          {sendingId === invoice.id ? '...' : 'Pay'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {invoices.length === 0 && (
                <div className="text-center py-16">
                  <Receipt size={24} className="mx-auto mb-3 text-gray-200 dark:text-white/10" />
                  <p className="text-[10px] text-gray-400 dark:text-white/20 font-black uppercase tracking-[0.3em]">No invoices found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* -- Maintenance Tab -- */}
        {activeTab === 'maintenance' && (
          <div className="space-y-4">
            {!showMaintForm && (
              <button
                onClick={() => setShowMaintForm(true)}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/20"
              >
                <Wrench size={14} /> New Maintenance Request
              </button>
            )}

            {showMaintForm && (
              <form onSubmit={submitMaintenance} className="bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 p-5 space-y-4 shadow-sm">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-700 dark:text-white/70">New Request</h3>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Issue Title *</label>
                  <input
                    type="text"
                    value={maintForm.title}
                    onChange={(e) => setMaintForm({ ...maintForm, title: e.target.value })}
                    placeholder="e.g. Leaking tap in bathroom"
                    required
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-400 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Description</label>
                  <textarea
                    value={maintForm.description}
                    onChange={(e) => setMaintForm({ ...maintForm, description: e.target.value })}
                    placeholder="Describe the issue in detail..."
                    rows={3}
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-400 text-gray-900 dark:text-white resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Priority</label>
                  <select
                    value={maintForm.priority}
                    onChange={(e) => setMaintForm({ ...maintForm, priority: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-400 text-gray-900 dark:text-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={submittingMaint} className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50">
                    {submittingMaint ? 'Submitting...' : 'Submit Request'}
                  </button>
                  <button type="button" onClick={() => setShowMaintForm(false)} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 transition-all font-black text-xs">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100 dark:border-white/5">
                <h2 className="text-sm font-black tracking-tight">Past Requests</h2>
                <p className="text-[9px] text-gray-400 dark:text-white/30 font-bold uppercase tracking-widest mt-0.5">{tickets.length} total</p>
              </div>
              <div className="divide-y divide-gray-50 dark:divide-white/5">
                {maintenanceLoading ? (
                  <div className="text-center py-12">
                    <Activity size={24} className="mx-auto mb-3 text-gray-200 dark:text-white/10" />
                    <p className="text-[10px] text-gray-400 dark:text-white/20 font-black uppercase tracking-[0.3em]">Loading requests</p>
                  </div>
                ) : tickets.map((ticket) => (
                  <div key={ticket.id} className="p-4 hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition-all">
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
                {maintenanceLoaded && !maintenanceLoading && tickets.length === 0 && (
                  <div className="text-center py-12">
                    <Wrench size={24} className="mx-auto mb-3 text-gray-200 dark:text-white/10" />
                    <p className="text-[10px] text-gray-400 dark:text-white/20 font-black uppercase tracking-[0.3em]">No requests yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* -- Prepay Modal -- */}
      <AnimatePresence>
        {showPrepay && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPrepay(false)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="relative w-full max-w-sm bg-white dark:bg-[#0b2233] border border-gray-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-black tracking-tight">Prepay Account</h3>
                  <p className="text-[10px] text-gray-400 dark:text-white/30 font-bold uppercase tracking-widest mt-0.5">
                    Overpayment shows as credit
                  </p>
                </div>
                <button onClick={() => setShowPrepay(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors text-gray-400">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {runningBalance < 0 && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                    You currently have a credit of Ksh {Math.abs(runningBalance).toLocaleString()} on your account.
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Amount (Ksh)</label>
                  <input
                    type="number"
                    min="1"
                    value={prepayAmount}
                    onChange={(e) => setPrepayAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 px-4 py-3 rounded-xl text-lg font-black outline-none focus:ring-2 focus:ring-[#c89f5e] text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">M-Pesa Phone Number</label>
                  <input
                    type="tel"
                    value={prepayPhone}
                    onChange={(e) => setPrepayPhone(e.target.value)}
                    placeholder="2547XXXXXXXX"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 px-4 py-3 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#c89f5e] text-gray-900 dark:text-white"
                  />
                  <p className="mt-1 text-[10px] text-gray-400 dark:text-white/30">Change this if paying from a different number.</p>
                </div>
                <p className="text-[10px] text-gray-400 dark:text-white/30 leading-relaxed">
                  An M-Pesa STK push will be sent to the number above. Any amount above your outstanding balance will appear as a credit and automatically offset future invoices.
                </p>
              </div>
              <div className="p-6 bg-gray-50 dark:bg-white/2 flex gap-3">
                <button
                  onClick={submitPrepay}
                  disabled={prepaying || !prepayAmount}
                  className="flex-1 py-3 rounded-xl bg-[#c89f5e] hover:bg-[#b08a4a] text-white font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CreditCard size={14} />
                  {prepaying ? 'Sending...' : 'Pay via M-Pesa'}
                </button>
                <button onClick={() => setShowPrepay(false)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 transition-all font-black text-xs">
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* -- Pay Confirmation Modal -- */}
      <AnimatePresence>
        {payConfirm && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPayConfirm(null)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="relative w-full max-w-sm bg-white dark:bg-[#0b2233] border border-gray-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-black tracking-tight">Confirm Payment</h3>
                  <p className="text-[10px] text-gray-400 dark:text-white/30 font-bold uppercase tracking-widest mt-0.5">
                    Invoice #{payConfirm.invoice.invoice_number}
                  </p>
                </div>
                <button onClick={() => setPayConfirm(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors text-gray-400">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="p-3 rounded-xl bg-[#c89f5e]/10 border border-[#c89f5e]/20 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Amount to Pay</p>
                  <p className="text-2xl font-black text-[#c89f5e]">Ksh {payConfirm.amount.toLocaleString()}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">M-Pesa Phone Number</label>
                  <input
                    type="tel"
                    value={payConfirm.phone}
                    onChange={(e) => setPayConfirm({ ...payConfirm, phone: e.target.value })}
                    placeholder="2547XXXXXXXX"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 px-4 py-3 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#c89f5e] text-gray-900 dark:text-white"
                  />
                  <p className="mt-1 text-[10px] text-gray-400 dark:text-white/30">Change this if paying from a different number.</p>
                </div>
                <p className="text-[10px] text-gray-400 dark:text-white/30 leading-relaxed">
                  An M-Pesa STK push will be sent to the number above for this invoice payment.
                </p>
              </div>
              <div className="p-6 bg-gray-50 dark:bg-white/2 flex gap-3">
                <button
                  onClick={payInvoice}
                  disabled={!payConfirm.phone.trim()}
                  className="flex-1 py-3 rounded-xl bg-[#c89f5e] hover:bg-[#b08a4a] text-white font-black text-xs uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CreditCard size={14} />
                  Pay via M-Pesa
                </button>
                <button onClick={() => setPayConfirm(null)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 transition-all font-black text-xs">
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* -- Receipt Modal -- */}
      <AnimatePresence>
        {receiptPreview && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setReceiptPreview(null)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="relative w-full max-w-lg bg-white dark:bg-[#0b2233] border border-gray-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-2xl printable-card"
            >
              <div className="p-6 border-b border-gray-100 dark:border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <Receipt size={16} />
                  </div>
                  <h3 className="text-lg font-black tracking-tight">Payment Receipt</h3>
                </div>
                <button onClick={() => setReceiptPreview(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors text-gray-400">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div className="p-5 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-1">Amount Paid</p>
                  <p className="text-3xl font-black text-[#c89f5e]">Ksh {receiptPreview.amount.toLocaleString()}</p>
                </div>
                <div className="grid gap-3 grid-cols-2">
                  {[
                    { label: 'Reference', value: receiptPreview.payment.reference_number || 'N/A', icon: ShieldCheck },
                    { label: 'Date', value: receiptPreview.payment.payment_date || 'N/A', icon: Activity },
                    { label: 'Method', value: receiptPreview.payment.payment_method || 'N/A', icon: Wallet },
                    { label: 'Status', value: receiptPreview.payment.status || 'Confirmed', icon: BadgeCheck },
                  ].map((item, i) => (
                    <div key={i} className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5 mb-1">
                        <item.icon size={10} className="text-blue-500/50" />{item.label}
                      </p>
                      <p className="text-xs font-black truncate">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-6 bg-gray-50 dark:bg-white/2 flex gap-3">
                <button
                  onClick={() => { window.print(); setReceiptPreview(null); }}
                  className="flex-1 py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black text-xs hover:opacity-90 transition-all flex items-center justify-center gap-2"
                >
                  <Printer size={14} /> Print
                </button>
                <button onClick={() => setReceiptPreview(null)} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 transition-all font-black text-xs">
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {toast && <CustomToast message={toast.message} type={toast.type} isVisible onClose={() => setToast(null)} />}
    </div>
  );
}
