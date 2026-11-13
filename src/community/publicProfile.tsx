import React, { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight, BookOpenText, CalendarDays, Check, Copy, MessageCircle,
  ShieldCheck, TrendingUp, UsersRound,
} from "lucide-react";
import { ChartPreview } from "../components/community/ChartPreview";
import type { ChartDocument } from "./chartDocument";
import {
  communityPostUrl, publicPostId, publicPostUrl,
  publicProfileDate, visibleReactionSummary,
  type PublicReactionSummary,
} from "./publicProfileViewModel";
import "./publicProfile.css";

type PublicStats = {
  totals: Array<{
    currency: string;
    count: number;
    wins: number;
    losses: number;
    flat: number;
    winRate: number | null;
    pnl?: string;
  }>;
  coverage: Array<{ status: string; synced_at?: string; covered_from?: string }>;
};
type PublicTrader = {
  id: string;
  username: string;
  displayName: string;
  url: string;
  joinedAt: string;
  communityOrigin: string;
  status: string;
  bio: string;
  interests: string;
  lifestyle: string;
  telegram: string;
  statistics: PublicStats | null;
};
type PublicPost = {
  id: string;
  createdAt: string;
  title: string;
  text: string;
  photos: string[];
  chart: ChartDocument | null;
  reactions?: PublicReactionSummary[];
};
type PublicComment = {
  id: string;
  createdAt: string;
  author: string;
  text: string;
  quote: string;
  photosCount: number;
  hasChart: boolean;
  reactions?: PublicReactionSummary[];
};
type CommentState = {
  items: PublicComment[];
  next: string | null;
  loading: boolean;
  error: string;
};
type PublicTab = "wall" | "statistics" | "about";

const HookChart = lazy(() => import("../components/community/SharedHookChart"));
async function read(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { credentials: "omit", cache: "no-store", signal });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.error || "Профіль недоступний");
  return data;
}
function nameAtLocation() {
  const path = location.pathname.match(/^\/u\/([a-z0-9-]+)\/?$/i);
  return (path?.[1] ?? location.hostname.split(".")[0]).toLowerCase();
}
function ReactionTotals({ reactions }: { reactions?: PublicReactionSummary[] }) {
  const totals = visibleReactionSummary(reactions);
  if (!totals.length) return null;
  return (
    <div className="public-profile-reactions" aria-label="Кількість реакцій">
      {totals.map(({ emoji, count }) => (
        <span key={emoji}><span aria-hidden="true">{emoji}</span> {count}</span>
      ))}
    </div>
  );
}

