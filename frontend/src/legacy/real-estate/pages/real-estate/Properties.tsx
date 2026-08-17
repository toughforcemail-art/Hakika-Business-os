// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Plus, Edit2, Trash2, Home, Users, DollarSign, Droplets,
  FileWarning, UserCog, Upload, X, Save, AlertTriangle, MapPin,
  Phone, Mail, Zap, Wifi, Trash, Clock, FileText, CheckSquare, Square, Printer, Search
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import AddableSelect from '../../components/AddableSelect';
import { UnifiedStorageService } from '../../services/UnifiedStorageService';
import { cache } from '../../utils/cache';
import { PropertyCardSkeleton } from '../../components/Skeleton';
import CountyPicker from '../../components/security/CountyPicker';
import {
  buildScopedCacheKey,
  calculatePlannedUnitTotals,
  createEmptyPlannedUnitMixEntry,
  createInspectionTemplateFromUnitMix,
  getUnitTypeLabel,
  normalizePlannedUnitMix,
  PlannedUnitMixEntry,
} from '../../utils/realEstate';
import { activityLogger } from '../../utils/activityLogger';
import { resolveCompanyScope } from '../../utils/companyScope';

interface Property {
  id: string;
  name: string;
  address: string | null;
  property_type: string;
  status: string;
  total_units?: number | null;
  photo_url?: string | null;
  photos?: string[] | null;
  re_units?: { id: string; status: string; rent_amount: number }[];
  stats?: {
    total_units: number;
    vacant_units: number;
    month_due: number;
    month_paid: number;
    total_due: number;
    total_paid: number;
  };
  created_at: string;
  county?: string | null;
  location?: string | null;
  sublocation?: string | null;
  village?: string | null;
  lra_no?: string | null;
  deposit_paid_to?: string;
  rent_paid_to?: string;
  notify_email?: boolean;
  notify_sms?: boolean;
  water_config?: string;
  water_fixed_amount?: number;
  electricity_config?: string;
  electricity_fixed_amount?: number;
  garbage_config?: string;
  garbage_fixed_amount?: number;
  internet_config?: string;
  internet_fixed_amount?: number;
  service_charge_notes?: string | null;
  late_penalty_enabled?: boolean;
  late_penalty_pct?: number;
  tax_declared?: boolean;
  invoice_channels?: string;
  billing_repeat_every?: string | null;
  billing_day?: number | null;
  billing_time?: string | null;
  billing_effective_from?: string | null;
  billing_effective_to?: string | null;
  due_day_rule?: string | null;
  due_day_offset?: number | null;
  due_month_mode?: string | null;
  service_fee_mode?: string | null;
  service_fee_value?: number | null;
  service_fee_name?: string | null;
  total_bedrooms?: number | null;
  planned_unit_mix?: PlannedUnitMixEntry[] | null;
  components?: any[] | null;
  inspection_config?: any[] | null;
}

interface PropertyFormData {
  name: string;
  address: string;
  property_type: string;
  status: string;
  county: string;
  location: string;
  sublocation: string;
  village: string;
  lra_no: string;
  deposit_paid_to: string;
  rent_paid_to: string;
  notify_email: boolean;
  notify_sms: boolean;
  water_config: string;
  water_fixed_amount: number;
  electricity_config: string;
  electricity_fixed_amount: number;
  garbage_config: string;
  garbage_fixed_amount: number;
  internet_config: string;
  internet_fixed_amount: number;
  service_charge_notes: string;
  late_penalty_enabled: boolean;
  late_penalty_pct: number;
  tax_declared: boolean;
  invoice_channels: string;
  billing_repeat_every: string;
  billing_day: number;
  billing_time: string;
  billing_effective_from: string;
  billing_effective_to: string;
  due_day_rule: string;
  due_day_offset: number;
  due_month_mode: string;
  service_fee_mode: string;
  service_fee_value: number;
  service_fee_name: string;
  total_bedrooms: number;
  planned_unit_mix: PlannedUnitMixEntry[];
  components: any[];
  inspection_config: any[];
}

const EMPTY_FORM: PropertyFormData = {
  name: '',
  address: '',
  property_type: 'Residential',
  status: 'Active',
  county: '',
  location: '',
  sublocation: '',
  village: '',
  lra_no: '',
  deposit_paid_to: 'landlord',
  rent_paid_to: 'landlord',
  notify_email: true,
  notify_sms: false,
  water_config: 'not_charged',
  water_fixed_amount: 0,
  electricity_config: 'not_charged',
  electricity_fixed_amount: 0,
  garbage_config: 'not_charged',
  garbage_fixed_amount: 0,
  internet_config: 'not_charged',
  internet_fixed_amount: 0,
  service_charge_notes: '',
  late_penalty_enabled: false,
  late_penalty_pct: 10,
  tax_declared: false,
  invoice_channels: 'email',
  billing_repeat_every: 'monthly',
  billing_day: 1,
  billing_time: '08:00',
  billing_effective_from: '',
  billing_effective_to: '',
  due_day_rule: 'invoice_day',
  due_day_offset: 0,
  due_month_mode: 'same_month',
  service_fee_mode: 'percent',
  service_fee_value: 10,
  service_fee_name: 'Service Fee',
  total_bedrooms: 0,
  planned_unit_mix: [],
  components: [],
  inspection_config: [],
};

function parseChannels(raw: string | undefined): Set<string> {
  if (!raw) return new Set(['email']);
  return new Set(raw.split(',').map(s => s.trim()).filter(Boolean));
}

function serializeChannels(set: Set<string>): string {
  return Array.from(set).join(',');
}

const SectionTitle = ({ icon: Icon, label }: { icon: React.ElementType; label: string }) => (
  <div className="flex items-center gap-2 pt-2 pb-1 border-b border-gray-200 dark:border-white/10 col-span-full">
    <Icon size={16} className="text-brand-purple" />
    <span className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">{label}</span>
  </div>
);

