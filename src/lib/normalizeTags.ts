/**
 * Normalize tags from Supabase which may arrive as:
 *   - string[] → use as-is
 *   - string   → split by commas and trim
 *   - null/undefined → empty array
 */
export function normalizeTags(
  tags: string[] | string | null | undefined,
): string[] {
  if (Array.isArray(tags)) return tags;
  if (typeof tags === "string")
    return tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  return [];
}
