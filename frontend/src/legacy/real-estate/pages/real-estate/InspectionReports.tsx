// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { ClipboardCheck, Plus, XCircle, DollarSign, Save, Trash2, FileText, ChevronDown, ChevronRight, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { activityLogger } from '../../utils/activityLogger';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { UnifiedStorageService } from '../../services/UnifiedStorageService';
import { cache } from '../../utils/cache';
import { Skeleton } from '../../components/Skeleton';
import {
  buildScopedCacheKey,
  createInspectionTemplateFromUnitMix,
  createInspectionTemplateFromUnitContext,
  normalizePlannedUnitMix,
} from '../../utils/realEstate';

/** Small inline component: renders a + button that expands to a text input when clicked */
function InlineTagInput({ onAdd }: { onAdd: (val: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [val, setVal] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const commit = () => {
    const trimmed = val.trim();
    if (trimmed) { onAdd(trimmed); }
    setVal('');
    setOpen(false);
  };

  React.useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        title="Add repair item"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs border border-dashed border-gray-300 dark:border-white/20 text-gray-400 hover:text-brand-purple hover:border-brand-purple rounded-full px-2 py-0.5 transition-all"
      >
        <Plus size={10}/> Add item
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <label htmlFor="inline-tag-input" className="sr-only">New repair item name</label>
      <input
        id="inline-tag-input"
        ref={inputRef}
        type="text"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') { setVal(''); setOpen(false); } }}
        placeholder="Type item & press Enter"
        className="text-xs border border-brand-purple/50 rounded-full px-2 py-0.5 outline-none focus:ring-1 focus:ring-brand-purple bg-white dark:bg-dark-surface text-gray-900 dark:text-white w-36"
      />
      <button type="button" title="Save this repair item" onClick={commit} className="text-brand-purple hover:text-brand-pink transition-colors"><Plus size={12}/></button>
      <button type="button" title="Cancel adding repair item" onClick={() => { setVal(''); setOpen(false); }} className="text-gray-400 hover:text-red-500 transition-colors"><XCircle size={12}/></button>
    </span>
  );
}


interface PayerDetail {
  payer: string;
  amount: number;
}

interface InspectionUnit {
  id: string;
  unit_number: string;
  type?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  features?: string | null;
  description?: string | null;
  property_id?: string | null;
  company_id?: string | null;
  property?: {
    id?: string;
    name?: string;
    company_id?: string | null;
    planned_unit_mix?: unknown;
  } | null;
}

interface InspectionProperty {
  id: string;
  name: string;
  company_id?: string | null;
}

interface InspectionRow {
  id: string;
  unit_id?: string | null;
  tenant_id?: string | null;
  inspector_id?: string | null;
  inspection_date: string;
  inspection_type?: string | null;
  overall_remarks?: string | null;
  unit?: null;
  tenant?: null;
  inspector?: {
    id?: string | null;
    full_name?: string | null;
    email?: string | null;
  } | null;
}

interface InspectionTenant {
  id: string;
  full_name?: string | null;
  current_unit_id?: string | null;
  lease_start_date?: string | null;
  lease_end_date?: string | null;
  is_active?: boolean;
  company_id?: string | null;
}

interface InspectionItem {
  section: string;
  item: string;
  condition: 'good' | 'repair_needed' | 'replacement_needed';
  remarks: string;
  quantity?: number;
  unit_price?: number;
  repair_cost: number;
  cost_mapped_to: 'tenant' | 'agent' | 'landlord' | 'other';
  payer_details?: PayerDetail[];
  evidence_urls: string[];
}

const STANDARD_ITEMS = ['Door & Locks','Windows','Fasteners & Stays','Floor','Walls & Paint','Electric Sockets','Light Switches','DP Switch','Cooker Socket','Bulb Holders','Ceiling','Closet / Wardrobes','Cabinets'];
const WC_ITEMS = ['Door & Locks','Windows','Floor','Walls & Paint (Tiles)','Water Faucets & Taps','Toilet Bowl & Seat','Plumbing & Drainage','Instant Heater / Geyser','Shower Rose & Mixer','Mirror & Accessories','Bulb Holders','Ceiling'];

const ALL_SECTIONS = [
  { name: 'Living Room', items: STANDARD_ITEMS },
  { name: 'Master Bedroom', items: STANDARD_ITEMS },
  { name: 'Bedroom 2', items: STANDARD_ITEMS },
  { name: 'Bedroom 3', items: STANDARD_ITEMS },
  { name: 'Bedroom 4', items: STANDARD_ITEMS },
  { name: 'Bedroom 5', items: STANDARD_ITEMS },
  { name: 'Bedroom 6', items: STANDARD_ITEMS },
  { name: 'Kitchen', items: [...STANDARD_ITEMS, 'Sink & Faucets', 'Countertops'] },
  { name: 'Combined Washroom', items: WC_ITEMS },
  { name: 'Bathroom', items: WC_ITEMS },
  { name: 'Toilet', items: ['Door & Locks','Floor','Walls & Paint (Tiles)','Toilet Bowl & Seat','Flush System','Plumbing & Drainage','Bulb Holder'] },
  { name: 'Dining Room', items: STANDARD_ITEMS },
  { name: 'Stores', items: ['Door & Locks','Windows','Floor','Walls & Paint','Ceiling'] },
  { name: 'Balcony', items: ['Railing / Guard Rail','Floor','Walls & Paint','Door / Sliding Door','Drain / Water outlet'] },
  { name: 'Corridor', items: ['Floor','Walls & Paint','Ceiling','Lighting Fixtures','Windows'] },
];

export default function InspectionReports() {
  const { profile } = useAccess();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [units, setUnits] = useState<InspectionUnit[]>([]);
  const [properties, setProperties] = useState<InspectionProperty[]>([]);
  const [tenants, setTenants] = useState<InspectionTenant[]>([]);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({ unit_id: null as string | null, tenant_id: null as string | null, inspection_date: new Date().toISOString().split('T')[0], inspection_type: 'periodic' as 'move_in'|'move_out'|'periodic', overall_remarks: '', cost_mapped_to: 'landlord' as 'tenant'|'agent'|'landlord'|'other' });
  const [items, setItems] = useState<InspectionItem[]>([]);
  const [filterPropertyId, setFilterPropertyId] = useState<string | null>(null);
  const [filterUnitId, setFilterUnitId] = useState<string | null>(null);
  const inspectionCacheKey = buildScopedCacheKey('inspections_list', profile?.company_id);

  const getInspectionSchemaHint = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error || '');
    if (message.includes("Could not find the 'company_id' column of 're_inspections'")) {
      return 'The inspections table is missing the latest company scoping migration. Apply the newest Supabase migrations, then try again.';
    }
    return null;
  };

  // Initialize from cache
  useEffect(() => {
    const cached = cache.get<any[]>(inspectionCacheKey);
    if (cached) {
      setInspections(cached);
      setLoading(false);
    }
  }, [inspectionCacheKey]);

  useEffect(() => { if (profile) { fetchData(); fetchInspections(); } }, [profile]);

  const fetchData = async () => {
    try {
      const [propertiesRes, unitsRes] = await Promise.all([
        supabase.from('re_properties').select('id, name, company_id').order('name'),
        supabase
          .from('re_units')
          .select('id, unit_number, type, property_id, company_id')
          .order('unit_number'),
      ]);

      if (propertiesRes.error) throw propertiesRes.error;
      if (unitsRes.error) throw unitsRes.error;

      const tenantQuery = supabase
        .from('re_tenants')
        .select('id, full_name, current_unit_id, lease_start_date, lease_end_date, is_active, company_id');
      const { data: t, error: tenantsError } = await tenantQuery;
      if (tenantsError) throw tenantsError;

      setProperties((propertiesRes.data || []) as InspectionProperty[]);
      setUnits(((unitsRes.data || []) as InspectionUnit[]).map((unit) => ({
        ...unit,
        property: unit.property || (propertiesRes.data || []).find((property) => property.id === unit.property_id) || null,
      })));
      setTenants((t || []) as InspectionTenant[]);
    } catch (e: any) {
      console.error('Error loading inspection setup data:', e);
      setUnits([]);
      setProperties([]);
      setTenants([]);
      setToast({ message: e?.message || 'Failed to load units and tenants for inspection', type: 'error' });
    }
  };

  const fetchInspections = async () => {
    setLoading(true);
    try {
      const response = await supabase
        .from('re_inspections')
        .select('id, unit_id, tenant_id, inspector_id, inspection_date, inspection_type, overall_remarks, created_at, updated_at')
        .order('inspection_date', { ascending: false });
      if (response.error) throw response.error;
      const inspectionRows = (response.data || []) as InspectionRow[];
      const inspectorIds = [...new Set(inspectionRows.map((row) => row.inspector_id).filter(Boolean) as string[])];
      let inspectorLookup: Record<string, { id: string; full_name?: string | null; email?: string | null }> = {};
      if (inspectorIds.length > 0) {
        const inspectorsRes = await supabase.from('profiles').select('id, full_name, email').in('id', inspectorIds);
        if (inspectorsRes.error) throw inspectorsRes.error;
        inspectorLookup = Object.fromEntries(
          ((inspectorsRes.data || []) as Array<{ id: string; full_name?: string | null; email?: string | null }>).map((profile) => [
            profile.id,
            profile,
          ]),
        );
      }
      const enriched = inspectionRows.map((row) => ({
        ...row,
        inspector: row.inspector_id ? inspectorLookup[row.inspector_id] || null : null,
      }));
      setInspections(enriched);
      cache.set(inspectionCacheKey, enriched);
    } catch (e: any) {
      setToast({ message: getInspectionSchemaHint(e) || 'Failed to load inspections', type: 'error' });
    }
    finally { setLoading(false); }
  };

  const initItems = (unitId?: string) => {
    const unit = units.find(u => u.id === unitId);
    const propertyTemplate = createInspectionTemplateFromUnitMix([]);

    const initial: InspectionItem[] = [];

    const generatedSections = createInspectionTemplateFromUnitContext({
      type: unit?.type,
      features: [unit?.description].filter(Boolean).join(' '),
      propertyConfig: propertyTemplate,
    });

    const sectionsToUse = generatedSections.length > 0
      ? generatedSections
      : ALL_SECTIONS.map((section) => ({ section: section.name, items: section.items }));

    sectionsToUse.forEach((section) => {
      (section.items || []).forEach((item: string) => {
        initial.push({
          section: section.section,
          item,
          condition: 'good',
          remarks: '',
          quantity: 1,
          unit_price: 0,
          repair_cost: 0,
          cost_mapped_to: 'landlord',
          payer_details: [{ payer: 'landlord', amount: 0 }],
          evidence_urls: []
        });
      });
    });
    
    setItems(initial); 
    setCollapsed(new Set());
  };

  const getUnitLabel = (unitId?: string | null) => {
    if (!unitId) return 'Unknown unit';
    return units.find((unit) => unit.id === unitId)?.unit_number || unitId;
  };

  const getTenantName = (tenantId?: string | null) => {
    if (!tenantId) return 'N/A';
    const t = tenants.find((t) => t.id === tenantId);
    return t?.full_name || tenantId;
  };

  const getPropertyLabel = (unitId?: string | null) => {
    if (!unitId) return 'Unknown property';
    const unit = units.find((item) => item.id === unitId);
    const property = properties.find((item) => item.id === unit?.property_id);
    return property?.name || 'Unknown property';
  };

  const handleCreateNew = () => { 
    setFormData({ ...formData, unit_id: null, tenant_id: null });
    setItems([]); 
    setShowForm(true); 
  };

  const onUnitChange = (uid: string) => {
    const t = tenants.find(t => t.current_unit_id === uid);
    setFormData({...formData, unit_id: uid || null, tenant_id: t?.id || null});
    if (uid) initItems(uid);
    else setItems([]);
  };

  const updateItem = (idx: number, field: keyof InspectionItem, value: any) => { 
    const ni = [...items]; 
    ni[idx] = { ...ni[idx], [field]: value }; 
    if (field === 'quantity' || field === 'unit_price') {
      ni[idx].repair_cost = (ni[idx].quantity || 1) * (ni[idx].unit_price || 0);
    }
    setItems(ni); 
  };

  const addPayer = (idx: number) => {
    const ni = [...items];
    if (!ni[idx].payer_details) ni[idx].payer_details = [];
    ni[idx].payer_details!.push({ payer: 'landlord', amount: 0 });
    setItems(ni);
  };

  const removePayer = (itemIdx: number, payerIdx: number) => {
    const ni = [...items];
    ni[itemIdx].payer_details = ni[itemIdx].payer_details?.filter((_, i) => i !== payerIdx);
    setItems(ni);
  };

  const updatePayer = (itemIdx: number, payerIdx: number, field: keyof PayerDetail, value: any) => {
    const ni = [...items];
    if (ni[itemIdx].payer_details) {
      ni[itemIdx].payer_details![payerIdx] = { ...ni[itemIdx].payer_details![payerIdx], [field]: value };
    }
    setItems(ni);
  };

  const handleEvidenceUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await UnifiedStorageService.upload(file, {
        folder: '/inspections',
        bucket: 'inspection-evidence'
      });
      const ni = [...items];
      ni[idx].evidence_urls = [...(ni[idx].evidence_urls || []), url];
      setItems(ni);
      setToast({ message: 'Evidence uploaded!', type: 'success' });
    } catch (err) {
      setToast({ message: 'Upload failed', type: 'error' });
    }
  };

  const removeEvidence = (idx: number, urlIdx: number) => {
    const ni = [...items];
    ni[idx].evidence_urls = ni[idx].evidence_urls.filter((_, i) => i !== urlIdx);
    setItems(ni);
  };

  const downloadEvidence = async (url: string, fallbackName: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Download failed (${response.status})`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fallbackName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };
  const totalCost = () => items.reduce((s, i) => s + (i.repair_cost || 0), 0);
  const toggleSection = (name: string) => setCollapsed(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  const selectedUnit = units.find((unit) => unit.id === formData.unit_id);
  const selectedTenant = tenants.find((tenant) => tenant.id === formData.tenant_id) || tenants.find((tenant) => tenant.current_unit_id === formData.unit_id);

  useEffect(() => {
    if (formData.unit_id && units.length > 0 && items.length === 0) {
      initItems(formData.unit_id);
    }
  }, [formData.unit_id, units]);

  const filteredInspections = useMemo(() => {
    return inspections.filter(inspection => {
      // Filter by property
      if (filterPropertyId) {
        const inspectionUnit = units.find(u => u.id === inspection.unit_id);
        if (inspectionUnit?.property_id !== filterPropertyId) return false;
      }
      // Filter by unit
      if (filterUnitId && inspection.unit_id !== filterUnitId) return false;
      return true;
    });
  }, [inspections, filterPropertyId, filterUnitId, units]);

  // Get units for selected property filter
  const unitsForFilterProperty = useMemo(() => {
    if (!filterPropertyId) return units;
    return units.filter(u => u.property_id === filterPropertyId);
  }, [filterPropertyId, units]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.unit_id) { setToast({ message: 'Please select a unit', type: 'warning' }); return; }
    setSaving(true);
    try {
      const selectedUnitCompanyId = selectedUnit?.company_id || selectedUnit?.property?.company_id || null;
      const inspectionCompanyId = profile?.company_id || selectedUnitCompanyId || null;
      if (!inspectionCompanyId) {
        throw new Error('Could not determine the inspection company. Please refresh and try again.');
      }
      const { data: insp, error: e1 } = await supabase.from('re_inspections')
        .insert([{ ...formData, inspector_id: profile?.id, total_repair_cost: totalCost(), status: 'completed', company_id: inspectionCompanyId }]).select().single();
      if (e1) throw e1;
      const itemPayload = items.map(it => ({
        inspection_id: insp.id,
        section: it.section,
        item: it.item,
        condition: it.condition,
        remarks: it.remarks,
        repair_cost: it.repair_cost,
        evidence_urls: it.evidence_urls,
        payer_details: it.payer_details
      }));
      const { error: e2 } = await supabase.from('re_inspection_items').insert(itemPayload);
      if (e2) throw e2;
      
      // Auto-create finance requisition if there are repairs needed
      const repairsNeeded = items.filter(it => it.condition === 'repair_needed' || it.condition === 'replacement_needed');
      if (repairsNeeded.length > 0) {
        const totalRepairCost = repairsNeeded.reduce((sum, item) => sum + (item.repair_cost || 0), 0);
        
        // Get organization_id from profile
        const { data: profileData } = await supabase.from('profiles').select('organization_id').eq('id', profile?.id).single();
        const organizationId = profileData?.organization_id;
        
        if (organizationId) {
          // Generate requisition number
          const { data: lastReq } = await supabase
            .from('finance_requisitions')
            .select('requisition_number')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .limit(1);
          
          const lastNumber = lastReq?.[0]?.requisition_number ? parseInt(lastReq[0].requisition_number.split('-')[1] || '0') : 0;
          const newRequisitionNumber = `REQ-${String(lastNumber + 1).padStart(6, '0')}`;
          
          // Create requisition
          const { data: requisition, error: reqError } = await supabase
            .from('finance_requisitions')
            .insert([{
              organization_id: organizationId,
              requisition_number: newRequisitionNumber,
              title: `Repairs for ${getPropertyLabel(formData.unit_id)} - Unit ${getUnitLabel(formData.unit_id)}`,
              department: 'Real Estate Maintenance',
              needed_by: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
              priority: totalRepairCost > 50000 ? 'high' : 'normal',
              status: 'draft',
              justification: `Inspection report ${insp.id} identified ${repairsNeeded.length} repair items requiring attention. Total estimated cost: Ksh ${totalRepairCost.toLocaleString()}`,
              requested_by: profile?.id,
              created_by: profile?.id,
            }])
            .select()
            .single();
          
          if (reqError) throw reqError;
          
          // Create requisition items
          const requisitionItems = repairsNeeded.map((item, idx) => ({
            requisition_id: requisition.id,
            item_description: `${item.section} - ${item.item}`,
            specification: item.remarks || 'As per inspection report',
            quantity: item.quantity || 1,
            unit_cost: item.unit_price || (item.repair_cost / (item.quantity || 1)),
            line_total: item.repair_cost,
            display_order: idx,
          }));
          
          const { error: itemsError } = await supabase
            .from('finance_requisition_items')
            .insert(requisitionItems);
          
          if (itemsError) throw itemsError;
        }
      }
      
      await activityLogger.log({
        resourceId: insp.id,
        resourceType: 'inspection',
        actionType: 'create',
        actionCategory: 'real_estate',
        description: `New inspection report submitted for unit ${formData.unit_id}`,
        metadata: { item_count: items.length, inspection_type: formData.inspection_type, unit_id: formData.unit_id, tenant_id: formData.tenant_id }
      });

      setToast({ message: 'Inspection report saved successfully!' + (repairsNeeded.length > 0 ? ' Finance requisition created.' : ''), type: 'success' });
      setShowForm(false); fetchInspections();
    } catch (e: any) {
      const message = e?.message || 'Error saving inspection';
      const rlsHint = message.includes('row-level security')
        ? 'You have access to the inspection form, but the saved inspection is not matching the current company scope. Refresh after applying the latest migration, then try again.'
        : null;
      setToast({ message: getInspectionSchemaHint(e) || rlsHint || message, type: 'error' });
    }
    finally { setSaving(false); }
  };

  if (saving) return <div className="flex-1 p-8 flex items-center justify-center"><CustomLoader size={40} label="Saving inspection report..." /></div>;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-4">
            <img src="/unnamed-removebg-preview.webp" alt="Hakika Logo" className="w-16 h-16 object-contain dark:brightness-200" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1 flex items-center"><ClipboardCheck className="mr-3 text-brand-purple" size={32} />Property Unit Inspection Report</h1>
              <p className="text-gray-500 dark:text-gray-400">Move-in, move-out, or periodic unit condition assessments.</p>
            </div>
          </div>
          {!showForm && <button onClick={handleCreateNew} title="Start a new property unit inspection" className="px-4 py-2 bg-brand-purple text-white rounded-lg font-medium hover:bg-brand-pink transition-colors flex items-center shadow-sm"><Plus size={18} className="mr-2" />New Inspection</button>}
        </div>

        {showForm ? (
          <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-xl border border-gray-200 dark:border-white/10 overflow-hidden animate-fade-in mb-12">
            <div className="bg-brand-purple/5 dark:bg-brand-purple/10 px-6 py-4 border-b border-brand-purple/10 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Inspection Report</h2>
              <button title="Close form" onClick={() => setShowForm(false)} className="text-gray-500 hover:text-red-500 transition-colors"><XCircle size={24} /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-8 pb-32">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-gray-50 dark:bg-black/20 p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-inner">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Unit *</label>
                  <select 
                    title="Select Unit"
                    value={formData.unit_id || ''} 
                    onChange={e => onUnitChange(e.target.value)} 
                    required 
                    className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 px-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple text-sm font-bold text-gray-900 dark:text-white shadow-sm"
                  >
                    <option value="">Select Unit</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.property?.name || 'Property'} - {u.unit_number}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Tenant</label>
                  <select 
                    title="Select Tenant"
                    value={formData.tenant_id || ''} 
                    onChange={e => setFormData({...formData, tenant_id: e.target.value || null})} 
                    className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 px-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple text-sm font-bold text-gray-900 dark:text-white shadow-sm"
                  >
                    <option value="">Auto-detected / Select</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name || t.id}
                        {t.current_unit_id === formData.unit_id ? ' (Current occupant)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Date</label>
                  <input 
                    type="date" 
                    title="Inspection Date"
                    value={formData.inspection_date} 
                    onChange={e => setFormData({...formData, inspection_date: e.target.value})} 
                    className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 px-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple text-sm font-bold text-gray-900 dark:text-white shadow-sm" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Type</label>
                  <select 
                    title="Inspection Type"
                    value={formData.inspection_type} 
                    onChange={e => setFormData({...formData, inspection_type: e.target.value as any})} 
                    className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 px-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple text-sm font-bold text-gray-900 dark:text-white shadow-sm"
                  >
                    <option value="move_in">Move In</option>
                    <option value="move_out">Move Out</option>
                    <option value="periodic">Periodic</option>
                  </select>
                </div>
              </div>

              {selectedUnit && (
                <div className="grid grid-cols-1 gap-4 rounded-3xl border border-brand-purple/15 bg-brand-purple/5 p-6 md:grid-cols-2 xl:grid-cols-5">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-purple">Property</p>
                    <p className="mt-2 text-sm font-black text-gray-900 dark:text-white">{getPropertyLabel(selectedUnit.id)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-purple">Unit Layout</p>
                    <p className="mt-2 text-sm font-black text-gray-900 dark:text-white">{selectedUnit.type || 'Unit'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-purple">Current Tenant</p>
                    <p className="mt-2 text-sm font-black text-gray-900 dark:text-white">{selectedTenant?.full_name || 'No active tenant linked'}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{selectedTenant ? (selectedTenant.full_name || selectedTenant.id) : 'The inspection can still proceed without a tenant assignment.'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-purple">Unit Notes</p>
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">{selectedUnit.description || selectedUnit.features || 'No extra unit notes captured yet.'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-purple">Checklist Coverage</p>
                    <p className="mt-2 text-sm font-black text-gray-900 dark:text-white">{items.length} inspection points ready</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Sinks, sockets, wardrobes, windows, paint, and fixtures are prepared from the unit context.</p>
                  </div>
                </div>
              )}

              {formData.unit_id && items.length === 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                  Inspection details could not be generated for this unit yet. Re-select the unit after confirming its unit type and notes are filled in on the record.
                </div>
              )}

              <div className="space-y-10">
                {Array.from(new Set(items.map(i => i.section))).map(sec => {
                  const secItems = items.map((it, idx) => ({ it, idx })).filter(x => x.it.section === sec);
                  const isCol = collapsed.has(sec);
                  return (
                    <div key={sec} className="space-y-4">
                      <div className="flex items-center justify-between group/sec">
                        <button 
                          type="button" 
                          onClick={() => toggleSection(sec as string)} 
                          className="flex items-center gap-3"
                        >
                          <div className={`p-1.5 rounded-lg transition-colors ${isCol ? 'bg-gray-100 dark:bg-white/5 text-gray-400' : 'bg-brand-purple/10 text-brand-purple'}`}>
                            {isCol ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                          </div>
                          <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight italic flex items-center gap-3">
                            {sec}
                            <span className="px-2 py-0.5 bg-gray-100 dark:bg-white/5 rounded text-[10px] font-bold text-gray-500 normal-case tracking-normal italic">
                              {secItems.length} items
                            </span>
                          </h3>
                        </button>
                        <div className="h-[1px] flex-1 bg-gray-100 dark:bg-white/5 mx-6 group-hover/sec:bg-brand-purple/20 transition-colors" />
                        <InlineTagInput onAdd={(val) => {
                          setItems([...items, { 
                            section: sec, 
                            item: val, 
                            condition: 'good', 
                            remarks: '', 
                            quantity: 1, 
                            unit_price: 0, 
                            repair_cost: 0, 
                            cost_mapped_to: 'landlord', 
                            payer_details: [{ payer: 'landlord', amount: 0 }], 
                            evidence_urls: [] 
                          }]);
                        }} />
                      </div>

                      {!isCol && (
                        <div className="grid grid-cols-1 gap-6">
                          {secItems.map(({ it: item, idx }) => (
                            <div key={idx} className={`p-6 bg-white dark:bg-dark-surface rounded-3xl border transition-all duration-500 ${item.condition !== 'good' ? 'border-orange-200 dark:border-orange-500/20 shadow-2xl shadow-orange-500/10' : 'border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md'}`}>
                              <div className="flex flex-col lg:flex-row gap-8">
                                <div className="flex-1 space-y-6">
                                  <div className="flex items-start justify-between">
                                    <h4 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight italic">{item.item}</h4>
                                    <button 
                                      type="button" 
                                      title="Delete Item"
                                      onClick={() => setItems(items.filter((_, i) => i !== idx))}
                                      className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    {(['good', 'repair_needed', 'replacement_needed'] as const).map(cond => (
                                      <button
                                        key={cond}
                                        type="button"
                                        onClick={() => updateItem(idx, 'condition', cond)}
                                        className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                                          item.condition === cond 
                                            ? cond === 'good' ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-orange-500 text-white shadow-lg shadow-orange-500/20 scale-105'
                                            : 'bg-gray-100 dark:bg-white/5 text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                                        }`}
                                      >
                                        {cond.replace('_', ' ')}
                                      </button>
                                    ))}
                                  </div>

                                  <div className="space-y-3">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Evidence (Photos / Documents)</label>
                                    <div className="flex flex-wrap gap-3">
                                      {item.evidence_urls?.map((url, uIdx) => (
                                        <div key={uIdx} className="relative group/ev">
                                          <img src={url} alt="Evidence" className="w-16 h-16 rounded-xl object-cover border border-gray-100 dark:border-white/10 shadow-md transform transition-transform group-hover/ev:scale-110" />
                                          <button
                                            type="button"
                                            title="Download evidence"
                                            onClick={() => void downloadEvidence(url, `inspection-evidence-${idx + 1}-${uIdx + 1}`)}
                                            className="absolute -bottom-2 -left-2 w-5 h-5 bg-brand-purple text-white rounded-full flex items-center justify-center shadow-lg transform scale-0 group-hover/ev:scale-100 transition-transform"
                                          >
                                            <FileText size={10} />
                                          </button>
                                          <button 
                                            type="button" 
                                            title="Remove evidence"
                                            onClick={() => removeEvidence(idx, uIdx)}
                                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg transform scale-0 group-hover/ev:scale-100 transition-transform"
                                          >
                                            <X size={12} />
                                          </button>
                                        </div>
                                      ))}
                                      <label className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 dark:border-white/10 flex flex-col items-center justify-center text-gray-400 hover:border-brand-purple hover:text-brand-purple cursor-pointer transition-all hover:bg-brand-purple/5" title="Upload Evidence">
                                        <Plus size={20} />
                                        <span className="text-[8px] font-black uppercase mt-1">Upload</span>
                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleEvidenceUpload(idx, e)} />
                                      </label>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex-1 lg:max-w-md space-y-6">
                                  <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Inspector Remarks</label>
                                    <textarea
                                      placeholder="Provide specific details about damage or condition..."
                                      value={item.remarks}
                                      onChange={e => updateItem(idx, 'remarks', e.target.value)}
                                      className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-4 text-xs font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-purple h-28 shadow-inner transition-all"
                                    />
                                  </div>
                                  
                                  {item.condition !== 'good' && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Quantity</label>
                                          <input type="number" title="Quantity" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-black" />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block ml-1">Unit Price</label>
                                          <input type="number" title="Unit Price" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))} className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-black" />
                                        </div>
                                      </div>

                                      <div className="bg-orange-50 dark:bg-orange-500/5 rounded-2xl p-5 border border-orange-100 dark:border-orange-500/10 shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                          <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 bg-orange-500/10 rounded-lg flex items-center justify-center text-orange-500">
                                              <DollarSign size={16} />
                                            </div>
                                            <span className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-tight italic">Cost Splitting</span>
                                          </div>
                                          <button 
                                            type="button" 
                                            title="Add Payer"
                                            onClick={() => addPayer(idx)}
                                            className="px-3 py-1 bg-brand-purple/10 text-brand-purple rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-brand-purple hover:text-white transition-all shadow-sm"
                                          >
                                            + Add Payer
                                          </button>
                                        </div>

                                        <div className="space-y-3">
                                          {(item.payer_details || []).map((p, pIdx) => (
                                            <div key={pIdx} className="flex gap-2 items-center group/payer animate-in slide-in-from-right-4 duration-300">
                                              <select 
                                                title="Select Payer"
                                                value={['landlord', 'tenant', 'agent'].includes(p.payer) ? p.payer : 'other'} 
                                                onChange={e => updatePayer(idx, pIdx, 'payer', e.target.value === 'other' ? '' : e.target.value)}
                                                className="flex-1 bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-black outline-none focus:ring-2 focus:ring-brand-purple"
                                              >
                                                <option value="landlord">Landlord</option>
                                                <option value="tenant">Tenant</option>
                                                <option value="agent">Agent</option>
                                                <option value="other">Other Entity</option>
                                              </select>
                                              
                                              {!['landlord', 'tenant', 'agent'].includes(p.payer) && (
                                                <input 
                                                  type="text" 
                                                  placeholder="Entity name..." 
                                                  value={p.payer} 
                                                  onChange={e => updatePayer(idx, pIdx, 'payer', e.target.value)} 
                                                  className="flex-1 bg-white dark:bg-dark-surface border border-brand-purple/50 rounded-lg px-3 py-1.5 text-[10px] font-black outline-none focus:ring-1 focus:ring-brand-purple w-28"
                                                />
                                              )}
                                              <input 
                                                type="number" 
                                                title="Charge share"
                                                value={p.amount} 
                                                onChange={e => updatePayer(idx, pIdx, 'amount', Number(e.target.value))}
                                                className="w-28 bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-black" 
                                                placeholder="KES 0.00"
                                              />
                                              <button 
                                                type="button" 
                                                title="Remove Payer"
                                                onClick={() => removePayer(idx, pIdx)}
                                                className="text-gray-300 hover:text-red-500 opacity-0 group-hover/payer:opacity-100 transition-opacity p-1"
                                              >
                                                <Trash2 size={14} />
                                              </button>
                                            </div>
                                          ))}
                                          <div className="flex items-center justify-between pt-4 border-t border-orange-100 dark:border-orange-500/10 mt-2">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Calculated Item Total</span>
                                            <span className="text-base font-black text-orange-600 dark:text-orange-400 italic">KES {(item.repair_cost || 0).toLocaleString()}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="bg-white dark:bg-dark-surface rounded-3xl p-8 border border-gray-100 dark:border-white/5 space-y-4">
                 <h4 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight italic flex items-center gap-2">
                   <FileText size={20} className="text-brand-purple" /> Overall Final Remarks
                 </h4>
                 <textarea 
                   title="Overall inspection summary"
                   value={formData.overall_remarks} 
                   onChange={e => setFormData({...formData, overall_remarks: e.target.value})} 
                   placeholder="Write a general summary of the unit assessment here..." 
                   className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-4 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-purple min-h-[120px]"
                 />
              </div>

              <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[95%] lg:w-[60%] z-50">
                <div className="bg-white/90 dark:bg-dark-surface/90 backdrop-blur-2xl px-8 py-6 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] border border-white/20 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-brand-purple rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-brand-purple/40">
                      <DollarSign size={32} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-2">Grand Total Estimated Repairs</p>
                      <p className="text-3xl font-black text-gray-900 dark:text-white italic tracking-tighter">KES {totalCost().toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <button 
                      type="button" 
                      onClick={() => setShowForm(false)} 
                      className="flex-1 sm:flex-none px-8 py-4 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 rounded-3xl font-black text-xs uppercase tracking-[0.2em] hover:bg-gray-200 transition-all active:scale-95"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={saving} 
                      className="flex-1 sm:flex-none px-12 py-4 bg-brand-purple text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] hover:bg-brand-pink transition-all flex items-center justify-center gap-3 shadow-2xl shadow-brand-purple/30 active:scale-95 disabled:opacity-50"
                    >
                      {saving ? <CustomLoader size={20} /> : <><Save size={20}/> Finalize Report</>}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        ) : (
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
            {/* Filter Section */}
            <div className="border-b border-gray-200 dark:border-white/10 p-6 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Property Filter */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Filter by Property</label>
                  <select
                    value={filterPropertyId || ''}
                    onChange={(e) => {
                      setFilterPropertyId(e.target.value || null);
                      setFilterUnitId(null); // Reset unit filter when property changes
                    }}
                    className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-dark-surface px-4 py-2.5 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-purple"
                  >
                    <option value="">All Properties</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name || 'Unnamed Property'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Unit Filter */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Filter by Unit</label>
                  <select
                    value={filterUnitId || ''}
                    onChange={(e) => setFilterUnitId(e.target.value || null)}
                    disabled={!filterPropertyId}
                    className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-dark-surface px-4 py-2.5 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-purple disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">All Units{filterPropertyId ? ' in Property' : ''}</option>
                    {unitsForFilterProperty.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        Unit {unit.unit_number || 'N/A'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter Status */}
                <div className="rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/10 p-4">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Results</p>
                  <p className="text-2xl font-bold text-brand-purple">{filteredInspections.length}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">inspection{filteredInspections.length !== 1 ? 's' : ''} found</p>
                </div>
              </div>
            </div>

            {filteredInspections.length === 0 && !loading ? (
              <div className="p-12 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-brand-purple/10 text-brand-purple rounded-full flex items-center justify-center mb-4"><ClipboardCheck size={32}/></div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Inspections Found</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">Try adjusting your filters or create a new inspection report.</p>
                <button onClick={handleCreateNew} title="Create inspection report" className="px-4 py-2 bg-brand-purple text-white rounded-lg hover:bg-brand-pink transition-colors">Create Report</button>
              </div>
            ) : inspections.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-brand-purple/10 text-brand-purple rounded-full flex items-center justify-center mb-4"><ClipboardCheck size={32}/></div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Inspections Yet</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">Start by creating a move-in or move-out report.</p>
                <button onClick={handleCreateNew} title="Create first inspection report" className="px-4 py-2 bg-brand-purple text-white rounded-lg hover:bg-brand-pink transition-colors">Create First Report</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                    <tr>
                      {['Date','Written By','Property / Unit','Tenant','Type','Cost Billed To','Total Cost','Status','Actions'].map(h => (
                        <th key={h} className={`px-6 py-4 font-medium text-gray-500 uppercase tracking-wider text-xs ${h==='Actions'?'text-right':''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                    {loading && !inspections.length ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-4 w-28" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-4 w-28" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-3 w-16 rounded-full" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                          <td className="px-6 py-4"><Skeleton className="h-4 w-20" /></td>
                          <td className="px-6 py-4 text-right"><Skeleton className="h-8 w-8 rounded-lg ml-auto" /></td>
                        </tr>
                      ))
                    ) : filteredInspections.map((insp) => (
                      <tr key={insp.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white font-medium">{new Date(insp.inspection_date).toLocaleDateString('en-KE',{day:'2-digit',month:'short',year:'numeric'})}</td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400 font-medium">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {insp.inspector?.full_name || 'Unknown author'}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {insp.inspector?.email || 'No email available'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4"><div><p className="font-bold text-gray-900 dark:text-white">{insp.unit?.property?.name}</p><p className="text-xs text-gray-500">Unit {insp.unit?.unit_number}</p></div></td>
                        <td className="px-6 py-4 text-gray-600 dark:text-gray-400 font-medium">{getTenantName(insp.tenant_id)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-[10px] uppercase font-black ${insp.inspection_type==='move_in'?'bg-blue-100 text-blue-700':insp.inspection_type==='move_out'?'bg-orange-100 text-orange-700':'bg-gray-100 text-gray-700'}`}>
                            {(insp.inspection_type as string).replace('_',' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4"><span className="capitalize text-xs font-bold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-white/10 px-2 py-1 rounded">{insp.cost_mapped_to||'landlord'}</span></td>
                        <td className="px-6 py-4 font-mono font-bold text-gray-900 dark:text-white">Ksh {(insp.total_repair_cost||0).toLocaleString()}</td>
                        <td className="px-6 py-4"><div className="flex items-center gap-1.5 text-green-500 font-bold text-xs uppercase"><CheckCircle2 size={14}/>Completed</div></td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button title="View" className="p-2 text-gray-400 hover:text-brand-purple transition-colors bg-white dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10"><FileText size={16}/></button>
                            <button title="Delete" className="p-2 text-gray-400 hover:text-red-500 transition-colors bg-white dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10"><Trash2 size={16}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      {toast && <CustomToast message={toast.message} type={toast.type} isVisible={!!toast} onClose={() => setToast(null)}/>}
    </div>
  );
}
