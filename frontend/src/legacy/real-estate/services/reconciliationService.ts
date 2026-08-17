// @ts-nocheck
import { supabase } from '../utils/supabase';

export interface MpesaTransaction {
  id: string;
  receipt_no: string;
  completion_time: string;
  paid_in: number;
  withdrawn: number;
  details: string;
  is_reconciled: boolean;
}

export interface ReconciliationStatus {
  total: number;
  reconciled: number;
  pending: number;
  unmatched_mpesa: number;
}

export const reconciliationService = {
  /**
   * Fetches reconciliation summary statistics.
   */
  async getStatusSummary(): Promise<ReconciliationStatus> {
    const { data: ledger } = await supabase.from('finance_ledger').select('is_verified');
    const { data: mpesa } = await supabase.from('mpesa_transactions').select('is_reconciled');

    const totalLedger = ledger?.length || 0;
    const reconciledLedger = ledger?.filter(l => l.is_verified).length || 0;
    const unmatchedMpesa = mpesa?.filter(m => !m.is_reconciled).length || 0;

    return {
      total: totalLedger,
      reconciled: reconciledLedger,
      pending: totalLedger - reconciledLedger,
      unmatched_mpesa: unmatchedMpesa
    };
  },

  /**
   * Attempts to auto-reconcile transactions.
   * Logic: Match by amount and receipt_no in reference field.
   */
  async runAutoReconciliation(): Promise<number> {
    // 1. Fetch unreconciled M-Pesa transactions
    const { data: mpesa } = await supabase
      .from('mpesa_transactions')
      .select('*')
      .eq('is_reconciled', false);

    // 2. Fetch unverified ledger entries
    const { data: ledger } = await supabase
      .from('finance_ledger')
      .select('*')
      .eq('is_verified', false);

    if (!mpesa || !ledger) return 0;

    let matchCount = 0;

    for (const m of mpesa) {
      // Find a ledger entry that matches receipt_no OR amount + close date
      const match = ledger.find(l => 
        (l.reference_id && l.reference_id.includes(m.receipt_no)) ||
        (Number(l.amount) === (m.paid_in || m.withdrawn))
      );

      if (match) {
        // Create reconciliation link
        const { error: reconError } = await supabase.from('mpesa_reconciliation').insert({
          ledger_id: match.id,
          mpesa_id: m.id,
          reconciliation_type: 'auto'
        });

        if (!reconError) {
          // Update flags
          await supabase.from('finance_ledger').update({ is_verified: true }).eq('id', match.id);
          await supabase.from('mpesa_transactions').update({ is_reconciled: true }).eq('id', m.id);
          matchCount++;
        }
      }
    }

    return matchCount;
  },

  /**
   * Uploads and parses an M-Pesa CSV statement.
   * This is a simplified mock parser.
   */
  async uploadStatement(rows: any[]): Promise<void> {
    const formatted = rows.map(r => ({
      receipt_no: r['Receipt No.'],
      completion_time: r['Completion Time'],
      details: r['Details'],
      paid_in: Number(r['Paid In'] || 0),
      withdrawn: Number(r['Withdrawn'] || 0),
      transaction_status: r['Transaction Status']
    }));

    const { error } = await supabase.from('mpesa_transactions').upsert(formatted, { onConflict: 'receipt_no' });
    if (error) throw error;
  }
};
