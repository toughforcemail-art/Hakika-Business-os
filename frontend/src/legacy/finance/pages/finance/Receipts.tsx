// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Download,
  Edit,
  Plus,
  Printer,
  Receipt,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { activityLogger } from '../../utils/activityLogger';
import { useAccess } from '../../hooks/useAccess';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { escapeHtml, printDocument } from '../../utils/printHelpers';

interface FinanceReceipt {
  id: string;
  receipt_number: string | null;
  receipt_date: string;
  source_module: string;
  amount: number;
  description: string | null;
  category: string | null;
  payment_method: string | null;
  organization_id: string;
  created_at: string;
}

interface ReceiptFormState {
  receipt_number: string;
  receipt_date: string;
  source_module: string;
  amount: string;
  description: string;
  category: string;
  payment_method: string;
}

const SOURCE_MODULE_OPTIONS = ['Finance', 'Real Estate', 'Security', 'HR', 'Administration', 'External'];
const PAYMENT_METHOD_OPTIONS = ['Cash', 'M-Pesa', 'Bank Transfer', 'Cheque', 'Card', 'Petty Cash'];
const CATEGORY_OPTIONS = ['Utilities', 'Maintenance', 'Operations', 'Travel', 'Supplies', 'Rent', 'Professional Services'];

const buildReceiptNumber = (date: string) =>
  `RCP-${date.replaceAll('-', '')}-${Date.now().toString().slice(-5)}`;

const emptyForm = (): ReceiptFormState => ({
  receipt_number: '',
  receipt_date: new Date().toISOString().split('T')[0],
  source_module: 'Finance',
  amount: '',
  description: '',
  category: 'Operations',
  payment_method: 'Cash',
});

