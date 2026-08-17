// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, Home, Users, Wrench, DollarSign, TrendingUp, AlertCircle,
  MapPin, ArrowUpRight, ArrowDownRight, ChevronRight, Calendar, FileText,
  BarChart3, Clock, CheckCircle, AlertTriangle
} from 'lucide-react';
import { supabase } from '../utils/supabase';
import { useAccess } from '../context/AccessContext';

import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

export default function DashboardRealEstate() {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { profile } = useAccess();
  
  const [metrics, setMetrics] = useState({
    properties: 0,
    units: 0,
    tenants: 0,
    occupancy: 0,
    revenue: 0,
    paidAmount: 0,
    unpaidAmount: 0,
    collectedInvoices: 0,
    pending: 0,
    maintenance: 0
  });

  const [properties, setProperties] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [workspaceStatus, setWorkspaceStatus] = useState<'loading' | 'empty' | 'ready'>('loading');
  const [workspaceLabel, setWorkspaceLabel] = useState<string>('your workspace');

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = async () => {
    // 1. Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    try {
      const userRole = (profile?.role || '').toLowerCase();
      const isElevated = ['super admin', 'director', 'director / super admin'].includes(userRole);
      const companyCode = (profile?.company_code || '').trim();
      let companyId = isElevated ? null : profile?.company_id || null;
      let resolvedCompanyName = '';

      if (!isElevated && companyCode) {
        const { data: companyRow } = await supabase
          .from('companies')
          .select('id, code, name')
          .eq('code', companyCode)
          .maybeSingle();
        companyId = companyRow?.id || companyId;
        resolvedCompanyName = companyRow?.name || '';
      }
      
      console.log('DashboardRealEstate: Fetching data for role:', userRole, 'isElevated:', isElevated, 'companyId:', companyId, 'companyCode:', companyCode);
      setWorkspaceLabel(resolvedCompanyName || profile?.company_code || 'your workspace');

      if (!companyId && !isElevated) {
        setWorkspaceStatus('empty');
        setMetrics({
          properties: 0,
          units: 0,
          tenants: 0,
          occupancy: 0,
          revenue: 0,
          paidAmount: 0,
          unpaidAmount: 0,
          collectedInvoices: 0,
          pending: 0,
          maintenance: 0,
        });
        setProperties([]);
        setTasks([]);
        setRecentPayments([]);
        setChartData([]);
        setLoading(false);
        return;
      }

      // 1. Build Queries (Conditional on companyId)
      let propQ = supabase.from('re_properties').select('*', { count: 'exact', head: true }).abortSignal(controller.signal);
      let unitQ = supabase.from('re_units').select('id, status, rent_amount').abortSignal(controller.signal);
      let tenantQ = supabase.from('re_tenants').select('*', { count: 'exact', head: true }).abortSignal(controller.signal);
      
      // Revenue calculation: Check both invoices and payments for a complete picture
      let invPaidQ = supabase.from('re_invoices').select('amount_due, amount_paid, status').abortSignal(controller.signal);
      let payQ = supabase.from('re_payments').select('amount').eq('status', 'confirmed').abortSignal(controller.signal);
      
      let invQ = supabase.from('re_invoices').select('id', { count: 'exact', head: true }).in('status', ['unpaid', 'overdue', 'partial']).abortSignal(controller.signal);
      let maintQ = supabase.from('re_maintenance').select('*, unit:re_units(unit_number)').order('created_at', { ascending: false }).limit(5).abortSignal(controller.signal);

      if (companyId) {
        propQ = propQ.eq('company_id', companyId);
        unitQ = unitQ.eq('company_id', companyId);
        tenantQ = tenantQ.eq('company_id', companyId);
        invPaidQ = invPaidQ.eq('company_id', companyId);
        payQ = payQ.eq('company_id', companyId);
        invQ = invQ.eq('company_id', companyId);
        maintQ = maintQ.eq('company_id', companyId);
      }

      const [propCount, unitData, tenantCount, invPaidSum, paySum, invPending, maintTasks] = await Promise.all([
        propQ, unitQ, tenantQ, invPaidQ, payQ, invQ, maintQ
      ]);

      if (controller.signal.aborted) return;

      // Calculate Occupancy from Unit list
      const allUnits = unitData.data || [];
      const occupiedUnits = allUnits.filter((u: any) => u.status === 'occupied').length;
      const maintenanceUnits = allUnits.filter((u: any) => u.status === 'under_maintenance').length;
      const occRate = allUnits.length > 0 ? (occupiedUnits / allUnits.length) * 100 : 0;

      // Revenue: Combine paid invoices and confirmed direct payments
      const invoiceRows = invPaidSum.data || [];
      const paidAmount = invoiceRows.reduce((acc: number, curr: any) => acc + (Number(curr.amount_paid) || 0), 0);
      const unpaidAmount = invoiceRows.reduce((acc: number, curr: any) => acc + Math.max(0, (Number(curr.amount_due) || 0) - (Number(curr.amount_paid) || 0)), 0);
      const collectedInvoices = invoiceRows.filter((curr: any) => Number(curr.amount_paid || 0) > 0).length;
      const directPayRev = (paySum.data || []).reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0);
      const totalRev = Math.max(paidAmount, directPayRev);
      const hasProperties = (propCount.count || 0) > 0;
      setWorkspaceStatus(hasProperties ? 'ready' : 'empty');

      setMetrics({
        properties: propCount.count || 0,
        units: allUnits.length,
        tenants: tenantCount.count || 0,
        occupancy: Math.round(occRate),
        revenue: totalRev,
        paidAmount,
        unpaidAmount,
        collectedInvoices,
        pending: invPending.count || 0,
        maintenance: maintenanceUnits
      });

      // 2. Fetch Properties list with Occupancy
      let listQ = supabase.from('re_properties').select('id, name, re_units(id, status, rent_amount, bedrooms)').limit(5).abortSignal(controller.signal);
      if (companyId) listQ = listQ.eq('company_id', companyId);
      const { data: propList } = await listQ;

      if (controller.signal.aborted) return;

      const processedProps = (propList || []).map(p => {
        const pUnits = (p.re_units as any[]) || [];
        const pOccupied = pUnits.filter((u: any) => u.status === 'occupied').length;
        const pRevenue = pUnits.reduce((acc: number, curr: any) => acc + (curr.rent_amount || 0), 0);
        const pBedrooms = pUnits.reduce((acc: number, curr: any) => acc + (curr.bedrooms || 0), 0);
        return {
          id: p.id,
          name: p.name,
          units: pUnits.length,
          bedrooms: pBedrooms,
          occupancy: pUnits.length > 0 ? Math.round((pOccupied / pUnits.length) * 100) : 0,
          revenue: (pRevenue / 1000).toFixed(1) + 'k',
        };
      });
      setProperties(processedProps);

      // 3. Recent Payments — from re_invoices (paid/partial)
      let recentPayQ = supabase
        .from('re_invoices')
        .select('id, amount_due, amount_paid, due_date, status, invoice_number, created_at, unit_id')
        .in('status', ['paid', 'partial'])
        .order('created_at', { ascending: false })
        .limit(5)
        .abortSignal(controller.signal);
      if (companyId) recentPayQ = recentPayQ.eq('company_id', companyId);
      const { data: recentPays } = await recentPayQ;
      
      if (controller.signal.aborted) return;

      // If invoices are empty, try re_payments for recent history
      if (!recentPays || recentPays.length === 0) {
        let altPayQ = supabase
          .from('re_payments')
          .select('id, amount, payment_date, status, reference_number, created_at, unit_id')
          .order('created_at', { ascending: false })
          .limit(5)
          .abortSignal(controller.signal);
        if (companyId) altPayQ = altPayQ.eq('company_id', companyId);
        const { data: altPays } = await altPayQ;
        setRecentPayments((altPays || []).map((p: any) => ({
          ...p,
          amount_paid: p.amount,
          invoice_number: p.reference_number
        })));
      } else {
        setRecentPayments(recentPays);
      }

      // 4. Monthly Revenue Chart Data
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);

      let trendQ = supabase
        .from('re_invoices')
        .select('amount_paid, created_at')
        .in('status', ['paid', 'partial'])
        .gte('created_at', sixMonthsAgo.toISOString())
        .order('created_at', { ascending: true })
        .abortSignal(controller.signal);
      if (companyId) trendQ = trendQ.eq('company_id', companyId);
      const { data: trendData } = await trendQ;

      if (controller.signal.aborted) return;

      const monthlyAgg: { [key: string]: number } = {};
      const last6Months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        return d.toLocaleString('default', { month: 'short' });
      });

      last6Months.forEach(m => monthlyAgg[m] = 0);
      (trendData || []).forEach((p: any) => {
        const m = new Date(p.created_at).toLocaleString('default', { month: 'short' });
        if (monthlyAgg[m] !== undefined) {
          monthlyAgg[m] += (p.amount_paid || 0);
        }
      });

      setChartData(last6Months.map(m => ({ name: m, revenue: monthlyAgg[m] })));

      // 5. Real Maintenance Tasks
      setTasks((maintTasks.data || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        priority: t.priority || 'medium',
        dueDate: t.scheduled_date ? new Date(t.scheduled_date).toLocaleDateString() : 'Not set',
        status: t.status,
        unit: t.unit?.unit_number
      })));

    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error('Error fetching dashboard data:', error);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (profile?.id) {
      fetchData();
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [profile?.id]);

  if (loading) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-purple"></div>
      </div>
    );
  }

  if (workspaceStatus === 'empty' || metrics.properties === 0) {
    return (
      <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
          <div className="rounded-[28px] border border-emerald-200 bg-white shadow-sm dark:border-emerald-500/20 dark:bg-dark-surface">
            <div className="grid gap-0 lg:grid-cols-[1.3fr_0.9fr]">
              <div className="p-6 sm:p-8 lg:p-10">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-600">
                  Empty workspace
                </p>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-gray-900 dark:text-white sm:text-4xl">
                  {workspaceLabel} is ready, but it has no properties yet.
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600 dark:text-gray-300">
                  This is your private renter workspace. Your properties, units, tenants, invoices,
                  and payments will live under your own company scope, separate from the parent
                  company. Start by creating your first property, then add units and tenants.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    onClick={() => navigate('/app/real-estate/properties')}
                    className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-700"
                  >
                    <Building2 size={18} className="mr-2" />
                    Create your first property
                  </button>
                  <button
                    onClick={() => navigate('/app/real-estate/units')}
                    className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-5 py-3.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                  >
                    Add units next
                  </button>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  {[
                    { label: 'Properties', value: '0', hint: 'Create the first location' },
                    { label: 'Units', value: '0', hint: 'Attach rooms or shops' },
                    { label: 'Tenants', value: '0', hint: 'Invite residents later' },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                        {item.label}
                      </p>
                      <p className="mt-2 text-3xl font-black text-gray-900 dark:text-white">{item.value}</p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{item.hint}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-6 sm:p-8 lg:border-l lg:border-t-0 dark:border-white/10 dark:from-emerald-500/10 dark:via-white/5 dark:to-sky-500/10">
                <div className="rounded-[24px] border border-white/60 bg-white/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-[#0b2a3c]/70">
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-600">
                    What happens next
                  </p>
                  <div className="mt-5 space-y-4">
                    {[
                      'Create a property and capture the physical location.',
                      'Add units, room types, and rent amounts.',
                      'Add tenants and start invoicing from your own workspace.',
                    ].map((step, index) => (
                      <div key={step} className="flex items-start gap-3">
                        <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-black text-white">
                          {index + 1}
                        </div>
                        <p className="pt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const metricItems = [
    { title: "Properties", value: metrics.properties.toString(), icon: Building2, color: "blue" },
    { title: "Units", value: metrics.units.toString(), icon: Home, color: "indigo" },
    { title: "Tenants", value: metrics.tenants.toString(), icon: Users, color: "green" },
    { title: "Occupancy", value: `${metrics.occupancy}%`, icon: TrendingUp, color: "violet" },
    { title: "Paid Invoices", value: `Ksh ${(metrics.paidAmount/1000000).toFixed(1)}M`, icon: CheckCircle, color: "emerald" },
    { title: "Unpaid Invoices", value: `Ksh ${(metrics.unpaidAmount/1000000).toFixed(1)}M`, icon: AlertTriangle, color: "orange" },
    { title: "Pending", value: metrics.pending.toString(), icon: AlertTriangle, color: "orange" },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-7 2xl:px-8 py-6 lg:py-7 2xl:py-8">
        
        {/* Header */}
        <div className="mb-6 lg:mb-7 2xl:mb-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">Real Estate Hub</h1>
            <p className="text-gray-500 dark:text-gray-400">Manage properties, tenants, and finances</p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Occupied units reflect tenancy status. Paid and unpaid invoices reflect billing status, including manually entered historical payments.</p>
            <ul className="mt-3 space-y-1 text-sm text-gray-500 dark:text-gray-400">
              <li><span className="font-semibold text-gray-700 dark:text-gray-200">Occupied</span> = tenancy status</li>
              <li><span className="font-semibold text-gray-700 dark:text-gray-200">Paid</span> = invoice/payment status</li>
              <li><span className="font-semibold text-gray-700 dark:text-gray-200">Unpaid</span> = outstanding invoice balance</li>
            </ul>
          </div>
          <div className="flex flex-wrap gap-3 xl:justify-end">
            <button
              onClick={() => navigate('/app/real-estate/reports/statement-of-rent')}
              title="Generate and view real estate reports"
              className="px-4 py-2 bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex-1 sm:flex-none"
            >
              <BarChart3 size={18} className="inline mr-2" />
              Reports
            </button>
            <button 
              onClick={() => navigate('/app/real-estate/properties')} 
              title="Navigate to add a new property"
              className="px-4 py-2 bg-brand-purple text-white rounded-lg font-medium hover:bg-brand-pink transition-colors flex-1 sm:flex-none"
            >
              <Building2 size={18} className="inline mr-2" />
              Add Property
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-3 lg:gap-4 mb-6 lg:mb-7 2xl:mb-8">
          {metricItems.map((metric, idx) => {
            const Icon = metric.icon;
            const colorMap: any = {
              blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
              indigo: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
              green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
              violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
              emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
              orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
            };

            return (
              <div key={idx} className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-3 lg:p-4 hover:shadow-md transition-shadow min-w-0">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg ${colorMap[metric.color]}`}>
                    <Icon size={20} />
                  </div>
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-xs font-medium mb-1">{metric.title}</p>
                <p className="text-xl lg:text-2xl font-bold text-gray-900 dark:text-white break-words">{metric.value}</p>
              </div>
            );
          })}
        </div>

        {/* Split Section */}
        <div className="mb-8 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm dark:border-emerald-500/20 dark:bg-dark-surface">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-600">Split</p>
              <h2 className="mt-2 text-2xl font-black text-gray-900 dark:text-white">Rent split and payout tools</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                Keep this focused on split preview, payout settings, and job history. The heavy M-Pesa test sandbox stays out of the admin console.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/app/real-estate/split-management')}
                className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700"
              >
                Open split page
              </button>
              <button
                onClick={() => navigate('/app/real-estate/split-management')}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
              >
                Split management
              </button>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <MiniCard title="Split preview" desc="Check company revenue versus landlord payable before posting a payment." action="Preview split" onClick={() => navigate('/app/real-estate/split-management')} />
            <MiniCard title="Payout queue" desc="Review queued jobs, retries, and delivery status." action="View queue" onClick={() => navigate('/app/real-estate/split-management/queue')} />
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6 mb-8">
          
          {/* Properties Overview */}
          <div className="xl:col-span-2 2xl:col-span-2 bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden min-w-0">
            <div className="px-5 lg:px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                <Building2 size={20} className="mr-2 text-brand-purple" />
                Properties
              </h2>
              <button 
                onClick={() => navigate('/app/real-estate/properties')}
                title="View full list of properties"
                className="text-sm font-medium text-brand-purple hover:text-brand-pink transition-colors flex items-center"
              >
                View All <ChevronRight size={16} className="ml-1" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest font-black">Property</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest font-black">Units</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest font-black">Rooms</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest font-black">Occupancy</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest font-black">Rent Roll</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {properties.map((prop) => (
                    <tr key={prop.id} onClick={() => navigate(`/app/real-estate/properties/${prop.id}`)} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer">
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{prop.name}</td>
                      <td className="px-6 py-4 text-center text-gray-600 dark:text-gray-300 font-bold">{prop.units}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500 dark:text-gray-400 font-bold">
                        <span className="inline-flex items-center gap-1">
                          <Home size={10} className="text-brand-purple/40" />
                          {prop.bedrooms}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-12 h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className={`dynamic-width-bar ${prop.occupancy > 90 ? 'bg-emerald-500' : 'bg-orange-500'}`} 
                              style={{ '--bar-width': `${prop.occupancy}%` } as React.CSSProperties}
                            ></div>
                          </div>
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-300 w-8">{prop.occupancy}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-white">Ksh {prop.revenue}</td>
                    </tr>
                  ))}
                  {properties.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No properties found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="space-y-6 min-w-0">
            {/* Occupancy Card */}
            <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-6">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <Home size={18} className="mr-2 text-brand-purple" />
                Occupancy Status
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Occupied</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {Math.round((metrics.occupancy / 100) * metrics.units)}/{metrics.units}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="dynamic-width-bar bg-emerald-500" 
                      style={{ '--bar-width': `${metrics.occupancy}%` } as React.CSSProperties}
                    ></div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 pt-2">
                  <p>Vacant: {metrics.units - Math.round((metrics.occupancy / 100) * metrics.units) - metrics.maintenance} units</p>
                  <p>Maintenance: {metrics.maintenance} units</p>
                </div>
              </div>
            </div>

            {/* Revenue Card */}
            <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 p-6">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                <DollarSign size={18} className="mr-2 text-brand-purple" />
                Total Revenue
              </h3>
              <div className="space-y-2">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">Ksh {metrics.revenue.toLocaleString()}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center">
                  <ArrowUpRight size={12} className="mr-1" /> All time collection
                </p>
                <div className="pt-3 border-t border-gray-200 dark:border-white/10">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Collected Invoices: {metrics.collectedInvoices}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Outstanding Invoice Balance: Ksh {metrics.unpaidAmount.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Manual payments already entered are included in the paid invoice total.</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Pending Invoices: {metrics.pending}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6 mb-8">
          
          {/* Revenue Chart */}
          <div className="xl:col-span-2 2xl:col-span-2 bg-white dark:bg-dark-surface p-6 rounded-xl shadow-sm border border-gray-200 dark:border-white/10 min-w-0">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                <TrendingUp size={20} className="mr-2 text-brand-purple" />
                Revenue Trends
              </h3>
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <span className="flex items-center"><div className="w-3 h-3 bg-brand-purple rounded-full mr-1.5"></div> Revenue</span>
              </div>
            </div>
            <div className="h-[280px] w-full min-h-[280px]">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#9ca3af', fontSize: 12}} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#9ca3af', fontSize: 12}}
                    tickFormatter={(value) => `${value/1000}k`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#8b5cf6" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorRev)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Tasks/Actions */}
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-white/10 overflow-hidden min-w-0">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                <Clock size={20} className="mr-2 text-brand-purple" />
                Pending Actions
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-white/10">
              {tasks.map((task) => (
                <div key={task.id} onClick={() => navigate('/app/real-estate/maintenance')} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">{task.title}</h4>
                      {task.unit && <p className="text-[10px] text-brand-purple font-bold uppercase mt-0.5">Unit {task.unit}</p>}
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded capitalize ${
                      task.priority === 'high' || task.priority === 'emergency' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                      task.priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                      'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    }`}>
                      {task.priority}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Due: {task.dueDate}</p>
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{task.status.replace('_', ' ')}</span>
                  </div>
                </div>
              ))}
              {tasks.length === 0 && (
                <div className="px-6 py-8 text-center text-gray-500 text-sm italic">No pending maintenance tasks.</div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Table Grid */}
          <div className="grid grid-cols-1 gap-6 pb-8 min-w-0">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                <DollarSign size={20} className="mr-2 text-brand-purple" />
                Recent Payments
              </h2>
              <button 
                onClick={() => navigate('/app/real-estate/payments/mpesa')}
                title="View full financial payment history"
                className="text-sm font-medium text-brand-purple hover:text-brand-pink transition-colors"
              >
                View All
              </button>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-white/10">
              {recentPayments.map((payment: any) => (
                <div key={payment.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{payment.invoice_number || 'Invoice'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(payment.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">Ksh {(payment.amount_paid || 0).toLocaleString()}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">of Ksh {(payment.amount_due || 0).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium px-2 py-1 rounded capitalize ${
                      payment.status === 'paid' ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' :
                      'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                    }`}>
                      {payment.status}
                    </span>
                  </div>
                </div>
              ))}
              {recentPayments.length === 0 && (
                <div className="px-6 py-8 text-center text-gray-500 text-sm">No recent payments recorded.</div>
              )}
            </div>
          </div>
        </div>
      </div>
  );
}

function MiniCard({
  title,
  desc,
  action,
  onClick,
}: {
  title: string;
  desc: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border border-gray-200 bg-slate-50 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
    >
      <p className="text-lg font-black text-gray-900 dark:text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{desc}</p>
      <p className="mt-4 text-xs font-black uppercase tracking-[0.24em] text-emerald-600">{action}</p>
    </button>
  );
}
