/** Public discussion snapshots are read-only. Group only comments already returned
 * by the privacy-filtered endpoint; never fetch missing or private parents.
 * The backend stores replies as comments on the post with sourceItemId links. */
export type PublicThreadLink = { id: string; replyToId?: string | null };

export function groupPublicComments<T extends PublicThreadLink>(items: readonly T[]): {
  roots: T[];
  repliesByRoot: Map<string, T[]>;
} {
  const byId = new Map(items.map(item => [item.id, item]));
  const roots: T[] = [];
  const repliesByRoot = new Map<string, T[]>();
  for (const comment of items) {
    let parent = comment;
    const seen = new Set<string>([comment.id]);
    let cycle = false;
    while (parent.replyToId && byId.has(parent.replyToId)) {
      if (seen.has(parent.replyToId)) { cycle = true; break; }
      seen.add(parent.replyToId);
      parent = byId.get(parent.replyToId)!;
    }
    if (cycle || parent.id === comment.id) {
      roots.push(comment);
    } else {
      const replies = repliesByRoot.get(parent.id) ?? [];
      replies.push(comment);
      repliesByRoot.set(parent.id, replies);
    }
  }
  return { roots, repliesByRoot };
}

/** Share only the explicitly public, canonical post URL. Telegram is optional. */
export function publicTelegramShareUrl(publicUrl: string, title: string): string {
  const url = new URL(publicUrl);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Некоректна публічна адреса");
  const query = new URLSearchParams({ url: url.toString(), text: title.slice(0, 150) });
  return "https://t.me/share/url?" + query.toString();
}
