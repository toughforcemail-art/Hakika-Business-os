// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw, Search, ArrowRightLeft, ShieldCheck, RotateCcw, Wallet, AlertTriangle, CheckCircle2, Clock3, Download, X, FileText, Building2, Hash } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';

type MpesaEvent = {
  id: string;
  invoice_id?: string | null;
  receipt_no: string | null;
  checkout_request_id: string | null;
  transaction_status: string | null;
  paid_in: number | null;
  withdrawn: number | null;
  phone_number: string | null;
  customer_name: string | null;
  completion_time: string | null;
  mpesa_source: string | null;
  callback_type: string | null;
  originator_conversation_id: string | null;
  conversation_id: string | null;
  details: string | null;
  invoice_number?: string | null;
  tenant_id?: string | null;
  tenant_name?: string | null;
  unit_number?: string | null;
  property_name?: string | null;
  amount_due?: number | null;
  amount_paid?: number | null;
  linked_invoice_id?: string | null;
  match_source?: string | null;
  synced_to_tenant_history?: boolean | null;
};

type InvoiceMatch = {
  id: string;
  invoice_number: string | null;
  amount_due: number | null;
  amount_paid: number | null;
  tenant_id: string | null;
  unit_id: string | null;
  mpesa_receipt_no: string | null;
  mpesa_checkout_request_id: string | null;
  tenant?: { id?: string | null; full_name?: string | null; phone?: string | null } | null;
  unit?: { id?: string | null; unit_number?: string | null; property?: { id?: string | null; name?: string | null } | null } | null;
};

type CallbackAudit = {
  id: string;
  company_id: string | null;
  callback_type: string | null;
  callback_key: string | null;
  receipt_no: string | null;
  checkout_request_id: string | null;
  originator_conversation_id: string | null;
  conversation_id: string | null;
  invoice_id: string | null;
  payload_hash: string | null;
  response_status: number | null;
  response_body: Record<string, unknown> | null;
  delivered_at: string | null;
};

const EVENT_LABELS: Record<string, { label: string; tone: string; icon: React.ReactNode }> = {
  stk: { label: 'STK', tone: 'bg-emerald-600 text-white border-emerald-500 dark:bg-emerald-500 dark:text-emerald-950', icon: <CheckCircle2 size={12} /> },
  c2b: { label: 'C2B', tone: 'bg-sky-600 text-white border-sky-500 dark:bg-sky-400 dark:text-sky-950', icon: <ArrowRightLeft size={12} /> },
  b2c: { label: 'B2C', tone: 'bg-orange-600 text-white border-orange-500 dark:bg-orange-400 dark:text-orange-950', icon: <ShieldCheck size={12} /> },
  b2b: { label: 'B2B', tone: 'bg-fuchsia-600 text-white border-fuchsia-500 dark:bg-fuchsia-400 dark:text-fuchsia-950', icon: <Wallet size={12} /> },
  reversal: { label: 'Reversal', tone: 'bg-red-600 text-white border-red-500 dark:bg-red-400 dark:text-red-950', icon: <RotateCcw size={12} /> },
  status: { label: 'Status', tone: 'bg-indigo-600 text-white border-indigo-500 dark:bg-indigo-400 dark:text-indigo-950', icon: <Activity size={12} /> },
  balance: { label: 'Balance', tone: 'bg-amber-600 text-white border-amber-500 dark:bg-amber-400 dark:text-amber-950', icon: <AlertTriangle size={12} /> },
};
const ADMIN_ROLES = new Set(['Super Admin', 'Administrator', 'Director', 'Director / Super Admin']);

const detectLabel = (row: MpesaEvent) => {
  const source = (row.callback_type || row.mpesa_source || '').toLowerCase();
  if (source.includes('reversal')) return 'reversal';
  if (source.includes('status')) return 'status';
  if (source.includes('balance')) return 'balance';
  if (source.includes('b2c')) return 'b2c';
  if (source.includes('b2b')) return 'b2b';
  if (source.includes('c2b')) return 'c2b';
  if (source.includes('stk')) return 'stk';
  if (Number(row.withdrawn || 0) > 0) return 'b2c';
  if (Number(row.paid_in || 0) > 0 && !row.checkout_request_id) return 'c2b';
  return 'stk';
};

