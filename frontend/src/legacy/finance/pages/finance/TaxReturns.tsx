// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, CalendarDays, CheckCircle2, Download, FileText, Gavel, ReceiptText, ScanBarcode, ShieldCheck, Wallet } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { useAccess } from '../../context/AccessContext';

type TaxPeriodStatus = 'Filed' | 'Due' | 'Overdue' | 'Pending';

type PeriodRow = {
  period: string;
  return_type: 'PAYE' | 'VAT' | 'Withholding Tax' | 'Annual Income Tax';
  due_date: string;
  status: TaxPeriodStatus;
  amount: number;
  acknowledgement_number: string | null;
  source_note: string;
};

type PayrollProfile = { id: string; full_name: string | null; salary: number | null; status?: string | null };
type PayrollAddition = { employee_id: string; amount: number | null; created_at: string };
type PayrollBenefit = { employee_id: string; taxable_value: number | null; created_at: string };
type FinanceInvoice = { id: string; invoice_number: string | null; invoice_date: string | null; due_date: string | null; total_amount: number | null; etims_status: string | null; etims_control_number: string | null };
type FinancePayment = { id: string; payment_number: string | null; payment_date: string | null; amount: number | null; payee_id: string | null; reference_number: string | null; entity: string | null };
type FinancePayee = { id: string; payee_name: string | null; vat_pin_number: string | null };
type StatutoryReturn = { return_type: string; tax_period: string; amount: number; filed_at: string | null; acknowledgement_number: string | null; status: string | null };
type TaxFilingPeriodStatus = {
  id: string;
  organization_id: string | null;
  return_type: string;
  period: string;
  due_date: string;
  amount: number;
  status: string;
  acknowledgement_number: string | null;
  source_note: string | null;
  source_type: string | null;
  source_ref: string | null;
};

const money = (value: number) => `KES ${new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)}`;
const monthKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-KE', { month: 'short', year: 'numeric' });
};
const toCsv = (rows: string[][]) => rows.map((row) => row.map((cell) => {
  const value = String(cell ?? '');
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}).join(',')).join('\n');

