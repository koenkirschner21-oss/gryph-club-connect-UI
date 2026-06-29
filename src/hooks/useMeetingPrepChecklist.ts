import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuthContext } from "../context/useAuthContext";

export const DEFAULT_MEETING_PREP_ITEMS = [
  {
    itemKey: "review_open_tasks",
    label: "Review my open tasks",
    sortOrder: 0,
  },
  {
    itemKey: "check_assigned_tasks",
    label: "Check tasks I assigned",
    sortOrder: 1,
  },
  {
    itemKey: "review_rsvps",
    label: "Review upcoming event RSVPs",
    sortOrder: 2,
  },
  {
    itemKey: "prepare_update",
    label: "Prepare one update for the team",
    sortOrder: 3,
  },
  {
    itemKey: "add_questions",
    label: "Add any questions for discussion",
    sortOrder: 4,
  },
] as const;

export interface MeetingPrepItem {
  id: string;
  itemKey: string;
  label: string;
  isChecked: boolean;
  sortOrder: number;
  convertedTaskId?: string;
}

export function resolveMeetingPrepKey(
  nextMeetingEvent?: { id: string; occurrenceDate: string } | null,
  meetingSchedule?: string | null,
): string | null {
  if (nextMeetingEvent) {
    return `${nextMeetingEvent.id}:${nextMeetingEvent.occurrenceDate}`;
  }
  const schedule = meetingSchedule?.trim();
  if (schedule) return `schedule:${schedule}`;
  return null;
}

export function useMeetingPrepChecklist(
  clubId: string | undefined,
  meetingKey: string | null,
) {
  const { user } = useAuthContext();
  const [items, setItems] = useState<MeetingPrepItem[]>([]);
  const [loading, setLoading] = useState(false);

  const seedDefaults = useCallback(async () => {
    if (!clubId || !user?.id || !meetingKey) return;

    const rows = DEFAULT_MEETING_PREP_ITEMS.map((item) => ({
      club_id: clubId,
      user_id: user.id,
      meeting_key: meetingKey,
      item_key: item.itemKey,
      label: item.label,
      sort_order: item.sortOrder,
      is_checked: false,
    }));

    await supabase.from("meeting_prep_items").upsert(rows, {
      onConflict: "club_id,user_id,meeting_key,item_key",
      ignoreDuplicates: true,
    });
  }, [clubId, meetingKey, user?.id]);

  const loadItems = useCallback(async () => {
    if (!clubId || !user?.id || !meetingKey) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    await seedDefaults();

    const { data, error } = await supabase
      .from("meeting_prep_items")
      .select("id, item_key, label, is_checked, sort_order, converted_task_id")
      .eq("club_id", clubId)
      .eq("user_id", user.id)
      .eq("meeting_key", meetingKey)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Failed to load meeting prep items:", error.message);
      setItems([]);
    } else {
      setItems(
        (data ?? []).map((row) => ({
          id: row.id as string,
          itemKey: row.item_key as string,
          label: row.label as string,
          isChecked: Boolean(row.is_checked),
          sortOrder: (row.sort_order as number) ?? 0,
          convertedTaskId: (row.converted_task_id as string) ?? undefined,
        })),
      );
    }
    setLoading(false);
  }, [clubId, meetingKey, seedDefaults, user?.id]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const toggleItem = useCallback(
    async (itemId: string, checked: boolean) => {
      const { error } = await supabase
        .from("meeting_prep_items")
        .update({ is_checked: checked, updated_at: new Date().toISOString() })
        .eq("id", itemId);

      if (error) {
        console.error("Failed to update prep item:", error.message);
        return false;
      }

      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, isChecked: checked } : item,
        ),
      );
      return true;
    },
    [],
  );

  const markConverted = useCallback(async (itemId: string, taskId: string) => {
    const { error } = await supabase
      .from("meeting_prep_items")
      .update({
        converted_task_id: taskId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId);

    if (error) {
      console.error("Failed to link converted task:", error.message);
      return false;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, convertedTaskId: taskId } : item,
      ),
    );
    return true;
  }, []);

  return {
    items,
    loading,
    toggleItem,
    markConverted,
    refresh: loadItems,
  };
}
