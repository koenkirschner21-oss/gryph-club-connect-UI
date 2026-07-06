import type { SupabaseClient } from "@supabase/supabase-js";

export const CLUB_DOCUMENTS_BUCKET = "club-documents";
export const DEFAULT_CLUB_DOCUMENTS_SIGNED_URL_TTL_SECONDS = 3600;

const PUBLIC_URL_MARKERS = [
  `/storage/v1/object/public/${CLUB_DOCUMENTS_BUCKET}/`,
  `/storage/v1/object/sign/${CLUB_DOCUMENTS_BUCKET}/`,
];

/** Resolve a stored file reference (legacy public URL or storage path) to object path. */
export function storagePathFromClubDocumentsReference(
  fileReference: string,
): string | null {
  const trimmed = fileReference.trim();
  if (!trimmed) return null;

  for (const marker of PUBLIC_URL_MARKERS) {
    const idx = trimmed.indexOf(marker);
    if (idx !== -1) {
      const path = trimmed.slice(idx + marker.length).split("?")[0] ?? "";
      return decodeURIComponent(path);
    }
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return null;
  }

  return trimmed.replace(/^\/+/, "");
}

export async function resolveClubDocumentsAccessUrl(
  supabase: SupabaseClient,
  fileReference: string,
  expiresIn = DEFAULT_CLUB_DOCUMENTS_SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const path = storagePathFromClubDocumentsReference(fileReference);
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(CLUB_DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.error("Failed to create signed storage URL:", error.message);
    return null;
  }

  return data.signedUrl ?? null;
}

export async function downloadClubDocumentsFile(
  supabase: SupabaseClient,
  fileReference: string,
  downloadName: string,
): Promise<boolean> {
  const accessUrl = await resolveClubDocumentsAccessUrl(supabase, fileReference);
  if (!accessUrl) return false;

  try {
    const response = await fetch(accessUrl);
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = downloadName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
    return true;
  } catch {
    return false;
  }
}
