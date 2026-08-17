// @ts-nocheck
import { supabase } from '../utils/supabase';

/**
 * Get the current user's company_id
 */
async function getCurrentUserCompanyId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle();

    return profile?.company_id || null;
  } catch (error) {
    console.error('Error getting user company_id:', error);
    return null;
  }
}

/**
 * Manually sync M-Pesa transactions to re_payments table
 * This is a fallback in case the automatic trigger doesn't work
 */
export async function syncMpesaPayments(invoiceId?: string) {
  try {
    const userCompanyId = await getCurrentUserCompanyId();
    console.log('Current user company_id:', userCompanyId);

    const query = supabase
      .from('mpesa_transactions')
      .select('*')
      .eq('transaction_status', 'Completed')
      .eq('mpesa_source', 'stk')
      .gt('paid_in', 0);

    if (invoiceId) {
      query.eq('invoice_id', invoiceId);
    }

    const { data: transactions, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching mpesa_transactions:', fetchError);
      throw fetchError;
    }
    
    if (!transactions || transactions.length === 0) {
      console.log('No mpesa_transactions found to sync');
      return { success: true, synced: 0, message: 'No transactions to sync' };
    }

    console.log(`Found ${transactions.length} mpesa_transactions to sync`);

    let synced = 0;
    const errors: string[] = [];

    for (const transaction of transactions) {
      try {
        console.log(`Processing transaction: ${transaction.receipt_no}`);

        // Check if payment already exists
        const { data: existingRows, error: existError } = await supabase
          .from('re_payments')
          .select('id')
          .eq('reference_number', transaction.receipt_no)
          .eq('payment_method', 'mpesa')
          .limit(1);

        if (existError) {
          console.error(`Error checking existing payment for ${transaction.receipt_no}:`, existError);
          errors.push(`Failed to check existing payment ${transaction.receipt_no}: ${existError.message}`);
          continue;
        }

        if ((existingRows?.length ?? 0) > 0) {
          console.log(`Payment already exists for ${transaction.receipt_no}, skipping`);
          continue; // Payment already exists
        }

        // Get company_id and tenant_id from transaction, invoice, tenant, or user profile
        let companyId = transaction.company_id;
        let tenantId = transaction.tenant_id;
        let unitId = transaction.unit_id;
        
        // Try to get data from invoice first (most reliable source)
        if (transaction.invoice_id) {
          const { data: invoice, error: invoiceError } = await supabase
            .from('re_invoices')
            .select('company_id, tenant_id, unit_id')
            .eq('id', transaction.invoice_id)
            .maybeSingle();
          
          if (invoiceError) {
            console.error(`Error fetching invoice ${transaction.invoice_id}:`, invoiceError);
          }
          if (invoice) {
            companyId = companyId || invoice.company_id;
            tenantId = tenantId || invoice.tenant_id;
            unitId = unitId || invoice.unit_id;
            console.log(`Got invoice data: company_id=${invoice.company_id}, tenant_id=${invoice.tenant_id}, unit_id=${invoice.unit_id}`);
          }
        }

        // If we have tenant_id but no company_id, get company_id from tenant
        if (!companyId && tenantId) {
          const { data: tenant, error: tenantError } = await supabase
            .from('re_tenants')
            .select('company_id')
            .eq('id', tenantId)
            .maybeSingle();
          
          if (tenantError) {
            console.error(`Error fetching tenant ${tenantId}:`, tenantError);
          }
          if (tenant) {
            companyId = tenant.company_id;
            console.log(`Got company_id from tenant: ${companyId}`);
          }
        }

        // Use user's company_id as fallback
        if (!companyId && userCompanyId) {
          console.log(`Using user's company_id as fallback: ${userCompanyId}`);
          companyId = userCompanyId;
        }

        // Skip if we still don't have company_id
        if (!companyId) {
          const msg = `Failed to sync ${transaction.receipt_no}: No company_id found (invoice: ${transaction.invoice_id}, tenant: ${tenantId})`;
          console.warn(msg);
          errors.push(msg);
          continue;
        }

        // Warn if we don't have tenant_id (but still proceed)
        if (!tenantId) {
          console.warn(`Warning: No tenant_id for payment ${transaction.receipt_no} (invoice: ${transaction.invoice_id})`);
        }

        console.log(`Inserting payment for ${transaction.receipt_no} with company_id: ${companyId}, tenant_id: ${tenantId}, unit_id: ${unitId}`);

        // Insert payment
        const { error: insertError } = await supabase
          .from('re_payments')
          .insert([
            {
              company_id: companyId,
              tenant_id: tenantId || null,
              unit_id: unitId || null,
              invoice_id: transaction.invoice_id,
              amount: transaction.paid_in,
              payment_method: 'mpesa',
              payment_date: new Date(transaction.completion_time).toISOString().split('T')[0],
              reference_number: transaction.receipt_no,
              status: 'completed',
              notes: `Manual sync from M-Pesa transaction: ${transaction.receipt_no}`,
              created_at: new Date().toISOString(),
            },
          ]);

        if (insertError) {
          console.error(`Insert error for ${transaction.receipt_no}:`, insertError);
          errors.push(`Failed to sync ${transaction.receipt_no}: ${insertError.message}`);
        } else {
          if (transaction.invoice_id) {
            try {
              await refreshInvoiceFromPayments(transaction.invoice_id);
            } catch (refreshError: any) {
              console.error(`Failed to refresh invoice ${transaction.invoice_id}:`, refreshError);
              errors.push(`Synced ${transaction.receipt_no} but invoice refresh failed: ${refreshError.message}`);
            }
          }
          console.log(`Successfully synced payment ${transaction.receipt_no}`);
          synced++;
        }
      } catch (error: any) {
        console.error(`Exception processing ${transaction.receipt_no}:`, error);
        errors.push(`Error processing ${transaction.receipt_no}: ${error.message}`);
      }
    }

    console.log(`Sync complete: ${synced} synced, ${errors.length} errors`);

    return {
      success: errors.length === 0,
      synced,
      errors: errors.length > 0 ? errors : undefined,
      message: `Synced ${synced} payments${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
    };
  } catch (error: any) {
    console.error('Payment sync error:', error);
    return {
      success: false,
      synced: 0,
      error: error.message,
      message: 'Failed to sync payments',
    };
  }
}

/**
 * Refresh invoice payment amounts from re_payments table
 */
export async function refreshInvoicePayments(invoiceId: string) {
  try {
    const { data: invoice, error } = await supabase.rpc('recalculate_invoice_from_payments', { p_invoice_id: invoiceId });
    if (error) throw error;
    if (!invoice) throw new Error('Invoice reconciliation returned no invoice');

    return {
      success: true,
      invoiceId,
      totalPaid: Number((invoice as any).amount_paid || 0),
      status: (invoice as any).status,
      message: `Invoice reconciled: ${(invoice as any).amount_paid || 0} paid, status: ${(invoice as any).status}`,
    };
  } catch (error: any) {
    console.error('Invoice refresh error:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to refresh invoice payments',
    };
  }
}

async function refreshInvoiceFromPayments(invoiceId: string) {
  const { error } = await supabase.rpc('recalculate_invoice_from_payments', { p_invoice_id: invoiceId });
  if (error) throw error;
}

/**
 * Get payment summary for an invoice
 */
export async function getInvoicePaymentSummary(invoiceId: string) {
  try {
    const { data: invoice, error: invoiceError } = await supabase
      .from('re_invoices')
      .select('id, invoice_number, amount_due, amount_paid, status')
      .eq('id', invoiceId)
      .maybeSingle();

    if (invoiceError) throw invoiceError;
    if (!invoice) throw new Error('Invoice not found');

    const { data: payments, error: paymentsError } = await supabase
      .from('re_payments')
      .select('id, payment_date, amount, payment_method, reference_number, status')
      .eq('invoice_id', invoiceId)
      .order('payment_date', { ascending: false });

    if (paymentsError) throw paymentsError;

    const balance = Math.max(0, invoice.amount_due - invoice.amount_paid);

    return {
      success: true,
      invoice: {
        ...invoice,
        balance,
      },
      payments: payments || [],
      message: 'Payment summary retrieved',
    };
  } catch (error: any) {
    console.error('Payment summary error:', error);
    return {
      success: false,
      error: error.message,
      message: 'Failed to get payment summary',
    };
  }
}
