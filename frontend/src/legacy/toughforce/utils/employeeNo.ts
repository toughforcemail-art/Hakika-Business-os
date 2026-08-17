// @ts-nocheck
export const EMPLOYEE_NO_REGEX = /^EMP-\d{4}-\d{2}-\d{2}-\d{3}$/;

export const formatEmployeeNo = (dateStr: string, sequence: number) => {
  const padded = String(sequence).padStart(3, '0');
  return `EMP-${dateStr}-${padded}`;
};

export const extractSequenceFromEmployeeNo = (employeeNo: string): number => {
  const match = employeeNo.match(/-(\d{3})$/);
  return match ? parseInt(match[1], 10) : 0;
};

export const normalizeEmployeeNo = (
  raw: string | null | undefined,
  dateStr: string,
  sequence: number
) => {
  if (!raw) return formatEmployeeNo(dateStr, sequence);

  const trimmed = String(raw).trim();
  if (EMPLOYEE_NO_REGEX.test(trimmed)) return trimmed;

  if (/^\d+$/.test(trimmed)) {
    return formatEmployeeNo(dateStr, Number(trimmed));
  }

  const trailingDigits = trimmed.match(/(\d{1,3})$/);
  if (trailingDigits) {
    return formatEmployeeNo(dateStr, Number(trailingDigits[1]));
  }

  return formatEmployeeNo(dateStr, sequence);
};

export const getEmployeeNoDateStr = (date = new Date()) => {
  return date.toISOString().slice(0, 10);
};
