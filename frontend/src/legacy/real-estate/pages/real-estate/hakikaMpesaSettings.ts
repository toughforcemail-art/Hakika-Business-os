// @ts-nocheck
export type SettingsState = {
  MPESA_CALLBACK_SECRET: string;
  MPESA_CONSUMER_KEY: string;
  MPESA_CONSUMER_SECRET: string;
  MPESA_QR_MERCHANT_NAME: string;
  MPESA_B2B_INITIATOR: string;
  MPESA_B2B_SECURITY_CREDENTIAL: string;
  MPESA_B2B_QUEUE_TIMEOUT_URL: string;
  MPESA_B2B_RESULT_URL: string;
  MPESA_BUSINESS_SHORT_CODE: string;
  MPESA_PASSKEY: string;
  MPESA_CALLBACK_URL: string;
  MPESA_CONFIRMATION_URL: string;
  MPESA_VALIDATION_URL: string;
  MPESA_B2C_INITIATOR_NAME: string;
  MPESA_B2C_SECURITY_CREDENTIAL: string;
  MPESA_B2C_SHORT_CODE: string;
  MPESA_B2C_QUEUE_TIMEOUT_URL: string;
  MPESA_B2C_RESULT_URL: string;
  MPESA_ENVIRONMENT: 'sandbox' | 'production';
};

const getEnv = (key: string) => (import.meta as any)?.env?.[key] || '';
const fallbackBusinessShortCode = getEnv('VITE_MPESA_BUSINESS_SHORT_CODE') || '174379';

export const DEFAULTS: SettingsState = {
  MPESA_CALLBACK_SECRET: '',
  MPESA_CONSUMER_KEY: getEnv('VITE_MPESA_CONSUMER_KEY'),
  MPESA_CONSUMER_SECRET: getEnv('VITE_MPESA_CONSUMER_SECRET'),
  MPESA_QR_MERCHANT_NAME: 'HAKIKA',
  MPESA_B2B_INITIATOR: getEnv('VITE_MPESA_B2B_INITIATOR'),
  MPESA_B2B_SECURITY_CREDENTIAL: getEnv('VITE_MPESA_B2B_SECURITY_CREDENTIAL'),
  MPESA_B2B_QUEUE_TIMEOUT_URL: getEnv('VITE_MPESA_B2B_QUEUE_TIMEOUT_URL'),
  MPESA_B2B_RESULT_URL: getEnv('VITE_MPESA_B2B_RESULT_URL'),
  MPESA_BUSINESS_SHORT_CODE: fallbackBusinessShortCode,
  MPESA_PASSKEY: '',
  MPESA_CALLBACK_URL: getEnv('VITE_MPESA_CALLBACK_URL'),
  MPESA_CONFIRMATION_URL: getEnv('VITE_MPESA_CONFIRMATION_URL'),
  MPESA_VALIDATION_URL: getEnv('VITE_MPESA_VALIDATION_URL'),
  MPESA_B2C_INITIATOR_NAME: getEnv('VITE_MPESA_B2C_INITIATOR_NAME'),
  MPESA_B2C_SECURITY_CREDENTIAL: getEnv('VITE_MPESA_B2C_SECURITY_CREDENTIAL'),
  MPESA_B2C_SHORT_CODE: getEnv('VITE_MPESA_B2C_SHORT_CODE') || fallbackBusinessShortCode,
  MPESA_B2C_QUEUE_TIMEOUT_URL: getEnv('VITE_MPESA_B2C_QUEUE_TIMEOUT_URL'),
  MPESA_B2C_RESULT_URL: getEnv('VITE_MPESA_B2C_RESULT_URL'),
  MPESA_ENVIRONMENT: 'sandbox',
};

export const STORAGE_KEY = 'hakika_daraja_settings';

export const readSettings = (): SettingsState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
};

export const writeSettings = (next: Partial<SettingsState>) => {
  const current = readSettings();
  const merged = { ...current, ...next };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
};
