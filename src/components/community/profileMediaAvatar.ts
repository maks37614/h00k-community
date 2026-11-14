/** Owner-only display URL; never resolves private media to an unauthenticated browser. */
export function ownerAvatarUrl(community: unknown): string | null {
  if (!community || typeof community !== "object" || Array.isArray(community))
    return null;
  const id = (community as Record<string, unknown>).avatarMediaId;
  if (typeof id !== "string" || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id))
    return null;
  return "/api/community/media/" + encodeURIComponent(id);
}