const detectOutcome = (row: MpesaEvent) => {
  const status = (row.transaction_status || '').toLowerCase();
  const isSuccess =
    /completed|processed successfully|success|accepted|confirmed|paid/i.test(status) ||
    Number(row.paid_in || 0) > 0 ||
    Number(row.withdrawn || 0) > 0;
  const isFailed =
    /failed|rejected|error|cancelled|canceled|timeout|timed out|declined|invalid/i.test(status) ||
    (!isSuccess && !row.transaction_status && Number(row.paid_in || 0) === 0 && Number(row.withdrawn || 0) === 0);
  if (isSuccess) return 'success';
  if (isFailed) return 'failed';
  return 'pending';
};

const formatOutcomeLabel = (row: MpesaEvent) => {
  const typeLabel = (EVENT_LABELS[detectLabel(row)] || EVENT_LABELS.stk).label;
  const outcome = detectOutcome(row);
  if (outcome === 'success') return `${typeLabel} Success`;
  if (outcome === 'failed') return `${typeLabel} Failed`;
  return `${typeLabel} Pending`;
};

const normalizeDigits = (value?: string | null) => String(value || '').replace(/\D/g, '');
const looksLikePhoneMatch = (left?: string | null, right?: string | null) => {
  const a = normalizeDigits(left);
  const b = normalizeDigits(right);
  if (!a || !b) return false;
  return a === b || a.endsWith(b.slice(-9)) || b.endsWith(a.slice(-9));
};
const invoiceBalance = (invoice: InvoiceMatch) => Math.max(0, Number(invoice.amount_due || 0) - Number(invoice.amount_paid || 0));

// Format datetime in local timezone (East Africa Time - EAT, UTC+3)
const formatDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    // Format: MM/DD/YY, HH:MM:SS AM/PM in local timezone
    return date.toLocaleString('en-US', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Africa/Nairobi' // East Africa Time
    });
  } catch (error) {
    return '-';
  }
};

