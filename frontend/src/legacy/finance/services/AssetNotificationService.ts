// @ts-nocheck
import { supabase } from '../utils/supabase';
import { sendBulkSms } from './SMSService';
import { sendEmail } from './emailService';

export const AssetNotificationService = {
  /**
   * Send notification when an asset is initially issued to an employee
   */
  async sendAssignmentAlert(employeeId: string, assetName: string, serialNumber: string) {
    try {
      // 1. Fetch employee contact info
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('full_name, email, phone')
        .eq('id', employeeId)
        .single();

      if (error || !profile) throw new Error('Employee profile not found for notification');

      const message = `Hello ${profile.full_name}, the asset "${assetName}" (SN: ${serialNumber}) has been officially issued to you. Please ensure its safety and use. - Hakika Operations`;

      // 2. Send SMS
      if (profile.phone) {
        await sendBulkSms([profile.phone], message);
      }

      // 3. Send Email
      if (profile.email) {
        const html = `
          <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #e5e7eb; border-radius: 24px;">
            <h1 style="color: #ff6a00; font-size: 24px; font-weight: 800; margin-bottom: 20px;">Asset Issued to You</h1>
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hello <strong>${profile.full_name}</strong>,</p>
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">This is to inform you that you have been assigned a new piece of equipment:</p>
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 16px; margin: 24px 0; border: 1px solid #f3f4f6;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase;">Equipment Name</p>
              <p style="margin: 4px 0 12px 0; color: #111827; font-size: 18px; font-weight: 800;">${assetName}</p>
              <p style="margin: 0; color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase;">Serial Number</p>
              <p style="margin: 4px 0 0 0; color: #111827; font-size: 16px; font-weight: 700; font-mono: true;">${serialNumber}</p>
            </div>
            <p style="color: #6b7280; font-size: 14px; text-align: center;">Please log in to your portal to view your assigned inventory.</p>
            <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 30px 0;" />
            <p style="color: #9ca3af; font-size: 10px; text-align: center;">© 2026 Hakika app. All rights reserved.</p>
          </div>
        `;
        await sendEmail({
          to: profile.email,
          subject: `Asset Issuance Notice: ${assetName}`,
          html
        });
      }

      return true;
    } catch (err) {
      console.error('Failed to send assignment alert:', err);
      return false;
    }
  },

  /**
   * Send notification when an asset is transferred from one employee to another
   */
  async sendTransferAlert(recipientId: string, assetName: string, serialNumber: string, previousHolderName: string) {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('full_name, email, phone')
        .eq('id', recipientId)
        .single();

      if (error || !profile) throw new Error('Recipient profile not found for notification');

      const message = `Hello ${profile.full_name}, the asset "${assetName}" (SN: ${serialNumber}) has been transferred to you from ${previousHolderName}. - Hakika Operations`;

      if (profile.phone) {
        await sendBulkSms([profile.phone], message);
      }

      if (profile.email) {
        const html = `
          <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #e5e7eb; border-radius: 24px;">
            <h1 style="color: #ff6a00; font-size: 24px; font-weight: 800; margin-bottom: 20px;">Asset Successfully Transferred</h1>
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">Hello <strong>${profile.full_name}</strong>,</p>
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">An equipment handover has been recorded. You are now the official holder of:</p>
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 16px; margin: 24px 0; border: 1px solid #f3f4f6;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase;">Equipment Name</p>
              <p style="margin: 4px 0 12px 0; color: #111827; font-size: 18px; font-weight: 800;">${assetName}</p>
              <p style="margin: 0; color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase;">Former Holder</p>
              <p style="margin: 4px 0 12px 0; color: #111827; font-size: 16px; font-weight: 700;">${previousHolderName}</p>
              <p style="margin: 0; color: #6b7280; font-size: 12px; font-weight: 700; text-transform: uppercase;">Serial Number</p>
              <p style="margin: 4px 0 0 0; color: #111827; font-size: 16px; font-family: monospace;">${serialNumber}</p>
            </div>
            <p style="color: #6b7280; font-size: 14px; text-align: center;">Chain of custody has been updated in the system.</p>
            <hr style="border: 0; border-top: 1px solid #f3f4f6; margin: 30px 0;" />
            <p style="color: #9ca3af; font-size: 10px; text-align: center;">© 2026 Hakika app. All rights reserved.</p>
          </div>
        `;
        await sendEmail({
          to: profile.email,
          subject: `Asset Handover Notice: ${assetName}`,
          html
        });
      }

      return true;
    } catch (err) {
      console.error('Failed to send transfer alert:', err);
      return false;
    }
  }
};
