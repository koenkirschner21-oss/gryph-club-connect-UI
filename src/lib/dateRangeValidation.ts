/** Validate an optional start/end date (yyyy-mm-dd) range. */
export function getDateRangeError(start: string, end: string): string | null {
  if (!start.trim() || !end.trim()) return null;
  if (end < start) {
    return "End date must be on or after the start date.";
  }
  return null;
}
