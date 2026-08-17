// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, Landmark, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CustomLoader from '../../components/CustomLoader';
import CustomToast, { ToastType } from '../../components/CustomToast';
import { useAccess } from '../../hooks/useAccess';
import { resolveOrganizationScope } from '../../utils/organizationScope';
import { supabase } from '../../utils/supabase';
import financeProviderSyncService, { FinanceProviderConnection } from '../../services/financeProviderSyncService';

interface Company {
  id: string;
  name: string;
  code: string | null;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  account_type: string | null;
  currency: string | null;
  current_balance: number;
  is_active: boolean;
  company_id: string;
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

const panelCls = 'rounded-[24px] border border-gray-200 bg-white/95 p-5 shadow-[0_20px_70px_-45px_rgba(15,23,42,0.35)] backdrop-blur-sm dark:border-white/10 dark:bg-dark-surface/90';
const labelCls = 'text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400';
const inputCls = 'w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#ff6a00]/40 focus:bg-white focus:ring-4 focus:ring-[#ff6a00]/10 dark:border-white/10 dark:bg-[#082131] dark:text-white dark:placeholder:text-slate-400 dark:focus:border-[#ff6a00]/40 dark:focus:bg-[#0b2a3c]';
const actionButtonCls = 'inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[#ff6a00]/30 hover:text-[#ff6a00] dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:border-[#ff6a00]/40 dark:hover:bg-white/[0.06]';
const primaryButtonCls = 'inline-flex items-center justify-center gap-2 rounded-2xl bg-[#ff6a00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#e85f00]';

const normalizeText = (value?: string | null) => value?.trim().toLowerCase() || '';
const toNumber = (value?: number | string | null) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};
const formatMoney = (value: number, currency = 'KES') =>
  `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const BankConnections: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAccess();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [providerConnections, setProviderConnections] = useState<FinanceProviderConnection[]>([]);
  const [bankAccountSearch, setBankAccountSearch] = useState('');
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [showStatementImport, setShowStatementImport] = useState(false);
  const [connectionForm, setConnectionForm] = useState<ConnectionFormState>({
    connection_name: '',
    provider: 'manual_import',
    sync_mode: 'statement_import',
    bank_account_id: '',
  });
  const [statementImportForm, setStatementImportForm] = useState<StatementImportFormState>({
    connection_id: '',
    payload_text: '',
  });
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const companyMap = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);

  const loadData = async () => {
    setLoading(true);
    try {
      const scope = await resolveOrganizationScope(profile);
      setOrganizationId(scope.organizationId);

      if (!scope.organizationId) {
        setCompanies([]);
        setBankAccounts([]);
        setProviderConnections([]);
        setOrganizationId(null);
        return;
      }

      const { data: companiesData, error: companiesError } = await supabase
        .from('companies')
        .select('id, name, code')
        .eq('organization_id', scope.organizationId)
        .order('name', { ascending: true });

      if (companiesError) throw companiesError;

      const nextCompanies = (companiesData || []) as Company[];
      setCompanies(nextCompanies);

      const companyIds = nextCompanies.map((company) => company.id);
      if (companyIds.length > 0) {
        const { data: bankData, error: bankError } = await supabase
          .from('re_bank_accounts')
          .select('id, company_id, bank_name, account_number, account_holder_name, account_type, currency, current_balance, is_active')
          .in('company_id', companyIds)
          .eq('is_active', true)
          .order('bank_name', { ascending: true })
          .order('account_number', { ascending: true });

        if (bankError) throw bankError;

        setBankAccounts(
          ((bankData || []) as BankAccount[]).map((account) => ({
            ...account,
            current_balance: toNumber(account.current_balance),
          })),
        );
      } else {
        setBankAccounts([]);
      }

      const connections = await financeProviderSyncService.listConnections();
      setProviderConnections(connections);
    } catch (error: any) {
      console.error('Failed to load bank connections:', error);
      setToast({ message: error.message || 'Failed to load bank connections.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      void loadData();
    }
  }, [profile]);

  const filteredBankAccounts = useMemo(() => {
    const search = normalizeText(bankAccountSearch);
    if (!search) return bankAccounts;

    return bankAccounts.filter((account) => {
      const company = companyMap.get(account.company_id);
      return (
        normalizeText(account.bank_name).includes(search) ||
        normalizeText(account.account_number).includes(search) ||
        normalizeText(account.account_holder_name).includes(search) ||
        normalizeText(company?.name || '').includes(search) ||
        normalizeText(company?.code || '').includes(search)
      );
    });
  }, [bankAccounts, bankAccountSearch, companyMap]);

  const resetConnectionForm = () => {
    setConnectionForm({
      connection_name: '',
      provider: 'manual_import',
      sync_mode: 'statement_import',
      bank_account_id: '',
    });
  };

  const openConnectionComposer = () => {
    resetConnectionForm();
    setShowConnectionForm(true);
  };

  const saveConnection = async () => {
    if (!connectionForm.connection_name.trim()) {
      setToast({ message: 'Connection name is required.', type: 'warning' });
      return;
    }
    if (!connectionForm.bank_account_id) {
      setToast({ message: 'Select a bank account to link.', type: 'warning' });
      return;
    }

    const linkedAccount = bankAccounts.find((account) => account.id === connectionForm.bank_account_id);
    if (!linkedAccount) {
      setToast({ message: 'Selected bank account was not found.', type: 'warning' });
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
        companyId: linkedAccount.company_id,
        organizationId,
        status: 'active',
      });

      setShowConnectionForm(false);
      resetConnectionForm();
      await loadData();
      setToast({ message: 'Bank connection saved.', type: 'success' });
    } catch (error: any) {
      console.error('Failed to save bank connection:', error);
      setToast({ message: error.message || 'Failed to save bank connection.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const openStatementImportForm = (connectionId?: string) => {
    setStatementImportForm({ connection_id: connectionId || '', payload_text: '' });
    setStatementFile(null);
    setShowStatementImport(true);
  };

  const handleStatementFileChange = (file: File | null) => {
    if (!file) {
      setStatementFile(null);
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setToast({ message: 'Statement file is too large. Please keep it under 5MB.', type: 'warning' });
      return;
    }

    setStatementFile(file);
  };

  const handlePasteStatementFile = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const fileItem = Array.from(items).find((item) => item.kind === 'file');
    if (!fileItem) return;

    const file = fileItem.getAsFile();
    if (file) {
      event.preventDefault();
      handleStatementFileChange(file);
    }
  };

  const handleDropStatementFile = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) handleStatementFileChange(file);
  };

  const readFileBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Unable to read statement file.'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    });

  const runStatementImport = async () => {
    if (!statementImportForm.connection_id) {
      setToast({ message: 'Select a connection before importing.', type: 'warning' });
      return;
    }

    const trimmedPayload = statementImportForm.payload_text.trim();
    let statementRows: Record<string, unknown>[] | undefined;

    if (trimmedPayload) {
      try {
        const parsed = JSON.parse(trimmedPayload);
        if (!Array.isArray(parsed)) {
          throw new Error('Statement payload must be a JSON array.');
        }
        statementRows = parsed as Record<string, unknown>[];
      } catch (error: any) {
        setToast({ message: error.message || 'Invalid JSON payload for statement rows.', type: 'error' });
        return;
      }
    }

    if (!statementRows && !statementFile) {
      setToast({ message: 'Paste statement rows or attach a statement file.', type: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const statementFilePayload = statementFile
        ? {
            name: statementFile.name,
            type: statementFile.type || 'application/octet-stream',
            size: statementFile.size,
            contentBase64: await readFileBase64(statementFile),
          }
        : undefined;

      const result = await financeProviderSyncService.syncConnection({
        connectionId: statementImportForm.connection_id,
        triggerSource: 'manual',
        statementRows,
        statementFile: statementFilePayload,
      });

      setShowStatementImport(false);
      setStatementImportForm({ connection_id: '', payload_text: '' });
      setStatementFile(null);
      await loadData();

      setToast({
        message: result.summary?.message
          ? String(result.summary.message)
          : result.message || 'Statement import completed.',
        type: 'success',
      });
    } catch (error: any) {
      console.error('Statement import failed:', error);
      setToast({ message: error.message || 'Statement import failed.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <CustomLoader text="Loading bank connections..." />;
  }

  return (
    <div className="min-h-screen space-y-6 bg-[#f6f7fb] p-6 dark:bg-[#061723]">
      <div className="flex items-center justify-between">
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
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Landmark className="text-[#ff6a00]" aria-hidden="true" /> Bank Connections
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Connect all bank accounts across companies and import statement activity.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => openStatementImportForm()} className={actionButtonCls}>
            <Download size={16} />
            Import Statement
          </button>
          <button type="button" onClick={openConnectionComposer} className={primaryButtonCls}>
            <Plus size={16} />
            Add Connection
          </button>
        </div>
      </div>

      <div className={panelCls}>
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00]">Connection Overview</p>
        <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-white">Connected Bank Feeds</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Choose any bank account from all companies, then import statements or upload statement files.
        </p>

        <div className="mt-4 space-y-3">
          {providerConnections.map((connection) => {
            const linkedBank = connection.re_bank_accounts?.[0];
            const company = connection.company_id ? companyMap.get(connection.company_id) : null;
            return (
              <div key={connection.id} className="rounded-2xl border border-gray-200 bg-white/80 p-4 text-sm shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900 dark:text-white">{connection.connection_name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {connection.provider.toUpperCase()} - {connection.sync_mode.replace('_', ' ')} - {connection.status}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Bank: {linkedBank ? `${linkedBank.bank_name} - ${linkedBank.account_number}` : 'Not linked'}
                    </p>
                    {company ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Company: {company.code ? `${company.name} (${company.code})` : company.name}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => openStatementImportForm(connection.id)} className={actionButtonCls}>
                      <Download size={14} />
                      Import Statement
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Last sync: {connection.last_synced_at ? new Date(connection.last_synced_at).toLocaleDateString() : 'Not yet synced'}
                  {connection.last_error ? ` | Last error: ${connection.last_error}` : ''}
                </div>
              </div>
            );
          })}
          {providerConnections.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
              No bank connections yet. Add a connection to start syncing statements.
            </div>
          ) : null}
        </div>
      </div>

      <div className={panelCls}>
        <p className={labelCls}>Available Bank Accounts</p>
        <h3 className="mt-2 text-lg font-black text-slate-900 dark:text-white">Search Across All Companies</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Use this search to quickly find any bank account when creating a connection.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            value={bankAccountSearch}
            onChange={(event) => setBankAccountSearch(event.target.value)}
            className={inputCls}
            placeholder="Search by bank, account number, or company"
          />
          <div className="rounded-2xl border border-gray-200 bg-white/70 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100">
            {filteredBankAccounts.length} account{filteredBankAccounts.length === 1 ? '' : 's'} found
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {filteredBankAccounts.slice(0, 6).map((account) => {
            const company = companyMap.get(account.company_id);
            return (
              <div key={account.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-white/70 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {account.bank_name} - {account.account_number}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {company ? (company.code ? `${company.name} (${company.code})` : company.name) : 'Company unknown'} | {account.account_holder_name}
                  </p>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Balance: {formatMoney(toNumber(account.current_balance), account.currency || 'KES')}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showConnectionForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[32px] border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#071b27]">
            <div className="border-b border-gray-200 bg-gradient-to-r from-[#fff3eb] via-white to-[#fff9f4] px-6 py-5 dark:border-white/10 dark:from-[#0b2a3c] dark:via-[#082131] dark:to-[#071b27]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00]">Bank Connection</p>
                  <h3 className="mt-2 text-xl font-black">Add Bank Connection</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Link Equity or ABSA accounts and import statement rows or files for balance updates.
                  </p>
                </div>
                <button type="button" onClick={() => setShowConnectionForm(false)} className={actionButtonCls}>
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
                <label className={labelCls}>Search Bank Accounts</label>
                <input
                  value={bankAccountSearch}
                  onChange={(event) => setBankAccountSearch(event.target.value)}
                  className={inputCls}
                  placeholder="Search bank, account number, or company"
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Bank Account</label>
                <select
                  value={connectionForm.bank_account_id}
                  onChange={(event) => setConnectionForm((current) => ({ ...current, bank_account_id: event.target.value }))}
                  className={inputCls}
                >
                  <option value="">Select bank account</option>
                  {filteredBankAccounts.map((account) => {
                    const company = companyMap.get(account.company_id);
                    const companyLabel = company ? (company.code ? `${company.name} (${company.code})` : company.name) : 'Unknown';
                    return (
                      <option key={account.id} value={account.id}>
                        {account.bank_name} - {account.account_number} ({companyLabel})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 px-6 pb-6">
              <button type="button" onClick={saveConnection} className={primaryButtonCls} disabled={saving}>
                <Plus size={16} />
                Save Connection
              </button>
              <button type="button" onClick={resetConnectionForm} className={actionButtonCls}>
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showStatementImport ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[32px] border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#071b27]">
            <div className="border-b border-gray-200 bg-gradient-to-r from-[#fff3eb] via-white to-[#fff9f4] px-6 py-5 dark:border-white/10 dark:from-[#0b2a3c] dark:via-[#082131] dark:to-[#071b27]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#ff6a00]">Statement Import</p>
                  <h3 className="mt-2 text-xl font-black">Paste or Upload Statement</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Paste JSON rows, or upload a statement image/PDF/doc. Both will be logged for reconciliation.
                  </p>
                </div>
                <button type="button" onClick={() => setShowStatementImport(false)} className={actionButtonCls}>
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
              <div>
                <label className={labelCls}>Statement File</label>
                <div
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 bg-white/70 px-4 py-6 text-center text-sm text-slate-500 transition hover:border-[#ff6a00]/40 hover:text-[#ff6a00] dark:border-white/20 dark:bg-white/[0.03] dark:text-slate-300"
                  onClick={() => fileInputRef.current?.click()}
                  onPaste={handlePasteStatementFile}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDropStatementFile}
                  role="button"
                  tabIndex={0}
                  aria-label="Paste or upload statement file"
                >
                  <p>Paste an image or document, or click to upload.</p>
                  <p className="text-xs text-slate-400">Accepted: PDF, images, or docs (max 5MB).</p>
                  {statementFile ? (
                    <p className="text-xs text-slate-500">
                      Selected: {statementFile.name} ({Math.round(statementFile.size / 1024)} KB)
                    </p>
                  ) : null}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.csv,application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(event) => handleStatementFileChange(event.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 px-6 pb-6">
              <button type="button" onClick={runStatementImport} className={primaryButtonCls} disabled={saving}>
                <Download size={16} />
                Import
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatementImportForm({ connection_id: '', payload_text: '' });
                  setStatementFile(null);
                }}
                className={actionButtonCls}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <CustomToast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
    </div>
  );
};

export default BankConnections;