const Receipts: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAccess();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<FinanceReceipt[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationNotice, setOrganizationNotice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'current' | 'backdated'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<FinanceReceipt | null>(null);
  const [formData, setFormData] = useState<ReceiptFormState>(emptyForm());
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const resolveOrganizationId = useCallback(async () => {
    if (profile?.organization_id) {
      setOrganizationNotice(null);
      setOrganizationId(profile.organization_id);
      return profile.organization_id;
    }

    if (profile?.company_id) {
      const { data, error } = await supabase
        .from('companies')
        .select('organization_id')
        .eq('id', profile.company_id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data?.organization_id) {
        setOrganizationNotice('Using your linked company organization for receipts until your profile finishes syncing.');
        setOrganizationId(data.organization_id);
        return data.organization_id;
      }
    }

    if (profile?.company_code) {
      const { data, error } = await supabase
        .from('companies')
        .select('organization_id')
        .eq('code', profile.company_code)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data?.organization_id) {
        setOrganizationNotice('Using your company code mapping for receipts until your profile finishes syncing.');
        setOrganizationId(data.organization_id);
        return data.organization_id;
      }
    }

    const { data: organizations, error: organizationsError } = await supabase
      .from('organizations')
      .select('id')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(2);

    if (organizationsError) {
      throw organizationsError;
    }

    if ((organizations || []).length === 1) {
      setOrganizationNotice('Using the only active organization in the workspace for receipts until your profile finishes syncing.');
      setOrganizationId(organizations![0].id);
      return organizations![0].id;
    }

    setOrganizationId(null);
    setOrganizationNotice(null);
    return null;
  }, [profile?.company_code, profile?.company_id, profile?.organization_id]);

  const fetchReceipts = useCallback(async () => {
    setLoading(true);

    try {
      const resolvedOrganizationId = await resolveOrganizationId();
      if (!resolvedOrganizationId) {
        setReceipts([]);
        setOrganizationNotice('Your account is not linked to an organization yet, so receipts cannot be posted. Apply the latest profile-organization migration or update the user profile.');
        return;
      }

      let query = supabase
        .from('finance_receipts')
        .select('*')
        .order('receipt_date', { ascending: false })
        .order('created_at', { ascending: false })
        .eq('organization_id', resolvedOrganizationId);

      const { data, error } = await query;
      if (error) throw error;

      setReceipts((data || []) as FinanceReceipt[]);
    } catch (error: any) {
      console.error('Failed to fetch receipts:', error);
      setToast({ message: error.message || 'Failed to load receipts.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [resolveOrganizationId]);

  useEffect(() => {
    if (profile) {
      fetchReceipts();
    }
  }, [profile]);

  const openCreateForm = () => {
    setEditingReceipt(null);
    setFormData(emptyForm());
    setShowForm(true);
  };

  const openEditForm = (receipt: FinanceReceipt) => {
    setEditingReceipt(receipt);
    setFormData({
      receipt_number: receipt.receipt_number || '',
      receipt_date: receipt.receipt_date,
      source_module: receipt.source_module || 'Finance',
      amount: String(receipt.amount || ''),
      description: receipt.description || '',
      category: receipt.category || 'Operations',
      payment_method: receipt.payment_method || 'Cash',
    });
    setShowForm(true);
  };

  const handlePrintReceipt = (receipt: FinanceReceipt) => {
    printDocument({
      title: `Receipt ${receipt.receipt_number || receipt.id}`,
      subtitle: `${receipt.receipt_date} · ${receipt.source_module} · ${receipt.payment_method || 'Unspecified method'}`,
      bodyHtml: `
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;">
          ${[
            ['Receipt Number', receipt.receipt_number || '-'],
            ['Receipt Date', receipt.receipt_date || '-'],
            ['Source Module', receipt.source_module || '-'],
            ['Payment Method', receipt.payment_method || '-'],
            ['Category', receipt.category || '-'],
            ['Amount', `KES ${Number(receipt.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
          ]
            .map(
              ([label, value]) => `
                <div style="border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px;">
                  <div style="font-size:11px;text-transform:uppercase;letter-spacing:.18em;color:#64748b;font-weight:700;">${escapeHtml(label)}</div>
                  <div style="margin-top:6px;font-size:15px;font-weight:700;color:#0f172a;">${escapeHtml(String(value))}</div>
                </div>
              `,
            )
            .join('')}
        </div>
        <div style="margin-top:16px;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:.18em;color:#64748b;font-weight:700;">Description</div>
          <div style="margin-top:6px;font-size:14px;line-height:1.6;color:#0f172a;">${escapeHtml(receipt.description || 'No description provided')}</div>
        </div>
      `,
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const resolvedOrganizationId = organizationId || await resolveOrganizationId();

    if (!resolvedOrganizationId) {
      setToast({ message: 'Your account is missing an organization link. Please contact support.', type: 'error' });
      return;
    }

    if (!formData.amount || Number(formData.amount) <= 0) {
      setToast({ message: 'Enter a valid amount before posting the receipt.', type: 'warning' });
      return;
    }

    setSaving(true);

    try {
      const payload = {
        organization_id: resolvedOrganizationId,
        receipt_number: formData.receipt_number.trim() || buildReceiptNumber(formData.receipt_date),
        receipt_date: formData.receipt_date,
        source_module: formData.source_module,
        amount: Number(formData.amount),
        description: formData.description.trim() || null,
        category: formData.category.trim() || null,
        payment_method: formData.payment_method.trim() || null,
      };

      if (editingReceipt) {
        const { error } = await supabase
          .from('finance_receipts')
          .update(payload)
          .eq('id', editingReceipt.id);

        if (error) throw error;
        setToast({ message: 'Receipt updated successfully.', type: 'success' });
      } else {
        const { error } = await supabase
          .from('finance_receipts')
          .insert([payload]);

        if (error) throw error;
        setToast({ message: 'Receipt posted successfully.', type: 'success' });
      }

      setShowForm(false);
      setEditingReceipt(null);
      setFormData(emptyForm());
      await fetchReceipts();
    } catch (error: any) {
      console.error('Failed to save receipt:', error);
      setToast({ message: error.message || 'Failed to save receipt.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (receiptId: string) => {
    setDeletingId(receiptId);
    try {
      const receipt = receipts.find((item) => item.id === receiptId);
      const { error } = await supabase.rpc('archive_record', { p_table_name: 'finance_receipts', p_record_id: receiptId, p_reason: 'delete' });
      if (error) throw error;
      void activityLogger.logDataAction('delete', 'finance_receipts', receiptId, receipt?.receipt_number || 'Receipt');
      setToast({ message: 'Receipt removed.', type: 'success' });
      await fetchReceipts();
    } catch (error: any) {
      console.error('Failed to delete receipt:', error);
      setToast({ message: error.message || 'Failed to delete receipt.', type: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const filteredReceipts = useMemo(() => {
    return receipts.filter((receipt) => {
      const haystack = [
        receipt.receipt_number,
        receipt.description,
        receipt.category,
        receipt.source_module,
        receipt.payment_method,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const receiptDate = new Date(receipt.receipt_date);
      const isCurrentMonth = receiptDate.getMonth() === currentMonth && receiptDate.getFullYear() === currentYear;
      const matchesSearch = haystack.includes(searchTerm.toLowerCase());
      const matchesDateFilter =
        dateFilter === 'all' ||
        (dateFilter === 'current' && isCurrentMonth) ||
        (dateFilter === 'backdated' && !isCurrentMonth);

      return matchesSearch && matchesDateFilter;
    });
  }, [currentMonth, currentYear, dateFilter, receipts, searchTerm]);

  const totalAmount = filteredReceipts.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0);
  const backdatedCount = filteredReceipts.filter((receipt) => {
    const receiptDate = new Date(receipt.receipt_date);
    return receiptDate.getMonth() !== currentMonth || receiptDate.getFullYear() !== currentYear;
  }).length;
  const latestReceiptDate = filteredReceipts[0]?.receipt_date || 'No receipts posted';

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <CustomLoader size={40} label="Loading receipts registry..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6 bg-gray-50 p-6 dark:bg-[#020817]">
      {toast ? (
        <CustomToast
          message={toast.message}
          type={toast.type}
          isVisible
          onClose={() => setToast(null)}
        />
      ) : null}

      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/app/finance/dashboard')}
          title="Go back to Finance Dashboard"
          aria-label="Back"
          className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-[#1e293b]"
        >
          <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Receipts Management</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Post current or backdated receipts directly into the finance register.
          </p>
        </div>
        <button
          type="button"
          onClick={() => filteredReceipts[0] && handlePrintReceipt(filteredReceipts[0])}
          disabled={filteredReceipts.length === 0}
          className="ml-auto inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#1e293b] dark:bg-[#0f172a] dark:text-gray-200 dark:hover:bg-[#111827]"
          title="Print latest visible receipt"
        >
          <Printer size={16} />
          Print Receipt
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-[#1e293b] dark:bg-[#0f172a]">
          <p className="text-sm text-gray-500 dark:text-gray-400">Visible Receipts</p>
          <p className="mt-2 text-3xl font-black text-gray-900 dark:text-white">{filteredReceipts.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-[#1e293b] dark:bg-[#0f172a]">
          <p className="text-sm text-gray-500 dark:text-gray-400">Posted Amount</p>
          <p className="mt-2 text-3xl font-black text-gray-900 dark:text-white">KES {totalAmount.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-[#1e293b] dark:bg-[#0f172a]">
          <p className="text-sm text-gray-500 dark:text-gray-400">Backdated Entries</p>
          <p className="mt-2 text-3xl font-black text-gray-900 dark:text-white">{backdatedCount}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-[#1e293b] dark:bg-[#0f172a]">
          <p className="text-sm text-gray-500 dark:text-gray-400">Latest Posting Date</p>
          <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">{latestReceiptDate}</p>
        </div>
      </div>

      {organizationNotice ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          {organizationNotice}
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-[#1e293b] dark:bg-[#0f172a]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by receipt number, description, category, or module..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 dark:border-[#1e293b] dark:bg-[#0A1628] dark:text-white"
            />
          </div>

          <select
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value as 'all' | 'current' | 'backdated')}
            className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 dark:border-[#1e293b] dark:bg-[#0A1628] dark:text-white"
          >
            <option value="all">All dates</option>
            <option value="current">Current month</option>
            <option value="backdated">Backdated only</option>
          </select>

          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Post Receipt
          </button>
        </div>
      </div>

      {showForm ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-[#1e293b] dark:bg-[#0f172a]">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingReceipt ? 'Edit Receipt' : 'Post New Receipt'}
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Use the original receipt date so January receipts and other backdated entries can be captured correctly.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingReceipt(null);
                setFormData(emptyForm());
              }}
              className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-[#1e293b] dark:hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Receipt Number</span>
              <input
                value={formData.receipt_number}
                onChange={(event) => setFormData((current) => ({ ...current, receipt_number: event.target.value }))}
                placeholder="Leave blank to auto-generate"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 dark:border-[#1e293b] dark:bg-[#0A1628] dark:text-white"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Receipt Date</span>
              <input
                type="date"
                value={formData.receipt_date}
                onChange={(event) => setFormData((current) => ({ ...current, receipt_date: event.target.value }))}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 dark:border-[#1e293b] dark:bg-[#0A1628] dark:text-white"
                required
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Amount</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(event) => setFormData((current) => ({ ...current, amount: event.target.value }))}
                placeholder="0.00"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 dark:border-[#1e293b] dark:bg-[#0A1628] dark:text-white"
                required
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Source Module</span>
              <select
                value={formData.source_module}
                onChange={(event) => setFormData((current) => ({ ...current, source_module: event.target.value }))}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 dark:border-[#1e293b] dark:bg-[#0A1628] dark:text-white"
              >
                {SOURCE_MODULE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Category</span>
              <input
                list="receipt-category-options"
                value={formData.category}
                onChange={(event) => setFormData((current) => ({ ...current, category: event.target.value }))}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 dark:border-[#1e293b] dark:bg-[#0A1628] dark:text-white"
              />
              <datalist id="receipt-category-options">
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Payment Method</span>
              <select
                value={formData.payment_method}
                onChange={(event) => setFormData((current) => ({ ...current, payment_method: event.target.value }))}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 dark:border-[#1e293b] dark:bg-[#0A1628] dark:text-white"
              >
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2 md:col-span-2 xl:col-span-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</span>
              <textarea
                value={formData.description}
                onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                placeholder="Describe the receipt or expense being posted"
                className="min-h-[120px] w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 dark:border-[#1e293b] dark:bg-[#0A1628] dark:text-white"
              />
            </label>

            <div className="flex flex-wrap gap-3 md:col-span-2 xl:col-span-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={16} />
                {saving ? 'Saving...' : editingReceipt ? 'Update Receipt' : 'Post Receipt'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingReceipt(null);
                  setFormData(emptyForm());
                }}
                className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-[#1e293b] dark:text-gray-200 dark:hover:bg-[#111827]"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-[#1e293b] dark:bg-[#0f172a]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50 dark:border-[#1e293b] dark:bg-[#0A1628]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Receipt</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Module</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Category</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Amount</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Receipt Date</th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-[#1e293b]">
              {filteredReceipts.map((receipt) => (
                <tr key={receipt.id} className="hover:bg-gray-50 dark:hover:bg-[#111827]">
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <p className="font-semibold text-gray-900 dark:text-white">{receipt.receipt_number || 'Unnumbered receipt'}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{receipt.description || 'No description provided'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-200">{receipt.source_module}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-200">{receipt.category || '-'}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">KES {Number(receipt.amount).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-200">{receipt.receipt_date}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handlePrintReceipt(receipt)}
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-[#1e293b] dark:hover:text-white"
                        title="Print receipt"
                      >
                        <Printer size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditForm(receipt)}
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-[#1e293b] dark:hover:text-white"
                        title="Edit receipt"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(receipt.id)}
                        disabled={deletingId === receipt.id}
                        className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        title="Delete receipt"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <Receipt size={34} />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">No receipts found</p>
                        <p className="text-sm">Post the first receipt or change your filters.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Receipts;
