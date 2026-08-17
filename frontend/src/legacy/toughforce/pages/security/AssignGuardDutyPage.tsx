// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import CustomToast, { sanitizeError } from '../../components/CustomToast';
import { NotificationService } from '../../services/NotificationService';
import {
  buildSiteShiftDrafts,
  createBulkShifts,
  fetchRosterBootstrapData,
  findShiftConflicts,
  formatGuardDropdownLabel,
  isGuardScheduledOnDate,
  sendShiftNotification,
  toIsoDateKey,
} from '../../services/securityRosterService';
import type { SecurityCentre, SecurityGuard, SecurityPost, SecuritySite, SecurityShift } from '../../types/security';

type AssignmentRow = {
  employee_id: string;
  replacement_id: string;
};

type AssignmentDraft = {
  centre_id: string;
  site_id: string;
  post_id: string;
  shift_kind: 'day' | 'night' | 'custom';
  assignments: AssignmentRow[];
  shift_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  notes: string;
};

const todayKey = toIsoDateKey(new Date());

const createAssignmentRow = (): AssignmentRow => ({
  employee_id: '',
  replacement_id: '',
});

const getSiteLabel = (site?: SecuritySite | null, centre?: SecurityCentre | null) => site?.name || centre?.name || 'selected site';
const addDays = (date: string, days: number) => {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
};

const AssignGuardDutyPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [centres, setCentres] = useState<SecurityCentre[]>([]);
  const [sites, setSites] = useState<SecuritySite[]>([]);
  const [posts, setPosts] = useState<SecurityPost[]>([]);
  const [guards, setGuards] = useState<SecurityGuard[]>([]);
  const [shifts, setShifts] = useState<SecurityShift[]>([]);
  const [assignmentDraft, setAssignmentDraft] = useState<AssignmentDraft | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const bootstrap = await fetchRosterBootstrapData();
        if (!active) return;

        setCentres(bootstrap.centres);
        setSites(bootstrap.sites);
        setPosts(bootstrap.posts);
        setGuards(bootstrap.guards);
        setShifts(bootstrap.shifts);

        const siteId = searchParams.get('site_id') || '';
        const postId = searchParams.get('post_id') || '';
        const centreId = searchParams.get('centre_id') || bootstrap.sites.find((site) => site.id === siteId)?.centre_id || '';
        const site = bootstrap.sites.find((item) => item.id === siteId) || null;
        const centre = bootstrap.centres.find((item) => item.id === centreId) || null;

        setAssignmentDraft({
          centre_id: centreId,
          site_id: siteId,
          post_id: postId,
          shift_kind: 'day',
          assignments: [createAssignmentRow()],
          shift_date: todayKey,
          end_date: todayKey,
          start_time: '06:00',
          end_time: '18:00',
          notes: `Assigned directly from ${getSiteLabel(site, centre)} operations.`,
        });
      } catch (error) {
        if (!active) return;
        setToast({ message: sanitizeError(error), type: 'error' });
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [searchParams]);

  const selectedCentre = useMemo(
    () => centres.find((centre) => centre.id === assignmentDraft?.centre_id) || null,
    [centres, assignmentDraft?.centre_id]
  );
  const selectedSite = useMemo(
    () => sites.find((site) => site.id === assignmentDraft?.site_id) || null,
    [sites, assignmentDraft?.site_id]
  );
  const selectedPosts = useMemo(
    () => posts.filter((post) => post.site_id === assignmentDraft?.site_id),
    [posts, assignmentDraft?.site_id]
  );
  const selectedAssignmentGuardIds = useMemo(
    () => assignmentDraft?.assignments.map((row) => row.employee_id).filter(Boolean) ?? [],
    [assignmentDraft]
  );
  const assignmentDateKey = assignmentDraft?.shift_date || '';

  const updateAssignmentRow = (index: number, field: 'employee_id' | 'replacement_id', value: string) => {
    if (!assignmentDraft) return;
    const assignments = [...assignmentDraft.assignments];
    assignments[index] = { ...assignments[index], [field]: value };
    setAssignmentDraft({ ...assignmentDraft, assignments });
  };

  const addAssignmentRow = () => {
    if (!assignmentDraft) return;
    setAssignmentDraft({ ...assignmentDraft, assignments: [...assignmentDraft.assignments, createAssignmentRow()] });
  };

  const removeAssignmentRow = (index: number) => {
    if (!assignmentDraft) return;
    if (assignmentDraft.assignments.length === 1) return;
    setAssignmentDraft({
      ...assignmentDraft,
      assignments: assignmentDraft.assignments.filter((_, rowIndex) => rowIndex !== index),
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentDraft) return;

    setSaving(true);
    try {
      const selectedAssignments = assignmentDraft.assignments.filter((assignment) => assignment.employee_id);
      if (selectedAssignments.length === 0) {
        throw new Error('Please select at least one guard to assign.');
      }
      if (!assignmentDraft.site_id) {
        throw new Error('Choose a site before saving this assignment.');
      }

      const guardLookup = new Map(guards.map((guard) => [guard.id, guard.full_name || ''] as const));
      const payload = buildSiteShiftDrafts(
        selectedAssignments.map((assignment) => ({
          site_id: assignmentDraft.site_id,
          post_id: assignmentDraft.post_id || null,
          employee_id: assignment.employee_id,
          replacement_id: assignment.replacement_id || null,
          shift_kind: assignmentDraft.shift_kind,
          shift_date: assignmentDraft.shift_date,
          end_date: assignmentDraft.end_date || assignmentDraft.shift_date,
          start_time: assignmentDraft.start_time,
          end_time: assignmentDraft.end_time,
          notes: assignmentDraft.notes.trim(),
        })),
        guardLookup,
        selectedSite?.name || selectedCentre?.name || null
      );

      const conflicts = await findShiftConflicts(payload, guards);
      if (conflicts.length > 0) {
        throw new Error(
          conflicts[0].reason === 'duplicate'
            ? `${conflicts[0].employeeName} already has that exact shift saved.`
            : `${conflicts[0].employeeName} already has overlapping roster cover.`
        );
      }

      const createdShifts = await createBulkShifts(payload);
      void Promise.allSettled(createdShifts.map((shift) => sendShiftNotification(shift)));

      setToast({
        message: `Assigned ${createdShifts.length} guard${createdShifts.length === 1 ? '' : 's'} from the site page and notified them by email and SMS.`,
        type: 'success',
      });

      const shiftStart = new Date(`${assignmentDraft.shift_date}T${assignmentDraft.start_time}:00`);
      navigate('/app/security/roster?view=table');

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        NotificationService.sendNotification(
          user.id,
          'Guard Assigned From Site Page',
          `${selectedAssignments.length} guard${selectedAssignments.length === 1 ? '' : 's'} were assigned from Sites & Branches.`,
          'success'
        );
      }
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !assignmentDraft) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-white px-4 dark:bg-dark-bg">
        <div className="rounded-3xl border border-gray-200 bg-white px-6 py-5 text-center shadow-xl dark:border-white/10 dark:bg-dark-surface">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-purple" />
          <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-300">Loading guard assignment page...</p>
        </div>
      </div>
    );
  }

  const isPreselectedSite = Boolean(searchParams.get('site_id'));

  return (
    <div className="min-h-screen bg-white p-6 text-gray-900 dark:bg-dark-bg dark:text-white lg:p-10">
      <CustomToast isVisible={!!toast} message={toast?.message || ''} type={toast?.type as any} onClose={() => setToast(null)} />

      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/app/security/sites')}
            className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-white/5"
            title="Go back"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Plus className="text-brand-purple" />
              Assign Guard Duty
            </h1>
            <p className="text-sm text-gray-500 dark:text-dark-text">
              Open the assignment on its own page and prefill the site or post you clicked from.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-xl dark:border-dark-border dark:bg-dark-surface">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Branch</label>
                <select
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-dark-border dark:bg-dark-bg"
                  value={assignmentDraft.centre_id}
                  onChange={(e) => setAssignmentDraft({ ...assignmentDraft, centre_id: e.target.value, site_id: '', post_id: '' })}
                >
                  <option value="">Select branch</option>
                  {centres.map((centre) => (
                    <option key={centre.id} value={centre.id}>
                      {centre.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Site</label>
                <select
                  required
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-dark-border dark:bg-dark-bg"
                  value={assignmentDraft.site_id}
                  onChange={(e) => setAssignmentDraft({ ...assignmentDraft, site_id: e.target.value, post_id: '' })}
                  disabled={isPreselectedSite && !!assignmentDraft.site_id}
                >
                  <option value="">Select site</option>
                  {(assignmentDraft.centre_id ? sites.filter((site) => site.centre_id === assignmentDraft.centre_id) : sites).map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Post</label>
                <select
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-dark-border dark:bg-dark-bg"
                  value={assignmentDraft.post_id}
                  onChange={(e) => setAssignmentDraft({ ...assignmentDraft, post_id: e.target.value })}
                  disabled={!assignmentDraft.site_id}
                >
                  <option value="">Select post</option>
                  {selectedPosts.map((post) => (
                    <option key={post.id} value={post.id}>
                      {post.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Shift kind</label>
                <select
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-dark-border dark:bg-dark-bg"
                  value={assignmentDraft.shift_kind}
                  onChange={(e) => {
                    const shift_kind = e.target.value as AssignmentDraft['shift_kind'];
                    setAssignmentDraft({
                      ...assignmentDraft,
                      shift_kind,
                      start_time: shift_kind === 'night' ? '18:00' : shift_kind === 'day' ? '06:00' : assignmentDraft.start_time,
                      end_time: shift_kind === 'night' ? '06:00' : shift_kind === 'day' ? '18:00' : assignmentDraft.end_time,
                      end_date: shift_kind === 'night' ? addDays(assignmentDraft.shift_date, 1) : assignmentDraft.shift_date,
                    });
                  }}
                >
                  <option value="day">Day</option>
                  <option value="night">Night</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Shift date</label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-dark-border dark:bg-dark-bg"
                  value={assignmentDraft.shift_date}
                  onChange={(e) => setAssignmentDraft({
                    ...assignmentDraft,
                    shift_date: e.target.value,
                    end_date: assignmentDraft.shift_kind === 'night' ? addDays(e.target.value, 1) : assignmentDraft.end_date,
                  })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Start time</label>
                <input
                  type="time"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-dark-border dark:bg-dark-bg"
                  value={assignmentDraft.start_time}
                  onChange={(e) => setAssignmentDraft({ ...assignmentDraft, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400">End date</label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-dark-border dark:bg-dark-bg"
                  value={assignmentDraft.end_date}
                  onChange={(e) => setAssignmentDraft({ ...assignmentDraft, end_date: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400">End time</label>
                <input
                  type="time"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-dark-border dark:bg-dark-bg"
                  value={assignmentDraft.end_time}
                  onChange={(e) => setAssignmentDraft({ ...assignmentDraft, end_time: e.target.value })}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Notes</label>
                <input
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-dark-border dark:bg-dark-bg"
                  value={assignmentDraft.notes}
                  onChange={(e) => setAssignmentDraft({ ...assignmentDraft, notes: e.target.value })}
                  placeholder="Reason, instructions, or handover notes"
                />
              </div>
            </div>

            <div className="space-y-4">
              {assignmentDraft.assignments.map((row, index) => (
                <div key={index} className="rounded-2xl border border-gray-200 p-4 dark:border-white/10">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Guard</label>
                      <select
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-dark-border dark:bg-dark-bg"
                        value={row.employee_id}
                        onChange={(e) => updateAssignmentRow(index, 'employee_id', e.target.value)}
                      >
                        <option value="">Select guard</option>
                        {guards.map((guard) => {
                          const alreadyAssignedToday = assignmentDateKey
                            ? isGuardScheduledOnDate(guard.id, shifts, assignmentDateKey)
                            : false;
                          const selectedElsewhere = selectedAssignmentGuardIds.includes(guard.id) && guard.id !== row.employee_id;
                          const disabled = (alreadyAssignedToday && guard.id !== row.employee_id) || selectedElsewhere;
                          return (
                            <option key={guard.id} value={guard.id} disabled={disabled}>
                              {formatGuardDropdownLabel(guard, alreadyAssignedToday && guard.id !== row.employee_id)}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Off duty releaver</label>
                      <select
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-dark-border dark:bg-dark-bg"
                        value={row.replacement_id}
                        onChange={(e) => updateAssignmentRow(index, 'replacement_id', e.target.value)}
                      >
                        <option value="">Optional</option>
                        {guards
                          .filter((guard) => guard.id !== row.employee_id || guard.id === row.replacement_id)
                          .map((guard) => {
                            const alreadyAssignedToday = assignmentDateKey
                              ? isGuardScheduledOnDate(guard.id, shifts, assignmentDateKey)
                              : false;
                            const selectedElsewhere = selectedAssignmentGuardIds.includes(guard.id) && guard.id !== row.replacement_id;
                            const disabled = (alreadyAssignedToday && guard.id !== row.replacement_id) || selectedElsewhere;
                            return (
                              <option key={guard.id} value={guard.id} disabled={disabled}>
                                {formatGuardDropdownLabel(guard, alreadyAssignedToday && guard.id !== row.replacement_id)}
                              </option>
                            );
                          })}
                      </select>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
                    Guards already assigned on this date are marked and disabled, matching bulk mode.
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-500">Each row becomes its own roster shift.</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={addAssignmentRow}
                        className="rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-600 dark:border-white/10 dark:text-gray-300"
                      >
                        Add another guard
                      </button>
                      {assignmentDraft.assignments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAssignmentRow(index)}
                          className="rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-600 dark:border-white/10 dark:text-gray-300"
                        >
                          <Trash2 size={12} className="mr-1 inline" />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xl dark:border-dark-border dark:bg-dark-surface">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Assignment summary</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>Branch</span>
                  <span className="font-bold">{selectedCentre?.name || assignmentDraft.centre_id || 'Not set'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Site</span>
                  <span className="font-bold">{selectedSite?.name || assignmentDraft.site_id || 'Not set'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Post</span>
                  <span className="font-bold">{assignmentDraft.post_id || 'Any / None'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Guard rows</span>
                  <span className="font-bold">{assignmentDraft.assignments.filter((row) => row.employee_id).length}</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-brand-purple/20 bg-brand-purple/5 p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-purple">How it works</p>
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                If you launch this from a site or post, the site comes in already selected so you can assign guards immediately.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/app/security/sites')}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 dark:border-white/10 dark:text-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-purple px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save assignment
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignGuardDutyPage;
