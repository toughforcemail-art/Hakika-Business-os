// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowRight, FileText, Search, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CustomLoader from '../../components/CustomLoader';
import CustomToast from '../../components/CustomToast';
import { supabase } from '../../utils/supabase';

interface EmployeeOption {
  id: string;
  employee_no: string | null;
  full_name: string | null;
  salary: number | null;
  department: string | null;
  designation: string | null;
}

const PayrollOverview: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'warning' | 'error' } | null>(null);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId],
  );

  useEffect(() => {
    const loadEmployees = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, employee_no, full_name, salary, department, designation')
          .eq('status', 'active')
          .order('full_name', { ascending: true });

        if (error) throw error;

        const nextEmployees = (data || []) as EmployeeOption[];
        setEmployees(nextEmployees);
        setSelectedEmployeeId((current) => current || nextEmployees[0]?.id || '');
      } catch (error: any) {
        setToast({ message: error.message || 'Failed to load employees.', type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    void loadEmployees();
  }, []);

  if (loading) return <CustomLoader label="Loading payroll overview..." />;

  return (
    <div className="min-h-screen bg-slate-50 p-6 dark:bg-dark-surface lg:p-10">
      {toast ? <CustomToast isVisible message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}

      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-dark-surface/90">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-brand-purple">HR Payroll</p>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900">Payroll Overview</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Pick an employee, check the salary currently saved in profiles, then jump into payroll processing or P9A.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/app/hr/payroll/p9a')}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-800 transition hover:border-brand-purple/30 hover:text-brand-purple dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
              >
                P9A Form <FileText size={14} />
              </button>
              <button
                onClick={() => navigate('/app/hr/payroll/payroll')}
                className="inline-flex items-center gap-2 rounded-2xl bg-brand-purple px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-brand-purple/20 transition hover:bg-brand-pink"
              >
                Open Payroll <Activity size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-dark-surface/90">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Employee</p>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-10 py-3 text-slate-900 outline-none transition focus:border-brand-purple/40 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
              >
                <option value="">Select an employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.employee_no ? `${employee.employee_no} - ` : ''}
                    {employee.full_name || 'Unnamed employee'}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            </div>

            {selectedEmployee ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Selected Employee</p>
                    <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{selectedEmployee.full_name || 'Unknown'}</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-300">{selectedEmployee.employee_no || 'No employee number'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/app/hr/payroll/payroll')}
                    className="inline-flex items-center gap-2 rounded-2xl bg-brand-purple px-4 py-2.5 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:bg-brand-pink"
                  >
                    Continue <ArrowRight size={14} />
                  </button>
                </div>
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white p-4 dark:bg-white/[0.03]">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Department</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{selectedEmployee.department || '-'}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 dark:bg-white/[0.03]">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Designation</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{selectedEmployee.designation || '-'}</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 sm:col-span-2 dark:bg-white/[0.03]">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Saved Salary</p>
                    <p className="mt-2 text-lg font-black text-brand-purple">
                      KES {(selectedEmployee.salary || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm dark:border-white/10 dark:from-dark-surface/90 dark:to-dark-surface">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Overview</p>
            <div className="mt-4 space-y-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
              <p>This page is a clean entry point into payroll, not a dashboard.</p>
              <p>Choose an employee here, then open the payroll workspace to select a date range and generate payslips.</p>
              <p>The salary shown here comes from the employee profile record stored in Supabase.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayrollOverview;
