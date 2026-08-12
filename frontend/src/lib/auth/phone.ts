import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

const KENYA_CODE = "+254";
const KENYA_NATIONAL = /^0[17]\d{8}$/;

function normalizeKenyanPhone(value: string): string | null {
  const compact = value.trim().replace(/[\s()-]/g, "");
  if (KENYA_NATIONAL.test(compact)) return `${KENYA_CODE}${compact.slice(1)}`;
  if (/^254[17]\d{8}$/.test(compact)) return `+${compact}`;
  if (/^\+254[17]\d{8}$/.test(compact)) return compact;
  return null;
}

export function normalizePhoneIdentifier(value: string, defaultCountryCode = KENYA_CODE): string | null {
  const input = value.trim();
  if (!input) return null;
  if (defaultCountryCode === KENYA_CODE) return normalizeKenyanPhone(input);
  const compact = input.replace(/[\s()-]/g, "");
  if (compact.startsWith("+")) return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null;
  if (compact.startsWith("00")) {
    const international = `+${compact.slice(2)}`;
    return /^\+[1-9]\d{7,14}$/.test(international) ? international : null;
  }
  if (defaultCountryCode === KENYA_CODE && /^2547\d{8}$/.test(compact)) {
    return `+${compact}`;
  }
  if (defaultCountryCode === KENYA_CODE && /^0?7\d{8}$/.test(compact)) {
    return `${KENYA_CODE}${compact.slice(-9)}`;
  }
  if (defaultCountryCode === KENYA_CODE && /^7\d{8}$/.test(compact)) {
    return `${KENYA_CODE}${compact}`;
  }
  return null;
}

export function isEmailIdentifier(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function normalizePhoneForCountry(value: string, country: CountryCode): string | null {
  if (country === "KE") return normalizeKenyanPhone(value);
  try {
    const parsed = parsePhoneNumberFromString(value.trim(), country);
    return parsed?.isValid() ? parsed.number : null;
  } catch {
    return null;
  }
}
