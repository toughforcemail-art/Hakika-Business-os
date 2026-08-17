// @ts-nocheck
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase';

export const sendTwoFactorCodeEmail = async (email: string, code: string): Promise<void> => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: email,
      subject: 'Your HAKIKA Verification Code',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #ec4899;">Verification Code</h2>
          <p>Your 6-digit verification code is:</p>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #111827; margin: 0;">${code}</p>
          </div>
          <p style="color: #666; font-size: 14px;">This code expires in 10 minutes. Do not share this code with anyone.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    let message = 'We could not send the verification code. Please try again.';
    try {
      const parsed = text ? JSON.parse(text) : null;
      message = parsed?.error || parsed?.message || message;
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }
};
