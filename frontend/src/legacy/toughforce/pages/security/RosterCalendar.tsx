// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import CustomLoader from '../../components/CustomLoader';
import CustomToast from '../../components/CustomToast';
import { useAsyncData } from '../../hooks/useAsyncData';
import {
  fetchRosterShifts,
  formatShiftTimeRange,
  getShiftHours,
  resolveWorkflowStatus,
  toIsoDateKey,
} from '../../services/securityRosterService';
import type { SecurityShift } from '../../types/security';

function workflowTone(status: string) {
  switch (status) {
    case 'published':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300';
    case 'acknowledged':
      return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300';
    case 'checked_in':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
    case 'completed':
      return 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300';
    case 'exception':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300';
    case 'no_show':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300';
  }
}

function buildMonthGrid(referenceMonth: Date) {
  const monthStart = new Date(referenceMonth.getFullYear(), referenceMonth.getMonth(), 1);
  const leadingDays = (monthStart.getDay() + 6) % 7;
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - leadingDays);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      date,
      key: toIsoDateKey(date),
      inMonth: date.getMonth() === referenceMonth.getMonth(),
    };
  });
}

function startOfWeek(date: Date) {
  const weekStart = new Date(date);
  const day = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - day);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

const RosterCalendar: React.FC = () => {
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const todayKey = toIsoDateKey(today);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [compactView, setCompactView] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { data: shifts, loading, error, run } = useAsyncData<SecurityShift[]>(fetchRosterShifts, [], {
    initialData: [],
    immediate: true,
  });

  const monthLabel = visibleMonth.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });
  const monthGrid = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth]);

  const shiftsByDate = useMemo(() => {
    return shifts.reduce<Record<string, SecurityShift[]>>((acc, shift) => {
      const key = toIsoDateKey(shift.start_time);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(shift);
      return acc;
    }, {});
  }, [shifts]);

  const selectedWeek = useMemo(() => {
    const parsedSelected = new Date(`${selectedDate}T00:00:00`);
    const weekStart = startOfWeek(parsedSelected);
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);
      const key = toIsoDateKey(date);
      return {
        date,
        key,
        label: date.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric' }),
        shifts: shiftsByDate[key] || [],
      };
    });
  }, [selectedDate, shiftsByDate]);

  const monthShifts = useMemo(
    () =>
      shifts.filter((shift) => {
        const date = new Date(shift.start_time);
        return date.getFullYear() === visibleMonth.getFullYear() && date.getMonth() === visibleMonth.getMonth();
      }),
    [shifts, visibleMonth]
  );

  const selectedShifts = shiftsByDate[selectedDate] || [];
  const selectedDayHours = selectedShifts.reduce((sum, shift) => sum + getShiftHours(shift), 0);
  const selectedDayGuards = new Set(selectedShifts.map((shift) => shift.employee_id)).size;

  const stats = useMemo(() => {
    const guardCount = new Set(monthShifts.map((shift) => shift.employee_id)).size;
    const siteCount = new Set(monthShifts.map((shift) => shift.site_id)).size;
    const hours = monthShifts.reduce((sum, shift) => sum + getShiftHours(shift), 0);
    const published = monthShifts.filter((shift) => resolveWorkflowStatus(shift) === 'published').length;

    return {
      total: monthShifts.length,
      guards: guardCount,
      sites: siteCount,
      hours,
      published,
    };
  }, [monthShifts]);

  useEffect(() => {
    const selectedIsVisible = monthGrid.some((cell) => cell.key === selectedDate);
    if (!selectedIsVisible) {
      const firstVisible = monthGrid.find((cell) => cell.inMonth) || monthGrid[0];
      if (firstVisible) {
        setSelectedDate(firstVisible.key);
      }
    }
  }, [monthGrid, selectedDate]);

  useEffect(() => {
    if (!error) {
      return;
    }
    setToast({ message: error, type: 'error' });
  }, [error]);

  const moveMonth = (offset: number) => {
    setVisibleMonth((current) => {
      const next = new Date(current);
      next.setMonth(next.getMonth() + offset);
      next.setDate(1);
      return next;
    });
  };

  const handleRefresh = async () => {
    try {
      await run();
      setToast({ message: 'Roster calendar refreshed.', type: 'success' });
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : 'Unable to refresh the roster calendar.';
      setToast({ message, type: 'error' });
    }
  };

  if (loading && shifts.length === 0) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <CustomLoader size={42} label="Loading roster calendar..." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <CustomToast isVisible={!!toast} message={toast?.message || ''} type={toast?.type || 'success'} onClose={() => setToast(null)} />

      <div className="overflow-hidden rounded-[32px] border border-gray-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-dark-surface">
        <div className="border-b border-gray-200 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-white dark:border-white/10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-white/80">
                <CalendarDays size={12} />
                Roster Shift Calendar
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight">All shifts, all guards, one calendar</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/70">
                Review every scheduled shift, see who is assigned, and jump into the active roster whenever you need to make changes.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Shifts', value: stats.total },
                { label: 'Guards', value: stats.guards },
                { label: 'Sites', value: stats.sites },
                { label: 'Hours', value: Math.round(stats.hours) },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">{item.label}</p>
                  <p className="mt-1 text-xl font-black">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-4 dark:border-white/10 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => moveMonth(-1)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 transition hover:border-brand-purple/30 hover:text-brand-purple dark:border-white/10 dark:text-gray-200"
            >
              <ChevronLeft size={16} />
              Prev
            </button>
            <button
              onClick={() => setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
              className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 transition hover:border-brand-purple/30 hover:text-brand-purple dark:border-white/10 dark:text-gray-200"
            >
              Today
            </button>
            <button
              onClick={() => moveMonth(1)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 transition hover:border-brand-purple/30 hover:text-brand-purple dark:border-white/10 dark:text-gray-200"
            >
              Next
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setCompactView((current) => !current)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 transition hover:border-brand-purple/30 hover:text-brand-purple dark:border-white/10 dark:text-gray-200"
            >
              {compactView ? 'Zoom in' : 'Zoom out'}
            </button>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-purple px-3 py-2 text-xs font-bold text-white shadow-lg shadow-brand-purple/20"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em]">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">Published</span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Checked in</span>
            <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">Exception</span>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 dark:bg-white/10 dark:text-gray-300">Scheduled</span>
          </div>
        </div>

        <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(340px,0.9fr)]">
          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">{monthLabel}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Click any day to review the assigned guards and their shift details.
                </p>
              </div>
              <button
                onClick={() => navigate('/app/security/roster')}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 transition hover:border-brand-purple/30 hover:text-brand-purple dark:border-white/10 dark:text-gray-200"
              >
                Open Active Roster
              </button>
            </div>

            <div className="mb-5 rounded-[28px] border border-gray-200 bg-gradient-to-r from-brand-purple/5 via-white to-cyan-50 p-4 dark:border-white/10 dark:from-white/5 dark:via-dark-surface dark:to-white/5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-400">Selected Week</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">A quick, scroll-free view of the seven-day window around the selected date.</p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
                  <span className="rounded-full bg-white px-3 py-1 shadow-sm dark:bg-white/10">Selected day highlighted</span>
                  <span className="rounded-full bg-white px-3 py-1 shadow-sm dark:bg-white/10">Shift count shown on each day</span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-7 gap-2 overflow-x-auto">
                {selectedWeek.map((day) => {
                  const isSelected = day.key === selectedDate;
                  const isToday = day.key === todayKey;
                  return (
                    <button
                      key={day.key}
                      onClick={() => setSelectedDate(day.key)}
                      className={`min-w-[88px] rounded-3xl border p-2.5 text-left transition-all ${
                        isSelected
                          ? 'border-brand-purple bg-brand-purple/10 shadow-[0_0_0_1px_rgba(142,86,255,0.18)]'
                          : 'border-gray-200 bg-white hover:border-brand-purple/25 dark:border-white/10 dark:bg-dark-bg'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={`text-[9px] font-black uppercase tracking-[0.18em] ${isToday ? 'text-brand-purple' : 'text-gray-400'}`}>
                            {day.label}
                          </p>
                          {isToday && <p className="mt-1 text-[8px] font-black uppercase tracking-[0.16em] text-brand-purple">Today</p>}
                        </div>
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-[9px] font-black text-gray-600 dark:bg-white/10 dark:text-gray-300">
                          {day.shifts.length}
                        </span>
                      </div>
                      <div className="mt-3 space-y-1">
                        {day.shifts.slice(0, 2).map((shift) => (
                          <div key={shift.id} className="rounded-2xl border border-gray-200 bg-gray-50 px-2 py-1 text-[9px] dark:border-white/10 dark:bg-white/5">
                            <p className="truncate font-bold text-gray-900 dark:text-white">{shift.profiles?.full_name || 'Assigned guard'}</p>
                            <p className="truncate text-gray-500 dark:text-gray-400">{shift.security_sites?.name || 'Unknown site'}</p>
                          </div>
                        ))}
                        {day.shifts.length > 2 && (
                          <p className="pt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                            +{day.shifts.length - 2} more
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day} className="py-2 text-[9px]">
                  {day}
                </div>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-2">
              {monthGrid.map((cell) => {
                const cellShifts = shiftsByDate[cell.key] || [];
                const isSelected = selectedDate === cell.key;
                const isToday = cell.key === todayKey;

                return (
                  <button
                    key={cell.key}
                    onClick={() => setSelectedDate(cell.key)}
                    className={`${compactView ? 'min-h-[126px]' : 'min-h-[150px]'} rounded-3xl border p-3 text-left transition-all ${
                      isSelected
                        ? 'border-brand-purple bg-brand-purple/5 shadow-[0_0_0_1px_rgba(142,86,255,0.15)]'
                        : 'border-gray-200 bg-gray-50 hover:border-brand-purple/25 hover:bg-white dark:border-white/10 dark:bg-dark-bg dark:hover:border-brand-purple/40'
                    } ${cell.inMonth ? '' : 'opacity-55'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`text-sm font-black ${isToday ? 'text-brand-purple' : 'text-gray-900 dark:text-white'}`}>
                          {cell.date.getDate()}
                        </p>
                        {isToday && (
                          <span className="mt-1 inline-flex rounded-full bg-brand-purple/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-brand-purple">
                            Today
                          </span>
                        )}
                      </div>
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-gray-600 dark:bg-white/10 dark:text-gray-300">
                        {cellShifts.length}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      {cellShifts.slice(0, 3).map((shift) => (
                        <div key={shift.id} className="rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-white/10 dark:bg-white/5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-gray-900 dark:text-white">
                                {shift.profiles?.full_name || 'Assigned guard'}
                              </p>
                              <p className="mt-0.5 truncate text-[10px] text-gray-500 dark:text-gray-400">
                                {shift.security_sites?.name || 'Unknown site'}
                              </p>
                            </div>
                            <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] ${workflowTone(resolveWorkflowStatus(shift))}`}>
                              {resolveWorkflowStatus(shift).replace('_', ' ')}
                            </span>
                          </div>
                          <p className="mt-2 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                            {formatShiftTimeRange(shift)}
                          </p>
                        </div>
                      ))}
                      {cellShifts.length > 3 && (
                        <p className="pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
                          +{cellShifts.length - 3} more shifts
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="space-y-5 rounded-[28px] border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-white/[0.03]">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">Selected Day</p>
              <h3 className="mt-1 text-xl font-black text-gray-900 dark:text-white">
                {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('en-KE', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-dark-surface">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Shifts</p>
                <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">{selectedShifts.length}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-dark-surface">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Guards</p>
                <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">
                  {new Set(selectedShifts.map((shift) => shift.employee_id)).size}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-dark-surface">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Selected Day Summary</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">A quick operational snapshot for the day you clicked.</p>
                </div>
                <span className="rounded-full bg-brand-purple/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-brand-purple">
                  {selectedDate}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/5">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Shifts</p>
                  <p className="mt-1 text-lg font-black text-gray-900 dark:text-white">{selectedShifts.length}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/5">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Guards</p>
                  <p className="mt-1 text-lg font-black text-gray-900 dark:text-white">{selectedDayGuards}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/5">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Hours</p>
                  <p className="mt-1 text-lg font-black text-gray-900 dark:text-white">{Math.round(selectedDayHours)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {selectedShifts.map((shift) => (
                <div key={shift.id} className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-dark-surface">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-gray-900 dark:text-white">{shift.profiles?.full_name || 'Assigned guard'}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {shift.security_sites?.name || 'Unknown site'} {shift.security_posts?.name ? `· ${shift.security_posts.name}` : ''}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${workflowTone(resolveWorkflowStatus(shift))}`}>
                      {resolveWorkflowStatus(shift).replace('_', ' ')}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-brand-purple" />
                      <span>{formatShiftTimeRange(shift)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-brand-purple" />
                      <span>{shift.security_sites?.name || 'Unknown site'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-brand-purple" />
                      <span>{shift.security_posts?.name || 'General post'}</span>
                    </div>
                    {shift.replacement_id && (
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={14} className="text-brand-purple" />
                        <span>Off Duty Releaver assigned</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {selectedShifts.length === 0 && (
                <div className="rounded-3xl border border-dashed border-gray-300 bg-white px-4 py-10 text-center text-sm text-gray-500 dark:border-white/10 dark:bg-dark-surface dark:text-gray-400">
                  No shifts are scheduled for this day.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default RosterCalendar;
