// @ts-nocheck
import { invokeEdgeFunction } from '../utils/edgeFunctions';
import supabase from '../utils/supabase';

export type FinanceProvider = 'mpesa' | 'equity' | 'absa' | 'manual_import' | 'custom';
export type FinanceAccountKind = 'bank' | 'mpesa';
export type FinanceSyncMode = 'api' | 'webhook' | 'statement_import' | 'manual';
export type FinanceTriggerSource = 'manual' | 'scheduled' | 'webhook' | 'backfill';

export interface FinanceProviderConnectionInput {
  id?: string;
  connectionName: string;
  provider: FinanceProvider;
  accountKind: FinanceAccountKind;
  syncMode: FinanceSyncMode;
  organizationId?: string | null;
  companyId?: string | null;
  bankAccountId?: string | null;
  mpesaAccountId?: string | null;
  externalAccountRef?: string | null;
  baseUrl?: string | null;
  clientId?: string | null;
  secretName?: string | null;
  webhookSecretName?: string | null;
  apiVersion?: string | null;
  status?: 'draft' | 'active' | 'error' | 'disabled';
  isActive?: boolean;
  config?: Record<string, unknown>;
}

export interface FinanceProviderSyncRequest {
  connectionId: string;
  triggerSource?: FinanceTriggerSource;
  statementRows?: Record<string, unknown>[];
  transactions?: Record<string, unknown>[];
  statementFile?: {
    name: string;
    type: string;
    size: number;
    contentBase64?: string;
  };
  allowMock?: boolean;
}

export interface FinanceProviderConnection {
  id: string;
  provider: FinanceProvider;
  connection_name: string;
  account_kind: FinanceAccountKind;
  sync_mode: FinanceSyncMode;
  status: string;
  company_id?: string | null;
  external_account_ref: string | null;
  last_synced_at?: string | null;
  last_successful_sync_at?: string | null;
  last_error?: string | null;
  is_active?: boolean;
  re_bank_accounts?: {
    id: string;
    bank_name: string;
    account_number: string;
    current_balance: number;
    currency?: string | null;
  }[] | null;
  re_mpesa_accounts?: {
    id: string;
    business_name: string;
    phone_number: string;
    current_balance: number;
  }[] | null;
}

export interface FinanceProviderSyncResult {
  success: boolean;
  message: string;
  importedCount?: number;
  upsertedCount?: number;
  latestBalance?: number | null;
  syncRunId?: string;
  summary?: Record<string, unknown>;
}

const FUNCTION_NAME = 'finance-provider-sync';

const normalizeText = (value?: unknown) => String(value ?? '').trim();

const toNumber = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? '').replace(/,/g, '').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parsePostedAt = (value: unknown) => {
  const raw = normalizeText(value);
  if (!raw) return new Date().toISOString();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const normalizeDirection = (row: Record<string, unknown>): 'credit' | 'debit' => {
  const explicit = normalizeText(row.transaction_direction || row.direction).toLowerCase();
  if (explicit === 'credit' || explicit === 'debit') return explicit;

  const paidIn = toNumber(row['Paid In'] || row.paid_in || row.credit || row.amount_in);
  const withdrawn = toNumber(row['Withdrawn'] || row.withdrawn || row.debit || row.amount_out);
  return paidIn >= withdrawn ? 'credit' : 'debit';
};

const normalizeMpesaStatementRows = (rows: Record<string, unknown>[]) =>
  rows
    .map((row, index) => {
      const paidIn = toNumber(row['Paid In'] || row.paid_in || row.credit || row.amount);
      const withdrawn = toNumber(row['Withdrawn'] || row.withdrawn || row.debit);
      const amount = paidIn > 0 ? paidIn : withdrawn;
      const direction = paidIn > 0 ? 'credit' : 'debit';
      const receiptNo = normalizeText(row['Receipt No.'] || row.receipt_no || row.reference || row.receipt);
      const postedAt = parsePostedAt(row['Completion Time'] || row.completion_time || row.posted_at || row.date);

      return {
        external_transaction_id: receiptNo || `MPESA-${index + 1}-${postedAt}`,
        transaction_direction: direction,
        transaction_type: normalizeText(row.transaction_type || row['Transaction Type']) || 'mpesa_statement',
        posted_at: postedAt,
        value_date: postedAt.slice(0, 10),
        amount,
        currency: normalizeText(row.currency) || 'KES',
        balance_after: row.balance_after == null ? null : toNumber(row.balance_after),
        reference_number: receiptNo || null,
        account_reference: normalizeText(row.account_reference || row.msisdn || row['MSISDN']) || null,
        counterparty_name: normalizeText(row.counterparty_name || row['Other Party Info'] || row['Details']) || null,
        counterparty_account: normalizeText(row.counterparty_account) || null,
        narrative: normalizeText(row.narrative || row['Details'] || row.description) || null,
        raw_payload: row,
      };
    })
    .filter((row) => row.amount > 0);

const normalizeBankStatementRows = (rows: Record<string, unknown>[], provider: FinanceProvider) =>
  rows
    .map((row, index) => {
      const direction = normalizeDirection(row);
      const amount =
        Math.abs(
          toNumber(
            row.amount ||
              row.Amount ||
              row.credit ||
              row.debit ||
              row['Debit Amount'] ||
              row['Credit Amount'],
          ),
        ) ||
        Math.max(toNumber(row.credit || row['Credit Amount']), toNumber(row.debit || row['Debit Amount']));
      const postedAt = parsePostedAt(row.posted_at || row.date || row['Transaction Date'] || row.value_date);
      const externalId = normalizeText(
        row.external_transaction_id ||
          row.transaction_id ||
          row.reference ||
          row['Transaction Reference'] ||
          row['Document Number'],
      );

      return {
        external_transaction_id: externalId || `${provider.toUpperCase()}-${index + 1}-${postedAt}`,
        transaction_direction: direction,
        transaction_type: normalizeText(row.transaction_type || row.type) || 'bank_statement',
        posted_at: postedAt,
        value_date: normalizeText(row.value_date || row['Value Date']) || postedAt.slice(0, 10),
        amount,
        currency: normalizeText(row.currency) || 'KES',
        balance_after: row.balance_after == null ? null : toNumber(row.balance_after),
        reference_number: normalizeText(row.reference || row['Transaction Reference']) || null,
        account_reference: normalizeText(row.account_reference || row.account_no || row['Account Number']) || null,
        counterparty_name: normalizeText(row.counterparty_name || row['Counterparty Name']) || null,
        counterparty_account: normalizeText(row.counterparty_account || row['Counterparty Account']) || null,
        narrative: normalizeText(row.narrative || row.description || row['Narration']) || null,
        raw_payload: row,
      };
    })
    .filter((row) => row.amount > 0);

const resolveOrganizationId = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (error) return null;
  return data?.organization_id ?? null;
};

