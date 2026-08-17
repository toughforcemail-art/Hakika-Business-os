// @ts-nocheck
import React, { useMemo, useState, useEffect, startTransition, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, Filter, Calendar, User, Home, MoreVertical, Trash2, CheckCircle, Clock, XCircle, Download, CreditCard, DollarSign, Smartphone, MessageSquare, Send, RefreshCw } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { callDaraja } from '../../services/darajaService';
import { sendBulkSms } from '../../services/SMSService';
import { generateMonthlyInvoices } from '../../services/realEstateBillingService';
import { syncMpesaPayments } from '../../services/paymentSyncService';
import { calculateHakikaSplit } from '../../utils/hakikaLedger';

const ADMIN_ROLES = new Set(['Super Admin', 'Administrator', 'Director', 'Director / Super Admin']);

const getPublicBaseUrl = () => {
  const envBase =
    import.meta.env.VITE_PUBLIC_APP_URL ||
    import.meta.env.VITE_SITE_URL ||
    import.meta.env.VITE_APP_URL ||
    '';

  if (envBase) return envBase.replace(/\/$/, '');

  if (typeof window !== 'undefined' && !/localhost|127\.0\.0\.1/i.test(window.location.hostname)) {
    return window.location.origin.replace(/\/$/, '');
  }

  return '';
};

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_type?: string | null;
  company_id?: string | null;
  mpesa_account_reference?: string | null;
  tenant_id: string;
  unit_id: string;
  amount_due: number;
  amount_paid: number;
  deposit_amount?: number | null;
  deposit_paid?: number | null;
  deposit_paid_to?: string | null;
  deposit_shared_with_agent?: boolean | null;
  rent_paid?: number | null;
  service_fee_mode?: string | null;
  service_fee_value?: number | null;
  service_fee_amount?: number | null;
  landlord_payable_amount?: number | null;
  due_date: string;
  invoice_date: string;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue' | 'draft';
  tenant?: { full_name?: string | null; phone?: string | null; email?: string | null; login_username?: string | null; id?: string | null } | null;
  unit?: { unit_number?: string | null; property?: { name?: string | null } | null } | null;
  created_at: string;
  mpesa_checkout_request_id?: string | null;
  mpesa_receipt_no?: string | null;
  mpesa_last_callback_at?: string | null;
  latest_payment_receipt?: string | null;
  latest_payment_at?: string | null;
  payment_match_source?: 'exact' | 'phone' | 'amount' | 'unmatched' | null;
  confirmation_sms_status?: 'sent' | 'failed' | 'pending' | 'cancelled' | null;
  confirmation_sms_sent_at?: string | null;
  confirmation_sms_error?: string | null;
}

const normalizeDigits = (value?: string | null) => String(value || '').replace(/\D/g, '');
const looksLikePhoneMatch = (left?: string | null, right?: string | null) => {
  const a = normalizeDigits(left);
  const b = normalizeDigits(right);
  if (!a || !b) return false;
  return a === b || a.endsWith(b.slice(-9)) || b.endsWith(a.slice(-9));
};

  const getMatchLabel = (invoice: Invoice) => {
    if (invoice.mpesa_checkout_request_id) return 'Exact STK match';
    if (invoice.latest_payment_receipt || invoice.mpesa_receipt_no) return 'Receipt linked';
    if (Number(invoice.amount_paid || 0) > 0) return 'Paid and updated';
    return 'Waiting for receipt';
  };

