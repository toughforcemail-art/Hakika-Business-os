// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Edit3, Plus, RefreshCcw, Search, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { useAccess } from '../../hooks/useAccess';
import { resolveOrganizationScope } from '../../utils/organizationScope';
import { supabase } from '../../utils/supabase';

interface FinancePayee {
  id: string;
  payee_name: string;
  client_grouping: string | null;
  client_account_number: string | null;
  vat_pin_number: string | null;
  contact_person: string | null;
  telephone_number: string | null;
  email: string | null;
  invoicing_address: string | null;
  shipping_address: string | null;
  transaction_currency: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  mpesa_phone_number: string | null;
  payment_information: string | null;
  agreement_date: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  notes: string | null;
  is_active: boolean;
  is_approved: boolean;
  created_at: string;
}

interface PayeeFormState {
  payeeName: string;
  clientGrouping: string;
  clientAccountNumber: string;
  vatPinNumber: string;
  contactPerson: string;
  telephoneNumber: string;
  email: string;
  invoicingAddress: string;
  shippingAddress: string;
  transactionCurrency: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  mpesaPhoneNumber: string;
  paymentInformation: string;
  agreementDate: string;
  contractStartDate: string;
  contractEndDate: string;
  notes: string;
  isActive: boolean;
}

const panelCls = 'rounded-[28px] border border-gray-200 bg-white/95 p-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur-sm dark:border-white/10 dark:bg-dark-surface/90';
const inputCls = 'w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#ff6a00]/40 focus:bg-white focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-[#082131] dark:text-white dark:placeholder:text-slate-400 dark:focus:border-[#ff6a00]/40 dark:focus:bg-[#0b2a3c]';
const primaryButtonCls = 'inline-flex items-center justify-center gap-2 rounded-2xl bg-[#ff6a00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e85f00] disabled:cursor-not-allowed disabled:opacity-60';
const subtleButtonCls = 'inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:border-[#ff6a00]/40 dark:hover:bg-white/[0.06]';
const labelCls = 'mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400';

const normalizeText = (value?: string | null) => value?.trim().toLowerCase() || '';

const createForm = (): PayeeFormState => ({
  payeeName: '',
  clientGrouping: '',
  clientAccountNumber: '',
  vatPinNumber: '',
  contactPerson: '',
  telephoneNumber: '',
  email: '',
  invoicingAddress: '',
  shippingAddress: '',
  transactionCurrency: 'KES',
  bankName: '',
  bankAccountName: '',
  bankAccountNumber: '',
  mpesaPhoneNumber: '',
  paymentInformation: '',
  agreementDate: '',
  contractStartDate: '',
  contractEndDate: '',
  notes: '',
  isActive: true,
});

