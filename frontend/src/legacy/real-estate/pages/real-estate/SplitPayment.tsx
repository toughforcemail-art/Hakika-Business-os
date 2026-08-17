// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Building2, CheckCircle2, Clock3, ReceiptText, Save, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { calculateHakikaSplit, summarizeHakikaSplit, SplitMode } from '../../utils/hakikaLedger';
import { useAccess } from '../../context/AccessContext';
import { loadPayoutRequests, PayoutRequest } from './hakikaPayoutData';

type PropertyRow = {
  id: string;
  name: string | null;
  service_fee_mode: string | null;
  service_fee_value: number | null;
};

export default function SplitPayment() {
  const { profile } = useAccess();
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [history, setHistory] = useState<PayoutRequest[]>([]);
  const [splitDrafts, setSplitDrafts] = useState<Record<string, { mode: SplitMode; rate: number }>>({});
  const [amount, setAmount] = useState(10000);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const isPrivilegedViewer = profile?.role === 'Super Admin' || profile?.role === 'Director' || profile?.role === 'Director / Super Admin';

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedPropertyId) || properties[0] || null,
    [properties, selectedPropertyId],
  );

  const selectedDraft = useMemo(() => {
    if (!selectedProperty) return { mode: 'percent' as SplitMode, rate: 10 };
    return splitDrafts[selectedProperty.id] || {
      mode: (selectedProperty.service_fee_mode || 'percent') as SplitMode,
      rate: Number(selectedProperty.service_fee_value ?? 10) || 0,
    };
  }, [selectedProperty, splitDrafts]);

  const preview = useMemo(
    () => calculateHakikaSplit({ amount, rate: selectedDraft.rate, mode: selectedDraft.mode }),
    [amount, selectedDraft.mode, selectedDraft.rate],
  );

  useEffect(() => {
    const load = async () => {
      if (!profile?.company_id && !isPrivilegedViewer) return;
      setLoading(true);
      try {
        const propertyQuery = supabase.from('re_properties').select('id, name, service_fee_mode, service_fee_value, company_id').order('name');
        const resolvedPropertyQuery = isPrivilegedViewer ? propertyQuery : propertyQuery.eq('company_id', profile.company_id);
        const [propertyRes, historyRes] = await Promise.all([
          resolvedPropertyQuery,
          profile?.company_id ? loadPayoutRequests(profile.company_id) : Promise.resolve([] as PayoutRequest[]),
        ]);

        if (!propertyRes.error) {
          const rows = (propertyRes.data || []) as PropertyRow[];
          setProperties(rows);
          setSplitDrafts((curr) => {
            const next = { ...curr };
            rows.forEach((property) => {
              next[property.id] = next[property.id] || {
                mode: (property.service_fee_mode || 'percent') as SplitMode,
                rate: Number(property.service_fee_value ?? 10) || 0,
              };
            });
            return next;
          });
          if (!selectedPropertyId && rows[0]?.id) setSelectedPropertyId(rows[0].id);
        }

        setHistory(historyRes);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [profile?.company_id, isPrivilegedViewer]);

  const updateDraft = (propertyId: string, patch: Partial<{ mode: SplitMode; rate: number }>) => {
    setSplitDrafts((curr) => ({
      ...curr,
      [propertyId]: {
        mode: curr[propertyId]?.mode || 'percent',
        rate: curr[propertyId]?.rate ?? 10,
        ...patch,
      },
    }));
  };

  const saveSplit = async () => {
    if (!selectedProperty) return;
    const draft = splitDrafts[selectedProperty.id] || selectedDraft;
    setSavingId(selectedProperty.id);
    try {
      const { error } = await supabase
        .from('re_properties')
        .update({ service_fee_mode: draft.mode, service_fee_value: draft.rate })
        .eq('id', selectedProperty.id);
      if (error) throw error;
      setProperties((curr) => curr.map((item) => item.id === selectedProperty.id ? { ...item, service_fee_mode: draft.mode, service_fee_value: draft.rate } : item));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-6 dark:from-dark-bg dark:via-dark-bg dark:to-emerald-950/20 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-dark-surface md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-600">Split</p>
          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white md:text-5xl">Hakika split workspace</h1>
              <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                Keep the page simple: preview, payout settings, and history. Everything else lives on dedicated pages.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/app/real-estate/split-management" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10">
                Split management
              </Link>
              <Link to="/app/real-estate/split-management/split-audit" className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white dark:bg-white dark:text-slate-900">
                Split audit
              </Link>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/app/real-estate/split-management/queue" className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10">
              Queue
            </Link>
            <Link to="/app/real-estate/split-management/history" className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10">
              History
            </Link>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-dark-surface md:p-8">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <ReceiptText size={22} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Preview</p>
                <h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Split preview</h2>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="block text-xs font-black uppercase tracking-[0.24em] text-slate-500">Property</span>
                <select
                  value={selectedPropertyId || ''}
                  onChange={(e) => setSelectedPropertyId(e.target.value || null)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name || 'Unnamed property'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="block text-xs font-black uppercase tracking-[0.24em] text-slate-500">Amount</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value || 0))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <Metric label="Company revenue" value={`KES ${preview.companyRevenue.toLocaleString()}`} />
              <Metric label="Landlord payable" value={`KES ${preview.landlordPayable.toLocaleString()}`} />
              <Metric label="Liability after" value={`KES ${preview.liabilityAfter.toLocaleString()}`} />
            </div>

            <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 text-sm leading-7 text-slate-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-slate-200">
              {summarizeHakikaSplit({ amount, rate: selectedDraft.rate, mode: selectedDraft.mode })}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-dark-surface md:p-8">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-900 p-3 text-white dark:bg-white dark:text-slate-900">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">Payout settings</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Company split rules</h2>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <Field
                  label="Split mode"
                  value={selectedDraft.mode}
                  onChange={(value) => selectedProperty && updateDraft(selectedProperty.id, { mode: value as SplitMode })}
                  type="select"
                  options={[{ label: 'Percent', value: 'percent' }, { label: 'Flat', value: 'flat' }]}
                />
                <Field
                  label="Split rate"
                  value={String(selectedDraft.rate)}
                  onChange={(value) => selectedProperty && updateDraft(selectedProperty.id, { rate: Number(value || 0) })}
                  type="number"
                />
              </div>

              <button
                type="button"
                onClick={() => void saveSplit()}
                disabled={!selectedProperty || savingId === selectedProperty?.id}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:opacity-60 dark:bg-white dark:text-slate-900"
              >
                <Save size={16} /> {savingId ? 'Saving...' : 'Save split'}
              </button>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-dark-surface md:p-8">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <Clock3 size={22} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">History</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">Recent payout history</h2>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {loading ? (
                  <p className="text-sm text-slate-500">Loading history...</p>
                ) : history.length === 0 ? (
                  <p className="text-sm text-slate-500">No payout history yet.</p>
                ) : (
                  history.slice(0, 4).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{item.recipient_name || 'Unnamed recipient'}</p>
                          <p className="text-xs text-slate-500">{item.recipient_phone || item.recipient_shortcode || '—'}</p>
                        </div>
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                          {item.request_status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">KES {Number(item.amount || 0).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'select';
  options?: Array<{ label: string; value: string }>;
}) {
  return (
    <label className="space-y-2">
      <span className="block text-xs font-black uppercase tracking-[0.24em] text-slate-500">{label}</span>
      {type === 'select' ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
        >
          {options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
        />
      )}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