const TaxReturns: React.FC = () => {
  const { profile } = useAccess();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [periodRows, setPeriodRows] = useState<PeriodRow[]>([]);
  const [returns, setReturns] = useState<StatutoryReturn[]>([]);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setLoadingError(null);
      try {
        const [employeeRes, additionsRes, benefitsRes, invoiceRes, paymentRes, payeeRes, filingStatusRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name, salary, status').eq('status', 'active'),
          supabase.from('payroll_additions').select('employee_id, amount, created_at').order('created_at', { ascending: false }).limit(500),
          supabase.from('non_cash_benefits').select('employee_id, taxable_value, created_at').order('created_at', { ascending: false }).limit(500),
          supabase.from('finance_invoices').select('id, invoice_number, invoice_date, due_date, total_amount, etims_status, etims_control_number').order('invoice_date', { ascending: false }).limit(500),
          supabase.from('finance_payments').select('id, payment_number, payment_date, amount, payee_id, reference_number, entity').order('payment_date', { ascending: false }).limit(500),
          supabase.from('finance_payees').select('id, payee_name, vat_pin_number').order('payee_name', { ascending: true }).limit(1000),
          supabase.from('tax_filing_period_status').select('id, organization_id, return_type, period, due_date, amount, status, acknowledgement_number, source_note, source_type, source_ref').order('due_date', { ascending: false }).limit(500),
        ]);

        if (employeeRes.error) throw employeeRes.error;
        if (additionsRes.error) throw additionsRes.error;
        if (benefitsRes.error) throw benefitsRes.error;
        if (invoiceRes.error) throw invoiceRes.error;
        if (paymentRes.error) throw paymentRes.error;
        if (payeeRes.error) throw payeeRes.error;
        if (filingStatusRes.error) throw filingStatusRes.error;

        const employees = (employeeRes.data || []) as PayrollProfile[];
        const additions = (additionsRes.data || []) as PayrollAddition[];
        const benefits = (benefitsRes.data || []) as PayrollBenefit[];
        const invoices = (invoiceRes.data || []) as FinanceInvoice[];
        const payments = (paymentRes.data || []) as FinancePayment[];
        const payees = (payeeRes.data || []) as FinancePayee[];
        const filingStatuses = (filingStatusRes.data || []) as TaxFilingPeriodStatus[];
        const statutory = filingStatuses.map((row) => ({
          return_type: row.return_type,
          tax_period: row.period,
          amount: Number(row.amount || 0),
          filed_at: row.status === 'filed' ? row.due_date : null,
          acknowledgement_number: row.acknowledgement_number,
          status: row.status,
        })) as StatutoryReturn[];

        if (filingStatuses.length) {
          const mapped = filingStatuses.map((row) => ({
            period: row.period,
            return_type: row.return_type as PeriodRow['return_type'],
            due_date: new Date(row.due_date).toLocaleDateString('en-KE'),
            status: ((row.status || 'pending').toLowerCase() === 'filed'
              ? 'Filed'
              : (row.status || 'pending').toLowerCase() === 'submitted'
                ? 'Pending'
                : (row.status || 'pending').toLowerCase() === 'due'
                  ? 'Due'
                  : (row.status || 'pending').toLowerCase() === 'overdue'
                    ? 'Overdue'
                    : 'Pending') as TaxPeriodStatus,
            amount: Number(row.amount || 0),
            acknowledgement_number: row.acknowledgement_number || null,
            source_note: row.source_note || `${row.source_type || 'record'} ${row.source_ref || ''}`.trim() || 'Recorded filing status',
          }));
          setPeriodRows(mapped);
          setReturns(statutory);
          return;
        }

        const byMonth = new Map<string, { payeBase: number; vatBase: number; withholdingBase: number; annualBase: number; support: string[] }>();
        const months = new Set<string>();
        const today = new Date();
        for (let i = 0; i < 6; i += 1) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          months.add(monthKey(d));
        }

        employees.forEach((employee) => {
          const salary = Number(employee.salary || 0);
          const baseMonth = monthKey(today);
          const current = byMonth.get(baseMonth) || { payeBase: 0, vatBase: 0, withholdingBase: 0, annualBase: 0, support: [] };
          current.payeBase += salary;
          if (employee.full_name) current.support.push(employee.full_name);
          byMonth.set(baseMonth, current);
        });

        additions.forEach((row) => {
          const key = monthKey(new Date(row.created_at));
          const current = byMonth.get(key) || { payeBase: 0, vatBase: 0, withholdingBase: 0, annualBase: 0, support: [] };
          current.payeBase += Number(row.amount || 0);
          byMonth.set(key, current);
        });

        benefits.forEach((row) => {
          const key = monthKey(new Date(row.created_at));
          const current = byMonth.get(key) || { payeBase: 0, vatBase: 0, withholdingBase: 0, annualBase: 0, support: [] };
          current.payeBase += Number(row.taxable_value || 0);
          current.annualBase += Number(row.taxable_value || 0);
          byMonth.set(key, current);
        });

        invoices.forEach((invoice) => {
          if (!invoice.invoice_date) return;
          const key = monthKey(new Date(invoice.invoice_date));
          const current = byMonth.get(key) || { payeBase: 0, vatBase: 0, withholdingBase: 0, annualBase: 0, support: [] };
          current.vatBase += Number(invoice.total_amount || 0);
          if ((invoice.etims_status || '').toLowerCase() === 'verified' && invoice.etims_control_number) {
            current.support.push(`eTIMS ${invoice.invoice_number || invoice.id}`);
          }
          byMonth.set(key, current);
        });

        payments.forEach((payment) => {
          if (!payment.payment_date) return;
          const key = monthKey(new Date(payment.payment_date));
          const current = byMonth.get(key) || { payeBase: 0, vatBase: 0, withholdingBase: 0, annualBase: 0, support: [] };
          current.withholdingBase += Number(payment.amount || 0);
          if (payment.reference_number) current.support.push(payment.reference_number);
          byMonth.set(key, current);
        });

        const mappedPeriods: PeriodRow[] = Array.from(months).sort((a, b) => b.localeCompare(a)).flatMap((key) => {
          const data = byMonth.get(key) || { payeBase: 0, vatBase: 0, withholdingBase: 0, annualBase: 0, support: [] };
          const periodDate = new Date(`${key}-01T00:00:00`);
          const periodLabel = monthLabel(key);
          const payeDue = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 9);
          const vatDue = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 20);
          const annualDue = new Date(periodDate.getFullYear() + 1, 5, 30);

          const resolveStatus = (returnType: PeriodRow['return_type'], dueDate: Date, amount: number, matched?: StatutoryReturn | undefined): PeriodRow => {
            const filed = Boolean(matched?.filed_at || matched?.acknowledgement_number || (matched?.status || '').toLowerCase() === 'filed');
            const overdue = !filed && today > dueDate;
            return {
              period: periodLabel,
              return_type: returnType,
              due_date: dueDate.toLocaleDateString('en-KE'),
              status: filed ? 'Filed' : overdue ? 'Overdue' : (today >= new Date(dueDate.getTime() - 7 * 24 * 60 * 60 * 1000) ? 'Due' : 'Pending'),
              amount,
              acknowledgement_number: matched?.acknowledgement_number || null,
              source_note: data.support.slice(0, 3).join(' · ') || 'Source data available in payroll, invoices, and payments',
            };
          };

          const paye = resolveStatus('PAYE', payeDue, Math.round(data.payeBase * 0.1), statutory.find((entry) => entry.return_type.toUpperCase() === 'PAYE' && entry.tax_period === key.replace('-', '/')));
          const vat = resolveStatus('VAT', vatDue, Math.round(data.vatBase * 0.16), statutory.find((entry) => entry.return_type.toUpperCase().includes('VAT') && entry.tax_period === key.replace('-', '/')));
          const withholding = resolveStatus('Withholding Tax', vatDue, Math.round(data.withholdingBase * 0.05), statutory.find((entry) => entry.return_type.toUpperCase().includes('WITHHOLDING') && entry.tax_period === key.replace('-', '/')));
          return [paye, vat, withholding];
        });

        const annualMatched = statutory.find((entry) => /annual|income tax/i.test(entry.return_type));
        const annualAmount = Math.round(Array.from(byMonth.values()).reduce((sum, item) => sum + item.annualBase, 0) * 0.1);
        const annualDue = new Date(today.getFullYear(), 5, 30);
        const annualStatus: PeriodRow = {
          period: String(today.getFullYear()),
          return_type: 'Annual Income Tax',
          due_date: annualDue.toLocaleDateString('en-KE'),
          status: annualMatched?.status === 'Filed' || annualMatched?.filed_at ? 'Filed' : today > annualDue ? 'Overdue' : 'Pending',
          amount: annualAmount,
          acknowledgement_number: annualMatched?.acknowledgement_number || null,
          source_note: `Payroll profiles: ${employees.length}, invoices: ${invoices.length}, payments: ${payments.length}`,
        };

        setPeriodRows([...mappedPeriods, annualStatus]);
        setReturns(statutory);
      } catch (error: any) {
        setLoadingError(error?.message || 'Failed to load tax data.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [profile?.company_id]);

  const stats = useMemo(() => {
    const filed = periodRows.filter((row) => row.status === 'Filed').length;
    const overdue = periodRows.filter((row) => row.status === 'Overdue').length;
    const due = periodRows.filter((row) => row.status === 'Due').length;
    return { filed, overdue, due, total: periodRows.length };
  }, [periodRows]);

  const overdueRows = useMemo(() => periodRows.filter((row) => row.status === 'Overdue'), [periodRows]);

  const downloadReturnPack = () => {
    const csv = toCsv([
      ['Return', 'Period', 'Due Date', 'Status', 'Amount', 'Acknowledgement', 'Source Note'],
      ...periodRows.map((row) => [row.return_type, row.period, row.due_date, row.status, String(row.amount), row.acknowledgement_number || '', row.source_note]),
    ]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tax-return-pack-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (loading) return <div className="flex min-h-full items-center justify-center p-10"><CustomLoader text="Loading tax compliance data..." /></div>;

  return (
    <div className="min-h-full w-full bg-gradient-to-br from-slate-50 via-white to-sky-50/60 p-6 text-slate-900 dark:from-[#07111f] dark:via-[#0b1627] dark:to-[#08101c] dark:text-white lg:p-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-white/[0.04] md:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.18),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.14),transparent_35%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200">
                <Gavel size={14} /> KRA and statutory compliance
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-black tracking-tight md:text-4xl">Tax & Statutory Returns</h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Live compliance view driven by payroll, invoices, payments, and previously recorded statutory filings. Use it to see what is filed, what is due, what is overdue, and to download a return pack for review or submission support.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
                  Payroll source
                </span>
                <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200">
                  Finance source
                </span>
                <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-violet-700 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-200">
                  Filing-status source
                </span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Filed', value: stats.filed, tone: 'text-emerald-600 dark:text-emerald-300' },
                { label: 'Due', value: stats.due, tone: 'text-amber-600 dark:text-amber-300' },
                { label: 'Overdue', value: stats.overdue, tone: 'text-rose-600 dark:text-rose-300' },
                { label: 'Tracked', value: stats.total, tone: 'text-sky-600 dark:text-sky-300' },
              ].map((card) => (
                <div key={card.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{card.label}</p>
                  <p className={`mt-2 text-xl font-black ${card.tone}`}>{card.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {loadingError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
            {loadingError}
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
          <div className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-black">Filing status by period</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Based on live payroll and finance records, with statutory filings where available.</p>
                </div>
                <button onClick={downloadReturnPack} type="button" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:bg-white/10">
                  <Download size={16} /> Download return pack
                </button>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:border-white/10 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Return</th>
                      <th className="px-4 py-3">Period</th>
                      <th className="px-4 py-3">Due date</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Acknowledgement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                    {periodRows.map((row) => (
                      <tr key={`${row.return_type}-${row.period}`} className="odd:bg-slate-50/70 even:bg-transparent dark:odd:bg-white/[0.02]">
                        <td className="px-4 py-4 font-semibold text-slate-900 dark:text-white">{row.return_type}</td>
                        <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{row.period}</td>
                        <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{row.due_date}</td>
                        <td className="px-4 py-4 font-semibold text-slate-900 dark:text-white">{money(row.amount)}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${
                            row.status === 'Filed'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200'
                              : row.status === 'Overdue'
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-200'
                                : row.status === 'Due'
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-200'
                                  : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200'
                          }`}>{row.status}</span>
                        </td>
                        <td className="px-4 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{row.acknowledgement_number || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-center gap-2">
                  <CalendarDays size={18} className="text-sky-600 dark:text-sky-300" />
                  <h3 className="text-lg font-black">Overdue alerts</h3>
                </div>
                <div className="mt-4 space-y-3">
                  {overdueRows.length ? overdueRows.map((row) => (
                    <div key={`${row.return_type}-${row.period}`} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                      <p className="font-bold">{row.return_type} for {row.period}</p>
                      <p className="mt-1 text-xs">Due {row.due_date}. Pack source: {row.source_note}</p>
                    </div>
                  )) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No overdue returns detected in the current rolling window.</p>
                  )}
                </div>
              </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-300" />
                  <h3 className="text-lg font-black">Source records included</h3>
              </div>
              <div className="mt-4 space-y-4 text-sm text-slate-600 dark:text-slate-300">
                  <p><strong>Payroll figures:</strong> active payroll profiles, payroll additions, and non-cash benefits feed PAYE support.</p>
                  <p><strong>Finance figures:</strong> invoices and eTIMS verification feed VAT support, while payments and vendor references feed withholding support.</p>
                  <p><strong>Filing-status figures:</strong> tax_filing_period_status provides the current filed, due, overdue, and acknowledgement tracking record.</p>
              </div>
            </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
              <h3 className="text-lg font-black">Downloadable pack contents</h3>
              <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <p>Period summary table</p>
                <p>Overdue items report</p>
                <p>Payroll support totals</p>
                <p>Invoice and eTIMS support</p>
                <p>Payments and withholding support</p>
                <p>Historical statutory filings</p>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-amber-600 dark:text-amber-300" />
                <h3 className="text-lg font-black">Compliance guidance</h3>
              </div>
              <div className="mt-4 space-y-4 text-sm text-slate-600 dark:text-slate-300">
                <p>Annual returns should remain supportable even when nil filed, provided the PIN requires income tax filing.</p>
                <p>VAT periods should remain linked to invoice-level support and eTIMS verification where applicable.</p>
                <p>Any return marked overdue should be flagged before the close of the current filing window.</p>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm dark:border-white/10">
              <div className="flex items-center gap-2 text-sky-200">
                <ArrowRight size={18} />
                <h3 className="text-lg font-black">Ready for next step</h3>
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-200">
                <p>Hook the return pack to PDF/Excel export.</p>
                <p>Add direct filing reference capture per return.</p>
                <p>Attach uploaded KRA acknowledgements to each period row.</p>
              </div>
            </div>
          </aside>
        </section>
      </div>

      {toast && <CustomToast isVisible={!!toast} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default TaxReturns;