export function PublicProfile() {
  const [profile, setProfile] = useState<PublicTrader | null>(null);
  const [items, setItems] = useState<PublicPost[]>([]);
  const [focusedPost, setFocusedPost] = useState<PublicPost | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [postError, setPostError] = useState("");
  const [busy, setBusy] = useState(false);
  const [chart, setChart] = useState<ChartDocument | null>(null);
  const [tab, setTab] = useState<PublicTab>("wall");
  const [copied, setCopied] = useState("");
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, CommentState>>({});
  const base = "/api/public/profiles/" + encodeURIComponent(nameAtLocation());
  const linkedPostId = publicPostId(new URLSearchParams(location.search).get("post"));

  useEffect(() => {
    if (chart) document.getElementById("public-chart-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [!!chart]);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([read(base, controller.signal), read(base + "/posts", controller.signal)])
      .then(([account, wall]) => {
        setProfile(account.profile);
        setItems(wall.items);
        setNext(wall.next);
        document.title = account.profile.displayName + " · h00k Community";
      })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Профіль недоступний"); });
    return () => controller.abort();
  }, [base]);
  useEffect(() => {
    if (!linkedPostId) return;
    const controller = new AbortController();
    void read(base + "/posts/" + encodeURIComponent(linkedPostId), controller.signal)
      .then(result => { setFocusedPost(result.item); setTab("wall"); })
      .catch(e => { if (!controller.signal.aborted) setPostError(e instanceof Error ? e.message : "Допис недоступний"); });
    return () => controller.abort();
  }, [base, linkedPostId]);

  const more = async () => {
    if (!next || busy) return;
    setBusy(true); setError("");
    try {
      const page = await read(base + "/posts?before=" + encodeURIComponent(next));
      setItems(old => [...new Map([...old, ...page.items].map(item => [item.id, item])).values()]);
      setNext(page.next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося завантажити пости");
    } finally { setBusy(false); }
  };
  const openChart = async (id: string) => {
    if (busy) return;
    setBusy(true); setError(""); setChart(null);
    try { setChart((await read(base + "/posts/" + encodeURIComponent(id) + "/chart")).document); }
    catch (e) { setError(e instanceof Error ? e.message : "Графік недоступний"); }
    finally { setBusy(false); }
  };
  const loadComments = async (id: string, after?: string) => {
    setComments(old => ({
      ...old, [id]: { items: old[id]?.items ?? [], next: old[id]?.next ?? null, loading: true, error: "" },
    }));
    try {
      const path = base + "/posts/" + encodeURIComponent(id) + "/comments" +
        (after ? "?after=" + encodeURIComponent(after) : "");
      const result = await read(path);
      setComments(old => ({
        ...old,
        [id]: {
          items: after
            ? [...new Map([...(old[id]?.items ?? []), ...result.items].map((c: PublicComment) => [c.id, c])).values()]
            : result.items,
          next: result.next,
          loading: false,
          error: "",
        },
      }));
    } catch (e) {
      setComments(old => ({
        ...old, [id]: {
          items: old[id]?.items ?? [], next: old[id]?.next ?? null, loading: false,
          error: e instanceof Error ? e.message : "Не вдалося завантажити коментарі",
        },
      }));
    }
  };
  const toggleComments = (id: string) => {
    if (expandedComments === id) { setExpandedComments(null); return; }
    setExpandedComments(id);
    if (!comments[id]) void loadComments(id);
  };
  const copy = async (value: string, id: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id);
    } catch {
      setCopied("error:" + id);
    }
  };

  const communityUrl = profile ? profile.communityOrigin + "/#community?section=profile&owner=" + encodeURIComponent(profile.id) : null;
  const wall = focusedPost && !items.some(item => item.id === focusedPost.id)
    ? [focusedPost, ...items] : items;
  const profileJoinDate = publicProfileDate(profile?.joinedAt);
  const totalClosures = profile?.statistics?.totals.reduce((sum, currency) => sum + currency.count, 0) ?? 0;

  return <main className="public-profile" data-network-mode="public-snapshot">
    <header className="public-profile-top">
      <a className="public-profile-brand" href={profile?.communityOrigin ?? "https://h00k.top/"}>h00k <span>Community</span></a>
      <div className="public-profile-top-links">
        <span>Публічна сторінка трейдера</span>
        <a href={profile?.communityOrigin ?? "https://h00k.top/"}>Спільнота</a>
        <a href="https://h00k.top" className="public-profile-screener-link">До скрінера <ArrowUpRight size={15} aria-hidden="true" /></a>
      </div>
    </header>
    {error && <p className="public-profile-error" role="alert">{error}</p>}
    {!profile && !error && <p role="status" className="public-profile-loading">Завантажуємо профіль…</p>}
    {profile && <>
      <section className="public-profile-hero">
        <div className="public-profile-cover" aria-hidden="true"><span>h00k / COMMUNITY</span></div>
        <div className="public-profile-identity">
          <div className="public-profile-avatar" aria-hidden="true">
            {(profile.displayName || "Т").slice(0, 1).toUpperCase()}
          </div>
          <div className="public-profile-hero-text">
            <p className="public-profile-kicker">ПРОФІЛЬ ТРЕЙДЕРА</p>
            <p className="public-profile-handle">@{profile.username}</p>
            <h1>{profile.displayName}</h1>
            {profile.status && <p className="public-profile-status">{profile.status}</p>}
            {profileJoinDate && <span className="public-profile-joined"><CalendarDays size={15} aria-hidden="true" /> У спільноті з {profileJoinDate}</span>}
          </div>
          <div className="public-profile-hero-actions">
            <a className="public-profile-action" href={communityUrl!}><UsersRound size={16} aria-hidden="true" /> Відкрити у Community</a>
            <button type="button" className="public-profile-copy" onClick={() => void copy(profile.url, "profile")}>
              {copied === "profile" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              {copied === "profile" ? "Скопійовано" : "Копіювати адресу"}
            </button>
          </div>
        </div>
        {copied === "error:profile" && <p className="public-profile-copy-error" role="status">Не вдалося скопіювати. Адреса: {profile.url}</p>}
        <div className="public-profile-hero-facts">
          <span><ShieldCheck size={16} aria-hidden="true" /> Власник керує видимістю</span>
          {profile.statistics && <span><TrendingUp size={16} aria-hidden="true" /> {totalClosures} імпортованих закриттів</span>}
          <span><BookOpenText size={16} aria-hidden="true" /> Публікації лише з дозволу автора</span>
        </div>
      </section>

      <div className="public-profile-columns">
        <aside className="public-profile-aside" aria-label="Інформація про трейдера">
          <section className="public-profile-panel public-profile-about-preview">
            <h2>Про трейдера</h2>
            {profile.bio && <p>{profile.bio}</p>}
            {!profile.bio && <p className="public-profile-muted">Біографія не опублікована.</p>}
            <button type="button" onClick={() => setTab("about")}>Детальніше про профіль <ArrowUpRight size={14} aria-hidden="true" /></button>
          </section>
          {(profile.interests || profile.lifestyle || profile.telegram) && <section className="public-profile-panel">
            {profile.interests && <><h2>Інтереси</h2><p>{profile.interests}</p></>}
            {profile.lifestyle && <><h2>Звички та спосіб життя</h2><p>{profile.lifestyle}</p></>}
            {profile.telegram && <a href={profile.telegram} target="_blank" rel="noopener noreferrer">Telegram-канал ↗</a>}
          </section>}
          <section className="public-profile-panel public-profile-privacy-panel">
            <ShieldCheck size={22} aria-hidden="true" />
            <h2>Прозорість даних</h2>
            <p>Тут видно лише те, що користувач зробив публічним. Приватні угоди, баланс і записи не розкриваються.</p>
          </section>
        </aside>
        <div className="public-profile-main">
          <nav className="public-profile-tabs" aria-label="Розділи профілю">
            <button type="button" aria-current={tab === "wall" ? "page" : undefined} onClick={() => setTab("wall")}><BookOpenText size={16} aria-hidden="true" /> Стіна</button>
            {profile.statistics && <button type="button" aria-current={tab === "statistics" ? "page" : undefined} onClick={() => setTab("statistics")}><TrendingUp size={16} aria-hidden="true" /> Результати</button>}
            <button type="button" aria-current={tab === "about" ? "page" : undefined} onClick={() => setTab("about")}><UsersRound size={16} aria-hidden="true" /> Про трейдера</button>
          </nav>

          {tab === "wall" && <section aria-label="Публічна стіна" className="public-profile-wall">
            <div className="public-profile-wall-heading">
              <div><p className="public-profile-kicker">СТІНА ТРЕЙДЕРА</p><h2>Публікації</h2></div>
              <span>Лише публічні матеріали автора</span>
            </div>
            {postError && <p className="public-profile-error" role="status">Допис за посиланням недоступний: {postError}</p>}
            {wall.map(item => <article className="public-profile-panel public-profile-post" key={item.id} id={"post-" + item.id}>
              {focusedPost?.id === item.id && <span className="public-profile-featured">Допис за посиланням</span>}
              <div className="public-profile-post-author">
                <span className="public-profile-post-avatar" aria-hidden="true">{profile.displayName.slice(0, 1).toUpperCase()}</span>
                <div><strong>{profile.displayName}</strong><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("uk-UA")}</time></div>
                <span className="public-profile-post-public">Публічно</span>
              </div>
              {item.title && <h3>{item.title}</h3>}
              {item.text && <p>{item.text}</p>}
              {!!item.photos?.length && <div className="public-profile-photos">
                {item.photos.map((id: string) => <img key={id} loading="lazy" alt="Фото до публікації" src={base + "/posts/" + item.id + "/media/" + id} />)}
              </div>}
              {item.chart && <ChartPreview document={item.chart} onOpen={() => void openChart(item.id)} />}
              <div className="public-profile-post-actions">
                <ReactionTotals reactions={item.reactions} />
                <button
                  type="button"
                  aria-expanded={expandedComments === item.id}
                  aria-controls={"public-comments-" + item.id}
                  onClick={() => toggleComments(item.id)}
                ><MessageCircle size={16} aria-hidden="true" /> {expandedComments === item.id ? "Сховати обговорення" : "Публічні коментарі"}</button>
                <button type="button" onClick={() => void copy(publicPostUrl(profile.url, item.id), item.id)}>
                  {copied === item.id ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                  {copied === item.id ? "Скопійовано" : "Поділитися"}
                </button>
                <a href={communityPostUrl(profile.communityOrigin, item.id)}>Обговорити у Community <ArrowUpRight size={14} aria-hidden="true" /></a>
              </div>
              {copied === "error:" + item.id && <p className="public-profile-copy-error" role="status">Не вдалося скопіювати адресу допису.</p>}
              {expandedComments === item.id && <div className="public-profile-comments" id={"public-comments-" + item.id}>
                <h4>Відкриті коментарі</h4>
                <p className="public-profile-muted">Показані лише коментарі, які їхні автори дозволили читати гостям.</p>
                {(comments[item.id]?.items ?? []).map(comment => (
                  <article className="public-profile-comment" key={comment.id}>
                    <div className="public-profile-comment-head">
                      <span className="public-profile-post-avatar" aria-hidden="true">{comment.author.slice(0, 1).toUpperCase()}</span>
                      <div><strong>{comment.author}</strong><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString("uk-UA")}</time></div>
                    </div>
                    {comment.quote && <blockquote>{comment.quote}</blockquote>}
                    {comment.text && <p>{comment.text}</p>}
                    {(comment.photosCount > 0 || comment.hasChart) && <p className="public-profile-muted">
                      {comment.photosCount > 0 ? "Фото" : ""}{comment.photosCount > 0 && comment.hasChart ? " та " : ""}{comment.hasChart ? "HookChart" : ""} — доступні у Community
                    </p>}
                    <ReactionTotals reactions={comment.reactions} />
                  </article>
                ))}
                {comments[item.id]?.loading && <p role="status">Завантаження коментарів…</p>}
                {comments[item.id]?.error && <p role="status" className="public-profile-error">{comments[item.id].error}</p>}
                {!comments[item.id]?.loading && comments[item.id]?.items.length === 0 && !comments[item.id]?.error && <p className="public-profile-muted">Відкритих коментарів поки немає.</p>}
                {comments[item.id]?.next && <button
                  type="button"
                  disabled={comments[item.id].loading}
                  onClick={() => void loadComments(item.id, comments[item.id].next!)}
                >Ще коментарі</button>}
                <a className="public-profile-comment-cta" href={communityPostUrl(profile.communityOrigin, item.id)}>Увійти, щоб відповісти <ArrowUpRight size={14} aria-hidden="true" /></a>
              </div>}
            </article>)}
            {!wall.length && <p className="public-profile-muted public-profile-empty">Публічних публікацій поки немає.</p>}
            {next && <button type="button" className="public-profile-more" disabled={busy} onClick={() => void more()}>Ще публікації</button>}
          </section>}

          {tab === "statistics" && profile.statistics && <section className="public-profile-results" aria-label="Торгові результати">
            <div className="public-profile-wall-heading">
              <div><p className="public-profile-kicker">ДАНІ З ПІДКЛЮЧЕНОЇ БІРЖІ</p><h2>Результати трейдера</h2></div>
            </div>
            <p className="public-profile-muted">Bybit linear · імпортовані закриті ордери за наявний період, не повна дохідність рахунку. Беззбиткові закриття не входять у знаменник win rate.</p>
            {!!profile.statistics.totals.length && <div className="public-profile-results-grid">
              {profile.statistics.totals.map(s => <section className="public-profile-panel public-profile-result-card" key={s.currency}>
                <h3>{s.currency}</h3>
                <div className="public-profile-result-metrics">
                  <div><span>Закриття</span><strong>{s.count}</strong></div>
                  <div><span>Win rate</span><strong>{s.winRate === null ? "—" : s.winRate.toFixed(1) + "%"}</strong></div>
                  <div><span>Прибуткові</span><strong>{s.wins}</strong></div>
                  <div><span>Збиткові</span><strong>{s.losses}</strong></div>
                  <div><span>Беззбиткові</span><strong>{s.flat}</strong></div>
                  {s.pnl !== undefined && <div><span>Сумарний PnL</span><strong>{s.pnl} {s.currency}</strong></div>}
                </div>
              </section>)}
            </div>}
            {!profile.statistics.totals.length && <div className="public-profile-panel">Імпортованих закриттів ще немає.</div>}
            <div className="public-profile-panel">
              <h3>Покриття й актуальність</h3>
              {!profile.statistics.coverage.length && <p className="public-profile-muted">Інформація про синхронізацію відсутня.</p>}
              {profile.statistics.coverage.map((c, i) => <p className="public-profile-muted" key={i}>
                Стан: {c.status} · остання синхронізація: {c.synced_at ? new Date(c.synced_at).toLocaleString("uk-UA") : "ще не виконана"}
                {c.covered_from && " · початок покриття: " + new Date(c.covered_from).toLocaleDateString("uk-UA")}
              </p>)}
              <p className="public-profile-muted">Результати не є гарантією майбутньої прибутковості.</p>
            </div>
          </section>}

          {tab === "about" && <section aria-label="Про трейдера" className="public-profile-about-tab">
            <div className="public-profile-wall-heading">
              <div><p className="public-profile-kicker">ПРОФІЛЬ</p><h2>Про трейдера</h2></div>
            </div>
            {profile.bio && <section className="public-profile-panel"><h3>Біографія</h3><p>{profile.bio}</p></section>}
            {profile.interests && <section className="public-profile-panel"><h3>Інтереси</h3><p>{profile.interests}</p></section>}
            {profile.lifestyle && <section className="public-profile-panel"><h3>Звички та спосіб життя</h3><p>{profile.lifestyle}</p></section>}
            {profile.telegram && <section className="public-profile-panel"><h3>Соцмережі</h3><a href={profile.telegram} target="_blank" rel="noopener noreferrer">Telegram-канал <ArrowUpRight size={14} aria-hidden="true" /></a></section>}
            {!profile.bio && !profile.interests && !profile.lifestyle && !profile.telegram && <p className="public-profile-muted">Автор ще не відкрив інформацію про себе.</p>}
          </section>}
        </div>
      </div>

      {chart && <section id="public-chart-workspace" className="public-profile-panel public-profile-workspace" aria-label="Збережений HookChart">
        <div className="public-profile-workspace-heading"><h2>HookChart · власний розбір</h2><button type="button" onClick={() => setChart(null)}>Закрити графік</button></div>
        <p>Зміни локальні й не змінюють публікацію. Доступні свічки збереженого знімка; біржових підключень немає. Для публікації відповіді відкрийте оригінал у Community.</p>
        <Suspense fallback={<p role="status">Відкриваємо HookChart…</p>}><HookChart value={chart} onChange={setChart} /></Suspense>
      </section>}
    </>}
    <footer className="public-profile-muted">Власник обирає публічні дані. Торгова статистика не гарантує надійність людини. Нікому не передавайте паролі, API-ключі або кошти.</footer>
  </main>;
}
if (typeof document !== "undefined" && document.getElementById("profile-root"))
  createRoot(document.getElementById("profile-root")!).render(<PublicProfile />);
