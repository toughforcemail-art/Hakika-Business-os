// @ts-nocheck
import { supabase } from '../utils/supabase';
import { imagekitService } from './imagekitService';

export interface UploadOptions {
  folder?: string;
  bucket?: string;
  fileName?: string;
}

export interface UploadFailure {
  fileName: string;
  message: string;
}

export const UnifiedStorageService = {
  /**
   * Uploads a file to the appropriate storage service based on its type.
   * PDFs/Docs go to Supabase Storage, Images go to ImageKit.
   */
  async upload(file: File, options: UploadOptions = {}): Promise<string> {
    const { 
      folder = '/general', 
      bucket = 'general-docs', 
      fileName: customName 
    } = options;

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const isDocument = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv'].includes(fileExt || '');
    const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(fileExt || '');

    try {
      if (isDocument) {
        // --- Supabase Storage ---
        const fileName = customName || `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        const filePath = folder.startsWith('/') ? `${folder.substring(1)}/${fileName}` : `${folder}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Supabase Storage Error:', uploadError);
          // Special hint if bucket might be missing
          if (uploadError.message?.includes('bucket not found')) {
            throw new Error(`Storage error: The bucket "${bucket}" does not exist. Please create it in Supabase.`);
          }
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);

        return publicUrl;
      } else if (isImage) {
        // --- ImageKit Storage ---
        const res = await imagekitService.upload(file, folder, customName);
        return res.url;
      } else {
        // Fallback to Supabase for unknown types
        const fileName = customName || `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, file);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
        return publicUrl;
      }
    } catch (error: any) {
      console.error('Unified Storage Service Error:', error);
      throw error;
    }
  },

  /**
   * Helper to upload multiple files resiliently.
   * Returns successful URLs and indicates if any failed.
   */
  async uploadMultiple(
    files: File[], 
    options: UploadOptions = {}
  ): Promise<{ results: string[]; hasFailures: boolean; failures: UploadFailure[] }> {
    const uploadPromises = files.map(file => this.upload(file, options));
    const settlements = await Promise.allSettled(uploadPromises);
    
    const results: string[] = [];
    let hasFailures = false;
    const failures: UploadFailure[] = [];

    settlements.forEach((s, index) => {
      if (s.status === 'fulfilled') {
        results.push(s.value);
      } else {
        const reason = s.reason instanceof Error ? s.reason.message : String(s.reason);
        const fileName = files[index]?.name || `file-${index + 1}`;
        console.error('Unified upload failure:', { fileName, reason });
        hasFailures = true;
        failures.push({ fileName, message: reason });
      }
    });

    return { results, hasFailures, failures };
  }
};
