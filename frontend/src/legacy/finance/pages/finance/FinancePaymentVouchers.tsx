// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, Printer, Receipt, RotateCcw, Search, Wallet, Eye } from 'lucide-react';
import { escapeHtml, printDocument } from '../../utils/printHelpers';
import { useNavigate } from 'react-router-dom';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { useAccess } from '../../hooks/useAccess';
import { resolveOrganizationScope } from '../../utils/organizationScope';
import { supabase } from '../../utils/supabase';
import { activityLogger } from '../../utils/activityLogger';

type PaymentType = 'apply_to_bill' | 'cash_payment';

interface FinancePayee {
  id: string;
  payee_name: string;
  client_grouping: string | null;
  client_account_number: string | null;
  vat_pin_number: string | null;
  contact_person: string | null;
  telephone_number: string | null;
  email: string | null;
  payable_account: string | null;
  default_bank_cash: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  mpesa_phone_number: string | null;
}

interface FinancePayment {
  id: string;
  organization_id: string;
  payee_id: string | null;
  source_requisition_id: string | null;
  payment_number: string | null;
  payment_date: string;
  payment_type: PaymentType;
  pay_from_account: string | null;
  pay_from_account_id: string | null;
  cost_center: string;
  expense_group: string | null;
  amount: number;
  quantity: number | null;
  unit_cost: number | null;
  specification: string | null;
  description: string | null;
  payment_method: string | null;
  reference_number: string | null;
  cheque_date: string | null;
  is_post_dated_cheque: boolean;
  currency: string;
  spot_rate: number;
  recording_date: string;
  voucher_notes: string | null;
  signature_data_url?: string | null;
  attachment_urls: string[] | null;
  status: string | null;
  created_at: string;
}

interface FinancePaymentAllocation {
  id: string;
  payment_id: string;
  bill_date: string | null;
  invoice_number: string | null;
  particular: string | null;
  specification: string | null;
  quantity: number;
  unit_cost: number;
  payable_total: number;
  wht_tax: number;
  paid_to_date: number;
  amount_due: number;
  payment_amount: number;
  new_balance: number;
  display_order: number;
}

interface PaymentEditFormState {
  recordingDate: string;
  paymentMethod: string;
  payFromAccount: string;
  costCenter: string;
  expenseGroup: string;
  referenceNumber: string;
  amount: string;
  currency: string;
  voucherNotes: string;
}

const panelCls =
  'rounded-[28px] border border-gray-200 bg-white/95 p-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur-sm dark:border-white/10 dark:bg-dark-surface/90';
const inputCls =
  'w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#ff6a00]/40 focus:bg-white focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-[#082131] dark:text-white dark:placeholder:text-slate-400 dark:focus:border-[#ff6a00]/40 dark:focus:bg-[#0b2a3c]';
const labelCls = 'text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400';
const subtleButtonCls =
  'inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:border-[#ff6a00]/40 dark:hover:bg-white/[0.06]';
const primaryButtonCls =
  'inline-flex items-center justify-center gap-2 rounded-2xl bg-[#ff6a00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e85f00] disabled:cursor-not-allowed disabled:opacity-60';

const normalizeText = (value?: string | null) => value?.trim().toLowerCase() || '';
const toNumber = (value?: string | number | null) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const formatMoney = (value: number, currency = 'KES') =>
  `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDateLabel = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};
const createEditForm = (payment: FinancePayment): PaymentEditFormState => ({
  recordingDate: payment.recording_date || '',
  paymentMethod: payment.payment_method || '',
  payFromAccount: payment.pay_from_account || '',
  costCenter: payment.cost_center || '',
  expenseGroup: payment.expense_group || '',
  referenceNumber: payment.reference_number || '',
  amount: payment.amount ? `${payment.amount}` : '',
  currency: payment.currency || 'KES',
  voucherNotes: payment.voucher_notes || '',
});
const errorText = (error: any) => `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
const isMissingFinanceWorkflow = (error: any) => {
  const message = errorText(error);
  return (
    message.includes('finance_payments') ||
    message.includes('finance_payment_allocations') ||
    message.includes('finance_payees') ||
    message.includes('expense_group') ||
    message.includes('recording_date') ||
    message.includes('attachment_urls') ||
    message.includes('does not exist') ||
    message.includes('schema cache')
  );
};

const isMissingFinancePaymentColumn = (error: any, columnName: string) => {
  const message = errorText(error);
  return (
    message.includes(`finance_payments.${columnName}`) ||
    message.includes(`'${columnName}' column`) ||
    message.includes(`"${columnName}" column`) ||
    (message.includes('schema cache') && message.includes('finance_payments') && message.includes(columnName))
  );
};

