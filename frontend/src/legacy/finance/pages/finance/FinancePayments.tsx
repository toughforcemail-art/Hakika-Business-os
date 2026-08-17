// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, CircleAlert, Download, Edit3, Plus, Printer, Receipt, RotateCcw, Search, Wallet } from 'lucide-react';
import { escapeHtml, printDocument } from '../../utils/printHelpers';
import { useNavigate, useParams } from 'react-router-dom';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import DigitalSignaturePad from '../../components/finance/DigitalSignaturePad';
import { useAccess } from '../../hooks/useAccess';
import { resolveOrganizationScope } from '../../utils/organizationScope';
import { fetchRowsInBatches } from '../../utils/fetchRowsInBatches';
import { supabase } from '../../utils/supabase';
import { generateInvoiceNumber } from '../../utils/invoiceNumbers';
import financeProviderSyncService, { FinanceProviderConnection } from '../../services/financeProviderSyncService';
import financeDepositAccountsService, { FinanceDepositAccount } from '../../services/financeDepositAccountsService';
import FinanceAccountSelect from './components/FinanceAccountSelect';

type PaymentType = 'apply_to_bill' | 'cash_payment';
type ReferenceOptionType = 'cost_center' | 'pay_from_account' | 'payment_method';
type BankChargeMode = 'included_in_total' | 'additional_expense';

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
  payable_account: string | null;
  default_bank_cash: string | null;
  payment_method: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  mpesa_phone_number: string | null;
  payment_information: string | null;
  agreement_date: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  notes: string | null;
  is_approved: boolean;
}

