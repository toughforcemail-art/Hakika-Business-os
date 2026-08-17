// @ts-nocheck
/**
 * 2026 Kenyan Statutory Payroll Calculations
 */

export interface PayrollInput {
    basicSalary: number;
    benefits: number; // Taxable benefits
    allowances: number;
    deductions: number; // Non-statutory deductions
}

export interface PayrollResult {
    grossPay: number;
    nssfTier1: number;
    nssfTier2: number;
    totalNSSF: number;
    taxablePay: number;
    paye: number;
    sha: number;
    housingLevy: number;
    netPay: number;
}

/**
 * NSSF 2026 Tiered Logic
 * Tier I: 6% of lower limit (capped around 360-420 KES)
 * Tier II: 6% of upper limit - Tier I
 */
export const calculateNSSF = (grossPay: number): { tier1: number; tier2: number; total: number } => {
    const TIER_1_LIMIT = 7000;
    const TIER_2_LIMIT = 36000; // Example 2026 limit

    let tier1 = Math.min(grossPay, TIER_1_LIMIT) * 0.06;
    let tier2 = 0;

    if (grossPay > TIER_1_LIMIT) {
        tier2 = (Math.min(grossPay, TIER_2_LIMIT) - TIER_1_LIMIT) * 0.06;
    }

    return {
        tier1: Math.round(tier1),
        tier2: Math.round(tier2),
        total: Math.round(tier1 + tier2)
    };
};

/**
 * SHA (Social Health Authority) - 2.75% of Gross
 */
export const calculateSHA = (grossPay: number): number => {
    return Math.round(grossPay * 0.0275);
};

/**
 * Housing Levy - 1.5% of Gross
 */
export const calculateHousingLevy = (grossPay: number): number => {
    return Math.round(grossPay * 0.015);
};

/**
 * PAYE 2026 (Simplified Bands)
 */
export const calculatePAYE = (taxablePay: number): number => {
    // 2026 Bands (Example)
    // 0 - 24,000: 10%
    // 24,001 - 32,333: 25%
    // Above 32,333: 30%
    // Personal Relief: 2,400

    let tax = 0;
    const relief = 2400;

    if (taxablePay <= 24000) {
        tax = taxablePay * 0.1;
    } else if (taxablePay <= 32333) {
        tax = (24000 * 0.1) + ((taxablePay - 24000) * 0.25);
    } else {
        tax = (24000 * 0.1) + ((32333 - 24000) * 0.25) + ((taxablePay - 32333) * 0.3);
    }

    return Math.max(0, Math.round(tax - relief));
};

export const calculatePayroll = (input: PayrollInput): PayrollResult => {
    const grossPay = input.basicSalary + input.benefits + input.allowances;

    const nssf = calculateNSSF(grossPay);
    const sha = calculateSHA(grossPay);
    const housingLevy = calculateHousingLevy(grossPay);

    // NSSF is usually tax deductible in Kenya
    const taxablePay = grossPay - nssf.total;
    const paye = calculatePAYE(taxablePay);

    const netPay = grossPay - nssf.total - sha - housingLevy - paye - input.deductions;

    return {
        grossPay,
        nssfTier1: nssf.tier1,
        nssfTier2: nssf.tier2,
        totalNSSF: nssf.total,
        taxablePay,
        paye,
        sha,
        housingLevy,
        netPay
    };
};
