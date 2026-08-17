// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, User, Home, Calendar, FileText, XCircle } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { useAccess } from '../../context/AccessContext';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { generateInvoiceNumber } from '../../utils/invoiceNumbers';
import { getTenantDisplayName } from '../../utils/tenantDisplay';
import { calculateHakikaSplit } from '../../utils/hakikaLedger';

interface Tenant {
  id: string;
  full_name: string | null;
  current_unit_id: string | null;
}

interface Unit {
  id: string;
  unit_number: string;
  property?: { name: string } | null;
  property_id?: string | null;
}

interface InvoiceTypeOption {
  name: string;
  slug: string;
  description?: string | null;
}

const DEFAULT_INVOICE_TYPES: InvoiceTypeOption[] = [
  { name: 'Rent', slug: 'rent', description: 'Monthly rent invoice' },
  { name: 'Water', slug: 'water', description: 'Water billing invoice' },
  { name: 'Electricity', slug: 'electricity', description: 'Electricity billing invoice' },
  { name: 'Garbage', slug: 'garbage', description: 'Garbage collection invoice' },
  { name: 'Internet', slug: 'internet', description: 'Internet service invoice' },
  { name: 'Penalty', slug: 'penalty', description: 'Penalty or fine invoice' },
  { name: 'Other', slug: 'other', description: 'Miscellaneous invoice' },
];