interface FinancePayment {
  id: string;
  organization_id: string;
  entity: string | null;
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


interface ApprovedFinanceRequisition {
  id: string;
  requisition_number: string;
  title: string;
  department: string | null;
  needed_by: string | null;
  vendor_preference: string | null;
  justification: string | null;
  notes: string | null;
  bank_charge_amount: number;
  bank_charge_mode: BankChargeMode;
  charge_bank_account_id: string | null;
  status: 'approved';
  created_at: string;
}

interface ApprovedFinanceRequisitionItem {
  id: string;
  requisition_id: string;
  item_description: string;
  specification: string | null;
  quantity: number;
  unit_cost: number;
  line_total: number;
  preferred_vendor: string | null;
  display_order: number;
}

interface PaymentReferenceOption {
  id: string;
  organization_id: string;
  option_type: ReferenceOptionType;
  option_value: string;
}

interface FinancePayeeClientGroup {
  id: string;
  organization_id: string;
  group_name: string;
}

interface ExpenseGroup {
  id: string;
  organization_id: string;
  group_name: string;
  created_at: string;
}

interface FinanceCompany {
  id: string;
  name: string;
  code: string | null;
  organization_id: string | null;
}

interface FinanceReceipt {
  id: string;
  receipt_number: string | null;
  receipt_date: string;
  amount: number;
  description: string | null;
  category: string | null;
  payment_method: string | null;
  currency?: string | null;
  received_from?: string | null;
  invoice_id?: string | null;
  notes?: string | null;
}

interface FinanceInvoice {
  id: string;
  invoice_number: string | null;
  invoice_date: string;
  due_date: string | null;
  total_amount: number;
  amount_paid: number;
  status: string;
  transaction_class: string;
  currency: string;
  accounts_receivable_account?: string | null;
  bill_to: string | null;
  notes: string | null;
}

interface AllocationDraft {
  entity: string;
  expense_group: string;
  bill_date: string;
  invoice_number: string;
  particular: string;
  specification: string;
  payable_total: string;
  quantity: string;
  unit_cost: string;
  wht_tax: string;
  paid_to_date: string;
  payment_amount: string;
}

interface PaymentFormState {
  sourceRequisitionIds: string[];
  paymentType: PaymentType;
  entity: string;
  payeeIds: string[];
  payFromAccount: string;
  payFromAccountId: string;
  costCenter: string;
  expenseGroup: string;
  paymentMethod: string;
  isPostDatedCheque: boolean;
  referenceNumber: string;
  chequeDate: string;
  currency: string;
  spotRate: string;
  recordingDate: string;
  amount: string;
  bankChargeAmount: string;
  quantity: string;
  unitCost: string;
  specification: string;
  description: string;
  voucherNotes: string;
  payeeReferences: string;
  preparedBy: string;
  signature: string;
  signatureDataUrl: string;
  signatureMode: 'draw' | 'text';
  checkedBy: string;
  approvedByName: string;
  receivedBy: string;
  signoffDate: string;
  attachmentUrlsText: string;
  allocationRows: AllocationDraft[];
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
}

interface ReferenceOptionFormState {
  type: ReferenceOptionType;
  value: string;
}

interface ClientGroupFormState {
  value: string;
}

interface ManualInvoiceFormState {
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  bill_to: string;
  transaction_class: string;
  receivable_account: string;
  currency: string;
  amount: string;
  notes: string;
}

interface ManualDepositFormState {
  receipt_number: string;
  receipt_date: string;
  amount: string;
  payment_method: string;
  currency: string;
  received_from: string;
  description: string;
  category: string;
  invoice_number: string;
  notes: string;
}

interface ConnectionFormState {
  connection_name: string;
  provider: 'equity' | 'absa' | 'manual_import';
  sync_mode: 'statement_import' | 'api';
  bank_account_id: string;
}

interface StatementImportFormState {
  connection_id: string;
  payload_text: string;
}

const CURRENCY_OPTIONS = ['KES', 'USD', 'EUR', 'GBP'];
const ENTITY_OPTIONS = ['Hakika Real Estate', 'Toughforce Security', 'Property', 'Branch', 'Group Services'];
const ACCOUNT_OPTIONS = ['ABSA', 'Cash Office', 'Equity Bank', 'KCB', 'M-Pesa Float', 'Petty Cash'];
const COST_CENTER_OPTIONS = ['Administration', 'Finance', 'Operations', 'Projects', 'Shared Services'];
const DEFAULT_CLIENT_GROUPS = ['Security', 'Real Estate', 'Facilities', 'Projects', 'Shared Services'];
const DEFAULT_EXPENSE_GROUPS = ['Utilities', 'Fuel', 'Salaries', 'Maintenance', 'Office Supplies'];
const DEFAULT_RECEIVABLE_ACCOUNT = 'ABSA';
const RECEIPT_CATEGORY_OPTIONS = ['Operations', 'Utilities', 'Maintenance', 'Rent', 'Professional Services', 'Other'];
const ENTITY_BRANDING: Record<string, { initials: string; displayName: string; addressLines: string[] }> = {
  'Hakika Real Estate': {
    initials: 'HR',
    displayName: 'Hakika Real Estate',
    addressLines: ['Official address not configured yet'],
  },
  'Toughforce Security': {
    initials: 'TS',
    displayName: 'Toughforce Security',
    addressLines: ['Official address not configured yet'],
  },
  Property: {
    initials: 'PR',
    displayName: 'Property',
    addressLines: ['Official address not configured yet'],
  },
  Branch: {
    initials: 'BR',
    displayName: 'Branch',
    addressLines: ['Official address not configured yet'],
  },
  'Group Services': {
    initials: 'GS',
    displayName: 'Group Services',
    addressLines: ['Official address not configured yet'],
  },
};

const panelCls = 'min-w-0 rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_24px_90px_-48px_rgba(15,23,42,0.42)] backdrop-blur-xl transition duration-300 dark:border-white/10 dark:bg-dark-surface';
const inputCls = 'w-full rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-900 outline-none transition duration-200 placeholder:text-slate-400 focus:border-[#ff6a00] focus:bg-white focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#ff6a00] dark:focus:bg-slate-900';
const allocationTableInputCls = 'h-11 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] outline-none transition duration-200 placeholder:text-slate-400 focus:border-[#ff6a00] focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#ff6a00]';
const allocationNumericInputCls = `${allocationTableInputCls} text-right font-medium tabular-nums`;
const allocationReadOnlyCellCls = 'whitespace-nowrap rounded-2xl border border-slate-200/80 bg-slate-50 px-3 py-3 text-right font-semibold tabular-nums text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100';
const labelCls = 'mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400';
const subtleButtonCls = 'inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition duration-200 hover:border-[#ff6a00]/30 hover:bg-[#ff6a00]/5 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.03]/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white hover:scale-[1.01] active:scale-[0.99]';
const primaryButtonCls = 'inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ff6a00] via-[#ff7a1a] to-[#ff9a4d] px-5 py-2.5 text-sm font-bold text-white shadow-[0_18px_45px_-22px_rgba(255,106,0,0.85)] transition duration-200 hover:from-[#e85f00] hover:to-[#ff7315] hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:scale-100';
const iconActionButtonCls = 'inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#ff6a00]/20 bg-[#ff6a00]/6 text-[#ff6a00] transition duration-200 hover:bg-[#ff6a00]/12 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#ff6a00]/25 dark:bg-[#ff6a00]/12 dark:text-[#ffb37a] dark:hover:bg-[#ff6a00]/20';
const heroStatCls = 'rounded-[24px] border border-white/70 bg-white/80 p-5 shadow-[0_18px_70px_-44px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]';
const pageShellCls = 'min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(255,106,0,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(15,118,110,0.10),_transparent_22%),linear-gradient(180deg,_#f7f8fc_0%,_#eef2f7_100%)] p-4 text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,_rgba(255,106,0,0.08),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.06),_transparent_20%),linear-gradient(180deg,_#0b2233_0%,_#10293d_100%)] dark:text-white sm:p-6 lg:p-8';
const heroBadgeCls = 'inline-flex items-center gap-2 rounded-full border border-[#ff6a00]/15 bg-[#ff6a00]/8 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-[#c95500] dark:border-[#ff6a00]/20 dark:bg-[#ff6a00]/10 dark:text-[#ffb37a]';
const sectionCardCls = 'overflow-hidden rounded-[30px] border border-white/70 bg-white/88 shadow-[0_26px_90px_-52px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]';
const sectionHeaderCls = 'border-b border-white/60 bg-gradient-to-r from-[#fff7f0] via-white to-[#f7fbfd] px-6 py-5 dark:border-white/10 dark:from-white/[0.05] dark:via-white/[0.03] dark:to-white/[0.02]';
const sectionEyebrowCls = 'text-[11px] font-black uppercase tracking-[0.24em] text-[#ff6a00] dark:text-[#ffb37a]';
const workflowChipCls = 'rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300';


const todayString = () => new Date().toISOString().slice(0, 10);
const buildReceiptNumber = (date = todayString()) => `RCP-${date.replaceAll('-', '')}-${Date.now().toString().slice(-5)}`;

const createAllocationRow = (): AllocationDraft => ({
  entity: '',
  expense_group: '',
  bill_date: '',
  invoice_number: '',
  particular: '',
  specification: '',
  payable_total: '',
  quantity: '1',
  unit_cost: '',
  wht_tax: '',
  paid_to_date: '',
  payment_amount: '',
});

const createPaymentForm = (defaults: Partial<Pick<PaymentFormState, 'preparedBy' | 'checkedBy' | 'approvedByName' | 'receivedBy' | 'signoffDate' | 'signature'>> = {}): PaymentFormState => ({
  sourceRequisitionIds: [],
  paymentType: 'apply_to_bill',
  entity: 'Hakika Real Estate',
  payeeIds: [],
  payFromAccount: 'ABSA',
  payFromAccountId: '',
  costCenter: 'Finance',
  expenseGroup: '',
  paymentMethod: 'Bank Transfer',
  isPostDatedCheque: false,
  referenceNumber: '',
  chequeDate: '',
  currency: 'KES',
  spotRate: '1',
  recordingDate: todayString(),
  amount: '0',
  bankChargeAmount: '0',
  quantity: '1',
  unitCost: '0',
  specification: '',
  description: '',
  voucherNotes: '',
  payeeReferences: '',
  preparedBy: defaults.preparedBy || '',
  signature: defaults.signature || '',
  signatureDataUrl: '',
  signatureMode: 'text',
  checkedBy: defaults.checkedBy || '',
  approvedByName: defaults.approvedByName || '',
  receivedBy: defaults.receivedBy || '',
  signoffDate: defaults.signoffDate || todayString(),
  attachmentUrlsText: '',
  allocationRows: [createAllocationRow()],
});

const createTextSignatureDataUrl = (signatureText: string) => {
  const text = signatureText.trim() || 'Signature';
  const width = Math.max(280, Math.min(560, text.length * 14 + 120));
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="110" viewBox="0 0 ${width} 110">
      <rect width="100%" height="100%" rx="18" ry="18" fill="white" />
      <path d="M24 74 C 78 22, 146 22, 198 72 S 318 124, 420 68" fill="none" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" />
      <text x="50%" y="66" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="34" font-style="italic" font-weight="600" fill="#0f172a">${escapeHtml(text)}</text>
      <text x="50%" y="92" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" letter-spacing="0.18em" fill="#64748b">TYPED SIGNATURE</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.trim())}`;
};

const buildVoucherSignoffNotes = (form: PaymentFormState) =>
  [
    form.preparedBy.trim() ? `Prepared by: ${form.preparedBy.trim()}` : null,
    form.signature.trim() ? `Signature: ${form.signature.trim()}` : null,
    form.checkedBy.trim() ? `Checked by: ${form.checkedBy.trim()}` : null,
    form.approvedByName.trim() ? `Approved by: ${form.approvedByName.trim()}` : null,
    form.receivedBy.trim() ? `Received by: ${form.receivedBy.trim()}` : null,
    form.signoffDate.trim() ? `Date: ${form.signoffDate.trim()}` : null,
  ]
    .filter(Boolean)
    .join('\n');

const createPayeeForm = (): PayeeFormState => ({
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
});

const createReferenceOptionForm = (type: ReferenceOptionType): ReferenceOptionFormState => ({
  type,
  value: '',
});

const referenceOptionMeta: Record<ReferenceOptionType, { label: string; fieldLabel: string; placeholder: string }> = {
  cost_center: {
    label: 'Cost Center',
    fieldLabel: 'Cost Center Name',
    placeholder: 'Enter cost center',
  },
  pay_from_account: {
    label: 'Pay From A/C',
    fieldLabel: 'Account Name',
    placeholder: 'Enter account name',
  },
  payment_method: {
    label: 'Payment Method',
    fieldLabel: 'Payment Method',
    placeholder: 'Bank Transfer, Cash, EFT...',
  },
};

const createClientGroupForm = (): ClientGroupFormState => ({
  value: '',
});

const createManualInvoiceForm = (): ManualInvoiceFormState => ({
  invoice_number: generateInvoiceNumber('FIN'),
  invoice_date: todayString(),
  due_date: '',
  bill_to: '',
  transaction_class: 'Security Services',
  receivable_account: DEFAULT_RECEIVABLE_ACCOUNT,
  currency: 'KES',
  amount: '',
  notes: '',
});

const createManualDepositForm = (): ManualDepositFormState => ({
  receipt_number: '',
  receipt_date: todayString(),
  amount: '',
  payment_method: 'Cash',
  currency: 'KES',
  received_from: '',
  description: '',
  category: 'Operations',
  invoice_number: '',
  notes: '',
});

const createConnectionForm = (): ConnectionFormState => ({
  connection_name: '',
  provider: 'manual_import',
  sync_mode: 'statement_import',
  bank_account_id: '',
});

const createStatementImportForm = (): StatementImportFormState => ({
  connection_id: '',
  payload_text: '',
});

const normalizeText = (value?: string | null) => value?.trim().toLowerCase() || '';
const normalizeOptionValue = (value?: string | null) => value?.trim() || '';
const mergeOptionValues = (defaults: string[], values: string[]) =>
  Array.from(new Set([...defaults, ...values.map((value) => normalizeOptionValue(value)).filter(Boolean)])).sort((left, right) =>
    left.localeCompare(right),
  );
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
const paymentNumber = () => {
  const stamp = new Date().toISOString().split('.')[0].replace('T', '').replaceAll('-', '').replaceAll(':', '');
  return `PM-${stamp.slice(0, 14)}`;
};
const numberToWords = (value: number) => {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return 'Zero only';
  const ones = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const scales = ['', 'Thousand', 'Million', 'Billion'];

  const chunkToWords = (chunk: number) => {
    const parts: string[] = [];
    const hundred = Math.floor(chunk / 100);
    const rem = chunk % 100;
    if (hundred) parts.push(`${ones[hundred]} Hundred`);
    if (rem >= 20) {
      parts.push(tens[Math.floor(rem / 10)]);
      if (rem % 10) parts.push(ones[rem % 10].toLowerCase());
    } else if (rem >= 10) {
      parts.push(teens[rem - 10]);
    } else if (rem > 0) {
      parts.push(ones[rem]);
    }
    return parts.join(' ');
  };

  const chunks: number[] = [];
  let remaining = n;
  while (remaining > 0) {
    chunks.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const words = chunks
    .map((chunk, index) => (chunk ? `${chunkToWords(chunk)} ${scales[index]}`.trim() : ''))
    .filter(Boolean)
    .reverse()
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${words} only`;
};
const attachmentListFromText = (value: string) => value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
const computeAmountDue = (row: AllocationDraft) => toNumber(row.payable_total) - toNumber(row.wht_tax) - toNumber(row.paid_to_date);
const computeNewBalance = (row: AllocationDraft) => computeAmountDue(row) - toNumber(row.payment_amount);
const errorText = (error: any) => `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
const isMissingBankAccountMetaColumn = (error: any) => {
  const message = errorText(error);
  return (
    message.includes('re_bank_accounts.module') ||
    message.includes('re_bank_accounts.entity') ||
    (message.includes('re_bank_accounts') && message.includes(`'module' column`)) ||
    (message.includes('re_bank_accounts') && message.includes(`'entity' column`)) ||
    (message.includes('schema cache') && message.includes('re_bank_accounts') && message.includes('module')) ||
    (message.includes('schema cache') && message.includes('re_bank_accounts') && message.includes('entity'))
  );
};
const isMissingFinanceWorkflow = (error: any) => {
  const message = errorText(error);
  return (
    message.includes('finance_payees') ||
    message.includes('finance_payee_client_groups') ||
    message.includes('finance_payment_allocations') ||
    message.includes('finance_payment_reference_options') ||
    message.includes('payee_id') ||
    message.includes('bank_account_number') ||
    message.includes('mpesa_phone_number') ||
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

const resolveInvoiceStatus = (currentStatus: string, dueDate: string | null, totalAmount: number, amountPaid: number) => {
  const normalized = normalizeText(currentStatus) || 'sent';
  if (amountPaid >= totalAmount && totalAmount > 0) return 'paid';
  if (amountPaid > 0) return 'partial';
  if (dueDate) {
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (due < today) return 'overdue';
  }
  return normalized === 'draft' ? 'draft' : 'sent';
};

interface FinancePaymentsProps {
  embedded?: boolean;
}

const FinancePayments: React.FC<FinancePaymentsProps> = ({ embedded = false }) => {
  const navigate = useNavigate();
  const { invoiceId, receiptId } = useParams<{ invoiceId?: string; receiptId?: string }>();
  const { profile } = useAccess();
  const isManualInvoiceEditorRoute = Boolean(invoiceId);
  const isManualDepositEditorRoute = Boolean(receiptId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workflowReady, setWorkflowReady] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationNotice, setOrganizationNotice] = useState<string | null>(null);
  const [dataNotice, setDataNotice] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [showPayeeForm, setShowPayeeForm] = useState(false);
  const [showReferenceOptionForm, setShowReferenceOptionForm] = useState<ReferenceOptionType | null>(null);
  const [payees, setPayees] = useState<FinancePayee[]>([]);
  const [payments, setPayments] = useState<FinancePayment[]>([]);
  const [manualInvoices, setManualInvoices] = useState<FinanceInvoice[]>([]);
  const [manualDeposits, setManualDeposits] = useState<FinanceReceipt[]>([]);
  const [referenceOptions, setReferenceOptions] = useState<PaymentReferenceOption[]>([]);
  const [clientGroups, setClientGroups] = useState<FinancePayeeClientGroup[]>([]);
  const [bankAccounts, setBankAccounts] = useState<FinanceDepositAccount[]>([]);
  const [approvedRequisitions, setApprovedRequisitions] = useState<ApprovedFinanceRequisition[]>([]);
  const [approvedRequisitionItems, setApprovedRequisitionItems] = useState<ApprovedFinanceRequisitionItem[]>([]);
  const [approvedRequisitionItemsLoading, setApprovedRequisitionItemsLoading] = useState(false);
  const [approvedRequisitionSearch, setApprovedRequisitionSearch] = useState('');
  const [providerConnections, setProviderConnections] = useState<FinanceProviderConnection[]>([]);
  const [providerNotice, setProviderNotice] = useState<string | null>(null);

  const findBankAccountByLabel = (label?: string | null) =>
    bankAccounts.find((account) => financeDepositAccountsService.formatAccountLabel(account) === normalizeOptionValue(label)) || null;
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(createPaymentForm());
  const [voucherPreviewNumber, setVoucherPreviewNumber] = useState(() => paymentNumber());
  const [payeeForm, setPayeeForm] = useState<PayeeFormState>(createPayeeForm());
  const [referenceOptionForm, setReferenceOptionForm] = useState<ReferenceOptionFormState>(createReferenceOptionForm('cost_center'));
  const [showClientGroupForm, setShowClientGroupForm] = useState(false);
  const [clientGroupForm, setClientGroupForm] = useState<ClientGroupFormState>(createClientGroupForm());
  const [expenseGroups, setExpenseGroups] = useState<ExpenseGroup[]>([]);
  const [showExpenseGroupForm, setShowExpenseGroupForm] = useState(false);
  const [expenseGroupForm, setExpenseGroupForm] = useState<ClientGroupFormState>(createClientGroupForm());
  const [showManualInvoiceForm, setShowManualInvoiceForm] = useState(false);
  const [manualInvoiceForm, setManualInvoiceForm] = useState<ManualInvoiceFormState>(createManualInvoiceForm());
  const [editingManualInvoiceId, setEditingManualInvoiceId] = useState<string | null>(null);
  const [showManualDepositForm, setShowManualDepositForm] = useState(false);
  const [manualDepositForm, setManualDepositForm] = useState<ManualDepositFormState>(createManualDepositForm());
  const [editingManualDepositId, setEditingManualDepositId] = useState<string | null>(null);
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [connectionForm, setConnectionForm] = useState<ConnectionFormState>(createConnectionForm());
  const [showStatementImport, setShowStatementImport] = useState(false);
  const [statementImportForm, setStatementImportForm] = useState<StatementImportFormState>(createStatementImportForm());
  const [lastSavedVoucherPayment, setLastSavedVoucherPayment] = useState<FinancePayment | null>(null);
  const [lastSavedVoucherAllocations, setLastSavedVoucherAllocations] = useState<FinancePaymentAllocation[]>([]);
  const profileName = profile?.full_name?.trim() || profile?.email?.split('@')[0]?.trim() || '';
  const normalizedRole = normalizeText(profile?.role);
  const signerName = profileName || 'User';
  const defaultSignoffValues = {
    preparedBy: profileName,
    signature: profileName,
    checkedBy: profileName,
    approvedByName: ['super admin', 'director', 'administrator', 'finance manager', 'accountant'].some((role) => normalizedRole.includes(role))
      ? profileName
      : '',
    receivedBy: '',
    signoffDate: todayString(),
  };

  const loadData = async () => {
    setLoading(true);

    try {
      const scope = await resolveOrganizationScope(profile);
      setOrganizationId(scope.organizationId);
      setOrganizationNotice(scope.notice);
      setDataNotice(null);

      if (!scope.organizationId) {
        setWorkflowReady(false);
        setPayees([]);
        setPayments([]);
        setManualInvoices([]);
        setManualDeposits([]);
        setReferenceOptions([]);
        setClientGroups([]);
        setApprovedRequisitions([]);
        setApprovedRequisitionItems([]);
        setProviderConnections([]);
        setProviderNotice(null);
        setOrganizationNotice('Your profile is not linked to an organization yet, so finance payments cannot be loaded.');
        return;
      }

      const [payeesResponse, paymentsResponse, referenceOptionsResponse, clientGroupResponse, expenseGroupResponse] = await Promise.all([
        supabase
          .from('finance_payees')
          .select('id, payee_name, client_grouping, client_account_number, vat_pin_number, contact_person, telephone_number, email, invoicing_address, shipping_address, transaction_currency, payable_account, default_bank_cash, payment_method, bank_name, bank_account_name, bank_account_number, mpesa_phone_number, payment_information, agreement_date, contract_start_date, contract_end_date, notes, is_approved')
          .eq('organization_id', scope.organizationId)
          .eq('is_active', true)
          .eq('is_approved', true)
          .order('payee_name', { ascending: true }),
        supabase
          .from('finance_payments')
          .select('id, organization_id, entity, payee_id, source_requisition_id, payment_number, payment_date, payment_type, pay_from_account, pay_from_account_id, cost_center, expense_group, amount, description, payment_method, reference_number, cheque_date, is_post_dated_cheque, currency, spot_rate, recording_date, voucher_notes, signature_data_url, attachment_urls, status, created_at')
          .eq('organization_id', scope.organizationId)
          .order('recording_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('finance_payment_reference_options')
          .select('id, organization_id, option_type, option_value')
          .eq('organization_id', scope.organizationId)
          .order('option_value', { ascending: true }),
        supabase
          .from('finance_payee_client_groups')
          .select('id, organization_id, group_name')
          .eq('organization_id', scope.organizationId)
          .order('group_name', { ascending: true }),
        supabase
          .from('finance_expense_groups')
          .select('id, organization_id, group_name, created_at')
          .eq('organization_id', scope.organizationId)
          .order('group_name', { ascending: true }),
      ]);

      let nextPaymentsResponse = paymentsResponse;
      if (paymentsResponse.error && isMissingFinancePaymentColumn(paymentsResponse.error, 'signature_data_url')) {
        nextPaymentsResponse = (await supabase
          .from('finance_payments')
          .select('id, organization_id, entity, payee_id, source_requisition_id, payment_number, payment_date, payment_type, pay_from_account, pay_from_account_id, cost_center, expense_group, amount, description, payment_method, reference_number, cheque_date, is_post_dated_cheque, currency, spot_rate, recording_date, voucher_notes, attachment_urls, status, created_at')
          .eq('organization_id', scope.organizationId)
          .order('recording_date', { ascending: false })
          .order('created_at', { ascending: false })) as typeof paymentsResponse;
      }

      const workflowError = payeesResponse.error || nextPaymentsResponse.error || referenceOptionsResponse.error || clientGroupResponse.error || expenseGroupResponse.error;
      if (workflowError) {
        if (isMissingFinanceWorkflow(workflowError)) {
          setWorkflowReady(false);
          setPayees([]);
          setPayments([]);
          setReferenceOptions([]);
          setClientGroups([]);
          setExpenseGroups([]);
          setDataNotice('The payment workflow needs the latest finance database update before this page can create payees, client groups, and payments.');
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
      setReferenceOptions((referenceOptionsResponse.data || []) as PaymentReferenceOption[]);
      setClientGroups((clientGroupResponse.data || []) as FinancePayeeClientGroup[]);
      setExpenseGroups((expenseGroupResponse.data || []) as ExpenseGroup[]);

      try {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('id, name, code, organization_id')
          .eq('organization_id', scope.organizationId)
          .order('name', { ascending: true });

        if (companyError) throw companyError;

        const companies = (companyData || []) as FinanceCompany[];
        const companyIds = companies.map((company) => company.id);
        const lookupCompanyIds = companyIds.length > 0
          ? companyIds
          : profile?.company_id
            ? [profile.company_id]
            : [];

        if (lookupCompanyIds.length === 0) {
          setBankAccounts([]);
        } else {
          let bankAccountsResponse = await supabase
            .from('re_bank_accounts')
            .select('id, company_id, bank_name, account_number, account_holder_name, account_type, currency, current_balance, is_active, module, entity')
            .in('company_id', lookupCompanyIds)
            .eq('is_active', true)
            .order('bank_name', { ascending: true })
            .order('account_number', { ascending: true });

          let fallbackBankAccountsResponse =
            bankAccountsResponse.error && isMissingBankAccountMetaColumn(bankAccountsResponse.error)
              ? await supabase
                .from('re_bank_accounts')
                .select('id, company_id, bank_name, account_number, account_holder_name, account_type, currency, current_balance, is_active')
                .in('company_id', lookupCompanyIds)
                .eq('is_active', true)
                .order('bank_name', { ascending: true })
                .order('account_number', { ascending: true })
              : bankAccountsResponse;

          if (fallbackBankAccountsResponse.error) throw fallbackBankAccountsResponse.error;

          let loadedAccounts = ((fallbackBankAccountsResponse.data || []) as Partial<FinanceDepositAccount>[]).map((account) => ({
            ...account,
            current_balance: toNumber(account.current_balance),
          })) as FinanceDepositAccount[];

          if (loadedAccounts.length === 0 && companyIds.length > 0 && profile?.company_id && !companyIds.includes(profile.company_id)) {
            const directCompanyResponse = await supabase
              .from('re_bank_accounts')
              .select('id, company_id, bank_name, account_number, account_holder_name, account_type, currency, current_balance, is_active, module, entity')
              .eq('company_id', profile.company_id)
              .eq('is_active', true)
              .order('bank_name', { ascending: true })
              .order('account_number', { ascending: true });

            const directCompanyFallback =
              directCompanyResponse.error && isMissingBankAccountMetaColumn(directCompanyResponse.error)
                ? await supabase
                  .from('re_bank_accounts')
                  .select('id, company_id, bank_name, account_number, account_holder_name, account_type, currency, current_balance, is_active')
                  .eq('company_id', profile.company_id)
                  .eq('is_active', true)
                  .order('bank_name', { ascending: true })
                  .order('account_number', { ascending: true })
                : directCompanyResponse;

            if (directCompanyFallback.error) throw directCompanyFallback.error;

            loadedAccounts = ((directCompanyFallback.data || []) as Partial<FinanceDepositAccount>[]).map((account) => ({
              ...account,
              current_balance: toNumber(account.current_balance),
            })) as FinanceDepositAccount[];
          }

          const serviceAccounts = await financeDepositAccountsService.listAccounts(lookupCompanyIds);
          const combined = [...loadedAccounts, ...serviceAccounts];
          const uniqueAccounts = combined.filter((account, index, self) =>
            self.findIndex((a) => a.id === account.id) === index
          );
          setBankAccounts(uniqueAccounts);
        }
      } catch (bankAccountError: any) {
        console.error('Failed to load finance bank accounts:', bankAccountError);
        try {
          const serviceAccounts = await financeDepositAccountsService.listAccounts();
          setBankAccounts(serviceAccounts);
        } catch {
          setBankAccounts([]);
        }
      }

      try {
        const { data: requisitionData, error: requisitionError } = await supabase
          .from('finance_requisitions')
          .select('id, requisition_number, title, department, needed_by, vendor_preference, justification, notes, bank_charge_amount, bank_charge_mode, charge_bank_account_id, status, created_at')
          .eq('organization_id', scope.organizationId)
          .eq('status', 'approved')
          .order('created_at', { ascending: false });

        if (requisitionError) throw requisitionError;

        const requisitions = (requisitionData || []) as ApprovedFinanceRequisition[];
        const usedRequisitionIds = new Set(nextPayments.map((payment) => payment.source_requisition_id).filter(Boolean));
        const availableRequisitions = requisitions.filter((entry) => !usedRequisitionIds.has(entry.id));
        const requisitionIds = availableRequisitions.map((entry) => entry.id);

        if (requisitionIds.length === 0) {
          setApprovedRequisitions([]);
          setApprovedRequisitionItems([]);
        } else {
          setApprovedRequisitions(availableRequisitions);
          setApprovedRequisitionItemsLoading(true);
          void (async () => {
            try {
              const requisitionItemsData = await fetchRowsInBatches<ApprovedFinanceRequisitionItem>({
                ids: requisitionIds,
                batchSize: 50,
                fetchBatch: async (batchIds) => {
                  const result = await supabase
                    .from('finance_requisition_items')
                    .select('id, requisition_id, item_description, specification, quantity, unit_cost, line_total, preferred_vendor, display_order')
                    .in('requisition_id', batchIds)
                    .order('display_order', { ascending: true });

                  return result;
                },
              });

              setApprovedRequisitionItems(requisitionItemsData);
            } catch (requisitionItemsError: any) {
              if (errorText(requisitionItemsError).includes('finance_requisition')) {
                setApprovedRequisitions([]);
                setApprovedRequisitionItems([]);
                setDataNotice('Apply the requisitions migration before using approvals.');
                return;
              }

              console.error('Failed to load approved requisition items:', requisitionItemsError);
            } finally {
              setApprovedRequisitionItemsLoading(false);
            }
          })();
        }
      } catch (requisitionError: any) {
        if (errorText(requisitionError).includes('finance_requisition')) {
        setApprovedRequisitions([]);
        setApprovedRequisitionItems([]);
      } else {
        throw requisitionError;
      }
    }

      try {
        const [invoiceResponse, receiptResponse] = await Promise.all([
          supabase
            .from('finance_invoices')
            .select('id, invoice_number, invoice_date, due_date, total_amount, amount_paid, status, transaction_class, currency, accounts_receivable_account, bill_to, notes')
            .eq('organization_id', scope.organizationId)
            .order('invoice_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(10),
          supabase
            .from('finance_receipts')
            .select('id, receipt_number, receipt_date, amount, description, category, payment_method, currency, received_from, invoice_id, notes')
            .eq('organization_id', scope.organizationId)
            .order('receipt_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(10),
        ]);

        if (invoiceResponse.error) throw invoiceResponse.error;
        if (receiptResponse.error) throw receiptResponse.error;

        setManualInvoices((invoiceResponse.data || []) as FinanceInvoice[]);
        setManualDeposits((receiptResponse.data || []) as FinanceReceipt[]);
      } catch (invoiceError: any) {
        console.error('Failed to load manual invoices or deposits:', invoiceError);
        setManualInvoices([]);
        setManualDeposits([]);
      }

      try {
        const connections = await financeProviderSyncService.listConnections();
        setProviderConnections(connections);
        setProviderNotice(null);
      } catch (connectionError: any) {
        console.error('Failed to load finance provider connections:', connectionError);
        setProviderConnections([]);
        setProviderNotice('Finance provider connections are not available yet. Apply the latest provider sync migration and edge function deployment.');
      }
    } catch (error: any) {
      console.error('Failed to load finance payment workflow:', error);
      setToast({ message: error.message || 'Failed to load finance payments.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      void loadData();
    }
  }, [profile]);

  useEffect(() => {
    if (!profileName) return;

    setPaymentForm((current) => {
      let next = current;
      if (!current.preparedBy.trim()) next = { ...next, preparedBy: profileName };
      if (!current.signature.trim()) next = { ...next, signature: profileName };
      if (!current.checkedBy.trim()) next = { ...next, checkedBy: profileName };
      if (!current.approvedByName.trim() && defaultSignoffValues.approvedByName) {
        next = { ...next, approvedByName: defaultSignoffValues.approvedByName };
      }
      if (!current.signoffDate.trim()) next = { ...next, signoffDate: defaultSignoffValues.signoffDate };
      return next;
    });
  }, [defaultSignoffValues.approvedByName, defaultSignoffValues.signoffDate, profileName]);

  const payeeMap = useMemo(
    () => Object.fromEntries(payees.map((payee) => [payee.id, payee])),
    [payees],
  );

  const filteredPayments = useMemo(() => payments, [payments]);

  const visibleAmount = useMemo(
    () => filteredPayments.reduce((sum, payment) => sum + toNumber(payment.amount), 0),
    [filteredPayments],
  );
  const payFromAccountOptions = useMemo(() => {
    const bankOptions = bankAccounts
      .map((account) => ({
        value: `bank:${account.id}`,
        label: financeDepositAccountsService.formatAccountLabel(account),
        accountId: account.id,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));

    const bankLabels = new Set(bankOptions.map((option) => option.label));
    const manualOptions = mergeOptionValues(
      ACCOUNT_OPTIONS,
      referenceOptions.filter((option) => option.option_type === 'pay_from_account').map((option) => option.option_value),
    )
      .filter((option) => !bankLabels.has(option))
      .map((option) => ({
        value: `label:${option}`,
        label: option,
        accountId: null,
      }));

    return [...bankOptions, ...manualOptions];
  }, [bankAccounts, referenceOptions]);
  const costCenterOptions = useMemo(
    () =>
      mergeOptionValues(
        COST_CENTER_OPTIONS,
        referenceOptions.filter((option) => option.option_type === 'cost_center').map((option) => option.option_value),
      ),
    [referenceOptions],
  );
  const clientGroupOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...DEFAULT_CLIENT_GROUPS,
          ...clientGroups.map((group) => group.group_name),
          ...payees.map((payee) => payee.client_grouping || '').filter(Boolean),
        ]),
      ).sort((left, right) => left.localeCompare(right)),
    [clientGroups, payees],
  );

  const expenseGroupOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...DEFAULT_EXPENSE_GROUPS,
          ...expenseGroups.map((group) => group.group_name),
        ]),
      ).sort((left, right) => left.localeCompare(right)),
    [expenseGroups],
  );

  const paymentMethodOptions = useMemo(
    () =>
      Array.from(
        new Set(referenceOptions.filter((option) => option.option_type === 'payment_method').map((option) => option.option_value)),
      ).sort((left, right) => left.localeCompare(right)),
    [referenceOptions],
  );

  useEffect(() => {
    setPaymentForm((current) => {
      if (paymentMethodOptions.length === 0) {
        return current.paymentMethod === '' ? current : { ...current, paymentMethod: '' };
      }

      if (paymentMethodOptions.includes(current.paymentMethod)) {
        return current;
      }

      return { ...current, paymentMethod: paymentMethodOptions[0] };
    });
  }, [paymentMethodOptions]);

  const totalPayees = payees.length;
  const selectedBankAccount =
    bankAccounts.find((account) => account.id === paymentForm.payFromAccountId) ||
    findBankAccountByLabel(paymentForm.payFromAccount) ||
    null;
  const projectedBankBalance = selectedBankAccount ? selectedBankAccount.current_balance - toNumber(paymentForm.amount) : null;
  const selectedPayFromAccountLabel = paymentForm.payFromAccount.trim();
  const selectedPayFromAccountSummary =
    selectedBankAccount ? (
      <div className="space-y-1 text-xs font-semibold">
        <p className="text-slate-500 dark:text-slate-400">
          Live bank balance: {formatMoney(selectedBankAccount.current_balance, selectedBankAccount.currency || paymentForm.currency)}
        </p>
        <p className={projectedBankBalance !== null && projectedBankBalance < 0 ? 'text-rose-600 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}>
          After this payment: {formatMoney(projectedBankBalance || 0, selectedBankAccount.currency || paymentForm.currency)}
          {projectedBankBalance !== null && projectedBankBalance < 0 ? ` (credit ${formatMoney(Math.abs(projectedBankBalance), selectedBankAccount.currency || paymentForm.currency)})` : ''}
        </p>
      </div>
    ) : selectedPayFromAccountLabel ? (
      <div className="rounded-2xl bg-white/70 px-4 py-3 text-xs text-slate-600 shadow-sm dark:bg-white/[0.03] dark:text-slate-300">
        <p className="font-semibold text-slate-900 dark:text-white">Selected account</p>
        <p className="mt-1 break-words">{selectedPayFromAccountLabel}</p>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          This account label is saved, but the live bank record was not matched on this device.
        </p>
      </div>
    ) : null;
  const selectedRequisitionIds = paymentForm.sourceRequisitionIds;
  const filteredApprovedRequisitions = useMemo(() => {
    const query = approvedRequisitionSearch.trim().toLowerCase();
    if (!query) return approvedRequisitions;

    return approvedRequisitions.filter((requisition) => {
      const haystack = [
        requisition.requisition_number,
        requisition.title,
        requisition.vendor_preference,
        requisition.department,
        requisition.justification,
        requisition.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [approvedRequisitions, approvedRequisitionSearch]);
  const selectedRequisitionSource =
    selectedRequisitionIds.length === 1
      ? approvedRequisitions.find((requisition) => requisition.id === selectedRequisitionIds[0]) || null
      : null;
  const selectedRequisitionSourceItems = selectedRequisitionSource
    ? approvedRequisitionItems.filter((item) => item.requisition_id === selectedRequisitionSource.id)
    : [];
  const selectedRequisitionTotal = selectedRequisitionSourceItems.reduce((sum, item) => sum + toNumber(item.line_total), 0)
    + toNumber(selectedRequisitionSource?.bank_charge_amount);
  const selectedRequisitionMultiTotal = selectedRequisitionIds.reduce((sum, requisitionId) => {
    const items = approvedRequisitionItems.filter((item) => item.requisition_id === requisitionId);
    const requisition = approvedRequisitions.find((entry) => entry.id === requisitionId);
    return sum + items.reduce((sub, item) => sub + toNumber(item.line_total), 0) + toNumber(requisition?.bank_charge_amount);
  }, 0);
  const currentAllocationTotal = paymentForm.allocationRows.reduce((sum, row) => sum + toNumber(row.payment_amount), 0);
  const currentUnallocated = toNumber(paymentForm.amount) - currentAllocationTotal;
  const voucherAmount = currentAllocationTotal > 0 ? currentAllocationTotal : toNumber(paymentForm.amount);
  const voucherAmountWords = numberToWords(voucherAmount);
  const selectedEntityBrand = ENTITY_BRANDING[paymentForm.entity] || ENTITY_BRANDING['Hakika Real Estate'];
  const normalizedPaymentMethod = paymentForm.paymentMethod.toLowerCase().replace(/[^a-z]/g, '');
  const referenceLabel =
    normalizedPaymentMethod.includes('mpesa')
      ? 'M-Pesa Reference'
      : normalizedPaymentMethod.includes('cheque')
        ? 'Cheque No.'
        : normalizedPaymentMethod.includes('bank') || normalizedPaymentMethod.includes('eft') || normalizedPaymentMethod.includes('rtgs')
          ? 'Bank Ref.'
          : 'Reference No.';
  const referencePlaceholder =
    normalizedPaymentMethod.includes('mpesa')
      ? 'M-Pesa code'
      : normalizedPaymentMethod.includes('cheque')
        ? 'Cheque number'
        : normalizedPaymentMethod.includes('bank') || normalizedPaymentMethod.includes('eft') || normalizedPaymentMethod.includes('rtgs')
          ? 'Bank reference'
        : 'Cheque no, EFT ref, MPesa code';
  const paymentBankChargeAmount = toNumber(paymentForm.bankChargeAmount);
  const hasSelectedPayee = paymentForm.payeeIds.length > 0;

  const handlePaymentFieldChange = <K extends keyof PaymentFormState>(field: K, value: PaymentFormState[K]) => {
    setPaymentForm((current) => {
      const next = { ...current, [field]: value };

      if (field === 'quantity' || field === 'unitCost') {
        const q = toNumber(next.quantity);
        const u = toNumber(next.unitCost);
        next.amount = `${q * u}`;
      }

      if (field === 'sourceRequisitionIds' && next.sourceRequisitionIds.length === 0) {
        next.payeeReferences = '';
      }

      return next;
    });
  };

  const handlePayFromAccountChange = (selection: string) => {
    if (!selection) {
      setPaymentForm((current) => ({ ...current, payFromAccount: '', payFromAccountId: '' }));
      return;
    }

    if (selection.startsWith('bank:')) {
      const accountId = selection.slice(5);
      const matchedAccount = bankAccounts.find((account) => account.id === accountId);
      setPaymentForm((current) => ({
        ...current,
        payFromAccount: matchedAccount ? financeDepositAccountsService.formatAccountLabel(matchedAccount) : current.payFromAccount,
        payFromAccountId: matchedAccount?.id || '',
      }));
      return;
    }

    const label = selection.startsWith('label:') ? selection.slice(6) : selection;
    setPaymentForm((current) => ({ ...current, payFromAccount: label, payFromAccountId: '' }));
  };

  const handleAllocationChange = (index: number, field: keyof AllocationDraft, value: string) => {
    setPaymentForm((current) => {
      const nextRows = [...current.allocationRows];
      const row = { ...nextRows[index], [field]: value };

      if (field === 'quantity' || field === 'unit_cost') {
        const q = toNumber(row.quantity);
        const u = toNumber(row.unit_cost);
        const total = q * u;
        row.payable_total = `${total}`;
        row.payment_amount = `${total}`;
      } else if (field === 'payment_amount') {
        row.payable_total = `${toNumber(value)}`;
      }

      nextRows[index] = row;
      const nextTotal = nextRows.reduce((sum, entry) => sum + toNumber(entry.payment_amount), 0);
      return { ...current, allocationRows: nextRows, amount: `${nextTotal}` };
    });
  };

  const addAllocationRow = () => {
    setPaymentForm((current) => ({
      ...current,
      allocationRows: [...current.allocationRows, createAllocationRow()],
    }));
  };

  const removeAllocationRow = (index: number) => {
    setPaymentForm((current) => ({
      ...current,
      allocationRows: current.allocationRows.length === 1
        ? [createAllocationRow()]
        : current.allocationRows.filter((_, rowIndex) => rowIndex !== index),
    }));
  };

  const resetPaymentForm = () => {
    setPaymentForm(createPaymentForm(defaultSignoffValues));
    setVoucherPreviewNumber(paymentNumber());
    setShowPayeeForm(false);
    setShowReferenceOptionForm(null);
  };

  const handlePayeeFieldChange = (field: keyof PayeeFormState, value: string) => {
    setPayeeForm((current) => ({ ...current, [field]: value }));
  };

  const togglePayeeSelection = (payeeId: string) => {
    setPaymentForm((current) => {
      const exists = current.payeeIds.includes(payeeId);
      const next = exists ? current.payeeIds.filter((id) => id !== payeeId) : [...current.payeeIds, payeeId];
      return { ...current, payeeIds: next };
    });
  };

  const clearPayeeSelection = () => {
    setPaymentForm((current) => ({ ...current, payeeIds: [] }));
  };

  const handleClientGroupFieldChange = (value: string) => {
    setClientGroupForm({ value });
  };

  const openPayeeComposer = () => {
    if (!workflowReady) {
      setToast({ message: 'Apply the payment voucher migration first, then create a payee.', type: 'warning' });
      return;
    }

    setPayeeForm(createPayeeForm());
    setShowPayeeForm(true);
  };

  const openReferenceOptionForm = (type: ReferenceOptionType) => {
    if (!workflowReady) {
      setToast({ message: 'Apply the payment voucher migration first, then add payment options.', type: 'warning' });
      return;
    }

    setReferenceOptionForm(createReferenceOptionForm(type));
    setShowReferenceOptionForm(type);
  };

  const openClientGroupForm = () => {
    if (!workflowReady) {
      setToast({ message: 'Apply the payment voucher migration first, then add client groups.', type: 'warning' });
      return;
    }

    setClientGroupForm(createClientGroupForm());
    setShowClientGroupForm(true);
  };

  const openExpenseGroupForm = () => {
    if (!workflowReady) {
      setToast({ message: 'Apply the payment voucher migration first, then add expense groups.', type: 'warning' });
      return;
    }

    setExpenseGroupForm(createClientGroupForm());
    setShowExpenseGroupForm(true);
  };

  const buildAllocationRowsFromRequisition = (requisition: ApprovedFinanceRequisition, requisitionItems: ApprovedFinanceRequisitionItem[]) =>
    requisitionItems.length > 0
      ? requisitionItems.map((item) => ({
          ...createAllocationRow(),
          bill_date: requisition.needed_by || '',
          invoice_number: requisition.requisition_number,
          particular: item.item_description,
          specification: item.specification || '',
          payable_total: `${toNumber(item.line_total)}`,
          quantity: `${toNumber(item.quantity) || 1}`,
          unit_cost: `${toNumber(item.unit_cost)}`,
          wht_tax: '0',
          paid_to_date: '0',
          payment_amount: `${toNumber(item.line_total)}`,
        }))
      : [createAllocationRow()];

  const buildBankChargeAllocationRow = (requisition: ApprovedFinanceRequisition) => {
    const bankChargeAmount = toNumber(requisition.bank_charge_amount);
    if (bankChargeAmount <= 0) return [];

    return [
      {
        ...createAllocationRow(),
        bill_date: requisition.needed_by || '',
        invoice_number: `${requisition.requisition_number}-BC`,
        particular: 'Bank Charges',
        specification:
          requisition.bank_charge_mode === 'additional_expense'
            ? 'Posted as additional expense'
            : 'Included in main transaction',
        payable_total: `${bankChargeAmount}`,
        quantity: '1',
        unit_cost: `${bankChargeAmount}`,
        wht_tax: '0',
        paid_to_date: '0',
        payment_amount: `${bankChargeAmount}`,
      },
    ];
  };

  const hydratePaymentForRequisition = (requisitionId: string, current: PaymentFormState): PaymentFormState => {
    const requisition = approvedRequisitions.find((entry) => entry.id === requisitionId);
    if (!requisition) {
      return { ...current, sourceRequisitionIds: [] };
    }

    const requisitionItems = approvedRequisitionItems.filter((item) => item.requisition_id === requisitionId);
    const matchedVendorNames = requisition.vendor_preference
      ? requisition.vendor_preference.split(',').map((value) => value.trim()).filter(Boolean)
      : [];
    const matchedPayees = payees.filter((payee) =>
      matchedVendorNames.some((name) => normalizeText(name) === normalizeText(payee.payee_name)),
    );
    const matchedChargeBankAccount = requisition.charge_bank_account_id
      ? bankAccounts.find((account) => account.id === requisition.charge_bank_account_id) || null
      : null;
    const nextAmount = requisitionItems.reduce((sum, item) => sum + toNumber(item.line_total), 0) + toNumber(requisition.bank_charge_amount);
    const allocationRows = [
      ...buildAllocationRowsFromRequisition(requisition, requisitionItems),
      ...buildBankChargeAllocationRow(requisition),
    ];

    return {
      ...current,
      sourceRequisitionIds: [requisition.id],
      paymentType: 'apply_to_bill' as PaymentType,
      payeeIds: matchedPayees.length > 0 ? matchedPayees.map((payee) => payee.id) : current.payeeIds,
      amount: nextAmount > 0 ? `${nextAmount}` : current.amount,
      description: requisition.title,
      payeeReferences: matchedVendorNames.length > 0 ? matchedVendorNames.join('\n') : current.payeeReferences,
      voucherNotes: [
        requisition.justification,
        requisition.notes,
        toNumber(requisition.bank_charge_amount) > 0
          ? `Bank charge: ${formatMoney(toNumber(requisition.bank_charge_amount), current.currency)} (${requisition.bank_charge_mode === 'additional_expense' ? 'additional expense' : 'included in main transaction'})`
          : null,
      ].filter(Boolean).join('\n\n'),
      recordingDate: requisition.needed_by || current.recordingDate,
      currency: matchedPayees[0]?.transaction_currency || current.currency,
      paymentMethod: matchedPayees[0]?.payment_method || current.paymentMethod,
      payFromAccount: matchedChargeBankAccount ? financeDepositAccountsService.formatAccountLabel(matchedChargeBankAccount) : matchedPayees[0]?.default_bank_cash || current.payFromAccount,
      payFromAccountId: matchedChargeBankAccount?.id || findBankAccountByLabel(matchedPayees[0]?.default_bank_cash)?.id || '',
      allocationRows,
    };
  };

  const toggleApprovedRequisitionSelection = (requisitionId: string) => {
    const exists = paymentForm.sourceRequisitionIds.includes(requisitionId);
    const previewIds = exists
      ? paymentForm.sourceRequisitionIds.filter((id) => id !== requisitionId)
      : [...paymentForm.sourceRequisitionIds, requisitionId];

    if (previewIds.length === 1) {
      const requisition = approvedRequisitions.find((entry) => entry.id === previewIds[0]);
      const matchedPayee = requisition
        ? payees.find((payee) => normalizeText(payee.payee_name) === normalizeText(requisition.vendor_preference))
        : null;

      if (requisition && !matchedPayee && requisition.vendor_preference) {
        setToast({
          message: `Approved requisition loaded. Voucher fields are prefilled and can still be edited. Create or select the payee for ${requisition.vendor_preference} before saving the voucher.`,
          type: 'warning',
        });
      }
    }

    setPaymentForm((current) => {
      const isSelected = current.sourceRequisitionIds.includes(requisitionId);
      const nextIds = isSelected
        ? current.sourceRequisitionIds.filter((id) => id !== requisitionId)
        : [...current.sourceRequisitionIds, requisitionId];

      if (nextIds.length === 1) {
        return hydratePaymentForRequisition(nextIds[0], { ...current, sourceRequisitionIds: nextIds });
      }

      return { ...current, sourceRequisitionIds: nextIds };
    });
  };

  const clearApprovedRequisitionSelection = () => {
    setPaymentForm((current) => ({ ...current, sourceRequisitionIds: [] }));
  };

  const clearApprovedRequisitionSearch = () => {
    setApprovedRequisitionSearch('');
  };

  const createReferenceOption = async () => {
    if (!workflowReady) {
      setToast({ message: 'Apply the payment voucher migration first, then add payment options.', type: 'warning' });
      return;
    }

    if (!organizationId) {
      setToast({ message: 'An organization is required before adding dropdown options.', type: 'warning' });
      return;
    }

    const optionValue = normalizeOptionValue(referenceOptionForm.value);
    if (!optionValue) {
      setToast({ message: 'Enter a value before saving the new option.', type: 'warning' });
      return;
    }

    setSaving(true);

    try {
      const payload = {
        organization_id: organizationId,
        option_type: referenceOptionForm.type,
        option_value: optionValue,
        created_by: profile?.id || null,
      };

      const { data, error } = await supabase
        .from('finance_payment_reference_options')
        .insert(payload)
        .select('id, organization_id, option_type, option_value')
        .single();

      if (error) throw error;

      const createdOption = data as PaymentReferenceOption;
      setReferenceOptions((current) => {
        const exists = current.some(
          (option) =>
            option.option_type === createdOption.option_type &&
            normalizeText(option.option_value) === normalizeText(createdOption.option_value),
        );
        return exists ? current : [...current, createdOption];
      });

      if (createdOption.option_type === 'pay_from_account') {
        setPaymentForm((current) => ({ ...current, payFromAccount: createdOption.option_value, payFromAccountId: '' }));
      } else if (createdOption.option_type === 'payment_method') {
        setPaymentForm((current) => ({ ...current, paymentMethod: createdOption.option_value }));
      } else {
        setPaymentForm((current) => ({ ...current, costCenter: createdOption.option_value }));
      }

      setShowReferenceOptionForm(null);
      setReferenceOptionForm(createReferenceOptionForm('cost_center'));
      setToast({ message: 'New dropdown option saved.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to create payment reference option:', error);
      setToast({ message: error.message || 'Failed to save the new option.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const createPayee = async () => {
    if (!organizationId) {
      setToast({ message: 'An organization is required before creating payees.', type: 'warning' });
      return;
    }

    if (!workflowReady) {
      setToast({ message: 'Apply the payment voucher migration first, then create a payee.', type: 'warning' });
      return;
    }

    if (!payeeForm.payeeName.trim()) {
      setToast({ message: 'Payee name is required.', type: 'warning' });
      return;
    }

    setSaving(true);

    try {
      const payload = {
        organization_id: organizationId,
        payee_name: payeeForm.payeeName.trim(),
        client_grouping: payeeForm.clientGrouping || null,
        client_account_number: payeeForm.clientAccountNumber || null,
        vat_pin_number: payeeForm.vatPinNumber || null,
        contact_person: payeeForm.contactPerson || null,
        telephone_number: payeeForm.telephoneNumber || null,
        email: payeeForm.email || null,
        invoicing_address: payeeForm.invoicingAddress || null,
        shipping_address: payeeForm.shippingAddress || null,
        transaction_currency: payeeForm.transactionCurrency || 'KES',
        bank_name: payeeForm.bankName || null,
        bank_account_name: payeeForm.bankAccountName || null,
        bank_account_number: payeeForm.bankAccountNumber || null,
        mpesa_phone_number: payeeForm.mpesaPhoneNumber || null,
        payment_information: payeeForm.paymentInformation || null,
        agreement_date: payeeForm.agreementDate || null,
        contract_start_date: payeeForm.contractStartDate || null,
        contract_end_date: payeeForm.contractEndDate || null,
        notes: payeeForm.notes || null,
        created_by: profile?.id || null,
        updated_by: profile?.id || null,
      };

      const { data, error } = await supabase.from('finance_payees').insert(payload).select('*').single();
      if (error) throw error;

      const createdPayee = data as FinancePayee;
      const nextPayees = [...payees, createdPayee].sort((left, right) => left.payee_name.localeCompare(right.payee_name));

      setPayees(nextPayees);
      setPaymentForm((current) => ({
        ...current,
        payeeIds: Array.from(new Set([...current.payeeIds, createdPayee.id])),
        currency: createdPayee.transaction_currency || current.currency,
      }));
      setPayeeForm(createPayeeForm());
      setShowPayeeForm(false);
      setToast({ message: 'Payee created and ready to use in this voucher.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to create payee:', error);
      setToast({ message: error.message || 'Failed to create payee.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const createClientGroup = async () => {
    if (!organizationId) {
      setToast({ message: 'An organization is required before creating client groups.', type: 'warning' });
      return;
    }

    const groupName = clientGroupForm.value.trim();
    if (!groupName) {
      setToast({ message: 'Client group name is required.', type: 'warning' });
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from('finance_payee_client_groups')
        .insert({
          organization_id: organizationId,
          group_name: groupName,
          created_by: profile?.id || null,
        })
        .select('id, organization_id, group_name')
        .single();

      if (error) throw error;

      const createdGroup = data as FinancePayeeClientGroup;
      setClientGroups((current) => [...current, createdGroup].sort((left, right) => left.group_name.localeCompare(right.group_name)));
      setPayeeForm((current) => ({ ...current, clientGrouping: createdGroup.group_name }));
      setClientGroupForm(createClientGroupForm());
      setShowClientGroupForm(false);
      setToast({ message: 'Client group saved successfully.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to create client group:', error);
      setToast({ message: error.message || 'Failed to create client group.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const createExpenseGroup = async () => {
    if (!organizationId) {
      setToast({ message: 'An organization is required before creating expense groups.', type: 'warning' });
      return;
    }

    const groupName = expenseGroupForm.value.trim();
    if (!groupName) {
      setToast({ message: 'Expense group name is required.', type: 'warning' });
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from('finance_expense_groups')
        .insert({
          organization_id: organizationId,
          group_name: groupName,
          created_by: profile?.id || null,
        })
        .select('id, organization_id, group_name, created_at')
        .single();

      if (error) throw error;

      const createdGroup = data as ExpenseGroup;
      setExpenseGroups((current) => [...current, createdGroup].sort((left, right) => left.group_name.localeCompare(right.group_name)));
      setPaymentForm((current) => ({ ...current, expenseGroup: createdGroup.group_name }));
      setExpenseGroupForm(createClientGroupForm());
      setShowExpenseGroupForm(false);
      setToast({ message: 'Expense group saved successfully.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to create expense group:', error);
      setToast({ message: error.message || 'Failed to create expense group.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const openManualInvoiceComposer = () => {
    setEditingManualInvoiceId(null);
    setManualInvoiceForm(createManualInvoiceForm());
    setShowManualInvoiceForm(true);
  };

  const openManualDepositComposer = () => {
    setEditingManualDepositId(null);
    setManualDepositForm(createManualDepositForm());
    setShowManualDepositForm(true);
  };

  const openManualInvoiceEditor = (invoice: FinanceInvoice) => {
    setEditingManualInvoiceId(invoice.id);
    setManualInvoiceForm({
      invoice_number: invoice.invoice_number || generateInvoiceNumber('FIN'),
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date || '',
      bill_to: invoice.bill_to || '',
      transaction_class: invoice.transaction_class || 'Security Services',
      receivable_account: invoice.accounts_receivable_account || DEFAULT_RECEIVABLE_ACCOUNT,
      currency: invoice.currency || 'KES',
      amount: `${invoice.total_amount || 0}`,
      notes: invoice.notes || '',
    });
    setShowManualInvoiceForm(true);
  };

  const openManualDepositEditor = (receipt: FinanceReceipt) => {
    setEditingManualDepositId(receipt.id);
    setManualDepositForm({
      receipt_number: receipt.receipt_number || '',
      receipt_date: receipt.receipt_date,
      amount: `${receipt.amount || 0}`,
      payment_method: receipt.payment_method || 'Cash',
      currency: receipt.currency || 'KES',
      received_from: receipt.received_from || '',
      description: receipt.description || '',
      category: receipt.category || 'Operations',
      invoice_number: '',
      notes: receipt.notes || '',
    });
    setShowManualDepositForm(true);
  };

  useEffect(() => {
    if (isManualInvoiceEditorRoute && invoiceId) {
      const target = manualInvoices.find((invoice) => invoice.id === invoiceId);
      if (target) {
        openManualInvoiceEditor(target);
      }
      return;
    }

    if (isManualDepositEditorRoute && receiptId) {
      const target = manualDeposits.find((deposit) => deposit.id === receiptId);
      if (target) {
        openManualDepositEditor(target);
      }
    }
  }, [invoiceId, isManualDepositEditorRoute, isManualInvoiceEditorRoute, manualDeposits, manualInvoices, receiptId]);

  const saveManualInvoice = async () => {
    if (!organizationId) {
      setToast({ message: 'An organization is required before creating an invoice.', type: 'warning' });
      return;
    }

    const totalAmount = toNumber(manualInvoiceForm.amount);
    if (!totalAmount || totalAmount <= 0) {
      setToast({ message: 'Enter a valid invoice amount.', type: 'warning' });
      return;
    }

    if (!manualInvoiceForm.invoice_date) {
      setToast({ message: 'Invoice date is required.', type: 'warning' });
      return;
    }

    setSaving(true);

    try {
      const existingInvoice = editingManualInvoiceId
        ? manualInvoices.find((invoice) => invoice.id === editingManualInvoiceId)
        : null;
      const safePaid = Math.min(toNumber(existingInvoice?.amount_paid || 0), totalAmount);
      const resolvedInvoiceNumber = manualInvoiceForm.invoice_number.trim() || generateInvoiceNumber('FIN');
      const resolvedDueDate = manualInvoiceForm.due_date.trim() || null;
      const resolvedStatus = resolveInvoiceStatus(existingInvoice?.status || 'sent', resolvedDueDate, totalAmount, safePaid);

      const payload = {
        organization_id: organizationId,
        invoice_number: resolvedInvoiceNumber,
        transaction_class: manualInvoiceForm.transaction_class.trim() || 'Security Services',
        accounts_receivable_account: manualInvoiceForm.receivable_account.trim() || DEFAULT_RECEIVABLE_ACCOUNT,
        invoice_date: manualInvoiceForm.invoice_date,
        due_date: resolvedDueDate,
        currency: manualInvoiceForm.currency,
        tax_rate: 0,
        subtotal: totalAmount,
        tax_amount: 0,
        total_amount: totalAmount,
        amount_paid: safePaid,
        status: resolvedStatus,
        bill_to: manualInvoiceForm.bill_to.trim() || null,
        notes: manualInvoiceForm.notes.trim() || null,
        updated_at: new Date().toISOString(),
        updated_by: profile?.id || null,
      };

      let invoiceId = editingManualInvoiceId || '';

      if (editingManualInvoiceId) {
        const { error } = await supabase
          .from('finance_invoices')
          .update(payload)
          .eq('id', editingManualInvoiceId);
        if (error) throw error;

        const { error: deleteItemsError } = await supabase
          .from('finance_invoice_items')
          .delete()
          .eq('invoice_id', editingManualInvoiceId);
        if (deleteItemsError) throw deleteItemsError;
      } else {
        const { data, error } = await supabase
          .from('finance_invoices')
          .insert([{ ...payload, created_by: profile?.id || null }])
          .select('id')
          .single();
        if (error) throw error;
        invoiceId = data?.id;
      }

      if (invoiceId) {
        const { error: itemError } = await supabase.from('finance_invoice_items').insert([
          {
            invoice_id: invoiceId,
            expense_item: 'Manual Invoice',
            description: manualInvoiceForm.bill_to.trim() || 'Manual invoice line',
            particulars: manualInvoiceForm.notes.trim() || null,
            income_account: manualInvoiceForm.receivable_account.trim() || DEFAULT_RECEIVABLE_ACCOUNT,
            unit_cost: totalAmount,
            quantity: 1,
            display_order: 0,
          },
        ]);
        if (itemError) throw itemError;
      }

      setToast({ message: editingManualInvoiceId ? 'Manual invoice updated.' : 'Manual invoice created.', type: 'success' });
      setShowManualInvoiceForm(false);
      setManualInvoiceForm(createManualInvoiceForm());
      setEditingManualInvoiceId(null);
      await loadData();
    } catch (error: any) {
      console.error('Failed to save manual invoice:', error);
      setToast({ message: error.message || 'Failed to save manual invoice.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const saveManualDeposit = async () => {
    if (!organizationId) {
      setToast({ message: 'An organization is required before posting a deposit.', type: 'warning' });
      return;
    }

    const amount = toNumber(manualDepositForm.amount);
    if (!amount || amount <= 0) {
      setToast({ message: 'Enter a valid deposit amount.', type: 'warning' });
      return;
    }

    if (!manualDepositForm.receipt_date) {
      setToast({ message: 'Receipt date is required.', type: 'warning' });
      return;
    }

    setSaving(true);

    try {
      let linkedInvoice: FinanceInvoice | null = null;

      if (manualDepositForm.invoice_number.trim()) {
        const { data, error } = await supabase
          .from('finance_invoices')
          .select('id, invoice_number, due_date, total_amount, amount_paid, status')
          .eq('organization_id', organizationId)
          .eq('invoice_number', manualDepositForm.invoice_number.trim())
          .maybeSingle();

        if (error) throw error;
        linkedInvoice = (data as FinanceInvoice) || null;
      }

      const payload = {
        organization_id: organizationId,
        receipt_number: manualDepositForm.receipt_number.trim() || buildReceiptNumber(manualDepositForm.receipt_date),
        receipt_date: manualDepositForm.receipt_date,
        source_module: 'Finance',
        amount,
        description: manualDepositForm.description.trim() || 'Manual deposit',
        category: manualDepositForm.category.trim() || 'Operations',
        payment_method: manualDepositForm.payment_method.trim() || 'Cash',
        currency: manualDepositForm.currency || 'KES',
        received_from: manualDepositForm.received_from.trim() || null,
        invoice_id: linkedInvoice?.id || null,
        notes: manualDepositForm.notes.trim() || null,
        posted_by: profile?.id || null,
      };

      if (editingManualDepositId) {
        const { error } = await supabase
          .from('finance_receipts')
          .update(payload)
          .eq('id', editingManualDepositId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('finance_receipts').insert([payload]);
        if (error) throw error;
      }

      if (linkedInvoice) {
        const nextPaid = toNumber(linkedInvoice.amount_paid) + amount;
        const nextStatus = resolveInvoiceStatus(linkedInvoice.status, linkedInvoice.due_date, toNumber(linkedInvoice.total_amount), nextPaid);
        const { error: invoiceError } = await supabase
          .from('finance_invoices')
          .update({
            amount_paid: nextPaid,
            status: nextStatus,
            updated_at: new Date().toISOString(),
            updated_by: profile?.id || null,
          })
          .eq('id', linkedInvoice.id);
        if (invoiceError) throw invoiceError;
      }

      setToast({ message: editingManualDepositId ? 'Manual deposit updated.' : 'Manual deposit posted.', type: 'success' });
      setShowManualDepositForm(false);
      setManualDepositForm(createManualDepositForm());
      setEditingManualDepositId(null);
      await loadData();
    } catch (error: any) {
      console.error('Failed to save manual deposit:', error);
      setToast({ message: error.message || 'Failed to save manual deposit.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const openConnectionComposer = () => {
    setConnectionForm(createConnectionForm());
    setShowConnectionForm(true);
  };

  const saveConnection = async () => {
    if (!connectionForm.connection_name.trim()) {
      setToast({ message: 'Connection name is required.', type: 'warning' });
      return;
    }

    if (!connectionForm.bank_account_id) {
      setToast({ message: 'Select a bank account before saving this connection.', type: 'warning' });
      return;
    }

    setSaving(true);
    try {
      await financeProviderSyncService.saveConnection({
        connectionName: connectionForm.connection_name.trim(),
        provider: connectionForm.provider,
        accountKind: 'bank',
        syncMode: connectionForm.sync_mode,
        bankAccountId: connectionForm.bank_account_id,
        status: 'active',
      });

      const connections = await financeProviderSyncService.listConnections();
      setProviderConnections(connections);
      setShowConnectionForm(false);
      setConnectionForm(createConnectionForm());
      setToast({ message: 'Bank connection saved.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to save provider connection:', error);
      setToast({ message: error.message || 'Failed to save connection.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const openStatementImportForm = (connectionId: string) => {
    setStatementImportForm({ connection_id: connectionId, payload_text: '' });
    setShowStatementImport(true);
  };

  const runStatementImport = async () => {
    if (!statementImportForm.connection_id) {
      setToast({ message: 'Select a connection before importing.', type: 'warning' });
      return;
    }

    let rows: Record<string, unknown>[] = [];
    if (statementImportForm.payload_text.trim()) {
      try {
        const parsed = JSON.parse(statementImportForm.payload_text);
        rows = Array.isArray(parsed) ? parsed : [];
      } catch {
        setToast({ message: 'Paste a valid JSON array of statement rows.', type: 'warning' });
        return;
      }
    }

    setSaving(true);
    try {
      await financeProviderSyncService.syncConnection({
        connectionId: statementImportForm.connection_id,
        triggerSource: 'manual',
        statementRows: rows,
      });

      setShowStatementImport(false);
      setStatementImportForm(createStatementImportForm());
      await loadData();
      setToast({ message: 'Statement import completed.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to import statement rows:', error);
      setToast({ message: error.message || 'Failed to import statement rows.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const savePayment = async () => {
    if (!organizationId) {
      setToast({ message: 'An organization is required before creating a payment.', type: 'warning' });
      return;
    }

    if (!workflowReady) {
      setToast({ message: 'Apply the payment voucher migration first, then create the payment.', type: 'warning' });
      return;
    }

    const hasRequisitionSelection = paymentForm.sourceRequisitionIds.length > 0;
    if (!hasRequisitionSelection && paymentForm.payeeIds.length === 0) {
      setToast({ message: 'Select at least one payee or link an approved requisition before saving. Use the + button to create a payee.', type: 'warning' });
      return;
    }

    if (!paymentForm.payFromAccount.trim() || !paymentForm.paymentMethod.trim() || !paymentForm.costCenter.trim()) {
      setToast({ message: 'Pay from account, payment method, and cost center are required.', type: 'warning' });
      return;
    }

    if (!paymentForm.recordingDate || (!hasRequisitionSelection && currentAllocationTotal <= 0)) {
      setToast({ message: 'Recording date and a valid amount paid are required.', type: 'warning' });
      return;
    }

    const positiveAllocations = paymentForm.allocationRows.filter((row) => toNumber(row.payment_amount) > 0);
    if (!hasRequisitionSelection && positiveAllocations.length === 0) {
      setToast({ message: 'Add at least one line item amount before saving the voucher.', type: 'warning' });
      return;
    }

    setSaving(true);

    try {
      const insertedPaymentIds: string[] = [];
      const createdPayments: FinancePayment[] = [];
      let lastSavedPayment: FinancePayment | null = null;
      let lastSavedAllocations: FinancePaymentAllocation[] = [];
      const matchedBankAccount = paymentForm.payFromAccountId
        ? bankAccounts.find((account) => account.id === paymentForm.payFromAccountId) || null
        : null;

      const createPaymentWithAllocations = async (
        payload: Record<string, unknown>,
        allocationPayload: Record<string, unknown>[],
      ) => {
        const { data, error } = await supabase.rpc('create_finance_payment_with_allocations', {
          p_payment: payload,
          p_allocations: allocationPayload,
          p_bank_account_id: matchedBankAccount?.id || null,
        });

        if (error) throw error;
        return data as FinancePayment;
      };

      if (hasRequisitionSelection) {
        const missingPayees: string[] = [];
        const selectedRequisitions = approvedRequisitions.filter((requisition) =>
          paymentForm.sourceRequisitionIds.includes(requisition.id),
        );

        for (const requisition of selectedRequisitions) {
          const matchedPayee = payees.find(
            (payee) => normalizeText(payee.payee_name) === normalizeText(requisition.vendor_preference),
          );

          if (!matchedPayee) {
            missingPayees.push(requisition.vendor_preference || requisition.requisition_number);
            continue;
          }

          const requisitionItems = approvedRequisitionItems.filter((item) => item.requisition_id === requisition.id);
          const requisitionAmount = requisitionItems.reduce((sum, item) => sum + toNumber(item.line_total), 0);
          const bankChargeAmount = toNumber(requisition.bank_charge_amount);
          const requisitionEntity = requisition.department?.trim() || paymentForm.entity.trim() || null;
          const amountToUse = requisitionAmount + bankChargeAmount > 0
            ? requisitionAmount + bankChargeAmount
            : toNumber(paymentForm.amount);
          const allocationRows = paymentForm.paymentType === 'apply_to_bill'
            ? [
                ...buildAllocationRowsFromRequisition(requisition, requisitionItems),
                ...buildBankChargeAllocationRow(requisition),
              ]
            : [];
          const bankChargeNote = bankChargeAmount > 0
            ? `Bank charge: ${formatMoney(bankChargeAmount, paymentForm.currency)} (${requisition.bank_charge_mode === 'additional_expense' ? 'additional expense' : 'included in main transaction'})`
            : null;

          const payload = {
            organization_id: organizationId,
            entity: requisitionEntity,
            payee_id: matchedPayee.id,
            source_requisition_id: requisition.id,
            payment_number: voucherPreviewNumber,
            payment_date: paymentForm.recordingDate,
            payment_type: paymentForm.paymentType,
            pay_from_account: paymentForm.payFromAccount.trim(),
            pay_from_account_id: matchedBankAccount?.id || null,
            cost_center: paymentForm.costCenter.trim(),
            expense_group: paymentForm.expenseGroup.trim() || null,
            amount: amountToUse,
            description: requisition.title,
            payment_method: paymentForm.paymentMethod.trim(),
            reference_number: paymentForm.referenceNumber.trim() || null,
            cheque_date: paymentForm.chequeDate || null,
            is_post_dated_cheque: paymentForm.isPostDatedCheque,
            currency: paymentForm.currency,
            spot_rate: toNumber(paymentForm.spotRate) || 1,
            recording_date: paymentForm.recordingDate,
            voucher_notes: [
              paymentForm.voucherNotes.trim() || null,
              buildVoucherSignoffNotes(paymentForm) || null,
              requisition.justification,
              requisition.notes,
              bankChargeNote,
            ].filter(Boolean).join('\n\n') || null,
            signature_data_url:
              paymentForm.signatureMode === 'text'
                ? createTextSignatureDataUrl(paymentForm.signature || signerName)
                : paymentForm.signatureDataUrl || createTextSignatureDataUrl(paymentForm.signature || signerName),
            attachment_urls: attachmentListFromText(paymentForm.attachmentUrlsText),
            status: 'completed',
            created_by: profile?.id || null,
            approved_by: profile?.id || null,
            approved_at: new Date().toISOString(),
            updated_by: profile?.id || null,
          };

          const allocationPayload = allocationRows.map((row, index) => ({
            entity: row.entity.trim() || requisitionEntity,
            expense_group: row.expense_group.trim() || paymentForm.expenseGroup.trim() || null,
            description: row.particular.trim() || null,
            bill_date: row.bill_date || null,
            invoice_number: row.invoice_number.trim() || null,
            particular: row.particular.trim() || null,
            specification: row.specification.trim() || null,
            quantity: `${toNumber(row.quantity) || 1}`,
            unit_cost: `${toNumber(row.unit_cost)}`,
            payable_total: `${toNumber(row.payable_total)}`,
            wht_tax: `${toNumber(row.wht_tax)}`,
            paid_to_date: `${toNumber(row.paid_to_date)}`,
            amount_due: `${computeAmountDue(row)}`,
            payment_amount: `${toNumber(row.payment_amount)}`,
            new_balance: `${computeNewBalance(row)}`,
            display_order: index,
          }));

          const createdPayment = await createPaymentWithAllocations(payload, allocationPayload);
          const insertedPaymentId = createdPayment.id as string;
          createdPayments.push(createdPayment);
          insertedPaymentIds.push(insertedPaymentId);
          lastSavedPayment = createdPayment;
          lastSavedAllocations = allocationRows.map((row, index) => ({
            id: `draft-${index}`,
            payment_id: createdPayment.id,
            bill_date: row.bill_date || null,
            invoice_number: row.invoice_number.trim() || null,
            particular: row.particular.trim() || null,
            specification: row.specification.trim() || null,
            quantity: toNumber(row.quantity) || 1,
            unit_cost: toNumber(row.unit_cost),
            payable_total: toNumber(row.payable_total),
            wht_tax: toNumber(row.wht_tax),
            paid_to_date: toNumber(row.paid_to_date),
            amount_due: computeAmountDue(row),
            payment_amount: toNumber(row.payment_amount),
            new_balance: computeNewBalance(row),
            display_order: index,
          }));
        }

        if (missingPayees.length > 0) {
          setToast({
            message: `Missing payees for: ${missingPayees.join(', ')}. Add payees and try again for those requisitions.`,
            type: 'warning',
          });
        }

        if (insertedPaymentIds.length === 0) {
          throw new Error('No vouchers were created. Check payee matches for the selected requisitions.');
        }

        setToast({
          message: insertedPaymentIds.length > 1 ? 'Payment vouchers created for selected requisitions.' : 'Payment voucher saved successfully.',
          type: 'success',
        });
      } else {
        for (const payeeId of paymentForm.payeeIds) {
          const payload = {
            organization_id: organizationId,
            entity: paymentForm.entity.trim() || null,
            payee_id: payeeId,
            source_requisition_id: null,
            payment_number: voucherPreviewNumber,
            payment_date: paymentForm.recordingDate,
            payment_type: paymentForm.paymentType,
            pay_from_account: paymentForm.payFromAccount.trim(),
            pay_from_account_id: matchedBankAccount?.id || null,
            cost_center: paymentForm.costCenter.trim(),
            expense_group: paymentForm.expenseGroup.trim() || null,
            amount: (currentAllocationTotal > 0 ? currentAllocationTotal : toNumber(paymentForm.amount)) + paymentBankChargeAmount,
            quantity: toNumber(paymentForm.quantity) || 1,
            unit_cost: toNumber(paymentForm.unitCost),
            specification: paymentForm.specification.trim() || null,
            description: paymentForm.description.trim() || null,
            payment_method: paymentForm.paymentMethod.trim(),
            reference_number: paymentForm.referenceNumber.trim() || null,
            cheque_date: paymentForm.chequeDate || null,
            is_post_dated_cheque: paymentForm.isPostDatedCheque,
            currency: paymentForm.currency,
            spot_rate: toNumber(paymentForm.spotRate) || 1,
            recording_date: paymentForm.recordingDate,
            voucher_notes: [
              paymentForm.voucherNotes.trim() || null,
              paymentForm.payeeReferences.trim() || null,
              paymentBankChargeAmount > 0 ? `Bank charge: ${formatMoney(paymentBankChargeAmount, paymentForm.currency)}` : null,
              buildVoucherSignoffNotes(paymentForm) || null,
            ].filter(Boolean).join('\n\n') || null,
            signature_data_url:
              paymentForm.signatureMode === 'text'
                ? createTextSignatureDataUrl(paymentForm.signature || signerName)
                : paymentForm.signatureDataUrl || createTextSignatureDataUrl(paymentForm.signature || signerName),
            attachment_urls: attachmentListFromText(paymentForm.attachmentUrlsText),
            status: 'completed',
            created_by: profile?.id || null,
            approved_by: profile?.id || null,
            approved_at: new Date().toISOString(),
            updated_by: profile?.id || null,
          };

          const allocationPayload = positiveAllocations.map((row, index) => ({
            entity: row.entity.trim() || paymentForm.entity.trim() || null,
            expense_group: row.expense_group.trim() || paymentForm.expenseGroup.trim() || null,
            description: row.particular.trim() || null,
            bill_date: row.bill_date || null,
            invoice_number: row.invoice_number.trim() || null,
            particular: row.particular.trim() || null,
            specification: row.specification.trim() || null,
            quantity: `${toNumber(row.quantity) || 1}`,
            unit_cost: `${toNumber(row.unit_cost)}`,
            payable_total: `${toNumber(row.payable_total)}`,
            wht_tax: `${toNumber(row.wht_tax)}`,
            paid_to_date: `${toNumber(row.paid_to_date)}`,
            amount_due: `${computeAmountDue(row)}`,
            payment_amount: `${toNumber(row.payment_amount)}`,
            new_balance: `${computeNewBalance(row)}`,
            display_order: index,
          }));

          const createdPayment = await createPaymentWithAllocations(payload, allocationPayload);
          const insertedPaymentId = createdPayment.id as string;
          createdPayments.push(createdPayment);
          insertedPaymentIds.push(insertedPaymentId);
          lastSavedPayment = createdPayment;
          lastSavedAllocations = positiveAllocations.map((row, index) => ({
            id: `draft-${index}`,
            payment_id: createdPayment.id,
            bill_date: row.bill_date || null,
            invoice_number: row.invoice_number.trim() || null,
            particular: row.particular.trim() || null,
            specification: row.specification.trim() || null,
            quantity: toNumber(row.quantity) || 1,
            unit_cost: toNumber(row.unit_cost),
            payable_total: toNumber(row.payable_total),
            wht_tax: toNumber(row.wht_tax),
            paid_to_date: toNumber(row.paid_to_date),
            amount_due: computeAmountDue(row),
            payment_amount: toNumber(row.payment_amount),
            new_balance: computeNewBalance(row),
            display_order: index,
          }));
        }

        setToast({
          message: paymentForm.payeeIds.length > 1 ? 'Payment vouchers saved for selected payees.' : 'Payment voucher saved successfully.',
          type: 'success',
        });
      }
      if (createdPayments.length > 0) {
        setLastSavedVoucherPayment(lastSavedPayment);
        setLastSavedVoucherAllocations(lastSavedAllocations);
        setPayments((current) => {
          const createdIds = new Set(insertedPaymentIds);
          return [...createdPayments, ...current.filter((payment) => !createdIds.has(payment.id))].sort(
            (left, right) =>
              new Date(right.recording_date || right.created_at).getTime() - new Date(left.recording_date || left.created_at).getTime(),
          );
        });

        if (hasRequisitionSelection) {
          setApprovedRequisitions((current) => current.filter((requisition) => !paymentForm.sourceRequisitionIds.includes(requisition.id)));
          setApprovedRequisitionItems((current) => current.filter((item) => !paymentForm.sourceRequisitionIds.includes(item.requisition_id)));
        }
      }
      resetPaymentForm();
    } catch (error: any) {
      console.error('Failed to save payment voucher:', error);
      const message = error?.message || 'Failed to save payment voucher.';
      if (normalizeText(message).includes('create_finance_payment_with_allocations')) {
        setToast({ message: 'Apply the latest finance payment migration, then try saving the voucher again.', type: 'error' });
      } else {
        setToast({ message, type: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  const exportPayments = () => {
    if (filteredPayments.length === 0) {
      setToast({ message: 'There are no payments to export right now.', type: 'warning' });
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
    link.download = `finance_payments_${todayString()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const refreshWorkflow = () => {
    void loadData();
  };

  const printLastSavedVoucher = () => {
    if (!lastSavedVoucherPayment) {
      setToast({ message: 'Save a voucher first, then print the last saved copy here.', type: 'warning' });
      return;
    }

    const payeeName = payeeMap[lastSavedVoucherPayment.payee_id || '']?.payee_name || 'Voucher Payee';
    const signatureHtml = lastSavedVoucherPayment.signature_data_url
      ? `<img src="${escapeHtml(lastSavedVoucherPayment.signature_data_url)}" alt="Digital signature" style="max-height:72px; max-width:100%; object-fit:contain;" />`
      : '<div style="color:#94a3b8;">No signature captured</div>';
    const allocationRowsHtml = lastSavedVoucherAllocations.length
      ? `
        <table style="width:100%; border-collapse:collapse; font-size:11px; margin-top:16px;">
          <thead>
            <tr>
              <th style="text-align:left; padding:8px 6px; border-bottom:1px solid #cbd5e1;">Invoice</th>
              <th style="text-align:left; padding:8px 6px; border-bottom:1px solid #cbd5e1;">Particular</th>
              <th style="text-align:right; padding:8px 6px; border-bottom:1px solid #cbd5e1;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lastSavedVoucherAllocations
              .map(
                (row) => `
                  <tr>
                    <td style="padding:8px 6px; border-bottom:1px solid #edf2f7;">${escapeHtml(row.invoice_number || '-')}</td>
                    <td style="padding:8px 6px; border-bottom:1px solid #edf2f7;">${escapeHtml(row.particular || row.specification || '-')}</td>
                    <td style="padding:8px 6px; border-bottom:1px solid #edf2f7; text-align:right;">${escapeHtml(formatMoney(toNumber(row.payment_amount), lastSavedVoucherPayment.currency || 'KES'))}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      `
      : '';

    printDocument({
      title: `Payment Voucher ${lastSavedVoucherPayment.payment_number || ''}`.trim(),
      subtitle: 'Last saved voucher',
      bodyHtml: `
        <div style="display:grid; gap:16px; grid-template-columns:repeat(2, minmax(0, 1fr)); font-size:12px;">
          <div><strong>Voucher No.</strong><br/>${escapeHtml(lastSavedVoucherPayment.payment_number || '-')}</div>
          <div><strong>Payee</strong><br/>${escapeHtml(payeeName)}</div>
          <div><strong>Recording Date</strong><br/>${escapeHtml(formatDateLabel(lastSavedVoucherPayment.recording_date))}</div>
          <div><strong>Method</strong><br/>${escapeHtml(lastSavedVoucherPayment.payment_method || '-')}</div>
          <div><strong>Pay From</strong><br/>${escapeHtml(lastSavedVoucherPayment.pay_from_account || '-')}</div>
          <div><strong>Reference</strong><br/>${escapeHtml(lastSavedVoucherPayment.reference_number || '-')}</div>
          <div><strong>Cost Center</strong><br/>${escapeHtml(lastSavedVoucherPayment.cost_center || '-')}</div>
          <div><strong>Expense Group</strong><br/>${escapeHtml(lastSavedVoucherPayment.expense_group || '-')}</div>
        </div>
        <div style="margin-top:18px; padding:14px; border:1px solid #e2e8f0; border-radius:18px; background:#f8fafc;">
          <strong>Amount</strong>
          <div style="margin-top:8px; font-size:18px; font-weight:800;">${escapeHtml(formatMoney(toNumber(lastSavedVoucherPayment.amount), lastSavedVoucherPayment.currency || 'KES'))}</div>
        </div>
        ${lastSavedVoucherPayment.voucher_notes ? `<div style="margin-top:18px;"><strong>Notes</strong><div style="margin-top:8px; white-space:pre-wrap;">${escapeHtml(lastSavedVoucherPayment.voucher_notes)}</div></div>` : ''}
        ${allocationRowsHtml}
        <div style="margin-top:24px; display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:16px; align-items:end;">
          <div style="border-top:1px solid #cbd5e1; padding-top:10px; font-size:11px;">
            <div style="font-weight:700; text-transform:uppercase; letter-spacing:.18em; color:#64748b;">Signature</div>
            <div style="margin-top:10px;">${signatureHtml}</div>
          </div>
          <div style="border-top:1px solid #cbd5e1; padding-top:10px; font-size:11px;">
            <div style="font-weight:700; text-transform:uppercase; letter-spacing:.18em; color:#64748b;">Printed By</div>
            <div style="margin-top:14px; color:#0f172a;">${escapeHtml(profileName || signerName)}</div>
          </div>
        </div>
      `,
    });
  };

  const handlePrint = () => {
    printLastSavedVoucher();
  };

  const isManualEditorRoute = isManualInvoiceEditorRoute || isManualDepositEditorRoute;
  const isManualEditorReady = isManualInvoiceEditorRoute
    ? showManualInvoiceForm && editingManualInvoiceId === invoiceId
    : isManualDepositEditorRoute
      ? showManualDepositForm && editingManualDepositId === receiptId
      : false;

  const renderManualInvoiceEditorPage = () => (
    <div className={embedded ? 'space-y-6' : 'min-h-screen space-y-6 bg-[#f6f7fb] p-6 dark:bg-[#061723]'}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className={`${panelCls} flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between`}>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => navigate('/app/finance/payments')}
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
            >
              <ArrowLeft size={16} />
              Back to Payments
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Manual Invoice</p>
              <h1 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">
                {editingManualInvoiceId ? 'Edit Manual Invoice' : 'New Manual Invoice'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Post invoices that are not captured by bank feeds.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setManualInvoiceForm(createManualInvoiceForm())} className={subtleButtonCls}>
              <RotateCcw size={16} />
              Clear
            </button>
            <button type="button" onClick={saveManualInvoice} className={primaryButtonCls} disabled={saving}>
              <Wallet size={16} />
              Save Invoice
            </button>
          </div>
        </div>

        <div className={panelCls}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>Invoice Number</label>
              <input
                value={manualInvoiceForm.invoice_number}
                onChange={(event) => setManualInvoiceForm((current) => ({ ...current, invoice_number: event.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Invoice Date</label>
              <input
                type="date"
                value={manualInvoiceForm.invoice_date}
                onChange={(event) => setManualInvoiceForm((current) => ({ ...current, invoice_date: event.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Due Date</label>
              <input
                type="date"
                value={manualInvoiceForm.due_date}
                onChange={(event) => setManualInvoiceForm((current) => ({ ...current, due_date: event.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Transaction Class</label>
              <input
                value={manualInvoiceForm.transaction_class}
                onChange={(event) => setManualInvoiceForm((current) => ({ ...current, transaction_class: event.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Receivable Account</label>
              <select
                value={manualInvoiceForm.receivable_account}
                onChange={(event) => setManualInvoiceForm((current) => ({ ...current, receivable_account: event.target.value }))}
                className={inputCls}
              >
                {ACCOUNT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <select
                value={manualInvoiceForm.currency}
                onChange={(event) => setManualInvoiceForm((current) => ({ ...current, currency: event.target.value }))}
                className={inputCls}
              >
                {CURRENCY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Bill To</label>
              <input
                value={manualInvoiceForm.bill_to}
                onChange={(event) => setManualInvoiceForm((current) => ({ ...current, bill_to: event.target.value }))}
                className={inputCls}
                placeholder="Customer or department"
              />
            </div>
            <div>
              <label className={labelCls}>Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={manualInvoiceForm.amount}
                onChange={(event) => setManualInvoiceForm((current) => ({ ...current, amount: event.target.value }))}
                className={inputCls}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea
                rows={4}
                value={manualInvoiceForm.notes}
                onChange={(event) => setManualInvoiceForm((current) => ({ ...current, notes: event.target.value }))}
                className={inputCls}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderManualDepositEditorPage = () => (
    <div className={embedded ? 'space-y-6' : 'min-h-screen space-y-6 bg-[#f6f7fb] p-6 dark:bg-[#061723]'}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className={`${panelCls} flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between`}>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => navigate('/app/finance/payments')}
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
            >
              <ArrowLeft size={16} />
              Back to Payments
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Manual Deposit</p>
              <h1 className="mt-2 text-3xl font-black text-slate-900 dark:text-white">
                {editingManualDepositId ? 'Edit Manual Deposit' : 'New Manual Deposit'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Post deposits that arrive outside a bank feed or statement import.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setManualDepositForm(createManualDepositForm())} className={subtleButtonCls}>
              <RotateCcw size={16} />
              Clear
            </button>
            <button type="button" onClick={saveManualDeposit} className={primaryButtonCls} disabled={saving}>
              <Wallet size={16} />
              Save Deposit
            </button>
          </div>
        </div>

        <div className={panelCls}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelCls}>Receipt Number</label>
              <input
                value={manualDepositForm.receipt_number}
                onChange={(event) => setManualDepositForm((current) => ({ ...current, receipt_number: event.target.value }))}
                className={inputCls}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className={labelCls}>Receipt Date</label>
              <input
                type="date"
                value={manualDepositForm.receipt_date}
                onChange={(event) => setManualDepositForm((current) => ({ ...current, receipt_date: event.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={manualDepositForm.amount}
                onChange={(event) => setManualDepositForm((current) => ({ ...current, amount: event.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Payment Method</label>
              <select
                value={manualDepositForm.payment_method}
                onChange={(event) => setManualDepositForm((current) => ({ ...current, payment_method: event.target.value }))}
                className={inputCls}
              >
                {paymentMethodOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <select
                value={manualDepositForm.currency}
                onChange={(event) => setManualDepositForm((current) => ({ ...current, currency: event.target.value }))}
                className={inputCls}
              >
                {CURRENCY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select
                value={manualDepositForm.category}
                onChange={(event) => setManualDepositForm((current) => ({ ...current, category: event.target.value }))}
                className={inputCls}
              >
                {RECEIPT_CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Received From</label>
              <input
                value={manualDepositForm.received_from}
                onChange={(event) => setManualDepositForm((current) => ({ ...current, received_from: event.target.value }))}
                className={inputCls}
                placeholder="Customer or payer"
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Description</label>
              <input
                value={manualDepositForm.description}
                onChange={(event) => setManualDepositForm((current) => ({ ...current, description: event.target.value }))}
                className={inputCls}
                placeholder="Deposit reason"
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Invoice Number (optional)</label>
              <input
                value={manualDepositForm.invoice_number}
                onChange={(event) => setManualDepositForm((current) => ({ ...current, invoice_number: event.target.value }))}
                className={inputCls}
                placeholder="Link to invoice number"
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea
                rows={4}
                value={manualDepositForm.notes}
                onChange={(event) => setManualDepositForm((current) => ({ ...current, notes: event.target.value }))}
                className={inputCls}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading || (isManualEditorRoute && !isManualEditorReady)) {
    return <CustomLoader text={isManualInvoiceEditorRoute ? 'Loading manual invoice editor...' : 'Loading manual deposit editor...'} />;
  }

  if (isManualInvoiceEditorRoute) {
    return renderManualInvoiceEditorPage();
  }

  if (isManualDepositEditorRoute) {
    return renderManualDepositEditorPage();
  }

  return (
    <div className={embedded ? 'space-y-6' : pageShellCls}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-white/60 to-transparent dark:from-white/5" />
      <div className="relative space-y-6">
        <div className={`${panelCls} overflow-hidden border-white/60 py-2 sm:py-3`}>
          <div className="relative grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {!embedded ? (
                  <button
                    type="button"
                    onClick={() => navigate('/app/finance/dashboard')}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition duration-200 hover:border-[#ff6a00]/30 hover:bg-[#ff6a00]/5 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.06]"
                    title="Back to Finance Dashboard"
                    aria-label="Back to Finance Dashboard"
                  >
                    <ArrowLeft size={15} />
                  </button>
                ) : null}
                <span className={`${heroBadgeCls} px-2 py-0.5 text-[8px]`}>Voucher studio</span>
                <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400">Payments, approvals, and manual entries in one place</span>
              </div>

              <div className="max-w-2xl space-y-1">
                <h1 className="text-[1.45rem] font-black tracking-tight text-slate-900 dark:text-white leading-tight sm:text-[1.6rem]">
                  Finance Payments, redesigned.
                </h1>
                <p className="max-w-xl text-[0.86rem] leading-5 text-slate-600 dark:text-slate-300">
                  Capture vouchers, route approvals, manage payees, and keep manual deposits alongside your payment workflow without leaving the page.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {!workflowReady ? (
                  <button type="button" onClick={refreshWorkflow} className={subtleButtonCls}>
                    <RotateCcw size={15} />
                    Refresh Status
                  </button>
                ) : null}
                <button type="button" onClick={resetPaymentForm} className={subtleButtonCls}>
                  <RotateCcw size={15} />
                  Reset Voucher
                </button>
                <button type="button" onClick={handlePrint} className={subtleButtonCls}>
                  <Printer size={15} />
                  Print Last Saved
                </button>
                <button type="button" onClick={() => navigate('/app/finance/vendors')} className={subtleButtonCls}>
                  <Wallet size={15} />
                  Vendors/Payees
                </button>
                <button type="button" onClick={exportPayments} className={primaryButtonCls}>
                  <Download size={15} />
                  Export
                </button>
              </div>

              {!workflowReady ? (
                <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/90 px-3 py-1.5 text-xs text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                  <CircleAlert size={14} className="mt-0.5 shrink-0" />
                  <p>Payment voucher migration is required before payees and vouchers can be created.</p>
                </div>
              ) : null}
            </div>

            <div className="hidden xl:flex xl:flex-col xl:items-end xl:justify-center xl:gap-3">
              <div className="flex flex-wrap justify-end gap-2">
                <span className={workflowChipCls}>Approved requisitions</span>
                <span className={workflowChipCls}>Manual deposits</span>
                <span className={workflowChipCls}>Payee registry</span>
                <span className={workflowChipCls}>Statement imports</span>
              </div>
              <div className="text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Keep the workflow moving without leaving the page.
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative overflow-hidden rounded-[20px] border border-white/70 bg-white/90 p-4 shadow-[0_20px_70px_-44px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#ff6a00] via-[#ff944d] to-transparent" />
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ff6a00]/10 text-[#ff6a00] dark:bg-[#ff6a00]/15 dark:text-[#ffb37a]">
                <Receipt size={17} />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Visible Vouchers</p>
                <p className="mt-0.5 text-lg font-black text-slate-900 dark:text-white">{filteredPayments.length}</p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Filtered by your current voucher scope.</p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[20px] border border-white/70 bg-white/90 p-4 shadow-[0_20px_70px_-44px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-transparent" />
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                <Wallet size={17} />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Visible Amount</p>
                <p className="mt-0.5 text-lg font-black text-slate-900 dark:text-white">{formatMoney(visibleAmount)}</p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Payments visible in the current scope.</p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[20px] border border-white/70 bg-white/90 p-4 shadow-[0_20px_70px_-44px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-indigo-400 to-transparent" />
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
                <CheckCircle2 size={17} />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Approved Payees</p>
                <p className="mt-0.5 text-lg font-black text-slate-900 dark:text-white">{totalPayees}</p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Ready for voucher routing and payment.</p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[20px] border border-white/70 bg-white/90 p-4 shadow-[0_20px_70px_-44px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-500 via-rose-400 to-transparent" />
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">Voucher Balance</p>
              <p className={`mt-0.5 text-lg font-black ${currentUnallocated < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                {formatMoney(currentUnallocated, paymentForm.currency || 'KES')}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">Amount paid minus allocated bill rows.</p>
            </div>
          </div>
        </div>

      {organizationNotice ? (
        <div className="flex items-start gap-3 rounded-[24px] border border-amber-200 bg-amber-50/90 px-5 py-4 text-sm text-amber-900 shadow-sm dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
          <CircleAlert size={18} className="mt-0.5 shrink-0" />
          <p>{organizationNotice}</p>
        </div>
      ) : null}
      {dataNotice ? (
        <div className="flex items-start gap-3 rounded-[24px] border border-[#ff6a00]/20 bg-[#fff3eb] px-5 py-4 text-sm text-[#9a3f00] shadow-sm dark:border-[#ff6a00]/25 dark:bg-[#ff6a00]/10 dark:text-[#ffd3b5]">
          <CircleAlert size={18} className="mt-0.5 shrink-0" />
          <div className="space-y-3">
            <p>{dataNotice}</p>
            <button type="button" onClick={refreshWorkflow} className={subtleButtonCls}>
              <RotateCcw size={16} />
              Check Again
            </button>
          </div>
        </div>
      ) : null}

      <div className="w-full">
        <div className={sectionCardCls}>
          <div className={sectionHeaderCls}>
          <div className="mb-0 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className={sectionEyebrowCls}>Voucher Composer</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">New Payment Voucher</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">Capture the vendor, payment route, value, and supporting references inside the same finance theme used across the app. Approved requisitions appear here first so they can be turned into vouchers.</p>
            </div>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white/80 p-1 dark:border-slate-800 dark:bg-slate-950/60">
            <button
              type="button"
              onClick={() => handlePaymentFieldChange('paymentType', 'apply_to_bill')}
              className={`rounded-lg px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all duration-200 ${paymentForm.paymentType === 'apply_to_bill' ? 'bg-gradient-to-r from-[#ff6a00] to-[#ff8533] text-white shadow-md shadow-[#ff6a00]/15 scale-[1.02]' : 'text-slate-500 hover:text-[#ff6a00] dark:text-slate-400 dark:hover:text-[#ffb37a]'}`}
            >
              Apply To Bill
            </button>
            <button
              type="button"
              onClick={() => handlePaymentFieldChange('paymentType', 'cash_payment')}
              className={`rounded-lg px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all duration-200 ${paymentForm.paymentType === 'cash_payment' ? 'bg-gradient-to-r from-[#ff6a00] to-[#ff8533] text-white shadow-md shadow-[#ff6a00]/15 scale-[1.02]' : 'text-slate-500 hover:text-[#ff6a00] dark:text-slate-400 dark:hover:text-[#ffb37a]'}`}
            >
              Cash Payment
            </button>
          </div>
          </div>
          </div>

          <div className="mb-6 overflow-hidden rounded-[28px] border border-slate-200/90 bg-gradient-to-br from-white via-white to-[#fff7f1] shadow-[0_22px_56px_-40px_rgba(15,23,42,0.42)] dark:border-white/10 dark:from-[#082131] dark:via-[#071b29] dark:to-[#051520]">
            <div className="grid gap-0 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
              <div className="flex flex-col gap-4 border-b border-slate-200/80 p-5 dark:border-white/10 xl:border-b-0 xl:border-r">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex h-18 w-18 items-center justify-center rounded-[24px] bg-[#ff6a00]/10 text-2xl font-black text-[#ff6a00] dark:bg-[#ff6a00]/15 dark:text-[#ffb37a]">
                    {selectedEntityBrand.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Payment Voucher Header</p>
                    <h3 className="mt-2 truncate text-2xl font-black text-slate-900 dark:text-white">{selectedEntityBrand.displayName}</h3>
                    <div className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                      {selectedEntityBrand.addressLines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className={labelCls}>Entity</label>
                    <select
                      value={paymentForm.entity}
                      onChange={(event) => handlePaymentFieldChange('entity', event.target.value)}
                      className={inputCls}
                    >
                      {ENTITY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Voucher No.</label>
                    <input value={voucherPreviewNumber} readOnly className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Voucher Date</label>
                    <input value={paymentForm.recordingDate} readOnly className={inputCls} />
                  </div>
                </div>
              </div>
              <div className="grid gap-4 p-5 md:grid-cols-2">
                <div className="rounded-[22px] bg-white/85 p-4 shadow-sm dark:bg-white/[0.03]">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Top Right Summary</p>
                  <dl className="mt-3 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500 dark:text-slate-400">Payee</dt>
                      <dd className="font-semibold text-slate-900 dark:text-white">{paymentForm.payeeIds.length > 0 ? `${paymentForm.payeeIds.length} selected` : 'No payee selected'}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500 dark:text-slate-400">{referenceLabel}</dt>
                      <dd className="font-semibold text-slate-900 dark:text-white">{paymentForm.referenceNumber || '-'}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500 dark:text-slate-400">Debit Account</dt>
                      <dd className="max-w-[14rem] truncate font-semibold text-slate-900 dark:text-white">{paymentForm.payFromAccount || 'Select account'}</dd>
                    </div>
                  </dl>
                </div>
                <div className="rounded-[22px] bg-[#fff7f1] p-4 shadow-sm dark:bg-[#ff6a00]/10">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ff6a00] dark:text-[#ffb37a]">Amount Summary</p>
                  <p className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{formatMoney(voucherAmount, paymentForm.currency)}</p>
                  <p className="mt-3 text-sm font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">Amount in words</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">{voucherAmountWords}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={labelCls}>Approved Requisition Source</label>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <input
                      type="search"
                      value={approvedRequisitionSearch}
                      onChange={(event) => setApprovedRequisitionSearch(event.target.value)}
                      className={inputCls}
                      placeholder="Search requisition #, title, vendor, department..."
                      aria-label="Search approved requisitions"
                    />
                  </div>
                  <button type="button" onClick={clearApprovedRequisitionSearch} className={subtleButtonCls}>
                    <Search size={16} />
                    Clear
                  </button>
                </div>
                <div className="max-h-[220px] space-y-2 overflow-y-auto rounded-2xl bg-gray-50 p-3 shadow-sm dark:bg-dark-surface">
                  {filteredApprovedRequisitions.map((requisition) => {
                    const selected = selectedRequisitionIds.includes(requisition.id);
                    return (
                      <label
                        key={requisition.id}
                        className={`flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-3 text-sm transition-all duration-200 hover:scale-[1.01] ${
                          selected
                            ? 'border-[#ff6a00]/30 bg-[#ff6a00]/5 text-[#ff6a00] dark:border-[#ff6a00]/40 dark:bg-[#ff6a00]/10 dark:text-[#ffd3b5]'
                            : 'border-slate-100 bg-white text-slate-700 hover:border-slate-200 dark:border-slate-800/40 dark:bg-slate-950/20 dark:text-slate-200 dark:hover:border-slate-700/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${selected ? 'border-[#ff6a00]/30 bg-[#ff6a00]/10 text-[#ff6a00]' : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-white/[0.03]'}`}>
                            <Receipt size={14} />
                          </div>
                          <div>
                            <p className="font-bold tracking-tight">{requisition.requisition_number}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">{requisition.title}</p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleApprovedRequisitionSelection(requisition.id)}
                          className="h-4 w-4 rounded border-slate-300 text-[#ff6a00] focus:ring-[#ff6a00]/20"
                        />
                      </label>
                    );
                  })}
                  {approvedRequisitions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                      No approved requisitions waiting for payment.
                    </div>
                  ) : filteredApprovedRequisitions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                      No approved requisitions match your search.
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span>{selectedRequisitionIds.length} selected</span>
                  <button type="button" onClick={clearApprovedRequisitionSelection} className="font-semibold text-[#ff6a00]">
                    Clear selection
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {approvedRequisitions.length > 0
                  ? `${filteredApprovedRequisitions.length} of ${approvedRequisitions.length} approved requisition${approvedRequisitions.length === 1 ? '' : 's'} shown.`
                  : 'No approved requisitions are waiting to be converted into vouchers right now.'}
              </p>
            </div>

            {selectedRequisitionSource ? (
              <div className="md:col-span-2 rounded-[24px] bg-[#fff7f2] p-4 shadow-sm dark:bg-[#ff6a00]/10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedRequisitionSource.requisition_number}</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{selectedRequisitionSource.title}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    Approved
                  </span>
                </div>
                <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                  <p className="text-slate-700 dark:text-slate-200">Vendor: {selectedRequisitionSource.vendor_preference || '-'}</p>
                  <p className="text-slate-700 dark:text-slate-200">Needed By: {formatDateLabel(selectedRequisitionSource.needed_by)}</p>
                  <p className="text-slate-700 dark:text-slate-200">
                    Lines: {approvedRequisitionItemsLoading && selectedRequisitionSourceItems.length === 0 ? 'Loading...' : selectedRequisitionSourceItems.length}
                  </p>
                </div>
                <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                  <p className="text-slate-700 dark:text-slate-200">Bank Charges: {formatMoney(toNumber(selectedRequisitionSource.bank_charge_amount), paymentForm.currency)}</p>
                  <p className="text-slate-700 dark:text-slate-200">
                    Posting: {selectedRequisitionSource.bank_charge_mode === 'additional_expense' ? 'Additional expense' : 'Included in main transaction'}
                  </p>
                  <p className="text-slate-700 dark:text-slate-200">
                    Charge bank: {selectedRequisitionSource.charge_bank_account_id
                      ? financeDepositAccountsService.formatAccountLabel(bankAccounts.find((account) => account.id === selectedRequisitionSource.charge_bank_account_id) || {
                          id: selectedRequisitionSource.charge_bank_account_id,
                          company_id: '',
                          account_kind: 'bank',
                          bank_name: 'Selected bank account',
                          account_number: '',
                          account_holder_name: '',
                          currency: 'KES',
                          current_balance: 0,
                          is_active: true,
                        })
                      : 'Optional - not selected'}
                  </p>
                  <p className="text-slate-700 dark:text-slate-200">Total: {formatMoney(selectedRequisitionTotal, paymentForm.currency)}</p>
                </div>
              </div>
            ) : selectedRequisitionIds.length > 1 ? (
              <div className="md:col-span-2 rounded-[24px] bg-[#fff7f2] p-4 shadow-sm dark:bg-[#ff6a00]/10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedRequisitionIds.length} requisitions selected</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Vouchers will be created for each selected requisition on save using the vendor preference.</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    Approved
                  </span>
                </div>
                <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                  <p className="text-slate-700 dark:text-slate-200">Estimated Total: {formatMoney(selectedRequisitionMultiTotal || 0, paymentForm.currency)}</p>
                  <p className="text-slate-700 dark:text-slate-200">Selected Requisitions: {selectedRequisitionIds.length}</p>
                </div>
              </div>
            ) : null}

            <div className="md:col-span-2">
              <label className={labelCls}>Payee / Vendor</label>
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className="max-h-[220px] space-y-2 overflow-y-auto rounded-2xl bg-gray-50 p-3 shadow-sm dark:bg-dark-surface">
                    {payees.map((payee) => {
                      const selected = paymentForm.payeeIds.includes(payee.id);
                      return (
                        <label
                          key={payee.id}
                          className={`flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-3 text-sm transition-all duration-200 hover:scale-[1.01] ${
                            selected
                              ? 'border-[#ff6a00]/30 bg-[#ff6a00]/5 text-[#ff6a00] dark:border-[#ff6a00]/40 dark:bg-[#ff6a00]/10 dark:text-[#ffd3b5]'
                              : 'border-slate-100 bg-white text-slate-700 hover:border-slate-200 dark:border-slate-800/40 dark:bg-slate-950/20 dark:text-slate-200 dark:hover:border-slate-700/60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${selected ? 'border-[#ff6a00]/30 bg-[#ff6a00]/10 text-[#ff6a00]' : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-white/[0.03]'}`}>
                              <CheckCircle2 size={14} />
                            </div>
                            <span className="font-bold tracking-tight">{payee.payee_name}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => togglePayeeSelection(payee.id)}
                            className="h-4 w-4 rounded border-slate-300 text-[#ff6a00] focus:ring-[#ff6a00]/20"
                          />
                        </label>
                      );
                    })}
                    {payees.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                        {workflowReady ? 'No approved payees yet. Use the + button to add one.' : 'Apply the payment voucher migration first.'}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>{paymentForm.payeeIds.length} selected</span>
                    <button type="button" onClick={clearPayeeSelection} className="font-semibold text-[#ff6a00]">
                      Clear selection
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={openPayeeComposer}
                  className={iconActionButtonCls}
                  title="Add new payee"
                  aria-label="Add new payee"
                  disabled={!workflowReady}
                >
                  <Plus size={18} />
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {workflowReady ? 'Migration is live, so the payee sheet is ready to use.' : 'Apply the payment voucher migration first, then create a payee.'}
              </p>
            </div>

            <FinanceAccountSelect
              label="Pay From A/C"
              value={
                paymentForm.payFromAccountId
                  ? `bank:${paymentForm.payFromAccountId}`
                  : paymentForm.payFromAccount
                    ? `label:${paymentForm.payFromAccount}`
                    : ''
              }
              options={payFromAccountOptions}
              onChange={handlePayFromAccountChange}
              inputCls={inputCls}
              labelCls={labelCls}
              subtleButtonCls={subtleButtonCls}
              iconActionButtonCls={iconActionButtonCls}
              placeholder="Select pay from account"
              onAdd={() => openReferenceOptionForm('pay_from_account')}
              addButtonTitle="Add new pay from account"
              addButtonAriaLabel="Add new pay from account"
              addButtonDisabled={!workflowReady}
              details={selectedPayFromAccountSummary}
            />
            <div>
              <label className={labelCls}>Payment Method</label>
              <div className="flex gap-2">
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(event) => handlePaymentFieldChange('paymentMethod', event.target.value)}
                  className={inputCls}
                >
                  {paymentMethodOptions.length === 0 ? (
                    <option value="">No payment methods configured</option>
                  ) : (
                    paymentMethodOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  onClick={() => openReferenceOptionForm('payment_method')}
                  className={iconActionButtonCls}
                  title="Add new payment method"
                  aria-label="Add new payment method"
                  disabled={!workflowReady}
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <select
                value={paymentForm.currency}
                onChange={(event) => handlePaymentFieldChange('currency', event.target.value)}
                className={inputCls}
              >
                {CURRENCY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Spot Rate</label>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={paymentForm.spotRate}
                onChange={(event) => handlePaymentFieldChange('spotRate', event.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Recording Date</label>
              <input
                type="date"
                value={paymentForm.recordingDate}
                onChange={(event) => handlePaymentFieldChange('recordingDate', event.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Quantity</label>
              <input
                type="number"
                min="0"
                step="1"
                value={paymentForm.quantity}
                onChange={(event) => handlePaymentFieldChange('quantity', event.target.value)}
                className={inputCls}
                placeholder="1"
              />
            </div>
            <div>
              <label className={labelCls}>Unit Cost</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={paymentForm.unitCost}
                onChange={(event) => handlePaymentFieldChange('unitCost', event.target.value)}
                className={inputCls}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className={labelCls}>Amount Paid</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={paymentForm.amount}
                onChange={(event) => handlePaymentFieldChange('amount', event.target.value)}
                className={inputCls}
                placeholder="0.00"
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Specification / Technical Detail</label>
              <input
                value={paymentForm.specification}
                onChange={(event) => handlePaymentFieldChange('specification', event.target.value)}
                className={inputCls}
                placeholder="Extra item detail (optional)"
              />
            </div>
            <div>
              <label className={labelCls}>{referenceLabel}</label>
              <input
                value={paymentForm.referenceNumber}
                onChange={(event) => handlePaymentFieldChange('referenceNumber', event.target.value)}
                className={inputCls}
                placeholder={referencePlaceholder}
              />
            </div>
            <div>
              <label className={labelCls}>Bank Charge Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={paymentForm.bankChargeAmount}
                onChange={(event) => handlePaymentFieldChange('bankChargeAmount', event.target.value)}
                className={inputCls}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className={labelCls}>Cheque Date</label>
              <input
                type="date"
                value={paymentForm.chequeDate}
                onChange={(event) => handlePaymentFieldChange('chequeDate', event.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Cost Center</label>
              <div className="flex gap-2">
                <select
                  value={paymentForm.costCenter}
                  onChange={(event) => handlePaymentFieldChange('costCenter', event.target.value)}
                  className={inputCls}
                >
                  <option value="">Select cost center</option>
                  {costCenterOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => openReferenceOptionForm('cost_center')}
                  className={iconActionButtonCls}
                  title="Add new cost center"
                  aria-label="Add new cost center"
                  disabled={!workflowReady}
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Payee References</label>
              <textarea
                rows={3}
                value={paymentForm.payeeReferences}
                onChange={(event) => handlePaymentFieldChange('payeeReferences', event.target.value)}
                className={inputCls}
                placeholder={hasSelectedPayee ? 'Optional: one reference per selected payee, one per line' : 'Select a vendor first to add references'}
                disabled={!hasSelectedPayee}
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Select a vendor first. This note is tied to the selected vendor/payee, and you can add one line per selected payee.
              </p>
            </div>
            <div>
              <label className={labelCls}>Expense Group</label>
              <div className="flex gap-2">
                <select
                  value={paymentForm.expenseGroup}
                  onChange={(event) => handlePaymentFieldChange('expenseGroup', event.target.value)}
                  className={inputCls}
                >
                  <option value="">Select expense group</option>
                  {expenseGroupOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={openExpenseGroupForm}
                  className={iconActionButtonCls}
                  title="Add new expense group"
                  aria-label="Add new expense group"
                  disabled={!workflowReady}
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-[#ff6a00]/40 dark:border-white/10 dark:bg-dark-surface dark:text-slate-200 dark:hover:border-[#ff6a00]/30 outline-none focus-within:border-[#ff6a00]/40 focus-within:ring-4 focus-within:ring-[#ff6a00]/10 dark:focus-within:border-[#ff6a00]/40">
              <input
                id="post-dated-cheque"
                type="checkbox"
                checked={paymentForm.isPostDatedCheque}
                onChange={(event) => handlePaymentFieldChange('isPostDatedCheque', event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#ff6a00] focus:ring-[#ff6a00]/30 dark:border-white/10 dark:bg-white/5 dark:checked:border-[#ff6a00] dark:checked:bg-[#ff6a00]"
              />
              <span>Post-dated cheque</span>
            </label>
            <div className="md:col-span-2">
              <label className={labelCls}>Particular / Description</label>
              <input
                value={paymentForm.description}
                onChange={(event) => handlePaymentFieldChange('description', event.target.value)}
                className={inputCls}
                placeholder="What this payment covers"
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Attachment Links</label>
              <textarea
                rows={3}
                value={paymentForm.attachmentUrlsText}
                onChange={(event) => handlePaymentFieldChange('attachmentUrlsText', event.target.value)}
                className={inputCls}
                placeholder="One file URL per line"
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Notes</label>
              <textarea
                rows={4}
                value={paymentForm.voucherNotes}
                onChange={(event) => handlePaymentFieldChange('voucherNotes', event.target.value)}
                className={inputCls}
                placeholder="Capture payment information, narration, or approval notes"
              />
            </div>
          </div>

          {paymentForm.paymentType === 'cash_payment' ? (
            <div className="mt-6 rounded-[28px] border border-slate-200/90 bg-gradient-to-br from-white via-white to-[#fff6ef] p-4 shadow-[0_22px_56px_-42px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-gradient-to-br dark:from-[#082131] dark:via-[#071b29] dark:to-[#051520] sm:p-5">
              <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Expense Voucher Lines</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">Capture the entity, expense group, narration, and line totals for this payment voucher.</p>
                  <div className="flex flex-wrap gap-2">
                    <div className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Rows</p>
                      <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{paymentForm.allocationRows.length}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Total</p>
                      <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{formatMoney(currentAllocationTotal, paymentForm.currency)}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">In words</p>
                      <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{voucherAmountWords}</p>
                    </div>
                  </div>
                </div>
                <button type="button" onClick={addAllocationRow} className={`${subtleButtonCls} self-start`}>
                  <Plus size={16} />
                  Add Expense Row
                </button>
              </div>

              <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-white/10 dark:bg-[#04141f]/70">
                <div className="overflow-x-auto">
                  <table className="min-w-[1400px] table-fixed text-sm">
                    <colgroup>
                      <col className="w-[200px]" />
                      <col className="w-[180px]" />
                      <col className="w-[360px]" />
                      <col className="w-[110px]" />
                      <col className="w-[140px]" />
                      <col className="w-[160px]" />
                      <col className="w-[120px]" />
                    </colgroup>
                    <thead className="bg-[#fff7f2] dark:bg-dark-surface">
                      <tr className="text-left text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        <th className="px-4 py-4">Entity</th>
                        <th className="px-4 py-4">Expense Group</th>
                        <th className="px-4 py-4">Description</th>
                        <th className="px-4 py-4">Qty</th>
                        <th className="px-4 py-4">Unit Cost</th>
                        <th className="px-4 py-4">Total</th>
                        <th className="px-4 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentForm.allocationRows.map((row, index) => (
                        <tr key={`expense-allocation-${index}`} className="border-t border-slate-200 align-top dark:border-white/10">
                          <td className="bg-white px-4 py-4 dark:bg-transparent">
                            <select
                              value={row.entity || paymentForm.entity}
                              onChange={(event) => handleAllocationChange(index, 'entity', event.target.value)}
                              className={allocationTableInputCls}
                            >
                              {ENTITY_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="bg-white px-4 py-4 dark:bg-transparent">
                            <div className="flex gap-2">
                              <select
                                value={row.expense_group || paymentForm.expenseGroup}
                                onChange={(event) => handleAllocationChange(index, 'expense_group', event.target.value)}
                                className={allocationTableInputCls}
                              >
                                <option value="">Select expense group</option>
                                {expenseGroupOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={openExpenseGroupForm}
                                className={iconActionButtonCls}
                                title="Add new expense group"
                                aria-label="Add new expense group"
                                disabled={!workflowReady}
                              >
                                <Plus size={18} />
                              </button>
                            </div>
                          </td>
                          <td className="bg-white px-4 py-4 dark:bg-transparent">
                            <input
                              value={row.particular}
                              onChange={(event) => handleAllocationChange(index, 'particular', event.target.value)}
                              className={allocationTableInputCls}
                              placeholder="Expense narration"
                            />
                          </td>
                          <td className="bg-white px-4 py-4 dark:bg-transparent">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.quantity}
                              onChange={(event) => handleAllocationChange(index, 'quantity', event.target.value)}
                              className={allocationNumericInputCls}
                              placeholder="1"
                            />
                          </td>
                          <td className="bg-white px-4 py-4 dark:bg-transparent">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.unit_cost}
                              onChange={(event) => handleAllocationChange(index, 'unit_cost', event.target.value)}
                              className={allocationNumericInputCls}
                              placeholder="0.00"
                            />
                          </td>
                          <td className="bg-white px-4 py-4 dark:bg-transparent">
                            <div className={allocationReadOnlyCellCls}>{formatMoney(toNumber(row.payable_total) || toNumber(row.quantity) * toNumber(row.unit_cost), paymentForm.currency)}</div>
                          </td>
                          <td className="bg-white px-4 py-4 text-right dark:bg-transparent">
                            <button
                              type="button"
                              onClick={() => removeAllocationRow(index)}
                              className="inline-flex h-11 items-center justify-center rounded-xl px-3 text-xs font-black uppercase tracking-[0.16em] text-rose-600 transition hover:bg-rose-50 hover:text-rose-700 dark:text-rose-300 dark:hover:bg-rose-400/10"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : paymentForm.paymentType === 'apply_to_bill' ? (
            <div className="mt-6 rounded-[28px] border border-slate-200/90 bg-gradient-to-br from-white via-white to-[#fff6ef] p-4 shadow-[0_22px_56px_-42px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-gradient-to-br dark:from-[#082131] dark:via-[#071b29] dark:to-[#051520] sm:p-5">
              <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Bill Allocation</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">Allocate this payment against invoice lines and keep the remaining balance visible while you work.</p>
                  <div className="flex flex-wrap gap-2">
                    <div className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Rows</p>
                      <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{paymentForm.allocationRows.length}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Allocated</p>
                      <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{formatMoney(currentAllocationTotal, paymentForm.currency)}</p>
                    </div>
                    <div className={`rounded-2xl border px-3 py-2 shadow-sm ${
                      currentUnallocated < 0
                        ? 'border-rose-200 bg-rose-50 dark:border-rose-400/20 dark:bg-rose-400/10'
                        : 'border-emerald-200 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-400/10'
                    }`}>
                      <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${
                        currentUnallocated < 0 ? 'text-rose-500 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'
                      }`}>
                        Remaining
                      </p>
                      <p className={`mt-1 text-sm font-bold ${
                        currentUnallocated < 0 ? 'text-rose-700 dark:text-rose-200' : 'text-emerald-700 dark:text-emerald-200'
                      }`}>
                        {formatMoney(currentUnallocated, paymentForm.currency)}
                      </p>
                    </div>
                  </div>
                </div>
                <button type="button" onClick={addAllocationRow} className={`${subtleButtonCls} self-start`}>
                  <Plus size={16} />
                  Add Bill Row
                </button>
              </div>

              <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-white/10 dark:bg-[#04141f]/70">
                <div className="overflow-x-auto">
                  <table className="min-w-[1900px] table-fixed text-sm">
                    <colgroup>
                      <col className="w-[140px]" />
                      <col className="w-[120px]" />
                      <col className="w-[190px]" />
                      <col className="w-[190px]" />
                      <col className="w-[100px]" />
                      <col className="w-[120px]" />
                      <col className="w-[120px]" />
                      <col className="w-[110px]" />
                      <col className="w-[110px]" />
                      <col className="w-[120px]" />
                      <col className="w-[130px]" />
                      <col className="w-[140px]" />
                      <col className="w-[110px]" />
                    </colgroup>
                  <thead className="bg-[#fff7f2] dark:bg-dark-surface">
                    <tr className="text-left text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      <th className="px-4 py-4">Date</th>
                      <th className="px-4 py-4">Inv No.</th>
                      <th className="px-4 py-4">Particular</th>
                      <th className="px-4 py-4">Specification</th>
                      <th className="px-4 py-4">Qty</th>
                      <th className="px-4 py-4">Unit Cost</th>
                      <th className="px-4 py-4">Payable Total</th>
                      <th className="px-4 py-4">WHT Tax</th>
                      <th className="px-4 py-4">Paid</th>
                      <th className="px-4 py-4">Amt Due</th>
                      <th className="px-4 py-4">Payment</th>
                      <th className="px-4 py-4">New Balance</th>
                      <th className="px-4 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentForm.allocationRows.map((row, index) => (
                      <tr key={`allocation-${index}`} className="border-t border-slate-200 align-top dark:border-white/10">
                        <td className="bg-white px-4 py-4 dark:bg-transparent">
                          <input
                            type="date"
                            value={row.bill_date}
                            onChange={(event) => handleAllocationChange(index, 'bill_date', event.target.value)}
                            className={allocationTableInputCls}
                          />
                        </td>
                        <td className="bg-white px-4 py-4 dark:bg-transparent">
                          <input
                            value={row.invoice_number}
                            onChange={(event) => handleAllocationChange(index, 'invoice_number', event.target.value)}
                            className={allocationTableInputCls}
                            placeholder="INV-001"
                          />
                        </td>
                         <td className="bg-white px-4 py-4 dark:bg-transparent">
                          <input
                            value={row.particular}
                            onChange={(event) => handleAllocationChange(index, 'particular', event.target.value)}
                            className={allocationTableInputCls}
                            placeholder="Invoice detail"
                          />
                        </td>
                        <td className="bg-white px-4 py-4 dark:bg-transparent">
                          <input
                            value={row.specification}
                            onChange={(event) => handleAllocationChange(index, 'specification', event.target.value)}
                            className={allocationTableInputCls}
                            placeholder="Extra specification"
                          />
                        </td>
                        <td className="bg-white px-4 py-4 dark:bg-transparent">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.quantity}
                            onChange={(event) => handleAllocationChange(index, 'quantity', event.target.value)}
                            className={allocationNumericInputCls}
                            placeholder="1"
                          />
                        </td>
                        <td className="bg-white px-4 py-4 dark:bg-transparent">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.unit_cost}
                            onChange={(event) => handleAllocationChange(index, 'unit_cost', event.target.value)}
                            className={allocationNumericInputCls}
                            placeholder="0.00"
                          />
                        </td>
                        <td className="bg-white px-4 py-4 dark:bg-transparent">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.payable_total}
                            onChange={(event) => handleAllocationChange(index, 'payable_total', event.target.value)}
                            className={allocationNumericInputCls}
                            placeholder="0.00"
                          />
                        </td>
                        <td className="bg-white px-4 py-4 dark:bg-transparent">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.wht_tax}
                            onChange={(event) => handleAllocationChange(index, 'wht_tax', event.target.value)}
                            className={allocationNumericInputCls}
                            placeholder="0.00"
                          />
                        </td>
                        <td className="bg-white px-4 py-4 dark:bg-transparent">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.paid_to_date}
                            onChange={(event) => handleAllocationChange(index, 'paid_to_date', event.target.value)}
                            className={allocationNumericInputCls}
                            placeholder="0.00"
                          />
                        </td>
                        <td className="bg-white px-4 py-4 dark:bg-transparent">
                          <div className={allocationReadOnlyCellCls}>{formatMoney(computeAmountDue(row), paymentForm.currency)}</div>
                        </td>
                        <td className="bg-white px-4 py-4 dark:bg-transparent">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.payment_amount}
                            onChange={(event) => handleAllocationChange(index, 'payment_amount', event.target.value)}
                            className={allocationNumericInputCls}
                            placeholder="0.00"
                          />
                        </td>
                        <td className="bg-white px-4 py-4 dark:bg-transparent">
                          <div className={allocationReadOnlyCellCls}>{formatMoney(computeNewBalance(row), paymentForm.currency)}</div>
                        </td>
                        <td className="bg-white px-4 py-4 text-right dark:bg-transparent">
                          <button
                            type="button"
                            onClick={() => removeAllocationRow(index)}
                            className="inline-flex h-11 items-center justify-center rounded-xl px-3 text-xs font-black uppercase tracking-[0.16em] text-rose-600 transition hover:bg-rose-50 hover:text-rose-700 dark:text-rose-300 dark:hover:bg-rose-400/10"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-[22px] border border-slate-200 bg-white/85 p-4 text-sm dark:border-white/10 dark:bg-white/[0.03]">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400" htmlFor="payment-prepared-by">
                Prepared by
              </label>
              <input
                id="payment-prepared-by"
                value={paymentForm.preparedBy}
                onChange={(event) => handlePaymentFieldChange('preparedBy', event.target.value)}
                placeholder="Name of the preparer"
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#ff6a00] focus:ring-2 focus:ring-[#ff6a00]/20 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              />
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-white/85 p-4 text-sm dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400" htmlFor="payment-signature-name">
                  Signature
                </label>
                <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 text-[10px] font-black uppercase tracking-[0.16em] dark:border-white/10 dark:bg-white/[0.03]">
                  <button
                    type="button"
                    onClick={() => setPaymentForm((current) => ({ ...current, signatureMode: 'text' }))}
                    className={`rounded-full px-3 py-1.5 transition ${paymentForm.signatureMode === 'text' ? 'bg-[#ff6a00] text-white' : 'text-slate-500 dark:text-slate-300'}`}
                  >
                    Typed
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentForm((current) => ({ ...current, signatureMode: 'draw' }))}
                    className={`rounded-full px-3 py-1.5 transition ${paymentForm.signatureMode === 'draw' ? 'bg-[#ff6a00] text-white' : 'text-slate-500 dark:text-slate-300'}`}
                  >
                    Drawn
                  </button>
                </div>
              </div>
              <input
                id="payment-signature-name"
                value={paymentForm.signature}
                onChange={(event) => handlePaymentFieldChange('signature', event.target.value)}
                placeholder={paymentForm.signatureMode === 'text' ? 'Typed name for signature' : 'Name used for signature preview'}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#ff6a00] focus:ring-2 focus:ring-[#ff6a00]/20 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              />
              {paymentForm.signatureMode === 'draw' ? (
                <div className="mt-3">
                  <DigitalSignaturePad
                    label="Draw signature"
                    signerName={paymentForm.signature || signerName}
                    value={paymentForm.signatureDataUrl}
                    onChange={(value) => setPaymentForm((current) => ({ ...current, signatureDataUrl: value }))}
                  />
                </div>
              ) : (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Typed signatures are saved as a generated signature image, so they still print and appear on vouchers.
                </p>
              )}
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-white/85 p-4 text-sm dark:border-white/10 dark:bg-white/[0.03]">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400" htmlFor="payment-checked-by">
                Checked by
              </label>
              <input
                id="payment-checked-by"
                value={paymentForm.checkedBy}
                onChange={(event) => handlePaymentFieldChange('checkedBy', event.target.value)}
                placeholder="Name of the reviewer"
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#ff6a00] focus:ring-2 focus:ring-[#ff6a00]/20 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              />
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-white/85 p-4 text-sm dark:border-white/10 dark:bg-white/[0.03]">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400" htmlFor="payment-approved-by">
                Approved by
              </label>
              <input
                id="payment-approved-by"
                value={paymentForm.approvedByName}
                onChange={(event) => handlePaymentFieldChange('approvedByName', event.target.value)}
                placeholder="Name of the approver"
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#ff6a00] focus:ring-2 focus:ring-[#ff6a00]/20 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              />
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-white/85 p-4 text-sm dark:border-white/10 dark:bg-white/[0.03]">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400" htmlFor="payment-received-by">
                Received by
              </label>
              <input
                id="payment-received-by"
                value={paymentForm.receivedBy}
                onChange={(event) => handlePaymentFieldChange('receivedBy', event.target.value)}
                placeholder="Name of the recipient"
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#ff6a00] focus:ring-2 focus:ring-[#ff6a00]/20 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              />
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-white/85 p-4 text-sm dark:border-white/10 dark:bg-white/[0.03]">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400" htmlFor="payment-signoff-date">
                Date
              </label>
              <input
                id="payment-signoff-date"
                type="date"
                value={paymentForm.signoffDate}
                onChange={(event) => handlePaymentFieldChange('signoffDate', event.target.value)}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#ff6a00] focus:ring-2 focus:ring-[#ff6a00]/20 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={savePayment} className={primaryButtonCls} disabled={saving || !workflowReady}>
              <Wallet size={16} />
              Save Voucher
            </button>
            <button type="button" onClick={handlePrint} className={subtleButtonCls} disabled={!lastSavedVoucherPayment}>
              <Printer size={16} />
              Print Last Saved
            </button>
            <button type="button" onClick={resetPaymentForm} className={subtleButtonCls}>
              <RotateCcw size={16} />
              Clear Form
            </button>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className={sectionCardCls}>
          <div className={sectionHeaderCls}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={sectionEyebrowCls}>Connected Accounts</p>
              <h3 className="mt-2 text-lg font-black text-slate-900 dark:text-white">Bank & M-Pesa Feeds</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Save connections for Equity/ABSA and import statement rows for now. Live API sync can be added later.</p>
            </div>
            <button type="button" onClick={openConnectionComposer} className={subtleButtonCls} disabled={!workflowReady}>
              <Plus size={16} />
              Add Connection
            </button>
          </div>
          </div>

          <div className="p-6">
          {providerNotice ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
              {providerNotice}
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {providerConnections.map((connection) => (
              <div key={connection.id} className="rounded-2xl border border-gray-200 bg-white/80 p-4 text-sm shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{connection.connection_name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {connection.provider.toUpperCase()} · {connection.sync_mode.replace('_', ' ')} · {connection.status}
                    </p>
                  </div>
                  <button type="button" onClick={() => openStatementImportForm(connection.id)} className={subtleButtonCls}>
                    <Download size={14} />
                    Import Statement
                  </button>
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Last sync: {connection.last_synced_at ? formatDateLabel(connection.last_synced_at) : 'Not yet synced'}
                </div>
              </div>
            ))}
            {providerConnections.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                No provider connections yet. Add a bank connection to start importing statement deposits.
              </div>
            ) : null}
          </div>
          </div>
        </div>

        <div className={`${sectionCardCls} xl:col-span-2`}>
          <div className={sectionHeaderCls}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={sectionEyebrowCls}>Manual Entries</p>
              <h3 className="mt-2 text-lg font-black text-slate-900 dark:text-white">Manual Invoice & Deposits</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Use these when you want to enter a new invoice or deposit without relying on bank sync.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={openManualInvoiceComposer} className={subtleButtonCls}>
                <Plus size={16} />
                New Invoice
              </button>
              <button type="button" onClick={openManualDepositComposer} className={subtleButtonCls}>
                <Plus size={16} />
                New Deposit
              </button>
            </div>
          </div>
          </div>

          <div className="p-6 pt-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white/90 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Recent Manual Invoices</p>
              <div className="mt-3 space-y-2">
                {manualInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.02]">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{invoice.invoice_number || 'Invoice'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDateLabel(invoice.invoice_date)} · {formatMoney(toNumber(invoice.total_amount), invoice.currency || 'KES')} · {invoice.status}
                      </p>
                    </div>
                    <button type="button" onClick={() => navigate(`/app/finance/payments/manual-invoices/${invoice.id}/edit`)} className={subtleButtonCls}>
                      <Edit3 size={14} />
                      Edit
                    </button>
                  </div>
                ))}
                {manualInvoices.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                    No manual invoices yet.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white/90 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Recent Manual Deposits</p>
              <div className="mt-3 space-y-2">
                {manualDeposits.map((receipt) => (
                  <div key={receipt.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.02]">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{receipt.receipt_number || 'Deposit'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDateLabel(receipt.receipt_date)} · {formatMoney(toNumber(receipt.amount), receipt.currency || 'KES')} · {receipt.payment_method || 'Cash'}
                      </p>
                    </div>
                    <button type="button" onClick={() => navigate(`/app/finance/payments/manual-deposits/${receipt.id}/edit`)} className={subtleButtonCls}>
                      <Edit3 size={14} />
                      Edit
                    </button>
                  </div>
                ))}
                {manualDeposits.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-center text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                    No manual deposits yet.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>




          </div>
        </div>
      </div>

      {showManualInvoiceForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[32px] border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-dark-surface">
            <div className="border-b border-gray-200 bg-gradient-to-r from-[#fff3eb] via-white to-[#fff9f4] px-6 py-5 dark:border-white/10 dark:from-[#0b2a3c] dark:via-[#082131] dark:to-[#071b27]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Manual Invoice</p>
                  <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">
                    {editingManualInvoiceId ? 'Edit Manual Invoice' : 'New Manual Invoice'}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Post invoices that are not captured by bank feeds.</p>
                </div>
                <button type="button" onClick={() => setShowManualInvoiceForm(false)} className={subtleButtonCls}>
                  Close
                </button>
              </div>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-2">
              <div>
                <label className={labelCls}>Invoice Number</label>
                <input
                  value={manualInvoiceForm.invoice_number}
                  onChange={(event) => setManualInvoiceForm((current) => ({ ...current, invoice_number: event.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Invoice Date</label>
                <input
                  type="date"
                  value={manualInvoiceForm.invoice_date}
                  onChange={(event) => setManualInvoiceForm((current) => ({ ...current, invoice_date: event.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Due Date</label>
                <input
                  type="date"
                  value={manualInvoiceForm.due_date}
                  onChange={(event) => setManualInvoiceForm((current) => ({ ...current, due_date: event.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Transaction Class</label>
                <input
                  value={manualInvoiceForm.transaction_class}
                  onChange={(event) => setManualInvoiceForm((current) => ({ ...current, transaction_class: event.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Receivable Account</label>
                <select
                  value={manualInvoiceForm.receivable_account}
                  onChange={(event) => setManualInvoiceForm((current) => ({ ...current, receivable_account: event.target.value }))}
                  className={inputCls}
                >
                  {ACCOUNT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Currency</label>
                <select
                  value={manualInvoiceForm.currency}
                  onChange={(event) => setManualInvoiceForm((current) => ({ ...current, currency: event.target.value }))}
                  className={inputCls}
                >
                  {CURRENCY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Bill To</label>
                <input
                  value={manualInvoiceForm.bill_to}
                  onChange={(event) => setManualInvoiceForm((current) => ({ ...current, bill_to: event.target.value }))}
                  className={inputCls}
                  placeholder="Customer or department"
                />
              </div>
              <div>
                <label className={labelCls}>Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualInvoiceForm.amount}
                  onChange={(event) => setManualInvoiceForm((current) => ({ ...current, amount: event.target.value }))}
                  className={inputCls}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Notes</label>
                <textarea
                  rows={3}
                  value={manualInvoiceForm.notes}
                  onChange={(event) => setManualInvoiceForm((current) => ({ ...current, notes: event.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 px-6 pb-6">
              <button type="button" onClick={saveManualInvoice} className={primaryButtonCls} disabled={saving}>
                <Wallet size={16} />
                Save Invoice
              </button>
              <button type="button" onClick={() => setManualInvoiceForm(createManualInvoiceForm())} className={subtleButtonCls}>
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showManualDepositForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[32px] border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-dark-surface">
            <div className="border-b border-gray-200 bg-gradient-to-r from-[#fff3eb] via-white to-[#fff9f4] px-6 py-5 dark:border-white/10 dark:from-[#0b2a3c] dark:via-[#082131] dark:to-[#071b27]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Manual Deposit</p>
                  <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">
                    {editingManualDepositId ? 'Edit Manual Deposit' : 'New Manual Deposit'}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Post deposits that arrive outside a bank feed or statement import.</p>
                </div>
                <button type="button" onClick={() => setShowManualDepositForm(false)} className={subtleButtonCls}>
                  Close
                </button>
              </div>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-2">
              <div>
                <label className={labelCls}>Receipt Number</label>
                <input
                  value={manualDepositForm.receipt_number}
                  onChange={(event) => setManualDepositForm((current) => ({ ...current, receipt_number: event.target.value }))}
                  className={inputCls}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className={labelCls}>Receipt Date</label>
                <input
                  type="date"
                  value={manualDepositForm.receipt_date}
                  onChange={(event) => setManualDepositForm((current) => ({ ...current, receipt_date: event.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualDepositForm.amount}
                  onChange={(event) => setManualDepositForm((current) => ({ ...current, amount: event.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Payment Method</label>
                <select
                  value={manualDepositForm.payment_method}
                  onChange={(event) => setManualDepositForm((current) => ({ ...current, payment_method: event.target.value }))}
                  className={inputCls}
                >
                {paymentMethodOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Currency</label>
                <select
                  value={manualDepositForm.currency}
                  onChange={(event) => setManualDepositForm((current) => ({ ...current, currency: event.target.value }))}
                  className={inputCls}
                >
                  {CURRENCY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <select
                  value={manualDepositForm.category}
                  onChange={(event) => setManualDepositForm((current) => ({ ...current, category: event.target.value }))}
                  className={inputCls}
                >
                  {RECEIPT_CATEGORY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Received From</label>
                <input
                  value={manualDepositForm.received_from}
                  onChange={(event) => setManualDepositForm((current) => ({ ...current, received_from: event.target.value }))}
                  className={inputCls}
                  placeholder="Customer or payer"
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Description</label>
                <input
                  value={manualDepositForm.description}
                  onChange={(event) => setManualDepositForm((current) => ({ ...current, description: event.target.value }))}
                  className={inputCls}
                  placeholder="Deposit reason"
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Invoice Number (optional)</label>
                <input
                  value={manualDepositForm.invoice_number}
                  onChange={(event) => setManualDepositForm((current) => ({ ...current, invoice_number: event.target.value }))}
                  className={inputCls}
                  placeholder="Link to invoice number"
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Notes</label>
                <textarea
                  rows={3}
                  value={manualDepositForm.notes}
                  onChange={(event) => setManualDepositForm((current) => ({ ...current, notes: event.target.value }))}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 px-6 pb-6">
              <button type="button" onClick={saveManualDeposit} className={primaryButtonCls} disabled={saving}>
                <Wallet size={16} />
                Save Deposit
              </button>
              <button type="button" onClick={() => setManualDepositForm(createManualDepositForm())} className={subtleButtonCls}>
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showConnectionForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[32px] border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-dark-surface">
            <div className="border-b border-gray-200 bg-gradient-to-r from-[#fff3eb] via-white to-[#fff9f4] px-6 py-5 dark:border-white/10 dark:from-[#0b2a3c] dark:via-[#082131] dark:to-[#071b27]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Bank Connection</p>
                  <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">Add Bank Connection</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">This will allow statement imports for Equity or ABSA.</p>
                </div>
                <button type="button" onClick={() => setShowConnectionForm(false)} className={subtleButtonCls}>
                  Close
                </button>
              </div>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelCls}>Connection Name</label>
                <input
                  value={connectionForm.connection_name}
                  onChange={(event) => setConnectionForm((current) => ({ ...current, connection_name: event.target.value }))}
                  className={inputCls}
                  placeholder="Equity Main Account"
                />
              </div>
              <div>
                <label className={labelCls}>Provider</label>
                <select
                  value={connectionForm.provider}
                  onChange={(event) => setConnectionForm((current) => ({ ...current, provider: event.target.value as ConnectionFormState['provider'] }))}
                  className={inputCls}
                >
                  <option value="equity">Equity</option>
                  <option value="absa">ABSA</option>
                  <option value="manual_import">Manual Import</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Sync Mode</label>
                <select
                  value={connectionForm.sync_mode}
                  onChange={(event) => setConnectionForm((current) => ({ ...current, sync_mode: event.target.value as ConnectionFormState['sync_mode'] }))}
                  className={inputCls}
                >
                  <option value="statement_import">Statement Import</option>
                  <option value="api">API (later)</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Bank Account</label>
                <select
                  value={connectionForm.bank_account_id}
                  onChange={(event) => setConnectionForm((current) => ({ ...current, bank_account_id: event.target.value }))}
                  className={inputCls}
                >
                  <option value="">Select bank account</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {financeDepositAccountsService.formatAccountLabel(account)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 px-6 pb-6">
              <button type="button" onClick={saveConnection} className={primaryButtonCls} disabled={saving}>
                <Plus size={16} />
                Save Connection
              </button>
              <button type="button" onClick={() => setConnectionForm(createConnectionForm())} className={subtleButtonCls}>
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showStatementImport ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[32px] border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-dark-surface">
            <div className="border-b border-gray-200 bg-gradient-to-r from-[#fff3eb] via-white to-[#fff9f4] px-6 py-5 dark:border-white/10 dark:from-[#0b2a3c] dark:via-[#082131] dark:to-[#071b27]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Statement Import</p>
                  <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">Paste Statement Rows</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Paste a JSON array of statement rows to update balances and deposits.</p>
                </div>
                <button type="button" onClick={() => setShowStatementImport(false)} className={subtleButtonCls}>
                  Close
                </button>
              </div>
            </div>

            <div className="grid gap-4 p-6">
              <div>
                <label className={labelCls}>Connection</label>
                <select
                  value={statementImportForm.connection_id}
                  onChange={(event) => setStatementImportForm((current) => ({ ...current, connection_id: event.target.value }))}
                  className={inputCls}
                >
                  <option value="">Select connection</option>
                  {providerConnections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.connection_name} ({connection.provider.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Statement Rows (JSON Array)</label>
                <textarea
                  rows={6}
                  value={statementImportForm.payload_text}
                  onChange={(event) => setStatementImportForm((current) => ({ ...current, payload_text: event.target.value }))}
                  className={inputCls}
                  placeholder='[{"Receipt No.":"ABC123","Completion Time":"2026-04-06 10:00","Paid In":"5000"}]'
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 px-6 pb-6">
              <button type="button" onClick={runStatementImport} className={primaryButtonCls} disabled={saving}>
                <Download size={16} />
                Import
              </button>
              <button type="button" onClick={() => setStatementImportForm(createStatementImportForm())} className={subtleButtonCls}>
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPayeeForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-[32px] border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-dark-surface">
            <div className="border-b border-gray-200 bg-gradient-to-r from-[#fff3eb] via-white to-[#fff9f4] px-6 py-5 dark:border-white/10 dark:from-[#0b2a3c] dark:via-[#082131] dark:to-[#071b27]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Step 2: Create Payee</p>
                  <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">New Payee Details</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Capture the vendor fields once, then use the payee immediately in this voucher.</p>
                </div>
                <button type="button" onClick={() => setShowPayeeForm(false)} className={subtleButtonCls}>
                  Close
                </button>
              </div>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-2">
              <div>
                <label className={labelCls}>Vendor / Payee Name</label>
                <input value={payeeForm.payeeName} onChange={(event) => handlePayeeFieldChange('payeeName', event.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Client Grouping</label>
                <div className="flex gap-2">
                  <select value={payeeForm.clientGrouping} onChange={(event) => handlePayeeFieldChange('clientGrouping', event.target.value)} className={inputCls}>
                    <option value="">Select client group</option>
                    {clientGroupOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={openClientGroupForm} className={iconActionButtonCls} title="Add client group" aria-label="Add client group" disabled={!workflowReady}>
                    <Plus size={18} />
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Client A/C No.</label>
                <input value={payeeForm.clientAccountNumber} onChange={(event) => handlePayeeFieldChange('clientAccountNumber', event.target.value)} className={inputCls} placeholder="Client account number" />
              </div>
              <div>
                <label className={labelCls}>VAT/PIN Number</label>
                <input value={payeeForm.vatPinNumber} onChange={(event) => handlePayeeFieldChange('vatPinNumber', event.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Contact Person</label>
                <input value={payeeForm.contactPerson} onChange={(event) => handlePayeeFieldChange('contactPerson', event.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Telephone Number</label>
                <input value={payeeForm.telephoneNumber} onChange={(event) => handlePayeeFieldChange('telephoneNumber', event.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={payeeForm.email} onChange={(event) => handlePayeeFieldChange('email', event.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Transaction Currency</label>
                <select value={payeeForm.transactionCurrency} onChange={(event) => handlePayeeFieldChange('transactionCurrency', event.target.value)} className={inputCls}>
                  {CURRENCY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Bank Name</label>
                <input value={payeeForm.bankName} onChange={(event) => handlePayeeFieldChange('bankName', event.target.value)} className={inputCls} placeholder="Bank name (optional)" />
              </div>
              <div>
                <label className={labelCls}>Bank Account Name</label>
                <input value={payeeForm.bankAccountName} onChange={(event) => handlePayeeFieldChange('bankAccountName', event.target.value)} className={inputCls} placeholder="Account holder name (optional)" />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Bank Account Number</label>
                <input value={payeeForm.bankAccountNumber} onChange={(event) => handlePayeeFieldChange('bankAccountNumber', event.target.value)} className={inputCls} placeholder="Bank account number (optional)" />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>M-Pesa Phone Number</label>
                <input value={payeeForm.mpesaPhoneNumber} onChange={(event) => handlePayeeFieldChange('mpesaPhoneNumber', event.target.value)} className={inputCls} placeholder="2547XXXXXXXX (optional)" />
              </div>
              <div>
                <label className={labelCls}>Agreement Date</label>
                <input type="date" value={payeeForm.agreementDate} onChange={(event) => handlePayeeFieldChange('agreementDate', event.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Contract Start Date</label>
                <input type="date" value={payeeForm.contractStartDate} onChange={(event) => handlePayeeFieldChange('contractStartDate', event.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Contract End Date</label>
                <input type="date" value={payeeForm.contractEndDate} onChange={(event) => handlePayeeFieldChange('contractEndDate', event.target.value)} className={inputCls} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Payment Information</label>
                <textarea rows={3} value={payeeForm.paymentInformation} onChange={(event) => handlePayeeFieldChange('paymentInformation', event.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Invoicing Address</label>
                <textarea rows={4} value={payeeForm.invoicingAddress} onChange={(event) => handlePayeeFieldChange('invoicingAddress', event.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Shipping Address</label>
                <textarea rows={4} value={payeeForm.shippingAddress} onChange={(event) => handlePayeeFieldChange('shippingAddress', event.target.value)} className={inputCls} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Notes</label>
                <textarea rows={4} value={payeeForm.notes} onChange={(event) => handlePayeeFieldChange('notes', event.target.value)} className={inputCls} />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 px-6 pb-6">
              <button type="button" onClick={createPayee} className={primaryButtonCls} disabled={saving}>
                <Plus size={16} />
                Save Payee
              </button>
              <button type="button" onClick={() => setPayeeForm(createPayeeForm())} className={subtleButtonCls}>
                Clear Payee Form
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showClientGroupForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[32px] border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-dark-surface">
            <div className="border-b border-gray-200 bg-gradient-to-r from-[#fff3eb] via-white to-[#fff9f4] px-6 py-5 dark:border-white/10 dark:from-[#0b2a3c] dark:via-[#082131] dark:to-[#071b27]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Client Groups</p>
                  <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">Add New Client Group</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Save service groupings like Security, Facilities, or Real Estate and reuse them in the payee dropdown.</p>
                </div>
                <button type="button" onClick={() => setShowClientGroupForm(false)} className={subtleButtonCls}>
                  Close
                </button>
              </div>
            </div>

            <div className="p-6">
              <label className={labelCls}>Client Group Name</label>
              <input
                value={clientGroupForm.value}
                onChange={(event) => handleClientGroupFieldChange(event.target.value)}
                className={inputCls}
                placeholder="Security, Real Estate, Facilities..."
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3 px-6 pb-6">
              <button type="button" onClick={createClientGroup} className={primaryButtonCls} disabled={saving}>
                <Plus size={16} />
                Save Client Group
              </button>
              <button type="button" onClick={() => setClientGroupForm(createClientGroupForm())} className={subtleButtonCls}>
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showReferenceOptionForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[32px] border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-dark-surface">
            <div className="border-b border-gray-200 bg-gradient-to-r from-[#fff3eb] via-white to-[#fff9f4] px-6 py-5 dark:border-white/10 dark:from-[#0b2a3c] dark:via-[#082131] dark:to-[#071b27]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Reference Setup</p>
                  <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">
                    Add New {referenceOptionMeta[showReferenceOptionForm].label}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">This will be saved to the database and appear in the dropdown immediately.</p>
                </div>
                <button type="button" onClick={() => setShowReferenceOptionForm(null)} className={subtleButtonCls}>
                  Close
                </button>
              </div>
            </div>

            <div className="p-6">
              <label className={labelCls}>{referenceOptionMeta[showReferenceOptionForm].fieldLabel}</label>
              <input
                value={referenceOptionForm.value}
                onChange={(event) => setReferenceOptionForm((current) => ({ ...current, value: event.target.value }))}
                className={inputCls}
                placeholder={referenceOptionMeta[showReferenceOptionForm].placeholder}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3 px-6 pb-6">
              <button type="button" onClick={createReferenceOption} className={primaryButtonCls} disabled={saving}>
                <Plus size={16} />
                Save Option
              </button>
              <button type="button" onClick={() => setReferenceOptionForm(createReferenceOptionForm(showReferenceOptionForm))} className={subtleButtonCls}>
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showExpenseGroupForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[32px] border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-dark-surface">
            <div className="border-b border-gray-200 bg-gradient-to-r from-[#fff3eb] via-white to-[#fff9f4] px-6 py-5 dark:border-white/10 dark:from-[#0b2a3c] dark:via-[#082131] dark:to-[#071b27]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Expense Groups</p>
                  <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">Add New Expense Group</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Save expense groupings like Utilities, Fuel, or Salaries and reuse them in the expense group dropdown.</p>
                </div>
                <button type="button" onClick={() => setShowExpenseGroupForm(false)} className={subtleButtonCls}>
                  Close
                </button>
              </div>
            </div>

            <div className="p-6">
              <label className={labelCls}>Expense Group Name</label>
              <input
                value={expenseGroupForm.value}
                onChange={(event) => setExpenseGroupForm((current) => ({ ...current, value: event.target.value }))}
                className={inputCls}
                placeholder="Utilities, Fuel, Salaries..."
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3 px-6 pb-6">
              <button type="button" onClick={createExpenseGroup} className={primaryButtonCls} disabled={saving}>
                <Plus size={16} />
                Save Expense Group
              </button>
              <button type="button" onClick={() => setExpenseGroupForm(createClientGroupForm())} className={subtleButtonCls}>
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <CustomToast
          message={toast.message}
          type={toast.type}
          isVisible={true}
          onClose={() => setToast(null)}
        />
      ) : null}
      </div>
    </div>
  );
};

export default FinancePayments;


