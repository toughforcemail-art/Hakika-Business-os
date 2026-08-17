// @ts-nocheck
import { supabase } from '../utils/supabase';
import { UnifiedStorageService } from './UnifiedStorageService';

export interface ProfileUpdate {
  full_name?: string;
  username?: string;
  phone?: string;
  avatar_url?: string;
  is_approved?: boolean;
  approval_status?: string;
  approved_by?: string;
  approved_by_id?: string;
  approved_at?: string;
}

export class ProfileService {
  /**
   * Uploads a profile image to the 'avatars' bucket
   */
  static async uploadAvatar(userId: string, file: File): Promise<string | null> {
    try {
      const url = await UnifiedStorageService.upload(file, {
        folder: `/avatars/${userId}`,
        bucket: 'avatars'
      });

      return url;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      return null;
    }
  }

  /**
   * Updates the profile in the database
   */
  static async updateProfile(userId: string, updates: ProfileUpdate) {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (error) throw error;
  }

  /**
   * Fetches the current user's profile
   */
  static async getProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}
