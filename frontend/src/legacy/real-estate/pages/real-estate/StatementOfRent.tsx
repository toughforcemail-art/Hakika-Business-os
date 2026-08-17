// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Calendar, Download, Home, Printer, User } from 'lucide-react';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { sanitizeError, ToastType } from '../../components/CustomToast';
import { printWorkspacePage } from '../../utils/printHelpers';
import { supabase } from '../../utils/supabase';

type LandlordRow = { id: string; full_name: string; phone: string | null; property_id: string | null; property?: { name: string | null }[] | null };
type PropertyRow = { id: string; name: string };
type UnitRow = { id: string; unit_number: string | null; property_id: string | null; rent_amount: number | null };
type LeaseRow = { id: string; unit_id: string; deposit_amount: number | null; water_deposit_amount?: number | null; electricity_deposit_amount?: number | null };
type StatementRow = {
  id: string;
  propertyName: string;
  landlordName: string;
  month: string;
  unitNumber: string;
  tenantName: string;
  tenantPhone: string;
  expectedRent: number;
  deposit: number;
  rentDeposit: number;
  waterDeposit: number;
  electricityDeposit: number;
  balanceBroughtForward: number;
  totalPayable: number;
  totalPaid: number;
  dateOfPayment: string;
  reference: string;
  balance: number;
};
type TenantRow = { id: string; full_name: string | null; phone: string | null; current_unit_id: string | null };
type InvoiceRow = { id: string; invoice_number: string | null; invoice_date: string | null; amount_due: number | null; amount_paid: number | null; unit_id: string | null };
type PaymentRow = { id: string; payment_date: string | null; amount: number | null; reference_number: string | null; invoice_id: string | null };

