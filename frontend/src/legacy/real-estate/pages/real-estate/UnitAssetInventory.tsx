// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Package, Plus, Trash2, Edit3, ArrowLeft, 
  Home, Building2, Tag, Calendar, Info, 
  Camera, CheckCircle2, AlertTriangle, X
} from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { activityLogger } from '../../utils/activityLogger';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';

interface UnitAsset {
  id: string;
  name: string;
  category: string;
  condition: string;
  serial_number?: string;
  purchased_at?: string;
  value?: number;
  photo_url?: string;
  notes?: string;
  unit_id: string;
  unit?: {
    id: string;
    unit_number?: string | null;
    property?: { name?: string | null } | null;
  } | null;
}

const CATEGORIES = ['Furniture', 'Appliance', 'Electronic', 'Fixture', 'Utility', 'Other'];
const CONDITIONS = [
  { value: 'new', label: 'Brand New', color: 'text-emerald-500 bg-emerald-50 border-emerald-200' },
  { value: 'good', label: 'Good', color: 'text-blue-500 bg-blue-50 border-blue-200' },
  { value: 'fair', label: 'Fair', color: 'text-orange-500 bg-orange-50 border-orange-200' },
  { value: 'damaged', label: 'Damaged', color: 'text-rose-500 bg-rose-50 border-rose-200' },
];

