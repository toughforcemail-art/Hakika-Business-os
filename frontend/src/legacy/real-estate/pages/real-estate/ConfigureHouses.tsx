// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Settings, Save, Search, Home, Zap, Droplets } from 'lucide-react';
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

export default function ConfigureHouses() {
  const { profile } = useAccess();
  const [units, setUnits] = useState<Unit[]>([]);
  const [edits, setEdits] = useState<Record<string, Partial<Unit>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

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

  useEffect(() => { if (profile) fetchUnits(); }, [profile]);

  const getEdit = (unit: Unit, field: keyof Unit) => {
    const val = edits[unit.id]?.[field];
    return val !== undefined ? val : unit[field];
  };

  const updateEdit = (id: string, field: keyof Unit, value: any) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleSave = async (unit: Unit) => {
    const changes = edits[unit.id];
    if (!changes || Object.keys(changes).length === 0) return;
    setSaving(unit.id);
    try {
      const { error } = await supabase.from('re_units').update(changes).eq('id', unit.id);
      if (error) throw error;
      setToast({ message: `Unit ${unit.unit_number} updated!`, type: 'success' });
      setEdits(prev => { const n = {...prev}; delete n[unit.id]; return n; });
      fetchUnits();
    } catch (err: any) {
      setToast({ message: err.message || 'Save failed', type: 'error' });
    } finally {
      setSaving(null);
    }
  };

  const filtered = units.filter(u =>
    u.unit_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.property?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const inputCls = 'w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 px-2.5 py-1.5 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple outline-none';

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
            <Settings className="mr-3 text-brand-purple" size={32} />
            Configure Houses
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Set rent amounts, unit types, and billing configurations for each house/unit.</p>
        </div>

        <div className="relative mb-6">
          <label htmlFor="search-houses" className="sr-only">Search units by number or property</label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input type="text" id="search-houses" placeholder="Search by unit number or property..." title="Search for houses by unit number or property name" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 pl-10 pr-4 py-2.5 rounded-lg outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple" />
        </div>

        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center"><CustomLoader size={32} label="Loading units..." /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Home size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Units Found</h3>
              <p className="text-gray-500 dark:text-gray-400">Add properties and houses first.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
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
                  {filtered.map(unit => {
                    const isDirty = edits[unit.id] && Object.keys(edits[unit.id]).length > 0;
                    return (
                      <tr key={unit.id} className={`transition-colors ${isDirty ? 'bg-brand-purple/5 dark:bg-brand-purple/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{unit.unit_number}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{unit.property?.name || '—'}</td>
                        <td className="px-4 py-3">
                          <select 
                            value={String(getEdit(unit, 'type'))} 
                            onChange={e => updateEdit(unit.id, 'type', e.target.value)} 
                            className={inputCls}
                            title={`Select unit type for ${unit.unit_number}`}
                          >
                            <option value="studio">Studio</option>
                            <option value="1BR">1 Bedroom</option>
                            <option value="2BR">2 Bedroom</option>
                            <option value="3BR">3 Bedroom</option>
                            <option value="penthouse">Penthouse</option>
                            <option value="commercial">Commercial</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="number" 
                            min="0" 
                            value={Number(getEdit(unit, 'rent_amount'))} 
                            onChange={e => updateEdit(unit.id, 'rent_amount', Number(e.target.value))} 
                            className={inputCls} 
                            title={`Set rent amount for ${unit.unit_number}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="number" 
                            min="0" 
                            value={String(getEdit(unit, 'floor_number') ?? '')} 
                            onChange={e => updateEdit(unit.id, 'floor_number', e.target.value ? Number(e.target.value) : null)} 
                            placeholder="—" 
                            className={inputCls} 
                            title={`Set floor number for ${unit.unit_number}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            type="number" 
                            min="0" 
                            value={String(getEdit(unit, 'size_sqft') ?? '')} 
                            onChange={e => updateEdit(unit.id, 'size_sqft', e.target.value ? Number(e.target.value) : null)} 
                            placeholder="—" 
                            className={inputCls} 
                            title={`Set size in sqft for ${unit.unit_number}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select 
                            value={String(getEdit(unit, 'status'))} 
                            onChange={e => updateEdit(unit.id, 'status', e.target.value)} 
                            className={inputCls}
                            title={`Set current status for ${unit.unit_number}`}
                          >
                            <option value="vacant">Vacant</option>
                            <option value="occupied">Occupied</option>
                            <option value="under_maintenance">Maintenance</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleSave(unit)}
                            disabled={!isDirty || saving === unit.id}
                            title={`Save changes for ${unit.unit_number}`}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${isDirty ? 'bg-brand-purple text-white hover:bg-brand-pink' : 'bg-gray-100 dark:bg-white/5 text-gray-400 cursor-not-allowed'}`}
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
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
