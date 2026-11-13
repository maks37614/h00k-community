import React, { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight, Award, BookOpenText, CalendarDays, Check, Copy, MessageCircle,
  ShieldCheck, TrendingUp, UsersRound, UserPlus, ChartNoAxesCombined,
  Globe2, Sparkles, Layers3, Lightbulb, GraduationCap,
} from "lucide-react";
import { ChartPreview } from "../components/community/ChartPreview";
import type { ChartDocument } from "./chartDocument";
import {
  communityPostUrl, publicPostId, publicPostUrl,
  publicProfileDate, visibleReactionSummary,
  type PublicReactionSummary,
} from "./publicProfileViewModel";
import { publicClosedOrderOverview, publicProfileSetups } from "./publicProfileSocialModel";
import "./publicProfile.css";
import "./publicProfileConcept.css";

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
  avatarUrl: string | null;
  coverUrl: string | null;
  statistics: PublicStats | null;
};
type PublicPost = {
  id: string;
  createdAt: string;
  title: string;
  text: string;
  category?: "general" | "idea" | "analysis" | "education";
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
type PublicTab = "wall" | "setups" | "statistics" | "about";

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
  const [postCategory, setPostCategory] = useState<"all" | "idea" | "analysis" | "education">("all");
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
  useEffect(() => {
    if (!focusedPost || !profile) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById("post-" + focusedPost.id)?.scrollIntoView({
        behavior: "auto",
        block: "start",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusedPost?.id, profile?.id]);

  const copy = async (value: string, id: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id);
    } catch {
      setCopied("error:" + id);
    }
  };

  const sharePost = async (id: string) => {
    if (!profile) return;
    const url = publicPostUrl(profile.url, id);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: profile.displayName + " · h00k Community", url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copy(url, id);
  };

  const communityUrl = profile ? profile.communityOrigin + "/#community?section=profile&owner=" + encodeURIComponent(profile.id) : null;
  const wall = focusedPost && !items.some(item => item.id === focusedPost.id)
    ? [focusedPost, ...items] : items;
  const profileJoinDate = publicProfileDate(profile?.joinedAt);
  const totalClosures = profile?.statistics?.totals.reduce((sum, currency) => sum + currency.count, 0) ?? 0;
  const overview = publicClosedOrderOverview(profile?.statistics?.totals ?? []);
  const categorizedWall = postCategory === "all" ? wall : wall.filter(item => item.category === postCategory);
  const visibleWall = tab === "setups" ? publicProfileSetups(wall) : categorizedWall;
  const visiblePostCount = items.length;
  const browsePosts = () => {
    setPostCategory("all");
    setTab("wall");
    document.getElementById("public-profile-tabs")?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  return <main className="public-profile" data-network-mode="public-snapshot">
    <header className="public-profile-top">
      <a className="public-profile-brand" href={profile?.communityOrigin ?? "https://h00k.top/"} aria-label="h00k Community — головна">h<span className="public-profile-brand-accent">00</span>k <span className="public-profile-brand-label">Community</span></a>
      <div className="public-profile-top-links">
        <span className="public-profile-top-caption"><Globe2 size={14} aria-hidden="true" /> Публічний профіль</span>
        <a href="https://h00k.top" className="public-profile-screener-link"><ChartNoAxesCombined size={15} aria-hidden="true" /> Скрінер</a>
        <a href={profile?.communityOrigin ?? "https://h00k.top/"} className="public-profile-community-top"><UsersRound size={16} aria-hidden="true" /> Community</a>
      </div>
    </header>
    {error && <p className="public-profile-error" role="alert">{error}</p>}
    {!profile && !error && <p role="status" className="public-profile-loading">Завантажуємо профіль…</p>}
    {profile && <>
      <section className="public-profile-hero">
        <div className="public-profile-cover" aria-hidden="true">
          {profile.coverUrl && <img className="public-profile-cover-image" src={profile.coverUrl} alt="" onError={e => { e.currentTarget.hidden = true; }} />}
          <span className="public-profile-cover-mark"><Sparkles size={14} aria-hidden="true" /> h00k / TRADER NETWORK</span>
        </div>
        <div className="public-profile-identity">
          <div className="public-profile-avatar" aria-hidden="true">
            {(profile.displayName || "Т").slice(0, 1).toUpperCase()}
            {profile.avatarUrl && <img className="public-profile-avatar-image" src={profile.avatarUrl} alt="" onError={e => { e.currentTarget.hidden = true; }} />}
          </div>
          <div className="public-profile-hero-text">
            <p className="public-profile-kicker"><span className="public-profile-live-dot" aria-hidden="true" /> ПРОФІЛЬ ТРЕЙДЕРА</p>
            <p className="public-profile-handle">@{profile.username}</p>
            <h1>{profile.displayName}</h1>
            {profile.status && <p className="public-profile-status">{profile.status}</p>}
            {profileJoinDate && <span className="public-profile-joined"><CalendarDays size={15} aria-hidden="true" /> У спільноті з {profileJoinDate}</span>}
          </div>
          <div className="public-profile-hero-actions">
            <a className="public-profile-action public-profile-connect" href={communityUrl!} title="Запити дружби доступні після входу в Community"><UserPlus size={16} aria-hidden="true" /> Додати в друзі</a>
            <a className="public-profile-chat" href={communityUrl!} title="Повідомлення доступні підтвердженим друзям у Community"><MessageCircle size={16} aria-hidden="true" /> Повідомлення</a>
            <a className="public-profile-community-link" href={communityUrl!}><UsersRound size={16} aria-hidden="true" /> Відкрити у Community</a>
            <button type="button" className="public-profile-copy" onClick={() => void copy(profile.url, "profile")}>
              {copied === "profile" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
              {copied === "profile" ? "Скопійовано" : "Копіювати адресу"}
            </button>
          </div>
        </div>
        <div className="public-profile-hero-detail">
          {profile.bio && <p className="public-profile-hero-bio">{profile.bio}</p>}
          <p className="public-profile-connect-hint">Запити дружби та приватні повідомлення доступні після входу у Community. Для листування потрібна підтверджена дружба.</p>
        </div>
        {copied === "error:profile" && <p className="public-profile-copy-error" role="status">Не вдалося скопіювати. Адреса: {profile.url}</p>}
        <div className="public-profile-hero-facts">
          <span><ShieldCheck size={16} aria-hidden="true" /> Лише відкриті автором дані</span>
          <span><BookOpenText size={16} aria-hidden="true" /> {visiblePostCount} завантажених публікацій</span>
          {profile.statistics && <span><TrendingUp size={16} aria-hidden="true" /> {totalClosures} імпортованих закриттів</span>}
        </div>
      </section>

      <div className="public-profile-columns public-profile-social-layout">
        <aside className="public-profile-aside" aria-label="Інформація про трейдера">
          <section className="public-profile-panel public-profile-about-preview">
            <h2><UsersRound size={18} aria-hidden="true" /> Про трейдера</h2>
            <p className="public-profile-sidebar-handle">@{profile.username}</p>
            {profile.status && <p className="public-profile-sidebar-status">{profile.status}</p>}
            {profile.bio && <p>{profile.bio}</p>}
            {!profile.bio && <p className="public-profile-muted">Біографія не опублікована.</p>}
            {profileJoinDate && <p className="public-profile-sidebar-joined"><CalendarDays size={14} aria-hidden="true" /> У спільноті з {profileJoinDate}</p>}
            <button type="button" onClick={() => { setTab("about"); document.getElementById("public-profile-tabs")?.scrollIntoView({ block: "start", behavior: "smooth" }); }}>Детальніше про профіль <ArrowUpRight size={14} aria-hidden="true" /></button>
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
          <nav id="public-profile-tabs" className="public-profile-tabs" aria-label="Розділи профілю">
            <button type="button" aria-current={tab === "wall" ? "page" : undefined} onClick={() => setTab("wall")}><Layers3 size={16} aria-hidden="true" /> Стрічка</button>
            <button type="button" aria-current={tab === "setups" ? "page" : undefined} onClick={() => setTab("setups")}><ChartNoAxesCombined size={16} aria-hidden="true" /> HookChart</button>
            {profile.statistics && <button type="button" aria-current={tab === "statistics" ? "page" : undefined} onClick={() => setTab("statistics")}><TrendingUp size={16} aria-hidden="true" /> Результати</button>}
            <button type="button" aria-current={tab === "about" ? "page" : undefined} onClick={() => setTab("about")}><UsersRound size={16} aria-hidden="true" /> Про трейдера</button>
          </nav>

          {(tab === "wall" || tab === "setups") && <section aria-label="Публічна стіна" className="public-profile-wall">
            <div className="public-profile-wall-heading">
              <div><p className="public-profile-kicker">{tab === "setups" ? "ЗБЕРЕЖЕНІ ГРАФІКИ" : "СТІНА ТРЕЙДЕРА"}</p><h2>{tab === "setups" ? "Публічні розбори HookChart" : "Публікації"}</h2></div>
              <span>{tab === "setups" ? "Публічні графіки без біржових підключень" : "Нові публікації спочатку"}</span>
            </div>
            {tab === "wall" && <nav className="public-profile-category-nav" aria-label="Категорії публікацій">
              {([
                ["all", "Усі дописи", Layers3],
                ["idea", "Ідеї", Lightbulb],
                ["analysis", "Аналіз", TrendingUp],
                ["education", "Навчання", GraduationCap],
              ] as const).map(([id, label, Icon]) => (
                <button type="button" key={id} aria-pressed={postCategory === id}
                  onClick={() => setPostCategory(id)}><Icon size={15} aria-hidden="true" /> {label}</button>
              ))}
            </nav>}
            {postError && <p className="public-profile-error" role="status">Допис за посиланням недоступний: {postError}</p>}
            {visibleWall.map(item => <article className="public-profile-panel public-profile-post" key={item.id} id={"post-" + item.id}>
              {focusedPost?.id === item.id && <span className="public-profile-featured">Допис за посиланням</span>}
              <div className="public-profile-post-author">
                <span className="public-profile-post-avatar" aria-hidden="true">
                  {profile.displayName.slice(0, 1).toUpperCase()}
                  {profile.avatarUrl && <img src={profile.avatarUrl} alt="" onError={e => { e.currentTarget.hidden = true; }} />}
                </span>
                <div><strong>{profile.displayName}</strong><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("uk-UA")}</time></div>
                <span className="public-profile-post-public">Публічно</span>
              </div>
              {item.category && item.category !== "general" && <span className="public-profile-post-kind">
                {item.category === "idea" ? "Ідея" : item.category === "analysis" ? "Аналіз" : "Навчання"}
              </span>}
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
                <button type="button" onClick={() => void sharePost(item.id)}>
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
            {!visibleWall.length && <div className="public-profile-panel public-profile-empty-state">
              <BookOpenText size={28} aria-hidden="true" />
              <h3>{tab === "setups" ? "Публічних графіків поки немає" : postCategory === "all" ? "Публікацій поки немає" : "У цій категорії поки немає дописів"}</h3>
              <p>Показуються тільки дозволені автором публікації серед уже завантажених. {next ? "Нижче можна завантажити наступні дописи." : "Поверніться до загальної стрічки."}</p>
              {postCategory !== "all" && <button type="button" onClick={() => setPostCategory("all")}>Усі публікації</button>}
            </div>}
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
        </div>        <aside className="public-profile-insights" aria-label="Торгові результати й участь у Community">
      <section className="public-profile-overview public-profile-panel" aria-labelledby="public-profile-overview-title">
        <div className="public-profile-overview-header">
          <div>
            <span className="public-profile-kicker">ІМПОРТОВАНІ ДАНІ БІРЖІ</span>
            <h2 id="public-profile-overview-title"><TrendingUp size={19} aria-hidden="true" /> Трейдерська статистика та результати</h2>
          </div>
          <span className="public-profile-overview-basis">Bybit linear · закриті ордери · доступний період</span>
        </div>
        {profile.statistics ? (
          <>
            <div className="public-profile-kpi-grid">
              <div className="public-profile-kpi"><span>Закриттів</span><strong>{overview.count}</strong><small>Імпортовані закриті ордери</small></div>
              <div className="public-profile-kpi public-profile-kpi-positive"><span>Win rate</span><strong>{overview.winRate === null ? "—" : overview.winRate.toFixed(1) + "%"}</strong><small>Беззбиткові не враховуються</small></div>
              <div className="public-profile-kpi"><span>Прибуткові</span><strong>{overview.wins}</strong><small>Закриття з прибутком</small></div>
              <div className="public-profile-kpi"><span>Збиткові</span><strong>{overview.losses}</strong><small>Закриття зі збитком</small></div>
              <div className="public-profile-kpi"><span>Беззбиткові</span><strong>{overview.flat}</strong><small>Закриття з нульовим PnL</small></div>
              {overview.pnl !== null && <div className="public-profile-kpi public-profile-kpi-pnl"><span>Сумарний PnL</span><strong>{overview.pnl} {overview.currency}</strong><small>У межах однієї валюти</small></div>}
            </div>
            <div className="public-profile-overview-foot">
              <p>Ці дані не є повною прибутковістю рахунку. Суми показуються лише з окремого дозволу власника. Показники різних валют не підсумовуються.</p>
              <button type="button" onClick={() => { setTab("statistics"); document.getElementById("public-profile-tabs")?.scrollIntoView({ block: "start", behavior: "smooth" }); }}>Детальна статистика <ArrowUpRight size={15} aria-hidden="true" /></button>
            </div>
          </>
        ) : (
          <div className="public-profile-overview-private">
            <ShieldCheck size={22} aria-hidden="true" />
            <p>Трейдер не відкрив торгову статистику. Показники не розраховуються й не підміняються демонстраційними числами.</p>
          </div>
        )}
      </section>

      <section className="public-profile-achievements public-profile-panel" aria-label="Заслуги та участь">
        <div className="public-profile-achievements-heading">
          <h2><Award size={19} aria-hidden="true" /> Заслуги та нагороди трейдера</h2>
          <span>Спільнота h00k</span>
        </div>
        <div className="public-profile-achievement-grid">
          {profileJoinDate && <div className="public-profile-achievement-card">
            <span className="public-profile-achievement-icon"><UsersRound size={23} aria-hidden="true" /></span>
            <div><strong>Учасник Community</strong><small>Дата приєднання: {profileJoinDate}</small></div>
          </div>}
          <div className="public-profile-achievement-empty">
            <Award size={20} aria-hidden="true" />
            <span>Підтверджені нагороди й торгові відзнаки ще не опубліковані. Бейджі не вигадуються на підставі PnL чи активності.</span>
          </div>
        </div>
      </section>


          <section className="public-profile-panel public-profile-right-help">
            <h2><MessageCircle size={18} aria-hidden="true" /> Спілкування</h2>
            <p>Хочете обговорити ідею або запросити трейдера у друзі? Перейдіть до Community та увійдіть у свій акаунт.</p>
            <a href={communityUrl!}><UsersRound size={15} aria-hidden="true" /> Відкрити Community <ArrowUpRight size={14} aria-hidden="true" /></a>
          </section>
        </aside>
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
