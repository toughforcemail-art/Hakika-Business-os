// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { 
  Clock, 
  UserCheck, 
  AlertCircle, 
  MapPin,
  Printer,
  Trash2,
  Plus,
  Search,
  Filter,
  X
} from 'lucide-react';
import { printWorkspacePage } from '../../utils/printHelpers';
import { motion } from 'framer-motion';
import { useAsyncData } from '../../hooks/useAsyncData';
import { supabase } from '../../utils/supabase';
import {
  createBulkShifts,
  findShiftConflicts,
  formatGuardDropdownLabel,
  fetchAttendanceMasterData,
  fetchRosterReferenceData,
  getCachedRosterBootstrapData,
  isGuardScheduledOnDate,
  sendShiftNotification,
  isShiftActive,
  resolveWorkflowStatus,
  toIsoDateKey,
} from '../../services/securityRosterService';
import type { SecurityCentre, SecurityGuard, SecurityPost, SecurityShift, SecuritySite, ShiftStatus } from '../../types/security';
import { useNavigate } from 'react-router-dom';

interface AttendancePageData {
  attendance: SecurityShift[];
  employees: SecurityGuard[];
  centres: SecurityCentre[];
  sites: SecuritySite[];
  posts: SecurityPost[];
}

const emptyAttendancePageData: AttendancePageData = {
  attendance: [],
  employees: [],
  centres: [],
  sites: [],
  posts: [],
};

const initialFilters = {
  query: '',
  county: 'all',
  siteId: 'all',
  postId: 'all',
  branchId: 'all',
  status: 'all',
};

const initialFormData = {
  employee_id: '',
  site_id: '',
  start_time: '',
  end_time: '',
  status: 'scheduled' as ShiftStatus,
};

