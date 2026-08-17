// @ts-nocheck
import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  FileText,
  Plus,
  Search,
  Target,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import CustomToast, { ToastType } from '../../components/CustomToast';

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  applied_for: string;
  status: 'Applied' | 'Screening' | 'Interview' | 'Offered' | 'Hired' | 'Rejected';
  applied_date: string;
  score: number;
}

const MOCK_CANDIDATES: Candidate[] = [
  { id: '1', full_name: 'David Wanyama', email: 'david@example.com', phone: '0712345678', applied_for: 'Security Guard', status: 'Applied', applied_date: '2026-03-14', score: 75 },
  { id: '2', full_name: 'Grace Mutua', email: 'grace@example.com', phone: '0722334455', applied_for: 'Accountant', status: 'Screening', applied_date: '2026-03-12', score: 88 },
  { id: '3', full_name: 'Kevin Otieno', email: 'kevin@example.com', phone: '0733445566', applied_for: 'Property Manager', status: 'Interview', applied_date: '2026-03-10', score: 92 },
  { id: '4', full_name: 'Lucy Njeri', email: 'lucy@example.com', phone: '0700112233', applied_for: 'Security Guard', status: 'Offered', applied_date: '2026-03-08', score: 85 },
];

const STAGES: Candidate['status'][] = ['Applied', 'Screening', 'Interview', 'Offered', 'Hired', 'Rejected'];

const STATUS_BADGE: Record<Candidate['status'], string> = {
  Applied: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/40 dark:text-gray-400',
  Screening: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400',
  Interview: 'bg-brand-purple/10 text-brand-purple border-brand-purple/20',
  Offered: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400',
  Hired: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400',
  Rejected: 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400',
};

const Recruitment: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<'All' | Candidate['status']>('All');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const filteredCandidates = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return MOCK_CANDIDATES.filter((candidate) => {
      const matchesStage = stageFilter === 'All' ? true : candidate.status === stageFilter;
      const matchesSearch = normalizedSearch
        ? [candidate.full_name, candidate.applied_for, candidate.email].some((value) =>
            value.toLowerCase().includes(normalizedSearch),
          )
        : true;

      return matchesStage && matchesSearch;
    });
  }, [searchTerm, stageFilter]);

  const pipeline = useMemo(
    () =>
      STAGES.map((stage) => ({
        stage,
        candidates: filteredCandidates.filter((candidate) => candidate.status === stage),
      })),
    [filteredCandidates],
  );

  const shortlist = useMemo(
    () =>
      MOCK_CANDIDATES.filter((candidate) => ['Interview', 'Offered'].includes(candidate.status))
        .sort((left, right) => right.score - left.score)
        .slice(0, 3),
    [],
  );

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-8 dark:bg-dark-bg">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="mb-2 flex items-center text-3xl font-bold text-gray-900 dark:text-white">
              <UserPlus className="mr-3 text-brand-purple" size={32} />
              Recruitment Portal
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Track pipeline health, prioritize the strongest candidates, and keep hiring moving.
            </p>
          </div>
          <button
            onClick={() => setToast({ message: 'New applicant form coming soon.', type: 'info' })}
            className="flex items-center gap-2 rounded-xl bg-brand-purple px-4 py-2 text-sm font-medium text-white shadow-lg shadow-brand-purple/20 transition-colors hover:bg-brand-pink"
            title="Add new applicant"
          >
            <Plus size={16} /> New Applicant
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Applicants', value: MOCK_CANDIDATES.length, icon: Users, color: 'text-brand-purple bg-brand-purple/10' },
            { label: 'Interview Ready', value: MOCK_CANDIDATES.filter((candidate) => candidate.status === 'Interview').length, icon: Briefcase, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
            { label: 'Offers Pending', value: MOCK_CANDIDATES.filter((candidate) => candidate.status === 'Offered').length, icon: FileText, color: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' },
            { label: 'High Score Pool', value: MOCK_CANDIDATES.filter((candidate) => candidate.score >= 85).length, icon: TrendingUp, color: 'text-green-500 bg-green-50 dark:bg-green-900/20' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-dark-surface">
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}`}>
                <stat.icon size={20} />
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{stat.label}</p>
              <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.55fr_0.85fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-dark-surface">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    placeholder="Search candidates, roles, email..."
                    title="Search candidates by name, role, or email"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-4 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-brand-purple dark:border-white/10 dark:bg-black/20 dark:text-white"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {['All', ...STAGES].map((stage) => (
                    <button
                      key={stage}
                      type="button"
                      onClick={() => setStageFilter(stage as 'All' | Candidate['status'])}
                      className={`rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.16em] transition ${
                        stageFilter === stage
                          ? 'bg-brand-purple text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10'
                      }`}
                    >
                      {stage}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {pipeline.map((column) => (
                <div key={column.stage} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-dark-surface">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-[0.16em] text-gray-900 dark:text-white">{column.stage}</h2>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{column.candidates.length} candidate(s)</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${STATUS_BADGE[column.stage]}`}>
                      {column.stage}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {column.candidates.length > 0 ? (
                      column.candidates.map((candidate) => (
                        <div key={candidate.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-gray-900 dark:text-white">{candidate.full_name}</p>
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{candidate.applied_for}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Score</p>
                              <p className="text-lg font-black text-gray-900 dark:text-white">{candidate.score}%</p>
                            </div>
                          </div>
                          <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>{new Date(candidate.applied_date).toLocaleDateString()}</span>
                            <button
                              className="inline-flex items-center gap-1 font-semibold text-brand-purple"
                              title="View candidate details"
                              aria-label="View details"
                            >
                              Open <ArrowRight size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
                        No candidates in this stage for the current filter.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl bg-brand-purple p-6 text-white shadow-sm">
              <Target size={28} className="mb-4 opacity-50" />
              <h3 className="text-lg font-bold">Shortlist Focus</h3>
              <p className="mb-5 mt-2 text-sm text-white/75">
                Highest scoring candidates already in interviews or offer stage.
              </p>
              <div className="space-y-3">
                {shortlist.map((candidate) => (
                  <div key={candidate.id} className="rounded-xl bg-white/10 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold">{candidate.full_name}</p>
                        <p className="mt-1 text-xs text-white/70">{candidate.applied_for}</p>
                      </div>
                      <span className="rounded-full bg-black/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]">
                        {candidate.score}%
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-white/70">{candidate.status} stage</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-dark-surface">
              <Briefcase size={26} className="mb-4 text-brand-purple" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Job Postings</h3>
              <p className="mb-5 mt-2 text-sm text-gray-500 dark:text-gray-400">
                Prioritize open roles with the biggest pipeline drop-off.
              </p>
              <div className="space-y-3">
                {[
                  { job: 'Security Officer Entry', note: 'Large applicant pool, low screening conversion' },
                  { job: 'Property Manager', note: 'Strong interview quality, shortlist ready' },
                  { job: 'Lead Accountant', note: 'Needs more sourcing at top of funnel' },
                ].map((job) => (
                  <div key={job.job} className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{job.job}</span>
                      <span className="rounded-full bg-brand-purple/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-purple">Active</span>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{job.note}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setToast({ message: 'Create listing feature coming soon.', type: 'info' })}
                className="mt-5 w-full rounded-lg bg-gray-900 py-2.5 text-sm font-bold text-white transition-colors hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                title="Create new job listing"
              >
                Create New Listing
              </button>
            </div>
          </div>
        </div>
      </div>

      {toast && <CustomToast isVisible={!!toast} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Recruitment;
