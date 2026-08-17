// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Clock3, Download, Filter, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';

interface ActivityLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  action_type: string;
  action_category: string | null;
  module: string | null;
  resource_type: string | null;
  resource_id: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  device_type: string | null;
  platform: string | null;
  session_id: string | null;
  page_url: string | null;
  created_at: string;
}

const filters = ['All events', 'Create', 'Update', 'Delete', 'Login', 'Error'];

const formatDateTime = (value: string) => new Date(value).toLocaleString('en-KE', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const formatMetadata = (metadata: Record<string, unknown> | null) => {
  if (!metadata || Object.keys(metadata).length === 0) return 'No metadata captured';
  return Object.entries(metadata).slice(0, 3).map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`).join(' • ');
};

const AuditTrail: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [activityRes, deleteRes] = await Promise.all([
          supabase.from('activity_logs').select('id, user_id, user_email, user_name, action_type, action_category, module, resource_type, resource_id, description, metadata, device_type, platform, session_id, page_url, created_at').order('created_at', { ascending: false }).limit(250),
          supabase.from('delete_audit_logs').select('id, user_name, user_email, action_type, action_category, resource_type, resource_id, description, created_at').order('created_at', { ascending: false }).limit(100),
        ]);

        if (activityRes.error) throw activityRes.error;
        if (deleteRes.error) throw deleteRes.error;

        const activityRows = (activityRes.data || []) as ActivityLog[];
        const deleteRows = ((deleteRes.data || []) as Array<{ id: string; user_name: string | null; user_email: string | null; action_type: string; action_category: string | null; resource_type: string | null; resource_id: string | null; description: string | null; created_at: string }>).map((row) => ({
          id: `delete-${row.id}`,
          user_id: null,
          user_email: row.user_email,
          user_name: row.user_name,
          action_type: row.action_type,
          action_category: row.action_category,
          module: 'delete_logs',
          resource_type: row.resource_type,
          resource_id: row.resource_id,
          description: row.description,
          metadata: null,
          device_type: null,
          platform: null,
          session_id: null,
          page_url: null,
          created_at: row.created_at,
        }));

        setLogs([...activityRows, ...deleteRows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      } catch (error: any) {
        setToast({ message: error?.message || 'Failed to load audit trail.', type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const stats = useMemo(() => {
    const filtered = logs.filter((log) => {
      const haystack = [log.user_name, log.user_email, log.description, log.action_type, log.module, log.resource_type, log.page_url].join(' ').toLowerCase();
      const matchesSearch = !search || haystack.includes(search.toLowerCase());
      const matchesType = filterType === 'all' || log.action_type === filterType;
      const matchesFrom = !fromDate || new Date(log.created_at) >= new Date(fromDate);
      const matchesTo = !toDate || new Date(log.created_at) <= new Date(`${toDate}T23:59:59.999`);
      return matchesSearch && matchesType && matchesFrom && matchesTo;
    });
    return {
      total: filtered.length,
      create: filtered.filter((log) => log.action_type === 'create').length,
      update: filtered.filter((log) => log.action_type === 'update').length,
      errors: filtered.filter((log) => log.action_type === 'error').length,
    };
  }, [logs, search, filterType, fromDate, toDate]);

  const filteredLogs = useMemo(() => logs.filter((log) => {
    const haystack = [log.user_name, log.user_email, log.description, log.action_type, log.module, log.resource_type, log.page_url].join(' ').toLowerCase();
    const matchesSearch = !search || haystack.includes(search.toLowerCase());
    const matchesType = filterType === 'all' || log.action_type === filterType;
    const matchesFrom = !fromDate || new Date(log.created_at) >= new Date(fromDate);
    const matchesTo = !toDate || new Date(log.created_at) <= new Date(`${toDate}T23:59:59.999`);
    return matchesSearch && matchesType && matchesFrom && matchesTo;
  }), [logs, search, filterType, fromDate, toDate]);

  const exportCsv = () => {
    const rows = [
      ['Timestamp', 'User', 'Email', 'Action', 'Module', 'Resource', 'Description', 'Device', 'Platform', 'Session', 'Page URL', 'Metadata'],
      ...filteredLogs.map((log) => [
        formatDateTime(log.created_at),
        log.user_name || '',
        log.user_email || '',
        log.action_type,
        log.module || '',
        log.resource_type || '',
        log.description || '',
        log.device_type || '',
        log.platform || '',
        log.session_id || '',
        log.page_url || '',
        formatMetadata(log.metadata),
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => {
      const text = String(value ?? '');
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const getActionClass = (type: string) => {
    if (type === 'login') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200';
    if (type === 'create') return 'bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-200';
    if (type === 'update') return 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-200';
    if (type === 'delete' || type === 'error') return 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-200';
    return 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200';
  };

  if (loading) return <div className="flex min-h-full items-center justify-center p-10"><CustomLoader text="Loading audit trail..." /></div>;

  return (
    <div className="min-h-full w-full bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6 text-slate-900 dark:from-[#06111f] dark:via-[#081423] dark:to-[#040b14] dark:text-white lg:p-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/[0.04] md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
                <ShieldCheck size={14} /> Professional audit trail
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight md:text-4xl">Financial Audit Trail</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                  Live record of financial and administrative events from the system audit tables. Search, filter, and export activity with clear timestamps, actor information, and resource context.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Events', value: stats.total },
                { label: 'Creates', value: stats.create },
                { label: 'Updates', value: stats.update },
                { label: 'Errors', value: stats.errors },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{item.label}</p>
                  <p className="mt-2 text-xl font-black text-slate-900 dark:text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2">
                <Filter size={18} className="text-sky-600 dark:text-sky-300" />
                <h2 className="text-lg font-black">Filters</h2>
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search user, action, module, or description..."
                className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-sky-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">From</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">To</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {filters.map((filter) => {
                  const active = filterType === (filter === 'All events' ? 'all' : filter.toLowerCase());
                  return (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setFilterType(filter === 'All events' ? 'all' : filter.toLowerCase())}
                      className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                        active
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:bg-white/10'
                      }`}
                    >
                      {filter}
                    </button>
                  );
                })}
              </div>
              <button onClick={exportCsv} type="button" className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:bg-white/10">
                <Download size={16} /> Export CSV
              </button>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-violet-600 dark:text-violet-300" />
                <h2 className="text-lg font-black">Control summary</h2>
              </div>
              <div className="mt-4 space-y-4 text-sm text-slate-600 dark:text-slate-300">
                <div className="flex items-start gap-3">
                  <Activity size={16} className="mt-0.5 text-emerald-500" />
                  <p>Entries are grouped from `activity_logs` and delete audit logs so removals no longer disappear from the trail.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Clock3 size={16} className="mt-0.5 text-sky-500" />
                  <p>Use the timestamps and resource context to reconstruct who did what, when, and from where.</p>
                </div>
                <div className="flex items-start gap-3">
                  <Users size={16} className="mt-0.5 text-amber-500" />
                  <p>Actor, module, and metadata are surfaced together for quicker finance and operations reviews.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
            <div className="border-b border-slate-200 px-6 py-4 dark:border-white/10">
              <h2 className="text-lg font-black">Event register</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Recent records from the live audit tables.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:border-white/10 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">User</th>
                    <th className="px-5 py-3">Action</th>
                    <th className="px-5 py-3">Module</th>
                    <th className="px-5 py-3">Resource</th>
                    <th className="px-5 py-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {filteredLogs.length ? filteredLogs.map((row) => (
                    <tr key={row.id} className="odd:bg-slate-50/70 even:bg-transparent dark:odd:bg-white/[0.02]">
                      <td className="px-5 py-4 font-mono text-xs text-slate-600 dark:text-slate-300">{formatDateTime(row.created_at)}</td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{row.user_name || row.user_email || 'System'}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{row.user_email || row.module || '-'}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${getActionClass(row.action_type)}`}>
                          {row.action_type}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{row.module || row.action_category || '-'}</td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                        <div>{row.resource_type || row.resource_id || '-'}</div>
                        <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">{row.device_type || 'device n/a'} · {row.platform || 'platform n/a'}</div>
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                        <div>{row.description || 'Activity recorded'}</div>
                        <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">{formatMetadata(row.metadata)} · Session {row.session_id || 'n/a'}</div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                        No audit records match the current search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {toast && <CustomToast isVisible={!!toast} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default AuditTrail;
