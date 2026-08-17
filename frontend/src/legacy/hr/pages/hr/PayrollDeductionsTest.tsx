// @ts-nocheck
import React, { useState } from 'react';
import { Calculator } from 'lucide-react';
import { calculateCompletePayroll, formatCurrency } from '../../utils/payrollCalculator';
import PayrollDeductionsBreakdown from '../../components/PayrollDeductionsBreakdown';
import Toast from '../../components/Toast';

const PayrollDeductionsTest: React.FC = () => {
  const [grossSalary, setGrossSalary] = useState<number>(50000);
  const [insurancePremium, setInsurancePremium] = useState<number>(0);
  const [deductions, setDeductions] = useState(calculateCompletePayroll(50000));
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleCalculate = () => {
    if (grossSalary <= 0) {
      setToast({ message: 'Gross salary must be greater than 0', type: 'error' });
      return;
    }
    const result = calculateCompletePayroll(grossSalary, insurancePremium);
    setDeductions(result);
    setToast({ message: 'Payroll calculated successfully', type: 'success' });
  };

  const testCases = [
    { salary: 25000, label: 'KES 25,000' },
    { salary: 50000, label: 'KES 50,000' },
    { salary: 100000, label: 'KES 100,000' },
    { salary: 150000, label: 'KES 150,000' },
    { salary: 200000, label: 'KES 200,000' }
  ];

  const handleTestCase = (salary: number) => {
    setGrossSalary(salary);
    const result = calculateCompletePayroll(salary, insurancePremium);
    setDeductions(result);
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-[#020817] min-h-screen">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Calculator className="w-8 h-8" />
          Kenya Payroll Deductions Calculator
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">Test and verify payroll calculations (2026 Rates)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Section */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#1e293b] rounded-lg p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Gross Salary (KES)
              </label>
              <input
                type="number"
                value={grossSalary}
                onChange={(e) => setGrossSalary(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg dark:bg-[#0A1628] dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Insurance Premium (KES) - Optional
              </label>
              <input
                type="number"
                value={insurancePremium}
                onChange={(e) => setInsurancePremium(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-[#1e293b] rounded-lg dark:bg-[#0A1628] dark:text-white"
              />
            </div>

            <button
              onClick={handleCalculate}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Calculate
            </button>

            {/* Test Cases */}
            <div className="pt-4 border-t border-gray-200 dark:border-[#1e293b]">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Quick Test Cases</p>
              <div className="space-y-2">
                {testCases.map((testCase) => (
                  <button
                    key={testCase.salary}
                    onClick={() => handleTestCase(testCase.salary)}
                    className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-[#0A1628] text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-[#1e293b] transition"
                  >
                    {testCase.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="space-y-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Gross Salary</p>
              <p className="text-xl font-bold text-blue-900 dark:text-blue-300">
                {formatCurrency(grossSalary)}
              </p>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-xs text-red-600 dark:text-red-400 mb-1">Total Deductions</p>
              <p className="text-xl font-bold text-red-900 dark:text-red-300">
                {formatCurrency(deductions.totalEmployeeDeductions)}
              </p>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Net Salary</p>
              <p className="text-xl font-bold text-emerald-900 dark:text-emerald-300">
                {formatCurrency(deductions.netSalary)}
              </p>
            </div>
          </div>
        </div>

        {/* Breakdown Section */}
        <div className="lg:col-span-2">
          <PayrollDeductionsBreakdown deductions={deductions} showEmployerContributions={true} />
        </div>
      </div>

      {/* Calculation Details */}
      <div className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#1e293b] rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Calculation Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">NSSF Calculation</h3>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <p>Tier 1 (0 - 9,000): 6% = {formatCurrency(Math.min(grossSalary, 9000) * 0.06)}</p>
              <p>
                Tier 2 (9,001 - 108,000): 6% = {formatCurrency(
                  Math.max(0, Math.min(grossSalary - 9000, 99000)) * 0.06
                )}
              </p>
              <p className="font-semibold text-gray-900 dark:text-white">
                Total: {formatCurrency(deductions.nssfEmployee)} (Employee) + {formatCurrency(deductions.nssfEmployer)} (Employer)
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">SHA Calculation</h3>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <p>Rate: 2.75% of gross salary</p>
              <p>Calculated: {formatCurrency(grossSalary * 0.0275)}</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                Applied: {formatCurrency(deductions.shaContribution)} (minimum KES 300)
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Housing Levy</h3>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <p>Rate: 1.5% employee + 1.5% employer</p>
              <p>Employee: {formatCurrency(deductions.housingLevyEmployee)}</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                Employer: {formatCurrency(deductions.housingLevyEmployer)}
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">PAYE Tax</h3>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <p>Taxable Income: {formatCurrency(deductions.taxableIncome)}</p>
              <p>Tax Before Relief: {formatCurrency(deductions.payeTax + deductions.personalRelief)}</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                After Relief: {formatCurrency(deductions.payeTax)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Information Box */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
        <h3 className="font-semibold text-amber-900 dark:text-amber-300 mb-3">2026 Kenya Payroll Rates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-amber-800 dark:text-amber-400">
          <div>
            <p><strong>NSSF:</strong> 6% employee + 6% employer (capped at KES 108,000)</p>
            <p><strong>SHA:</strong> 2.75% of gross (minimum KES 300)</p>
          </div>
          <div>
            <p><strong>Housing Levy:</strong> 1.5% employee + 1.5% employer</p>
            <p><strong>Personal Relief:</strong> KES 2,400 monthly</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayrollDeductionsTest;