export default function AddInvoiceItem() {
  const { profile } = useAccess();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [invoiceTypes, setInvoiceTypes] = useState<InvoiceTypeOption[]>(DEFAULT_INVOICE_TYPES);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [success, setSuccess] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    invoice_type: 'rent',
    tenant_id: '',
    unit_id: '',
    amount_due: '',
    deposit_amount: '',
    deposit_paid_to: 'landlord',
    deposit_shared_with_agent: false,
    deposit_share_landlord: '',
    deposit_share_agent: '',
    due_date: today,
    invoice_date: today,
    notes: '',
    status: 'unpaid',
  });

  useEffect(() => {
    const fetchTenants = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('re_tenants')
          .select('id, full_name, current_unit_id, profile:profiles(full_name, email)')
          .eq('is_active', true)
          .order('full_name');
        if (error) throw error;
        setTenants(data || []);
        const { data: propData } = await supabase.from('re_properties').select('id, name, service_fee_mode, service_fee_value');
        setProperties(propData || []);
        const { data: typeData } = await supabase
          .from('re_invoice_types')
          .select('name, slug, description, is_active, sort_order')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true });
        const liveTypes = (typeData || []).map((row: any) => ({
          name: row.name,
          slug: row.slug,
          description: row.description,
        }));
        setInvoiceTypes(liveTypes.length > 0 ? liveTypes : DEFAULT_INVOICE_TYPES);
      } catch { } finally { setLoading(false); }
    };
    if (profile) fetchTenants();
  }, [profile]);

  useEffect(() => {
    const loadUnit = async () => {
      const tenant = tenants.find(t => t.id === formData.tenant_id);
      if (tenant?.current_unit_id) {
        const { data } = await supabase
          .from('re_units')
          .select('id, unit_number, property_id, property:re_properties(name)')
          .eq('id', tenant.current_unit_id)
          .single();
        setUnits(data ? [data as any] : []);
        setFormData(prev => ({ ...prev, unit_id: tenant.current_unit_id || '' }));
      } else {
        setUnits([]);
        setFormData(prev => ({ ...prev, unit_id: '' }));
      }
    };
    if (formData.tenant_id) loadUnit();
  }, [formData.tenant_id, tenants]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tenant_id || !formData.unit_id || !formData.amount_due || !formData.due_date) {
      setToast({ message: 'Tenant, assigned unit, amount, and due date are required', type: 'warning' });
      return;
    }

    const tenant = tenants.find((item) => item.id === formData.tenant_id);
    if (!tenant?.current_unit_id || tenant.current_unit_id !== formData.unit_id) {
      setToast({ message: 'Invoices can only be created for tenants with an assigned unit.', type: 'warning' });
      return;
    }
    setIsSubmitting(true);
    try {
      const monthStart = new Date(formData.invoice_date);
      monthStart.setDate(1);
      const nextMonthStart = new Date(monthStart);
      nextMonthStart.setMonth(monthStart.getMonth() + 1);

      const isRentInvoice = formData.invoice_type === 'rent';
      const { data: existingInvoice, error: existingInvoiceError } = await supabase
        .from('re_invoices')
        .select('id, invoice_number, invoice_date, invoice_type')
        .eq('company_id', profile?.company_id)
        .eq('tenant_id', formData.tenant_id)
        .eq('unit_id', formData.unit_id)
        .eq('invoice_type', formData.invoice_type)
        .gte('invoice_date', monthStart.toISOString().split('T')[0])
        .lt('invoice_date', nextMonthStart.toISOString().split('T')[0])
        .maybeSingle();

      if (existingInvoiceError) throw existingInvoiceError;
      if (existingInvoice) {
        setToast({
          message: `A ${formData.invoice_type} invoice already exists for this unit for ${monthStart.toLocaleString('default', { month: 'long', year: 'numeric' })}.`,
          type: 'warning',
        });
        return;
      }

      const { error } = await supabase.from('re_invoices').insert([{
        invoice_number: generateInvoiceNumber(),
        tenant_id: formData.tenant_id,
        unit_id: formData.unit_id,
        invoice_type: formData.invoice_type,
        amount_due: Number(formData.amount_due),
        amount_paid: 0,
        deposit_amount: Number(formData.deposit_amount || 0),
        deposit_paid: 0,
        deposit_paid_to: formData.deposit_paid_to,
        deposit_shared_with_agent: formData.deposit_shared_with_agent,
        deposit_share_landlord: Number(formData.deposit_share_landlord || 0),
        deposit_share_agent: Number(formData.deposit_share_agent || 0),
        due_date: formData.due_date,
        invoice_date: formData.invoice_date,
        notes: formData.notes || null,
        status: formData.status,
        company_id: profile?.company_id,
        created_by: profile?.id,
      }]);
      if (error) throw error;
      setToast({ message: 'Invoice created successfully!', type: 'success' });
      setSuccess(true);
      setFormData({ invoice_type: 'rent', tenant_id: '', unit_id: '', amount_due: '', deposit_amount: '', deposit_paid_to: 'landlord', deposit_shared_with_agent: false, deposit_share_landlord: '', deposit_share_agent: '', due_date: today, invoice_date: today, notes: '', status: 'unpaid' });
      window.setTimeout(() => navigate('/app/real-estate/invoice/list'), 700);
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to create invoice', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = 'w-full bg-gray-50 dark:bg-black/20 border border-gray-300 dark:border-white/10 px-4 py-2.5 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-purple outline-none';
  const selectedUnit = units.find(u => u.id === formData.unit_id);
  const selectedProperty = properties.find((p) => p.id === selectedUnit?.property_id);
  const splitMode = (selectedProperty?.service_fee_mode || 'percent') as 'percent' | 'flat';
  const splitRate = Number(selectedProperty?.service_fee_value ?? 10) || 0;
  const splitPreview = calculateHakikaSplit({ amount: Number(formData.amount_due || 0), rate: splitRate, mode: splitMode });

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-dark-bg p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center">
            <PlusCircle className="mr-3 text-brand-purple" size={32} />
            Create Invoice
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Create a new invoice for rent, charges, or other fees.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><CustomLoader size={32} label="Loading..." /></div>
        ) : (
          <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-sm border border-gray-200 dark:border-white/10 p-8">
            {success && (
              <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-xl flex items-center gap-3 text-green-700 dark:text-green-400">
                <FileText size={20} />
                <div>
                  <p className="font-semibold">Invoice Created!</p>
                  <p className="text-sm">The invoice has been added and is now visible in the invoice list.</p>
                </div>
                <button onClick={() => setSuccess(false)} title="Dismiss success message" className="ml-auto"><XCircle size={18} /></button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="tenant-select" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Tenant *</label>
                <select id="tenant-select" title="Select tenant for invoice" required value={formData.tenant_id} onChange={e => setFormData({...formData, tenant_id: e.target.value})} className={inputCls}>
                  <option value="">-- Select Tenant --</option>
                  {tenants.map(t => {
                    const hasAssignedUnit = Boolean(t.current_unit_id);
                    return (
                      <option key={t.id} value={t.id} disabled={!hasAssignedUnit}>
                        {getTenantDisplayName(t as any)}{hasAssignedUnit ? '' : ' (No assigned unit)'}
                      </option>
                    );
                  })}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Only tenants with an assigned unit can be invoiced.</p>
              </div>

              {formData.tenant_id && (
                <div>
                  <label htmlFor="unit-select" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Unit *</label>
                  <select id="unit-select" title="Select unit for invoice" required disabled={units.length === 0} value={formData.unit_id} onChange={e => setFormData({...formData, unit_id: e.target.value})} className={inputCls}>
                    <option value="">{units.length > 0 ? '-- Select Unit --' : '-- No assigned unit --'}</option>
                    {units.map(u => <option key={u.id} value={u.id}>Unit {u.unit_number}{u.property ? ` · ${u.property.name}` : ''}</option>)}
                  </select>
                  {units.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">This tenant has no assigned unit, so an invoice cannot be created yet.</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="invoice-type" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Invoice Type *</label>
                  <select id="invoice-type" value={formData.invoice_type} onChange={e => setFormData({...formData, invoice_type: e.target.value})} className={inputCls}>
                    {invoiceTypes.map((type) => (
                      <option key={type.slug} value={type.slug}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="amount-input" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Amount Due (Ksh) *</label>
                  <input id="amount-input" required type="number" min="1" value={formData.amount_due} onChange={e => setFormData({...formData, amount_due: e.target.value})} placeholder="e.g. 25000" title="Amount due in Ksh" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="deposit-input" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Deposit Amount (Ksh)</label>
                  <input id="deposit-input" type="number" min="0" value={formData.deposit_amount} onChange={e => setFormData({...formData, deposit_amount: e.target.value})} placeholder="Optional deposit" title="Deposit amount to add on the invoice" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="status-select" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Status</label>
                  <select id="status-select" title="Initial invoice status" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className={inputCls}>
                    <option value="draft">Draft</option>
                    <option value="unpaid">Unpaid</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="invoice-date" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Invoice Date</label>
                  <input id="invoice-date" type="date" value={formData.invoice_date} onChange={e => setFormData({...formData, invoice_date: e.target.value})} title="Date the invoice was issued" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="due-date" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Due Date *</label>
                  <input id="due-date" required type="date" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} title="Deadline for invoice payment" className={inputCls} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="deposit-paid-to" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Deposit Paid To</label>
                  <select id="deposit-paid-to" value={formData.deposit_paid_to} onChange={e => setFormData({...formData, deposit_paid_to: e.target.value})} className={inputCls}>
                    <option value="landlord">Landlord</option>
                    <option value="agent">Agent</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={formData.deposit_shared_with_agent} onChange={e => setFormData({...formData, deposit_shared_with_agent: e.target.checked})} />
                    Share deposit with agent
                  </label>
                </div>
              </div>

              {formData.deposit_shared_with_agent && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="deposit-landlord-share" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Landlord Share (Ksh)</label>
                    <input id="deposit-landlord-share" type="number" min="0" value={formData.deposit_share_landlord} onChange={e => setFormData({...formData, deposit_share_landlord: e.target.value})} className={inputCls} />
                  </div>
                  <div>
                    <label htmlFor="deposit-agent-share" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Agent Share (Ksh)</label>
                    <input id="deposit-agent-share" type="number" min="0" value={formData.deposit_share_agent} onChange={e => setFormData({...formData, deposit_share_agent: e.target.value})} className={inputCls} />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="notes-textarea" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Notes / Description</label>
                <textarea id="notes-textarea" rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="e.g. Monthly rent for March 2026, Unit A1..." className={`${inputCls} resize-none`} />
              </div>

              <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Split Preview</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Gross amount</p>
                    <p className="font-bold text-gray-900 dark:text-white">Ksh {Number(formData.amount_due || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Service fee</p>
                    <p className="font-bold text-gray-900 dark:text-white">Ksh {splitPreview.companyRevenue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Landlord payable</p>
                    <p className="font-bold text-gray-900 dark:text-white">Ksh {splitPreview.landlordPayable.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button type="submit" disabled={isSubmitting} title="Create the new invoice" className="px-8 py-3 bg-brand-purple text-white rounded-xl hover:bg-brand-pink transition-all font-semibold shadow-lg shadow-brand-purple/20 flex items-center disabled:opacity-50">
                  {isSubmitting ? <><CustomLoader size={18} className="mr-2" />Creating...</> : <><PlusCircle size={18} className="mr-2" />Create Invoice</>}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
      {toast && <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
