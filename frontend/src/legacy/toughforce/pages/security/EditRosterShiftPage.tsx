// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import CustomToast, { sanitizeError } from '../../components/CustomToast';
import {
  buildSiteShiftDraft,
  fetchRosterBootstrapData,
  findShiftConflicts,
  formatGuardDropdownLabel,
  formatShiftTimeRange,
  isGuardScheduledOnDate,
  resolveShiftKindLabel,
  resolveWorkflowStatus,
  sendShiftNotification,
  toIsoDateKey,
  updateShiftDetails,
} from '../../services/securityRosterService';
import type { SecurityGuard, SecurityPost, SecurityShift, SecuritySite, ShiftWorkflowStatus } from '../../types/security';

type ShiftEditFormState = {
  siteId: string;
  postId: string;
  guardId: string;
  replacementId: string;
  shiftKind: 'day' | 'night' | 'custom';
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  workflowStatus: ShiftWorkflowStatus;
  notes: string;
};

const emptyForm: ShiftEditFormState = {
  siteId: '',
  postId: '',
  guardId: '',
  replacementId: '',
  shiftKind: 'custom',
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  workflowStatus: 'draft',
  notes: '',
};

function getGuardLabel(guard: Pick<SecurityGuard, 'full_name' | 'designation'>) {
  return guard.full_name || guard.designation || 'Unknown guard';
}

const EditRosterShiftPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  const [shift, setShift] = useState<SecurityShift | null>(null);
  const [shifts, setShifts] = useState<SecurityShift[]>([]);
  const [sites, setSites] = useState<SecuritySite[]>([]);
  const [posts, setPosts] = useState<SecurityPost[]>([]);
  const [guards, setGuards] = useState<SecurityGuard[]>([]);
  const [form, setForm] = useState<ShiftEditFormState>(emptyForm);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!id) {
        setToast({ message: 'Missing shift ID.', type: 'error' });
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const bootstrap = await fetchRosterBootstrapData();
        if (!active) return;

        const target = bootstrap.shifts.find((item) => item.id === id) || null;
        if (!target) {
          setShift(null);
          setToast({ message: 'The shift could not be found.', type: 'error' });
          return;
        }

        setSites(bootstrap.sites);
        setPosts(bootstrap.posts);
        setGuards(bootstrap.guards);
        setShifts(bootstrap.shifts);
        setShift(target);
        setForm({
          siteId: target.site_id,
          postId: target.post_id || '',
          guardId: target.employee_id,
          replacementId: target.replacement_id || '',
          shiftKind: target.shift_kind || 'custom',
          startDate: toIsoDateKey(target.start_time),
          endDate: toIsoDateKey(target.end_time),
          startTime: new Date(target.start_time).toTimeString().slice(0, 5),
          endTime: new Date(target.end_time).toTimeString().slice(0, 5),
          workflowStatus: resolveWorkflowStatus(target),
          notes: target.notes || '',
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
  }, [id]);

  const selectedSite = useMemo(() => sites.find((site) => site.id === form.siteId) || null, [sites, form.siteId]);
  const selectedPost = useMemo(() => posts.find((post) => post.id === form.postId) || null, [posts, form.postId]);
  const selectedGuard = useMemo(() => guards.find((guard) => guard.id === form.guardId) || null, [guards, form.guardId]);
  const selectedReplacement = useMemo(
    () => guards.find((guard) => guard.id === form.replacementId) || null,
    [guards, form.replacementId]
  );
  const sitePosts = useMemo(() => posts.filter((post) => post.site_id === form.siteId), [posts, form.siteId]);
  const shiftDateKey = form.startDate || (shift ? toIsoDateKey(shift.start_time) : '');
  const checkedInLabel = shift?.checked_in_at ? new Date(shift.checked_in_at).toLocaleString() : '';
  const checkedOutLabel = shift?.checked_out_at ? new Date(shift.checked_out_at).toLocaleString() : '';
  const workflowStatusLocked = shift ? ['draft', 'published'].includes(resolveWorkflowStatus(shift)) : false;
  const effectiveWorkflowStatus = workflowStatusLocked ? resolveWorkflowStatus(shift) : form.workflowStatus;

  const updateField = <K extends keyof ShiftEditFormState>(field: K, value: ShiftEditFormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    if (!shift) return;
    if (!form.siteId) {
      setToast({ message: 'Choose a site before saving.', type: 'warning' });
      return;
    }
    if (!form.guardId) {
      setToast({ message: 'Choose a guard before saving.', type: 'warning' });
      return;
    }

    const candidate = buildSiteShiftDraft(
      {
        site_id: form.siteId,
        post_id: form.postId || null,
        employee_id: form.guardId,
        replacement_id: form.replacementId || null,
        shift_kind: form.shiftKind,
        shift_date: form.startDate,
        end_date: form.endDate,
        start_time: form.startTime,
        end_time: form.endTime,
        notes: form.notes,
      },
      selectedGuard?.full_name || null,
      selectedReplacement?.full_name || null
    );

    const conflicts = await findShiftConflicts([candidate], guards, { ignoreShiftIds: [shift.id] });
    if (conflicts.length > 0) {
      setToast({
        message: 'This edit creates a matching or overlapping shift. Please adjust the guard, site, post, or time.',
        type: 'error',
      });
      return;
    }

    setSaving(true);
    try {
      const updatedShift = await updateShiftDetails(shift, {
        site_id: form.siteId,
        post_id: form.postId || null,
        employee_id: form.guardId,
        replacement_id: form.replacementId || null,
        shift_kind: form.shiftKind,
        shift_date: form.startDate,
        end_date: form.endDate,
        start_time: form.startTime,
        end_time: form.endTime,
        workflow_status: effectiveWorkflowStatus,
        notes: form.notes,
      });

      void sendShiftNotification(updatedShift);
      setToast({ message: 'Shift updated successfully.', type: 'success' });
      navigate(`/app/security/roster?view=table&date=${toIsoDateKey(updatedShift.start_time)}&bucket=all`);
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark-bg px-4 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-5 text-center shadow-2xl backdrop-blur">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-purple" />
          <p className="mt-3 text-sm font-medium text-white/70">Loading shift editor...</p>
        </div>
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark-bg px-4 text-white">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-purple">Security roster</p>
          <h1 className="mt-3 text-2xl font-black">Shift not found</h1>
          <p className="mt-2 text-sm text-white/70">The shift may have been deleted or the page was opened with an invalid link.</p>
          <button
            type="button"
            onClick={() => navigate('/app/security/roster')}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-brand-purple px-4 py-2.5 text-sm font-bold text-white"
          >
            <ArrowLeft size={16} />
            Back to roster
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-3xl border border-white/10 bg-dark-surface p-5 shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <button
                type="button"
                onClick={() => navigate('/app/security/roster')}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-white/80 transition hover:bg-white/10"
              >
                <ArrowLeft size={14} />
                Back to roster
              </button>
              <p className="mt-4 text-xs font-black uppercase tracking-[0.3em] text-brand-purple">Edit shift in its own page</p>
              <h1 className="mt-2 text-3xl font-black text-white">
                {selectedSite?.name || shift.security_sites?.name || 'Shift'} / {selectedPost?.name || shift.security_posts?.name || 'Post'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/70">
                Update the full roster row here, then save to return straight back to the work roster.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Current window</p>
              <p className="mt-1 text-sm font-bold text-white">
                {new Date(shift.start_time).toLocaleDateString()} - {resolveShiftKindLabel(shift)} - {formatShiftTimeRange(shift)}
              </p>
              <p className="mt-1 text-xs text-white/60">{resolveWorkflowStatus(shift)} status</p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-widest text-white/50">Site</label>
                  <select
                    value={form.siteId}
                    onChange={(e) => updateField('siteId', e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-dark-bg px-3 py-3 text-sm text-white"
                  >
                    <option value="">Select site</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-widest text-white/50">Post</label>
                  <select
                    value={form.postId}
                    onChange={(e) => updateField('postId', e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-dark-bg px-3 py-3 text-sm text-white"
                  >
                    <option value="">Select post</option>
                    {sitePosts.map((post) => (
                      <option key={post.id} value={post.id}>
                        {post.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-widest text-white/50">Guard</label>
                  <select
                    value={form.guardId}
                    onChange={(e) => updateField('guardId', e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-dark-bg px-3 py-3 text-sm text-white"
                  >
                    <option value="">Select guard</option>
                    {guards.map((guard) => {
                      const alreadyAssignedToday = shiftDateKey
                        ? isGuardScheduledOnDate(guard.id, shifts, shiftDateKey, [shift.id])
                        : false;
                      const disabled = alreadyAssignedToday && guard.id !== form.guardId;
                      return (
                        <option key={guard.id} value={guard.id} disabled={disabled}>
                          {formatGuardDropdownLabel(guard, alreadyAssignedToday && guard.id !== form.guardId)}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-widest text-white/50">Off duty releaver</label>
                  <select
                    value={form.replacementId}
                    onChange={(e) => updateField('replacementId', e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-dark-bg px-3 py-3 text-sm text-white"
                  >
                    <option value="">Optional</option>
                    {guards
                      .filter((guard) => guard.id !== form.guardId || guard.id === form.replacementId)
                      .map((guard) => {
                        const alreadyAssignedToday = shiftDateKey
                          ? isGuardScheduledOnDate(guard.id, shifts, shiftDateKey, [shift.id])
                          : false;
                        const disabled = alreadyAssignedToday && guard.id !== form.replacementId;
                        return (
                          <option key={guard.id} value={guard.id} disabled={disabled}>
                            {formatGuardDropdownLabel(guard, alreadyAssignedToday && guard.id !== form.replacementId)}
                          </option>
                        );
                      })}
                  </select>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-widest text-white/50">Start date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => updateField('startDate', e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-dark-bg px-3 py-3 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-widest text-white/50">End date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => updateField('endDate', e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-dark-bg px-3 py-3 text-sm text-white"
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-widest text-white/50">Start time</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) => updateField('startTime', e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-dark-bg px-3 py-3 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-widest text-white/50">End time</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) => updateField('endTime', e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-dark-bg px-3 py-3 text-sm text-white"
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-widest text-white/50">Workflow</label>
                  <select
                    value={form.workflowStatus}
                    onChange={(e) => updateField('workflowStatus', e.target.value as ShiftWorkflowStatus)}
                    className="w-full rounded-2xl border border-white/10 bg-dark-bg px-3 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={workflowStatusLocked}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="acknowledged">Acknowledged</option>
                    <option value="checked_in">Checked in</option>
                    <option value="completed">Completed</option>
                    <option value="exception">Exception</option>
                    <option value="no_show">No show</option>
                  </select>
                  {workflowStatusLocked ? (
                    <p className="mt-2 text-xs text-white/50">
                      This shift is already saved as {resolveWorkflowStatus(shift)}. Its workflow state is locked here to prevent accidental resets.
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-widest text-white/50">Shift kind</label>
                  <select
                    value={form.shiftKind}
                    onChange={(e) => updateField('shiftKind', e.target.value as ShiftEditFormState['shiftKind'])}
                    className="w-full rounded-2xl border border-white/10 bg-dark-bg px-3 py-3 text-sm text-white"
                  >
                    <option value="day">Day</option>
                    <option value="night">Night</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-xs font-black uppercase tracking-widest text-white/50">Demand notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-white/10 bg-dark-bg px-3 py-3 text-sm text-white"
                  placeholder="Add notes for this roster row"
                />
              </div>

            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs font-black uppercase tracking-widest text-white/40">Edit summary</p>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/60">Guard</span>
                    <span className="font-bold text-white">{selectedGuard ? getGuardLabel(selectedGuard) : 'Unassigned'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/60">Site</span>
                    <span className="font-bold text-white">{selectedSite?.name || 'Unselected'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/60">Post</span>
                    <span className="font-bold text-white">{selectedPost?.name || 'Unselected'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/60">Workflow</span>
                    <span className="font-bold text-white">{effectiveWorkflowStatus}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/60">Shift kind</span>
                    <span className="font-bold text-white">{form.shiftKind}</span>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Manual attendance</p>
                  <p className="mt-2 text-xs text-white/70">
                    Use these controls when a guard reports on duty, since attendance is being updated manually.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateField('workflowStatus', 'acknowledged')}
                      disabled={workflowStatusLocked}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Acknowledge
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField('workflowStatus', 'checked_in')}
                      disabled={workflowStatusLocked}
                      className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Report on duty
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField('workflowStatus', 'completed')}
                      disabled={workflowStatusLocked}
                      className="rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-blue-200 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Mark completed
                    </button>
                  </div>
                  <div className="mt-4 space-y-2 text-xs text-white/60">
                    <p>Checked in: {checkedInLabel || 'Not yet recorded'}</p>
                    <p>Checked out: {checkedOutLabel || 'Not yet recorded'}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-brand-purple/10 p-5">
                <p className="text-xs font-black uppercase tracking-widest text-brand-purple">What happens on save</p>
                <p className="mt-3 text-sm text-white/80">
                  The roster row updates in place, then the updated guard is notified by SMS and email.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/app/security/roster')}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/80 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-brand-purple px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-purple/20 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default EditRosterShiftPage;
