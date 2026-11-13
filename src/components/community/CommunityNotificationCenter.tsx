import React, { useEffect, useId, useRef, useState } from "react";
import {
  Bell,
  Check,
  CircleAlert,
  Inbox,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { apiJson } from "../../utils/apiFetch";
import {
  describeCommunityNotice,
  filterCommunityNotices,
  safeNoticeDate,
  unreadNoticeCount,
  type CommunityNotice,
  type NoticeFilter,
} from "./notificationModel";
import "./social-notification-center.css";

/**
 * Reads only the authenticated account's existing /notifications endpoint.
 * Opens on demand; no background polling, exchange connections or new timers.
 */
export function CommunityNotificationCenter({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  const panelId = useId();
  const alive = useRef(true);
  const requestId = useRef(0);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NoticeFilter>("unread");
  const [items, setItems] = useState<CommunityNotice[]>([]);
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
      const result = await apiJson("/api/community/notifications");
      if (!alive.current || request !== requestId.current) return;
      if (!Array.isArray(result.items)) {
        throw new Error("Невідома відповідь сервера сповіщень");
      }
      setItems(result.items.filter((item: unknown) =>
        !!item &&
        typeof item === "object" &&
        typeof (item as CommunityNotice).id === "string" &&
        typeof (item as CommunityNotice).type === "string",
      ) as CommunityNotice[]);
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

  const visible = filterCommunityNotices(items, filter);
  const unread = unreadNoticeCount(items);

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
        {loaded && unread > 0 && <span className="community-notification-count">{unread > 99 ? "99+" : unread}</span>}
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
              <small>Особисті події з Community · останні 50</small>
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
              Непрочитані {loaded && unread > 0 ? `(${unread})` : ""}
            </button>
            <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
              Усі
            </button>
          </div>
          {error && <p className="community-notification-error" role="alert">{error}</p>}
          {loading && <p className="community-notification-loading" role="status">Завантаження сповіщень…</p>}
          {!loading && loaded && visible.length === 0 && (
            <div className="community-notification-empty">
              <Inbox size={22} aria-hidden="true" />
              {filter === "unread" ? "Немає непрочитаних сповіщень." : "Сповіщень поки немає."}
            </div>
          )}
          {!loading && !loaded && !error && <p className="community-notification-loading">Відкриваємо повідомлення…</p>}
          <ul className="community-notification-list">
            {visible.map((notice) => {
              const details = describeCommunityNotice(notice);
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