export const financeProviderSyncService = {
  async listConnections(): Promise<FinanceProviderConnection[]> {
    try {
      const response = await invokeEdgeFunction<{ success: boolean; connections: FinanceProviderConnection[] }>(
        FUNCTION_NAME,
        { action: 'list-connections' },
        { allowAnon: true },
      );

      return response.connections || [];
    } catch (error) {
      const { data, error: queryError } = await supabase
        .from('finance_external_account_connections')
        .select(`
          id,
          provider,
          connection_name,
          account_kind,
          sync_mode,
          status,
          company_id,
          external_account_ref,
          last_synced_at,
          last_successful_sync_at,
          last_error,
          is_active,
          re_bank_accounts (
            id,
            bank_name,
            account_number,
            current_balance,
            currency
          ),
          re_mpesa_accounts (
            id,
            business_name,
            phone_number,
            current_balance
          )
        `)
        .order('created_at', { ascending: false });

      if (queryError) {
        throw error ?? queryError;
      }

      return (data || []) as FinanceProviderConnection[];
    }
  },

  async saveConnection(input: FinanceProviderConnectionInput): Promise<FinanceProviderConnection> {
    try {
      const response = await invokeEdgeFunction<{ success: boolean; connection: FinanceProviderConnection }>(
        FUNCTION_NAME,
        { action: 'upsert-connection', payload: input },
        { allowAnon: true },
      );

      return response.connection;
    } catch (error) {
      const organizationId = input.organizationId ?? (await resolveOrganizationId());
      const payload = {
        organization_id: organizationId,
        company_id: input.companyId ?? null,
        provider: input.provider,
        connection_name: input.connectionName,
        account_kind: input.accountKind,
        sync_mode: input.syncMode,
        bank_account_id: input.bankAccountId ?? null,
        mpesa_account_id: input.mpesaAccountId ?? null,
        external_account_ref: input.externalAccountRef ?? null,
        base_url: input.baseUrl ?? null,
        client_id: input.clientId ?? null,
        secret_name: input.secretName ?? null,
        webhook_secret_name: input.webhookSecretName ?? null,
        api_version: input.apiVersion ?? null,
        status: input.status ?? 'active',
        is_active: input.isActive ?? true,
        config: input.config ?? {},
      };

      const { data, error: insertError } = await supabase
        .from('finance_external_account_connections')
        .insert([payload])
        .select(`
          id,
          provider,
          connection_name,
          account_kind,
          sync_mode,
          status,
          company_id,
          external_account_ref,
          last_synced_at,
          last_successful_sync_at,
          last_error,
          is_active,
          re_bank_accounts (
            id,
            bank_name,
            account_number,
            current_balance,
            currency
          ),
          re_mpesa_accounts (
            id,
            business_name,
            phone_number,
            current_balance
          )
        `)
        .single();

      if (insertError) {
        throw error ?? insertError;
      }

      return data as FinanceProviderConnection;
    }
  },

  async syncConnection(input: FinanceProviderSyncRequest): Promise<FinanceProviderSyncResult> {
    try {
      return await invokeEdgeFunction<FinanceProviderSyncResult>(
        FUNCTION_NAME,
        { action: 'sync-connection', payload: input },
        { allowAnon: true },
      );
    } catch (error) {
      const { data: connection, error: connectionError } = await supabase
        .from('finance_external_account_connections')
        .select('id, organization_id, provider, account_kind, bank_account_id, mpesa_account_id, sync_mode')
        .eq('id', input.connectionId)
        .single();

      if (connectionError || !connection) {
        throw error ?? connectionError;
      }

      const { data: syncRun, error: syncRunError } = await supabase
        .from('finance_external_sync_runs')
        .insert({
          organization_id: connection.organization_id,
          connection_id: connection.id,
          trigger_source: input.triggerSource ?? 'manual',
          status: 'running',
          request_payload: {
            rowCount: input.statementRows?.length ?? input.transactions?.length ?? 0,
            statementFile: input.statementFile
              ? { name: input.statementFile.name, type: input.statementFile.type, size: input.statementFile.size }
              : null,
            sync_mode: connection.sync_mode,
            provider: connection.provider,
          },
        })
        .select('id')
        .single();

      if (syncRunError || !syncRun) {
        throw error ?? syncRunError;
      }

      const providedRows = input.statementRows ?? input.transactions ?? [];
      const normalizedRows =
        providedRows.length > 0
          ? connection.provider === 'mpesa'
            ? normalizeMpesaStatementRows(providedRows)
            : normalizeBankStatementRows(providedRows, connection.provider)
          : [];

      if (normalizedRows.length > 0) {
        const payload = normalizedRows.map((transaction) => ({
          organization_id: connection.organization_id,
          connection_id: connection.id,
          sync_run_id: syncRun.id,
          provider: connection.provider,
          account_kind: connection.account_kind,
          bank_account_id: connection.bank_account_id,
          mpesa_account_id: connection.mpesa_account_id,
          external_transaction_id: transaction.external_transaction_id,
          transaction_direction: transaction.transaction_direction,
          transaction_type: transaction.transaction_type,
          posted_at: transaction.posted_at,
          value_date: transaction.value_date,
          amount: transaction.amount,
          currency: transaction.currency || 'KES',
          balance_after: transaction.balance_after,
          reference_number: transaction.reference_number,
          account_reference: transaction.account_reference,
          counterparty_name: transaction.counterparty_name,
          counterparty_account: transaction.counterparty_account,
          narrative: transaction.narrative,
          raw_payload: transaction.raw_payload,
        }));

        await supabase
          .from('finance_external_transactions')
          .upsert(payload, { onConflict: 'connection_id,external_transaction_id' });
      }

      const latestWithBalance = [...normalizedRows]
        .filter((row) => row.balance_after != null)
        .sort((left, right) => new Date(right.posted_at).getTime() - new Date(left.posted_at).getTime())[0];

      const latestBalance = latestWithBalance?.balance_after ?? null;

      if (latestWithBalance && connection.account_kind === 'bank' && connection.bank_account_id) {
        await supabase
          .from('re_bank_accounts')
          .update({ current_balance: latestWithBalance.balance_after })
          .eq('id', connection.bank_account_id);
      }

      if (latestWithBalance && connection.account_kind === 'mpesa' && connection.mpesa_account_id) {
        await supabase
          .from('re_mpesa_accounts')
          .update({ current_balance: latestWithBalance.balance_after })
          .eq('id', connection.mpesa_account_id);
      }

      await supabase
        .from('finance_external_account_connections')
        .update({
          last_synced_at: new Date().toISOString(),
          last_successful_sync_at: new Date().toISOString(),
          last_error: null,
          status: 'active',
        })
        .eq('id', connection.id);

      await supabase
        .from('finance_external_sync_runs')
        .update({
          status: normalizedRows.length > 0 ? 'success' : 'partial',
          imported_count: normalizedRows.length,
          upserted_count: normalizedRows.length,
          skipped_count: 0,
          completed_at: new Date().toISOString(),
          result_summary: {
            mode: normalizedRows.length > 0 ? 'statement_import' : input.statementFile ? 'file_upload' : 'manual',
            message:
              normalizedRows.length > 0
                ? 'Imported statement rows into finance transactions.'
                : input.statementFile
                  ? 'Statement file uploaded. Parse this file to generate transactions.'
                  : 'No statement rows were supplied.',
            latestBalance,
          },
        })
        .eq('id', syncRun.id);

      return {
        success: true,
        message: 'Finance provider sync completed.',
        importedCount: normalizedRows.length,
        upsertedCount: normalizedRows.length,
        latestBalance,
        syncRunId: syncRun.id,
        summary: {
          mode: normalizedRows.length > 0 ? 'statement_import' : input.statementFile ? 'file_upload' : 'manual',
          message:
            normalizedRows.length > 0
              ? 'Imported statement rows into finance transactions.'
              : input.statementFile
                ? 'Statement file uploaded. Parse this file to generate transactions.'
                : 'No statement rows were supplied.',
        },
      };
    }
  },
};

export default financeProviderSyncService;
