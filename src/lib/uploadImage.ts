import { supabase } from "./supabaseClient";

/**
 * Upload an image file to a Supabase Storage bucket and return its public URL.
 *
 * @param bucket  – Storage bucket name (e.g. "profile-pictures", "club-logos", "club-banners")
 * @param path    – Object path inside the bucket (e.g. "userId.png")
 * @param file    – The File object to upload
 * @returns The public URL string, or null on error.
 */
export async function uploadImage(
  bucket: string,
  path: string,
  file: File,
): Promise<string | null> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true });

  if (error) {
    console.error(`Upload to ${bucket}/${path} failed:`, error.message);
    return null;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);

  return publicUrl;
}
