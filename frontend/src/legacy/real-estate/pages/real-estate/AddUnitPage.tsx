// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Save, Settings, Info, Plus, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { resolveCompanyScope } from '../../utils/companyScope';

interface Property {
  id: string;
  name: string;
}

interface UnitRecord {
  id: string;
  property_id: string;
  unit_number: string;
  lease_type?: 'residential' | 'commercial' | null;
  type: string;
  rent_amount: number | string;
  status: string;
  floor_number?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  description?: string | null;
  photo_url?: string | null;
  features?: string | null;
  garbage_amount?: number | null;
  internet_amount?: number | null;
  last_water_reading?: number | null;
  last_electricity_reading?: number | null;
}

interface UnitTypeItem {
  id: string;
  name: string;
  label: string | null;
  lease_type?: 'tenant' | 'commercial' | null;
}

const DEFAULT_UNIT_TYPES = [
  { value: 'studio', label: 'Studio / Bedsitter' },
  { value: 'single_room', label: 'Single room (shared bathroom)' },
  { value: '1BR', label: '1 Bedroom' },
  { value: '2BR', label: '2 Bedroom' },
  { value: '3BR', label: '3 Bedroom' },
  { value: '4BR', label: '4 Bedroom' },
  { value: '5BR', label: '5 Bedroom' },
  { value: '6BR', label: '6 Bedroom' },
  { value: 'penthouse', label: 'Penthouse' },
  { value: 'commercial', label: 'Commercial Space' },
  { value: 'office', label: 'Office Suite' },
  { value: 'shop', label: 'Shop / Retail' },
];

