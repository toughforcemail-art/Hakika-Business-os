// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { Activity, DollarSign, TrendingUp, Home, ChevronRight, Download, Filter, Calendar, AlertCircle, Search } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';

interface MetricCardProps {
  title: string;
  value: string;
  subValue: string;
  icon: React.ReactNode;
  color: string;
}

const MetricCard = ({ title, value, subValue, icon, color }: MetricCardProps) => (
  <div className="bg-white dark:bg-dark-surface p-6 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm flex items-start gap-4">
    <div className={`p-3 rounded-lg ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</h3>
      <p className="text-xs text-gray-400 mt-1">{subValue}</p>
    </div>
  </div>
);

export default function FinancialYield() {
  const { profile } = useAccess();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [payRes, maintRes, propRes, unitRes, invRes] = await Promise.all([
        supabase.from('re_payments').select('*').order('payment_date', { ascending: true }),
        supabase.from('re_maintenance').select('actual_cost, created_at, status'),
        supabase.from('re_properties').select('*'),
        supabase.from('re_units').select('status, property_id'),
        supabase.from('re_invoices').select('amount_due, amount_paid, status')
      ]);

      setPayments(payRes.data || []);
      setMaintenance(maintRes.data || []);
      setProperties(propRes.data || []);
      setUnits(unitRes.data || []);
      setInvoices(invRes.data || []);
    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalExpenses = maintenance.reduce((sum, m) => sum + (m.actual_cost || 0), 0);
    const totalInvoiced = invoices.reduce((sum, i) => sum + (i.amount_due || 0), 0);
    const totalArrears = totalInvoiced - totalRevenue;
    const netYield = totalRevenue - totalExpenses;
    
    const occupiedUnits = units.filter(u => u.status === 'occupied').length;
    const occupancyRate = units.length ? (occupiedUnits / units.length) * 100 : 0;

    return {
      totalRevenue,
      totalExpenses,
      totalArrears,
      netYield,
      occupancyRate,
      propertyCount: properties.length
    };
  }, [payments, maintenance, invoices, units, properties]);

  const chartData = useMemo(() => {
    const months: { [key: string]: any } = {};
    
    payments.forEach(p => {
      const month = new Date(p.payment_date).toLocaleString('default', { month: 'short' });
      if (!months[month]) months[month] = { name: month, revenue: 0, expenses: 0 };
      months[month].revenue += (p.amount || 0);
    });

    maintenance.forEach(m => {
      const month = new Date(m.created_at).toLocaleString('default', { month: 'short' });
      if (!months[month]) months[month] = { name: month, revenue: 0, expenses: 0 };
      months[month].expenses += (m.actual_cost || 0);
    });

    return Object.values(months);
  }, [payments, maintenance]);

  const propertyData = useMemo(() => {
    return properties.map(prop => {
      const propUnits = units.filter(u => u.property_id === prop.id);
      const occupied = propUnits.filter(u => u.status === 'occupied').length;
      return {
        name: prop.name,
        value: propUnits.length ? (occupied / propUnits.length) * 100 : 0
      };
    });
  }, [properties, units]);

  const COLORS = ['#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];

  if (loading) return <div className="flex-1 p-8 flex items-center justify-center"><CustomLoader size={40} label="Calculating financial metrics..." /></div>;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
              <Activity className="mr-3 text-brand-purple" size={32} />
              Financial Yield
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Analysis of property performance, revenue, and overall ROI.
            </p>
          </div>
          <button title="Export this financial yield report" className="px-4 py-2 bg-white dark:bg-dark-surface text-gray-700 dark:text-white border border-gray-200 dark:border-white/10 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center shadow-sm">
            <Download size={18} className="mr-2" /> Export Report
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard 
            title="Total Revenue" 
            value={`KES ${stats.totalRevenue.toLocaleString()}`}
            subValue="Cash collected to date"
            icon={<DollarSign className="text-brand-purple" />}
            color="bg-brand-purple/10"
          />
          <MetricCard 
            title="Net Yield" 
            value={`KES ${stats.netYield.toLocaleString()}`}
            subValue="Revenue minus Maintenance"
            icon={<TrendingUp className="text-emerald-500" />}
            color="bg-emerald-500/10"
          />
          <MetricCard 
            title="Occupancy Rate" 
            value={`${stats.occupancyRate.toFixed(1)}%`}
            subValue={`${units.filter(u => u.status === 'occupied').length} of ${units.length} units`}
            icon={<Home className="text-blue-500" />}
            color="bg-blue-500/10"
          />
          <MetricCard 
            title="Current Arrears" 
            value={`KES ${Math.max(0, stats.totalArrears).toLocaleString()}`}
            subValue="Pending from all invoices"
            icon={<AlertCircle className="text-orange-500" />}
            color="bg-orange-500/10"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Revenue vs Expenses Chart */}
          <div className="lg:col-span-2 bg-white dark:bg-dark-surface p-6 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Revenue vs Expenses</h3>
            <div className="h-[350px] min-h-[350px]">
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                  <Area type="monotone" dataKey="expenses" stroke="#ec4899" strokeWidth={3} fillOpacity={0} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Occupancy by Property */}
          <div className="bg-white dark:bg-dark-surface p-6 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Occupancy by Property</h3>
            <div className="h-[350px] min-h-[350px]">
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={propertyData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {propertyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown Table */}
        <div className="mt-8 bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-white/10 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Property ROI Breakdown</h3>
            <div className="flex gap-2">
              <div className="relative">
                <label htmlFor="filter-properties" className="sr-only">Filter properties in the breakdown table</label>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  id="filter-properties"
                  type="text" 
                  placeholder="Filter properties..."
                  title="Search for properties in this table"
                  className="pl-9 pr-4 py-1.5 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-purple"
                />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-black/20 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider font-semibold">
                  <th className="px-6 py-4">Property Name</th>
                  <th className="px-6 py-4">Total Units</th>
                  <th className="px-6 py-4">Revenue</th>
                  <th className="px-6 py-4">Exp (Maint)</th>
                  <th className="px-6 py-4">Net ROI</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {properties.map(prop => {
                  const propUnits = units.filter(u => u.property_id === prop.id);
                  const propPayments = payments.filter(p => propUnits.some(u => u.id === p.unit_id));
                  const propMaint = maintenance.filter(m => (m as any).property_id === prop.id);
                  
                  const revenue = propPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
                  const expenses = propMaint.reduce((sum, m) => sum + (m.actual_cost || 0), 0);
                  const net = revenue - expenses;

                  return (
                    <tr key={prop.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{prop.name}</td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{propUnits.length}</td>
                      <td className="px-6 py-4 text-emerald-600 font-bold">KES {revenue.toLocaleString()}</td>
                      <td className="px-6 py-4 text-rose-500">KES {expenses.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-lg font-bold ${net >= 0 ? 'text-brand-purple bg-brand-purple/10' : 'text-red-500 bg-red-500/10'}`}>
                          KES {net.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span 
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              // Any details logic here
                            }
                          }}
                          title={`View financial details for ${prop.name}`} 
                          className="flex items-center text-xs text-gray-400 group-hover:text-brand-purple transition-colors cursor-pointer outline-none focus:ring-2 focus:ring-brand-purple rounded"
                        >
                          Details <ChevronRight size={14} className="ml-1" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
