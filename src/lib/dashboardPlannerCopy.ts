/**
 * User-facing description for the dashboard This Month / This Week planner.
 * Only assigned tasks and club events are aggregated — club_meetings is not
 * included, so copy must not reference meetings.
 */
export function dashboardPlannerDescription(calendarView: "week" | "month"): string {
  if (calendarView === "week") {
    return "Your assigned tasks and your clubs' events for the week.";
  }
  return "Your assigned tasks and your clubs' events for the month.";
}
