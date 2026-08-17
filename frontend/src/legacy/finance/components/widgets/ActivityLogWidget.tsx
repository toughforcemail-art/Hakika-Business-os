// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { Activity, Clock, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../utils/supabase';

interface ActivityLogWidgetProps {
  module: 'hr' | 'security' | 'real_estate' | 'rock_of_ages_cms' | 'finance';
  companyCode: string;
  limit?: number;
}

interface LogRow {
  id: string;
  user_name: string | null;
  action_type: string;
  description: string | null;
  created_at: string;
}

const formatTime = (value: string) =>
  new Date(value).toLocaleString('en-KE', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const getActionColor = (type: string) => {
  if (type === 'login') return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400';
  if (type === 'create') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400';
  if (type === 'update') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400';
  if (type === 'delete' || type === 'error') return 'bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400';
  if (type === 'page_view') return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400';
};

const ActivityLogWidget: React.FC<ActivityLogWidgetProps> = ({ module, companyCode, limit = 20 }) => {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!companyCode) return;

    const fetchLogs = async () => {
      setLoading(true);
      setError('');
      try {
        const { data, error: fetchError } = await supabase
          .from('activity_logs')
          .select('id, user_name, action_type, description, created_at')
          .eq('company_code', companyCode)
          .eq('module', module)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (fetchError) throw fetchError;
        setLogs((data || []) as LogRow[]);
      } catch (err: any) {
        console.error('ActivityLogWidget: fetch error', err);
        setError(err.message || 'Failed to load activity logs.');
      } finally {
        setLoading(false);
      }
    };

    void fetchLogs();
  }, [companyCode, module, limit]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-[#1e293b] dark:bg-[#0f172a]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
        </div>
        <Link
          to={`/admin/activity-log?module=${module}`}
          className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          View all logs →
        </Link>
      </div>

      {loading ? (
        <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>
      ) : error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      ) : logs.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">No activity recorded yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-[#1e293b]">
                <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1"><Clock size={12} /> Time</span>
                </th>
                <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1"><User size={12} /> User</span>
                </th>
                <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Action</th>
                <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-[#1e293b]">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-[#111827]">
                  <td className="py-2 pr-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {formatTime(log.created_at)}
                  </td>
                  <td className="py-2 pr-3 text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {log.user_name || 'Unknown'}
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getActionColor(log.action_type)}`}>
                      {log.action_type}
                    </span>
                  </td>
                  <td className="py-2 max-w-[200px] truncate text-xs text-gray-600 dark:text-gray-400">
                    {log.description || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ActivityLogWidget;