const AttendanceMaster: React.FC = () => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [filters, setFilters] = useState(initialFilters);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [cachedBootstrap] = useState(() => getCachedRosterBootstrapData());

  const { data, loading, error, run } = useAsyncData(async () => {
    const [attendance, metadata] = await Promise.all([
      fetchAttendanceMasterData(),
      fetchRosterReferenceData(),
    ]);

    return {
      attendance,
      employees: metadata.guards,
      centres: metadata.centres ?? [],
      sites: metadata.sites,
      posts: metadata.posts ?? [],
    };
  }, [], {
    initialData: cachedBootstrap
      ? {
          attendance: cachedBootstrap.shifts,
          employees: cachedBootstrap.guards,
          centres: cachedBootstrap.centres ?? [],
          sites: cachedBootstrap.sites,
          posts: cachedBootstrap.posts ?? [],
        }
      : emptyAttendancePageData,
    immediate: !cachedBootstrap,
  });

  useEffect(() => {
    if (cachedBootstrap) {
      void run();
    }
  }, [cachedBootstrap, run]);

  useEffect(() => {
    const channel = supabase
      .channel('attendance-master-security-shifts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'security_shifts',
        },
        () => {
          void run();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [run]);

  const todayKey = toIsoDateKey(new Date());
  const attendanceRows = data.attendance
    .filter((record): record is NonNullable<typeof record> => Boolean(record))
    .slice()
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  const visibleAttendanceRows = useMemo(() => {
    const query = filters.query.trim().toLowerCase();

    return attendanceRows
      .filter((record) => {
        const status = resolveWorkflowStatus(record);
        const guardName = record.employee_name_snapshot || record.profiles?.full_name || '';
        const siteName = record.security_sites?.name || '';
        const county = record.security_sites?.county || '';
        const postName = record.security_posts?.name || '';
        const branchName = record.security_sites?.security_centres?.name || '';

        if (filters.status !== 'all' && status !== filters.status) return false;
        if (filters.county !== 'all' && county !== filters.county) return false;
        if (filters.siteId !== 'all' && record.site_id !== filters.siteId) return false;
        if (filters.postId !== 'all' && record.post_id !== filters.postId) return false;
        if (filters.branchId !== 'all' && record.security_sites?.centre_id !== filters.branchId) return false;

        if (query) {
          return [guardName, siteName, county, postName, branchName, record.employee_id, record.notes || '']
            .join(' ')
            .toLowerCase()
            .includes(query);
        }

        return true;
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [attendanceRows, filters]);

  const todaysAttendance = visibleAttendanceRows.filter((record) => toIsoDateKey(record.start_time) === todayKey);
  const presentToday = todaysAttendance.filter((record) => ['acknowledged', 'checked_in', 'completed'].includes(resolveWorkflowStatus(record))).length;
  const lateClockIns = todaysAttendance.filter((record) => String(record.status).toLowerCase() === 'late').length;
  const onSiteNow = visibleAttendanceRows.filter((record) => isShiftActive(record) || ['acknowledged', 'checked_in', 'completed'].includes(resolveWorkflowStatus(record))).length;
  const manualEntryDateKey = formData.start_time ? toIsoDateKey(new Date(formData.start_time)) : '';

  const siteOptions = data.sites;
  const branchOptions = data.centres;
  const postOptions = data.posts;
  const countyOptions = Array.from(
    new Set(
      [
        ...siteOptions.map((site) => site.county || ''),
        ...branchOptions.map((branch) => branch.county || ''),
      ]
        .filter((value): value is string => Boolean(value))
    )
  ).sort((a, b) => a.localeCompare(b));
  const getReleaverDisplayName = (record: Pick<SecurityShift, 'replacement_id' | 'replacement_name_snapshot'>) => {
    if (record.replacement_name_snapshot) return record.replacement_name_snapshot;
    if (record.replacement_id) return 'Off-duty releaver';
    return '';
  };

  const handleManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const start = new Date(formData.start_time);
      const end = new Date(formData.end_time);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error('Please provide valid start and end date-times.');
      }

      if (end <= start) {
        throw new Error('End time must be later than start time.');
      }

      const payload = {
        employee_id: formData.employee_id,
        site_id: formData.site_id,
        post_id: null,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: formData.status,
        notes: null,
      };

      const conflicts = await findShiftConflicts([payload], data.employees);
      if (conflicts.length > 0) {
        throw new Error(
          conflicts[0].reason === 'duplicate'
            ? 'That exact attendance shift already exists.'
            : 'That guard already has another overlapping shift.'
        );
      }

      const createdShifts = await createBulkShifts([payload]);
      await Promise.allSettled(createdShifts.map((shift) => sendShiftNotification(shift)));
      setShowModal(false);
      setFormData(initialFormData);
      await run();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error saving attendance.';
      console.error('Error saving attendance:', error);
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full w-full p-6 lg:p-10 space-y-8 bg-white dark:bg-dark-bg text-gray-900 dark:text-white">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-200 dark:border-dark-border pb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Clock className="text-brand-purple" /> Attendance Master
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-text">
            Track guard deployments, clock-ins, and shift completion.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => printWorkspacePage()} className="px-4 py-2 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition flex items-center gap-2">
             <Printer size={16} /> Print
           </button>
           <button 
             onClick={() => {
               if (window.confirm('Clear these attendance records?')) {
                 // Logic
               }
             }}
             className="px-4 py-2 bg-rose-500/10 text-rose-500 text-sm font-medium rounded-xl hover:bg-rose-500/20 transition flex items-center gap-2"
           >
             <Trash2 size={16} /> Delete
           </button>
           <button 
             onClick={() => setShowModal(true)}
             className="px-4 py-2 bg-brand-purple text-white text-sm font-medium rounded-xl hover:bg-opacity-90 transition flex items-center gap-2 shadow-lg shadow-brand-purple/20"
           >
             <Plus size={16} /> Manual Entry
           </button>
        </div>
      </div>

      <div className="glass-card relative z-10 mb-8 rounded-2xl border border-gray-200 p-4 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
            <Filter size={16} className="text-brand-purple" />
            Attendance filters
          </div>
          <button
            type="button"
            onClick={() => setFilters(initialFilters)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-black uppercase tracking-widest text-gray-500 transition hover:border-brand-purple/30 hover:text-brand-purple dark:border-white/10 dark:text-gray-300"
          >
            <X size={14} />
            Clear filters
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Search by name</span>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-dark-surface">
              <Search size={14} className="text-gray-400" />
              <input
                value={filters.query}
                onChange={(e) => setFilters((current) => ({ ...current, query: e.target.value }))}
                placeholder="Guard, site, post, branch"
                className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
              />
            </div>
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">County</span>
            <select
              value={filters.county}
              onChange={(e) => setFilters((current) => ({ ...current, county: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-dark-surface"
            >
              <option value="all">All counties</option>
              {countyOptions.map((county) => (
                <option key={county} value={county}>
                  {county}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Branch</span>
            <select
              value={filters.branchId}
              onChange={(e) => setFilters((current) => ({ ...current, branchId: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-dark-surface"
            >
              <option value="all">All branches</option>
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Site</span>
            <select
              value={filters.siteId}
              onChange={(e) => setFilters((current) => ({ ...current, siteId: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-dark-surface"
            >
              <option value="all">All sites</option>
              {siteOptions.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Post</span>
            <select
              value={filters.postId}
              onChange={(e) => setFilters((current) => ({ ...current, postId: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-dark-surface"
            >
              <option value="all">All posts</option>
              {postOptions.map((post) => (
                <option key={post.id} value={post.id}>
                  {post.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Status</span>
            <select
              value={filters.status}
              onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-dark-surface"
            >
              <option value="all">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="checked_in">Checked in</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        </div>
      </div>

      {(error || saveError) && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
          {saveError || error}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
           <motion.div 
             initial={{ scale: 0.95, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             className="bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
           >
              <h3 className="text-lg font-semibold mb-4">Manual Attendance Entry</h3>
              <form onSubmit={handleManualEntry} className="space-y-4">
                 <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Employee</label>
                    <select 
                      title="Select Guard"
                      required
                      className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg p-2 text-sm"
                      value={formData.employee_id}
                      onChange={(e) => setFormData({...formData, employee_id: e.target.value})}
                    >
                       <option value="">Select Guard</option>
                       {data.employees.map((guard) => {
                         const alreadyAssignedToday = manualEntryDateKey
                           ? isGuardScheduledOnDate(guard.id, attendanceRows, manualEntryDateKey)
                           : false;
                         const disabled = alreadyAssignedToday && guard.id !== formData.employee_id;
                         return (
                           <option key={guard.id} value={guard.id} disabled={disabled}>
                             {formatGuardDropdownLabel(guard, alreadyAssignedToday && guard.id !== formData.employee_id)}
                           </option>
                         );
                       })}
                    </select>
                 </div>
                 <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Site</label>
                    <select 
                      title="Select Site"
                      required
                      className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg p-2 text-sm"
                      value={formData.site_id}
                      onChange={(e) => setFormData({...formData, site_id: e.target.value})}
                    >
                       <option value="">Select Site</option>
                       {data.sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label className="text-xs font-semibold text-gray-500">Start Time</label>
                       <input 
                         title="Start Time"
                         type="datetime-local"
                         required
                         className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg p-2 text-sm"
                         value={formData.start_time}
                         onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                       />
                    </div>
                    <div className="space-y-1">
                       <label className="text-xs font-semibold text-gray-500">End Time</label>
                       <input 
                         title="End Time"
                         type="datetime-local"
                         required
                         className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg p-2 text-sm"
                         value={formData.end_time}
                         onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                       />
                    </div>
                 </div>
                 <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-dark-surface rounded-lg transition">Cancel</button>
                    <button disabled={saving} type="submit" className="px-4 py-2 bg-brand-purple text-white text-sm font-medium rounded-lg hover:bg-opacity-90 transition disabled:opacity-60">
                      {saving ? 'Saving...' : 'Save Entry'}
                    </button>
                 </div>
              </form>
           </motion.div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
         {[
           { label: 'Present Today', value: loading ? '--' : String(presentToday), icon: UserCheck, color: 'emerald' },
           { label: 'Late Clock-ins', value: loading ? '--' : String(lateClockIns), icon: AlertCircle, color: 'rose' },
           { label: 'On-Site Now', value: loading ? '--' : String(onSiteNow), icon: MapPin, color: 'blue' },
         ].map((stat, idx) => (
           <div key={idx} className="glass-card p-6 rounded-2xl border border-gray-200 dark:border-white/10 flex items-center gap-6">
              <div className={`p-4 bg-${stat.color}-500/10 text-${stat.color}-500 rounded-2xl`}>
                 <stat.icon size={24}/>
              </div>
              <div>
                 <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{stat.label}</p>
                 <h3 className="text-2xl font-bold">{stat.value}</h3>
              </div>
           </div>
         ))}
      </div>

      <div className="glass-card rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="border-b border-white/10 bg-dark-surface/90 text-xs uppercase tracking-wider text-white/50 font-black">
                     <th className="p-4">Guard</th>
                     <th className="p-4">Branch / Site / Post</th>
                     <th className="p-4">Date</th>
                     <th className="p-4">Scheduled</th>
                     <th className="p-4">Clock In</th>
                     <th className="p-4">Status</th>
                  </tr>
               </thead>
               <tbody className="text-gray-700 dark:text-gray-200">
                  {visibleAttendanceRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        No attendance rows match the current filters.
                      </td>
                    </tr>
                  ) : visibleAttendanceRows.map((record, idx) => {
                    const workflow = resolveWorkflowStatus(record);
                    const branchName = record.security_sites?.security_centres?.name || 'Branch';
                    const shiftDate = new Date(record.start_time).toLocaleDateString();
                    const shiftStart = new Date(record.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const shiftEnd = new Date(record.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const scheduledWindow = `${shiftDate} • ${shiftStart} - ${shiftEnd}`;

                    return (
                    <tr
                      key={idx}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/app/security/attendance/${record.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          navigate(`/app/security/attendance/${record.id}`);
                        }
                      }}
                      className="border-b border-gray-100 transition-colors hover:cursor-pointer hover:bg-gray-100 hover:text-gray-900 dark:border-white/5 dark:hover:bg-white/5 dark:hover:text-white"
                    >
                       <td className="p-4">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-lg bg-brand-purple/10 text-brand-purple flex items-center justify-center font-bold text-xs">
                                {record.profiles?.full_name?.substring(0,2)}
                             </div>
                             <div>
                               <span className="font-medium text-sm">{record.profiles?.full_name}</span>
                             </div>
                          </div>
                       </td>
                       <td className="p-4 text-sm">
                         <div className="space-y-1">
                           <p>{branchName}</p>
                           <p className="font-medium text-gray-700 dark:text-gray-200">{record.security_sites?.name || 'Unknown site'}</p>
                           <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{record.security_posts?.name || 'No post'}</p>
                           {record.replacement_id && (
                             <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
                               Releaved by {getReleaverDisplayName(record)}
                             </p>
                           )}
                         </div>
                       </td>
                       <td className="p-4 text-sm text-gray-500 dark:text-gray-400">
                          {shiftDate}
                       </td>
                       <td className="p-4 text-sm text-gray-500 dark:text-gray-400">
                          {scheduledWindow}
                       </td>
                       <td className="p-4">
                          {['completed', 'acknowledged', 'checked_in'].includes(workflow) ? (
                             <div className="space-y-1">
                               <span className="text-sm font-medium text-emerald-500">
                                  {record.checked_in_at
                                    ? new Date(record.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    : new Date(record.start_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                               </span>
                               <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80">
                                 By {record.checked_in_by_name_snapshot || (record.checked_in_by ? 'Assigned releaver' : 'Unknown')}
                               </p>
                             </div>
                          ) : (
                             <span className="text-sm text-gray-400">--:--</span>
                          )}
                       </td>
                       <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                             workflow === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 
                             workflow === 'checked_in' ? 'bg-blue-500/10 text-blue-500' :
                             workflow === 'acknowledged' ? 'bg-indigo-500/10 text-indigo-500' :
                             workflow === 'published' ? 'bg-sky-500/10 text-sky-500' :
                             workflow === 'draft' ? 'bg-amber-500/10 text-amber-500' :
                             'bg-rose-500/10 text-rose-500'
                          }`}>
                             {workflow.replace('_', ' ')}
                          </span>
                       </td>
                    </tr>
                    );
                  })}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

export default AttendanceMaster;
