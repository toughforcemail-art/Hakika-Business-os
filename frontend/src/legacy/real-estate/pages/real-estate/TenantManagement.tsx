// @ts-nocheck
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Users, Plus, Home, Phone, Mail, FileText, X, Building2, Calendar, FileSignature, Edit2, Edit, Check, XCircle, Printer, Trash2, UserPlus, Minus, KeyRound, ShieldCheck, ArrowLeftRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { printWorkspacePage } from '../../utils/printHelpers';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { cache } from '../../utils/cache';
import { Skeleton } from '../../components/Skeleton';
import { buildScopedCacheKey } from '../../utils/realEstate';
import { formatPhoneInput, normalizePhoneNumber } from '../../utils/phoneNumbers';
import { getTenantDisplayName } from '../../utils/tenantDisplay';
import { invokeEdgeFunction } from '../../utils/edgeFunctions';
import { ENABLE_REAL_ESTATE_AUDIT } from '../../config/featureFlags';
import { UnifiedStorageService } from '../../services/UnifiedStorageService';

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

interface Unit {
  id: string;
  unit_number: string;
  status?: string | null;
  lease_type?: 'residential' | 'commercial' | null;
  property_id?: string | null;
  property?: { id?: string; name: string } | null;
  rent_amount: number;
}

interface Tenant {
  id: string;
  full_name?: string;
  profile_id?: string | null;
  email: string | null;
  phone: string | null;
  national_id: string | null;
  profile_image_url?: string | null;
  id_document_url?: string | null;
  is_active: boolean;
  lease_start_date: string | null;
  lease_end_date: string | null;
  current_unit_id: string | null;
  login_username?: string | null;
  login_sent_at?: string | null;
  login_resend_count?: number | null;
  login_active?: boolean | null;
  tenant_no?: string | null;
  unit?: Unit;
  emergency_contacts?: EmergencyContact[];
}

// Format datetime in local timezone (East Africa Time - EAT, UTC+3)
const formatDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    // Format: MM/DD/YY, HH:MM:SS AM/PM in local timezone
    return date.toLocaleString('en-US', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Africa/Nairobi' // East Africa Time
    });
  } catch (error) {
    return '-';
  }
};

