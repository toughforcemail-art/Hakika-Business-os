// @ts-nocheck
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CalendarClock, RotateCcw, Search, ShieldOff, Users } from 'lucide-react';
import CustomToast, { ToastType, sanitizeError } from '../../components/CustomToast';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchPastGuards } from '../../services/securityRosterService';
import { extractEdgeFunctionErrorMessage } from '../../utils/edgeFunctionError';
import { invokeEdgeFunction } from '../../utils/edgeFunctions';
import { supabase } from '../../utils/supabase';
import type { ArchivedSecurityGuard } from '../../types/security';

function formatDateTime(value?: string | null) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getOriginalField(record: ArchivedSecurityGuard, ...keys: string[]) {
  const original = (record.original_data ?? {}) as Record<string, unknown>;
  for (const key of keys) {
    const value = original?.[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  }
  return '';
}

function isGuardArchive(record: ArchivedSecurityGuard) {
  const original = (record.original_data ?? {}) as Record<string, unknown>;
  const haystack = [
    record.full_name,
    record.role,
    record.department,
    record.designation,
    record.employee_no,
    getOriginalField(record, 'role', 'department', 'designation', 'psra_number', 'uniform_size', 'status'),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    original.is_security_guard === true ||
    haystack.includes('security') ||
    haystack.includes('guard')
  );
}

const PastGuards: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const { data: archivedGuards, loading, error, run } = useAsyncData(fetchPastGuards, [], {
    initialData: [],
    immediate: true,
  });

  const guards = archivedGuards.filter(isGuardArchive);
  const filteredGuards = guards.filter((guard) => {
    const needle = searchTerm.toLowerCase();
    return [
      guard.full_name,
      guard.email,
      guard.employee_no,
      guard.role,
      guard.department,
      guard.designation,
      guard.deleted_by_name,
      getOriginalField(guard, 'psra_number', 'uniform_size'),
    ]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(needle));
  });

  const deletedThisMonth = guards.filter((guard) => {
    const archivedAt = new Date(guard.archived_at);
    const now = new Date();
    return (
      archivedAt.getFullYear() === now.getFullYear() &&
      archivedAt.getMonth() === now.getMonth()
    );
  }).length;

  const uniqueDeleters = new Set(guards.map((guard) => guard.deleted_by_name || 'Unknown')).size;

  const handleRefresh = async () => {
    try {
      await run();
      setToast({ message: 'Past guards refreshed successfully.', type: 'success' });
    } catch (refreshError) {
      setToast({ message: sanitizeError(refreshError), type: 'error' });
    }
  };

  const handleReinstate = async (guard: ArchivedSecurityGuard) => {
    const confirmed = window.confirm(
      `Reinstate ${guard.full_name} back to the security roster and recreate their login account?`
    );

    if (!confirmed) return;

    setRestoringId(guard.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Authentication required');

      const data = await invokeEdgeFunction('reinstate-user', {
        archivedProfileId: guard.id,
        sendEmail: true,
        sendSms: true,
        module: 'security',
      }, {
        accessToken: session.access_token,
      });

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to reinstate guard.');
      }

      const deliverySummary = [
        data?.emailSent ? 'email' : null,
        data?.smsSent ? 'sms' : null,
      ].filter(Boolean).join(' and ');

      setToast({
        message: deliverySummary
          ? `${guard.full_name} reinstated successfully. New credentials sent via ${deliverySummary}.`
          : `${guard.full_name} reinstated successfully.`,
        type: 'success',
      });
      await run();
    } catch (error) {
      console.error('Error reinstating guard:', error);
      setToast({
        message: extractEdgeFunctionErrorMessage(error, 'Failed to reinstate guard.'),
        type: 'error',
      });
    } finally {
      setRestoringId(null);
    }
  };

  const stats = [
    { label: 'Deleted guards', value: guards.length, tone: 'text-rose-500', icon: ShieldOff },
    { label: 'Deleted this month', value: deletedThisMonth, tone: 'text-amber-500', icon: CalendarClock },
    { label: 'Unique deleters', value: uniqueDeleters, tone: 'text-brand-purple', icon: Users },
  ];

  return (
    <div className="min-h-full w-full space-y-8 bg-white p-6 text-gray-900 dark:bg-dark-bg dark:text-white lg:p-10">
      <div className="flex flex-col items-start justify-between gap-6 border-b border-gray-200 pb-8 md:flex-row md:items-center dark:border-dark-border">
        <div className="space-y-2">
          <button
            onClick={() => navigate('/app/security/guards')}
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand-purple transition-colors hover:text-brand-pink"
            title="Back to active guard database"
          >
            <ArrowLeft size={14} /> Back to Guard Database
          </button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <ShieldOff className="text-brand-purple" /> Past Guards
            </h1>
            <p className="text-sm text-gray-500 dark:text-dark-text">
              Archived guard records with the staff member who deleted each profile.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate('/app/security/guards')}
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
            title="Return to live guard records"
          >
            Active Guards
          </button>
          <button
            onClick={handleRefresh}
            className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-medium text-white shadow-lg shadow-brand-purple/20 transition hover:bg-opacity-90"
            title="Refresh archived guards"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-dark-surface">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{stat.label}</p>
                  <p className={`mt-2 text-2xl font-bold ${stat.tone}`}>{stat.value}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-3 text-gray-400 dark:bg-white/5">
                  <Icon size={18} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-dark-surface">
        <div className="border-b border-gray-200 p-4 dark:border-white/10">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by name, PSRA, department, or deleted by..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm outline-none transition focus:ring-2 focus:ring-brand-purple/30 dark:border-dark-border dark:bg-dark-bg"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              title="Search archived guards"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-400">Loading archived guards...</div>
        ) : filteredGuards.length === 0 ? (
          <div className="py-20 text-center">
            <ShieldOff className="mx-auto mb-4 text-gray-200 dark:text-gray-700" size={48} />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">No past guards found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm ? 'No archived guards match your search.' : 'Deleted guards will appear here with the deleting user attached.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                <tr>
                  <th className="px-6 py-4">Guard</th>
                  <th className="px-6 py-4">Guard Details</th>
                  <th className="px-6 py-4">Deleted By</th>
                  <th className="px-6 py-4">Archived On</th>
                  <th className="px-6 py-4">Notes</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {filteredGuards.map((guard, index) => {
                  const psra = getOriginalField(guard, 'psra_number') || guard.employee_no || 'N/A';
                  const uniformSize = getOriginalField(guard, 'uniform_size') || 'N/A';
                  const originalStatus = getOriginalField(guard, 'status') || guard.archive_status || 'archived';
                  return (
                    <motion.tr
                      key={guard.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="align-top hover:bg-gray-50 dark:hover:bg-white/5"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-purple to-brand-blue text-sm font-bold text-white shadow-lg shadow-brand-purple/20">
                            {guard.full_name?.slice(0, 1) || 'G'}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white">{guard.full_name || 'Unknown Guard'}</div>
                            <div className="text-xs text-gray-500">
                              {guard.email || 'No email recorded'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {guard.designation || guard.role || 'Security Guard'}
                          </div>
                          <div className="text-xs text-gray-400">
                            {guard.department || 'Security Department'}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-widest">
                            <span className="rounded-full bg-brand-purple/10 px-2 py-1 text-brand-purple">PSRA {psra}</span>
                            <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-600 dark:bg-white/5 dark:text-gray-300">Uniform {uniformSize}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {guard.deleted_by_name || 'Unknown user'}
                          </div>
                          <div className="text-xs text-gray-400">
                            {guard.deleted_by_id || 'No deleter ID stored'}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="font-medium text-gray-900 dark:text-white">{formatDateTime(guard.archived_at)}</div>
                          <div className="text-xs text-gray-400">Archived from live profiles</div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                            {originalStatus}
                          </span>
                          <p className="max-w-xs text-xs leading-5 text-gray-500 dark:text-gray-400">
                            {guard.exit_summary || 'Guard profile archived after deletion. Original profile data is preserved in the archive record.'}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => void handleReinstate(guard)}
                          disabled={restoringId === guard.id}
                          className="inline-flex items-center gap-2 rounded-xl bg-brand-purple px-3 py-2 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-brand-purple/20 transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <RotateCcw size={12} />
                          {restoringId === guard.id ? 'Reinstating...' : 'Reinstate'}
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && (
        <CustomToast
          isVisible={!!toast}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default PastGuards;
