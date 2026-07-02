import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export const WORKSPACE_SECTIONS = [
  "announcements",
  "tasks",
  "events",
  "meetings",
] as const;

export type WorkspaceSection = (typeof WORKSPACE_SECTIONS)[number];

export type WorkspaceSectionViews = Partial<Record<WorkspaceSection, string>>;

function isWorkspaceSection(value: string): value is WorkspaceSection {
  return (WORKSPACE_SECTIONS as readonly string[]).includes(value);
}

export async function fetchWorkspaceSectionViews(
  client: SupabaseClient,
  clubId: string,
  userId: string,
): Promise<WorkspaceSectionViews> {
  const { data, error } = await client
    .from("workspace_section_views")
    .select("section, last_viewed_at")
    .eq("club_id", clubId)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to load workspace section views:", error.message);
    return {};
  }

  const views: WorkspaceSectionViews = {};
  for (const row of data ?? []) {
    const section = row.section as string;
    if (!isWorkspaceSection(section)) continue;
    views[section] = row.last_viewed_at as string;
  }
  return views;
}

export async function markWorkspaceSectionViewed(
  clubId: string,
  section: WorkspaceSection,
  client: SupabaseClient = supabase,
): Promise<string | null> {
  const { data, error } = await client.rpc("upsert_workspace_section_view", {
    p_club_id: clubId,
    p_section: section,
  });

  if (error) {
    console.error(
      `Failed to mark workspace section viewed (${section}):`,
      error.message,
    );
    return null;
  }

  return (data as string | null) ?? new Date().toISOString();
}

export function sectionFromWorkspacePath(
  pathname: string,
  workspaceBasePath: string,
): WorkspaceSection | null {
  if (pathname.startsWith(`${workspaceBasePath}/announcements`)) {
    return "announcements";
  }
  if (pathname.startsWith(`${workspaceBasePath}/tasks`)) {
    return "tasks";
  }
  if (pathname.startsWith(`${workspaceBasePath}/events`)) {
    return "events";
  }
  if (pathname.startsWith(`${workspaceBasePath}/meetings`)) {
    return "meetings";
  }
  return null;
}
