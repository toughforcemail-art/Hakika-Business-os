// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowLeft, ArrowUpRight, CheckCircle2, CreditCard, Download, FileText, Home, Printer, Search, ShieldCheck, User, Users, Landmark, Clock3, MapPinned, Phone, Mail, RefreshCw, Trash2, LayoutDashboard, LogOut, CalendarDays } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { sanitizeError, ToastType } from '../../components/CustomToast';
import { printWorkspacePage } from '../../utils/printHelpers';
import { getInvoiceBalance } from '../../utils/arrears';
import { supabase } from '../../utils/supabase';
import { getTenantDisplayName } from '../../utils/tenantDisplay';
import { callDaraja } from '../../services/darajaService';
import { syncMpesaPayments } from '../../services/paymentSyncService';

type TabKey = 'overview' | 'leases' | 'arrears' | 'statement' | 'moveout';

interface MoveOutRequest {
  id: string;
  requested_at: string;
  requested_move_out_date: string;
  eligible_move_out_date: string;
  status: string;
  deposit_held: number | string | null;
  arrears: number | string | null;
  refundable_deposit: number | string | null;
  settlement_notes?: string | null;
  reason?: string | null;
}

interface Tenant {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  national_id: string | null;
  is_active: boolean;
  lease_start_date: string | null;
  lease_end_date: string | null;
  current_unit_id: string | null;
  emergency_contacts?: Array<{ name: string; relationship: string; phone: string }>;
  profile_image_url?: string | null;
  tenant_no?: string | null;
}

interface Lease {
  id: string;
  lease_number?: string | null;
  tenant_id: string;
  unit_id: string;
  property_id?: string | null;
  lease_type?: 'residential' | 'commercial' | null;
  rent_amount?: number | null;
  deposit_amount?: number | null;
  water_deposit_amount?: number | null;
  electricity_deposit_amount?: number | null;
  deposit_paid_to?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  payment_day?: number | null;
  duration_months?: number | null;
  status?: string | null;
}

interface Unit {
  id: string;
  unit_number: string;
  property_id: string | null;
  rent_amount?: number | null;
  property?: Array<{ name: string }>;
  lease_type?: string | null;
}

interface Property {
  id: string;
  name: string;
}

interface Invoice {
  id: string;
  tenant_id: string;
  invoice_number: string | null;
  invoice_date: string;
  due_date: string | null;
  amount_due: number | string | null;
  amount_paid: number | string | null;
  deposit_amount?: number | string | null;
  deposit_paid?: number | string | null;
  deposit_paid_to?: string | null;
  deposit_shared_with_agent?: boolean | null;
  rent_paid?: number | string | null;
  status: string | null;
  unit_id?: string | null;
  created_at?: string | null;
  notes?: string | null;
  mpesa_checkout_request_id?: string | null;
  mpesa_receipt_no?: string | null;
  payment_match_source?: 'exact' | 'phone' | 'amount' | 'unmatched' | null;
}

interface Payment {
  id: string;
  tenant_id: string;
  payment_date: string;
  amount: number | string | null;
  payment_method: string | null;
  reference_number: string | null;
  status?: string | null;
  notes?: string | null;
  invoice_id?: string | null;
  created_at?: string | null;
}

