import type { SupabaseClient } from "@supabase/supabase-js";

export type PublishClubMissingItem = {
  id: string;
  label: string;
};

export type PublishClubProfileResult =
  | {
      ok: true;
      outcome: "published" | "already_published";
      clubId: string;
      claimStatus: string;
      isPublished: boolean;
      setupCompleted: boolean;
    }
  | {
      ok: false;
      outcome: "incomplete";
      missingItems: PublishClubMissingItem[];
    }
  | {
      ok: false;
      outcome: "forbidden" | "invalid_state" | "error";
      error: string;
    };

export class PublishClubValidationError extends Error {
  readonly missingItems: PublishClubMissingItem[];

  constructor(missingItems: PublishClubMissingItem[]) {
    super(formatPublishMissingItems(missingItems));
    this.name = "PublishClubValidationError";
    this.missingItems = missingItems;
  }
}

export function formatPublishMissingItems(
  items: PublishClubMissingItem[],
): string {
  if (items.length === 0) {
    return "Complete all setup checklist items before publishing.";
  }
  if (items.length === 1) {
    return `Complete before publishing: ${items[0].label}`;
  }
  return `Complete before publishing:\n${items.map((item) => `• ${item.label}`).join("\n")}`;
}

function mapPublishClubRpcError(message: string): string {
  if (message.includes("not_authenticated")) {
    return "You must be signed in to publish this club.";
  }
  if (message.includes("club_not_found")) {
    return "This club could not be found.";
  }
  return "Could not publish your club. Please try again.";
}

function parseMissingItems(raw: unknown): PublishClubMissingItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id : "";
      const label = typeof row.label === "string" ? row.label : "";
      if (!id || !label) return null;
      return { id, label };
    })
    .filter((item): item is PublishClubMissingItem => item !== null);
}

export async function publishClubProfile(
  supabase: SupabaseClient,
  clubId: string,
): Promise<PublishClubProfileResult> {
  const { data, error } = await supabase.rpc("publish_club_profile", {
    p_club_id: clubId,
  });

  if (error) {
    console.error("Failed to publish club profile:", error.message);
    return { ok: false, outcome: "error", error: mapPublishClubRpcError(error.message) };
  }

  const payload = (data ?? {}) as {
    outcome?: string;
    club_id?: string;
    claim_status?: string;
    is_published?: boolean;
    setup_completed?: boolean;
    missing_items?: unknown;
    error?: string;
  };

  const outcome = payload.outcome;

  if (outcome === "incomplete") {
    return {
      ok: false,
      outcome: "incomplete",
      missingItems: parseMissingItems(payload.missing_items),
    };
  }

  if (outcome === "forbidden") {
    return {
      ok: false,
      outcome: "forbidden",
      error: "You do not have permission to publish this club.",
    };
  }

  if (outcome === "invalid_state") {
    return {
      ok: false,
      outcome: "invalid_state",
      error: "This club is not ready to publish yet.",
    };
  }

  if (
    (outcome === "published" || outcome === "already_published") &&
    typeof payload.club_id === "string"
  ) {
    return {
      ok: true,
      outcome,
      clubId: payload.club_id,
      claimStatus: (payload.claim_status as string) ?? "active",
      isPublished: payload.is_published === true,
      setupCompleted: payload.setup_completed === true,
    };
  }

  return {
    ok: false,
    outcome: "error",
    error: "Could not publish your club. Please try again.",
  };
}
