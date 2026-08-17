// @ts-nocheck
/**
 * ImageKit Service for unified image uploads
 * Uses a Supabase Edge Function as a secure server-side upload proxy.
 */
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../utils/supabase';
import supabase from '../utils/supabase';

export interface ImageKitUploadResponse {
  url: string;
  fileId: string;
  name: string;
  size: number;
  filePath: string;
  thumbnailUrl: string;
}

export const imagekitService = {
  /**
   * Uploads a file to ImageKit using a signed request
   * @param file The File object to upload
   * @param folder Destination folder in ImageKit (e.g., '/properties')
   * @param fileName Optional custom file name
   */
  async upload(
    file: File, 
    folder: string = '/general', 
    fileName?: string
  ): Promise<ImageKitUploadResponse> {
    try {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Missing Supabase configuration for upload proxy');
      }

      const { data: { session } } = await supabase.auth.getSession();

      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', fileName || `${Date.now()}_${file.name}`);
      formData.append('folder', folder);

      console.log('Uploading to ImageKit via Edge Function...', { folder, fileName: fileName || file.name });
      const response = await fetch(`${SUPABASE_URL}/functions/v1/imagekit-auth`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${SUPABASE_ANON_KEY}`,
          'x-client-info': 'supabase-js-web',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('ImageKit Upload Proxy Error:', response.status, errorData);
        throw new Error(errorData?.error || errorData?.message || errorData?.details || `ImageKit upload failed (${response.status})`);
      }

      const result = await response.json();
      console.log('ImageKit Upload Success:', result.url);
      return result as ImageKitUploadResponse;
    } catch (error) {
      console.error('ImageKit Upload Service Error:', error);
      throw error;
    }
  },

  /**
   * Helper to upload multiple files resiliently
   * Returns successful uploads and indicates if any failed
   */
  async uploadMultiple(
    files: File[], 
    folder: string = '/general'
  ): Promise<{ results: ImageKitUploadResponse[]; hasFailures: boolean }> {
    const uploadPromises = files.map(file => this.upload(file, folder));
    const settlements = await Promise.allSettled(uploadPromises);
    
    const results: ImageKitUploadResponse[] = [];
    let hasFailures = false;

    settlements.forEach((s, i) => {
      if (s.status === 'fulfilled') {
        results.push(s.value);
      } else {
        hasFailures = true;
        console.error(`Upload failed for file ${files[i].name}:`, s.reason);
      }
    });

    return { results, hasFailures };
  }
};
