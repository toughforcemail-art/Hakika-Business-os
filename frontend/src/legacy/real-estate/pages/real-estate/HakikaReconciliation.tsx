// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRightLeft, RefreshCw, BookOpen, Wallet, Layers3, Search, Send } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import { useLocation, useNavigate } from 'react-router-dom';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { callDaraja } from '../../services/darajaService';
import { calculateHakikaSplit } from '../../utils/hakikaLedger';
const getEnv = (key: string) => (import.meta as any)?.env?.[key] || '';

const B2C_ENV_KEYS = [
  'VITE_MPESA_B2C_INITIATOR_NAME',
  'VITE_MPESA_B2C_INITIATOR',
  'VITE_MPESA_B2C_SECURITY_CREDENTIAL',
  'VITE_MPESA_B2C_SHORT_CODE',
  'VITE_MPESA_BUSINESS_SHORT_CODE',
  'VITE_MPESA_B2C_QUEUE_TIMEOUT_URL',
  'VITE_MPESA_B2C_RESULT_URL',
  'VITE_MPESA_CALLBACK_URL',
];

const B2C_FIELD_LABELS: Record<string, string> = {
  initiatorName: 'B2C initiator name',
  securityCredential: 'B2C security credential',
  shortCode: 'B2C short code',
  queueTimeOutURL: 'B2C queue timeout URL',
  resultURL: 'B2C result URL',
};

const getB2CSettings = () => {
  const settings = {
    initiatorName: getEnv('VITE_MPESA_B2C_INITIATOR_NAME') || getEnv('VITE_MPESA_B2C_INITIATOR') || '',
    securityCredential: getEnv('VITE_MPESA_B2C_SECURITY_CREDENTIAL') || '',
    shortCode: getEnv('VITE_MPESA_B2C_SHORT_CODE') || getEnv('VITE_MPESA_BUSINESS_SHORT_CODE') || '',
    queueTimeOutURL: getEnv('VITE_MPESA_B2C_QUEUE_TIMEOUT_URL') || getEnv('VITE_MPESA_CALLBACK_URL') || '',
    resultURL: getEnv('VITE_MPESA_B2C_RESULT_URL') || getEnv('VITE_MPESA_CALLBACK_URL') || '',
  };
  const missing = (Object.entries(settings) as Array<[keyof typeof settings, string]>)
    .filter(([, value]) => !String(value).trim())
    .map(([key]) => B2C_FIELD_LABELS[key] || key);
  return { settings, missing };
};

type MpesaTransaction = {
  id: string;
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
};

type LedgerRow = {
  id: string;
  transaction_date: string;
  transaction_type: string;
  category: string;
  amount: number;
  description: string | null;
  reference_id: string | null;
  payment_method: string | null;
  notes: string | null;
};

type InvoiceRow = {
  id: string;
  tenant_id: string | null;
  invoice_number: string | null;
  status: string | null;
  reconciliation_status: string | null;
  amount_due: number | null;
  amount_paid: number | null;
  service_fee_mode?: string | null;
  service_fee_value?: number | null;
  service_fee_amount?: number | null;
  landlord_payable_amount?: number | null;
  mpesa_receipt_no: string | null;
  mpesa_checkout_request_id: string | null;
  mpesa_originator_conversation_id: string | null;
  mpesa_conversation_id: string | null;
  tenant?: { id: string; full_name: string | null; phone: string | null } | null;
};

type TenantRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

