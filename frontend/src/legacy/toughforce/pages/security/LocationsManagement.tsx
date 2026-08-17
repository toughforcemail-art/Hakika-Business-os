// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { 
  Building2, 
  MapPin, 
  Target, 
  Plus, 
  ShieldCheck,
  Trash2,
  Edit2,
  Printer,
  X
} from 'lucide-react';
import { printWorkspacePage } from '../../utils/printHelpers';
import { motion, AnimatePresence } from 'framer-motion';
import CustomToast, { sanitizeError } from '../../components/CustomToast';
import { NotificationService } from '../../services/NotificationService';
import { buildSiteShiftDrafts, createBulkShifts, fetchRosterBootstrapData, findShiftConflicts, formatGuardDropdownLabel, isGuardScheduledOnDate, sendShiftNotification, toIsoDateKey } from '../../services/securityRosterService';
import type { SecurityCentre, SecurityGuard, SecurityShift } from '../../types/security';
import CountyPicker from '../../components/security/CountyPicker';

interface SiteAssignmentDraft {
  centre_id: string;
  site_id: string;
  post_id: string;
  shift_kind: 'day' | 'night' | 'custom';
  assignments: {
    employee_id: string;
    replacement_id: string;
  }[];
  shift_date: string;
  start_time: string;
  end_time: string;
  notes: string;
}

const todayKey = toIsoDateKey(new Date());

const shiftKindTimes: Record<'day' | 'night' | 'custom', { start_time?: string; end_time?: string }> = {
  day: { start_time: '06:00', end_time: '18:00' },
  night: { start_time: '18:00', end_time: '06:00' },
  custom: {},
};

const buildShiftDateTime = (date: string, time: string) => {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0, 0);
};

