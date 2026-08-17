// @ts-nocheck
import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  ShieldCheck, 
  FileText, 
  Edit3,
  UserCheck,
  Award,
  Printer,
  Trash2,
  Plus,
  ShieldOff,
  History
} from 'lucide-react';
import { printWorkspacePage } from '../../utils/printHelpers';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchSecurityGuards } from '../../services/securityRosterService';
import { supabase } from '../../utils/supabase';
import { invokeEdgeFunction } from '../../utils/edgeFunctions';
import CustomToast, { ToastType, sanitizeError } from '../../components/CustomToast';

const GuardDatabase: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingGuardId, setDeletingGuardId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const { data: guards, loading, error, run } = useAsyncData(fetchSecurityGuards, [], {
    initialData: [],
    immediate: true,
  });

  const filteredGuards = guards.filter(g => 
    g.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.psra_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const activeGuards = guards.filter((guard) => ['active', 'Active', 'On-Duty'].includes(guard.status || '')).length;
  const missingPsra = guards.filter((guard) => !guard.psra_number).length;
  const missingUniform = guards.filter((guard) => !guard.uniform_size).length;

  const handleDeleteGuard = async (guard: (typeof guards)[number]) => {
    const confirmed = window.confirm(
      `Delete ${guard.full_name || 'this guard'}? This will archive the profile and remove the live account.`
    );

    if (!confirmed) return;

    setDeletingGuardId(guard.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Authentication required');

      const data = await invokeEdgeFunction('delete-user', { userId: guard.id }, {
        accessToken: session.access_token,
      });

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to delete guard.');
      }

      setToast({
        message: `${guard.full_name || 'Guard'} deleted successfully and moved to Past Guards.`,
        type: 'success',
      });
      await run();
    } catch (deleteError) {
      setToast({ message: sanitizeError(deleteError), type: 'error' });
    } finally {
      setDeletingGuardId(null);
    }
  };

  return (
    <div className="min-h-full w-full p-6 lg:p-10 space-y-8 bg-white dark:bg-dark-bg text-gray-900 dark:text-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-200 dark:border-dark-border pb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="text-brand-purple" /> Guard Database
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-text">
            Registry of all security personnel and their credentials.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate('/app/security/past-guards')}
            title="View archived and deleted guard profiles"
            className="px-4 py-2 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition flex items-center gap-2"
          >
            <History size={16} /> Past Guards
          </button>
           <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
             <input 
               type="text" 
               placeholder="Search by name or PSRA..."
               title="Search guard database by name or PSRA number"
               className="pl-10 pr-4 py-2 bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-purple transition-all w-64"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
           </div>
          <button onClick={() => printWorkspacePage()} title="Print current guard registry" className="px-4 py-2 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition flex items-center gap-2">
             <Printer size={16} /> Print
           </button>
           <button onClick={() => navigate('/app/security/guards/new')} title="Onboard and register a new security guard" className="px-4 py-2 bg-brand-purple text-white text-sm font-medium rounded-xl hover:bg-opacity-90 transition flex items-center gap-2 shadow-lg shadow-brand-purple/20">
             <Plus size={16} /> Add Guard
           </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Active guards', value: loading ? '--' : activeGuards, tone: 'text-emerald-500' },
          { label: 'Missing PSRA', value: loading ? '--' : missingPsra, tone: 'text-amber-500' },
          { label: 'Missing uniform size', value: loading ? '--' : missingUniform, tone: 'text-blue-500' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-dark-surface">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{stat.label}</p>
            <p className={`mt-2 text-2xl font-bold ${stat.tone}`}>{stat.value}</p>
          </div>
          ))}
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-dark-surface">
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-4 dark:border-white/10">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Active guard list</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {loading ? 'Loading registry...' : `${filteredGuards.length} guards in view`}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
            <span className="rounded-full bg-gray-50 px-3 py-1 dark:bg-white/5">PSRA</span>
            <span className="rounded-full bg-gray-50 px-3 py-1 dark:bg-white/5">Status</span>
            <span className="rounded-full bg-gray-50 px-3 py-1 dark:bg-white/5">Uniform</span>
          </div>
        </div>

        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                <tr>
                  <th className="px-6 py-4">Guard</th>
                  <th className="px-6 py-4">Details</th>
                  <th className="px-6 py-4">PSRA</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Uniform</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {[1, 2, 3].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-gray-100 dark:bg-white/5" />
                        <div className="space-y-2">
                          <div className="h-4 w-40 rounded bg-gray-100 dark:bg-white/5" />
                          <div className="h-3 w-24 rounded bg-gray-100 dark:bg-white/5" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-2">
                        <div className="h-4 w-32 rounded bg-gray-100 dark:bg-white/5" />
                        <div className="h-3 w-28 rounded bg-gray-100 dark:bg-white/5" />
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="h-4 w-20 rounded bg-gray-100 dark:bg-white/5" />
                    </td>
                    <td className="px-6 py-5">
                      <div className="h-6 w-20 rounded-full bg-gray-100 dark:bg-white/5" />
                    </td>
                    <td className="px-6 py-5">
                      <div className="h-4 w-10 rounded bg-gray-100 dark:bg-white/5" />
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="ml-auto h-9 w-24 rounded-xl bg-gray-100 dark:bg-white/5" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : filteredGuards.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <Users size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No guards found in database.</p>
            <p className="text-sm">Try adjusting your search or add a new guard profile.</p>
            <button
              onClick={() => navigate('/app/security/past-guards')}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-brand-purple/30 px-4 py-2 text-sm font-medium text-brand-purple transition hover:bg-brand-purple/5"
            >
              <ShieldOff size={16} /> View Past Guards
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                <tr>
                  <th className="px-6 py-4">Guard</th>
                  <th className="px-6 py-4">Details</th>
                  <th className="px-6 py-4">PSRA</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Uniform</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {filteredGuards.map((guard, index) => {
                  const status = guard.status || 'Active';
                  const isActive = ['active', 'Active', 'On-Duty'].includes(status);
                  return (
                    <motion.tr
                      key={guard.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="align-top hover:bg-gray-50 dark:hover:bg-white/5"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-purple to-brand-blue text-sm font-bold text-white shadow-lg shadow-brand-purple/20">
                            {guard.full_name?.slice(0, 1) || 'G'}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {guard.full_name || 'Unknown Guard'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {guard.role || 'Security Guard'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {guard.designation || guard.department || 'Security Personnel'}
                          </div>
                          <div className="text-xs text-gray-400">
                            {guard.department || 'Security Department'}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="inline-flex items-center gap-1 rounded-full bg-brand-purple/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-brand-purple">
                          <FileText size={12} />
                          {guard.psra_number || 'PENDING'}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-amber-500/10 text-amber-500'
                          }`}
                        >
                          <ShieldCheck size={12} />
                          {status}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-gray-600 dark:bg-white/5 dark:text-gray-300">
                          <Award size={12} />
                          {guard.uniform_size || 'M'}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/app/security/guards/${guard.id}/edit`)}
                            title={`Edit profile and credentials for ${guard.full_name || 'guard'}`}
                            className="inline-flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-bold uppercase tracking-widest text-gray-700 transition hover:bg-brand-purple/10 hover:text-brand-purple dark:bg-white/5 dark:text-gray-300"
                          >
                            <Edit3 size={12} />
                            Profile
                          </button>
                          <button
                            className="inline-flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-bold uppercase tracking-widest text-gray-700 transition hover:bg-brand-purple/10 hover:text-brand-purple dark:bg-white/5 dark:text-gray-300"
                            title={`Check vetting and compliance status for ${guard.full_name || 'guard'}`}
                          >
                            <UserCheck size={12} />
                            Vetting
                          </button>
                          <button
                            onClick={() => handleDeleteGuard(guard)}
                            disabled={deletingGuardId === guard.id}
                            className="rounded-xl bg-rose-500/10 p-2 text-rose-500 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            title={`Delete ${guard.full_name || 'guard'} and archive the record`}
                            aria-label={`Delete ${guard.full_name || 'guard'}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && <CustomToast isVisible={!!toast} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default GuardDatabase;
