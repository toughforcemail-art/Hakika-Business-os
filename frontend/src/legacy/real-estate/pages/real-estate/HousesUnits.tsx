// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  Home, Plus, Building2, Edit2, Trash2, DollarSign, Info,
  MapPin, Droplets, Zap, Wifi, Trash, Save, X, AlertTriangle,
  Search, Filter, List, LayoutGrid, Upload, CheckCircle2,
  ChevronRight, ArrowRight, Printer, FileText, Package
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { printWorkspacePage } from '../../utils/printHelpers';
import { resolveCompanyScope } from '../../utils/companyScope';
import {
  calculatePlannedUnitTotals,
  getUnitTypeLabel,
  normalizePlannedUnitMix,
  PlannedUnitMixEntry,
} from '../../utils/realEstate';

interface Property {
  id: string;
  name: string;
  planned_unit_mix?: PlannedUnitMixEntry[] | null;
}

interface Unit {
  id: string;
  property_id: string;
  unit_number: string;
  type: string;
  rent_amount: number;
  status: string;
  property?: { name: string };
  floor_number?: string;
  bedrooms?: number;
  bathrooms?: number;
  description?: string;
  photo_url?: string;
  features?: string;
  garbage_amount?: number;
  internet_amount?: number;
  last_water_reading?: number;
  last_electricity_reading?: number;
  created_at: string;
}

const UNIT_TYPES = [
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

const normalizeUnitType = (value: string) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'single room' || raw === 'single-room' || raw === 'single_room') return 'single_room';
  if (raw === 'studio / bedsitter' || raw === 'studio-bedsitter') return 'studio';
  return value;
};

const STATUS_COLORS: Record<string, string> = {
  vacant: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30',
  occupied: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30',
  under_maintenance: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/30',
};