const RadioGroup = ({ name, value, options, onChange }: { name: string; value: string; options: { val: string; label: string }[]; onChange: (v: string) => void }) => (
  <div className="flex flex-wrap gap-4">
    {options.map(opt => (
      <label key={opt.val} className="flex items-center gap-2 cursor-pointer">
        <input type="radio" name={name} value={opt.val} checked={value === opt.val} onChange={() => onChange(opt.val)} className="hidden" />
        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${value === opt.val ? 'border-brand-purple' : 'border-gray-300 dark:border-white/20'}`}>
          {value === opt.val && <div className="w-2 h-2 bg-brand-purple rounded-full" />}
        </div>
        <span className={`text-sm ${value === opt.val ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-500'}`}>{opt.label}</span>
      </label>
    ))}
  </div>
);

export default function Properties() {
  const { profile } = useAccess();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [propertyPhotos, setPropertyPhotos] = useState<{ url: string; file?: File }[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoJumpRequested, setPhotoJumpRequested] = useState(false);
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const photosSectionRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [invoiceChannels, setInvoiceChannels] = useState<Set<string>>(new Set(['email']));
  const scopedPropertiesCacheKey = buildScopedCacheKey('properties_list', resolvedCompanyId ?? profile?.company_id);

  useEffect(() => {
    let active = true;
    const syncScope = async () => {
      const { companyId } = await resolveCompanyScope(profile);
      if (active) setResolvedCompanyId(companyId);
    };
    void syncScope();
    return () => {
      active = false;
    };
  }, [profile]);

  useEffect(() => {
    cache.remove(scopedPropertiesCacheKey);
    setProperties([]);
    setLoading(true);
  }, [scopedPropertiesCacheKey]);

  const F = (patch: Partial<typeof EMPTY_FORM>) => setFormData(prev => ({ ...prev, ...patch }));
  const normalizeOptionalDate = (value: string) => value.trim() ? value : null;

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const propertySelects = [
        '*, re_units(id, status, rent_amount)',
        'id, name, address, property_type, status, re_units(id, status, rent_amount)',
      ] as const;

      let data: any[] | null = null;
      let lastError: unknown = null;
      for (const select of propertySelects) {
        const response = await supabase
          .from('re_properties')
          .select(select)
          .is('deleted_at', null)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });
        if (!response.error) {
          data = response.data;
          lastError = null;
          break;
        }
        lastError = response.error;
      }
      if (lastError) throw lastError;

      // Fetch financial stats for all properties
      const propertyIds = (data || []).map((property) => property.id);
      const { data: statsData } = propertyIds.length > 0
        ? await supabase
        .from('re_property_stats')
        .select('*')
        .in('property_id', propertyIds)
        : { data: [] as any[] };

      const merged = (data || []).map(p => ({
        ...p,
        planned_unit_mix: normalizePlannedUnitMix(p.planned_unit_mix),
        stats: statsData?.find(s => s.property_id === p.id)
      }));

      setProperties(merged);
      cache.set(scopedPropertiesCacheKey, merged);
    } catch (error: any) {
      console.error('Fetch error:', error);
      setToast({ message: 'Failed to load properties', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) fetchProperties();
  }, [profile]);

  const openAddForm = () => {
    setEditingId(null);
    setFormData({ ...EMPTY_FORM });
    setInvoiceChannels(new Set(['email']));
    setPropertyPhotos([]);
    setShowForm(true);
  };

  useEffect(() => {
    if (!showForm || !photoJumpRequested) return;
    const timer = window.setTimeout(() => {
      photosSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setPhotoJumpRequested(false);
    }, 100);
    return () => window.clearTimeout(timer);
  }, [showForm, photoJumpRequested]);

  const openEditForm = (p: Property, options?: { focusPhotos?: boolean }) => {
    setEditingId(p.id);
    setFormData({
      name: p.name || '',
      address: p.address || '',
      property_type: p.property_type || 'Residential',
      status: p.status || 'Active',
      county: p.county || '',
      location: p.location || '',
      sublocation: p.sublocation || '',
      village: p.village || '',
      lra_no: p.lra_no || '',
      deposit_paid_to: p.deposit_paid_to || 'landlord',
      rent_paid_to: p.rent_paid_to || 'landlord',
      notify_email: p.notify_email ?? true,
      notify_sms: p.notify_sms ?? false,
      water_config: p.water_config === 'meter' ? 'metered' : (p.water_config || 'not_charged'),
      water_fixed_amount: p.water_fixed_amount || 0,
      electricity_config: p.electricity_config === 'meter' ? 'metered' : (p.electricity_config || 'not_charged'),
      electricity_fixed_amount: p.electricity_fixed_amount || 0,
      garbage_config: p.garbage_config || 'not_charged',
      garbage_fixed_amount: p.garbage_fixed_amount || 0,
      internet_config: p.internet_config || 'not_charged',
      internet_fixed_amount: p.internet_fixed_amount || 0,
      service_charge_notes: p.service_charge_notes || '',
      late_penalty_enabled: p.late_penalty_enabled ?? false,
      late_penalty_pct: p.late_penalty_pct ?? 10,
      tax_declared: p.tax_declared ?? false,
      invoice_channels: p.invoice_channels || 'email',
      billing_repeat_every: p.billing_repeat_every || 'monthly',
      billing_day: p.billing_day ?? 1,
      billing_time: p.billing_time || '08:00',
      billing_effective_from: p.billing_effective_from || '',
      billing_effective_to: p.billing_effective_to || '',
      due_day_rule: p.due_day_rule || 'invoice_day',
      due_day_offset: p.due_day_offset ?? 0,
      due_month_mode: p.due_month_mode || 'same_month',
      service_fee_mode: p.service_fee_mode || 'percent',
      service_fee_value: p.service_fee_value ?? 10,
      service_fee_name: p.service_fee_name || 'Service Fee',
      total_bedrooms: p.total_bedrooms || 0,
      planned_unit_mix: normalizePlannedUnitMix(p.planned_unit_mix),
      components: p.components || [],
      inspection_config: p.inspection_config || [],
    });
    setInvoiceChannels(parseChannels(p.invoice_channels));
    const existing = p.photos || (p.photo_url ? [p.photo_url] : []);
    setPropertyPhotos(existing.map(url => ({ url })));
    setPhotoJumpRequested(Boolean(options?.focusPhotos));
    setShowForm(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const newPhotos = files.map((file: File) => ({
      url: URL.createObjectURL(file),
      file
    }));
    setPropertyPhotos(prev => [...prev, ...newPhotos]);
  };

  const removePhoto = (index: number) => {
    setPropertyPhotos(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      if (prev[index].file) {
        URL.revokeObjectURL(prev[index].url);
      }
      return filtered;
    });
  };

  const uploadPhotos = async (): Promise<{ urls: string[]; failed: boolean; errorMessage?: string }> => {
    const filesToUpload = propertyPhotos.filter(p => !!p.file).map(p => p.file!);
    const existingUrls = propertyPhotos.filter(p => !p.file).map(p => p.url);

    if (filesToUpload.length === 0) return { urls: existingUrls, failed: false };
    
    setUploadingPhoto(true);
    try {
      const { results, hasFailures, failures } = await UnifiedStorageService.uploadMultiple(filesToUpload, {
        folder: '/properties',
        bucket: 'property-photos'
      });
      
      const newUrls = results; // Unified gives back string[] directly
      
      // Cleanup object URLs for successful uploads
      propertyPhotos.forEach(p => {
        if (p.file && results.some(url => url.includes(p.file!.name.replace(/\s+/g, '_')))) {
          URL.revokeObjectURL(p.url);
        }
      });

      if (hasFailures) {
        const errorMessage = failures
          .slice(0, 2)
          .map((failure) => `${failure.fileName}: ${failure.message}`)
          .join(' | ');
        return { urls: [...existingUrls, ...newUrls], failed: true, errorMessage: errorMessage || 'One or more photo uploads failed.' };
      }

      return { urls: [...existingUrls, ...newUrls], failed: false };
    } catch (err: any) {
      console.error('Photo upload error:', err);
      return { urls: existingUrls, failed: true, errorMessage: err?.message || 'Photo upload failed.' };
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setToast({ message: 'Property name is required', type: 'warning' });
      return;
    }
    setIsSubmitting(true);
    try {
      const { urls, failed: photoFailed, errorMessage: photoErrorMessage } = await uploadPhotos();
      const normalizedMix = normalizePlannedUnitMix(formData.planned_unit_mix);
      const plannedTotals = calculatePlannedUnitTotals(normalizedMix);
      const generatedInspectionTemplate = (formData.inspection_config || []).length > 0
        ? formData.inspection_config
        : createInspectionTemplateFromUnitMix(normalizedMix);
      const payload: any = {
        ...formData,
        billing_effective_from: normalizeOptionalDate(formData.billing_effective_from),
        billing_effective_to: normalizeOptionalDate(formData.billing_effective_to),
        total_units: plannedTotals.totalUnits,
        total_bedrooms: formData.total_bedrooms || plannedTotals.totalBedrooms,
        planned_unit_mix: normalizedMix,
        inspection_config: generatedInspectionTemplate,
        invoice_channels: serializeChannels(invoiceChannels),
        photos: urls,
        photo_url: urls.length > 0 ? urls[0] : null
      };
      if (resolvedCompanyId) payload.company_id = resolvedCompanyId;

      if (editingId) {
        const { error } = await supabase.from('re_properties').update(payload).eq('id', editingId);
        if (error) throw error;
        setToast({
          message: photoFailed
            ? `Property updated, but photo upload failed: ${photoErrorMessage || 'unknown error'}`
            : 'Property updated successfully!',
          type: photoFailed ? 'warning' : 'success'
        });
      } else {
        if (profile?.id) { payload.owner_id = profile.id; payload.created_by = profile.id; }
        const { error } = await supabase.from('re_properties').insert([payload]);
        if (error) throw error;
        setToast({
          message: photoFailed
            ? `Property saved, but photo upload failed: ${photoErrorMessage || 'unknown error'}`
            : 'Property added successfully!',
          type: photoFailed ? 'warning' : 'success'
        });
      }
      setShowForm(false);
      setFormData({ ...EMPTY_FORM });
      setInvoiceChannels(new Set(['email']));
      setPropertyPhotos([]);
      fetchProperties();
    } catch (error: any) {
      setToast({ message: error.message || 'Error saving property', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const property = properties.find((item) => item.id === deleteId);
      const { error } = await supabase.rpc('archive_record', { p_table_name: 're_properties', p_record_id: deleteId, p_reason: 'delete' });
      if (error) throw error;
      void activityLogger.logDataAction('delete', 're_properties', deleteId, property?.name || 'Property');
      setToast({ message: 'Property archived.', type: 'success' });
      setDeleteId(null);
      fetchProperties();
    } catch (error: any) {
      const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
      if (message.includes('re_units_property_id_fkey') || (message.includes('foreign key constraint') && message.includes('re_units'))) {
        setToast({
          message: 'Delete the linked units first, then delete this property.',
          type: 'warning'
        });
      } else {
        setToast({ message: error.message || 'Error deleting property', type: 'error' });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleChannel = (ch: string) => {
    setInvoiceChannels(prev => {
      const next = new Set(prev);
      next.has(ch) ? next.delete(ch) : next.add(ch);
      return next;
    });
  };

  const updatePlannedUnitMix = (id: string, patch: Partial<PlannedUnitMixEntry>) => {
    F({
      planned_unit_mix: (formData.planned_unit_mix || []).map((entry) =>
        entry.id === id ? { ...entry, ...patch } : entry
      ),
    });
  };

  const removePlannedUnitMix = (id: string) => {
    F({
      planned_unit_mix: (formData.planned_unit_mix || []).filter((entry) => entry.id !== id),
    });
  };

  const addPlannedUnitMix = () => {
    F({
      planned_unit_mix: [
        ...(formData.planned_unit_mix || []),
        createEmptyPlannedUnitMixEntry(),
      ],
    });
  };

  const filteredProperties = properties.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.county || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const plannedTotals = calculatePlannedUnitTotals(formData.planned_unit_mix || []);

  const inputCls = "w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white text-sm";
  const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
        {/* Header Row: Search & Add Button */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 max-w-2xl relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-purple transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Search Property"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple outline-none transition-all shadow-sm font-medium"
            />
          </div>
          <button 
            onClick={openAddForm} 
            className="px-8 py-3 bg-brand-purple text-white rounded-xl hover:bg-brand-pink transition-all flex items-center gap-2 text-sm font-bold shadow-lg shadow-brand-purple/20 active:scale-95 whitespace-nowrap"
          >
            Add New Property
          </button>
        </div>

        {/* Info Row */}
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white italic">
            Total Properties: <span className="text-brand-purple">{properties.length}</span>
          </h2>
          {searchTerm && (
            <p className="text-sm text-gray-500 font-medium">Found {filteredProperties.length} results</p>
          )}
        </div>

        {/* Form Section (Conditional) */}
        {showForm && (
          <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl border border-gray-100 dark:border-white/5 mb-10 overflow-hidden animate-in slide-in-from-top duration-500">
            <div className="px-8 py-6 border-b border-gray-100 dark:border-white/10 bg-brand-purple/5 flex justify-between items-center">
              <h2 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight italic">
                {editingId ? 'Edit Property' : 'Add New Property'}
              </h2>
              <button title="Close form" onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors">
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8">
              <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-brand-purple/10 bg-gradient-to-br from-brand-purple/10 via-white to-white p-5 shadow-sm dark:from-brand-purple/15 dark:via-dark-surface dark:to-dark-surface">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-brand-purple">Planned Units</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-gray-900 dark:text-white">{plannedTotals.totalUnits}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Define the mix now, then add actual unit records in the units page.</p>
                </div>
                <div className="rounded-2xl border border-emerald-200/60 bg-white p-5 shadow-sm dark:border-emerald-500/10 dark:bg-dark-surface">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">Planned Bedrooms</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-gray-900 dark:text-white">{plannedTotals.totalBedrooms || formData.total_bedrooms || 0}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Used to guide inspection templates and portfolio sizing.</p>
                </div>
                <div className="rounded-2xl border border-amber-200/60 bg-white p-5 shadow-sm dark:border-amber-500/10 dark:bg-dark-surface">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400">Inspection Items</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-gray-900 dark:text-white">{(formData.inspection_config || []).reduce((sum: number, section: any) => sum + ((section.items || []).length || 0), 0)}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Checklist defaults can be generated from your planned unit mix.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {/* Basic Info */}
                <SectionTitle icon={Building2} label="General Information" />
                <div className="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Property Name</label>
                    <input type="text" value={formData.name} onChange={e => F({ name: e.target.value })} className={inputCls} placeholder="e.g. Sunset Heights" required />
                  </div>
                  <div>
                    <label className={labelCls}>Property Type</label>
                    <AddableSelect value={formData.property_type} options={['Residential', 'Commercial', 'Mixed Use', 'Industrial', 'Land']} onChange={val => F({ property_type: val })} placeholder="Select type" />
                  </div>
                  <div>
                    <label className={labelCls}>LRA Number</label>
                    <input type="text" value={formData.lra_no} onChange={e => F({ lra_no: e.target.value })} className={inputCls} placeholder="Registration No." />
                  </div>
                  <div>
                    <label className={labelCls}>Property Status</label>
                    <select value={formData.status} onChange={e => F({ status: e.target.value })} className={inputCls} title="Property operational status">
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Under Maintenance">Under Maintenance</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Total Bedrooms</label>
                    <input type="number" value={formData.total_bedrooms} onChange={e => F({ total_bedrooms: Number(e.target.value) })} className={inputCls} placeholder="e.g. 20" />
                  </div>
                  <div className="col-span-full">
                    <label className={labelCls}>Property Components / Amenities</label>
                    <textarea 
                      value={Array.isArray(formData.components) ? formData.components.join(', ') : formData.components} 
                      onChange={e => F({ components: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} 
                      className={inputCls + " h-20"} 
                      placeholder="e.g. Swimming Pool, Gym, Perimeter Wall, Borehole (comma separated)" 
                    />
                  </div>
                </div>

                <SectionTitle icon={Home} label="Planned Unit Mix" />
                <div className="col-span-full space-y-4">
                  <div className="rounded-2xl border border-dashed border-brand-purple/20 bg-brand-purple/5 p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                      <div>
                        <p className="text-sm font-black text-gray-900 dark:text-white">Capture the property setup once</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Example: 10 single rooms, 10 one-bedroom units. Actual unit records can then be added or expanded later in the units page.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => F({ inspection_config: createInspectionTemplateFromUnitMix(formData.planned_unit_mix || []) })}
                          className="rounded-xl border border-brand-purple/20 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-brand-purple transition hover:bg-brand-purple hover:text-white"
                        >
                          Generate Inspection Template
                        </button>
                        <button
                          type="button"
                          onClick={addPlannedUnitMix}
                          className="rounded-xl bg-brand-purple px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-brand-pink"
                        >
                          Add Mix Row
                        </button>
                      </div>
                    </div>
                  </div>

                  {(formData.planned_unit_mix || []).length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                      No unit composition added yet. Start with the expected layouts for this property.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(formData.planned_unit_mix || []).map((entry) => (
                        <div key={entry.id} className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-6 dark:border-white/10 dark:bg-white/5">
                          <div>
                            <label className={labelCls}>Type</label>
                            <select
                              value={entry.type}
                              onChange={(e) => updatePlannedUnitMix(entry.id, { type: e.target.value })}
                              className={inputCls}
                            >
                              {['single_room', 'studio', '1BR', '2BR', '3BR', '4BR', 'commercial', 'office', 'shop'].map((option) => (
                                <option key={option} value={option}>{getUnitTypeLabel(option)}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={labelCls}>Count</label>
                            <input type="number" min="0" value={entry.count} onChange={(e) => updatePlannedUnitMix(entry.id, { count: Number(e.target.value) })} className={inputCls} />
                          </div>
                          <div>
                            <label className={labelCls}>Bedrooms</label>
                            <input type="number" min="0" value={entry.bedrooms} onChange={(e) => updatePlannedUnitMix(entry.id, { bedrooms: Number(e.target.value) })} className={inputCls} />
                          </div>
                          <div>
                            <label className={labelCls}>Bathrooms</label>
                            <input type="number" min="0" value={entry.bathrooms} onChange={(e) => updatePlannedUnitMix(entry.id, { bathrooms: Number(e.target.value) })} className={inputCls} />
                          </div>
                          <div>
                            <label className={labelCls}>Guide Rent</label>
                            <input type="number" min="0" value={entry.default_rent} onChange={(e) => updatePlannedUnitMix(entry.id, { default_rent: Number(e.target.value) })} className={inputCls} placeholder="Optional" />
                          </div>
                          <div className="flex items-end">
                            <button type="button" onClick={() => removePlannedUnitMix(entry.id)} className="w-full rounded-xl border border-rose-200 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-rose-500 transition hover:bg-rose-50 dark:border-rose-500/20 dark:hover:bg-rose-500/10">
                              Remove
                            </button>
                          </div>
                          <div className="md:col-span-2">
                            <label className={labelCls}>Label</label>
                            <input type="text" value={entry.label} onChange={(e) => updatePlannedUnitMix(entry.id, { label: e.target.value })} className={inputCls} placeholder="e.g. Courtyard Singles" />
                          </div>
                          <div className="md:col-span-4">
                            <label className={labelCls}>Notes</label>
                            <input type="text" value={entry.notes} onChange={(e) => updatePlannedUnitMix(entry.id, { notes: e.target.value })} className={inputCls} placeholder="e.g. Shared balcony, washing area, exterior corridor" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <SectionTitle icon={MapPin} label="Location Details" />
                <div className="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <CountyPicker
                    value={formData.county}
                    onChange={(county) => F({ county })}
                    label="County"
                    title="Property County"
                    placeholder="Select county"
                  />
                  <div>
                    <label className={labelCls}>Location</label>
                    <input type="text" value={formData.location} onChange={e => F({ location: e.target.value })} className={inputCls} placeholder="Area" />
                  </div>
                  <div>
                    <label className={labelCls}>Sub-location</label>
                    <input type="text" value={formData.sublocation} onChange={e => F({ sublocation: e.target.value })} className={inputCls} placeholder="Specific area" />
                  </div>
                  <div>
                    <label className={labelCls}>Village / Estate</label>
                    <input type="text" value={formData.village} onChange={e => F({ village: e.target.value })} className={inputCls} placeholder="Estate, block, phase" />
                  </div>
                  <div className="lg:col-span-2">
                    <label className={labelCls}>Full Address</label>
                    <input type="text" value={formData.address} onChange={e => F({ address: e.target.value })} className={inputCls} placeholder="Street, Building, etc" />
                  </div>
                </div>

                <SectionTitle icon={DollarSign} label="Financial Settings" />
                <div className="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className={labelCls}>Deposit Paid To</label>
                    <RadioGroup name="deposit_paid_to" value={formData.deposit_paid_to} onChange={v => F({ deposit_paid_to: v })} options={[{ val: 'landlord', label: 'Landlord' }, { val: 'agent', label: 'Agent' }]} />
                  </div>
                  <div>
                    <label className={labelCls}>Rent Paid To</label>
                    <RadioGroup name="rent_paid_to" value={formData.rent_paid_to} onChange={v => F({ rent_paid_to: v })} options={[{ val: 'landlord', label: 'Landlord' }, { val: 'agent', label: 'Agent' }]} />
                  </div>
                  <div>
                    <label className={labelCls}>Late Penalty (%)</label>
                    <div className="flex items-center gap-3">
                      <button type="button" title="Toggle Late Penalty" onClick={() => F({ late_penalty_enabled: !formData.late_penalty_enabled })} className={`w-10 h-6 rounded-full transition-colors relative ${formData.late_penalty_enabled ? 'bg-brand-purple' : 'bg-gray-300'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.late_penalty_enabled ? 'left-5' : 'left-1'}`} />
                      </button>
                      {formData.late_penalty_enabled && (
                        <input type="number" title="Penalty Percentage" placeholder="%" value={formData.late_penalty_pct} onChange={e => F({ late_penalty_pct: Number(e.target.value) })} className="w-20 bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-3 py-1 rounded text-sm" />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Billing Frequency</label>
                    <select value={formData.billing_repeat_every} onChange={e => F({ billing_repeat_every: e.target.value })} className={inputCls}>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Billing Day</label>
                    <input type="number" min="1" max="31" value={formData.billing_day} onChange={e => F({ billing_day: Number(e.target.value) })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Billing Time</label>
                    <input type="time" value={formData.billing_time} onChange={e => F({ billing_time: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Due Day Rule</label>
                    <select value={formData.due_day_rule} onChange={e => F({ due_day_rule: e.target.value })} className={inputCls}>
                      <option value="invoice_day">On invoice day</option>
                      <option value="days_after_invoice">Days after invoice</option>
                      <option value="next_month_day">Same day next month</option>
                      <option value="end_of_month">End of invoice month</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Due Offset (days)</label>
                    <input type="number" min="0" value={formData.due_day_offset} onChange={e => F({ due_day_offset: Number(e.target.value) })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Due Month Mode</label>
                    <select value={formData.due_month_mode} onChange={e => F({ due_month_mode: e.target.value })} className={inputCls}>
                      <option value="same_month">Same month</option>
                      <option value="next_month">Next month</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Service Fee Mode</label>
                    <select value={formData.service_fee_mode} onChange={e => F({ service_fee_mode: e.target.value })} className={inputCls}>
                      <option value="percent">Percentage</option>
                      <option value="flat">Flat amount</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Service Fee Value</label>
                    <input type="number" min="0" step="0.01" value={formData.service_fee_value} onChange={e => F({ service_fee_value: Number(e.target.value) })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Service Fee Name</label>
                    <input type="text" value={formData.service_fee_name} onChange={e => F({ service_fee_name: e.target.value })} className={inputCls} placeholder="Service Fee" />
                  </div>
                  <div>
                    <label className={labelCls}>Billing Start</label>
                    <input type="date" value={formData.billing_effective_from} onChange={e => F({ billing_effective_from: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Billing End</label>
                    <input type="date" value={formData.billing_effective_to} onChange={e => F({ billing_effective_to: e.target.value })} className={inputCls} />
                  </div>
                </div>

                <SectionTitle icon={Zap} label="Utilities & Services" />
                <div className="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <label className={labelCls}>Water Billing</label>
                    <select value={formData.water_config} onChange={e => F({ water_config: e.target.value })} className={inputCls} title="Water billing configuration">
                      <option value="not_charged">Not Charged</option>
                      <option value="metered">Metered</option>
                      <option value="fixed">Fixed Rate</option>
                    </select>
                    {formData.water_config === 'fixed' && <input type="number" value={formData.water_fixed_amount} onChange={e => F({ water_fixed_amount: Number(e.target.value) })} className="mt-2 w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2 rounded-lg text-sm" placeholder="Monthly amount" />}
                  </div>
                  <div>
                    <label className={labelCls}>Electricity</label>
                    <select value={formData.electricity_config} onChange={e => F({ electricity_config: e.target.value })} className={inputCls} title="Electricity billing configuration">
                      <option value="not_charged">Not Charged</option>
                      <option value="metered">Metered</option>
                      <option value="fixed">Fixed Rate</option>
                    </select>
                    {formData.electricity_config === 'fixed' && <input type="number" value={formData.electricity_fixed_amount} onChange={e => F({ electricity_fixed_amount: Number(e.target.value) })} className="mt-2 w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2 rounded-lg text-sm" placeholder="Monthly amount" />}
                  </div>
                  <div>
                    <label className={labelCls}>Garbage Collection</label>
                    <select value={formData.garbage_config} onChange={e => F({ garbage_config: e.target.value })} className={inputCls} title="Garbage billing configuration">
                      <option value="not_charged">Not Charged</option>
                      <option value="fixed">Fixed Rate</option>
                    </select>
                    {formData.garbage_config === 'fixed' && <input type="number" value={formData.garbage_fixed_amount} onChange={e => F({ garbage_fixed_amount: Number(e.target.value) })} className="mt-2 w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2 rounded-lg text-sm" placeholder="Monthly amount" />}
                  </div>
                  <div>
                    <label className={labelCls}>Internet</label>
                    <select value={formData.internet_config} onChange={e => F({ internet_config: e.target.value })} className={inputCls} title="Internet billing configuration">
                      <option value="not_charged">Not Charged</option>
                      <option value="fixed">Fixed Rate</option>
                    </select>
                    {formData.internet_config === 'fixed' && <input type="number" value={formData.internet_fixed_amount} onChange={e => F({ internet_fixed_amount: Number(e.target.value) })} className="mt-2 w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2 rounded-lg text-sm" placeholder="Monthly amount" />}
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelCls}>Service Charge Notes</label>
                    <textarea value={formData.service_charge_notes} onChange={e => F({ service_charge_notes: e.target.value })} className={inputCls + " h-24"} placeholder="Notes about garbage, security, shared cleaning, parking, or any service charge logic." />
                  </div>
                </div>

                <SectionTitle icon={Mail} label="Communication" />
                <div className="col-span-full grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <label className={labelCls}>Auto Notifications</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={formData.notify_email} onChange={e => F({ notify_email: e.target.checked })} className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple" />
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Email</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={formData.notify_sms} onChange={e => F({ notify_sms: e.target.checked })} className="rounded border-gray-300 text-brand-purple focus:ring-brand-purple" />
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">SMS</span>
                      </label>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Invoice Delivery Channels</label>
                    <div className="flex flex-wrap gap-2">
                      {['email', 'sms', 'whatsapp'].map(ch => (
                        <button key={ch} type="button" onClick={() => toggleChannel(ch)} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${invoiceChannels.has(ch) ? 'bg-brand-purple text-white shadow-lg shadow-brand-purple/20' : 'bg-gray-100 dark:bg-white/5 text-gray-400 hover:bg-gray-200'}`}>
                          {ch === 'email' && <Mail size={10} className="inline mr-1" />}
                          {ch === 'sms' && <Phone size={10} className="inline mr-1" />}
                          {ch === 'whatsapp' && <span className="mr-1">💬</span>}
                          {ch}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <SectionTitle icon={Upload} label="Property Photos" />
                <div ref={photosSectionRef} className="col-span-full flex flex-wrap gap-4">
                  {propertyPhotos.map((p, idx) => (
                    <div key={idx} className="relative group/img">
                      <img src={p.url} alt={`Preview ${idx + 1}`} className="w-24 h-24 rounded-xl object-cover border border-gray-200 dark:border-white/10 shadow" />
                      <button 
                        type="button" 
                        onClick={() => removePhoto(idx)} 
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow opacity-0 group-hover/img:opacity-100 transition-opacity" 
                        title="Remove photo"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 dark:border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-brand-purple transition-colors text-gray-400 hover:text-brand-purple"
                    title="Upload property photo"
                  >
                    <Plus size={20} />
                    <span className="text-[10px] mt-1 font-bold uppercase tracking-widest">Add More</span>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} title="Property photo upload" />
                </div>

                <SectionTitle icon={CheckSquare} label="Inspection Checklist Configuration" />
                <div className="col-span-full space-y-4">
                  <p className="text-xs text-gray-500 font-medium italic mb-2">Configure the default sections and items that will appear on inspection reports for this property.</p>
                  
                  {(formData.inspection_config || []).length === 0 && (
                    <button 
                      type="button" 
                      onClick={() => F({ inspection_config: [
                        { section: 'Living Room', items: ['Door & Locks', 'Windows', 'Walls & Paint', 'Floor'] },
                        { section: 'Kitchen', items: ['Sink & Faucets', 'Cabinets', 'Countertops'] },
                        { section: 'Combined Washroom', items: ['Toilet Bowl', 'Shower Rose', 'Water Faucets'] }
                      ]})} 
                      className="text-[10px] font-black uppercase tracking-widest text-brand-purple hover:bg-brand-purple/10 px-4 py-2 rounded-lg border border-brand-purple/20 transition-all"
                    >
                      + Load Standard Template
                    </button>
                  )}

                  <div className="space-y-4">
                    {(formData.inspection_config || []).map((sec: any, sIdx: number) => (
                      <div key={sIdx} className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-white/10 group/sec">
                        <div className="flex items-center justify-between mb-3">
                          <input 
                            type="text" 
                            value={sec.section} 
                            onChange={e => {
                              const nc = [...(formData.inspection_config || [])];
                              nc[sIdx] = { ...nc[sIdx], section: e.target.value };
                              F({ inspection_config: nc });
                            }} 
                            className="bg-transparent border-b border-brand-purple/20 focus:border-brand-purple outline-none font-bold text-gray-900 dark:text-white text-sm px-1 py-0.5"
                            placeholder="Section Name (e.g. Master Bedroom)"
                          />
                          <button 
                            type="button" 
                            onClick={() => {
                              const nc = (formData.inspection_config || []).filter((_: any, i: number) => i !== sIdx);
                              F({ inspection_config: nc });
                            }} 
                            className="text-gray-400 hover:text-red-500 opacity-0 group-hover/sec:opacity-100 transition-all"
                            title="Remove Section"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {sec.items.map((item: string, iIdx: number) => (
                            <span key={iIdx} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-dark-surface border border-gray-100 dark:border-white/10 rounded-full text-xs font-medium text-gray-600 dark:text-gray-400">
                              {item}
                              <button 
                                type="button" 
                                title="Remove item"
                                onClick={() => {
                                  const nc = [...(formData.inspection_config || [])];
                                  nc[sIdx].items = nc[sIdx].items.filter((_: any, i: number) => i !== iIdx);
                                  F({ inspection_config: nc });
                                }} 
                                className="hover:text-red-500 transition-colors"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                          <button 
                            type="button" 
                            onClick={() => {
                              const name = window.prompt(`Add item to ${sec.section}:`);
                              if (name) {
                                const nc = [...(formData.inspection_config || [])];
                                nc[sIdx].items = [...nc[sIdx].items, name.trim()];
                                F({ inspection_config: nc });
                              }
                            }}
                            className="text-[10px] font-black uppercase tracking-widest text-brand-purple px-2 py-1 rounded-lg border border-dashed border-brand-purple/20 hover:bg-brand-purple/5 transition-all"
                          >
                            + Add Item
                          </button>
                        </div>
                      </div>
                    ))}
                    <button 
                      type="button" 
                      onClick={() => {
                        F({ inspection_config: [...(formData.inspection_config || []), { section: 'New Section', items: [] }] });
                      }} 
                      className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl text-gray-400 hover:text-brand-purple hover:border-brand-purple transition-all text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                      <Plus size={16} /> Add New Section
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-white/10">
                <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors text-sm font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting || uploadingPhoto} title={editingId ? 'Update this property in the system' : 'Save this property to the system'} className="px-8 py-2 bg-brand-purple text-white rounded-lg hover:bg-brand-pink transition-colors flex items-center gap-2 text-sm font-bold disabled:opacity-50 shadow-sm shadow-brand-purple/30">
                  {(isSubmitting || uploadingPhoto) ? <><CustomLoader size={16} /> Saving...</> : <><Save size={16} /> {editingId ? 'Update Property' : 'Save Property'}</>}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Grid Section */}
        {loading && !properties.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
            {Array.from({ length: 3 }).map((_, i) => <PropertyCardSkeleton key={i} />)}
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="bg-white dark:bg-dark-surface rounded-2xl p-12 text-center border border-gray-100 dark:border-white/5 flex flex-col items-center">
            <div className="w-20 h-20 bg-brand-purple/10 text-brand-purple rounded-full flex items-center justify-center mb-6">
              <Building2 size={40} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 italic uppercase">
              {searchTerm ? 'No matches found' : 'No Properties Found'}
            </h3>
            <p className="text-sm text-gray-500 max-w-sm mb-8 font-medium">
              {searchTerm ? `We couldn't find anything matching "${searchTerm}"` : 'Your property portfolio is empty. Start by adding your first investment.'}
            </p>
            {!searchTerm && (
              <button onClick={openAddForm} className="px-8 py-3 bg-brand-purple text-white rounded-xl hover:bg-brand-pink transition-all font-bold shadow-xl shadow-brand-purple/20">
                Add Property
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
            {filteredProperties.map((property) => {
              const totalUnits = property.stats?.total_units ?? (property.re_units?.length || 0);
              const vacantUnits = property.stats?.vacant_units ?? (property.re_units?.filter(u => u.status === 'vacant').length || 0);
              const paidPct = property.stats?.month_due ? Math.round((property.stats.month_paid / property.stats.month_due) * 100) : 0;
              const plannedMix = normalizePlannedUnitMix(property.planned_unit_mix);
              const plannedMixTotals = calculatePlannedUnitTotals(plannedMix);

              return (
                <div key={property.id} className="group relative bg-white dark:bg-dark-surface rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col border border-transparent hover:border-brand-purple/10">
                  <Link to={`/app/real-estate/properties/${property.id}`} className="flex flex-col flex-grow">
                    {/* Card Image Section */}
                    <div className="relative h-56 overflow-hidden">
                      {property.photo_url ? (
                        <img 
                          src={`${property.photo_url}?tr=w-400,h-300,fo-auto`} 
                          alt={property.name} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-brand-purple/5 to-brand-pink/5 flex items-center justify-center text-brand-purple/20">
                          <Building2 size={64} />
                        </div>
                      )}
                      
                      {/* Paid % Overlay (Circular Progress like screenshot) */}
                      <div className="absolute -bottom-8 left-6">
                        <div className="relative w-24 h-24 bg-white dark:bg-dark-surface rounded-full shadow-xl flex items-center justify-center p-2 border-4 border-gray-50 dark:border-dark-bg">
                          <svg className="w-full h-full" viewBox="0 0 36 36">
                            <circle cx="18" cy="18" r="16" fill="none" className="stroke-gray-100 dark:stroke-white/5" strokeWidth="3" />
                            <circle 
                              cx="18" cy="18" r="16" fill="none" 
                              className="stroke-orange-500" 
                              strokeWidth="4" 
                              strokeDasharray={`${paidPct}, 100`} 
                              strokeLinecap="round"
                              transform="rotate(-90 18 18)"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <span className="text-xs font-black text-orange-500 leading-none">{paidPct}%</span>
                            <span className="text-[8px] font-black text-gray-400 uppercase leading-none mt-1">Paid</span>
                          </div>
                        </div>
                      </div>

                      {/* Vacant Badge Overlay */}
                      <div className="absolute bottom-6 right-6 bg-white dark:bg-dark-surface px-4 py-1.5 rounded-full shadow-lg border border-gray-100 dark:border-white/10">
                        <span className="text-[11px] font-black text-gray-700 dark:text-gray-200 uppercase tracking-widest">{vacantUnits} Vacant</span>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="p-8 pt-12 space-y-4 flex-grow">
                      <div className="flex items-center gap-4">
                        <span className="px-3 py-1 bg-gray-100 dark:bg-white/5 rounded-lg text-[9px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                          {property.property_type || 'Residential'}
                        </span>
                        <div className="flex items-center gap-1.5 text-gray-400">
                          <FileText size={14} className="text-brand-purple/40" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Units {totalUnits}</span>
                          {plannedMixTotals.totalUnits > 0 && (
                            <>
                              <div className="w-1 h-1 bg-gray-300 rounded-full mx-1" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-brand-purple">Plan {plannedMixTotals.totalUnits}</span>
                            </>
                          )}
                          {(property.total_bedrooms || 0) > 0 && (
                            <>
                              <div className="w-1 h-1 bg-gray-300 rounded-full mx-1" />
                              <span className="text-[10px] font-black uppercase tracking-widest">{property.total_bedrooms} Bedrooms</span>
                            </>
                          )}
                        </div>
                      </div>

                      <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight leading-tight group-hover:text-brand-purple transition-colors truncate">
                        {property.name}
                      </h3>

                      <div className="flex items-start gap-2 text-gray-400">
                        <MapPin size={14} className="mt-0.5 flex-shrink-0" />
                        <p className="text-xs font-medium leading-relaxed truncate">{property.address || 'Address not specified'}</p>
                      </div>

                      {property.components && property.components.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          {property.components.slice(0, 3).map((comp: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 bg-brand-purple/5 text-brand-purple rounded text-[8px] font-black uppercase tracking-widest">
                              {comp}
                            </span>
                          ))}
                          {property.components.length > 3 && (
                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest px-1">+{property.components.length - 3} more</span>
                          )}
                        </div>
                      )}

                      {plannedMix.length > 0 && (
                        <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-3 dark:border-white/10 dark:bg-white/5">
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Planned Mix</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {plannedMix.slice(0, 3).map((entry) => (
                              <span key={entry.id} className="rounded-full bg-white px-2 py-1 text-[9px] font-black uppercase tracking-widest text-gray-600 shadow-sm dark:bg-dark-surface dark:text-gray-300">
                                {entry.count} {getUnitTypeLabel(entry.type)}
                              </span>
                            ))}
                            {plannedMix.length > 3 && (
                              <span className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-gray-400">
                                +{plannedMix.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Actions (Outside Link to avoid nested clicks) */}
                  <div className="absolute top-6 right-6 flex gap-2 translate-y-[-20px] opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 z-10">
                    <button 
                      title="Edit" 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditForm(property); }} 
                      className="p-2.5 bg-white shadow-xl text-gray-600 hover:text-brand-purple rounded-xl transition-all"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      title="Update image"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditForm(property, { focusPhotos: true }); }}
                      className="p-2.5 bg-white shadow-xl text-gray-600 hover:text-brand-purple rounded-xl transition-all"
                    >
                      <Upload size={16} />
                    </button>
                    <button
                      title="Delete"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteId(property.id); }}
                      className="p-2.5 bg-rose-500 shadow-xl text-white hover:bg-rose-600 rounded-xl transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-surface rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-white/5">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 italic uppercase tracking-tight">Delete Property?</h3>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-6 leading-relaxed">This will permanently remove the property and all associated history. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button title="Cancel" onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">Cancel</button>
              <button title="Delete confirmed" onClick={handleDelete} disabled={isDeleting} className="flex-1 px-4 py-2 bg-rose-500 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-rose-600 transition-colors shadow-lg shadow-rose-500/20">
                {isDeleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <CustomToast message={toast.message} type={toast.type} isVisible={!!toast} onClose={() => setToast(null)} />}
    </div>
  );
}
