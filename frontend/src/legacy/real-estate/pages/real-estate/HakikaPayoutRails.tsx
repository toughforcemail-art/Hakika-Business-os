// @ts-nocheck
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, CheckCircle2, Save, ShieldCheck, Wallet } from 'lucide-react';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { DEFAULTS, readSettings, writeSettings, SettingsState } from './hakikaMpesaSettings';

type FormState = {
  MPESA_B2B_INITIATOR: string;
  MPESA_B2B_SECURITY_CREDENTIAL: string;
  MPESA_B2B_QUEUE_TIMEOUT_URL: string;
  MPESA_B2B_RESULT_URL: string;
  MPESA_B2C_INITIATOR_NAME: string;
  MPESA_B2C_SHORT_CODE: string;
  MPESA_B2C_QUEUE_TIMEOUT_URL: string;
  MPESA_B2C_RESULT_URL: string;
  MPESA_BUSINESS_SHORT_CODE: string;
  MPESA_CONFIRMATION_URL: string;
  MPESA_VALIDATION_URL: string;
};

const DEFAULT_FORM: FormState = {
  MPESA_B2B_INITIATOR: '',
  MPESA_B2B_SECURITY_CREDENTIAL: '',
  MPESA_B2B_QUEUE_TIMEOUT_URL: '',
  MPESA_B2B_RESULT_URL: '',
  MPESA_B2C_INITIATOR_NAME: '',
  MPESA_B2C_SHORT_CODE: '',
  MPESA_B2C_QUEUE_TIMEOUT_URL: '',
  MPESA_B2C_RESULT_URL: '',
  MPESA_BUSINESS_SHORT_CODE: '',
  MPESA_CONFIRMATION_URL: '',
  MPESA_VALIDATION_URL: '',
};

const getEnv = (key: string) => (import.meta as any)?.env?.[key] || '';

const readFormFromSettings = (settings: SettingsState): FormState => ({
  MPESA_B2B_INITIATOR: settings.MPESA_B2B_INITIATOR || getEnv('VITE_MPESA_B2B_INITIATOR'),
  MPESA_B2B_SECURITY_CREDENTIAL: settings.MPESA_B2B_SECURITY_CREDENTIAL || getEnv('VITE_MPESA_B2B_SECURITY_CREDENTIAL'),
  MPESA_B2B_QUEUE_TIMEOUT_URL: settings.MPESA_B2B_QUEUE_TIMEOUT_URL || getEnv('VITE_MPESA_B2B_QUEUE_TIMEOUT_URL'),
  MPESA_B2B_RESULT_URL: settings.MPESA_B2B_RESULT_URL || getEnv('VITE_MPESA_B2B_RESULT_URL'),
  MPESA_B2C_INITIATOR_NAME: settings.MPESA_B2C_INITIATOR_NAME || getEnv('VITE_MPESA_B2C_INITIATOR_NAME'),
  MPESA_B2C_SHORT_CODE: settings.MPESA_B2C_SHORT_CODE || getEnv('VITE_MPESA_B2C_SHORT_CODE') || getEnv('VITE_MPESA_BUSINESS_SHORT_CODE'),
  MPESA_B2C_QUEUE_TIMEOUT_URL: settings.MPESA_B2C_QUEUE_TIMEOUT_URL || getEnv('VITE_MPESA_B2C_QUEUE_TIMEOUT_URL'),
  MPESA_B2C_RESULT_URL: settings.MPESA_B2C_RESULT_URL || getEnv('VITE_MPESA_B2C_RESULT_URL'),
  MPESA_BUSINESS_SHORT_CODE: settings.MPESA_BUSINESS_SHORT_CODE || getEnv('VITE_MPESA_BUSINESS_SHORT_CODE'),
  MPESA_CONFIRMATION_URL: settings.MPESA_CONFIRMATION_URL || getEnv('VITE_MPESA_CONFIRMATION_URL'),
  MPESA_VALIDATION_URL: settings.MPESA_VALIDATION_URL || getEnv('VITE_MPESA_VALIDATION_URL'),
});

