// @ts-nocheck
import { supabase } from '../utils/supabase';
import bankAccountsService from './bankAccountsService';

export type FinanceDepositAccountKind = 'bank' | 'cash' | 'mpesa' | 'general';

export interface FinanceDepositAccount {
  id: string;
  company_id: string;
  account_kind: FinanceDepositAccountKind;
  currency: string | null;
  current_balance: number;
  is_active: boolean;
  bank_name?: string | null;
  account_number?: string | null;
  account_holder_name?: string | null;
  account_type?: string | null;
  account_name?: string | null;
  business_name?: string | null;
  phone_number?: string | null;
  wallet_name?: string | null;
  wallet_provider?: string | null;
  wallet_identifier?: string | null;
}

const normalizeCompanyIds = (companyIds?: string[] | string | null) => {
  if (!companyIds) return [] as string[];
  return Array.isArray(companyIds)
    ? companyIds.map((value) => value.trim()).filter(Boolean)
    : [companyIds.trim()].filter(Boolean);
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildCompanyFilter = <T extends { company_id: string }>(
  accounts: T[],
  companyIds?: string[] | string | null,
) => {
  const normalizedCompanyIds = normalizeCompanyIds(companyIds);
  if (normalizedCompanyIds.length === 0) return accounts;
  return accounts.filter((account) => normalizedCompanyIds.includes(account.company_id));
};

const dedupeAccounts = <T extends {
  id: string;
  company_id: string;
  account_kind: FinanceDepositAccountKind;
  bank_name?: string | null;
  account_number?: string | null;
  account_holder_name?: string | null;
  account_name?: string | null;
  business_name?: string | null;
  phone_number?: string | null;
  wallet_name?: string | null;
  wallet_provider?: string | null;
  wallet_identifier?: string | null;
}>(accounts: T[]) => {
  const seen = new Set<string>();
  return accounts.filter((account) => {
    const keyParts = [account.company_id, account.account_kind];

    if (account.account_kind === 'bank') {
      keyParts.push(account.bank_name?.trim() || '', account.account_number?.trim() || '', account.account_holder_name?.trim() || '');
    } else if (account.account_kind === 'cash') {
      keyParts.push(account.account_name?.trim() || '');
    } else if (account.account_kind === 'mpesa') {
      keyParts.push(account.business_name?.trim() || '', account.phone_number?.trim() || '');
    } else {
      keyParts.push(account.wallet_name?.trim() || '', account.wallet_provider?.trim() || '', account.wallet_identifier?.trim() || '');
    }

    const key = keyParts.map((part) => part || '').join(':').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const bankAccountSignature = (account: {
  company_id: string;
  bank_name?: string | null;
  account_number?: string | null;
  account_holder_name?: string | null;
  account_type?: string | null;
}) =>
  [account.company_id, account.bank_name?.trim() || '', account.account_number?.trim() || '', account.account_holder_name?.trim() || '', account.account_type?.trim() || '']
    .join(':')
    .toLowerCase();

const formatAccountLabel = (account: FinanceDepositAccount) => {
  const bankParts = [account.bank_name?.trim(), account.account_number?.trim(), account.account_holder_name?.trim()].filter(Boolean);
  const walletParts = [account.wallet_name?.trim(), account.wallet_provider?.trim(), account.wallet_identifier?.trim()].filter(Boolean);

  if (account.account_kind === 'cash') {
    return account.account_name?.trim() || 'Cash Wallet';
  }

  if (account.account_kind === 'mpesa') {
    const parts = [account.business_name?.trim(), account.phone_number?.trim()].filter(Boolean);
    return parts.length > 0 ? parts.join(' · ') : 'M-Pesa Wallet';
  }

  if (account.account_kind === 'general') {
    if (walletParts.length > 0) return walletParts.join(' · ');
    if (bankParts.length > 0) return bankParts.join(' · ');
    return 'Other Wallet';
  }

  return bankParts.length > 0 ? bankParts.join(' · ') : 'Bank Account';
};

const formatAccountSubtitle = (account: FinanceDepositAccount) => {
  if (account.account_kind === 'cash') {
    return 'Cash wallet';
  }

  if (account.account_kind === 'mpesa') {
    return 'M-Pesa wallet';
  }

  if (account.account_kind === 'general') {
    return account.wallet_provider?.trim() || 'Other wallet';
  }

  return account.account_type?.trim() || 'Bank account';
};

const listBankAccounts = async (companyIds?: string[] | string | null) => {
  const normalizedCompanyIds = normalizeCompanyIds(companyIds);

  // 1. Fetch via supabase table directly
  let dbAccounts: any[] = [];
  try {
    const query = supabase
      .from('re_bank_accounts')
      .select('id, company_id, bank_name, account_number, account_holder_name, account_type, currency, current_balance, is_active')
      .eq('is_active', true)
      .order('bank_name', { ascending: true })
      .order('account_number', { ascending: true });

    const result = normalizedCompanyIds.length > 0 ? await query.in('company_id', normalizedCompanyIds) : await query;
    if (!result.error && result.data) {
      dbAccounts = result.data;
    }
  } catch (dbError) {
    console.warn('financeDepositAccountsService: direct bank accounts query failed', dbError);
  }

  // 2. Fetch via bankAccountsService (Edge Function to bypass RLS)
  let serviceAccounts: any[] = [];
  try {
    if (normalizedCompanyIds.length > 0) {
      const results = await Promise.all(
        normalizedCompanyIds.map((companyId) => bankAccountsService.listAccounts(companyId))
      );
      serviceAccounts = results.flat();
    } else {
      serviceAccounts = await bankAccountsService.listAccounts();
    }
  } catch (serviceError) {
    console.warn('financeDepositAccountsService: edge function bank accounts query failed', serviceError);
  }

  // 3. Merge and deduplicate by the logical account signature instead of raw ID.
  // The direct table query and the edge-function query can both surface the same
  // underlying bank account with different row IDs, which would otherwise show up
  // twice in account pickers.
  const combined = [...dbAccounts, ...serviceAccounts];
  const seen = new Set<string>();
  const unique = combined.filter((account) => {
    const signature = bankAccountSignature(account);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });

  return unique.map((account) => ({
    id: account.id,
    company_id: account.company_id,
    bank_name: account.bank_name,
    account_number: account.account_number,
    account_holder_name: account.account_holder_name ?? null,
    account_type: account.account_type ?? null,
    currency: account.currency ?? null,
    current_balance: toNumber(account.current_balance),
    is_active: account.is_active ?? true,
    account_kind: 'bank' as const,
  })) as FinanceDepositAccount[];
};

const listCashAccounts = async (companyIds?: string[] | string | null) => {
  const query = supabase
    .from('re_cash_accounts')
    .select('id, company_id, account_name, current_balance, is_active')
    .eq('is_active', true)
    .order('account_name', { ascending: true });

  const normalizedCompanyIds = normalizeCompanyIds(companyIds);
  const result = normalizedCompanyIds.length > 0 ? await query.in('company_id', normalizedCompanyIds) : await query;

  if (result.error) throw result.error;

  return ((result.data || []) as Array<{
    id: string;
    company_id: string;
    account_name: string;
    current_balance: number | string;
    is_active: boolean;
  }>).map((account) => ({
    ...account,
    account_kind: 'cash' as const,
    currency: 'KES',
    current_balance: toNumber(account.current_balance),
  })) as FinanceDepositAccount[];
};

const listMpesaAccounts = async (companyIds?: string[] | string | null) => {
  const query = supabase
    .from('re_mpesa_accounts')
    .select('id, company_id, business_name, phone_number, current_balance, is_active')
    .eq('is_active', true)
    .order('business_name', { ascending: true })
    .order('phone_number', { ascending: true });

  const normalizedCompanyIds = normalizeCompanyIds(companyIds);
  const result = normalizedCompanyIds.length > 0 ? await query.in('company_id', normalizedCompanyIds) : await query;

  if (result.error) throw result.error;

  return ((result.data || []) as Array<{
    id: string;
    company_id: string;
    business_name: string;
    phone_number: string;
    current_balance: number | string;
    is_active: boolean;
  }>).map((account) => ({
    ...account,
    account_kind: 'mpesa' as const,
    currency: 'KES',
    current_balance: toNumber(account.current_balance),
  })) as FinanceDepositAccount[];
};

const listGenericWalletAccounts = async (companyIds?: string[] | string | null) => {
  const query = supabase
    .from('re_wallet_accounts')
    .select('id, company_id, wallet_name, wallet_provider, wallet_identifier, current_balance, currency, is_active')
    .eq('is_active', true)
    .order('wallet_name', { ascending: true });

  const normalizedCompanyIds = normalizeCompanyIds(companyIds);
  const result = normalizedCompanyIds.length > 0 ? await query.in('company_id', normalizedCompanyIds) : await query;

  if (result.error) throw result.error;

  return ((result.data || []) as Array<{
    id: string;
    company_id: string;
    wallet_name: string;
    wallet_provider: string | null;
    wallet_identifier: string | null;
    current_balance: number | string;
    currency: string | null;
    is_active: boolean;
  }>).map((account) => ({
    ...account,
    account_kind: 'general' as const,
    current_balance: toNumber(account.current_balance),
  })) as FinanceDepositAccount[];
};

export const financeDepositAccountsService = {
  async listAccounts(companyIds?: string[] | string | null): Promise<FinanceDepositAccount[]> {
    const results = await Promise.allSettled([
      listBankAccounts(companyIds),
      listCashAccounts(companyIds),
      listMpesaAccounts(companyIds),
      listGenericWalletAccounts(companyIds),
    ]);

    const bankAccounts = results[0].status === 'fulfilled' ? results[0].value : [];
    const cashAccounts = results[1].status === 'fulfilled' ? results[1].value : [];
    const mpesaAccounts = results[2].status === 'fulfilled' ? results[2].value : [];
    const genericAccounts = results[3].status === 'fulfilled' ? results[3].value : [];

    return dedupeAccounts([...bankAccounts, ...cashAccounts, ...mpesaAccounts, ...genericAccounts])
      .filter((account) => buildCompanyFilter([account], companyIds).length > 0)
      .sort((left, right) => formatAccountLabel(left).localeCompare(formatAccountLabel(right)));
  },
  formatAccountLabel,
  formatAccountSubtitle,
};

export default financeDepositAccountsService;
