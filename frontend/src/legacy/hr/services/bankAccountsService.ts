// @ts-nocheck
import { invokeEdgeFunction } from '../utils/edgeFunctions';

export interface BankAccountRecord {
  id: string;
  company_id: string;
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  account_type: string | null;
  currency: string | null;
  current_balance: number | string;
  is_active: boolean;
  module?: string | null;
  entity?: string | null;
}

type BankAccountsListResponse = {
  success: boolean;
  accounts: BankAccountRecord[];
};

const FUNCTION_NAME = 'bank-accounts-list';

export const bankAccountsService = {
  async listAccounts(companyId?: string): Promise<BankAccountRecord[]> {
    const response = await invokeEdgeFunction<BankAccountsListResponse>(
      FUNCTION_NAME,
      companyId ? { companyId } : {},
    );

    return response.accounts || [];
  },
};

export default bankAccountsService;
