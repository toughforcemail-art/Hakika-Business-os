// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { Settings, Save, Search, Home, X, Plus } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';

interface Unit {
  id: string;
  unit_number: string;
  type: string;
  rent_amount: number;
  floor_number: number | null;
  size_sqft: number | null;
  status: string;
  property?: { name: string } | null;
}

export default function UnitsManagement() {
  const { profile } = useAccess();
  const location = useLocation();
  const [units, setUnits] = useState<Unit[]>([]);
  const [edits, setEdits] = useState<Record<string, Partial<Unit>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    property_id: '',
    unit_number: '',
    type: '1BR',
    rent_amount: '',
    floor_number: '',
    size_sqft: '',
    status: 'vacant',
  });
  const [companyId, setCompanyId] = useState<string | null>(null);

  const fetchUnits = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('re_units')
        .select('*, property:re_properties(name)')
        .order('unit_number');
      if (error) throw error;
      setUnits(data || []);
    } catch {
      setToast({ message: 'Failed to load units', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (profile) void fetchUnits(); }, [profile]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'add') setShowForm(true);
  }, [location.search]);

  const getEdit = (unit: Unit, field: keyof Unit) => {
    const val = edits[unit.id]?.[field];
    return val !== undefined ? val : unit[field];
  };

  const updateEdit = (id: string, field: keyof Unit, value: any) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleSave = async (unit: Unit) => {
    const changes = edits[unit.id];
    if (!changes || Object.keys(changes).length === 0) return;
    setSaving(unit.id);
    try {
      const { error } = await supabase.from('re_units').update(changes).eq('id', unit.id);
      if (error) throw error;
      setToast({ message: `Unit ${unit.unit_number} updated!`, type: 'success' });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[unit.id];
        return next;
      });
      void fetchUnits();
    } catch (err: any) {
      setToast({ message: err.message || 'Save failed', type: 'error' });
    } finally {
      setSaving(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.property_id || !formData.unit_number.trim() || !formData.rent_amount) {
      setToast({ message: 'Fill all required fields (*)', type: 'warning' });
      return;
    }

    setSaving('new');
    try {
      const payload = {
        property_id: formData.property_id,
        unit_number: formData.unit_number,
        type: formData.type,
        rent_amount: Number(formData.rent_amount),
        floor_number: formData.floor_number ? Number(formData.floor_number) : null,
        size_sqft: formData.size_sqft ? Number(formData.size_sqft) : null,
        status: formData.status,
        created_by: profile?.id,
        company_id: companyId,
      };

      const { error } = await supabase.from('re_units').insert([payload]);
      if (error) throw error;
      setToast({ message: 'Unit added successfully!', type: 'success' });
      setShowForm(false);
      setFormData({ property_id: '', unit_number: '', type: '1BR', rent_amount: '', floor_number: '', size_sqft: '', status: 'vacant' });
      void fetchUnits();
    } catch (err: any) {
      setToast({ message: err.message || 'Save failed', type: 'error' });
    } finally {
      setSaving(null);
    }
  };

  const filtered = units.filter(
    (u) => u.unit_number.toLowerCase().includes(searchTerm.toLowerCase()) || (u.property?.name || '').toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const inputCls = 'w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-[#ff6a00]/20 dark:border-white/10 dark:bg-white/5 dark:text-white';

  return (
    <div className="min-h-[calc(100vh-8rem)] text-black dark:text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-2 flex items-center text-3xl font-bold text-gray-900 dark:text-white">
              <Settings className="mr-3 text-[#ff6a00]" size={32} />
              Units Management
            </h1>
            <p className="text-gray-500 dark:text-gray-400">A dedicated workspace for editing unit types, rent, size, floor, and status.</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#ff6a00] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#ff7a1a]"
          >
            <Plus size={16} />
            Add New Unit
          </button>
        </div>

        <div className="relative mb-6">
          <label htmlFor="search-units" className="sr-only">Search units by number or property</label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-dark-text" size={18} />
          <input
            id="search-units"
            type="text"
            placeholder="Search by unit number or property..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-gray-900 outline-none focus:border-[#ff6a00]/40 focus:ring-1 focus:ring-[#ff6a00]/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500"
          />
        </div>

        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-dark-surface">
          {loading ? (
            <div className="flex justify-center p-12">
              <CustomLoader size={32} label="Loading units..." />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Home size={40} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">No Units Found</h3>
              <p className="text-gray-500 dark:text-gray-400">Add properties and units first.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5">
                  <tr>
                    <th className="px-4 py-4 font-medium text-gray-500 dark:text-gray-400">Unit</th>
                    <th className="px-4 py-4 font-medium text-gray-500 dark:text-gray-400">Property</th>
                    <th className="px-4 py-4 font-medium text-gray-500 dark:text-gray-400">Type</th>
                    <th className="px-4 py-4 font-medium text-gray-500 dark:text-gray-400">Rent (Ksh)</th>
                    <th className="px-4 py-4 font-medium text-gray-500 dark:text-gray-400">Floor</th>
                    <th className="px-4 py-4 font-medium text-gray-500 dark:text-gray-400">Size (sqft)</th>
                    <th className="px-4 py-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
                    <th className="px-4 py-4 font-medium text-gray-500 dark:text-gray-400">Save</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {filtered.map((unit) => {
                    const isDirty = edits[unit.id] && Object.keys(edits[unit.id]).length > 0;
                    return (
                      <tr key={unit.id} className={`transition-colors ${isDirty ? 'bg-[#ff6a00]/5 dark:bg-[#ff6a00]/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{unit.unit_number}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">{unit.property?.name || '—'}</td>
                        <td className="px-4 py-3">
                          <input value={String(getEdit(unit, 'type'))} onChange={(e) => updateEdit(unit.id, 'type', e.target.value)} className={inputCls} />
                        </td>
                        <td className="px-4 py-3">
                          <input type="number" min="0" value={Number(getEdit(unit, 'rent_amount'))} onChange={(e) => updateEdit(unit.id, 'rent_amount', Number(e.target.value))} className={inputCls} />
                        </td>
                        <td className="px-4 py-3">
                          <input type="number" min="0" value={String(getEdit(unit, 'floor_number') ?? '')} onChange={(e) => updateEdit(unit.id, 'floor_number', e.target.value ? Number(e.target.value) : null)} className={inputCls} />
                        </td>
                        <td className="px-4 py-3">
                          <input type="number" min="0" value={String(getEdit(unit, 'size_sqft') ?? '')} onChange={(e) => updateEdit(unit.id, 'size_sqft', e.target.value ? Number(e.target.value) : null)} className={inputCls} />
                        </td>
                        <td className="px-4 py-3">
                          <select value={String(getEdit(unit, 'status'))} onChange={(e) => updateEdit(unit.id, 'status', e.target.value)} className={inputCls}>
                            <option value="vacant">Vacant</option>
                            <option value="occupied">Occupied</option>
                            <option value="under_maintenance">Maintenance</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => void handleSave(unit)}
                            disabled={!isDirty || saving === unit.id}
                            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                              isDirty ? 'bg-[#ff6a00] text-white hover:bg-[#ff7a1a]' : 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-white/5'
                            }`}
                          >
                            {saving === unit.id ? <CustomLoader size={14} /> : <><Save size={12} />Save</>}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white shadow-2xl dark:bg-dark-surface">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-white/10">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add New Unit</h2>
                <button onClick={() => setShowForm(false)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4 p-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <input className={inputCls} placeholder="Property ID" value={formData.property_id} onChange={(e) => setFormData({ ...formData, property_id: e.target.value })} />
                  <input className={inputCls} placeholder="Unit Number" value={formData.unit_number} onChange={(e) => setFormData({ ...formData, unit_number: e.target.value })} />
                  <input className={inputCls} placeholder="Type" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} />
                  <input className={inputCls} placeholder="Rent Amount" type="number" value={formData.rent_amount} onChange={(e) => setFormData({ ...formData, rent_amount: e.target.value })} />
                  <input className={inputCls} placeholder="Floor Number" value={formData.floor_number} onChange={(e) => setFormData({ ...formData, floor_number: e.target.value })} />
                  <input className={inputCls} placeholder="Size (sqft)" value={formData.size_sqft} onChange={(e) => setFormData({ ...formData, size_sqft: e.target.value })} />
                  <select className={inputCls} value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                    <option value="vacant">Vacant</option>
                    <option value="occupied">Occupied</option>
                    <option value="under_maintenance">Under Maintenance</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10">Cancel</button>
                  <button type="submit" disabled={saving === 'new'} className="inline-flex items-center gap-2 rounded-xl bg-[#ff6a00] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ff7a1a] disabled:opacity-50">
                    <Save size={14} />
                    Save Unit
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
