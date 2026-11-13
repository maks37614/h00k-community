/** Public pages construct navigation from server-provided trusted URLs only. */
export const PUBLIC_POST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function publicPostId(value: unknown): string | null {
  return typeof value === "string" && PUBLIC_POST_ID.test(value) ? value : null;
}

/** Keep a shareable public URL within the profile's own canonical domain. */
export function publicPostUrl(profileUrl: string, id: string): string {
  if (!publicPostId(id)) throw new Error("Некоректна адреса допису");
  const url = new URL(profileUrl);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Некоректна адреса профілю");
  url.searchParams.set("post", id);
  return url.toString();
}

/** A logged-in viewer is directed to the actual post, never just the profile tab. */
export function communityPostUrl(communityOrigin: string, id: string): string {
  if (!publicPostId(id)) throw new Error("Некоректна адреса допису");
  const url = new URL(communityOrigin);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Некоректна адреса Community");
  url.hash = "community?post=" + encodeURIComponent(id);
  return url.toString();
}

export type PublicReactionSummary = { emoji: string; count: number };

export function visibleReactionSummary(input: unknown): PublicReactionSummary[] {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is PublicReactionSummary =>
    !!item && typeof item.emoji === "string" && item.emoji.length <= 10 &&
    Number.isInteger(item.count) && item.count > 0 && item.count <= 1_000_000,
  ).slice(0, 5);
}

export function publicProfileDate(value: unknown): string {
  if (typeof value !== "string") return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("uk-UA", { year: "numeric", month: "long" })
    : "";
}
