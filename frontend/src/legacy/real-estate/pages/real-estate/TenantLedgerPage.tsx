// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, BookOpen, Calendar, Download, FileSpreadsheet, Home, Printer, Search, User } from 'lucide-react';
import { printWorkspacePage } from '../../utils/printHelpers';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import { getTenantDisplayName } from '../../utils/tenantDisplay';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { sanitizeError, ToastType } from '../../components/CustomToast';

type TenantRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

type InvoiceRow = {
  id: string;
  tenant_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  amount_due: number | null;
  amount_paid: number | null;
  status: string | null;
  reconciliation_status: string | null;
  unit_id?: string | null;
  tenant?: { id: string; full_name: string | null; phone: string | null } | null;
  unit?: { id: string; unit_number: string | null; property?: { name: string | null } | null } | null;
};

type FilterOption = {
  value: string;
  label: string;
};

type PaymentRow = {
  id: string;
  tenant_id: string | null;
  invoice_id: string | null;
  payment_date: string | null;
  amount: number | null;
  payment_method: string | null;
  reference_number: string | null;
  status: string | null;
  notes: string | null;
  created_at?: string | null;
};

type LedgerRow = {
  id: string;
  date: string;
  reference: string;
  type: 'invoice' | 'payment';
  toWho: string;
  amountPayable: number;
  amountPaid: number;
  balance: number;
};

const currency = (value: number) => `KES ${value.toLocaleString()}`;

