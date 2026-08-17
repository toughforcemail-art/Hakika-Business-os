// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { PlusCircle, Edit3, Trash2, BadgeInfo } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';

type InvoiceTypeRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

const EMPTY_FORM = { name: '', slug: '', description: '', sort_order: '0', is_active: true };
const DEFAULT_TYPES: InvoiceTypeRow[] = [
  { id: 'default-rent', name: 'Rent', slug: 'rent', description: 'Monthly rent invoice', is_active: true, sort_order: 1 },
  { id: 'default-water', name: 'Water', slug: 'water', description: 'Water billing invoice', is_active: true, sort_order: 2 },
  { id: 'default-electricity', name: 'Electricity', slug: 'electricity', description: 'Electricity billing invoice', is_active: true, sort_order: 3 },
  { id: 'default-garbage', name: 'Garbage', slug: 'garbage', description: 'Garbage collection invoice', is_active: true, sort_order: 4 },
  { id: 'default-internet', name: 'Internet', slug: 'internet', description: 'Internet service invoice', is_active: true, sort_order: 5 },
  { id: 'default-penalty', name: 'Penalty', slug: 'penalty', description: 'Penalty or fine invoice', is_active: true, sort_order: 6 },
  { id: 'default-other', name: 'Other', slug: 'other', description: 'Miscellaneous invoice', is_active: true, sort_order: 7 },
];

export default function InvoiceTypesPage() {
  const { profile } = useAccess();
  const [rows, setRows] = useState<InvoiceTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('re_invoice_types')
      .select('id, name, slug, description, is_active, sort_order')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) {
      setToast({ message: error.message, type: 'error' });
      setRows([]);
    } else {
      setRows(((data && data.length > 0 ? data : DEFAULT_TYPES) || []) as InvoiceTypeRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (profile) fetchRows();
  }, [profile]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile?.company_id) {
      setToast({ message: 'Company context is missing.', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        company_id: profile.company_id,
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase(),
        description: form.description.trim() || null,
        sort_order: Number(form.sort_order || 0),
        is_active: form.is_active,
      };
      if (!payload.name || !payload.slug) {
        throw new Error('Name and slug are required.');
      }
      const query = editingId && !editingId.startsWith('default-')
        ? supabase.from('re_invoice_types').update(payload).eq('id', editingId)
        : supabase.from('re_invoice_types').insert(payload);
      const { error } = await query;
      if (error) throw error;
      setToast({ message: editingId ? 'Invoice type updated.' : 'Invoice type added.', type: 'success' });
      resetForm();
      fetchRows();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to save invoice type', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (row: InvoiceTypeRow) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      slug: row.slug,
      description: row.description || '',
      sort_order: String(row.sort_order ?? 0),
      is_active: row.is_active,
    });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this invoice type?')) return;
    if (id.startsWith('default-')) {
      setToast({ message: 'Default invoice types cannot be deleted.', type: 'warning' });
      return;
    }
    const { error } = await supabase.from('re_invoice_types').delete().eq('id', id);
    if (error) {
      setToast({ message: error.message, type: 'error' });
      return;
    }
    setToast({ message: 'Invoice type deleted.', type: 'success' });
    if (editingId === id) resetForm();
    fetchRows();
  };

  const activeCount = useMemo(() => rows.filter((row) => row.is_active).length, [rows]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="rounded-3xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-brand-purple">
                <BadgeInfo size={14} /> Invoice Type Setup
              </p>
              <h1 className="mt-2 text-3xl font-black text-gray-900 dark:text-white">Add Invoice Type</h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Manage the invoice type catalog used across rent, water, electricity, penalties, and other charges.
              </p>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Active types: <span className="font-semibold text-gray-900 dark:text-white">{activeCount}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
          <form onSubmit={handleSubmit} className="rounded-3xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{editingId ? 'Edit Type' : 'New Type'}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Add, edit, or retire invoice types from one place.</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} className="w-full rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-black/20 px-4 py-2.5 outline-none" placeholder="Water" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Slug</label>
              <input value={form.slug} onChange={(e) => setForm((current) => ({ ...current, slug: e.target.value }))} className="w-full rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-black/20 px-4 py-2.5 outline-none" placeholder="water" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} className="w-full min-h-[96px] rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-black/20 px-4 py-2.5 outline-none" placeholder="Water billing invoice" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Sort Order</label>
                <input type="number" value={form.sort_order} onChange={(e) => setForm((current) => ({ ...current, sort_order: e.target.value }))} className="w-full rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-black/20 px-4 py-2.5 outline-none" />
              </div>
              <label className="flex items-center gap-3 self-end rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-black/20 px-4 py-3 text-sm text-gray-700 dark:text-gray-200">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((current) => ({ ...current, is_active: e.target.checked }))} />
                Active
              </label>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-brand-purple px-4 py-2.5 font-semibold text-white hover:bg-brand-pink disabled:opacity-50">
                <PlusCircle size={18} />
                {saving ? 'Saving...' : editingId ? 'Update Type' : 'Save Type'}
              </button>
              {editingId ? (
                <button type="button" onClick={resetForm} className="rounded-xl border border-gray-300 dark:border-white/10 px-4 py-2.5 font-semibold text-gray-700 dark:text-gray-200">
                  Cancel
                </button>
              ) : null}
            </div>
          </form>

          <div className="rounded-3xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-white/10 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Existing Types</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Edit or delete the type catalog used by invoice creation.</p>
              </div>
            </div>

            {loading ? (
              <div className="py-16 flex justify-center"><CustomLoader size={28} label="Loading types..." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="py-3 pr-4">Name</th>
                      <th className="py-3 pr-4">Slug</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4">Order</th>
                      <th className="py-3 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td className="py-3 pr-4">
                          <div className="font-semibold text-gray-900 dark:text-white">{row.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{row.description || '-'}</div>
                        </td>
                        <td className="py-3 pr-4 font-mono text-xs text-gray-600 dark:text-gray-300">{row.slug}</td>
                        <td className="py-3 pr-4">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.is_active ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400'}`}>
                            {row.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">{row.sort_order}</td>
                        <td className="py-3 pr-4">
                          <div className="flex gap-2">
                            <button type="button" onClick={() => handleEdit(row)} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">
                              <Edit3 size={14} /> Edit
                            </button>
                            <button type="button" onClick={() => handleDelete(row.id)} disabled={row.id.startsWith('default-')} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 disabled:opacity-50">
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 ? (
                      <tr><td colSpan={5} className="py-10 text-center text-gray-500 dark:text-gray-400">No invoice types found.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
      {toast ? <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