export default function InvoiceList() {
  const { profile } = useAccess();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const deleteInvoice = async (invoice: Invoice) => {
    const userRole = profile?.role || '';
    const allowedRoles = ['Super Admin', 'Administrator', 'Director', 'Director / Super Admin'];
    if (!allowedRoles.includes(userRole)) {
      setToast({ message: 'Only Super Admins, Administrators, and Directors can delete invoices.', type: 'error' });
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete invoice ${invoice.invoice_number || invoice.id}?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('re_invoices').update({
        deleted_at: new Date().toISOString(),
        deleted_by: profile?.id || null,
      }).eq('id', invoice.id);
      if (error) throw error;
      setInvoices((current: any[]) => current.filter((item: any) => item.id !== invoice.id));
      setToast({ message: `Invoice ${invoice.invoice_number || invoice.id} deleted successfully.`, type: 'success' });
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to delete invoice', type: 'error' });
    }
  };

  const handleDeleteAllFiltered = async () => {
    const userRole = profile?.role || '';
    const allowedRoles = ['Super Admin', 'Administrator', 'Director', 'Director / Super Admin'];
    if (!allowedRoles.includes(userRole)) {
      setToast({ message: 'Only Super Admins, Administrators, and Directors can delete invoices.', type: 'error' });
      return;
    }

    if (filteredInvoices.length === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete all ${filteredInvoices.length} currently displayed invoices?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const ids = filteredInvoices.map(i => i.id);
      const { error } = await supabase.from('re_invoices').update({
        deleted_at: new Date().toISOString(),
        deleted_by: profile?.id || null,
      }).in('id', ids);
      
      if (error) throw error;
      setInvoices((current: any[]) => current.filter((item: any) => !ids.includes(item.id)));
      setToast({ message: `Successfully deleted ${ids.length} invoices.`, type: 'success' });
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to delete invoices', type: 'error' });
    }
  };
  const [stkBusyId, setStkBusyId] = useState<string | null>(null);
  const [stkDraft, setStkDraft] = useState<{
    invoiceId: string;
    invoiceNumber: string;
    accountReference: string;
    tenantName: string;
    tenantId?: string | null;
    unitNumber: string;
    propertyName: string;
    amountDue: number;
    amountPaid: number;
    amount: string;
    phone: string;
    smsStatus?: 'idle' | 'pending' | 'sent' | 'failed' | 'cancelled' | 'skipped';
    smsMessage?: string | null;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [recentDarajaNote, setRecentDarajaNote] = useState<string | null>(null);
  const [latestStkResultCode, setLatestStkResultCode] = useState<number | null>(null);
  const [stkRefreshTick, setStkRefreshTick] = useState(0);
  const [stkAmountValue, setStkAmountValue] = useState('');

  // Memoize the amount input handler to prevent unnecessary re-renders
  const handleStkAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setStkAmountValue(e.target.value);
  }, []);

  // Debounce search term to avoid excessive filtering
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms debounce

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchTerm]);

  const handleSyncPayments = async () => {
    setSyncing(true);
    try {
      const result = await syncMpesaPayments();
      if (result.success) {
        setToast({ message: `${result.message}. Synced ${result.synced} payments.`, type: 'success' });
        // Refresh invoice data
        await fetchData();
      } else {
        setToast({ message: result.message || 'Failed to sync payments', type: 'error' });
      }
    } catch (error: any) {
      setToast({ message: error.message || 'Payment sync failed', type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch related data separately for better reliability
      const [invRes, tenRes, unitRes, propRes] = await Promise.all([
        supabase.from('re_invoices').select('*').is('deleted_at', null).order('invoice_date', { ascending: false }),
        supabase.from('re_tenants').select('id, full_name, phone, email, login_username'),
        supabase.from('re_units').select('id, unit_number, property_id'),
        supabase.from('re_properties').select('id, name, service_fee_mode, service_fee_value')
      ]);
      const payRes = await supabase
        .from('re_payments')
        .select('invoice_id, amount, payment_method, reference_number, payment_date, created_at, status')
        .eq('payment_method', 'mpesa')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (invRes.error) throw invRes.error;
      if (payRes.error) throw payRes.error;
      
      const invoicesData = invRes.data || [];
      const tenantsData = tenRes.data || [];
      const unitsData = unitRes.data || [];
      const propertiesData = propRes.data || [];
      const paymentsData = payRes.data || [];
      const paymentIndex = paymentsData.reduce((acc: Record<string, any[]>, payment: any) => {
        if (!payment?.invoice_id) return acc;
        if (!acc[payment.invoice_id]) acc[payment.invoice_id] = [];
        acc[payment.invoice_id].push(payment);
        return acc;
      }, {});

      const joinedInvoices = invoicesData.map((invoice: any) => {
        const tenant = tenantsData.find(t => t.id === invoice.tenant_id);
        const unit = unitsData.find(u => u.id === invoice.unit_id);
        const property = propertiesData.find(p => p.id === unit?.property_id);
        const invoicePayments = (paymentIndex[invoice.id] || []).slice().sort((a: any, b: any) => {
          const left = new Date(a.created_at || a.payment_date || 0).getTime();
          const right = new Date(b.created_at || b.payment_date || 0).getTime();
          return right - left;
        });
        const latestPayment = invoicePayments[0] || null;
        const paidFromPayments = invoicePayments.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
        const splitMode = (invoice.service_fee_mode || property?.service_fee_mode || 'percent') as 'percent' | 'flat';
        const splitRate = Number(invoice.service_fee_value ?? property?.service_fee_value ?? 10) || 0;
        const split = calculateHakikaSplit({ amount: Number(invoice.amount_due || 0), rate: splitRate, mode: splitMode });
        const matchSource = invoice.mpesa_checkout_request_id
          ? 'exact'
          : latestPayment?.reference_number || invoice.mpesa_receipt_no
            ? 'phone'
            : looksLikePhoneMatch(tenant?.phone || null, invoice.tenant_phone || null)
              ? 'phone'
              : Number(invoice.amount_paid || 0) > 0
                ? 'amount'
                : 'unmatched';

        return {
          ...invoice,
          invoice_number: invoice.invoice_number || `INV-${String(invoice.id || '').slice(0, 8).toUpperCase()}`,
          invoice_type: invoice.invoice_type || 'rent',
          amount_due: Number(invoice.amount_due || 0),
          amount_paid: paidFromPayments > 0 ? paidFromPayments : Number(invoice.amount_paid || 0),
          deposit_amount: Number(invoice.deposit_amount || 0),
          deposit_paid: Number(invoice.deposit_paid || 0),
          deposit_paid_to: invoice.deposit_paid_to || null,
          deposit_shared_with_agent: Boolean(invoice.deposit_shared_with_agent),
          rent_paid: Number(invoice.rent_paid || 0),
          service_fee_mode: invoice.service_fee_mode || property?.service_fee_mode || 'percent',
          service_fee_value: splitRate,
          service_fee_amount: Number(invoice.service_fee_amount ?? split.companyRevenue),
          landlord_payable_amount: Number(invoice.landlord_payable_amount ?? split.landlordPayable),
          status: invoice.status || 'draft',
          mpesa_checkout_request_id: invoice.mpesa_checkout_request_id || null,
          mpesa_receipt_no: latestPayment?.reference_number || invoice.mpesa_receipt_no || null,
          mpesa_last_callback_at: invoice.mpesa_last_callback_at || null,
          latest_payment_receipt: latestPayment?.reference_number || null,
          latest_payment_at: latestPayment?.created_at || latestPayment?.payment_date || null,
          payment_match_source: matchSource,
          confirmation_sms_status: invoice.confirmation_sms_status || null,
          confirmation_sms_sent_at: invoice.confirmation_sms_sent_at || null,
          confirmation_sms_error: invoice.confirmation_sms_error || null,
          tenant: tenant || null,
          unit: unit ? { ...unit, property: property || null } : null,
        };
      });

      if (profile?.company_id) {
        const filtered = joinedInvoices.filter(i => i.company_id === profile.company_id);
        setInvoices(filtered);
        setStkDraft((current) => {
          if (!current) return current;
        const latest = filtered.find((invoice) => invoice.id === current.invoiceId);
        if (!latest) return current;
        const nextStatus = latest.confirmation_sms_status === 'sent'
          ? 'sent'
          : latest.confirmation_sms_status === 'cancelled'
              ? 'cancelled'
              : latest.confirmation_sms_status === 'failed'
                ? 'failed'
                : current.smsStatus;
        const nextMessage = latest.confirmation_sms_status === 'sent'
          ? 'Confirmation SMS sent successfully.'
          : latest.confirmation_sms_status === 'cancelled'
            ? 'Cancellation SMS sent successfully.'
            : latest.confirmation_sms_status === 'failed'
              ? latest.confirmation_sms_error || 'Confirmation SMS failed.'
              : current.smsMessage;
        return {
          ...current,
          amountDue: current.amountDue || latest.amount_due,
          amountPaid: latest.amount_paid,
          smsStatus: nextStatus,
          smsMessage: nextMessage,
        };
      });
      } else {
        setInvoices(joinedInvoices);
      }
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      setToast({ message: 'Failed to load invoices', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

    const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
  const publicInvoiceUrl = (token?: string | null) => {
    const baseUrl = getPublicBaseUrl();
    const path = `/invoice/${token || ''}`;
    return baseUrl ? `${baseUrl}${path}` : path;
  };

  const getConfirmationSmsMeta = (invoice: Invoice) => {
    switch (invoice.confirmation_sms_status) {
      case 'sent':
        return { label: 'SMS sent', className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400', message: invoice.confirmation_sms_sent_at ? `Sent at ${formatDateTime(invoice.confirmation_sms_sent_at)}` : 'Confirmation SMS sent successfully.' };
      case 'cancelled':
        return { label: 'SMS cancelled', className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/20 dark:text-slate-300', message: invoice.confirmation_sms_sent_at ? `Cancellation sent at ${formatDateTime(invoice.confirmation_sms_sent_at)}` : 'Cancellation SMS sent successfully.' };
      case 'failed':
        return { label: 'SMS failed', className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400', message: invoice.confirmation_sms_error || 'Confirmation SMS failed.' };
      default:
        return { label: 'SMS pending', className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400', message: 'Waiting for payment receipt to send the confirmation SMS.' };
    }
  };
  const tenantPortalUrl = (tenant?: Invoice['tenant'] | null) => {
    const baseUrl = getPublicBaseUrl();
    const loginPath = `/portal?${tenant?.login_username ? `user=${encodeURIComponent(tenant.login_username)}` : tenant?.email ? `email=${encodeURIComponent(tenant.email)}` : ''}`;
    return baseUrl ? `${baseUrl}${loginPath}` : loginPath;
  };
  const ensurePublicToken = async (invoiceId: string) => {
    const token = `${invoiceId.replace(/-/g, '')}${Math.random().toString(36).slice(2, 10)}`;
    const { data, error } = await supabase.from('re_invoices').select('public_invoice_token').eq('id', invoiceId).maybeSingle();
    if (error) throw error;
    if (data?.public_invoice_token) return data.public_invoice_token as string;
    const { error: updateError } = await supabase.from('re_invoices').update({ public_invoice_token: token }).eq('id', invoiceId);
    if (updateError) throw updateError;
    return token;
  };

  const handleSendInvoice = async (invoice: Invoice, channel: 'sms' | 'whatsapp') => {
    if (!invoice.tenant?.phone) {
      setToast({ message: 'Tenant does not have a valid phone number', type: 'error' });
      return;
    }
    
    setSendingInvoiceId(invoice.id);
    const balance = invoice.amount_due - invoice.amount_paid;
    const token = await ensurePublicToken(invoice.id);
    const invoiceLink = publicInvoiceUrl(token);
    const msgTemplate = `Hello ${invoice.tenant?.full_name || 'Tenant'}, your invoice ${invoice.invoice_number} for unit ${invoice.unit?.unit_number || 'N/A'} is ready. Total due: Ksh ${balance.toLocaleString()}. Due Date: ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}. View and pay here: ${invoiceLink}`;
    
    const { success, error } = await sendBulkSms([invoice.tenant.phone], msgTemplate, channel);
    
    if (success) {
      setToast({ message: `Invoice sent via ${channel.toUpperCase()}`, type: 'success' });
      // Log to communication table
      if (invoice.tenant?.id) {
        try {
          await supabase.from('re_communication').insert([{
             tenant_id: invoice.tenant.id,
             sender_id: profile?.id,
             channel: channel,
             message_content: msgTemplate,
             message_type: 'invoice',
             recipient_type: 'individual',
             status: 'sent',
             sent_at: new Date().toISOString()
          }]);
        } catch (err) {
          console.error('Failed to log voice to communication table', err);
        }
      }
    } else {
      setToast({ message: `Failed to send invoice via ${channel.toUpperCase()}`, type: 'error' });
      console.error(error);
    }
    setSendingInvoiceId(null);
  };

  const openStkDraft = (invoice: Invoice) => {
    const balance = Math.max(0, invoice.amount_due - invoice.amount_paid);
    startTransition(() => {
      setStkDraft({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        accountReference: invoice.mpesa_account_reference || invoice.invoice_number || invoice.id,
        tenantName: invoice.tenant?.full_name || 'Unassigned',
        tenantId: invoice.tenant?.id || null,
        unitNumber: invoice.unit?.unit_number || 'N/A',
        propertyName: invoice.unit?.property?.name || 'Unassigned Property',
        amountDue: invoice.amount_due,
        amountPaid: invoice.amount_paid,
        amount: String(balance),
        phone: invoice.tenant?.phone || '',
        smsStatus: 'idle',
        smsMessage: null,
      });
      setStkAmountValue(String(balance));
    });
  };

  const getPaybillNumber = () => import.meta.env.VITE_MPESA_PAYBILL_NUMBER || import.meta.env.VITE_MPESA_BUSINESS_SHORT_CODE || 'N/A';

  const sendStkFromList = async () => {
    if (!stkDraft) return;
    const invoiceId = stkDraft.invoiceId;
    const phone = stkDraft.phone.trim();
    const amountValue = String(stkAmountValue !== '' ? stkAmountValue : stkDraft.amount).trim();
    const amount = Math.max(0, Number(amountValue || 0));

    if (!phone) {
      setToast({ message: 'Tenant does not have a valid phone number', type: 'error' });
      return;
    }
    if (!amount) {
      setToast({ message: 'Enter an amount greater than zero.', type: 'error' });
      return;
    }

    // Update UI state immediately
    setStkBusyId(invoiceId);
    setStkDraft((current) => current ? {
      ...current,
      smsStatus: 'pending',
      smsMessage: `STK request is being submitted for KES ${amount.toLocaleString()}. Waiting for payment receipt before the confirmation SMS is sent.`,
    } : current);
    
    // Defer heavy async work to next frame
    requestAnimationFrame(() => {
      startTransition(() => {
        (async () => {
        try {
          setStkDraft((current) => current ? {
            ...current,
            smsStatus: 'pending',
            smsMessage: `STK request is being submitted for KES ${amount.toLocaleString()}. Waiting for payment receipt before the confirmation SMS is sent.`,
          } : current);

          // Yield to the browser so the button state paints before network work starts.
          await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

      const { data: currentInvoice, error: currentInvoiceError } = await supabase
        .from('re_invoices')
        .select('id, invoice_number, mpesa_account_reference, tenant_id, unit_id, amount_due, amount_paid, tenant:re_tenants(id, full_name, phone), unit:re_units(id, unit_number, property:re_properties(name))')
        .eq('id', invoiceId)
        .maybeSingle();

      if (currentInvoiceError) throw currentInvoiceError;
      if (!currentInvoice?.id) {
        throw new Error('The selected invoice could not be reloaded. Please reopen it and try again.');
      }

      const resolvedTenant = Array.isArray(currentInvoice.tenant) ? currentInvoice.tenant[0] : currentInvoice.tenant;
      const resolvedUnit = Array.isArray(currentInvoice.unit) ? currentInvoice.unit[0] : currentInvoice.unit;
      const resolvedProperty = Array.isArray(resolvedUnit?.property) ? resolvedUnit.property[0] : resolvedUnit?.property;
      const resolvedInvoiceNumber = currentInvoice.invoice_number || stkDraft.invoiceNumber || 'HAKIKA';
      const resolvedAccountReference = currentInvoice.mpesa_account_reference || stkDraft.accountReference || resolvedInvoiceNumber;
      const resolvedAmountDue = Number(currentInvoice.amount_due ?? stkDraft.amountDue ?? 0);
      const resolvedAmountPaid = Number(currentInvoice.amount_paid ?? stkDraft.amountPaid ?? 0);
      const resolvedBalanceBefore = Math.max(0, resolvedAmountDue - resolvedAmountPaid);
      const resolvedPhone = String(phone || resolvedTenant?.phone || '').trim();

      if (!resolvedPhone) {
        throw new Error('The selected invoice does not have a tenant phone number.');
      }

      const response = await callDaraja({
        action: 'stk-push',
        amount: Math.round(amount),
        phoneNumber: resolvedPhone,
        accountReference: resolvedAccountReference,
        transactionDesc: `Invoice ${resolvedInvoiceNumber} rent payment`,
        service_key: 'hakika',
        company_code: profile?.company_code || null,
      });
      const resultCode = Number(response?.response?.ResultCode ?? response?.response?.resultCode ?? NaN);
      const resultDesc = String(response?.response?.ResultDesc ?? response?.response?.resultDesc ?? '');
      setLatestStkResultCode(Number.isFinite(resultCode) ? resultCode : null);
      const checkoutRequestId = response?.response?.CheckoutRequestID || response?.response?.checkoutRequestID || response?.response?.CheckoutRequestId || null;
      if (checkoutRequestId) {
        const { error: snapshotError } = await supabase.from('mpesa_stk_request_context').insert([{
          company_id: profile?.company_id,
          invoice_id: invoiceId,
          checkout_request_id: checkoutRequestId,
          account_reference: resolvedAccountReference,
          transaction_desc: `Invoice ${resolvedInvoiceNumber} rent payment`,
          phone_number: resolvedPhone,
          tenant_id: currentInvoice.tenant_id || null,
          unit_id: currentInvoice.unit_id || null,
          property_name: resolvedProperty?.name || stkDraft.propertyName || null,
          unit_number: resolvedUnit?.unit_number || stkDraft.unitNumber || null,
          tenant_name: resolvedTenant?.full_name || stkDraft.tenantName || null,
          tenant_phone: resolvedPhone,
          invoice_number: resolvedInvoiceNumber,
          amount_due: resolvedAmountDue,
          amount_paid: resolvedAmountPaid,
          amount_requested: amount,
          balance_before: resolvedBalanceBefore,
          payload: { source: 'invoice-list', sent_at: new Date().toISOString() },
        }]);
        if (snapshotError) console.warn('Failed to store STK request context:', snapshotError);
        await supabase
          .from('re_invoices')
          .update({
            mpesa_checkout_request_id: checkoutRequestId,
            mpesa_last_stk_request_at: new Date().toISOString(),
            reconciliation_status: 'pending',
          })
          .eq('id', invoiceId);
      }
      const cancelled = resultCode === 1032;
      const failed = Number.isFinite(resultCode) && resultCode !== 0 && !cancelled;
      setStkDraft((current) => current ? {
        ...current,
        smsStatus: cancelled ? 'cancelled' : failed ? 'failed' : 'pending',
        smsMessage: cancelled
          ? `STK was cancelled for KES ${amount.toLocaleString()}. No confirmation SMS will be sent.`
          : failed
            ? `STK request failed${resultDesc ? `: ${resultDesc}` : ''}.`
            : `STK request submitted for KES ${amount.toLocaleString()}. Paybill: ${getPaybillNumber()}. Account: ${resolvedAccountReference}. Waiting for payment receipt before the confirmation SMS is sent.`,
      } : current);
      setRecentDarajaNote(typeof response?.response === 'object' ? JSON.stringify(response.response) : null);
      setToast({
        message: cancelled
          ? `STK cancelled for ${resolvedInvoiceNumber}.`
          : response?.response?.CustomerMessage || `STK sent for ${resolvedInvoiceNumber}. Paybill: ${getPaybillNumber()}. Account: ${resolvedAccountReference}. Amount: KES ${amount.toLocaleString()}.`,
        type: cancelled ? 'warning' : 'success',
      });
      if (Number.isFinite(resultCode) && resultCode === 0) {
        setStkRefreshTick((current) => current + 1);
      }
    } catch (error: any) {
      console.error('Failed to send STK push:', error);
      setToast({ message: error?.message || 'Failed to send STK push', type: 'error' });
    } finally {
      setStkBusyId(null);
    }
        })();
      });
    });
  };

  // Subscribe to real-time invoice updates
  useEffect(() => {
    if (!profile?.company_id) return;

    const channelName = `invoice_list:${profile.company_id}`;
    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 're_invoices',
          filter: `company_id=eq.${profile.company_id}`,
        },
        () => {
          // Refresh data when invoices change
          void fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 're_payments',
          filter: `company_id=eq.${profile.company_id}`,
        },
        () => {
          void fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mpesa_transactions',
          filter: `company_id=eq.${profile.company_id}`,
        },
        () => {
          void fetchData();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [profile?.company_id]);

  useEffect(() => {
    if (!stkDraft || latestStkResultCode !== 0) return;

    let cancelled = false;
    const timers: number[] = [];
    const pollDelays = [1500, 3500, 6500, 10000];

    pollDelays.forEach((delay) => {
      const timer = window.setTimeout(() => {
        if (!cancelled) {
          void fetchData();
        }
      }, delay);
      timers.push(timer);
    });

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [stkDraft?.invoiceId, latestStkResultCode, stkRefreshTick, profile?.company_id]);

  useEffect(() => {
    if (!stkDraft) return;

    const latest = invoices.find((invoice) => invoice.id === stkDraft.invoiceId);
    const stillPending =
      !latest ||
      latest.amount_paid <= 0 ||
      latest.confirmation_sms_status === 'pending' ||
      (!latest.confirmation_sms_status && !latest.mpesa_last_callback_at);

    if (!stillPending) return;

    const interval = window.setInterval(() => {
      void fetchData();
    }, 2500);

    return () => window.clearInterval(interval);
  }, [stkDraft?.invoiceId, stkDraft?.smsStatus, invoices, profile?.company_id]);

  useEffect(() => {
    if (!stkDraft) return;
    const latest = invoices.find((invoice) => invoice.id === stkDraft.invoiceId);
    if (!latest) return;

    const nextStatus =
      latest.confirmation_sms_status === 'sent'
        ? 'sent'
        : latest.confirmation_sms_status === 'cancelled'
          ? 'cancelled'
          : latest.confirmation_sms_status === 'failed'
            ? 'failed'
            : latest.amount_paid > 0
              ? 'sent'
              : latest.mpesa_receipt_no || latest.mpesa_checkout_request_id
                ? 'pending'
                : 'idle';

    const nextMessage =
      latest.confirmation_sms_status === 'sent'
        ? `Confirmation SMS sent successfully for receipt ${latest.latest_payment_receipt || latest.mpesa_receipt_no || 'N/A'}.`
        : latest.confirmation_sms_status === 'failed'
          ? latest.confirmation_sms_error || 'Confirmation SMS failed.'
          : latest.amount_paid > 0
            ? `Payment received for receipt ${latest.latest_payment_receipt || latest.mpesa_receipt_no || 'N/A'}. Confirmation SMS will follow if it has not already been sent.`
            : latest.mpesa_checkout_request_id
              ? `STK request submitted for KES ${Number(stkDraft.amount || 0).toLocaleString()}. Paybill: ${getPaybillNumber()}. Account: ${stkDraft.accountReference}. Waiting for payment receipt before the confirmation SMS is sent.`
              : null;

    setStkDraft((current) => current ? {
      ...current,
      amountDue: current.amountDue || latest.amount_due,
      amountPaid: latest.amount_paid,
      smsStatus: latest.confirmation_sms_status === 'sent' || latest.confirmation_sms_status === 'failed' || latest.confirmation_sms_status === 'cancelled'
        ? nextStatus
        : current.smsStatus === 'pending' && latest.amount_paid > 0
          ? 'pending'
            : nextStatus,
        smsMessage: latest.confirmation_sms_status === 'sent' || latest.confirmation_sms_status === 'failed' || latest.confirmation_sms_status === 'cancelled'
          ? nextMessage
          : current.smsStatus === 'pending' && latest.amount_paid > 0
            ? `Payment received for receipt ${latest.latest_payment_receipt || latest.mpesa_receipt_no || 'N/A'}. Confirmation SMS is being sent.`
            : nextMessage,
      } : current);
  }, [stkDraft?.invoiceId, invoices]);

  const sendConfirmationSms = async () => {
    if (!stkDraft) return;
    if (!ADMIN_ROLES.has(profile?.role || '')) {
      setToast({ message: 'Only admins can resend confirmation SMS.', type: 'error' });
      return;
    }
    const phone = stkDraft.phone.trim();
    if (!phone) {
      setToast({ message: 'Enter a phone number before sending the test SMS.', type: 'error' });
      return;
    }
    if (!window.confirm(`Resend the confirmation SMS for invoice ${stkDraft.invoiceNumber}?`)) return;

    const propertyName = stkDraft.propertyName || 'Hakika Property';
    const unitNumber = stkDraft.unitNumber || 'N/A';
    const tenantName = stkDraft.tenantName || 'Tenant';
    const tenantId = stkDraft.tenantId || 'N/A';
    const amountDue = Number(stkDraft.amountDue || 0);
    const amountPaid = Number(stkDraft.amountPaid || 0);
    const balance = Math.max(0, amountDue - amountPaid);
    const paybillNumber = getPaybillNumber();

    const message = [
      `Payment receipt preview for ${propertyName}, Unit ${unitNumber}.`,
      `Tenant: ${tenantName} (${tenantId})`,
      `Invoice: ${stkDraft.invoiceNumber || 'N/A'}`,
      `Rent due: KES ${amountDue.toLocaleString()}`,
      `Paid so far: KES ${amountPaid.toLocaleString()}`,
      `Balance: KES ${balance.toLocaleString()}`,
      `Paybill: ${paybillNumber}`,
      `Account: ${stkDraft.accountReference || stkDraft.invoiceNumber || 'N/A'}`,
      `Phone: ${phone}`,
    ].join(' ');

    const { success, error } = await sendBulkSms([phone], message, 'sms');
    if (success) {
      setStkDraft((current) => current ? { ...current, smsStatus: 'sent', smsMessage: 'Confirmation SMS sent successfully.' } : current);
      setToast({ message: 'Confirmation SMS sent successfully.', type: 'success' });
    } else {
      setStkDraft((current) => current ? { ...current, smsStatus: 'failed', smsMessage: error || 'Failed to send confirmation SMS.' } : current);
      setToast({ message: error || 'Failed to send confirmation SMS.', type: 'error' });
    }
  };

  const getSmsStatusMeta = (status?: string | null) => {
    switch (status) {
      case 'sent':
        return { label: 'SMS sent', className: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400' };
      case 'failed':
        return { label: 'SMS failed', className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400' };
      case 'pending':
        return { label: 'Waiting for receipt', className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400' };
      case 'skipped':
        return { label: 'SMS skipped', className: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400' };
      default:
        return { label: 'Not sent yet', className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/5 dark:text-slate-300' };
    }
  };

  const getLiveStatusMeta = (invoice: Invoice | null) => {
    if (!invoice) {
      return {
        label: 'Waiting',
        className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/5 dark:text-slate-300',
        title: 'Live status',
        message: 'Waiting for payment or callback activity.',
      };
    }

    if (latestStkResultCode === 1032) {
      return {
        label: 'Cancelled',
        className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300',
        title: 'Live status',
        message: 'STK was cancelled, so no payment confirmation SMS will be sent.',
      };
    }

    if (invoice.amount_paid > 0) {
      return {
        label: 'Paid',
        className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300',
        title: 'Live status',
        message: `Payment updated for ${invoice.invoice_number}. Balance is now KES ${Math.max(0, invoice.amount_due - invoice.amount_paid).toLocaleString()}.`,
      };
    }

    if (invoice.mpesa_checkout_request_id || invoice.latest_payment_receipt || invoice.mpesa_receipt_no) {
      return {
        label: 'Pending',
        className: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300',
        title: 'Live status',
        message: 'STK has been submitted. Waiting for callback before the SMS is sent.',
      };
    }

    return {
      label: 'Idle',
      className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/5 dark:text-slate-300',
      title: 'Live status',
      message: 'No payment activity yet for this invoice.',
    };
  };

  const [generating, setGenerating] = useState(false);
  const handleGenerateInvoices = async () => {
    if (!window.confirm('Generate invoices for all occupied units for the current month?')) return;
    setGenerating(true);
    try {
      if (!profile?.company_id || !profile?.id) {
        setToast({ message: 'User profile not loaded correctly', type: 'error' });
        return;
      }
          const result = await generateMonthlyInvoices(new Date(), profile.company_id, profile.id);
          if (result.success) {
            setToast({ message: `Successfully generated ${result.count} invoices.`, type: 'success' });
            fetchData();
            for (const inv of invoices.filter((invoice) => invoice.company_id === profile.company_id && invoice.tenant?.phone)) {
              void ensurePublicToken(inv.id);
            }
          } else {
            setToast({ message: result.message || 'Failed to generate invoices', type: 'error' });
          }
    } catch (error: any) {
      setToast({ message: error.message, type: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (profile) fetchData();
  }, [profile?.company_id]);

  const formatDate = (value?: string | null) => {
    if (!value) return '-';

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString();
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return '-';

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString();
  };

  const filteredInvoices = useMemo(() => (Array.isArray(invoices) ? invoices.filter(inv => {
    const matchesSearch = 
      (inv.invoice_number || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (inv.tenant?.full_name || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      (inv.unit?.unit_number || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    const matchesType = typeFilter === 'all' || String(inv.invoice_type || 'rent').toLowerCase() === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  }) : []), [invoices, debouncedSearchTerm, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    const total = filteredInvoices.length;
    const overdue = filteredInvoices.filter((inv) => inv.status === 'overdue').length;
    const partial = filteredInvoices.filter((inv) => inv.status === 'partial').length;
    const paid = filteredInvoices.filter((inv) => inv.status === 'paid').length;
    const balance = filteredInvoices.reduce((sum, inv) => sum + Math.max(0, inv.amount_due - inv.amount_paid), 0);
    return { total, overdue, partial, paid, balance };
  }, [filteredInvoices]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200';
      case 'partial': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200';
      case 'overdue': return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200';
      case 'unpaid': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 border-orange-200';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400 border-gray-200';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_36%),linear-gradient(180deg,#071b28_0%,#0b2232_45%,#0a1a26_100%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_36%),linear-gradient(180deg,#071b28_0%,#0b2232_45%,#0a1a26_100%)] p-4 text-slate-900 dark:text-white sm:p-6 lg:p-8">
      <div className="w-full max-w-none">
        <div className="mb-6 rounded-[28px] border border-slate-200/80 bg-[#123b54]/90 p-5 shadow-2xl shadow-slate-300/20 dark:border-white/10 dark:bg-[#123b54]/90 dark:shadow-slate-950/20 backdrop-blur-xl">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-fuchsia-700 dark:border-pink-400/30 dark:bg-pink-400/10 dark:text-pink-200">
                <FileText size={12} />
                Real Estate Billing
              </div>
              <h1 className="mt-3 flex items-center gap-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                Invoice List
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
                Manage and track all tenant invoices and billing history.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-[#f8fafc] px-4 py-3 dark:border-white/10 dark:bg-[#173d56]">
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Invoices</div>
                <div className="mt-1 text-2xl font-black text-slate-950 dark:text-white">{stats.total}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#f8fafc] px-4 py-3 dark:border-white/10 dark:bg-[#173d56]">
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Paid</div>
                <div className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-300">{stats.paid}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#f8fafc] px-4 py-3 dark:border-white/10 dark:bg-[#173d56]">
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Partial</div>
                <div className="mt-1 text-2xl font-black text-sky-700 dark:text-sky-300">{stats.partial}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#f8fafc] px-4 py-3 dark:border-white/10 dark:bg-[#173d56]">
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Balance</div>
                <div className="mt-1 text-lg font-black text-amber-700 dark:text-amber-200">Ksh {stats.balance.toLocaleString()}</div>
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button 
              onClick={handleSyncPayments} 
              disabled={syncing}
              title="Manually sync M-Pesa payments to invoices" 
              className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-sky-200/50 transition hover:bg-sky-500 disabled:opacity-50"
            >
              <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing...' : 'Sync Payments'}
            </button>
            <button 
              onClick={handleGenerateInvoices} 
              disabled={generating}
              title="Run automated billing for the current month" 
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-200/40 transition hover:bg-emerald-500 disabled:opacity-50"
            >
              <DollarSign size={16} /> {generating ? 'Generating...' : 'Run Monthly Billing'}
            </button>
            <button title="Export invoice list" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-[#173d56] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#1b4663]">
              <Download size={16} /> Export
            </button>
            <button 
              onClick={handleDeleteAllFiltered}
              disabled={filteredInvoices.length === 0}
              title="Delete all currently displayed invoices" 
              className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400 transition hover:bg-red-500/20 hover:text-white disabled:opacity-50"
            >
              <Trash2 size={16} /> Delete All
            </button>
            <button onClick={() => navigate('/app/real-estate/invoice/add-item')} title="Create a new invoice manually" className="inline-flex items-center gap-2 rounded-2xl bg-fuchsia-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-fuchsia-200/50 transition hover:bg-fuchsia-500">
              <Plus size={16} /> New Invoice
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-[24px] border border-white/10 bg-[#123b54]/90 p-4 shadow-xl shadow-slate-300/15 dark:shadow-slate-950/15 backdrop-blur-xl">
          <div className="relative flex-1">
            <label htmlFor="search-invoices" className="sr-only">Search invoices by number, tenant or unit</label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              id="search-invoices"
              type="text"
              placeholder="Search invoice #, tenant or unit..."
              title="Search for invoices by number, tenant name, or unit"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#0f3147] pl-10 pr-4 py-3 text-white outline-none placeholder:text-slate-400 focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <div className="mt-4 flex flex-col gap-4 md:flex-row">
            <label htmlFor="status-filter" className="sr-only">Filter invoices by status</label>
            <select 
              id="status-filter"
              title="Filter invoices by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#0f3147] px-4 py-3 text-white outline-none focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/20 md:max-w-[240px]"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="overdue">Overdue</option>
            </select>
            <label htmlFor="type-filter" className="sr-only">Filter invoices by type</label>
            <select
              id="type-filter"
              title="Filter invoices by type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#0f3147] px-4 py-3 text-white outline-none focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/20 md:max-w-[240px]"
            >
              <option value="all">All Types</option>
              <option value="rent">Rent</option>
              <option value="water">Water Bill</option>
              <option value="electricity">Electricity Bill</option>
              <option value="garbage">Garbage</option>
              <option value="internet">Internet</option>
              <option value="penalty">Penalty</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-[28px] border border-white/10 bg-[#123b54]/90 shadow-2xl shadow-slate-300/20 dark:shadow-slate-950/20 backdrop-blur-xl overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center">
              <CustomLoader size={32} label="Loading invoices..." />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-12 text-center text-slate-300">
              <FileText className="mx-auto mb-4 text-slate-500 dark:text-slate-400" size={48} />
              <p>No invoices found matching your criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1700px] text-sm text-left border-separate border-spacing-0">
                <thead className="bg-[#173d56] border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-slate-400">Invoice #</th>
                    <th className="px-6 py-4 font-semibold text-slate-400">Type</th>
                    <th className="px-6 py-4 font-semibold text-slate-400">Tenant / Unit</th>
                    <th className="px-6 py-4 font-semibold text-slate-400">Created</th>
                    <th className="px-6 py-4 font-semibold text-slate-400">Invoice Date</th>
                    <th className="px-6 py-4 font-semibold text-slate-400">Due Date</th>
                    <th className="px-6 py-4 font-semibold text-slate-400">Amount</th>
                    <th className="px-6 py-4 font-semibold text-slate-400">Paid So Far</th>
                    <th className="px-6 py-4 font-semibold text-slate-400">Split</th>
                    <th className="px-6 py-4 font-semibold text-slate-400">Last Payment</th>
                    <th className="px-6 py-4 font-semibold text-slate-400">Receipt</th>
                    <th className="px-6 py-4 font-semibold text-slate-400">Balance</th>
                    <th className="px-6 py-4 font-semibold text-slate-400">Status</th>
                    <th className="px-3 py-4 font-semibold text-slate-400 w-[132px]">Payment Link</th>
                    <th className="px-3 py-4 font-semibold text-slate-400 text-right w-[168px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-200/80 dark:divide-white/10">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="group border-b border-white/10 transition-colors hover:bg-[#1a4a68]">
                      <td className="px-6 py-5 font-extrabold text-white uppercase tracking-wide">
                        <div className="flex flex-col">
                          <span>{inv.invoice_number}</span>
                          <span className="mt-1 inline-flex w-fit rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
                            {getMatchLabel(inv)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold capitalize text-slate-200">
                        {inv.invoice_type || 'rent'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-white">{inv.tenant?.full_name || 'Unassigned Tenant'}</span>
                          <span className="text-xs text-slate-400">{inv.unit?.property?.name || 'Unassigned Property'} - Unit {inv.unit?.unit_number || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400">
                        {formatDateTime(inv.created_at)}
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        {formatDate(inv.invoice_date)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center text-slate-300">
                           <Calendar size={14} className="mr-1.5 text-slate-400" />
                           {formatDate(inv.due_date)}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-black text-white">
                        Ksh {inv.amount_due.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-emerald-300">
                            Ksh {Number(inv.amount_paid || 0).toLocaleString()}
                          </span>
                          <span className="text-xs text-slate-400">
                            {Number(inv.amount_paid || 0) > 0 ? 'Payments received' : 'No payments yet'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-white">
                            Fee: Ksh {Number(inv.service_fee_amount || 0).toLocaleString()}
                          </span>
                          <span className="text-xs text-slate-400">
                            Landlord: Ksh {Number(inv.landlord_payable_amount || Math.max(0, inv.amount_due - Number(inv.service_fee_amount || 0))).toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-white">
                            {inv.mpesa_receipt_no || '-'}
                          </span>
                          <span className="text-xs text-slate-400">
                            {inv.mpesa_last_callback_at ? new Date(inv.mpesa_last_callback_at).toLocaleString() : 'No payment yet'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-amber-200">
                        <div className="flex flex-col">
                          <span>Ksh {(inv.amount_due - inv.amount_paid).toLocaleString()}</span>
                          <span className="text-xs text-slate-400">
                            {inv.amount_paid > 0 ? `Updated after ${Number(inv.amount_paid).toLocaleString()} paid` : 'Awaiting payment'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wide border ${getStatusColor(inv.status)}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 w-[150px]">
                        <span
                          className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white text-center leading-tight min-w-[124px] ${
                            inv.payment_match_source === 'exact'
                              ? 'bg-emerald-600'
                              : inv.payment_match_source === 'phone'
                                ? 'bg-sky-600'
                                : inv.payment_match_source === 'amount'
                                  ? 'bg-amber-600'
                                  : 'bg-gray-500'
                          }`}
                        >
                          {getMatchLabel(inv)}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-right w-[168px]">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            disabled={stkBusyId === inv.id}
                            onClick={() => openStkDraft(inv)}
                            title="Review and send an STK push request for this invoice"
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2.5 text-sm font-black text-white transition hover:bg-emerald-400 disabled:opacity-50"
                          >
                            <Send size={14} />
                            {stkBusyId === inv.id ? 'Sending...' : 'Send STK'}
                          </button>
                          <button 
                            disabled={sendingInvoiceId === inv.id}
                            onClick={() => handleSendInvoice(inv, 'sms')} 
                            title="Send via SMS" 
                            className="rounded-xl border border-white/10 bg-[#173d56] p-2 text-slate-300 transition hover:bg-[#1b4663] hover:text-white disabled:opacity-50"
                          >
                            <Smartphone size={16} />
                          </button>
                          <button 
                            disabled={sendingInvoiceId === inv.id}
                            onClick={() => handleSendInvoice(inv, 'whatsapp')} 
                            title="Send via WhatsApp" 
                            className="rounded-xl border border-white/10 bg-[#173d56] p-2 text-slate-300 transition hover:bg-[#1b4663] hover:text-[#25D366] disabled:opacity-50"
                          >
                            <MessageSquare size={16} />
                          </button>
                          <button
                            onClick={() => deleteInvoice(inv)}
                            title="Delete invoice"
                            className="rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/20 hover:text-white"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {stkDraft && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 px-3 py-4 backdrop-blur-md dark:bg-black/50 sm:px-4 sm:py-6">
          <div className="my-auto w-full max-w-xl overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_30px_120px_-30px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-slate-950/95 dark:shadow-[0_30px_120px_-30px_rgba(2,6,23,0.95)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-5 sm:py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.35em] text-sky-600">STK Push</p>
                <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white sm:text-2xl">Send payment request</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Confirm the amount before requesting payment.</p>
              </div>
              <button onClick={() => {
                setStkDraft(null);
                setStkAmountValue('');
              }} className="rounded-full border border-white/10 bg-[#173d56] p-2 text-slate-300 transition hover:bg-[#1b4663] hover:text-white" aria-label="Close STK modal">×</button>
            </div>
            <div className="space-y-3 px-4 py-4 text-sm text-slate-300 sm:px-5 sm:py-5">
              {(() => {
                const latestInvoice = invoices.find((invoice) => invoice.id === stkDraft.invoiceId) || null;
                const smsStatus = latestStkResultCode === 1032
                  ? 'cancelled'
                  : latestInvoice?.confirmation_sms_status || stkDraft.smsStatus;
                const smsMessage =
                  latestStkResultCode === 1032
                    ? 'The STK request was cancelled on the phone. No confirmation SMS will be sent.'
                    : latestInvoice?.confirmation_sms_status === 'sent'
                      ? `Confirmation SMS sent for receipt ${latestInvoice?.latest_payment_receipt || latestInvoice?.mpesa_receipt_no || 'N/A'}.`
                      : latestInvoice?.confirmation_sms_status === 'failed'
                        ? latestInvoice?.confirmation_sms_error || 'Confirmation SMS failed.'
                        : latestInvoice?.confirmation_sms_status === 'cancelled'
                          ? 'The confirmation SMS was cancelled and will not be sent.'
                          : (latestInvoice?.amount_paid ?? 0) > 0
                            ? `Payment received for receipt ${latestInvoice?.latest_payment_receipt || latestInvoice?.mpesa_receipt_no || 'N/A'}. Confirmation SMS is being sent.`
                            : 'The confirmation SMS will be sent after the payment receipt is recorded.';

                return (
                  <>
                    <div className="rounded-2xl border border-white/10 bg-[#173d56] p-3 sm:p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Invoice</p>
                      <p className="mt-2 text-base font-black text-white sm:text-lg">{stkDraft.invoiceNumber}</p>
                    </div>
                    <div className="rounded-2xl border border-dashed border-white/10 bg-[#173d56] p-3 sm:p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Confirmation SMS</p>
                        <p className="text-sm text-slate-300">{smsMessage}</p>
                      </div>
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border ${getSmsStatusMeta(smsStatus).className}`}>
                        {getSmsStatusMeta(smsStatus).label}
                      </span>
                    </div>
                  </>
                );
              })()}
              {(() => {
                const latestInvoice = invoices.find((invoice) => invoice.id === stkDraft.invoiceId) || null;
                const liveMeta = getLiveStatusMeta(latestInvoice);
                return (
                  <div className={`rounded-2xl border p-3 sm:p-4 ${liveMeta.className}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-70">{liveMeta.title}</p>
                        <p className="mt-2 text-sm font-medium leading-6">{liveMeta.message}</p>
                      </div>
                      <span className="inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-semibold">
                        {liveMeta.label}
                      </span>
                    </div>
                  </div>
                );
              })()}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-[#173d56] p-3 sm:p-4">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400 font-black">Tenant</p>
                  <p className="mt-2 break-words font-semibold text-white">{stkDraft.tenantName}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#173d56] p-3 sm:p-4">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400 font-black">Property / Unit</p>
                  <p className="mt-2 break-words font-semibold text-white">{stkDraft.propertyName} - Unit {stkDraft.unitNumber}</p>
                </div>
                <label className="rounded-2xl border border-white/10 bg-[#173d56] p-3 block sm:p-4">
                  <span className="text-[11px] uppercase tracking-[0.3em] text-slate-400 font-black">Phone</span>
                  <input
                    value={stkDraft.phone}
                    onChange={(e) => setStkDraft((current) => current ? { ...current, phone: e.target.value } : current)}
                    placeholder="2547XXXXXXXX"
                    className="mt-3 w-full rounded-xl border border-white/10 bg-[#0f3147] px-3 py-2 text-white outline-none focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/20"
                  />
                </label>
                <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#173d56] to-[#123b54] p-3 sm:p-4">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400 font-black">STK Amount</p>
                  <input
                    type="number"
                    min="1"
                    value={stkAmountValue}
                    onChange={handleStkAmountChange}
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-[#0f3147] px-4 py-3 text-white outline-none focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/20"
                  />
                  <p className="mt-2 text-xs text-slate-400">Default is the invoice balance, but you can edit it before sending.</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  onClick={() => {
                    setStkDraft(null);
                    setStkAmountValue('');
                  }}
                  className="flex-1 rounded-2xl border border-white/10 bg-[#173d56] px-4 py-3 font-semibold text-white hover:bg-[#1b4663]"
                >
                  Cancel
                </button>
                {ADMIN_ROLES.has(profile?.role || '') && (
                  <button
                    onClick={sendConfirmationSms}
                    className="flex-1 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-4 py-3 font-semibold text-fuchsia-200 hover:bg-fuchsia-500/20"
                  >
                    Resend confirmation SMS
                  </button>
                )}
                <button
                  onClick={sendStkFromList}
                  disabled={stkBusyId === stkDraft.invoiceId}
                  className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 font-semibold text-white shadow-lg shadow-emerald-200/40 disabled:opacity-50"
                >
                  {stkBusyId === stkDraft.invoiceId ? 'Sending...' : `Send KES ${Number(stkAmountValue || 0).toLocaleString()}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
