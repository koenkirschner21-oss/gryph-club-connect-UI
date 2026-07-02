import type { SupabaseClient } from "@supabase/supabase-js";

/** Keys exposed in PersonalSettingsPage / MyMembershipPanel toggles. */
export const NOTIFICATION_PREFERENCE_KEYS = [
  "announcements",
  "events",
  "task_assignments",
  "task_deadline_reminders",
  "chat_messages",
  "chat_mentions",
] as const;

export type NotificationPreferenceKey = (typeof NOTIFICATION_PREFERENCE_KEYS)[number];

export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  announcements: true,
  events: true,
  task_assignments: true,
  task_deadline_reminders: true,
  chat_messages: true,
  chat_mentions: true,
};

/**
 * Categories enforced on send paths in this batch. Other toggles exist in Settings
 * but stay always-on until their send paths are wired to a preference key.
 */
const ENFORCED_BELL_TYPE_TO_PREFERENCE: Partial<
  Record<string, NotificationPreferenceKey>
> = {
  mention: "chat_mentions",
  direct_message: "chat_messages",
};

const ENFORCED_INBOX_TYPE_TO_PREFERENCE: Partial<
  Record<string, NotificationPreferenceKey>
> = {};

export function mergeNotificationPreferences(
  raw: Record<string, unknown> | null | undefined,
): NotificationPreferences {
  const merged = { ...DEFAULT_NOTIFICATION_PREFERENCES };
  if (!raw || typeof raw !== "object") return merged;
  for (const key of NOTIFICATION_PREFERENCE_KEYS) {
    if (typeof raw[key] === "boolean") {
      merged[key] = raw[key];
    }
  }
  return merged;
}

/** Opt-out model: only explicit `false` suppresses; missing/null prefs notify. */
export function isPreferenceExplicitlyDisabled(
  raw: Record<string, unknown> | null | undefined,
  key: NotificationPreferenceKey,
): boolean {
  return raw != null && typeof raw === "object" && raw[key] === false;
}

export function preferenceKeyForBellType(
  type: string,
): NotificationPreferenceKey | null {
  return ENFORCED_BELL_TYPE_TO_PREFERENCE[type] ?? null;
}

export function preferenceKeyForInboxType(
  type: string,
): NotificationPreferenceKey | null {
  return ENFORCED_INBOX_TYPE_TO_PREFERENCE[type] ?? null;
}

export function shouldDeliverBellNotification(
  rawPrefs: Record<string, unknown> | null | undefined,
  type: string,
): boolean {
  const key = preferenceKeyForBellType(type);
  if (!key) return true;
  return !isPreferenceExplicitlyDisabled(rawPrefs, key);
}

export function shouldDeliverInboxMessage(
  rawPrefs: Record<string, unknown> | null | undefined,
  type: string,
): boolean {
  const key = preferenceKeyForInboxType(type);
  if (!key) return true;
  return !isPreferenceExplicitlyDisabled(rawPrefs, key);
}

export async function fetchNotificationPreferencesByUserId(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, Record<string, unknown> | null>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const map = new Map<string, Record<string, unknown> | null>();
  if (uniqueIds.length === 0) return map;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, notification_preferences")
    .in("id", uniqueIds);

  if (error) {
    console.error("Failed to load notification preferences:", error.message);
    return map;
  }

  for (const row of data ?? []) {
    const id = row.id as string;
    const prefs = row.notification_preferences as Record<string, unknown> | null;
    map.set(id, prefs);
  }

  return map;
}