export default function AssetTracking() {
  const { unitId } = useParams<{ unitId: string }>();
  const { profile } = useAccess();
  const [assets, setAssets] = useState<UnitAsset[]>([]);
  const [unit, setUnit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialFormData = {
    name: '',
    category: 'Furniture',
    condition: 'good',
    serial_number: '',
    purchased_at: '',
    value: '',
    notes: ''
  };

  const [formData, setFormData] = useState(initialFormData);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (unitId) {
        // Fetch Unit Info
        const { data: unitData, error: unitError } = await supabase
          .from('re_units')
          .select('*, property:re_properties(name)')
          .eq('id', unitId)
          .single();
        
        if (unitError) throw unitError;
        setUnit(unitData);

        // Fetch Assets for one unit
        const { data: assetsData, error: assetsError } = await supabase
          .from('re_unit_assets')
          .select('*')
          .eq('unit_id', unitId)
          .order('created_at', { ascending: false });
        
        if (assetsError) throw assetsError;
        setAssets(assetsData || []);
      } else {
        setUnit(null);
        // All unit assets overview for the sidebar route
        const { data: assetsData, error: assetsError } = await supabase
          .from('re_unit_assets')
          .select('*, unit:re_units(id, unit_number, property:re_properties(name))')
          .order('created_at', { ascending: false });

        if (assetsError) throw assetsError;
        setAssets((assetsData || []).map((asset: any) => ({
          ...asset,
          unit: Array.isArray(asset.unit) ? asset.unit[0] : asset.unit
        })));
      }
    } catch (error: any) {
      console.error('Error fetching assets:', error);
      setToast({ message: 'Failed to load assets', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile && unitId) fetchData();
  }, [profile, unitId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setToast({ message: 'Asset name is required', type: 'warning' });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        unit_id: unitId,
        company_id: profile?.company_id,
        created_by: profile?.id,
        value: formData.value ? parseFloat(formData.value) : 0,
        purchased_at: formData.purchased_at || null
      };

      if (editingId) {
        const { error } = await supabase.from('re_unit_assets').update(payload).eq('id', editingId);
        if (error) throw error;
        setToast({ message: 'Asset updated successfully', type: 'success' });
      } else {
        const { error } = await supabase.from('re_unit_assets').insert([payload]);
        if (error) throw error;
        setToast({ message: 'Asset added to unit', type: 'success' });
      }

      setShowForm(false);
      setEditingId(null);
      setFormData(initialFormData);
      fetchData();
    } catch (error: any) {
      setToast({ message: 'Error saving asset', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (asset: UnitAsset) => {
    setEditingId(asset.id);
    setFormData({
      name: asset.name,
      category: asset.category,
      condition: asset.condition,
      serial_number: asset.serial_number || '',
      purchased_at: asset.purchased_at || '',
      value: asset.value?.toString() || '',
      notes: asset.notes || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this asset?')) return;
    try {
      const asset = assets.find((item) => item.id === id);
      const { error } = await supabase.rpc('archive_record', { p_table_name: 're_unit_assets', p_record_id: id, p_reason: 'delete' });
      if (error) throw error;
      void activityLogger.logDataAction('delete', 're_unit_assets', id, asset?.name || 'Unit Asset');
      setToast({ message: 'Asset removed', type: 'success' });
      fetchData();
    } catch (error) {
      setToast({ message: 'Delete failed', type: 'error' });
    }
  };

  if (loading && !assets.length) return <div className="flex-1 p-8 flex items-center justify-center"><CustomLoader size={40} label="Loading inventory..." /></div>;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-8 text-gray-900 dark:bg-[#061622] dark:text-white">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2 text-sm font-medium">
              <Link to={unitId ? "/app/real-estate/units" : "/app/real-estate/assets"} className="hover:text-[#ff6a00] flex items-center gap-1 transition-colors">
                <ArrowLeft size={14} /> Back
              </Link>
              <span>/</span>
              <span className="text-gray-900 dark:text-white uppercase tracking-widest text-[10px] font-black">{unitId ? unit?.property?.name : 'All Units'}</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Package size={32} className="text-[#ff6a00]" />
              {unitId ? `Unit ${unit?.unit_number} Inventory` : 'Asset Tracking'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {unitId ? 'Track furniture, appliances, and fixtures for move-in/out inspections.' : 'Track assets across all units and see where each item is allocated.'}
            </p>
          </div>
            {unitId && (
              <button 
                onClick={() => { setShowForm(true); setEditingId(null); setFormData(initialFormData); }}
                title="Add a new asset to this unit"
                className="px-6 py-3 bg-[#ff6a00] text-white rounded-2xl font-bold hover:bg-[#ff7a1a] transition-all flex items-center shadow-lg shadow-[#ff6a00]/20"
              >
                <Plus size={20} className="mr-2" /> Add Asset
              </button>
            )}
          </div>

        {/* Assets Grid */}
        {assets.length === 0 ? (
          <div className="bg-white dark:bg-[#0f1729] p-16 text-center rounded-3xl border border-gray-200 dark:border-white/10 flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 text-gray-400 rounded-full flex items-center justify-center mb-4">
              <Package size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Inventory Empty</h3>
            <p className="text-gray-500 max-w-xs mb-8">{unitId ? 'No assets have been logged for this unit. Start by adding furniture or appliances.' : 'No unit assets have been logged yet.'}</p>
            {unitId && <button onClick={() => setShowForm(true)} title="Add your first asset" className="px-8 py-3 bg-[#ff6a00]/10 text-[#ff6a00] rounded-2xl font-bold hover:bg-[#ff6a00] hover:text-white transition-all">Add First Asset</button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assets.map(asset => {
              const cond = CONDITIONS.find(c => c.value === asset.condition) || CONDITIONS[1];
              return (
                <div key={asset.id} className="bg-white dark:bg-[#0f1729] rounded-3xl p-6 border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-xl transition-all group flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-white/5 rounded-2xl flex items-center justify-center text-gray-400 group-hover:text-[#ff6a00] transition-colors">
                      <Tag size={24} />
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${cond.color}`}>
                      {cond.label}
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{asset.name}</h3>
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                    <Info size={12} /> {asset.category}
                  </div>
                  {!unitId && asset.unit && (
                    <div className="mb-4 rounded-2xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                      <div className="flex items-center gap-2 font-bold uppercase tracking-widest text-[10px]">
                        <Building2 size={12} className="text-[#ff6a00]" /> {asset.unit.property?.name || 'Unknown property'}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Home size={12} /> {asset.unit.unit_number || 'Unknown unit'}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 flex-1">
                    {asset.serial_number && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400 font-bold uppercase tracking-tight">S/N</span>
                        <span className="text-gray-700 dark:text-gray-300 font-mono">{asset.serial_number}</span>
                      </div>
                    )}
                    {asset.value ? (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400 font-bold uppercase tracking-tight">Estimated Value</span>
                        <span className="text-gray-900 dark:text-white font-black">Ksh {asset.value.toLocaleString()}</span>
                      </div>
                    ) : null}
                    {asset.notes && (
                      <p className="text-xs text-gray-500 italic mt-2 line-clamp-2">"{asset.notes}"</p>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/5 flex gap-2">
                    <button onClick={() => handleEdit(asset)} title={`Edit ${asset.name}`} className="flex-1 py-2 bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-[#ff6a00] hover:text-white transition-all flex items-center justify-center gap-2">
                       <Edit3 size={14} /> Edit
                    </button>
                    <button onClick={() => handleDelete(asset.id)} title={`Delete ${asset.name}`} className="w-10 py-2 bg-gray-50 dark:bg-white/5 text-gray-400 rounded-xl text-xs font-bold hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center">
                       <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Form */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
            <div className="bg-white dark:bg-dark-surface rounded-3xl w-full max-w-xl shadow-2xl my-auto border border-white/10 overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-black/20">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingId ? 'Edit Asset' : 'Add Unit Asset'}
                </h2>
                <button onClick={() => setShowForm(false)} title="Close form" className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors">
                  <X className="text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-5">
                <div className="space-y-1">
                  <label htmlFor="asset-name" className="text-xs font-black uppercase text-gray-400 tracking-widest">Asset Name *</label>
                  <input id="asset-name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Leather Sofa, Fridge, Microwave" className="w-full bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="asset-cat" className="text-xs font-black uppercase text-gray-400 tracking-widest">Category</label>
                    <select id="asset-cat" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="asset-cond" className="text-xs font-black uppercase text-gray-400 tracking-widest">Current Condition</label>
                    <select id="asset-cond" value={formData.condition} onChange={e => setFormData({...formData, condition: e.target.value})} className="w-full bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple">
                      {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="asset-sn" className="text-xs font-black uppercase text-gray-400 tracking-widest">Serial Number</label>
                    <input id="asset-sn" value={formData.serial_number} onChange={e => setFormData({...formData, serial_number: e.target.value})} placeholder="Optional S/N" className="w-full bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple font-mono" />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="asset-value" className="text-xs font-black uppercase text-gray-400 tracking-widest">Estimated Value</label>
                    <input id="asset-value" type="number" value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} placeholder="Value in Ksh" className="w-full bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="asset-notes" className="text-xs font-black uppercase text-gray-400 tracking-widest">Condition Notes / Detail</label>
                  <textarea id="asset-notes" rows={2} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Any specific damage or unique identifiers..." className="w-full bg-gray-100/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple resize-none" />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 font-bold text-gray-500 hover:text-gray-900 transition-colors">Cancel</button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-10 py-3 bg-brand-purple text-white rounded-2xl font-bold hover:bg-brand-pink transition-all flex items-center shadow-lg shadow-brand-purple/20 disabled:opacity-50"
                  >
                    {isSubmitting ? <CustomLoader size={20} className="mr-2" /> : <CheckCircle2 className="mr-2" size={20} />}
                    {isSubmitting ? 'Saving...' : (editingId ? 'Update Asset' : 'Save Asset')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
      {toast && <CustomToast message={toast.message} type={toast.type} isVisible={!!toast} onClose={() => setToast(null)} />}
    </div>
  );
}
