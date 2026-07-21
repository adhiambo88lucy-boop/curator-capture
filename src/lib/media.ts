import { supabase } from "@/integrations/supabase/client";

export const MEDIA_BUCKET = "product-media";

export async function uploadMedia(file: File, productId: string, colourId: string) {
  const ext = file.name.split(".").pop() || "bin";
  const path = `${productId}/${colourId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

export async function signedUrl(path: string, expiresSeconds = 3600) {
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(path, expiresSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeMedia(path: string) {
  await supabase.storage.from(MEDIA_BUCKET).remove([path]);
}
