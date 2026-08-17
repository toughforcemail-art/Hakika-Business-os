// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { Droplets, Calculator, Building, Calendar, Users, Save, X, Info, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { generateInvoiceNumber } from '../../utils/invoiceNumbers';

type DistributionMethod = 'reading' | 'equal' | 'sqft';

export default function AddWaterBill() {
  const { profile } = useAccess();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [readings, setReadings] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Bill State
  const [step, setStep] = useState(1);
  const [propertyId, setPropertyId] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [billingMonth, setBillingMonth] = useState(new Date().toISOString().split('T')[0].slice(0, 7));
  const [method, setMethod] = useState<DistributionMethod>('reading');
  const [generatedBills, setGeneratedBills] = useState<any[]>([]);

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [propRes, unitRes, readingRes] = await Promise.all([
        supabase.from('re_properties').select('*'),
        supabase.from('re_units').select('*'),
        supabase.from('re_meter_readings').select('*').eq('type', 'water').eq('is_billed', false)
      ]);
      setProperties(propRes.data || []);
      setUnits(unitRes.data || []);
      setReadings(readingRes.data || []);
    } catch (error) {
      console.error('Error fetching bill data:', error);
    } finally {
      setLoading(false);
    }
  };

  const propertyUnits = useMemo(() => units.filter(u => u.property_id === propertyId), [units, propertyId]);
  
  const calculateDistribution = () => {
    if (!propertyId || !totalAmount || Number(totalAmount) <= 0) {
      setToast({ message: 'Please enter a valid property and total amount', type: 'warning' });
      return;
    }

    const amount = Number(totalAmount);
    let bills: any[] = [];

    if (method === 'equal') {
      const perUnit = amount / Math.max(propertyUnits.length, 1);
      bills = propertyUnits.map(u => ({
        unit_id: u.id,
        unit_number: u.unit_number,
        amount: perUnit,
        basis: 'Equal split'
      }));
    } else if (method === 'sqft') {
      const totalSqft = propertyUnits.reduce((sum, u) => sum + (Number(u.size_sqft) || 0), 0);
      bills = propertyUnits.map(u => ({
        unit_id: u.id,
        unit_number: u.unit_number,
        amount: (Number(u.size_sqft || 0) / Math.max(totalSqft, 1)) * amount,
        basis: `${u.size_sqft || 0} sqft`
      }));
    } else if (method === 'reading') {
      const pReadings = readings.filter(r => r.property_id === propertyId && r.reading_date.startsWith(billingMonth));
      const totalConsumption = pReadings.reduce((sum, r) => sum + (Number(r.consumption) || 0), 0);
      
      if (totalConsumption === 0) {
        setToast({ message: 'No meter readings found for this property and month.', type: 'error' });
        return;
      }

      bills = propertyUnits.map(u => {
        const reading = pReadings.find(r => r.unit_id === u.id);
        return {
          unit_id: u.id,
          unit_number: u.unit_number,
          amount: (Number(reading?.consumption || 0) / totalConsumption) * amount,
          basis: `${reading?.consumption || 0} units consumed`,
          reading_id: reading?.id
        };
      });
    }

    setGeneratedBills(bills);
    setStep(2);
  };

  const handleProcess = async () => {
    setLoading(true);
    try {
      // 1. Create Invoices for each unit
      const invoices = generatedBills.map(b => ({
        invoice_number: generateInvoiceNumber(),
        company_id: profile?.company_id,
        unit_id: b.unit_id,
        invoice_type: 'water',
        amount_due: b.amount,
        due_date: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0],
        invoice_date: new Date().toISOString().split('T')[0],
        notes: `Water Bill - ${billingMonth} (${b.basis})`,
        status: 'unpaid',
        created_by: profile?.id
      }));

      const { data: invData, error: invError } = await supabase.from('re_invoices').insert(invoices).select();
      if (invError) throw invError;

      // 2. Mark readings as billed if using reading method
      if (method === 'reading') {
        const readingIds = generatedBills.map(b => b.reading_id).filter(Boolean);
        if (readingIds.length > 0) {
          await supabase.from('re_meter_readings').update({ is_billed: true }).in('id', readingIds);
        }
      }

      setToast({ message: `Successfully processed ${invoices.length} water bills`, type: 'success' });
      setStep(1);
      setTotalAmount('');
      setGeneratedBills([]);
      fetchData();
    } catch (error) {
      console.error('Processing error:', error);
      setToast({ message: 'Failed to process bills', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (loading && step === 1) return <div className="flex-1 p-8 flex items-center justify-center"><CustomLoader label="Preparing billing processor..." /></div>;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8 text-gray-900 dark:text-white">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10 text-center">
            <div className="inline-flex p-4 bg-brand-purple/10 text-brand-purple rounded-2xl mb-4">
               <Droplets size={40} />
            </div>
            <h1 className="text-4xl font-black mb-2 tracking-tight">Batch Water Billing</h1>
            <p className="text-gray-500 dark:text-gray-400">Distribute municipal bills across units with precision.</p>
        </div>

        {/* Wizard Steps */}
        <div className="flex items-center justify-center gap-4 mb-10">
           <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${step >= 1 ? 'bg-brand-purple text-white' : 'bg-gray-200 dark:bg-white/5 text-gray-400'}`}>1</div>
           <div className={`h-1 w-20 rounded-full ${step >= 2 ? 'bg-brand-purple' : 'bg-gray-200 dark:bg-white/5'}`} />
           <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${step >= 2 ? 'bg-brand-purple text-white' : 'bg-gray-200 dark:bg-white/5 text-gray-400'}`}>2</div>
        </div>

        {step === 1 ? (
          <div className="bg-white dark:bg-dark-surface p-8 rounded-3xl border border-gray-200 dark:border-white/10 shadow-2xl space-y-8 animate-fade-in">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                   <label className="block text-sm font-black uppercase tracking-widest text-gray-400">Step 1: Select Property & Month</label>
                   <div className="space-y-4">
                      <div className="relative">
                         <label htmlFor="bill-property" className="sr-only">Select property for batch billing</label>
                         <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-purple" size={20} />
                         <select 
                          id="bill-property"
                          value={propertyId}
                          onChange={(e) => setPropertyId(e.target.value)}
                          title="Select property for batch billing"
                          className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/5 rounded-2xl outline-none focus:ring-2 focus:ring-brand-purple font-bold"
                         >
                           <option value="">-- Choose Property --</option>
                           {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                         </select>
                      </div>
                      <div className="relative">
                         <label htmlFor="bill-year" className="sr-only">Billing Year</label>
                         <label htmlFor="bill-month" className="sr-only">Billing Month</label>
                         <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-purple" size={20} />
                         <div className="flex gap-2 w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/5 rounded-2xl">
                           <select 
                            id="bill-year"
                            title="Filter by Year"
                            value={billingMonth.split('-')[0] || ''} 
                            onChange={(e) => {
                              const year = e.target.value;
                              const month = billingMonth.split('-')[1] || '01';
                              setBillingMonth(year ? `${year}-${month}` : '');
                            }}
                            className="bg-transparent outline-none focus:ring-1 focus:ring-brand-purple rounded font-bold text-gray-900 dark:text-white"
                           >
                              {[2024, 2025, 2026].map(y => <option key={y} value={y.toString()}>{y}</option>)}
                           </select>
                           <select 
                            id="bill-month"
                            title="Filter by Month"
                            value={billingMonth.split('-')[1] || ''} 
                            onChange={(e) => {
                              const month = e.target.value;
                              const year = billingMonth.split('-')[0] || new Date().getFullYear().toString();
                              setBillingMonth(month ? `${year}-${month}` : '');
                            }}
                            className="bg-transparent outline-none focus:ring-1 focus:ring-brand-purple rounded font-bold text-gray-900 dark:text-white"
                           >
                              {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => (
                                <option key={m} value={m}>{new Date(2000, parseInt(m)-1).toLocaleString('default', { month: 'short' })}</option>
                              ))}
                           </select>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="space-y-4">
                   <label htmlFor="total-bill-amount" className="block text-sm font-black uppercase tracking-widest text-gray-400">Step 2: Enter Total Bill Amount</label>
                   <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-purple font-black">KSH</span>
                      <input 
                        id="total-bill-amount"
                        type="number" 
                        value={totalAmount}
                        onChange={(e) => setTotalAmount(e.target.value)}
                        placeholder="e.g. 150,000"
                        title="Total Municipal Bill Amount"
                        className="w-full pl-16 pr-4 py-4 bg-gray-50 dark:bg-black/20 border border-gray-100 dark:border-white/5 rounded-2xl outline-none focus:ring-2 focus:ring-brand-purple font-black text-2xl"
                      />
                   </div>
                   <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex gap-3 text-emerald-600 dark:text-emerald-400">
                      <Calculator size={20} className="flex-shrink-0" />
                      <p className="text-xs font-medium leading-relaxed">System will automatically split this amount across {propertyUnits.length} active units.</p>
                   </div>
                </div>
             </div>

             <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-white/5">
                <label className="block text-sm font-black uppercase tracking-widest text-gray-400">Step 3: Distribution Algorithm</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   {[
                     { id: 'reading', label: 'By Meter Reading', desc: 'Proportional to usage', icon: Droplets },
                     { id: 'equal', label: 'Equal Split', desc: 'Divide by unit count', icon: Users },
                     { id: 'sqft', label: 'By Floor Area', desc: 'Based on unit size', icon: Building },
                   ].map(opt => (
                     <button 
                      key={opt.id}
                      onClick={() => setMethod(opt.id as DistributionMethod)}
                      title={`Use ${opt.label} algorithm`}
                      className={`p-6 rounded-3xl border text-left transition-all ${method === opt.id ? 'bg-brand-purple text-white border-brand-purple shadow-xl shadow-brand-purple/20 ring-4 ring-brand-purple/10 scale-[1.02]' : 'bg-gray-50 dark:bg-black/20 border-gray-100 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                     >
                        <opt.icon size={28} className={method === opt.id ? 'text-white' : 'text-brand-purple'} />
                        <h4 className="font-black mt-4 uppercase tracking-tighter">{opt.label}</h4>
                        <p className={`text-xs mt-1 ${method === opt.id ? 'opacity-80' : 'text-gray-400'}`}>{opt.desc}</p>
                     </button>
                   ))}
                </div>
             </div>

             <div className="pt-6">
                <button 
                  onClick={calculateDistribution}
                  title="Calculate bill distribution based on selected method"
                  className="w-full py-5 bg-gradient-to-r from-brand-purple to-brand-pink text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:opacity-90 transition-all shadow-xl shadow-brand-purple/30"
                >
                   Calculate Distribution
                   <ArrowRight size={24} />
                </button>
             </div>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
             <div className="bg-white dark:bg-dark-surface rounded-3xl border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-black/10">
                   <div>
                      <h4 className="font-black text-xl">Distribution Preview</h4>
                      <p className="text-sm text-gray-500">Review generated unit-level costs before final processing.</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-black uppercase text-brand-purple tracking-widest">Selected Method</p>
                      <span className="px-4 py-1.5 bg-brand-purple text-white rounded-full text-xs font-black uppercase">{method}</span>
                   </div>
                </div>
                
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead>
                         <tr className="text-xs font-black uppercase text-gray-400 tracking-widest bg-gray-50/30 dark:bg-black/5">
                            <th className="px-8 py-4">Unit</th>
                            <th className="px-8 py-4">Basis / Consumption</th>
                            <th className="px-8 py-4 text-right">Computed Bill</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                         {generatedBills.map((b, i) => (
                           <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                              <td className="px-8 py-5">
                                 <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center font-black text-gray-400">
                                       {b.unit_number}
                                    </div>
                                    <span className="font-bold">Unit {b.unit_number}</span>
                                 </div>
                              </td>
                              <td className="px-8 py-5">
                                 <span className="px-3 py-1 bg-gray-100 dark:bg-white/5 rounded-lg text-[10px] font-black uppercase text-gray-500">
                                    {b.basis}
                                 </span>
                              </td>
                              <td className="px-8 py-5 text-right font-black text-lg text-brand-purple">
                                 Ksh {b.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </div>

                <div className="p-8 bg-gray-50 dark:bg-black/10 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                   <div className="flex items-center gap-3 text-amber-500">
                      <Info size={20} />
                      <p className="text-xs font-bold uppercase tracking-tight">This will generate {generatedBills.length} pending invoices.</p>
                   </div>
                   <div className="flex gap-4">
                      <button 
                        onClick={() => setStep(1)}
                        className="px-8 py-4 text-gray-500 font-bold hover:text-gray-900 dark:hover:text-white transition-colors"
                      >
                         Go Back
                      </button>
                      <button 
                        onClick={handleProcess}
                        disabled={loading}
                        title="Commit distribution and generate invoices for all units"
                        className="px-10 py-4 bg-brand-purple text-white rounded-2xl font-black uppercase tracking-widest hover:bg-brand-pink transition-all flex items-center gap-3 shadow-xl shadow-brand-purple/20 disabled:opacity-50"
                      >
                         {loading ? <CustomLoader size={20} /> : <Save size={20} />}
                         Commit & Generate Invoices
                      </button>
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
