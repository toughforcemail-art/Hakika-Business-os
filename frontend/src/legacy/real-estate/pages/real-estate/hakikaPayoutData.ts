// @ts-nocheck
import { supabase } from '../../utils/supabase';

export type PayoutRecipient = {
  id: string;
  recipient_name: string;
  recipient_phone: string | null;
  recipient_shortcode: string | null;
  payout_type: 'b2c' | 'b2b';
  is_active: boolean;
  updated_at: string;
};

export type PayoutRequest = {
  id: string;
  request_type: 'b2c' | 'b2b';
  recipient_name: string | null;
  recipient_phone: string | null;
  recipient_shortcode: string | null;
  amount: number;
  request_status: string;
  response_status: string | null;
  result_description: string | null;
  daraja_reference: string | null;
  created_at: string;
};

export type PayoutJob = {
  id: string;
  invoice_id: string | null;
  queue_source: string;
  payout_type: 'b2c' | 'b2b';
  beneficiary_name: string | null;
  beneficiary_phone: string | null;
  beneficiary_shortcode: string | null;
  amount: number;
  currency: string;
  status: string;
  attempts: number;
  last_error: string | null;
  locked_at: string | null;
  processed_at: string | null;
  created_at: string;
};

export async function loadPayoutRecipients(companyId: string) {
  const { data, error } = await supabase
    .from('mpesa_payout_recipients')
    .select('id, recipient_name, recipient_phone, recipient_shortcode, payout_type, is_active, updated_at')
    .eq('company_id', companyId)
    .order('updated_at', { ascending: false })
    .limit(120);
  if (error) throw error;
  return (data || []) as PayoutRecipient[];
}

export async function loadPayoutRequests(companyId: string) {
  const { data, error } = await supabase
    .from('mpesa_payout_requests')
    .select('id, request_type, recipient_name, recipient_phone, recipient_shortcode, amount, request_status, response_status, result_description, daraja_reference, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []) as PayoutRequest[];
}

export async function loadPayoutJobs(companyId: string) {
  const { data, error } = await supabase
    .from('mpesa_payout_jobs')
    .select('id, invoice_id, queue_source, payout_type, beneficiary_name, beneficiary_phone, beneficiary_shortcode, amount, currency, status, attempts, last_error, locked_at, processed_at, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(120);
  if (error) throw error;
  return (data || []) as PayoutJob[];
}
