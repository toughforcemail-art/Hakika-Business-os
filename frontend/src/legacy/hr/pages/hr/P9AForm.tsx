// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, Download, Landmark, Printer, RefreshCw, RotateCcw, Save, User } from 'lucide-react';
import { calculateCompletePayroll, formatCurrency } from '../../utils/payrollCalculator';
import { escapeHtml, printDocument } from '../../utils/printHelpers';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../hooks/useAccess';
import { resolveOrganizationScope } from '../../utils/organizationScope';

type MonthKey =
  | 'january'
  | 'february'
  | 'march'
  | 'april'
  | 'may'
  | 'june'
  | 'july'
  | 'august'
  | 'september'
  | 'october'
  | 'november'
  | 'december';

type P9Row = {
  month: MonthKey;
  monthLabel: string;
  year: number;
  basicSalary: number;
  benefitsNonCash: number;
  valueOfQuarters: number;
  grossPay: number;
  e1: number;
  e2: number;
  e3: number;
  ownerOccupiedInterest: number;
  retirementContribution: number;
  chargeablePay: number;
  taxCharged: number;
  personalRelief: number;
  insuranceRelief: number;
  payeTax: number;
};

type EmployeeOption = {
  id: string;
  full_name: string | null;
  employee_no: string | null;
  kra_pin: string | null;
};

type PayslipRecord = {
  month: number;
  year: number;
  gross_salary: number | null;
  total_deductions: number | null;
  net_salary: number | null;
  gross_pay?: number | null;
  net_pay?: number | null;
  deductions?: number | null;
};

const MONTHS: { key: MonthKey; label: string; monthNumber: number }[] = [
  { key: 'january', label: 'January', monthNumber: 1 },
  { key: 'february', label: 'February', monthNumber: 2 },
  { key: 'march', label: 'March', monthNumber: 3 },
  { key: 'april', label: 'April', monthNumber: 4 },
  { key: 'may', label: 'May', monthNumber: 5 },
  { key: 'june', label: 'June', monthNumber: 6 },
  { key: 'july', label: 'July', monthNumber: 7 },
  { key: 'august', label: 'August', monthNumber: 8 },
  { key: 'september', label: 'September', monthNumber: 9 },
  { key: 'october', label: 'October', monthNumber: 10 },
  { key: 'november', label: 'November', monthNumber: 11 },
  { key: 'december', label: 'December', monthNumber: 12 },
];

const money = (value: number) => formatCurrency(Number.isFinite(value) ? value : 0);

const inputCls =
  'w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/10';

const emptyRows = (): Record<MonthKey, P9Row> =>
  MONTHS.reduce((acc, month) => {
    acc[month.key] = {
      month: month.key,
      monthLabel: month.label,
      year: new Date().getFullYear(),
      basicSalary: 0,
      benefitsNonCash: 0,
      valueOfQuarters: 0,
      grossPay: 0,
      e1: 0,
      e2: 0,
      e3: 0,
      ownerOccupiedInterest: 0,
      retirementContribution: 0,
      chargeablePay: 0,
      taxCharged: 0,
      personalRelief: 2400,
      insuranceRelief: 0,
      payeTax: 0,
    };
    return acc;
  }, {} as Record<MonthKey, P9Row>);

const monthKeyByNumber = (month: number): MonthKey => MONTHS[Math.max(0, Math.min(11, month - 1))].key;
const monthLabelByNumber = (month: number) => MONTHS[Math.max(0, Math.min(11, month - 1))].label;

