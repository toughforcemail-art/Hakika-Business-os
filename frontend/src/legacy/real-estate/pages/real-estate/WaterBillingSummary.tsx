// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { BarChart2, Droplets, Filter, Search, Download, TrendingUp, AlertTriangle, Building, Home, ChevronRight, FileText } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';

export default function WaterBillingSummary() {
  const { profile } = useAccess();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<any[]>([]);
  const [readings, setReadings] = useState<any[]>([]);
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(new Date().toISOString().split('T')[0].slice(0, 7)); // YYYY-MM
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch related data separately to avoid complex join errors
      const [propsRes, rdgsRes, unitRes] = await Promise.all([
        supabase.from('re_properties').select('id, name'),
        supabase.from('re_meter_readings').select('*').eq('type', 'water'),
        supabase.from('re_units').select('id, unit_number, water_utility_account, electricity_utility_account')
      ]);
      
      if (rdgsRes.error) {
         if (rdgsRes.error.message?.includes('does not exist')) {
            setReadings([]);
         } else {
            throw rdgsRes.error;
         }
      } else {
         const readingsData = rdgsRes.data || [];
         const unitsData = unitRes.data || [];
         
         // Join in memory
         const joinedReadings = readingsData.map((r: any) => ({
            ...r,
            re_units: unitsData.find(u => u.id === r.unit_id) || null
         }));
         
         setReadings(joinedReadings);
      }
      
      setProperties(propsRes.data || []);
    } catch (error: any) {
      console.error('Error fetching billing summary:', error);
      setToast({ message: 'Failed to load consumption data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAllBills = async () => {
    setIsGenerating(true);
    try {
      const unbilled = readings.filter(r => !r.is_billed && r.reading_date.startsWith(monthFilter));
      if (unbilled.length === 0) {
        setToast({ message: 'No unbilled readings found for this period.', type: 'warning' });
        return;
      }

      const { data: tenants } = await supabase
        .from('re_tenants')
        .select('id, current_unit_id')
        .eq('is_active', true)
        .in('current_unit_id', unbilled.map(r => r.unit_id));

      const invoicePayloads: any[] = unbilled.map(r => {
        const tenant = (tenants || []).find(t => t.current_unit_id === r.unit_id);
        if (!tenant) return null;
        
        return {
          tenant_id: tenant.id,
          unit_id: r.unit_id,
          property_id: r.property_id,
          amount_due: Number(r.consumption) * 150, // Standard water rate
          description: `Water bill for ${monthFilter} (Consumption: ${r.consumption} units)`,
          status: 'unpaid',
          due_date: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString(),
          company_id: profile?.company_id
        };
      }).filter(Boolean);

      if (invoicePayloads.length === 0) {
        setToast({ message: 'No active tenants found for the unbilled units.', type: 'error' });
        return;
      }

      const { error: invError } = await supabase.from('re_invoices').insert(invoicePayloads);
      if (invError) throw invError;

      const { error: updError } = await supabase
        .from('re_meter_readings')
        .update({ is_billed: true })
        .in('id', unbilled.map(r => r.id));
      if (updError) throw updError;

      setToast({ message: `Successfully generated ${invoicePayloads.length} invoices.`, type: 'success' });
      fetchData();
    } catch (error: any) {
      console.error('Error generating bills:', error);
      setToast({ message: error.message || 'Failed to generate bills', type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const propertySummary = useMemo(() => {
    return properties.map(p => {
      const pReadings = readings.filter(r => r.property_id === p.id && r.reading_date.startsWith(monthFilter));
      const totalUnits = pReadings.reduce((sum, r) => sum + (Number(r.consumption) || 0), 0);
      const billedReadings = pReadings.filter(r => r.is_billed).length;
      return {
        id: p.id,
        name: p.name,
        consumption: totalUnits,
        readingsCount: pReadings.length,
        billingStatus: pReadings.length > 0 ? (billedReadings === pReadings.length ? 'Completed' : 'Pending') : 'No Data'
      };
    }).sort((a, b) => b.consumption - a.consumption);
  }, [properties, readings, monthFilter]);

  const chartData = useMemo(() => {
    return propertySummary.slice(0, 5).map(p => ({
      name: p.name.length > 15 ? p.name.substring(0, 12) + '...' : p.name,
      consumption: p.consumption
    }));
  }, [propertySummary]);

  const topConsumers = useMemo(() => {
    return readings
      .filter(r => r.reading_date.startsWith(monthFilter))
      .map(r => ({
        ...r,
        unit_label: `${properties.find(p => p.id === r.property_id)?.name || ''} - ${r.re_units?.unit_number || 'N/A'}`
      }))
      .sort((a, b) => b.consumption - a.consumption)
      .slice(0, 5);
  }, [readings, monthFilter, properties]);

  if (loading) return <div className="flex-1 p-8 flex items-center justify-center"><CustomLoader label="Loading consumption reports..." /></div>;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
              <BarChart2 className="mr-3 text-brand-purple" size={32} />
              Water Billing Summary
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
               Property-wide water consumption analysis and billing status.
            </p>
          </div>
          <div className="flex gap-2">
            <select 
              title="Filter by Year"
              value={monthFilter.split('-')[0] || ''} 
              onChange={(e) => {
                const year = e.target.value;
                const month = monthFilter.split('-')[1] || '01';
                setMonthFilter(year ? `${year}-${month}` : '');
              }}
              className="px-4 py-2 bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple text-gray-900 dark:text-white shadow-sm"
            >
              {[2024, 2025, 2026].map(y => <option key={y} value={y.toString()}>{y}</option>)}
            </select>
            <select 
              title="Filter by Month"
              value={monthFilter.split('-')[1] || ''} 
              onChange={(e) => {
                const month = e.target.value;
                const year = monthFilter.split('-')[0] || new Date().getFullYear().toString();
                setMonthFilter(month ? `${year}-${month}` : '');
              }}
              className="px-4 py-2 bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-brand-purple text-gray-900 dark:text-white shadow-sm"
            >
              {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => (
                <option key={m} value={m}>{new Date(2000, parseInt(m)-1).toLocaleString('default', { month: 'short' })}</option>
              ))}
            </select>
            <button 
              title="Export consumption report"
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-xl font-bold text-gray-700 dark:text-white hover:bg-gray-50 transition-all shadow-sm"
            >
              <Download size={18} />
              Export
            </button>
          </div>
        </div>

        {/* Top Level Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
           <div className="bg-white dark:bg-dark-surface p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm transition-transform hover:scale-[1.02]">
              <div className="flex justify-between items-start mb-4">
                 <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                    <Droplets size={24} />
                 </div>
                 <div className="text-right">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Consumed</p>
                    <h4 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {propertySummary.reduce((sum, p) => sum + p.consumption, 0).toLocaleString()} <span className="text-sm font-normal text-gray-400">Units</span>
                    </h4>
                 </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-blue-500">
                 <TrendingUp size={14} />
                 <span>Primary Consumption Month</span>
              </div>
           </div>

           <div className="bg-white dark:bg-dark-surface p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm transition-transform hover:scale-[1.02]">
              <div className="flex justify-between items-start mb-4">
                 <div className="p-3 bg-brand-purple/10 rounded-xl text-brand-purple">
                    <Building size={24} />
                 </div>
                 <div className="text-right">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Properties</p>
                    <h4 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {propertySummary.filter(p => p.readingsCount > 0).length} / {properties.length}
                    </h4>
                 </div>
              </div>
              <div className="w-full bg-gray-100 dark:bg-white/5 h-1.5 rounded-full overflow-hidden">
                 <div 
                  className="bg-brand-purple h-full transition-all duration-1000" 
                  style={{ width: `${(propertySummary.filter(p => p.readingsCount > 0).length / properties.length) * 100}%` }}
                 />
              </div>
           </div>

           <div className="bg-white dark:bg-dark-surface p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm transition-transform hover:scale-[1.02]">
              <div className="flex justify-between items-start mb-4">
                 <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
                    <TrendingUp size={24} />
                 </div>
                 <div className="text-right">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Billed Status</p>
                    <h4 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {Math.round((readings.filter(r => r.is_billed && r.reading_date.startsWith(monthFilter)).length / Math.max(readings.filter(r => r.reading_date.startsWith(monthFilter)).length, 1)) * 100)}%
                    </h4>
                 </div>
              </div>
              <p className="text-xs text-gray-400">Readings converted to invoices</p>
           </div>

           <div className="bg-rose-500/5 dark:bg-rose-500/10 p-6 rounded-2xl border border-rose-500/20 shadow-sm flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                 <AlertTriangle size={20} className="text-rose-500" />
                 <span className="text-sm font-bold text-rose-500">Audit Alert</span>
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-400 leading-relaxed">
                 {topConsumers[0] ? `${topConsumers[0].unit_label} has unusually high consumption (${topConsumers[0].consumption} units). Consider inspection.` : 'No critical alerts for this period.'}
              </p>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
           {/* Chart Column */}
           <div className="lg:col-span-2 space-y-8">
              <div className="bg-white dark:bg-dark-surface p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
                 <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Property Consumption Comparison</h3>
                 <div className="h-[300px] w-full min-h-[300px]">
                    <ResponsiveContainer width="100%" height={300}>
                       <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                          <YAxis stroke="#94a3b8" fontSize={12} />
                          <Tooltip 
                            cursor={{ fill: '#ffffff05' }}
                            contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff' }}
                          />
                          <Bar dataKey="consumption" radius={[6, 6, 0, 0]}>
                             {chartData.map((_, index) => (
                               <Cell key={`cell-${index}`} fill={index === 0 ? '#8b5cf6' : '#8b5cf6'} fillOpacity={1 - index * 0.15} />
                             ))}
                          </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              <div className="bg-white dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
                 <div className="p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900 dark:text-white">Detailed Summary</h3>
                    <div className="relative">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                       <input 
                        type="text" 
                        placeholder="Filter list..."
                        title="Filter detailed summary list"
                        className="pl-9 pr-4 py-1.5 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:ring-1 focus:ring-brand-purple"
                       />
                    </div>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                       <thead>
                          <tr className="bg-gray-50 dark:bg-black/10 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                             <th className="px-6 py-4">Property</th>
                             <th className="px-6 py-4">Total Consumption</th>
                             <th className="px-6 py-4">Readings Logged</th>
                             <th className="px-6 py-4">Billing Status</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                          {propertySummary.map(p => (
                            <tr key={p.id} className="group hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                               <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                     <div className="w-8 h-8 rounded-lg bg-brand-purple/10 text-brand-purple flex items-center justify-center font-bold text-xs">
                                        {p.name.charAt(0)}
                                     </div>
                                     <span className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">{p.name}</span>
                                  </div>
                               </td>
                               <td className="px-6 py-4">
                                  <span className="text-sm font-mono text-gray-600 dark:text-gray-300 font-bold">{p.consumption.toLocaleString()}</span>
                                  <span className="ml-1 text-[10px] text-gray-400">units</span>
                               </td>
                               <td className="px-6 py-4">
                                  <span className="text-xs font-medium text-gray-500">{p.readingsCount} Units tracked</span>
                               </td>
                               <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                     <div className={`w-2 h-2 rounded-full ${p.billingStatus === 'Completed' ? 'bg-emerald-500' : p.billingStatus === 'Pending' ? 'bg-amber-500' : 'bg-gray-300'}`} />
                                     <span className={`text-[10px] font-black uppercase ${p.billingStatus === 'Completed' ? 'text-emerald-500' : p.billingStatus === 'Pending' ? 'text-amber-500' : 'text-gray-400'}`}>
                                        {p.billingStatus}
                                     </span>
                                  </div>
                               </td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>

           {/* Sidebar Column */}
           <div className="space-y-8">
              <div className="bg-white dark:bg-dark-surface p-6 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
                 <h3 className="text-md font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-rose-500" />
                    Top Consumers
                 </h3>
                 <div className="space-y-6">
                    {topConsumers.map((c, i) => (
                      <div key={c.id} className="relative pl-6 border-l-2 border-brand-purple/20">
                         <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white dark:bg-dark-surface border-2 border-brand-purple" />
                         <p className="text-[10px] font-black text-brand-purple uppercase mb-1">Rank #{i + 1}</p>
                         <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate">{c.unit_label}</h4>
                         <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-gray-500">{c.consumption} Units</span>
                            <span className="text-xs font-bold text-rose-500">
                               +{Math.round((c.consumption / (propertySummary[0]?.consumption || 1)) * 100)}% of max
                            </span>
                         </div>
                      </div>
                    ))}
                    {topConsumers.length === 0 && <p className="text-center text-gray-400 text-sm py-4">No consumer data available</p>}
                 </div>
              </div>

              <div className="bg-gradient-to-br from-brand-purple to-brand-pink p-6 rounded-2xl shadow-xl shadow-brand-purple/20 text-white">
                 <h3 className="font-bold mb-4 flex items-center gap-2 uppercase tracking-widest text-xs opacity-90">
                    <TrendingUp size={16} />
                    Insight summary
                 </h3>
                 <p className="text-sm leading-relaxed mb-6 opacity-90 font-medium">
                    Overall water usage is <span className="underline decoration-2 underline-offset-4">stable</span> across properties this month. Total projected billing:
                 </p>
                  <div className="text-3xl font-black mb-6">
                    Ksh {(propertySummary.reduce((sum, p) => sum + p.consumption, 0) * 150).toLocaleString()}
                  </div>
                  <button 
                    onClick={handleGenerateAllBills}
                    disabled={isGenerating}
                    title="Generate invoices for all units with unbilled consumption"
                    className="w-full py-3 bg-white text-brand-purple rounded-xl font-black text-xs uppercase hover:bg-opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isGenerating ? <CustomLoader size={16} /> : <FileText size={16} />}
                    {isGenerating ? 'Processing...' : 'Generate All Unit Bills'}
                  </button>
              </div>
            </div>
        </div>
      </div>
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
