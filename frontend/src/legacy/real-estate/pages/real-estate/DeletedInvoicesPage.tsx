// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';

type DeletedInvoice = {
  id: string;
  invoice_number: string | null;
  invoice_type: string | null;
  tenant_id: string | null;
  unit_id: string | null;
  amount_due: number | null;
  invoice_date: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  tenant?: { full_name?: string | null } | null;
  unit?: { unit_number?: string | null; property?: { name?: string | null } | null } | null;
};

export default function DeletedInvoicesPage() {
  const navigate = useNavigate();
  const { profile } = useAccess();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<DeletedInvoice[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [invRes, tenRes, unitRes, propRes] = await Promise.all([
        supabase.from('re_invoices').select('id, invoice_number, invoice_type, tenant_id, unit_id, amount_due, invoice_date, deleted_at, deleted_by').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
        supabase.from('re_tenants').select('id, full_name'),
        supabase.from('re_units').select('id, unit_number, property_id'),
        supabase.from('re_properties').select('id, name'),
      ]);
      if (invRes.error) throw invRes.error;
      const tenants = tenRes.data || [];
      const units = unitRes.data || [];
      const properties = propRes.data || [];
      setRows((invRes.data || []).map((invoice: any) => {
        const tenant = tenants.find((t: any) => t.id === invoice.tenant_id) || null;
        const unit = units.find((u: any) => u.id === invoice.unit_id) || null;
        const property = properties.find((p: any) => p.id === unit?.property_id) || null;
        return { ...invoice, tenant, unit: unit ? { ...unit, property } : null };
      }));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (profile) void load(); }, [profile]);

  const filtered = useMemo(() => rows.filter((row) => {
    const haystack = [row.invoice_number, row.invoice_type, row.tenant?.full_name, row.unit?.unit_number, row.unit?.property?.name].join(' ').toLowerCase();
    return haystack.includes(search.toLowerCase());
  }), [rows, search]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => navigate('/app/real-estate/invoice/list')} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-white/10">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white">Deleted Invoices</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Soft-deleted invoices are shown here and can be reviewed before permanent cleanup.</p>
          </div>
        </div>

        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search deleted invoices..." className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 dark:border-white/10 dark:bg-dark-surface" />
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-dark-surface">
          {loading ? (
            <div className="py-16 flex justify-center"><CustomLoader label="Loading deleted invoices..." /></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-500">No deleted invoices found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-500 dark:bg-white/5 dark:text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Invoice #</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Tenant / Unit</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Deleted At</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {filtered.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="px-4 py-3 font-mono">{invoice.invoice_number || invoice.id}</td>
                      <td className="px-4 py-3 capitalize">{invoice.invoice_type || '-'}</td>
                      <td className="px-4 py-3">
                        {invoice.tenant?.full_name || '-'} / Unit {invoice.unit?.unit_number || '-'} {invoice.unit?.property?.name ? `· ${invoice.unit.property.name}` : ''}
                      </td>
                      <td className="px-4 py-3">Ksh {Number(invoice.amount_due || 0).toLocaleString()}</td>
                      <td className="px-4 py-3">{invoice.deleted_at ? new Date(invoice.deleted_at).toLocaleString() : '-'}</td>
                      <td className="px-4 py-3 text-right text-rose-600">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold dark:bg-rose-500/10">
                          <Trash2 size={14} /> Deleted
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
