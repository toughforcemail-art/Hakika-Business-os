// @ts-nocheck
export const DEFAULT_PHONE_COUNTRY_CODE = '+254';

const digitsOnly = (value: string) => value.replace(/\D/g, '');
const normalizeKenyanDigits = (digits: string) => {
  if (!digits) return null;
  if (digits.startsWith('254')) {
    const local = digits.slice(3);
    return local ? `+254${local}` : null;
  }
  if (digits.startsWith('0')) {
    const local = digits.slice(1);
    return local ? `+254${local}` : null;
  }
  if (digits.startsWith('7') || digits.startsWith('1')) {
    return `+254${digits}`;
  }
  return `+254${digits}`;
};

export const formatPhoneInput = (value?: string | null): string => {
  const raw = (value ?? '').trim();
  const digits = digitsOnly(raw);

  if (!digits) {
    return DEFAULT_PHONE_COUNTRY_CODE;
  }

  if (raw.startsWith('+')) {
    return `+${digits}`;
  }

  if (digits.startsWith('254')) {
    return `+${digits}`;
  }

  if (digits.startsWith('0')) {
    return `${DEFAULT_PHONE_COUNTRY_CODE}${digits.slice(1)}`;
  }

  return `${DEFAULT_PHONE_COUNTRY_CODE}${digits}`;
};

export const normalizePhoneNumber = (value?: string | null): string | null => {
  const raw = (value ?? '').trim();
  const digits = digitsOnly(raw);

  if (!digits || digits === '254') {
    return null;
  }

  if (raw.startsWith('+')) {
    return digits.startsWith('254') ? `+${digits}` : normalizeKenyanDigits(digits);
  }

  return normalizeKenyanDigits(digits);
};
