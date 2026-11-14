/** Pure mobile swipe navigation; no native-scroll hijack or market listeners. */
export type CommunityMobilePane = "profile" | "feed" | "sessions";
const ORDER: readonly CommunityMobilePane[] = ["profile", "feed", "sessions"];

export function swipeCommunityPane(
  pane: CommunityMobilePane,
  deltaX: number,
  deltaY: number,
  durationMs: number,
): CommunityMobilePane {
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY) ||
      !Number.isFinite(durationMs) || durationMs > 1300 || durationMs < 0 ||
      Math.abs(deltaX) < 75 || Math.abs(deltaX) < Math.abs(deltaY) * 1.6)
    return pane;
  const index = ORDER.indexOf(pane);
  if (index < 0) return "feed";
  const nextIndex = Math.max(0, Math.min(ORDER.length - 1, index + (deltaX < 0 ? 1 : -1)));
  return ORDER[nextIndex];
}
