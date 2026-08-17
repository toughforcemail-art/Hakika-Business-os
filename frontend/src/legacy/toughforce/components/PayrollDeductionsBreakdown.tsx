// @ts-nocheck
import React from 'react';
import { PayrollDeductions, formatCurrency, getDeductionBreakdown, getEmployerContributionBreakdown } from '../utils/payrollCalculator';

interface PayrollDeductionsBreakdownProps {
  deductions: PayrollDeductions;
  showEmployerContributions?: boolean;
}

const PayrollDeductionsBreakdown: React.FC<PayrollDeductionsBreakdownProps> = ({
  deductions,
  showEmployerContributions = false
}) => {
  const employeeBreakdown = getDeductionBreakdown(deductions);
  const employerBreakdown = getEmployerContributionBreakdown(deductions);

  return (
    <div className="space-y-6">
      {/* Gross Salary */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">Gross Salary</span>
          <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {formatCurrency(deductions.taxableIncome + deductions.nssfEmployee + deductions.shaContribution + deductions.housingLevyEmployee)}
          </span>
        </div>
      </div>

      {/* Employee Deductions */}
      <div className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#1e293b] rounded-lg overflow-hidden">
        <div className="bg-gray-50 dark:bg-[#0A1628] px-6 py-3 border-b border-gray-200 dark:border-[#1e293b]">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Employee Deductions</h3>
        </div>
        <div className="p-6 space-y-3">
          {employeeBreakdown.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center">
              <span className={`text-gray-700 dark:text-gray-300 ${item.isBold ? 'font-semibold' : ''}`}>
                {item.label}
              </span>
              <span className={`font-mono ${item.isBold ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                {formatCurrency(item.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Tax Reliefs */}
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-green-900 dark:text-green-300 mb-3">Tax Reliefs Applied</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-green-700 dark:text-green-400">Personal Relief</span>
            <span className="font-mono text-green-700 dark:text-green-400">{formatCurrency(deductions.personalRelief)}</span>
          </div>
          {deductions.insuranceRelief > 0 && (
            <div className="flex justify-between">
              <span className="text-green-700 dark:text-green-400">Insurance Relief</span>
              <span className="font-mono text-green-700 dark:text-green-400">{formatCurrency(deductions.insuranceRelief)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Net Salary */}
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-gray-900 dark:text-white">Net Salary (Take Home)</span>
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(deductions.netSalary)}
          </span>
        </div>
      </div>

      {/* Employer Contributions */}
      {showEmployerContributions && (
        <div className="bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-[#1e293b] rounded-lg overflow-hidden">
          <div className="bg-gray-50 dark:bg-[#0A1628] px-6 py-3 border-b border-gray-200 dark:border-[#1e293b]">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Employer Contributions</h3>
          </div>
          <div className="p-6 space-y-3">
            {employerBreakdown.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span className={`text-gray-700 dark:text-gray-300 ${item.isBold ? 'font-semibold' : ''}`}>
                  {item.label}
                </span>
                <span className={`font-mono ${item.isBold ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                  {formatCurrency(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deduction Details */}
      <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-[#1e293b] rounded-lg p-4 text-xs text-gray-600 dark:text-gray-400 space-y-1">
        <p><strong>NSSF:</strong> 6% employee + 6% employer on earnings up to KES 108,000</p>
        <p><strong>SHA:</strong> 2.75% of gross salary (minimum KES 300)</p>
        <p><strong>Housing Levy:</strong> 1.5% employee + 1.5% employer on gross salary</p>
        <p><strong>PAYE:</strong> Progressive tax after deductions and reliefs</p>
        <p><strong>Personal Relief:</strong> KES 2,400 monthly deduction from tax</p>
      </div>
    </div>
  );
};

export default PayrollDeductionsBreakdown;
