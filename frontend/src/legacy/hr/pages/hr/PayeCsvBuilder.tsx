// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, FileText, Printer, Search, Wand2 } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { calculateCompletePayroll } from '../../utils/payrollCalculator';
import { printWorkspacePage } from '../../utils/printHelpers';

type EmployeeRecord = {
  id: string;
  employee_no: string | null;
  full_name: string | null;
  salary: number | null;
  salary_source?: string | null;
  department: string | null;
  designation: string | null;
};

type AdditionRecord = {
  employee_id: string;
  addition_type: string;
  amount: number | null;
  approved_by: string | null;
};

type BenefitRecord = {
  employee_id: string;
  benefit_type: string;
  taxable_value: number | null;
};

type AdvanceRecord = {
  employee_id: string;
  amount: number | null;
  deduction_amount: number | null;
  deduction_payroll_id: string | null;
  status: string | null;
};

type PayrollSummaryRow = {
  basicSalary: number;
  incentives: number;
  noncashBenefits: number;
  untaxedAddition: number;
  grossPay: number;
  nssfTier1: number;
  tier2: number;
  nssfTotal: number;
  shif: number;
  housingLevy: number;
  taxablePay: number;
  incomeTax: number;
  personalRelief: number;
  paye: number;
  salaryAdvance: number;
  netPay: number;
};

const money = (value: number) =>
  `KES ${new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)}`;

const parseSalary = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const createSummary = (
  employee: EmployeeRecord,
  additions: AdditionRecord[],
  benefits: BenefitRecord[],
  advances: AdvanceRecord[],
): PayrollSummaryRow => {
  const basicSalary = parseSalary(employee.salary);
  const incentives = additions
    .filter((item) => /allowance|bonus|incentive|commission|overtime/i.test(item.addition_type))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const untaxedAddition = additions
    .filter((item) => /airtime|reimbursement|refund|untaxed|non.?taxable/i.test(item.addition_type))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const noncashBenefits = benefits.reduce((sum, item) => sum + Number(item.taxable_value || 0), 0);
  const grossPay = basicSalary + incentives + noncashBenefits;
  const calc = calculateCompletePayroll(grossPay);
  const nssfTier1 = Math.min(grossPay, 9000) * 0.06;
  const nssfTier2 = grossPay > 9000 ? Math.min(grossPay - 9000, 99000) * 0.06 : 0;
  const nssfTotal = nssfTier1 + nssfTier2;
  const salaryAdvance = advances
    .filter((item) => item.status === 'approved')
    .reduce((sum, item) => sum + Number(item.deduction_amount ?? item.amount ?? 0), 0);
  const taxablePay = grossPay - nssfTotal - calc.shaContribution - calc.housingLevyEmployee;
  const incomeTax = calc.payeTax + calc.personalRelief;
  const paye = calc.payeTax;
  const netPay = grossPay - nssfTotal - calc.shaContribution - calc.housingLevyEmployee - paye - salaryAdvance;

  return {
    basicSalary,
    incentives,
    noncashBenefits,
    untaxedAddition,
    grossPay,
    nssfTier1,
    tier2: nssfTier2,
    nssfTotal,
    shif: calc.shaContribution,
    housingLevy: calc.housingLevyEmployee,
    taxablePay,
    incomeTax,
    personalRelief: calc.personalRelief,
    paye,
    salaryAdvance,
    netPay,
  };
};

const PayrollRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4 border-b border-dashed border-slate-200 py-2 last:border-0 dark:border-white/10">
    <span className="text-sm text-slate-500 dark:text-slate-300">{label}</span>
    <span className="text-sm font-semibold text-slate-900 dark:text-white">{value}</span>
  </div>
);

