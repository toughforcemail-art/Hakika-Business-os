// @ts-nocheck
export type SplitMode = 'percent' | 'flat';

export interface HakikaSplitInput {
  amount: number;
  rate: number;
  mode: SplitMode;
}

export interface HakikaSplitResult {
  companyRevenue: number;
  landlordPayable: number;
  liabilityBefore: number;
  liabilityAfter: number;
}

export function calculateHakikaSplit(input: HakikaSplitInput): HakikaSplitResult {
  const safeAmount = Number.isFinite(input.amount) ? Math.max(0, input.amount) : 0;
  const safeRate = Number.isFinite(input.rate) ? Math.max(0, input.rate) : 0;
  const companyRevenue = input.mode === 'percent'
    ? Math.round((safeAmount * safeRate / 100) * 100) / 100
    : Math.min(safeAmount, Math.round(safeRate * 100) / 100);
  const landlordPayable = Math.max(0, Math.round((safeAmount - companyRevenue) * 100) / 100);

  return {
    companyRevenue,
    landlordPayable,
    liabilityBefore: safeAmount,
    liabilityAfter: landlordPayable,
  };
}

export function summarizeHakikaSplit(input: HakikaSplitInput) {
  const split = calculateHakikaSplit(input);
  return `Liability reduces from Ksh ${split.liabilityBefore.toLocaleString()} to Ksh ${split.liabilityAfter.toLocaleString()}. Company revenue: Ksh ${split.companyRevenue.toLocaleString()}.`;
}
