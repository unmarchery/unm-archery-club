import "server-only";
import { createAdminClient } from "./supabase/admin";

// Payment receipts and the club's QR live in a private Supabase Storage bucket with no
// storage policies, so only this server code (secret key) can touch them. Callers check
// permissions first; archers only ever upload into their own folder.
const BUCKET = "receipts";
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

// Returns a message when the file can't be used, or null when it's fine.
export function uploadProblem(file: FormDataEntryValue | null, allowPdf = true) {
  if (!(file instanceof File) || file.size === 0) return "Add a picture first.";
  if (!EXTENSIONS[file.type] || (!allowPdf && file.type === "application/pdf")) {
    return allowPdf ? "Use a JPG, PNG or PDF file. A screenshot works best." : "Use a JPG or PNG picture.";
  }
  if (file.size > MAX_UPLOAD_BYTES) return "That file is over 4 MB. Try a screenshot instead.";
  return null;
}

export async function uploadFile(folder: string, file: File) {
  const path = `${folder}/${Date.now()}-${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
  const { error } = await createAdminClient().storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (error) {
    console.error("Upload failed:", error.message);
    return null;
  }
  return path;
}

export async function removeFile(path: string) {
  await createAdminClient().storage.from(BUCKET).remove([path]);
}

// Short-lived links for showing private files on a page, keyed by path.
export async function signedUrls(paths: (string | null | undefined)[], seconds = 900) {
  const wanted = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (wanted.length === 0) return {} as Record<string, string>;
  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUrls(wanted, seconds);
  if (error) console.error("Signing links failed:", error.message);
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl]));
}
