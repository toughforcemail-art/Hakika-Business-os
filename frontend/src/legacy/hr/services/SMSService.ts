// @ts-nocheck
import { supabase } from '../utils/supabase';
import { invokeEdgeFunction } from '../utils/edgeFunctions';
import { normalizePhoneNumber } from '../utils/phoneNumbers';

export async function sendBulkSms(
  phoneNumbers: string[],
  message: string,
  channel: 'sms' | 'whatsapp' = 'sms',
  options?: { allowAnon?: boolean }
): Promise<any> {
  const normalizedPhoneNumbers = phoneNumbers
    .map((phoneNumber) => normalizePhoneNumber(phoneNumber))
    .filter((phoneNumber): phoneNumber is string => Boolean(phoneNumber));

  if (!normalizedPhoneNumbers.length) {
    throw new Error('Please provide at least one valid phone number with a country code.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session && !options?.allowAnon) throw new Error('Authentication required');

  return await invokeEdgeFunction('send-sms', { 
    phoneNumbers: normalizedPhoneNumbers, 
    message, 
    channel, 
    module: options?.allowAnon ? 'public_auth' : 'admin' 
  }, {
    accessToken: session?.access_token ?? null,
    allowAnon: Boolean(options?.allowAnon)
  });
}
