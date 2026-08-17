// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ClipboardList, Edit2, Filter, Plus, Printer, RotateCcw, Search } from 'lucide-react';
import { escapeHtml, printDocument } from '../../utils/printHelpers';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { useAccess } from '../../hooks/useAccess';
import { resolveOrganizationScope } from '../../utils/organizationScope';
import { fetchRowsInBatches } from '../../utils/fetchRowsInBatches';
import { supabase } from '../../utils/supabase';
import financeDepositAccountsService, { FinanceDepositAccount } from '../../services/financeDepositAccountsService';
import FinanceAccountSelect from './components/FinanceAccountSelect';

type RequisitionPriority = 'low' | 'normal' | 'high' | 'urgent';
type RequisitionStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'ordered' | 'fulfilled';
type BankChargeMode = 'included_in_total' | 'additional_expense';
type ReferenceOptionType = 'pay_from_account' | 'payment_method';

interface FinanceRequisition {
  id: string;
  organization_id: string;
  requisition_number: string;
  title: string;
  department: string | null;
  needed_by: string | null;
  priority: RequisitionPriority;
  status: RequisitionStatus;
  approval_stage: 'submitted' | 'accounts_approved' | 'director_approved' | 'rejected';
  justification: string | null;
  vendor_preference: string | null;
  notes: string | null;
  bank_charge_amount: number;
  bank_charge_mode: BankChargeMode;
  charge_bank_account_id: string | null;
  accounts_approved_by: string | null;
  accounts_approved_at: string | null;
  director_approved_by: string | null;
  director_approved_at: string | null;
  created_at: string;
}

interface FinanceRequisitionItem {
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

interface DepartmentOption {
  id: string;
  name: string;
}

interface FinancePayeeOption {
  id: string;
  payee_name: string;
  contact_person: string | null;
  telephone_number: string | null;
  email: string | null;
}

interface FinanceBankAccountOption {
  id: string;
  company_id: string;
  account_kind: string;
  bank_name: string | null;
  account_number: string | null;
  account_holder_name: string | null;
  currency: string | null;
  current_balance: number | string | null;
  account_name?: string | null;
  business_name?: string | null;
  phone_number?: string | null;
  wallet_name?: string | null;
  wallet_provider?: string | null;
  wallet_identifier?: string | null;
  account_type?: string | null;
}

interface CompanyOption {
  id: string;
  name: string;
  code?: string | null;
}

interface PaymentReferenceOption {
  id: string;
  organization_id: string;
  option_type: ReferenceOptionType;
  option_value: string;
}

interface RequisitionItemDraft {
  itemDescription: string;
  specification: string;
  quantity: string;
  unitCost: string;
  preferredVendor: string;
}

interface RequisitionFormState {
  title: string;
  department: string;
  neededBy: string;
  priority: RequisitionPriority;
  status: RequisitionStatus;
  justification: string;
  vendorPreference: string;
  vendorPreferences: string[];
  notes: string;
  bankChargeAmount: string;
  bankChargeMode: BankChargeMode;
  chargeBankAccountSelection: string;
  chargeBankAccountId: string;
  items: RequisitionItemDraft[];
}

interface DepartmentCreateForm {
  name: string;
  description: string;
}

interface PayeeCreateForm {
  payeeName: string;
  contactPerson: string;
  telephoneNumber: string;
  email: string;
  paymentInformation: string;
}

interface ReferenceOptionFormState {
  value: string;
}

const panelCls = 'min-w-0 rounded-[28px] border border-gray-200 bg-white/95 p-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur-sm dark:border-white/10 dark:bg-dark-surface/90';
const inputCls = 'w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#ff6a00]/40 focus:bg-white focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-[#082131] dark:text-white dark:placeholder:text-slate-400 dark:focus:border-[#ff6a00]/40 dark:focus:bg-[#0b2a3c]';
const labelCls = 'mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300';
const subtleButtonCls = 'inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:border-[#ff6a00]/40 dark:hover:bg-white/[0.06]';
const primaryButtonCls = 'inline-flex items-center justify-center gap-2 rounded-2xl bg-[#ff6a00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e85f00] disabled:cursor-not-allowed disabled:opacity-60';
const iconActionButtonCls = 'inline-flex h-[50px] w-[50px] items-center justify-center rounded-2xl border border-[#ff6a00]/15 bg-[#ff6a00]/8 text-[#ff6a00] transition hover:bg-[#ff6a00]/14 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#ff6a00]/25 dark:bg-[#ff6a00]/10 dark:text-[#ffb37a] dark:hover:bg-[#ff6a00]/20';

const STATUS_LABELS: Record<RequisitionStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Accounts Review',
  approved: 'Approved',
  rejected: 'Rejected',
  ordered: 'Ordered',
  fulfilled: 'Fulfilled',
};

const STATUS_FLOW: RequisitionStatus[] = ['pending_approval', 'approved', 'ordered', 'fulfilled'];
const EDITABLE_STATUSES = new Set<RequisitionStatus>(['draft', 'pending_approval', 'rejected', 'ordered', 'fulfilled']);

const createItemDraft = (): RequisitionItemDraft => ({
  itemDescription: '',
  specification: '',
  quantity: '1',
  unitCost: '0',
  preferredVendor: '',
});

const createForm = (): RequisitionFormState => ({
  title: '',
  department: '',
  neededBy: '',
  priority: 'normal',
  status: 'pending_approval',
  justification: '',
  vendorPreference: '',
  vendorPreferences: [],
  notes: '',
  bankChargeAmount: '0',
  bankChargeMode: 'included_in_total',
  chargeBankAccountSelection: '',
  chargeBankAccountId: '',
  items: [createItemDraft()],
});

const createFormFromRequisition = (
  requisition: FinanceRequisition,
  requisitionItems: FinanceRequisitionItem[],
): RequisitionFormState => ({
  title: requisition.title,
  department: requisition.department || '',
  neededBy: requisition.needed_by || '',
  priority: requisition.priority,
  status: requisition.status,
  justification: requisition.justification || '',
  vendorPreference: requisition.vendor_preference || '',
  vendorPreferences: (requisition.vendor_preference || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  notes: requisition.notes || '',
  bankChargeAmount: `${Number(requisition.bank_charge_amount || 0)}`,
  bankChargeMode: requisition.bank_charge_mode || 'included_in_total',
  chargeBankAccountSelection: requisition.charge_bank_account_id ? `account:${requisition.charge_bank_account_id}` : '',
  chargeBankAccountId: requisition.charge_bank_account_id || '',
  items: requisitionItems.length > 0
    ? requisitionItems.map((item) => ({
        itemDescription: item.item_description,
        specification: item.specification || '',
        quantity: `${item.quantity}`,
        unitCost: `${item.unit_cost}`,
        preferredVendor: item.preferred_vendor || '',
      }))
    : [createItemDraft()],
});

const createDepartmentForm = (): DepartmentCreateForm => ({
  name: '',
  description: '',
});

const createPayeeForm = (): PayeeCreateForm => ({
  payeeName: '',
  contactPerson: '',
  telephoneNumber: '',
  email: '',
  paymentInformation: '',
});

const createReferenceOptionForm = (): ReferenceOptionFormState => ({
  value: '',
});

const normalizeText = (value?: string | null) => value?.trim().toLowerCase() || '';

const splitVendorPreferences = (value: string) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const mergeOptionValues = (defaults: string[], values: string[]) =>
  Array.from(new Set([...defaults, ...values.map((value) => value.trim()).filter(Boolean)])).sort((left, right) =>
    left.localeCompare(right),
  );

const formatFinanceAccountLabel = (account: FinanceBankAccountOption | FinanceDepositAccount) =>
  financeDepositAccountsService.formatAccountLabel(account as FinanceDepositAccount);

const toNumber = (value?: string | number | null) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value: number) =>
  `KES ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getStatusClasses = (status?: string | null) => {
  switch (status) {
    case 'approved':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
    case 'rejected':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300';
    case 'ordered':
      return 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300';
    case 'fulfilled':
      return 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300';
    case 'draft':
      return 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200';
    default:
      return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
  }
};

const todayString = () => new Date().toISOString().slice(0, 10);
const requisitionNumber = () => {
  const stamp = new Date().toISOString().split('.')[0].replace('T', '').replaceAll('-', '').replaceAll(':', '');
  return `REQ-${stamp.slice(0, 14)}`;
};
const errorText = (error: any) => `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
const isMissingRequisitionWorkflow = (error: any) => errorText(error).includes('finance_requisition');