const csvEscape = (value: string | number | null | undefined) => {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

export default function TenantLedgerPage() {
  const { profile } = useAccess();
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [selectedProperty, setSelectedProperty] = useState('all');
  const [selectedUnit, setSelectedUnit] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const fetchData = async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const [tenRes, invRes, payRes] = await Promise.all([
        supabase.from('re_tenants').select('id, full_name, phone').eq('company_id', profile.company_id).order('full_name'),
        supabase.from('re_invoices').select('id, tenant_id, invoice_number, invoice_date, amount_due, amount_paid, status, reconciliation_status, unit_id, tenant:re_tenants(id, full_name, phone), unit:re_units(id, unit_number, property:re_properties(name))').is('deleted_at', null).eq('company_id', profile.company_id).order('invoice_date', { ascending: true }),
        supabase.from('re_payments').select('id, tenant_id, invoice_id, payment_date, amount, payment_method, reference_number, status, notes, created_at').eq('company_id', profile.company_id).order('payment_date', { ascending: true }),
      ]);

      if (tenRes.error) throw tenRes.error;
      if (invRes.error) throw invRes.error;
      if (payRes.error) throw payRes.error;

      setTenants((tenRes.data || []) as TenantRow[]);
      setInvoices((invRes.data || []) as InvoiceRow[]);
      setPayments((payRes.data || []) as PaymentRow[]);
      if (!selectedTenantId && (tenRes.data || []).length > 0) {
        setSelectedTenantId((tenRes.data || [])[0].id);
      }
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [profile?.company_id]);

  const selectedTenant = tenants.find((tenant) => tenant.id === selectedTenantId) || null;
  const tenantInvoices = useMemo(() => invoices.filter((invoice) => invoice.tenant_id === selectedTenantId), [invoices, selectedTenantId]);
  const tenantPayments = useMemo(() => payments.filter((payment) => payment.tenant_id === selectedTenantId), [payments, selectedTenantId]);
  const invoiceById = useMemo(() => new Map(invoices.map((invoice) => [invoice.id, invoice])), [invoices]);
  const propertyOptions = useMemo<FilterOption[]>(() => {
    const seen = new Map<string, string>();
    tenantInvoices.forEach((invoice) => {
      const name = invoice.unit?.property?.name?.trim();
      if (!name) return;
      seen.set(name.toLowerCase(), name);
    });
    return [{ value: 'all', label: 'All properties' }, ...Array.from(seen.values()).sort().map((label) => ({ value: label, label }))];
  }, [tenantInvoices]);
  const unitOptions = useMemo<FilterOption[]>(() => {
    const seen = new Map<string, string>();
    tenantInvoices.forEach((invoice) => {
      const unitNumber = invoice.unit?.unit_number?.trim();
      if (!unitNumber) return;
      const propertyName = invoice.unit?.property?.name?.trim();
      const key = `${propertyName || 'Unknown'}::${unitNumber}`.toLowerCase();
      const label = propertyName ? `${propertyName} - Unit ${unitNumber}` : `Unit ${unitNumber}`;
      seen.set(key, label);
    });
    return [{ value: 'all', label: 'All units' }, ...Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1])).map(([, label]) => ({ value: label, label }))];
  }, [tenantInvoices]);
  const availableUnitLabels = useMemo(() => new Set(unitOptions.map((option) => option.label)), [unitOptions]);

  const ledgerRows = useMemo(() => {
    if (!selectedTenant) return [] as LedgerRow[];
    const tenantName = selectedTenant.full_name || 'Tenant';
    const rows: LedgerRow[] = [];

    tenantInvoices.forEach((invoice) => {
      const propertyName = invoice.unit?.property?.name?.trim() || '';
      const unitNumber = invoice.unit?.unit_number?.trim() || '';
      const propertyLabel = propertyName || 'Unknown property';
      const unitLabel = unitNumber ? `Unit ${unitNumber}` : 'Unknown unit';
      if (selectedProperty !== 'all' && propertyName !== selectedProperty) return;
      if (selectedUnit !== 'all' && `${propertyLabel} - ${unitLabel}` !== selectedUnit) return;
      const amountDue = Number(invoice.amount_due || 0);
      const amountPaid = Number(invoice.amount_paid || 0);
      rows.push({
        id: `invoice-${invoice.id}`,
        date: invoice.invoice_date || new Date().toISOString(),
        reference: invoice.invoice_number || invoice.id,
        type: 'invoice',
        toWho: `${propertyLabel}${unitNumber ? ` / ${unitLabel}` : ''}` || tenantName,
        amountPayable: amountDue,
        amountPaid: 0,
        balance: amountDue - amountPaid,
      });
    });

    tenantPayments.forEach((payment) => {
      const linkedInvoice = payment.invoice_id ? invoiceById.get(payment.invoice_id) || null : null;
      const propertyName = linkedInvoice?.unit?.property?.name?.trim() || '';
      const unitNumber = linkedInvoice?.unit?.unit_number?.trim() || '';
      const propertyLabel = propertyName || 'Unknown property';
      const unitLabel = unitNumber ? `Unit ${unitNumber}` : 'Unknown unit';
      if (selectedProperty !== 'all' && propertyName !== selectedProperty) return;
      if (selectedUnit !== 'all' && `${propertyLabel} - ${unitLabel}` !== selectedUnit) return;
      rows.push({
        id: `payment-${payment.id}`,
        date: payment.payment_date || payment.created_at || new Date().toISOString(),
        reference: payment.reference_number || linkedInvoice?.invoice_number || payment.id,
        type: 'payment',
        toWho: `${propertyLabel}${unitNumber ? ` / ${unitLabel}` : ''}` || tenantName,
        amountPayable: Number(linkedInvoice?.amount_due || payment.amount || 0),
        amountPaid: Number(payment.amount || 0),
        balance: 0,
      });
    });

    return rows
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((row, index, source) => {
        const running = source.slice(0, index + 1).reduce((sum, current) => {
          const debit = current.type === 'invoice' ? current.amountPayable : 0;
          const credit = current.type === 'payment' ? current.amountPaid : 0;
          return sum + debit - credit;
        }, 0);
        return { ...row, balance: running };
      });
  }, [selectedTenant, tenantInvoices, tenantPayments, invoiceById, selectedProperty, selectedUnit]);

  const openingBalance = useMemo(() => {
    if (!startDate) return 0;
    const cutoff = new Date(`${startDate}T00:00:00`);
    return ledgerRows
      .filter((row) => new Date(row.date) < cutoff)
      .reduce((sum, row) => sum + (row.type === 'invoice' ? row.amountPayable : -row.amountPaid), 0);
  }, [ledgerRows, startDate]);

  const filteredLedgerRows = useMemo(() => {
    return ledgerRows.filter((row) => {
      const date = new Date(row.date);
      return (!startDate || date >= new Date(`${startDate}T00:00:00`)) && (!endDate || date <= new Date(`${endDate}T23:59:59.999`));
    });
  }, [ledgerRows, startDate, endDate]);

  const runningLedger = useMemo(() => {
    let running = openingBalance;
    return filteredLedgerRows.map((row) => {
      running += row.type === 'invoice' ? row.amountPayable : -row.amountPaid;
      return { ...row, balance: running };
    });
  }, [filteredLedgerRows, openingBalance]);

  const totalPayable = tenantInvoices.reduce((sum, invoice) => sum + Number(invoice.amount_due || 0), 0);
  const totalPaid = tenantPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const currentBalance = totalPayable - totalPaid;
  const filteredInvoiceRows = tenantInvoices.filter((invoice) => {
    const propertyName = invoice.unit?.property?.name?.trim() || '';
    const unitNumber = invoice.unit?.unit_number?.trim() || '';
    const propertyLabel = propertyName || 'Unknown property';
    const unitLabel = unitNumber ? `Unit ${unitNumber}` : 'Unknown unit';
    return (selectedProperty === 'all' || propertyName === selectedProperty) && (selectedUnit === 'all' || `${propertyLabel} - ${unitLabel}` === selectedUnit);
  });
  const filteredPaymentRows = tenantPayments.filter((payment) => {
    const linkedInvoice = payment.invoice_id ? invoiceById.get(payment.invoice_id) || null : null;
    const propertyName = linkedInvoice?.unit?.property?.name?.trim() || '';
    const unitNumber = linkedInvoice?.unit?.unit_number?.trim() || '';
    const propertyLabel = propertyName || 'Unknown property';
    const unitLabel = unitNumber ? `Unit ${unitNumber}` : 'Unknown unit';
    return (selectedProperty === 'all' || propertyName === selectedProperty) && (selectedUnit === 'all' || `${propertyLabel} - ${unitLabel}` === selectedUnit);
  });
  const filteredPayable = filteredInvoiceRows.reduce((sum, invoice) => sum + Number(invoice.amount_due || 0), 0);
  const filteredPaid = filteredPaymentRows.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const filteredBalance = filteredPayable - filteredPaid;

  const exportCsv = () => {
    if (!selectedTenant) return;
    const rows = [
      ['Tenant', getTenantDisplayName(selectedTenant as any)],
      ['Phone', selectedTenant.phone || 'N/A'],
      ['Current balance', currency(filteredBalance)],
      [],
      ['Date', 'Reference', 'Type', 'To Who', 'Amount Payable', 'Amount Paid', 'Balance'],
      ...runningLedger.map((row) => [
        row.date,
        row.reference,
        row.type,
        row.toWho,
        currency(row.amountPayable),
        currency(row.amountPaid),
        currency(row.balance),
      ]),
    ];
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tenant_ledger_${getTenantDisplayName(selectedTenant as any).replace(/\s+/g, '_').toLowerCase() || 'tenant'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    setToast({ message: 'Tenant ledger exported as CSV.', type: 'success' });
  };

  if (loading && !tenants.length) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <CustomLoader size={40} label="Loading tenant ledger..." />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="flex items-center text-3xl font-bold text-gray-900 dark:text-white mb-2">
              <FileSpreadsheet className="mr-3 text-brand-purple" size={32} />
              Tenant Ledger
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              A dedicated tenant ledger showing every invoice and payment with reference number, who was charged, amount payable, amount paid, and balance.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedTenant && (
              <>
                <button className="px-4 py-2 bg-white dark:bg-dark-surface text-gray-700 dark:text-white border border-gray-200 dark:border-white/10 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center shadow-sm" onClick={() => printWorkspacePage()}>
                  <Printer size={18} className="mr-2" /> Print
                </button>
                <button className="px-4 py-2 bg-brand-purple text-white rounded-lg font-medium hover:bg-brand-pink transition-colors flex items-center shadow-sm" onClick={exportCsv}>
                  <Download size={18} className="mr-2" /> Export CSV
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-6">
          <div className="bg-white dark:bg-dark-surface p-6 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex-1 max-w-md">
                <label htmlFor="tenant-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Select Tenant
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <select
                    id="tenant-select"
                    value={selectedTenantId}
                    onChange={(e) => setSelectedTenantId(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg outline-none focus:ring-2 focus:ring-brand-purple text-gray-900 dark:text-white"
                  >
                    <option value="">-- Choose Tenant --</option>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>{getTenantDisplayName(tenant as any)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:min-w-[520px]">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Property</label>
                  <select
                    value={selectedProperty}
                    onChange={(e) => {
                      setSelectedProperty(e.target.value);
                      setSelectedUnit('all');
                    }}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-brand-purple dark:border-white/10 dark:bg-black/20 dark:text-white"
                  >
                    {propertyOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Unit</label>
                  <select
                    value={selectedUnit}
                    onChange={(e) => setSelectedUnit(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-brand-purple dark:border-white/10 dark:bg-black/20 dark:text-white"
                  >
                    {unitOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">From</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-brand-purple dark:border-white/10 dark:bg-black/20 dark:text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">To</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-brand-purple dark:border-white/10 dark:bg-black/20 dark:text-white" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
            <StatCard label="Opening Balance" value={currency(openingBalance)} tone="text-slate-700" />
            <StatCard label="Current Balance" value={currency(filteredBalance)} tone="text-brand-purple" />
            <StatCard label="Amount Payable" value={currency(filteredPayable)} tone="text-rose-600" />
            <StatCard label="Amount Paid" value={currency(filteredPaid)} tone="text-emerald-600" />
          </div>
        </div>

        {selectedTenant ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card title="Tenant" icon={<Home size={20} />} tone="bg-brand-purple/10 text-brand-purple" rows={[
                ['Name', getTenantDisplayName(selectedTenant as any)],
                ['Phone', selectedTenant.phone || 'N/A'],
                ['Ledger entries', String(runningLedger.length)],
              ]} />
              <Card title="Period" icon={<Calendar size={20} />} tone="bg-blue-500/10 text-blue-600" rows={[
                ['From', startDate || 'All time'],
                ['To', endDate || 'All time'],
                ['Filtered rows', String(filteredLedgerRows.length)],
                ['Property', selectedProperty === 'all' ? 'All properties' : selectedProperty],
                ['Unit', selectedUnit === 'all' ? 'All units' : selectedUnit],
              ]} />
              <Card title="Summary" icon={<BookOpen size={20} />} tone="bg-emerald-500/10 text-emerald-600" rows={[
                ['Total payable', currency(filteredPayable)],
                ['Total paid', currency(filteredPaid)],
                ['Net balance', currency(filteredBalance)],
              ]} />
            </div>

            <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
              <div className="p-4 bg-gray-50 dark:bg-black/20 border-b border-gray-200 dark:border-white/10 flex flex-wrap gap-4 justify-between items-center px-6">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">Tenant Ledger Table</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Invoices and payments with reference number, payee, payable, paid, and running balance.</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500"><Search size={14} /> {startDate || endDate ? 'Filtered period' : 'All time record'}</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white dark:bg-dark-surface text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold border-b border-gray-100 dark:border-white/5">
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Reference</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">To Who</th>
                      <th className="px-6 py-4">Amount Payable</th>
                      <th className="px-6 py-4">Amount Paid</th>
                      <th className="px-6 py-4">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {runningLedger.length > 0 ? runningLedger.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{new Date(row.date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-sm font-mono text-gray-500">{row.reference}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white capitalize flex items-center gap-2">
                          {row.type === 'invoice' ? <ArrowUpRight size={14} className="text-rose-500" /> : <ArrowDownRight size={14} className="text-emerald-500" />}
                          {row.type}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-200">{row.toWho}</td>
                        <td className="px-6 py-4 text-sm text-rose-500 font-medium">{row.type === 'invoice' ? currency(row.amountPayable) : '---'}</td>
                        <td className="px-6 py-4 text-sm text-emerald-600 font-medium">{row.type === 'payment' ? currency(row.amountPaid) : '---'}</td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">{currency(row.balance)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500 italic">No transactions found for this tenant and date range.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white dark:bg-dark-surface rounded-xl border-2 border-dashed border-gray-200 dark:border-white/10 p-20 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="text-gray-400" size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Tenant Selected</h3>
              <p className="text-gray-500 dark:text-gray-400">Choose a tenant above to load their ledger.</p>
            </div>
          </div>
        )}
      </div>

      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-dark-surface">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
      <p className={`mt-2 text-xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function Card({ title, icon, tone, rows }: { title: string; icon: React.ReactNode; tone: string; rows: [string, string][] }) {
  return (
    <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tone}`}>{icon}</div>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-gray-400">{title}</p>
          <h3 className="font-bold text-gray-900 dark:text-white">{title} Summary</h3>
        </div>
      </div>
      <div className="space-y-3 text-sm">
        {rows.map(([label, value]) => (
          <InfoRow key={`${label}-${value}`} label={label} value={value} />
        ))}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-2 last:border-b-0 last:pb-0 dark:border-white/5">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-right font-semibold text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}