export default function MpesaPaymentTracker() {
  const { profile } = useAccess();
  const [rows, setRows] = useState<MpesaEvent[]>([]);
  const [invoiceRows, setInvoiceRows] = useState<InvoiceMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'stk' | 'c2b' | 'b2c' | 'b2b' | 'reversal' | 'status' | 'balance'>('all');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<MpesaEvent | null>(null);
  const [callbackAudits, setCallbackAudits] = useState<CallbackAudit[]>([]);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillPreview, setBackfillPreview] = useState<{ total: number; matched: number; updated: number } | null>(null);
  const [forceLinkInvoiceId, setForceLinkInvoiceId] = useState('');
  const [forceLinkBusy, setForceLinkBusy] = useState(false);
  const canBackfill = ADMIN_ROLES.has(String((profile as any)?.role || ''));

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data: transactions, error } = await supabase
        .from('mpesa_transactions')
        .select('*')
        .order('completion_time', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;

      const { data: invoices } = await supabase
        .from('re_invoices')
        .select('id, invoice_number, amount_due, amount_paid, tenant_id, unit_id, mpesa_receipt_no, mpesa_checkout_request_id, mpesa_originator_conversation_id, mpesa_conversation_id, tenant:re_tenants(id, full_name, phone), unit:re_units(id, unit_number, property:re_properties(id, name))')
        .limit(1000);
      const { data: audits } = await supabase
        .from('mpesa_callback_audit')
        .select('id, company_id, callback_type, callback_key, receipt_no, checkout_request_id, originator_conversation_id, conversation_id, invoice_id, payload_hash, response_status, response_body, delivered_at')
        .order('delivered_at', { ascending: false })
        .limit(200);
      const invoiceList = (invoices || []) as InvoiceMatch[];
      setInvoiceRows(invoiceList);
      setCallbackAudits((audits || []) as CallbackAudit[]);
      const merged = (transactions || []).map((row: any) => {
        const transactionKey = row.receipt_no || row.checkout_request_id || row.originator_conversation_id || row.conversation_id;
        const exactMatch = invoiceList.find((invoice) => [
          invoice.mpesa_receipt_no,
          invoice.mpesa_checkout_request_id,
          invoice.mpesa_originator_conversation_id,
          invoice.mpesa_conversation_id,
          invoice.invoice_number,
        ].filter(Boolean).includes(transactionKey));
        const phoneMatch = invoiceList.find((invoice) => looksLikePhoneMatch(invoice.tenant?.phone || null, row.phone_number || null));
        const amountMatch = invoiceList.find((invoice) => Number(row.paid_in || row.withdrawn || 0) > 0 && invoiceBalance(invoice) >= 0);
        const match = exactMatch || phoneMatch || amountMatch || null;
        return {
          ...row,
          invoice_number: match?.invoice_number || null,
          tenant_id: match?.tenant_id || null,
          tenant_name: match?.tenant?.full_name || null,
          tenant_phone: match?.tenant?.phone || null,
          unit_number: match?.unit?.unit_number || null,
          property_name: match?.unit?.property?.name || null,
          amount_due: match?.amount_due ?? null,
          amount_paid: match?.amount_paid ?? null,
          linked_invoice_id: match?.id || null,
          match_source: exactMatch ? 'exact' : phoneMatch ? 'phone' : amountMatch ? 'amount' : null,
          synced_to_tenant_history: Boolean(match?.id && (row.paid_in || row.withdrawn)),
        };
      });
      setRows(merged as MpesaEvent[]);
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to load payment tracker', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  const filtered = useMemo(() => {
    const result = rows.filter((row) => {
      const label = detectLabel(row);
      const query = searchTerm.toLowerCase().trim();
      const haystack = [
        row.receipt_no,
        row.checkout_request_id,
        row.transaction_status,
        row.phone_number,
        row.customer_name,
        row.originator_conversation_id,
        row.conversation_id,
        row.details,
      ].filter(Boolean).join(' ').toLowerCase();
      const matchesFilter = filter === 'all' || label === filter;
      const matchesSearch = !query || haystack.includes(query);
      const matchesProperty = propertyFilter === 'all' || (row.property_name || '').toLowerCase().includes(propertyFilter.toLowerCase());
      const matchesUnit = unitFilter === 'all' || (row.unit_number || '').toLowerCase().includes(unitFilter.toLowerCase());
      const matchesTime = !timeFilter || (row.completion_time || '').includes(timeFilter);
      return matchesFilter && matchesSearch && matchesProperty && matchesUnit && matchesTime;
    });
    
    // Ensure newest transactions appear at the top
    return result.sort((a, b) => {
      const timeA = a.completion_time ? new Date(a.completion_time).getTime() : 0;
      const timeB = b.completion_time ? new Date(b.completion_time).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA; // Descending by completion_time
      
      const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return createdB - createdA; // Descending by created_at as fallback
    });
  }, [rows, filter, searchTerm, propertyFilter, unitFilter, timeFilter]);

  const summary = useMemo(() => ({
    total: rows.length,
    stk: rows.filter((row) => detectLabel(row) === 'stk').length,
    c2b: rows.filter((row) => detectLabel(row) === 'c2b').length,
    b2c: rows.filter((row) => detectLabel(row) === 'b2c').length,
    b2b: rows.filter((row) => detectLabel(row) === 'b2b').length,
    reversal: rows.filter((row) => detectLabel(row) === 'reversal').length,
  }), [rows]);

  const propertyOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.property_name).filter(Boolean) as string[])).sort(), [rows]);
  const unitOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.unit_number).filter(Boolean) as string[])).sort(), [rows]);

  const exportCsv = () => {
    const headers = ['type', 'invoice_id', 'receipt_no', 'invoice_number', 'tenant_name', 'tenant_id', 'property_name', 'unit_number', 'phone_number', 'completion_time', 'paid_in', 'withdrawn', 'status'];
    const csv = [
      headers.join(','),
      ...filtered.map((row) => headers.map((key) => {
        const value = (row as any)[key] ?? '';
        const text = String(value).replace(/"/g, '""');
        return `"${text}"`;
      }).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mpesa-payment-tracker-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const inferInvoiceFromEvent = (event: MpesaEvent) => {
    const receipt = event.receipt_no || '';
    const checkout = event.checkout_request_id || '';
    const phoneDigits = String(event.phone_number || '').replace(/\D/g, '');

    const direct = invoiceRows.find((invoice) => [
      invoice.mpesa_receipt_no,
      invoice.mpesa_checkout_request_id,
      invoice.mpesa_originator_conversation_id,
      invoice.mpesa_conversation_id,
      invoice.invoice_number,
    ].filter(Boolean).includes(receipt || checkout || event.originator_conversation_id || event.conversation_id));
    if (direct) return direct;

    const receiptMatch = invoiceRows.find((invoice) => normalizeDigits(invoice.mpesa_receipt_no) === normalizeDigits(receipt));
    if (receiptMatch) return receiptMatch;

    const fallback = invoiceRows.find((invoice) => {
      const invoicePhone = String(invoice?.tenant?.phone || '').replace(/\D/g, '');
      if (!invoicePhone || !phoneDigits) return false;
      return looksLikePhoneMatch(invoicePhone, phoneDigits);
    });

    return fallback || null;
  };

  const backfillPastPayments = async () => {
    if (!profile) return;
    if (!canBackfill) {
      setToast({ message: 'Only admins can run payment backfill.', type: 'error' });
      return;
    }
    if (!window.confirm('Backfill past M-Pesa payments into invoices now? This will update amount_paid and reconciliation status for matched invoices.')) return;

    setBackfillBusy(true);
    try {
      const candidates = rows.filter((row) => {
        const label = detectLabel(row);
        return (label === 'stk' || label === 'c2b') && detectOutcome(row) === 'success';
      });

      let matchedCount = 0;
      let updatedCount = 0;
      for (const event of candidates) {
        const invoice = inferInvoiceFromEvent(event);
        if (!invoice?.id) continue;
        matchedCount += 1;

        const amount = Number(event.paid_in || 0);
        if (amount <= 0) continue;

        const previousPaid = Number(invoice.amount_paid || 0);
        const nextPaid = Math.max(0, previousPaid + amount);
        const nextBalance = Math.max(0, Number(invoice.amount_due || 0) - nextPaid);

        const { error } = await supabase
          .from('re_invoices')
          .update({
            amount_paid: nextPaid,
            reconciliation_status: nextBalance <= 0 ? 'paid' : 'partial',
            mpesa_receipt_no: event.receipt_no || invoice.mpesa_receipt_no || null,
            mpesa_checkout_request_id: event.checkout_request_id || invoice.mpesa_checkout_request_id || null,
            mpesa_last_callback_at: event.completion_time || new Date().toISOString(),
          })
          .eq('id', invoice.id);

        if (!error) updatedCount += 1;
      }

      setBackfillPreview({ total: candidates.length, matched: matchedCount, updated: updatedCount });
      setToast({ message: `Backfill complete: ${updatedCount}/${matchedCount} invoices updated.`, type: 'success' });
      await fetchData();
    } catch (error: any) {
      setToast({ message: error?.message || 'Backfill failed', type: 'error' });
    } finally {
      setBackfillBusy(false);
    }
  };

  const forceLinkPayment = async () => {
    if (!canBackfill) {
      setToast({ message: 'Only admins can force-link payments.', type: 'error' });
      return;
    }
    if (!selectedEvent?.id) {
      setToast({ message: 'Select a payment event first.', type: 'error' });
      return;
    }
    if (!forceLinkInvoiceId) {
      setToast({ message: 'Choose an invoice to link this payment to.', type: 'error' });
      return;
    }

    const invoice = invoiceRows.find((item) => item.id === forceLinkInvoiceId);
    if (!invoice) {
      setToast({ message: 'Selected invoice was not found.', type: 'error' });
      return;
    }

    const paidAmount = Number(selectedEvent.paid_in || selectedEvent.withdrawn || 0);
    if (paidAmount <= 0) {
      setToast({ message: 'This event has no payment amount to apply.', type: 'error' });
      return;
    }

    if (!window.confirm(`Force link receipt ${selectedEvent.receipt_no || selectedEvent.checkout_request_id || '-'} to invoice ${invoice.invoice_number || invoice.id}?`)) return;

    setForceLinkBusy(true);
    try {
      const previousPaid = Number(invoice.amount_paid || 0);
      const nextPaid = Math.max(0, previousPaid + paidAmount);
      const nextBalance = Math.max(0, Number(invoice.amount_due || 0) - nextPaid);

      const { error } = await supabase
        .from('re_invoices')
        .update({
          amount_paid: nextPaid,
          reconciliation_status: nextBalance <= 0 ? 'paid' : 'partial',
          mpesa_receipt_no: selectedEvent.receipt_no || invoice.mpesa_receipt_no || null,
          mpesa_checkout_request_id: selectedEvent.checkout_request_id || invoice.mpesa_checkout_request_id || null,
          mpesa_last_callback_at: selectedEvent.completion_time || new Date().toISOString(),
        })
        .eq('id', invoice.id);
      if (error) throw error;

      setToast({ message: `Linked ${selectedEvent.receipt_no || selectedEvent.checkout_request_id || 'payment'} to ${invoice.invoice_number || invoice.id}.`, type: 'success' });
      setSelectedEvent((current) => current ? { ...current, invoice_number: invoice.invoice_number, tenant_id: invoice.tenant_id, tenant_name: invoice.tenant?.full_name || null, tenant_phone: invoice.tenant?.phone || null, unit_number: invoice.unit?.unit_number || null, property_name: invoice.unit?.property?.name || null, amount_due: invoice.amount_due, amount_paid: nextPaid } : current);
      await fetchData();
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to force link payment', type: 'error' });
    } finally {
      setForceLinkBusy(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Activity className="text-brand-purple" size={32} />
              M-Pesa Payment Tracker
            </h1>
            <p className="text-gray-500 dark:text-gray-400">All payment events in one place: STK, C2B, B2C, B2B, reversals, status, and balance queries.</p>
          </div>
          <div className="flex gap-2">
            {canBackfill ? (
              <button
                onClick={backfillPastPayments}
                disabled={backfillBusy || loading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 text-white font-semibold disabled:opacity-50"
              >
                <FileText size={16} /> {backfillBusy ? 'Backfilling...' : 'Backfill Past Payments'}
              </button>
            ) : null}
            <button onClick={exportCsv} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 text-gray-700 dark:text-white font-semibold">
              <Download size={16} /> Export CSV
            </button>
            <button onClick={fetchData} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-purple text-white font-semibold">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {backfillPreview ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            Backfill preview: {backfillPreview.total} candidates, {backfillPreview.matched} matched, {backfillPreview.updated} updated.
          </div>
        ) : null}

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            ['Total', summary.total],
            ['STK', summary.stk],
            ['C2B', summary.c2b],
            ['B2C', summary.b2c],
            ['B2B', summary.b2b],
            ['Reversal', summary.reversal],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 p-4">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black">{label}</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">{String(value)}</p>
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-white/10 p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search receipt, phone, reference, status..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 outline-none text-gray-900 dark:text-white"
            />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 outline-none text-gray-900 dark:text-white">
            <option value="all">All events</option>
            <option value="stk">STK</option>
            <option value="c2b">C2B</option>
            <option value="b2c">B2C</option>
            <option value="b2b">B2B</option>
            <option value="reversal">Reversal</option>
            <option value="status">Status</option>
            <option value="balance">Balance</option>
          </select>
          <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)} className="px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 outline-none text-gray-900 dark:text-white">
            <option value="all">All properties</option>
            {propertyOptions.map((property) => <option key={property} value={property}>{property}</option>)}
          </select>
          <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} className="px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 outline-none text-gray-900 dark:text-white">
            <option value="all">All units</option>
            {unitOptions.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
          </select>
          <input
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            placeholder="YYYY-MM or full timestamp"
            className="px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 outline-none text-gray-900 dark:text-white"
          />
        </div>

        <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center">
              <CustomLoader size={32} label="Loading payment events..." />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Clock3 className="mx-auto mb-4 text-gray-300" size={48} />
              <p>No payment events found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-medium text-gray-500">Type</th>
                    <th className="px-6 py-4 font-medium text-gray-500">Receipt / Ref</th>
                    <th className="px-6 py-4 font-medium text-gray-500">Invoice</th>
                    <th className="px-6 py-4 font-medium text-gray-500">Property / Unit</th>
                    <th className="px-6 py-4 font-medium text-gray-500">Phone / Customer</th>
                    <th className="px-6 py-4 font-medium text-gray-500">Time</th>
                    <th className="px-6 py-4 font-medium text-gray-500">Paid In</th>
                    <th className="px-6 py-4 font-medium text-gray-500">Withdrawn</th>
                    <th className="px-6 py-4 font-medium text-gray-500">Status</th>
                    <th className="px-6 py-4 font-medium text-gray-500">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {filtered.map((row) => {
                    const labelKey = detectLabel(row);
                    const label = EVENT_LABELS[labelKey] || EVENT_LABELS.stk;
                    const outcome = detectOutcome(row);
                    return (
                      <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${label.tone}`}>
                            {label.icon} {label.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-gray-900 dark:text-white">
                          {row.receipt_no || row.checkout_request_id || row.originator_conversation_id || row.conversation_id || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Hash size={14} className="text-gray-400" />
                            <span className="font-semibold text-gray-900 dark:text-white">{row.invoice_number || '-'}</span>
                          </div>
                          <p className="text-xs text-gray-500">Invoice ID: {row.invoice_id || '-'}</p>
                          <p className="text-xs text-gray-500">
                            {row.tenant_id || '-'}
                            {row.match_source ? ` · matched by ${row.match_source}` : ''}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900 dark:text-white">{row.property_name || '-'}</span>
                            <span className="text-xs text-brand-purple font-bold">Unit {row.unit_number || '-'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900 dark:text-white">{row.customer_name || row.tenant_name || '-'}</span>
                            <span className="text-xs text-gray-500">{row.phone_number || '-'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                          {formatDateTime(row.completion_time)}
                        </td>
                        <td className="px-6 py-4 font-bold text-emerald-600">
                          KES {Number(row.paid_in || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 font-bold text-orange-600">
                          KES {Number(row.withdrawn || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                          {row.transaction_status || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${
                              outcome === 'success'
                                ? 'bg-emerald-600 text-white border-emerald-500 dark:bg-emerald-400 dark:text-emerald-950'
                                : outcome === 'failed'
                                  ? 'bg-red-600 text-white border-red-500 dark:bg-red-400 dark:text-red-950'
                                  : 'bg-amber-600 text-white border-amber-500 dark:bg-amber-400 dark:text-amber-950'
                            }`}
                          >
                            {formatOutcomeLabel(row)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button onClick={() => setSelectedEvent(row)} className="px-3 py-2 rounded-lg bg-gray-900 text-white dark:bg-white dark:text-gray-900 font-semibold">
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 shadow-2xl p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Event Details</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Raw payment JSON and linked invoice context.</p>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <InfoCard label="Type" value={(EVENT_LABELS[detectLabel(selectedEvent)] || EVENT_LABELS.stk).label} />
              <InfoCard label="Receipt" value={selectedEvent.receipt_no || selectedEvent.checkout_request_id || '-'} />
              <InfoCard label="Invoice ID" value={selectedEvent.invoice_id || '-'} />
              <InfoCard label="Invoice" value={selectedEvent.invoice_number || '-'} />
              <InfoCard label="Property / Unit" value={`${selectedEvent.property_name || '-'} / ${selectedEvent.unit_number || '-'}`} />
              <InfoCard label="Tenant" value={`${selectedEvent.customer_name || selectedEvent.tenant_name || '-'} (${selectedEvent.tenant_id || 'N/A'})`} />
              <InfoCard label="Time" value={formatDateTime(selectedEvent.completion_time)} />
            </div>
            <div className={`mb-4 rounded-2xl border p-4 text-sm font-semibold ${
              selectedEvent.synced_to_tenant_history
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100'
                : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100'
            }`}>
              <p>Tenant history sync</p>
              <p className="mt-1">
                {selectedEvent.synced_to_tenant_history
                  ? 'Synced to tenant payment history.'
                  : 'Not yet synced to tenant history. Use Force Link or wait for the next callback/backfill.'}
              </p>
            </div>
            <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-100">
              <p className="font-semibold">Match status</p>
              <p className="mt-1">
                {selectedEvent.linked_invoice_id
                  ? `Linked invoice detected (${selectedEvent.match_source || 'exact'} match).`
                  : 'No invoice linked yet. Use Manual Link if this payment is real and should reduce an invoice.'}
              </p>
            </div>
            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.02]">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Callback audit trail</p>
              {callbackAudits
                .filter((audit) => [
                  audit.receipt_no,
                  audit.checkout_request_id,
                  audit.originator_conversation_id,
                  audit.conversation_id,
                ].filter(Boolean).some((value) => [
                  selectedEvent.receipt_no,
                  selectedEvent.checkout_request_id,
                  selectedEvent.originator_conversation_id,
                  selectedEvent.conversation_id,
                ].filter(Boolean).includes(String(value))))
                .slice(0, 3).length > 0 ? (
                <div className="mt-3 space-y-3">
                  {callbackAudits
                    .filter((audit) => [
                      audit.receipt_no,
                      audit.checkout_request_id,
                      audit.originator_conversation_id,
                      audit.conversation_id,
                    ].filter(Boolean).some((value) => [
                      selectedEvent.receipt_no,
                      selectedEvent.checkout_request_id,
                      selectedEvent.originator_conversation_id,
                      selectedEvent.conversation_id,
                    ].filter(Boolean).includes(String(value))))
                    .slice(0, 3)
                    .map((audit) => (
                      <div key={audit.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-white/10 dark:bg-black/20">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-slate-900 dark:text-white">{audit.callback_type || 'callback'}</span>
                          <span className="font-mono text-slate-500">{audit.receipt_no || audit.checkout_request_id || audit.callback_key || '-'}</span>
                        </div>
                        <p className="mt-1 text-slate-500 dark:text-slate-400">
                          Invoice: {audit.invoice_id || '-'} · Status: {audit.response_status ?? '-'} · Delivered: {formatDateTime(audit.delivered_at)}
                        </p>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No audit row found for this event.</p>
              )}
            </div>
            {canBackfill ? (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/30">
                <p className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-200">Manual Link</p>
                <p className="mt-1 text-sm text-amber-900 dark:text-amber-100">Use this only when the payment was successful but auto-linking missed the invoice.</p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <select
                    value={forceLinkInvoiceId}
                    onChange={(e) => setForceLinkInvoiceId(e.target.value)}
                    className="flex-1 rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none dark:border-amber-900/40 dark:bg-black/20 dark:text-white"
                  >
                    <option value="">Choose invoice to link</option>
                    {invoiceRows
                      .slice()
                      .sort((left, right) => {
                        const leftScore = (looksLikePhoneMatch(left.tenant?.phone || null, selectedEvent.phone_number || null) ? 2 : 0) + (invoiceBalance(left) > 0 ? 1 : 0);
                        const rightScore = (looksLikePhoneMatch(right.tenant?.phone || null, selectedEvent.phone_number || null) ? 2 : 0) + (invoiceBalance(right) > 0 ? 1 : 0);
                        return rightScore - leftScore;
                      })
                      .map((invoice) => (
                        <option key={invoice.id} value={invoice.id}>
                          {invoice.invoice_number || invoice.id} - {invoice.tenant?.full_name || 'Tenant'} - Balance KES {invoiceBalance(invoice).toLocaleString()}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={forceLinkPayment}
                    disabled={forceLinkBusy}
                    className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {forceLinkBusy ? 'Linking...' : 'Force Link Payment'}
                  </button>
                </div>
              </div>
            ) : null}
            <div className="rounded-2xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 p-4">
              <p className="text-xs uppercase tracking-widest text-gray-400 font-black mb-2">Raw JSON</p>
              <pre className="text-[11px] leading-5 text-gray-700 dark:text-gray-300 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(selectedEvent, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 p-4">
      <p className="text-[10px] uppercase tracking-widest text-gray-400 font-black">{label}</p>
      <p className="mt-1 font-semibold text-gray-900 dark:text-white break-words">{value}</p>
    </div>
  );
}