const FinanceRequisitions: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { profile } = useAccess();
  const isBulkRoute = location.pathname.endsWith('/bulk');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workflowReady, setWorkflowReady] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationNotice, setOrganizationNotice] = useState<string | null>(null);
  const [dataNotice, setDataNotice] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>('Hakika app');
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [requisitions, setRequisitions] = useState<FinanceRequisition[]>([]);
  const [items, setItems] = useState<FinanceRequisitionItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [payees, setPayees] = useState<FinancePayeeOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<FinanceBankAccountOption[]>([]);
  const [referenceOptions, setReferenceOptions] = useState<PaymentReferenceOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingRequisitionId, setEditingRequisitionId] = useState<string | null>(null);
  const [form, setForm] = useState<RequisitionFormState>(createForm());
  const [showBulkRequisitionForm, setShowBulkRequisitionForm] = useState(false);
  const [bulkRequisitionForm, setBulkRequisitionForm] = useState<RequisitionFormState>(createForm());
  const [showDepartmentForm, setShowDepartmentForm] = useState(false);
  const [showPayeeForm, setShowPayeeForm] = useState(false);
  const [showReferenceOptionForm, setShowReferenceOptionForm] = useState(false);
  const [departmentForm, setDepartmentForm] = useState<DepartmentCreateForm>(createDepartmentForm());
  const [payeeForm, setPayeeForm] = useState<PayeeCreateForm>(createPayeeForm());
  const [referenceOptionForm, setReferenceOptionForm] = useState<ReferenceOptionFormState>(createReferenceOptionForm());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RequisitionStatus>('all');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [showAllVendors, setShowAllVendors] = useState(false);
  const [showAllVendorsBulk, setShowAllVendorsBulk] = useState(false);
  const [showAllVendorsBulk2, setShowAllVendorsBulk2] = useState(false);
  const [showVendorColumn, setShowVendorColumn] = useState(true);

  const loadData = async () => {
    setLoading(true);

    try {
      const scope = await resolveOrganizationScope(profile);
      setOrganizationId(scope.organizationId);
      setOrganizationNotice(scope.notice);
      setDataNotice(null);

      if (!scope.organizationId) {
        setWorkflowReady(false);
        setRequisitions([]);
        setItems([]);
        setBankAccounts([]);
        setOrganizationNotice('Your profile is not linked to an organization yet, so finance requisitions cannot be loaded.');
        return;
      }

      const [requisitionResponse, departmentResponse, payeeResponse, referenceOptionsResponse] = await Promise.all([
        supabase
          .from('finance_requisitions')
          .select('id, organization_id, requisition_number, title, department, needed_by, priority, status, approval_stage, justification, vendor_preference, notes, bank_charge_amount, bank_charge_mode, charge_bank_account_id, accounts_approved_by, accounts_approved_at, director_approved_by, director_approved_at, created_at')
          .eq('organization_id', scope.organizationId)
          .order('created_at', { ascending: false }),
        supabase
          .from('departments')
          .select('id, name')
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase
          .from('finance_payees')
          .select('id, payee_name, contact_person, telephone_number, email')
          .eq('organization_id', scope.organizationId)
          .eq('is_active', true)
          .order('payee_name', { ascending: true }),
        supabase
          .from('finance_payment_reference_options')
          .select('id, organization_id, option_type, option_value')
          .eq('organization_id', scope.organizationId)
          .order('option_value', { ascending: true }),
      ]);

      const requisitionError = requisitionResponse.error;

      if (requisitionError) {
        if (isMissingRequisitionWorkflow(requisitionError)) {
          setWorkflowReady(false);
          setRequisitions([]);
          setItems([]);
          setDataNotice('Apply the requisitions migration before using this page.');
          return;
        }

        throw requisitionError;
      }

      if (departmentResponse.error) throw departmentResponse.error;
      if (payeeResponse.error) throw payeeResponse.error;
      if (referenceOptionsResponse.error) throw referenceOptionsResponse.error;

      const nextRequisitions = (requisitionResponse.data || []) as FinanceRequisition[]; 
      const requisitionIds = nextRequisitions.map((entry) => entry.id);

      setWorkflowReady(true);
      setRequisitions(nextRequisitions);
      setDepartments((departmentResponse.data || []) as DepartmentOption[]);
      setPayees((payeeResponse.data || []) as FinancePayeeOption[]);
      setReferenceOptions((referenceOptionsResponse.data || []) as PaymentReferenceOption[]);
      setSelectedId((current) => current || nextRequisitions[0]?.id || null);

      // Load items in background, but only set itemsLoading if there are items to load
      if (requisitionIds.length > 0) {
        setItemsLoading(true);
        (async () => {
          try {
            const nextItems = await fetchRowsInBatches<FinanceRequisitionItem>({
              ids: requisitionIds,
              batchSize: 50,
              fetchBatch: (batchIds) =>
                supabase
                  .from('finance_requisition_items')
                  .select('id, requisition_id, item_description, specification, quantity, unit_cost, line_total, preferred_vendor, display_order')
                  .in('requisition_id', batchIds)
                  .order('display_order', { ascending: true }),
            });
            setItems(nextItems);
          } catch (itemError: any) {
            if (isMissingRequisitionWorkflow(itemError)) {
              setWorkflowReady(false);
              setRequisitions([]);
              setItems([]);
              setDataNotice('Apply the requisitions migration before using this page.');
              return;
            }

            console.error('Failed to load finance requisition items:', itemError);
            setItems([]); // Set empty items on error
          } finally {
            setItemsLoading(false);
          }
        })();
      } else {
        setItems([]); // Ensure items are cleared if there are no requisitions
        setItemsLoading(false);
      }

      setWorkflowReady(true);
      setRequisitions(nextRequisitions);
      setDepartments((departmentResponse.data || []) as DepartmentOption[]);
      setPayees((payeeResponse.data || []) as FinancePayeeOption[]);
      setReferenceOptions((referenceOptionsResponse.data || []) as PaymentReferenceOption[]);
      setSelectedId((current) => current || nextRequisitions[0]?.id || null);

      void (async () => {
        try {
          const { data: companyData, error: companyError } = await supabase
            .from('companies')
            .select('id, name, code, organization_id')
            .eq('organization_id', scope.organizationId)
            .order('name', { ascending: true });

          if (companyError) throw companyError;

          const companies = (companyData || []) as CompanyOption[];
          setCompanyName(companies[0] ? `${companies[0].name}${companies[0].code ? ` (${companies[0].code})` : ''}` : 'Hakika app');
          const companyIds = companies.map((company) => company.id);
          const lookupCompanyIds = companyIds.length > 0
            ? companyIds
            : profile?.company_id
              ? [profile.company_id]
              : [];

          if (lookupCompanyIds.length === 0) {
            setBankAccounts([]);
          } else {
            try {
              const serviceAccounts = await financeDepositAccountsService.listAccounts(lookupCompanyIds);
              setBankAccounts(serviceAccounts as FinanceBankAccountOption[]);
            } catch (bankAccountError: any) {
              console.error('Failed to load finance bank accounts:', bankAccountError);
              setBankAccounts([]);
            }
          }
        } catch (bankAccountError: any) {
          console.error('Failed to load finance bank accounts:', bankAccountError);
          setBankAccounts([]);
        }
      })();
    } catch (error: any) {
      console.error('Failed to load finance requisitions:', error);
      setToast({ message: error.message || 'Failed to load requisitions.', type: 'error' });
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
    const chargeBankAccountId = searchParams.get('chargeBankAccountId');
    if (!chargeBankAccountId) return;

    setForm((current) =>
      current.chargeBankAccountId === chargeBankAccountId
        ? current
        : { ...current, chargeBankAccountId, chargeBankAccountSelection: `account:${chargeBankAccountId}` },
    );
  }, [searchParams]);

  useEffect(() => {
    if (!form.chargeBankAccountId) return;

    const matchedAccount = bankAccounts.find((account) => account.id === form.chargeBankAccountId);
    if (!matchedAccount) return;

    setForm((current) =>
      current.chargeBankAccountSelection === `account:${matchedAccount.id}`
        ? current
        : { ...current, chargeBankAccountSelection: `account:${matchedAccount.id}` },
    );
  }, [bankAccounts, form.chargeBankAccountId]);

  const selectedRequisition = requisitions.find((entry) => entry.id === selectedId) || null;
  const selectedRequisitionChargeAccount = selectedRequisition?.charge_bank_account_id
    ? bankAccounts.find((account) => account.id === selectedRequisition.charge_bank_account_id) || {
        id: selectedRequisition.charge_bank_account_id,
        company_id: '',
        account_kind: 'general',
        bank_name: null,
        account_number: null,
        account_holder_name: null,
        account_type: null,
        account_name: null,
        business_name: null,
        phone_number: null,
        wallet_name: 'Selected account',
        wallet_provider: null,
        wallet_identifier: null,
        currency: null,
        current_balance: 0,
        is_active: true,
      }
    : null;
  const selectedRequisitionChargeBankLabel = selectedRequisitionChargeAccount
    ? financeDepositAccountsService.formatAccountLabel(selectedRequisitionChargeAccount as FinanceDepositAccount)
    : null;
  const selectedRequisitionChargeBankSubtitle = selectedRequisitionChargeAccount
    ? financeDepositAccountsService.formatAccountSubtitle(selectedRequisitionChargeAccount as FinanceDepositAccount)
    : null;
  const selectedChargePostingLabel = (() => {
    const account = form.chargeBankAccountId ? bankAccounts.find((item) => item.id === form.chargeBankAccountId) : null;
    if (!account) return 'Charge account posting';

    switch (account.account_kind) {
      case 'cash':
        return 'Cash charge posting';
      case 'mpesa':
        return 'M-Pesa charge posting';
      case 'general':
        return 'Wallet charge posting';
      default:
        return 'Bank charge posting';
    }
  })();
  const payFromAccountOptions = useMemo(() => {
    const bankOptions = bankAccounts
      .map((account) => ({
        value: `account:${account.id}`,
        label: formatFinanceAccountLabel(account),
        accountId: account.id,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));

    const manualOptions = mergeOptionValues(
      [],
      referenceOptions
        .filter((option) => option.option_type === 'pay_from_account' || option.option_type === 'payment_method')
        .map((option) => option.option_value),
    )
      .map((option) => ({
        value: `label:${option}`,
        label: option,
        accountId: null as string | null,
      }));

    return [...bankOptions, ...manualOptions];
  }, [bankAccounts, referenceOptions]);

  const findBankAccountByLabel = (label?: string | null) =>
    bankAccounts.find((account) => normalizeText(formatFinanceAccountLabel(account)) === normalizeText(label)) || null;
  const selectedItems = useMemo(
    () => items.filter((entry) => entry.requisition_id === selectedId),
    [items, selectedId],
  );
  const selectedRequisitionItemsTotal = useMemo(
    () => selectedItems.reduce((sum, item) => sum + Number(item.line_total || 0), 0),
    [selectedItems],
  );
  const selectedRequisitionTotal = selectedRequisitionItemsTotal + Number(selectedRequisition?.bank_charge_amount || 0);
  const filteredRequisitions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return requisitions.filter((entry) => {
      const matchesStatus = statusFilter === 'all' ? true : entry.status === statusFilter;
      const matchesVendor = vendorFilter ? normalizeText(entry.vendor_preference) === normalizeText(vendorFilter) : true;
      const matchesDepartment = departmentFilter ? normalizeText(entry.department) === normalizeText(departmentFilter) : true;
      const matchesDateFrom = dateFromFilter ? new Date(entry.created_at) >= new Date(`${dateFromFilter}T00:00:00`) : true;
      const matchesDateTo = dateToFilter ? new Date(entry.created_at) <= new Date(`${dateToFilter}T23:59:59.999`) : true;
      const matchesSearch = normalizedSearch
        ? [entry.requisition_number, entry.title, entry.department, entry.vendor_preference]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalizedSearch))
        : true;

      return matchesStatus && matchesSearch && matchesVendor && matchesDepartment && matchesDateFrom && matchesDateTo;
    });
  }, [requisitions, searchTerm, statusFilter, vendorFilter, departmentFilter, dateFromFilter, dateToFilter]);
  const draftTotal = useMemo(
    () => form.items.reduce((sum, item) => sum + (toNumber(item.quantity) * toNumber(item.unitCost)), 0) + toNumber(form.bankChargeAmount),
    [form.bankChargeAmount, form.items],
  );
  const requisitionSummary = useMemo(() => {
    const pendingApproval = requisitions.filter((entry) => entry.status === 'pending_approval').length;
    const urgent = requisitions.filter((entry) => entry.priority === 'urgent' || entry.priority === 'high').length;
    const orderedOutstanding = requisitions.filter((entry) => entry.status === 'ordered').length;
    const dueSoon = requisitions.filter((entry) => {
      if (!entry.needed_by) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const neededBy = new Date(entry.needed_by);
      neededBy.setHours(0, 0, 0, 0);
      const diff = Math.round((neededBy.getTime() - today.getTime()) / 86400000);
      return diff >= 0 && diff <= 7;
    }).length;

    return {
      pendingApproval,
      urgent,
      orderedOutstanding,
      dueSoon,
    };
  }, [requisitions]);

  const requisitionTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    requisitions.forEach((req) => {
      const itemsForReq = items.filter((item) => item.requisition_id === req.id);
      const itemsTotal = itemsForReq.reduce((sum, item) => sum + (item.line_total || 0), 0);
      totals[req.id] = itemsTotal + (req.bank_charge_amount || 0);
    });
    return totals;
  }, [requisitions, items]);

  const setField = (field: keyof RequisitionFormState, value: string) => {
    setForm((current) => {
      if (field === 'vendorPreference') {
        return {
          ...current,
          vendorPreference: value,
          vendorPreferences: splitVendorPreferences(value),
        };
      }
      return { ...current, [field]: value };
    });
  };

  const toggleVendorPreference = (vendorName: string) => {
    setForm((current) => {
      const selected = current.vendorPreferences.some((value) => normalizeText(value) === normalizeText(vendorName));
      const vendorPreferences = selected
        ? current.vendorPreferences.filter((value) => normalizeText(value) !== normalizeText(vendorName))
        : [...current.vendorPreferences, vendorName];

      return {
        ...current,
        vendorPreferences,
        vendorPreference: vendorPreferences.join(', '),
      };
    });
  };

  const setDepartmentField = (field: keyof DepartmentCreateForm, value: string) => {
    setDepartmentForm((current) => ({ ...current, [field]: value }));
  };

  const setPayeeField = (field: keyof PayeeCreateForm, value: string) => {
    setPayeeForm((current) => ({ ...current, [field]: value }));
  };

  const openReferenceOptionForm = () => {
    setReferenceOptionForm(createReferenceOptionForm());
    setShowReferenceOptionForm(true);
  };

  const createReferenceOption = async () => {
    if (!organizationId) {
      setToast({ message: 'An organization is required before adding dropdown options.', type: 'warning' });
      return;
    }

    const optionValue = referenceOptionForm.value.trim();
    if (!optionValue) {
      setToast({ message: 'Enter a value before saving the new option.', type: 'warning' });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('finance_payment_reference_options')
        .insert({
          organization_id: organizationId,
          option_type: 'pay_from_account',
          option_value: optionValue,
          created_by: profile?.id || null,
        })
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

      setShowReferenceOptionForm(false);
      setReferenceOptionForm(createReferenceOptionForm());
      setToast({ message: 'Pay From A/C option saved.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to create requisition account option:', error);
      setToast({ message: error.message || 'Failed to save the new option.', type: 'error' });
    }
  };

  const handleChargeBankAccountChange = (selection: string) => {
    if (!selection) {
      setForm((current) => ({ ...current, chargeBankAccountId: '', chargeBankAccountSelection: '' }));
      return;
    }

    if (selection.startsWith('account:')) {
      const accountId = selection.replace('account:', '');
      setForm((current) => ({ ...current, chargeBankAccountId: accountId, chargeBankAccountSelection: selection }));
      return;
    }

    if (selection.startsWith('bank:')) {
      const accountId = selection.replace('bank:', '');
      setForm((current) => ({ ...current, chargeBankAccountId: accountId, chargeBankAccountSelection: selection }));
      return;
    }

    if (selection.startsWith('label:')) {
      const label = selection.replace('label:', '');
      const matchedAccount = findBankAccountByLabel(label);
      setForm((current) => ({
        ...current,
        chargeBankAccountId: matchedAccount?.id || '',
        chargeBankAccountSelection: matchedAccount ? `account:${matchedAccount.id}` : selection,
      }));
    }
  };

  const setItemField = (index: number, field: keyof RequisitionItemDraft, value: string) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }));
  };

  const addItem = () => {
    setForm((current) => ({ ...current, items: [...current.items, createItemDraft()] }));
  };

  const removeItem = (index: number) => {
    setForm((current) => ({
      ...current,
      items: current.items.length === 1 ? [createItemDraft()] : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const resetForm = () => {
    setForm(createForm());
    setEditingRequisitionId(null);
  };

  const openBulkRequisitionForm = () => {
    navigate('/app/finance/expenses/bulk');
  };

  const setBulkField = (field: keyof RequisitionFormState, value: string) => {
    setBulkRequisitionForm((current) => ({ ...current, [field]: value }));
  };

  const setBulkItemField = (index: number, field: keyof RequisitionItemDraft, value: string) => {
    setBulkRequisitionForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }));
  };

  const addBulkItem = () => {
    setBulkRequisitionForm((current) => ({ ...current, items: [...current.items, createItemDraft()] }));
  };

  const removeBulkItem = (index: number) => {
    setBulkRequisitionForm((current) => ({
      ...current,
      items: current.items.length === 1 ? [createItemDraft()] : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const copyBulkToMainForm = () => {
    setForm({
      ...bulkRequisitionForm,
      items: bulkRequisitionForm.items.map((item) => ({ ...item })),
    });
    setEditingRequisitionId(null);
    setShowBulkRequisitionForm(false);
    setToast({ message: 'Bulk requisition draft copied to the main form.', type: 'success' });
  };

  const startEditRequisition = (requisitionId: string) => {
    const requisitionToEdit = requisitions.find((entry) => entry.id === requisitionId) || null;
    if (!requisitionToEdit) return;
    if (!EDITABLE_STATUSES.has(requisitionToEdit.status)) {
      setToast({ message: 'Approved requisitions cannot be edited.', type: 'warning' });
      return;
    }

    const requisitionItemRows = items.filter((entry) => entry.requisition_id === requisitionToEdit.id);
    setSelectedId(requisitionToEdit.id);
    setEditingRequisitionId(requisitionToEdit.id);
    setForm(createFormFromRequisition(requisitionToEdit, requisitionItemRows));
  };

  const startEditSelectedRequisition = () => {
    if (!selectedRequisition) return;
    startEditRequisition(selectedRequisition.id);
  };

  const openRequisitionForEdit = (requisitionId: string) => {
    if (itemsLoading) {
      setToast({ message: 'Please wait until requisition line items have finished loading before editing.', type: 'warning' });
      return;
    }

    const requisitionToEdit = requisitions.find((r) => r.id === requisitionId);
    if (!requisitionToEdit) {
      setToast({ message: 'Requisition not found.', type: 'error' });
      return;
    }

    startEditRequisition(requisitionId);
    
    // Scroll to the requisition form
    setTimeout(() => {
      const formElement = document.querySelector('[data-requisition-form]');
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handlePrint = () => {
    printSelectedRequisition();
  };

  const buildRequisitionPrintHtml = (requisition: FinanceRequisition, requisitionItems: FinanceRequisitionItem[]) => {
    const total = requisitionItems.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
    const grandTotal = total + Number(requisition.bank_charge_amount || 0);
    const approvedBy = requisition.director_approved_by || requisition.accounts_approved_by || null;
    const approvedAt = requisition.director_approved_at || requisition.accounts_approved_at || null;

    return `
      <div style="border:1px solid #e2e8f0;border-radius:20px;padding:18px 20px;margin-bottom:18px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
          <div>
            <div style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#64748b;font-weight:800;">Requisition</div>
            <h2 style="margin:6px 0 4px;font-size:22px;line-height:1.2;color:#0f172a;">${escapeHtml(requisition.title)}</h2>
            <div style="font-size:12px;color:#475569;">${escapeHtml(requisition.requisition_number)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#64748b;font-weight:800;">Status</div>
            <div style="margin-top:6px;font-size:14px;font-weight:800;color:#0f172a;">${escapeHtml(STATUS_LABELS[requisition.status] || requisition.status)}</div>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;">
        <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;font-weight:800;">Entity / Department</div><div style="margin-top:6px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(requisition.department || '-')}</div></div>
        <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;font-weight:800;">Needed By</div><div style="margin-top:6px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(requisition.needed_by || '-')}</div></div>
        <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;font-weight:800;">Vendor</div><div style="margin-top:6px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(requisition.vendor_preference || '-')}</div></div>
        <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;font-weight:800;">Approved By</div><div style="margin-top:6px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(approvedBy || '-')}</div><div style="margin-top:4px;font-size:12px;color:#64748b;">${approvedAt ? escapeHtml(new Date(approvedAt).toLocaleString()) : 'Not approved yet'}</div></div>
      </div>
      <div style="margin-top:18px;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="text-align:left;padding:12px 14px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#64748b;">Item</th>
              <th style="text-align:left;padding:12px 14px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#64748b;">Specification</th>
              <th style="text-align:right;padding:12px 14px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#64748b;">Qty</th>
              <th style="text-align:right;padding:12px 14px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#64748b;">Unit Cost</th>
              <th style="text-align:right;padding:12px 14px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#64748b;">Total</th>
              <th style="text-align:left;padding:12px 14px;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#64748b;">Vendor</th>
            </tr>
          </thead>
          <tbody>
            ${requisitionItems.map((item) => `
              <tr>
                <td style="padding:12px 14px;border-top:1px solid #e2e8f0;color:#0f172a;font-weight:700;">${escapeHtml(item.item_description)}</td>
                <td style="padding:12px 14px;border-top:1px solid #e2e8f0;color:#334155;">${escapeHtml(item.specification || '-')}</td>
                <td style="padding:12px 14px;border-top:1px solid #e2e8f0;text-align:right;color:#0f172a;">${Number(item.quantity || 0).toLocaleString()}</td>
                <td style="padding:12px 14px;border-top:1px solid #e2e8f0;text-align:right;color:#0f172a;">${formatMoney(Number(item.unit_cost || 0))}</td>
                <td style="padding:12px 14px;border-top:1px solid #e2e8f0;text-align:right;color:#0f172a;font-weight:700;">${formatMoney(Number(item.line_total || 0))}</td>
                <td style="padding:12px 14px;border-top:1px solid #e2e8f0;color:#334155;">${escapeHtml(item.preferred_vendor || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:16px;margin-top:16px;font-size:14px;">
        <div style="min-width:240px;border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;">
          <div style="display:flex;justify-content:space-between;gap:12px;"><span style="color:#64748b;">Items Total</span><strong style="color:#0f172a;">${formatMoney(total)}</strong></div>
          <div style="display:flex;justify-content:space-between;gap:12px;margin-top:8px;"><span style="color:#64748b;">Bank Charges</span><strong style="color:#0f172a;">${formatMoney(Number(requisition.bank_charge_amount || 0))}</strong></div>
          <div style="display:flex;justify-content:space-between;gap:12px;margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0;"><span style="color:#64748b;font-weight:700;">Grand Total</span><strong style="color:#0f172a;font-size:16px;">${formatMoney(grandTotal)}</strong></div>
        </div>
      </div>
      ${requisition.justification ? `<div style="margin-top:16px;border:1px solid #e2e8f0;border-radius:18px;padding:14px 16px;"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.22em;color:#64748b;font-weight:800;">Justification</div><div style="margin-top:6px;color:#334155;line-height:1.6;">${escapeHtml(requisition.justification)}</div></div>` : ''}
    `;
  };

  const printSelectedRequisition = () => {
    if (!selectedRequisition) {
      setToast({ message: 'Select a requisition before printing.', type: 'warning' });
      return;
    }

    const requisitionItems = items.filter((entry) => entry.requisition_id === selectedRequisition.id);
    printDocument({
      title: `Requisition ${selectedRequisition.requisition_number}`,
      subtitle: `${companyName} • Printed ${new Date().toLocaleString()}`,
      bodyHtml: buildRequisitionPrintHtml(selectedRequisition, requisitionItems),
      footerHtml: `Approved by: ${escapeHtml(selectedRequisition.director_approved_by || selectedRequisition.accounts_approved_by || 'Pending approval')}`,
    });
  };

  const printBulkRequisitions = () => {
    if (filteredRequisitions.length === 0) {
      setToast({ message: 'There are no requisitions to print with the current filters.', type: 'warning' });
      return;
    }

    const bodyHtml = filteredRequisitions
      .map((requisition, index) => {
        const requisitionItems = items.filter((entry) => entry.requisition_id === requisition.id);
        return `
          <section style="page-break-after:${index === filteredRequisitions.length - 1 ? 'auto' : 'always'};margin-bottom:24px;">
            ${buildRequisitionPrintHtml(requisition, requisitionItems)}
          </section>
        `;
      })
      .join('');

    printDocument({
      title: 'Bulk Requisitions',
      subtitle: `${companyName} • ${filteredRequisitions.length} requisition(s)`,
      bodyHtml,
    });
  };

  const saveDepartment = async () => {
    if (!departmentForm.name.trim()) {
      setToast({ message: 'Department name is required.', type: 'warning' });
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: departmentForm.name.trim(),
        description: departmentForm.description.trim() || null,
        is_active: true,
      };

      const { data, error } = await supabase.from('departments').insert([payload]).select('id, name').single();
      if (error) throw error;

      const createdDepartment = data as DepartmentOption;
      setDepartments((current) => [...current, createdDepartment].sort((left, right) => left.name.localeCompare(right.name)));
      setForm((current) => ({ ...current, department: createdDepartment.name }));
      setDepartmentForm(createDepartmentForm());
      setShowDepartmentForm(false);
      setToast({ message: 'Department added successfully.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to create department:', error);
      setToast({ message: error.message || 'Failed to create department.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const savePayee = async () => {
    if (!organizationId) {
      setToast({ message: 'An organization is required before creating payees.', type: 'warning' });
      return;
    }

    if (!payeeForm.payeeName.trim()) {
      setToast({ message: 'Vendor name is required.', type: 'warning' });
      return;
    }

    setSaving(true);

    try {
      const payload = {
        organization_id: organizationId,
        payee_name: payeeForm.payeeName.trim(),
        contact_person: payeeForm.contactPerson.trim() || null,
        telephone_number: payeeForm.telephoneNumber.trim() || null,
        email: payeeForm.email.trim() || null,
        payment_information: payeeForm.paymentInformation.trim() || null,
        created_by: profile?.id || null,
        updated_by: profile?.id || null,
      };

      const { data, error } = await supabase
        .from('finance_payees')
        .insert(payload)
        .select('id, payee_name, contact_person, telephone_number, email')
        .single();

      if (error) throw error;

      const createdPayee = data as FinancePayeeOption;
      setPayees((current) => [...current, createdPayee].sort((left, right) => left.payee_name.localeCompare(right.payee_name)));
      setForm((current) => ({
        ...current,
        vendorPreferences: Array.from(new Set([...current.vendorPreferences, createdPayee.payee_name])),
        vendorPreference: current.vendorPreference ? `${current.vendorPreference}, ${createdPayee.payee_name}` : createdPayee.payee_name,
      }));
      setPayeeForm(createPayeeForm());
      setShowPayeeForm(false);
      setToast({ message: 'Vendor added successfully.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to create vendor:', error);
      setToast({ message: error.message || 'Failed to create vendor.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const saveRequisition = async () => {
    if (!organizationId) {
      setToast({ message: 'An organization is required before saving requisitions.', type: 'warning' });
      return;
    }

    if (!workflowReady) {
      setToast({ message: 'Apply the requisitions migration before saving a requisition.', type: 'warning' });
      return;
    }

    if (!form.title.trim()) {
      setToast({ message: 'Requisition title is required.', type: 'warning' });
      return;
    }

    const activeItems = form.items.filter((item) =>
      [item.itemDescription, item.specification, item.preferredVendor, item.quantity, item.unitCost]
        .some((value) => String(value || '').trim().length > 0),
    );
    if (activeItems.length === 0) {
      setToast({ message: 'Add at least one requisition line item.', type: 'warning' });
      return;
    }

    setSaving(true);
    const editingRequisition = editingRequisitionId
      ? requisitions.find((entry) => entry.id === editingRequisitionId) || null
      : null;
    if (editingRequisition && !EDITABLE_STATUSES.has(editingRequisition.status)) {
      setToast({ message: 'Approved requisitions cannot be edited.', type: 'warning' });
      setSaving(false);
      return;
    }
    const currentFormItems = editingRequisitionId
      ? items.filter((entry) => entry.requisition_id === editingRequisitionId)
      : [];
    let savedRequisitionId: string | null = editingRequisitionId || null;
    const submittedStatus: RequisitionStatus = editingRequisition ? editingRequisition.status : 'pending_approval';

    try {
      const requisitionPayload = {
        organization_id: organizationId,
        title: form.title.trim(),
        department: form.department.trim() || null,
        needed_by: form.neededBy || null,
        priority: form.priority,
        status: submittedStatus,
        justification: form.justification.trim() || null,
        vendor_preference: (form.vendorPreferences.length > 0 ? form.vendorPreferences.join(', ') : form.vendorPreference).trim() || null,
        notes: form.notes.trim() || null,
        bank_charge_amount: toNumber(form.bankChargeAmount),
        bank_charge_mode: form.bankChargeMode,
        charge_bank_account_id: form.chargeBankAccountId || null,
        requested_by: profile?.id || null,
        created_by: profile?.id || null,
        updated_by: profile?.id || null,
      };

      if (editingRequisitionId) {
        const { error } = await supabase
          .from('finance_requisitions')
          .update(requisitionPayload)
          .eq('id', editingRequisitionId);
        if (error) throw error;
      } else {
        const requisitionNumberValue = requisitionNumber();
        const { data, error } = await supabase
          .from('finance_requisitions')
          .insert({ ...requisitionPayload, requisition_number: requisitionNumberValue })
          .select('id')
          .single();
        if (error) throw error;

        savedRequisitionId = data.id as string;
      }

      const itemPayload = activeItems.map((item, index) => ({
        requisition_id: savedRequisitionId,
        item_description: item.itemDescription.trim() || item.preferredVendor.trim() || `Item ${index + 1}`,
        specification: item.specification.trim() || null,
        quantity: toNumber(item.quantity) || 1,
        unit_cost: toNumber(item.unitCost),
        line_total: (toNumber(item.quantity) || 1) * toNumber(item.unitCost),
        preferred_vendor: item.preferredVendor.trim() || null,
        display_order: index,
      }));

      if (editingRequisitionId && savedRequisitionId) {
        const { error: deleteError } = await supabase
          .from('finance_requisition_items')
          .delete()
          .eq('requisition_id', savedRequisitionId);
        if (deleteError) throw deleteError;
      }

      const { error: itemError } = await supabase.from('finance_requisition_items').insert(itemPayload);
      if (itemError) {
        if (editingRequisitionId && savedRequisitionId && currentFormItems.length > 0) {
          await supabase.from('finance_requisition_items').insert(
            currentFormItems.map((item, index) => ({
              requisition_id: savedRequisitionId,
              item_description: item.item_description,
              specification: item.specification,
              quantity: item.quantity,
              unit_cost: item.unit_cost,
              line_total: item.line_total,
              preferred_vendor: item.preferred_vendor,
              display_order: index,
            })),
          );
        } else if (savedRequisitionId) {
          await supabase.from('finance_requisitions').delete().eq('id', savedRequisitionId);
        }

        throw itemError;
      }

      setToast({
        message: editingRequisitionId
          ? 'Requisition updated successfully.'
          : `Requisition submitted successfully and moved to ${STATUS_LABELS[submittedStatus]}.`,
        type: 'success',
      });
      setSelectedId(savedRequisitionId);
      resetForm();
      void loadData();
    } catch (error: any) {
      console.error('Failed to save requisition:', error);
      setToast({ message: error.message || 'Failed to save requisition.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const updateRequisitionStatus = async (status: RequisitionStatus) => {
    if (!selectedRequisition) return;

    setSaving(true);

    try {
      const payload: Record<string, string | null> = {
        status,
        updated_by: profile?.id || null,
      };

      if (status === 'approved') {
        payload.director_approved_by = profile?.id || null;
        payload.director_approved_at = new Date().toISOString();
        payload.approval_stage = 'director_approved';
      }

      if (status === 'pending_approval') {
        payload.accounts_approved_by = profile?.id || null;
        payload.accounts_approved_at = new Date().toISOString();
        payload.approval_stage = 'accounts_approved';
      }

      const { error } = await supabase
        .from('finance_requisitions')
        .update(payload)
        .eq('id', selectedRequisition.id);

      if (error) throw error;

      setToast({ message: `Requisition moved to ${STATUS_LABELS[status]}.`, type: 'success' });
      setSelectedId(selectedRequisition.id);
      void loadData();
    } catch (error: any) {
      console.error('Failed to update requisition status:', error);
      setToast({ message: error.message || 'Failed to update requisition status.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <CustomLoader label="Loading requisitions..." />;
  }

  if (isBulkRoute) {
    return (
      <div className="min-h-screen space-y-6 bg-[#f6f7fb] p-6 dark:bg-[#061723]">
        <div className={`${panelCls} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/app/finance/expenses')}
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-200 bg-white text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
              title="Back to Requisitions"
              aria-label="Back to Requisitions"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Bulk / Another Requisition</p>
              <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Create a new requisition using the same structure and line items, but on its own page.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={copyBulkToMainForm} className={primaryButtonCls}>
              <ClipboardList size={16} />
              Continue in Main Form
            </button>
            <button type="button" onClick={() => setBulkRequisitionForm(createForm())} className={subtleButtonCls}>
              Reset Draft
            </button>
          </div>
        </div>

        <div className={panelCls}>
          <div className="mb-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Requisition Builder</p>
            <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Bulk Requisition Page</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Fill in the same details and line items here, then continue back to the main requisition form with this draft loaded.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={labelCls}>Title</label>
              <input value={bulkRequisitionForm.title} onChange={(event) => setBulkField('title', event.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Department</label>
              <div className="flex gap-2">
                <select value={bulkRequisitionForm.department} onChange={(event) => setBulkField('department', event.target.value)} className={inputCls}>
                  <option value="">Select department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.name}>
                      {department.name}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => setShowDepartmentForm(true)} className={subtleButtonCls} title="Add department">
                  <Plus size={16} />
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Needed By</label>
              <input type="date" value={bulkRequisitionForm.neededBy} onChange={(event) => setBulkField('neededBy', event.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select value={bulkRequisitionForm.priority} onChange={(event) => setBulkField('priority', event.target.value)} className={inputCls}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Vendor Preference</label>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-dark-surface">
                <div className="flex flex-wrap gap-2">
                  {payees.length > 0 ? (
                    <>
                      {(showAllVendorsBulk ? payees : payees.slice(0, 5)).map((payee) => {
                        const selected = splitVendorPreferences(bulkRequisitionForm.vendorPreference).some((value) => normalizeText(value) === normalizeText(payee.payee_name));
                        return (
                          <button
                            key={payee.id}
                            type="button"
                            onClick={() => {
                              const current = splitVendorPreferences(bulkRequisitionForm.vendorPreference);
                              const next = current.some((value) => normalizeText(value) === normalizeText(payee.payee_name))
                                ? current.filter((value) => normalizeText(value) !== normalizeText(payee.payee_name))
                                : [...current, payee.payee_name];
                              setBulkField('vendorPreference', next.join(', '));
                            }}
                            className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                              selected
                                ? 'border-[#ff6a00]/30 bg-[#ff6a00]/10 text-[#ff6a00] dark:border-[#ff6a00]/40 dark:bg-[#ff6a00]/15 dark:text-[#ffd3b5]'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:border-[#ff6a00]/40'
                            }`}
                          >
                            {payee.payee_name}
                          </button>
                        );
                      })}
                      {payees.length > 5 && (
                        <button
                          type="button"
                          onClick={() => setShowAllVendorsBulk(!showAllVendorsBulk)}
                          className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                            showAllVendorsBulk
                              ? 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:bg-white/[0.06]'
                          }`}
                        >
                          {showAllVendorsBulk ? `Hide (${payees.length} total)` : `Show All (${payees.length} total)`}
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-slate-500 dark:text-slate-400">No vendors available yet.</span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <button type="button" onClick={() => setShowPayeeForm(true)} className={subtleButtonCls} title="Add vendor">
                    <Plus size={16} />
                    Add Vendor
                  </button>
                  <button type="button" onClick={() => setBulkField('vendorPreference', '')} className="text-sm font-semibold text-[#ff6a00]">
                    Clear Selection
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className={labelCls}>Bank Charge Amount</label>
              <input type="number" min="0" step="0.01" value={bulkRequisitionForm.bankChargeAmount} onChange={(event) => setBulkField('bankChargeAmount', event.target.value)} className={inputCls} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Justification</label>
              <textarea rows={3} value={bulkRequisitionForm.justification} onChange={(event) => setBulkField('justification', event.target.value)} className={inputCls} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Notes</label>
              <input value={bulkRequisitionForm.notes} onChange={(event) => setBulkField('notes', event.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Line Items</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">Edit or add the items you want to carry into the next requisition.</p>
              </div>
              <button type="button" onClick={addBulkItem} className={subtleButtonCls}>
                <Plus size={16} />
                Add Item
              </button>
            </div>
            <div className="space-y-4">
              {bulkRequisitionForm.items.map((item, index) => (
                <div key={`bulk-item-${index}`} className="rounded-[24px] border border-gray-200 p-4 dark:border-white/10">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className={labelCls}>Item Description</label>
                      <input value={item.itemDescription} onChange={(event) => setBulkItemField(index, 'itemDescription', event.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Specification</label>
                      <input value={item.specification} onChange={(event) => setBulkItemField(index, 'specification', event.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Preferred Vendor</label>
                      <select value={item.preferredVendor} onChange={(event) => setBulkItemField(index, 'preferredVendor', event.target.value)} className={inputCls}>
                        <option value="">Select vendor</option>
                        {payees.map((payee) => (
                          <option key={payee.id} value={payee.payee_name}>
                            {payee.payee_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Quantity</label>
                      <input type="number" min="0" step="0.01" value={item.quantity} onChange={(event) => setBulkItemField(index, 'quantity', event.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Unit Cost</label>
                      <input type="number" min="0" step="0.01" value={item.unitCost} onChange={(event) => setBulkItemField(index, 'unitCost', event.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Line total: {formatMoney(toNumber(item.quantity) * toNumber(item.unitCost))}</span>
                    <button type="button" onClick={() => removeBulkItem(index)} className="text-xs font-black uppercase tracking-[0.16em] text-rose-600 dark:text-rose-300">
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {showDepartmentForm ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-[32px] border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#071b27]">
              <div className="border-b border-gray-200 bg-gradient-to-r from-[#fff3eb] via-white to-[#fff9f4] px-6 py-5 dark:border-white/10 dark:from-[#0b2a3c] dark:via-[#082131] dark:to-[#071b27]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Add Department</p>
                    <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">New Department</h3>
                  </div>
                  <button type="button" onClick={() => setShowDepartmentForm(false)} className={subtleButtonCls}>
                    Close
                  </button>
                </div>
              </div>
              <div className="space-y-4 p-6">
                <div>
                  <label className={labelCls}>Department Name</label>
                  <input value={departmentForm.name} onChange={(event) => setDepartmentField('name', event.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Description</label>
                  <textarea rows={3} value={departmentForm.description} onChange={(event) => setDepartmentField('description', event.target.value)} className={inputCls} />
                </div>
              </div>
              <div className="flex flex-wrap gap-3 px-6 pb-6">
                <button type="button" onClick={saveDepartment} className={primaryButtonCls} disabled={saving}>
                  <Plus size={16} />
                  Save Department
                </button>
                <button type="button" onClick={() => setDepartmentForm(createDepartmentForm())} className={subtleButtonCls}>
                  Clear
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showPayeeForm ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-[32px] border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#071b27]">
              <div className="border-b border-gray-200 bg-gradient-to-r from-[#fff3eb] via-white to-[#fff9f4] px-6 py-5 dark:border-white/10 dark:from-[#0b2a3c] dark:via-[#082131] dark:to-[#071b27]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Add Vendor</p>
                    <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">New Payee / Vendor</h3>
                  </div>
                  <button type="button" onClick={() => setShowPayeeForm(false)} className={subtleButtonCls}>
                    Close
                  </button>
                </div>
              </div>
              <div className="space-y-4 p-6">
                <div>
                  <label className={labelCls}>Vendor Name</label>
                  <input value={payeeForm.payeeName} onChange={(event) => setPayeeField('payeeName', event.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Contact Person</label>
                  <input value={payeeForm.contactPerson} onChange={(event) => setPayeeField('contactPerson', event.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Telephone Number</label>
                  <input value={payeeForm.telephoneNumber} onChange={(event) => setPayeeField('telephoneNumber', event.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={payeeForm.email} onChange={(event) => setPayeeField('email', event.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Payment Information</label>
                  <textarea rows={3} value={payeeForm.paymentInformation} onChange={(event) => setPayeeField('paymentInformation', event.target.value)} className={inputCls} />
                </div>
              </div>
              <div className="flex flex-wrap gap-3 px-6 pb-6">
                <button type="button" onClick={savePayee} className={primaryButtonCls} disabled={saving}>
                  <Plus size={16} />
                  Save Vendor
                </button>
                <button type="button" onClick={() => setPayeeForm(createPayeeForm())} className={subtleButtonCls}>
                  Clear
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showReferenceOptionForm ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-[32px] border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#071b27]">
              <div className="border-b border-gray-200 bg-gradient-to-r from-[#fff3eb] via-white to-[#fff9f4] px-6 py-5 dark:border-white/10 dark:from-[#0b2a3c] dark:via-[#082131] dark:to-[#071b27]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Reference Setup</p>
                    <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">Add New Pay From A/C</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">This will be saved to the database and appear in the dropdown immediately.</p>
                  </div>
                  <button type="button" onClick={() => setShowReferenceOptionForm(false)} className={subtleButtonCls}>
                    Close
                  </button>
                </div>
              </div>

              <div className="p-6">
                <label className={labelCls}>Account Name</label>
                <input
                  value={referenceOptionForm.value}
                  onChange={(event) => setReferenceOptionForm((current) => ({ ...current, value: event.target.value }))}
                  className={inputCls}
                  placeholder="Enter account name"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-3 px-6 pb-6">
                <button type="button" onClick={createReferenceOption} className={primaryButtonCls}>
                  <Plus size={16} />
                  Save Option
                </button>
                <button type="button" onClick={() => setReferenceOptionForm(createReferenceOptionForm())} className={subtleButtonCls}>
                  Clear
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="min-h-screen space-y-6 bg-[#f6f7fb] p-6 dark:bg-[#061723]"
      data-print-company-name={companyName}
      data-print-company-logo="/tough_force_logo.webp"
    >
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
          <div className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Finance requisitions manage internal purchasing requests with item-level detail and approval status.
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={openBulkRequisitionForm} className={subtleButtonCls}>
            <ClipboardList size={16} />
            Bulk / Another Requisition
          </button>
          {!workflowReady ? (
            <button type="button" onClick={() => void loadData()} className={subtleButtonCls}>
              <RotateCcw size={16} />
              Refresh Status
            </button>
          ) : null}
          {selectedRequisition ? (
          <button
            type="button"
            onClick={startEditSelectedRequisition}
            className={subtleButtonCls}
            disabled={!EDITABLE_STATUSES.has(selectedRequisition.status) || itemsLoading}
            title={
              !EDITABLE_STATUSES.has(selectedRequisition.status)
                ? 'Approved requisitions cannot be edited'
                : itemsLoading
                  ? 'Waiting for requisition line items to finish loading'
                  : 'Edit selected requisition'
            }
          >
            <ClipboardList size={16} />
            Edit Selected
          </button>
          ) : null}
          <button type="button" onClick={resetForm} className={subtleButtonCls}>
            <RotateCcw size={16} />
            Clear Form
          </button>
          <button type="button" onClick={handlePrint} className={subtleButtonCls} disabled={!selectedRequisition || itemsLoading}>
            <Printer size={16} />
            Print Selected
          </button>
          <button type="button" onClick={printBulkRequisitions} className={subtleButtonCls} disabled={filteredRequisitions.length === 0}>
            <Printer size={16} />
            Print Bulk
          </button>
          <button type="button" onClick={saveRequisition} className={primaryButtonCls} disabled={saving}>
            <Plus size={16} />
            {editingRequisitionId ? 'Save Changes' : 'Submit Requisition'}
          </button>
        </div>
      </div>

      {organizationNotice ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50/90 px-5 py-4 text-sm text-amber-900 shadow-sm dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
          {organizationNotice}
        </div>
      ) : null}

      {dataNotice ? (
        <div className="rounded-[24px] border border-[#ff6a00]/20 bg-[#fff3eb] px-5 py-4 text-sm text-[#9a3f00] shadow-sm dark:border-[#ff6a00]/25 dark:bg-[#ff6a00]/10 dark:text-[#ffd3b5]">
          {dataNotice}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <div className={panelCls}>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Pending Approval</p>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{requisitionSummary.pendingApproval}</p>
        </div>
        <div className={panelCls}>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Draft Value</p>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{formatMoney(draftTotal)}</p>
          <p className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Includes any bank charges added to the draft.</p>
        </div>
        <div className={panelCls}>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Urgent / High</p>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{requisitionSummary.urgent}</p>
        </div>
        <div className={panelCls}>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">Due In 7 Days</p>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{requisitionSummary.dueSoon}</p>
        </div>
      </div>

      <div className="grid gap-6">
        <div className={panelCls} data-requisition-form>
          <div className="mb-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Requisition Builder</p>
            <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{editingRequisitionId ? 'Edit Requisition' : 'New Requisition'}</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Departments now come from HR, vendors come from finance payees, and every submission keeps its charge detail ready for payment posting.</p>
          </div>

          {editingRequisitionId ? (
            <div className="mb-4 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
              Editing an existing requisition. Save Changes will update the selected request and keep the original requisition number.
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={labelCls}>Title</label>
              <input value={form.title} onChange={(event) => setField('title', event.target.value)} className={inputCls} placeholder="Office furniture, site equipment, consumables..." />
            </div>
            <div>
              <label className={labelCls}>Department</label>
              <div className="flex gap-2">
                <select value={form.department} onChange={(event) => setField('department', event.target.value)} className={inputCls}>
                  <option value="">Select department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.name}>
                      {department.name}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => setShowDepartmentForm(true)} className={subtleButtonCls} title="Add department">
                  <Plus size={16} />
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Needed By</label>
              <input type="date" value={form.neededBy} onChange={(event) => setField('neededBy', event.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select value={form.priority} onChange={(event) => setField('priority', event.target.value)} className={inputCls}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Submission Status</label>
              <div className="flex h-[50px] items-center rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
                New requisitions start as Pending Approval
              </div>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Justification</label>
              <textarea rows={3} value={form.justification} onChange={(event) => setField('justification', event.target.value)} className={inputCls} placeholder="Why the requisition is needed" />
            </div>
            <div>
              <label className={labelCls}>Vendor Preference</label>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-dark-surface">
                <div className="flex flex-wrap gap-2">
                  {payees.length > 0 ? (
                    <>
                      {(showAllVendors ? payees : payees.slice(0, 5)).map((payee) => {
                        const selected = form.vendorPreferences.some((value) => normalizeText(value) === normalizeText(payee.payee_name));
                        return (
                          <button
                            key={payee.id}
                            type="button"
                            onClick={() => toggleVendorPreference(payee.payee_name)}
                            className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                              selected
                                ? 'border-[#ff6a00]/30 bg-[#ff6a00]/10 text-[#ff6a00] dark:border-[#ff6a00]/40 dark:bg-[#ff6a00]/15 dark:text-[#ffd3b5]'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:border-[#ff6a00]/40'
                            }`}
                          >
                            {payee.payee_name}
                          </button>
                        );
                      })}
                      {payees.length > 5 && (
                        <button
                          type="button"
                          onClick={() => setShowAllVendors(!showAllVendors)}
                          className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                            showAllVendors
                              ? 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:bg-white/[0.06]'
                          }`}
                        >
                          {showAllVendors ? `Hide (${payees.length} total)` : `Show All (${payees.length} total)`}
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-slate-500 dark:text-slate-400">No vendors available yet.</span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => setShowPayeeForm(true)} className={subtleButtonCls} title="Add vendor">
                    <Plus size={16} />
                    Add Vendor
                  </button>
                  <button type="button" onClick={() => setField('vendorPreference', '')} className="text-sm font-semibold text-[#ff6a00]">
                    Clear Selection
                  </button>
                </div>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Optional. Pick one or more vendors/payees for this requisition.
                </p>
              </div>
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input value={form.notes} onChange={(event) => setField('notes', event.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Bank Charge Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.bankChargeAmount}
                onChange={(event) => setField('bankChargeAmount', event.target.value)}
                className={inputCls}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className={labelCls}>{selectedChargePostingLabel}</label>
              <select
                value={form.bankChargeMode}
                onChange={(event) => setField('bankChargeMode', event.target.value as BankChargeMode)}
                className={inputCls}
              >
                <option value="included_in_total">Include in main transaction</option>
                <option value="additional_expense">Post as additional expense</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <FinanceAccountSelect
                label="Charge Wallet account"
                value={form.chargeBankAccountSelection}
                options={payFromAccountOptions}
                onChange={handleChargeBankAccountChange}
                inputCls={inputCls}
                labelCls={labelCls}
                subtleButtonCls={subtleButtonCls}
                iconActionButtonCls={iconActionButtonCls}
                placeholder="Leave blank if not required"
                onAdd={openReferenceOptionForm}
                addButtonTitle="Add new pay from account"
                addButtonAriaLabel="Add new pay from account"
                addButtonDisabled={!workflowReady}
                helpText={
                  bankAccounts.length === 0
                    ? 'No active finance accounts were found for the current organization.'
                    : 'Uses bank, cash, wallet, Pay From A/C, and payment method options from finance settings.'
                }
              />
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Line Items</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">Add the item details, quantities, vendors, and estimated costs for this request.</p>
              </div>
              <button type="button" onClick={addItem} className={subtleButtonCls}>
                <Plus size={16} />
                Add Item
              </button>
            </div>

            <div className="space-y-4">
              {form.items.map((item, index) => (
                <div key={`draft-item-${index}`} className="rounded-[24px] border border-gray-200 p-4 dark:border-white/10">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className={labelCls}>Item Description</label>
                      <input value={item.itemDescription} onChange={(event) => setItemField(index, 'itemDescription', event.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Specification</label>
                      <input value={item.specification} onChange={(event) => setItemField(index, 'specification', event.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Preferred Vendor</label>
                      <select value={item.preferredVendor} onChange={(event) => setItemField(index, 'preferredVendor', event.target.value)} className={inputCls}>
                        <option value="">Select vendor</option>
                        {payees.map((payee) => (
                          <option key={payee.id} value={payee.payee_name}>
                            {payee.payee_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Quantity</label>
                      <input type="number" min="0" step="0.01" value={item.quantity} onChange={(event) => setItemField(index, 'quantity', event.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Unit Cost</label>
                      <input type="number" min="0" step="0.01" value={item.unitCost} onChange={(event) => setItemField(index, 'unitCost', event.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Line total: {formatMoney(toNumber(item.quantity) * toNumber(item.unitCost))}</span>
                    <button type="button" onClick={() => removeItem(index)} className="text-xs font-black uppercase tracking-[0.16em] text-rose-600 dark:text-rose-300">
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={panelCls}>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Registry</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">Requisitions</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Complete history of all requisitions in table format.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowVendorColumn(!showVendorColumn)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:border-[#ff6a00]/40 dark:hover:bg-white/[0.06]"
              title={showVendorColumn ? 'Hide Vendor column' : 'Show Vendor column'}
            >
              {showVendorColumn ? '◆ Hide Vendor' : '◇ Show Vendor'}
            </button>
          </div>

          <div className="overflow-x-auto rounded-[24px] border border-gray-200 dark:border-white/10">
            <table className="min-w-full text-sm">
              <thead className="bg-[#fff7f2] dark:bg-[#082131]">
                <tr className="text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3">Requisition #</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Department</th>
                  {showVendorColumn && <th className="px-4 py-3">Vendor</th>}
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3 text-right">Total Value</th>
                  <th className="px-4 py-3">Needed By</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requisitions.map((req) => (
                  <tr
                    key={req.id}
                    className={`border-t border-gray-200 transition hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/[0.02] ${
                      selectedId === req.id ? 'bg-[#fff7f2] dark:bg-[#082131]' : ''
                    }`}
                    onClick={() => openRequisitionForEdit(req.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openRequisitionForEdit(req.id);
                      }
                    }}
                    aria-label={`Open requisition ${req.requisition_number}`}
                  >
                    <td className="px-4 py-3 text-slate-900 dark:text-white font-semibold">{req.requisition_number}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{req.title}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{req.department || '-'}</td>
                    {showVendorColumn && <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{req.vendor_preference || '-'}</td>}
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${getStatusClasses(req.status)}`}>
                        {STATUS_LABELS[req.status] || req.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${
                        req.priority === 'urgent' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' :
                        req.priority === 'high' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' :
                        req.priority === 'normal' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' :
                        'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300'
                      }`}>
                        {req.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
                      {formatMoney(requisitionTotals[req.id] || 0)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{req.needed_by || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openRequisitionForEdit(req.id);
                        }}
                        className="inline-flex items-center gap-2 rounded-2xl border border-[#ff6a00]/15 bg-[#ff6a00]/8 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#ff6a00] transition hover:bg-[#ff6a00]/14 dark:border-[#ff6a00]/25 dark:bg-[#ff6a00]/10 dark:text-[#ffb37a] dark:hover:bg-[#ff6a00]/20"
                        disabled={!EDITABLE_STATUSES.has(req.status) || itemsLoading}
                        title={
                          itemsLoading
                            ? 'Waiting for requisition line items to finish loading'
                            : !EDITABLE_STATUSES.has(req.status)
                              ? 'Approved requisitions cannot be edited'
                              : 'Open and edit requisition'
                        }
                      >
                        <Edit2 size={14} />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {requisitions.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
              No requisitions yet. Create one using the form above.
            </div>
          ) : null}
        </div>
      </div>

      {showBulkRequisitionForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[32px] border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#071b27]">
            <div className="border-b border-gray-200 bg-gradient-to-r from-[#fff3eb] via-white to-[#fff9f4] px-6 py-5 dark:border-white/10 dark:from-[#0b2a3c] dark:via-[#082131] dark:to-[#071b27]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Bulk / Another Requisition</p>
                  <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">Clone the current requisition</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Use this workspace to duplicate the current details and line items, then tweak only what is different for the next request.
                  </p>
                </div>
                <button type="button" onClick={() => setShowBulkRequisitionForm(false)} className={subtleButtonCls}>
                  Close
                </button>
              </div>
            </div>

            <div className="space-y-6 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className={labelCls}>Title</label>
                  <input value={bulkRequisitionForm.title} onChange={(event) => setBulkField('title', event.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Department</label>
                  <select value={bulkRequisitionForm.department} onChange={(event) => setBulkField('department', event.target.value)} className={inputCls}>
                    <option value="">Select department</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.name}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Needed By</label>
                  <input type="date" value={bulkRequisitionForm.neededBy} onChange={(event) => setBulkField('neededBy', event.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Priority</label>
                  <select value={bulkRequisitionForm.priority} onChange={(event) => setBulkField('priority', event.target.value)} className={inputCls}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Vendor Preference</label>
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-dark-surface">
                    <div className="flex flex-wrap gap-2">
                      {payees.length > 0 ? (
                        <>
                          {(showAllVendorsBulk2 ? payees : payees.slice(0, 5)).map((payee) => {
                            const selected = splitVendorPreferences(bulkRequisitionForm.vendorPreference).some((value) => normalizeText(value) === normalizeText(payee.payee_name));
                            return (
                              <button
                                key={payee.id}
                                type="button"
                                onClick={() => {
                                  const current = splitVendorPreferences(bulkRequisitionForm.vendorPreference);
                                  const next = current.some((value) => normalizeText(value) === normalizeText(payee.payee_name))
                                    ? current.filter((value) => normalizeText(value) !== normalizeText(payee.payee_name))
                                    : [...current, payee.payee_name];
                                  setBulkField('vendorPreference', next.join(', '));
                                }}
                                className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                                  selected
                                    ? 'border-[#ff6a00]/30 bg-[#ff6a00]/10 text-[#ff6a00] dark:border-[#ff6a00]/40 dark:bg-[#ff6a00]/15 dark:text-[#ffd3b5]'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:border-[#ff6a00]/40'
                                }`}
                              >
                                {payee.payee_name}
                              </button>
                            );
                          })}
                          {payees.length > 5 && (
                            <button
                              type="button"
                              onClick={() => setShowAllVendorsBulk2(!showAllVendorsBulk2)}
                              className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                                showAllVendorsBulk2
                                  ? 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 dark:hover:bg-white/[0.06]'
                              }`}
                            >
                              {showAllVendorsBulk2 ? `Hide (${payees.length} total)` : `Show All (${payees.length} total)`}
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-sm text-slate-500 dark:text-slate-400">No vendors available yet.</span>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Bank Charge Amount</label>
                  <input type="number" min="0" step="0.01" value={bulkRequisitionForm.bankChargeAmount} onChange={(event) => setBulkField('bankChargeAmount', event.target.value)} className={inputCls} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Justification</label>
                  <textarea rows={3} value={bulkRequisitionForm.justification} onChange={(event) => setBulkField('justification', event.target.value)} className={inputCls} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Notes</label>
                  <input value={bulkRequisitionForm.notes} onChange={(event) => setBulkField('notes', event.target.value)} className={inputCls} />
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 dark:text-white">Line Items</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Edit or add the items you want to carry into the next requisition.</p>
                  </div>
                  <button type="button" onClick={addBulkItem} className={subtleButtonCls}>
                    <Plus size={16} />
                    Add Item
                  </button>
                </div>
                <div className="space-y-4">
                  {bulkRequisitionForm.items.map((item, index) => (
                    <div key={`bulk-item-${index}`} className="rounded-[24px] border border-gray-200 p-4 dark:border-white/10">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                          <label className={labelCls}>Item Description</label>
                          <input value={item.itemDescription} onChange={(event) => setBulkItemField(index, 'itemDescription', event.target.value)} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Specification</label>
                          <input value={item.specification} onChange={(event) => setBulkItemField(index, 'specification', event.target.value)} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Preferred Vendor</label>
                          <select value={item.preferredVendor} onChange={(event) => setBulkItemField(index, 'preferredVendor', event.target.value)} className={inputCls}>
                            <option value="">Select vendor</option>
                            {payees.map((payee) => (
                              <option key={payee.id} value={payee.payee_name}>
                                {payee.payee_name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Quantity</label>
                          <input type="number" min="0" step="0.01" value={item.quantity} onChange={(event) => setBulkItemField(index, 'quantity', event.target.value)} className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Unit Cost</label>
                          <input type="number" min="0" step="0.01" value={item.unitCost} onChange={(event) => setBulkItemField(index, 'unitCost', event.target.value)} className={inputCls} />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-600 dark:text-slate-300">Line total: {formatMoney(toNumber(item.quantity) * toNumber(item.unitCost))}</span>
                        <button type="button" onClick={() => removeBulkItem(index)} className="text-xs font-black uppercase tracking-[0.16em] text-rose-600 dark:text-rose-300">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={copyBulkToMainForm} className={primaryButtonCls}>
                  <ClipboardList size={16} />
                  Load into Main Form
                </button>
                <button type="button" onClick={() => setBulkRequisitionForm(createForm())} className={subtleButtonCls}>
                  Reset Duplicate
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showDepartmentForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[32px] border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#071b27]">
            <div className="border-b border-gray-200 bg-gradient-to-r from-[#fff3eb] via-white to-[#fff9f4] px-6 py-5 dark:border-white/10 dark:from-[#0b2a3c] dark:via-[#082131] dark:to-[#071b27]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Add Department</p>
                  <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">New Department</h3>
                </div>
                <button type="button" onClick={() => setShowDepartmentForm(false)} className={subtleButtonCls}>
                  Close
                </button>
              </div>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className={labelCls}>Department Name</label>
                <input value={departmentForm.name} onChange={(event) => setDepartmentField('name', event.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea rows={3} value={departmentForm.description} onChange={(event) => setDepartmentField('description', event.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="flex flex-wrap gap-3 px-6 pb-6">
              <button type="button" onClick={saveDepartment} className={primaryButtonCls} disabled={saving}>
                <Plus size={16} />
                Save Department
              </button>
              <button type="button" onClick={() => setDepartmentForm(createDepartmentForm())} className={subtleButtonCls}>
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPayeeForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[32px] border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#071b27]">
            <div className="border-b border-gray-200 bg-gradient-to-r from-[#fff3eb] via-white to-[#fff9f4] px-6 py-5 dark:border-white/10 dark:from-[#0b2a3c] dark:via-[#082131] dark:to-[#071b27]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Add Vendor</p>
                  <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">New Payee / Vendor</h3>
                </div>
                <button type="button" onClick={() => setShowPayeeForm(false)} className={subtleButtonCls}>
                  Close
                </button>
              </div>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className={labelCls}>Vendor Name</label>
                <input value={payeeForm.payeeName} onChange={(event) => setPayeeField('payeeName', event.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Contact Person</label>
                <input value={payeeForm.contactPerson} onChange={(event) => setPayeeField('contactPerson', event.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Telephone Number</label>
                <input value={payeeForm.telephoneNumber} onChange={(event) => setPayeeField('telephoneNumber', event.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={payeeForm.email} onChange={(event) => setPayeeField('email', event.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Payment Information</label>
                <textarea rows={3} value={payeeForm.paymentInformation} onChange={(event) => setPayeeField('paymentInformation', event.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="flex flex-wrap gap-3 px-6 pb-6">
              <button type="button" onClick={savePayee} className={primaryButtonCls} disabled={saving}>
                <Plus size={16} />
                Save Vendor
              </button>
              <button type="button" onClick={() => setPayeeForm(createPayeeForm())} className={subtleButtonCls}>
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showReferenceOptionForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[32px] border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#071b27]">
            <div className="border-b border-gray-200 bg-gradient-to-r from-[#fff3eb] via-white to-[#fff9f4] px-6 py-5 dark:border-white/10 dark:from-[#0b2a3c] dark:via-[#082131] dark:to-[#071b27]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00] dark:text-[#ffb37a]">Reference Setup</p>
                  <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-white">Add New Pay From A/C</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">This will be saved to the database and appear in the dropdown immediately.</p>
                </div>
                <button type="button" onClick={() => setShowReferenceOptionForm(false)} className={subtleButtonCls}>
                  Close
                </button>
              </div>
            </div>

            <div className="p-6">
              <label className={labelCls}>Account Name</label>
              <input
                value={referenceOptionForm.value}
                onChange={(event) => setReferenceOptionForm((current) => ({ ...current, value: event.target.value }))}
                className={inputCls}
                placeholder="Enter account name"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3 px-6 pb-6">
              <button type="button" onClick={createReferenceOption} className={primaryButtonCls}>
                <Plus size={16} />
                Save Option
              </button>
              <button type="button" onClick={() => setReferenceOptionForm(createReferenceOptionForm())} className={subtleButtonCls}>
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <CustomToast message={toast.message} type={toast.type} isVisible={true} onClose={() => setToast(null)} /> : null}
    </div>
  );
};

export default FinanceRequisitions;
