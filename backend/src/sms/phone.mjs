const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

/** Normalize a user-entered destination before sending through Africa's Talking. */
export function normalizeSmsPhone(value, defaultCountryCode = "+254") {
  const compact = String(value ?? "").trim().replace(/[\s()-]/g, "");
  if (!compact) return null;
  if (compact.startsWith("+")) return E164_PATTERN.test(compact) ? compact : null;
  if (compact.startsWith("00")) {
    const international = `+${compact.slice(2)}`;
    return E164_PATTERN.test(international) ? international : null;
  }
  if (defaultCountryCode === "+254" && /^254[17]\d{8}$/.test(compact)) return `+${compact}`;
  if (defaultCountryCode === "+254" && /^0[17]\d{8}$/.test(compact)) return `+254${compact.slice(1)}`;
  if (defaultCountryCode === "+254" && /^[17]\d{8}$/.test(compact)) return `+254${compact}`;
  return null;
}
