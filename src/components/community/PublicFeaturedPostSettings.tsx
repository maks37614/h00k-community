import React, { useEffect, useState } from "react";

type PublicPostChoice = { id: string; title: string; text: string; category?: string };
const validId = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

/** Owner-side picker reads only the same consent-filtered posts that guests can see. */
export function PublicFeaturedPostSettings({
  username, enabled, selectedId, busy, onSelect,
}: {
  username: string;
  enabled: boolean;
  selectedId: string | null;
  busy: boolean;
  onSelect: (id: string | null) => Promise<void>;
}) {
  const [posts, setPosts] = useState<PublicPostChoice[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setPosts([]);
    setNext(null);
    setError("");
    if (!enabled || !username) return;
    const controller = new AbortController();
    setLoading(true);
    void fetch("/api/public/profiles/" + encodeURIComponent(username) + "/posts", {
      credentials: "omit", cache: "no-store", signal: controller.signal,
    }).then(async response => {
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Не вдалося завантажити публікації");
      if (!active) return;
      setPosts(Array.isArray(data.items) ? data.items.filter((item: PublicPostChoice) =>
        item && validId.test(item.id) && typeof item.text === "string" && typeof item.title === "string") : []);
      setNext(typeof data.next === "string" && validId.test(data.next) ? data.next : null);
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : "Не вдалося завантажити публікації");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [enabled, username]);

  async function loadMore() {
    if (!next || busy || loading) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ before: next });
      const response = await fetch(
        "/api/public/profiles/" + encodeURIComponent(username) + "/posts?" + params,
        { credentials: "omit", cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Не вдалося завантажити публікації");
      setPosts(current => [...new Map([
        ...current,
        ...(Array.isArray(data.items) ? data.items : []).filter((item: PublicPostChoice) =>
          item && validId.test(item.id) && typeof item.text === "string" && typeof item.title === "string"),
      ].map((item: PublicPostChoice) => [item.id, item])).values()]);
      setNext(typeof data.next === "string" && validId.test(data.next) ? data.next : null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не вдалося завантажити публікації");
    } finally { setLoading(false); }
  }

  const unknownSelection = !!selectedId && !posts.some(post => post.id === selectedId);
  return <section className="community-public-featured-settings" aria-label="Закріплений публічний допис">
    <h3>Закріплений допис у публічному профілі</h3>
    <p className="community-hint">
      Оберіть один зі своїх дописів, доступних гостям. Він з'явиться першим на публічній сторінці,
      навіть коли знаходиться на наступній сторінці стрічки. Публічність поста,
      фотографій та HookChart перевіряється під час кожного перегляду.
    </p>
    {!enabled && <p className="community-hint">Спочатку увімкніть публічний профіль.</p>}
    {enabled && !loading && !posts.length && !error && !selectedId && (
      <p className="community-hint">Відкритих дописів поки немає. Створіть перший пост у Community та виберіть для нього аудиторію «Публічно».</p>
    )}
    <label>
      Показувати першим
      <select value={selectedId ?? ""} disabled={busy || !enabled}
        onChange={event => void onSelect(event.target.value || null)}>
        <option value="">Нічого не закріплено</option>
        {unknownSelection && <option value={selectedId!}>Раніше вибраний допис — немає серед завантажених</option>}
        {posts.map(post => <option key={post.id} value={post.id}>
          {(post.title.trim() || post.text.trim() || "Публікація без назви").slice(0, 110)}
        </option>)}
      </select>
    </label>
    {next && <button type="button" disabled={loading || busy} onClick={() => void loadMore()}>
      {loading ? "Завантаження…" : "Показати старіші публікації"}
    </button>}
    {error && <p role="status" className="community-public-featured-error">{error}</p>}
    {loading && <p role="status" className="community-hint">Перевіряємо відкриті дописи…</p>}
    <p className="community-hint">Якщо ви приховаєте або видалите закріплений пост, він одразу перестане відображатися гостям. Приватні дані не стануть публічними через закріплення.</p>
  </section>;
}