const FinancePayeeManager: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAccess();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [workflowReady, setWorkflowReady] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [payees, setPayees] = useState<FinancePayee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPayeeId, setEditingPayeeId] = useState<string | null>(null);
  const [form, setForm] = useState<PayeeFormState>(createForm());

  const loadData = async () => {
    setLoading(true);
    try {
      const scope = await resolveOrganizationScope(profile);
      setOrganizationId(scope.organizationId);

      if (!scope.organizationId) {
        setWorkflowReady(false);
        setPayees([]);
        return;
      }

      const { data, error } = await supabase
        .from('finance_payees')
        .select('id, payee_name, client_grouping, client_account_number, vat_pin_number, contact_person, telephone_number, email, invoicing_address, shipping_address, transaction_currency, bank_name, bank_account_name, bank_account_number, mpesa_phone_number, payment_information, agreement_date, contract_start_date, contract_end_date, notes, is_active, is_approved, created_at')
        .eq('organization_id', scope.organizationId)
        .order('payee_name', { ascending: true });

      if (error) {
        if (error.message.includes('finance_payees') || error.message.includes('does not exist')) {
          setWorkflowReady(false);
          setPayees([]);
          return;
        }
        throw error;
      }

      setWorkflowReady(true);
      setPayees((data || []) as FinancePayee[]);
    } catch (error: any) {
      console.error('Failed to load vendors:', error);
      setToast({ message: error.message || 'Failed to load vendors.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      void loadData();
    }
  }, [profile]);

  const filteredPayees = useMemo(() => {
    const query = normalizeText(searchTerm);
    return payees.filter((payee) =>
      query
        ? [payee.payee_name, payee.contact_person, payee.telephone_number, payee.email, payee.client_grouping]
            .filter(Boolean)
            .some((value) => normalizeText(String(value)).includes(query))
        : true,
    );
  }, [payees, searchTerm]);

  const stats = useMemo(
    () => ({
      total: payees.length,
      active: payees.filter((entry) => entry.is_active).length,
      approved: payees.filter((entry) => entry.is_approved).length,
    }),
    [payees],
  );

  const setField = (field: keyof PayeeFormState, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(createForm());
    setEditingPayeeId(null);
  };

  const openEdit = (payee: FinancePayee) => {
    setEditingPayeeId(payee.id);
    setForm({
      payeeName: payee.payee_name || '',
      clientGrouping: payee.client_grouping || '',
      clientAccountNumber: payee.client_account_number || '',
      vatPinNumber: payee.vat_pin_number || '',
      contactPerson: payee.contact_person || '',
      telephoneNumber: payee.telephone_number || '',
      email: payee.email || '',
      invoicingAddress: payee.invoicing_address || '',
      shippingAddress: payee.shipping_address || '',
      transactionCurrency: payee.transaction_currency || 'KES',
      bankName: payee.bank_name || '',
      bankAccountName: payee.bank_account_name || '',
      bankAccountNumber: payee.bank_account_number || '',
      mpesaPhoneNumber: payee.mpesa_phone_number || '',
      paymentInformation: payee.payment_information || '',
      agreementDate: payee.agreement_date || '',
      contractStartDate: payee.contract_start_date || '',
      contractEndDate: payee.contract_end_date || '',
      notes: payee.notes || '',
      isActive: Boolean(payee.is_active),
    });
  };

  const openEditFromRow = (payee: FinancePayee) => {
    openEdit(payee);
  };

  const savePayee = async () => {
    if (!organizationId) {
      setToast({ message: 'An organization is required before managing vendors.', type: 'warning' });
      return;
    }

    if (!workflowReady) {
      setToast({ message: 'Apply the finance payee migration before managing vendors.', type: 'warning' });
      return;
    }

    if (!form.payeeName.trim()) {
      setToast({ message: 'Vendor name is required.', type: 'warning' });
      return;
    }

    setSaving(true);

    try {
      const payload = {
        organization_id: organizationId,
        payee_name: form.payeeName.trim(),
        client_grouping: form.clientGrouping.trim() || null,
        client_account_number: form.clientAccountNumber.trim() || null,
        vat_pin_number: form.vatPinNumber.trim() || null,
        contact_person: form.contactPerson.trim() || null,
        telephone_number: form.telephoneNumber.trim() || null,
        email: form.email.trim() || null,
        invoicing_address: form.invoicingAddress.trim() || null,
        shipping_address: form.shippingAddress.trim() || null,
        transaction_currency: form.transactionCurrency.trim() || 'KES',
        bank_name: form.bankName.trim() || null,
        bank_account_name: form.bankAccountName.trim() || null,
        bank_account_number: form.bankAccountNumber.trim() || null,
        mpesa_phone_number: form.mpesaPhoneNumber.trim() || null,
        payment_information: form.paymentInformation.trim() || null,
        agreement_date: form.agreementDate || null,
        contract_start_date: form.contractStartDate || null,
        contract_end_date: form.contractEndDate || null,
        notes: form.notes.trim() || null,
        is_active: form.isActive,
        created_by: profile?.id || null,
        updated_by: profile?.id || null,
      };

      if (editingPayeeId) {
        const { error } = await supabase
          .from('finance_payees')
          .update(payload)
          .eq('id', editingPayeeId);
        if (error) throw error;
        setToast({ message: 'Vendor updated successfully.', type: 'success' });
      } else {
        const { error } = await supabase
          .from('finance_payees')
          .insert(payload);
        if (error) throw error;
        setToast({ message: 'Vendor saved successfully.', type: 'success' });
      }

      resetForm();
      await loadData();
    } catch (error: any) {
      console.error('Failed to save vendor:', error);
      setToast({ message: error.message || 'Failed to save vendor.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const deletePayee = async (payee: FinancePayee) => {
    const confirmed = window.confirm(`Delete vendor "${payee.payee_name}"?`);
    if (!confirmed) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('finance_payees').delete().eq('id', payee.id);
      if (error) throw error;
      setPayees((current) => current.filter((entry) => entry.id !== payee.id));
      if (editingPayeeId === payee.id) {
        resetForm();
      }
      setToast({ message: 'Vendor deleted successfully.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to delete vendor:', error);
      setToast({ message: error.message || 'Failed to delete vendor.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <CustomLoader text="Loading vendors..." />;
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
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Vendors</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Edit, deactivate, or delete vendor records used by requisitions and payments.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void loadData()} className={subtleButtonCls}>
            <RefreshCcw size={16} />
            Refresh
          </button>
          <button type="button" onClick={resetForm} className={primaryButtonCls}>
            <Plus size={16} />
            New Vendor
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className={panelCls}>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Total Vendors</p>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{stats.total}</p>
        </div>
        <div className={panelCls}>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Active</p>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{stats.active}</p>
        </div>
        <div className={panelCls}>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Approved</p>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{stats.approved}</p>
        </div>
      </div>

      <div className={panelCls}>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Vendor Register</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Search, edit, or remove vendors from the finance workflow.</p>
          </div>
          <div className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className={`${inputCls} pl-11`}
              placeholder="Search vendors, contacts, or grouping"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-[24px] border border-gray-200 dark:border-white/10">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-white/[0.03]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Vendor</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Currency</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/10">
              {filteredPayees.map((payee) => (
                <tr
                  key={payee.id}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                  onClick={() => openEditFromRow(payee)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openEditFromRow(payee);
                    }
                  }}
                  aria-label={`Edit vendor ${payee.payee_name}`}
                >
                  <td className="px-4 py-4">
                    <p className="font-bold text-slate-900 dark:text-white">{payee.payee_name}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {payee.client_grouping || 'No client grouping'} · {payee.payment_information || 'No payment details'}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700 dark:text-slate-200">
                    <div>{payee.contact_person || '-'}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{payee.telephone_number || payee.email || '-'}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-700 dark:text-slate-200">{payee.transaction_currency || 'KES'}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${payee.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300'}`}>
                      {payee.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className={`ml-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${payee.is_approved ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'}`}>
                      {payee.is_approved ? 'Approved' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEdit(payee);
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
                          void deletePayee(payee);
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
              {filteredPayees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    {payees.length === 0 ? 'No vendors saved yet.' : 'No vendors match your search.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className={panelCls}>
        <div className="mb-4">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">{editingPayeeId ? 'Edit Vendor' : 'Add Vendor'}</p>
          <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{editingPayeeId ? 'Update vendor record' : 'Create a new vendor record'}</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelCls}>Vendor Name</label>
            <input value={form.payeeName} onChange={(event) => setField('payeeName', event.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Contact Person</label>
            <input value={form.contactPerson} onChange={(event) => setField('contactPerson', event.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Telephone Number</label>
            <input value={form.telephoneNumber} onChange={(event) => setField('telephoneNumber', event.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={form.email} onChange={(event) => setField('email', event.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Currency</label>
            <input value={form.transactionCurrency} onChange={(event) => setField('transactionCurrency', event.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Client Grouping</label>
            <input value={form.clientGrouping} onChange={(event) => setField('clientGrouping', event.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Client Account Number</label>
            <input value={form.clientAccountNumber} onChange={(event) => setField('clientAccountNumber', event.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>VAT / PIN</label>
            <input value={form.vatPinNumber} onChange={(event) => setField('vatPinNumber', event.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Bank Name</label>
            <input value={form.bankName} onChange={(event) => setField('bankName', event.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Bank Account Name</label>
            <input value={form.bankAccountName} onChange={(event) => setField('bankAccountName', event.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Bank Account Number</label>
            <input value={form.bankAccountNumber} onChange={(event) => setField('bankAccountNumber', event.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>M-Pesa Phone Number</label>
            <input value={form.mpesaPhoneNumber} onChange={(event) => setField('mpesaPhoneNumber', event.target.value)} className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Invoicing Address</label>
            <textarea rows={3} value={form.invoicingAddress} onChange={(event) => setField('invoicingAddress', event.target.value)} className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Shipping Address</label>
            <textarea rows={3} value={form.shippingAddress} onChange={(event) => setField('shippingAddress', event.target.value)} className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Payment Information</label>
            <textarea rows={3} value={form.paymentInformation} onChange={(event) => setField('paymentInformation', event.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Agreement Date</label>
            <input type="date" value={form.agreementDate} onChange={(event) => setField('agreementDate', event.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Start Date</label>
            <input type="date" value={form.contractStartDate} onChange={(event) => setField('contractStartDate', event.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>End Date</label>
            <input type="date" value={form.contractEndDate} onChange={(event) => setField('contractEndDate', event.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select value={form.isActive ? 'active' : 'inactive'} onChange={(event) => setField('isActive', event.target.value === 'active')} className={inputCls}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Notes</label>
            <textarea rows={3} value={form.notes} onChange={(event) => setField('notes', event.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => void savePayee()} className={primaryButtonCls} disabled={saving}>
            <Plus size={16} />
            {editingPayeeId ? 'Update Vendor' : 'Save Vendor'}
          </button>
          <button type="button" onClick={resetForm} className={subtleButtonCls}>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinancePayeeManager;