export default function AddUnitPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useAccess();
  const [properties, setProperties] = useState<Property[]>([]);
  const [unitTypes, setUnitTypes] = useState<UnitTypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [typeCreating, setTypeCreating] = useState(false);
  const [typeSaving, setTypeSaving] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeLeaseType, setNewTypeLeaseType] = useState<'tenant' | 'commercial'>('tenant');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    property_id: '',
    unit_number: '',
    lease_type: 'residential' as 'residential' | 'commercial',
    type: '1BR',
    bedrooms: '1',
    bathrooms: '1',
    rent_amount: '',
    status: 'vacant',
    floor_number: '',
    water_utility_account: '',
    electricity_utility_account: '',
    last_water_reading: '0',
    last_electricity_reading: '0',
    garbage_amount: '0',
    internet_amount: '0',
    features: '',
    description: '',
  });

  useEffect(() => {
    void fetchData();
  }, []);

  useEffect(() => {
    let active = true;
    const syncScope = async () => {
      const { companyId: resolvedCompanyId } = await resolveCompanyScope(profile);
      if (active) setCompanyId(resolvedCompanyId);
    };
    void syncScope();
    return () => {
      active = false;
    };
  }, [profile]);

  useEffect(() => {
    const propertyId = searchParams.get('property_id');
    if (propertyId) setFormData((prev) => ({ ...prev, property_id: propertyId }));
  }, [searchParams]);

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId) return;
    let active = true;
    const loadEdit = async () => {
      setLoadingEdit(true);
      try {
        const { data, error } = await supabase
          .from('re_units')
          .select('id, property_id, unit_number, lease_type, type, rent_amount, status, floor_number, bedrooms, bathrooms, description, photo_url, features, garbage_amount, internet_amount, last_water_reading, last_electricity_reading')
          .eq('id', editId)
          .maybeSingle();
        if (error) throw error;
        if (!active || !data) return;
        const unit = data as UnitRecord;
        setFormData({
          property_id: unit.property_id || '',
          unit_number: unit.unit_number || '',
          lease_type: unit.lease_type === 'commercial' ? 'commercial' : 'residential',
          type: unit.type || '1BR',
          bedrooms: String(unit.bedrooms ?? '1'),
          bathrooms: String(unit.bathrooms ?? '1'),
          rent_amount: String(unit.rent_amount ?? ''),
          status: unit.status || 'vacant',
          floor_number: unit.floor_number || '',
          water_utility_account: '',
          electricity_utility_account: '',
          last_water_reading: String(unit.last_water_reading ?? '0'),
          last_electricity_reading: String(unit.last_electricity_reading ?? '0'),
          garbage_amount: String(unit.garbage_amount ?? '0'),
          internet_amount: String(unit.internet_amount ?? '0'),
          features: unit.features || '',
          description: unit.description || '',
        });
      } catch (error: any) {
        setToast({ message: error?.message || 'Failed to load unit for editing', type: 'error' });
      } finally {
        if (active) setLoadingEdit(false);
      }
    };
    void loadEdit();
    return () => { active = false; };
  }, [searchParams]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let propData: Property[] | null = null;
      let propError: any = null;
      const propertySelects = [
        'id, name',
        'id, name, company_id, created_at',
        '*, re_units(id)',
      ] as const;

      for (const select of propertySelects) {
        const response = await supabase
          .from('re_properties')
          .select(select)
          .is('deleted_at', null)
          .eq('is_deleted', false)
          .order('name', { ascending: true });
        if (!response.error) {
          propData = (response.data || []) as Property[];
          propError = null;
          break;
        }
        propError = response.error;
      }

      const { data: typeData, error: typeError } = await supabase
        .from('re_unit_types')
        .select('id, name, label, lease_type')
        .order('label');

      if (propError) throw propError;
      if (typeError) throw typeError;
      setProperties(propData || []);
      setUnitTypes(typeData || []);
    } catch {
      setToast({ message: 'Failed to load properties', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const unitTypeOptions = useMemo(() => {
    const fromDb = unitTypes.map((t) => ({ value: t.name, label: t.label?.trim() || t.name }));
    const merged = [...DEFAULT_UNIT_TYPES];
    fromDb.forEach((item) => {
      if (!merged.some((existing) => existing.value === item.value)) merged.push(item);
    });
    return merged;
  }, [unitTypes]);

  const createUnitType = async () => {
    const name = newTypeName.trim();
    if (!name) {
      setToast({ message: 'Enter a unit type name.', type: 'warning' });
      return;
    }

    setTypeSaving(true);
    try {
      const { error } = await supabase.from('re_unit_types').insert([
        {
          name,
          lease_type: newTypeLeaseType,
          created_by: profile?.id,
        },
      ]);
      if (error) throw error;

      setToast({ message: 'Unit type added successfully!', type: 'success' });
      setNewTypeName('');
      setNewTypeLeaseType('tenant');
      await fetchData();
      setFormData((prev) => ({ ...prev, type: name }));
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to add unit type', type: 'error' });
    } finally {
      setTypeSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.property_id || !formData.unit_number.trim() || !formData.rent_amount) {
      setToast({ message: 'Fill all required fields (*)', type: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        property_id: formData.property_id,
        unit_number: formData.unit_number,
        lease_type: formData.lease_type,
        type: formData.type,
        bedrooms: Number(formData.bedrooms || 0),
        bathrooms: Number(formData.bathrooms || 0),
        rent_amount: Number(formData.rent_amount),
        status: formData.status,
        floor_number: formData.floor_number || null,
        water_utility_account: formData.water_utility_account || null,
        electricity_utility_account: formData.electricity_utility_account || null,
        last_water_reading: Number(formData.last_water_reading || 0),
        last_electricity_reading: Number(formData.last_electricity_reading || 0),
        garbage_amount: Number(formData.garbage_amount || 0),
        internet_amount: Number(formData.internet_amount || 0),
        features: formData.features,
        description: formData.description,
        created_by: profile?.id,
        company_id: companyId,
      };

      const editId = searchParams.get('edit');
      const { error } = editId
        ? await supabase.from('re_units').update(payload).eq('id', editId)
        : await supabase.from('re_units').insert([payload]);
      if (error) throw error;

      setToast({ message: editId ? 'Unit updated successfully!' : 'Unit added successfully!', type: 'success' });
      navigate('/app/real-estate/houses');
    } catch (err: any) {
      setToast({ message: err.message || 'Save failed', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-brand-purple dark:border-white/10 dark:bg-black/30 dark:text-white';

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/app/real-estate/houses')}
            className="rounded-xl border border-gray-200 bg-white p-2 text-gray-500 transition hover:border-brand-purple/30 hover:text-brand-purple dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:text-white"
            title="Back to Units"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="flex items-center text-3xl font-bold text-gray-900 dark:text-white">
              <Settings className="mr-3 text-brand-purple" size={32} />
              {searchParams.get('edit') ? 'Edit Unit' : 'Configure New Unit'}
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              {searchParams.get('edit') ? 'Update the unit details using the full Hakika unit setup form.' : 'Create a new unit using the full Hakika unit setup form.'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-gray-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-dark-surface">
        {loading || loadingEdit ? (
          <div className="flex justify-center py-10">
            <CustomLoader size={32} label={loadingEdit ? 'Loading unit...' : 'Loading properties...'} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Lease Type</label>
                <select
                  value={formData.lease_type}
                  onChange={(e) => setFormData({ ...formData, lease_type: e.target.value as 'residential' | 'commercial' })}
                  className={inputCls}
                  title="Choose whether this unit is for tenant/residential or commercial leasing"
                >
                  <option value="residential">Residential / Tenant Lease</option>
                  <option value="commercial">Commercial Lease</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Target Property *</label>
                <select value={formData.property_id} onChange={(e) => setFormData({ ...formData, property_id: e.target.value })} className={inputCls}>
                  <option value="">-- Select Property --</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Unit Number/Name *</label>
                <input
                  value={formData.unit_number}
                  onChange={(e) => setFormData({ ...formData, unit_number: e.target.value })}
                  placeholder="e.g. House 04, Apt A7"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
              <div className="space-y-2 md:col-span-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Unit Type</label>
                  <button
                    type="button"
                    onClick={() => setTypeCreating((prev) => !prev)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:border-brand-purple hover:text-brand-purple dark:border-white/10 dark:bg-white/5 dark:text-gray-300"
                    title="Add new unit type"
                    aria-label="Add new unit type"
                  >
                    {typeCreating ? <X size={14} /> : <Plus size={14} />}
                  </button>
                </div>
                <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className={inputCls}>
                  {unitTypeOptions.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Single room units are saved with shared bathroom access, so the private bathroom count is set to 0.
                </p>
                {typeCreating && (
                  <div className="space-y-2 rounded-2xl border border-dashed border-gray-200 p-4 dark:border-white/10">
                    <input
                      value={newTypeName}
                      onChange={(e) => setNewTypeName(e.target.value)}
                      placeholder="Unit type name, e.g. Duplex"
                      className={inputCls}
                    />
                    <select
                      value={newTypeLeaseType}
                      onChange={(e) => setNewTypeLeaseType(e.target.value as 'tenant' | 'commercial')}
                      className={inputCls}
                    >
                      <option value="tenant">Tenant / Residential</option>
                      <option value="commercial">Commercial</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void createUnitType()}
                      disabled={typeSaving}
                      className="inline-flex items-center rounded-xl bg-brand-purple px-4 py-2 text-sm font-semibold text-white hover:bg-brand-pink disabled:opacity-50"
                    >
                      {typeSaving ? 'Saving...' : 'Save type'}
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Bedrooms</label>
                <input type="number" min="0" value={formData.bedrooms} onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })} className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Bathrooms</label>
                <input type="number" min="0" value={formData.bathrooms} onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })} className={inputCls} />
              </div>
              <div className="space-y-2 md:col-span-1">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Rent Amount (Ksh) *</label>
                <input type="number" min="0" value={formData.rent_amount} onChange={(e) => setFormData({ ...formData, rent_amount: e.target.value })} className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Occupancy Status</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className={inputCls}>
                  <option value="vacant">Vacant</option>
                  <option value="occupied">Occupied</option>
                  <option value="under_maintenance">Under Maintenance</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Floor/Location</label>
              <input
                value={formData.floor_number}
                onChange={(e) => setFormData({ ...formData, floor_number: e.target.value })}
                placeholder="e.g. Ground Floor, 4th Floor East Wing"
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Water Utility Account</label>
                <input
                  value={formData.water_utility_account}
                  onChange={(e) => setFormData({ ...formData, water_utility_account: e.target.value })}
                  placeholder="e.g. Water meter / account number"
                  className={inputCls}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Electricity Utility Account</label>
                <input
                  value={formData.electricity_utility_account}
                  onChange={(e) => setFormData({ ...formData, electricity_utility_account: e.target.value })}
                  placeholder="e.g. KPLC account / meter number"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50 p-5 dark:border-white/5 dark:bg-black/20">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-gray-400">
                <Info size={14} /> Utility & Meter Configuration
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-gray-500">Initial Water Meter</label>
                  <input type="number" value={formData.last_water_reading} onChange={(e) => setFormData({ ...formData, last_water_reading: e.target.value })} className={inputCls} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-gray-500">Initial Electricity Meter</label>
                  <input type="number" value={formData.last_electricity_reading} onChange={(e) => setFormData({ ...formData, last_electricity_reading: e.target.value })} className={inputCls} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-gray-500">Unit Garbage Charge (Monthly)</label>
                  <input type="number" value={formData.garbage_amount} onChange={(e) => setFormData({ ...formData, garbage_amount: e.target.value })} className={inputCls} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase text-gray-500">Unit Internet Charge (Monthly)</label>
                  <input type="number" value={formData.internet_amount} onChange={(e) => setFormData({ ...formData, internet_amount: e.target.value })} className={inputCls} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Distinctive Features</label>
              <input
                value={formData.features}
                onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                placeholder="e.g. Master ensuite, Lake view, Balcony, Dedicated parking"
                className={inputCls}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Internal Description / Notes</label>
              <textarea
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Any specific notes about this unit's condition or layout..."
                className={inputCls}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => navigate('/app/real-estate/houses')} className="rounded-2xl px-6 py-3 font-bold text-gray-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="inline-flex items-center rounded-2xl bg-brand-purple px-8 py-3 font-bold text-white shadow-lg shadow-brand-purple/20 hover:bg-brand-pink disabled:opacity-50">
                {saving ? <CustomLoader size={20} className="mr-2" /> : <Save className="mr-2" size={20} />}
                {saving ? 'Saving...' : 'Save Unit'}
              </button>
            </div>
          </>
        )}
      </form>

      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
