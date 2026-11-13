/** Rendering helpers for the authenticated, server-filtered Community inbox. */
export type CommunityNotice = {
  id: string;
  type: string;
  created_at: string;
  read_at?: string | null;
  body?: {
    text?: unknown;
    window?: unknown;
    used?: unknown;
    limit?: unknown;
    currency?: unknown;
    friendId?: unknown;
    postId?: unknown;
    awardType?: unknown;
  } | null;
};

export type NoticeFilter = "unread" | "all";
export type ChatNotice = {
  id: string;
  title?: string | null;
  peer_name?: string | null;
  is_group?: boolean;
  unread_count?: number | string | null;
  muted?: boolean;
};
const CHAT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOCIAL_TYPES = new Set(["friend_request", "friend_accepted", "comment", "award"]);

export function visibleCommunityNotices(items: CommunityNotice[], filter: NoticeFilter, socialEnabled = true): CommunityNotice[] {
  const included = socialEnabled ? items : items.filter(notice => !SOCIAL_TYPES.has(notice.type));
  return filterCommunityNotices(included, filter);
}

/** Existing authorized /conversations response; no message contents or extra event rows. */
export function unreadChatNotices(items: unknown, limit = 8): Array<ChatNotice & { count: number; displayName: string }> {
  if (!Array.isArray(items)) return [];
  return items.filter((item): item is ChatNotice =>
    item !== null && typeof item === "object" &&
    item.muted !== true && CHAT_UUID.test(String(item.id ?? "")))
    .map(item => {
      const count = Number(item.unread_count);
      return {
        id: item.id,
        is_group: item.is_group === true,
        count: Number.isFinite(count) ? Math.max(0, Math.min(100, Math.floor(count))) : 0,
        displayName: item.is_group
          ? (typeof item.title === "string" && item.title.trim() ? item.title.slice(0, 100) : "Групова розмова")
          : (typeof item.peer_name === "string" && item.peer_name.trim() ? item.peer_name.slice(0, 100) : "Особистий діалог"),
      };
    })
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, Math.max(0, Math.min(30, Math.floor(limit))));
}

export function unreadNoticeCount(items: CommunityNotice[]): number {
  return items.filter((notice) => !notice.read_at).length;
}

export function filterCommunityNotices(
  items: CommunityNotice[],
  filter: NoticeFilter,
): CommunityNotice[] {
  return filter === "unread" ? items.filter((notice) => !notice.read_at) : items;
}

export function describeCommunityNotice(notice: CommunityNotice): {
  title: string;
  description: string;
  isImportant: boolean;
} {
  const body = notice.body;
  const safeText =
    typeof body?.text === "string" ? body.text.slice(0, 1000) : "";
  if (notice.type === "friend_request") {
    return { title: "Нова заявка у друзі",
      description: "Користувач хоче додати вас у друзі. Перевірте заявку перед прийняттям.",
      isImportant: false };
  }
  if (notice.type === "friend_accepted") {
    return { title: "Запит у друзі прийнято",
      description: "Вашу заявку прийнято. Тепер можна спілкуватися в Community.",
      isImportant: false };
  }
  if (notice.type === "comment") {
    return { title: "Нове обговорення",
      description: "Хтось залишив публічний коментар до вашого допису або відповів на ваш коментар.",
      isImportant: false };
  }
  if (notice.type === "award") {
    const names: Record<string,string> = { thanks: "Подяка", analysis: "Крутий аналіз", top_trader: "Топ трейдер" };
    const label = typeof body?.awardType === "string" ? names[body.awardType] : undefined;
    return { title: "Нова нагорода",
      description: label ? "Ви отримали нагороду: " + label + "." : "Ви отримали нову нагороду Community.",
      isImportant: false };
  }
  if (notice.type === "risk") {
    const parts = [body?.used, body?.limit, body?.currency];
    const hasValues = parts.every(
      (value) => typeof value === "string" || typeof value === "number",
    );
    const windowText =
      typeof body?.window === "string" ? body.window.slice(0, 50) : "";
    return {
      title: "Особистий ліміт збитку",
      description:
        hasValues
          ? `Досягнуто ліміту${windowText ? " · " + windowText : ""}: ${body?.used} / ${body?.limit} ${body?.currency}. h00k не зупиняє торгівлю на біржі.`
          : safeText || "Перевірте ліміти ризику й актуальність імпортованих даних.",
      isImportant: true,
    };
  }
  if (notice.type === "security") {
    return {
      title: "Безпека акаунта",
      description: safeText || "Перевірте події безпеки у своєму акаунті.",
      isImportant: true,
    };
  }
  return {
    title: "Подія Community",
    description: safeText || "Нове сповіщення у вашій спільноті.",
    isImportant: false,
  };
}

export function safeNoticeDate(input: string): string {
  const date = new Date(input);
  return Number.isNaN(date.getTime())
    ? "Час невідомий"
    : date.toLocaleString("uk-UA");
}

const PUBLIC_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type CommunityNoticeDestination =
  | { section: "friends" }
  | { section: "feed"; postId: string }
  | { section: "chats"; conversationId: string };

/** Only known server-defined destinations may be opened from an inbox item. */
export function communityNoticeDestination(notice: CommunityNotice): CommunityNoticeDestination | null {
  if (notice.type === "friend_request" || notice.type === "friend_accepted")
    return { section: "friends" };
  if (notice.type === "comment" &&
    typeof notice.body?.postId === "string" && PUBLIC_UUID.test(notice.body.postId))
    return { section: "feed", postId: notice.body.postId };
  return null;
}
