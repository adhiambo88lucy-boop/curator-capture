import { supabase } from "@/integrations/supabase/client";
import { MEDIA_BUCKET } from "@/lib/media";

const cache = new Map<string, { url: string; expires: number }>();

export async function getSignedMediaUrl(path: string): Promise<string | null> {
  const now = Date.now();
  const hit = cache.get(path);
  if (hit && hit.expires > now + 60_000) return hit.url;
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, 3600);
  if (error || !data) return null;
  cache.set(path, { url: data.signedUrl, expires: now + 3600_000 });
  return data.signedUrl;
}

export async function getSignedMediaUrls(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    paths.map(async (p) => {
      const url = await getSignedMediaUrl(p);
      if (url) out[p] = url;
    }),
  );
  return out;
}
