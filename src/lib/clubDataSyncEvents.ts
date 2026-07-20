/** Cross-page sync for club ops data without full app reloads. */

export const CLUB_TASKS_CHANGED_EVENT = "club-tasks-changed";
export const HIRING_APPLICATION_UPDATED_EVENT = "hiring-application-updated";

export type ClubTasksChangedDetail = {
  clubId?: string;
  taskId?: string;
};

export type HiringApplicationUpdatedDetail = {
  clubId?: string;
  listingId?: string;
  applicationId?: string;
};

export function dispatchClubTasksChanged(detail: ClubTasksChangedDetail = {}): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CLUB_TASKS_CHANGED_EVENT, { detail }),
  );
}

export function dispatchHiringApplicationUpdated(
  detail: HiringApplicationUpdatedDetail = {},
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(HIRING_APPLICATION_UPDATED_EVENT, { detail }),
  );
}
