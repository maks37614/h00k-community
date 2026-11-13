/** Quote-based replies remain comments on the post, not nested reply rows.
 * The existing Community API resolves sourceItemId with visibility checks.
 */
export type ReplySource = {
  id: string;
  displayName: string;
  text: string;
  audience: string;
};

export const COMMENT_AUDIENCES = ["private", "friends", "public"] as const;
export type CommentAudience = typeof COMMENT_AUDIENCES[number];

export function normalizeReplyAudience(value: unknown): CommentAudience {
  return value === "public" || value === "friends" ? value : "private";
}

export function replyAudienceOptions(source?: ReplySource): CommentAudience[] {
  if (!source) return [...COMMENT_AUDIENCES];
  const maximum = normalizeReplyAudience(source.audience);
  return COMMENT_AUDIENCES.slice(0, COMMENT_AUDIENCES.indexOf(maximum) + 1);
}

export function canShareReplyWithAudience(
  source: ReplySource | undefined,
  audience: string,
): boolean {
  return replyAudienceOptions(source).includes(audience as CommentAudience);
}

/** Only a small quote is displayed in the interface; full text is not copied. */
export function replyPreviewText(value: unknown): string {
  if (typeof value !== "string") return "";
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > 180 ? flat.slice(0, 179) + "…" : flat;
}

export function replyBody(
  text: string,
  photos: string[],
  source?: ReplySource,
): { text: string; photos: string[]; sourceItemId?: string } {
  return {
    text,
    photos,
    ...(source ? { sourceItemId: source.id } : {}),
  };
}