export default function HousesUnits() {
  const { profile, loading: authLoading } = useAccess();
  const navigate = useNavigate();
  const location = useLocation();
  const [units, setUnits] = useState<Unit[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Form & Edit State
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const initialFormData = {
    property_id: '',
    unit_number: '',
    type: '1BR',
    rent_amount: '',
    status: 'vacant',
    floor_number: '',
    bedrooms: '1',
    bathrooms: '1',
    description: '',
    photo_url: '',
    features: '',
    garbage_amount: '0',
    internet_amount: '0',
    last_water_reading: '0',
    last_electricity_reading: '0',
  };

  const [formData, setFormData] = useState(initialFormData);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { companyId: resolvedCompanyId } = await resolveCompanyScope(profile);
      setCompanyId(resolvedCompanyId);

      const { data: propsData, error: propsError } = await supabase
        .from('re_properties')
        .select('id, name, planned_unit_mix')
        .order('name');
      if (propsError) throw propsError;
      setProperties((propsData || []).map((property) => ({
        ...property,
        planned_unit_mix: normalizePlannedUnitMix((property as Property).planned_unit_mix),
      })));

      const { data: unitsData, error: unitsError } = await supabase
        .from('re_units')
        .select('*, property:re_properties(name)')
        .order('unit_number', { ascending: true });
      if (unitsError) throw unitsError;
      setUnits(unitsData || []);
    } catch (error: any) {
      console.error('Error fetching units:', error);
      setToast({ message: 'Failed to load data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (profile && !authLoading) fetchData(); }, [profile, authLoading]);

  useEffect(() => {
    const search = new URLSearchParams(location.search);
    const propertyId = search.get('property_id');
    const action = search.get('action');
    const editUnitId = search.get('edit');

    if (propertyId && action === 'add' && !editingId) {
      setFormData((prev) => ({ ...prev, property_id: propertyId }));
      setShowForm(true);
    }

    if (editUnitId && units.length > 0) {
      const target = units.find((unit) => unit.id === editUnitId);
      if (target) handleEdit(target);
    }
  }, [location.search, units]);

  const handleEdit = (unit: Unit) => {
    navigate(`/app/real-estate/units/add?edit=${unit.id}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.property_id || !formData.unit_number.trim() || !formData.rent_amount) {
      setToast({ message: 'Fill all required fields (*)', type: 'warning' });
      return;
    }

    setIsSubmitting(true);
    try {
      // Validate Numeric Fields
      const rent = Number(formData.rent_amount);
      const garbage = Number(formData.garbage_amount);
      const internet = Number(formData.internet_amount);
      const water = Number(formData.last_water_reading);
      const elec = Number(formData.last_electricity_reading);
      const bedrooms = Number(formData.bedrooms);
      const bathrooms = Number(formData.bathrooms);

      if (isNaN(rent) || isNaN(garbage) || isNaN(internet) || isNaN(water) || isNaN(elec) || isNaN(bedrooms) || isNaN(bathrooms)) {
         setToast({ message: 'Rent and utility amounts must be valid numbers', type: 'error' });
         setIsSubmitting(false);
         return;
      }

      const payload = {
        property_id: formData.property_id,
        unit_number: formData.unit_number,
        type: normalizeUnitType(formData.type),
        rent_amount: rent,
        bedrooms,
        bathrooms,
        status: formData.status,
        floor_number: formData.floor_number,
        description: formData.description,
        photo_url: formData.photo_url,
        features: formData.features,
        garbage_amount: garbage,
        internet_amount: internet,
        last_water_reading: water,
        last_electricity_reading: elec,
        created_by: profile?.id,
        company_id: companyId,
      };

      if (editingId) {
        const { error } = await supabase.from('re_units').update(payload).eq('id', editingId);
        if (error) throw error;
        setToast({ message: 'Unit updated successfully!', type: 'success' });
      } else {
        const { error } = await supabase.from('re_units').insert([payload]);
        if (error) throw error;
        setToast({ message: 'Unit added successfully!', type: 'success' });
      }

      setShowForm(false);
      setEditingId(null);
      setFormData(initialFormData);
      fetchData();
    } catch (error: any) {
      console.error('Submission error:', error);
      let msg = error.message || 'Error saving unit';
      if (msg.includes('invalid input syntax for type integer')) {
         msg = 'One of the numeric fields (like Floor or Meter Reading) has an invalid text value. Please check your inputs.';
      }
      setToast({ message: msg, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('re_units').delete().eq('id', id);
      if (error) throw error;
      setToast({ message: 'Unit removed successfully', type: 'success' });
      setConfirmDelete(null);
      fetchData();
    } catch (error: any) {
      setToast({ message: 'Failed to delete unit', type: 'error' });
    }
  };

  const filteredUnits = units.filter(u => 
    (
      u.unit_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.property?.name.toLowerCase().includes(searchTerm.toLowerCase())
    ) &&
    (!propertyFilter || u.property_id === propertyFilter) &&
    (!typeFilter || u.type === typeFilter) &&
    (!statusFilter || u.status === statusFilter)
  );
  const selectedProperty = properties.find((property) => property.id === formData.property_id);
  const selectedPropertyMix = normalizePlannedUnitMix(selectedProperty?.planned_unit_mix);
  const selectedPropertyPlanTotals = calculatePlannedUnitTotals(selectedPropertyMix);
  const isEmptyWorkspace = !loading && properties.length === 0 && units.length === 0;

  if (loading && !units.length) return <div className="flex-1 p-8 flex items-center justify-center"><CustomLoader size={40} label="Fetching units..." /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
              <Home className="mr-3 text-brand-purple" size={32} />
              Houses & Residential Units
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Manage inventory, vacancy status, and unit-specific configurations.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-white dark:bg-dark-surface p-1 rounded-lg border border-gray-200 dark:border-white/10">
              <button 
                onClick={() => setViewMode('table')}
                title="Switch to table view"
                className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-brand-purple text-white' : 'text-gray-500 hover:text-brand-purple'}`}
              >
                <List size={20} />
              </button>
              <button 
                onClick={() => setViewMode('grid')}
                title="Switch to grid view"
                className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-brand-purple text-white' : 'text-gray-500 hover:text-brand-purple'}`}
              >
                <LayoutGrid size={20} />
              </button>
            </div>
            <button onClick={() => printWorkspacePage()} title="Print unit list" className="px-4 py-2 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition flex items-center gap-2">
              <Printer size={16} /> Print
            </button>
            <button 
              onClick={() => {
                if (window.confirm('Delete selected units?')) {
                  setToast({ message: 'Bulk delete functionality to be implemented.', type: 'info' });
                }
              }} 
              title="Delete selected units"
              className="px-4 py-2 bg-rose-500/10 text-rose-500 text-sm font-medium rounded-xl hover:bg-rose-500/20 transition flex items-center gap-2"
            >
              <Trash2 size={16} /> Delete
            </button>
            <button 
              onClick={() => navigate('/app/real-estate/units/add')}
              title="Add a new residential unit"
              className="px-5 py-2.5 bg-brand-purple text-white rounded-xl font-bold hover:bg-brand-pink transition-all flex items-center shadow-lg shadow-brand-purple/25"
            >
              <Plus size={20} className="mr-2" /> Add New Unit
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="relative mb-6">
          <label htmlFor="search-units" className="sr-only">Search units by number or property name</label>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            id="search-units"
            type="text"
            placeholder="Search by unit number or property name..."
            title="Search units and houses"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-brand-purple text-gray-900 dark:text-white shadow-sm"
          />
        </div>

        <div className="mb-6 flex flex-wrap gap-3">
          <select value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-dark-surface dark:text-white">
            <option value="">All Properties</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>{property.name}</option>
            ))}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-dark-surface dark:text-white">
            <option value="">All Types</option>
            {UNIT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-dark-surface dark:text-white">
            <option value="">All Statuses</option>
            <option value="vacant">Vacant</option>
            <option value="occupied">Occupied</option>
            <option value="under_maintenance">Under Maintenance</option>
          </select>
          {(propertyFilter || typeFilter || statusFilter || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setPropertyFilter('');
                setTypeFilter('');
                setStatusFilter('');
                setSearchTerm('');
              }}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 dark:border-white/10 dark:bg-dark-surface dark:text-gray-300"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Form Modal / Panel */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
            <div className="bg-white dark:bg-dark-surface rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto border border-white/10">
              <div className="px-8 py-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-black/20">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingId ? 'Edit Residential Unit' : 'Configure New Unit'}
                </h2>
                <button onClick={() => setShowForm(false)} title="Close modal" className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors">
                  <X className="text-gray-500" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
                
                {/* Visual Section: Unit Context */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="unit-property" className="text-sm font-bold text-gray-700 dark:text-gray-300">Target Property *</label>
                    <select
                      id="unit-property"
                      required
                      value={formData.property_id}
                      onChange={(e) => setFormData({...formData, property_id: e.target.value})}
                      title="Select property for this unit"
                      className="w-full bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple"
                    >
                      <option value="">-- Select Property --</option>
                      {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="unit-number" className="text-sm font-bold text-gray-700 dark:text-gray-300">Unit Number/Name *</label>
                    <input
                      id="unit-number"
                      required
                      type="text"
                      placeholder="e.g. House 04, Apt A7"
                      value={formData.unit_number}
                      onChange={(e) => setFormData({...formData, unit_number: e.target.value})}
                      title="Unit Number or Name"
                      className="w-full bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple"
                    />
                  </div>
                </div>

                {selectedProperty && (
                  <div className="rounded-2xl border border-brand-purple/15 bg-brand-purple/5 p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-black text-gray-900 dark:text-white">{selectedProperty.name}</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Planned {selectedPropertyPlanTotals.totalUnits} units and {selectedPropertyPlanTotals.totalBedrooms} bedrooms across the property.
                        </p>
                      </div>
                      {selectedPropertyMix.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {selectedPropertyMix.map((entry) => (
                            <span key={entry.id} className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-700 shadow-sm dark:bg-dark-surface dark:text-gray-200">
                              {entry.count} {getUnitTypeLabel(entry.type)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="unit-type" className="text-sm font-bold text-gray-700 dark:text-gray-300">Unit Type</label>
                    <select
                      id="unit-type"
                      value={formData.type}
                      onChange={(e) => {
                        const nextType = e.target.value;
                        setFormData((current) => ({
                          ...current,
                          type: nextType,
                          bedrooms: nextType === 'single_room' ? '1' : current.bedrooms,
                          bathrooms: nextType === 'single_room' ? '0' : current.bathrooms,
                        }));
                      }}
                      title="Select unit layout type"
                      className="w-full bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple"
                    >
                      {UNIT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Single room units are saved with shared bathroom access, so the private bathroom count is set to 0.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="unit-bedrooms" className="text-sm font-bold text-gray-700 dark:text-gray-300">Bedrooms</label>
                    <input
                      id="unit-bedrooms"
                      type="number"
                      min="0"
                      value={formData.bedrooms}
                      onChange={(e) => setFormData({...formData, bedrooms: e.target.value})}
                      title="Number of bedrooms in this unit"
                      className="w-full bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="unit-bathrooms" className="text-sm font-bold text-gray-700 dark:text-gray-300">Bathrooms</label>
                    <input
                      id="unit-bathrooms"
                      type="number"
                      min="0"
                      value={formData.bathrooms}
                      onChange={(e) => setFormData({...formData, bathrooms: e.target.value})}
                      title="Number of bathrooms in this unit"
                      className="w-full bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="unit-rent" className="text-sm font-bold text-gray-700 dark:text-gray-300">Rent Amount (Ksh) *</label>
                    <input
                      id="unit-rent"
                      required
                      type="number"
                      value={formData.rent_amount}
                      onChange={(e) => setFormData({...formData, rent_amount: e.target.value})}
                      title="Monthly Rent amount in Ksh"
                      className="w-full bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple font-bold text-lg text-brand-purple"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="unit-status" className="text-sm font-bold text-gray-700 dark:text-gray-300">Occupancy Status</label>
                    <select
                      id="unit-status"
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      title="Unit occupancy status"
                      className="w-full bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple"
                    >
                      <option value="vacant">Vacant</option>
                      <option value="occupied">Occupied</option>
                      <option value="under_maintenance">Under Maintenance</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="unit-floor" className="text-sm font-bold text-gray-700 dark:text-gray-300">Floor/Location</label>
                  <input
                    id="unit-floor"
                    type="text"
                    placeholder="e.g. Ground Floor, 4th Floor East Wing"
                    value={formData.floor_number}
                    onChange={(e) => setFormData({...formData, floor_number: e.target.value})}
                    title="Floor number or location detail"
                    className="w-full bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple"
                  />
                </div>

                {/* Meter Settings */}
                <div className="bg-gray-50 dark:bg-black/20 p-6 rounded-2xl border border-gray-100 dark:border-white/5 space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-wider text-gray-400 flex items-center gap-2">
                    <Info size={14} /> Utility & Meter Configuration
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label htmlFor="init-water" className="text-[11px] font-bold text-gray-500 uppercase">Initial Water Meter</label>
                      <input 
                        id="init-water"
                        type="number" 
                        value={formData.last_water_reading}
                        onChange={(e) => setFormData({...formData, last_water_reading: e.target.value})}
                        title="Initial Water Meter Reading"
                        className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 px-3 py-2 rounded-lg text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="init-elec" className="text-[11px] font-bold text-gray-500 uppercase">Initial Electricity Meter</label>
                      <input 
                        id="init-elec"
                        type="number"
                        value={formData.last_electricity_reading}
                        onChange={(e) => setFormData({...formData, last_electricity_reading: e.target.value})}
                        title="Initial Electricity Meter Reading"
                        className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 px-3 py-2 rounded-lg text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="unit-garbage" className="text-[11px] font-bold text-gray-500 uppercase">Unit Garbage Charge (Monthly)</label>
                      <input 
                        id="unit-garbage"
                        type="number"
                        value={formData.garbage_amount}
                        onChange={(e) => setFormData({...formData, garbage_amount: e.target.value})}
                        title="Monthly Garbage Charge"
                        className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 px-3 py-2 rounded-lg text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="unit-internet" className="text-[11px] font-bold text-gray-500 uppercase">Unit Internet Charge (Monthly)</label>
                      <input 
                        id="unit-internet"
                        type="number"
                        value={formData.internet_amount}
                        onChange={(e) => setFormData({...formData, internet_amount: e.target.value})}
                        title="Monthly Internet Charge"
                        className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 px-3 py-2 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="unit-features" className="text-sm font-bold text-gray-700 dark:text-gray-300">Distinctive Features</label>
                  <input
                    id="unit-features"
                    type="text"
                    placeholder="e.g. Master ensuite, Lake view, Balcony, Dedicated parking"
                    value={formData.features}
                    onChange={(e) => setFormData({...formData, features: e.target.value})}
                    title="Unit features and amenities"
                    className="w-full bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="unit-description" className="text-sm font-bold text-gray-700 dark:text-gray-300">Internal Description / Notes</label>
                  <textarea
                    id="unit-description"
                    rows={3}
                    placeholder="Any specific notes about this unit's condition or layout..."
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    title="Internal unit description or notes"
                    className="w-full bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-6">
                  <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 font-bold text-gray-500 hover:text-gray-900 transition-colors">Cancel</button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    title={editingId ? 'Update this unit in the system' : 'Save this unit to the system'}
                    className="px-10 py-3 bg-brand-purple text-white rounded-2xl font-bold hover:bg-brand-pink transition-all flex items-center shadow-lg shadow-brand-purple/20 disabled:opacity-50"
                  >
                    {isSubmitting ? <CustomLoader size={20} className="mr-2" /> : <Save className="mr-2" size={20} />}
                    {isSubmitting ? 'Saving...' : (editingId ? 'Update Unit' : 'Save Unit')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Units View */}
        {isEmptyWorkspace ? (
          <div className="bg-white dark:bg-dark-surface p-16 text-center rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm flex flex-col items-center">
            <div className="w-20 h-20 bg-brand-purple/10 text-brand-purple rounded-full flex items-center justify-center mb-6">
              <Home size={40} />
            </div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Empty workspace</h3>
            <p className="text-gray-500 max-w-sm mb-8">
              This rented workspace has no properties or units yet. Create your first property to begin.
            </p>
            <button
              onClick={() => navigate('/app/real-estate/properties')}
              className="px-8 py-3 bg-brand-purple text-white rounded-2xl font-bold"
            >
              Create your first property
            </button>
          </div>
        ) : filteredUnits.length === 0 ? (
          <div className="bg-white dark:bg-dark-surface p-16 text-center rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm flex flex-col items-center">
            <div className="w-20 h-20 bg-brand-purple/10 text-brand-purple rounded-full flex items-center justify-center mb-6">
              <Home size={40} />
            </div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">No Units Found</h3>
            <p className="text-gray-500 max-w-sm mb-8">
              We couldn't find any residential units matching your criteria. Start by adding a new house or unit.
            </p>
            <button 
              onClick={() => navigate('/app/real-estate/units/add')}
              className="px-8 py-3 bg-brand-purple text-white rounded-2xl font-bold"
            >
              Add Your First Unit
            </button>
          </div>
        ) : viewMode === 'table' ? (
          <div className="bg-white dark:bg-dark-surface rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="px-8 py-5 font-black text-gray-400 uppercase tracking-widest text-[10px]">Unit Detail</th>
                    <th className="px-6 py-5 font-black text-gray-400 uppercase tracking-widest text-[10px]">Property</th>
                    <th className="px-6 py-5 font-black text-gray-400 uppercase tracking-widest text-[10px]">Specs & Status</th>
                    <th className="px-6 py-5 font-black text-gray-400 uppercase tracking-widest text-[10px] text-right">Rent (Ksh)</th>
                    <th className="px-8 py-5 font-black text-gray-400 uppercase tracking-widest text-[10px] text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {filteredUnits.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${u.status === 'occupied' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20' : 'bg-gray-100 text-gray-400 dark:bg-white/5'}`}>
                            <Home size={24} />
                          </div>
                          <div>
                            <p className="font-black text-gray-900 dark:text-white text-lg leading-tight">{u.unit_number}</p>
                            <p className="text-[11px] text-gray-400 font-medium uppercase mt-0.5">{u.floor_number || 'No Floor Set'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <Building2 size={16} className="text-brand-purple" />
                          <span className="font-bold text-gray-700 dark:text-gray-300">{u.property?.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-2">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{getUnitTypeLabel(u.type)}</span>
                          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{u.bedrooms || 0} bed, {u.bathrooms || 0} bath</span>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border w-fit ${STATUS_COLORS[u.status]}`}>
                            {u.status.replace('_', ' ')}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right font-black text-gray-900 dark:text-white text-base">
                        {u.rent_amount.toLocaleString()}
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center justify-center gap-2">
                          <Link 
                            to={`/app/real-estate/units/${u.id}/assets`}
                            className="p-2.5 bg-gray-100 dark:bg-white/5 text-gray-500 hover:bg-brand-purple hover:text-white rounded-xl transition-all"
                            title="Manage Unit Assets (Furniture/Appliances)"
                          >
                            <Package size={18} />
                          </Link>
                          <button 
                            onClick={() => handleEdit(u)}
                            className="p-2.5 bg-gray-100 dark:bg-white/5 text-gray-500 hover:bg-brand-purple hover:text-white rounded-xl transition-all"
                            title="Edit Unit"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => setConfirmDelete(u.id)}
                            className="p-2.5 bg-gray-100 dark:bg-white/5 text-gray-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                            title="Delete Unit"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUnits.map((u) => (
              <div key={u.id} className="bg-white dark:bg-dark-surface rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden flex flex-col h-full hover:shadow-xl transition-shadow group border-b-4 border-b-transparent hover:border-b-brand-purple">
                <div className="p-8 flex-1">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${u.status === 'occupied' ? 'bg-emerald-100 text-emerald-600' : 'bg-brand-purple/10 text-brand-purple'}`}>
                      <Home size={28} />
                    </div>
                    <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase border ${STATUS_COLORS[u.status]}`}>
                      {u.status.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-1 group-hover:text-brand-purple transition-colors">{u.unit_number}</h3>
                  <p className="text-gray-500 text-sm font-medium flex items-center gap-1.5 mb-4 border-b border-gray-50 dark:border-white/5 pb-4">
                    <Building2 size={14} /> {u.property?.name}
                  </p>
                  
                  <div className="space-y-3 mb-6">
                     <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400 font-bold uppercase tracking-widest">Type</span>
                        <span className="text-gray-900 dark:text-white font-black uppercase">{getUnitTypeLabel(u.type)}</span>
                     </div>
                     <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400 font-bold uppercase tracking-widest">Layout</span>
                        <span className="text-gray-900 dark:text-white font-black">{u.bedrooms || 0} bed / {u.bathrooms || 0} bath</span>
                     </div>
                     <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400 font-bold uppercase tracking-widest">Floor</span>
                        <span className="text-gray-900 dark:text-white font-black">{u.floor_number || '-'}</span>
                     </div>
                     <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400 font-bold uppercase tracking-widest">Utilities</span>
                        <div className="flex gap-1.5 grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                           <Droplets size={14} className="text-blue-500" />
                           <Zap size={14} className="text-yellow-500" />
                           <Wifi size={14} className="text-indigo-500" />
                        </div>
                     </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-black/20 p-4 rounded-2xl flex items-center justify-between">
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Monthly Rent</span>
                     <span className="text-lg font-black text-brand-purple">Ksh {u.rent_amount.toLocaleString()}</span>
                   </div>
                </div>
                <div className="px-8 py-6 bg-gray-50 dark:bg-black/10 border-t border-gray-100 dark:border-white/5 flex gap-3">
                  <Link 
                    to={`/app/real-estate/units/${u.id}/assets`}
                    className="flex-1 py-2.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-bold text-gray-700 dark:text-white hover:bg-brand-purple hover:text-white hover:border-brand-purple transition-all flex items-center justify-center gap-2 shadow-sm"
                    title="Manage Unit Assets"
                  >
                    <Package size={16} /> Assets
                  </Link>
                  <button onClick={() => handleEdit(u)} className="flex-1 py-2.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-bold text-gray-700 dark:text-white hover:bg-brand-purple hover:text-white hover:border-brand-purple transition-all flex items-center justify-center gap-2 shadow-sm">
                    <Edit2 size={16} /> Edit
                  </button>
                  <button onClick={() => setConfirmDelete(u.id)} title="Delete unit" className="w-12 h-10 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-500 transition-all">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Delete Confirmation */}
        {confirmDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-dark-surface rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-white/10">
              <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6 mx-auto">
                <AlertTriangle size={40} />
              </div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2">Permanently Delete?</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-8">
                Are you sure you want to remove unit <span className="font-bold text-gray-900 dark:text-white">{units.find(u => u.id === confirmDelete)?.unit_number}</span>? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} title="Cancel deletion" className="flex-1 py-3 font-bold text-gray-500 hover:text-gray-900 transition-colors">Cancel</button>
                <button onClick={() => handleDelete(confirmDelete)} title="Confirm deletion" className="flex-1 py-3 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-600/20">Delete Now</button>
              </div>
            </div>
          </div>
        )}


      {toast && <CustomToast message={toast.message} type={toast.type} isVisible={!!toast} onClose={() => setToast(null)} />}
    </div>
  );
}
