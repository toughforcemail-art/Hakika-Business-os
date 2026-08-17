// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { TrendingDown, Search, Filter, Mail, Phone, ChevronRight, Home, User, AlertCircle, Download } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { formatInvoiceDate, getInvoiceBalance, toMoney } from '../../utils/arrears';
import { getTenantDisplayName } from '../../utils/tenantDisplay';

interface ArrearsRecord {
  tenant_id: string;
  tenant_name: string;
  unit_number: string;
  property_name: string;
  total_due: number;
  total_paid: number;
  arrears: number;
  last_invoice_date: string;
  phone: string;
}

export default function ArrearsReport() {
  const { profile } = useAccess();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const [invoices, setInvoices] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);

  useEffect(() => {
    if (profile) fetchData();
  }, [profile?.company_id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, tenRes, unitRes, propRes] = await Promise.all([
        profile?.company_id
          ? supabase.from('re_invoices').select('*').eq('company_id', profile.company_id).is('deleted_at', null)
          : supabase.from('re_invoices').select('*').is('deleted_at', null),
        profile?.company_id
          ? supabase.from('re_tenants').select('id, full_name, phone').eq('company_id', profile.company_id)
          : supabase.from('re_tenants').select('id, full_name, phone'),
        profile?.company_id
          ? supabase.from('re_units').select('id, unit_number, property_id').eq('company_id', profile.company_id)
          : supabase.from('re_units').select('id, unit_number, property_id'),
        profile?.company_id
          ? supabase.from('re_properties').select('id, name').eq('company_id', profile.company_id)
          : supabase.from('re_properties').select('id, name')
      ]);

      if (invRes.error) throw invRes.error;
      if (tenRes.error) throw tenRes.error;
      if (unitRes.error) throw unitRes.error;
      if (propRes.error) throw propRes.error;

      setInvoices(invRes.data || []);
      setTenants(tenRes.data || []);
      setUnits(unitRes.data || []);
      setProperties(propRes.data || []);
    } catch (error) {
      console.error('Error fetching arrears data:', error);
      setToast({ message: 'Failed to load report data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const arrearsData = useMemo(() => {
    const grouped: { [key: string]: ArrearsRecord } = {};

    invoices.forEach(inv => {
      const balance = getInvoiceBalance(inv);
      if (balance <= 0) return;

      const tenantKey = inv.tenant_id || `unassigned-${inv.id}`;
      if (!grouped[tenantKey]) {
        const tenant = tenants.find(t => t.id === inv.tenant_id);
        const unit = units.find(u => u.id === inv.unit_id);
        const property = properties.find(p => p.id === unit?.property_id);

        grouped[tenantKey] = {
          tenant_id: inv.tenant_id || tenantKey,
          tenant_name: tenant ? getTenantDisplayName(tenant as any) : 'Unknown Tenant',
          unit_number: unit?.unit_number || 'N/A',
          property_name: property?.name || 'Unknown Property',
          total_due: 0,
          total_paid: 0,
          arrears: 0,
          last_invoice_date: inv.invoice_date,
          phone: tenant?.phone || ''
        };
      }

      const rec = grouped[tenantKey];
      rec.total_due += toMoney(inv.amount_due);
      rec.total_paid += toMoney(inv.amount_paid);
      rec.arrears = rec.total_due - rec.total_paid;
      
      if (new Date(inv.invoice_date || 0) > new Date(rec.last_invoice_date || 0)) {
        rec.last_invoice_date = inv.invoice_date;
      }
    });

    return Object.values(grouped).filter(rec => rec.arrears > 0);
  }, [invoices, tenants, units, properties]);

  const filteredData = arrearsData.filter(rec => {
    const matchesSearch = 
      rec.tenant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.unit_number.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesProperty = propertyFilter === 'all' || rec.property_name === propertyFilter;
    
    return matchesSearch && matchesProperty;
  });

  const totalArrears = filteredData.reduce((sum, rec) => sum + rec.arrears, 0);

  if (loading) return <div className="flex-1 p-8 flex items-center justify-center"><CustomLoader size={40} label="Generating arrears report..." /></div>;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
              <TrendingDown className="mr-3 text-brand-purple" size={32} />
              Arrears Report
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Track outstanding balances and overdue rent across all properties.
            </p>
          </div>
          <div className="flex gap-2">
            <button title="Export arrears report as PDF" className="px-4 py-2 bg-white dark:bg-dark-surface text-gray-700 dark:text-white border border-gray-200 dark:border-white/10 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center shadow-sm">
              <Download size={18} className="mr-2" /> Export PDF
            </button>
          </div>
        </div>

        {/* Global Stats */}
        <div className="bg-brand-purple/5 border border-brand-purple/10 rounded-xl p-6 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-purple/10 rounded-lg">
              <AlertCircle className="text-brand-purple" size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-brand-purple/70 uppercase tracking-wider">Total Outstanding Arrears</p>
              <h2 className="text-3xl font-bold text-brand-purple">KES {totalArrears.toLocaleString()}</h2>
            </div>
          </div>
          <div className="hidden md:block text-right">
            <p className="text-sm text-gray-500 font-medium">{filteredData.length} Tenants in Arrears</p>
            <p className="text-xs text-gray-400 capitalize">Filters: {propertyFilter === 'all' ? 'All Properties' : propertyFilter}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-dark-surface p-4 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm mb-6 flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px] relative">
            <label htmlFor="search-arrears-report" className="sr-only">Search arrears by tenant or unit</label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              id="search-arrears-report"
              type="text" 
              placeholder="Search tenant or unit..." 
              title="Search by tenant name or unit number"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg outline-none focus:ring-2 focus:ring-brand-purple text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="property-filter" className="sr-only">Filter by property</label>
            <Filter size={18} className="text-gray-400" />
            <select 
              id="property-filter"
              title="Filter by property"
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 px-4 py-2 rounded-lg outline-none focus:ring-2 focus:ring-brand-purple text-gray-700 dark:text-white text-sm"
            >
              <option value="all">All Properties</option>
              {properties.map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Report Table */}
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-black/20 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold">
                  <th className="px-6 py-4">Tenant</th>
                  <th className="px-6 py-4">Property / Unit</th>
                  <th className="px-6 py-4">Total Due</th>
                  <th className="px-6 py-4">Amount Paid</th>
                  <th className="px-6 py-4">Balance (Arrears)</th>
                  <th className="px-6 py-4">Last Invoice</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {filteredData.length > 0 ? (
                  filteredData.map((rec) => (
                    <tr key={rec.tenant_id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-brand-purple/10 flex items-center justify-center text-brand-purple font-bold">
                            {rec.tenant_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{rec.tenant_name}</p>
                            <p className="text-xs text-gray-500">{rec.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-gray-900 dark:text-white font-medium">{rec.property_name}</p>
                          <p className="text-xs text-gray-500">Unit {rec.unit_number}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">KES {rec.total_due.toLocaleString()}</td>
                      <td className="px-6 py-4 text-emerald-600 font-medium">KES {rec.total_paid.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className="text-rose-600 font-bold bg-rose-50 dark:bg-rose-900/10 px-2 py-1 rounded-lg">
                          KES {rec.arrears.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-sm italic">
                        {formatInvoiceDate(rec.last_invoice_date)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button 
                            className="p-2 text-gray-400 hover:text-brand-purple hover:bg-brand-purple/10 rounded-lg transition-colors"
                            title="Send SMS Reminder"
                          >
                            <Phone size={18} />
                          </button>
                          <button 
                            className="p-2 text-gray-400 hover:text-brand-pink hover:bg-brand-pink/10 rounded-lg transition-colors"
                            title="Send Email Notice"
                          >
                            <Mail size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <Home className="text-gray-300" size={48} />
                        <p>No active arrears found for the selected filters.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
