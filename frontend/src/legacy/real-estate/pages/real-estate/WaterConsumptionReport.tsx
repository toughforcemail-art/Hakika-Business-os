// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Droplets, Search, Printer, TrendingDown, BarChart2 } from 'lucide-react';
import { printWorkspacePage } from '../../utils/printHelpers';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';

interface WaterBill {
  id: string;
  bill_month: string;
  meter_reading_open: number;
  meter_reading_close: number;
  units_consumed: number;
  rate_per_unit: number;
  amount_due: number;
  amount_paid: number;
  status: string;
  unit?: { unit_number: string; property?: { name: string } | null } | null;
  tenant?: { full_name: string } | null;
}

export default function WaterConsumptionReport() {
  const { profile } = useAccess();
  const [bills, setBills] = useState<WaterBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const [billsRes, tenRes, unitRes, propRes] = await Promise.all([
        supabase.from('re_bills_water').select('*').order('bill_month', { ascending: false }),
        supabase.from('re_tenants').select('id, full_name'),
        supabase.from('re_units').select('id, unit_number, property_id'),
        supabase.from('re_properties').select('id, name')
      ]);

      if (billsRes.error) throw billsRes.error;
      
      const billsData = billsRes.data || [];
      const tenantsData = tenRes.data || [];
      const unitsData = unitRes.data || [];
      const propertiesData = propRes.data || [];

      const joinedBills = billsData.map((bill: any) => {
        const tenant = tenantsData.find(t => t.id === bill.tenant_id);
        const unit = unitsData.find(u => u.id === bill.unit_id);
        const property = propertiesData.find(p => p.id === unit?.property_id);

        return {
          ...bill,
          tenant: tenant || null,
          unit: unit ? { ...unit, property: property || null } : null,
        };
      });

      if (profile?.company_id) {
        setBills(joinedBills.filter(b => b.company_id === profile.company_id));
      } else {
        setBills(joinedBills);
      }
    } catch (err: any) {
      console.error('Error fetching water consumption:', err);
      setToast({ message: 'Failed to load water consumption data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (profile) fetchBills(); }, [profile]);

  const filtered = bills.filter(b => {
    const matchSearch =
      (b.unit?.unit_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.tenant?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.unit?.property?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchMonth = !monthFilter || b.bill_month.startsWith(monthFilter);
    return matchSearch && matchMonth;
  });

  const totalUnits = filtered.reduce((sum, b) => sum + b.units_consumed, 0);
  const totalBilled = filtered.reduce((sum, b) => sum + b.amount_due, 0);
  const totalUnpaid = filtered.reduce((sum, b) => sum + (b.amount_due - b.amount_paid), 0);

  const statusBadge = (status: string) => {
    const cls: Record<string, string> = {
      paid: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30',
      partial: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800/30',
      unpaid: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/30',
      overdue: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30',
    };
    return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize border ${cls[status] || ''}`}>{status}</span>;
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
              <Droplets className="mr-3 text-blue-500" size={32} />
              Water Consumption Report
            </h1>
            <p className="text-gray-500 dark:text-gray-400">Monthly water usage and billing summary per unit.</p>
          </div>
          <button onClick={() => printWorkspacePage()} title="Print water consumption report" className="px-4 py-2 bg-gray-800 dark:bg-white/10 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors flex items-center gap-2 shadow-sm">
            <Printer size={18} /> Print
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-5 flex items-center gap-4">
            <div className="w-11 h-11 bg-blue-100 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400"><Droplets size={22} /></div>
            <div><p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUnits.toFixed(1)}</p><p className="text-xs text-gray-500 dark:text-gray-400">Total m³ Consumed</p></div>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-5 flex items-center gap-4">
            <div className="w-11 h-11 bg-brand-purple/10 rounded-xl flex items-center justify-center text-brand-purple"><BarChart2 size={22} /></div>
            <div><p className="text-2xl font-bold text-gray-900 dark:text-white">Ksh {totalBilled.toLocaleString()}</p><p className="text-xs text-gray-500 dark:text-gray-400">Total Billed</p></div>
          </div>
          <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 p-5 flex items-center gap-4">
            <div className="w-11 h-11 bg-red-100 dark:bg-red-900/20 rounded-xl flex items-center justify-center text-red-600 dark:text-red-400"><TrendingDown size={22} /></div>
            <div><p className="text-2xl font-bold text-gray-900 dark:text-white">Ksh {totalUnpaid.toLocaleString()}</p><p className="text-xs text-gray-500 dark:text-gray-400">Outstanding Balance</p></div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Search unit, property or tenant..." 
              title="Search water consumption bills"
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 pl-10 pr-4 py-2.5 rounded-lg outline-none text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple" 
            />
          </div>
          <div className="flex gap-2">
            <select 
              title="Filter by Year"
              value={monthFilter.split('-')[0] || ''} 
              onChange={e => {
                const year = e.target.value;
                const month = monthFilter.split('-')[1] || '01';
                setMonthFilter(year ? `${year}-${month}` : '');
              }}
              className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 px-3 py-2.5 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-purple"
            >
              <option value="">Year</option>
              {[2024, 2025, 2026].map(y => <option key={y} value={y.toString()}>{y}</option>)}
            </select>
            <select 
              title="Filter by Month"
              value={monthFilter.split('-')[1] || ''} 
              onChange={e => {
                const month = e.target.value;
                const year = monthFilter.split('-')[0] || new Date().getFullYear().toString();
                setMonthFilter(month ? `${year}-${month}` : '');
              }}
              className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 px-3 py-2.5 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-purple"
            >
              <option value="">Month</option>
              {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => (
                <option key={m} value={m}>{new Date(2000, parseInt(m)-1).toLocaleString('default', { month: 'short' })}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center"><CustomLoader size={32} label="Loading consumption data..." /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Droplets size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No Water Bills Found</h3>
              <p className="text-gray-500 dark:text-gray-400">Record water bills via Add Water Bill to see data here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Unit / Property</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Tenant</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Month</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Open (m³)</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Close (m³)</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Consumed</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Amount Due</th>
                    <th className="px-6 py-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {filtered.map(b => (
                    <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900 dark:text-white">Unit {b.unit?.unit_number}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{b.unit?.property?.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{b.tenant?.full_name || '—'}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">{new Date(b.bill_month).toLocaleDateString('en-KE', { month: 'short', year: 'numeric' })}</td>
                      <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{b.meter_reading_open}</td>
                      <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{b.meter_reading_close}</td>
                      <td className="px-6 py-4 font-semibold text-blue-600 dark:text-blue-400">{b.units_consumed} m³</td>
                      <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">Ksh {b.amount_due.toLocaleString()}</td>
                      <td className="px-6 py-4">{statusBadge(b.status)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-white/5 border-t border-gray-200 dark:border-white/10">
                  <tr>
                    <td colSpan={5} className="px-6 py-4 font-bold text-gray-700 dark:text-gray-300">Totals ({filtered.length} records)</td>
                    <td className="px-6 py-4 font-bold text-blue-600 dark:text-blue-400">{totalUnits.toFixed(1)} m³</td>
                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">Ksh {totalBilled.toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