export default function TenantManagement() {
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAccess();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [tenantIdDocUploading, setTenantIdDocUploading] = useState(false);
  const [tenantPhotoUploading, setTenantPhotoUploading] = useState(false);
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  
  // Rent Edit State inside Modal
  const [isEditingRent, setIsEditingRent] = useState(false);
  const [editRentAmount, setEditRentAmount] = useState<number>(0);
  const [isSavingRent, setIsSavingRent] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: formatPhoneInput(''),
    national_id: '',
    lease_type: 'residential' as 'residential' | 'commercial',
    property_id: '',
    current_unit_id: '',
    lease_start_date: '',
    lease_end_date: '',
    rent_amount: '',
    deposit_amount: '',
    water_deposit_amount: '',
    electricity_deposit_amount: '',
    deposit_paid_to: 'landlord',
    id_document_url: '',
    profile_image_url: ''
  });
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([{ name: '', relationship: '', phone: formatPhoneInput('') }]);
  
  // Invoice & Delete Management State
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [tenantInvoices, setTenantInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [isDeletingTenant, setIsDeletingTenant] = useState(false);
  const [tenantForDeletion, setTenantForDeletion] = useState<Tenant | null>(null);
  const [clearUnitOnly, setClearUnitOnly] = useState(false);
  const tenantTableScrollRef = useRef<HTMLDivElement>(null);
  const tenantTableTopScrollRef = useRef<HTMLDivElement>(null);

  // ── Transfer / Swap flow state ──────────────────────────────────────────
  const [tenantForTransfer, setTenantForTransfer] = useState<Tenant | null>(null);
  // step: 'property-choice' | 'unit-choice' | 'arrears-review' | 'confirm'
  const [transferStep, setTransferStep] = useState<'property-choice' | 'unit-choice' | 'arrears-review' | 'confirm'>('property-choice');
  const [transferSameProperty, setTransferSameProperty] = useState<boolean | null>(null);
  const [transferPropertyId, setTransferPropertyId] = useState('');
  const [transferUnitId, setTransferUnitId] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [transferReason, setTransferReason] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  // Arrears state
  const [transferInvoices, setTransferInvoices] = useState<any[]>([]);
  const [loadingTransferInvoices, setLoadingTransferInvoices] = useState(false);
  const [arrearsAction, setArrearsAction] = useState<Record<string, 'migrate' | 'clear' | 'paid'>>({});
  
  const tenantsCacheKey = buildScopedCacheKey('tenants_list', profile?.company_id);
  const unitsCacheKey = buildScopedCacheKey('available_units', profile?.company_id);

  // Only show real emails — hide synthetic @tenant.local addresses created for Supabase Auth
  const realEmail = (email: string | null | undefined) =>
    email && !email.endsWith('@tenant.local') ? email : null;

  const openTransferDialog = (tenant: Tenant) => {
    setTenantForTransfer(tenant);
    setTransferStep('property-choice');
    setTransferSameProperty(null);
    setTransferPropertyId(tenant.unit?.property?.id || '');
    setTransferUnitId('');
    setTransferDate(new Date().toISOString().slice(0, 10));
    setTransferReason('');
    setTransferInvoices([]);
    setArrearsAction({});
  };

  const loadTransferInvoices = async (tenantId: string) => {
    setLoadingTransferInvoices(true);
    try {
      const { data, error } = await supabase
        .from('re_invoices')
        .select('id, invoice_number, invoice_date, due_date, amount_due, amount_paid, status, invoice_type, notes')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('due_date', { ascending: false });
      if (error) throw error;
      setTransferInvoices(data || []);
      // Default: unpaid invoices → migrate, paid → keep
      const defaults: Record<string, 'migrate' | 'clear' | 'paid'> = {};
      for (const inv of data || []) {
        const balance = Number(inv.amount_due) - Number(inv.amount_paid);
        if (balance > 0) defaults[inv.id] = 'migrate';
        else defaults[inv.id] = 'paid';
      }
      setArrearsAction(defaults);
    } catch (e: any) {
      console.error('Failed to load tenant invoices for transfer', e);
    } finally {
      setLoadingTransferInvoices(false);
    }
  };

  const submitUnitTransfer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantForTransfer || !transferUnitId) return;
    setIsTransferring(true);
    try {
      // 1. Perform the unit swap
      const { error } = await supabase.rpc('swap_tenant_unit', {
        p_tenant_id: tenantForTransfer.id,
        p_to_unit_id: transferUnitId,
        p_effective_date: transferDate,
        p_reason: transferReason || null,
      });
      if (error) throw error;

      // 2. Handle arrears actions for each invoice
      const nowIso = new Date().toISOString();
      for (const inv of transferInvoices) {
        const action = arrearsAction[inv.id];
        const balance = Number(inv.amount_due) - Number(inv.amount_paid);
        if (balance <= 0) continue; // already paid, nothing to do

        if (action === 'migrate') {
          // Re-link invoice to the new unit
          await supabase
            .from('re_invoices')
            .update({ unit_id: transferUnitId, notes: `${inv.notes ? inv.notes + ' | ' : ''}Arrears migrated to new unit on transfer ${transferDate}` })
            .eq('id', inv.id);
        } else if (action === 'clear') {
          // Soft-delete the invoice (write off)
          await supabase
            .from('re_invoices')
            .update({ deleted_at: nowIso, notes: `${inv.notes ? inv.notes + ' | ' : ''}Written off during unit transfer ${transferDate}` })
            .eq('id', inv.id);
        } else if (action === 'paid') {
          // Mark as paid (admin confirmed payment was received)
          await supabase
            .from('re_invoices')
            .update({ status: 'paid', amount_paid: inv.amount_due, notes: `${inv.notes ? inv.notes + ' | ' : ''}Marked paid by admin during transfer ${transferDate}` })
            .eq('id', inv.id);
        }
      }

      setToast({ message: 'Unit swapped. Arrears handled as selected.', type: 'success' });
      setTenantForTransfer(null);
      cache.remove(tenantsCacheKey);
      cache.remove(unitsCacheKey);
      await fetchTenantData();
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to swap tenant unit', type: 'error' });
    } finally {
      setIsTransferring(false);
    }
  };

  // Property filter state
  const [propertyFilter, setPropertyFilter] = useState<string>('');
  const [allProperties, setAllProperties] = useState<{ id: string; name: string }[]>([]);
  const [unitFilter, setUnitFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const syncTenantTableScroll = useCallback((source: 'top' | 'table') => {
    const top = tenantTableTopScrollRef.current;
    const table = tenantTableScrollRef.current;
    if (!top || !table) return;
    if (source === 'top') table.scrollLeft = top.scrollLeft;
    else top.scrollLeft = table.scrollLeft;
  }, []);
  const filteredUnitsForList = useMemo(() => {
    return allUnits.filter((unit) => {
      const matchesProperty = !propertyFilter || unit.property?.id === propertyFilter;
      const matchesUnit = !unitFilter || unit.id === unitFilter;
      return matchesProperty && matchesUnit;
    });
  }, [allUnits, propertyFilter, unitFilter]);

  // Derive properties from already-loaded units + tenants — no extra query needed
  const derivedProperties = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const u of allUnits) {
      if (u.property?.id && u.property?.name) map.set(u.property.id, { id: u.property.id, name: u.property.name });
    }
    for (const t of tenants) {
      if (t.unit?.property?.id && t.unit?.property?.name) map.set(t.unit.property.id, { id: t.unit.property.id, name: t.unit.property.name });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allUnits, tenants]);

  const filteredTenants = useMemo(() => {
    const term = deferredSearchTerm.trim().toLowerCase();
    return tenants.filter((t) => {
      const matchesSearch =
        !term ||
        (t.full_name || '').toLowerCase().includes(term) ||
        (t.phone || '').toLowerCase().includes(term) ||
        (t.email || '').toLowerCase().includes(term) ||
        (t.unit?.unit_number || '').toLowerCase().includes(term) ||
        (t.unit?.property?.name || '').toLowerCase().includes(term);
      const matchesProperty = !propertyFilter || t.unit?.property?.id === propertyFilter;
      const matchesUnit = !unitFilter || t.current_unit_id === unitFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && t.is_active) ||
        (statusFilter === 'inactive' && !t.is_active);
      return matchesSearch && matchesProperty && matchesUnit && matchesStatus;
    });
  }, [deferredSearchTerm, propertyFilter, statusFilter, tenants, unitFilter]);

  const addEmergencyContact = () =>
    setEmergencyContacts(prev => [...prev, { name: '', relationship: '', phone: formatPhoneInput('') }]);

  const removeEmergencyContact = (idx: number) =>
    setEmergencyContacts(prev => prev.filter((_, i) => i !== idx));

  const updateEmergencyContact = (idx: number, field: keyof EmergencyContact, value: string) =>
    setEmergencyContacts(prev => prev.map((c, i) => i === idx ? { ...c, [field]: field === 'phone' ? formatPhoneInput(value) : value } : c));

  const syncMissingInvoices = async () => {
    if (!profile?.company_id) return;

    const candidates = tenants.filter((tenant) => tenant.current_unit_id && tenant.is_active);
    if (candidates.length === 0) {
      setToast({ message: 'No active assigned tenants found to backfill.', type: 'warning' });
      return;
    }

    let created = 0;
    let skipped = 0;

    for (const tenant of candidates) {
      const unitId = tenant.current_unit_id;
      const unit = allUnits.find((item) => item.id === unitId) || tenant.unit || null;
      if (!unitId || !unit) {
        skipped++;
        continue;
      }

      const invoiceDate = tenant.lease_start_date || new Date().toISOString().split('T')[0];
      const dueDate = tenant.lease_start_date || invoiceDate;
      const amountDue = Number(unit.rent_amount || 0);

      const { data: existingInvoice, error: existingInvoiceError } = await supabase
        .from('re_invoices')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('unit_id', unitId)
        .eq('invoice_date', invoiceDate)
        .maybeSingle();

      if (existingInvoiceError) {
        console.error('Failed to check existing invoice during backfill', existingInvoiceError);
        skipped++;
        continue;
      }

      if (existingInvoice?.id) {
        skipped++;
        continue;
      }

      const { error: insertError } = await supabase.from('re_invoices').insert([
        {
          invoice_number: `INV-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
          company_id: profile.company_id,
          tenant_id: tenant.id,
          unit_id: unitId,
          amount_due: amountDue,
          amount_paid: 0,
          due_date: dueDate,
          invoice_date: invoiceDate,
          notes: `Backfilled initial invoice for tenant assignment to unit ${unit.unit_number}`,
          status: 'unpaid',
          created_by: profile.id,
        },
      ]);

      if (insertError) {
        console.error('Failed to backfill invoice', insertError);
        skipped++;
        continue;
      }

      created++;
    }

    setToast({
      message: `Backfill complete. Created ${created} invoice${created === 1 ? '' : 's'}${skipped > 0 ? `, skipped ${skipped}` : ''}.`,
      type: created > 0 ? 'success' : 'warning',
    });

    if (created > 0) {
      fetchTenantData();
    }
  };

  const fetchTenantData = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('re_tenants')
        .select(`id, full_name, profile_id, phone, email, national_id, profile_image_url, id_document_url, current_unit_id, lease_start_date, lease_end_date, is_active, company_id, login_username, login_sent_at, login_resend_count, login_active, tenant_no, emergency_contacts, profile:profiles(full_name, email), unit:re_units!current_unit_id(id, unit_number, rent_amount, lease_type, property:re_properties(id, name))`)
        .eq('is_active', true)
        .abortSignal(signal!);
      if (error) throw error;
      const normalized = (data || []).map((t: any) => {
        const rawUnit = Array.isArray(t.unit) ? t.unit[0] : t.unit;
        const unit = rawUnit ? {
          ...rawUnit,
          property: Array.isArray(rawUnit.property) ? rawUnit.property[0] : rawUnit.property
        } : undefined;
        return {
          ...t,
          unit,
          full_name: t.full_name || t.name || t.display_name || t.profile?.full_name || t.profile?.email?.split('@')[0] || ''
        };
      });
      setTenants(normalized);
      cache.set(tenantsCacheKey, normalized);
    } catch (error: any) {
      if (error?.name === 'AbortError' || error?.message?.includes('AbortError') || error?.message?.includes('aborted')) return;
      console.error('Error in fetchTenantData:', error);
      setToast({ message: error?.message || 'Failed to load tenants', type: 'error' });
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  const fetchAvailableUnits = async (signal?: AbortSignal) => {
    try {
      const { data, error } = await supabase
        .from('re_units')
        .select('id, unit_number, rent_amount, status, lease_type, property_id, property:re_properties(id, name)')
        .eq('status', 'vacant')
        .abortSignal(signal!);
      if (error) throw error;
      
      const normalizedUnits = (data || []).map((u: any) => ({
        ...u,
        property: Array.isArray(u.property) ? u.property[0] : u.property
      }));

      setAvailableUnits(normalizedUnits);
      cache.set(unitsCacheKey, normalizedUnits);
    } catch (error: any) {
      if (error?.name === 'AbortError' || error?.message?.includes('AbortError') || error?.message?.includes('aborted')) return;
      console.error('Error in fetchAvailableUnits:', error);
      setToast({ message: 'Failed to load vacant units', type: 'error' });
    }
  };

  const fetchAllUnits = async (signal?: AbortSignal) => {
    try {
      const { data, error } = await supabase
        .from('re_units')
        .select('id, unit_number, rent_amount, status, lease_type, property_id, property:re_properties(id, name)')
        .order('unit_number')
        .abortSignal(signal!);
      if (error) throw error;

      const normalizedUnits = (data || []).map((u: any) => ({
        ...u,
        property: Array.isArray(u.property) ? u.property[0] : u.property
      }));

      setAllUnits(normalizedUnits);
    } catch (error: any) {
      if (error?.name === 'AbortError' || error?.message?.includes('AbortError') || error?.message?.includes('aborted')) return;
      console.error('Error in fetchAllUnits:', error);
    }
  };

  useEffect(() => {
    if (!profile || authLoading) return;

    const controller = new AbortController();
    const { signal } = controller;

    const cachedTenants = cache.get<Tenant[]>(tenantsCacheKey);
    const cachedUnits = cache.get<Unit[]>(unitsCacheKey);
    if (cachedTenants) {
      setTenants(cachedTenants);
      setLoading(false);
    }
    if (cachedUnits) setAvailableUnits(cachedUnits);

    fetchTenantData(signal);
    fetchAvailableUnits(signal);
    fetchAllUnits(signal);

    const fetchProperties = async () => {
      try {
        const { data, error } = await supabase
          .from('re_properties')
          .select('id, name')
          .order('name')
          .abortSignal(signal);
        if (error) throw error;
        if (!signal.aborted && data && data.length > 0) setAllProperties(data);
      } catch (e: any) {
        if (e?.name === 'AbortError' || e?.message?.includes('AbortError') || e?.message?.includes('aborted')) return;
        console.error('Failed to load properties for filter', e);
      }
    };
    void fetchProperties();

    return () => controller.abort();
  }, [profile, authLoading, tenantsCacheKey, unitsCacheKey]);

  const onboardingUnits = useMemo(() => {
    const unitsToConsider = allUnits.length > 0 ? allUnits : availableUnits;
    return unitsToConsider.filter(unit => {
      const isVacant = unit.status === 'vacant';
      const isCurrentTenantUnit = isEditing && editingTenantId && unit.id === tenants.find(t => t.id === editingTenantId)?.current_unit_id;
      const unitPropertyId = unit.property_id || unit.property?.id;
      const matchesProperty = !formData.property_id || unitPropertyId === formData.property_id;
      return (isVacant || isCurrentTenantUnit) && matchesProperty;
    });
  }, [allUnits, availableUnits, formData.property_id, isEditing, editingTenantId, tenants]);

  const directoryUnits = useMemo(() => (allUnits.length > 0
    ? allUnits
    : tenants.map((tenant) => tenant.unit).filter((unit): unit is Unit => Boolean(unit))
  ), [allUnits, tenants]);

  const getUnitStatusLabel = useCallback((status?: string | null) => {
    if (!status) return 'Unknown';
    return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedTenantPhone = normalizePhoneNumber(formData.phone);
    setIsSubmitting(true);
    try {
      const originalTenant = editingTenantId ? tenants.find((tenant) => tenant.id === editingTenantId) || null : null;
      const originalUnitId = originalTenant?.current_unit_id || null;
      const payload: any = {
        full_name: formData.full_name || 'Unnamed Tenant',
        email: formData.email || null,
        phone: normalizedTenantPhone || null,
        national_id: formData.national_id || null,
        emergency_contacts: emergencyContacts
          .map((contact) => ({
            ...contact,
            phone: normalizePhoneNumber(contact.phone) || '',
          }))
          .filter((contact) => contact.name.trim() || contact.phone.trim()),
        current_unit_id: formData.current_unit_id || null, // Optional if adding to waitlist
        lease_start_date: formData.lease_start_date || null,
        lease_end_date: formData.lease_end_date || null,
        id_document_url: formData.id_document_url || null,
        profile_image_url: formData.profile_image_url || null,
        is_active: true,
        created_by: profile?.id
      };

      // NOTE: login_username is intentionally NOT updated here.
      // It is the tenant's stable portal login credential, set when credentials are first sent.
      // Changing the email in tenant management should not break the tenant's existing login.

      if (profile?.company_id) {
        payload.company_id = profile.company_id;
      }
      
      let tenantError;
      let savedTenantId: string | null = editingTenantId || null;
      if (isEditing && editingTenantId) {
        const updatePayload = { ...payload };
        delete updatePayload.created_by;
        const { error } = await supabase
          .from('re_tenants')
          .update(updatePayload)
          .eq('id', editingTenantId);
        tenantError = error;

        if (!tenantError && originalTenant?.profile_id) {
          await supabase
            .from('profiles')
            .update({
              full_name: payload.full_name,
              email: payload.email,
              phone: payload.phone
            })
            .eq('id', originalTenant.profile_id);
        }
      } else {
        const { data, error } = await supabase
          .from('re_tenants')
          .insert([payload])
          .select('id')
          .maybeSingle();
        tenantError = error;
        if (data?.id) savedTenantId = data.id;
      }
      
      if (tenantError) throw tenantError;

      if (!isEditing && savedTenantId && ENABLE_REAL_ESTATE_AUDIT) {
        try {
          await invokeEdgeFunction('real-estate-audit-tenant-created', {
            actorId: profile?.id,
            organizationId: profile?.organization_id,
            companyId: profile?.company_id,
            entityId: savedTenantId,
            entityName: payload.full_name,
            route: window.location.pathname,
            correlationId: crypto.randomUUID(),
            requestId: crypto.randomUUID(),
            metadata: { tenantEmail: payload.email, tenantPhone: payload.phone },
          });
        } catch (auditError) {
          console.error('Tenant created but audit logging failed', auditError);
        }
      }

      if (isEditing && editingTenantId && originalUnitId && originalUnitId !== formData.current_unit_id) {
        const { error: releaseUnitError } = await supabase
          .from('re_units')
          .update({ status: 'vacant' })
          .eq('id', originalUnitId);

        if (releaseUnitError) {
          console.error('Failed to release previous unit after reassignment', releaseUnitError);
        }

        const { error: releaseLeaseError } = await supabase
          .from('re_leases')
          .update({ status: 'inactive' })
          .eq('tenant_id', editingTenantId)
          .eq('unit_id', originalUnitId)
          .eq('status', 'active');

        if (releaseLeaseError) {
          console.error('Failed to close previous lease after reassignment', releaseLeaseError);
        }
      }
      
      // If a unit was assigned, update the unit status to occupied
      if (formData.current_unit_id) {
        const { data: assignedUnit, error: assignedUnitError } = await supabase
          .from('re_units')
          .select('id, property_id, rent_amount, unit_number, lease_type')
          .eq('id', formData.current_unit_id)
          .maybeSingle();

        if (assignedUnitError) {
          console.error('Failed to load assigned unit for lease sync', assignedUnitError);
        }

        const updatePayload: any = { status: 'occupied' };
        if (formData.rent_amount) {
           updatePayload.rent_amount = Number(formData.rent_amount);
        }
        
        const { error: unitError } = await supabase
          .from('re_units')
          .update(updatePayload)
          .eq('id', formData.current_unit_id);
          
        if (unitError) console.error('Failed to update unit status', unitError);

        if (assignedUnit) {
          const leaseStartDate = formData.lease_start_date || new Date().toISOString().slice(0, 10);
          const leaseEndDate = formData.lease_end_date || new Date(new Date().getFullYear() + 1, new Date().getMonth(), new Date().getDate()).toISOString().slice(0, 10);
          const tenantId = savedTenantId;

        const leasePayload: any = {
            lease_type: formData.lease_type || assignedUnit.lease_type || 'residential',
            tenant_id: tenantId,
            unit_id: assignedUnit.id,
            property_id: assignedUnit.property_id || null,
            rent_amount: Number(formData.rent_amount || assignedUnit.rent_amount || 0),
            deposit_amount: Number(formData.deposit_amount || 0),
            water_deposit_amount: Number(formData.water_deposit_amount || 0),
            electricity_deposit_amount: Number(formData.electricity_deposit_amount || 0),
            deposit_paid_to: formData.deposit_paid_to || 'landlord',
            start_date: leaseStartDate,
            end_date: leaseEndDate,
            payment_day: 1,
            status: 'active'
          };

          if (profile?.company_id) {
            leasePayload.company_id = profile.company_id;
          }

          if (tenantId) {
            const { data: existingLease, error: existingLeaseError } = await supabase
              .from('re_leases')
              .select('id')
              .eq('unit_id', assignedUnit.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (existingLeaseError) {
              console.error('Failed to look up existing lease for assigned tenant', existingLeaseError);
            }

            if (existingLease?.id) {
              const { error: leaseUpdateError } = await supabase
                .from('re_leases')
                .update(leasePayload)
                .eq('id', existingLease.id);

              if (leaseUpdateError) {
                console.error('Failed to update lease for assigned tenant', leaseUpdateError);
              }
            } else {
              const { error: leaseInsertError } = await supabase
                .from('re_leases')
                .insert([leasePayload]);

              if (leaseInsertError) {
                console.error('Failed to create lease for assigned tenant', leaseInsertError);
              }
            }

            const invoiceDate = leaseStartDate;
            const dueDate = formData.lease_start_date || leaseStartDate;
            const invoiceAmount = Number(formData.rent_amount || assignedUnit.rent_amount || 0);

            const { data: existingInvoice, error: existingInvoiceError } = await supabase
              .from('re_invoices')
              .select('id')
              .eq('tenant_id', tenantId)
              .eq('unit_id', assignedUnit.id)
              .eq('invoice_date', invoiceDate)
              .eq('invoice_type', 'rent')
              .maybeSingle();

            if (existingInvoiceError) {
              console.error('Failed to check for existing invoice on tenant assignment', existingInvoiceError);
            }

            if (!existingInvoice?.id) {
              const { error: invoiceError } = await supabase.from('re_invoices').insert([
                {
                  invoice_number: `INV-${Date.now().toString().slice(-8)}`,
                  company_id: profile?.company_id || null,
                  tenant_id: tenantId,
                  unit_id: assignedUnit.id,
                  invoice_type: 'rent',
                  amount_due: invoiceAmount,
                  amount_paid: 0,
                  due_date: dueDate,
                  invoice_date: invoiceDate,
                  notes: `Initial invoice created during tenant assignment for ${assignedUnit.unit_number}`,
                  status: 'unpaid',
                  created_by: profile?.id || null,
                },
              ]);

              if (invoiceError) {
                console.error('Failed to create initial invoice for assigned tenant', invoiceError);
              }
            }
          }
        }
      }
      
      setToast({ message: isEditing ? 'Tenant details updated!' : 'Tenant successfully onboarded!', type: 'success' });
      setShowForm(false);
      setIsEditing(false);
      setEditingTenantId(null);

      // Optimistic update — reflect changes in the table immediately
      if (isEditing && editingTenantId) {
        const newUnitId = payload.current_unit_id;
        const newUnit = newUnitId ? allUnits.find(u => u.id === newUnitId) : undefined;
        
        setTenants((prev) => prev.map((t) => {
          if (t.id !== editingTenantId) return t;
          return {
            ...t,
            full_name: payload.full_name ?? t.full_name,
            email: payload.email ?? t.email,
            phone: payload.phone ?? t.phone,
            national_id: payload.national_id ?? t.national_id,
            lease_start_date: payload.lease_start_date ?? t.lease_start_date,
            lease_end_date: payload.lease_end_date ?? t.lease_end_date,
            current_unit_id: payload.current_unit_id ?? t.current_unit_id,
            emergency_contacts: payload.emergency_contacts ?? t.emergency_contacts,
            id_document_url: payload.id_document_url ?? t.id_document_url,
            profile_image_url: payload.profile_image_url ?? t.profile_image_url,
            unit: newUnitId !== undefined ? (newUnit as Unit) : t.unit,
          };
        }));
      }

      setFormData({
        full_name: '', email: '', phone: formatPhoneInput(''), national_id: '', lease_type: 'residential',
        property_id: '', current_unit_id: '', lease_start_date: '', lease_end_date: '', rent_amount: '',
        deposit_amount: '', water_deposit_amount: '', electricity_deposit_amount: '',
        deposit_paid_to: 'landlord',
        id_document_url: '', profile_image_url: ''
      });
      setEmergencyContacts([{ name: '', relationship: '', phone: formatPhoneInput('') }]);
      // Bust cache and refetch to confirm from DB
      cache.remove(tenantsCacheKey);
      cache.remove(unitsCacheKey);
      fetchTenantData();
      fetchAvailableUnits();
    } catch (error: any) {
      console.error('Error adding tenant:', error);
      setToast({ message: error.message || 'Error adding tenant', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRent = async () => {
    if (!selectedTenant?.unit?.id) return;
    
    setIsSavingRent(true);
    try {
      const { error } = await supabase
        .from('re_units')
        .update({ rent_amount: editRentAmount })
        .eq('id', selectedTenant.unit.id);
        
      if (error) throw error;
      
      // Update local state directly to show instant feedback without a full re-fetch
      setSelectedTenant({
        ...selectedTenant,
        unit: { ...selectedTenant.unit!, rent_amount: editRentAmount }
      });
      
      // Update the main tenants array list
      setTenants(tenants.map(t => {
        if (t.id === selectedTenant.id && t.unit) {
          return { ...t, unit: { ...t.unit, rent_amount: editRentAmount } };
        }
        return t;
      }));
      
      setToast({ message: 'Rent amount updated successfully', type: 'success' });
      setIsEditingRent(false);
    } catch (error: any) {
      console.error('Error updating rent:', error);
      setToast({ message: error.message || 'Error updating rent', type: 'error' });
    } finally {
      setIsSavingRent(false);
    }
  };

  const handleSendTenantLogin = async (tenant: Tenant, resend = false) => {
    try {
      const result = await invokeEdgeFunction<{ success: boolean; username?: string; email?: string }>('admin-create-tenant-login', {
        tenant_id: tenant.id,
        resend,
      });
      setToast({
        message: resend
          ? `Tenant login re-sent to ${tenant.full_name || 'tenant'}`
          : `Tenant login created for ${tenant.full_name || 'tenant'} (${result.username || result.email || 'credentials ready'})`,
        type: 'success',
      });
      fetchTenantData();
    } catch (error: any) {
      console.error('Error sending tenant login:', error);
      setToast({ message: error?.message || 'Failed to send tenant login', type: 'error' });
    }
  };

  const uploadTenantMedia = async (file: File, bucket: 'leases' | 'avatars') => {
    return UnifiedStorageService.upload(file, {
      folder: bucket === 'avatars' ? '/tenant-avatars' : '/tenant-documents',
      bucket,
    });
  };

  const handleIdDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setTenantIdDocUploading(true);
    try {
      const url = await uploadTenantMedia(file, 'leases');
      setFormData((current) => ({ ...current, id_document_url: url }));
      setToast({ message: 'ID document uploaded.', type: 'success' });
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to upload ID document', type: 'error' });
    } finally {
      setTenantIdDocUploading(false);
    }
  };

  const handleProfilePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setTenantPhotoUploading(true);
    try {
      const url = await uploadTenantMedia(file, 'avatars');
      setFormData((current) => ({ ...current, profile_image_url: url }));
      setToast({ message: 'Profile image uploaded.', type: 'success' });
    } catch (error: any) {
      setToast({ message: error?.message || 'Failed to upload profile image', type: 'error' });
    } finally {
      setTenantPhotoUploading(false);
    }
  };

  const handleResetTenantLogin = async (tenant: Tenant) => {
    try {
      const result = await invokeEdgeFunction<{ success: boolean; username?: string; email?: string }>('admin-create-tenant-login', {
        tenant_id: tenant.id,
        reset: true,
      });
      setToast({
        message: `Tenant portal login reset for ${tenant.full_name || 'tenant'} (${result.username || result.email || 'updated'})`,
        type: 'success',
      });
      fetchTenantData();
    } catch (error: any) {
      console.error('Error resetting tenant login:', error);
      setToast({ message: error?.message || 'Failed to reset tenant login', type: 'error' });
    }
  };

  const handleDeleteTenant = async (tenant: Tenant) => {
    const confirmed = window.confirm(`Archive ${getTenantDisplayName(tenant)} and clear their remaining unit assignment and open invoices?`);
    if (!confirmed) return;

    setIsDeletingTenant(true);
    try {
      const nowIso = new Date().toISOString();
      const tenantId = tenant.id;

      if (tenant.current_unit_id) {
        const { error: unitError } = await supabase
          .from('re_units')
          .update({ status: 'vacant' })
          .eq('id', tenant.current_unit_id);

        if (unitError) {
          console.error('Failed to clear tenant unit while archiving', unitError);
        }
      }

      const { error: leaseError } = await supabase
        .from('re_leases')
        .update({ status: 'inactive' })
        .eq('tenant_id', tenantId)
        .eq('status', 'active');

      if (leaseError) {
        console.error('Failed to deactivate leases while archiving tenant', leaseError);
      }

      const { data: invoiceRows, error: invoiceLookupError } = await supabase
        .from('re_invoices')
        .select('id')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null);

      if (invoiceLookupError) throw invoiceLookupError;

      const invoiceIds = (invoiceRows || []).map((row: any) => row.id);
      if (invoiceIds.length > 0) {
        const { error: invoiceError } = await supabase
          .from('re_invoices')
          .update({ deleted_at: nowIso, notes: 'Soft-deleted during tenant archive' })
          .in('id', invoiceIds);

        if (invoiceError) throw invoiceError;

        const { error: paymentError } = await supabase
          .from('re_payments')
          .update({ deleted_at: nowIso })
          .in('invoice_id', invoiceIds);

        if (paymentError) throw paymentError;
      }

      const { error: tenantClearError } = await supabase
        .from('re_tenants')
        .update({ current_unit_id: null, is_active: false })
        .eq('id', tenantId);

      if (tenantClearError) throw tenantClearError;

      const { error: archiveError } = await supabase.rpc('archive_record', {
        p_table_name: 're_tenants',
        p_record_id: tenantId,
        p_reason: 'delete',
      });

      if (archiveError) throw archiveError;

      setToast({ message: `${getTenantDisplayName(tenant)} archived and removed from the active directory.`, type: 'success' });
      cache.remove(tenantsCacheKey);
      cache.remove(unitsCacheKey);
      void fetchTenantData();
      void fetchAvailableUnits();
      void fetchAllUnits();
    } catch (error: any) {
      console.error('Error archiving tenant:', error);
      setToast({ message: error?.message || 'Failed to archive tenant', type: 'error' });
    } finally {
      setIsDeletingTenant(false);
    }
  };

  // No longer blocking with full page loader

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-in fade-in duration-500 px-3 py-4 sm:px-4 sm:py-6 lg:p-0">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="mb-2 flex items-center text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
              <Users className="mr-3 text-brand-purple" size={32} />
              Tenant Management
            </h1>
            <p className="max-w-2xl text-sm text-gray-500 dark:text-gray-400 sm:text-base">
              Manage tenant profiles, leases, and unit allocations.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
            <button 
            onClick={() => printWorkspacePage()}
              title="Print current tenant directory"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
            >
              <Printer size={16} /> Print
            </button>
            <button 
              onClick={() => {
                if (window.confirm('This will perform a batch action or clear view. Proceed?')) {
                  setToast({ message: 'Bulk delete functionality to be implemented.', type: 'info' });
                }
              }} 
              title="Perform batch delete or database maintenance"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-500 transition hover:bg-rose-500/20"
            >
              <Trash2 size={16} /> Delete
            </button>
            {!showForm && !selectedTenant && (
              <button 
                onClick={() => setShowForm(true)}
                title="Open form to onboard a new tenant"
                className="inline-flex items-center justify-center rounded-xl bg-brand-purple px-4 py-2 text-white shadow-lg shadow-brand-purple/20 transition-colors hover:bg-brand-pink"
              >
                <Plus size={18} className="mr-2" /> Onboard Tenant
              </button>
            )}
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => navigate('/app/real-estate/tenants')}
            className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-purple/30 hover:text-brand-purple dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
          >
            Tenant directory
          </button>
          <button
            type="button"
            onClick={() => navigate('/app/real-estate/deleted/tenants')}
            className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-purple/30 hover:text-brand-purple dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
          >
            Archived tenants
          </button>
          <button
            type="button"
            onClick={() => void syncMissingInvoices()}
            className="rounded-full border border-brand-purple/20 bg-brand-purple/10 px-3 py-2 text-sm font-semibold text-brand-purple transition hover:bg-brand-purple/20"
          >
            Backfill invoices
          </button>
        </div>

        {showForm && (
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-6 mb-8 animate-fade-in">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {isEditing ? 'Edit Tenant Details' : 'Onboard New Tenant'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-1">
                  <label htmlFor="tenant-fullname" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                  <input
                    id="tenant-fullname"
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    placeholder="e.g. Jane Doe"
                    title="Tenant Full Name"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="tenant-phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
                  <input
                    id="tenant-phone"
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: formatPhoneInput(e.target.value)})}
                    placeholder="e.g. +254712345678"
                    title="Tenant Phone Number"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="tenant-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                  <input
                    id="tenant-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="e.g. jane@example.com"
                    title="Tenant Email Address"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Profile Image</label>
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center text-sm text-gray-500 transition hover:border-brand-purple hover:bg-brand-purple/5 dark:border-white/10 dark:bg-black/20 dark:text-gray-300">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleProfilePhotoUpload}
                      className="hidden"
                    />
                    <span className="font-semibold text-gray-900 dark:text-white">{tenantPhotoUploading ? 'Uploading photo...' : 'Upload or capture profile photo'}</span>
                    <span className="text-xs">Photo will show in tenant views and dashboards.</span>
                  </label>
                  {formData.profile_image_url && <p className="mt-1 text-xs text-green-600">Photo attached</p>}
                </div>
                <div>
                  <label htmlFor="tenant-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">National ID / Passport</label>
                  <input
                    id="tenant-id"
                    type="text"
                    value={formData.national_id}
                    onChange={(e) => setFormData({...formData, national_id: e.target.value})}
                    placeholder="ID Number"
                    title="Tenant National ID or Passport"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ID Document</label>
                  <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center text-sm text-gray-500 transition hover:border-brand-purple hover:bg-brand-purple/5 dark:border-white/10 dark:bg-black/20 dark:text-gray-300">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      capture="environment"
                      onChange={handleIdDocumentUpload}
                      className="hidden"
                    />
                    <span className="font-semibold text-gray-900 dark:text-white">{tenantIdDocUploading ? 'Uploading ID...' : 'Upload or capture ID document'}</span>
                    <span className="text-xs">Required later when downloading the lease document.</span>
                  </label>
                  {formData.id_document_url && <p className="mt-1 text-xs text-green-600">ID document attached</p>}
                </div>
                <div>
                  <label htmlFor="tenant-property" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Property</label>
                  <select
                    id="tenant-property"
                    value={formData.property_id}
                    onChange={(e) => setFormData({
                      ...formData,
                      property_id: e.target.value,
                      current_unit_id: '',
                      rent_amount: '',
                    })}
                    title="Filter units by property"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white"
                  >
                    <option value="">-- Select Property --</option>
                    {(allProperties.length > 0 ? allProperties : derivedProperties).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="tenant-lease-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lease Type Override</label>
                  <select
                    id="tenant-lease-type"
                    value={formData.lease_type}
                    onChange={(e) => setFormData({ ...formData, lease_type: e.target.value as 'residential' | 'commercial' })}
                    title="Override the unit lease type only for special cases"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white"
                  >
                    <option value="residential">Residential / Tenant Lease</option>
                    <option value="commercial">Commercial Lease</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Defaults to the selected unit type, but you can override it here if needed.</p>
                </div>
                <div>
                  <label htmlFor="tenant-unit" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign Unit</label>
                  <select
                    id="tenant-unit"
                    value={formData.current_unit_id}
                    onChange={(e) => {
                      const unitId = e.target.value;
                      const u = onboardingUnits.find(x => x.id === unitId);
                      setFormData({
                        ...formData,
                        current_unit_id: unitId,
                        rent_amount: u?.rent_amount ? String(u.rent_amount) : '',
                        lease_type: u?.lease_type === 'commercial' ? 'commercial' : 'residential',
                      });
                    }}
                    title="Select available unit for this tenant"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white"
                  >
                    <option value="">-- No Unit (Waitlist) --</option>
                    {onboardingUnits.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.property?.name || 'Unknown property'}: {u.unit_number} (Rent: Ksh {u.rent_amount}) {u.lease_type ? `• ${u.lease_type}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {formData.current_unit_id && (
                  <div>
                    <label htmlFor="tenant-rent" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Agreed Rent Amount (Ksh)</label>
                    <input
                      id="tenant-rent"
                      type="number"
                      value={formData.rent_amount}
                      onChange={(e) => setFormData({...formData, rent_amount: e.target.value})}
                      placeholder="e.g. 15000"
                      title="Agreed Rent Amount"
                      className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white"
                    />
                  </div>
                )}
                <div>
                  <label htmlFor="tenant-deposit" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gate Key Deposit</label>
                  <input
                    id="tenant-deposit"
                    type="number"
                    min="0"
                    value={formData.deposit_amount}
                    onChange={(e) => setFormData({...formData, deposit_amount: e.target.value})}
                    placeholder="e.g. 15000"
                    title="Gate key deposit amount for the lease"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="tenant-water-deposit" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Water Deposit (Ksh)</label>
                  <input
                    id="tenant-water-deposit"
                    type="number"
                    min="0"
                    value={formData.water_deposit_amount}
                    onChange={(e) => setFormData({...formData, water_deposit_amount: e.target.value})}
                    placeholder="Optional"
                    title="Water deposit amount"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="tenant-electricity-deposit" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Electricity Deposit (Ksh)</label>
                  <input
                    id="tenant-electricity-deposit"
                    type="number"
                    min="0"
                    value={formData.electricity_deposit_amount}
                    onChange={(e) => setFormData({...formData, electricity_deposit_amount: e.target.value})}
                    placeholder="Optional"
                    title="Electricity deposit amount"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="tenant-deposit-paid-to" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Deposit Paid To</label>
                  <select
                    id="tenant-deposit-paid-to"
                    value={formData.deposit_paid_to}
                    onChange={(e) => setFormData({...formData, deposit_paid_to: e.target.value})}
                    title="Who receives the lease deposit"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white"
                  >
                    <option value="landlord">Landlord</option>
                    <option value="agent">Agent</option>
                    <option value="both">Both</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="lease-start" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lease Start Date</label>
                  <input
                    id="lease-start"
                    type="date"
                    value={formData.lease_start_date}
                    onChange={(e) => setFormData({...formData, lease_start_date: e.target.value})}
                    title="Lease Start Date"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="lease-end" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lease End Date</label>
                  <input
                    id="lease-end"
                    type="date"
                    value={formData.lease_end_date}
                    onChange={(e) => setFormData({...formData, lease_end_date: e.target.value})}
                    title="Lease End Date"
                    className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Emergency Contacts Section */}
              <div className="border border-gray-200 dark:border-white/10 rounded-xl p-4 mt-2 bg-gray-50 dark:bg-black/10">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <UserPlus size={16} className="text-brand-purple" /> Emergency Contacts
                  </h3>
                  <button
                    type="button"
                    onClick={addEmergencyContact}
                    title="Add another emergency contact"
                    className="flex items-center gap-1.5 text-xs font-bold text-brand-purple hover:text-brand-pink transition-colors px-3 py-1.5 border border-brand-purple/30 rounded-lg hover:bg-brand-purple/5"
                  >
                    <Plus size={14} /> Add Contact
                  </button>
                </div>
                <div className="space-y-3">
                  {emergencyContacts.map((contact, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start bg-white dark:bg-white/5 p-3 rounded-lg border border-gray-200 dark:border-white/10">
                      <div>
                        <label htmlFor={`contact-name-${idx}`} className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Name</label>
                        <input
                          id={`contact-name-${idx}`}
                          type="text"
                          value={contact.name}
                          onChange={e => updateEmergencyContact(idx, 'name', e.target.value)}
                          placeholder="e.g. John Doe"
                          title="Contact Name"
                          className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-3 py-2 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor={`contact-rel-${idx}`} className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Relationship</label>
                        <input
                          id={`contact-rel-${idx}`}
                          type="text"
                          value={contact.relationship}
                          onChange={e => updateEmergencyContact(idx, 'relationship', e.target.value)}
                          placeholder="e.g. Spouse, Parent"
                          title="Contact Relationship"
                          className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-3 py-2 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label htmlFor={`contact-phone-${idx}`} className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Telephone</label>
                          <input
                            id={`contact-phone-${idx}`}
                            type="text"
                            value={contact.phone}
                            onChange={e => updateEmergencyContact(idx, 'phone', e.target.value)}
                            placeholder="e.g. +254712345678"
                            title="Contact Telephone"
                            className="w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-3 py-2 rounded-lg focus:ring-2 focus:ring-brand-purple outline-none text-gray-900 dark:text-white text-sm"
                          />
                        </div>
                        {emergencyContacts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeEmergencyContact(idx)}
                            className="mt-5 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Remove contact"
                          >
                            <Minus size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-white/10 mt-6">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-brand-purple text-white rounded-lg hover:bg-brand-pink transition-colors flex items-center disabled:opacity-50"
                >
                  {isSubmitting ? <><CustomLoader size={16} className="mr-2" /> Saving...</> : 'Save Tenant'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* View Let Modal / Panel */}
        {selectedTenant && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-dark-surface rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-white/5">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                  <FileSignature className="mr-2 text-brand-purple" size={24} />
                  Lease Information
                </h2>
                <button 
                  onClick={() => {
                    setSelectedTenant(null);
                    setIsEditingRent(false);
                  }}
                  title="Close lease details and return to list"
                  aria-label="Close"
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                <div className="flex items-start gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-white/10">
                   <div className="w-16 h-16 bg-brand-purple/10 rounded-full flex items-center justify-center text-brand-purple text-2xl font-bold uppercase shrink-0">
                     {(selectedTenant.full_name || 'U').charAt(0)}
                   </div>
                   <div>
                     <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedTenant.full_name || 'Unnamed Tenant'}</h3>
                     {selectedTenant.tenant_no && (
                       <span className="inline-block mt-1 rounded-full bg-brand-purple/10 px-3 py-0.5 text-xs font-bold text-brand-purple font-mono">
                         {selectedTenant.tenant_no}
                       </span>
                     )}
                     <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                        <span className="flex items-center"><Phone size={14} className="mr-1" /> {selectedTenant.phone}</span>
                        {selectedTenant.email && !selectedTenant.email.endsWith('@tenant.local') && <span className="flex items-center"><Mail size={14} className="mr-1" /> {selectedTenant.email}</span>}
                     </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Unit Details</h4>
                      <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-lg">
                        {selectedTenant.unit ? (
                          <>
                            <div className="flex items-center mb-2">
                              <Home className="text-brand-purple mr-2" size={18} />
                              <span className="font-bold text-gray-900 dark:text-white text-lg">Unit {selectedTenant.unit.unit_number}</span>
                            </div>
                            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                              <Building2 className="mr-2" size={16} />
                              {selectedTenant.unit.property?.name || 'Unknown property'}
                            </div>
                             <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/10 flex justify-between items-center text-sm">
                               <span className="text-gray-500">Monthly Rent:</span>
                               {isEditingRent ? (
                                  <div className="flex items-center gap-2">
                                    <div className="relative">
                                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 font-medium">Ksh</span>
                                      <input 
                                        type="number" 
                                        value={editRentAmount}
                                        onChange={(e) => setEditRentAmount(Number(e.target.value))}
                                        title="Agreed Rent Amount"
                                        className="w-28 pl-9 pr-2 py-1 text-right bg-white dark:bg-black/40 border border-brand-purple rounded-md focus:outline-none focus:ring-1 focus:ring-brand-purple font-bold text-gray-900 dark:text-white custom-scrollbar"
                                      />
                                    </div>
                                    <button 
                                      onClick={handleUpdateRent}
                                      disabled={isSavingRent}
                                      className="p-1 bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 rounded transition-colors disabled:opacity-50"
                                      title="Save Rent"
                                    >
                                      {isSavingRent ? <CustomLoader size={12} /> : <Check size={16} />}
                                    </button>
                                    <button 
                                      onClick={() => setIsEditingRent(false)}
                                      disabled={isSavingRent}
                                      className="p-1 bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-300 rounded transition-colors disabled:opacity-50"
                                      title="Cancel"
                                    >
                                      <XCircle size={16} />
                                    </button>
                                  </div>
                               ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-900 dark:text-white text-lg">Ksh {selectedTenant.unit.rent_amount?.toLocaleString() || '0'}</span>
                                    <button 
                                      onClick={() => {
                                        setEditRentAmount(selectedTenant.unit?.rent_amount || 0);
                                        setIsEditingRent(true);
                                      }}
                                      className="text-gray-400 hover:text-brand-purple transition-colors p-1"
                                      title="Edit Rent"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                  </div>
                               )}
                             </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-4 text-center">
                            <Home className="text-gray-400 mb-2" size={24} />
                            <p className="text-gray-500 dark:text-gray-400">No unit assigned</p>
                            <span className="text-xs text-gray-400 mt-1">Tenant is currently waitlisted</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                     <div>
                      <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Lease Terms</h4>
                      <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-lg space-y-3">
                         <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-white/5">
                           <span className="text-gray-500 text-sm">Status</span>
                           <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize border ${
                            selectedTenant.is_active 
                              ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30'
                              : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30'
                          }`}>
                            {selectedTenant.is_active ? 'Active Lease' : 'Inactive'}
                          </span>
                         </div>
                         <div className="flex justify-between items-center text-sm">
                            <span className="flex items-center text-gray-500">
                              <Calendar size={14} className="mr-2" /> Start Date
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {selectedTenant.lease_start_date ? new Date(selectedTenant.lease_start_date).toLocaleDateString() : 'Not set'}
                            </span>
                         </div>
                         <div className="flex justify-between items-center text-sm">
                            <span className="flex items-center text-gray-500">
                              <Calendar size={14} className="mr-2" /> End Date
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {selectedTenant.lease_end_date ? new Date(selectedTenant.lease_end_date).toLocaleDateString() : 'Not set'}
                            </span>
                         </div>
                        <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-200 dark:border-white/5">
                            <span className="text-gray-500">Tenant Portal</span>
                            <span className="font-medium text-gray-900 dark:text-white text-xs text-right">
                              {selectedTenant.login_sent_at
                                ? `Sent ${formatDateTime(selectedTenant.login_sent_at)}`
                                : 'Not sent yet'}
                            </span>
                         </div>
                         <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-200 dark:border-white/5">
                            <span className="text-gray-500">Portal Username</span>
                            <span className="font-medium text-gray-900 dark:text-white text-xs text-right">
                              {selectedTenant.login_username || 'Not set'}
                            </span>
                         </div>
                         {selectedTenant.tenant_no && (
                           <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-200 dark:border-white/5">
                             <span className="text-gray-500">Tenant No</span>
                             <span className="font-mono font-bold text-brand-purple text-xs text-right">
                               {selectedTenant.tenant_no}
                             </span>
                           </div>
                         )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Emergency Contacts */}
                {selectedTenant.emergency_contacts && selectedTenant.emergency_contacts.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-gray-200 dark:border-white/10">
                    <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <UserPlus size={14} /> Emergency Contacts
                    </h4>
                    <div className="space-y-2">
                      {selectedTenant.emergency_contacts.map((contact, i) => (
                        <div key={i} className="flex items-center gap-4 bg-gray-50 dark:bg-white/5 px-4 py-3 rounded-lg text-sm">
                          <div className="w-7 h-7 rounded-full bg-brand-purple/10 flex items-center justify-center text-brand-purple font-bold text-xs shrink-0">
                            {contact.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 dark:text-white">{contact.name || '—'}</p>
                            {contact.relationship && <p className="text-xs text-gray-500">{contact.relationship}</p>}
                          </div>
                          {contact.phone && (
                            <span className="flex items-center text-gray-600 dark:text-gray-400 text-xs">
                              <Phone size={12} className="mr-1" /> {contact.phone}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex justify-end">
                 <div className="mr-auto pr-4 text-xs text-gray-500 dark:text-gray-400 self-center">
                   Send the tenant portal login here the first time. Resend it from this same page any time later.
                 </div>
                 <button
                  type="button"
                  onClick={() => selectedTenant && handleSendTenantLogin(selectedTenant, Boolean(selectedTenant.login_sent_at))}
                  className="mr-auto px-4 py-2 bg-brand-purple/10 text-brand-purple rounded-lg hover:bg-brand-purple/20 transition-colors flex items-center gap-2"
                  title="Create or resend tenant portal login"
                >
                  <Mail size={16} /> {selectedTenant.login_sent_at ? 'Resend Tenant Login' : 'Send Tenant Login'}
                </button>
                 <button 
                  onClick={() => {
                    setSelectedTenant(null);
                    setIsEditingRent(false);
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-white/10 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-white/20 transition-colors font-medium"
                 >
                   Close Details
                 </button>
              </div>
            </div>
          </div>
        )}

        {/* Sticky Filter Bar */}
        <div className="sticky top-12 sm:top-14 z-20 bg-white dark:bg-dark-surface border-b border-gray-200 dark:border-white/10 shadow-sm mb-4 rounded-t-xl">
          <div className="px-6 py-4 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, phone, email..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-purple text-gray-900 dark:text-white"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </div>
            <select
              value={propertyFilter}
              onChange={(e) => {
                setPropertyFilter(e.target.value);
                setUnitFilter('');
              }}
              className="px-3 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-purple text-gray-900 dark:text-white min-w-[180px]"
            >
              <option value="">All Properties</option>
              {(allProperties.length > 0 ? allProperties : derivedProperties).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="px-3 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-purple text-gray-900 dark:text-white min-w-[180px]"
            >
              <option value="">All Units</option>
              {filteredUnitsForList.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.property?.name ? `${unit.property.name} · ` : ''}{unit.unit_number} {unit.status ? `• ${getUnitStatusLabel(unit.status)}` : ''}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="px-3 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-purple text-gray-900 dark:text-white min-w-[150px]"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {(propertyFilter || unitFilter || statusFilter !== 'all' || searchTerm) && (
              <button
                onClick={() => { setPropertyFilter(''); setUnitFilter(''); setStatusFilter('all'); setSearchTerm(''); }}
                className="px-3 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => void syncMissingInvoices()}
              className="px-3 py-2 text-xs font-bold text-white bg-brand-purple rounded-lg hover:bg-brand-pink transition-colors"
            >
              Backfill invoices
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">

          {(() => {
            if (tenants.length === 0 && !loading) {
              return (
                <div className="p-12 text-center flex flex-col items-center">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 text-blue-600 rounded-full flex items-center justify-center mb-4">
                    <Users size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Tenants Directory</h3>
                  <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">
                    You haven't added any tenants yet. Note that tenants must be allocated to a unit linked to your properties.
                  </p>
                  <button
                    onClick={() => setShowForm(true)}
                    className="px-4 py-2 bg-brand-purple text-white rounded-lg hover:bg-brand-pink transition-colors"
                  >
                    Onboard Tenant
                  </button>
                </div>
              );
            }

            return filteredTenants.length === 0 && tenants.length > 0 ? (
              <div className="p-12 text-center flex flex-col items-center">
                <div className="w-12 h-12 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-3">
                  <Users size={24} className="text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">No tenants match your filter.</p>
                <button onClick={() => { setPropertyFilter(''); setSearchTerm(''); }} className="mt-3 text-sm text-brand-purple hover:underline">Clear filters</button>
              </div>
            ) : (
              <div className="hidden md:block">
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-brand-purple/30 bg-brand-purple/5 px-3 py-2 text-xs font-semibold text-brand-purple">
                <ArrowLeftRight size={14} aria-hidden="true" />
                <span>Scroll horizontally to view all tenant columns and actions</span>
              </div>
              <div ref={tenantTableTopScrollRef} onScroll={() => syncTenantTableScroll('top')} className="data-table-scroll w-full mb-1 overflow-x-auto rounded-t-lg border border-b-0 border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5" aria-label="Horizontal tenant table scrollbar">
                <div className="h-3 min-w-[1700px]" />
              </div>
              <div ref={tenantTableScrollRef} onScroll={() => syncTenantTableScroll('table')} className="w-full overflow-x-auto data-table-scroll" title="Use the horizontal scrollbar below to view all tenant columns">
              <table className="w-full min-w-[1700px] text-sm text-left">
                <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Tenant Name</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Contact Details</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Unit Allocation</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Lease Status</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Portal Login</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {loading && tenants.length === 0 ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-28" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-40" /></td>
                        <td className="px-6 py-4"><Skeleton className="h-4 w-20 rounded-full" /></td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2"><Skeleton className="h-6 w-16" /></td>
                      </tr>
                    ))
                  ) : filteredTenants.map((tenant) => (
                    <tr
                      key={tenant.id}
                      className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group cursor-pointer"
                      onClick={() => navigate(`/app/real-estate/tenants/${tenant.id}/profile`)}
                      title={`Open full tenant profile for ${getTenantDisplayName(tenant)}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {tenant.profile_image_url ? (
                            <img src={tenant.profile_image_url} alt={getTenantDisplayName(tenant)} className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-white/10 shrink-0" />
                          ) : (
                            <div className="w-10 h-10 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold uppercase shrink-0">
                              {getTenantDisplayName(tenant).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white text-base">{getTenantDisplayName(tenant)}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5" title={tenant.id}>
                               {tenant.tenant_no
                                 ? <span className="font-bold text-brand-purple">{tenant.tenant_no}</span>
                                 : <>ID: {tenant.id.substring(0, 8)}...</>
                               }
                               {tenant.national_id ? ` • Nat.ID: ${tenant.national_id}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center text-gray-700 dark:text-gray-300 text-sm">
                            <Phone size={14} className="mr-2 text-gray-400" />
                            {tenant.phone || 'N/A'}
                          </div>
                          {realEmail(tenant.email) && (
                            <div className="flex items-center text-gray-600 dark:text-gray-400 text-xs">
                              <Mail size={12} className="mr-2 text-gray-400" />
                              {realEmail(tenant.email)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {tenant.unit ? (
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900 dark:text-white">{tenant.unit.unit_number}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {tenant.unit.property?.name || 'Unknown property'} <span className="mx-1">•</span> Rent: Ksh <span className="font-bold text-brand-purple">{tenant.unit.rent_amount?.toLocaleString() || '0'}</span>
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-sm">Waitlisted / Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize border w-max ${
                            tenant.is_active 
                              ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30'
                              : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30'
                          }`}>
                            {tenant.is_active ? 'Active' : 'Inactive'}
                          </span>
                          {tenant.lease_end_date && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Ends: {new Date(tenant.lease_end_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border w-max ${
                            tenant.login_sent_at
                              ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/30'
                              : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/30'
                          }`}>
                            {tenant.login_sent_at ? 'Sent' : 'Not sent yet'}
                          </span>
                          {/* Show real email if available, otherwise show username (hide synthetic @tenant.local usernames) */}
                          {realEmail(tenant.email) ? (
                            <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]" title={realEmail(tenant.email)!}>
                              {realEmail(tenant.email)}
                            </span>
                          ) : tenant.login_username && !tenant.login_username.includes('@tenant.local') ? (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {tenant.login_username}
                            </span>
                          ) : tenant.login_username ? (
                            <span className="text-xs text-amber-500 dark:text-amber-400 italic">
                              No real email — resend to update
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-500">No username yet</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                           <button
                             type="button"
                             onClick={() => handleSendTenantLogin(tenant, Boolean(tenant.login_sent_at))}
                             className="px-3 py-1.5 bg-brand-purple/10 text-brand-purple hover:bg-brand-purple text-xs font-bold rounded-lg hover:text-white transition-all flex items-center gap-1.5"
                             title={tenant.login_sent_at ? 'Resend tenant portal login' : 'Send tenant portal login'}
                           >
                              <Mail size={14} /> {tenant.login_sent_at ? 'Resend Login' : 'Send Login'}
                           </button>
                           <button
                             type="button"
                             onClick={() => handleResetTenantLogin(tenant)}
                             className="px-3 py-1.5 bg-amber-500/10 text-amber-700 hover:bg-amber-500 hover:text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                             title="Reset the tenant portal password and resend credentials"
                           >
                              <KeyRound size={14} /> Reset
                           </button>
                           <button 
                             type="button"
                              onClick={async (event) => {
                                event.stopPropagation();
                                const rawUnit = Array.isArray(tenant.unit) ? tenant.unit[0] : tenant.unit;
                                const rawProp = rawUnit ? (Array.isArray(rawUnit.property) ? rawUnit.property[0] : rawUnit.property) : null;

                                let leaseData: any = null;
                                if (tenant.id) {
                                  const { data: lease } = await supabase
                                    .from('re_leases')
                                    .select('*')
                                    .eq('tenant_id', tenant.id)
                                    .order('created_at', { ascending: false })
                                    .limit(1)
                                    .maybeSingle();
                                  leaseData = lease;
                                }

                                setFormData({
                                  full_name: tenant.full_name || '',
                                  email: (tenant.email && !tenant.email.endsWith('@tenant.local')) ? tenant.email : '',
                                  phone: tenant.phone || '',
                                  national_id: tenant.national_id || '',
                                  lease_type: (leaseData?.lease_type as any) || (rawUnit as any)?.lease_type || 'residential',
                                  property_id: rawProp?.id || (rawUnit as any)?.property_id || leaseData?.property_id || '',
                                  current_unit_id: tenant.current_unit_id || leaseData?.unit_id || '',
                                  lease_start_date: tenant.lease_start_date || leaseData?.start_date || '',
                                  lease_end_date: tenant.lease_end_date || leaseData?.end_date || '',
                                  rent_amount: leaseData?.rent_amount ? String(leaseData.rent_amount) : ((rawUnit as any)?.rent_amount ? String((rawUnit as any).rent_amount) : ''),
                                  deposit_amount: leaseData?.deposit_amount != null ? String(leaseData.deposit_amount) : '',
                                  water_deposit_amount: leaseData?.water_deposit_amount != null ? String(leaseData.water_deposit_amount) : '',
                                  electricity_deposit_amount: leaseData?.electricity_deposit_amount != null ? String(leaseData.electricity_deposit_amount) : '',
                                  deposit_paid_to: leaseData?.deposit_paid_to || 'landlord',
                                  id_document_url: tenant.id_document_url || '',
                                  profile_image_url: tenant.profile_image_url || ''
                                });
                                setEmergencyContacts(tenant.emergency_contacts || [{ name: '', relationship: '', phone: '' }]);
                                setEditingTenantId(tenant.id);
                                setIsEditing(true);
                                setShowForm(true);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                             className="p-2 text-gray-400 hover:text-brand-purple hover:bg-brand-purple/5 rounded-lg transition-colors"
                             title="Edit tenant details"
                           >
                              <Edit size={18} />
                           </button>
                           <button 
                             type="button"
                             onClick={(event) => {
                               event.stopPropagation();
                               navigate(`/app/real-estate/tenants/${tenant.id}/profile`);
                             }}
                             title={`Open tenant profile for ${getTenantDisplayName(tenant)}`}
                             className="px-3 py-1.5 bg-brand-purple/10 text-brand-purple hover:bg-brand-purple text-xs font-bold rounded-lg hover:text-white transition-all flex items-center gap-1.5"
                           >
                              <FileText size={14} /> Profile
                           </button>
                           <button 
                             type="button"
                             onClick={(event) => {
                               event.stopPropagation();
                               navigate(`/app/real-estate/tenants/${tenant.id}/portal`);
                             }}
                             title={`Open tenant portal details for ${getTenantDisplayName(tenant)}`}
                             className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-900 text-xs font-bold rounded-lg hover:text-white transition-all flex items-center gap-1.5 dark:bg-white/10 dark:text-white"
                           >
                              <ShieldCheck size={14} /> Portal
                           </button>
                           {tenant.is_active && tenant.current_unit_id && (
                             <button
                               type="button"
                               onClick={(event) => { event.stopPropagation(); openTransferDialog(tenant); }}
                               title={`Swap ${getTenantDisplayName(tenant)} to another unit`}
                               className="px-3 py-1.5 bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500 hover:text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                             >
                               <ArrowLeftRight size={14} /> Swap Unit
                             </button>
                           )}
                           <button
                             type="button"
                             onClick={(event) => {
                               event.stopPropagation();
                               void handleDeleteTenant(tenant);
                             }}
                             title={`Archive ${getTenantDisplayName(tenant)} and clear their unit assignment`}
                             className="px-3 py-1.5 bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                             disabled={isDeletingTenant}
                           >
                              <Trash2 size={14} /> Archive
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              </div>
            );
          })()}
        </div>
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {tenantForTransfer && (() => {
        const destUnits = allUnits.filter(
          (u) =>
            u.id !== tenantForTransfer.current_unit_id &&
            !['occupied', 'rented'].includes((u.status || '').toLowerCase()) &&
            (!transferPropertyId || u.property?.id === transferPropertyId)
        );
        const stepLabels = ['Location', 'Unit & Date', 'Arrears', 'Confirm'];
        const stepIndex = { 'property-choice': 0, 'unit-choice': 1, 'arrears-review': 2, 'confirm': 3 }[transferStep];
        const selectedUnit = allUnits.find((u) => u.id === transferUnitId);
        const openInvoices = transferInvoices.filter((inv) => (Number(inv.amount_due) - Number(inv.amount_paid)) > 0);
        const paidInvoices = transferInvoices.filter((inv) => (Number(inv.amount_due) - Number(inv.amount_paid)) <= 0);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-dark-surface shadow-2xl flex flex-col max-h-[92vh]">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-gray-200 dark:border-white/10 px-6 py-4 shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <ArrowLeftRight size={18} className="text-brand-purple" /> Swap Tenant Unit
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">History, payments and invoices remain attached to the tenant.</p>
                </div>
                <button type="button" onClick={() => setTenantForTransfer(null)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white mt-0.5"><X size={20} /></button>
              </div>
              {/* Step indicator */}
              <div className="flex items-center px-6 pt-4 pb-2 shrink-0">
                {stepLabels.map((label, i) => (
                  <React.Fragment key={label}>
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${i < stepIndex ? 'bg-brand-purple border-brand-purple text-white' : i === stepIndex ? 'border-brand-purple text-brand-purple bg-brand-purple/10' : 'border-gray-300 dark:border-white/20 text-gray-400'}`}>
                        {i < stepIndex ? <Check size={12} /> : i + 1}
                      </div>
                      <span className={`text-[10px] font-semibold ${i === stepIndex ? 'text-brand-purple' : 'text-gray-400'}`}>{label}</span>
                    </div>
                    {i < stepLabels.length - 1 && <div className={`flex-1 h-0.5 mx-1 mb-4 rounded ${i < stepIndex ? 'bg-brand-purple' : 'bg-gray-200 dark:bg-white/10'}`} />}
                  </React.Fragment>
                ))}
              </div>
              {/* Tenant pill */}
              <div className="mx-6 mb-2 rounded-xl bg-gray-50 dark:bg-white/5 px-4 py-2.5 text-sm flex items-center gap-2 shrink-0">
                <div className="w-7 h-7 rounded-full bg-brand-purple/10 text-brand-purple font-bold text-xs flex items-center justify-center uppercase shrink-0">{getTenantDisplayName(tenantForTransfer).charAt(0)}</div>
                <div>
                  <span className="font-bold text-gray-900 dark:text-white">{getTenantDisplayName(tenantForTransfer)}</span>
                  <span className="text-gray-400 mx-2">·</span>
                  <span className="text-xs text-gray-500">Current: {tenantForTransfer.unit ? `Unit ${tenantForTransfer.unit.unit_number} · ${tenantForTransfer.unit.property?.name || ''}` : 'No unit'}</span>
                </div>
              </div>

              {/* Step content */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

                {/* ── STEP 1: Same or different property ── */}
                {transferStep === 'property-choice' && (
                  <div className="space-y-4">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Is the tenant moving to a unit in the same property?</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button" onClick={() => { setTransferSameProperty(true); setTransferPropertyId(tenantForTransfer.unit?.property?.id || ''); setTransferStep('unit-choice'); }}
                        className="rounded-xl border-2 border-gray-200 dark:border-white/10 px-4 py-5 text-center text-sm font-semibold hover:border-brand-purple/50 transition-all text-gray-700 dark:text-gray-300">
                        <Home size={22} className="mx-auto mb-2 text-brand-purple" />
                        Same property
                        <p className="mt-1 text-xs font-normal text-gray-400">{tenantForTransfer.unit?.property?.name || 'Current property'}</p>
                      </button>
                      <button type="button" onClick={() => { setTransferSameProperty(false); setTransferPropertyId(''); setTransferStep('unit-choice'); }}
                        className="rounded-xl border-2 border-gray-200 dark:border-white/10 px-4 py-5 text-center text-sm font-semibold hover:border-brand-purple/50 transition-all text-gray-700 dark:text-gray-300">
                        <Building2 size={22} className="mx-auto mb-2 text-brand-purple" />
                        Different property
                        <p className="mt-1 text-xs font-normal text-gray-400">Choose another property</p>
                      </button>
                    </div>
                  </div>
                )}

                {/* ── STEP 2: Property (if different) + Unit + Date + Reason ── */}
                {transferStep === 'unit-choice' && (
                  <div className="space-y-4">
                    {transferSameProperty === false && (
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Destination property</label>
                        <select value={transferPropertyId} onChange={(e) => { setTransferPropertyId(e.target.value); setTransferUnitId(''); }} className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-gray-900 outline-none focus:ring-2 focus:ring-brand-purple dark:border-white/10 dark:bg-black/20 dark:text-white">
                          <option value="">— Select a property —</option>
                          {(allProperties.length > 0 ? allProperties : derivedProperties).map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Destination unit {transferSameProperty === false && !transferPropertyId && <span className="text-xs font-normal text-gray-400">(select a property first)</span>}</label>
                      <select value={transferUnitId} onChange={(e) => setTransferUnitId(e.target.value)} disabled={transferSameProperty === false && !transferPropertyId} className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-gray-900 outline-none focus:ring-2 focus:ring-brand-purple dark:border-white/10 dark:bg-black/20 dark:text-white disabled:opacity-50">
                        <option value="">— Choose an available unit —</option>
                        {destUnits.length === 0 && (transferSameProperty === true || transferPropertyId) && (<option disabled>No vacant units found</option>)}
                        {destUnits.map((u) => (<option key={u.id} value={u.id}>{u.unit_number} · Ksh {Number(u.rent_amount || 0).toLocaleString()}{u.status ? ` · ${getUnitStatusLabel(u.status)}` : ''}</option>))}
                      </select>
                      {destUnits.length === 0 && (transferSameProperty === true || transferPropertyId) && (<p className="mt-1 text-xs text-amber-500">No vacant units in this property.</p>)}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Effective date</label>
                      <input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className="w-full rounded-xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-gray-900 outline-none focus:ring-2 focus:ring-brand-purple dark:border-white/10 dark:bg-black/20 dark:text-white" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">Reason <span className="font-normal text-gray-400">(optional)</span></label>
                      <textarea rows={2} value={transferReason} onChange={(e) => setTransferReason(e.target.value)} placeholder="e.g. Tenant requested a larger unit" className="w-full resize-none rounded-xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-gray-900 outline-none focus:ring-2 focus:ring-brand-purple dark:border-white/10 dark:bg-black/20 dark:text-white" />
                    </div>
                  </div>
                )}

                {/* ── STEP 3: Arrears review ── */}
                {transferStep === 'arrears-review' && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Review all invoices. For each unpaid balance, choose what to do on transfer.</p>
                    {loadingTransferInvoices ? (
                      <div className="flex items-center justify-center py-8 text-gray-400"><CustomLoader size={20} className="mr-2" /> Loading invoices...</div>
                    ) : transferInvoices.length === 0 ? (
                      <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-4 text-sm text-green-700 dark:text-green-400 text-center">✓ No invoices found — clean slate.</div>
                    ) : (
                      <>
                        {openInvoices.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-red-500">Unpaid / Arrears ({openInvoices.length})</h4>
                              <div className="flex gap-2">
                                <button type="button" onClick={() => { const a = { ...arrearsAction }; openInvoices.forEach((inv) => { a[inv.id] = 'migrate'; }); setArrearsAction(a); }} className="text-xs text-brand-purple hover:underline">All → Migrate</button>
                                <button type="button" onClick={() => { const a = { ...arrearsAction }; openInvoices.forEach((inv) => { a[inv.id] = 'paid'; }); setArrearsAction(a); }} className="text-xs text-green-600 hover:underline">All → Mark Paid</button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              {openInvoices.map((inv) => {
                                const balance = Number(inv.amount_due) - Number(inv.amount_paid);
                                const action = arrearsAction[inv.id] || 'migrate';
                                return (
                                  <div key={inv.id} className="rounded-xl border border-gray-200 dark:border-white/10 p-3 bg-gray-50 dark:bg-white/5">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <div>
                                        <p className="text-xs font-bold text-gray-900 dark:text-white">{inv.invoice_number}</p>
                                        <p className="text-xs text-gray-500">Due: {inv.due_date || inv.invoice_date} · {inv.invoice_type || 'rent'}</p>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <p className="text-sm font-bold text-red-500">Ksh {balance.toLocaleString()} <span className="text-xs font-normal text-gray-400">unpaid</span></p>
                                        {Number(inv.amount_paid) > 0 && <p className="text-xs text-gray-400">Paid: Ksh {Number(inv.amount_paid).toLocaleString()}</p>}
                                      </div>
                                    </div>
                                    <div className="flex gap-2 flex-wrap">
                                      {(['migrate', 'paid', 'clear'] as const).map((opt) => (
                                        <button key={opt} type="button" onClick={() => setArrearsAction((prev) => ({ ...prev, [inv.id]: opt }))}
                                          className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${action === opt ? opt === 'migrate' ? 'border-brand-purple bg-brand-purple text-white' : opt === 'paid' ? 'border-green-500 bg-green-500 text-white' : 'border-red-400 bg-red-400 text-white' : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'}`}>
                                          {opt === 'migrate' ? '↗ Migrate' : opt === 'paid' ? '✓ Mark paid' : '✕ Write off'}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {paidInvoices.length > 0 && (
                          <details>
                            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 select-none">Paid invoices ({paidInvoices.length}) — click to expand</summary>
                            <div className="mt-2 space-y-1">
                              {paidInvoices.map((inv) => (
                                <div key={inv.id} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-white/5 px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                                  <span>{inv.invoice_number} · {inv.due_date || inv.invoice_date}</span>
                                  <span className="text-green-600 font-semibold">✓ Ksh {Number(inv.amount_due).toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* ── STEP 4: Confirm ── */}
                {transferStep === 'confirm' && (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Review and confirm the transfer:</p>
                    <div className="rounded-xl border border-gray-200 dark:border-white/10 divide-y divide-gray-100 dark:divide-white/10 text-sm overflow-hidden">
                      <div className="flex justify-between px-4 py-3"><span className="text-gray-500">Tenant</span><span className="font-bold text-gray-900 dark:text-white">{getTenantDisplayName(tenantForTransfer)}</span></div>
                      <div className="flex justify-between px-4 py-3"><span className="text-gray-500">From</span><span className="font-medium text-gray-900 dark:text-white">Unit {tenantForTransfer.unit?.unit_number || '—'} · {tenantForTransfer.unit?.property?.name || '—'}</span></div>
                      <div className="flex justify-between px-4 py-3"><span className="text-gray-500">To</span><span className="font-bold text-brand-purple">Unit {selectedUnit?.unit_number || '—'} · {selectedUnit?.property?.name || (allProperties.length > 0 ? allProperties : derivedProperties).find(p => p.id === transferPropertyId)?.name || '—'}</span></div>
                      <div className="flex justify-between px-4 py-3"><span className="text-gray-500">Effective date</span><span className="font-medium text-gray-900 dark:text-white">{transferDate}</span></div>
                      {transferReason && <div className="flex justify-between px-4 py-3"><span className="text-gray-500">Reason</span><span className="font-medium text-gray-900 dark:text-white text-right max-w-[60%]">{transferReason}</span></div>}
                      {openInvoices.length > 0 && (
                        <div className="px-4 py-3">
                          <p className="text-gray-500 mb-2">Arrears ({openInvoices.length} invoices)</p>
                          <div className="space-y-1">
                            {openInvoices.map((inv) => {
                              const balance = Number(inv.amount_due) - Number(inv.amount_paid);
                              const action = arrearsAction[inv.id] || 'migrate';
                              const label = action === 'migrate' ? '↗ Migrate' : action === 'paid' ? '✓ Mark paid' : '✕ Write off';
                              const color = action === 'migrate' ? 'text-brand-purple' : action === 'paid' ? 'text-green-600' : 'text-red-500';
                              return (
                                <div key={inv.id} className="flex justify-between text-xs">
                                  <span className="text-gray-500">{inv.invoice_number} · Ksh {balance.toLocaleString()}</span>
                                  <span className={`font-bold ${color}`}>{label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {openInvoices.length === 0 && <div className="px-4 py-3 text-xs text-green-600">✓ No arrears — clean transfer</div>}
                    </div>
                  </div>
                )}

              </div>{/* end step content */}

              {/* Footer navigation */}
              <div className="flex items-center justify-between border-t border-gray-200 dark:border-white/10 px-6 py-4 shrink-0 gap-3">
                <button type="button"
                  onClick={() => {
                    if (transferStep === 'property-choice') setTenantForTransfer(null);
                    else if (transferStep === 'unit-choice') setTransferStep('property-choice');
                    else if (transferStep === 'arrears-review') setTransferStep('unit-choice');
                    else if (transferStep === 'confirm') setTransferStep('arrears-review');
                  }}
                  className="rounded-xl bg-gray-100 px-5 py-2.5 font-semibold text-gray-700 dark:bg-white/5 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                  {transferStep === 'property-choice' ? 'Cancel' : '← Back'}
                </button>

                {transferStep !== 'confirm' ? (
                  <button type="button"
                    disabled={(transferStep === 'unit-choice' && !transferUnitId) || (transferStep === 'unit-choice' && transferSameProperty === false && !transferPropertyId)}
                    onClick={() => {
                      if (transferStep === 'unit-choice') { void loadTransferInvoices(tenantForTransfer.id); setTransferStep('arrears-review'); }
                      else if (transferStep === 'arrears-review') setTransferStep('confirm');
                    }}
                    className="flex items-center gap-2 rounded-xl bg-brand-purple px-5 py-2.5 font-semibold text-white disabled:opacity-40 hover:bg-brand-pink transition-colors">
                    Continue →
                  </button>
                ) : (
                  <button type="button" disabled={isTransferring}
                    onClick={(e) => void submitUnitTransfer(e as any)}
                    className="flex items-center gap-2 rounded-xl bg-brand-purple px-5 py-2.5 font-semibold text-white disabled:opacity-50 hover:bg-brand-pink transition-colors">
                    <ArrowLeftRight size={16} />{isTransferring ? 'Swapping...' : 'Confirm Swap'}
                  </button>
                )}
              </div>

            </div>{/* end modal card */}
          </div>
        );
      })()}
    </div>
  );
}

