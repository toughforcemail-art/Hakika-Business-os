// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Play, Search, Filter, Home, CheckCircle2, AlertCircle, Calendar, Send, Calculator, Building, User, Settings2, Percent, WalletCards, ChevronRight, Clock3 } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { generateInvoiceNumber } from '../../utils/invoiceNumbers';
import { getTenantDisplayName } from '../../utils/tenantDisplay';
import { calculateHakikaSplit } from '../../utils/hakikaLedger';
import { callDaraja } from '../../services/darajaService';
import { Link, useNavigate } from 'react-router-dom';

const SummaryTile = ({ label, value, accent }: { label: string; value: string; accent: string }) => {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-dark-surface p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
      <p className={`mt-2 text-lg font-black ${accent}`}>{value}</p>
    </div>
  );
};

export default function AutoBilling() {
  const { profile } = useAccess();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [leases, setLeases] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [billingMonth, setBillingMonth] = useState(new Date().toISOString().split('T')[0].slice(0, 7));
  const [interestRate, setInterestRate] = useState(() => Number(localStorage.getItem('hakika_interest_rate') || '10'));
  const [interestMode, setInterestMode] = useState<'percent' | 'flat'>((localStorage.getItem('hakika_interest_mode') as 'percent' | 'flat') || 'percent');
  const [autoEmail, setAutoEmail] = useState(() => localStorage.getItem('hakika_auto_email') !== 'false');
  const [autoSms, setAutoSms] = useState(() => localStorage.getItem('hakika_auto_sms') !== 'false');
  const [manualStkAmount, setManualStkAmount] = useState('');
  const [manualStkPhone, setManualStkPhone] = useState('');
  const [manualStkName, setManualStkName] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const isVisibleRecord = (value?: string | null) => {
    const status = String(value || '').trim().toLowerCase();
    return !status || !['deleted', 'inactive', 'archived', 'removed'].includes(status);
  };

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('hakika_interest_rate', String(interestRate));
    localStorage.setItem('hakika_interest_mode', interestMode);
  }, [interestRate, interestMode]);

  useEffect(() => {
    localStorage.setItem('hakika_auto_email', String(autoEmail));
    localStorage.setItem('hakika_auto_sms', String(autoSms));
  }, [autoEmail, autoSms]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [propRes, leaseRes, unitRes, tenantRes] = await Promise.all([
        supabase.from('re_properties').select('id, name, status, service_fee_mode, service_fee_value, billing_repeat_every, billing_day, billing_time, billing_effective_from, billing_effective_to, due_day_rule, due_day_offset, due_month_mode'),
        supabase.from('re_leases').select('*').eq('status', 'active'),
        supabase.from('re_units').select('id, unit_number, property_id, rent_amount'),
        supabase.from('re_tenants').select('id, full_name')
      ]);

      const visibleProperties = (propRes.data || []).filter((property: any) => {
        const status = String(property.status || '').trim().toLowerCase();
        return isVisibleRecord(property.status) && status !== 'deleted';
      });
      const visiblePropertyIds = new Set(visibleProperties.map((property: any) => property.id));
      const visibleUnits = (unitRes.data || []).filter((unit: any) => {
        const unitVisible = isVisibleRecord(unit.status);
        const propertyVisible = visiblePropertyIds.has(unit.property_id);
        return unitVisible && propertyVisible;
      });
      const visibleLeases = (leaseRes.data || []).filter((lease: any) => {
        const unit = visibleUnits.find((u: any) => u.id === lease.unit_id);
        return Boolean(unit);
      });

      setProperties(visibleProperties);
      setLeases(visibleLeases);
      setUnits(visibleUnits);
      setTenants(tenantRes.data || []);
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const invoicePreview = useMemo(() => {
    return leases.map(lease => {
      const unit = units.find(u => u.id === lease.unit_id);
      const tenant = tenants.find(t => t.id === lease.tenant_id);
      const property = properties.find(p => p.id === unit?.property_id);
      const splitMode = (property?.service_fee_mode || interestMode) as 'percent' | 'flat';
      const splitRate = Number(property?.service_fee_value ?? interestRate) || 0;
      const split = calculateHakikaSplit({ amount: Number(lease.rent_amount) || Number(unit?.rent_amount) || 0, rate: splitRate, mode: splitMode });
      const invoiceMonth = billingMonth.split('-');
      const dueDay = Number(property?.billing_day || lease.payment_day || 1);
      const dueRule = property?.due_day_rule || 'invoice_day';
      const dueMonthMode = property?.due_month_mode || 'same_month';
      const baseDate = new Date(Number(invoiceMonth[0] || new Date().getFullYear()), Number(invoiceMonth[1] || '1') - 1, dueDay);
      const dueDate = (() => {
        if (dueRule === 'days_after_invoice') return new Date(baseDate.getTime() + (Number(property?.due_day_offset || 0) * 86400000));
        if (dueRule === 'next_month_day') return new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, dueDay);
        if (dueRule === 'end_of_month') return new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
        return baseDate;
      })();

      if (propertyFilter !== 'all' && property?.id !== propertyFilter) return null;

      return {
        lease_id: lease.id,
        tenant_id: lease.tenant_id,
        tenant_name: tenant ? getTenantDisplayName(tenant as any) : 'Unknown Tenant',
        unit_id: lease.unit_id,
        unit_number: unit?.unit_number,
        property_name: property?.name,
        amount: Number(lease.rent_amount) || Number(unit?.rent_amount) || 0,
        due_date: dueDate.toISOString().split('T')[0],
        split_mode: splitMode,
        split_rate: splitRate,
        service_fee: split.companyRevenue,
        landlord_payable: split.landlordPayable,
        billing_frequency: property?.billing_repeat_every || 'monthly',
        due_month_mode: dueMonthMode,
        type: 'Rent & Service Charge'
      };
    }).filter(Boolean);
  }, [leases, units, tenants, properties, propertyFilter, billingMonth, interestRate, interestMode]);

  const handleProcess = async () => {
    if (invoicePreview.length === 0) {
      setToast({ message: 'No invoices to generate', type: 'warning' });
      return;
    }

    setProcessing(true);
    try {
      const invoices = invoicePreview.map(prev => ({
        invoice_number: generateInvoiceNumber(),
        company_id: profile?.company_id,
        tenant_id: prev?.tenant_id,
        unit_id: prev?.unit_id,
        invoice_type: 'rent',
        amount_due: prev?.amount,
        service_fee_mode: prev?.split_mode,
        service_fee_value: prev?.split_rate,
        service_fee_amount: prev?.service_fee,
        landlord_payable_amount: prev?.landlord_payable,
        split_liability_amount: prev?.amount,
        split_rule_snapshot: {
          billing_frequency: prev?.billing_frequency,
          due_month_mode: prev?.due_month_mode,
          split_mode: prev?.split_mode,
          split_rate: prev?.split_rate,
        },
        due_date: prev?.due_date,
        invoice_date: new Date().toISOString().split('T')[0],
        notes: `Auto-generated Rent for ${billingMonth}`,
        status: 'unpaid',
        created_by: profile?.id
      }));

      const monthStart = `${billingMonth}-01`;
      const nextMonth = new Date(Number(billingMonth.split('-')[0]), Number(billingMonth.split('-')[1]) - 1 + 1, 1).toISOString().split('T')[0];
      const existingRes = await supabase
        .from('re_invoices')
        .select('id, tenant_id, unit_id')
        .eq('company_id', profile?.company_id)
        .eq('invoice_type', 'rent')
        .is('deleted_at', null)
        .gte('invoice_date', monthStart)
        .lt('invoice_date', nextMonth);

      if (existingRes.error) throw existingRes.error;
      const existingKeys = new Set((existingRes.data || []).map((row: any) => `${row.tenant_id}:${row.unit_id}`));
      const filteredInvoices = invoices.filter((invoice) => !existingKeys.has(`${invoice.tenant_id}:${invoice.unit_id}`));
      if (filteredInvoices.length === 0) {
        setToast({ message: 'Rent invoices already exist for this month.', type: 'warning' });
        return;
      }

      const { error } = await supabase.from('re_invoices').insert(filteredInvoices);
      if (error) throw error;

      setToast({ message: `Successfully generated ${filteredInvoices.length} rent invoices`, type: 'success' });
      fetchData();
    } catch (error) {
      console.error('Auto-billing error:', error);
      setToast({ message: 'Failed to generate bulk invoices', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleSendStk = () => {
    if (!manualStkPhone || !manualStkAmount) {
      setToast({ message: 'Enter a phone number and amount before sending STK', type: 'warning' });
      return;
    }

    setToast({
      message: `STK push prepared for ${manualStkName || 'tenant'} at ${manualStkPhone}. Amount: Ksh ${Number(manualStkAmount).toLocaleString()}`,
      type: 'success'
    });
  };

  const selectedProperty = properties.find(p => p.id === propertyFilter);
  const selectedSplitMode = (selectedProperty?.service_fee_mode || interestMode) as 'percent' | 'flat';
  const selectedSplitRate = Number(selectedProperty?.service_fee_value ?? interestRate) || 0;
  const selectedSplitPreview = calculateHakikaSplit({ amount: Number(manualStkAmount || 0), rate: selectedSplitRate, mode: selectedSplitMode });
  const totalGross = invoicePreview.reduce((sum, p) => sum + (p?.amount || 0), 0);
  const totalFee = invoicePreview.reduce((sum, p) => sum + (p?.service_fee || 0), 0);
  const totalLandlord = invoicePreview.reduce((sum, p) => sum + (p?.landlord_payable || 0), 0);
  const availableUnits = useMemo(() => {
    const leasedUnitIds = new Set(leases.map((lease) => lease.unit_id));
    return units.filter((unit: any) => !leasedUnitIds.has(unit.id) && String(unit.status || '').toLowerCase() !== 'deleted');
  }, [leases, units]);

  const propertyRows = useMemo(() => {
    return properties.map((property) => {
      const propUnits = units.filter((unit) => unit.property_id === property.id);
      const propLeases = leases.filter((lease) => propUnits.some((unit) => unit.id === lease.unit_id));
      const occupied = propUnits.filter((unit) => unit.status === 'occupied').length;
      const vacant = propUnits.filter((unit) => unit.status === 'vacant').length;
      return {
        property,
        totalUnits: propUnits.length,
        occupied,
        vacant,
        activeTenants: propLeases.length,
      };
    });
  }, [properties, units, leases]);

  const selectedUnit = useMemo(() => {
    if (!selectedUnitId) return null;
    return units.find((unit) => unit.id === selectedUnitId) || null;
  }, [selectedUnitId, units]);

  const selectedRow = useMemo(() => {
    if (!selectedUnit) return null;
    const lease = leases.find((item) => item.unit_id === selectedUnit.id) || null;
    const tenant = lease ? tenants.find((item) => item.id === lease.tenant_id) || null : null;
    const property = properties.find((item) => item.id === selectedUnit.property_id) || null;
    const splitMode = (property?.service_fee_mode || interestMode) as 'percent' | 'flat';
    const splitRate = Number(property?.service_fee_value ?? interestRate) || 0;
    const split = calculateHakikaSplit({ amount: Number(lease?.rent_amount || selectedUnit.rent_amount || 0), rate: splitRate, mode: splitMode });
    return { lease, tenant, property, splitMode, splitRate, split };
  }, [selectedUnit, leases, tenants, properties, interestMode, interestRate]);

  if (loading) return <div className="flex-1 p-8 flex items-center justify-center"><CustomLoader label="Scanning active leases..." /></div>;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8 text-gray-900 dark:text-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-black mb-2 flex items-center tracking-tight">
              <RefreshCw className="mr-4 text-brand-purple animate-spin-slow" size={40} />
              Auto-Billing Engine
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
               Generate recurring monthly invoices for all active leases in one click.
            </p>
          </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-dark-surface p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-white/10">
                <span className="text-[10px] font-black text-gray-400 uppercase">Billing Cycle</span>
                <div className="mt-2 flex gap-2">
                  <select 
                    id="billing-year-select"
                    title="Select Billing Year"
                    value={billingMonth.split('-')[0] || ''} 
                    onChange={(e) => {
                      const year = e.target.value;
                      const month = billingMonth.split('-')[1] || '01';
                      setBillingMonth(year ? `${year}-${month}` : '');
                    }}
                    className="bg-transparent font-black text-brand-purple outline-none text-sm"
                  >
                    {[2024, 2025, 2026].map(y => <option key={y} value={y.toString()}>{y}</option>)}
                  </select>
                  <select 
                    id="billing-month-select"
                    title="Select Billing Month"
                    value={billingMonth.split('-')[1] || ''} 
                    onChange={(e) => {
                      const month = e.target.value;
                      const year = billingMonth.split('-')[0] || new Date().getFullYear().toString();
                      setBillingMonth(month ? `${year}-${month}` : '');
                    }}
                    className="bg-transparent font-black text-brand-purple outline-none text-sm"
                  >
                    {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => (
                      <option key={m} value={m}>{new Date(2000, parseInt(m)-1).toLocaleString('default', { month: 'short' })}</option>
                    ))}
                  </select>
                </div>
            </div>
            <div className="bg-white dark:bg-dark-surface p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-white/10">
              <span className="text-[10px] font-black text-gray-400 uppercase">Split Rule</span>
              <div className="mt-2 flex items-center gap-2">
                <Settings2 size={18} className="text-brand-purple" />
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-black uppercase text-gray-400">Interest</label>
                  <select
                    value={interestMode}
                    onChange={(e) => setInterestMode(e.target.value as 'percent' | 'flat')}
                    className="bg-transparent text-sm font-bold outline-none text-gray-900 dark:text-white"
                  >
                    <option value="percent">Percentage</option>
                    <option value="flat">Flat fee</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={interestRate}
                    onChange={(e) => setInterestRate(Number(e.target.value))}
                    className="w-24 bg-transparent text-right font-black text-brand-purple outline-none"
                    aria-label="Interest amount"
                  />
                  <span className="text-xs font-bold text-gray-400">{interestMode === 'percent' ? '%' : 'KES'}</span>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-dark-surface p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-white/10">
              <span className="text-[10px] font-black text-gray-400 uppercase">Split Preview</span>
              <div className="mt-2 text-sm">
                <p className="font-bold text-gray-900 dark:text-white">Fee Ksh {selectedSplitPreview.companyRevenue.toLocaleString()}</p>
                <p className="text-gray-500">Landlord Ksh {selectedSplitPreview.landlordPayable.toLocaleString()}</p>
              </div>
            </div>
            <button
              onClick={handleProcess}
              disabled={processing || invoicePreview.length === 0}
              title="Generate invoices for all active leases for the selected cycle"
              className="px-8 py-3 bg-brand-purple text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-brand-pink transition-all shadow-xl shadow-brand-purple/20 disabled:opacity-50"
            >
                {processing ? <RefreshCw className="animate-spin" size={20} /> : <Play size={20} />}
                Run Global Cycle
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SummaryTile label="Properties" value={`${properties.length}`} accent="text-brand-purple" />
            <SummaryTile label="Occupied units" value={`${units.filter(u => u.status === 'occupied').length}`} accent="text-emerald-600" />
            <SummaryTile label="Vacant units" value={`${availableUnits.length}`} accent="text-sky-600" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SummaryTile label="Gross invoices" value={`Ksh ${totalGross.toLocaleString()}`} accent="text-brand-purple" />
            <SummaryTile label="Service fees" value={`Ksh ${totalFee.toLocaleString()}`} accent="text-amber-600" />
            <SummaryTile label="Landlord payable" value={`Ksh ${totalLandlord.toLocaleString()}`} accent="text-emerald-600" />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8">
           <div className="flex bg-white dark:bg-dark-surface p-1 rounded-xl shadow-sm border border-gray-200 dark:border-white/10">
              <button 
                onClick={() => setPropertyFilter('all')}
                title="Show generation preview for all properties"
                className={`px-6 py-2 rounded-lg text-xs font-black uppercase transition-all ${propertyFilter === 'all' ? 'bg-brand-purple text-white shadow-lg' : 'text-gray-500 hover:text-gray-700'}`}
              >
                All Properties
              </button>
              {properties.map(p => (
                <button 
                  key={p.id}
                  onClick={() => setPropertyFilter(p.id)}
                  title={`Show generation preview specifically for ${p.name}`}
                  className={`px-6 py-2 rounded-lg text-xs font-black uppercase transition-all ${propertyFilter === p.id ? 'bg-brand-purple text-white shadow-lg' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {p.name}
                </button>
              ))}
           </div>
        </div>

        <div className="mb-8 rounded-3xl border border-gray-200 dark:border-white/10 bg-white dark:bg-dark-surface shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black">Property Billing Hub</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Click a property to open its own billing page with schedule, units, and STK tools.</p>
            </div>
            <Link to="/app/real-estate/properties" className="text-xs font-black uppercase tracking-widest text-brand-purple">Manage properties</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-5">
            {propertyRows.map(({ property, totalUnits, occupied, vacant, activeTenants }) => (
              <button
                key={property.id}
                onClick={() => {
                  setPropertyFilter(property.id);
                  setSelectedUnitId(null);
                  navigate(`/app/real-estate/invoice/auto-billing/${property.id}`);
                }}
                className="text-left rounded-2xl border border-gray-200 dark:border-white/10 p-4 hover:border-brand-purple/40 hover:shadow-lg transition-all bg-gray-50/50 dark:bg-white/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Property</p>
                    <h4 className="mt-1 text-lg font-black">{property.name}</h4>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl bg-white dark:bg-dark-surface p-3">
                    <p className="text-gray-400 font-black uppercase">Units</p>
                    <p className="mt-1 font-black">{totalUnits}</p>
                  </div>
                  <div className="rounded-xl bg-white dark:bg-dark-surface p-3">
                    <p className="text-gray-400 font-black uppercase">Occ.</p>
                    <p className="mt-1 font-black text-emerald-600">{occupied}</p>
                  </div>
                  <div className="rounded-xl bg-white dark:bg-dark-surface p-3">
                    <p className="text-gray-400 font-black uppercase">Vacant</p>
                    <p className="mt-1 font-black text-sky-600">{vacant}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                  <span>{activeTenants} active lease(s)</span>
                  <span>Day {property.billing_day || 1} at {property.billing_time || '08:00'}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)] gap-8">
           <div className="space-y-8">
              <div className="bg-white dark:bg-dark-surface rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
                 <div className="p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
                    <h3 className="text-xl font-black tracking-tight">Generation Preview</h3>
                    <div className="flex items-center gap-2 px-4 py-2 bg-brand-purple/5 rounded-full">
                       <Calculator size={16} className="text-brand-purple" />
                       <span className="text-xs font-bold text-brand-purple">Total Value: Ksh {totalGross.toLocaleString()}</span>
                    </div>
                 </div>
                 
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                       <thead>
                          <tr className="bg-gray-50 dark:bg-black/10 text-[10px] font-black uppercase text-gray-400 tracking-widest">
                             <th className="px-8 py-5">Tenant / Unit</th>
                             <th className="px-8 py-5">Charge Type</th>
                             <th className="px-8 py-5">Expected Date</th>
                             <th className="px-8 py-5 text-right">Amount</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                          {invoicePreview.length > 0 ? invoicePreview.map((prev, i) => (
                            <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors group">
                               <td className="px-8 py-5">
                                  <div className="flex items-center gap-4">
                                     <div className="w-10 h-10 rounded-2xl bg-brand-purple/10 text-brand-purple flex items-center justify-center group-hover:bg-brand-purple group-hover:text-white transition-all">
                                        <User size={20} />
                                     </div>
                                     <div>
                                        <p className="font-bold text-gray-900 dark:text-white leading-none mb-1">{prev?.tenant_name}</p>
                                        <p className="text-xs text-brand-purple font-black uppercase opacity-60">{prev?.property_name} • Unit {prev?.unit_number}</p>
                                     </div>
                                  </div>
                               </td>
                               <td className="px-8 py-5">
                                  <span className="text-xs font-bold text-gray-500 uppercase tracking-tighter">{prev?.type}</span>
                               </td>
                               <td className="px-8 py-5">
                                  <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                                     <Calendar size={14} />
                                     {prev?.due_date}
                                  </div>
                               </td>
                               <td className="px-8 py-5 text-right">
                                  <span className="text-lg font-black text-gray-900 dark:text-white">Ksh {prev?.amount.toLocaleString()}</span>
                                  <div className="mt-2 flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedUnitId(prev?.unit_id || null)}
                                      className="px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/10 text-[10px] font-black uppercase tracking-widest"
                                    >
                                      Inspect
                                    </button>
                                  </div>
                               </td>
                            </tr>
                          )) : (
                            <tr>
                               <td colSpan={4} className="px-8 py-20 text-center">
                                  <div className="flex flex-col items-center">
                                     <AlertCircle size={48} className="text-gray-200 mb-4" />
                                     <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No pending invoices match your criteria</p>
                                  </div>
                               </td>
                            </tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>

              <div className="bg-white dark:bg-dark-surface rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black tracking-tight">Available Units</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Vacant units from active properties that are not currently leased.</p>
                  </div>
                  <div className="px-4 py-2 rounded-full bg-brand-purple/5 text-brand-purple text-xs font-bold">
                    {availableUnits.length} available
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-black/10 text-[10px] font-black uppercase text-gray-400 tracking-widest">
                        <th className="px-6 py-4">Unit</th>
                        <th className="px-6 py-4">Property</th>
                        <th className="px-6 py-4 text-right">Rent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {availableUnits.length > 0 ? availableUnits.slice(0, 10).map((unit: any) => {
                        const property = properties.find((p) => p.id === unit.property_id);
                        return (
                          <tr key={unit.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5">
                            <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{unit.unit_number}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">{property?.name || 'Unassigned'}</td>
                            <td className="px-6 py-4 text-right font-bold text-brand-purple">Ksh {Number(unit.rent_amount || 0).toLocaleString()}</td>
                          </tr>
                        );
                      }) : (
                        <tr>
                          <td colSpan={3} className="px-6 py-10 text-center text-sm text-gray-500">
                            No available units found for the current scope.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
           </div>

           <div className="space-y-8">
              <div className="bg-white dark:bg-dark-surface p-8 rounded-[2rem] border border-gray-200 dark:border-white/10">
                 <h4 className="font-black text-xs uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
                    <WalletCards size={14} className="text-brand-purple" />
                    STK Push at will
                 </h4>
                 <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Tenant name</label>
                      <input
                        value={manualStkName}
                        onChange={(e) => setManualStkName(e.target.value)}
                        placeholder="e.g. Mary Wanjiku"
                        className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 px-4 py-2.5 rounded-xl outline-none text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Phone number</label>
                      <input
                        value={manualStkPhone}
                        onChange={(e) => setManualStkPhone(e.target.value)}
                        placeholder="2547XXXXXXXX"
                        className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 px-4 py-2.5 rounded-xl outline-none text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Amount</label>
                      <input
                        type="number"
                        value={manualStkAmount}
                        onChange={(e) => setManualStkAmount(e.target.value)}
                        placeholder="5000"
                        className="w-full bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 px-4 py-2.5 rounded-xl outline-none text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="rounded-xl bg-gray-50 dark:bg-black/20 border border-dashed border-gray-200 dark:border-white/10 p-3 text-xs text-gray-500">
                      <p className="font-bold uppercase tracking-widest mb-2">Split Preview</p>
                      <p>Fee: Ksh {selectedSplitPreview.companyRevenue.toLocaleString()}</p>
                      <p>Landlord payable: Ksh {selectedSplitPreview.landlordPayable.toLocaleString()}</p>
                    </div>
                    <button
                      onClick={handleSendStk}
                      className="w-full px-4 py-3 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors"
                    >
                      <Send size={16} />
                      Send STK Push
                    </button>
                 </div>
                 <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                   Uses the current interest setting so you can split liability after payment callback.
                 </p>
              </div>

              <div className="bg-brand-purple p-8 rounded-[2rem] shadow-2xl shadow-brand-purple/30 text-white relative overflow-hidden">
                 <div className="relative z-10">
                    <p className="text-xs font-black uppercase opacity-60 tracking-widest mb-6">Automation Core</p>
                    <div className="space-y-6">
                       <div>
                          <h4 className="text-3xl font-black">{invoicePreview.length}</h4>
                          <p className="text-xs font-bold uppercase tracking-tighter opacity-80">Pending Invoices</p>
                       </div>
                       <div className="pt-6 border-t border-white/10">
                          <h4 className="text-xl font-bold mb-4">Smart Rules</h4>
                          <div className="space-y-3">
                             <div className="flex items-center gap-3 text-xs">
                                <CheckCircle2 size={16} className="text-emerald-300" />
                                <span>Rent from active leases</span>
                             </div>
                             <div className="flex items-center gap-3 text-xs">
                                <CheckCircle2 size={16} className="text-emerald-300" />
                                <span>Service charges included</span>
                             </div>
                             <div className="flex items-center gap-3 text-xs">
                                <CheckCircle2 size={16} className="text-emerald-300" />
                                <span>Adjust interest and split rules at any time</span>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
                 <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
              </div>

             <div className="bg-white dark:bg-dark-surface p-8 rounded-[2rem] border border-gray-200 dark:border-white/10">
                 <h4 className="font-black text-xs uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
                    <Send size={14} className="text-brand-purple" />
                    Notification settings
                 </h4>
                 <div className="space-y-4">
                    <label htmlFor="auto-email-check" className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-all">
                       <input id="auto-email-check" type="checkbox" checked={autoEmail} onChange={(e) => setAutoEmail(e.target.checked)} className="w-5 h-5 rounded-lg border-gray-300 text-brand-purple focus:ring-brand-purple" />
                       <span className="text-sm font-bold opacity-80">Auto-email tenants</span>
                    </label>
                    <label htmlFor="auto-sms-check" className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-all">
                       <input id="auto-sms-check" type="checkbox" checked={autoSms} onChange={(e) => setAutoSms(e.target.checked)} className="w-5 h-5 rounded-lg border-gray-300 text-brand-purple focus:ring-brand-purple" />
                       <span className="text-sm font-bold opacity-80">Send SMS reminder</span>
                    </label>
                 </div>
              </div>
           </div>
        </div>

        {selectedRow && selectedUnit && (
          <div className="mt-8 rounded-3xl border border-gray-200 dark:border-white/10 bg-white dark:bg-dark-surface shadow-sm p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Selected unit</p>
                <h3 className="text-2xl font-black mt-1">{selectedUnit.unit_number} {selectedRow.property ? `• ${selectedRow.property.name}` : ''}</h3>
                <p className="text-sm text-gray-500">Tenant: {selectedRow.tenant ? getTenantDisplayName(selectedRow.tenant as any) : 'Unassigned'}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => selectedRow.property && navigate(`/app/real-estate/invoice/auto-billing/${selectedRow.property.id}`)} className="px-4 py-2 rounded-xl bg-brand-purple text-white font-black">
                  Open Property Page
                </button>
                <button onClick={() => setSelectedUnitId(null)} className="px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 font-black">
                  Close
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
              <SummaryTile label="Unit Status" value={selectedUnit.status} accent="text-brand-purple" />
              <SummaryTile label="Billing Mode" value={selectedRow.splitMode} accent="text-amber-600" />
              <SummaryTile label="Fee" value={`Ksh ${selectedRow.split.companyRevenue.toLocaleString()}`} accent="text-emerald-600" />
              <SummaryTile label="Landlord" value={`Ksh ${selectedRow.split.landlordPayable.toLocaleString()}`} accent="text-sky-600" />
            </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-end">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400">Phone</label>
                  <input value={manualStkPhone} onChange={(e) => setManualStkPhone(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-transparent px-3 py-2" placeholder="Tenant phone" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400">Amount</label>
                  <input value={manualStkAmount} onChange={(e) => setManualStkAmount(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-transparent px-3 py-2" placeholder="Amount" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400">Name</label>
                  <input value={manualStkName} onChange={(e) => setManualStkName(e.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-transparent px-3 py-2" placeholder="Tenant name" />
                </div>
              </div>
              <button
                onClick={async () => {
                    if (!manualStkPhone) return;
                  try {
                    const response = await callDaraja({
                      action: 'stk-push',
                      amount: Math.round(Number(manualStkAmount)),
                      phoneNumber: manualStkPhone,
                      accountReference: selectedUnit.unit_number,
                      transactionDesc: `Auto billing for ${selectedRow.property?.name || 'property'}`,
                      service_key: 'hakika',
                      company_code: profile?.company_code || null,
                    } as any);
                    setToast({ message: response?.response?.CustomerMessage || 'STK push sent', type: 'success' });
                  } catch (error: any) {
                    setToast({ message: error?.message || 'Failed to send STK push', type: 'error' });
                  }
                }}
                className="px-5 py-3 rounded-xl bg-brand-purple text-white font-black uppercase tracking-widest flex items-center gap-2"
              >
                <Send size={16} /> Send STK
              </button>
            </div>
          </div>
        )}
      </div>
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}


