import type { SupabaseClient } from "@supabase/supabase-js";

type InvoiceFileRef = {
  provider: string;
  bucket: string;
  object_key: string;
};

export async function removeInvoiceStorageObjects(supabase: SupabaseClient, files: InvoiceFileRef[]) {
  const pathsByBucket = new Map<string, string[]>();

  for (const file of files) {
    if (file.provider !== "supabase" || !file.bucket || !file.object_key) continue;
    const paths = pathsByBucket.get(file.bucket) ?? [];
    paths.push(file.object_key);
    pathsByBucket.set(file.bucket, paths);
  }

  for (const [bucket, paths] of pathsByBucket) {
    if (!paths.length) continue;
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) throw error;
  }
}