const LocationsManagement: React.FC = () => {
  const navigate = useNavigate();
  const [centres, setCentres] = useState<SecurityCentre[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [guards, setGuards] = useState<SecurityGuard[]>([]);
  const [shifts, setShifts] = useState<SecurityShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningGuard, setAssigningGuard] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // Modal and Form States
  const [modalType, setModalType] = useState<'centre' | 'site' | 'post' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [assignmentDraft, setAssignmentDraft] = useState<SiteAssignmentDraft | null>(null);

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const { data: cData } = await supabase.from('security_centres').select('*').order('name');
      const { data: sData } = await supabase.from('security_sites').select('*, security_centres(name)').order('name');
      const { data: pData } = await supabase.from('security_posts').select('*, security_sites(name)').order('name');
      
      if (cData) setCentres(cData);
      if (sData) setSites(sData);
      if (pData) setPosts(pData);
      
    } catch (error) {
      console.error("Error fetching locations:", error);
    }
    setLoading(false);
  };

  const fetchGuards = async () => {
    try {
      const bootstrap = await fetchRosterBootstrapData();
      setGuards(bootstrap.guards);
      setShifts(bootstrap.shifts);
    } catch (error) {
      console.error('Error fetching guards:', error);
    }
  };

  const getDeleteErrorMessage = (error: unknown, type: 'centre' | 'site' | 'post') => {
    const message = typeof error === 'object' && error !== null
      ? `${(error as any).message || ''} ${(error as any).details || ''} ${(error as any).hint || ''}`.toLowerCase()
      : String(error || '').toLowerCase();

    if (message.includes('duplicate key') || message.includes('unique constraint') || message.includes('already exists')) {
      if (type === 'centre') {
        return 'This branch still has linked operational records. Remove the remaining site and roster data first.';
      }
      if (type === 'site') {
        return 'This site still has linked operational records. Remove the remaining roster data first.';
      }
      return 'This post still has linked operational records. Remove the remaining references first.';
    }

    return sanitizeError(error);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    let table = '';
    if (modalType === 'centre') table = 'security_centres';
    else if (modalType === 'site') table = 'security_sites';
    else if (modalType === 'post') table = 'security_posts';

    try {
      if (modalType === 'centre' && !editingItem) {
        // Check for existing branch name
        const { data: existing } = await supabase
          .from('security_centres')
          .select('id')
          .ilike('name', formData.name?.trim())
          .single();
        
        if (existing) {
          setToast({ message: `A branch with the name "${formData.name}" already exists!`, type: 'error' });
          setLoading(false);
          return;
        }
      }

      if (editingItem) {
        const { error } = await supabase.from(table).update(formData).eq('id', editingItem.id);
        if (error) throw error;
        setToast({ message: `${getLocationLabel()} updated successfully!`, type: 'success' });
      } else {
        const insertPayload = {
          ...formData,
          status: formData.status || 'active',
        };
        const { error } = await supabase.from(table).insert([insertPayload]).select().single();
        if (error) throw error;

        setToast({ message: `${getLocationLabel()} added successfully!`, type: 'success' });
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        NotificationService.sendNotification(
          user.id,
          editingItem ? `${getLocationLabel()} Updated` : `New ${getLocationLabel()} Added`,
          `${formData.name} has been processed in Locations Management.`,
          'success'
        );
      }

      await fetchLocations();
      closeModal();
    } catch (error) {
      console.error("Save error:", error);
      setToast({ message: sanitizeError(error), type: 'error' });
    }
    setLoading(false);
  };

  const handleDelete = async (type: string, id: string) => {
    if (!window.confirm("Are you sure you want to delete this?")) return;
    setLoading(true);
    let table = type === 'centre' ? 'security_centres' : type === 'site' ? 'security_sites' : 'security_posts';
    try {
      if (type === 'centre') {
        const branchSites = sites.filter((site) => site.centre_id === id);
        const siteIds = branchSites.map((site) => site.id);
        if (siteIds.length > 0) {
          const { error: rosterVersionsDeleteError } = await supabase
            .from('security_roster_versions')
            .delete()
            .in('site_id', siteIds);
          if (rosterVersionsDeleteError) throw rosterVersionsDeleteError;

          const { error: shiftsDeleteError } = await supabase
            .from('security_shifts')
            .delete()
            .in('site_id', siteIds);
          if (shiftsDeleteError) throw shiftsDeleteError;
        }
        if (siteIds.length > 0) {
          const { error: patrolDeleteError } = await supabase
            .from('security_patrol_checkpoints')
            .delete()
            .in('site_id', siteIds);
          if (patrolDeleteError) throw patrolDeleteError;

          const { error: incidentsDeleteError } = await supabase
            .from('security_incidents')
            .delete()
            .in('site_id', siteIds);
          if (incidentsDeleteError) throw incidentsDeleteError;

          const { error: sosDeleteError } = await supabase
            .from('security_sos_alerts')
            .delete()
            .in('site_id', siteIds);
          if (sosDeleteError) throw sosDeleteError;

          const { error: billingDeleteError } = await supabase
            .from('security_billing_summaries')
            .delete()
            .in('site_id', siteIds);
          if (billingDeleteError) throw billingDeleteError;

          const { error: camerasDeleteError } = await supabase
            .from('security_cameras')
            .delete()
            .in('site_id', siteIds);
          if (camerasDeleteError) throw camerasDeleteError;

          const { error: nvrDeleteError } = await supabase
            .from('security_nvr_devices')
            .delete()
            .in('site_id', siteIds);
          if (nvrDeleteError) throw nvrDeleteError;

          const { error: postsDeleteError } = await supabase
            .from('security_posts')
            .delete()
            .in('site_id', siteIds);
          if (postsDeleteError) throw postsDeleteError;

          const { error: sitesDeleteError } = await supabase
            .from('security_sites')
            .delete()
            .eq('centre_id', id);
          if (sitesDeleteError) throw sitesDeleteError;
        }
      } else if (type === 'site') {
        const { error: shiftsDeleteError } = await supabase
          .from('security_shifts')
          .delete()
          .eq('site_id', id);
        if (shiftsDeleteError) throw shiftsDeleteError;

        const { error: postsDeleteError } = await supabase
          .from('security_posts')
          .delete()
          .eq('site_id', id);
        if (postsDeleteError) throw postsDeleteError;
      }

      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      setToast({ message: `${type === 'centre' ? 'Branch' : type} deleted successfully`, type: 'success' });
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        NotificationService.sendNotification(
          user.id,
          'Location Asset Removed',
          `A security ${type} has been deleted.`,
          'warning'
        );
      }

      await fetchLocations();
    } catch (error) {
      console.error("Delete error:", error);
      setToast({ message: getDeleteErrorMessage(error, type as 'centre' | 'site' | 'post'), type: 'error' });
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchLocations();
    void fetchGuards();
  }, []);

  const openModal = (type: 'centre' | 'site' | 'post', item: any = null) => {
    setModalType(type);
    // Only treat as "editing" if the item has a real database id
    setEditingItem(item?.id ? item : null);
    if (item?.id) {
       // Editing existing record — strip joined relations before putting in formData
       const { security_centres, security_sites, ...rest } = item;
       setFormData(rest);
    } else if (item && (item.site_id || item.centre_id)) {
       // Quick-add pre-fill (e.g. { centre_id: '...' }) — use as initial formData only
       setFormData(item);
    } else {
      setFormData({});
    }
  };

  const closeModal = () => {
    setModalType(null);
    setEditingItem(null);
    setFormData({});
  };

  const getLocationLabel = () => {
    if (modalType === 'centre') return 'Branch';
    if (modalType === 'site') return 'Site';
    if (modalType === 'post') return 'Post';
    return 'Location';
  };
  const getLocationActionLabel = () => {
    if (modalType === 'centre') {
      return editingItem?.id ? 'Save Branch' : 'Create Branch';
    }
    if (modalType === 'site') {
      return editingItem?.id ? 'Save Site' : 'Create Site';
    }
    if (modalType === 'post') {
      return editingItem?.id ? 'Save Post' : 'Create Post';
    }
    return editingItem?.id ? 'Save Changes' : 'Save';
  };

  const openAssignmentModal = (target: any, postId = '') => {
    const resolvedCentreId = target?.centre_id || (target?.site_id ? sites.find((site) => site.id === target.site_id)?.centre_id : target?.id ? target.id : '');
    const resolvedSiteId = target?.site_id || '';
    const query = new URLSearchParams();
    if (resolvedCentreId) query.set('centre_id', resolvedCentreId);
    if (resolvedSiteId) query.set('site_id', resolvedSiteId);
    if (postId) query.set('post_id', postId);
    navigate(`/app/security/sites/assign${query.toString() ? `?${query.toString()}` : ''}`);
  };

  const closeAssignmentModal = () => {
    setAssignmentDraft(null);
  };

  const updateAssignmentRow = (index: number, field: 'employee_id' | 'replacement_id', value: string) => {
    if (!assignmentDraft) return;
    const assignments = [...assignmentDraft.assignments];
    assignments[index] = { ...assignments[index], [field]: value };
    setAssignmentDraft({ ...assignmentDraft, assignments });
  };

  const addAssignmentRow = () => {
    if (!assignmentDraft) return;
    setAssignmentDraft({
      ...assignmentDraft,
      assignments: [...assignmentDraft.assignments, { employee_id: '', replacement_id: '' }],
    });
  };

  const removeAssignmentRow = (index: number) => {
    if (!assignmentDraft) return;
    if (assignmentDraft.assignments.length === 1) return;
    setAssignmentDraft({
      ...assignmentDraft,
      assignments: assignmentDraft.assignments.filter((_, rowIndex) => rowIndex !== index),
    });
  };

  const selectedAssignmentGuardIds = assignmentDraft?.assignments.map((row) => row.employee_id).filter(Boolean) ?? [];

  const handleAssignGuardDuty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentDraft) return;

    setAssigningGuard(true);
    try {
      const selectedAssignments = assignmentDraft.assignments.filter((assignment) => assignment.employee_id);
      if (selectedAssignments.length === 0) {
        throw new Error('Please select at least one guard to assign.');
      }

      const shiftStart = buildShiftDateTime(assignmentDraft.shift_date, assignmentDraft.start_time);
      const shiftEnd = buildShiftDateTime(assignmentDraft.shift_date, assignmentDraft.end_time);

      if (shiftEnd <= shiftStart) {
        shiftEnd.setDate(shiftEnd.getDate() + 1);
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
          start_time: assignmentDraft.start_time,
          end_time: assignmentDraft.end_time,
          notes: assignmentDraft.notes.trim(),
        })),
        guardLookup,
        sites.find((site) => site.id === assignmentDraft.site_id)?.name || null
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
        message: `Assigned ${createdShifts.length} guard${createdShifts.length === 1 ? '' : 's'} from site operations and notified them by email and SMS.`,
        type: 'success',
      });
      closeAssignmentModal();
      navigate('/app/security/roster?view=table');
    } catch (error) {
      console.error('Assign guard error:', error);
      setToast({ message: sanitizeError(error), type: 'error' });
    } finally {
      setAssigningGuard(false);
    }
  };

  return (
    <div className="min-h-full w-full p-6 lg:p-10 space-y-8 bg-white dark:bg-dark-bg text-gray-900 dark:text-white">
      <CustomToast 
        isVisible={!!toast} 
        message={toast?.message || ''} 
        type={toast?.type as any} 
        onClose={() => setToast(null)} 
      />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-gray-200 dark:border-dark-border pb-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Building2 className="text-brand-purple" /> Sites & Branches
          </h1>
          <p className="text-sm text-gray-500 dark:text-dark-text">
            Manage your operational Branches, Sites, and Guard Posts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => printWorkspacePage()} className="px-4 py-2 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition flex items-center gap-2" title="Print locations">
            <Printer size={16} /> Print
          </button>
          <button 
            onClick={() => {
              if (window.confirm('This will perform a batch action or clear view. Proceed?')) {
                setToast({ message: 'Bulk delete functionality to be implemented.', type: 'info' });
              }
            }} 
            className="px-4 py-2 bg-rose-500/10 text-rose-500 text-sm font-medium rounded-xl hover:bg-rose-500/20 transition flex items-center gap-2"
            title="Bulk actions / Delete"
          >
            <Trash2 size={16} /> Delete
          </button>
          <button onClick={() => navigate('/app/security/locations/new?type=centre')} className="px-4 py-2 bg-brand-purple text-white text-sm font-medium rounded-xl hover:bg-opacity-90 transition flex items-center gap-2 shadow-lg shadow-brand-purple/20" title="Add new branch">
            <Plus size={16} /> Add Branch
          </button>
        </div>
      </div>

      {/* ── Unified Operations Map ─────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-purple/10">
              <Building2 className="text-brand-purple" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Unified Operations Map</h2>
              <p className="text-xs text-gray-500 dark:text-dark-text">Live hierarchy of all Branches → Sites → Posts</p>
            </div>
          </div>
          <button
            title="Refresh map"
            onClick={fetchLocations}
            className="px-3 py-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-brand-purple border border-gray-200 dark:border-dark-border rounded-xl hover:border-brand-purple/40 transition-all flex items-center gap-1.5"
          >
            <ShieldCheck size={14} /> Sync
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium">Loading operational map…</p>
            </div>
          </div>
        )}

        {!loading && centres.length === 0 && (
          <div className="relative overflow-hidden flex flex-col items-center justify-center py-24 rounded-3xl border-2 border-dashed border-gray-200 bg-white/80 text-gray-700 shadow-sm dark:border-white/10 dark:bg-dark-surface dark:text-gray-200">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-purple/5 via-transparent to-brand-pink/5 dark:from-brand-purple/10 dark:via-transparent dark:to-transparent pointer-events-none" />
            <Building2 size={48} className="relative z-10 mb-4 text-gray-300 dark:text-white/15" />
            <h3 className="relative z-10 text-base font-semibold text-gray-700 dark:text-gray-100">No Branches Configured</h3>
            <p className="relative z-10 mt-1 text-xs text-gray-500 dark:text-gray-400">Start building your operational structure.</p>
            <button onClick={() => openModal('centre')} className="relative z-10 mt-5 flex items-center gap-2 rounded-xl bg-brand-purple px-5 py-2 text-xs font-bold text-white shadow-lg shadow-brand-purple/20 transition hover:bg-brand-purple/90">
              <Plus size={14} /> Create First Branch
            </button>
          </div>
        )}

        <div className="space-y-6">
          {centres.map((centre, cidx) => {
            const branchSites = sites.filter(s => s.centre_id === centre.id);
            const branchPosts = posts.filter(p => branchSites.some(s => s.id === p.site_id));
            const PALETTE = [
              'from-violet-600 to-purple-700',
              'from-blue-600 to-indigo-700',
              'from-emerald-500 to-teal-600',
              'from-orange-500 to-amber-600',
              'from-pink-500 to-rose-600',
              'from-cyan-500 to-sky-600',
            ];
            const gradient = PALETTE[cidx % PALETTE.length];

            return (
              <motion.div
                key={centre.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: cidx * 0.05 }}
                className="rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 shadow-sm"
              >
                {/* ── Branch Header Bar ──────────────────── */}
                <div className={`bg-gradient-to-r ${gradient} px-5 py-4 flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <Building2 size={18} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm leading-none">{centre.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {centre.county && (
                          <span className="text-[10px] text-white/70 font-medium">{centre.county}</span>
                        )}
                        {centre.location && (
                          <>
                            <span className="text-white/40 text-[10px]">•</span>
                            <span className="text-[10px] text-white/70 font-medium flex items-center gap-1">
                              <MapPin size={10} />{centre.location}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Stats pills */}
                    <div className="hidden sm:flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-white/15 text-white text-[10px] font-bold rounded-lg">
                        {branchSites.length} {branchSites.length === 1 ? 'Site' : 'Sites'}
                      </span>
                      <span className="px-2.5 py-1 bg-white/15 text-white text-[10px] font-bold rounded-lg">
                        {branchPosts.length} {branchPosts.length === 1 ? 'Post' : 'Posts'}
                      </span>
                      <span className="px-2.5 py-1 bg-white/15 text-white text-[10px] font-bold rounded-lg">
                        {branchPosts.reduce((sum, p) => sum + (p.required_guards || 0), 0)} Guards
                      </span>
                    </div>
                    {/* Edit / Delete */}
                    <div className="flex gap-1">
                      <button
                        title="Assign guard to branch"
                        onClick={() => openAssignmentModal(centre)}
                        className="p-1.5 rounded-lg bg-white/10 text-white/80 hover:bg-white/25 transition-colors"
                      >
                        <Plus size={13} />
                      </button>
                      <button
                        title="Edit Branch"
                        onClick={() => openModal('centre', centre)}
                        className="p-1.5 rounded-lg bg-white/10 text-white/80 hover:bg-white/25 transition-colors"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        title="Delete Branch"
                        onClick={() => handleDelete('centre', centre.id)}
                        className="p-1.5 rounded-lg bg-white/10 text-white/80 hover:bg-rose-500/60 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Sites Grid ─────────────────────────── */}
                <div className="bg-gray-50/60 dark:bg-dark-surface p-4">
                  {branchSites.length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-white/10 py-8 text-center">
                      <MapPin size={28} className="mx-auto text-gray-300 dark:text-white/10 mb-2" />
                      <p className="text-xs text-gray-400">No sites assigned to this branch yet.</p>
                      <button
                        onClick={() => openModal('site', { centre_id: centre.id })}
                        className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 bg-brand-purple text-white text-[11px] font-bold rounded-lg hover:bg-brand-purple/90 transition shadow-sm"
                      >
                        <Plus size={12} /> Add First Site
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {branchSites.map(site => {
                        const sitePosts = posts.filter(p => p.site_id === site.id);
                        const totalGuards = sitePosts.reduce((sum, p) => sum + (p.required_guards || 0), 0);
                        return (
                          <div key={site.id} className="bg-white dark:bg-dark-surface rounded-xl border border-gray-100 dark:border-white/10 overflow-hidden group/site shadow-sm hover:shadow-md transition-shadow">
                            {/* Site header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 dark:border-white/5">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-6 h-6 rounded-lg bg-brand-pink/10 flex items-center justify-center shrink-0">
                                  <MapPin size={12} className="text-brand-pink" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{site.name}</p>
                                  {site.address && (
                                    <p className="text-[10px] text-gray-400 truncate">{site.address}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                {totalGuards > 0 && (
                                  <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 text-[9px] font-bold rounded-md">
                                    {totalGuards}G
                                  </span>
                                )}
                                <button
                                  title="Assign guard duty from this site"
                                  onClick={() => openAssignmentModal(site)}
                                  className="rounded-md border border-brand-purple/20 bg-brand-purple/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-brand-purple hover:bg-brand-purple hover:text-white transition-all"
                                >
                                  Assign Guard
                                </button>
                                <div className="flex gap-0.5 opacity-0 group-hover/site:opacity-100 transition-opacity">
                                  <button title="Edit Site" onClick={() => openModal('site', site)} className="p-1 hover:text-brand-purple transition-colors text-gray-400">
                                    <Edit2 size={11} />
                                  </button>
                                  <button title="Delete Site" onClick={() => handleDelete('site', site.id)} className="p-1 hover:text-rose-500 transition-colors text-gray-400">
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Posts list */}
                            <div className="p-3 space-y-1.5">
                              <p className="text-[9px] text-gray-400 uppercase font-black tracking-widest px-1">Operational Posts</p>
                              {sitePosts.map(post => (
                                <div key={post.id} className="flex items-center justify-between px-2.5 py-2 bg-gray-50 dark:bg-white/5 rounded-lg hover:bg-brand-purple/5 transition-colors group/post">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Target size={11} className="text-gray-300 group-hover/post:text-brand-purple transition-colors shrink-0" />
                                    <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300 truncate">{post.name}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0 ml-1">
                                    <button
                                      title="Assign guard directly to this post"
                                      onClick={() => openAssignmentModal(site, post.id)}
                                      className="rounded-md border border-brand-purple/20 bg-brand-purple/10 px-1.5 py-1 text-[9px] font-black uppercase tracking-widest text-brand-purple hover:bg-brand-purple hover:text-white transition-all"
                                    >
                                      Assign
                                    </button>
                                    <span className="text-[9px] px-1.5 py-0.5 bg-brand-purple/10 text-brand-purple rounded font-bold whitespace-nowrap">
                                      {post.required_guards} {post.required_guards === 1 ? 'Guard' : 'Guards'}
                                    </span>
                                    <div className="flex gap-0.5 opacity-0 group-hover/post:opacity-100 transition-opacity">
                                      <button title="Edit Post" onClick={() => openModal('post', post)} className="p-0.5 hover:text-brand-purple transition-colors text-gray-400">
                                        <Edit2 size={10} />
                                      </button>
                                      <button title="Delete Post" onClick={() => handleDelete('post', post.id)} className="p-0.5 hover:text-rose-500 transition-colors text-gray-400">
                                        <Trash2 size={10} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              <button
                                title="Add Post to this Site"
                                onClick={() => openModal('post', { site_id: site.id })}
                                className="w-full py-1.5 border border-dashed border-gray-200 dark:border-white/10 rounded-lg text-[10px] text-gray-400 hover:text-brand-purple hover:border-brand-purple/40 transition-all flex items-center justify-center gap-1 mt-1"
                              >
                                <Plus size={10} /> Add Post
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* + New Site card */}
                      <button
                        title="Add Site to this Branch"
                        onClick={() => openModal('site', { centre_id: centre.id })}
                        className="min-h-[120px] rounded-xl border-2 border-dashed border-gray-200 dark:border-white/10 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-brand-purple hover:border-brand-purple/40 transition-all bg-white/40 dark:bg-transparent hover:bg-brand-purple/3"
                      >
                        <div className="w-8 h-8 border-2 border-current border-dashed rounded-xl flex items-center justify-center">
                          <Plus size={16} />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-widest">New Site</span>
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {modalType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-3xl p-8 w-full max-w-2xl shadow-2xl relative my-auto"
            >
              <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-100 dark:border-dark-border">
                <div>
                  <h3 className="text-2xl font-bold tracking-tight">
                    {editingItem?.id ? 'Edit' : 'Create New'} {getLocationLabel()}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-dark-text mt-1">
                    Manage {getLocationLabel().toLowerCase()} details.
                  </p>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-surface rounded-xl transition-colors" title="Close modal">
                   <X size={20} className="text-gray-400"/>
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                {modalType === 'centre' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500">Branch Name</label>
                        <input 
                          id="branch-name"
                          title="Branch Name"
                          required
                          className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm"
                          value={formData.name || ''}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          placeholder="e.g. Westlands HQ"
                        />
                      </div>
                      <CountyPicker
                        value={formData.county || ''}
                        onChange={(county) => setFormData({ ...formData, county })}
                        label="County"
                        title="Branch County"
                        placeholder="Select county"
                      />
                    </div>
                  </>
                )}

                {modalType === 'site' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500">Parent Branch</label>
                      <select 
                        required
                        title="Parent Branch"
                        className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm"
                        value={formData.centre_id || ''}
                        onChange={(e) => setFormData({...formData, centre_id: e.target.value})}
                      >
                         <option value="">Select Branch</option>
                         {centres.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500">Site Name</label>
                      <input 
                        required
                        title="Site Name"
                        className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                  </div>
                )}

                {modalType === 'post' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500">Parent Site</label>
                      <select 
                        required
                        title="Parent Site"
                        className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm"
                        value={formData.site_id || ''}
                        onChange={(e) => setFormData({...formData, site_id: e.target.value})}
                      >
                         <option value="">Select Site</option>
                         {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500">Post Name</label>
                      <input 
                        required
                        title="Post Name"
                        className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-500">Guards Required</label>
                      <input 
                        type="number"
                        min="1"
                        title="Guards Required"
                        required
                        className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm"
                        value={formData.required_guards || 1}
                        onChange={(e) => setFormData({...formData, required_guards: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-6">
                  <button type="button" onClick={closeModal} className="px-6 py-3 text-sm font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-surface rounded-xl transition-all">Cancel</button>
                  <button type="submit" className="px-8 py-3 bg-brand-purple text-white text-sm font-bold rounded-xl hover:bg-brand-purple/90 transition-all shadow-xl shadow-brand-purple/20">
                     {getLocationActionLabel()}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {assignmentDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-3xl p-8 w-full max-w-2xl shadow-2xl relative my-auto"
            >
                <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-100 dark:border-dark-border">
                  <div>
                  <h3 className="text-2xl font-bold tracking-tight">Assign Guard Duty</h3>
                  <p className="text-sm text-gray-500 dark:text-dark-text mt-1">
                    Create a roster assignment directly from <span className="font-semibold text-brand-purple">{sites.find((site) => site.id === assignmentDraft.site_id)?.name || centres.find((centre) => centre.id === assignmentDraft.centre_id)?.name || 'selected branch'}</span>.
                  </p>
                </div>
                <button onClick={closeAssignmentModal} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-surface rounded-xl transition-colors" title="Close modal">
                  <X size={20} className="text-gray-400"/>
                </button>
              </div>

              <form onSubmit={handleAssignGuardDuty} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Branch</label>
                    <input
                      readOnly
                      value={centres.find((centre) => centre.id === assignmentDraft.centre_id)?.name || 'Selected branch'}
                      className="w-full bg-gray-100 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Site</label>
                    <select
                      title="Select site"
                      className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm"
                      value={assignmentDraft.site_id}
                      onChange={(e) => setAssignmentDraft({ ...assignmentDraft, site_id: e.target.value, post_id: '' })}
                    >
                      <option value="">Select site</option>
                      {(assignmentDraft.centre_id ? sites.filter((site) => site.centre_id === assignmentDraft.centre_id) : sites).map((site) => (
                        <option key={site.id} value={site.id}>{site.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">Post</label>
                  <select
                    title="Operational Post"
                    className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm"
                    value={assignmentDraft.post_id}
                    onChange={(e) => setAssignmentDraft({ ...assignmentDraft, post_id: e.target.value })}
                    disabled={!assignmentDraft.site_id}
                  >
                    <option value="">Site-wide coverage</option>
                    {posts.filter((post) => post.site_id === assignmentDraft.site_id).map((post) => (
                      <option key={post.id} value={post.id}>{post.name}</option>
                    ))}
                  </select>
                  {!assignmentDraft.site_id && (
                    <p className="text-[11px] text-amber-500">Choose a site before selecting a post.</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">Shift bucket</label>
                  <select
                    title="Select shift bucket"
                    className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm"
                    value={assignmentDraft.shift_kind}
                    onChange={(e) => {
                      const shift_kind = e.target.value as SiteAssignmentDraft['shift_kind'];
                      setAssignmentDraft({
                        ...assignmentDraft,
                        shift_kind,
                        start_time: shiftKindTimes[shift_kind].start_time || assignmentDraft.start_time,
                        end_time: shiftKindTimes[shift_kind].end_time || assignmentDraft.end_time,
                      });
                    }}
                  >
                    <option value="day">Day</option>
                    <option value="night">Night</option>
                    <option value="custom">Custom</option>
                  </select>
                  <p className="text-[11px] text-gray-400">
                    Day stores 06:00 AM to 06:00 PM, Night stores 06:00 PM to 06:00 AM, and Custom keeps your chosen times.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Guards</label>
                      <p className="text-[11px] text-gray-400">Add as many guards to this site as you need.</p>
                    </div>
                    <button
                      type="button"
                      onClick={addAssignmentRow}
                      className="rounded-lg border border-brand-purple/20 px-3 py-2 text-xs font-bold text-brand-purple hover:bg-brand-purple/5"
                    >
                      Add Guard
                    </button>
                  </div>

                  <div className="space-y-3">
                    {assignmentDraft.assignments.map((assignment, index) => (
                      <div key={`assignment-${index}`} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-dark-border dark:bg-dark-surface">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Assignment {index + 1}</p>
                          {assignmentDraft.assignments.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeAssignmentRow(index)}
                              className="text-xs font-bold text-rose-500 hover:text-rose-600"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500">Guard</label>
                            <select
                              required
                              title="Assign Guard"
                              className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface"
                              value={assignment.employee_id}
                              onChange={(e) => updateAssignmentRow(index, 'employee_id', e.target.value)}
                            >
                              <option value="">Select guard</option>
                              {guards.map((guard) => {
                                const alreadyAssignedToday = assignmentDraft
                                  ? isGuardScheduledOnDate(guard.id, shifts, assignmentDraft.shift_date)
                                  : false;
                                const selectedElsewhere = selectedAssignmentGuardIds.includes(guard.id) && guard.id !== assignment.employee_id;
                                const disabled = (alreadyAssignedToday && guard.id !== assignment.employee_id) || selectedElsewhere;
                                return (
                                  <option key={guard.id} value={guard.id} disabled={disabled}>
                                    {formatGuardDropdownLabel(guard, alreadyAssignedToday && guard.id !== assignment.employee_id)}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500">Off Duty Releaver</label>
                            <select
                              title="Assign Off Duty Releaver"
                              className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm dark:border-dark-border dark:bg-dark-surface"
                              value={assignment.replacement_id}
                              onChange={(e) => updateAssignmentRow(index, 'replacement_id', e.target.value)}
                            >
                              <option value="">Optional backup</option>
                              {guards
                                .filter((guard) => guard.id !== assignment.employee_id || guard.id === assignment.replacement_id)
                                .map((guard) => {
                                  const alreadyAssignedToday = assignmentDraft
                                    ? isGuardScheduledOnDate(guard.id, shifts, assignmentDraft.shift_date)
                                    : false;
                                  const selectedElsewhere = selectedAssignmentGuardIds.includes(guard.id) && guard.id !== assignment.replacement_id;
                                  const disabled = (alreadyAssignedToday && guard.id !== assignment.replacement_id) || selectedElsewhere;
                                  return (
                                    <option key={guard.id} value={guard.id} disabled={disabled}>
                                      {formatGuardDropdownLabel(guard, alreadyAssignedToday && guard.id !== assignment.replacement_id)}
                                    </option>
                                  );
                                })}
                            </select>
                            {assignment.replacement_id && (
                              <p className="text-[11px] font-medium text-gray-500">
                                Selected releaver: {guards.find((guard) => guard.id === assignment.replacement_id)?.full_name || assignment.replacement_id}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Duty Date</label>
                    <input
                      required
                      type="date"
                      title="Duty Date"
                      className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm"
                      value={assignmentDraft.shift_date}
                      onChange={(e) => setAssignmentDraft({ ...assignmentDraft, shift_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">Start Time</label>
                    <input
                      required
                      type="time"
                      title="Start Time"
                      className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm"
                      value={assignmentDraft.start_time}
                      onChange={(e) => setAssignmentDraft({ ...assignmentDraft, start_time: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500">End Time</label>
                    <input
                      required
                      type="time"
                      title="End Time"
                      className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm"
                      value={assignmentDraft.end_time}
                      onChange={(e) => setAssignmentDraft({ ...assignmentDraft, end_time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-brand-purple/10 bg-brand-purple/5 px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                  Saving here creates the duty directly in roster planning, so operations staff do not have to go back to the roster page.
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500">Notes</label>
                  <textarea
                    rows={3}
                    title="Assignment Notes"
                    className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3 text-sm"
                    value={assignmentDraft.notes}
                    onChange={(e) => setAssignmentDraft({ ...assignmentDraft, notes: e.target.value })}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={closeAssignmentModal} className="px-6 py-3 text-sm font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-surface rounded-xl transition-all">
                    Cancel
                  </button>
                  <button type="submit" disabled={assigningGuard} className="px-8 py-3 bg-brand-purple text-white text-sm font-bold rounded-xl hover:bg-brand-purple/90 transition-all shadow-xl shadow-brand-purple/20 disabled:opacity-60">
                    {assigningGuard ? 'Assigning...' : 'Assign To Roster'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LocationsManagement;