export default function P9AForm() {
  const { profile } = useAccess();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [employerName, setEmployerName] = useState('Community Action For Nature Conservation');
  const [employerPin, setEmployerPin] = useState('P051376109B');
  const [employeeName, setEmployeeName] = useState('Employee Name');
  const [employeePin, setEmployeePin] = useState('P051376109B');
  const [kraBranch, setKraBranch] = useState('Kabeleo');
  const [signatureName, setSignatureName] = useState('HR Manager');
  const [signatureDesignation, setSignatureDesignation] = useState('HR Manager');
  const [lrNumber, setLrNumber] = useState('');
  const [houseOccupationDate, setHouseOccupationDate] = useState('');
  const [financingInstitution, setFinancingInstitution] = useState('');
  const [rows, setRows] = useState<Record<MonthKey, P9Row>>(emptyRows());

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const scope = await resolveOrganizationScope(profile);
      setOrganizationId(scope.organizationId);
      if (!scope.organizationId) {
        setToast({ message: 'No organization is linked to this profile yet.', type: 'warning' });
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, employee_no, kra_pin')
        .eq('organization_id', scope.organizationId)
        .order('full_name', { ascending: true });

      if (error) throw error;

      const nextEmployees = (data || []) as EmployeeOption[];
      setEmployees(nextEmployees);
      setSelectedEmployeeId((current) => current || nextEmployees[0]?.id || '');
    } catch (error: any) {
      console.error('Failed to load employees:', error);
      setToast({ message: error.message || 'Failed to load employees.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEmployees();
  }, [profile]);

  const loadPayslips = async () => {
    if (!selectedEmployeeId || !organizationId) return;
    setLoading(true);
    try {
      const primaryQuery = await supabase
        .from('hr_payslips')
        .select('month, year, gross_pay, deductions, net_pay')
        .eq('employee_id', selectedEmployeeId)
        .order('year', { ascending: false })
        .order('month', { ascending: true })
        .limit(12);

      const fallbackQuery = primaryQuery.error
        ? await supabase
            .from('payslips')
            .select('month, year, gross_salary, total_deductions, net_salary')
            .eq('employee_id', selectedEmployeeId)
            .order('year', { ascending: false })
            .order('month', { ascending: true })
            .limit(12)
        : primaryQuery;

      const { data, error } = fallbackQuery;
      if (error) throw error;

      const payslips = (data || []) as PayslipRecord[];
      if (payslips.length === 0) {
        setToast({ message: 'No payslips found for the selected employee.', type: 'warning' });
        setRows(emptyRows());
        return;
      }

      const employee = employees.find((item) => item.id === selectedEmployeeId);
      setEmployeeName(employee?.full_name || 'Employee Name');
      setEmployeePin(employee?.kra_pin || employee?.employee_no || 'P051376109B');

      const nextRows = emptyRows();
      payslips.forEach((payslip) => {
        const key = monthKeyByNumber(Number(payslip.month || 1));
        const grossPay = Number((payslip.gross_pay ?? payslip.gross_salary) || 0);
        const basicSalary = Number(grossPay);
        const benefits = 0;
        const calc = calculateCompletePayroll(grossPay);

        nextRows[key] = {
          month: key,
          monthLabel: MONTHS.find((month) => month.key === key)?.label || key,
          year: Number(payslip.year || new Date().getFullYear()),
          basicSalary,
          benefitsNonCash: benefits,
          valueOfQuarters: 0,
          grossPay,
          e1: grossPay * 0.3,
          e2: calc.nssfEmployee,
          e3: 0,
          ownerOccupiedInterest: 0,
          retirementContribution: calc.nssfEmployee,
          chargeablePay: calc.taxableIncome,
          taxCharged: calc.payeTax,
          personalRelief: calc.personalRelief,
          insuranceRelief: calc.insuranceRelief,
          payeTax: calc.payeTax,
        };
      });

      setRows(nextRows);
      const activeYear = payslips[0]?.year ? String(payslips[0].year) : selectedYear;
      setSelectedYear(activeYear);
      setToast({ message: `Loaded payslips for ${employee?.full_name || 'selected employee'}.`, type: 'success' });
    } catch (error: any) {
      console.error('Failed to load payslips:', error);
      setToast({ message: error.message || 'Failed to load payslips.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPayslips();
  }, [selectedEmployeeId, organizationId]);

  const tableRows = MONTHS.map((month) => rows[month.key]);

  const totals = useMemo(
    () =>
      tableRows.reduce(
        (acc, row) => ({
          grossPay: acc.grossPay + row.grossPay,
          e1: acc.e1 + row.e1,
          e2: acc.e2 + row.e2,
          e3: acc.e3 + row.e3,
          retirementContribution: acc.retirementContribution + row.retirementContribution,
          chargeablePay: acc.chargeablePay + row.chargeablePay,
          taxCharged: acc.taxCharged + row.taxCharged,
          personalRelief: acc.personalRelief + row.personalRelief,
          insuranceRelief: acc.insuranceRelief + row.insuranceRelief,
          payeTax: acc.payeTax + row.payeTax,
        }),
        {
          grossPay: 0,
          e1: 0,
          e2: 0,
          e3: 0,
          retirementContribution: 0,
          chargeablePay: 0,
          taxCharged: 0,
          personalRelief: 0,
          insuranceRelief: 0,
          payeTax: 0,
        },
      ),
    [tableRows],
  );

  const exportCsv = () => {
    const header = ['Month', 'Basic Salary', 'Benefits Non Cash', 'Value of Quarters', 'Total Gross Pay', '30% of A', 'Actual Retirement Contribution', 'Fixed E3', 'Owner Occupied Interest', 'Retirement + Interest', 'Chargeable Pay', 'Tax Charged', 'Personal Relief', 'Insurance Relief', 'PAYE Tax'];
    const csv = [
      header,
      ...tableRows.map((row) => [
        row.monthLabel,
        row.basicSalary,
        row.benefitsNonCash,
        row.valueOfQuarters,
        row.grossPay,
        row.e1,
        row.retirementContribution,
        row.e3,
        row.ownerOccupiedInterest,
        row.retirementContribution + row.ownerOccupiedInterest,
        row.chargeablePay,
        row.taxCharged,
        row.personalRelief,
        row.insuranceRelief,
        row.payeTax,
      ]),
    ]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `P9A-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printP9A = () => {
    const employee = employees.find((item) => item.id === selectedEmployeeId);
    const bodyHtml = `
      <div style="display:grid; gap:18px;">
        <section style="border:1px solid #cbd5e1; border-radius:20px; padding:18px;">
          <div style="display:flex; justify-content:space-between; gap:16px; margin-bottom:16px;">
            <div>
              <div style="font-size:11px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; color:#64748b;">Kenya Revenue Authority</div>
              <h2 style="margin:6px 0 4px; font-size:20px;">P9A Tax Deduction Card</h2>
              <div style="font-size:12px; color:#475569;">${escapeHtml(employerName)} | ${escapeHtml(selectedYear)}</div>
            </div>
            <div style="text-align:right; font-size:12px; color:#475569;">
              <div><strong>Employee:</strong> ${escapeHtml(employee?.full_name || employeeName || 'Employee')}</div>
              <div><strong>PIN:</strong> ${escapeHtml(employeePin)}</div>
              <div><strong>Branch:</strong> ${escapeHtml(kraBranch)}</div>
            </div>
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:11px;">
            <thead>
              <tr>
                ${['Month','Basic Salary','Benefits Non Cash','Value of Quarters','Total Gross Pay','30% of A','Actual Retirement','Fixed Limit','Owner Occupied Interest','Retirement + Interest','Chargeable Pay','Tax Charged','Personal Relief','Insurance Relief','PAYE Tax'].map((heading) => `<th style="border:1px solid #cbd5e1; background:#0f172a; color:#fff; text-align:left; padding:8px 10px; font-size:10px; text-transform:uppercase; letter-spacing:.12em;">${heading}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${tableRows.map((row) => `
                <tr>
                  <td style="border:1px solid #cbd5e1; padding:7px 10px; font-weight:700;">${escapeHtml(row.monthLabel)}</td>
                  <td style="border:1px solid #cbd5e1; padding:7px 10px; text-align:right;">${money(row.basicSalary)}</td>
                  <td style="border:1px solid #cbd5e1; padding:7px 10px; text-align:right;">${money(row.benefitsNonCash)}</td>
                  <td style="border:1px solid #cbd5e1; padding:7px 10px; text-align:right;">${money(row.valueOfQuarters)}</td>
                  <td style="border:1px solid #cbd5e1; padding:7px 10px; text-align:right; font-weight:700;">${money(row.grossPay)}</td>
                  <td style="border:1px solid #cbd5e1; padding:7px 10px; text-align:right;">${money(row.e1)}</td>
                  <td style="border:1px solid #cbd5e1; padding:7px 10px; text-align:right;">${money(row.retirementContribution)}</td>
                  <td style="border:1px solid #cbd5e1; padding:7px 10px; text-align:right;">${money(row.e3)}</td>
                  <td style="border:1px solid #cbd5e1; padding:7px 10px; text-align:right;">${money(row.ownerOccupiedInterest)}</td>
                  <td style="border:1px solid #cbd5e1; padding:7px 10px; text-align:right;">${money(row.retirementContribution + row.ownerOccupiedInterest)}</td>
                  <td style="border:1px solid #cbd5e1; padding:7px 10px; text-align:right; font-weight:700;">${money(row.chargeablePay)}</td>
                  <td style="border:1px solid #cbd5e1; padding:7px 10px; text-align:right; font-weight:700;">${money(row.taxCharged)}</td>
                  <td style="border:1px solid #cbd5e1; padding:7px 10px; text-align:right;">${money(row.personalRelief)}</td>
                  <td style="border:1px solid #cbd5e1; padding:7px 10px; text-align:right;">${money(row.insuranceRelief)}</td>
                  <td style="border:1px solid #cbd5e1; padding:7px 10px; text-align:right; font-weight:700;">${money(row.payeTax)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </section>
        <section style="border:1px solid #cbd5e1; border-radius:20px; padding:18px;">
          <h3 style="margin:0 0 12px; font-size:16px;">Declaration and Signature</h3>
          <div style="display:grid; gap:12px; grid-template-columns:repeat(3, minmax(0, 1fr));">
            <div><strong>Employee</strong><br/>${escapeHtml(employee?.full_name || employeeName || '')}<br/>${escapeHtml(employeePin)}</div>
            <div><strong>Employer</strong><br/>${escapeHtml(employerName)}<br/>${escapeHtml(employerPin)}</div>
            <div><strong>Signed by</strong><br/>${escapeHtml(signatureName)}<br/>${escapeHtml(signatureDesignation)}</div>
          </div>
        </section>
      </div>
    `;
    printDocument({
      title: `P9A Tax Deduction Card - ${employee?.full_name || employeeName || 'Employee'}`,
      subtitle: `Tax year ${selectedYear}`,
      bodyHtml,
      footerHtml: `Generated from live payslip data for ${escapeHtml(employee?.full_name || employeeName || 'employee')}.`,
    });
  };

  if (loading) return <CustomLoader text="Loading P9A payroll data..." />;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.10),_transparent_30%),linear-gradient(180deg,#0b2435_0%,#071522_58%,#05101a_100%)] px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="overflow-hidden rounded-[36px] border border-white/10 bg-slate-900/82 shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl">
          <div className="border-b border-white/10 bg-white/[0.02] px-5 py-4">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100">
                    <Building2 size={12} /> Kenya Revenue Authority
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100">
                    <CheckCircle2 size={12} /> HR Live Payroll
                  </span>
                </div>
                <h1 className="text-3xl font-black tracking-tight text-white">P9A Tax Deduction Card</h1>
                <p className="max-w-4xl text-sm leading-6 text-slate-300">
                  Structured to mirror the KRA P9A layout, with employee selection and month-by-month payslip mapping.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => void loadPayslips()} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-semibold text-slate-100 shadow-sm hover:bg-white/[0.08]">
                  <RefreshCw className="h-4 w-4" /> Refresh Live Data
                </button>
                <button onClick={printP9A} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-semibold text-slate-100 shadow-sm hover:bg-white/[0.08]">
                  <Printer className="h-4 w-4" /> Print
                </button>
                <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-3.5 py-2 text-sm font-semibold text-slate-950 shadow-sm hover:bg-cyan-400">
                  <Download className="h-4 w-4" /> Export CSV
                </button>
                <button onClick={() => setRows(emptyRows())} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-semibold text-slate-100 shadow-sm hover:bg-white/[0.08]">
                  <RotateCcw className="h-4 w-4" /> Reset
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6 px-5 py-5">
            <section className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/70 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
              <div className="border-b border-white/10 px-5 py-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2 xl:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Employee</label>
                    <select className={inputCls} value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.full_name || employee.employee_no || employee.id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Employer name</label>
                    <input className={inputCls} value={employerName} onChange={(e) => setEmployerName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Employer PIN</label>
                    <input className={inputCls} value={employerPin} onChange={(e) => setEmployerPin(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Tax year</label>
                    <input className={inputCls} value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} />
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Employee name</label>
                    <input className={inputCls} value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Employee PIN</label>
                    <input className={inputCls} value={employeePin} onChange={(e) => setEmployeePin(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">KRA Branch / Office</label>
                    <input className={inputCls} value={kraBranch} onChange={(e) => setKraBranch(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="overflow-auto">
                <table className="min-w-[1500px] w-full border-collapse text-[11px]">
                  <thead className="sticky top-0 z-10 bg-slate-800 text-slate-200">
                    <tr>
                      <th className="border border-slate-700 px-2 py-1.5 text-left font-black uppercase tracking-[0.16em]">Month</th>
                      <th className="border border-slate-700 px-2 py-1.5 text-left font-black uppercase tracking-[0.16em]">Basic Salary</th>
                      <th className="border border-slate-700 px-2 py-1.5 text-left font-black uppercase tracking-[0.16em]">Ben. Non-Cash</th>
                      <th className="border border-slate-700 px-2 py-1.5 text-left font-black uppercase tracking-[0.16em]">Quarters</th>
                      <th className="border border-slate-700 px-2 py-1.5 text-left font-black uppercase tracking-[0.16em]">Gross Pay</th>
                      <th className="border border-slate-700 px-2 py-1.5 text-left font-black uppercase tracking-[0.16em]">30% A</th>
                      <th className="border border-slate-700 px-2 py-1.5 text-left font-black uppercase tracking-[0.16em]">Retire.</th>
                      <th className="border border-slate-700 px-2 py-1.5 text-left font-black uppercase tracking-[0.16em]">Fixed</th>
                      <th className="border border-slate-700 px-2 py-1.5 text-left font-black uppercase tracking-[0.16em]">O/O Interest</th>
                      <th className="border border-slate-700 px-2 py-1.5 text-left font-black uppercase tracking-[0.16em]">Ret + Int.</th>
                      <th className="border border-slate-700 px-2 py-1.5 text-left font-black uppercase tracking-[0.16em]">Chargeable</th>
                      <th className="border border-slate-700 px-2 py-1.5 text-left font-black uppercase tracking-[0.16em]">Tax</th>
                      <th className="border border-slate-700 px-2 py-1.5 text-left font-black uppercase tracking-[0.16em]">Pers. Relief</th>
                      <th className="border border-slate-700 px-2 py-1.5 text-left font-black uppercase tracking-[0.16em]">Ins. Relief</th>
                      <th className="border border-slate-700 px-2 py-1.5 text-left font-black uppercase tracking-[0.16em]">PAYE Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => (
                      <tr key={row.month} className="odd:bg-slate-900/90 even:bg-slate-950/70">
                        <td className="border border-slate-800 px-2 py-1.5 font-black uppercase tracking-[0.14em] text-slate-100">{row.monthLabel}</td>
                        <td className="border border-slate-800 px-2 py-1.5 text-right text-slate-200">{money(row.basicSalary)}</td>
                        <td className="border border-slate-800 px-2 py-1.5 text-right text-slate-200">{money(row.benefitsNonCash)}</td>
                        <td className="border border-slate-800 px-2 py-1.5 text-right text-slate-200">{money(row.valueOfQuarters)}</td>
                        <td className="border border-slate-800 px-2 py-1.5 text-right font-semibold text-white">{money(row.grossPay)}</td>
                        <td className="border border-slate-800 px-2 py-1.5 text-right text-slate-200">{money(row.e1)}</td>
                        <td className="border border-slate-800 px-2 py-1.5 text-right text-slate-200">{money(row.retirementContribution)}</td>
                        <td className="border border-slate-800 px-2 py-1.5 text-right text-slate-200">{money(row.e3)}</td>
                        <td className="border border-slate-800 px-2 py-1.5 text-right text-slate-200">{money(row.ownerOccupiedInterest)}</td>
                        <td className="border border-slate-800 px-2 py-1.5 text-right text-slate-200">{money(row.retirementContribution + row.ownerOccupiedInterest)}</td>
                        <td className="border border-slate-800 px-2 py-1.5 text-right font-semibold text-white">{money(row.chargeablePay)}</td>
                        <td className="border border-slate-800 px-2 py-1.5 text-right font-semibold text-cyan-300">{money(row.taxCharged)}</td>
                        <td className="border border-slate-800 px-2 py-1.5 text-right text-slate-200">{money(row.personalRelief)}</td>
                        <td className="border border-slate-800 px-2 py-1.5 text-right text-slate-200">{money(row.insuranceRelief)}</td>
                        <td className="border border-slate-800 px-2 py-1.5 text-right font-semibold text-white">{money(row.payeTax)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-cyan-500/10 text-white">
                    <tr className="bg-cyan-500/8">
                      <td className="border border-cyan-400/30 px-2 py-2 font-black uppercase tracking-[0.18em] text-cyan-100">Totals</td>
                      <td className="border border-cyan-400/30 px-2 py-2 text-right text-cyan-100">{money(tableRows.reduce((sum, row) => sum + row.basicSalary, 0))}</td>
                      <td className="border border-cyan-400/30 px-2 py-2 text-right text-cyan-100">{money(tableRows.reduce((sum, row) => sum + row.benefitsNonCash, 0))}</td>
                      <td className="border border-cyan-400/30 px-2 py-2 text-right text-cyan-100">{money(tableRows.reduce((sum, row) => sum + row.valueOfQuarters, 0))}</td>
                      <td className="border border-cyan-400/30 px-2 py-2 text-right text-cyan-100">{money(totals.grossPay)}</td>
                      <td className="border border-cyan-400/30 px-2 py-2 text-right text-cyan-100">{money(totals.e1)}</td>
                      <td className="border border-cyan-400/30 px-2 py-2 text-right text-cyan-100">{money(totals.e2)}</td>
                      <td className="border border-cyan-400/30 px-2 py-2 text-right text-cyan-100">{money(totals.e3)}</td>
                      <td className="border border-cyan-400/30 px-2 py-2 text-right text-cyan-100">{money(tableRows.reduce((sum, row) => sum + row.ownerOccupiedInterest, 0))}</td>
                      <td className="border border-cyan-400/30 px-2 py-2 text-right text-cyan-100">{money(tableRows.reduce((sum, row) => sum + row.retirementContribution + row.ownerOccupiedInterest, 0))}</td>
                      <td className="border border-cyan-400/30 px-2 py-2 text-right text-cyan-100">{money(totals.chargeablePay)}</td>
                      <td className="border border-cyan-400/30 px-2 py-2 text-right text-white">{money(totals.taxCharged)}</td>
                      <td className="border border-cyan-400/30 px-2 py-2 text-right text-cyan-100">{money(totals.personalRelief)}</td>
                      <td className="border border-cyan-400/30 px-2 py-2 text-right text-cyan-100">{money(totals.insuranceRelief)}</td>
                      <td className="border border-cyan-400/30 px-2 py-2 text-right text-white">{money(totals.payeTax)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/80 shadow-[0_16px_50px_rgba(0,0,0,0.28)]">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-lg font-black tracking-tight text-white">Declaration and Signature</h2>
            <p className="mt-1 text-sm text-slate-300">KRA-style declaration area for the employee and employer sign-off.</p>
          </div>
          <div className="grid gap-5 px-5 py-5 lg:grid-cols-3">
            <div className="space-y-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.18)]">
              <div className="flex items-center gap-2 text-slate-100">
                <Landmark size={16} className="text-brand-purple" />
                <span className="text-sm font-bold">Mortgage / Housing Details</span>
              </div>
              <input className={inputCls} value={financingInstitution} onChange={(e) => setFinancingInstitution(e.target.value)} placeholder="Names of financial institution" />
              <input className={inputCls} value={lrNumber} onChange={(e) => setLrNumber(e.target.value)} placeholder="L.R. No. of occupied property" />
              <input className={inputCls} value={houseOccupationDate} onChange={(e) => setHouseOccupationDate(e.target.value)} placeholder="Date of occupation" />
            </div>
            <div className="space-y-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.18)]">
              <div className="flex items-center gap-2 text-slate-100">
                <User size={16} className="text-brand-purple" />
                <span className="text-sm font-bold">Employee Declaration</span>
              </div>
              <input className={inputCls} value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} placeholder="Employee name" />
              <input className={inputCls} value={employeePin} onChange={(e) => setEmployeePin(e.target.value)} placeholder="Employee PIN" />
              <div className="rounded-xl border border-dashed border-white/10 px-4 py-3 text-xs text-slate-300">
                I certify that the information entered above is true and complete to the best of my knowledge.
              </div>
            </div>
            <div className="space-y-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_14px_40px_rgba(0,0,0,0.18)]">
              <div className="flex items-center gap-2 text-slate-100">
                <Building2 size={16} className="text-brand-purple" />
                <span className="text-sm font-bold">Employer Certification</span>
              </div>
              <input className={inputCls} value={signatureName} onChange={(e) => setSignatureName(e.target.value)} placeholder="Signed by" />
              <input className={inputCls} value={signatureDesignation} onChange={(e) => setSignatureDesignation(e.target.value)} placeholder="Designation" />
              <input className={inputCls} value={employerName} onChange={(e) => setEmployerName(e.target.value)} placeholder="Employer name" />
            </div>
          </div>
          <div className="border-t border-white/10 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-300">
                Each month is pulled from that employee's payslips. Use the employee selector to print a separate form per staff member.
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-3.5 py-2 text-sm font-semibold text-slate-950 shadow-sm hover:bg-cyan-400">
                  <Save className="h-4 w-4" /> Save CSV
                </button>
                <button onClick={printP9A} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-semibold text-slate-100 hover:bg-white/[0.08]">
                  <Printer className="h-4 w-4" /> Print
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast ? <CustomToast message={toast.message} type={toast.type} isVisible onClose={() => setToast(null)} /> : null}
    </div>
  );
}