const FinancePaymentVouchers: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAccess();
  const inspectorRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [workflowReady, setWorkflowReady] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationNotice, setOrganizationNotice] = useState<string | null>(null);
  const [dataNotice, setDataNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [payments, setPayments] = useState<FinancePayment[]>([]);
  const [payees, setPayees] = useState<FinancePayee[]>([]);
  const [selectedPaymentAllocations, setSelectedPaymentAllocations] = useState<FinancePaymentAllocation[]>([]);
  const [allocationsLoading, setAllocationsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | PaymentType>('all');
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState<PaymentEditFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);

    try {
      const scope = await resolveOrganizationScope(profile);
      setOrganizationId(scope.organizationId);
      setOrganizationNotice(scope.notice);
      setDataNotice(null);

      if (!scope.organizationId) {
        setWorkflowReady(false);
        setPayments([]);
        setPayees([]);
        setSelectedPaymentAllocations([]);
        setOrganizationNotice('Your profile is not linked to an organization yet, so payment vouchers cannot be loaded.');
        return;
      }

      const [payeesResponse, paymentsResponse] = await Promise.all([
        supabase
          .from('finance_payees')
          .select(
            'id, payee_name, client_grouping, client_account_number, vat_pin_number, contact_person, telephone_number, email, payable_account, default_bank_cash, bank_name, bank_account_name, bank_account_number, mpesa_phone_number',
          )
          .eq('organization_id', scope.organizationId)
          .order('payee_name', { ascending: true }),
        supabase
          .from('finance_payments')
          .select('id, organization_id, payee_id, source_requisition_id, payment_number, payment_date, payment_type, pay_from_account, pay_from_account_id, cost_center, expense_group, amount, quantity, unit_cost, specification, description, payment_method, reference_number, cheque_date, is_post_dated_cheque, currency, spot_rate, recording_date, voucher_notes, signature_data_url, attachment_urls, status, created_at')
          .eq('organization_id', scope.organizationId)
          .in('status', ['completed', 'approved', 'paid'])
          .order('recording_date', { ascending: false })
          .order('created_at', { ascending: false }),
      ]);

      let nextPaymentsResponse: any = paymentsResponse;
      if (paymentsResponse.error && isMissingFinancePaymentColumn(paymentsResponse.error, 'signature_data_url')) {
        nextPaymentsResponse = await supabase
          .from('finance_payments')
          .select('id, organization_id, payee_id, source_requisition_id, payment_number, payment_date, payment_type, pay_from_account, pay_from_account_id, cost_center, expense_group, amount, quantity, unit_cost, specification, description, payment_method, reference_number, cheque_date, is_post_dated_cheque, currency, spot_rate, recording_date, voucher_notes, attachment_urls, status, created_at')
          .eq('organization_id', scope.organizationId)
          .in('status', ['completed', 'approved', 'paid'])
          .order('recording_date', { ascending: false })
          .order('created_at', { ascending: false });
      }

      const workflowError = payeesResponse.error || nextPaymentsResponse.error;
      if (workflowError) {
        if (isMissingFinanceWorkflow(workflowError)) {
          setWorkflowReady(false);
          setPayments([]);
          setPayees([]);
          setSelectedPaymentAllocations([]);
          setDataNotice('The payment voucher workflow needs the latest finance database update before this page can load vouchers.');
          return;
        }

        throw workflowError;
      }

      const nextPayees = ((payeesResponse.data || []) as FinancePayee[]).sort((left, right) =>
        left.payee_name.localeCompare(right.payee_name),
      );
      const nextPayments = (nextPaymentsResponse.data || []).map((entry: any) => ({
        ...entry,
        attachment_urls: Array.isArray(entry.attachment_urls) ? entry.attachment_urls : [],
      })) as FinancePayment[];

      setWorkflowReady(true);
      setPayees(nextPayees);
      setPayments(nextPayments);
      setSelectedPaymentId((current) => current || nextPayments[0]?.id || null);
    } catch (error: any) {
      console.error('Failed to load payment vouchers:', error);
      setToast({ message: error.message || 'Failed to load payment vouchers.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedAllocations = async (paymentId: string | null) => {
    if (!paymentId || !organizationId) {
      setSelectedPaymentAllocations([]);
      return;
    }

    setSelectedPaymentAllocations([]);
    setAllocationsLoading(true);
    try {
      const { data, error } = await supabase
        .from('finance_payment_allocations')
        .select('id, payment_id, bill_date, invoice_number, particular, specification, quantity, unit_cost, payable_total, wht_tax, paid_to_date, amount_due, payment_amount, new_balance, display_order')
        .eq('payment_id', paymentId)
        .order('display_order', { ascending: true });

      if (error) {
        if (isMissingFinanceWorkflow(error)) {
          setWorkflowReady(false);
          setSelectedPaymentAllocations([]);
          setDataNotice('The payment voucher workflow needs the latest finance database update before this page can load voucher allocations.');
          return;
        }

        throw error;
      }

      setSelectedPaymentAllocations((data || []) as FinancePaymentAllocation[]);
    } catch (error: any) {
      console.error('Failed to load payment allocations:', error);
      setToast({ message: error.message || 'Failed to load payment allocations.', type: 'error' });
    } finally {
      setAllocationsLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      void loadData();
    }
  }, [profile]);

  useEffect(() => {
    if (!workflowReady) {
      setSelectedPaymentAllocations([]);
      return;
    }
    void loadSelectedAllocations(selectedPaymentId);
  }, [selectedPaymentId, workflowReady, organizationId]);

  useEffect(() => {
    if (selectedPaymentId && inspectorRef.current) {
      inspectorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedPaymentId]);

  const payeeMap = useMemo(
    () => Object.fromEntries(payees.map((payee) => [payee.id, payee])),
    [payees],
  );

  const filteredPayments = useMemo(() => {
    const search = normalizeText(searchTerm);

    return payments.filter((payment) => {
      if (typeFilter !== 'all' && payment.payment_type !== typeFilter) return false;
      if (!search) return true;

      const payee = payeeMap[payment.payee_id || ''];
      const haystack = [
        payment.payment_number,
        payee?.payee_name,
        payment.reference_number,
        payment.pay_from_account,
        payment.payment_method,
        payment.cost_center,
        payment.expense_group,
        payment.description,
      ]
        .filter(Boolean)
        .join(' ');

      return normalizeText(haystack).includes(search);
    });
  }, [payments, payeeMap, searchTerm, typeFilter]);

  const totalPaid = useMemo(() => filteredPayments.reduce((sum, payment) => sum + toNumber(payment.amount), 0), [filteredPayments]);
  const uniquePayees = useMemo(() => new Set(filteredPayments.map((payment) => payment.payee_id).filter(Boolean)).size, [filteredPayments]);

  const selectedPayment = payments.find((payment) => payment.id === selectedPaymentId) || null;
  const selectedPaymentPayee = selectedPayment?.payee_id ? payeeMap[selectedPayment.payee_id] : null;

  const openEditVoucher = () => {
    if (!selectedPayment) return;
    setEditForm(createEditForm(selectedPayment));
    setShowEditForm(true);
  };

  const handleEditChange = (field: keyof PaymentEditFormState, value: string) => {
    setEditForm((current) => (current ? { ...current, [field]: value } : current));
  };

  const saveEdit = async () => {
    if (!selectedPayment || !editForm) return;

    setSaving(true);
    try {
      const payload = {
        recording_date: editForm.recordingDate || null,
        payment_date: editForm.recordingDate || null,
        payment_method: editForm.paymentMethod.trim() || null,
        pay_from_account: editForm.payFromAccount.trim() || null,
        pay_from_account_id:
          normalizeText(editForm.payFromAccount) === normalizeText(selectedPayment.pay_from_account)
            ? selectedPayment.pay_from_account_id || null
            : null,
        cost_center: editForm.costCenter.trim() || null,
        expense_group: editForm.expenseGroup.trim() || null,
        reference_number: editForm.referenceNumber.trim() || null,
        amount: toNumber(editForm.amount),
        currency: editForm.currency || 'KES',
        voucher_notes: editForm.voucherNotes.trim() || null,
        updated_by: profile?.id || null,
      };

      const { data, error } = await supabase
        .from('finance_payments')
        .update(payload)
        .eq('id', selectedPayment.id)
        .select('*')
        .single();

      if (error) throw error;

      const updatedPayment = {
        ...data,
        attachment_urls: Array.isArray(data.attachment_urls) ? data.attachment_urls : [],
      } as FinancePayment;

      setPayments((current) => current.map((payment) => (payment.id === updatedPayment.id ? updatedPayment : payment)));
      setShowEditForm(false);
      setEditForm(null);
      setToast({ message: 'Voucher updated successfully.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to update voucher:', error);
      setToast({ message: error.message || 'Failed to update voucher.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const deleteVoucher = async () => {
    if (!selectedPayment) return;
    const confirmed = window.confirm('Delete this payment voucher? This action cannot be undone.');
    if (!confirmed) return;

    setDeleting(true);
    try {
      const { error } = await supabase.rpc('archive_record', { p_table_name: 'finance_payments', p_record_id: selectedPayment.id, p_reason: 'delete' });
      if (error) throw error;
      void activityLogger.logDataAction('delete', 'finance_payments', selectedPayment.id, selectedPaymentPayee?.payee_name || 'Payment Voucher');

      setPayments((current) => current.filter((payment) => payment.id !== selectedPayment.id));
      setSelectedPaymentAllocations([]);
      setSelectedPaymentId((current) => (current === selectedPayment.id ? null : current));
      setToast({ message: 'Voucher deleted successfully.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to delete voucher:', error);
      setToast({ message: error.message || 'Failed to delete voucher.', type: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
  };

  const buildSignatureBlock = (payment: FinancePayment) => {
    const signedBy = selectedPaymentPayee?.payee_name || 'Voucher Sign-Off';
    if (!payment.signature_data_url) {
      return `
        <div style="margin-top:24px; display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;">
          <div style="border-top:1px solid #cbd5e1; padding-top:10px; font-size:11px;">
            <div style="font-weight:700; text-transform:uppercase; letter-spacing:.18em; color:#64748b;">Signature</div>
            <div style="margin-top:14px; color:#94a3b8;">No signature captured</div>
          </div>
          <div style="border-top:1px solid #cbd5e1; padding-top:10px; font-size:11px;">
            <div style="font-weight:700; text-transform:uppercase; letter-spacing:.18em; color:#64748b;">Signed by</div>
            <div style="margin-top:14px; color:#0f172a;">${escapeHtml(signedBy)}</div>
          </div>
        </div>
      `;
    }

    return `
        <div style="margin-top:24px; display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; align-items:end;">
          <div style="border-top:1px solid #cbd5e1; padding-top:10px; font-size:11px;">
          <div style="font-weight:700; text-transform:uppercase; letter-spacing:.18em; color:#64748b;">Signature</div>
          <div style="margin-top:10px;"><img src="${escapeHtml(payment.signature_data_url || '')}" alt="Digital signature" style="max-height:72px; max-width:100%; object-fit:contain;" /></div>
        </div>
        <div style="border-top:1px solid #cbd5e1; padding-top:10px; font-size:11px;">
          <div style="font-weight:700; text-transform:uppercase; letter-spacing:.18em; color:#64748b;">Signed by</div>
          <div style="margin-top:14px; color:#0f172a;">${escapeHtml(signedBy)}</div>
        </div>
      </div>
    `;
  };

  const printSelectedVoucher = () => {
    if (!selectedPayment) {
      setToast({ message: 'Select a voucher before printing it.', type: 'warning' });
      return;
    }

    const lines = [
      `<div style="display:grid; gap:16px; grid-template-columns: repeat(2, minmax(0, 1fr)); font-size:12px;">`,
      `<div><strong>Voucher No.</strong><br/>${escapeHtml(selectedPayment.payment_number || '-')}</div>`,
      `<div><strong>Payee</strong><br/>${escapeHtml(selectedPaymentPayee?.payee_name || '-')}</div>`,
      `<div><strong>Recording Date</strong><br/>${escapeHtml(formatDateLabel(selectedPayment.recording_date))}</div>`,
      `<div><strong>Method</strong><br/>${escapeHtml(selectedPayment.payment_method || '-')}</div>`,
      `<div><strong>Pay From</strong><br/>${escapeHtml(selectedPayment.pay_from_account || '-')}</div>`,
      `<div><strong>Reference</strong><br/>${escapeHtml(selectedPayment.reference_number || '-')}</div>`,
      `<div><strong>Cost Center</strong><br/>${escapeHtml(selectedPayment.cost_center || '-')}</div>`,
      `<div><strong>Expense Group</strong><br/>${escapeHtml(selectedPayment.expense_group || '-')}</div>`,
      `</div>`,
      `<div style="margin-top:18px; padding:14px; border:1px solid #e2e8f0; border-radius:18px; background:#f8fafc;"><strong>Amount</strong><div style="margin-top:8px; font-size:18px; font-weight:800;">${escapeHtml(formatMoney(toNumber(selectedPayment.amount), selectedPayment.currency || 'KES'))}</div></div>`,
    ];

    if (selectedPayment.voucher_notes) {
      lines.push(`<div style="margin-top:18px;"><strong>Notes</strong><div style="margin-top:8px; white-space:pre-wrap;">${escapeHtml(selectedPayment.voucher_notes)}</div></div>`);
    }

    if (selectedPaymentAllocations.length > 0) {
      lines.push(`
        <div style="margin-top:18px;">
          <strong>Allocations</strong>
          <table style="width:100%; margin-top:8px; border-collapse:collapse; font-size:11px;">
            <thead>
              <tr>
                <th style="border-bottom:1px solid #e2e8f0; text-align:left; padding:8px 6px;">Invoice</th>
                <th style="border-bottom:1px solid #e2e8f0; text-align:left; padding:8px 6px;">Particular</th>
                <th style="border-bottom:1px solid #e2e8f0; text-align:right; padding:8px 6px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${selectedPaymentAllocations
                .map(
                  (row) => `
                    <tr>
                      <td style="border-bottom:1px solid #f1f5f9; padding:8px 6px;">${escapeHtml(row.invoice_number || '-')}</td>
                      <td style="border-bottom:1px solid #f1f5f9; padding:8px 6px;">${escapeHtml(row.particular || row.specification || '-')}</td>
                      <td style="border-bottom:1px solid #f1f5f9; padding:8px 6px; text-align:right;">${escapeHtml(formatMoney(toNumber(row.payment_amount), selectedPayment.currency || 'KES'))}</td>
                    </tr>
                  `,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `);
    }

    lines.push(buildSignatureBlock(selectedPayment));

    printDocument({
      title: `Payment Voucher ${selectedPayment.payment_number || ''}`.trim(),
      subtitle: 'Selected voucher',
      bodyHtml: lines.join('\n'),
    });
  };

  const printAllVouchers = () => {
    if (filteredPayments.length === 0) {
      setToast({ message: 'There are no vouchers to print right now.', type: 'warning' });
      return;
    }

    const rows = filteredPayments
      .map(
        (payment) => `
          <tr>
            <td style="padding:8px 6px; border-bottom:1px solid #e2e8f0;">${escapeHtml(payment.payment_number || '-')}</td>
            <td style="padding:8px 6px; border-bottom:1px solid #e2e8f0;">${escapeHtml(payeeMap[payment.payee_id || '']?.payee_name || '-')}</td>
            <td style="padding:8px 6px; border-bottom:1px solid #e2e8f0; text-align:right;">${escapeHtml(formatMoney(toNumber(payment.amount), payment.currency || 'KES'))}</td>
            <td style="padding:8px 6px; border-bottom:1px solid #e2e8f0;">${escapeHtml(payment.payment_method || '-')}</td>
            <td style="padding:8px 6px; border-bottom:1px solid #e2e8f0;">${escapeHtml(formatDateLabel(payment.recording_date))}</td>
          </tr>
        `,
      )
      .join('');

    printDocument({
      title: 'Payment Vouchers',
      subtitle: `${filteredPayments.length} voucher${filteredPayments.length === 1 ? '' : 's'} in the current filter`,
      bodyHtml: `
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead>
            <tr>
              <th style="padding:8px 6px; text-align:left; border-bottom:1px solid #cbd5e1;">Voucher No.</th>
              <th style="padding:8px 6px; text-align:left; border-bottom:1px solid #cbd5e1;">Payee</th>
              <th style="padding:8px 6px; text-align:right; border-bottom:1px solid #cbd5e1;">Amount</th>
              <th style="padding:8px 6px; text-align:left; border-bottom:1px solid #cbd5e1;">Method</th>
              <th style="padding:8px 6px; text-align:left; border-bottom:1px solid #cbd5e1;">Recording Date</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `,
    });
  };

  const exportPayments = () => {
    if (filteredPayments.length === 0) {
      setToast({ message: 'There are no vouchers to export right now.', type: 'warning' });
      return;
    }

    const lines = [
      ['Payment Number', 'Payee', 'Type', 'Recording Date', 'Method', 'Pay From', 'Cost Center', 'Expense Group', 'Currency', 'Amount', 'Reference'].join(','),
      ...filteredPayments.map((payment) => [
        `"${payment.payment_number || ''}"`,
        `"${payeeMap[payment.payee_id || '']?.payee_name || ''}"`,
        `"${payment.payment_type === 'apply_to_bill' ? 'Apply To Bill' : 'Cash Payment'}"`,
        `"${payment.recording_date || ''}"`,
        `"${payment.payment_method || ''}"`,
        `"${payment.pay_from_account || ''}"`,
        `"${payment.cost_center || ''}"`,
        `"${payment.expense_group || ''}"`,
        `"${payment.currency || 'KES'}"`,
        payment.amount,
        `"${payment.reference_number || ''}"`,
      ].join(',')),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payment_vouchers_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return <CustomLoader text="Loading payment vouchers..." />;
  }

  return (
    <div className="min-h-screen space-y-6 bg-[#f6f7fb] p-6 dark:bg-[#061723]">
      <div className={`${panelCls} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/app/finance/dashboard')}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
            title="Back to Finance Dashboard"
            aria-label="Back to Finance Dashboard"
          >
            <ArrowLeft size={18} />
          </button>
          {!workflowReady ? (
            <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Payment voucher migration is required before vouchers can be loaded.
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
          {!workflowReady ? (
            <button type="button" onClick={() => void loadData()} className={subtleButtonCls}>
              <RotateCcw size={16} />
              Refresh Status
            </button>
          ) : null}
          <button type="button" onClick={printSelectedVoucher} className={subtleButtonCls} disabled={!selectedPayment}>
            <Printer size={16} />
            Print Selected
          </button>
          <button type="button" onClick={printAllVouchers} className={subtleButtonCls} disabled={filteredPayments.length === 0}>
            <Printer size={16} />
            Print All
          </button>
          <button type="button" onClick={exportPayments} className={primaryButtonCls}>
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {organizationNotice ? (
        <div className="flex items-start gap-3 rounded-[24px] border border-amber-200 bg-amber-50/90 px-5 py-4 text-sm text-amber-900 shadow-sm dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
          {organizationNotice}
        </div>
      ) : null}
      {dataNotice ? (
        <div className="flex items-start gap-3 rounded-[24px] border border-[#ff6a00]/20 bg-[#fff3eb] px-5 py-4 text-sm text-[#9a3f00] shadow-sm dark:border-[#ff6a00]/25 dark:bg-[#ff6a00]/10 dark:text-[#ffd3b5]">
          {dataNotice}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className={panelCls}>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-[#ff6a00]/10 text-[#ff6a00] dark:bg-[#ff6a00]/12 dark:text-[#ffb37a]">
              <Receipt size={22} />
            </div>
            <div>
              <p className={labelCls}>Approved Vouchers</p>
              <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{filteredPayments.length}</p>
            </div>
          </div>
        </div>
        <div className={panelCls}>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
              <Wallet size={22} />
            </div>
            <div>
              <p className={labelCls}>Total Paid</p>
              <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatMoney(totalPaid)}</p>
            </div>
          </div>
        </div>
        <div className={panelCls}>
          <div className="space-y-1">
            <p className={labelCls}>Vendors Paid</p>
            <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{uniquePayees}</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Unique payees captured in approved vouchers.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {selectedPaymentId ? (
          <div ref={inspectorRef} className={panelCls}>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Inspector</p>
                <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Voucher Details</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Edit or remove approved vouchers with full audit visibility.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={printSelectedVoucher} className={subtleButtonCls} disabled={!selectedPayment}>
                  <Printer size={16} />
                  Print This
                </button>
                <button type="button" onClick={printAllVouchers} className={subtleButtonCls} disabled={filteredPayments.length === 0}>
                  <Printer size={16} />
                  Print All
                </button>
                <button type="button" onClick={openEditVoucher} className={subtleButtonCls} disabled={!selectedPayment || saving}>
                  Edit
                </button>
                <button type="button" onClick={deleteVoucher} className={subtleButtonCls} disabled={!selectedPayment || deleting}>
                  Delete
                </button>
              </div>
            </div>
            {selectedPayment ? (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Payee</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{selectedPaymentPayee?.payee_name || '-'}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Requisition</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{selectedPayment.source_requisition_id || '-'}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Amount</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{formatMoney(toNumber(selectedPayment.amount), selectedPayment.currency || 'KES')}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Pay From</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{selectedPayment.pay_from_account || '-'}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Reference</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{selectedPayment.reference_number || '-'}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Expense Group</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{selectedPayment.expense_group || '-'}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Recording Date</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{formatDateLabel(selectedPayment.recording_date)}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Cheque Date</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{formatDateLabel(selectedPayment.cheque_date)}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Method</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{selectedPayment.payment_method || '-'}</p>
                </div>
                {selectedPayment.quantity && selectedPayment.quantity > 1 ? (
                  <>
                    <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Quantity</p>
                      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200 font-bold">{selectedPayment.quantity}</p>
                    </div>
                    <div className="rounded-2xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Unit Cost</p>
                      <p className="mt-2 text-sm text-slate-700 dark:text-slate-200 font-bold">{formatMoney(toNumber(selectedPayment.unit_cost), selectedPayment.currency || 'KES')}</p>
                    </div>
                  </>
                ) : null}
              </div>

              {selectedPayment.specification ? (
                <div className="rounded-2xl bg-[#fff7f2] border border-[#ff6a00]/10 px-4 py-3 dark:bg-[#ff6a00]/5 dark:border-[#ff6a00]/20">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ff6a00] dark:text-[#ffb37a]">Specification / Details</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200 italic">{selectedPayment.specification}</p>
                </div>
              ) : null}

              {selectedPaymentPayee ? (
                <div className="rounded-[24px] border border-gray-200 p-4 dark:border-white/10">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Payee Profile</p>
                  <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                    <p className="text-slate-700 dark:text-slate-200">Contact: {selectedPaymentPayee.contact_person || '-'}</p>
                    <p className="text-slate-700 dark:text-slate-200">Phone: {selectedPaymentPayee.telephone_number || '-'}</p>
                    <p className="text-slate-700 dark:text-slate-200">Email: {selectedPaymentPayee.email || '-'}</p>
                    <p className="text-slate-700 dark:text-slate-200">Client Group: {selectedPaymentPayee.client_grouping || '-'}</p>
                    <p className="text-slate-700 dark:text-slate-200">Client A/C No.: {selectedPaymentPayee.client_account_number || '-'}</p>
                    <p className="text-slate-700 dark:text-slate-200">VAT/PIN: {selectedPaymentPayee.vat_pin_number || '-'}</p>
                    <p className="text-slate-700 dark:text-slate-200">Payable A/C: {selectedPaymentPayee.payable_account || '-'}</p>
                    <p className="text-slate-700 dark:text-slate-200">Bank/Cash: {selectedPaymentPayee.default_bank_cash || '-'}</p>
                    <p className="text-slate-700 dark:text-slate-200">Bank Name: {selectedPaymentPayee.bank_name || '-'}</p>
                    <p className="text-slate-700 dark:text-slate-200">Bank Account Name: {selectedPaymentPayee.bank_account_name || '-'}</p>
                    <p className="text-slate-700 dark:text-slate-200">Bank Account No.: {selectedPaymentPayee.bank_account_number || '-'}</p>
                    <p className="text-slate-700 dark:text-slate-200">M-Pesa Number: {selectedPaymentPayee.mpesa_phone_number || '-'}</p>
                  </div>
                </div>
              ) : null}

              {allocationsLoading ? (
                <div className="rounded-[24px] border border-dashed border-gray-200 px-4 py-6 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                  Loading allocation details...
                </div>
              ) : selectedPaymentAllocations.length > 0 ? (
                <div>
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Bill Allocation</p>
                  <div className="overflow-x-auto rounded-[24px] border border-gray-200 dark:border-white/10">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#fff7f2] dark:bg-[#082131]">
                        <tr className="text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                          <th className="px-3 py-3">Date</th>
                          <th className="px-3 py-3">Inv No.</th>
                          <th className="px-3 py-3">Particular</th>
                          <th className="px-3 py-3 text-center">Qty</th>
                          <th className="px-3 py-3">Unit Cost</th>
                          <th className="px-3 py-3">Amt Due</th>
                          <th className="px-3 py-3">Payment</th>
                          <th className="px-3 py-3">New Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPaymentAllocations.map((row) => (
                          <tr key={row.id} className="border-t border-gray-200 dark:border-white/10 text-[13px]">
                            <td className="px-3 py-3 text-slate-700 dark:text-slate-200 whitespace-nowrap">{formatDateLabel(row.bill_date)}</td>
                            <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{row.invoice_number || '-'}</td>
                            <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                              <div className="font-medium">{row.particular || '-'}</div>
                              {row.specification ? (
                                <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 italic">
                                  {row.specification}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-3 py-3 text-slate-700 dark:text-slate-200 text-center font-bold">{row.quantity || 1}</td>
                            <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{formatMoney(toNumber(row.unit_cost), selectedPayment.currency || 'KES')}</td>
                            <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{formatMoney(toNumber(row.amount_due), selectedPayment.currency || 'KES')}</td>
                            <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{formatMoney(toNumber(row.payment_amount), selectedPayment.currency || 'KES')}</td>
                            <td className="px-3 py-3 text-slate-700 dark:text-slate-200">{formatMoney(toNumber(row.new_balance), selectedPayment.currency || 'KES')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {selectedPayment.voucher_notes ? (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Notes</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{selectedPayment.voucher_notes}</p>
                </div>
              ) : null}

              {selectedPayment.signature_data_url ? (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Digital Signature</p>
                  <div className="mt-2 rounded-[20px] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <img
                      src={selectedPayment.signature_data_url}
                      alt="Digital signature"
                      className="max-h-24 max-w-full object-contain"
                    />
                  </div>
                </div>
              ) : null}

              {(selectedPayment.attachment_urls || []).length > 0 ? (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Attachments</p>
                  <div className="mt-2 flex flex-col gap-2">
                    {(selectedPayment.attachment_urls || []).map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" className="text-sm font-medium text-[#ff6a00] hover:text-[#e85f00] dark:text-[#ffb37a]">
                        {url}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            ) : null}
          </div>
        ) : null}

        <div className={panelCls}>
          <div className="mb-4 flex flex-col gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Voucher Register</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Payment Voucher History</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Approved and paid vouchers from the payments workflow.</p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className={`${inputCls} pl-9`}
                  placeholder="Search payee, reference, method..."
                />
              </div>
              <div className="flex gap-3">
                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | PaymentType)} className={inputCls}>
                  <option value="all">All payment types</option>
                  <option value="apply_to_bill">Apply to bill</option>
                  <option value="cash_payment">Cash payment</option>
                </select>
                <button type="button" onClick={resetFilters} className={subtleButtonCls}>
                  <RotateCcw size={16} />
                  Reset
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[24px] border border-gray-200 dark:border-white/10">
            <table className="min-w-full text-sm">
              <thead className="bg-[#fff7f2] dark:bg-[#082131]">
                <tr className="text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3">Voucher #</th>
                  <th className="px-4 py-3">Payee</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Recording Date</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => {
                  const payee = payeeMap[payment.payee_id || ''];
                  return (
                    <tr key={payment.id} className="border-t border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition">
                      <td className="px-4 py-3 text-slate-900 dark:text-white font-semibold">{payment.payment_number || 'Unnumbered'}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{payee?.payee_name || 'Unknown payee'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${payment.payment_type === 'apply_to_bill' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200'}`}>
                          {payment.payment_type === 'apply_to_bill' ? 'Bill' : 'Cash'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{formatDateLabel(payment.recording_date)}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{payment.payment_method || '-'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">{formatMoney(toNumber(payment.amount), payment.currency || 'KES')}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedPaymentId(payment.id)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:border-[#ff6a00]/40 dark:hover:bg-white/[0.06]"
                        >
                          <Eye size={14} />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredPayments.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
              No approved payment vouchers match the current filters yet.
            </div>
          ) : null}
        </div>
      </div>

      {showEditForm && editForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[32px] border border-gray-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#071b27]">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-4 dark:border-white/10">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Edit Voucher</p>
                <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">Update Payment Details</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Keep audit context intact while updating the voucher fields.</p>
              </div>
              <button type="button" onClick={() => setShowEditForm(false)} className={subtleButtonCls}>
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelCls}>Recording Date</label>
                <input
                  type="date"
                  value={editForm.recordingDate}
                  onChange={(event) => handleEditChange('recordingDate', event.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Payment Method</label>
                <input
                  value={editForm.paymentMethod}
                  onChange={(event) => handleEditChange('paymentMethod', event.target.value)}
                  className={inputCls}
                  placeholder="Bank Transfer, Cash, M-Pesa..."
                />
              </div>
              <div>
                <label className={labelCls}>Pay From Account</label>
                <input
                  value={editForm.payFromAccount}
                  onChange={(event) => handleEditChange('payFromAccount', event.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Cost Center</label>
                <input
                  value={editForm.costCenter}
                  onChange={(event) => handleEditChange('costCenter', event.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Expense Group</label>
                <input
                  value={editForm.expenseGroup}
                  onChange={(event) => handleEditChange('expenseGroup', event.target.value)}
                  className={inputCls}
                  placeholder="Utilities, Fuel, Salaries..."
                />
              </div>
              <div>
                <label className={labelCls}>Reference Number</label>
                <input
                  value={editForm.referenceNumber}
                  onChange={(event) => handleEditChange('referenceNumber', event.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Currency</label>
                <input
                  value={editForm.currency}
                  onChange={(event) => handleEditChange('currency', event.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(event) => handleEditChange('amount', event.target.value)}
                  className={inputCls}
                  disabled={selectedPaymentAllocations.length > 0}
                />
                {selectedPaymentAllocations.length > 0 ? (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Amount editing is locked when allocation rows exist. Adjust allocations to change the total.
                  </p>
                ) : null}
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Voucher Notes</label>
                <textarea
                  rows={4}
                  value={editForm.voucherNotes}
                  onChange={(event) => handleEditChange('voucherNotes', event.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setShowEditForm(false)} className={subtleButtonCls}>
                Cancel
              </button>
              <button type="button" onClick={saveEdit} className={primaryButtonCls} disabled={saving}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </div>
  );
};

export default FinancePaymentVouchers;
