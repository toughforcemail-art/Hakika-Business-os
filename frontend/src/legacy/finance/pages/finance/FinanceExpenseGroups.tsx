// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Edit3, Plus, RefreshCcw, Search, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { useAccess } from '../../hooks/useAccess';
import { resolveOrganizationScope } from '../../utils/organizationScope';
import { supabase } from '../../utils/supabase';

interface ExpenseGroupRow {
  id: string;
  organization_id: string;
  group_name: string;
  created_at: string;
}

const panelCls = 'rounded-[28px] border border-gray-200 bg-white/95 p-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur-sm dark:border-white/10 dark:bg-dark-surface/90';
const inputCls = 'w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#ff6a00]/40 focus:bg-white focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-[#082131] dark:text-white dark:placeholder:text-slate-400 dark:focus:border-[#ff6a00]/40 dark:focus:bg-[#0b2a3c]';
const primaryButtonCls = 'inline-flex items-center justify-center gap-2 rounded-2xl bg-[#ff6a00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e85f00] disabled:cursor-not-allowed disabled:opacity-60';
const subtleButtonCls = 'inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:border-[#ff6a00]/40 dark:hover:bg-white/[0.06]';
const labelCls = 'mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400';

const normalizeText = (value?: string | null) => value?.trim().toLowerCase() || '';

const FinanceExpenseGroups: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAccess();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [workflowReady, setWorkflowReady] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [rows, setRows] = useState<ExpenseGroupRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const scope = await resolveOrganizationScope(profile);
      setOrganizationId(scope.organizationId);

      if (!scope.organizationId) {
        setWorkflowReady(false);
        setRows([]);
        return;
      }

      const { data, error } = await supabase
        .from('finance_expense_groups')
        .select('id, organization_id, group_name, created_at')
        .eq('organization_id', scope.organizationId)
        .order('group_name', { ascending: true });

      if (error) {
        if (error.message.includes('finance_expense_groups') || error.message.includes('does not exist')) {
          setWorkflowReady(false);
          setRows([]);
          return;
        }
        throw error;
      }

      setWorkflowReady(true);
      setRows((data || []) as ExpenseGroupRow[]);
    } catch (error: any) {
      console.error('Failed to load expense groups:', error);
      setToast({ message: error.message || 'Failed to load expense groups.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      void loadData();
    }
  }, [profile]);

  const filteredRows = useMemo(() => {
    const query = normalizeText(searchTerm);
    return rows.filter((row) => (query ? normalizeText(row.group_name).includes(query) : true));
  }, [rows, searchTerm]);

  const resetForm = () => {
    setGroupName('');
    setEditingId(null);
  };

  const openEdit = (row: ExpenseGroupRow) => {
    setEditingId(row.id);
    setGroupName(row.group_name);
  };

  const openEditFromRow = (row: ExpenseGroupRow) => {
    openEdit(row);
  };

  const saveRow = async () => {
    if (!organizationId) {
      setToast({ message: 'An organization is required before managing expense groups.', type: 'warning' });
      return;
    }

    if (!workflowReady) {
      setToast({ message: 'Apply the expense group migration before managing expense groups.', type: 'warning' });
      return;
    }

    const trimmed = groupName.trim();
    if (!trimmed) {
      setToast({ message: 'Expense group name is required.', type: 'warning' });
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('finance_expense_groups')
          .update({
            group_name: trimmed,
          })
          .eq('id', editingId);
        if (error) throw error;
        setToast({ message: 'Expense group updated successfully.', type: 'success' });
      } else {
        const { error } = await supabase
          .from('finance_expense_groups')
          .insert({
            organization_id: organizationId,
            group_name: trimmed,
            created_by: profile?.id || null,
          });
        if (error) throw error;
        setToast({ message: 'Expense group saved successfully.', type: 'success' });
      }

      resetForm();
      await loadData();
    } catch (error: any) {
      console.error('Failed to save expense group:', error);
      setToast({ message: error.message || 'Failed to save expense group.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (row: ExpenseGroupRow) => {
    const confirmed = window.confirm(`Delete expense group "${row.group_name}"?`);
    if (!confirmed) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('finance_expense_groups').delete().eq('id', row.id);
      if (error) throw error;
      setRows((current) => current.filter((entry) => entry.id !== row.id));
      if (editingId === row.id) resetForm();
      setToast({ message: 'Expense group deleted successfully.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to delete expense group:', error);
      setToast({ message: error.message || 'Failed to delete expense group.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <CustomLoader text="Loading expense groups..." />;
  }

  return (
    <div className="min-h-screen space-y-6 bg-[#f6f7fb] p-6 dark:bg-[#061723]">
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className={`${panelCls} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/app/finance/payments')}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
            title="Back to Finance Payments"
            aria-label="Back to Finance Payments"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Finance Setup</p>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Expense Groups</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Maintain reusable expense group labels for vouchers and reports.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void loadData()} className={subtleButtonCls}>
            <RefreshCcw size={16} />
            Refresh
          </button>
          <button type="button" onClick={resetForm} className={primaryButtonCls}>
            <Plus size={16} />
            New Group
          </button>
        </div>
      </div>

      <div className={panelCls}>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Expense Group Register</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Edit or delete expense groups used by the finance workflow.</p>
          </div>
          <div className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className={`${inputCls} pl-11`} placeholder="Search expense groups" />
          </div>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-gray-200 dark:border-white/10">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-white/[0.03]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Expense Group</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/10">
              {filteredRows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                  onClick={() => openEditFromRow(row)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openEditFromRow(row);
                    }
                  }}
                  aria-label={`Edit expense group ${row.group_name}`}
                >
                  <td className="px-4 py-4 text-sm font-semibold text-slate-900 dark:text-white">{row.group_name}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEdit(row);
                        }}
                        className={subtleButtonCls}
                      >
                        <Edit3 size={14} />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void deleteRow(row);
                        }}
                        className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200"
                        disabled={saving}
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    {rows.length === 0 ? 'No expense groups saved yet.' : 'No matching expense groups found.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className={panelCls}>
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">{editingId ? 'Edit Expense Group' : 'Add Expense Group'}</p>
        <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{editingId ? 'Update the selected expense group' : 'Create a new expense group'}</h2>
        <div className="mt-4 max-w-2xl">
          <label className={labelCls}>Expense Group Name</label>
          <input value={groupName} onChange={(event) => setGroupName(event.target.value)} className={inputCls} placeholder="Utilities" />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => void saveRow()} className={primaryButtonCls} disabled={saving}>
            <Plus size={16} />
            {editingId ? 'Update Expense Group' : 'Save Expense Group'}
          </button>
          <button type="button" onClick={resetForm} className={subtleButtonCls}>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinanceExpenseGroups;
