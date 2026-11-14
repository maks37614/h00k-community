import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Hash, Send, ShieldCheck, UsersRound } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { apiJson } from "../../utils/apiFetch";
import { COMMUNITY_PUBLIC_ROOMS, type CommunityPublicRoomSlug } from "../../community/publicRooms";
import "./social-public-rooms.css";

type PublicMessage = {
  id: string;
  owner_id: string;
  text: string;
  created_at: string;
  author: { displayName: string; username?: string | null; avatarUrl?: string | null };
};

function roomEndpoint(slug: CommunityPublicRoomSlug) {
  return "/api/community/rooms/" + slug + "/messages";
}

function RoomAvatar({ item }: { item: PublicMessage }) {
  const [badImage, setBadImage] = useState(false);
  return (
    <span className="community-room-avatar" aria-hidden="true">
      {(item.author.displayName || "Т").slice(0, 1).toUpperCase()}
      {item.author.avatarUrl && !badImage && (
        <img src={item.author.avatarUrl} alt="" loading="lazy" onError={() => setBadImage(true)} />
      )}
    </span>
  );
}

/** Public rooms are separate from private conversations, with no shared cursors. */
export function CommunityPublicRooms({ onProfile }: { onProfile: (id: string) => void }) {
  const { user } = useAuth();
  const [slug, setSlug] = useState<CommunityPublicRoomSlug>("general");
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [before, setBefore] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const latest = useRef<PublicMessage[]>([]);
  const activeSlug = useRef(slug);
  const scroll = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const olderOffset = useRef<number | null>(null);
  activeSlug.current = slug;
  latest.current = messages;

  const loadNewest = useCallback(async (requestedSlug: CommunityPublicRoomSlug) => {
    const after = latest.current.at(-1)?.id;
    const result = await apiJson(roomEndpoint(requestedSlug) +
      (after ? "?after=" + encodeURIComponent(after) : ""));
    if (activeSlug.current !== requestedSlug) return;
    const received: PublicMessage[] = Array.isArray(result.items) ? result.items : [];
    setMessages(old => [...new Map((after ? [...old, ...received] : received)
      .map(item => [item.id, item])).values()]);
    if (!after) setBefore(result.next ?? null);
    setError("");
  }, []);

  useEffect(() => {
    setMessages([]);
    latest.current = [];
    setBefore(null);
    setLoadingOlder(false);
    setError("");
    setNotice("");
    atBottom.current = true;
    olderOffset.current = null;
    let active = true;
    let inFlight = false;
    const pull = () => {
      if (!active || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      void loadNewest(slug).catch(e => {
        if (active) setError(e instanceof Error ? e.message : "Не вдалося оновити чат");
      }).finally(() => { inFlight = false; });
    };
    pull();
    // Poll only the selected visible room. Never subscribe to exchange streams.
    const timer = window.setInterval(pull, 12000);
    document.addEventListener("visibilitychange", pull);
    window.addEventListener("focus", pull);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", pull);
      window.removeEventListener("focus", pull);
    };
  }, [slug, loadNewest]);

  useLayoutEffect(() => {
    const el = scroll.current;
    if (!el) return;
    if (olderOffset.current !== null) {
      el.scrollTop = Math.max(0, el.scrollHeight - olderOffset.current);
      olderOffset.current = null;
    } else if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, slug]);

  async function loadOlder() {
    if (!before || loadingOlder) return;
    const requestedSlug = slug;
    setLoadingOlder(true);
    try {
      const result = await apiJson(roomEndpoint(requestedSlug) +
        "?before=" + encodeURIComponent(before));
      if (activeSlug.current !== requestedSlug) return;
      if (scroll.current)
        olderOffset.current = scroll.current.scrollHeight - scroll.current.scrollTop;
      const older: PublicMessage[] = Array.isArray(result.items) ? result.items : [];
      setMessages(old => [...new Map([...older, ...old].map(item => [item.id,item])).values()]);
      setBefore(result.next ?? null);
      setError("");
    } catch (e) {
      if (activeSlug.current === requestedSlug)
        setError(e instanceof Error ? e.message : "Не вдалося завантажити історію");
    } finally {
      if (activeSlug.current === requestedSlug) setLoadingOlder(false);
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    const requestedSlug = slug;
    setSending(true);
    setError("");
    try {
      await apiJson(roomEndpoint(requestedSlug), {
        method:"POST", body:JSON.stringify({ text:body }),
      });
      if (activeSlug.current !== requestedSlug) return;
      setText("");
      atBottom.current = true;
      await loadNewest(requestedSlug);
    } catch (e) {
      if (activeSlug.current === requestedSlug)
        setError(e instanceof Error ? e.message : "Не вдалося надіслати повідомлення");
    } finally {
      setSending(false);
    }
  }

  async function deleteMessage(item: PublicMessage) {
    if (!window.confirm("Видалити своє повідомлення з загальної кімнати?")) return;
    try {
      await apiJson(roomEndpoint(slug) + "/" + encodeURIComponent(item.id), { method:"DELETE" });
      setMessages(old => old.filter(message => message.id !== item.id));
      setNotice("Повідомлення видалено");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Видалення недоступне");
    }
  }

  async function reportMessage(item: PublicMessage) {
    const reason = window.prompt("Причина скарги (від 8 до 500 символів)");
    if (!reason) return;
    if (reason.trim().length < 8 || reason.length > 500) {
      setError("Опишіть причину скарги (8–500 символів)");
      return;
    }
    try {
      await apiJson(roomEndpoint(slug) + "/" + encodeURIComponent(item.id) + "/report", {
        method:"POST", body:JSON.stringify({ reason:reason.trim() }),
      });
      setNotice("Скаргу надіслано модераторам");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося надіслати скаргу");
    }
  }

  const current = COMMUNITY_PUBLIC_ROOMS.find(room => room.slug === slug)!;
  return (
    <section className="community-rooms-layout" aria-label="Публічні кімнати трейдерів">
      <aside className="community-rooms-channels">
        <h3><UsersRound size={16} aria-hidden="true" /> Кімнати трейдерів</h3>
        {COMMUNITY_PUBLIC_ROOMS.map(room => (
          <button type="button" key={room.slug} aria-pressed={slug === room.slug}
            onClick={() => { if (slug !== room.slug) { setSlug(room.slug); setText(""); } }}>
            <Hash size={17} aria-hidden="true" />
            <span><strong>{room.handle}</strong><small>{room.description}</small></span>
          </button>
        ))}
        <p><ShieldCheck size={15} aria-hidden="true" /> Публічні текстові повідомлення. Тут немає приватних чатів або автоматичних торгових сигналів.</p>
      </aside>
      <div className="community-rooms-main">
        <header className="community-rooms-header">
          <Hash size={22} aria-hidden="true" />
          <div><h3>{current.title}</h3><p>{current.description} · Оновлення приблизно раз на 12 с</p></div>
        </header>
        {error && <p className="community-rooms-error" role="alert">{error}</p>}
        {notice && <p className="community-rooms-notice" role="status">{notice}</p>}
        <div className="community-rooms-thread" role="log" aria-label={current.title} aria-live="off"
          ref={scroll} onScroll={event => {
            const el = event.currentTarget;
            atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}>
          {before && <button type="button" className="community-rooms-older"
            disabled={loadingOlder} onClick={() => void loadOlder()}>
            {loadingOlder ? "Завантажуємо…" : "Попередні повідомлення"}
          </button>}
          {!messages.length && !error && <p className="community-rooms-empty">
            Тут поки немає повідомлень. Почніть обговорення з іншими трейдерами.
          </p>}
          {messages.map(item => {
            const mine = item.owner_id === user?.uid;
            return (
              <article key={item.id} className={"community-room-bubble" + (mine ? " community-room-bubble-mine" : "")}>
                <RoomAvatar item={item} />
                <div className="community-room-content">
                  <header>
                    <button type="button" onClick={() => onProfile(item.owner_id)}
                      className="community-room-author">
                      {item.author.displayName || "Трейдер"}
                      {item.author.username && <small>@{item.author.username}</small>}
                    </button>
                    <time dateTime={item.created_at}>
                      {new Date(item.created_at).toLocaleString("uk-UA", { dateStyle:"short", timeStyle:"short" })}
                    </time>
                  </header>
                  <p>{item.text}</p>
                  <footer>
                    {mine ? <button type="button" onClick={() => void deleteMessage(item)}>Видалити</button> :
                      <button type="button" onClick={() => void reportMessage(item)}>Поскаржитися</button>}
                  </footer>
                </div>
              </article>
            );
          })}
        </div>
        <form className="community-rooms-send" onSubmit={event => void send(event)}>
          <label htmlFor="community-room-text">Написати в {current.handle}</label>
          <div>
            <textarea id="community-room-text" value={text} maxLength={2000}
              onChange={event => setText(event.target.value)} disabled={sending}
              onKeyDown={event => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Ваше повідомлення…" rows={2} />
            <button type="submit" disabled={sending || !text.trim()}>
              <Send size={17} aria-hidden="true" /> {sending ? "Надсилаємо…" : "Надіслати"}
            </button>
          </div>
          <small>Enter — надіслати · Shift+Enter — новий рядок · до 2000 символів</small>
        </form>
      </div>
    </section>
  );
}
