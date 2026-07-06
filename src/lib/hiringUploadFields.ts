import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CLUB_DOCUMENTS_BUCKET,
  downloadClubDocumentsFile,
} from "./clubDocumentsStorage";

export type HiringUploadSlot = "resume" | "portfolio" | "other";
export type HiringUploadSetting = "required" | "optional" | "not_included";

export interface HiringUploadFields {
  resume: HiringUploadSetting;
  portfolio: HiringUploadSetting;
  other: HiringUploadSetting;
}

export const DEFAULT_HIRING_UPLOAD_FIELDS: HiringUploadFields = {
  resume: "not_included",
  portfolio: "not_included",
  other: "not_included",
};

export const HIRING_UPLOAD_SLOTS: HiringUploadSlot[] = ["resume", "portfolio", "other"];

export const HIRING_UPLOAD_SLOT_LABELS: Record<HiringUploadSlot, string> = {
  resume: "Resume",
  portfolio: "Portfolio",
  other: "Other File",
};

export const HIRING_UPLOAD_QUESTION_IDS: Record<HiringUploadSlot, string> = {
  resume: "upload_resume",
  portfolio: "upload_portfolio",
  other: "upload_other",
};

export const HIRING_UPLOAD_SETTING_OPTIONS: {
  value: HiringUploadSetting;
  label: string;
}[] = [
  { value: "not_included", label: "Not included" },
  { value: "optional", label: "Optional" },
  { value: "required", label: "Required" },
];

export { CLUB_DOCUMENTS_BUCKET } from "./clubDocumentsStorage";
export const MAX_HIRING_FILE_BYTES = 52_428_800;

const VALID_SETTINGS = new Set<HiringUploadSetting>([
  "required",
  "optional",
  "not_included",
]);

function normalizeSetting(value: unknown): HiringUploadSetting {
  if (typeof value === "string" && VALID_SETTINGS.has(value as HiringUploadSetting)) {
    return value as HiringUploadSetting;
  }
  return "not_included";
}

export function parseHiringUploadFields(raw: unknown): HiringUploadFields {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_HIRING_UPLOAD_FIELDS };
  }

  const row = raw as Record<string, unknown>;
  return {
    resume: normalizeSetting(row.resume),
    portfolio: normalizeSetting(row.portfolio),
    other: normalizeSetting(row.other),
  };
}

export function activeUploadSlots(
  fields: HiringUploadFields,
): { slot: HiringUploadSlot; setting: "required" | "optional" }[] {
  return HIRING_UPLOAD_SLOTS.flatMap((slot) => {
    const setting = fields[slot];
    if (setting === "required" || setting === "optional") {
      return [{ slot, setting }];
    }
    return [];
  });
}

export function isHiringFileQuestionId(questionId: string): boolean {
  return (
    questionId === HIRING_UPLOAD_QUESTION_IDS.resume ||
    questionId === HIRING_UPLOAD_QUESTION_IDS.portfolio ||
    questionId === HIRING_UPLOAD_QUESTION_IDS.other
  );
}

export function hiringFileQuestionLabel(questionId: string): string {
  if (questionId === HIRING_UPLOAD_QUESTION_IDS.resume) {
    return HIRING_UPLOAD_SLOT_LABELS.resume;
  }
  if (questionId === HIRING_UPLOAD_QUESTION_IDS.portfolio) {
    return HIRING_UPLOAD_SLOT_LABELS.portfolio;
  }
  if (questionId === HIRING_UPLOAD_QUESTION_IDS.other) {
    return HIRING_UPLOAD_SLOT_LABELS.other;
  }
  return "Uploaded file";
}

export interface HiringUploadedFileMeta {
  url: string;
  name: string;
  type?: string;
  size?: number;
}

export async function uploadHiringApplicationFile(
  supabase: SupabaseClient,
  clubId: string,
  listingId: string,
  applicantId: string,
  file: File,
): Promise<HiringUploadedFileMeta | null> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${clubId}/hiring-applications/${applicantId}/${listingId}/${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage
    .from(CLUB_DOCUMENTS_BUCKET)
    .upload(path, file, { upsert: false });

  if (error) {
    console.error("Hiring application upload failed:", error.message);
    return null;
  }

  return {
    url: path,
    name: file.name,
    type: file.type || undefined,
    size: file.size,
  };
}

export async function downloadHiringApplicationFile(
  supabase: SupabaseClient,
  fileReference: string,
  fileName: string,
): Promise<boolean> {
  return downloadClubDocumentsFile(supabase, fileReference, fileName);
}
