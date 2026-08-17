// @ts-nocheck
import { ArrowRightLeft, Banknote, History, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAccess } from '../../context/AccessContext';

const cards = [
  { title: 'Split page', description: 'Preview and edit the property split rule.', to: '/app/real-estate/split-management', icon: ArrowRightLeft },
  { title: 'Payout queue', description: 'Monitor auto-retried payout jobs.', to: '/app/real-estate/split-management/queue', icon: Users },
  { title: 'Split audit', description: 'Review every split calculation row.', to: '/app/real-estate/split-management/split-audit', icon: History },
];

export default function HakikaPayoutOverview() {
  const { profile } = useAccess();
  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 p-6 md:p-8 dark:from-dark-bg dark:via-dark-bg dark:to-emerald-950/20">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[2rem] border border-slate-200/70 bg-white/85 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.25)] backdrop-blur dark:border-white/10 dark:bg-dark-surface/90">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                <Banknote size={14} />
                Split management
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-5xl dark:text-white">Hakika split management</h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-600 md:text-base dark:text-slate-300">
                Keep the workspace light. The split page handles rule editing, the queue handles execution, and the audit page shows what happened.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Stat label="Company" value={profile?.company_id || 'Not linked'} />
              <Stat label="Security" value="Server-side settings" />
            </div>
          </div>
        </section>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.title} to={card.to} className="group rounded-[1.75rem] border border-slate-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-emerald-300 hover:shadow-xl dark:border-white/10 dark:bg-dark-surface">
                <div className="flex items-start justify-between gap-4">
                  <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><Icon size={20} /></div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-white/10 dark:text-slate-300">Open</span>
                </div>
                <h2 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">{card.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{card.description}</p>
              </Link>
            );
          })}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}
