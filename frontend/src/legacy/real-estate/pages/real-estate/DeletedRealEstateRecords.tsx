// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Search, Trash2, RotateCcw, Hammer } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import CustomLoader from '../../components/CustomLoader';

type ArchiveEvent = {
  id: string;
  table_name: string;
  record_id: string | null;
  record_data: Record<string, any>;
  action: string;
  actor_name: string | null;
  actor_email: string | null;
  archived_at: string;
};

const labels: Record<string, { title: string; table: string; hint: string }> = {
  properties: { title: 'Deleted Properties', table: 're_properties', hint: 'Properties removed from the active directory' },
  caretakers: { title: 'Deleted Caretakers', table: 're_personnel', hint: 'Caretakers archived from personnel' },
  landlords: { title: 'Deleted Landlords', table: 're_personnel', hint: 'Landlords archived from personnel' },
  tenants: { title: 'Deleted Tenants', table: 're_tenants', hint: 'Tenants archived from the active directory' },
};

export default function DeletedRealEstateRecords() {
  const navigate = useNavigate();
  const { kind = 'properties' } = useParams();
  const meta = labels[kind] || labels.properties;
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ArchiveEvent[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [kind]);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('archive_events')
        .select('id, table_name, record_id, record_data, action, actor_name, actor_email, archived_at')
        .eq('table_name', meta.table)
        .order('archived_at', { ascending: false });
      if (error) throw error;
      setRows((data || []) as ArchiveEvent[]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => rows.filter((row) => {
    const haystack = [row.record_id, row.actor_name, row.actor_email, JSON.stringify(row.record_data || {})].join(' ').toLowerCase();
    return haystack.includes(search.toLowerCase());
  }), [rows, search]);

  const restoreRow = async (row: ArchiveEvent) => {
    if (!row.record_id) return;
    setRestoringId(row.id);
    try {
      const { error } = await supabase.rpc('restore_record', { p_table_name: meta.table, p_record_id: row.record_id });
      if (error) throw error;
      await load();
    } finally {
      setRestoringId(null);
    }
  };

  const hardDeleteRow = async (row: ArchiveEvent) => {
    if (!row.record_id) return;
    const confirmed = window.confirm('Permanently delete this archived record? This cannot be undone.');
    if (!confirmed) return;
    setRestoringId(row.id);
    try {
      const { error } = await supabase.from(meta.table).delete().eq('id', row.record_id);
      if (error) throw error;
      const { error: archiveError } = await supabase.from('archive_events').delete().eq('id', row.id);
      if (archiveError) throw archiveError;
      await load();
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#020817] p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/app/real-estate/dashboard')} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-[#1e293b]">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{meta.title}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">{meta.hint}. Deleted by user and timestamp are shown below.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#1e293b] dark:bg-[#0f172a]">
          <div className="relative mb-4">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search deleted records..." className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm dark:border-[#1e293b] dark:bg-[#0A1628]" />
          </div>
          {loading ? <div className="py-12 text-center"><CustomLoader label="Loading deleted records..." /></div> : filtered.length === 0 ? (
            <div className="py-12 text-center text-gray-500">No deleted records found.</div>
          ) : (
            <div className="space-y-3">
              {filtered.map((row) => {
                const name = row.record_data?.name || row.record_data?.full_name || row.record_data?.property_name || row.record_id;
                const idNumber = row.record_data?.id_number || row.record_data?.national_id || row.record_data?.idNo || null;
                return (
                  <div key={row.id} className="rounded-2xl border border-gray-200 p-4 dark:border-[#1e293b]">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Trash2 size={16} className="text-rose-500" />
                          <p className="font-semibold text-gray-900 dark:text-white">{name || 'Deleted record'}</p>
                        </div>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Deleted by {row.actor_name || row.actor_email || 'System'} on {new Date(row.archived_at).toLocaleString()}</p>
                        {idNumber && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">ID Number: {idNumber}</p>}
                        <p className="mt-1 text-xs text-gray-500">Record ID: {row.record_id || 'N/A'}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void restoreRow(row)}
                          disabled={restoringId === row.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <RotateCcw size={16} /> {restoringId === row.id ? 'Restoring...' : 'Restore'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void hardDeleteRow(row)}
                          disabled={restoringId === row.id}
                          className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                        >
                          <Hammer size={16} /> Delete permanently
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
