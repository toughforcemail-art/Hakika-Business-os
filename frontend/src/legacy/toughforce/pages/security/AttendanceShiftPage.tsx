// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import CustomToast, { sanitizeError } from '../../components/CustomToast';
import {
  fetchAttendanceShiftData,
  formatShiftTimeRange,
  resolveWorkflowStatus,
  sendShiftNotification,
  toIsoDateKey,
  updateShiftWorkflowStatus,
} from '../../services/securityRosterService';
import type { SecurityShift } from '../../types/security';

const AttendanceShiftPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<null | 'checked_in' | 'completed' | 'acknowledged'>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  const [shift, setShift] = useState<SecurityShift | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!id) {
        setToast({ message: 'Missing attendance shift ID.', type: 'error' });
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const selectedShift = (await fetchAttendanceShiftData(id)) || null;
        if (!active) return;

        setShift(selectedShift);
        if (!selectedShift) {
          setToast({ message: 'The attendance shift could not be found.', type: 'error' });
        }
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

  const refreshShift = async () => {
    if (!id) return;
    const selectedShift = (await fetchAttendanceShiftData(id)) || null;
    setShift(selectedShift);
  };

  const handleMark = async (workflowStatus: 'acknowledged' | 'checked_in' | 'completed') => {
    if (!shift) return;
    setSaving(workflowStatus);
    try {
      const updatedShift = await updateShiftWorkflowStatus(shift.id, workflowStatus);
      void sendShiftNotification(updatedShift);
      setShift(updatedShift);
      setToast({
        message:
          workflowStatus === 'checked_in'
            ? 'Shift marked as reported on duty.'
            : workflowStatus === 'completed'
              ? 'Shift marked as signed out.'
              : 'Shift acknowledged.',
        type: 'success',
      });
      await refreshShift();
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark-bg px-4 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-5 text-center shadow-2xl backdrop-blur">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand-purple" />
          <p className="mt-3 text-sm font-medium text-white/70">Loading attendance details...</p>
        </div>
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark-bg px-4 text-white">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-brand-purple">Attendance Master</p>
          <h1 className="mt-3 text-2xl font-black">Shift not found</h1>
          <p className="mt-2 text-sm text-white/70">This shift may have been deleted or opened from an old link.</p>
          <button
            type="button"
            onClick={() => navigate('/app/security/attendance')}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-brand-purple px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-purple/20"
          >
            <ArrowLeft size={16} />
            Back to attendance
          </button>
        </div>
      </div>
    );
  }

  const workflow = resolveWorkflowStatus(shift);
  const releaverName = shift.replacement_name_snapshot || (shift.replacement_id ? 'Off-duty releaver' : '');
  const checkedInByName = shift.checked_in_by_name_snapshot || (shift.checked_in_by ? shift.checked_in_by : '');

  return (
    <div className="min-h-screen bg-dark-bg px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-3xl border border-white/10 bg-dark-surface p-5 shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <button
                type="button"
                onClick={() => navigate('/app/security/attendance')}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-white/80 transition hover:bg-white/10"
              >
                <ArrowLeft size={14} />
                Back to attendance
              </button>
              <p className="mt-4 text-xs font-black uppercase tracking-[0.3em] text-brand-purple">Attendance detail page</p>
              <h1 className="mt-2 text-3xl font-black text-white">
                {shift.security_sites?.name || 'Site'} / {shift.security_posts?.name || 'Post'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/70">
                Use this page to manually record when a guard reports on duty or signs out.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Current window</p>
              <p className="mt-1 text-sm font-bold text-white">
                {new Date(shift.start_time).toLocaleDateString()} - {formatShiftTimeRange(shift)}
              </p>
              <p className="mt-1 text-xs text-white/60">{workflow.replace('_', ' ')} status</p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Guard</p>
                  <p className="mt-2 text-lg font-bold text-white">
                    {shift.employee_name_snapshot || shift.profiles?.full_name || 'Assigned guard'}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Releaver</p>
                  <p className="mt-2 text-lg font-bold text-white">
                    {releaverName || 'Not assigned'}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Shift date</p>
                  <p className="mt-2 text-lg font-bold text-white">{toIsoDateKey(shift.start_time)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Check in</p>
                  <p className="mt-2 text-lg font-bold text-white">
                    {shift.checked_in_at ? new Date(shift.checked_in_at).toLocaleString() : 'Not recorded'}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Checked in by</p>
                  <p className="mt-2 text-lg font-bold text-white">
                    {checkedInByName || (shift.checked_in_at ? 'Assigned releaver' : 'Not recorded')}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Check out</p>
                  <p className="mt-2 text-lg font-bold text-white">
                    {shift.checked_out_at ? new Date(shift.checked_out_at).toLocaleString() : 'Not recorded'}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-white/40">Manual attendance controls</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleMark('acknowledged')}
                    disabled={!!saving}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/80 transition hover:bg-white/10 disabled:opacity-60"
                  >
                    <RefreshCw size={16} />
                    Acknowledge
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleMark('checked_in')}
                    disabled={!!saving}
                    className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-bold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-60"
                  >
                    <LogIn size={16} />
                    Report on duty
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleMark('completed')}
                    disabled={!!saving}
                    className="inline-flex items-center gap-2 rounded-2xl border border-blue-400/30 bg-blue-500/10 px-4 py-2.5 text-sm font-bold text-blue-200 transition hover:bg-blue-500/20 disabled:opacity-60"
                  >
                    <LogOut size={16} />
                    Signed out
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs font-black uppercase tracking-widest text-white/40">Attendance summary</p>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/60">Workflow</span>
                    <span className="font-bold text-white">{workflow}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/60">Status</span>
                    <span className="font-bold text-white">{shift.status}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/60">Shift kind</span>
                    <span className="font-bold text-white">{shift.shift_kind || 'custom'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-white/60">Notes</span>
                    <span className="font-bold text-white">{shift.notes || 'No notes'}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-brand-purple/10 p-5">
                <p className="text-xs font-black uppercase tracking-widest text-brand-purple">Why this page exists</p>
                <p className="mt-3 text-sm text-white/80">
                  This page is for manual attendance handling until automation is switched on. Use it when a guard arrives or leaves.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default AttendanceShiftPage;
