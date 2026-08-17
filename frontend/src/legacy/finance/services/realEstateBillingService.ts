// @ts-nocheck
import { supabase } from '../utils/supabase';

export interface BillingBatchResult {
  totalUnits: number;
  invoicesGenerated: number;
  warnings: string[];
}

export async function generateMonthlyInvoices(month: Date, companyId: string, createdBy: string): Promise<{ success: boolean; count: number; message?: string }> {
    const stats = {
      totalUnits: 0,
      invoicesGenerated: 0,
      warnings: [] as string[]
    };

    try {
      // 1. Fetch all Units that are 'occupied'
      const { data: units, error: unitError } = await supabase
        .from('re_units')
        .select(`
          *,
          tenant:re_tenants(*)
        `)
        .eq('company_id', companyId)
        .eq('status', 'occupied');

      if (unitError) throw unitError;
      stats.totalUnits = units?.length || 0;

      if (!units || units.length === 0) return { success: true, count: 0, message: 'No occupied units found to bill.' };

      // 2. Iterate and generate invoices
      for (const unit of units) {
        if (!unit.tenant) {
          stats.warnings.push(`Unit ${unit.unit_number} is marked as occupied but has no linked tenant.`);
          continue;
        }

        const tenant = unit.tenant;
        const { error: invoiceError } = await supabase.rpc('generate_monthly_invoice_for_unit', {
          p_unit_id: unit.id,
          p_company_id: companyId,
          p_created_by: createdBy,
          p_month: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`,
        });

        if (invoiceError) {
          stats.warnings.push(`Failed to create invoice for Unit ${unit.unit_number}: ${invoiceError.message}`);
        } else {
          stats.invoicesGenerated++;
        }
      }

      return { 
        success: stats.invoicesGenerated > 0 || stats.warnings.length === 0, 
        count: stats.invoicesGenerated,
        message: stats.warnings.length > 0 ? stats.warnings.join('\n') : undefined
      };
    } catch (error: any) {
      console.error('Billing Job Failed:', error);
      return { success: false, count: 0, message: error.message };
    }
}
