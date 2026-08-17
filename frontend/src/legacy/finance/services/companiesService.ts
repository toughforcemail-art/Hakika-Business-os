// @ts-nocheck
import { invokeEdgeFunction } from '../utils/edgeFunctions';

export interface CompanyRecord {
  id: string;
  name: string;
  code: string | null;
  organization_id: string | null;
}

type CompaniesListResponse = {
  success: boolean;
  companies: CompanyRecord[];
};

const FUNCTION_NAME = 'companies-list';

export const companiesService = {
  async listCompanies(): Promise<CompanyRecord[]> {
    const response = await invokeEdgeFunction<CompaniesListResponse>(FUNCTION_NAME, {});
    return response.companies || [];
  },
};

export default companiesService;
