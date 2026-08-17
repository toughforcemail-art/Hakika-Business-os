// @ts-nocheck
import { NotificationService } from './NotificationService';
import { activityLogger } from '../utils/activityLogger';
import { isAbortError } from '../utils/abortErrors';
import { supabase } from '../utils/supabase';
import { EmailTemplates, sendEmail } from './emailService';
import { sendBulkSms } from './SMSService';
import type {
  AttendanceRecord,
  ArchivedSecurityGuard,
  BoardShiftBucket,
  BulkShiftFormData,
  DispatchPostCoverage,
  DispatchSiteCoverage,
  DispatchSlot,
  GeneratedShiftDraft,
  GuardAvailability,
  GuardSuggestion,
  RosterBootstrapData,
  RosterAuditLogEntry,
  RosterFilters,
  RosterRequest,
  RosterStats,
  RosterVersion,
  SecurityCentre,
  SecurityGuard,
  SecurityPost,
  SecurityShift,
  SecuritySite,
  ShiftConflict,
  ShiftExceptionStatus,
  ShiftStatus,
  ShiftTemplate,
  ShiftWorkflowStatus,
  TacticalConsoleData,
  WorkforceStats,
} from '../types/security';

function isSecurityGuardProfile(guard: Pick<SecurityGuard, 'is_security_guard' | 'role' | 'department' | 'designation'>) {
  const haystack = [guard.role, guard.department, guard.designation].filter(Boolean).join(' ').toLowerCase();
  return guard.is_security_guard === true || haystack.includes('security') || haystack.includes('guard');
}

export type RosterShiftKind = 'day' | 'night' | 'custom';

type ShiftWindowLike = {
  start_time: string;
  end_time: string;
  shift_kind?: RosterShiftKind | null;
};

export function resolveShiftKind(shift: ShiftWindowLike): RosterShiftKind {
  if (shift.shift_kind === 'day' || shift.shift_kind === 'night' || shift.shift_kind === 'custom') {
    return shift.shift_kind;
  }

  const start = new Date(shift.start_time);
  const end = new Date(shift.end_time);
  const spansOvernight = end.getTime() <= start.getTime();

  if (start.getHours() === 6 && end.getHours() === 18 && !spansOvernight) {
    return 'day';
  }
  if (start.getHours() === 18 && end.getHours() === 6 && spansOvernight) {
    return 'night';
  }
  return 'custom';
}

export function resolveShiftKindLabel(shift: ShiftWindowLike) {
  const kind = resolveShiftKind(shift);
  return kind === 'custom' ? 'Custom' : kind === 'day' ? 'Day' : 'Night';
}

const SECURITY_SHIFT_SELECT = `
  *,
  shift_kind,
  employee_name_snapshot,
  replacement_name_snapshot,
  checked_in_by,
  checked_in_by_name_snapshot,
  security_sites ( name, county, hourly_rate ),
  security_posts ( name, required_guards )
`;

const ATTENDANCE_SHIFT_SELECT = `
  *,
  shift_kind,
  employee_name_snapshot,
  replacement_name_snapshot,
  checked_in_by,
  checked_in_by_name_snapshot,
  security_sites ( name, county, hourly_rate ),
  security_posts ( name )
`;

const ROSTER_BOOTSTRAP_CACHE_KEY = 'security-roster-bootstrap-cache';

function requireData<T>(value: T | null, fallback: T): T {
  return value ?? fallback;
}

function throwIfError(error: { message?: string } | null, fallbackMessage: string) {
  if (error && !isAbortError(error)) {
    throw new Error(error.message || fallbackMessage);
  }
}

function isOptionalFeatureError(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() || '';
  return message.includes('does not exist') || message.includes('schema cache') || message.includes('column');
}

async function fetchGuardNameLookup(guardIds: string[]) {
  const uniqueGuardIds = [...new Set(guardIds.filter(Boolean))];
  const lookup = new Map<string, string>();
  if (uniqueGuardIds.length === 0) {
    return lookup;
  }

  const [activeRes, archivedRows] = await Promise.all([
    supabase.from('profiles').select('id, full_name').in('id', uniqueGuardIds),
    safeOptionalQuery<{ original_id: string; full_name: string }>(
      supabase.from('archived_profiles').select('original_id, full_name').in('original_id', uniqueGuardIds),
      'archived guard names'
    ),
  ]);

  throwIfError(activeRes.error, 'Failed to load guard names.');
  requireData<{ id: string; full_name: string | null }[]>(activeRes.data as { id: string; full_name: string | null }[] | null, []).forEach((guard) => {
    if (guard.full_name) {
      lookup.set(guard.id, guard.full_name);
    }
  });

  archivedRows.forEach((guard) => {
    if (guard.original_id && guard.full_name && !lookup.has(guard.original_id)) {
      lookup.set(guard.original_id, guard.full_name);
    }
  });

  return lookup;
}

function readRosterBootstrapCache(): RosterBootstrapData | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(ROSTER_BOOTSTRAP_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RosterBootstrapData;
  } catch {
    return null;
  }
}

function writeRosterBootstrapCache(payload: RosterBootstrapData) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ROSTER_BOOTSTRAP_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore cache write failures.
  }
}

export function clearRosterBootstrapCache() {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(ROSTER_BOOTSTRAP_CACHE_KEY);
  } catch {
    // Ignore cache cleanup failures.
  }
}

async function safeOptionalQuery<T>(
  query: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>,
  label: string
) {
  try {
    const response = await query;
    if (response.error) {
      if (isAbortError(response.error)) {
        return [] as T[];
      }
      if (!isOptionalFeatureError(response.error)) {
        console.warn(`Optional roster query failed for ${label}:`, response.error);
      }
      return [] as T[];
    }
    return requireData<T[]>(response.data, []);
  } catch (error) {
    if (isAbortError(error)) {
      return [] as T[];
    }
    throw error;
  }
}

async function attachShiftGuardProfiles(shifts: SecurityShift[]) {
  const guardIds = [...new Set(shifts.map((shift) => shift.employee_id).filter(Boolean))];
  if (guardIds.length === 0) {
    return shifts;
  }

  const { data, error } = await supabase.from('profiles').select('id, full_name, email, phone').in('id', guardIds);
  if (error) {
    if (!isAbortError(error)) {
      console.warn('Roster guard profile lookup failed:', error);
    }
    return shifts;
  }

  const guardMap = new Map(
    (data ?? []).map((profile) => [
      profile.id,
      {
        full_name: profile.full_name ?? null,
        email: profile.email ?? null,
        phone: profile.phone ?? null,
      },
    ])
  );

  return shifts.map((shift) => ({
    ...shift,
    profiles: guardMap.get(shift.employee_id) ?? shift.profiles ?? null,
  }));
}
function buildLocalDate(date: string, time: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0, 0);
}

