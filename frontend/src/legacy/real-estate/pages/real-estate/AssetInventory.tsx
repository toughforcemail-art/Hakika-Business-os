// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Package, Search, User, CalendarClock, ShieldCheck, Clock3, Building2 } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';

type AssetRow = {
  id: string;
  name: string;
  type: string;
  serial_number: string;
  status: string | null;
  condition: string | null;
  created_at: string;
};

type AssignmentRow = {
  id: string;
  asset_id: string;
  assigned_at: string;
  returned_at: string | null;
  assigned_by?: { full_name?: string | null; email?: string | null } | null;
  employee?: { full_name?: string | null; email?: string | null } | null;
};

// Format datetime in local timezone (East Africa Time - EAT, UTC+3)
const formatDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    // Format: MM/DD/YY, HH:MM:SS AM/PM in local timezone
    return date.toLocaleString('en-US', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Africa/Nairobi' // East Africa Time
    });
  } catch (error) {
    return '-';
  }
};

export default function AssetInventory() {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [assignments, setAssignments] = useState<Record<string, AssignmentRow>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'available' | 'assigned' | 'maintenance' | 'disposed'>('all');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: assetData, error: assetError }, { data: assignData, error: assignError }] = await Promise.all([
          supabase.from('re_assets').select('id, name, type, serial_number, status, condition, created_at').order('created_at', { ascending: false }),
          supabase
            .from('re_asset_assignments')
            .select('id, asset_id, assigned_at, returned_at, assigned_by:profiles!re_asset_assignments_assigned_by_fkey(full_name, email), employee:profiles!re_asset_assignments_employee_id_fkey(full_name, email)')
            .order('assigned_at', { ascending: false })
        ]);
        if (assetError) throw assetError;
        if (assignError) throw assignError;
        setAssets(assetData || []);
        const latest = (assignData || []).reduce<Record<string, AssignmentRow>>((acc, row: any) => {
          if (!acc[row.asset_id]) acc[row.asset_id] = row;
          return acc;
        }, {});
        setAssignments(latest);
      } catch (err: any) {
        console.error(err);
        setToast({ message: err?.message || 'Failed to load assets', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const filtered = useMemo(() => assets.filter((asset) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || [asset.name, asset.type, asset.serial_number].join(' ').toLowerCase().includes(q);
    const matchesStatus = status === 'all' || asset.status === status;
    return matchesSearch && matchesStatus;
  }), [assets, search, status]);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><CustomLoader size={40} label="Loading assets..." /></div>;

  return (
    <div className="min-h-full w-full bg-gray-50 p-6 text-gray-900 dark:bg-[#061622] dark:text-white lg:p-10">
      {toast && <CustomToast isVisible={!!toast} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-slate-500 dark:text-slate-400">
              <Link to="/app/real-estate/dashboard" className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-[#ff6a00]/40 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                <ArrowLeft size={14} /> Back to Home
              </Link>
            </div>
            <h1 className="flex items-center gap-3 text-3xl font-black text-gray-900 dark:text-white">
              <Package className="text-[#ff6a00]" /> Asset Management
            </h1>
            <p className="mt-1 text-slate-600 dark:text-slate-300">View every asset, who currently has it, who allocated it, and when it was allocated.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/5">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Total Assets</div>
              <div className="text-2xl font-black text-gray-900 dark:text-white">{assets.length}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/5">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Allocated</div>
              <div className="text-2xl font-black text-gray-900 dark:text-white">{assets.filter((a) => a.status === 'assigned').length}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/5">
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Available</div>
              <div className="text-2xl font-black text-gray-900 dark:text-white">{assets.filter((a) => a.status === 'available').length}</div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-4 text-slate-900 shadow-xl dark:border-white/10 dark:bg-[#0f1729] dark:text-white">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, type, or serial..." className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none focus:border-[#ff6a00]/40 focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-[#0A1628] dark:text-white" />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-[#ff6a00]/40 focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-[#0A1628] dark:text-white">
              <option value="all">All Statuses</option>
              <option value="available">Available</option>
              <option value="assigned">Assigned</option>
              <option value="maintenance">Maintenance</option>
              <option value="disposed">Disposed</option>
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#0f1729]">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-gray-200 bg-gray-50 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4">Asset</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Allocated To</th>
                  <th className="px-6 py-4">Allocated By</th>
                  <th className="px-6 py-4">Allocated At</th>
                  <th className="px-6 py-4">Serial</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((asset) => {
                  const latest = assignments[asset.id];
                  return (
                    <tr key={asset.id} className="border-b border-gray-100 last:border-b-0 hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/5">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 dark:text-white">{asset.name}</div>
                        <div className="text-xs text-slate-500">{asset.type}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-[#ff6a00]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#ff6a00]">
                          {asset.status || 'unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">
                        {latest?.employee?.full_name || latest?.employee?.email || 'Not allocated'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">
                        {latest?.assigned_by?.full_name || latest?.assigned_by?.email || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">
                        {formatDateTime(latest?.assigned_at)}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-700 dark:text-slate-200">{asset.serial_number}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="px-6 py-16 text-center text-slate-500 dark:text-slate-400">No assets match your filters.</div>
          )}
        </div>
      </div>
    </div>
  );
}