const currency = (value: number) => `KES ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const toNumber = (value: number | string | null | undefined) => Number(value || 0);

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

const panelCls = 'rounded-[28px] border border-white/60 bg-white/90 p-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-dark-surface/90';
const pillBase = 'inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.18em] transition';

export default function TenantProfilePage() {
  const navigate = useNavigate();
  const { tenantId } = useParams();
  const { profile } = useAccess();
  const isSuperAdmin = ['super admin', 'super_admin', 'director / super admin'].includes((profile?.role || '').trim().toLowerCase());

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [moveOutRequest, setMoveOutRequest] = useState<MoveOutRequest | null>(null);
  const [isTenantPickerOpen, setIsTenantPickerOpen] = useState(false);
  const [tenantSearch, setTenantSearch] = useState('');
  const [tenantPropertyFilter, setTenantPropertyFilter] = useState('');
  const [tenantUnitFilter, setTenantUnitFilter] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [stkBusyInvoiceId, setStkBusyInvoiceId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const resolvedTenantId = useMemo(() => tenantId || tenants[0]?.id || '', [tenantId, tenants]);

  useEffect(() => {
    if (profile) {
      void loadData();
    }
  }, [profile?.company_id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tenantRes, leaseRes, unitRes, propertyRes] = await Promise.all([
        supabase.from('re_tenants').select('*').eq('is_active', true).order('full_name'),
        supabase.from('re_leases').select('*').order('created_at', { ascending: false }),
        supabase.from('re_units').select('*'),
        supabase.from('re_properties').select('*').order('name'),
      ]);

      if (tenantRes.error) throw tenantRes.error;
      if (leaseRes.error) throw leaseRes.error;
      if (unitRes.error) throw unitRes.error;
      if (propertyRes.error) throw propertyRes.error;

      const nextTenants = (tenantRes.data || []) as Tenant[];
      setTenants(nextTenants);
      setLeases((leaseRes.data || []) as Lease[]);
      setUnits((unitRes.data || []) as Unit[]);
      setProperties((propertyRes.data || []) as Property[]);

      const selected = tenantId || nextTenants[0]?.id || '';
      if (selected) {
        await loadTenantActivity(selected);
        if (!tenantId) {
          navigate(`/app/real-estate/tenants/${selected}/profile`, { replace: true });
        }
      } else {
        setInvoices([]);
        setPayments([]);
        setMoveOutRequest(null);
      }
    } catch (error: any) {
      console.error('Failed to load tenant profile:', error);
      setToast({ message: sanitizeError(error), type: 'error' });
      setInvoices([]);
      setPayments([]);
      setMoveOutRequest(null);
    } finally {
      setLoading(false);
    }
  };

  const loadTenantActivity = async (selectedTenantId: string) => {
    try {
      // Fetch invoices for this tenant
      const invoiceRes = await supabase
        .from('re_invoices')
        .select('*')
        .eq('tenant_id', selectedTenantId)
        .is('deleted_at', null)
        .order('invoice_date', { ascending: true });

      if (invoiceRes.error) throw invoiceRes.error;

      const invoices = (invoiceRes.data || []) as Invoice[];
      setInvoices(invoices);

      // Fetch payments in two ways:
      // 1. Payments directly linked to this tenant (tenant_id = selectedTenantId)
      // 2. Payments linked via invoices for this tenant (invoice_id in invoice list)
      const invoiceIds = invoices.map(inv => inv.id);
      
      let allPayments: Payment[] = [];

      // Get payments by tenant_id
      const paymentByTenantRes = await supabase
        .from('re_payments')
        .select('*')
        .eq('tenant_id', selectedTenantId)
        .order('payment_date', { ascending: true });

      if (paymentByTenantRes.error) throw paymentByTenantRes.error;
      allPayments = [...(paymentByTenantRes.data || [])];

      // Get payments by invoice_id (for payments synced without tenant_id)
      if (invoiceIds.length > 0) {
        const paymentByInvoiceRes = await supabase
          .from('re_payments')
          .select('*')
          .in('invoice_id', invoiceIds)
          .order('payment_date', { ascending: true });

        if (paymentByInvoiceRes.error) throw paymentByInvoiceRes.error;
        
        // Merge and deduplicate payments
        const paymentMap = new Map<string, Payment>();
        allPayments.forEach(p => paymentMap.set(p.id, p));
        (paymentByInvoiceRes.data || []).forEach(p => paymentMap.set(p.id, p));
        allPayments = Array.from(paymentMap.values()).sort((a, b) => 
          new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime()
        );
      }

      setPayments(allPayments as Payment[]);

      const moveOutRes = await supabase
        .from('re_tenant_move_out_requests')
        .select('id, requested_at, requested_move_out_date, eligible_move_out_date, status, deposit_held, arrears, refundable_deposit, settlement_notes, reason')
        .eq('tenant_id', selectedTenantId)
        .order('requested_at', { ascending: false })
        .limit(1);
      if (moveOutRes.error) {
        console.error('Failed to load move-out requests:', moveOutRes.error);
        setMoveOutRequest(null);
        setToast({ message: `Move-out requests could not be loaded: ${sanitizeError(moveOutRes.error)}`, type: 'error' });
      } else {
        setMoveOutRequest((moveOutRes.data?.[0] || null) as MoveOutRequest | null);
      }
    } catch (error: any) {
      console.error('Failed to load tenant activity:', error);
      setInvoices([]);
      setPayments([]);
      throw error;
    }
  };

  useEffect(() => {
    if (!resolvedTenantId) return;

    void loadTenantActivity(resolvedTenantId).catch((error) =>
      setToast({ message: sanitizeError(error), type: 'error' }),
    );

    // Subscribe to real-time invoice updates for this tenant
    const invoiceSubscription = supabase
      .channel(`re_invoices:${resolvedTenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 're_invoices',
          filter: `tenant_id=eq.${resolvedTenantId}`,
        },
        (payload) => {
          // Refresh tenant activity immediately when invoices change
          console.log('Invoice change detected:', payload.eventType);
          void loadTenantActivity(resolvedTenantId);
        }
      )
      .subscribe();

    // Subscribe to real-time payment updates for this tenant
    const paymentSubscription = supabase
      .channel(`re_payments:${resolvedTenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 're_payments',
          filter: `tenant_id=eq.${resolvedTenantId}`,
        },
        (payload) => {
          // Refresh tenant activity immediately when payments change
          console.log('Payment change detected:', payload.eventType);
          void loadTenantActivity(resolvedTenantId);
        }
      )
      .subscribe();

    return () => {
      invoiceSubscription.unsubscribe();
      paymentSubscription.unsubscribe();
    };
  }, [resolvedTenantId]);

  const selectedTenant = tenants.find((tenant) => tenant.id === resolvedTenantId) || tenants.find((tenant) => tenant.id === tenantId) || null;
  const selectedLease = useMemo(
    () =>
      leases.find((lease) => lease.tenant_id === resolvedTenantId && lease.status === 'active') ||
      leases.find((lease) => lease.tenant_id === resolvedTenantId) ||
      leases.find((lease) => lease.tenant_id === tenantId && lease.status === 'active') ||
      leases.find((lease) => lease.tenant_id === tenantId) ||
      null,
    [leases, resolvedTenantId, tenantId],
  );
  const tenantLeases = useMemo(
    () => leases.filter((lease) => lease.tenant_id === (resolvedTenantId || tenantId)),
    [leases, resolvedTenantId, tenantId],
  );
  const selectedUnit = useMemo(
    () => units.find((unit) => unit.id === (selectedTenant?.current_unit_id || selectedLease?.unit_id)) || null,
    [selectedLease?.unit_id, selectedTenant?.current_unit_id, units],
  );
  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === (selectedLease?.property_id || selectedUnit?.property_id)) || null,
    [properties, selectedLease?.property_id, selectedUnit?.property_id],
  );
  const tenantOptions = useMemo(() => {
    return tenants
      .map((tenant) => {
        const lease = leases.find((item) => item.tenant_id === tenant.id && item.status === 'active') || leases.find((item) => item.tenant_id === tenant.id) || null;
        const unit = units.find((item) => item.id === (tenant.current_unit_id || lease?.unit_id)) || null;
        const property = properties.find((item) => item.id === (lease?.property_id || unit?.property_id)) || null;
        return { tenant, lease, unit, property };
      })
      .filter(({ tenant, unit, property }) => {
        const search = tenantSearch.trim().toLowerCase();
        const matchesSearch =
          !search ||
          getTenantDisplayName(tenant as any).toLowerCase().includes(search) ||
          (tenant.phone || '').toLowerCase().includes(search) ||
          (tenant.email || '').toLowerCase().includes(search) ||
          (unit?.unit_number || '').toLowerCase().includes(search) ||
          (property?.name || '').toLowerCase().includes(search);
        const matchesProperty = !tenantPropertyFilter || property?.id === tenantPropertyFilter;
        const matchesUnit = !tenantUnitFilter || unit?.id === tenantUnitFilter;
        return matchesSearch && matchesProperty && matchesUnit;
      });
  }, [leases, properties, tenantPropertyFilter, tenantSearch, tenantUnitFilter, tenants, units]);

  const tenantPickerUnits = useMemo(
    () =>
      units
        .map((unit) => ({
          ...unit,
          propertyName: properties.find((property) => property.id === unit.property_id)?.name || '',
        }))
        .filter((unit) => !tenantPropertyFilter || unit.property_id === tenantPropertyFilter),
    [properties, tenantPropertyFilter, units],
  );
  const arrears = useMemo(
    () => (Array.isArray(invoices) ? invoices : []).map((invoice) => ({ ...invoice, balance: getInvoiceBalance(invoice) })).filter((invoice) => invoice.balance > 0),
    [invoices],
  );
  const totalInvoiced = useMemo(() => (Array.isArray(invoices) ? invoices : []).reduce((sum, invoice) => sum + toNumber(invoice.amount_due), 0), [invoices]);
  const totalPaid = useMemo(() => (Array.isArray(payments) ? payments : []).reduce((sum, payment) => sum + toNumber(payment.amount), 0), [payments]);
  const totalDepositDue = useMemo(() => (Array.isArray(invoices) ? invoices : []).reduce((sum, invoice) => sum + toNumber(invoice.deposit_amount), 0), [invoices]);
  const totalDepositPaid = useMemo(() => (Array.isArray(invoices) ? invoices : []).reduce((sum, invoice) => sum + toNumber(invoice.deposit_paid), 0), [invoices]);
  const currentLeaseDeposit = useMemo(() => {
    if (!selectedLease) return { rent: 0, water: 0, electricity: 0, total: 0 };
    const rent = toNumber(selectedLease.deposit_amount);
    const water = toNumber(selectedLease.water_deposit_amount);
    const electricity = toNumber(selectedLease.electricity_deposit_amount);
    return { rent, water, electricity, total: rent + water + electricity };
  }, [selectedLease]);
  const currentBalance = totalInvoiced - totalPaid;
  const creditBalance = Math.max(0, totalPaid - totalInvoiced);
  const hasCredit = creditBalance > 0;
  const invoiceRows = useMemo(() => (Array.isArray(invoices) ? invoices : []).map((invoice) => ({
    ...invoice,
    balance: Math.max(0, toNumber(invoice.amount_due) - toNumber(invoice.amount_paid)),
    overpaid: Math.max(0, toNumber(invoice.amount_paid) - toNumber(invoice.amount_due)),
    payment_match_source: invoice.mpesa_checkout_request_id
      ? 'exact'
      : invoice.mpesa_receipt_no
        ? 'phone'
        : toNumber(invoice.amount_paid) > 0
          ? 'amount'
          : 'unmatched',
  })), [invoices]);
  const paymentRows = useMemo(() => (Array.isArray(payments) ? payments : []).map((payment) => ({
    ...payment,
    description: payment.notes || (payment.invoice_id ? `Payment against invoice ${payment.invoice_id}` : 'General tenant payment'),
  })), [payments]);

  const sendInvoiceStk = async (invoice: Invoice) => {
    const amount = Math.max(0, toNumber(invoice.amount_due) - toNumber(invoice.amount_paid));
    const phone = selectedTenant?.phone || '';
    if (!phone) {
      setToast({ message: 'Tenant does not have a phone number for STK.', type: 'error' });
      return;
    }
    if (amount <= 0) {
      setToast({ message: 'This invoice has no outstanding balance.', type: 'warning' });
      return;
    }

    setStkBusyInvoiceId(invoice.id);
    try {
      const response = await callDaraja({
        action: 'stk-push',
        amount: Math.round(amount),
        phoneNumber: phone,
        accountReference: invoice.invoice_number || 'HAKIKA',
        transactionDesc: `Invoice ${invoice.invoice_number || invoice.id} rent payment`,
      });
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
      }
      setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, mpesa_checkout_request_id: checkoutRequestId || null } as any : item));
      setToast({ message: response?.response?.CustomerMessage || `STK sent for ${invoice.invoice_number || invoice.id}.`, type: 'success' });
      await loadTenantActivity(resolvedTenantId);
    } catch (error: any) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setStkBusyInvoiceId(null);
    }
  };

  const deleteInvoice = async (invoice: Invoice) => {
    // Check if user has permission (Super Admin or Director)
    const userRole = profile?.role || '';
    const allowedRoles = ['Super Admin', 'Administrator', 'Director', 'Director / Super Admin'];
    if (!allowedRoles.includes(userRole)) {
      setToast({ message: 'Only Super Admins and Directors can delete invoices.', type: 'error' });
      return;
    }

    // Confirm deletion
    const confirmed = window.confirm(
      `Are you sure you want to delete invoice ${invoice.invoice_number || invoice.id}?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('re_invoices')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: profile?.id || null,
        })
        .eq('id', invoice.id);

      if (error) throw error;

      setInvoices((current) => current.filter((item) => item.id !== invoice.id));
      setToast({ message: `Invoice ${invoice.invoice_number || invoice.id} deleted successfully.`, type: 'success' });
      await loadTenantActivity(resolvedTenantId);
    } catch (error: any) {
      setToast({ message: sanitizeError(error), type: 'error' });
    }
  };

  const syncPayments = async () => {
    setSyncing(true);
    try {
      const result = await syncMpesaPayments();
      console.log('Sync result:', result);
      
      if (result.success || result.synced > 0) {
        // Wait a moment for database to process
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Force reload tenant activity
        console.log('Reloading tenant activity after sync...');
        await loadTenantActivity(resolvedTenantId);
        
        setToast({ message: result.message || 'Payments synced successfully', type: 'success' });
      } else {
        // Show first error in toast
        let errorMsg = result.message || 'Failed to sync payments';
        if (result.errors && result.errors.length > 0) {
          errorMsg = `${result.message}\n\nFirst error: ${result.errors[0]}`;
        }
        setToast({ message: errorMsg, type: 'error' });
        console.error('Sync errors:', result.errors);
      }
    } catch (error: any) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const exportCsv = () => {
    if (!selectedTenant) return;
    const rows: Array<Array<string | number>> = [
      ['Tenant', getTenantDisplayName(selectedTenant as any)],
      ['Phone', selectedTenant.phone || ''],
      ['Email', selectedTenant.email || ''],
      ['National ID', selectedTenant.national_id || ''],
      ['Property', selectedProperty?.name || ''],
      ['Unit', selectedUnit?.unit_number || ''],
      ['Lease', selectedLease?.lease_number || ''],
      ['Lease type', selectedLease?.lease_type || ''],
      ['Lease start', selectedTenant.lease_start_date || ''],
      ['Lease end', selectedTenant.lease_end_date || ''],
      ['Total invoiced', currency(totalInvoiced)],
      ['Total paid', currency(totalPaid)],
      ['Deposit due', currency(totalDepositDue)],
      ['Deposit paid', currency(totalDepositPaid)],
      ['Current balance', currency(currentBalance)],
      ['Credit balance', currency(creditBalance)],
      [],
      ['Invoices'],
      ['Invoice #', 'Invoice date', 'Due date', 'Amount due', 'Amount paid', 'Balance', 'Status', 'Notes'],
      ...invoiceRows.map((invoice) => [
        invoice.invoice_number || invoice.id,
        invoice.invoice_date,
        invoice.due_date || '',
        currency(toNumber(invoice.amount_due)),
        currency(toNumber(invoice.amount_paid)),
        invoice.balance > 0 ? currency(invoice.balance) : invoice.overpaid > 0 ? `Credit ${currency(invoice.overpaid)}` : 'Settled',
        invoice.status || '',
        invoice.notes || '',
      ]),
      [],
      ['Payments'],
      ['Date', 'Reference', 'Method', 'Amount', 'Status', 'Description', 'Invoice ID'],
      ...paymentRows.map((payment) => [
        payment.payment_date,
        payment.reference_number || '',
        payment.payment_method || '',
        currency(toNumber(payment.amount)),
        payment.status || '',
        payment.description,
        payment.invoice_id || '',
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tenant_profile_${getTenantDisplayName(selectedTenant as any).replace(/\s+/g, '_').toLowerCase() || 'tenant'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    setToast({ message: 'Tenant profile exported as CSV.', type: 'success' });
  };

  const openTenantPicker = () => {
    setTenantSearch('');
    setTenantPropertyFilter(selectedProperty?.id || '');
    setTenantUnitFilter(selectedUnit?.id || '');
    setIsTenantPickerOpen(true);
  };

  const openTenant = (id: string) => {
    navigate(`/app/real-estate/tenants/${id}/profile`);
    setActiveTab('overview');
  };

  const quickLinks = [
    { key: 'overview' as const, label: 'Overview', icon: User },
    { key: 'leases' as const, label: 'Lease', icon: FileText },
    { key: 'arrears' as const, label: 'Arrears', icon: CreditCard },
    { key: 'statement' as const, label: 'Statement', icon: FileText },
    { key: 'moveout' as const, label: 'Move-out request', icon: LogOut },
  ];

  if (loading) {
    return <div className="flex h-full items-center justify-center p-8"><CustomLoader label="Loading tenant profile..." /></div>;
  }

  const statusTone = selectedTenant?.is_active
    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    : 'bg-slate-500/10 text-slate-700 dark:text-slate-300';
  const balanceTone = currentBalance > 0
    ? 'text-rose-600 dark:text-rose-300'
    : 'text-emerald-600 dark:text-emerald-300';

  return (
    <div className="min-h-screen space-y-6 bg-[radial-gradient(circle_at_top_left,rgba(255,106,0,0.12),transparent_28%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] p-6 dark:bg-[radial-gradient(circle_at_top_left,rgba(255,183,122,0.12),transparent_28%),linear-gradient(180deg,#061725_0%,#081b2a_100%)]">
      <div className={`${panelCls} relative overflow-hidden`}>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.85),rgba(255,255,255,0.25))] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))]" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/app/real-estate/tenants')}
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/70 bg-white text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
              aria-label="Back to tenant management"
              title="Back to tenant management"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Tenant Profile Hub</p>
              <h1 className="mt-1 text-3xl font-black text-slate-900 dark:text-white">{selectedTenant ? getTenantDisplayName(selectedTenant as any) : 'Select a tenant'}</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">A single profile view for identity, lease placement, billing posture, and payment history.</p>
              {selectedTenant ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] ${statusTone}`}>
                    <CheckCircle2 size={14} />
                    {selectedTenant.is_active ? 'Active tenant' : 'Inactive tenant'}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-slate-700 dark:bg-white/10 dark:text-slate-200">
                    <MapPinned size={14} />
                    {selectedProperty?.name || 'Unassigned property'}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-slate-700 dark:bg-white/10 dark:text-slate-200">
                    <Landmark size={14} />
                    {selectedUnit?.unit_number || 'No unit'}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
          <div className="relative flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => printWorkspacePage({ title: selectedTenant ? `Tenant Profile - ${getTenantDisplayName(selectedTenant as any)}` : 'Tenant Profile' })}
              className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100"
            >
              <Printer size={16} className="mr-2 inline" /> Print
            </button>
            {isSuperAdmin && selectedTenant ? (
              <button
                type="button"
                onClick={() => window.open(`/app/tenant/dashboard?tenantId=${encodeURIComponent(selectedTenant.id)}`, '_blank', 'noopener,noreferrer')}
                className="inline-flex items-center gap-2 rounded-2xl border border-[#ff6a00]/20 bg-[#ff6a00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#ff7f2a]"
                title="View this tenant's dashboard"
              >
                <LayoutDashboard size={16} /> View tenant dashboard
              </button>
            ) : null}
            <button type="button" onClick={exportCsv} className="rounded-2xl border border-[#ff6a00]/20 bg-[#ff6a00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#ff7f2a]">
              <Download size={16} className="mr-2 inline" /> Download CSV
            </button>
            <button
              type="button"
              onClick={openTenantPicker}
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100"
            >
              <Search size={16} className="mr-1 inline" /> Change tenant
            </button>
          </div>
        </div>
      </div>

      {selectedTenant ? (
        <div className="rounded-[28px] border border-gray-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-dark-surface/90">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <button
                  key={link.key}
                  type="button"
                  onClick={() => setActiveTab(link.key)}
                  className={`inline-flex min-w-max items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${
                    activeTab === link.key
                      ? 'border-[#ff6a00]/30 bg-[#ff6a00] text-white'
                      : 'border-gray-200 bg-gray-50 text-slate-700 hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200'
                  }`}
                >
                  <Icon size={15} />
                  {link.label}
                </button>
              );
            })}
            <button type="button" onClick={() => printWorkspacePage({ title: selectedTenant ? `Tenant Profile - ${getTenantDisplayName(selectedTenant as any)}` : 'Tenant Profile' })} className="inline-flex min-w-max items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200">
              <Printer size={15} /> Print
            </button>
            <button type="button" onClick={exportCsv} className="inline-flex min-w-max items-center gap-2 rounded-full border border-[#ff6a00]/20 bg-[#ff6a00] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#ff7f2a]">
              <Download size={15} /> CSV
            </button>
          </div>
        </div>
      ) : null}

      {isTenantPickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-white/60 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-dark-surface">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Change tenant</p>
                <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-white">Pick another profile</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTenantPickerOpen(false)}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
              >
                Close
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="relative sm:col-span-3">
                  <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    value={tenantSearch}
                    onChange={(event) => setTenantSearch(event.target.value)}
                    placeholder="Search tenant, phone, email..."
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-[#ff6a00]/40 focus:bg-white focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                  />
                </div>
                <select
                  value={tenantPropertyFilter}
                  onChange={(event) => {
                    setTenantPropertyFilter(event.target.value);
                    setTenantUnitFilter('');
                  }}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#ff6a00]/40 focus:bg-white focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white sm:col-span-1"
                >
                  <option value="">All properties</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>{property.name}</option>
                  ))}
                </select>
                <select
                  value={tenantUnitFilter}
                  onChange={(event) => setTenantUnitFilter(event.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#ff6a00]/40 focus:bg-white focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white sm:col-span-2"
                >
                  <option value="">All units</option>
                  {tenantPickerUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.propertyName ? `${unit.propertyName} • ` : ''}{unit.unit_number}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {tenantOptions.map(({ tenant, unit, property }) => (
                <button
                  key={tenant.id}
                  type="button"
                  onClick={() => {
                    openTenant(tenant.id);
                    setIsTenantPickerOpen(false);
                  }}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    tenant.id === tenantId
                      ? 'border-[#ff6a00]/30 bg-[#fff3eb] dark:border-[#ff6a00]/30 dark:bg-[#ff6a00]/10'
                      : 'border-gray-200 bg-white hover:border-[#ff6a00]/20 dark:border-white/10 dark:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {(tenant as any).profile_image_url ? (
                      <img src={(tenant as any).profile_image_url} alt={getTenantDisplayName(tenant as any)} className="h-8 w-8 rounded-full object-cover border border-gray-200 dark:border-white/10 shrink-0" />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ff6a00]/10 text-[#ff6a00] font-black text-sm">
                        {getTenantDisplayName(tenant as any).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{getTenantDisplayName(tenant as any)}</p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {tenant.phone || 'No phone'} • {property?.name || 'No property'} • {unit?.unit_number || 'No unit'} • {tenant.is_active ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
              {tenantOptions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                  No tenants match your filters.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className={`${panelCls} space-y-5 hidden`}>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">Switch Tenant</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                value={tenantId || ''}
                onChange={(event) => openTenant(event.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-[#ff6a00]/40 focus:bg-white focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-[#082131] dark:text-white"
              >
                <option value="">Choose tenant profile</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>{getTenantDisplayName(tenant as any)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300">View</label>
            <div className="flex flex-wrap gap-2">
            {(['overview', 'leases', 'arrears', 'statement', 'moveout'] as TabKey[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`${pillBase} ${
                  activeTab === tab
                    ? 'bg-[#ff6a00] text-white'
                    : 'border border-gray-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {tenants.map((tenant) => (
            <button
              key={tenant.id}
              type="button"
              onClick={() => openTenant(tenant.id)}
              className={`min-w-[180px] rounded-2xl border px-3 py-3 text-left transition ${
                tenant.id === tenantId
                  ? 'border-[#ff6a00]/30 bg-[#fff3eb] dark:border-[#ff6a00]/30 dark:bg-[#ff6a00]/10'
                  : 'border-gray-200 bg-white hover:border-[#ff6a00]/20 dark:border-white/10 dark:bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {(tenant as any).profile_image_url ? (
                  <img src={(tenant as any).profile_image_url} alt={getTenantDisplayName(tenant as any)} className="h-7 w-7 rounded-full object-cover border border-gray-200 dark:border-white/10 shrink-0" />
                ) : (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ff6a00]/10 text-[#ff6a00] font-black text-xs">
                    {getTenantDisplayName(tenant as any).charAt(0).toUpperCase()}
                  </div>
                )}
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{getTenantDisplayName(tenant as any)}</p>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{tenant.phone || 'No phone'} • {tenant.is_active ? 'Active' : 'Inactive'}</p>
            </button>
          ))}
        </div>
      </div>

      {!selectedTenant ? (
        <div className="rounded-[28px] border border-dashed border-gray-300 bg-white p-10 text-center dark:border-white/10 dark:bg-dark-surface/90">
          <p className="text-sm text-slate-500 dark:text-slate-400">Pick a tenant to open their profile, lease, arrears, and statement timeline.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className={`${panelCls} relative overflow-hidden`}>
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-500 to-orange-400" />
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Current Balance</p>
              <p className={`mt-3 text-3xl font-black ${balanceTone}`}>{currency(currentBalance)}</p>
            </div>
            <div className={panelCls}>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Invoices</p>
              <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{invoices.length}</p>
            </div>
            <div className={panelCls}>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Payments</p>
              <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{payments.length}</p>
            </div>
            <div className={panelCls}>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Arrears</p>
              <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{arrears.length}</p>
            </div>
          </div>

          {activeTab === 'overview' ? (
            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className={`${panelCls} relative overflow-hidden`}>
                <div className="absolute right-0 top-0 h-28 w-28 translate-x-10 -translate-y-10 rounded-full bg-[#ff6a00]/10 blur-2xl" />
                <div className="relative mb-4 flex items-center gap-3">
                  {selectedTenant.profile_image_url ? (
                    <img
                      src={selectedTenant.profile_image_url}
                      alt={getTenantDisplayName(selectedTenant as any)}
                      className="h-12 w-12 rounded-2xl object-cover border border-gray-200 dark:border-white/10 shrink-0"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#ff6a00]/10 text-[#ff6a00] dark:bg-[#ff6a00]/12 dark:text-[#ffb37a] font-black text-xl">
                      {getTenantDisplayName(selectedTenant as any).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Tenant</p>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">{getTenantDisplayName(selectedTenant as any)}</h2>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Info label="Phone" value={selectedTenant.phone || '-'} />
                  <Info label="Email" value={selectedTenant.email || '-'} />
                  <Info label="National ID" value={selectedTenant.national_id || '-'} />
                  <Info label="Status" value={selectedTenant.is_active ? 'Active' : 'Inactive'} />
                  <Info label="Lease Type" value={selectedLease?.lease_type || selectedUnit?.lease_type || 'N/A'} />
                  <Info label="Credit Balance" value={hasCredit ? currency(creditBalance) : 'None'} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <MiniStat icon={Phone} label="Phone" value={selectedTenant.phone || 'No phone'} />
                  <MiniStat icon={Mail} label="Email" value={selectedTenant.email || 'No email'} />
                  <MiniStat icon={Clock3} label="Lease ends" value={selectedTenant.lease_end_date || 'Open-ended'} />
                </div>
              </div>

              <div className={`${panelCls} relative overflow-hidden`}>
                <div className="absolute left-0 top-0 h-28 w-28 -translate-x-10 -translate-y-10 rounded-full bg-emerald-500/10 blur-2xl" />
                <div className="relative mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                    <Home size={20} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Lease Context</p>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">Current placement</h2>
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  <Info label="Property" value={selectedProperty?.name || 'N/A'} />
                  <Info label="Unit" value={selectedUnit?.unit_number || 'N/A'} />
                  <Info label="Lease" value={selectedLease?.lease_number || 'No lease found'} />
                  <Info label="Lease Period" value={`${selectedTenant.lease_start_date || 'N/A'} to ${selectedTenant.lease_end_date || 'Open-ended'}`} />
                  <Info label="Monthly Rent" value={selectedLease?.rent_amount != null ? currency(Number(selectedLease.rent_amount)) : 'N/A'} />
                  <Info label="Deposit" value={selectedLease ? currency(currentLeaseDeposit.total) : 'N/A'} />
                  <Info label="Deposit To" value={selectedLease?.deposit_paid_to || 'landlord'} />
                  <Info label="Lease Status" value={selectedLease?.status || 'N/A'} />
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'leases' ? (
            <div className={panelCls}>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
                  <CreditCard size={20} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Leases</p>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">Tenant lease history</h2>
                </div>
              </div>
              <div className="space-y-3">
                {tenantLeases.map((lease) => (
                  <div key={lease.id} className="rounded-[24px] border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{lease.lease_number || lease.id}</p>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#ff6a00]">{lease.lease_type || 'residential'} lease</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{lease.start_date || '-'} to {lease.end_date || 'Open-ended'}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 dark:bg-slate-800 dark:text-slate-200">{lease.status || 'unknown'}</span>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-4 text-sm text-slate-700 dark:text-slate-200">
                      <Info label="Unit" value={units.find((unit) => unit.id === lease.unit_id)?.unit_number || 'N/A'} />
                      <Info label="Rent" value={lease.rent_amount != null ? currency(Number(lease.rent_amount)) : 'N/A'} />
                      <Info label="Deposit" value={lease.deposit_amount != null ? currency(Number(lease.deposit_amount)) : 'N/A'} />
                      <Info label="Payment Day" value={lease.payment_day ? `Day ${lease.payment_day}` : 'N/A'} />
                    </div>
                  </div>
                ))}
                {tenantLeases.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                    No lease records found for this tenant.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeTab === 'arrears' ? (
            <div className={panelCls}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Arrears</p>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">Outstanding rent invoices</h2>
                </div>
                </div>
                <button type="button" onClick={() => void syncPayments()} disabled={syncing} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-slate-600 transition hover:border-[#ff6a00]/40 hover:text-[#ff6a00] disabled:opacity-50 dark:border-white/10 dark:text-slate-200">
                  <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Refreshing...' : 'Refresh payments'}
                </button>
              </div>
              <div className="space-y-3">
                {arrears.map((invoice) => (
                  <div key={invoice.id} className="rounded-[24px] border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{invoice.invoice_number || invoice.id}</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Due {invoice.due_date || 'N/A'} • Status {invoice.status || 'unpaid'}</p>
                      </div>
                      <p className="text-lg font-black text-rose-600 dark:text-rose-300">{currency(invoice.balance)}</p>
                    </div>
                  </div>
                ))}
                {arrears.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                    No arrears found for the selected tenant.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeTab === 'moveout' ? (
            <div className={panelCls}>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600"><LogOut size={20} /></div>
                <div><p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Move-out</p><h2 className="text-xl font-black text-slate-900 dark:text-white">Notice and deposit settlement</h2></div>
              </div>
              {!moveOutRequest ? (
                <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-10 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">No move-out request has been submitted for this tenant.</div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                    <div><p className="font-black text-amber-800 dark:text-amber-200">Request status: {moveOutRequest.status}</p><p className="mt-1 text-sm text-amber-700 dark:text-amber-300">Submitted {formatDateTime(moveOutRequest.requested_at)}</p></div>
                    <CalendarDays size={22} className="text-amber-600" />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <Info label="Requested date" value={moveOutRequest.requested_move_out_date} />
                    <Info label="Eligible date" value={moveOutRequest.eligible_move_out_date} />
                    <Info label="Arrears at request" value={currency(toNumber(moveOutRequest.arrears))} />
                    <Info label="Estimated refundable" value={currency(toNumber(moveOutRequest.refundable_deposit))} />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Info label="Deposit held" value={currency(toNumber(moveOutRequest.deposit_held))} />
                    <Info label="Tenant reason" value={moveOutRequest.reason || 'Not provided'} />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Settlement notes</p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{moveOutRequest.settlement_notes || 'No settlement notes recorded.'}</p>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Refund remains subject to inspection and confirmation of the final invoice/arrears settlement.</p>
                </div>
              )}
            </div>
          ) : null}

          {activeTab === 'statement' ? (
            <div className={panelCls}>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ff6a00]/10 text-[#ff6a00] dark:bg-[#ff6a00]/12 dark:text-[#ffb37a]">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Statement</p>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">Rent statement timeline</h2>
                </div>
              </div>
              {hasCredit ? (
                <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                  Overpayment detected. The tenant has a credit of {currency(creditBalance)} that should offset future invoices automatically.
                </div>
              ) : null}
              <div className="w-full overflow-x-auto">
                <div className="inline-block min-w-full">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-white/[0.03]">
                      <tr className="text-left text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        <th className="px-3 md:px-4 py-3 whitespace-nowrap">Date</th>
                        <th className="px-3 md:px-4 py-3 whitespace-nowrap">Type</th>
                        <th className="px-3 md:px-4 py-3 whitespace-nowrap">Reference</th>
                        <th className="px-3 md:px-4 py-3 whitespace-nowrap hidden md:table-cell">Description</th>
                        <th className="px-3 md:px-4 py-3 whitespace-nowrap text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                      {[
                        ...(selectedLease ? [{
                          id: `${selectedLease.id}-lease`,
                          date: selectedLease.start_date || selectedTenant.lease_start_date || new Date().toISOString().slice(0, 10),
                          type: 'deposit' as const,
                          reference: selectedLease.lease_number || selectedLease.id,
                          amount: currentLeaseDeposit.total,
                          description: [
                            `Lease deposit for ${selectedProperty?.name || 'current lease'}`,
                            currentLeaseDeposit.water > 0 ? `Water ${currency(currentLeaseDeposit.water)}` : null,
                            currentLeaseDeposit.electricity > 0 ? `Electricity ${currency(currentLeaseDeposit.electricity)}` : null,
                            selectedLease.deposit_paid_to ? `Paid to ${selectedLease.deposit_paid_to}` : null,
                          ].filter(Boolean).join(' · '),
                        }] : []),
                        ...invoiceRows.map((invoice) => ({
                          id: invoice.id,
                          date: invoice.invoice_date,
                          type: 'invoice' as const,
                          reference: invoice.invoice_number || invoice.id,
                          amount: toNumber(invoice.amount_due),
                          description: invoice.notes || `Invoice ${invoice.invoice_number || invoice.id}`,
                        })),
                        ...paymentRows.map((payment) => ({
                          id: payment.id,
                          date: payment.payment_date,
                          type: 'payment' as const,
                          reference: payment.reference_number || payment.id,
                          amount: toNumber(payment.amount) * -1,
                          description: payment.description,
                        })),
                      ]
                        .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
                        .map((row) => (
                          <tr key={`${row.type}-${row.id}`} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                            <td className="px-3 md:px-4 py-3 text-slate-600 dark:text-slate-300 text-xs md:text-sm">{row.date}</td>
                            <td className="px-3 md:px-4 py-3 capitalize text-xs md:text-sm font-medium">{row.type}</td>
                            <td className="px-3 md:px-4 py-3 font-semibold text-xs md:text-sm">{row.reference}</td>
                            <td className="px-3 md:px-4 py-3 text-slate-600 dark:text-slate-300 text-xs md:text-sm hidden md:table-cell truncate">{row.description || '-'}</td>
                            <td className={`px-3 md:px-4 py-3 font-bold text-xs md:text-sm text-right ${row.type === 'invoice' ? 'text-rose-600' : row.type === 'deposit' ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {currency(Math.abs(row.amount))}
                            </td>
                          </tr>
                        ))}
                      {invoices.length === 0 && payments.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                            No statement activity found for this tenant.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-6">
            <div className={`${panelCls} overflow-hidden`}>
              <div className="px-5 pb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600">
                  <ArrowUpRight size={20} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Invoices</p>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">Invoice history</h2>
                </div>
              </div>
              <style>{`
                .invoice-scroll {
                  scroll-behavior: smooth;
                }
                .invoice-scroll::-webkit-scrollbar {
                  height: 8px;
                }
                .invoice-scroll::-webkit-scrollbar-track {
                  background: #f1f5f9;
                }
                .invoice-scroll::-webkit-scrollbar-thumb {
                  background: #cbd5e1;
                  border-radius: 4px;
                }
                .invoice-scroll::-webkit-scrollbar-thumb:hover {
                  background: #94a3b8;
                }
                .dark .invoice-scroll::-webkit-scrollbar-track {
                  background: #1e293b;
                }
                .dark .invoice-scroll::-webkit-scrollbar-thumb {
                  background: #475569;
                }
                .dark .invoice-scroll::-webkit-scrollbar-thumb:hover {
                  background: #64748b;
                }
              `}</style>
              <div className="overflow-x-auto invoice-scroll">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-white/[0.03]">
                    <tr className="text-left text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      <th className="px-5 py-3 whitespace-nowrap">Invoice</th>
                      <th className="px-5 py-3 whitespace-nowrap hidden sm:table-cell">Created</th>
                      <th className="px-5 py-3 whitespace-nowrap hidden md:table-cell">Invoice Date</th>
                      <th className="px-5 py-3 whitespace-nowrap">Due</th>
                      <th className="px-5 py-3 whitespace-nowrap">Amount Due</th>
                      <th className="px-5 py-3 whitespace-nowrap hidden md:table-cell">Deposit</th>
                      <th className="px-5 py-3 whitespace-nowrap">Paid</th>
                      <th className="px-5 py-3 whitespace-nowrap hidden lg:table-cell">Receipt</th>
                      <th className="px-5 py-3 whitespace-nowrap">Balance</th>
                      <th className="px-5 py-3 whitespace-nowrap">Status</th>
                      <th className="px-5 py-3 whitespace-nowrap hidden xl:table-cell">Link</th>
                      <th className="px-5 py-3 whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                    {invoiceRows.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3 font-semibold text-slate-900 dark:text-white text-xs md:text-sm">{invoice.invoice_number || invoice.id}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300 text-xs hidden sm:table-cell">
                          {formatDateTime(invoice.created_at)}
                        </td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300 text-xs md:text-sm hidden md:table-cell">{invoice.invoice_date}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300 text-xs md:text-sm">{invoice.due_date || '-'}</td>
                        <td className="px-5 py-3 font-semibold text-rose-600 text-xs md:text-sm">{currency(toNumber(invoice.amount_due))}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300 text-xs md:text-sm hidden md:table-cell">
                          {toNumber(invoice.deposit_amount) > 0 ? `${currency(toNumber(invoice.deposit_paid))} / ${currency(toNumber(invoice.deposit_amount))}` : 'N/A'}
                        </td>
                        <td className="px-5 py-3 font-semibold text-emerald-600 text-xs md:text-sm">{currency(toNumber(invoice.amount_paid))}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300 text-xs font-mono hidden lg:table-cell">{invoice.mpesa_receipt_no || '-'}</td>
                        <td className="px-5 py-3 font-bold text-slate-900 dark:text-white text-xs md:text-sm">
                          {invoice.balance > 0 ? currency(invoice.balance) : invoice.overpaid > 0 ? `Credit ${currency(invoice.overpaid)}` : 'Settled'}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2 md:px-3 py-1 text-[9px] md:text-[10px] font-black uppercase tracking-[0.18em] whitespace-nowrap ${
                            invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                            invoice.status === 'partial' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                            invoice.status === 'overdue' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                            'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                          }`}>
                            {invoice.status || 'unknown'}
                          </span>
                        </td>
                        <td className="px-5 py-3 hidden xl:table-cell">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white whitespace-nowrap ${
                              invoice.payment_match_source === 'exact'
                                ? 'bg-emerald-600'
                                : invoice.payment_match_source === 'phone'
                                  ? 'bg-sky-600'
                                  : invoice.payment_match_source === 'amount'
                                    ? 'bg-amber-600'
                                    : 'bg-gray-500'
                            }`}
                          >
                            {invoice.payment_match_source === 'unmatched' ? 'No match' : `${invoice.payment_match_source}`}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void sendInvoiceStk(invoice as any)}
                              disabled={stkBusyInvoiceId === invoice.id || invoice.balance <= 0}
                              className="rounded-lg bg-emerald-600 px-2 md:px-3 py-1.5 md:py-2 text-[10px] md:text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                            >
                              {stkBusyInvoiceId === invoice.id ? 'Sending...' : 'STK'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteInvoice(invoice as any)}
                              title="Delete invoice"
                              className="rounded-lg bg-red-600 px-2 md:px-3 py-1.5 md:py-2 text-[10px] md:text-xs font-bold text-white hover:bg-red-700 transition-colors whitespace-nowrap inline-flex items-center gap-1"
                            >
                              <Trash2 size={14} />
                              <span className="hidden sm:inline">Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {invoiceRows.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                          No invoices found for this tenant.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={`${panelCls} overflow-hidden`}>
              <div className="px-5 pb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                    <ArrowDownRight size={20} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Payments</p>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">Payment history</h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void syncPayments()}
                  disabled={syncing}
                  className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50 transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? 'Syncing...' : 'Sync Payments'}
                </button>
              </div>
              <style>{`
                .payment-scroll {
                  scroll-behavior: smooth;
                }
                .payment-scroll::-webkit-scrollbar {
                  height: 8px;
                }
                .payment-scroll::-webkit-scrollbar-track {
                  background: #f1f5f9;
                }
                .payment-scroll::-webkit-scrollbar-thumb {
                  background: #cbd5e1;
                  border-radius: 4px;
                }
                .payment-scroll::-webkit-scrollbar-thumb:hover {
                  background: #94a3b8;
                }
                .dark .payment-scroll::-webkit-scrollbar-track {
                  background: #1e293b;
                }
                .dark .payment-scroll::-webkit-scrollbar-thumb {
                  background: #475569;
                }
                .dark .payment-scroll::-webkit-scrollbar-thumb:hover {
                  background: #64748b;
                }
              `}</style>
              <div className="overflow-x-auto payment-scroll">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-white/[0.03]">
                    <tr className="text-left text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      <th className="px-5 py-3 whitespace-nowrap">Payment Date</th>
                      <th className="px-5 py-3 whitespace-nowrap hidden sm:table-cell">Created</th>
                      <th className="px-5 py-3 whitespace-nowrap">Reference</th>
                      <th className="px-5 py-3 whitespace-nowrap hidden md:table-cell">Method</th>
                      <th className="px-5 py-3 whitespace-nowrap">Amount</th>
                      <th className="px-5 py-3 whitespace-nowrap hidden lg:table-cell">Invoice</th>
                      <th className="px-5 py-3 whitespace-nowrap hidden xl:table-cell">Description</th>
                      <th className="px-5 py-3 whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                    {paymentRows.map((payment) => (
                      <tr key={payment.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300 font-medium text-xs md:text-sm">{formatDateTime(payment.payment_date)}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300 text-xs hidden sm:table-cell">
                          {formatDateTime(payment.created_at)}
                        </td>
                        <td className="px-5 py-3 font-semibold text-slate-900 dark:text-white font-mono text-xs">{payment.reference_number || payment.id}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300 capitalize text-xs md:text-sm hidden md:table-cell">{payment.payment_method || '-'}</td>
                        <td className="px-5 py-3 font-bold text-emerald-600 text-sm md:text-base">{currency(toNumber(payment.amount))}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300 font-mono text-xs hidden lg:table-cell">{payment.invoice_id || '-'}</td>
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300 max-w-xs truncate text-xs hidden xl:table-cell">{payment.description}</td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2 md:px-3 py-1 text-[9px] md:text-[10px] font-black uppercase tracking-[0.18em] whitespace-nowrap ${
                            payment.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                            payment.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                            payment.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                            'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                          }`}>
                            {payment.status || 'completed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {paymentRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                          No payments found for this tenant.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {toast ? <CustomToast message={toast.message} type={toast.type} isVisible={true} onClose={() => setToast(null)} /> : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-white/[0.03]">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/5 text-[#ff6a00] dark:bg-white/10 dark:text-[#ffb37a]">
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</p>
      </div>
    </div>
  );
}
