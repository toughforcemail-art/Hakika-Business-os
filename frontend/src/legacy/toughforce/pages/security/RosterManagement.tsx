// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  closestCenter,
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  Bell,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Edit2,
  Filter,
  GripVertical,
  Search,
  Send,
  ShieldAlert,
  Siren,
  Users,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import CustomToast, { sanitizeError } from '../../components/CustomToast';
import CountyPicker from '../../components/security/CountyPicker';
import ThemedConfirmDialog from '../../components/security/ThemedConfirmDialog';
import { isAbortError } from '../../utils/abortErrors';
import { migrateGuardNamesToShifts } from '../../utils/migrateGuardNames';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  buildDispatchBoard,
  buildSiteShiftDraft,
  calculateRosterStats,
  createBulkShifts,
  deleteShifts,
  fetchRosterBootstrapData,
  fetchRosterAuditTrail,
  fetchRosterOperationsMeta,
  fetchRosterShifts,
  getCachedRosterBootstrapData,
  filterShifts,
  findShiftConflicts,
  formatShiftTimeRange,
  formatGuardDropdownLabel,
  generateShiftDrafts,
  getShiftHours,
  getWeeklyHoursForGuard,
  isLateRisk,
  isShiftDueSoon,
  matchesShiftBucket,
  notifyShifts,
  publishRosterVersion,
  reassignShift as reassignRosterShift,
  rankGuardsForSlot,
  relieveAllGuardsOfAllShifts,
  selectEmergencyReplacement,
  resolveShiftKindLabel,
  resolveWorkflowStatus,
  restoreRosterVersion,
  restoreShiftToOriginalGuard,
  sendShiftNotification,
  sendUpcomingReminders,
  toIsoDateKey,
  updateShiftWorkflowStatus,
  updateShiftDetails,
  markShiftException,
} from '../../services/securityRosterService';
import type {
  AttendanceRecord,
  BoardShiftBucket,
  BulkShiftFormData,
  ArchivedSecurityGuard,
  DispatchSlot,
  GuardAvailability,
  GuardSuggestion,
  GeneratedShiftDraft,
  RosterAuditLogEntry,
  RosterFilters,
  RosterRequest,
  RosterStats,
  RosterVersion,
  RosterWorkspaceMode,
  SecurityCentre,
  SecurityGuard,
  SecurityPost,
  SecurityShift,
  SecuritySite,
  ShiftConflict,
  ShiftTemplate,
  ShiftWorkflowStatus,
} from '../../types/security';

const todayKey = toIsoDateKey(new Date());

const initialFilters: RosterFilters = {
  timeframe: 'all',
  site_id: 'all',
  post_id: 'all',
  branch_id: 'all',
  employee_id: 'all',
  county: 'all',
  query: '',
};

const initialBulkData: BulkShiftFormData = {
  site_id: '',
  post_id: '',
  employee_id: '',
  employee_ids: [],
  replacement_id: '',
  start_date: todayKey,
  end_date: todayKey,
  start_time: '06:00',
  end_time: '18:00',
  pattern: 'daily',
  notes: '',
};

const rosterComposerDraftStorageKey = 'security-roster-composer-draft';

const emptyStats: RosterStats = {
  totalGuards: 0,
  pendingAck: 0,
  todaysAbsences: 0,
  activeShifts: 0,
  overdueNotifications: 0,
};

function getShiftLaneLabel(
  shift: Pick<SecurityShift, 'start_time' | 'end_time'> & { shift_kind?: SecurityShift['shift_kind'] } | Pick<DispatchSlot, 'start_time' | 'end_time'>
) {
  return resolveShiftKindLabel(shift);
}

function formatRosterWindow(
  shift: Pick<SecurityShift, 'start_time' | 'end_time' | 'shift_kind'> | Pick<DispatchSlot, 'start_time' | 'end_time'>
) {
  return `${new Date(shift.start_time).toLocaleDateString()} • ${getShiftLaneLabel(shift)} • ${formatShiftTimeRange(shift)}`;
}

function getReleaverBadge(shift: Pick<SecurityShift, 'replacement_id'>) {
  return shift.replacement_id ? (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
      Releaver
    </span>
  ) : null;
}