export default function HakikaReconciliation() {
  const { profile } = useAccess();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [mpesaRows, setMpesaRows] = useState<MpesaTransaction[]>([]);
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [tenantsById, setTenantsById] = useState<Record<string, TenantRow>>({});
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [stkBusy, setStkBusy] = useState(false);
  const [stkAmount, setStkAmount] = useState<string>('');
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [landlordPhone, setLandlordPhone] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const fetchData = async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const [txnRes, ledgerRes, invoiceRes] = await Promise.all([
        supabase
          .from('mpesa_transactions')
          .select('*')
          .order('completion_time', { ascending: false })
          .limit(100),
        supabase
          .from('re_finance_ledger')
          .select('*')
          .eq('company_id', profile.company_id)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('re_invoices')
          .select('id, tenant_id, invoice_number, status, reconciliation_status, amount_due, amount_paid, service_fee_mode, service_fee_value, service_fee_amount, landlord_payable_amount, mpesa_receipt_no, mpesa_checkout_request_id, mpesa_originator_conversation_id, mpesa_conversation_id, tenant:re_tenants(id, full_name, phone)')
          .eq('company_id', profile.company_id)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      const tenantRes = await supabase
        .from('re_tenants')
        .select('id, full_name, phone')
        .eq('company_id', profile.company_id);

      if (txnRes.error) throw txnRes.error;
      if (ledgerRes.error) throw ledgerRes.error;
      if (invoiceRes.error) throw invoiceRes.error;
      if (tenantRes.error) throw tenantRes.error;

      setMpesaRows((txnRes.data || []) as MpesaTransaction[]);
      setLedgerRows((ledgerRes.data || []) as LedgerRow[]);
      const tenantMap = Object.fromEntries((tenantRes.data || []).map((tenant: TenantRow) => [tenant.id, tenant]));
      setTenantsById(tenantMap);
      const invoiceRows = (invoiceRes.data || []).map((invoice: InvoiceRow) => ({
        ...invoice,
        tenant: invoice.tenant_id ? tenantMap[invoice.tenant_id] || null : null,
        service_fee_amount: Number(invoice.service_fee_amount || Math.max(0, Number(invoice.amount_due || 0) - Number(invoice.landlord_payable_amount || 0))),
        landlord_payable_amount: Number(invoice.landlord_payable_amount || Math.max(0, Number(invoice.amount_due || 0) - Number(invoice.service_fee_amount || 0))),
      }));
      setInvoices(invoiceRows as InvoiceRow[]);
      if (!selectedInvoiceId && invoiceRows.length > 0) {
        setSelectedInvoiceId(invoiceRows[0].id);
      }
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to load reconciliation dashboard', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile?.company_id]);

  useEffect(() => {
    const incoming = location.state as { invoiceId?: string; invoiceNumber?: string } | null;
    if (incoming?.invoiceId) setSelectedInvoiceId(incoming.invoiceId);
  }, [location.state]);

  const selectedInvoice = useMemo(() => invoices.find((invoice) => invoice.id === selectedInvoiceId) || null, [invoices, selectedInvoiceId]);
  const selectedTenant = selectedInvoice?.tenant || (selectedInvoice?.tenant_id ? tenantsById[selectedInvoice.tenant_id] || null : null);
  const selectedTenantPhone = (selectedTenant?.phone || '').trim() || '';
  const selectedSplit = useMemo(() => {
    if (!selectedInvoice) return calculateHakikaSplit({ amount: 0, rate: 10, mode: 'percent' });
    const mode = (selectedInvoice.service_fee_mode || 'percent') as 'percent' | 'flat';
    const rate = Number(selectedInvoice.service_fee_value ?? 10) || 0;
    return calculateHakikaSplit({ amount: Number(selectedInvoice.amount_due || 0), rate, mode });
  }, [selectedInvoice]);
  const selectedCallbacks = useMemo(() => {
    if (!selectedInvoice) return [] as MpesaTransaction[];
    return mpesaRows.filter((row) => {
      const haystack = [
        row.receipt_no,
        row.originator_conversation_id,
        row.conversation_id,
        row.checkout_request_id,
        row.phone_number,
        row.customer_name,
        row.transaction_status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const invoiceTokens = [
        selectedInvoice.invoice_number,
        selectedInvoice.mpesa_receipt_no,
        selectedInvoice.mpesa_checkout_request_id,
        selectedInvoice.mpesa_originator_conversation_id,
        selectedInvoice.mpesa_conversation_id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(invoiceTokens) || invoiceTokens.includes(haystack) || haystack.includes((selectedInvoice.invoice_number || '').toLowerCase());
    });
  }, [selectedInvoice, mpesaRows]);

  const selectedLedgerRows = useMemo(() => {
    if (!selectedInvoice) return [] as LedgerRow[];
    return ledgerRows.filter((row) => row.reference_id === selectedInvoice.mpesa_receipt_no || row.reference_id === selectedInvoice.invoice_number || row.notes?.includes(selectedInvoice.invoice_number || '') || row.description?.includes(selectedInvoice.invoice_number || ''));
  }, [ledgerRows, selectedInvoice]);

  useEffect(() => {
    if (!selectedInvoice) {
      setStkAmount('');
      return;
    }
    const balance = Math.max(0, Number(selectedInvoice.amount_due || 0) - Number(selectedInvoice.amount_paid || 0));
    setStkAmount(String(balance || 0));
  }, [selectedInvoiceId, selectedInvoice?.amount_due, selectedInvoice?.amount_paid]);

  const handleSendStk = async () => {
    if (!selectedInvoice || stkBusy) return;
    const phone = selectedTenantPhone;
    if (!phone) {
      setToast({ message: 'No phone number found for this tenant.', type: 'error' });
      return;
    }
    const amountToCharge = Math.max(0, Number(stkAmount || 0));
    if (!amountToCharge) {
      setToast({ message: 'Enter an STK amount greater than zero.', type: 'warning' });
      return;
    }

    setStkBusy(true);
    try {
      const response = await callDaraja({
        action: 'stk-push',
        amount: Math.round(amountToCharge),
        phoneNumber: phone,
        accountReference: selectedInvoice.invoice_number || 'HAKIKA',
        transactionDesc: `Hakika STK for ${selectedTenant?.full_name || 'tenant'}`,
        service_key: 'hakika',
        company_code: profile?.company_code || null,
      });

      setToast({ message: response?.response?.CustomerMessage || 'STK Push sent successfully.', type: 'success' });
      fetchData(); // Refresh to see if checkout_id is updated (though it won't be unless the backend updates it)
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to send STK push', type: 'error' });
    } finally {
      setStkBusy(false);
    }
  };

  const handleDisburseLandlord = async () => {
    if (!selectedInvoice || payoutBusy) return;
    if (!landlordPhone.trim()) {
      setToast({ message: 'Enter the landlord phone number before disbursing.', type: 'warning' });
      return;
    }
    const { settings, missing } = getB2CSettings();
    if (missing.length > 0) {
      setToast({
        message: `Missing B2C field${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Configure the secure admin settings page or frontend env.`,
        type: 'warning',
      });
      return;
    }
    const payable = Number(selectedInvoice.landlord_payable_amount ?? selectedSplit.landlordPayable ?? 0);
    if (payable <= 0) {
      setToast({ message: 'No landlord payable amount is available for this invoice.', type: 'warning' });
      return;
    }

    setPayoutBusy(true);
    try {
      const response = await callDaraja({
        action: 'b2c-payment-request',
        initiatorName: settings.initiatorName,
        securityCredential: settings.securityCredential,
        partyA: settings.shortCode,
        partyB: landlordPhone,
        amount: Math.round(payable),
        queueTimeOutURL: settings.queueTimeOutURL,
        resultURL: settings.resultURL,
        remarks: `Landlord payout for ${selectedInvoice.invoice_number || 'invoice'}`,
        occasion: 'Hakika landlord payout',
      } as any);

      await supabase.from('re_finance_ledger').insert([{
        company_id: profile?.company_id,
        transaction_type: 'expense',
        category: 'Landlord Payout',
        amount: payable,
        description: `Landlord payout requested for ${selectedInvoice.invoice_number || 'invoice'}`,
        reference_id: selectedInvoice.mpesa_receipt_no || selectedInvoice.invoice_number,
        payment_method: 'mpesa',
        source_module: 'REAL_ESTATE',
        transaction_date: new Date().toISOString().split('T')[0],
        transaction_time: new Date().toTimeString().slice(0, 8),
        currency: 'KES',
      }]);

      setToast({ message: response?.response?.ResponseDescription || `Landlord payout requested for KES ${payable.toLocaleString()}`, type: 'success' });
      fetchData();
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to request landlord payout', type: 'error' });
    } finally {
      setPayoutBusy(false);
    }
  };

  const selectedPayouts = useMemo(() => {
    return mpesaRows.filter((row) => Number(row.withdrawn || 0) > 0 && (!selectedInvoice || [
      row.receipt_no,
      row.originator_conversation_id,
      row.conversation_id,
      row.customer_name,
      row.phone_number,
    ].filter(Boolean).join(' ').toLowerCase().includes((selectedInvoice.invoice_number || '').toLowerCase())));
  }, [mpesaRows, selectedInvoice]);

  const summary = useMemo(() => {
    const completed = mpesaRows.filter((row) => /completed|processed successfully/i.test(row.transaction_status || '')).length;
    const payouts = mpesaRows.filter((row) => Number(row.withdrawn || 0) > 0).length;
    const pending = mpesaRows.filter((row) => !/completed|processed successfully/i.test(row.transaction_status || '')).length;
    const ledgerIncome = ledgerRows.filter((row) => row.transaction_type === 'income').reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const ledgerExpense = ledgerRows.filter((row) => row.transaction_type === 'expense').reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return { completed, payouts, pending, ledgerIncome, ledgerExpense };
  }, [mpesaRows, ledgerRows]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Activity className="text-brand-purple" size={32} />
              Hakika M-Pesa Reconciliation
            </h1>
            <p className="text-gray-500 dark:text-gray-400">Raw callback events, journal writes, and payout status in one place.</p>
          </div>
          <button onClick={fetchData} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-purple text-white font-semibold">
            <RefreshCw size={16} />
            Refresh
          </button>
          <button onClick={() => navigate('/app/real-estate/reports/tenant-ledger')} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-dark-surface text-gray-700 dark:text-white font-semibold">
            <BookOpen size={16} />
            Tenant Ledger
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatCard icon={<ArrowRightLeft size={18} />} label="Callbacks" value={mpesaRows.length} />
          <StatCard icon={<BookOpen size={18} />} label="Ledger rows" value={ledgerRows.length} />
          <StatCard icon={<Wallet size={18} />} label="Payouts" value={summary.payouts} />
          <StatCard icon={<Layers3 size={18} />} label="Pending" value={summary.pending} />
        </div>

        <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-white/10 p-5">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Invoice Drill-down</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pick an invoice to see the payment trail end to end.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter invoices..."
                  className="pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-gray-900 dark:text-white outline-none"
                />
              </div>
              <select
                value={selectedInvoiceId}
                onChange={(e) => setSelectedInvoiceId(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-gray-900 dark:text-white outline-none"
              >
                {invoices.filter((invoice) => {
                  const query = searchTerm.toLowerCase().trim();
                  if (!query) return true;
                  return [invoice.invoice_number, invoice.status, invoice.reconciliation_status].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
                }).map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number || invoice.id}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {selectedInvoice ? (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <DetailPanel title="Invoice" rows={[
                ['Invoice #', selectedInvoice.invoice_number || '-'],
                ['Status', selectedInvoice.status || '-'],
                ['Reconciliation', selectedInvoice.reconciliation_status || 'pending'],
                ['Amount due', `KES ${Number(selectedInvoice.amount_due || 0).toLocaleString()}`],
                ['Amount paid', `KES ${Number(selectedInvoice.amount_paid || 0).toLocaleString()}`],
                ['STK amount', `KES ${Number(stkAmount || 0).toLocaleString()}`],
                ['Service fee', `KES ${Number(selectedInvoice.service_fee_amount || selectedSplit.companyRevenue || 0).toLocaleString()}`],
                ['Landlord payable', `KES ${Number(selectedInvoice.landlord_payable_amount || selectedSplit.landlordPayable || 0).toLocaleString()}`],
                ['Tenant', selectedTenant?.full_name || '-'],
                ['Phone', selectedTenantPhone || '-'],
              ]} >
                <div className="mt-4">
                  <label className="block mb-3">
                    <span className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">STK amount to charge</span>
                    <input
                      type="number"
                      min="1"
                      value={stkAmount}
                      onChange={(e) => setStkAmount(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-gray-900 dark:text-white outline-none"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Default is the remaining invoice balance, but you can change it before sending.</p>
                  </label>
                   <button
                     disabled={stkBusy || !selectedTenantPhone || Number(stkAmount || 0) <= 0}
                     onClick={handleSendStk}
                     className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-lg shadow-emerald-600/20"
                   >
                     <Send size={18} />
                     {stkBusy ? 'Sending Push...' : `Send STK Push Now (KES ${Number(stkAmount || 0).toLocaleString()})`}
                   </button>
                   {!selectedTenantPhone && (
                     <p className="text-[10px] text-red-500 mt-1 text-center font-medium">Tenant missing phone number</p>
                   )}
                </div>
                <div className="mt-4 rounded-2xl border border-dashed border-gray-200 dark:border-white/10 bg-white/70 dark:bg-black/10 p-4 space-y-3">
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400">Landlord payout</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-gray-50 dark:bg-black/20 p-3">
                      <p className="text-xs uppercase text-gray-400 font-bold">Payable amount</p>
                      <p className="font-bold text-gray-900 dark:text-white">Ksh {Number(selectedInvoice.landlord_payable_amount || selectedSplit.landlordPayable || 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 dark:bg-black/20 p-3">
                      <p className="text-xs uppercase text-gray-400 font-bold">Service fee</p>
                      <p className="font-bold text-gray-900 dark:text-white">Ksh {Number(selectedInvoice.service_fee_amount || selectedSplit.companyRevenue || 0).toLocaleString()}</p>
                    </div>
                  </div>
                  <label className="block">
                    <span className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Landlord phone number</span>
                    <input
                      value={landlordPhone}
                      onChange={(e) => setLandlordPhone(e.target.value)}
                      placeholder="2547XXXXXXXX"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 text-gray-900 dark:text-white outline-none"
                    />
                  </label>
                  <button
                    onClick={handleDisburseLandlord}
                    disabled={payoutBusy}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors disabled:opacity-50"
                  >
                    {payoutBusy ? 'Requesting payout...' : 'Disburse landlord payable'}
                  </button>
                </div>
              </DetailPanel>
              <DetailPanel title="Callbacks" rows={selectedCallbacks.slice(0, 6).map((row) => [row.callback_type || row.mpesa_source || '-', row.receipt_no || row.originator_conversation_id || row.id])} />
              <DetailPanel title="Payouts" rows={selectedPayouts.slice(0, 6).map((row) => [row.transaction_status || '-', `KES ${Number(row.withdrawn || 0).toLocaleString()}`])} />
            </div>
          ) : (
            <p className="text-sm text-gray-500">No invoices available for drill-down.</p>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Panel title="Raw Callbacks" subtitle="Latest STK, C2B, B2C, status, and balance payloads" count={mpesaRows.length}>
            {loading ? (
              <CustomLoader size={28} label="Loading callbacks..." />
            ) : (
              <div className="space-y-3">
                {mpesaRows.map((row) => (
                  <div key={row.id} className="rounded-xl border border-gray-200 dark:border-white/10 p-4 bg-gray-50 dark:bg-black/20">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{row.receipt_no || row.originator_conversation_id || row.conversation_id || row.id}</p>
                        <p className="text-xs text-gray-500">{row.callback_type || row.mpesa_source || 'callback'}</p>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white dark:bg-white/10 text-gray-700 dark:text-gray-200">
                        {row.transaction_status || 'unknown'}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300">
                      <p>Phone: {row.phone_number || '-'}</p>
                      <p>Paid in: KES {Number(row.paid_in || 0).toLocaleString()}</p>
                      <p>Withdrawn: KES {Number(row.withdrawn || 0).toLocaleString()}</p>
                      <p>Date: {row.completion_time ? new Date(row.completion_time).toLocaleString() : '-'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Ledger Splits" subtitle="Income and expense journals generated from callbacks" count={ledgerRows.length}>
            {loading ? (
              <CustomLoader size={28} label="Loading ledger..." />
            ) : (
              <div className="space-y-3">
                {ledgerRows.map((row) => (
                  <div key={row.id} className="rounded-xl border border-gray-200 dark:border-white/10 p-4 bg-gray-50 dark:bg-black/20">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{row.category}</p>
                        <p className="text-xs text-gray-500">{row.transaction_type} · {row.payment_method || 'n/a'}</p>
                      </div>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        KES {Number(row.amount || 0).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{row.description || row.notes || '-'}</p>
                    <p className="mt-2 text-xs text-gray-500 font-mono">{row.reference_id || '-'}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Payout Status" subtitle="Quick view of landlord disbursement activity" count={summary.payouts}>
            {loading ? (
              <CustomLoader size={28} label="Loading payout status..." />
            ) : (
              <div className="space-y-3">
                {mpesaRows.filter((row) => Number(row.withdrawn || 0) > 0).map((row) => (
                  <div key={row.id} className="rounded-xl border border-gray-200 dark:border-white/10 p-4 bg-gray-50 dark:bg-black/20">
                    <p className="font-semibold text-gray-900 dark:text-white">{row.customer_name || row.phone_number || 'Landlord payout'}</p>
                    <p className="text-xs text-gray-500">{row.receipt_no || row.originator_conversation_id || '-'}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-300">{row.transaction_status || 'Unknown'}</span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        KES {Number(row.withdrawn || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SummaryCard label="Ledger income" value={`KES ${summary.ledgerIncome.toLocaleString()}`} />
          <SummaryCard label="Ledger expense" value={`KES ${summary.ledgerExpense.toLocaleString()}`} />
        </div>
      </div>

      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-white/10 p-5 flex items-center gap-4">
      <div className="w-11 h-11 bg-brand-purple/10 text-brand-purple rounded-xl flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, count, children }: { title: string; subtitle: string; count: number; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-white/10 p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-purple/10 text-brand-purple">{count}</span>
      </div>
      {children}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-white/10 p-5">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
    </div>
  );
}

function DetailPanel({ title, rows, children }: { title: string; rows: [string, string][]; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 p-4 bg-gray-50 dark:bg-black/20">
      <h3 className="font-bold text-gray-900 dark:text-white mb-3">{title}</h3>
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">No records linked.</p>
        ) : rows.map(([label, value]) => (
          <div key={`${label}-${value}`} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-gray-500">{label}</span>
            <span className="text-gray-900 dark:text-white font-medium text-right">{value}</span>
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}
