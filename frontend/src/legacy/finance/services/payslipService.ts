// @ts-nocheck
import { supabase } from '../utils/supabase';

export interface PayslipRecord {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: {
    size: number;
    mimetype: string;
    cacheControl: string;
  };
}

export const payslipService = {
  /**
   * Fetches the list of payslips for the current user.
   * Assumes files are stored in a folder named after the user's ID.
   */
  async getMyPayslips(): Promise<PayslipRecord[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const { data, error } = await supabase
      .storage
      .from('payslips')
      .list(user.id, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'name', order: 'desc' },
      });

    if (error) {
      console.error('Error fetching payslips:', error);
      throw error;
    }

    return data as unknown as PayslipRecord[];
  },

  /**
   * Gets a temporary signed URL for a specific payslip file.
   */
  async getDownloadUrl(fileName: string): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const { data, error } = await supabase
      .storage
      .from('payslips')
      .createSignedUrl(`${user.id}/${fileName}`, 60 * 60); // 1 hour expiry

    if (error) {
      console.error('Error creating signed URL:', error);
      throw error;
    }

    return data.signedUrl;
  },

  /**
   * Admin function to upload a payslip for a specific user.
   */
  async uploadPayslip(userId: string, fileName: string, fileBody: Blob | File): Promise<void> {
    const { error } = await supabase
      .storage
      .from('payslips')
      .upload(`${userId}/${fileName}`, fileBody, {
        upsert: true,
        contentType: 'application/pdf',
      });

    if (error) {
      console.error('Error uploading payslip:', error);
      throw error;
    }
  }
};