export function toIsoDateKey(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function formatShiftTimeRange(shift: Pick<SecurityShift, 'start_time' | 'end_time'>) {
  return `${new Date(shift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(
    shift.end_time
  ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function getShiftHours(shift: Pick<SecurityShift, 'start_time' | 'end_time' | 'break_minutes' | 'estimated_hours'>) {
  if (shift.estimated_hours && shift.estimated_hours > 0) {
    return shift.estimated_hours;
  }

  const raw = (new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / (1000 * 60 * 60);
  const breakHours = (shift.break_minutes || 0) / 60;
  return Math.max(0, raw - breakHours);
}

export function isShiftActive(shift: SecurityShift, now = new Date()) {
  const start = new Date(shift.start_time).getTime();
  const end = new Date(shift.end_time).getTime();
  const current = now.getTime();
  return current >= start && current <= end && shift.status !== 'cancelled';
}

export function isShiftDueSoon(shift: SecurityShift, now = new Date()) {
  const diff = new Date(shift.start_time).getTime() - now.getTime();
  return diff >= 0 && diff <= 2 * 60 * 60 * 1000;
}

export function isGuardScheduledOnDate(
  guardId: string,
  shifts: Pick<SecurityShift, 'id' | 'employee_id' | 'replacement_id' | 'start_time' | 'status'>[],
  dateKey: string,
  ignoreShiftIds: string[] = []
) {
  return shifts.some(
    (shift) =>
      !ignoreShiftIds.includes(shift.id) &&
      shift.status !== 'cancelled' &&
      toIsoDateKey(shift.start_time) === dateKey &&
      (shift.employee_id === guardId || shift.replacement_id === guardId)
  );
}

export function formatGuardDropdownLabel(
  guard: Pick<SecurityGuard, 'full_name' | 'designation'>,
  alreadyAssignedToday = false
) {
  const label = guard.full_name || guard.designation || 'Unknown guard';
  return alreadyAssignedToday ? `${label} • already assigned today` : label;
}

export function resolveWorkflowStatus(shift: SecurityShift): ShiftWorkflowStatus {
  if (shift.workflow_status) {
    return shift.workflow_status;
  }
  if (shift.checked_in_at) {
    return 'checked_in';
  }
  if (shift.acknowledged_at || shift.status === 'acknowledged') {
    return 'acknowledged';
  }
  if (shift.status === 'completed') {
    return 'completed';
  }
  if (shift.status === 'absent') {
    return 'no_show';
  }
  if (shift.exception_status && shift.exception_status !== 'none') {
    return 'exception';
  }
  return 'draft';
}

export function isLateRisk(shift: SecurityShift, attendance: AttendanceRecord[], now = new Date()) {
  if (!['published', 'acknowledged'].includes(resolveWorkflowStatus(shift))) {
    return false;
  }

  const shiftDate = toIsoDateKey(shift.start_time);
  const attRecord = attendance.find((item) => item.employee_id === shift.employee_id && item.date === shiftDate);
  if (attRecord?.status === 'present') {
    return false;
  }

  const start = new Date(shift.start_time).getTime();
  return now.getTime() > start + 15 * 60 * 1000;
}

export function matchesShiftBucket(shift: Pick<SecurityShift, 'start_time'>, bucket: Exclude<BoardShiftBucket, 'all'>) {
  const hour = new Date(shift.start_time).getHours();
  if (bucket === 'day') {
    return hour >= 6 && hour < 18;
  }
  return hour < 6 || hour >= 18;
}

function bucketTimesForDate(date: string, bucket: Exclude<BoardShiftBucket, 'all'>) {
  const start = buildLocalDate(date, bucket === 'day' ? '06:00' : '18:00');
  const end = buildLocalDate(date, bucket === 'day' ? '18:00' : '06:00');
  if (bucket === 'night') {
    end.setDate(end.getDate() + 1);
  }
  return {
    start_time: start.toISOString(),
    end_time: end.toISOString(),
  };
}

export function shiftsOverlap(
  first: Pick<SecurityShift, 'employee_id' | 'start_time' | 'end_time' | 'status'>,
  second: Pick<SecurityShift, 'employee_id' | 'start_time' | 'end_time' | 'status'>
) {
  if (first.employee_id !== second.employee_id) {
    return false;
  }
  if (first.status === 'cancelled' || second.status === 'cancelled') {
    return false;
  }

  const firstStart = new Date(first.start_time).getTime();
  const firstEnd = new Date(first.end_time).getTime();
  const secondStart = new Date(second.start_time).getTime();
  const secondEnd = new Date(second.end_time).getTime();

  return firstStart < secondEnd && firstEnd > secondStart;
}

function isExactShiftMatch(
  first:
    | Pick<SecurityShift, 'employee_id' | 'site_id' | 'post_id' | 'start_time' | 'end_time' | 'status'>
    | GeneratedShiftDraft,
  second:
    | Pick<SecurityShift, 'employee_id' | 'site_id' | 'post_id' | 'start_time' | 'end_time' | 'status'>
    | GeneratedShiftDraft
) {
  return (
    first.employee_id === second.employee_id &&
    first.site_id === second.site_id &&
    (first.post_id || null) === (second.post_id || null) &&
    first.start_time === second.start_time &&
    first.end_time === second.end_time &&
    first.status !== 'cancelled' &&
    second.status !== 'cancelled'
  );
}

function isHandoverPair(
  first: Pick<SecurityShift, 'employee_id' | 'replacement_id' | 'start_time' | 'end_time' | 'status'> | GeneratedShiftDraft,
  second: Pick<SecurityShift, 'employee_id' | 'replacement_id' | 'start_time' | 'end_time' | 'status'> | GeneratedShiftDraft
) {
  return first.employee_id !== second.employee_id && (first.replacement_id === second.employee_id || second.replacement_id === first.employee_id);
}

function getGeneratedShiftKey(shift: Pick<GeneratedShiftDraft, 'employee_id' | 'site_id' | 'post_id' | 'start_time' | 'end_time'>) {
  return [
    shift.employee_id,
    shift.site_id,
    shift.post_id || '',
    shift.start_time,
    shift.end_time,
  ].join('|');
}

function dedupeGeneratedShifts(generatedShifts: GeneratedShiftDraft[]) {
  const seen = new Set<string>();
  const uniqueShifts: GeneratedShiftDraft[] = [];

  for (const shift of generatedShifts) {
    const key = getGeneratedShiftKey(shift);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueShifts.push(shift);
  }

  return uniqueShifts;
}

async function fetchPotentialShiftOverlaps(generatedShifts: GeneratedShiftDraft[]) {
  if (generatedShifts.length === 0) {
    return [] as Array<
      Pick<
        SecurityShift,
        | 'id'
        | 'employee_id'
        | 'site_id'
        | 'post_id'
        | 'replacement_id'
        | 'employee_name_snapshot'
        | 'replacement_name_snapshot'
        | 'shift_kind'
        | 'start_time'
        | 'end_time'
        | 'status'
        | 'workflow_status'
        | 'notes'
        | 'checked_in_at'
        | 'checked_out_at'
        | 'security_sites'
        | 'security_posts'
        | 'profiles'
      >
    >;
  }

  const employeeIds = [...new Set(generatedShifts.map((shift) => shift.employee_id))];
  const earliestStart = generatedShifts.reduce(
    (min, shift) => (shift.start_time < min ? shift.start_time : min),
    generatedShifts[0].start_time
  );
  const latestEnd = generatedShifts.reduce(
    (max, shift) => (shift.end_time > max ? shift.end_time : max),
    generatedShifts[0].end_time
  );

  const existingRes = await supabase
    .from('security_shifts')
    .select('id, employee_id, employee_name_snapshot, replacement_id, replacement_name_snapshot, site_id, post_id, shift_kind, start_time, end_time, status, workflow_status, notes, checked_in_at, checked_out_at, security_sites(name), security_posts(name)')
    .in('employee_id', employeeIds)
    .lt('start_time', latestEnd)
    .gt('end_time', earliestStart)
    .neq('status', 'cancelled');

  throwIfError(existingRes.error, 'Failed to check for overlapping shifts.');
  return requireData<any[]>(existingRes.data, []);
}

function buildShiftRestorationNotes(shift: Pick<SecurityShift, 'notes'>) {
  const existingNotes = shift.notes?.trim();
  const restorationNote = 'Handover returned to the original guard; the off duty releaver signed out and the guard resumed duty.';
  return existingNotes ? `${existingNotes}\n${restorationNote}` : restorationNote;
}

async function restoreHandoverShift(
  shift: Pick<
    SecurityShift,
    'id' | 'notes' | 'workflow_status' | 'status' | 'checked_in_at' | 'checked_out_at' | 'profiles' | 'employee_name_snapshot' | 'replacement_name_snapshot'
  >,
  restoredGuardId: string,
  restoredGuardName: string,
  draft: GeneratedShiftDraft
) {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    employee_id: restoredGuardId,
    employee_name_snapshot: restoredGuardName,
    replacement_id: null,
    replacement_name_snapshot: null,
    status: draft.status || shift.status || 'scheduled',
    workflow_status: shift.workflow_status && shift.workflow_status !== 'draft' ? shift.workflow_status : draft.workflow_status || 'draft',
    checked_in_at: now,
    checked_out_at: now,
    notified_at: null,
    reminder_sent: false,
    notes: buildShiftRestorationNotes(shift),
  };

  const response = await supabase
    .from('security_shifts')
    .update(payload)
    .eq('id', shift.id)
    .select(SECURITY_SHIFT_SELECT)
    .single();

  throwIfError(response.error, 'Failed to restore shift handover.');
  const restoredShift = requireData<SecurityShift | null>(response.data as SecurityShift | null, null);
  if (!restoredShift) {
    throw new Error('The restored shift could not be loaded.');
  }

  await logRosterActivity('handover_restore', `Restored shift ${shift.id} to ${restoredGuardName}`, {
    shiftId: shift.id,
    restoredGuardId,
    offDutyReleaverId: shift.replacement_name_snapshot || null,
  });

  return restoredShift;
}

export function calculateRosterStats(shifts: SecurityShift[], referenceDate = new Date()): RosterStats {
  const today = toIsoDateKey(referenceDate);
  const uniqueGuards = new Set(shifts.map((shift) => shift.employee_id)).size;
  const pendingAck = shifts.filter((shift) => resolveWorkflowStatus(shift) === 'published').length;
  const todaysAbsences = shifts.filter(
    (shift) => (shift.status === 'absent' || shift.exception_status === 'no_show') && toIsoDateKey(shift.start_time) === today
  ).length;
  const activeShifts = shifts.filter((shift) => isShiftActive(shift, referenceDate)).length;
  const overdueNotifications = shifts.filter((shift) => {
    if (shift.notified_at || resolveWorkflowStatus(shift) === 'draft') {
      return false;
    }
    const hoursUntilStart = (new Date(shift.start_time).getTime() - referenceDate.getTime()) / (1000 * 60 * 60);
    return hoursUntilStart >= 0 && hoursUntilStart <= 12;
  }).length;

  return {
    totalGuards: uniqueGuards,
    pendingAck,
    todaysAbsences,
    activeShifts,
    overdueNotifications,
  };
}

export function matchesRosterSearch(shift: SecurityShift, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const haystack = [
    shift.profiles?.full_name,
    shift.security_sites?.name,
    shift.security_sites?.county,
    shift.security_sites?.security_centres?.name,
    shift.security_posts?.name,
    shift.status,
    shift.workflow_status,
    shift.reason,
    shift.notes,
    toIsoDateKey(shift.start_time),
    new Date(shift.start_time).toLocaleDateString(),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalized);
}

export function filterShifts(shifts: SecurityShift[], filters: RosterFilters, referenceDate = new Date()) {
  let result = [...shifts];

  if (filters.branch_id !== 'all') {
    result = result.filter((shift) => shift.security_sites?.centre_id === filters.branch_id);
  }

  if (filters.site_id !== 'all') {
    result = result.filter((shift) => shift.site_id === filters.site_id);
  }

  if (filters.post_id !== 'all') {
    result = result.filter((shift) => shift.post_id === filters.post_id);
  }

  if (filters.employee_id !== 'all') {
    result = result.filter((shift) => shift.employee_id === filters.employee_id);
  }

  if (filters.county !== 'all') {
    result = result.filter((shift) => shift.security_sites?.county === filters.county);
  }

  if (filters.query.trim()) {
    result = result.filter((shift) => matchesRosterSearch(shift, filters.query));
  }

  if (filters.timeframe === 'daily') {
    const today = toIsoDateKey(referenceDate);
    result = result.filter((shift) => toIsoDateKey(shift.start_time) === today);
  } else if (filters.timeframe === 'weekly') {
    const weekAgo = new Date(referenceDate);
    weekAgo.setDate(referenceDate.getDate() - 7);
    result = result.filter((shift) => new Date(shift.start_time) >= weekAgo);
  } else if (filters.timeframe === 'monthly') {
    const monthAgo = new Date(referenceDate);
    monthAgo.setMonth(referenceDate.getMonth() - 1);
    result = result.filter((shift) => new Date(shift.start_time) >= monthAgo);
  } else if (filters.timeframe === 'yearly') {
    const yearAgo = new Date(referenceDate);
    yearAgo.setFullYear(referenceDate.getFullYear() - 1);
    result = result.filter((shift) => new Date(shift.start_time) >= yearAgo);
  }

  return result;
}

export async function fetchRosterAuditTrail(limit = 30) {
  const response = await supabase
    .from('security_shift_audit_logs')
    .select('id, shift_id, action, changed_by, changed_at, old_row, new_row')
    .order('changed_at', { ascending: false })
    .limit(limit);

  throwIfError(response.error, 'Failed to load roster audit trail.');
  return requireData<RosterAuditLogEntry[]>(response.data as RosterAuditLogEntry[] | null, []);
}

export async function fetchRosterBootstrapData(): Promise<RosterBootstrapData> {
  const [centresRes, sitesRes, postsRes, guards, shiftsRes, attendanceRes] = await Promise.all([
    safeOptionalQuery<SecurityCentre>(supabase.from('security_centres').select('id, name, county').order('name'), 'centres'),
    safeOptionalQuery<SecuritySite>(
      supabase.from('security_sites').select('id, name, centre_id').order('name'),
      'sites'
    ),
    safeOptionalQuery<SecurityPost>(supabase.from('security_posts').select('id, name, site_id').order('name'), 'posts'),
    fetchSecurityGuards(),
    safeOptionalQuery<SecurityShift>(
      supabase.from('security_shifts').select(SECURITY_SHIFT_SELECT).order('start_time', { ascending: true }),
      'shifts'
    ),
    safeOptionalQuery<AttendanceRecord>(
      supabase.from('hr_attendance').select('id, employee_id, date, status').order('date', { ascending: false }).limit(500),
      'attendance'
    ),
  ]);
  const shifts = await attachShiftGuardProfiles(shiftsRes);

  const archivedGuards = await safeOptionalQuery<ArchivedSecurityGuard>(
    supabase
      .from('archived_profiles')
      .select(
        'id, original_id, full_name, email, phone, employee_no, role, department, designation, archived_at, deleted_by_id, deleted_by_name, archive_status, exit_reason, exit_summary, certificate_issued, certificate_date, original_data'
      )
      .order('archived_at', { ascending: false })
      .limit(500),
    'archived guards'
  );

  const payload = {
    centres: centresRes,
    sites: sitesRes,
    posts: postsRes,
    guards,
    archivedGuards,
    shifts,
    attendance: attendanceRes,
  };
  writeRosterBootstrapCache(payload);
  return payload;
}

export function getCachedRosterBootstrapData(): RosterBootstrapData | null {
  return readRosterBootstrapCache();
}

export async function fetchRosterShifts() {
  const response = await supabase
    .from('security_shifts')
    .select('*, shift_kind, employee_name_snapshot, replacement_name_snapshot, security_sites ( name, county, hourly_rate ), security_posts ( name )')
    .order('start_time', { ascending: true });
  throwIfError(response.error, 'Failed to refresh roster shifts.');
  return attachShiftGuardProfiles(requireData<SecurityShift[]>(response.data as SecurityShift[] | null, []));
}

export async function fetchSecurityGuards() {
  const archivedGuardIds = new Set(
    await safeOptionalQuery<{ original_id: string }>(
      supabase.from('archived_profiles').select('original_id').limit(1000),
      'archived guard ids'
    ).then((rows) => rows.map((row) => row.original_id).filter(Boolean))
  );

  const attempts = [
    {
      select: 'id, full_name, role, status, department, designation, psra_number, uniform_size, is_security_guard',
      filters: (query: any) => query.eq('is_active', true).neq('role', 'Account Deleted'),
    },
    {
      select: 'id, full_name, role, department, designation, psra_number, uniform_size, is_security_guard',
      filters: (query: any) => query.neq('role', 'Account Deleted'),
    },
    {
      select: 'id, full_name, role, department, designation',
      filters: (query: any) => query,
    },
  ] as const;

  for (const attempt of attempts) {
    const query = attempt.filters(supabase.from('profiles').select(attempt.select).order('full_name'));
    const response = await query;
    if (!response.error) {
      const rows = requireData<SecurityGuard[]>(response.data as SecurityGuard[] | null, []);
      return rows.filter((guard) => !archivedGuardIds.has(guard.id));
    }
    if (!isOptionalFeatureError(response.error)) {
      console.warn('Failed to load employee records.', response.error);
      break;
    }
  }

  return [];
}

export async function fetchPastGuards() {
  const response = await supabase
    .from('archived_profiles')
    .select(
      'id, original_id, full_name, email, phone, employee_no, role, department, designation, archived_at, deleted_by_id, deleted_by_name, archive_status, exit_reason, exit_summary, certificate_issued, certificate_date, original_data'
    )
    .order('archived_at', { ascending: false });

  throwIfError(response.error, 'Failed to load archived guard records.');
  return requireData<ArchivedSecurityGuard[]>(response.data as ArchivedSecurityGuard[] | null, []);
}

export async function fetchAttendanceMasterData() {
  const response = await supabase
    .from('security_shifts')
    .select(
      '*, security_sites(name, county, hourly_rate, centre_id, security_centres(name)), security_posts(name, required_guards)'
    )
    .order('start_time', { ascending: true });

  throwIfError(response.error, 'Failed to load attendance records.');
  return attachShiftGuardProfiles(requireData<SecurityShift[]>(response.data as SecurityShift[] | null, []));
}

export async function fetchAttendanceShiftData(shiftId: string) {
  const response = await supabase
    .from('security_shifts')
    .select(ATTENDANCE_SHIFT_SELECT)
    .eq('id', shiftId)
    .maybeSingle();

  throwIfError(response.error, 'Failed to load attendance shift.');
  return requireData<SecurityShift | null>(response.data as SecurityShift | null, null);
}

export async function fetchRosterReferenceData() {
  const [centres, guards, sites, posts] = await Promise.all([
    supabase.from('security_centres').select('id, name, county').order('name'),
    fetchSecurityGuards(),
    supabase.from('security_sites').select('id, name, centre_id, county, hourly_rate').order('name'),
    supabase.from('security_posts').select('id, name, site_id, required_guards').order('name'),
  ]);

  throwIfError(centres.error, 'Failed to load branches.');
  throwIfError(sites.error, 'Failed to load sites.');
  throwIfError(posts.error, 'Failed to load posts.');

  return {
    centres: requireData<SecurityCentre[]>(centres.data as SecurityCentre[] | null, []),
    guards,
    sites: requireData<SecuritySite[]>(sites.data as SecuritySite[] | null, []),
    posts: requireData<SecurityPost[]>(posts.data as SecurityPost[] | null, []),
  };
}

export async function fetchRosterOperationsMeta() {
  const [versions, templates, availability, requests] = await Promise.all([
    safeOptionalQuery<RosterVersion>(
      supabase.from('security_roster_versions').select('*').order('published_at', { ascending: false }).limit(20),
      'versions'
    ),
    safeOptionalQuery<ShiftTemplate>(
      supabase.from('security_shift_templates').select('*').eq('is_active', true).order('name'),
      'templates'
    ),
    safeOptionalQuery<GuardAvailability>(
      supabase.from('security_guard_availability').select('*').gte('end_date', toIsoDateKey(new Date())).order('start_date'),
      'availability'
    ),
    safeOptionalQuery<RosterRequest>(
      supabase.from('security_roster_requests').select('*').in('status', ['pending', 'approved']).order('submitted_at', { ascending: false }).limit(30),
      'requests'
    ),
  ]);

  return {
    versions,
    templates,
    availability,
    requests,
  };
}

export async function fetchWorkforceStats(): Promise<WorkforceStats> {
  const guards = await fetchSecurityGuards();

  return {
    totalGuards: guards.length,
    activeOnDuty: guards.filter((guard) => ['Active', 'On-Duty', 'active', 'on-duty'].includes(guard.status || '')).length,
    standby: guards.filter((guard) => ['Standby', 'Off Duty', 'off_duty', 'standby'].includes(guard.status || '')).length,
    onLeave: guards.filter((guard) => ['On Leave', 'Absent', 'on_leave', 'absent'].includes(guard.status || '')).length,
  };
}

export async function fetchTacticalConsoleData(): Promise<TacticalConsoleData> {
  const now = new Date();
  const [shiftsRes, sitesRes, incidentsRes, guards] = await Promise.all([
    fetchRosterShifts(),
    supabase.from('security_sites').select('id, name, status').or('status.is.null,status.eq.active'),
    supabase.from('security_incidents').select('*', { count: 'exact', head: true }).not('status', 'in', '("resolved","closed")'),
    fetchSecurityGuards(),
  ]);

  throwIfError(sitesRes.error, 'Failed to load site coverage.');
  throwIfError(incidentsRes.error, 'Failed to load alert counts.');

  const activeShifts = shiftsRes.filter((shift) => isShiftActive(shift, now) || resolveWorkflowStatus(shift) === 'acknowledged');
  const required = requireData(sitesRes.data, []).length;
  const completion = guards.length > 0 ? Math.min(100, Math.round((activeShifts.length / guards.length) * 100)) : 0;

  return {
    activeShifts,
    onDuty: activeShifts.length,
    required,
    alerts: incidentsRes.count || 0,
    completion,
  };
}

export function generateShiftDrafts(form: BulkShiftFormData): GeneratedShiftDraft[] {
  const targetEmployeeIds = (form.employee_ids && form.employee_ids.length > 0)
    ? form.employee_ids
    : form.employee_id
      ? [form.employee_id]
      : [];

  if (!form.site_id || targetEmployeeIds.length === 0 || !form.start_date || !form.end_date) {
    throw new Error('Site, at least one guard, start date, and end date are required.');
  }

  const start = buildLocalDate(form.start_date, '00:00');
  const end = buildLocalDate(form.end_date, '00:00');

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Please provide valid start and end dates.');
  }

  if (end < start) {
    throw new Error('End date cannot be earlier than the start date.');
  }

  const drafts: GeneratedShiftDraft[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const day = cursor.getDay();
    const include =
      form.pattern === 'daily' ||
      (form.pattern === 'weekdays' && day >= 1 && day <= 5) ||
      (form.pattern === 'weekends' && (day === 0 || day === 6));

    if (include) {
      const shiftStart = buildLocalDate(toIsoDateKey(cursor), form.start_time);
      const shiftEnd = buildLocalDate(toIsoDateKey(cursor), form.end_time);

      if (shiftEnd <= shiftStart) {
        shiftEnd.setDate(shiftEnd.getDate() + 1);
      }

      for (const employeeId of targetEmployeeIds) {
        drafts.push({
          site_id: form.site_id,
          post_id: form.post_id || null,
          employee_id: employeeId,
          replacement_id: form.replacement_id || null,
          start_time: shiftStart.toISOString(),
          end_time: shiftEnd.toISOString(),
          status: 'scheduled',
          notes: form.notes.trim() || null,
          workflow_status: 'draft',
        });
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  if (drafts.length === 0) {
    throw new Error('No shifts matched the selected pattern and date range.');
  }

  return drafts;
}

export interface SiteShiftAssignmentDraft {
  site_id: string;
  post_id?: string | null;
  employee_id: string;
  replacement_id?: string | null;
  shift_kind?: RosterShiftKind | null;
  shift_date: string;
  end_date?: string;
  start_time: string;
  end_time: string;
  notes?: string | null;
}

export function buildSiteShiftDraft(assignment: SiteShiftAssignmentDraft, guardName?: string | null, replacementName?: string | null): GeneratedShiftDraft {
  const shiftStart = buildLocalDate(assignment.shift_date, assignment.start_time);
  const shiftEnd = buildLocalDate(assignment.end_date || assignment.shift_date, assignment.end_time);

  if (shiftEnd <= shiftStart) {
    shiftEnd.setDate(shiftEnd.getDate() + 1);
  }

  return {
    site_id: assignment.site_id,
    post_id: assignment.post_id || null,
    employee_id: assignment.employee_id,
    employee_name_snapshot: guardName || null,
    shift_kind: assignment.shift_kind || resolveShiftKind({ start_time: shiftStart.toISOString(), end_time: shiftEnd.toISOString(), shift_kind: assignment.shift_kind || null }),
    replacement_id: assignment.replacement_id || null,
    replacement_name_snapshot: replacementName || null,
    start_time: shiftStart.toISOString(),
    end_time: shiftEnd.toISOString(),
    status: 'scheduled',
    notes: assignment.notes?.trim() || null,
    workflow_status: 'draft',
  };
}

export function buildSiteShiftDrafts(assignments: SiteShiftAssignmentDraft[], guardLookup: Map<string, string>, siteName?: string | null): GeneratedShiftDraft[] {
  return assignments.map((assignment) => {
    const guardName = guardLookup.get(assignment.employee_id) || null;
    const replacementName = assignment.replacement_id ? guardLookup.get(assignment.replacement_id) || null : null;
    return {
      ...buildSiteShiftDraft(assignment, guardName, replacementName),
      notes:
        assignment.notes?.trim() ||
        (siteName ? `Assigned directly from ${siteName} operations.` : 'Assigned directly from site operations.'),
    };
  });
}

export async function findShiftConflicts(
  generatedShifts: GeneratedShiftDraft[],
  guards: SecurityGuard[],
  options?: { ignoreShiftIds?: string[] }
): Promise<ShiftConflict[]> {
  const uniqueGeneratedShifts = dedupeGeneratedShifts(generatedShifts);
  const ignoreShiftIds = new Set(options?.ignoreShiftIds || []);
  const existing = (await fetchPotentialShiftOverlaps(uniqueGeneratedShifts)).filter((shift) => !ignoreShiftIds.has(shift.id));
  const conflicts: ShiftConflict[] = [];

  for (const candidate of uniqueGeneratedShifts) {
    const employeeName = candidate.employee_name_snapshot || guards.find((guard) => guard.id === candidate.employee_id)?.full_name || 'Unknown Guard';

    for (const scheduled of existing) {
      if (scheduled.replacement_id === candidate.employee_id) {
        continue;
      }

      if (isHandoverPair(candidate, scheduled)) {
        continue;
      }

      if (isExactShiftMatch(candidate, scheduled)) {
        conflicts.push({
          employeeId: candidate.employee_id,
          employeeName: employeeName || scheduled.employee_name_snapshot || 'Unknown Guard',
          startTime: candidate.start_time,
          endTime: candidate.end_time,
          conflictingShiftId: scheduled.id,
          siteName: scheduled.security_sites?.name,
          source: 'existing',
          reason: 'duplicate',
        });
        continue;
      }

      if (
        shiftsOverlap(
          {
            employee_id: candidate.employee_id,
            start_time: candidate.start_time,
            end_time: candidate.end_time,
            status: candidate.status,
          },
          {
            employee_id: scheduled.employee_id,
            start_time: scheduled.start_time,
            end_time: scheduled.end_time,
            status: scheduled.status,
          }
        )
      ) {
        conflicts.push({
          employeeId: candidate.employee_id,
          employeeName: employeeName || scheduled.employee_name_snapshot || 'Unknown Guard',
          startTime: candidate.start_time,
          endTime: candidate.end_time,
          conflictingShiftId: scheduled.id,
          siteName: scheduled.security_sites?.name,
          source: 'existing',
          reason: 'overlap',
        });
      }
    }
  }

  for (let index = 0; index < uniqueGeneratedShifts.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < uniqueGeneratedShifts.length; compareIndex += 1) {
      const first = uniqueGeneratedShifts[index];
      const second = uniqueGeneratedShifts[compareIndex];

      if (isHandoverPair(first, second)) {
        continue;
      }

      if (isExactShiftMatch(first, second)) {
        const firstName = first.employee_name_snapshot || guards.find((guard) => guard.id === first.employee_id)?.full_name || 'Unknown Guard';
        conflicts.push({
          employeeId: first.employee_id,
          employeeName: firstName,
          startTime: second.start_time,
          endTime: second.end_time,
          source: 'generated',
          reason: 'duplicate',
        });
        continue;
      }

      if (
        shiftsOverlap(
          { employee_id: first.employee_id, start_time: first.start_time, end_time: first.end_time, status: first.status },
          { employee_id: second.employee_id, start_time: second.start_time, end_time: second.end_time, status: second.status }
        )
      ) {
        const firstName = first.employee_name_snapshot || guards.find((guard) => guard.id === first.employee_id)?.full_name || 'Unknown Guard';
        conflicts.push({
          employeeId: first.employee_id,
          employeeName: firstName,
          startTime: second.start_time,
          endTime: second.end_time,
          source: 'generated',
          reason: 'overlap',
        });
      }
    }
  }

  return conflicts;
}

export function getWeeklyHoursForGuard(guardId: string, shifts: SecurityShift[], referenceDate: string | Date) {
  const date = typeof referenceDate === 'string' ? new Date(referenceDate) : referenceDate;
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return shifts
    .filter(
      (shift) =>
        shift.employee_id === guardId &&
        shift.status !== 'cancelled' &&
        new Date(shift.start_time) >= start &&
        new Date(shift.start_time) < end
    )
    .reduce((sum, shift) => sum + getShiftHours(shift), 0);
}

function getRecentShiftCount(guardId: string, shifts: SecurityShift[], referenceDate: string | Date) {
  const date = typeof referenceDate === 'string' ? new Date(referenceDate) : referenceDate;
  const start = new Date(date);
  start.setDate(date.getDate() - 7);
  return shifts.filter(
    (shift) => shift.employee_id === guardId && shift.status !== 'cancelled' && new Date(shift.start_time) >= start
  ).length;
}

function getLastShiftBefore(guardId: string, shifts: SecurityShift[], slotStart: string) {
  const start = new Date(slotStart).getTime();
  return shifts
    .filter((shift) => shift.employee_id === guardId && new Date(shift.end_time).getTime() <= start && shift.status !== 'cancelled')
    .sort((a, b) => new Date(b.end_time).getTime() - new Date(a.end_time).getTime())[0];
}

function getAvailabilityMatch(
  guardId: string,
  availability: GuardAvailability[],
  slot: Pick<DispatchSlot, 'start_time' | 'end_time' | 'site_id' | 'post_id'>
): GuardSuggestion['availability_match'] {
  const slotDate = toIsoDateKey(slot.start_time);
  const records = availability.filter(
    (item) => item.guard_id === guardId && item.start_date <= slotDate && item.end_date >= slotDate && item.status !== 'rejected'
  );

  if (records.some((item) => item.availability_type === 'unavailable' || item.availability_type === 'time_off')) {
    return 'unavailable';
  }
  if (records.some((item) => item.availability_type === 'preferred' && item.preferred_post_id === slot.post_id)) {
    return 'preferred';
  }
  if (records.some((item) => item.availability_type === 'preferred' && item.preferred_site_id === slot.site_id)) {
    return 'preferred';
  }
  if (records.some((item) => item.availability_type === 'available')) {
    return 'available';
  }
  return 'neutral';
}

export function rankGuardsForSlot(
  slot: DispatchSlot,
  guards: SecurityGuard[],
  shifts: SecurityShift[],
  availability: GuardAvailability[]
) {
  const slotHours = getShiftHours({ start_time: slot.start_time, end_time: slot.end_time, break_minutes: 0, estimated_hours: null });

  return guards
    .map<GuardSuggestion>((guard) => {
      const overlap = shifts.some((candidateShift) =>
        shiftsOverlap(
          {
            employee_id: guard.id,
            start_time: slot.start_time,
            end_time: slot.end_time,
            status: 'scheduled',
          },
          {
            employee_id: candidateShift.employee_id,
            start_time: candidateShift.start_time,
            end_time: candidateShift.end_time,
            status: candidateShift.status,
          }
        )
      );

      const weeklyHours = getWeeklyHoursForGuard(guard.id, shifts, slot.start_time);
      const projectedWeeklyHours = weeklyHours + slotHours;
      const lastShift = getLastShiftBefore(guard.id, shifts, slot.start_time);
      const restHours = lastShift
        ? (new Date(slot.start_time).getTime() - new Date(lastShift.end_time).getTime()) / (1000 * 60 * 60)
        : 99;
      const restCompliant = restHours >= 10;
      const recentShiftCount = getRecentShiftCount(guard.id, shifts, slot.start_time);
      const lastAssignedSite = shifts
        .filter((item) => item.employee_id === guard.id && item.status !== 'cancelled')
        .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())[0];
      const sameCountyBonus = lastAssignedSite?.security_sites?.county === slot.site_county;
      const sameSiteBonus = lastAssignedSite?.site_id === slot.site_id;
      const psraReady = Boolean(guard.psra_number);
      const availabilityMatch = getAvailabilityMatch(guard.id, availability, slot);

      let score = 100;
      const rationale: string[] = [];

      if (overlap) {
        score -= 100;
        rationale.push('Overlaps with another assignment.');
      } else {
        rationale.push('No overlapping shift found.');
      }

      if (!restCompliant) {
        score -= 18;
        rationale.push(`Rest gap is only ${Math.max(0, Math.round(restHours))}h.`);
      } else {
        score += 8;
        rationale.push('Rest-period compliant.');
      }

      if (availabilityMatch === 'unavailable') {
        score -= 40;
        rationale.push('Guard submitted unavailable/time-off request.');
      } else if (availabilityMatch === 'preferred') {
        score += 16;
        rationale.push('Preferred for this site/post.');
      } else if (availabilityMatch === 'available') {
        score += 10;
        rationale.push('Explicitly marked available.');
      }

      if (sameSiteBonus) {
        score += 10;
        rationale.push('Recently worked this site.');
      } else if (sameCountyBonus) {
        score += 6;
        rationale.push('Recently worked in the same county.');
      }

      if (!psraReady) {
        score -= 12;
        rationale.push('Missing PSRA reference.');
      } else {
        score += 6;
        rationale.push('PSRA reference present.');
      }

      if (projectedWeeklyHours > 60) {
        score -= 24;
        rationale.push(`Projects ${Math.round(projectedWeeklyHours)}h this week.`);
      } else if (projectedWeeklyHours > 48) {
        score -= 8;
        rationale.push(`Approaching overtime at ${Math.round(projectedWeeklyHours)}h.`);
      } else {
        score += 6;
        rationale.push(`Balanced weekly load at ${Math.round(projectedWeeklyHours)}h.`);
      }

      score -= recentShiftCount * 2;
      rationale.push(`${recentShiftCount} shifts in the last 7 days.`);

      return {
        guard,
        score,
        weekly_hours: weeklyHours,
        projected_weekly_hours: projectedWeeklyHours,
        recent_shift_count: recentShiftCount,
        same_county_bonus: Boolean(sameCountyBonus),
        same_site_bonus: Boolean(sameSiteBonus),
        has_overlap: overlap,
        rest_compliant: restCompliant,
        psra_ready: psraReady,
        availability_match: availabilityMatch,
        rationale,
      };
    })
    .filter((suggestion) => !suggestion.has_overlap && suggestion.availability_match !== 'unavailable')
    .sort((a, b) => b.score - a.score);
}

export function selectEmergencyReplacement(
  slot: DispatchSlot,
  guards: SecurityGuard[],
  shifts: SecurityShift[],
  availability: GuardAvailability[],
  primaryGuardId: string
) {
  return rankGuardsForSlot(slot, guards, shifts, availability).find((suggestion) => suggestion.guard.id !== primaryGuardId)?.guard.id ?? null;
}

export function buildDispatchBoard(
  sites: SecuritySite[],
  posts: SecurityPost[],
  shifts: SecurityShift[],
  attendance: AttendanceRecord[],
  boardDate: string,
  bucket: BoardShiftBucket
) {
  const siteCoverages: DispatchSiteCoverage[] = [];
  const openSlots: DispatchSlot[] = [];
  const boardShifts = shifts.filter((shift) => toIsoDateKey(shift.start_time) === boardDate);

  // When there are no real shifts on the selected date, keep the board empty.
  // This avoids manufacturing placeholder "Open Slot" rows after a fresh reset.
  if (boardShifts.length === 0) {
    return {
      siteCoverages,
      openSlots,
      dueSoon: [] as SecurityShift[],
      lateRisk: [] as SecurityShift[],
      exceptionShifts: [] as SecurityShift[],
    };
  }

  for (const site of sites) {
    const sitePosts = posts.filter((post) => post.site_id === site.id);
    const activeSitePosts = sitePosts.filter((post) => boardShifts.some((shift) => shift.post_id === post.id));

    // Only render coverage for posts that actually have shifts on the selected date.
    // Empty posts stay out of the work roster so fresh resets do not show undeletable placeholders.
    if (activeSitePosts.length === 0) {
      continue;
    }

    const postCoverages: DispatchPostCoverage[] = [];

    for (const post of activeSitePosts) {
      const postShifts = boardShifts.filter((shift) => shift.post_id === post.id);
      const slotBreakdown: DispatchSlot[] = [];
      const configuredBuckets = (() => {
        if (bucket !== 'all') {
          return [bucket] as Exclude<BoardShiftBucket, 'all'>[];
        }

        const foundBuckets = new Set<Exclude<BoardShiftBucket, 'all'>>();
        for (const shift of postShifts) {
          foundBuckets.add(matchesShiftBucket(shift, 'day') ? 'day' : 'night');
        }

        if (foundBuckets.size === 0) {
          return ['day'] as Exclude<BoardShiftBucket, 'all'>[];
        }

        return Array.from(foundBuckets);
      })();

      for (const activeBucket of configuredBuckets) {
        const slotTimes = bucketTimesForDate(boardDate, activeBucket);
        const bucketShifts = postShifts.filter((shift) => matchesShiftBucket(shift, activeBucket));
        const acknowledged = bucketShifts.filter((shift) => ['acknowledged', 'checked_in', 'completed'].includes(resolveWorkflowStatus(shift))).length;
        const checkedIn = bucketShifts.filter((shift) => shift.checked_in_at || isShiftActive(shift)).length;
        const requiredGuards = post.required_guards || 1;
        const gap = Math.max(0, requiredGuards - bucketShifts.length);
        const overtimeRisk = bucketShifts.filter((shift) => getWeeklyHoursForGuard(shift.employee_id, shifts, shift.start_time) > 48).length;

        const slot: DispatchSlot = {
          id: `${post.id}-${activeBucket}-${boardDate}`,
          site_id: site.id,
          site_name: site.name,
          site_county: site.county || null,
          post_id: post.id,
          post_name: post.name,
          bucket: activeBucket,
          start_time: slotTimes.start_time,
          end_time: slotTimes.end_time,
          required_guards: requiredGuards,
          assigned_shifts: bucketShifts,
          open_positions: gap,
          checked_in: checkedIn,
          acknowledged,
          gap,
          overtime_risk: overtimeRisk,
        };

        slotBreakdown.push(slot);

        for (let slotIndex = 0; slotIndex < gap; slotIndex += 1) {
          openSlots.push({
            ...slot,
            id: `${slot.id}-open-${slotIndex + 1}`,
            required_guards: 1,
            assigned_shifts: [],
            open_positions: 1,
            gap: 1,
          });
        }
      }

      postCoverages.push({
        post_id: post.id,
        post_name: post.name,
        required_guards: slotBreakdown.reduce((sum, item) => sum + item.required_guards, 0),
        assigned: slotBreakdown.reduce((sum, item) => sum + item.assigned_shifts.length, 0),
        acknowledged: slotBreakdown.reduce((sum, item) => sum + item.acknowledged, 0),
        checked_in: slotBreakdown.reduce((sum, item) => sum + item.checked_in, 0),
        gap: slotBreakdown.reduce((sum, item) => sum + item.gap, 0),
        overtime_risk: slotBreakdown.reduce((sum, item) => sum + item.overtime_risk, 0),
        slot_breakdown: slotBreakdown,
      });
    }

    if (postCoverages.length === 0) {
      continue;
    }

    siteCoverages.push({
      site_id: site.id,
      site_name: site.name,
      county: site.county || null,
      assigned: postCoverages.reduce((sum, item) => sum + item.assigned, 0),
      required: postCoverages.reduce((sum, item) => sum + item.required_guards, 0),
      acknowledged: postCoverages.reduce((sum, item) => sum + item.acknowledged, 0),
      checked_in: postCoverages.reduce((sum, item) => sum + item.checked_in, 0),
      gap: postCoverages.reduce((sum, item) => sum + item.gap, 0),
      overtime_risk: postCoverages.reduce((sum, item) => sum + item.overtime_risk, 0),
      estimated_cost: postCoverages.reduce(
        (sum, item) =>
          sum +
          item.slot_breakdown.reduce(
            (slotSum, slot) =>
              slotSum +
              slot.assigned_shifts.reduce(
                (shiftSum, shift) =>
                  shiftSum + getShiftHours(shift) * Number(shift.hourly_rate_snapshot ?? shift.security_sites?.hourly_rate ?? site.hourly_rate ?? 0),
                0
              ),
            0
          ),
        0
      ),
      post_coverages: postCoverages,
    });
  }

  const dueSoon = boardShifts.filter((shift) => isShiftDueSoon(shift));
  const lateRisk = boardShifts.filter((shift) => isLateRisk(shift, attendance));
  const exceptionShifts = boardShifts.filter(
    (shift) => shift.is_sick || shift.exception_status !== 'none' || shift.status === 'absent' || shift.status === 'cancelled'
  );

  return {
    siteCoverages,
    openSlots,
    dueSoon,
    lateRisk,
    exceptionShifts,
  };
}

export function getReassignmentCandidates(
  shift: SecurityShift,
  guards: SecurityGuard[],
  shifts: SecurityShift[]
) {
  return guards.filter((guard) => {
    if (guard.id === shift.employee_id) {
      return false;
    }

    return !shifts.some((candidateShift) => {
      if (candidateShift.id === shift.id) {
        return false;
      }

      return shiftsOverlap(
        {
          employee_id: guard.id,
          start_time: shift.start_time,
          end_time: shift.end_time,
          status: 'scheduled',
        },
        {
          employee_id: candidateShift.employee_id,
          start_time: candidateShift.start_time,
          end_time: candidateShift.end_time,
          status: candidateShift.status,
        }
      );
    });
  });
}

export function getOpenShiftPayload(
  slot: DispatchSlot,
  guardId: string,
  workflowStatus: ShiftWorkflowStatus = 'draft',
  replacementId?: string | null
): GeneratedShiftDraft {
  return {
    site_id: slot.site_id,
    post_id: slot.post_id,
    employee_id: guardId,
    shift_kind: slot.bucket,
    replacement_id: replacementId || null,
    start_time: slot.start_time,
    end_time: slot.end_time,
    status: 'scheduled',
    notes: `Auto-filled from dispatch board for ${slot.bucket} coverage.`,
    workflow_status: workflowStatus,
  };
}

async function logRosterActivity(actionType: string, description: string, metadata: Record<string, unknown>) {
  await activityLogger.log({
    actionType,
    actionCategory: 'security_roster',
    resourceType: 'security_shift',
    description,
    metadata,
  });
}

export async function createBulkShifts(generatedShifts: GeneratedShiftDraft[]) {
  const uniqueGeneratedShifts = dedupeGeneratedShifts(generatedShifts);

  if (uniqueGeneratedShifts.length === 0) {
    return [] as SecurityShift[];
  }

  const overlaps = await fetchPotentialShiftOverlaps(uniqueGeneratedShifts);
  const exactDuplicate = overlaps.find((scheduled) => uniqueGeneratedShifts.some((draft) => isExactShiftMatch(draft, scheduled)));
  if (exactDuplicate) {
    throw new Error('A matching shift already exists for the selected guard, site, post, and time window.');
  }

  const guardNameLookup = await fetchGuardNameLookup(
    uniqueGeneratedShifts.flatMap((shift) => [shift.employee_id, shift.replacement_id || '']).filter(Boolean)
  );
  const createdShifts: SecurityShift[] = [];
  const pendingInserts: GeneratedShiftDraft[] = [];

  for (const draft of uniqueGeneratedShifts) {
    const handoverShift = overlaps.find(
      (shift) =>
        shift.replacement_id === draft.employee_id &&
        shiftsOverlap(
          {
            employee_id: draft.employee_id,
            start_time: draft.start_time,
            end_time: draft.end_time,
            status: draft.status,
          },
          {
            employee_id: shift.employee_id,
            start_time: shift.start_time,
            end_time: shift.end_time,
            status: shift.status,
          }
        )
    );

    if (handoverShift) {
      const restoredShift = await restoreHandoverShift(
        {
          id: handoverShift.id,
          notes: handoverShift.notes || null,
          workflow_status: handoverShift.workflow_status || null,
          status: handoverShift.status,
          checked_in_at: handoverShift.checked_in_at || null,
          checked_out_at: handoverShift.checked_out_at || null,
          profiles: handoverShift.profiles || null,
          employee_name_snapshot: handoverShift.employee_name_snapshot || null,
          replacement_name_snapshot: handoverShift.replacement_name_snapshot || null,
        },
        draft.employee_id,
        guardNameLookup.get(draft.employee_id) || draft.employee_name_snapshot || 'original guard',
        draft
      );
      createdShifts.push(restoredShift);
      continue;
    }

    pendingInserts.push(draft);
  }

  if (pendingInserts.length > 0) {
    const response = await supabase
      .from('security_shifts')
      .insert(
        pendingInserts.map((draft) => {
          const employeeName = draft.employee_name_snapshot || guardNameLookup.get(draft.employee_id) || 'Assigned Guard';
          const replacementName = draft.replacement_id ? draft.replacement_name_snapshot || guardNameLookup.get(draft.replacement_id) || 'Off-duty Releaver' : null;
          return {
            ...draft,
            shift_kind: draft.shift_kind || resolveShiftKind(draft),
            employee_name_snapshot: employeeName,
            replacement_name_snapshot: replacementName,
          };
        })
      )
      .select(SECURITY_SHIFT_SELECT);
    throwIfError(response.error, 'Failed to save generated shifts.');
    const batchCreated = (response.data || []) as SecurityShift[];
    if (batchCreated.length === 0) {
      throw new Error('The generated shifts could not be loaded.');
    }
    createdShifts.push(...batchCreated);
  }

  await logRosterActivity('bulk_generate', `Generated ${uniqueGeneratedShifts.length} roster shifts`, {
    shiftCount: uniqueGeneratedShifts.length,
    employeeIds: [...new Set(uniqueGeneratedShifts.map((shift) => shift.employee_id))],
    siteIds: [...new Set(uniqueGeneratedShifts.map((shift) => shift.site_id))],
  });

  return createdShifts;
}

export async function restoreShiftToOriginalGuard(shift: SecurityShift) {
  if (!shift.replacement_id) {
    throw new Error('This shift does not have an off duty releaver assigned.');
  }

  const replacementNameLookup = await fetchGuardNameLookup([shift.replacement_id]);

  return restoreHandoverShift(
    {
      id: shift.id,
      notes: shift.notes || null,
      workflow_status: shift.workflow_status || null,
      status: shift.status,
      checked_in_at: shift.checked_in_at || null,
      checked_out_at: shift.checked_out_at || null,
      profiles: shift.profiles || null,
      employee_name_snapshot: shift.employee_name_snapshot || null,
      replacement_name_snapshot: shift.replacement_name_snapshot || null,
    },
    shift.replacement_id,
    replacementNameLookup.get(shift.replacement_id) || shift.replacement_name_snapshot || 'original guard',
    {
      site_id: shift.site_id,
      post_id: shift.post_id,
      employee_id: shift.replacement_id,
      replacement_id: null,
      start_time: shift.start_time,
      end_time: shift.end_time,
      status: shift.status,
      notes: shift.notes || '',
      workflow_status: shift.workflow_status || 'draft',
    }
  );
}

export async function updateShiftStatus(shiftId: string, status: ShiftStatus) {
  const workflowStatus: ShiftWorkflowStatus =
    status === 'completed' ? 'completed' : status === 'acknowledged' ? 'acknowledged' : status === 'absent' ? 'no_show' : 'published';
  const response = await supabase.from('security_shifts').update({ status, workflow_status: workflowStatus }).eq('id', shiftId);
  throwIfError(response.error, `Failed to mark shift as ${status}.`);

  await logRosterActivity('status_update', `Updated shift ${shiftId} to ${status}`, {
    shiftId,
    status,
  });
}

export async function updateShiftWorkflowStatus(shiftId: string, workflowStatus: ShiftWorkflowStatus) {
  const currentResponse = await supabase
    .from('security_shifts')
    .select('id, employee_id, replacement_id, replacement_name_snapshot')
    .eq('id', shiftId)
    .single();
  throwIfError(currentResponse.error, `Failed to load shift ${shiftId}.`);
  const currentShift = requireData<Pick<SecurityShift, 'employee_id' | 'replacement_id' | 'replacement_name_snapshot'> | null>(
    currentResponse.data as Pick<SecurityShift, 'employee_id' | 'replacement_id' | 'replacement_name_snapshot'> | null,
    null
  );
  if (!currentShift) {
    throw new Error('The shift could not be loaded.');
  }

  const payload: Record<string, unknown> = { workflow_status: workflowStatus };
  if (workflowStatus === 'published') {
    payload.published_at = new Date().toISOString();
  }
  if (workflowStatus === 'acknowledged') {
    payload.acknowledged_at = new Date().toISOString();
    payload.status = 'acknowledged';
  }
  if (workflowStatus === 'checked_in') {
    payload.checked_in_at = new Date().toISOString();
    payload.status = 'acknowledged';
    if (currentShift.replacement_id) {
      payload.checked_in_by = currentShift.replacement_id;
      payload.checked_in_by_name_snapshot = currentShift.replacement_name_snapshot || null;
    } else {
      payload.checked_in_by = currentShift.employee_id;
      payload.checked_in_by_name_snapshot = null;
    }
  }
  if (workflowStatus === 'completed') {
    payload.checked_out_at = new Date().toISOString();
    payload.status = 'completed';
  }
  if (workflowStatus === 'no_show') {
    payload.status = 'absent';
    payload.exception_status = 'no_show';
  }

  const response = await supabase
    .from('security_shifts')
    .update(payload)
    .eq('id', shiftId)
    .select(SECURITY_SHIFT_SELECT)
    .single();
  throwIfError(response.error, `Failed to move shift to ${workflowStatus}.`);

  await logRosterActivity('workflow_update', `Updated workflow for shift ${shiftId} to ${workflowStatus}`, {
    shiftId,
    workflowStatus,
  });

  const updatedShift = requireData<SecurityShift | null>(response.data as SecurityShift | null, null);
  if (!updatedShift) {
    throw new Error('The updated shift could not be loaded.');
  }

  return updatedShift;
}

export async function bulkUpdateShiftStatus(shiftIds: string[], status: ShiftStatus) {
  const workflowStatus: ShiftWorkflowStatus =
    status === 'completed' ? 'completed' : status === 'acknowledged' ? 'acknowledged' : status === 'absent' ? 'no_show' : 'published';
  const response = await supabase.from('security_shifts').update({ status, workflow_status: workflowStatus }).in('id', shiftIds);
  throwIfError(response.error, `Failed to update selected shifts to ${status}.`);

  await logRosterActivity('bulk_status_update', `Updated ${shiftIds.length} shifts to ${status}`, {
    shiftIds,
    status,
  });
}

export async function deleteShifts(shiftIds: string[]) {
  const response = await supabase.from('security_shifts').delete().in('id', shiftIds);
  throwIfError(response.error, 'Failed to delete selected shifts.');
  clearRosterBootstrapCache();

  await logRosterActivity('bulk_delete', `Deleted ${shiftIds.length} shifts`, {
    shiftIds,
  });
}

export async function reassignShift(shift: SecurityShift, guardId: string, replacementGuardId?: string | null) {
  const guardNameLookup = await fetchGuardNameLookup([guardId, replacementGuardId || '', shift.employee_id]);
  const originalGuard = shift.employee_name_snapshot || shift.profiles?.full_name || guardNameLookup.get(shift.employee_id) || shift.employee_id;
  const assignedGuardName = guardNameLookup.get(guardId) || guardId;
  const replacementGuardName = replacementGuardId ? guardNameLookup.get(replacementGuardId) || replacementGuardId : null;
  const existingNotes = shift.notes?.trim();
  const replacementNote = replacementGuardId ? ' Off-duty releaver has been assigned.' : '';
  const notes = existingNotes
    ? `${existingNotes}\nReassigned from ${originalGuard}.${replacementNote}`
    : `Reassigned from ${originalGuard}.${replacementNote}`;

  const response = await supabase
    .from('security_shifts')
    .update({
      employee_id: guardId,
      employee_name_snapshot: assignedGuardName,
      replacement_id: replacementGuardId || null,
      replacement_name_snapshot: replacementGuardName,
      is_sick: false,
      status: 'scheduled',
      workflow_status: 'draft',
      notified_at: null,
      reminder_sent: false,
      notes,
    })
    .eq('id', shift.id)
    .select(SECURITY_SHIFT_SELECT)
    .single();

  throwIfError(response.error, 'Failed to reassign shift.');
  const updatedShift = requireData<SecurityShift | null>(response.data as SecurityShift | null, null);
  if (!updatedShift) {
    throw new Error('The reassigned shift could not be loaded.');
  }
  clearRosterBootstrapCache();

  await logRosterActivity('reassign', `Reassigned shift ${shift.id}`, {
    shiftId: shift.id,
    previousGuardId: shift.employee_id,
    replacementGuardId: guardId,
    offDutyReleaverId: replacementGuardId || null,
  });

  return updatedShift;
}

export interface ShiftDetailsUpdate {
  site_id: string;
  post_id?: string | null;
  employee_id: string;
  replacement_id?: string | null;
  shift_kind?: RosterShiftKind | null;
  shift_date: string;
  end_date?: string;
  start_time: string;
  end_time: string;
  workflow_status?: ShiftWorkflowStatus | null;
  notes?: string | null;
}

export async function updateShiftDetails(shift: SecurityShift, details: ShiftDetailsUpdate) {
  const guardNameLookup = await fetchGuardNameLookup([details.employee_id, details.replacement_id || '', shift.employee_id]);
  const assignedGuardName = guardNameLookup.get(details.employee_id) || details.employee_id;
  const replacementGuardName = details.replacement_id ? guardNameLookup.get(details.replacement_id) || details.replacement_id : null;
  const shiftStart = buildLocalDate(details.shift_date, details.start_time);
  const shiftEnd = buildLocalDate(details.end_date || details.shift_date, details.end_time);

  if (shiftEnd <= shiftStart) {
    shiftEnd.setDate(shiftEnd.getDate() + 1);
  }

  const workflowStatus = details.workflow_status || shift.workflow_status || 'draft';
  const payload: Record<string, unknown> = {
    site_id: details.site_id,
    post_id: details.post_id || null,
    employee_id: details.employee_id,
    employee_name_snapshot: assignedGuardName,
    replacement_id: details.replacement_id || null,
    replacement_name_snapshot: replacementGuardName,
    shift_kind: details.shift_kind || resolveShiftKind({ start_time: shiftStart.toISOString(), end_time: shiftEnd.toISOString(), shift_kind: details.shift_kind || null }),
    start_time: shiftStart.toISOString(),
    end_time: shiftEnd.toISOString(),
    notes: details.notes?.trim() || null,
    workflow_status: workflowStatus,
    status: shift.status === 'cancelled' ? 'cancelled' : shift.status || 'scheduled',
    is_sick: false,
    reminder_sent: false,
  };

  if (workflowStatus === 'published' && !shift.published_at) {
    payload.published_at = new Date().toISOString();
  }
  if (workflowStatus === 'acknowledged' && !shift.acknowledged_at) {
    payload.acknowledged_at = new Date().toISOString();
    payload.status = 'acknowledged';
  }
  if (workflowStatus === 'checked_in' && !shift.checked_in_at) {
    payload.checked_in_at = new Date().toISOString();
    payload.status = 'acknowledged';
  }
  if (workflowStatus === 'completed' && !shift.checked_out_at) {
    payload.checked_out_at = new Date().toISOString();
    payload.status = 'completed';
  }
  if (workflowStatus === 'no_show') {
    payload.status = 'absent';
    payload.exception_status = 'no_show';
  }

  const response = await supabase
    .from('security_shifts')
    .update(payload)
    .eq('id', shift.id)
    .select(SECURITY_SHIFT_SELECT)
    .single();

  throwIfError(response.error, 'Failed to update shift details.');
  const updatedShift = requireData<SecurityShift | null>(response.data as SecurityShift | null, null);
  if (!updatedShift) {
    throw new Error('The updated shift could not be loaded.');
  }
  clearRosterBootstrapCache();

  await logRosterActivity('shift_details_update', `Updated shift ${shift.id}`, {
    shiftId: shift.id,
    siteId: details.site_id,
    postId: details.post_id || null,
    employeeId: details.employee_id,
    replacementId: details.replacement_id || null,
    workflowStatus,
  });

  return updatedShift;
}

export async function markShiftSick(shift: SecurityShift, reason: string) {
  const response = await supabase
    .from('security_shifts')
    .update({
      is_sick: true,
      status: 'cancelled',
      workflow_status: 'exception',
      exception_status: 'sick_leave',
      exception_notes: reason.trim() || 'Sick',
      reason: reason.trim() || 'Sick',
    })
    .eq('id', shift.id);

  throwIfError(response.error, 'Failed to mark guard as sick.');
  clearRosterBootstrapCache();

  await logRosterActivity('mark_sick', `Marked shift ${shift.id} as sick`, {
    shiftId: shift.id,
    reason: reason.trim() || 'Sick',
  });
}

export async function markShiftException(shiftId: string, exceptionStatus: ShiftExceptionStatus, exceptionNotes: string) {
  const response = await supabase
    .from('security_shifts')
    .update({
      workflow_status: 'exception',
      exception_status: exceptionStatus,
      exception_notes: exceptionNotes || null,
    })
    .eq('id', shiftId);

  throwIfError(response.error, 'Failed to flag shift exception.');
  clearRosterBootstrapCache();

  await logRosterActivity('mark_exception', `Marked shift ${shiftId} as ${exceptionStatus}`, {
    shiftId,
    exceptionStatus,
    exceptionNotes,
  });
}

export interface ShiftNotificationSummary {
  success: boolean;
  inAppSent: boolean;
  emailSent: boolean;
  smsSent: boolean;
  failures: string[];
}

export async function sendShiftNotification(shift: SecurityShift): Promise<ShiftNotificationSummary> {
  const guardName = shift.employee_name_snapshot || shift.profiles?.full_name || 'Guard';
  const shiftDate = new Date(shift.start_time).toLocaleDateString();
  const shiftTime = formatShiftTimeRange(shift);
  const siteName = shift.security_sites?.name || 'your site';
  const postName = shift.security_posts?.name || 'your post';
  const notificationMessage = `You are assigned to ${siteName}${shift.security_posts?.name ? ` - ${postName}` : ''} on ${shiftDate}.`;
  const smsMessage = `Hello ${guardName}, you have been assigned to ${siteName}${shift.security_posts?.name ? ` - ${postName}` : ''} on ${shiftDate} (${shiftTime}). Please report on time.`;

  const failures: string[] = [];

  let inAppSent = false;
  try {
    inAppSent = await NotificationService.sendNotification(
      shift.employee_id,
      'Shift Assignment',
      notificationMessage,
      'success'
    );
    if (!inAppSent) {
      failures.push('in-app notification');
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : 'in-app notification');
  }

  let emailSent = false;
  if (shift.profiles?.email) {
    try {
      const template = EmailTemplates.shiftAssigned(guardName, {
        site: siteName,
        shift: postName,
        date: shiftDate,
        time: shiftTime,
      });
      const response = await sendEmail({
        to: shift.profiles.email,
        subject: template.subject,
        html: template.html,
      });
      emailSent = response.success;
      if (!emailSent) {
        failures.push(response.error || 'email notification');
      }
    } catch (error) {
      failures.push(error instanceof Error ? error.message : 'email notification');
    }
  } else {
    failures.push('email missing');
  }

  let smsSent = false;
  if (shift.profiles?.phone) {
    try {
      const response = await sendBulkSms([shift.profiles.phone], smsMessage);
      smsSent = response.success;
      if (!smsSent) {
        failures.push(response.error || 'sms notification');
      }
    } catch (error) {
      failures.push(error instanceof Error ? error.message : 'sms notification');
    }
  } else {
    failures.push('phone missing');
  }

  const success = inAppSent || emailSent || smsSent;

  if (success) {
    const response = await supabase
      .from('security_shifts')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', shift.id);

    throwIfError(response.error, 'Notification was sent, but the shift record could not be updated.');
  }

  await logRosterActivity('notify_guard', `Sent assignment notification for shift ${shift.id}`, {
    shiftId: shift.id,
    employeeId: shift.employee_id,
    success,
    inAppSent,
    emailSent,
    smsSent,
    failures,
  });

  return {
    success,
    inAppSent,
    emailSent,
    smsSent,
    failures,
  };
}

export async function notifyShifts(shifts: SecurityShift[]) {
  const sentIds: string[] = [];
  const failures: string[] = [];

  const settled = await Promise.allSettled(
    shifts.map(async (shift) => {
      const sent = await NotificationService.sendNotification(
        shift.employee_id,
        'Roster Update',
        'Your roster has been updated. Check the portal for details.',
        'success'
      );

      if (!sent) {
        throw new Error(shift.employee_name_snapshot || shift.profiles?.full_name || shift.employee_id);
      }

      sentIds.push(shift.id);
    })
  );

  settled.forEach((result) => {
    if (result.status === 'rejected') {
      failures.push(result.reason instanceof Error ? result.reason.message : 'Unknown guard');
    }
  });

  if (sentIds.length > 0) {
    const response = await supabase
      .from('security_shifts')
      .update({ notified_at: new Date().toISOString() })
      .in('id', sentIds);

    throwIfError(response.error, 'Notifications were sent, but shift records could not be updated.');
  }

  await logRosterActivity('bulk_notify', `Sent ${sentIds.length} roster notifications`, {
    shiftIds: sentIds,
    failures,
  });

  return {
    sentCount: sentIds.length,
    failures,
  };
}

export async function sendUpcomingReminders(shifts: SecurityShift[], now = new Date()) {
  const cutoff = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const upcoming = shifts.filter((shift) => {
    const start = new Date(shift.start_time);
    return start > now && start <= cutoff && !shift.reminder_sent && resolveWorkflowStatus(shift) !== 'draft';
  });

  if (upcoming.length === 0) {
    return { reminderCount: 0 };
  }

  const settled = await Promise.allSettled(
    upcoming.map((shift) =>
      NotificationService.sendNotification(
        shift.employee_id,
        'Shift Reminder',
        `Reminder: Your shift at ${shift.security_sites?.name || 'your assigned site'} starts soon.`,
        'info'
      )
    )
  );

  const successfulIds = upcoming
    .filter((_, index) => settled[index].status === 'fulfilled' && settled[index].value)
    .map((shift) => shift.id);

  if (successfulIds.length > 0) {
    const response = await supabase.from('security_shifts').update({ reminder_sent: true }).in('id', successfulIds);
    throwIfError(response.error, 'Reminders were sent, but reminder status could not be updated.');
  }

  await logRosterActivity('send_reminders', `Sent ${successfulIds.length} shift reminders`, {
    shiftIds: successfulIds,
  });

  return {
    reminderCount: successfulIds.length,
  };
}

export async function publishRosterVersion(
  shifts: SecurityShift[],
  rosterDate: string,
  reason: string,
  siteId?: string
) {
  if (shifts.length === 0) {
    throw new Error('There are no shifts to publish for the selected board.');
  }

  const versionNumberRes = await supabase
    .from('security_roster_versions')
    .select('version_number')
    .eq('roster_date', rosterDate)
    .is('site_id', siteId || null)
    .order('version_number', { ascending: false })
    .limit(1);

  if (versionNumberRes.error && !isOptionalFeatureError(versionNumberRes.error)) {
    throw new Error(versionNumberRes.error.message || 'Failed to compute roster version number.');
  }

  const nextVersion = (versionNumberRes.data?.[0]?.version_number || 0) + 1;
  const summary = {
    shift_count: shifts.length,
    site_count: new Set(shifts.map((shift) => shift.site_id)).size,
    draft_count: shifts.filter((shift) => resolveWorkflowStatus(shift) === 'draft').length,
  };

  const versionInsert = await supabase
    .from('security_roster_versions')
    .insert({
      roster_date: rosterDate,
      site_id: siteId || null,
      version_number: nextVersion,
      status: 'published',
      reason: reason || 'Published from dispatch board',
      summary,
      published_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  throwIfError(versionInsert.error, 'Failed to create roster version.');

  const version = versionInsert.data as RosterVersion;
  const snapshotItems = shifts.map((shift) => ({
    version_id: version.id,
    source_shift_id: shift.id,
    shift_snapshot: shift,
  }));

  const snapshotInsert = await supabase.from('security_roster_version_items').insert(snapshotItems);
  throwIfError(snapshotInsert.error, 'Failed to snapshot roster version.');

  const shiftUpdate = await supabase
    .from('security_shifts')
    .update({
      workflow_status: 'published',
      published_at: new Date().toISOString(),
      version_id: version.id,
      published_reason: reason || 'Published from dispatch board',
    })
    .in('id', shifts.map((shift) => shift.id));

  throwIfError(shiftUpdate.error, 'Failed to publish roster shifts.');

  await logRosterActivity('publish_roster', `Published roster version ${nextVersion} for ${rosterDate}`, {
    rosterDate,
    versionId: version.id,
    shiftIds: shifts.map((shift) => shift.id),
  });

  return version;
}

export async function restoreRosterVersion(versionId: string) {
  const itemsRes = await supabase
    .from('security_roster_version_items')
    .select('source_shift_id, shift_snapshot')
    .eq('version_id', versionId);

  throwIfError(itemsRes.error, 'Failed to load roster snapshot.');
  const items = requireData<any[]>(itemsRes.data, []);

  for (const item of items) {
    const snapshot = item.shift_snapshot || {};
    if (!item.source_shift_id) {
      continue;
    }

    const response = await supabase
      .from('security_shifts')
      .update({
        employee_id: snapshot.employee_id,
        site_id: snapshot.site_id,
        post_id: snapshot.post_id,
        start_time: snapshot.start_time,
        end_time: snapshot.end_time,
        status: snapshot.status,
        notes: snapshot.notes,
        is_sick: snapshot.is_sick,
        replacement_id: snapshot.replacement_id,
        reason: snapshot.reason,
        reminder_sent: snapshot.reminder_sent,
        notified_at: snapshot.notified_at,
        workflow_status: snapshot.workflow_status,
        published_at: snapshot.published_at,
        acknowledged_at: snapshot.acknowledged_at,
        checked_in_at: snapshot.checked_in_at,
        checked_out_at: snapshot.checked_out_at,
        exception_status: snapshot.exception_status,
        exception_notes: snapshot.exception_notes,
        hourly_rate_snapshot: snapshot.hourly_rate_snapshot,
        estimated_hours: snapshot.estimated_hours,
        actual_hours: snapshot.actual_hours,
        break_minutes: snapshot.break_minutes,
        shift_template_id: snapshot.shift_template_id,
        version_id: versionId,
        published_reason: snapshot.published_reason,
      })
      .eq('id', item.source_shift_id);

    throwIfError(response.error, 'Failed to restore a roster shift from version history.');
  }

  const versionRes = await supabase
    .from('security_roster_versions')
    .update({ status: 'restored' })
    .eq('id', versionId)
    .select('*')
    .single();

  if (!versionRes.error) {
    await logRosterActivity('restore_roster_version', `Restored roster version ${versionId}`, {
      versionId,
      rosterDate: versionRes.data?.roster_date,
    });
  }
}

export async function relieveAllGuardsOfAllShifts(guards: SecurityGuard[]) {
  const shiftsRes = await supabase
    .from('security_shifts')
    .select('id, employee_id, replacement_id, status')
    .neq('status', 'cancelled')
    .is('replacement_id', null);

  throwIfError(shiftsRes.error, 'Failed to load shifts for relief operation.');
  const shiftsToRelieve = requireData<any[]>(shiftsRes.data, []);

  if (shiftsToRelieve.length === 0) {
    return { relievedCount: 0, message: 'No shifts to relieve.' };
  }

  const guardNameLookup = await fetchGuardNameLookup(guards.map((g) => g.id));
  let relievedCount = 0;

  for (const shift of shiftsToRelieve) {
    const availableGuards = guards.filter((g) => g.id !== shift.employee_id);
    if (availableGuards.length === 0) {
      continue;
    }

    const replacementGuard = availableGuards[Math.floor(Math.random() * availableGuards.length)];
    const replacementName = guardNameLookup.get(replacementGuard.id) || replacementGuard.full_name || 'Off-duty Releaver';

    const response = await supabase
      .from('security_shifts')
      .update({
        replacement_id: replacementGuard.id,
        replacement_name_snapshot: replacementName,
      })
      .eq('id', shift.id);

    if (!response.error) {
      relievedCount++;
    }
  }

  await logRosterActivity('relieve_all_guards', `Relieved all guards of ${relievedCount} shifts`, {
    totalShifts: shiftsToRelieve.length,
    relievedCount,
  });

  return {
    relievedCount,
    message: `Successfully relieved ${relievedCount} of ${shiftsToRelieve.length} shifts.`,
  };
}
