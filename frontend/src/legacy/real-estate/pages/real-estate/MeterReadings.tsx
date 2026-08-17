// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { Zap, Droplets, Search, Plus, Filter, Calendar, TrendingUp, History, Save, X, ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export default function MeterReadings() {
  const { profile } = useAccess();
  const [loading, setLoading] = useState(true);
  const [readings, setReadings] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'water' | 'electricity'>('all');
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    property_id: '',
    unit_id: '',
    type: 'water',
    reading_value: '',
    reading_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch related data separately to avoid complex join errors
      const [readingsRes, propRes, unitRes] = await Promise.all([
        supabase.from('re_meter_readings').select('*').order('reading_date', { ascending: false }),
        supabase.from('re_properties').select('id, name'),
        supabase.from('re_units').select('id, unit_number, property_id, water_utility_account, electricity_utility_account')
      ]);

      if (readingsRes.error) {
        // If table is missing, just set empty but log it
        if (readingsRes.error.code === 'PGRST204' || readingsRes.error.message?.includes('does not exist')) {
          console.warn('re_meter_readings table does not exist yet.');
          setReadings([]);
        } else {
          throw readingsRes.error;
        }
      } else {
        setReadings(readingsRes.data || []);
      }
      
      setProperties(propRes.data || []);
      setUnits(unitRes.data || []);
    } catch (error: any) {
      console.error('Error fetching meter data:', error);
      setToast({ message: 'Failed to load meter data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const trendData = useMemo(() => {
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      return d.toLocaleString('default', { month: 'short' });
    }).reverse();

    return last6Months.map(month => {
      const water = readings
        .filter(r => r.type === 'water' && new Date(r.reading_date).toLocaleString('default', { month: 'short' }) === month)
        .reduce((sum, r) => sum + (Number(r.consumption) || 0), 0);
      const electricity = readings
        .filter(r => r.type === 'electricity' && new Date(r.reading_date).toLocaleString('default', { month: 'short' }) === month)
        .reduce((sum, r) => sum + (Number(r.consumption) || 0), 0);
      return { month, water, electricity };
    });
  }, [readings]);

  const filteredReadings = useMemo(() => {
    return readings.map(r => {
      const property = properties.find(p => p.id === r.property_id);
      const unit = units.find(u => u.id === r.unit_id);
      return { ...r, property_name: property?.name, unit_number: unit?.unit_number, water_utility_account: unit?.water_utility_account, electricity_utility_account: unit?.electricity_utility_account };
    }).filter(r => {
      const matchesSearch = r.property_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           r.unit_number?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || r.type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [readings, searchTerm, typeFilter, properties, units]);

  const handleSave = async () => {
    if (!formData.property_id || !formData.unit_id || !formData.reading_value) {
      setToast({ message: 'Missing required fields', type: 'warning' });
      return;
    }

    // Calculate consumption
    const lastReading = readings
      .filter(r => r.unit_id === formData.unit_id && r.type === formData.type)
      .sort((a, b) => new Date(b.reading_date).getTime() - new Date(a.reading_date).getTime())[0];

    const prevValue = lastReading ? Number(lastReading.reading_value) : 0;
    const currentValue = Number(formData.reading_value);
    const consumption = currentValue - prevValue;

    try {
      const { error } = await supabase.from('re_meter_readings').insert([
        {
          ...formData,
          reading_value: currentValue,
          previous_reading: prevValue,
          consumption: consumption > 0 ? consumption : 0,
          company_id: profile?.company_id,
          recorded_by: profile?.id
        }
      ]);

      if (error) throw error;
      setToast({ message: 'Reading recorded successfully', type: 'success' });
      setShowModal(false);
      fetchData();
    } catch (error) {
      setToast({ message: 'Failed to record reading', type: 'error' });
    }
  };

  if (loading) return <div className="flex-1 p-8 flex items-center justify-center"><CustomLoader size={40} label="Fetching utility data..." /></div>;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
              <Zap className="mr-3 text-brand-purple" size={32} />
              Meter Readings
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
               Track and manage water and electricity consumption across properties.
            </p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            title="Open modal to add a new meter reading"
            className="px-6 py-3 bg-brand-purple text-white rounded-xl font-bold flex items-center gap-2 hover:bg-brand-pink transition-all shadow-lg shadow-brand-purple/20"
          >
            <Plus size={20} />
            Add New Reading
          </button>
        </div>

        {/* Analytics Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white dark:bg-dark-surface p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
               <TrendingUp size={20} className="text-brand-purple" />
               Consumption Trends (Last 6 Months)
            </h3>
            <div className="h-[250px] w-full min-h-[250px]">
               <ResponsiveContainer width="100%" height={250}>
                 <AreaChart data={trendData}>
                   <defs>
                     <linearGradient id="colorWater" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                       <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                     </linearGradient>
                     <linearGradient id="colorElec" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/>
                       <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                   <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                   <YAxis stroke="#94a3b8" fontSize={12} />
                   <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                   />
                   <Area type="monotone" dataKey="water" name="Water (Units)" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorWater)" />
                   <Area type="monotone" dataKey="electricity" name="Electricity (KWh)" stroke="#ec4899" fillOpacity={1} fill="url(#colorElec)" />
                 </AreaChart>
               </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-6">
             <div className="bg-brand-purple/10 border border-brand-purple/20 p-6 rounded-2xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-brand-purple">Total Water Consumption</span>
                  <Droplets size={20} className="text-brand-purple" />
                </div>
                <h4 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {readings.filter(r => r.type === 'water').reduce((sum, r) => sum + (Number(r.consumption) || 0), 0).toLocaleString()} <span className="text-sm font-normal text-gray-400">units</span>
                </h4>
                <div className="mt-2 flex items-center text-xs text-emerald-500 font-bold">
                   <ArrowUpRight size={14} className="mr-1" />
                   +12.5% from last month
                </div>
             </div>

             <div className="bg-brand-pink/10 border border-brand-pink/20 p-6 rounded-2xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-brand-pink">Total Electricity Usage</span>
                  <Zap size={20} className="text-brand-pink" />
                </div>
                <h4 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {readings.filter(r => r.type === 'electricity').reduce((sum, r) => sum + (Number(r.consumption) || 0), 0).toLocaleString()} <span className="text-sm font-normal text-gray-400">KWh</span>
                </h4>
                <div className="mt-2 flex items-center text-xs text-rose-500 font-bold">
                   <ArrowDownRight size={14} className="mr-1" />
                   -3.2% from last month
                </div>
             </div>
          </div>
        </div>

        {/* Toolbar & Data Table */}
        <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-white/10 flex flex-wrap gap-4 items-center justify-between">
             <div className="flex items-center gap-4">
               <h3 className="font-bold text-gray-900 dark:text-white">Reading Logs</h3>
               <div className="flex bg-gray-100 dark:bg-black/20 p-1 rounded-lg">
                 <button 
                  onClick={() => setTypeFilter('all')}
                  title="Show all meter readings"
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${typeFilter === 'all' ? 'bg-white dark:bg-brand-purple text-brand-purple dark:text-white shadow-sm' : 'text-gray-500'}`}
                 >
                   All
                 </button>
                 <button 
                  onClick={() => setTypeFilter('water')}
                  title="Show only water meter readings"
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${typeFilter === 'water' ? 'bg-white dark:bg-brand-purple text-brand-purple dark:text-white shadow-sm' : 'text-gray-500'}`}
                 >
                   Water
                 </button>
                 <button 
                  onClick={() => setTypeFilter('electricity')}
                  title="Show only electricity meter readings"
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${typeFilter === 'electricity' ? 'bg-white dark:bg-brand-purple text-brand-purple dark:text-white shadow-sm' : 'text-gray-500'}`}
                 >
                   Electricity
                 </button>
               </div>
             </div>
             
             <div className="relative w-full max-w-xs">
                <label htmlFor="search-meter-readings" className="sr-only">Search units or properties</label>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  id="search-meter-readings"
                  type="text" 
                  placeholder="Search units or properties..."
                  title="Search meter reading logs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg outline-none focus:ring-2 focus:ring-brand-purple text-gray-900 dark:text-white text-sm"
                />
             </div>
          </div>

          <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead>
                   <tr className="bg-gray-50 dark:bg-black/10 text-gray-400 text-xs font-bold uppercase tracking-wider">
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Property / Unit</th>
                      <th className="px-6 py-4">Utility Accounts</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Prev Reading</th>
                      <th className="px-6 py-4">Current Reading</th>
                      <th className="px-6 py-4">Consumption</th>
                      <th className="px-6 py-4">Status</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                   {filteredReadings.length > 0 ? (
                     filteredReadings.map(r => (
                       <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-500">{new Date(r.reading_date).toLocaleDateString()}</td>
                          <td className="px-6 py-4">
                             <p className="text-sm font-bold text-gray-900 dark:text-white">{r.property_name}</p>
                             <p className="text-xs text-gray-400">Unit {r.unit_number}</p>
                          </td>
                          <td className="px-6 py-4 text-sm">
                             <span className={`flex items-center gap-1 font-medium ${r.type === 'water' ? 'text-blue-500' : 'text-orange-500'}`}>
                                {r.type === 'water' ? <Droplets size={14} /> : <Zap size={14} />}
                                {r.type.charAt(0).toUpperCase() + r.type.slice(1)}
                             </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 font-mono">{r.previous_reading || 0}</td>
                          <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white font-mono">{r.reading_value}</td>
                          <td className="px-6 py-4">
                             <span className="px-3 py-1 bg-brand-purple/10 text-brand-purple rounded-full text-xs font-bold">
                                {r.consumption} {r.type === 'water' ? 'units' : 'KWh'}
                             </span>
                          </td>
                          <td className="px-6 py-4">
                             <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${r.is_billed ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                                {r.is_billed ? 'Billed' : 'Pending'}
                             </span>
                          </td>
                       </tr>
                     ))
                   ) : (
                     <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-400">No reading logs found</td>
                     </tr>
                   )}
                </tbody>
             </table>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-surface rounded-2xl w-full max-w-lg shadow-2xl border border-white/10 overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">New Meter Reading</h3>
              <button onClick={() => setShowModal(false)} title="Close modal" className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"><X size={24} /></button>
            </div>
            <div className="p-6 space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reading-property" className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Property</label>
                    <select 
                      id="reading-property"
                      value={formData.property_id}
                      onChange={(e) => setFormData({...formData, property_id: e.target.value})}
                      title="Select property for reading"
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-purple"
                    >
                      <option value="">-- Choose Property --</option>
                      {properties.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="reading-unit" className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Unit</label>
                    <select 
                      id="reading-unit"
                      value={formData.unit_id}
                      onChange={(e) => setFormData({...formData, unit_id: e.target.value})}
                      title="Select unit for reading"
                      disabled={!formData.property_id}
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-purple disabled:opacity-50"
                    >
                      <option value="">-- Choose Unit --</option>
                      {units.filter(u => u.property_id === formData.property_id).map(u => (
                        <option key={u.id} value={u.id}>Unit {u.unit_number}</option>
                      ))}
                    </select>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Utility Type</label>
                    <div className="flex bg-gray-50 dark:bg-black/20 p-1 rounded-lg">
                       <button 
                        onClick={() => setFormData({...formData, type: 'water'})}
                        title="Select Water utility"
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${formData.type === 'water' ? 'bg-white dark:bg-brand-purple text-brand-purple dark:text-white shadow-sm' : 'text-gray-500'}`}
                       >
                         <Droplets size={14} /> Water
                       </button>
                       <button 
                        onClick={() => setFormData({...formData, type: 'electricity'})}
                        title="Select Electricity utility"
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-all ${formData.type === 'electricity' ? 'bg-white dark:bg-brand-purple text-brand-purple dark:text-white shadow-sm' : 'text-gray-500'}`}
                       >
                         <Zap size={14} /> Electricity
                       </button>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="reading-date" className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Reading Date</label>
                    <input 
                      id="reading-date"
                      type="date" 
                      value={formData.reading_date}
                      onChange={(e) => setFormData({...formData, reading_date: e.target.value})}
                      title="Select reading date"
                      className="w-full px-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-purple"
                    />
                  </div>
               </div>

               <div>
                  <label htmlFor="reading-value" className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Current Reading Value</label>
                  <input 
                    id="reading-value"
                    type="number" 
                    value={formData.reading_value}
                    onChange={(e) => setFormData({...formData, reading_value: e.target.value})}
                    placeholder="e.g. 15420.50"
                    title="Current Reading Value"
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-purple font-mono"
                  />
                  <p className="mt-1 text-[10px] text-gray-400 flex items-center gap-1">
                     <Info size={10} /> Previous reading for this unit: 
                     <span className="font-bold text-gray-500">
                        {readings.find(r => r.unit_id === formData.unit_id && r.type === formData.type)?.reading_value || 0}
                     </span>
                  </p>
               </div>

               <div>
                  <label htmlFor="reading-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1">Notes (Optional)</label>
                  <textarea 
                    id="reading-notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    rows={2}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-purple resize-none"
                    placeholder="Any observations..."
                    title="Reading Notes"
                  />
               </div>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-black/10 flex justify-end gap-3">
               <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 font-medium">Cancel</button>
               <button onClick={handleSave} title="Save meter reading to database" className="px-6 py-2 bg-brand-purple text-white rounded-lg font-bold hover:bg-brand-pink transition-all flex items-center gap-2 shadow-lg shadow-brand-purple/20">
                  <Save size={18} />
                  Save Reading
               </button>
            </div>
          </div>
        </div>
      )}

      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