function formatCheckInTime(value?: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

type RosterPreviewState = {
  label: string;
  generatedShifts: ReturnType<typeof generateShiftDrafts>;
  conflicts: ShiftConflict[];
  totalSelectedGuards: number;
  affectedSites: string[];
  affectedPosts: string[];
};

type MobileBulkWizardStep = 'setup' | 'guards' | 'review';

type RosterSavedPreset = {
  name: string;
  filters: RosterFilters;
  boardDate: string;
  boardBucket: BoardShiftBucket;
  workflowFilter: 'all' | ShiftWorkflowStatus;
  workspaceMode: RosterWorkspaceMode;
};

const savedPresetsStorageKey = 'security-roster-workspace-presets';

type BulkAssignmentRow = {
  employee_id: string;
  centre_id: string;
  site_id: string;
  post_id: string;
  replacement_id: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  notes: string;
};

function createBulkAssignmentRow(overrides: Partial<BulkAssignmentRow> = {}): BulkAssignmentRow {
  return {
    employee_id: '',
    centre_id: '',
    site_id: '',
    post_id: '',
    replacement_id: '',
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    notes: '',
    ...overrides,
  };
}

function getRecordStringValue(record: Record<string, unknown> | null | undefined, key: string) {
  const value = record?.[key];
  return typeof value === 'string' ? value : '';
}

function formatConflictToastMessage(conflicts: ShiftConflict[], context: 'bulk' | 'assign' | 'reassign') {
  const primary = conflicts[0];
  if (!primary) {
    return 'A shift overlap was detected. Please review the roster before continuing.';
  }

  if (primary.reason === 'duplicate') {
    return primary.conflictingShiftId
      ? `A matching shift already exists for ${primary.employeeName}. Change the site, post, or time.`
      : `${primary.employeeName} already has a matching shift saved.`;
  }

  if (primary.source === 'generated') {
    return `This bulk roster creates a real overlap for ${primary.employeeName}. Adjust the pattern or dates before saving.`;
  }

  if (context === 'reassign') {
    return primary.conflictingShiftId
      ? `This reassignment creates a real overlap for ${primary.employeeName}. It is not a handover.`
      : `${primary.employeeName} already has another shift during this time.`;
  }

  if (context === 'assign') {
    return primary.conflictingShiftId
      ? `This assignment creates a real overlap for ${primary.employeeName}. It is not a handover.`
      : `${primary.employeeName} already has another shift during this time.`;
  }

  return primary.conflictingShiftId
    ? `This bulk roster creates a real overlap for ${primary.employeeName}.`
    : `${primary.employeeName} already has another shift during this time.`;
}

function workflowBadge(status: ShiftWorkflowStatus) {
  switch (status) {
    case 'draft':
      return 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300';
    case 'published':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300';
    case 'acknowledged':
      return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300';
    case 'checked_in':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300';
    case 'completed':
      return 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300';
    case 'exception':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300';
    case 'no_show':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function coverageColor(coverage: number) {
  if (coverage >= 100) return 'bg-emerald-500';
  if (coverage >= 75) return 'bg-blue-500';
  if (coverage >= 50) return 'bg-amber-500';
  return 'bg-rose-500';
}

function coverageTextColor(coverage: number) {
  if (coverage >= 100) return 'text-emerald-500';
  if (coverage >= 75) return 'text-blue-500';
  if (coverage >= 50) return 'text-amber-500';
  return 'text-rose-500';
}

function DraggableSuggestion({
  suggestion,
  guardName,
  selected,
  onSelect,
  onAssign,
}: {
  suggestion: GuardSuggestion;
  guardName: string;
  selected: boolean;
  onSelect: () => void;
  onAssign: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `guard:${suggestion.guard.id}`,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.65 : 1,
      }}
      className={`rounded-2xl border p-3 transition-all ${
        selected
          ? 'border-brand-purple bg-brand-purple/5'
          : 'border-gray-200 bg-white hover:border-brand-purple/30 dark:border-white/10 dark:bg-dark-surface'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-purple/10 text-xs font-black text-brand-purple">
              {guardName.slice(0, 2)?.toUpperCase() || 'NA'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{guardName}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                Score {Math.round(suggestion.score)} - {Math.round(suggestion.projected_weekly_hours)}h projected
              </p>
            </div>
          </div>
        </button>
        <button
          {...attributes}
          {...listeners}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-brand-purple dark:hover:bg-white/10"
          title="Drag onto an open slot or assigned shift"
        >
          <GripVertical size={16} />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${suggestion.psra_ready ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'}`}>
          {suggestion.psra_ready ? 'PSRA ready' : 'PSRA missing'}
        </span>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${suggestion.rest_compliant ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'}`}>
          {suggestion.rest_compliant ? 'Rest okay' : 'Rest risk'}
        </span>
        <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase text-gray-700 dark:bg-white/10 dark:text-gray-300">
          {suggestion.availability_match}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{suggestion.rationale.slice(0, 2).join(' ')}</p>
        <button onClick={onAssign} className="rounded-xl bg-brand-purple px-3 py-2 text-xs font-bold text-white">
          Assign
        </button>
      </div>
    </div>
  );
}

function getReleaverDisplayName(shift: Pick<SecurityShift, 'replacement_id' | 'replacement_name_snapshot'>) {
  return shift.replacement_name_snapshot || (shift.replacement_id ? 'Off-duty releaver' : '');
}

function DroppableCoverageSlot({
  slot,
  selected,
  onSelect,
  children,
}: {
  slot: DispatchSlot;
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `slot:${slot.id}` });
  const coverage = Math.min(100, Math.round((slot.assigned_shifts.length / Math.max(1, slot.required_guards)) * 100));

  return (
    <div
      ref={setNodeRef}
      onClick={onSelect}
      className={`rounded-2xl border p-3 transition-all ${
        isOver || selected
          ? 'border-brand-purple bg-brand-purple/5'
          : 'border-gray-200 bg-white dark:border-white/10 dark:bg-dark-surface'
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-gray-400">{slot.bucket} shift</p>
          <p className="text-sm font-bold">{formatShiftTimeRange(slot)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-black uppercase tracking-widest text-gray-400">Coverage</p>
          <p className="text-sm font-bold">{slot.assigned_shifts.length}/{slot.required_guards}</p>
        </div>
      </div>
      <div className="mb-3 h-2 rounded-full bg-gray-100 dark:bg-white/10">
        <div className={`h-2 rounded-full ${coverageColor(coverage)}`} style={{ width: `${coverage}%` }} />
      </div>
      {children}
    </div>
  );
}

function ShiftDropCard({
  shift,
  guardName,
  attendance,
  onNotify,
  onWorkflow,
  onException,
  onDelete,
  onSelect,
}: {
  shift: SecurityShift;
  guardName: string;
  attendance: AttendanceRecord[];
  onNotify: () => void;
  onWorkflow: (status: ShiftWorkflowStatus) => void;
  onException: () => void;
  onDelete: () => void;
  onSelect: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `shift:${shift.id}` });
  const workflow = resolveWorkflowStatus(shift);
  const dueSoon = isShiftDueSoon(shift);
  const lateRisk = isLateRisk(shift, attendance);
  const checkInTime = formatCheckInTime(shift.checked_in_at);

  return (
    <div
      ref={setNodeRef}
      onClick={onSelect}
      className={`rounded-xl border p-3 ${isOver ? 'border-brand-purple bg-brand-purple/5' : 'border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-dark-bg'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate text-sm font-bold">{guardName}</p>
            {getReleaverBadge(shift)}
          </div>
          {shift.replacement_id && (
            <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-gray-500">
              {getReleaverDisplayName(shift)}
            </p>
          )}
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{formatShiftTimeRange(shift)}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${workflowBadge(workflow)}`}>{workflow.replace('_', ' ')}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {shift.notified_at && <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-bold uppercase text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">Notified</span>}
        {shift.checked_in_at && <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">Reported on duty{checkInTime ? ` ${checkInTime}` : ''}</span>}
        {dueSoon && <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">Due in 2h</span>}
        {lateRisk && <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold uppercase text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">Late risk</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={(e) => { e.stopPropagation(); onNotify(); }} className="rounded-lg border border-gray-200 px-2 py-1 text-[10px] font-bold uppercase dark:border-white/10">
          Notify
        </button>
        {workflow === 'draft' && <button onClick={(e) => { e.stopPropagation(); onWorkflow('published'); }} className="rounded-lg border border-gray-200 px-2 py-1 text-[10px] font-bold uppercase dark:border-white/10">Publish</button>}
        {workflow === 'published' && <button onClick={(e) => { e.stopPropagation(); onWorkflow('acknowledged'); }} className="rounded-lg border border-gray-200 px-2 py-1 text-[10px] font-bold uppercase dark:border-white/10">Acknowledge</button>}
        {(workflow === 'published' || workflow === 'acknowledged') && <button onClick={(e) => { e.stopPropagation(); onWorkflow('checked_in'); }} className="rounded-lg border border-gray-200 px-2 py-1 text-[10px] font-bold uppercase dark:border-white/10">Check in</button>}
        {workflow === 'checked_in' && <button onClick={(e) => { e.stopPropagation(); onWorkflow('completed'); }} className="rounded-lg border border-gray-200 px-2 py-1 text-[10px] font-bold uppercase dark:border-white/10">Complete</button>}
        <button onClick={(e) => { e.stopPropagation(); onException(); }} className="rounded-lg border border-rose-200 px-2 py-1 text-[10px] font-bold uppercase text-rose-600 dark:border-rose-500/30 dark:text-rose-300">
          Exception
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="rounded-lg border border-rose-200 px-2 py-1 text-[10px] font-bold uppercase text-rose-600 dark:border-rose-500/30 dark:text-rose-300">
          Delete
        </button>
      </div>
    </div>
  );
}

const RosterManagement: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sites, setSites] = useState<SecuritySite[]>([]);
  const [posts, setPosts] = useState<SecurityPost[]>([]);
  const [centres, setCentres] = useState<SecurityCentre[]>([]);
  const [employees, setEmployees] = useState<SecurityGuard[]>([]);
  const [archivedGuards, setArchivedGuards] = useState<ArchivedSecurityGuard[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [shifts, setShifts] = useState<SecurityShift[]>([]);
  const [availability, setAvailability] = useState<GuardAvailability[]>([]);
  const [requests, setRequests] = useState<RosterRequest[]>([]);
  const [versions, setVersions] = useState<RosterVersion[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  const [filter, setFilter] = useState<RosterFilters>(initialFilters);
  const [savedPresets, setSavedPresets] = useState<RosterSavedPreset[]>([]);
  const [viewMode, setViewMode] = useState<'board' | 'table'>('table');
  const [workspaceMode, setWorkspaceMode] = useState<RosterWorkspaceMode>('plan');
  const [boardDate, setBoardDate] = useState(todayKey);
  const [boardBucket, setBoardBucket] = useState<BoardShiftBucket>('all');
  const [workflowFilter, setWorkflowFilter] = useState<'all' | ShiftWorkflowStatus>('all');
  const [selectedSlot, setSelectedSlot] = useState<DispatchSlot | null>(null);
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [auditTrail, setAuditTrail] = useState<RosterAuditLogEntry[]>([]);
  const [stats, setStats] = useState<RosterStats>(emptyStats);
  const [collapsedGuardCards, setCollapsedGuardCards] = useState<Record<string, boolean>>({});
  const [rosterPage, setRosterPage] = useState(1);
  const [rosterPageSize, setRosterPageSize] = useState(6);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [shiftEditDraft, setShiftEditDraft] = useState<{
    shift: SecurityShift;
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
  } | null>(null);
  const [bulkCentreId, setBulkCentreId] = useState('');
  const [bulkAssignmentRows, setBulkAssignmentRows] = useState<BulkAssignmentRow[]>([createBulkAssignmentRow()]);
  const [bulkData, setBulkData] = useState<BulkShiftFormData>(initialBulkData);
  const [previewState, setPreviewState] = useState<RosterPreviewState | null>(null);
  const [bulkCsvError, setBulkCsvError] = useState<string | null>(null);
  const [mobileWizardStep, setMobileWizardStep] = useState<MobileBulkWizardStep>('setup');
  const [auditActionFilter, setAuditActionFilter] = useState<'all' | RosterAuditLogEntry['action']>('all');
  const [auditSiteFilter, setAuditSiteFilter] = useState('all');
  const [auditGuardFilter, setAuditGuardFilter] = useState('all');
  const [deleteConfirm, setDeleteConfirm] = useState<{ shiftIds: string[]; label: string } | null>(null);
  const [presetName, setPresetName] = useState('');
  const [publishReason, setPublishReason] = useState('');
  const [exceptionDraft, setExceptionDraft] = useState<{ shift: SecurityShift; status: string; notes: string } | null>(null);
  const isWorkbenchPage = location.pathname.endsWith('/workbench');
  const bulkRowGuardRefs = useRef<(HTMLSelectElement | null)[]>([]);
  const pendingBulkRowFocusIndex = useRef<number | null>(null);
  const [draggingBulkRowIndex, setDraggingBulkRowIndex] = useState<number | null>(null);
  const bulkCsvInputRef = useRef<HTMLInputElement | null>(null);
  const closeWorkbench = () => {
    if (isWorkbenchPage) {
      navigate('/app/security/roster', { replace: true });
      return;
    }
    setShowBulkModal(false);
    setPreviewState(null);
    setBulkCsvError(null);
    setMobileWizardStep('setup');
  };

  const normalizeComposerRow = (row: Partial<BulkAssignmentRow> = {}): BulkAssignmentRow => ({
    employee_id: row.employee_id || bulkData.employee_id || '',
    centre_id: row.centre_id || bulkCentreId || '',
    site_id: row.site_id || bulkData.site_id || '',
    post_id: row.post_id || bulkData.post_id || '',
    replacement_id: row.replacement_id || bulkData.replacement_id || '',
    start_date: row.start_date || bulkData.start_date || todayKey,
    end_date: row.end_date || bulkData.end_date || todayKey,
    start_time: row.start_time || bulkData.start_time || '06:00',
    end_time: row.end_time || bulkData.end_time || '18:00',
    notes: row.notes || bulkData.notes || '',
  });

  const syncBulkAssignmentRows = (nextRows: BulkAssignmentRow[]) => {
    const normalizedRows = nextRows.length > 0 ? nextRows : [createBulkAssignmentRow()];
    const selectedIds = normalizedRows.map((row) => row.employee_id).filter(Boolean);
    setBulkAssignmentRows(normalizedRows);
    setBulkData((current) => ({
      ...current,
      start_date: normalizedRows[0]?.start_date || current.start_date,
      end_date: normalizedRows[0]?.end_date || current.end_date,
      start_time: normalizedRows[0]?.start_time || current.start_time,
      end_time: normalizedRows[0]?.end_time || current.end_time,
      replacement_id: normalizedRows[0]?.replacement_id || current.replacement_id,
      notes: normalizedRows[0]?.notes || current.notes,
      employee_ids: selectedIds,
      employee_id: selectedIds[0] || '',
    }));
    setPreviewState(null);
  };

  useEffect(() => {
    const targetIndex = pendingBulkRowFocusIndex.current;
    if (targetIndex === null) return;

    const raf = window.requestAnimationFrame(() => {
      const target = bulkRowGuardRefs.current[targetIndex];
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.focus({ preventScroll: true });
      }
      pendingBulkRowFocusIndex.current = null;
    });

    return () => window.cancelAnimationFrame(raf);
  }, [bulkAssignmentRows.length, showBulkModal]);

  useEffect(() => {
    let active = true;
    void fetchInitialData(active);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isWorkbenchPage) return;
    setWorkspaceMode('plan');
    setMobileWizardStep('setup');
    setPreviewState(null);
    setSelectedSlot(null);
    setBulkCentreId('');
    setBulkCsvError(null);
    setBulkData(initialBulkData);
    setBulkAssignmentRows([createBulkAssignmentRow()]);
    setShowBulkModal(true);
  }, [isWorkbenchPage]);

  useEffect(() => {
    const view = searchParams.get('view');
    const date = searchParams.get('date');
    const employeeId = searchParams.get('employee_id');
    const siteId = searchParams.get('site_id');
    const bucket = searchParams.get('bucket');

    if (view === 'board' || view === 'table') {
      setViewMode(view);
    }
    if (date && date !== boardDate) {
      setBoardDate(date);
    }
    if (employeeId && employeeId !== filter.employee_id) {
      setFilter((current) => ({ ...current, employee_id: employeeId }));
    }
    if (siteId && siteId !== filter.site_id) {
      setFilter((current) => ({ ...current, site_id: siteId }));
    }
    if (bucket === 'day' || bucket === 'night' || bucket === 'all') {
      setBoardBucket(bucket);
    }
  }, [boardDate, filter.employee_id, filter.site_id, searchParams]);

  useEffect(() => {
    if (showBulkModal) {
      setMobileWizardStep('setup');
    }
  }, [showBulkModal, workspaceMode]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(savedPresetsStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as RosterSavedPreset[];
      if (Array.isArray(parsed)) {
        setSavedPresets(parsed.slice(0, 8));
      }
    } catch {
      setSavedPresets([]);
    }
  }, []);

  useEffect(() => {
    const cached = getCachedRosterBootstrapData();
    if (!cached) return;
    setCentres(cached.centres);
    setSites(cached.sites);
    setPosts(cached.posts);
    setEmployees(cached.guards);
    setAttendance(cached.attendance);
    setShifts(cached.shifts);
    setStats({
      ...calculateRosterStats(cached.shifts),
      totalGuards: cached.guards.length,
    });
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(savedPresetsStorageKey, JSON.stringify(savedPresets.slice(0, 8)));
    } catch {
      // Ignore storage write failures.
    }
  }, [savedPresets]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(rosterComposerDraftStorageKey);
      if (!raw) return;

      const parsed = JSON.parse(raw) as {
        workspaceMode?: RosterWorkspaceMode;
        bulkCentreId?: string;
        bulkData?: Partial<BulkShiftFormData>;
        bulkAssignmentRows?: Partial<BulkAssignmentRow>[];
        mobileWizardStep?: MobileBulkWizardStep;
        showBulkModal?: boolean;
      };

      if (!parsed || !Array.isArray(parsed.bulkAssignmentRows)) return;

      const restoredBulkData = { ...initialBulkData, ...(parsed.bulkData || {}) } as BulkShiftFormData;
      const restoredRows = parsed.bulkAssignmentRows.map((row) => normalizeComposerRow(row));

      setWorkspaceMode(parsed.workspaceMode === 'assign' ? 'assign' : 'plan');
      setBulkCentreId(typeof parsed.bulkCentreId === 'string' ? parsed.bulkCentreId : '');
      setBulkData(restoredBulkData);
      setBulkAssignmentRows(restoredRows.length > 0 ? restoredRows : [createBulkAssignmentRow()]);
      setMobileWizardStep(parsed.mobileWizardStep === 'guards' || parsed.mobileWizardStep === 'review' ? parsed.mobileWizardStep : 'setup');
      setShowBulkModal(parsed.showBulkModal !== false);
    } catch {
      try {
        window.localStorage.removeItem(rosterComposerDraftStorageKey);
      } catch {
        // Ignore storage cleanup failures.
      }
    }
  }, []);

  useEffect(() => {
    try {
      const hasComposerContent =
        showBulkModal &&
        Boolean(
          bulkCentreId ||
            bulkData.site_id ||
            bulkData.post_id ||
            bulkData.employee_id ||
            bulkData.employee_ids.length > 0 ||
            bulkData.replacement_id ||
            bulkData.notes ||
            bulkAssignmentRows.some((row) =>
              Boolean(
                row.employee_id ||
                  row.centre_id ||
                  row.site_id ||
                  row.post_id ||
                  row.replacement_id ||
                  row.start_date ||
                  row.end_date ||
                  row.start_time ||
                  row.end_time ||
                  row.notes,
              ),
            ),
        );

      if (!hasComposerContent) {
        window.localStorage.removeItem(rosterComposerDraftStorageKey);
        return;
      }

      window.localStorage.setItem(
        rosterComposerDraftStorageKey,
        JSON.stringify({
          workspaceMode,
          bulkCentreId,
          bulkData,
          bulkAssignmentRows,
          mobileWizardStep,
          showBulkModal,
        }),
      );
    } catch {
      // Ignore storage write failures.
    }
  }, [bulkAssignmentRows, bulkCentreId, bulkData, mobileWizardStep, showBulkModal, workspaceMode]);

  const fetchInitialData = async (active = true) => {
    if (active) {
      setLoading(true);
      setPageError(null);
    }
    try {
      const [bootstrapResult, metaResult, auditResult] = await Promise.allSettled([
        fetchRosterBootstrapData(),
        fetchRosterOperationsMeta(),
        fetchRosterAuditTrail(),
      ]);
      if (!active) return;

      if (bootstrapResult.status === 'fulfilled') {
        const bootstrap = bootstrapResult.value;
        setCentres(bootstrap.centres);
        setSites(bootstrap.sites);
        setPosts(bootstrap.posts);
        setEmployees(bootstrap.guards);
        setArchivedGuards(bootstrap.archivedGuards || []);
        setAttendance(bootstrap.attendance);
        setShifts(bootstrap.shifts);
        setStats({
          ...calculateRosterStats(bootstrap.shifts),
          totalGuards: bootstrap.guards.length,
        });
      } else {
        const message = sanitizeError(bootstrapResult.reason);
        console.warn('Roster bootstrap partially failed:', message);
        setToast({ message, type: 'error' });
      }

      if (metaResult.status === 'fulfilled') {
        const meta = metaResult.value;
        setAvailability(meta.availability);
        setRequests(meta.requests);
        setVersions(meta.versions);
        setTemplates(meta.templates);
      } else {
        console.warn('Roster metadata failed to load:', sanitizeError(metaResult.reason));
      }

      if (auditResult.status === 'fulfilled') {
        setAuditTrail(auditResult.value);
      } else {
        console.warn('Roster audit trail failed to load:', sanitizeError(auditResult.reason));
      }
    } catch (error) {
      if (!active || isAbortError(error)) {
        return;
      }
      const message = sanitizeError(error);
      setPageError(message);
      setToast({ message, type: 'error' });
    } finally {
      if (active) {
        setLoading(false);
      }
    }
  };

  const refreshRoster = async () => {
    const [shiftsResult, metaResult, auditResult] = await Promise.allSettled([
      fetchRosterShifts(),
      fetchRosterOperationsMeta(),
      fetchRosterAuditTrail(),
    ]);

    if (shiftsResult.status === 'fulfilled') {
      const freshShifts = shiftsResult.value;
      setShifts(freshShifts);
      setStats({
        ...calculateRosterStats(freshShifts),
        totalGuards: employees.length,
      });
    }

    if (metaResult.status === 'fulfilled') {
      const meta = metaResult.value;
      setAvailability(meta.availability);
      setRequests(meta.requests);
      setVersions(meta.versions);
      setTemplates(meta.templates);
    }

    if (auditResult.status === 'fulfilled') {
      setAuditTrail(auditResult.value);
    }

    if (shiftsResult.status !== 'fulfilled') {
      throw shiftsResult.reason;
    }

    return shiftsResult.value;
  };

  const focusRosterOnShifts = (createdShifts: Pick<SecurityShift, 'start_time'>[]) => {
    const firstShift = createdShifts[0];
    if (!firstShift) {
      return;
    }

    setFilter(initialFilters);
    setWorkflowFilter('all');
    setBoardBucket('all');
    setBoardDate(toIsoDateKey(firstShift.start_time));
    setSelectedSlot(null);
  };

  const openComposer = (scope: 'single' | 'bulk', slot?: DispatchSlot, guardId?: string) => {
    setWorkspaceMode(scope === 'single' ? 'assign' : 'plan');
    setPreviewState(null);
    setSelectedSlot(slot || null);
    setBulkCsvError(null);
    setShowBulkModal(true);

    if (slot) {
      const defaultGuardId = guardId || slot.assigned_shifts[0]?.employee_id || selectedSuggestion?.guard.id || '';
      setBulkCentreId(sites.find((site) => site.id === slot.site_id)?.centre_id || '');
      setBulkData({
        ...initialBulkData,
        site_id: slot.site_id,
        post_id: slot.post_id || '',
        employee_id: defaultGuardId,
        employee_ids: defaultGuardId ? [defaultGuardId] : [],
        start_date: toIsoDateKey(slot.start_time),
        end_date: toIsoDateKey(slot.start_time),
        start_time: new Date(slot.start_time).toTimeString().slice(0, 5),
        end_time: new Date(slot.end_time).toTimeString().slice(0, 5),
        replacement_id: '',
        notes: `Shift workbench draft for ${slot.site_name} / ${slot.post_name}`,
      });
      setBulkAssignmentRows([
        createBulkAssignmentRow({
          employee_id: defaultGuardId,
          centre_id: sites.find((site) => site.id === slot.site_id)?.centre_id || '',
          site_id: slot.site_id,
          post_id: slot.post_id || '',
          replacement_id: '',
          start_date: toIsoDateKey(slot.start_time),
          end_date: toIsoDateKey(slot.start_time),
          start_time: new Date(slot.start_time).toTimeString().slice(0, 5),
          end_time: new Date(slot.end_time).toTimeString().slice(0, 5),
          notes: `Shift workbench draft for ${slot.site_name} / ${slot.post_name}`,
        }),
      ]);
      return;
    }

    setBulkCentreId('');
    setBulkData(initialBulkData);
    setBulkAssignmentRows([createBulkAssignmentRow()]);
  };

  const updateBulkAssignmentRow = (index: number, updates: Partial<BulkAssignmentRow>) => {
    const nextRows = bulkAssignmentRows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...updates } : row));
    syncBulkAssignmentRows(nextRows);
  };

  const addBulkAssignmentRow = () => {
    pendingBulkRowFocusIndex.current = bulkAssignmentRows.length;
    syncBulkAssignmentRows([
      ...bulkAssignmentRows,
      createBulkAssignmentRow({
        centre_id: bulkCentreId,
        site_id: bulkData.site_id,
        post_id: bulkData.post_id,
        replacement_id: bulkData.replacement_id || '',
        start_date: bulkData.start_date,
        end_date: bulkData.end_date,
        start_time: bulkData.start_time,
        end_time: bulkData.end_time,
        notes: bulkData.notes,
      }),
    ]);
  };

  const removeBulkAssignmentRow = (index: number) => {
    const nextRows = bulkAssignmentRows.filter((_, rowIndex) => rowIndex !== index);
    syncBulkAssignmentRows(nextRows);
  };

  const duplicateBulkAssignmentRow = (index: number) => {
    const source = bulkAssignmentRows[index];
    if (!source) return;
    pendingBulkRowFocusIndex.current = bulkAssignmentRows.length;
    syncBulkAssignmentRows([
      ...bulkAssignmentRows,
      {
        ...source,
        employee_id: '',
      },
    ]);
  };

  const moveBulkAssignmentRow = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= bulkAssignmentRows.length || fromIndex === toIndex) {
      return;
    }
    const nextRows = [...bulkAssignmentRows];
    const [moved] = nextRows.splice(fromIndex, 1);
    nextRows.splice(toIndex, 0, moved);
    syncBulkAssignmentRows(nextRows);
  };

  const importBulkCsv = async (file: File) => {
    const text = await file.text();
    const [headerLine, ...lines] = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (!headerLine || lines.length === 0) {
      throw new Error('The CSV file is empty.');
    }

    const headers = headerLine.split(',').map((item) => item.trim().toLowerCase());
    const nextRows = lines.map((line) => {
      const values = line.split(',').map((item) => item.trim());
      const row = createBulkAssignmentRow();
      headers.forEach((header, index) => {
        const value = values[index] || '';
        switch (header) {
          case 'branch':
          case 'centre':
          case 'center':
          case 'branch_id':
          case 'centre_id':
            row.centre_id = value;
            break;
          case 'site':
          case 'site_id':
            row.site_id = value;
            break;
          case 'post':
          case 'post_id':
            row.post_id = value;
            break;
          case 'guard':
          case 'guard_id':
          case 'employee':
          case 'employee_id':
            row.employee_id = value;
            break;
          case 'replacement':
          case 'replacement_id':
            row.replacement_id = value;
            break;
          case 'start_date':
            row.start_date = value;
            break;
          case 'end_date':
            row.end_date = value;
            break;
          case 'start_time':
            row.start_time = value;
            break;
          case 'end_time':
            row.end_time = value;
            break;
          case 'notes':
            row.notes = value;
            break;
          default:
            break;
        }
      });
      return row;
    });

    syncBulkAssignmentRows(nextRows.length > 0 ? nextRows : [createBulkAssignmentRow()]);
    setBulkCsvError(null);
  };

  const getBulkRowValidation = (row: BulkAssignmentRow) => {
    const issues: string[] = [];
    if (!row.centre_id && !bulkCentreId) issues.push('branch');
    if (!row.site_id && !bulkData.site_id) issues.push('site');
    if (!row.post_id && !bulkData.post_id) issues.push('post');
    if (!row.employee_id) issues.push('guard');
    if (!row.start_date && !bulkData.start_date) issues.push('start date');
    if (!row.end_date && !bulkData.end_date) issues.push('end date');
    if (!row.start_time && !bulkData.start_time) issues.push('start time');
    if (!row.end_time && !bulkData.end_time) issues.push('end time');
    return issues;
  };

  const getComposerDraftRows = () => {
    const normalizedRows = bulkAssignmentRows.map((row) => normalizeComposerRow(row));

    if (workspaceMode === 'assign') {
      const firstPopulatedRow =
        normalizedRows.find(
          (row) =>
            row.employee_id ||
            row.centre_id ||
            row.site_id ||
            row.post_id ||
            row.replacement_id ||
            row.start_date ||
            row.end_date ||
            row.start_time ||
            row.end_time ||
            row.notes,
        ) || normalizeComposerRow();
      return [firstPopulatedRow];
    }

    return normalizedRows.length > 0 ? normalizedRows : [normalizeComposerRow()];
  };

  const buildComposerDrafts = () => {
    const selectedRows = getComposerDraftRows();
    const assignedRows = selectedRows.filter((row) => row.employee_id);
    const guardLookup = new Map(employees.map((guard) => [guard.id, guard.full_name || ''] as const));
    const drafts: GeneratedShiftDraft[] = [];
    for (const row of assignedRows) {
      const employeeId = row.employee_id || bulkData.employee_id;
      const siteId = row.site_id || bulkData.site_id;
      const postId = row.post_id || bulkData.post_id || null;
      const rowStartDate = row.start_date || bulkData.start_date;
      const rowEndDate = row.end_date || bulkData.end_date;
      const rowStartTime = row.start_time || bulkData.start_time;
      const rowEndTime = row.end_time || bulkData.end_time;
      const rowReplacementId = row.replacement_id || bulkData.replacement_id || null;
      const rowNotes = row.notes.trim() || bulkData.notes.trim() || null;

      if (!siteId) {
        continue;
      }
      if (!rowStartDate || !rowEndDate) {
        throw new Error('Start date and end date are required for each guard row.');
      }

      const rowStart = new Date(`${rowStartDate}T00:00:00`);
      const rowEnd = new Date(`${rowEndDate}T00:00:00`);
      if (Number.isNaN(rowStart.getTime()) || Number.isNaN(rowEnd.getTime())) {
        throw new Error('Please provide valid dates for each guard row.');
      }
      if (rowEnd < rowStart) {
        throw new Error('End date cannot be earlier than the start date.');
      }

      const rowCursor = new Date(rowStart);
      while (rowCursor <= rowEnd) {
        const rowDay = rowCursor.getDay();
        const include =
          bulkData.pattern === 'daily' ||
          (bulkData.pattern === 'weekdays' && rowDay >= 1 && rowDay <= 5) ||
          (bulkData.pattern === 'weekends' && (rowDay === 0 || rowDay === 6));

        if (include) {
          const rowDateKey = toIsoDateKey(rowCursor);
          drafts.push(
            buildSiteShiftDraft(
              {
                site_id: siteId,
                post_id: postId,
                employee_id: employeeId,
                replacement_id: rowReplacementId,
                shift_kind: new Date(`${rowDateKey}T${rowStartTime}:00`).getHours() >= 18 ? 'night' : 'day',
                shift_date: rowDateKey,
                start_time: rowStartTime,
                end_time: rowEndTime,
                notes: rowNotes || undefined,
              },
              guardLookup.get(employeeId) || null,
              rowReplacementId ? guardLookup.get(rowReplacementId) || null : null
            )
          );
        }

        rowCursor.setDate(rowCursor.getDate() + 1);
      }
    }

    if (drafts.length === 0) {
      throw new Error('Choose at least one guard and one site before saving.');
    }

    return drafts;
  };

  const buildComposerPreview = async () => {
    const generatedShifts = buildComposerDrafts();
    const conflicts = await findShiftConflicts(generatedShifts, employees);
    const selectedRows = getComposerDraftRows();

    return {
      label: workspaceMode === 'assign' ? 'Single shift assignment' : 'Bulk shift generation',
      generatedShifts,
      conflicts,
      totalSelectedGuards: selectedRows.map((row) => row.employee_id).filter(Boolean).length,
      affectedSites: [...new Set(generatedShifts.map((shift) => shift.site_id))],
      affectedPosts: [...new Set(generatedShifts.map((shift) => shift.post_id || ''))].filter(Boolean),
    };
  };

  const getComposerSlotKey = (slot: Pick<DispatchSlot, 'site_id' | 'post_id' | 'start_time' | 'end_time'>) =>
    `${slot.site_id}|${slot.post_id || ''}|${slot.start_time}|${slot.end_time}`;

  const buildDraftGuardNameLookup = (drafts: GeneratedShiftDraft[]) => {
    const lookup: Record<string, string> = {};

    drafts.forEach((draft) => {
      const key = `${draft.site_id}|${draft.post_id || ''}|${draft.start_time}|${draft.end_time}`;
      const displayName = draft.employee_name_snapshot || guardDirectory.get(draft.employee_id) || draft.employee_id;
      if (!displayName) return;
      lookup[key] = lookup[key] ? `${lookup[key]}, ${displayName}` : displayName;
    });

    return lookup;
  };

  const reviewComposerChanges = async () => {
    setBusyAction('review-composer');
    try {
      const preview = await buildComposerPreview();
      setPreviewState(preview);
      return preview.conflicts.length === 0;
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
      return false;
    } finally {
      setBusyAction(null);
    }
  };

  const saveComposerChanges = async (preview = previewState) => {
    if (!preview) {
      setToast({ message: 'Review the composer changes before saving.', type: 'warning' });
      return;
    }
    if (preview.conflicts.length > 0) {
      setToast({ message: 'Resolve the detected conflicts before saving this roster draft.', type: 'error' });
      return;
    }

    setBusyAction('save-composer');
    try {
      const createdShifts = await createBulkShifts(preview.generatedShifts);
      setShifts((current) => {
        const existingIds = new Set(createdShifts.map((shift) => shift.id));
        const nextShifts = [...createdShifts, ...current.filter((shift) => !existingIds.has(shift.id))];
        setStats({ ...calculateRosterStats(nextShifts), totalGuards: employees.length });
        return nextShifts;
      });
      focusRosterOnShifts(createdShifts);
      void refreshRoster();
      setShowBulkModal(false);
      setPreviewState(null);
      setBulkData(initialBulkData);
      setBulkCentreId('');
      setBulkAssignmentRows([createBulkAssignmentRow()]);
      setSelectedSlot(null);
      try {
        window.localStorage.removeItem(rosterComposerDraftStorageKey);
      } catch {
        // Ignore storage cleanup failures.
      }
      setToast({
        message: `${createdShifts.length} shift${createdShifts.length === 1 ? '' : 's'} saved as drafts. Publish later to notify guards by SMS and email.`,
        type: 'success',
      });
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

  const submitComposerChanges = async () => {
    if (previewState) {
      await saveComposerChanges(previewState);
      return;
    }

    setBusyAction('review-composer');
    try {
      const preview = await buildComposerPreview();
      setPreviewState(preview);
      if (preview.conflicts.length === 0) {
        await saveComposerChanges(preview);
      }
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) {
      setToast({ message: 'Name this filter preset before saving it.', type: 'warning' });
      return;
    }

    const nextPreset: RosterSavedPreset = {
      name,
      filters: { ...filter },
      boardDate,
      boardBucket,
      workflowFilter,
      workspaceMode,
    };

    setSavedPresets((current) => [nextPreset, ...current.filter((preset) => preset.name !== name)].slice(0, 8));
    setPresetName('');
    setToast({ message: `Saved preset "${name}"`, type: 'success' });
  };

  const applyPreset = (preset: RosterSavedPreset) => {
    setFilter({ ...preset.filters });
    setBoardDate(preset.boardDate);
    setBoardBucket(preset.boardBucket);
    setWorkflowFilter(preset.workflowFilter);
    setWorkspaceMode(preset.workspaceMode);
    setPreviewState(null);
    setToast({ message: `Applied preset "${preset.name}"`, type: 'success' });
  };

  const requestDeleteShifts = (shiftIds: string[], label: string) => {
    if (shiftIds.length === 0) return;
    setDeleteConfirm({ shiftIds, label });
  };

  const executeDeleteShifts = async (shiftIds: string[]) => {
    if (shiftIds.length === 0) return;
    const publishedCount = shifts.filter((shift) => shiftIds.includes(shift.id) && resolveWorkflowStatus(shift) !== 'draft').length;

    setBusyAction(`delete-${shiftIds[0]}`);
    try {
      await deleteShifts(shiftIds);
      await refreshRoster();
      setSelectedSlot((current) => (current && current.assigned_shifts.some((shift) => shiftIds.includes(shift.id)) ? null : current));
      setExceptionDraft((current) => (current && shiftIds.includes(current.shift.id) ? null : current));
      setToast({
        message:
          publishedCount > 0
            ? shiftIds.length === 1
              ? 'Published shift deleted from the workbench'
              : `${publishedCount} published shifts and ${shiftIds.length - publishedCount} draft shifts deleted`
            : shiftIds.length === 1
              ? 'Shift deleted'
              : `${shiftIds.length} shifts deleted`,
        type: 'success',
      });
    } catch (error) {
      if (isAbortError(error)) return;
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

  const openShiftEditDraft = (shift: SecurityShift) => {
    setShiftEditDraft({
      shift,
      siteId: shift.site_id,
      postId: shift.post_id || '',
      guardId: shift.employee_id,
      replacementId: shift.replacement_id || '',
      shiftKind: shift.shift_kind || 'custom',
      startDate: toIsoDateKey(shift.start_time),
      endDate: toIsoDateKey(shift.end_time),
      startTime: new Date(shift.start_time).toTimeString().slice(0, 5),
      endTime: new Date(shift.end_time).toTimeString().slice(0, 5),
      workflowStatus: resolveWorkflowStatus(shift),
      notes: shift.notes || '',
    });
  };

  const handleSaveShiftEdit = async () => {
    if (!shiftEditDraft) return;
    if (!shiftEditDraft.guardId) {
      setToast({ message: 'Choose a guard before saving the edit.', type: 'warning' });
      return;
    }
    if (!shiftEditDraft.siteId) {
      setToast({ message: 'Choose a site before saving the edit.', type: 'warning' });
      return;
    }

    const { shift } = shiftEditDraft;
    const editedShift = buildSiteShiftDraft(
      {
        site_id: shiftEditDraft.siteId,
        post_id: shiftEditDraft.postId || null,
        employee_id: shiftEditDraft.guardId,
        replacement_id: shiftEditDraft.replacementId || null,
        shift_kind: shiftEditDraft.shiftKind,
        shift_date: shiftEditDraft.startDate,
        end_date: shiftEditDraft.endDate,
        start_time: shiftEditDraft.startTime,
        end_time: shiftEditDraft.endTime,
        notes: shiftEditDraft.notes,
      },
      employees.find((guard) => guard.id === shiftEditDraft.guardId)?.full_name || null,
      shiftEditDraft.replacementId ? employees.find((guard) => guard.id === shiftEditDraft.replacementId)?.full_name || null : null
    );

    if (
      shift.site_id === shiftEditDraft.siteId &&
      (shift.post_id || '') === shiftEditDraft.postId &&
      shift.employee_id === shiftEditDraft.guardId &&
      (shift.replacement_id || '') === shiftEditDraft.replacementId &&
      toIsoDateKey(shift.start_time) === shiftEditDraft.startDate &&
      toIsoDateKey(shift.end_time) === shiftEditDraft.endDate &&
      new Date(shift.start_time).toTimeString().slice(0, 5) === shiftEditDraft.startTime &&
      new Date(shift.end_time).toTimeString().slice(0, 5) === shiftEditDraft.endTime &&
      (shift.shift_kind || 'custom') === shiftEditDraft.shiftKind &&
      (shift.notes || '') === shiftEditDraft.notes &&
      resolveWorkflowStatus(shift) === shiftEditDraft.workflowStatus
    ) {
      setShiftEditDraft(null);
      return;
    }

    const conflicts = await findShiftConflicts([editedShift], employees, { ignoreShiftIds: [shift.id] });
    if (conflicts.length > 0) {
      setToast({ message: formatConflictToastMessage(conflicts, 'reassign'), type: 'error' });
      return;
    }

    setBusyAction(`edit-${shift.id}`);
    try {
      const updatedShift = await updateShiftDetails(shift, {
        site_id: shiftEditDraft.siteId,
        post_id: shiftEditDraft.postId || null,
        employee_id: shiftEditDraft.guardId,
        replacement_id: shiftEditDraft.replacementId || null,
        shift_kind: shiftEditDraft.shiftKind,
        shift_date: shiftEditDraft.startDate,
        end_date: shiftEditDraft.endDate,
        start_time: shiftEditDraft.startTime,
        end_time: shiftEditDraft.endTime,
        workflow_status: shiftEditDraft.workflowStatus,
        notes: shiftEditDraft.notes,
      });
      setShifts((current) => current.map((item) => (item.id === updatedShift.id ? updatedShift : item)));
      void sendShiftNotification(updatedShift);
      void refreshRoster();
      setShiftEditDraft(null);
      setToast({ message: 'Shift updated and guard notified by email and SMS.', type: 'success' });
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

  const filteredShifts = filterShifts(shifts, filter, new Date(boardDate)).filter((shift) => {
    if (workflowFilter === 'all') {
      return true;
    }
    return resolveWorkflowStatus(shift) === workflowFilter;
  });

  const query = filter.query.trim().toLowerCase();
  const filteredShiftSiteIds = new Set(filteredShifts.map((shift) => shift.site_id));
  const filteredSites = sites.filter((site) => {
    if (filter.branch_id !== 'all' && site.centre_id !== filter.branch_id) return false;
    if (filter.site_id !== 'all' && site.id !== filter.site_id) return false;
    if (filter.county !== 'all' && site.county !== filter.county) return false;
    if (query) {
      const centreName = centres.find((centre) => centre.id === site.centre_id)?.name || '';
      const haystack = `${site.name} ${site.county || ''} ${centreName}`.toLowerCase();
      if (!haystack.includes(query) && !filteredShiftSiteIds.has(site.id)) {
        return false;
      }
    }
    return true;
  });
  const bulkSites = bulkCentreId ? sites.filter((site) => site.centre_id === bulkCentreId) : sites;
  const bulkPosts = posts.filter((post) => post.site_id === bulkData.site_id);
  const filteredPosts = posts.filter((post) => filteredSites.some((site) => site.id === post.site_id));
  const boardData = buildDispatchBoard(filteredSites, filteredPosts, filteredShifts, attendance, boardDate, boardBucket);
  const boardShiftPool = filteredShifts.filter((shift) => {
    if (toIsoDateKey(shift.start_time) !== boardDate) {
      return false;
    }
    if (boardBucket === 'all') {
      return true;
    }
    return matchesShiftBucket(shift, boardBucket);
  });
  const rosterListShifts = viewMode === 'table' ? filteredShifts : boardShiftPool;
  const rosterListOpenSlots = viewMode === 'table' ? [] : boardData.openSlots;
  const guardDirectory = useMemo(() => {
    const directory = new Map<string, string | null>();
    [...employees, ...archivedGuards].forEach((guard) => {
      directory.set(guard.id, guard.full_name || null);
      if ('original_id' in guard && guard.original_id) {
        directory.set(guard.original_id, guard.full_name || null);
      }
    });
    shifts.forEach((shift) => {
      if (shift.employee_name_snapshot && !directory.get(shift.employee_id)) {
        directory.set(shift.employee_id, shift.employee_name_snapshot);
      }
      if (shift.replacement_name_snapshot && shift.replacement_id && !directory.get(shift.replacement_id)) {
        directory.set(shift.replacement_id, shift.replacement_name_snapshot);
      }
    });
    return directory;
  }, [employees, archivedGuards, shifts]);
  const selectedSuggestions =
    selectedSlot ? rankGuardsForSlot(selectedSlot, employees, shifts, availability).slice(0, 8) : [];
  const selectedSuggestion = selectedSuggestions.find((item) => item.guard.id === selectedSuggestionId) || selectedSuggestions[0];
  const assignmentDateKey = selectedSlot ? toIsoDateKey(selectedSlot.start_time) : bulkData.start_date;
  const isGuardScheduledOnDate = (guardId: string, dateKey: string) =>
    shifts.some(
      (shift) =>
        (shift.employee_id === guardId || shift.replacement_id === guardId) &&
        toIsoDateKey(shift.start_time) === dateKey &&
        shift.status !== 'cancelled'
    );
  const getShiftDisplayName = (shift: Pick<SecurityShift, 'employee_id' | 'employee_name_snapshot' | 'profiles'>) =>
    shift.employee_name_snapshot ||
    shift.profiles?.full_name ||
    (shift.employee_id ? guardDirectory.get(shift.employee_id) : null) ||
    (shift.employee_id ? 'Assigned guard' : 'Open Slot');
  const getGuardDisplayName = (guard: Pick<SecurityGuard, 'id' | 'full_name'>) => guard.full_name || guardDirectory.get(guard.id) || 'Unknown guard';
  const shiftEditDateKey = shiftEditDraft ? shiftEditDraft.startDate || toIsoDateKey(shiftEditDraft.shift.start_time) : '';
  const formatGuardCheckInLabel = (shift: SecurityShift) => {
    if (!shift.checked_in_at) {
      return null;
    }

    const time = formatCheckInTime(shift.checked_in_at);
    return `Reported on duty${time ? ` at ${time}` : ''}`;
  };
  const rosterGuardCards = rosterListShifts.reduce<Record<string, {
    guardId: string;
    guardName: string;
    shifts: SecurityShift[];
    totalHours: number;
    siteCount: number;
  }>>((acc, shift) => {
    const guardId = shift.employee_id;
    const guardName = getShiftDisplayName(shift) || 'Assigned guard';
    if (!acc[guardId]) {
      acc[guardId] = {
        guardId,
        guardName,
        shifts: [],
        totalHours: 0,
        siteCount: 0,
      };
    }
    acc[guardId].shifts.push(shift);
    acc[guardId].totalHours += getShiftHours(shift);
    acc[guardId].siteCount = new Set(acc[guardId].shifts.map((item) => item.site_id)).size;
    return acc;
  }, {});
  const rosterGuardCardsList = Object.values(rosterGuardCards).sort((a, b) => a.guardName.localeCompare(b.guardName));
  const weeklyHoursBreakdown = employees
    .map((guard) => ({
      guard,
      hours: getWeeklyHoursForGuard(guard.id, shifts, boardDate),
    }))
    .filter((item) => item.hours > 0)
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 6);
  const allGuardRoster = employees
    .map((guard) => ({
      guard,
      hours: getWeeklyHoursForGuard(guard.id, shifts, boardDate),
    }))
    .sort((a, b) => (a.guard.full_name || '').localeCompare(b.guard.full_name || ''));
  const estimatedBoardCost = boardData.siteCoverages.reduce((sum, site) => sum + site.estimated_cost, 0);
  const openShiftCount = boardData.openSlots.length;
  const pendingRequests = requests.filter((request) => request.status === 'pending');
  const activeTemplate = templates.find((template) => template.post_id === selectedSlot?.post_id && template.shift_kind === selectedSlot?.bucket);
  const visibleShiftDeleteCount = boardShiftPool.length;
  const selectedBulkEmployeeIds = bulkAssignmentRows.map((row) => row.employee_id).filter(Boolean);
  const bulkReplacementCandidates = employees;
  const auditEntriesWithContext = auditTrail.map((entry) => {
    const snapshot = (entry.new_row ?? entry.old_row ?? {}) as Record<string, unknown>;
    const shift = shifts.find((item) => item.id === entry.shift_id);
    const siteId = getRecordStringValue(snapshot, 'site_id') || shift?.site_id || '';
    const guardId = getRecordStringValue(snapshot, 'employee_id') || shift?.employee_id || '';
    const siteName = shift?.security_sites?.name || sites.find((site) => site.id === siteId)?.name || siteId || 'Unknown site';
    const guardName =
      shift?.employee_name_snapshot ||
      shift?.profiles?.full_name ||
      employees.find((guard) => guard.id === guardId)?.full_name ||
      guardId ||
      'Unknown guard';

    return {
      entry,
      siteId,
      siteName,
      guardId,
      guardName,
    };
  });
  const auditSiteOptions = Array.from(
    new Map(
      auditEntriesWithContext
        .filter((item) => item.siteId)
        .map((item) => [item.siteId, item.siteName])
    ).entries()
  ).map(([value, label]) => ({ value, label }));
  const auditGuardOptions = Array.from(
    new Map(
      auditEntriesWithContext
        .filter((item) => item.guardId)
        .map((item) => [item.guardId, item.guardName])
    ).entries()
  ).map(([value, label]) => ({ value, label }));
  const filteredAuditEntries = auditEntriesWithContext.filter((item) => {
    if (auditActionFilter !== 'all' && item.entry.action !== auditActionFilter) {
      return false;
    }
    if (auditSiteFilter !== 'all' && item.siteId !== auditSiteFilter) {
      return false;
    }
    if (auditGuardFilter !== 'all' && item.guardId !== auditGuardFilter) {
      return false;
    }
    return true;
  });
  const toggleGuardRows = (guardId: string) => {
    setCollapsedGuardCards((current) => ({ ...current, [guardId]: !(current[guardId] ?? true) }));
  };
  const rosterTotalPages = Math.max(1, Math.ceil(rosterGuardCardsList.length / rosterPageSize));
  const safeRosterPage = Math.min(rosterPage, rosterTotalPages);
  const rosterPageStart = (safeRosterPage - 1) * rosterPageSize;
  const rosterPageEnd = rosterPageStart + rosterPageSize;
  const rosterGuardCardsPage = rosterGuardCardsList.slice(rosterPageStart, rosterPageEnd);
  const rosterPageLabelStart = rosterGuardCardsList.length === 0 ? 0 : rosterPageStart + 1;
  const rosterPageLabelEnd = Math.min(rosterPageEnd, rosterGuardCardsList.length);

  const applyTemplateToBulkForm = (template: ShiftTemplate) => {
    setWorkspaceMode('plan');
    setBulkCentreId('');
    setPreviewState(null);
    setBulkData((current) => ({
      ...current,
      site_id: template.site_id || current.site_id,
      post_id: template.post_id || current.post_id,
      replacement_id: '',
      start_date: boardDate,
      end_date: boardDate,
      start_time: template.start_time.slice(0, 5),
      end_time: template.end_time.slice(0, 5),
      notes: template.default_notes || current.notes,
    }));
    setShowBulkModal(true);
  };

  const selectSingleWorkspace = () => {
    const firstRow = bulkAssignmentRows[0];
    const nextGuardId =
      firstRow?.employee_id ||
      bulkData.employee_id ||
      selectedSlot?.assigned_shifts[0]?.employee_id ||
      selectedSuggestion?.guard.id ||
      '';
    setWorkspaceMode('assign');
    syncBulkAssignmentRows([
      createBulkAssignmentRow({
        employee_id: nextGuardId,
        centre_id: firstRow?.centre_id || bulkCentreId,
        site_id: firstRow?.site_id || bulkData.site_id,
        post_id: firstRow?.post_id || bulkData.post_id,
        replacement_id: firstRow?.replacement_id || bulkData.replacement_id || '',
        start_date: firstRow?.start_date || bulkData.start_date,
        end_date: firstRow?.end_date || bulkData.end_date,
        start_time: firstRow?.start_time || bulkData.start_time,
        end_time: firstRow?.end_time || bulkData.end_time,
        notes: firstRow?.notes || bulkData.notes,
      }),
    ]);
    setPreviewState(null);
    setMobileWizardStep('setup');
  };

  const selectBulkWorkspace = () => {
    setWorkspaceMode('plan');
    syncBulkAssignmentRows([]);
    setPreviewState(null);
    setMobileWizardStep('setup');
  };

  const handleCopyRosterToNextWeek = async () => {
    const sourceShifts = boardShiftPool.filter((shift) => shift.status !== 'cancelled');
    if (sourceShifts.length === 0) {
      setToast({ message: 'No shifts are available to copy for the selected date.', type: 'warning' });
      return;
    }

    const addDays = (value: string, days: number) => {
      const date = new Date(value);
      date.setDate(date.getDate() + days);
      return date.toISOString();
    };

    setBusyAction('copy-next-week');
    try {
      const generatedShifts = sourceShifts.map((shift) => ({
        site_id: shift.site_id,
        post_id: shift.post_id,
        employee_id: shift.employee_id,
        replacement_id: shift.replacement_id || null,
        start_time: addDays(shift.start_time, 7),
        end_time: addDays(shift.end_time, 7),
        status: 'scheduled' as const,
        notes: shift.notes || `Copied from roster on ${boardDate}`,
        workflow_status: 'draft' as const,
        shift_template_id: shift.shift_template_id || null,
      }));

      const conflicts = await findShiftConflicts(generatedShifts, employees);
      if (conflicts.length > 0) {
        throw new Error(formatConflictToastMessage(conflicts, 'bulk'));
      }

      await createBulkShifts(generatedShifts);
      focusRosterOnShifts(generatedShifts);
      await refreshRoster();
      setToast({ message: `Copied ${generatedShifts.length} shifts to next week as draft roster entries.`, type: 'success' });
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleAssignGuard = async (slot: DispatchSlot, guardId: string) => {
    setBusyAction(`assign-${slot.id}`);
    try {
      const replacementId = selectEmergencyReplacement(slot, employees, shifts, availability, guardId);
      const payload = buildSiteShiftDraft(
        {
          site_id: slot.site_id,
          post_id: slot.post_id,
          employee_id: guardId,
          replacement_id: replacementId || null,
          shift_kind: slot.bucket === 'day' || slot.bucket === 'night' ? slot.bucket : 'custom',
          shift_date: toIsoDateKey(slot.start_time),
          start_time: new Date(slot.start_time).toTimeString().slice(0, 5),
          end_time: new Date(slot.end_time).toTimeString().slice(0, 5),
          notes: `Auto-filled from dispatch board for ${slot.bucket} coverage.`,
        },
        employees.find((guard) => guard.id === guardId)?.full_name || null,
        replacementId ? employees.find((guard) => guard.id === replacementId)?.full_name || null : null
      );
      const conflicts = await findShiftConflicts([payload], employees);
      if (conflicts.length > 0) {
        throw new Error(formatConflictToastMessage(conflicts, 'assign'));
      }
      const createdShifts = await createBulkShifts([payload]);
      setShifts((current) => {
        const nextShifts = [...createdShifts, ...current.filter((shift) => shift.id !== createdShifts[0]?.id)];
        setStats({ ...calculateRosterStats(nextShifts), totalGuards: employees.length });
        return nextShifts;
      });
      focusRosterOnShifts(createdShifts);
      void Promise.allSettled(createdShifts.map((shift) => sendShiftNotification(shift)));
      void refreshRoster();
      setToast({ message: 'Open coverage filled and the guard was notified by email and SMS', type: 'success' });
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const activeId = String(event.active.id || '');
    const overId = String(event.over?.id || '');
    if (!activeId.startsWith('guard:') || !overId) return;

    const guardId = activeId.replace('guard:', '');

    if (overId.startsWith('slot:')) {
      const slotId = overId.replace('slot:', '');
      const slot = boardData.openSlots.find((item) => item.id === slotId) || boardData.siteCoverages.flatMap((site) => site.post_coverages.flatMap((post) => post.slot_breakdown)).find((item) => item.id === slotId);
      if (slot) {
        await handleAssignGuard(slot, guardId);
      }
      return;
    }

    if (overId.startsWith('shift:')) {
      const shiftId = overId.replace('shift:', '');
      const targetShift = shifts.find((shift) => shift.id === shiftId);
      if (!targetShift) return;

      setBusyAction(`reassign-${shiftId}`);
      try {
        const replacementId = selectEmergencyReplacement(
          {
            id: shiftId,
            site_id: targetShift.site_id,
            site_name: targetShift.security_sites?.name || 'Site',
            site_county: targetShift.security_sites?.county || null,
            post_id: targetShift.post_id || '',
            post_name: targetShift.security_posts?.name || 'Post',
            bucket: new Date(targetShift.start_time).getHours() >= 18 ? 'night' : 'day',
            start_time: targetShift.start_time,
            end_time: targetShift.end_time,
            required_guards: 1,
            assigned_shifts: [],
            open_positions: 0,
            checked_in: 0,
            acknowledged: 0,
            gap: 0,
            overtime_risk: 0,
          },
          employees,
          shifts,
          availability,
          guardId
        );
        const payload = buildSiteShiftDraft(
          {
            site_id: targetShift.site_id,
            post_id: targetShift.post_id || null,
            employee_id: guardId,
            replacement_id: replacementId || null,
            shift_kind: new Date(targetShift.start_time).getHours() >= 18 ? 'night' : 'day',
            shift_date: toIsoDateKey(targetShift.start_time),
            start_time: new Date(targetShift.start_time).toTimeString().slice(0, 5),
            end_time: new Date(targetShift.end_time).toTimeString().slice(0, 5),
            notes: targetShift.notes || undefined,
          },
          employees.find((guard) => guard.id === guardId)?.full_name || null,
          replacementId ? employees.find((guard) => guard.id === replacementId)?.full_name || null : null
        );
        const conflicts = await findShiftConflicts([payload], employees);
        if (conflicts.some((item) => item.conflictingShiftId !== targetShift.id)) {
          throw new Error(formatConflictToastMessage(conflicts, 'reassign'));
        }
        const reassignedShift = await reassignRosterShift(targetShift, guardId, replacementId || null);
        await sendShiftNotification(reassignedShift);
        await refreshRoster();
        setToast({ message: 'Shift reassigned from dispatch board', type: 'success' });
      } catch (error) {
        setToast({ message: sanitizeError(error), type: 'error' });
      } finally {
        setBusyAction(null);
      }
    }
  };

  const handleWorkflow = async (shiftId: string, workflowStatus: ShiftWorkflowStatus) => {
    setBusyAction(`workflow-${shiftId}`);
    try {
      await updateShiftWorkflowStatus(shiftId, workflowStatus);
      await refreshRoster();
      setToast({ message: `Shift moved to ${workflowStatus.replace('_', ' ')}`, type: 'success' });
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

  const handlePublishBoard = async () => {
    setBusyAction('publish-board');
    try {
      const publishable = boardShiftPool.filter((shift) => ['draft', 'published'].includes(resolveWorkflowStatus(shift)));
      const notifyAfterPublish = publishable.filter((shift) => resolveWorkflowStatus(shift) === 'draft');
      await publishRosterVersion(publishable, boardDate, publishReason.trim(), filter.site_id === 'all' ? undefined : filter.site_id);
      await Promise.allSettled(notifyAfterPublish.map((shift) => sendShiftNotification(shift)));
      await refreshRoster();
      setPublishReason('');
      setToast({
        message:
          notifyAfterPublish.length > 0
            ? `Roster published and ${notifyAfterPublish.length} guard${notifyAfterPublish.length === 1 ? '' : 's'} notified by SMS and email.`
            : 'Roster version published with snapshot history.',
        type: 'success',
      });
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    setBusyAction(`restore-${versionId}`);
    try {
      await restoreRosterVersion(versionId);
      await refreshRoster();
      setToast({ message: 'Roster version restored', type: 'success' });
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleNotifyAll = async () => {
    setBusyAction('notify-all');
    try {
      const result = await notifyShifts(boardShiftPool);
      await refreshRoster();
      setToast({
        message: result.failures.length > 0 ? `Notified ${result.sentCount} guards, ${result.failures.length} need attention.` : `Notified ${result.sentCount} guards`,
        type: result.failures.length > 0 ? 'error' : 'success',
      });
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleSendReminders = async () => {
    setBusyAction('send-reminders');
    try {
      const result = await sendUpcomingReminders(boardShiftPool);
      await refreshRoster();
      setToast({ message: result.reminderCount === 0 ? 'No pending reminders in the next 4 hours' : `Sent ${result.reminderCount} reminders`, type: 'success' });
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleNotifyShift = async (shift: SecurityShift) => {
    setBusyAction(`notify-${shift.id}`);
    try {
      const result = await sendShiftNotification(shift);
      if (!result.success) {
        throw new Error('No delivery channel succeeded for this shift notification.');
      }
      await refreshRoster();
      setToast({ message: `Notification sent to ${getShiftDisplayName(shift)}`, type: 'success' });
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleFillOpenSlot = (slot: DispatchSlot) => {
    openComposer('single', slot);
  };

  const handleEditOpenSlot = (slot: DispatchSlot) => {
    const primaryGuardId = slot.assigned_shifts[0]?.employee_id || '';
    openComposer('single', slot, primaryGuardId);
  };

  const handleDeleteOpenSlotCoverage = async (slot: DispatchSlot) => {
    const targetShiftIds =
      slot.assigned_shifts.length > 0
        ? slot.assigned_shifts.map((shift) => shift.id)
        : shifts
            .filter(
              (shift) =>
                shift.workflow_status === 'draft' &&
                shift.site_id === slot.site_id &&
                (shift.post_id || '') === (slot.post_id || '') &&
                shift.start_time === slot.start_time &&
                shift.end_time === slot.end_time
            )
            .map((shift) => shift.id);

    if (targetShiftIds.length === 0) {
      setToast({ message: 'No shift record exists for that slot.', type: 'info' });
      return;
    }

    requestDeleteShifts(targetShiftIds, `coverage for ${slot.site_name} / ${slot.post_name}`);
  };

  const handleRestoreOriginalGuard = async (shift: SecurityShift) => {
    setBusyAction(`restore-${shift.id}`);
    try {
      const restoredShift = await restoreShiftToOriginalGuard(shift);
      await sendShiftNotification(restoredShift);
      await refreshRoster();
      setToast({ message: 'The off duty releaver signed out and the original guard resumed the shift.', type: 'success' });
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleExceptionSave = async () => {
    if (!exceptionDraft) return;
    setBusyAction(`exception-${exceptionDraft.shift.id}`);
    try {
      await markShiftException(
        exceptionDraft.shift.id,
        exceptionDraft.status as Parameters<typeof markShiftException>[1],
        exceptionDraft.notes
      );
      await refreshRoster();
      setExceptionDraft(null);
      setToast({ message: 'Shift moved into exception center', type: 'success' });
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleMigrateGuardNames = async () => {
    setBusyAction('migrate-guard-names');
    try {
      const result = await migrateGuardNamesToShifts();
      if (result.success) {
        setToast({
          message: `Migration complete: ${result.migratedCount} shifts updated with guard names.`,
          type: 'success',
        });
        await refreshRoster();
      } else {
        setToast({
          message: `Migration failed: ${result.error}`,
          type: 'error',
        });
      }
    } catch (error) {
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setBusyAction(null);
    }
  };

  const presetViews = [
    { label: 'Today', apply: () => { setBoardDate(todayKey); setBoardBucket('all'); setFilter(initialFilters); setWorkflowFilter('all'); setSelectedSlot(null); setPreviewState(null); } },
    { label: 'Night Shift', apply: () => { setBoardDate(todayKey); setBoardBucket('night'); setPreviewState(null); } },
    { label: 'Unfilled Posts', apply: () => { setBoardDate(todayKey); setBoardBucket('all'); setSelectedSlot(boardData.openSlots[0] || null); setPreviewState(null); } },
    { label: 'Published Only', apply: () => { setWorkflowFilter('published'); setPreviewState(null); } },
  ];

  return (
    <div className="min-h-full w-full space-y-5 bg-white p-3 text-gray-900 dark:bg-dark-bg dark:text-white sm:p-4 lg:p-6">
      <ThemedConfirmDialog
        open={!!deleteConfirm}
        title="Delete shift records?"
        message={deleteConfirm ? `Delete ${deleteConfirm.label}? This cannot be undone.` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (!deleteConfirm) return;
          const next = deleteConfirm;
          setDeleteConfirm(null);
          void executeDeleteShifts(next.shiftIds);
        }}
      />
      <CustomToast isVisible={!!toast} message={toast?.message || ''} type={toast?.type} onClose={() => setToast(null)} />

      <div className="flex flex-col gap-6 border-b border-gray-200 pb-8 dark:border-dark-border">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <CalendarDays className="text-brand-purple" /> Roster Planning Board
            </h1>
            <p className="text-sm text-gray-500 dark:text-dark-text">
              Workbench mode for planning, assigning, publishing, and adjusting shifts with pre-save review and audit history.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={handleNotifyAll} disabled={!!busyAction} className="rounded-vercel border border-gray-200 px-4 py-2 text-sm font-medium disabled:opacity-60 dark:border-dark-border">
              <Bell size={16} className="mr-2 inline" /> Notify Board
            </button>
            <button onClick={handleSendReminders} disabled={!!busyAction} className="rounded-vercel border border-blue-200 px-4 py-2 text-sm font-medium text-blue-600 disabled:opacity-60 dark:border-blue-900 dark:text-blue-400">
              <Clock size={16} className="mr-2 inline" /> Reminders
            </button>
            <button
              onClick={() => requestDeleteShifts(boardShiftPool.map((shift) => shift.id), `the visible roster (${visibleShiftDeleteCount} shifts)`)}
              disabled={!!busyAction || visibleShiftDeleteCount === 0}
              className="rounded-vercel border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 disabled:opacity-60 dark:border-rose-900/60 dark:text-rose-300"
            >
              <Trash2 size={16} className="mr-2 inline" /> Delete Visible
            </button>
            <button
              onClick={() => navigate('/app/security/roster/workbench')}
              className="rounded-vercel bg-brand-purple px-4 py-2 text-sm font-medium text-white shadow-lg shadow-brand-purple/20"
            >
              <CalendarPlus size={16} className="mr-2 inline" /> Open Workbench
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['plan', 'assign', 'publish', 'adjust'] as RosterWorkspaceMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setWorkspaceMode(mode)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-widest ${
                workspaceMode === mode
                  ? 'bg-brand-purple text-white'
                  : 'border border-gray-200 text-gray-500 dark:border-white/10 dark:text-gray-300'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          {presetViews.map((preset) => (
            <button key={preset.label} onClick={preset.apply} className="rounded-full border border-gray-200 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-gray-500 dark:border-white/10 dark:text-gray-300">
              {preset.label}
            </button>
          ))}
          {savedPresets.map((preset) => (
            <button key={preset.name} onClick={() => applyPreset(preset)} className="rounded-full border border-brand-purple/30 bg-brand-purple/5 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-brand-purple">
              {preset.name}
            </button>
          ))}
        </div>

        {pageError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
            {pageError}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Open Coverage', value: openShiftCount, tone: 'text-rose-500', icon: ShieldAlert },
          { label: 'Pending Ack', value: stats.pendingAck, tone: 'text-blue-500', icon: Send },
          { label: 'Due Soon', value: boardData.dueSoon.length, tone: 'text-amber-500', icon: Clock },
          { label: 'Exception Queue', value: boardData.exceptionShifts.length + boardData.lateRisk.length, tone: 'text-rose-500', icon: Siren },
          { label: 'Est. Cost', value: `KES ${estimatedBoardCost.toFixed(0)}`, tone: 'text-emerald-500', icon: CheckCircle2 },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-dark-surface">
            <div className="mb-2 flex items-center gap-2 text-gray-400">
              <card.icon size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">{card.label}</span>
            </div>
            <p className={`text-2xl font-bold ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-wrap items-center gap-3">
          <Filter size={16} className="text-gray-400" />
          <input
            type="search"
            value={filter.query}
            onChange={(e) => setFilter({ ...filter, query: e.target.value })}
            placeholder="Search guard name, site, post, branch, county, or date"
            className="min-w-[260px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-surface"
          />
          <input type="date" value={boardDate} onChange={(e) => setBoardDate(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-surface" />
          <select value={boardBucket} onChange={(e) => setBoardBucket(e.target.value as BoardShiftBucket)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-surface">
            <option value="all">Day + Night</option>
            <option value="day">Day only</option>
            <option value="night">Night only</option>
          </select>
          <select value={filter.branch_id} onChange={(e) => setFilter({ ...filter, branch_id: e.target.value })} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-surface">
            <option value="all">All branches</option>
            {centres.map((centre) => <option key={centre.id} value={centre.id}>{centre.name}</option>)}
          </select>
          <select value={filter.site_id} onChange={(e) => setFilter({ ...filter, site_id: e.target.value })} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-surface">
            <option value="all">All sites</option>
            {sites.filter((site) => filter.branch_id === 'all' || site.centre_id === filter.branch_id).map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select>
          <select value={filter.post_id} onChange={(e) => setFilter({ ...filter, post_id: e.target.value })} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-surface">
            <option value="all">All posts</option>
            {posts.filter((post) => filter.site_id === 'all' || post.site_id === filter.site_id).map((post) => <option key={post.id} value={post.id}>{post.name}</option>)}
          </select>
          <select value={filter.employee_id} onChange={(e) => setFilter({ ...filter, employee_id: e.target.value })} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-surface">
            <option value="all">All guards</option>
            {employees.map((guard) => <option key={guard.id} value={guard.id}>{getGuardDisplayName(guard)}</option>)}
          </select>
          <CountyPicker
            value={filter.county === 'all' ? '' : filter.county}
            onChange={(county) => setFilter({ ...filter, county: county || 'all' })}
            label="County"
            placeholder="All counties"
            title="Filter by county"
            showLabel={false}
            className="min-w-[220px]"
          />
          <select value={workflowFilter} onChange={(e) => setWorkflowFilter(e.target.value as typeof workflowFilter)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-surface">
            <option value="all">All workflows</option>
            {['draft', 'published', 'acknowledged', 'checked_in', 'completed', 'exception', 'no_show'].map((status) => (
              <option key={status} value={status}>{status.replace('_', ' ')}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setFilter(initialFilters);
              setWorkflowFilter('all');
              setBoardBucket('all');
              setBoardDate(todayKey);
              setSelectedSlot(null);
              setPreviewState(null);
              setSearchParams({});
            }}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 dark:border-dark-border dark:bg-dark-surface dark:text-gray-200"
          >
            Reset Filters
          </button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Preset name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-surface"
            />
            <button
              type="button"
              onClick={savePreset}
              className="rounded-xl border border-brand-purple/30 bg-brand-purple/5 px-4 py-2 text-sm font-bold text-brand-purple"
            >
              Save preset
            </button>
            <input
              type="text"
              placeholder="Publish note"
              value={publishReason}
              onChange={(e) => setPublishReason(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-surface"
            />
            <button onClick={handlePublishBoard} disabled={!!busyAction} className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              {busyAction === 'publish-board' ? 'Publishing...' : 'Publish Board'}
            </button>
            <button onClick={() => void handleCopyRosterToNextWeek()} disabled={!!busyAction} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 dark:border-dark-border dark:bg-dark-surface dark:text-gray-200">
              {busyAction === 'copy-next-week' ? 'Copying...' : 'Copy to Next Week'}
            </button>
        </div>
      </div>

      <div
        className={
          viewMode === 'board'
            ? 'grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.95fr)_minmax(320px,0.85fr)]'
            : 'grid grid-cols-1 gap-5'
        }
      >
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <button onClick={() => setViewMode('table')} className={`rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-widest ${viewMode === 'table' ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300'}`}>List</button>
            <button onClick={() => setViewMode('board')} className={`rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-widest ${viewMode === 'board' ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300'}`}>Board</button>
          </div>

          {viewMode === 'board' ? (
            <DndContext collisionDetection={closestCenter} onDragEnd={(event) => void handleDragEnd(event)}>
              <div className="space-y-6">
                {filteredSites.length === 0 && (
                  <div className="rounded-3xl border border-dashed border-gray-200 bg-gradient-to-br from-slate-50 to-cyan-50 p-10 text-center shadow-sm dark:border-white/10 dark:from-white/5 dark:to-white/10">
                    <h3 className="text-2xl font-black tracking-tight">No sites match the current filters.</h3>
                    <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-500">
                      Clear the query, county, or site filter to bring the coverage board back into view.
                    </p>
                  </div>
                )}
                {filteredSites.length > 0 && boardData.siteCoverages.length === 0 && (
                  <div className="rounded-3xl border border-dashed border-gray-200 bg-gradient-to-br from-slate-50 to-cyan-50 p-10 text-center shadow-sm dark:border-white/10 dark:from-white/5 dark:to-white/10">
                    <h3 className="text-2xl font-black tracking-tight">No shifts exist for this board yet.</h3>
                    <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-500">
                      The roster has been cleared, so there are no live shifts or open coverage rows to display.
                    </p>
                  </div>
                )}
                {filteredSites.map((site) => {
                  const coverage = boardData.siteCoverages.find((item) => item.site_id === site.id);
                  if (!coverage) return null;
                  const percentage = Math.min(100, Math.round((coverage.assigned / Math.max(1, coverage.required)) * 100));
                  const siteCards = [
                    { label: 'Open Positions', value: coverage.gap, tone: coverage.gap > 0 ? 'text-rose-500' : 'text-emerald-500' },
                    { label: 'Acknowledged', value: coverage.acknowledged, tone: 'text-blue-500' },
                    { label: 'Checked In', value: coverage.checked_in, tone: 'text-emerald-500' },
                    { label: 'OT Risk', value: coverage.overtime_risk, tone: coverage.overtime_risk > 0 ? 'text-amber-500' : 'text-gray-400' },
                    { label: 'Est. Cost', value: `KES ${coverage.estimated_cost.toFixed(0)}`, tone: 'text-emerald-500' },
                  ];
                  const postGridClass =
                    coverage.post_coverages.length > 1
                      ? 'grid grid-cols-1 gap-4 2xl:grid-cols-2'
                      : 'grid grid-cols-1 gap-4';

                  return (
                    <div key={site.id} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-dark-surface">
                      <div className="mb-5 space-y-4">
                        <div className="rounded-2xl bg-gradient-to-r from-sky-950/80 to-cyan-950/70 p-5 text-white shadow-inner">
                          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
                            <div className="min-w-0">
                              <h2 className="text-2xl font-black tracking-tight">{coverage.site_name}</h2>
                              <p className="mt-1 text-sm text-white/70">{coverage.county || 'No county'} - {coverage.assigned}/{coverage.required} covered</p>
                              <div className="mt-4 flex flex-wrap gap-2">
                                {coverage.post_coverages.map((post) => (
                                  <span key={post.post_id} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/80">
                                    {post.post_name}: {post.assigned}/{post.required_guards}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4">
                              <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-widest text-white/60">
                                <span>Demand vs coverage</span>
                                <span className={coverageTextColor(percentage).replace('500', '300')}>{percentage}%</span>
                              </div>
                              <div className="h-3 rounded-full bg-white/10">
                                <div className={`h-3 rounded-full ${coverageColor(percentage)}`} style={{ width: `${percentage}%` }} />
                              </div>
                              <div className="mt-4 grid grid-cols-2 gap-3 text-[11px] font-bold uppercase tracking-widest text-white/60">
                                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                                  <p>Required</p>
                                  <p className="mt-1 text-lg text-white">{coverage.required}</p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                                  <p>Assigned</p>
                                  <p className="mt-1 text-lg text-white">{coverage.assigned}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {siteCards.map((card) => (
                            <div key={card.label} className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-dark-bg">
                              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{card.label}</p>
                              <p className={`mt-2 text-lg font-black ${card.tone}`}>{card.value}</p>
                            </div>
                          ))}
                          <div className="rounded-2xl border border-dashed border-gray-200 bg-transparent px-4 py-3 dark:border-white/10">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Dispatch Note</p>
                            <p className="mt-2 text-sm font-medium text-gray-500">
                              {coverage.gap > 0
                                ? `${coverage.gap} position${coverage.gap > 1 ? 's' : ''} still need cover before publish.`
                                : 'Coverage is full. Publish or rebalance for overtime fairness.'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className={postGridClass}>
                        {coverage.post_coverages.map((postCoverage) => (
                          <div key={postCoverage.post_id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-dark-bg">
                            <div className="mb-4 flex items-start justify-between gap-4">
                              <div>
                                <p className="text-base font-black tracking-tight">{postCoverage.post_name}</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                  Required {postCoverage.required_guards} - Assigned {postCoverage.assigned} - Ack {postCoverage.acknowledged} - Gap {postCoverage.gap}
                                </p>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-right">
                                <div className="rounded-xl bg-white px-3 py-2 shadow-sm dark:bg-dark-surface">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Checked in</p>
                                  <p className="text-sm font-bold">{postCoverage.checked_in}</p>
                                </div>
                                <div className="rounded-xl bg-white px-3 py-2 shadow-sm dark:bg-dark-surface">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">OT risk</p>
                                  <p className={`text-sm font-bold ${postCoverage.overtime_risk > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>{postCoverage.overtime_risk}</p>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                              {postCoverage.slot_breakdown.map((slot) => (
                            <DroppableCoverageSlot key={slot.id} slot={slot} selected={selectedSlot?.id === slot.id} onSelect={() => setSelectedSlot(slot)}>
                                  <div className="space-y-2">
                                    {slot.assigned_shifts.map((shift) => (
                                      <ShiftDropCard
                                        key={shift.id}
                                        shift={shift}
                                        guardName={getShiftDisplayName(shift)}
                                        attendance={attendance}
                                        onNotify={() => void handleNotifyShift(shift)}
                                        onWorkflow={(status) => void handleWorkflow(shift.id, status)}
                                        onException={() => setExceptionDraft({ shift, status: 'incident_gap', notes: shift.exception_notes || '' })}
                                        onDelete={() => requestDeleteShifts([shift.id], `shift for ${getShiftDisplayName(shift) || 'this guard'}`)}
                                        onSelect={() => setSelectedSlot({
                                          ...slot,
                                          assigned_shifts: [shift],
                                        })}
                                      />
                                    ))}
                                    {Array.from({ length: slot.open_positions }).map((_, index) => (
                                      <div key={`${slot.id}-placeholder-${index}`} className="rounded-xl border-2 border-dashed border-rose-300 p-3 text-sm font-medium text-rose-600 dark:border-rose-500/40 dark:text-rose-300">
                                        Open shift lane: drag a suggested guard here
                                      </div>
                                    ))}
                                  </div>
                                </DroppableCoverageSlot>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </DndContext>
          ) : (
            <div className="rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-dark-surface">
              <div className="border-b border-gray-200 px-6 py-4 dark:border-white/10">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Users className="text-brand-purple" size={18} />
                  Work Roster List
                </h2>
              </div>

              <div className="p-4 sm:p-6">
                {rosterGuardCardsList.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-gray-200 p-12 text-center text-sm text-gray-500 dark:border-white/10">
                    No shifts match the current roster filters.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-dark-surface via-dark-bg to-dark-surface p-4 shadow-[0_20px_45px_rgba(0,0,0,0.18)]">
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-brand-purple/90">
                            Work roster search
                          </p>
                          <h3 className="mt-1 text-lg font-bold text-white">
                            Search by guard, site, or post
                          </h3>
                          <p className="mt-1 text-sm text-gray-400">
                            Use this to narrow the list before expanding rows.
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-300">
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-gray-100">
                            {rosterGuardCardsList.length} group{rosterGuardCardsList.length === 1 ? '' : 's'}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-gray-100">
                            Page {safeRosterPage} of {rosterTotalPages}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center">
                        <label className="relative flex-1">
                          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-brand-purple/80" />
                          <input
                            type="search"
                            value={filter.query}
                            onChange={(event) => {
                              setFilter({ ...filter, query: event.target.value });
                              setRosterPage(1);
                            }}
                            placeholder="Search guard, site, or post"
                            className="w-full rounded-2xl border border-white/10 bg-dark-surface py-3 pl-11 pr-4 text-sm font-medium text-white outline-none transition placeholder:text-gray-500 focus:border-brand-purple/40 focus:ring-2 focus:ring-brand-purple/20"
                          />
                        </label>

                        <div className="flex flex-wrap items-center gap-2">
                          <label className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">Rows</span>
                            <select
                              value={rosterPageSize}
                              onChange={(event) => {
                                setRosterPageSize(Number(event.target.value));
                                setRosterPage(1);
                              }}
                              className="rounded-xl border border-white/10 bg-dark-surface px-3 py-2 text-sm font-semibold text-white outline-none transition focus:border-brand-purple/40 focus:ring-2 focus:ring-brand-purple/20"
                            >
                              {[4, 6, 8, 12].map((size) => (
                                <option key={size} value={size}>
                                  {size} groups
                                </option>
                              ))}
                            </select>
                          </label>

                          <button
                            type="button"
                            onClick={() => {
                              setFilter((current) => ({ ...current, query: '' }));
                              setRosterPage(1);
                            }}
                            disabled={!filter.query.trim()}
                            className="rounded-full border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-200 transition hover:border-brand-purple/30 hover:text-brand-purple disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-3xl border border-white/10 bg-dark-surface/90">
                      <div className="bg-white/[0.04] px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-300">
                        Guard shifts
                      </div>

                      <div className="divide-y divide-white/5">
                        {rosterGuardCardsPage.map((card) => {
                          const isCollapsed = collapsedGuardCards[card.guardId] ?? true;

                          return (
                            <div key={card.guardId} className="bg-transparent px-6 py-5">
                              <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-purple/10 text-sm font-black text-brand-purple ring-1 ring-white/5">
                                      {card.guardName.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <h3 className="truncate text-base font-bold text-gray-900 dark:text-white">{card.guardName}</h3>
                                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-400">
                                        {card.shifts.length} shift{card.shifts.length === 1 ? '' : 's'} across {card.siteCount} site{card.siteCount === 1 ? '' : 's'}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-brand-purple/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand-purple">
                                    {Math.round(card.totalHours)}h
                                  </span>
                                  <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-200">
                                    Scheduled
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      requestDeleteShifts(
                                        card.shifts.map((shift) => shift.id),
                                        `the whole roster for ${card.guardName} (${card.shifts.length} shift${card.shifts.length === 1 ? '' : 's'})`,
                                      )
                                    }
                                    disabled={!!busyAction || card.shifts.length === 0}
                                    className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-rose-200 transition hover:border-rose-400/50 hover:bg-rose-500/20 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                                    title="Delete the entire roster for this guard"
                                    aria-label={`Delete the entire roster for ${card.guardName}`}
                                  >
                                    Delete Group
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleGuardRows(card.guardId)}
                                    className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-200 transition hover:border-brand-purple/30 hover:text-brand-purple"
                                  >
                                    {isCollapsed ? `Show rows (${card.shifts.length})` : 'Hide rows'}
                                  </button>
                                </div>
                              </div>

                              {isCollapsed ? (
                                <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-gray-400">
                                  Shift rows are hidden. Use <span className="font-semibold text-brand-purple">Show rows</span> to bring them back.
                                </div>
                              ) : card.shifts.length === 0 ? (
                                <p className="mt-4 text-sm text-gray-400">No roster rows in this group.</p>
                              ) : (
                                <div className="mt-5 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                                  {card.shifts
                                    .slice()
                                    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                                    .map((shift) => (
                                      <div
                                        key={shift.id}
                                        className="grid gap-4 bg-transparent px-4 py-4 lg:grid-cols-[1.2fr_1.3fr_1fr_auto]"
                                      >
                                        <div className="min-w-0 space-y-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-semibold text-white">
                                              {shift.security_sites?.name} / {shift.security_posts?.name}
                                            </p>
                                            {getReleaverBadge(shift)}
                                            {shift.replacement_id && (
                                              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-300">
                                                Releaver: {getReleaverDisplayName(shift)}
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                            {shift.security_sites?.security_centres?.name || 'Branch'} / {shift.security_sites?.county || 'No county'}
                                          </p>
                                        </div>

                                        <div className="min-w-0">
                                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                                            {formatRosterWindow(shift)}
                                          </p>
                                          {shift.replacement_id && (
                                            <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                                              Releaver: {getReleaverDisplayName(shift)}
                                            </p>
                                          )}
                                          {formatGuardCheckInLabel(shift) && (
                                            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-emerald-500">
                                              {formatGuardCheckInLabel(shift)}
                                            </p>
                                          )}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${workflowBadge(resolveWorkflowStatus(shift))}`}>
                                            {resolveWorkflowStatus(shift).replace('_', ' ')}
                                          </span>
                                          <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-gray-200">
                                            {new Date(shift.start_time).toLocaleDateString()}
                                          </span>
                                        </div>

                                          <div className="flex shrink-0 flex-wrap justify-end gap-2">
                                            <button
                                              type="button"
                                              onClick={() => navigate(`/app/security/roster/${shift.id}/edit`)}
                                              disabled={!!busyAction}
                                              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold uppercase text-gray-200 disabled:opacity-60"
                                            >
                                              <Edit2 size={10} />
                                              Edit
                                            </button>
                                            {shift.replacement_id && (
                                              <button
                                                type="button"
                                                onClick={() => void handleRestoreOriginalGuard(shift)}
                                                disabled={!!busyAction}
                                                className="rounded-lg border border-emerald-500/30 px-2 py-1 text-[10px] font-bold uppercase text-emerald-300 disabled:opacity-60"
                                              >
                                                Restore
                                              </button>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() => requestDeleteShifts([shift.id], `shift for ${getShiftDisplayName(shift) || 'this guard'}`)}
                                              disabled={!!busyAction}
                                              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[10px] font-bold uppercase text-rose-200 transition hover:bg-rose-500/20 hover:text-rose-100 disabled:opacity-60"
                                              title="Delete this roster shift"
                                              aria-label="Delete this roster shift"
                                            >
                                              <Trash2 size={10} />
                                              Delete
                                            </button>
                                          </div>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {rosterTotalPages > 1 && (
                      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-bold text-gray-300 shadow-sm">
                        <span>
                          Page {safeRosterPage} of {rosterTotalPages}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setRosterPage((page) => Math.max(1, page - 1))}
                            disabled={safeRosterPage === 1}
                            className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-gray-200 transition hover:border-brand-purple/30 hover:text-brand-purple disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Previous
                          </button>
                          <button
                            type="button"
                            onClick={() => setRosterPage((page) => Math.min(rosterTotalPages, page + 1))}
                            disabled={safeRosterPage === rosterTotalPages}
                            className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-gray-200 transition hover:border-brand-purple/30 hover:text-brand-purple disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {viewMode === 'board' && (
            <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-dark-surface">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Auto-Fill Suggestions</h3>
                <p className="text-sm text-gray-500">Drag guards onto an open slot or assigned shift to rebalance instantly.</p>
              </div>
              {activeTemplate && (
                <button onClick={() => applyTemplateToBulkForm(activeTemplate)} className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold uppercase dark:border-white/10">
                  Use template
                </button>
              )}
            </div>
            {selectedSlot ? (
              <>
                <div className="mb-4 rounded-2xl bg-gray-50 p-4 dark:bg-dark-bg">
                  <p className="text-sm font-bold">{selectedSlot.site_name} - {selectedSlot.post_name}</p>
                  <p className="text-xs text-gray-500">{selectedSlot.bucket} slot - {formatShiftTimeRange(selectedSlot)}</p>
                  <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Gap {selectedSlot.gap} - Overtime risk {selectedSlot.overtime_risk}
                  </p>
                </div>
                <div className="space-y-3">
                    {selectedSuggestions.map((suggestion) => (
                      <DraggableSuggestion
                        key={suggestion.guard.id}
                        suggestion={suggestion}
                        guardName={getGuardDisplayName(suggestion.guard)}
                        selected={(selectedSuggestion?.guard.id || '') === suggestion.guard.id}
                        onSelect={() => setSelectedSuggestionId(suggestion.guard.id)}
                        onAssign={() => openComposer('single', selectedSlot, suggestion.guard.id)}
                      />
                  ))}
                  {selectedSuggestions.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-white/10">
                      No conflict-free guards are available for this slot right now.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-white/10">
                Select an open or assigned slot on the board to see ranked suggestions.
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-dark-surface">
            <h3 className="text-lg font-bold">Exception Center</h3>
            <div className="mt-4 space-y-3">
              {[...boardData.exceptionShifts, ...boardData.lateRisk].slice(0, 6).map((shift) => (
                <button key={shift.id} onClick={() => setExceptionDraft({ shift, status: shift.exception_status || 'incident_gap', notes: shift.exception_notes || '' })} className="flex w-full items-start justify-between rounded-2xl border border-gray-200 p-3 text-left dark:border-white/10">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">{getShiftDisplayName(shift)}</p>
                      {getReleaverBadge(shift)}
                    </div>
                    {shift.replacement_id && (
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                        Releaver: {getReleaverDisplayName(shift)}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">{shift.security_sites?.name} - {formatShiftTimeRange(shift)}</p>
                  </div>
                  <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold uppercase text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                    {shift.exception_status && shift.exception_status !== 'none' ? shift.exception_status.replace('_', ' ') : 'attention'}
                  </span>
                </button>
              ))}
              {boardData.exceptionShifts.length + boardData.lateRisk.length === 0 && (
                <p className="text-sm text-gray-500">No active roster exceptions for this board.</p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-dark-surface">
            <h3 className="text-lg font-bold">Guard Self-Service Queue</h3>
            <div className="mt-4 space-y-3">
              {pendingRequests.slice(0, 6).map((request) => (
                <div key={request.id} className="rounded-2xl border border-gray-200 p-3 dark:border-white/10">
                  <p className="text-sm font-bold">{request.request_type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-gray-500">Submitted {new Date(request.submitted_at).toLocaleString()}</p>
                </div>
              ))}
              {pendingRequests.length === 0 && <p className="text-sm text-gray-500">No pending availability, swap, claim, or acknowledgement requests.</p>}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-dark-surface">
            <h3 className="text-lg font-bold">Version History</h3>
            <div className="mt-4 space-y-3">
              {versions.slice(0, 6).map((version) => (
                <button
                  key={version.id}
                  onClick={() => setSelectedVersionId(version.id)}
                  className={`w-full rounded-2xl border p-3 text-left ${selectedVersionId === version.id ? 'border-brand-purple bg-brand-purple/5' : 'border-gray-200 dark:border-white/10'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold">Version {version.version_number} - {new Date(version.roster_date).toLocaleDateString()}</p>
                      <p className="text-xs text-gray-500">{version.reason || 'Published dispatch snapshot'}</p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase text-gray-700 dark:bg-white/10 dark:text-gray-300">
                      {version.status}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleRestoreVersion(version.id);
                      }}
                      className="rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-bold uppercase dark:border-white/10"
                    >
                      Restore
                    </span>
                  </div>
                </button>
              ))}
              {versions.length === 0 && <p className="text-sm text-gray-500">No published versions yet. Publish this board to create rollback history.</p>}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-dark-surface">
            <h3 className="text-lg font-bold">What Changed</h3>
            <p className="mt-1 text-sm text-gray-500">Recent shift-level audit records from the database trigger.</p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value as typeof auditActionFilter)}
                className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-white/10 dark:bg-dark-bg"
              >
                <option value="all">All actions</option>
                <option value="insert">Insert</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
              </select>
              <select
                value={auditSiteFilter}
                onChange={(e) => setAuditSiteFilter(e.target.value)}
                className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-white/10 dark:bg-dark-bg"
              >
                <option value="all">All sites</option>
                {auditSiteOptions.map((site) => (
                  <option key={site.value} value={site.value}>
                    {site.label}
                  </option>
                ))}
              </select>
              <select
                value={auditGuardFilter}
                onChange={(e) => setAuditGuardFilter(e.target.value)}
                className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-white/10 dark:bg-dark-bg"
              >
                <option value="all">All guards</option>
                {auditGuardOptions.map((guard) => (
                  <option key={guard.value} value={guard.value}>
                    {guard.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                Showing {filteredAuditEntries.length} of {auditTrail.length} records
              </p>
              <button
                type="button"
                onClick={() => {
                  setAuditActionFilter('all');
                  setAuditSiteFilter('all');
                  setAuditGuardFilter('all');
                }}
                className="rounded-full border border-gray-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-600 dark:border-white/10 dark:text-gray-300"
              >
                Clear
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {filteredAuditEntries.slice(0, 6).map(({ entry, siteName, guardName }) => (
                <div key={entry.id} className="rounded-2xl border border-gray-200 p-3 dark:border-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold capitalize">{entry.action}</p>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {new Date(entry.changed_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {siteName} - {guardName || `Shift ${entry.shift_id.slice(0, 8)}`}
                  </p>
                </div>
              ))}
              {filteredAuditEntries.length === 0 && <p className="text-sm text-gray-500">No audit entries match the current filters.</p>}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-dark-surface">
            <h3 className="text-lg font-bold">Payroll Forecast</h3>
            <div className="mt-4 space-y-3">
              {weeklyHoursBreakdown.map(({ guard, hours }) => (
                <div key={guard.id} className="flex items-center justify-between rounded-2xl border border-gray-200 p-3 dark:border-white/10">
                  <div>
                    <p className="text-sm font-bold">{getGuardDisplayName(guard)}</p>
                    <p className="text-xs text-gray-500">{hours > 48 ? 'Overtime exposure' : 'Within weekly target'}</p>
                  </div>
                  <span className={`text-sm font-bold ${hours > 48 ? 'text-rose-500' : 'text-emerald-500'}`}>{Math.round(hours)}h</span>
                </div>
              ))}
              {weeklyHoursBreakdown.length === 0 && <p className="text-sm text-gray-500">No weekly hour data yet for the selected period.</p>}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-dark-surface">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">All Available Guards</h3>
                <p className="text-sm text-gray-500">Every active guard currently available in the roster system.</p>
              </div>
              <span className="rounded-full bg-brand-purple/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand-purple">
                {employees.length}
              </span>
            </div>
            <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
              {allGuardRoster.map(({ guard, hours }) => (
                <div key={guard.id} className="flex items-center justify-between rounded-2xl border border-gray-200 px-3 py-2 dark:border-white/10">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{getGuardDisplayName(guard)}</p>
                    <p className="truncate text-xs text-gray-500">{guard.designation || 'Security Guard'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-gray-600 dark:bg-white/10 dark:text-gray-300">
                      {guard.status || 'Unknown'}
                    </span>
                    <span className={`text-sm font-bold ${hours > 48 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {Math.round(hours)}h
                    </span>
                  </div>
                </div>
              ))}
              {allGuardRoster.length === 0 && <p className="text-sm text-gray-500">No guard records available right now.</p>}
            </div>
          </div>
        </div>
        )}
      </div>

      <AnimatePresence>
        {shiftEditDraft && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-2xl rounded-3xl border border-gray-200 bg-white p-6 text-gray-900 shadow-2xl dark:border-white/10 dark:bg-dark-surface dark:text-white"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-brand-purple">Edit shift</p>
                  <h3 className="mt-2 text-xl font-bold">
                    {shiftEditDraft.shift.security_sites?.name} / {shiftEditDraft.shift.security_posts?.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {new Date(shiftEditDraft.shift.start_time).toLocaleDateString()} - {formatShiftTimeRange(shiftEditDraft.shift)}
                  </p>
                </div>
                <button type="button" onClick={() => setShiftEditDraft(null)} className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-white/5">
                  <X size={18} />
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-500">Site</label>
                    <select
                      value={shiftEditDraft.siteId}
                      onChange={(e) =>
                        setShiftEditDraft((current) =>
                          current
                            ? {
                                ...current,
                                siteId: e.target.value,
                                postId: '',
                              }
                            : current
                        )
                      }
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-white/10 dark:bg-dark-bg"
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
                    <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-500">Post</label>
                    <select
                      value={shiftEditDraft.postId}
                      onChange={(e) => setShiftEditDraft((current) => (current ? { ...current, postId: e.target.value } : current))}
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-white/10 dark:bg-dark-bg"
                    >
                      <option value="">Select post</option>
                      {posts
                        .filter((post) => post.site_id === shiftEditDraft.siteId)
                        .map((post) => (
                          <option key={post.id} value={post.id}>
                            {post.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-500">Guard</label>
                    <select
                      value={shiftEditDraft.guardId}
                      onChange={(e) => setShiftEditDraft((current) => (current ? { ...current, guardId: e.target.value } : current))}
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-white/10 dark:bg-dark-bg"
                    >
                      <option value="">Select guard</option>
                      {employees.map((guard) => {
                        const alreadyAssignedToday = shiftEditDateKey
                          ? isGuardScheduledOnDate(guard.id, shiftEditDateKey)
                          : false;
                        const disabled = alreadyAssignedToday && guard.id !== shiftEditDraft.guardId;
                        return (
                          <option key={guard.id} value={guard.id} disabled={disabled}>
                            {formatGuardDropdownLabel(guard, alreadyAssignedToday && guard.id !== shiftEditDraft.guardId)}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-500">Off duty releaver</label>
                    <select
                      value={shiftEditDraft.replacementId}
                      onChange={(e) => setShiftEditDraft((current) => (current ? { ...current, replacementId: e.target.value } : current))}
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-white/10 dark:bg-dark-bg"
                    >
                      <option value="">Off Duty Releaver (optional)</option>
                      {employees
                        .filter((guard) => guard.id !== shiftEditDraft.guardId || guard.id === shiftEditDraft.replacementId)
                        .map((guard) => {
                          const alreadyAssignedToday = shiftEditDateKey
                            ? isGuardScheduledOnDate(guard.id, shiftEditDateKey)
                            : false;
                          const disabled = alreadyAssignedToday && guard.id !== shiftEditDraft.replacementId;
                          return (
                            <option key={guard.id} value={guard.id} disabled={disabled}>
                              {formatGuardDropdownLabel(guard, alreadyAssignedToday && guard.id !== shiftEditDraft.replacementId)}
                            </option>
                          );
                        })}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-500">Start date</label>
                    <input
                      type="date"
                      value={shiftEditDraft.startDate}
                      onChange={(e) => setShiftEditDraft((current) => (current ? { ...current, startDate: e.target.value } : current))}
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-white/10 dark:bg-dark-bg"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-500">End date</label>
                    <input
                      type="date"
                      value={shiftEditDraft.endDate}
                      onChange={(e) => setShiftEditDraft((current) => (current ? { ...current, endDate: e.target.value } : current))}
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-white/10 dark:bg-dark-bg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-500">Start time</label>
                    <input
                      type="time"
                      value={shiftEditDraft.startTime}
                      onChange={(e) => setShiftEditDraft((current) => (current ? { ...current, startTime: e.target.value } : current))}
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-white/10 dark:bg-dark-bg"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-500">End time</label>
                    <input
                      type="time"
                      value={shiftEditDraft.endTime}
                      onChange={(e) => setShiftEditDraft((current) => (current ? { ...current, endTime: e.target.value } : current))}
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-white/10 dark:bg-dark-bg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-500">Workflow</label>
                    <select
                      value={shiftEditDraft.workflowStatus}
                      onChange={(e) =>
                        setShiftEditDraft((current) =>
                          current ? { ...current, workflowStatus: e.target.value as ShiftWorkflowStatus } : current
                        )
                      }
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-white/10 dark:bg-dark-bg"
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="acknowledged">Acknowledged</option>
                      <option value="checked_in">Checked in</option>
                      <option value="completed">Completed</option>
                      <option value="exception">Exception</option>
                      <option value="no_show">No show</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-500">Shift kind</label>
                    <select
                      value={shiftEditDraft.shiftKind}
                      onChange={(e) =>
                        setShiftEditDraft((current) =>
                          current ? { ...current, shiftKind: e.target.value as 'day' | 'night' | 'custom' } : current
                        )
                      }
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-white/10 dark:bg-dark-bg"
                    >
                      <option value="day">Day</option>
                      <option value="night">Night</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-black uppercase tracking-widest text-gray-500">Demand notes</label>
                  <textarea
                    value={shiftEditDraft.notes}
                    onChange={(e) => setShiftEditDraft((current) => (current ? { ...current, notes: e.target.value } : current))}
                    rows={3}
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-white/10 dark:bg-dark-bg"
                    placeholder="Add notes for this roster row"
                  />
                </div>

                <p className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500 dark:border-white/10 dark:bg-dark-bg">
                  Saving this edit updates the roster row directly and notifies the updated guard by SMS and email.
                </p>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShiftEditDraft(null)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 dark:border-white/10 dark:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveShiftEdit()}
                  disabled={!!busyAction}
                  className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {busyAction === `edit-${shiftEditDraft.shift.id}` ? 'Saving...' : 'Save edit'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBulkModal && (
          <div className={isWorkbenchPage ? 'fixed inset-0 z-50 bg-white dark:bg-dark-bg' : 'fixed inset-0 z-50 bg-black/50 backdrop-blur-md'}>
            <motion.div
              initial={{ x: 80, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 80, opacity: 0 }}
              className={isWorkbenchPage
                ? 'h-full w-full overflow-y-auto bg-white p-4 text-gray-900 dark:bg-dark-bg dark:text-white sm:p-6 lg:p-8'
                : 'absolute right-0 top-0 h-full w-full max-w-5xl overflow-y-auto border-l border-white/10 bg-white p-6 text-gray-900 shadow-2xl dark:bg-dark-bg dark:text-white sm:p-8'}
            >
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-brand-purple">
                    {workspaceMode === 'assign' ? 'Single assignment' : 'Bulk batch'}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">
                    {workspaceMode === 'assign' ? 'Single guard' : workspaceMode === 'publish' ? 'Publish review' : workspaceMode === 'adjust' ? 'Adjust roster' : 'Bulk guards'}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-dark-text">
                    {workspaceMode === 'assign'
                      ? 'Fill the details once for one guard, then save.'
                      : 'Create one row per guard and keep each assignment separate.'}
                  </p>
                </div>
                <button onClick={closeWorkbench} className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-dark-surface">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4 md:hidden">
                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-gray-500">Mobile wizard</p>
                      <p className="mt-1 text-sm text-gray-500">Setup, guards, review.</p>
                    </div>
                    <span className="rounded-full bg-brand-purple/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand-purple">
                      {mobileWizardStep}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {([
                      { key: 'setup', label: 'Setup' },
                      { key: 'guards', label: 'Guards' },
                      { key: 'review', label: 'Review' },
                    ] as const).map((step) => (
                      <button
                        key={step.key}
                        type="button"
                        onClick={() => setMobileWizardStep(step.key)}
                        className={`rounded-2xl px-3 py-2 text-[10px] font-black uppercase tracking-widest ${
                          mobileWizardStep === step.key
                            ? 'bg-brand-purple text-white'
                            : 'border border-gray-200 text-gray-500 dark:border-white/10 dark:text-gray-300'
                        }`}
                      >
                        {step.label}
                      </button>
                    ))}
                  </div>
                </div>

                {mobileWizardStep === 'setup' && (
                  <div className="rounded-3xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-dark-surface">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={selectSingleWorkspace} className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-widest ${workspaceMode === 'assign' ? 'bg-brand-purple text-white' : 'border border-gray-200 text-gray-500 dark:border-white/10 dark:text-gray-300'}`}>One guard</button>
                      <button type="button" onClick={selectBulkWorkspace} className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-widest ${workspaceMode !== 'assign' ? 'bg-brand-purple text-white' : 'border border-gray-200 text-gray-500 dark:border-white/10 dark:text-gray-300'}`}>Bulk</button>
                    </div>
                    {workspaceMode === 'assign' ? (
                      <div className="mt-4 space-y-3">
                        <select value={bulkCentreId} onChange={(e) => { const nextCentreId = e.target.value; setBulkCentreId(nextCentreId); setBulkData((current) => ({ ...current, site_id: '', post_id: '' })); syncBulkAssignmentRows(bulkAssignmentRows.map((row) => ({ ...row, centre_id: nextCentreId, site_id: '', post_id: '' }))); setPreviewState(null); }} className="w-full rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface">
                          <option value="">Select branch</option>
                          {centres.map((centre) => <option key={centre.id} value={centre.id}>{centre.name}</option>)}
                        </select>
                        <select value={bulkData.site_id} onChange={(e) => { setBulkData({ ...bulkData, site_id: e.target.value, post_id: '' }); setPreviewState(null); }} className="w-full rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface">
                          <option value="">Select site</option>
                          {bulkSites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
                        </select>
                        <select value={bulkData.post_id} onChange={(e) => { setBulkData({ ...bulkData, post_id: e.target.value }); setPreviewState(null); }} className="w-full rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface">
                          <option value="">Select post</option>
                          {bulkPosts.map((post) => <option key={post.id} value={post.id}>{post.name}</option>)}
                        </select>
                        <select value={bulkData.pattern} onChange={(e) => { setBulkData({ ...bulkData, pattern: e.target.value as BulkShiftFormData['pattern'] }); setPreviewState(null); }} className="w-full rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface">
                          <option value="daily">Daily</option>
                          <option value="weekdays">Weekdays</option>
                          <option value="weekends">Weekends</option>
                        </select>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <input type="date" value={bulkData.start_date} onChange={(e) => { setBulkData({ ...bulkData, start_date: e.target.value }); setPreviewState(null); }} className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface" />
                          <input type="date" value={bulkData.end_date} onChange={(e) => { setBulkData({ ...bulkData, end_date: e.target.value }); setPreviewState(null); }} className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface" />
                          <input type="time" value={bulkData.start_time} onChange={(e) => { setBulkData({ ...bulkData, start_time: e.target.value }); setPreviewState(null); }} className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface" />
                          <input type="time" value={bulkData.end_time} onChange={(e) => { setBulkData({ ...bulkData, end_time: e.target.value }); setPreviewState(null); }} className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface" />
                        </div>
                        <div className="space-y-3">
                          <select value={bulkData.replacement_id ?? ''} onChange={(e) => { setBulkData({ ...bulkData, replacement_id: e.target.value }); setPreviewState(null); }} className="w-full rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface">
                            <option value="">Off Duty Releaver (optional)</option>
                            {bulkReplacementCandidates.map((guard) => <option key={guard.id} value={guard.id}>{getGuardDisplayName(guard)}</option>)}
                          </select>
                          <input value={bulkData.notes} onChange={(e) => { setBulkData({ ...bulkData, notes: e.target.value }); setPreviewState(null); }} placeholder="Reason, instructions, or handover notes" className="w-full rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface" />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-white/10 dark:bg-dark-surface dark:text-gray-400">
                        Bulk mode keeps the assignment details inside each guard row. Tap <span className="font-bold text-gray-900 dark:text-white">Next: Guards</span> to add the first row.
                      </div>
                    )}
                    <div className="mt-4 flex justify-end">
                      <button type="button" onClick={() => setMobileWizardStep('guards')} className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-bold text-white">Next: Guards</button>
                    </div>
                  </div>
                )}

                {mobileWizardStep === 'guards' && (
                  <div className="rounded-3xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-dark-surface">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-gray-500">Guard selection</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {workspaceMode === 'assign'
                            ? 'Pick one available guard for this slot. Guards already assigned on this date are marked and disabled.'
                            : 'Assign each guard to a site and post in the chosen branch.'}
                        </p>
                      </div>
                      <button type="button" onClick={() => setMobileWizardStep('setup')} className="rounded-full border border-gray-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-600 dark:border-white/10 dark:text-gray-300">Back</button>
                    </div>
                      {workspaceMode === 'assign' ? (
                      <div className="space-y-2">
                        <select value={bulkData.employee_id} onChange={(e) => { syncBulkAssignmentRows([createBulkAssignmentRow({ employee_id: e.target.value || '', centre_id: bulkCentreId, site_id: bulkData.site_id, post_id: bulkData.post_id, replacement_id: bulkData.replacement_id || '', start_date: bulkData.start_date, end_date: bulkData.end_date, start_time: bulkData.start_time, end_time: bulkData.end_time, notes: bulkData.notes })]); setPreviewState(null); }} className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-dark-border dark:bg-dark-surface">
                          <option value="">Select guard</option>
                          {employees.map((guard) => {
                            const alreadyAssignedToday = assignmentDateKey ? isGuardScheduledOnDate(guard.id, assignmentDateKey) : false;
                            const disabled = alreadyAssignedToday && guard.id !== bulkData.employee_id;
                            return (
                              <option key={guard.id} value={guard.id} disabled={disabled}>
                                {formatGuardDropdownLabel(guard, alreadyAssignedToday && guard.id !== bulkData.employee_id)}
                              </option>
                            );
                          })}
                        </select>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          Guards already assigned on this date are marked and disabled, just like bulk mode.
                        </p>
                      </div>
                    ) : (
                      bulkAssignmentRows.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-white/10 dark:bg-dark-surface dark:text-gray-400">
                          No bulk guard rows yet. Use <span className="font-bold text-gray-900 dark:text-white">Add another guard</span> to start the batch.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {bulkAssignmentRows.map((row, index) => {
                            const rowSites = row.centre_id ? sites.filter((site) => site.centre_id === row.centre_id) : bulkCentreId ? sites.filter((site) => site.centre_id === bulkCentreId) : sites;
                            const rowPosts = row.site_id ? posts.filter((post) => post.site_id === row.site_id) : [];
                            const rowIssues = getBulkRowValidation(row);
                            return (
                              <div key={`mobile-bulk-row-${index}`} className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-dark-bg">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{index === 0 ? 'Primary guard' : `Additional guard ${index + 1}`}</p>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button type="button" onClick={() => duplicateBulkAssignmentRow(index)} className="rounded-full border border-gray-200 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-600 dark:border-white/10 dark:text-gray-300">Copy row</button>
                                    {bulkAssignmentRows.length > 1 && <button type="button" onClick={() => removeBulkAssignmentRow(index)} className="rounded-full border border-gray-200 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-600 dark:border-white/10 dark:text-gray-300">Remove</button>}
                                    <button type="button" onClick={addBulkAssignmentRow} className="rounded-full bg-brand-purple px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white">Add another guard</button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 gap-3">
                                  <select value={row.centre_id || bulkCentreId} onChange={(e) => updateBulkAssignmentRow(index, { centre_id: e.target.value, site_id: '', post_id: '' })} className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface">
                                    <option value="">Select branch</option>
                                    {centres.map((centre) => <option key={centre.id} value={centre.id}>{centre.name}</option>)}
                                  </select>
                                  <select value={row.site_id} onChange={(e) => updateBulkAssignmentRow(index, { site_id: e.target.value, post_id: '' })} className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface">
                                    <option value="">Select site</option>
                                    {rowSites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
                                  </select>
                                  <select value={row.post_id} onChange={(e) => updateBulkAssignmentRow(index, { post_id: e.target.value })} className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface">
                                    <option value="">Select post</option>
                                    {rowPosts.map((post) => <option key={post.id} value={post.id}>{post.name}</option>)}
                                  </select>
                                  <select value={row.employee_id} onChange={(e) => updateBulkAssignmentRow(index, { employee_id: e.target.value })} className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface">
                                    <option value="">Select guard</option>
                            {employees.map((guard) => {
                              const alreadyAssignedToday = selectedSlot ? isGuardScheduledOnDate(guard.id, toIsoDateKey(selectedSlot.start_time)) : false;
                              const disabled = alreadyAssignedToday && guard.id !== row.employee_id;
                              return (
                                <option key={guard.id} value={guard.id} disabled={disabled}>
                                  {formatGuardDropdownLabel(guard, alreadyAssignedToday && guard.id !== row.employee_id)}
                                </option>
                              );
                            })}
                                  </select>
                                </div>
                                {rowIssues.length > 0 && <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">Missing: {rowIssues.join(', ')}.</p>}
                              </div>
                            );
                          })}
                          <p className="text-xs text-gray-500 dark:text-gray-400">Add as many guards as you need, and place each one on a site and post inside the selected branch.</p>
                        </div>
                      )
                    )}
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <button type="button" onClick={() => setMobileWizardStep('setup')} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 dark:border-white/10 dark:text-gray-200">Back</button>
                      <button type="button" onClick={submitComposerChanges} disabled={!!busyAction} className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Review & save</button>
                    </div>
                  </div>
                )}

                {mobileWizardStep === 'review' && (
                  <div className="space-y-4 rounded-3xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-dark-surface">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-gray-500">Review</p>
                        <p className="mt-1 text-sm text-gray-500">Check the draft before saving.</p>
                      </div>
                      <button type="button" onClick={() => setMobileWizardStep('guards')} className="rounded-full border border-gray-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-600 dark:border-white/10 dark:text-gray-300">Back</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-dark-bg"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Guards</p><p className="mt-1 text-lg font-bold">{selectedBulkEmployeeIds.length}</p></div>
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-dark-bg"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sites</p><p className="mt-1 text-lg font-bold">{bulkData.site_id ? 1 : 0}</p></div>
                    </div>
                    {previewState ? (
                      previewState.conflicts.length > 0 ? (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
                          <p className="font-bold">Conflicts detected</p>
                          <p className="mt-1 text-xs">{previewState.conflicts.length} issue{previewState.conflicts.length === 1 ? '' : 's'} found.</p>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                          No matching shift conflicts found.
                        </div>
                      )
                    ) : (
                      <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-white/10">Run review first to generate a preview.</div>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <button type="button" onClick={() => setPreviewState(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 dark:border-white/10 dark:text-gray-200">Back to edit</button>
                      <button
                        type="button"
                        onClick={submitComposerChanges}
                        disabled={!!busyAction || (previewState ? previewState.conflicts.length > 0 : false)}
                        className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                      >
                        {busyAction === 'review-composer'
                          ? 'Reviewing...'
                          : busyAction === 'save-composer'
                            ? 'Saving...'
                            : previewState
                              ? previewState.conflicts.length > 0
                                ? 'Resolve conflicts first'
                                : 'Save draft'
                              : 'Review & save'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitComposerChanges();
                }}
                className="hidden grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr] md:grid"
              >
                <div className="space-y-5">
                  <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
                    <div className="flex flex-wrap gap-2">
                      {([
                        { key: 'single', label: 'One guard' },
                        { key: 'bulk', label: 'Bulk' },
                      ] as const).map((scope) => (
                        <button
                          key={scope.key}
                          type="button"
                          onClick={() => {
                            if (scope.key === 'single') {
                              selectSingleWorkspace();
                            } else {
                              selectBulkWorkspace();
                            }
                          }}
                          className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-widest ${
                            (scope.key === 'single' && workspaceMode === 'assign') || (scope.key === 'bulk' && workspaceMode !== 'assign')
                              ? 'bg-brand-purple text-white'
                              : 'border border-gray-200 text-gray-500 dark:border-white/10 dark:text-gray-300'
                          }`}
                        >
                          {scope.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                      {workspaceMode === 'assign'
                        ? 'Use this for one guard only. The details you enter apply to that single assignment.'
                        : 'Use this when each guard needs their own row with independent details.'}
                    </p>
                    {workspaceMode === 'assign' ? (
                      <>
                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                          <select
                            value={bulkCentreId}
                            onChange={(e) => {
                              const nextCentreId = e.target.value;
                              setBulkCentreId(nextCentreId);
                              setBulkData((current) => ({ ...current, site_id: '', post_id: '' }));
                              syncBulkAssignmentRows(
                                bulkAssignmentRows.map((row) => ({
                                  ...row,
                                  centre_id: nextCentreId,
                                  site_id: '',
                                  post_id: '',
                                }))
                              );
                              setPreviewState(null);
                            }}
                            className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface"
                          >
                            <option value="">Select branch</option>
                            {centres.map((centre) => <option key={centre.id} value={centre.id}>{centre.name}</option>)}
                          </select>
                          <select
                            value={bulkData.site_id}
                            onChange={(e) => {
                              setBulkData({ ...bulkData, site_id: e.target.value, post_id: '' });
                              setPreviewState(null);
                            }}
                            className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface"
                          >
                            <option value="">Select site</option>
                            {bulkSites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
                          </select>
                          <select
                            value={bulkData.post_id}
                            onChange={(e) => {
                              setBulkData({ ...bulkData, post_id: e.target.value });
                              setPreviewState(null);
                            }}
                            className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface"
                          >
                            <option value="">Select post</option>
                            {bulkPosts.map((post) => <option key={post.id} value={post.id}>{post.name}</option>)}
                          </select>
                          <select
                            value={bulkData.pattern}
                            onChange={(e) => {
                              setBulkData({ ...bulkData, pattern: e.target.value as BulkShiftFormData['pattern'] });
                              setPreviewState(null);
                            }}
                            className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface"
                          >
                            <option value="daily">Daily</option>
                            <option value="weekdays">Weekdays</option>
                            <option value="weekends">Weekends</option>
                          </select>
                          <input
                            type="date"
                            required
                            value={bulkData.start_date}
                            onChange={(e) => {
                              setBulkData({ ...bulkData, start_date: e.target.value });
                              setPreviewState(null);
                            }}
                            className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface"
                          />
                          <input
                            type="date"
                            required
                            value={bulkData.end_date}
                            onChange={(e) => {
                              setBulkData({ ...bulkData, end_date: e.target.value });
                              setPreviewState(null);
                            }}
                            className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface"
                          />
                          <input
                            type="time"
                            required
                            value={bulkData.start_time}
                            onChange={(e) => {
                              setBulkData({ ...bulkData, start_time: e.target.value });
                              setPreviewState(null);
                            }}
                            className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface"
                          />
                          <input
                            type="time"
                            required
                            value={bulkData.end_time}
                            onChange={(e) => {
                              setBulkData({ ...bulkData, end_time: e.target.value });
                              setPreviewState(null);
                            }}
                            className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface"
                          />
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                          <select
                            value={bulkData.replacement_id ?? ''}
                            onChange={(e) => {
                              setBulkData({ ...bulkData, replacement_id: e.target.value });
                              setPreviewState(null);
                            }}
                            className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface"
                          >
                            <option value="">Off Duty Releaver (optional)</option>
                            {bulkReplacementCandidates.map((guard) => (
                              <option key={guard.id} value={guard.id}>
                                {getGuardDisplayName(guard)}
                              </option>
                            ))}
                          </select>
                          <input
                            value={bulkData.notes}
                            onChange={(e) => {
                              setBulkData({ ...bulkData, notes: e.target.value });
                              setPreviewState(null);
                            }}
                            placeholder="Reason, instructions, or handover notes"
                            className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-white/10 dark:bg-dark-surface dark:text-gray-400">
                        Bulk mode keeps the assignment details inside each guard row. Use the row editor below to add the first guard.
                      </div>
                    )}

                    <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-dark-surface">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-gray-500">Guard selection</p>
                          <p className="mt-1 text-xs text-gray-500">
                            {workspaceMode === 'assign'
                              ? 'Pick one guard for this slot.'
                              : 'Add one row per guard and fill each row independently.'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => bulkCsvInputRef.current?.click()}
                            className="rounded-full border border-gray-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-600 dark:border-white/10 dark:text-gray-300"
                          >
                            Import CSV
                          </button>
                          <button
                            type="button"
                            onClick={addBulkAssignmentRow}
                            className="rounded-full bg-fuchsia-500 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-fuchsia-500/20"
                          >
                            Add another guard
                          </button>
                        </div>
                      </div>
                      <input
                        ref={bulkCsvInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            await importBulkCsv(file);
                            setToast({ message: 'CSV imported into bulk rows.', type: 'success' });
                          } catch (error) {
                            const message = sanitizeError(error);
                            setBulkCsvError(message);
                            setToast({ message, type: 'error' });
                          } finally {
                            e.target.value = '';
                          }
                        }}
                      />
                      {bulkCsvError && (
                        <p className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                          {bulkCsvError}
                        </p>
                      )}
                      {workspaceMode === 'assign' ? (
                        <div className="space-y-2">
                          <select
                            value={bulkData.employee_id}
                            onChange={(e) => {
                              syncBulkAssignmentRows([
                                createBulkAssignmentRow({
                                  employee_id: e.target.value || '',
                                  centre_id: bulkCentreId,
                                  site_id: bulkData.site_id,
                                  post_id: bulkData.post_id,
                                  replacement_id: bulkData.replacement_id || '',
                                  start_date: bulkData.start_date,
                                  end_date: bulkData.end_date,
                                  start_time: bulkData.start_time,
                                  end_time: bulkData.end_time,
                                  notes: bulkData.notes,
                                }),
                              ]);
                              setPreviewState(null);
                            }}
                            className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-dark-border dark:bg-dark-surface"
                          >
                            <option value="">Select guard</option>
                            {employees.map((guard) => {
                              const alreadyAssignedToday = assignmentDateKey ? isGuardScheduledOnDate(guard.id, assignmentDateKey) : false;
                              const disabled = alreadyAssignedToday && guard.id !== bulkData.employee_id;
                              return (
                                <option key={guard.id} value={guard.id} disabled={disabled}>
                                  {formatGuardDropdownLabel(guard, alreadyAssignedToday && guard.id !== bulkData.employee_id)}
                                </option>
                              );
                            })}
                          </select>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            Guards already assigned on this date are marked and disabled, just like bulk mode.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {bulkAssignmentRows.map((row, index) => {
                            const rowSites = row.centre_id
                              ? sites.filter((site) => site.centre_id === row.centre_id)
                              : bulkCentreId
                                ? sites.filter((site) => site.centre_id === bulkCentreId)
                                : sites;
                            const rowPosts = row.site_id ? posts.filter((post) => post.site_id === row.site_id) : [];
                            const rowIssues = getBulkRowValidation(row);
                            const rowSite = sites.find((site) => site.id === (row.site_id || bulkData.site_id));
                            const rowPost = posts.find((post) => post.id === (row.post_id || bulkData.post_id));
                            const rowDateKey = row.start_date || bulkData.start_date;
                            const rowGuardOptions =
                              rowSite && rowPost
                                ? rankGuardsForSlot(
                                    {
                                      id: `bulk-${index}`,
                                      site_id: rowSite.id,
                                      site_name: rowSite.name,
                                      site_county: rowSite.county || null,
                                      post_id: rowPost.id,
                                      post_name: rowPost.name,
                                      bucket: new Date(`1970-01-01T${row.start_time || bulkData.start_time}:00`).getHours() >= 18 ? 'night' : 'day',
                                      start_time: `${row.start_date || bulkData.start_date}T${row.start_time || bulkData.start_time}:00`,
                                      end_time: `${row.end_date || bulkData.end_date}T${row.end_time || bulkData.end_time}:00`,
                                      required_guards: rowPost.required_guards || 1,
                                      assigned_shifts: [],
                                      open_positions: 0,
                                      checked_in: 0,
                                      acknowledged: 0,
                                      gap: 0,
                                      overtime_risk: 0,
                                    },
                                    employees,
                                    shifts,
                                    availability
                                  )
                                    .map((suggestion) => suggestion.guard)
                                    .filter((guard) => !isGuardScheduledOnDate(guard.id, rowDateKey))
                                : employees;
                            const rowBestSuggestion =
                              rowSite && rowPost
                                ? rankGuardsForSlot(
                                    {
                                      id: `bulk-${index}`,
                                      site_id: rowSite.id,
                                      site_name: rowSite.name,
                                      site_county: rowSite.county || null,
                                      post_id: rowPost.id,
                                      post_name: rowPost.name,
                                      bucket: new Date(`1970-01-01T${row.start_time || bulkData.start_time}:00`).getHours() >= 18 ? 'night' : 'day',
                                      start_time: `${row.start_date || bulkData.start_date}T${row.start_time || bulkData.start_time}:00`,
                                      end_time: `${row.end_date || bulkData.end_date}T${row.end_time || bulkData.end_time}:00`,
                                      required_guards: rowPost.required_guards || 1,
                                      assigned_shifts: [],
                                      open_positions: 0,
                                      checked_in: 0,
                                      acknowledged: 0,
                                      gap: 0,
                                      overtime_risk: 0,
                                    },
                                    employees,
                                    shifts,
                                    availability
                                  )[0]
                                : null;

                            return (
                              <div
                                key={`bulk-guard-row-${index}`}
                                draggable
                                onDragStart={() => setDraggingBulkRowIndex(index)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => {
                                  if (draggingBulkRowIndex !== null) {
                                    moveBulkAssignmentRow(draggingBulkRowIndex, index);
                                    setDraggingBulkRowIndex(null);
                                  }
                                }}
                                className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-dark-surface"
                              >
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                    {index === 0 ? 'Primary guard' : `Additional guard ${index + 1}`}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => duplicateBulkAssignmentRow(index)}
                                      className="rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-600 transition hover:bg-gray-100 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10"
                                    >
                                      Copy row
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveBulkAssignmentRow(index, index - 1)}
                                      disabled={index === 0}
                                      className="rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-600 transition hover:bg-gray-100 disabled:opacity-40 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10"
                                    >
                                      Up
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveBulkAssignmentRow(index, index + 1)}
                                      disabled={index === bulkAssignmentRows.length - 1}
                                      className="rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-600 transition hover:bg-gray-100 disabled:opacity-40 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10"
                                    >
                                      Down
                                    </button>
                                    {bulkAssignmentRows.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => removeBulkAssignmentRow(index)}
                                        className="rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-600 transition hover:bg-gray-100 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10"
                                      >
                                        Remove
                                      </button>
                                    )}
                                    {true && (
                                      <button
                                        type="button"
                                        onClick={addBulkAssignmentRow}
                                        className="rounded-xl bg-brand-purple px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg shadow-brand-purple/20 transition hover:bg-opacity-90"
                                      >
                                        Add another guard
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                  <select
                                    value={row.centre_id || bulkCentreId}
                                    onChange={(e) => updateBulkAssignmentRow(index, { centre_id: e.target.value, site_id: '', post_id: '' })}
                                    className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface"
                                  >
                                    <option value="">Select branch</option>
                                    {centres.map((centre) => (
                                      <option key={centre.id} value={centre.id}>
                                        {centre.name}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    value={row.site_id}
                                    onChange={(e) => updateBulkAssignmentRow(index, { site_id: e.target.value, post_id: '' })}
                                    className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface"
                                  >
                                    <option value="">Select site</option>
                                    {rowSites.map((site) => (
                                      <option key={site.id} value={site.id}>
                                        {site.name}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    value={row.post_id}
                                    onChange={(e) => updateBulkAssignmentRow(index, { post_id: e.target.value })}
                                    className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface"
                                  >
                                    <option value="">Select post</option>
                                    {rowPosts.map((post) => (
                                      <option key={post.id} value={post.id}>
                                        {post.name}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    value={row.employee_id}
                                    onChange={(e) => updateBulkAssignmentRow(index, { employee_id: e.target.value })}
                                    ref={(element) => {
                                      bulkRowGuardRefs.current[index] = element;
                                    }}
                                    className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface"
                                  >
                                    <option value="">Select guard</option>
                                    {employees.map((guard) => {
                                      const alreadyAssignedToday = rowDateKey ? isGuardScheduledOnDate(guard.id, rowDateKey) : false;
                                      const selectedElsewhere = selectedBulkEmployeeIds.includes(guard.id) && guard.id !== row.employee_id;
                                      const disabled = (alreadyAssignedToday && guard.id !== row.employee_id) || selectedElsewhere;
                                      return (
                                        <option key={guard.id} value={guard.id} disabled={disabled}>
                                          {formatGuardDropdownLabel(guard, alreadyAssignedToday && guard.id !== row.employee_id)}
                                        </option>
                                      );
                                    })}
                                  </select>
                                  {rowBestSuggestion && (
                                    <button
                                      type="button"
                                      onClick={() => updateBulkAssignmentRow(index, { employee_id: rowBestSuggestion.guard.id })}
                                      className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-left text-xs font-bold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                                    >
                                      Suggested: {getGuardDisplayName(rowBestSuggestion.guard)} ({rowBestSuggestion.availability_match})
                                    </button>
                                  )}
                                </div>
                                {rowIssues.length > 0 && (
                                  <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                                    Missing: {rowIssues.join(', ')}.
                                  </p>
                                )}
                                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                                  <input
                                    type="date"
                                    value={row.start_date || bulkData.start_date}
                                    onChange={(e) => updateBulkAssignmentRow(index, { start_date: e.target.value })}
                                    className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface"
                                  />
                                  <input
                                    type="date"
                                    value={row.end_date || bulkData.end_date}
                                    onChange={(e) => updateBulkAssignmentRow(index, { end_date: e.target.value })}
                                    className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface"
                                  />
                                  <input
                                    type="time"
                                    value={row.start_time || bulkData.start_time}
                                    onChange={(e) => updateBulkAssignmentRow(index, { start_time: e.target.value })}
                                    className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface"
                                  />
                                  <input
                                    type="time"
                                    value={row.end_time || bulkData.end_time}
                                    onChange={(e) => updateBulkAssignmentRow(index, { end_time: e.target.value })}
                                    className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface"
                                  />
                                </div>
                                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1.4fr]">
                                  <select
                                    value={row.replacement_id}
                                    onChange={(e) => updateBulkAssignmentRow(index, { replacement_id: e.target.value })}
                                    className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface"
                                  >
                                    <option value="">Off Duty Releaver (optional)</option>
                                    {bulkReplacementCandidates.map((guard) => (
                                      <option key={guard.id} value={guard.id}>
                                        {getGuardDisplayName(guard)}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    value={row.notes}
                                    onChange={(e) => updateBulkAssignmentRow(index, { notes: e.target.value })}
                                    placeholder="Reason, instructions, or handover notes"
                                    className="rounded-2xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface"
                                  />
                                </div>
                              </div>
                            );
                          })}
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Add as many guards as you need, and place each one on a site and post inside the selected branch.
                          </p>
                        </div>
                      )}
                    </div>

                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-gray-500">Pre-save review</p>
                        <p className="mt-1 text-sm text-gray-500">
                          Review the impact before anything is written.
                        </p>
                      </div>
                      <span className="rounded-full bg-brand-purple/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-brand-purple">
                        {previewState ? 'Preview ready' : 'Draft only'}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-center">
                      <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-dark-surface">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Guards</p>
                        <p className="mt-1 text-lg font-bold">{selectedBulkEmployeeIds.length}</p>
                      </div>
                      <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-dark-surface">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sites</p>
                        <p className="mt-1 text-lg font-bold">{bulkData.site_id ? 1 : 0}</p>
                      </div>
                    </div>

                    {previewState ? (
                      <div className="mt-4 space-y-3">
                        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-dark-surface">
                          <p className="text-xs font-black uppercase tracking-widest text-gray-500">{previewState.label}</p>
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                            {previewState.generatedShifts.length} shift{previewState.generatedShifts.length === 1 ? '' : 's'} ready to save
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {previewState.totalSelectedGuards} guard{previewState.totalSelectedGuards === 1 ? '' : 's'} selected - {previewState.affectedSites.length} site{previewState.affectedSites.length === 1 ? '' : 's'} - {previewState.affectedPosts.length} post{previewState.affectedPosts.length === 1 ? '' : 's'}
                          </p>
                        </div>
                        {previewState.conflicts.length > 0 ? (
                          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
                            <p className="font-bold">Conflicts detected</p>
                            <div className="mt-3 space-y-2">
                              {previewState.conflicts.slice(0, 5).map((conflict, index) => (
                                <div key={`${conflict.employeeId}-${index}`} className="rounded-xl border border-rose-200/60 bg-white/70 p-3 dark:border-rose-500/30 dark:bg-black/20">
                                  <p className="font-semibold">{conflict.employeeName}</p>
                                  <p className="text-xs">
                                    {conflict.reason === 'duplicate' ? 'Matching window' : 'Overlap'} - {new Date(conflict.startTime).toLocaleString()}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                            No matching shift conflicts found.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-white/10">
                        Run the review step to generate a preview and validate conflicts before saving.
                      </div>
                    )}
                  </div>

                  <div className="rounded-3xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-dark-surface">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-gray-500">Saved presets</p>
                        <p className="mt-1 text-xs text-gray-500">Quickly return to common roster setups.</p>
                      </div>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-600 dark:bg-white/10 dark:text-gray-300">
                        {savedPresets.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {savedPresets.slice(0, 4).map((preset) => (
                        <button key={preset.name} type="button" onClick={() => applyPreset(preset)} className="w-full rounded-2xl border border-gray-200 px-3 py-2 text-left text-sm dark:border-white/10">
                          <p className="font-bold">{preset.name}</p>
                          <p className="text-xs text-gray-500">{preset.boardDate} - {preset.boardBucket} - {preset.workspaceMode}</p>
                        </button>
                      ))}
                      {savedPresets.length === 0 && <p className="text-sm text-gray-500">No saved presets yet.</p>}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-dark-surface">
                    <p className="text-xs font-black uppercase tracking-widest text-gray-500">Action summary</p>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span>Scope</span>
                      <span className="font-bold">{workspaceMode}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span>Preview status</span>
                      <span className="font-bold">{previewState ? 'Ready' : 'Pending'}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span>Guard count</span>
                      <span className="font-bold">{selectedBulkEmployeeIds.length}</span>
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-2 flex flex-wrap justify-end gap-3 border-t border-gray-200 pt-4 dark:border-white/10">
                  <button type="button" onClick={closeWorkbench} className="rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-dark-surface">
                    Close
                  </button>
                  {previewState && (
                    <button type="button" onClick={() => setPreviewState(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 dark:border-white/10 dark:text-gray-200">
                      Back to edit
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!!busyAction || (previewState ? previewState.conflicts.length > 0 : false)}
                    className="rounded-xl bg-brand-purple px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {busyAction === 'review-composer'
                      ? 'Reviewing...'
                      : busyAction === 'save-composer'
                        ? 'Saving...'
                        : previewState
                          ? previewState.conflicts.length > 0
                            ? 'Resolve conflicts first'
                            : 'Confirm save'
                          : 'Review changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {exceptionDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-8 shadow-2xl dark:border-dark-border dark:bg-dark-bg">
              <h2 className="text-xl font-bold">Escalate roster exception</h2>
              <p className="mt-2 text-sm text-gray-500">{getShiftDisplayName(exceptionDraft.shift)} - {exceptionDraft.shift.security_sites?.name}</p>
              <div className="mt-6 space-y-4">
                <select value={exceptionDraft.status} onChange={(e) => setExceptionDraft({ ...exceptionDraft, status: e.target.value })} className="w-full rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-dark-border dark:bg-dark-surface">
                  <option value="incident_gap">Incident-linked staffing gap</option>
                  <option value="late_arrival">Late arrival</option>
                  <option value="early_handover">Early handover</option>
                  <option value="emergency_replacement">Emergency replacement</option>
                  <option value="no_show">No show</option>
                </select>
                <textarea value={exceptionDraft.notes} onChange={(e) => setExceptionDraft({ ...exceptionDraft, notes: e.target.value })} placeholder="Capture supervisor notes, cause, and replacement instructions" className="h-32 w-full rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-dark-border dark:bg-dark-surface" />
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setExceptionDraft(null)} className="rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-dark-surface">Cancel</button>
                <button onClick={() => void handleExceptionSave()} disabled={!!busyAction} className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                  Save Exception
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </div>
  );
};

export default RosterManagement;