const currency = (value: number) => `KES ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthLabel = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
};
const dateLabel = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};
const firstRelation = <T,>(value: T[] | T | null | undefined): T | null => (Array.isArray(value) ? value[0] || null : value || null);

const tableCellCls = 'px-3 py-2.5 align-top text-sm';

export default function StatementOfRent() {
  const { profile } = useAccess();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [landlords, setLandlords] = useState<LandlordRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [leases, setLeases] = useState<LeaseRow[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [selectedLandlordId, setSelectedLandlordId] = useState('');

  useEffect(() => {
    if (profile) void load();
  }, [profile?.company_id]);

  const load = async () => {
    setLoading(true);
    try {
      const [landlordRes, propertyRes, unitRes, leaseRes, tenantRes, invoiceRes, paymentRes] = await Promise.all([
        supabase.from('re_personnel').select('id, full_name, phone, property_id, property:re_properties(name)').eq('role', 'landlord').is('deleted_at', null).eq('is_deleted', false).order('full_name'),
        supabase.from('re_properties').select('id, name').order('name'),
        supabase.from('re_units').select('id, unit_number, property_id, rent_amount').order('unit_number'),
        supabase.from('re_leases').select('id, unit_id, deposit_amount, water_deposit_amount, electricity_deposit_amount').order('created_at', { ascending: false }),
        supabase.from('re_tenants').select('id, full_name, phone, current_unit_id').eq('is_active', true).order('full_name'),
        supabase.from('re_invoices').select('id, invoice_number, invoice_date, amount_due, amount_paid, unit_id').is('deleted_at', null).order('invoice_date', { ascending: true }),
        supabase.from('re_payments').select('id, payment_date, amount, reference_number, invoice_id').order('payment_date', { ascending: true }),
      ]);
      if (landlordRes.error) throw landlordRes.error;
      if (propertyRes.error) throw propertyRes.error;
      if (unitRes.error) throw unitRes.error;
      if (leaseRes.error) throw leaseRes.error;
      if (tenantRes.error) throw tenantRes.error;
      if (invoiceRes.error) throw invoiceRes.error;
      if (paymentRes.error) throw paymentRes.error;

      const nextLandlords = (landlordRes.data || []) as unknown as LandlordRow[];
      setLandlords(nextLandlords);
      setProperties((propertyRes.data || []) as PropertyRow[]);
      setUnits((unitRes.data || []) as UnitRow[]);
      setLeases((leaseRes.data || []) as LeaseRow[]);
      setTenants((tenantRes.data || []) as TenantRow[]);
      setInvoices((invoiceRes.data || []) as InvoiceRow[]);
      setPayments((paymentRes.data || []) as PaymentRow[]);
      if (!selectedLandlordId && nextLandlords[0]) setSelectedLandlordId(nextLandlords[0].id);
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const selectedLandlord = useMemo(() => landlords.find((l) => l.id === selectedLandlordId) || null, [landlords, selectedLandlordId]);
  const selectedProperty = useMemo(() => properties.find((p) => p.id === selectedLandlord?.property_id) || firstRelation(selectedLandlord?.property) || null, [properties, selectedLandlord?.property_id, selectedLandlord?.property]);
  const propertyUnits = useMemo(() => units.filter((u) => u.property_id && u.property_id === selectedLandlord?.property_id), [units, selectedLandlord?.property_id]);
  const leaseByUnit = useMemo(() => {
    const map = new Map<string, LeaseRow>();
    leases.forEach((lease) => { if (!map.has(lease.unit_id)) map.set(lease.unit_id, lease); });
    return map;
  }, [leases]);
  const tenantByUnit = useMemo(() => {
    const map = new Map<string, TenantRow>();
    tenants.forEach((tenant) => { if (tenant.current_unit_id) map.set(tenant.current_unit_id, tenant); });
    return map;
  }, [tenants]);

  const rentRows = useMemo<StatementRow[]>(() => {
    if (!selectedLandlord?.property_id) return [];
    return invoices
      .filter((invoice) => {
        const unit = invoice.unit_id ? propertyUnits.find((u) => u.id === invoice.unit_id) : null;
        return unit?.property_id === selectedLandlord.property_id;
      })
      .map((invoice) => {
        const unit = invoice.unit_id ? propertyUnits.find((u) => u.id === invoice.unit_id) : null;
        const tenant = unit ? tenantByUnit.get(unit.id) || null : null;
        const payment = payments.find((item) => item.invoice_id === invoice.id) || null;
        const expectedRent = Number(unit?.rent_amount ?? invoice.amount_due ?? 0);
        const lease = leaseByUnit.get(unit?.id || '') || null;
        const deposit = Number(lease?.deposit_amount ?? 0);
        const waterDeposit = Number(lease?.water_deposit_amount ?? 0);
        const electricityDeposit = Number(lease?.electricity_deposit_amount ?? 0);
        const totalDeposit = deposit + waterDeposit + electricityDeposit;
        const totalPaid = Number(invoice.amount_paid ?? 0);
        const balanceBroughtForward = Math.max(expectedRent - totalPaid, 0);
        const totalPayable = expectedRent + totalDeposit + balanceBroughtForward;
        const balance = totalPayable - totalPaid;
        return {
          id: invoice.id,
          propertyName: selectedProperty?.name || 'N/A',
          landlordName: selectedLandlord.full_name,
          month: monthLabel(invoice.invoice_date),
          unitNumber: unit?.unit_number || 'N/A',
          tenantName: tenant?.full_name || '-',
          tenantPhone: tenant?.phone || '-',
          expectedRent,
          deposit: totalDeposit,
          rentDeposit: deposit,
          waterDeposit,
          electricityDeposit,
          balanceBroughtForward,
          totalPayable,
          totalPaid,
          dateOfPayment: dateLabel(payment?.payment_date || invoice.invoice_date),
          reference: payment?.reference_number || invoice.invoice_number || invoice.id,
          balance,
        };
      });
  }, [invoices, leaseByUnit, payments, propertyUnits, selectedLandlord, selectedProperty?.name, tenantByUnit]);

  const depositRows = useMemo<StatementRow[]>(() => {
    if (!selectedLandlord?.property_id) return [];
    return leases
      .map((lease) => {
        const unit = propertyUnits.find((u) => u.id === lease.unit_id) || null;
        if (!unit) return null;
        const tenant = tenantByUnit.get(unit.id) || null;
        const rentDeposit = Number(lease.deposit_amount || 0);
        const waterDeposit = Number(lease.water_deposit_amount || 0);
        const electricityDeposit = Number(lease.electricity_deposit_amount || 0);
        const deposit = rentDeposit + waterDeposit + electricityDeposit;
        if (deposit <= 0) return null;
        return {
          id: `lease-deposit-${lease.id}`,
          propertyName: selectedProperty?.name || 'N/A',
          landlordName: selectedLandlord.full_name,
          month: 'Lease deposit',
          unitNumber: unit.unit_number || 'N/A',
          tenantName: tenant?.full_name || '-',
          tenantPhone: tenant?.phone || '-',
          expectedRent: 0,
          deposit,
          rentDeposit,
          waterDeposit,
          electricityDeposit,
          balanceBroughtForward: 0,
          totalPayable: deposit,
          totalPaid: 0,
          dateOfPayment: dateLabel(new Date().toISOString()),
          reference: lease.id,
          balance: deposit,
        };
      })
      .filter((row): row is StatementRow => Boolean(row));
  }, [leases, propertyUnits, selectedLandlord?.full_name, selectedLandlord?.property_id, selectedProperty?.name, tenantByUnit]);

  const totals = useMemo(() => ({
    expectedRent: [...rentRows, ...depositRows].reduce((sum, row) => sum + row.expectedRent, 0),
    deposit: [...rentRows, ...depositRows].reduce((sum, row) => sum + row.deposit, 0),
    balanceBf: [...rentRows, ...depositRows].reduce((sum, row) => sum + row.balanceBroughtForward, 0),
    payable: [...rentRows, ...depositRows].reduce((sum, row) => sum + row.totalPayable, 0),
    paid: [...rentRows, ...depositRows].reduce((sum, row) => sum + row.totalPaid, 0),
    balance: [...rentRows, ...depositRows].reduce((sum, row) => sum + row.balance, 0),
  }), [depositRows, rentRows]);

  const exportCsv = () => {
    const rows = [
      ['Property Name', selectedProperty?.name || 'N/A'],
      ['Landlord Name', selectedLandlord?.full_name || 'N/A'],
      [],
      ['Property', 'Landlord', 'Month', 'Unit No', 'Tenant Name', 'Phone Number', 'Expected Rent', 'Deposit', 'Balance Brought Forward', 'Total Payable', 'Total Paid', 'Date of Payment', 'Reference', 'Balance'],
      ...rentRows.map((row) => [row.propertyName, row.landlordName, row.month, row.unitNumber, row.tenantName, row.tenantPhone, row.expectedRent, row.deposit, row.balanceBroughtForward, row.totalPayable, row.totalPaid, row.dateOfPayment, row.reference, row.balance]),
      ...depositRows.map((row) => [row.propertyName, row.landlordName, row.month, row.unitNumber, row.tenantName, row.tenantPhone, row.expectedRent, row.deposit, row.balanceBroughtForward, row.totalPayable, row.totalPaid, row.dateOfPayment, row.reference, row.balance]),
    ];
    const csv = rows.map((row) => row.map((cell) => {
      const text = String(cell ?? '');
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `statement_of_rent_${(selectedProperty?.name || 'property').replace(/\s+/g, '_').toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (loading) return <CustomLoader size={32} label="Loading rent statement..." />;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-8 dark:bg-dark-bg">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="mb-2 flex items-center text-3xl font-bold text-gray-900 dark:text-white">
              <Home className="mr-3 text-brand-purple" size={32} />
              Statement of Rent
            </h1>
            <p className="text-gray-500 dark:text-gray-400">Landlord rent statement with tenant balances and payment references.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-white">
              <Download size={18} /> Export CSV
            </button>
            <button onClick={() => printWorkspacePage()} className="inline-flex items-center gap-2 rounded-xl bg-brand-purple px-4 py-2.5 text-sm font-semibold text-white">
              <Printer size={18} /> Print
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {[
            { label: 'Landlord', value: selectedLandlord?.full_name || 'N/A', icon: User },
            { label: 'Property', value: selectedProperty?.name || 'N/A', icon: Building2 },
            { label: 'Units', value: propertyUnits.length, icon: Home },
            { label: 'Balance', value: currency(totals.balance), icon: Calendar },
          ].map((card) => (
            <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-dark-surface">
              <div className="mb-3 flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <card.icon size={16} />
                <span className="text-xs font-bold uppercase tracking-[0.2em]">{card.label}</span>
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{card.value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#0f3548] p-5 text-white shadow-[0_24px_80px_-48px_rgba(0,0,0,0.3)]">
          <div className="mb-6 rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ff6a00]/15 text-[#ffb07a]">
                  <Building2 size={22} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">Hakika Real Estate</p>
                  <h2 className="text-2xl font-black">Statement of Rent</h2>
                </div>
              </div>
              <div className="text-right text-sm text-slate-300">
                <div>{selectedLandlord?.full_name || 'Landlord'}</div>
                <div>{selectedProperty?.name || 'Property'}</div>
                <div>{selectedLandlord?.phone || 'N/A'}</div>
              </div>
            </div>
          </div>

          <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-300">Landlord</label>
              <select value={selectedLandlordId} onChange={(e) => setSelectedLandlordId(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#082131] px-4 py-3 text-sm text-slate-100">
                <option value="">Select landlord</option>
                {landlords.map((landlord) => <option key={landlord.id} value={landlord.id}>{landlord.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-300">Property</label>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">{selectedProperty?.name || 'No property linked'}</div>
            </div>
            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-300">Phone</label>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">{selectedLandlord?.phone || 'N/A'}</div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[24px] border border-white/10 bg-white/5">
            <table className="w-full min-w-[1400px] text-left">
              <thead className="bg-white/10 text-slate-300">
                <tr>
                  <th className={tableCellCls}>Property Name</th>
                  <th className={tableCellCls}>Landlord Name</th>
                  <th className={tableCellCls}>Month</th>
                  <th className={tableCellCls}>Table/Unit No</th>
                  <th className={tableCellCls}>Tenant Name</th>
                  <th className={tableCellCls}>Phone Number</th>
                  <th className={tableCellCls}>Expected Rent</th>
                  <th className={tableCellCls}>Deposit</th>
                  <th className={tableCellCls}>Balance Brought Forward</th>
                  <th className={tableCellCls}>Total Payable</th>
                  <th className={tableCellCls}>Total Paid</th>
                  <th className={tableCellCls}>Date of Payment</th>
                  <th className={tableCellCls}>Reference</th>
                  <th className={tableCellCls}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {rentRows.length === 0 && depositRows.length === 0 ? (
                  <tr><td colSpan={14} className="px-6 py-12 text-center text-sm text-slate-300">No rent rows found.</td></tr>
                ) : (
                  <>
                    {depositRows.map((row) => (
                      <tr key={row.id} className="odd:bg-white/[0.02]">
                        <td className={tableCellCls}>{row.propertyName}</td>
                        <td className={tableCellCls}>{row.landlordName}</td>
                        <td className={tableCellCls}>{row.month}</td>
                        <td className={tableCellCls}>{row.unitNumber}</td>
                        <td className={tableCellCls}>{row.tenantName}</td>
                        <td className={tableCellCls}>{row.tenantPhone}</td>
                        <td className={tableCellCls}>{currency(row.expectedRent)}</td>
                        <td className={tableCellCls}>
                          <div className="space-y-1">
                            <div>{currency(row.deposit)}</div>
                            <div className="text-[10px] text-slate-300">
                              Rent {currency(row.rentDeposit)}
                              {row.waterDeposit > 0 ? ` · Water ${currency(row.waterDeposit)}` : ''}
                              {row.electricityDeposit > 0 ? ` · Electricity ${currency(row.electricityDeposit)}` : ''}
                            </div>
                          </div>
                        </td>
                        <td className={tableCellCls}>{currency(row.balanceBroughtForward)}</td>
                        <td className={tableCellCls}>{currency(row.totalPayable)}</td>
                        <td className={tableCellCls}>{currency(row.totalPaid)}</td>
                        <td className={tableCellCls}>{row.dateOfPayment}</td>
                        <td className={tableCellCls}>{row.reference}</td>
                        <td className={tableCellCls}>{currency(row.balance)}</td>
                      </tr>
                    ))}
                    {rentRows.map((row) => (
                  <tr key={row.id} className="odd:bg-white/[0.02]">
                    <td className={tableCellCls}>{row.propertyName}</td>
                    <td className={tableCellCls}>{row.landlordName}</td>
                    <td className={tableCellCls}>{row.month}</td>
                    <td className={tableCellCls}>{row.unitNumber}</td>
                    <td className={tableCellCls}>{row.tenantName}</td>
                    <td className={tableCellCls}>{row.tenantPhone}</td>
                    <td className={tableCellCls}>{currency(row.expectedRent)}</td>
                    <td className={tableCellCls}>
                      {row.deposit > 0 ? (
                        <div className="space-y-1">
                          <div>{currency(row.deposit)}</div>
                          {(row.waterDeposit > 0 || row.electricityDeposit > 0) && (
                            <div className="text-[10px] text-slate-300">
                              {row.rentDeposit > 0 ? `Rent ${currency(row.rentDeposit)}` : ''}
                              {row.waterDeposit > 0 ? `${row.rentDeposit > 0 ? ' · ' : ''}Water ${currency(row.waterDeposit)}` : ''}
                              {row.electricityDeposit > 0 ? `${row.rentDeposit > 0 || row.waterDeposit > 0 ? ' · ' : ''}Electricity ${currency(row.electricityDeposit)}` : ''}
                            </div>
                          )}
                        </div>
                      ) : 'N/A'}
                    </td>
                    <td className={tableCellCls}>{currency(row.balanceBroughtForward)}</td>
                    <td className={tableCellCls}>{currency(row.totalPayable)}</td>
                    <td className={tableCellCls}>{currency(row.totalPaid)}</td>
                    <td className={tableCellCls}>{row.dateOfPayment}</td>
                    <td className={tableCellCls}>{row.reference}</td>
                    <td className={tableCellCls}>{currency(row.balance)}</td>
                  </tr>
                    ))}
                  </>
                )}
              </tbody>
              <tfoot className="border-t border-white/10 bg-white/5">
                <tr>
                  <td colSpan={7} className={tableCellCls}>Totals</td>
                  <td className={tableCellCls}>{currency(totals.deposit)}</td>
                  <td className={tableCellCls}>{currency(totals.balanceBf)}</td>
                  <td className={tableCellCls}>{currency(totals.payable)}</td>
                  <td className={tableCellCls}>{currency(totals.paid)}</td>
                  <td className={tableCellCls} />
                  <td className={tableCellCls} />
                  <td className={tableCellCls}>{currency(totals.balance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <h3 className="text-sm font-black uppercase tracking-[0.24em] text-slate-300">Landlord Signature</h3>
              <div className="mt-10 border-t border-dashed border-white/20 pt-3 text-sm text-slate-200">Signature: ________________________________</div>
              <div className="mt-3 text-sm text-slate-400">Name: {selectedLandlord?.full_name || '-'}</div>
              <div className="mt-1 text-sm text-slate-400">Date: ________________________________</div>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <h3 className="text-sm font-black uppercase tracking-[0.24em] text-slate-300">Prepared By</h3>
              <div className="mt-3 text-sm text-slate-200">Hakika Real Estate Finance Desk</div>
              <div className="mt-2 text-sm text-slate-400">This report is system-generated and should be reviewed before filing.</div>
            </div>
          </div>
        </div>
      </div>
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
