// @ts-nocheck
/**
 * Kenya Payroll Deductions Calculator (2026 Rates)
 * Implements NSSF, SHA, Housing Levy, PAYE, and Tax Reliefs
 */

export interface PayrollDeductions {
  nssfEmployee: number;
  nssfEmployer: number;
  shaContribution: number;
  housingLevyEmployee: number;
  housingLevyEmployer: number;
  personalRelief: number;
  insuranceRelief: number;
  taxableIncome: number;
  payeTax: number;
  totalEmployeeDeductions: number;
  totalEmployerDeductions: number;
  netSalary: number;
}

// =====================================================
// NSSF CALCULATION (2026 Rates)
// =====================================================
export const calculateNSSF = (grossSalary: number): { employee: number; employer: number } => {
  const TIER1_LIMIT = 9000;
  const TIER2_UPPER = 108000;
  const RATE = 0.06;

  // Tier 1: First 9,000
  const tier1Amount = Math.min(grossSalary, TIER1_LIMIT) * RATE;

  // Tier 2: 9,001 to 108,000
  let tier2Amount = 0;
  if (grossSalary > TIER1_LIMIT) {
    const tier2Salary = Math.min(grossSalary - TIER1_LIMIT, TIER2_UPPER - TIER1_LIMIT);
    tier2Amount = tier2Salary * RATE;
  }

  const totalAmount = tier1Amount + tier2Amount;

  return {
    employee: totalAmount,
    employer: totalAmount
  };
};

// =====================================================
// SHA CALCULATION (2026 Rates)
// =====================================================
export const calculateSHA = (grossSalary: number): number => {
  const CONTRIBUTION_RATE = 0.0275;
  const MINIMUM_MONTHLY = 300;

  const calculatedAmount = grossSalary * CONTRIBUTION_RATE;
  return Math.max(calculatedAmount, MINIMUM_MONTHLY);
};

// =====================================================
// HOUSING LEVY CALCULATION (2026 Rates)
// =====================================================
export const calculateHousingLevy = (grossSalary: number): { employee: number; employer: number } => {
  const LEVY_RATE = 0.015;

  return {
    employee: grossSalary * LEVY_RATE,
    employer: grossSalary * LEVY_RATE
  };
};

// =====================================================
// PAYE TAX CALCULATION (2026 Brackets)
// =====================================================
export const calculatePAYE = (taxableIncome: number): number => {
  let tax = 0;
  let remaining = taxableIncome;

  // Bracket 1: 0 - 24,000 (0%)
  if (remaining > 0) {
    const bracket1 = Math.min(remaining, 24000);
    tax += bracket1 * 0;
    remaining -= bracket1;
  }

  // Bracket 2: 24,001 - 50,000 (10%)
  if (remaining > 0) {
    const bracket2 = Math.min(remaining, 26000);
    tax += bracket2 * 0.1;
    remaining -= bracket2;
  }

  // Bracket 3: 50,001 - 100,000 (15%)
  if (remaining > 0) {
    const bracket3 = Math.min(remaining, 50000);
    tax += bracket3 * 0.15;
    remaining -= bracket3;
  }

  // Bracket 4: 100,001 - 150,000 (20%)
  if (remaining > 0) {
    const bracket4 = Math.min(remaining, 50000);
    tax += bracket4 * 0.2;
    remaining -= bracket4;
  }

  // Bracket 5: 150,001+ (25%)
  if (remaining > 0) {
    tax += remaining * 0.25;
  }

  return tax;
};

// =====================================================
// COMPLETE PAYROLL DEDUCTIONS CALCULATION
// =====================================================
export const calculateCompletePayroll = (
  grossSalary: number,
  insurancePremium: number = 0
): PayrollDeductions => {
  // Calculate NSSF
  const nssf = calculateNSSF(grossSalary);

  // Calculate SHA
  const sha = calculateSHA(grossSalary);

  // Calculate Housing Levy
  const housingLevy = calculateHousingLevy(grossSalary);

  // Calculate Tax Reliefs
  const personalRelief = 2400;
  const insuranceRelief = Math.min(insurancePremium * 0.15, 60000);

  // Calculate Taxable Income (Gross - NSSF - SHA - Housing Levy)
  const taxableIncome = grossSalary - nssf.employee - sha - housingLevy.employee;

  // Calculate PAYE
  let payeTax = calculatePAYE(taxableIncome);

  // Apply Personal Relief
  payeTax = Math.max(payeTax - personalRelief, 0);

  // Calculate totals
  const totalEmployeeDeductions = nssf.employee + sha + housingLevy.employee + payeTax;
  const totalEmployerDeductions = nssf.employer + housingLevy.employer;
  const netSalary = grossSalary - totalEmployeeDeductions;

  return {
    nssfEmployee: Math.round(nssf.employee * 100) / 100,
    nssfEmployer: Math.round(nssf.employer * 100) / 100,
    shaContribution: Math.round(sha * 100) / 100,
    housingLevyEmployee: Math.round(housingLevy.employee * 100) / 100,
    housingLevyEmployer: Math.round(housingLevy.employer * 100) / 100,
    personalRelief: Math.round(personalRelief * 100) / 100,
    insuranceRelief: Math.round(insuranceRelief * 100) / 100,
    taxableIncome: Math.round(taxableIncome * 100) / 100,
    payeTax: Math.round(payeTax * 100) / 100,
    totalEmployeeDeductions: Math.round(totalEmployeeDeductions * 100) / 100,
    totalEmployerDeductions: Math.round(totalEmployerDeductions * 100) / 100,
    netSalary: Math.round(netSalary * 100) / 100
  };
};

// =====================================================
// UTILITY: Format Currency
// =====================================================
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

// =====================================================
// UTILITY: Get Deduction Breakdown
// =====================================================
export const getDeductionBreakdown = (deductions: PayrollDeductions) => {
  return [
    { label: 'NSSF (Employee)', amount: deductions.nssfEmployee },
    { label: 'SHA', amount: deductions.shaContribution },
    { label: 'Housing Levy', amount: deductions.housingLevyEmployee },
    { label: 'PAYE Tax', amount: deductions.payeTax },
    { label: 'Total Deductions', amount: deductions.totalEmployeeDeductions, isBold: true }
  ];
};

// =====================================================
// UTILITY: Get Employer Contribution Breakdown
// =====================================================
export const getEmployerContributionBreakdown = (deductions: PayrollDeductions) => {
  return [
    { label: 'NSSF (Employer)', amount: deductions.nssfEmployer },
    { label: 'Housing Levy (Employer)', amount: deductions.housingLevyEmployer },
    { label: 'Total Employer Contribution', amount: deductions.totalEmployerDeductions, isBold: true }
  ];
};
