// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { 
  ShieldAlert, 
  TrendingUp, 
  MapPin, 
  AlertTriangle,
  CheckCircle2,
  Filter,
  Calendar,
  ChevronRight,
  Zap,
  Shield
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import CustomLoader from '../../components/CustomLoader';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444', // red-500
  high: '#f97316',     // orange-500
  medium: '#f59e0b',   // amber-500
  low: '#3b82f6'       // blue-500
};

export default function IncidentAnalytics() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({
    total: 0,
    resolved: 0,
    critical: 0,
    avgResolutionTime: '2.4 days' // Mock
  });

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('security_incidents')
        .select('*, security_sites(name)');
      
      if (error) throw error;
      setIncidents(data || []);

      // Calculate stats
      const total = data?.length || 0;
      const resolved = data?.filter((i: any) => i.status === 'resolved' || i.status === 'closed').length || 0;
      const critical = data?.filter((i: any) => i.severity === 'critical').length || 0;

      setStats({
        total,
        resolved,
        critical,
        avgResolutionTime: '1.8 days'
      });
    } catch (error) {
       console.error("Analytics fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Chart Data Preparation
  const severityData = [
    { name: 'Critical', value: incidents.filter(i => i.severity === 'critical').length },
    { name: 'High', value: incidents.filter(i => i.severity === 'high').length },
    { name: 'Medium', value: incidents.filter(i => i.severity === 'medium').length },
    { name: 'Low', value: incidents.filter(i => i.severity === 'low').length },
  ].filter(d => d.value > 0);

  const siteData = Object.entries(
    incidents.reduce((acc: any, curr: any) => {
      const siteName = curr.security_sites?.name || 'Unknown';
      acc[siteName] = (acc[siteName] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, count]) => ({ name, count }))
   .sort((a: any, b: any) => b.count - a.count)
   .slice(0, 5);

  const trendData = [
    { name: 'Mon', count: 4 },
    { name: 'Tue', count: 7 },
    { name: 'Wed', count: 5 },
    { name: 'Thu', count: 9 },
    { name: 'Fri', count: 12 },
    { name: 'Sat', count: 6 },
    { name: 'Sun', count: 3 },
  ]; // Mock weekly trend

  if (loading) return <div className="flex-1 p-8 flex items-center justify-center"><CustomLoader size={40} label="Processing Intelligence..." /></div>;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <ShieldAlert className="text-brand-purple" size={32} />
              Incident Analytics & Intelligence
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Operational oversight of security breaches, response times, and site risk profiles.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white dark:bg-dark-surface px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 flex items-center gap-2 shadow-sm">
                <Calendar size={16} className="text-gray-400" />
                <span className="text-sm font-bold">Last 30 Days</span>
            </div>
            <button title="Apply filters to analytics data" className="p-2.5 bg-brand-purple text-white rounded-xl shadow-lg shadow-brand-purple/20">
                <Filter size={20} />
            </button>
          </div>
        </div>

        {/* Top Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { label: 'Total Incidents', value: stats.total, icon: ShieldAlert, color: 'text-brand-purple bg-brand-purple/10' },
            { label: 'Resolution Rate', value: `${stats.total > 0 ? Math.round((stats.resolved/stats.total)*100) : 0}%`, icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-500/10' },
            { label: 'Critical Breaches', value: stats.critical, icon: AlertTriangle, color: 'text-rose-500 bg-rose-500/10' },
            { label: 'Avg Tech Response', value: stats.avgResolutionTime, icon: Zap, color: 'text-blue-500 bg-blue-500/10' },
          ].map((stat, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white dark:bg-dark-surface p-6 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${stat.color}`}>
                <stat.icon size={24} />
              </div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</h3>
            </motion.div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Trend Chart */}
          <div className="bg-white dark:bg-dark-surface p-8 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm">
             <div className="flex items-center justify-between mb-8">
               <h3 className="text-lg font-bold flex items-center gap-2"><TrendingUp size={20} className="text-brand-purple"/> 7-Day Trend</h3>
               <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">+12% vs LW</span>
             </div>
             <div className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={trendData}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                   <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                   <YAxis fontSize={11} tickLine={false} axisLine={false} />
                   <Tooltip 
                     contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                   />
                   <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6' }} activeDot={{ r: 6 }} />
                 </LineChart>
               </ResponsiveContainer>
             </div>
          </div>

          {/* Severity Breakdown */}
          <div className="bg-white dark:bg-dark-surface p-8 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-8"><Shield size={20} className="text-brand-purple"/> Severity Distribution</h3>
            <div className="h-[300px] w-full flex items-center">
               <ResponsiveContainer width="50%" height="100%">
                 <PieChart>
                    <Pie
                      data={severityData}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {severityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={SEVERITY_COLORS[entry.name.toLowerCase()]} />
                      ))}
                    </Pie>
                 </PieChart>
               </ResponsiveContainer>
               <div className="w-1/2 space-y-4 pr-4">
                  {severityData.map((d, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                       <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[d.name.toLowerCase()] }}></div>
                          <span className="font-bold text-gray-500">{d.name}</span>
                       </div>
                       <span className="font-black text-gray-900 dark:text-white">{d.value}</span>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        </div>

        {/* Bottom Row: Site Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 bg-white dark:bg-dark-surface p-8 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-8"><MapPin size={20} className="text-brand-purple"/> Incidents by Operating Site</h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={siteData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" width={100} fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px' }} />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
           </div>

           <div className="bg-white dark:bg-dark-surface p-8 rounded-3xl border border-gray-200 dark:border-white/10 shadow-sm flex flex-col">
              <h3 className="text-lg font-bold mb-6">Recent Alerts</h3>
              <div className="space-y-4 flex-1">
                 {incidents.slice(0, 4).map((inc, i) => (
                   <div key={i} className="flex gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-transparent hover:border-brand-purple/20 transition-all cursor-pointer">
                      <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${inc.severity === 'critical' ? 'bg-rose-100 text-rose-600' : 'bg-brand-purple/10 text-brand-purple'}`}>
                         <AlertTriangle size={20} />
                      </div>
                      <div className="min-w-0">
                         <p className="text-sm font-bold truncate">{inc.type}</p>
                         <p className="text-xs text-gray-500 truncate">{inc.security_sites?.name}</p>
                      </div>
                      <div className="ml-auto">
                        <ChevronRight size={16} className="text-gray-300" />
                      </div>
                   </div>
                 ))}
              </div>
              <button className="w-full py-3 mt-6 text-xs font-black uppercase tracking-widest text-brand-purple bg-brand-purple/10 rounded-2xl hover:bg-brand-purple hover:text-white transition-all">View All Entries</button>
           </div>
        </div>

      </div>
    </div>
  );
}
