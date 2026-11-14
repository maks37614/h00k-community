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

/** Build an authenticated profile/contact destination without treating a guest URL as an API action. */
export function communityProfileContactUrl(
  communityOrigin: string, ownerId: string, contact?: "friend" | "message",
): string {
  if (!publicPostId(ownerId)) throw new Error("Некоректний ідентифікатор профілю");
  const url = new URL(communityOrigin);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Некоректна адреса Community");
  const params = new URLSearchParams({ section: "profile", owner: ownerId });
  if (contact) params.set("contact", contact);
  url.hash = "community?" + params.toString();
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
  ).slice(0, 5).map(({ emoji, count }) => ({ emoji, count }));
}

export function publicProfileDate(value: unknown): string {
  if (typeof value !== "string") return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("uk-UA", { year: "numeric", month: "long" })
    : "";
}

export type PublicProfileDeepLink = {
  tab: "wall" | "articles" | "setups" | "statistics" | "about";
  postId: string | null;
  openChart: boolean;
};

/** Guest-facing query values select public pages, never grant access to content. */
export function publicProfileDeepLink(search: string): PublicProfileDeepLink {
  const params = new URLSearchParams(search);
  const requested = params.get("tab");
  const tab = requested === "hookchart" ? "setups"
    : requested === "about" ? "about"
    : requested === "articles" ? "articles"
    : requested === "statistics" ? "statistics" : "wall";
  const postId = publicPostId(params.get("post"));
  return { tab, postId, openChart: tab === "setups" && postId !== null && params.get("view") === "chart" };
}

/** Link directly to the public HookChart gallery, not a live market terminal. */
export function publicChartGalleryUrl(profileUrl: string): string {
  const url = new URL(profileUrl);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Некоректна адреса профілю");
  url.searchParams.delete("post");
  url.searchParams.delete("view");
  url.searchParams.set("tab", "hookchart");
  return url.toString();
}

/** Sharing a chart opens only an authorized saved public snapshot for that post. */
export function publicChartPostUrl(profileUrl: string, id: string): string {
  const url = new URL(publicPostUrl(profileUrl, id));
  url.searchParams.set("tab", "hookchart");
  url.searchParams.set("view", "chart");
  return url.toString();
}

/** Public educational post links stay within the already-authorized profile. */
export function publicArticleUrl(profileUrl: string, id: string): string {
  const url = new URL(publicPostUrl(profileUrl, id));
  url.searchParams.delete("view");
  url.searchParams.delete("comment");
  url.searchParams.set("tab", "articles");
  return url.toString();
}

/** Return to this trader's article collection without retaining post identity. */
export function publicArticlesUrl(profileUrl: string): string {
  const url = new URL(profileUrl);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Некоректна адреса профілю");
  url.searchParams.delete("view");
  url.searchParams.delete("comment");
  url.searchParams.delete("post");
  url.searchParams.set("tab", "articles");
  return url.toString();
}

/** Estimate reading time using only text already visible to anonymous readers. */
export function publicArticleReadMinutes(value: unknown): number {
  if (typeof value !== "string" || !value.trim()) return 1;
  const words = value.trim().split(/\s+/u).length;
  return Math.min(120, Math.max(1, Math.ceil(words / 200)));
}

export function publicArticleExcerpt(value: unknown, max = 180): string {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(/\s+/gu, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max).trimEnd() + "…";
}

/** A URL can focus only a valid public post/comment pair. */
export function publicCommentIdFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  if (!publicPostId(params.get("post")) || params.get("view") === "chart") return null;
  return publicPostId(params.get("comment"));
}

/** Stable guest permalink without chart-mode or previous tab parameters. */
export function publicCommentUrl(profileUrl: string, postId: string, commentId: string): string {
  if (!publicPostId(commentId)) throw new Error("Некоректна адреса коментаря");
  const url = new URL(publicPostUrl(profileUrl, postId));
  url.searchParams.delete("view");
  url.searchParams.delete("tab");
  url.searchParams.set("comment", commentId);
  return url.toString();
}