export default function HakikaPayoutRails() {
  const [settings, setSettings] = useState<SettingsState>(DEFAULTS);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next = readSettings();
    const resolved = readFormFromSettings(next);
    setSettings(next);
    setForm(resolved);
  }, []);

  const summary = useMemo(() => {
    const businessShortCode = form.MPESA_BUSINESS_SHORT_CODE || settings.MPESA_BUSINESS_SHORT_CODE || 'not set';
    const b2cShortCode = form.MPESA_B2C_SHORT_CODE || settings.MPESA_B2C_SHORT_CODE || businessShortCode;
    return { businessShortCode, b2cShortCode };
  }, [form.MPESA_B2C_SHORT_CODE, form.MPESA_BUSINESS_SHORT_CODE, settings.MPESA_B2C_SHORT_CODE, settings.MPESA_BUSINESS_SHORT_CODE]);

  const setField = (field: keyof FormState, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const next = writeSettings({
        MPESA_B2B_INITIATOR: form.MPESA_B2B_INITIATOR.trim(),
        MPESA_B2B_SECURITY_CREDENTIAL: form.MPESA_B2B_SECURITY_CREDENTIAL.trim(),
        MPESA_B2B_QUEUE_TIMEOUT_URL: form.MPESA_B2B_QUEUE_TIMEOUT_URL.trim(),
        MPESA_B2B_RESULT_URL: form.MPESA_B2B_RESULT_URL.trim(),
        MPESA_B2C_INITIATOR_NAME: form.MPESA_B2C_INITIATOR_NAME.trim(),
        MPESA_B2C_SHORT_CODE: form.MPESA_B2C_SHORT_CODE.trim(),
        MPESA_B2C_QUEUE_TIMEOUT_URL: form.MPESA_B2C_QUEUE_TIMEOUT_URL.trim(),
        MPESA_B2C_RESULT_URL: form.MPESA_B2C_RESULT_URL.trim(),
        MPESA_BUSINESS_SHORT_CODE: form.MPESA_BUSINESS_SHORT_CODE.trim(),
        MPESA_CONFIRMATION_URL: form.MPESA_CONFIRMATION_URL.trim(),
        MPESA_VALIDATION_URL: form.MPESA_VALIDATION_URL.trim(),
      });
      setSettings(next);
      setToast({ message: 'Daraja settings saved.', type: 'success' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 dark:from-dark-bg dark:via-dark-bg dark:to-emerald-950/20 p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-[2rem] border border-slate-200/70 dark:border-white/10 bg-white/85 dark:bg-dark-surface/90 backdrop-blur p-6 md:p-8 shadow-[0_20px_80px_-30px_rgba(15,23,42,0.25)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                <ArrowRightLeft size={14} />
                Hakika payout settings
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                B2B and B2C Daraja setup
              </h1>
              <p className="max-w-3xl text-sm md:text-base leading-7 text-slate-600 dark:text-slate-300">
                Save the shared Daraja credentials once, then reuse them for landlord payouts through B2B and B2C.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/5 p-5 min-w-[260px]">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Current shortcode</p>
              <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">{summary.businessShortCode}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">B2C shortcode</p>
              <p className="mt-2 text-base font-bold text-slate-800 dark:text-slate-100">{summary.b2cShortCode}</p>
            </div>
          </div>
        </section>

        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[1.75rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-surface p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300 p-3">
                <Wallet size={20} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">B2B settings</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Used for business-to-business landlord payouts.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Initiator" value={form.MPESA_B2B_INITIATOR} onChange={(value) => setField('MPESA_B2B_INITIATOR', value)} placeholder="B2B initiator" />
              <Field label="Security Credential" value={form.MPESA_B2B_SECURITY_CREDENTIAL} onChange={(value) => setField('MPESA_B2B_SECURITY_CREDENTIAL', value)} placeholder="Base64 credential" />
              <Field label="Queue Timeout URL" value={form.MPESA_B2B_QUEUE_TIMEOUT_URL} onChange={(value) => setField('MPESA_B2B_QUEUE_TIMEOUT_URL', value)} placeholder="https://..." />
              <Field label="Result URL" value={form.MPESA_B2B_RESULT_URL} onChange={(value) => setField('MPESA_B2B_RESULT_URL', value)} placeholder="https://..." />
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-300 p-3">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">B2C settings</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Used when Hakika pays landlords to phone numbers.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Initiator Name" value={form.MPESA_B2C_INITIATOR_NAME} onChange={(value) => setField('MPESA_B2C_INITIATOR_NAME', value)} placeholder="Initiator name" />
              <Field label="Shortcode" value={form.MPESA_B2C_SHORT_CODE} onChange={(value) => setField('MPESA_B2C_SHORT_CODE', value)} placeholder="174379" />
              <Field label="Queue Timeout URL" value={form.MPESA_B2C_QUEUE_TIMEOUT_URL} onChange={(value) => setField('MPESA_B2C_QUEUE_TIMEOUT_URL', value)} placeholder="https://..." />
              <Field label="Result URL" value={form.MPESA_B2C_RESULT_URL} onChange={(value) => setField('MPESA_B2C_RESULT_URL', value)} placeholder="https://..." />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Business Shortcode" value={form.MPESA_BUSINESS_SHORT_CODE} onChange={(value) => setField('MPESA_BUSINESS_SHORT_CODE', value)} placeholder="174379" />
              <Field label="Confirmation URL" value={form.MPESA_CONFIRMATION_URL} onChange={(value) => setField('MPESA_CONFIRMATION_URL', value)} placeholder="https://..." />
              <Field label="Validation URL" value={form.MPESA_VALIDATION_URL} onChange={(value) => setField('MPESA_VALIDATION_URL', value)} placeholder="https://..." />
            </div>

            <button type="submit" className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 transition-colors">
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Daraja settings'}
            </button>
          </section>

          <aside className="space-y-5">
            <article className="rounded-[1.75rem] border border-slate-200 dark:border-white/10 bg-slate-900 text-white p-6">
              <h3 className="text-xl font-black">How this page is used</h3>
              <ul className="mt-4 space-y-3 text-sm text-white/75">
                <li className="flex gap-3"><CheckCircle2 size={16} className="mt-0.5 text-emerald-400" /> Save the shortcode and URLs once.</li>
                <li className="flex gap-3"><CheckCircle2 size={16} className="mt-0.5 text-emerald-400" /> Reuse the same values in the payout console and admin test tools.</li>
                <li className="flex gap-3"><CheckCircle2 size={16} className="mt-0.5 text-emerald-400" /> Keep the split logic separate from the actual Safaricom rails.</li>
              </ul>
            </article>
            <article className="rounded-[1.75rem] border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-6 text-emerald-950 dark:text-emerald-50">
              <h3 className="text-xl font-black">Saved state</h3>
              <p className="mt-3 text-sm leading-6">
                The form persists to the browser’s local storage using the shared Hakika Daraja settings key so the admin console and payout pages see the same values.
              </p>
            </article>
          </aside>
        </form>
      </div>
      {toast ? <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </div>
  );
}

const Field = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) => (
  <label className="space-y-2">
    <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-3 text-slate-900 dark:text-white outline-none focus:border-emerald-400/60"
    />
  </label>
);