export default function PayeCsvBuilder() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [additions, setAdditions] = useState<AdditionRecord[]>([]);
  const [benefits, setBenefits] = useState<BenefitRecord[]>([]);
  const [advances, setAdvances] = useState<AdvanceRecord[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId],
  );
  const summary = useMemo(
    () => (selectedEmployee ? createSummary(
      selectedEmployee,
      additions.filter((item) => item.employee_id === selectedEmployee.id),
      benefits.filter((item) => item.employee_id === selectedEmployee.id),
      advances.filter((item) => item.employee_id === selectedEmployee.id),
    ) : null),
    [selectedEmployee, additions, benefits, advances],
  );
  const rangeLabel = periodFrom && periodTo
    ? `${new Date(periodFrom).toLocaleDateString('en-KE')} to ${new Date(periodTo).toLocaleDateString('en-KE')}`
    : 'No range selected';

  const loadInitial = async () => {
    setLoading(true);
    try {
      const [employeeRes] = await Promise.all([
        supabase.from('profiles').select('id, employee_no, full_name, salary, department, designation').eq('status', 'active').order('full_name', { ascending: true }),
      ]); 
      if (employeeRes.error) throw employeeRes.error;

      const nextEmployees = (employeeRes.data || []) as EmployeeRecord[];
      setEmployees(nextEmployees.map((employee) => ({
        ...employee,
        salary: parseSalary(employee.salary),
      })));
      setSelectedEmployeeId(nextEmployees[0]?.id || '');
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to load payroll data.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadEmployeePayroll = async () => {
    if (!selectedEmployeeId) {
      setToast({ message: 'Select an employee first.', type: 'error' });
      return;
    }
    if (!periodFrom || !periodTo) {
      setToast({ message: 'Select a payroll date range first.', type: 'error' });
      return;
    }
    try {
      const effectiveSalary = await loadEffectiveSalary();
      const [additionRes, benefitRes, advanceRes] = await Promise.all([
        supabase.from('payroll_additions').select('employee_id, addition_type, amount, approved_by, created_at').eq('employee_id', selectedEmployeeId).gte('created_at', periodFrom).lte('created_at', periodTo),
        supabase.from('non_cash_benefits').select('employee_id, benefit_type, taxable_value, created_at').eq('employee_id', selectedEmployeeId).gte('created_at', periodFrom).lte('created_at', periodTo),
        supabase.from('salary_advances').select('employee_id, amount, deduction_amount, deduction_payroll_id, status, approved_at').eq('employee_id', selectedEmployeeId).eq('status', 'approved').gte('approved_at', periodFrom).lte('approved_at', periodTo),
      ]);
      if (additionRes.error) throw additionRes.error;
      if (benefitRes.error) throw benefitRes.error;
      if (advanceRes.error) throw advanceRes.error;
      setEmployees((current) => current.map((employee) => (
        employee.id === selectedEmployeeId
          ? { ...employee, salary: effectiveSalary.salary, salary_source: effectiveSalary.salary_source }
          : employee
      )));
      setAdditions((additionRes.data || []) as AdditionRecord[]);
      setBenefits((benefitRes.data || []) as BenefitRecord[]);
      setAdvances((advanceRes.data || []) as AdvanceRecord[]);
      setToast({ message: 'Payroll loaded for selected employee.', type: 'success' });
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to load employee payroll.', type: 'error' });
    }
  };

  const loadEffectiveSalary = async () => {
    const { data, error } = await supabase.rpc('get_employee_effective_salary', {
      p_employee_id: selectedEmployeeId,
        p_payroll_period_id: null,
      });

    if (error) throw error;

    const firstRow = Array.isArray(data) ? data[0] : data;
    return {
      salary: parseSalary(firstRow?.salary ?? firstRow?.basic_salary ?? firstRow?.effective_salary ?? 0),
      salary_source: String(firstRow?.salary_source ?? firstRow?.source ?? ''),
    };
  };

  const generatePayslip = async () => {
    if (!selectedEmployee || !summary) {
      setToast({ message: 'Load an employee first.', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        employee_id: selectedEmployee.id,
        month: new Date(periodFrom).getMonth() + 1,
        year: new Date(periodFrom).getFullYear(),
        basic_salary: summary.basicSalary,
        gross_pay: summary.grossPay,
        deductions: summary.nssfTotal + summary.shif + summary.housingLevy + summary.paye + summary.salaryAdvance,
        net_pay: summary.netPay,
        status: 'draft',
      };
      const { error } = await supabase.from('hr_payslips').upsert(payload, { onConflict: 'employee_id,month,year' });
      if (error) throw error;
      setToast({ message: 'Payslip generated.', type: 'success' });
    } catch (error: any) {
      setToast({ message: error.message || 'Failed to generate payslip.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const printPayslip = () => {
    if (!selectedEmployee || !summary) {
      setToast({ message: 'Load an employee first.', type: 'error' });
      return;
    }
    const w = window.open('', '_blank', 'width=1100,height=900');
    if (!w) return;
    w.document.write(`
      <html><head><title>Payslip</title>
      <style>
        body{font-family:Arial,sans-serif;padding:32px;color:#0f172a}
        .card{border:1px solid #cbd5e1;border-radius:20px;padding:20px;margin-bottom:16px}
        .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #e2e8f0}
        .row:last-child{border-bottom:0}
      </style></head><body>
      <div class="card"><h1>Payslip</h1><div>${selectedEmployee.full_name || ''}</div><div>${selectedEmployee.employee_no || ''}</div></div>
      <div class="card">
        <div class="row"><span>Basic Salary</span><strong>${money(summary.basicSalary)}</strong></div>
        <div class="row"><span>Incentives</span><strong>${money(summary.incentives)}</strong></div>
        <div class="row"><span>Noncash Benefits</span><strong>${money(summary.noncashBenefits)}</strong></div>
        <div class="row"><span>Untaxed Addition</span><strong>${money(summary.untaxedAddition)}</strong></div>
        <div class="row"><span>Gross Pay</span><strong>${money(summary.grossPay)}</strong></div>
        <div class="row"><span>NSSF</span><strong>${money(summary.nssfTotal)}</strong></div>
        <div class="row"><span>SHIF</span><strong>${money(summary.shif)}</strong></div>
        <div class="row"><span>Housing Levy</span><strong>${money(summary.housingLevy)}</strong></div>
        <div class="row"><span>Income Tax</span><strong>${money(summary.incomeTax)}</strong></div>
        <div class="row"><span>Personal Relief</span><strong>${money(summary.personalRelief)}</strong></div>
        <div class="row"><span>PAYE</span><strong>${money(summary.paye)}</strong></div>
        <div class="row"><span>Salary Advance</span><strong>${money(summary.salaryAdvance)}</strong></div>
        <div class="row"><span>Net Pay</span><strong>${money(summary.netPay)}</strong></div>
      </div>
      <script>window.print();</script>
      </body></html>
    `);
    w.document.close();
  };

  useEffect(() => {
    void loadInitial();
  }, []);

  useEffect(() => {
    if (!selectedEmployeeId) return;

    void (async () => {
      try {
        const effectiveSalary = await loadEffectiveSalary();
        setEmployees((current) => current.map((employee) => (
          employee.id === selectedEmployeeId
            ? { ...employee, salary: effectiveSalary.salary, salary_source: effectiveSalary.salary_source }
            : employee
        )));
      } catch {
        // Let the explicit Load Payroll action surface the error if needed.
      }
    })();
  }, [selectedEmployeeId, periodFrom, periodTo]);

  if (loading) return <CustomLoader label="Loading payroll..." />;

  return (
    <div className="min-h-screen bg-slate-50 p-6 dark:bg-dark-surface lg:p-8">
      {toast ? <CustomToast message={toast.message} type={toast.type} isVisible onClose={() => setToast(null)} /> : null}
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-brand-purple">HR Payroll</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">Payroll</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              Select a date range and employee, then load salary, deductions, reliefs, generate a payslip, and print it.
            </p>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Range: {rangeLabel}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void loadEmployeePayroll()} className="inline-flex items-center gap-2 rounded-2xl bg-brand-purple px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-pink">
              <Wand2 size={16} /> Load Payroll
            </button>
            <button type="button" onClick={generatePayslip} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-purple/30 hover:text-brand-purple dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100">
              <FileText size={16} /> {saving ? 'Generating...' : 'Generate Payslip'}
            </button>
            <button type="button" onClick={printPayslip} className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-purple/30 hover:text-brand-purple dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100">
              <Printer size={16} /> Print Payslip
            </button>
            <button type="button" onClick={() => printWorkspacePage()} className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-purple/30 hover:text-brand-purple dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100">
              <Printer size={16} /> Print Page
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Payroll Date Range</p>
                <p className="mt-1 text-sm text-slate-500">Filter the selected employee by start and end date.</p>
              </div>
              <div className="rounded-2xl bg-brand-purple/10 px-3 py-2 text-xs font-semibold text-brand-purple">
                <CalendarDays size={14} className="mr-1 inline-block" />
                Range filter
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Date From</label>
                <input
                  type="date"
                  value={periodFrom}
                  onChange={(e) => setPeriodFrom(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Date To</label>
                <input
                  type="date"
                  value={periodTo}
                  onChange={(e) => setPeriodTo(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
                />
              </div>
            </div>
            <p className="mt-3 text-[11px] text-slate-500">Use any dates you want. The payroll will load for that selected range and employee.</p>
          </div>
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-dark-surface/90">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Employee</p>
            <div className="relative mt-2">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="Search employee"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-10 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
            </div>
            <div className="relative mt-3">
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full appearance-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                <option value="">Select employee</option>
                {employees.filter((employee) => {
                  const q = employeeSearch.trim().toLowerCase();
                  if (!q) return true;
                  return `${employee.employee_no || ''} ${employee.full_name || ''}`.toLowerCase().includes(q);
                }).map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.employee_no ? `${employee.employee_no} - ` : ''}{employee.full_name || 'Unnamed employee'}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            </div>
          </div>
        </div>

        {selectedEmployee ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-dark-surface/90">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Employee Details</p>
              <div className="mt-3 space-y-2">
                <PayrollRow label="Name" value={selectedEmployee.full_name || '-'} />
                <PayrollRow label="Employee No" value={selectedEmployee.employee_no || '-'} />
                <PayrollRow label="Department" value={selectedEmployee.department || '-'} />
                <PayrollRow label="Designation" value={selectedEmployee.designation || '-'} />
                <PayrollRow label="Salary" value={money(Number(selectedEmployee.salary || 0))} />
                <PayrollRow label="Salary Source" value={selectedEmployee.salary_source || 'profiles.salary'} />
              </div>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-dark-surface/90">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Payroll Summary</p>
              {summary ? (
                <div className="mt-3 space-y-2">
                  <PayrollRow label="Incentives" value={money(summary.incentives)} />
                  <PayrollRow label="Noncash Benefits" value={money(summary.noncashBenefits)} />
                  <PayrollRow label="Untaxed Addition" value={money(summary.untaxedAddition)} />
                  <PayrollRow label="Gross Pay" value={money(summary.grossPay)} />
                  <PayrollRow label="NSSF" value={money(summary.nssfTotal)} />
                  <PayrollRow label="SHIF" value={money(summary.shif)} />
                  <PayrollRow label="Housing Levy" value={money(summary.housingLevy)} />
                  <PayrollRow label="Personal Relief" value={money(summary.personalRelief)} />
                  <PayrollRow label="PAYE" value={money(summary.paye)} />
                  <PayrollRow label="Salary Advance" value={money(summary.salaryAdvance)} />
                  <PayrollRow label="Net Pay" value={money(summary.netPay)} />
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">Load the payroll for the selected employee and period to see deductions and reliefs.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
