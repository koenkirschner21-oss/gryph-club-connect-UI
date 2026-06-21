/** Derive display initials from profile name, falling back to email. */
export function getProfileInitials(fullName: string, email?: string | null): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length > 0) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (email ?? "GC").slice(0, 2).toUpperCase();
}
