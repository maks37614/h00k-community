import React, { useEffect, useId, useRef, useState } from "react";
import {
  Bell,
  Check,
  CircleAlert,
  Inbox,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { apiJson } from "../../utils/apiFetch";
import {
  describeCommunityNotice,
  communityNoticeDestination,
  visibleCommunityNotices,
  unreadChatNotices,
  safeNoticeDate,
  unreadNoticeCount,
  type CommunityNotice,
  type NoticeFilter,
  type CommunityNoticeDestination,
} from "./notificationModel";
import "./social-notification-center.css";

/**
 * Reads only the authenticated account's existing /notifications endpoint.
 * Opens on demand; no background polling, exchange connections or new timers.
 */
export function CommunityNotificationCenter({
  onOpenSettings,
  onNavigate,
  showChatNotices = true,
  showSocialNotices = true,
}: {
  onOpenSettings: () => void;
  onNavigate?: (destination: CommunityNoticeDestination) => void;
  showChatNotices?: boolean;
  showSocialNotices?: boolean;
}) {
  const panelId = useId();
  const alive = useRef(true);
  const requestId = useRef(0);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NoticeFilter>("unread");
  const [items, setItems] = useState<CommunityNotice[]>([]);
  const [chats, setChats] = useState<ReturnType<typeof unreadChatNotices>>([]);
  const [chatError, setChatError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      requestId.current++;
    };
  }, []);

  async function refresh() {
    const request = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      // Chat summaries and stored events share the SAME on-demand refresh.
      // No WebSocket, per-message notification inserts or extra polling timer.
      const [notices, conversations] = await Promise.allSettled([
        apiJson("/api/community/notifications"),
        showChatNotices
          ? apiJson("/api/community/conversations")
          : Promise.resolve({ items: [] }),
      ]);
      if (!alive.current || request !== requestId.current) return;
      if (notices.status === "rejected") throw notices.reason;
      if (!Array.isArray(notices.value.items)) {
        throw new Error("Невідома відповідь сервера сповіщень");
      }
      setItems(notices.value.items.filter((item: unknown) =>
        !!item &&
        typeof item === "object" &&
        typeof (item as CommunityNotice).id === "string" &&
        typeof (item as CommunityNotice).type === "string",
      ) as CommunityNotice[]);
      if (conversations.status === "fulfilled") {
        setChats(unreadChatNotices(conversations.value?.items));
        setChatError("");
      } else {
        setChats([]);
        setChatError("Не вдалося завантажити непрочитані чати.");
      }
      setLoaded(true);
    } catch (cause) {
      if (alive.current && request === requestId.current)
        setError(cause instanceof Error ? cause.message : "Не вдалося завантажити сповіщення");
    } finally {
      if (alive.current && request === requestId.current) setLoading(false);
    }
  }

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    void refresh();
  }

  async function markRead(id: string) {
    if (busyId) return;
    setBusyId(id);
    setError("");
    // Invalidate any earlier inbox fetch so it cannot revert the read state.
    requestId.current++;
    setLoading(false);
    try {
      await apiJson("/api/community/notifications/" + encodeURIComponent(id) + "/read", {
        method: "POST",
        body: "{}",
      });
      if (!alive.current) return;
      setItems((old) =>
        old.map((notice) =>
          notice.id === id ? { ...notice, read_at: new Date().toISOString() } : notice,
        ),
      );
    } catch (cause) {
      if (alive.current)
        setError(cause instanceof Error ? cause.message : "Не вдалося позначити сповіщення прочитаним");
    } finally {
      if (alive.current) setBusyId(null);
    }
  }

  const visible = visibleCommunityNotices(items, filter, showSocialNotices);
  const unread = unreadNoticeCount(visibleCommunityNotices(items, "unread", showSocialNotices));
  const openChats = showChatNotices ? chats : [];
  const totalUnreadChats = openChats.reduce((total, chat) => total + chat.count, 0);
  const totalUnread = unread + totalUnreadChats;

  return (
    <div className="community-notification-anchor">
      <button
        type="button"
        className="community-notification-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
      >
        <Bell size={17} aria-hidden="true" />
        <span>Сповіщення</span>
        {loaded && totalUnread > 0 && <span className="community-notification-count">{totalUnread > 99 ? "99+" : totalUnread}</span>}
      </button>
      {open && (
        <section
          className="community-notification-panel"
          id={panelId}
          role="region"
          aria-label="Центр сповіщень"
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        >
          <header className="community-notification-panel-head">
            <div>
              <span className="community-page-kicker">ВАШ АКАУНТ</span>
              <h2>Сповіщення</h2>
              <small>Особисті події · останні 50 та непрочитані розмови</small>
            </div>
            <button
              type="button"
              aria-label="Оновити сповіщення"
              disabled={loading || !!busyId}
              onClick={() => void refresh()}
            >
              <RefreshCw size={17} aria-hidden="true" />
            </button>
          </header>
          <div className="community-notification-filters" role="group" aria-label="Показати сповіщення">
            <button type="button" aria-pressed={filter === "unread"} onClick={() => setFilter("unread")}>
              Непрочитані {loaded && totalUnread > 0 ? `(${totalUnread > 99 ? "99+" : totalUnread})` : ""}
            </button>
            <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
              Усі
            </button>
          </div>
          {error && <p className="community-notification-error" role="alert">{error}</p>}
          {showChatNotices && chatError && <p className="community-notification-error" role="status">{chatError}</p>}
          {loading && <p className="community-notification-loading" role="status">Завантаження сповіщень…</p>}
          {!loading && loaded && visible.length === 0 && openChats.length === 0 && (
            <div className="community-notification-empty">
              <Inbox size={22} aria-hidden="true" />
              {filter === "unread" ? "Немає непрочитаних сповіщень." : "Сповіщень поки немає."}
            </div>
          )}
          {!loading && !loaded && !error && <p className="community-notification-loading">Відкриваємо повідомлення…</p>}
          <ul className="community-notification-list">
            {openChats.map((chat) => (
              <li className="community-notification-item community-notification-unread community-notification-chat-item" key={"chat:" + chat.id}>
                <div className="community-notification-item-icon" aria-hidden="true"><MessageCircle size={17} /></div>
                <div className="community-notification-item-body">
                  <strong>{chat.is_group ? "Група: " : "Повідомлення: "}{chat.displayName}</strong>
                  <p>Непрочитаних повідомлень: {chat.count >= 100 ? "99+" : chat.count}</p>
                  {onNavigate && (
                    <button type="button" className="community-notification-open"
                      onClick={() => {
                        setOpen(false);
                        onNavigate({ section: "chats", conversationId: chat.id });
                      }}>
                      Відкрити розмову
                    </button>
                  )}
                </div>
              </li>
            ))}
            {visible.map((notice) => {
              const details = describeCommunityNotice(notice);
              const destination = communityNoticeDestination(notice);
              const isUnread = !notice.read_at;
              return (
                <li
                  className={"community-notification-item" + (isUnread ? " community-notification-unread" : "")}
                  key={notice.id}
                >
                  <div className="community-notification-item-icon" aria-hidden="true">
                    {details.isImportant
                      ? <ShieldAlert size={17} />
                      : <CircleAlert size={17} />}
                  </div>
                  <div className="community-notification-item-body">
                    <strong>{details.title}</strong>
                    <time dateTime={notice.created_at}>{safeNoticeDate(notice.created_at)}</time>
                    <p>{details.description}</p>
                    {destination && onNavigate && (
                      <button type="button" className="community-notification-open"
                        onClick={() => {
                          setOpen(false);
                          onNavigate(destination);
                          if (isUnread) void markRead(notice.id);
                        }}>
                        {destination.section === "friends" ? "Переглянути друзів" : "Відкрити обговорення"}
                      </button>
                    )}
                    {isUnread && (
                      <button
                        type="button"
                        disabled={!!busyId}
                        onClick={() => void markRead(notice.id)}
                      >
                        <Check size={14} aria-hidden="true" />
                        {busyId === notice.id ? "Зберігаємо…" : "Позначити прочитаним"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <footer className="community-notification-panel-foot">
            <span>Сповіщення доступні тільки власнику акаунта.</span>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenSettings();
              }}
            >
              Налаштування
            </button>
          </footer>
        </section>
      )}
    </div>
  );
}
