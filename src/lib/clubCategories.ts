/** Canonical club categories (matches club settings + Explore filter values). */
export const CLUB_CATEGORY_TAXONOMY = [
  "Academic",
  "Arts",
  "Athletics",
  "Cultural",
  "Engineering",
  "Environmental",
  "Health",
  "Media",
  "Political",
  "Recreation",
  "Social",
  "Technology",
  "Volunteer",
  "Other",
] as const;

export type ClubCategory = (typeof CLUB_CATEGORY_TAXONOMY)[number];

/** Categories shown on create/edit club forms (full taxonomy). */
export const CLUB_CATEGORY_OPTIONS: readonly ClubCategory[] = CLUB_CATEGORY_TAXONOMY;

/** Build filter options in taxonomy order, then any legacy/extra values alphabetically. */
export function clubCategoryFilterOptions(observed: Iterable<string>): string[] {
  const observedSet = new Set(
    [...observed].map((value) => value.trim()).filter(Boolean),
  );
  if (observedSet.size === 0) return [];

  const fromTaxonomy = CLUB_CATEGORY_TAXONOMY.filter((category) =>
    observedSet.has(category),
  );
  const taxonomySet = new Set<string>(CLUB_CATEGORY_TAXONOMY);
  const extras = [...observedSet]
    .filter((category) => !taxonomySet.has(category))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  return [...fromTaxonomy, ...extras];
}
