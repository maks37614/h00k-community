import { AccountSecuritySettings } from "./AccountSecuritySettings";
import { PublicProfileSettings } from "./PublicProfileSettings";
import { CommunityNotificationCenter } from "./CommunityNotificationCenter";
import { CommunityTradingSessions } from "./CommunityTradingSessions";
import { CommunityConceptProfile } from "./CommunityConceptProfile";
import { ownerAvatarUrl } from "./profileMediaAvatar";
import { CommunityAwardPanel } from "./CommunityAwardPanel";
import { STRATEGY_PRESETS } from "../hookchart/strategyEngine";
import { saveChartArchive } from "../../community/archiveChart";
import { chartFromScreenerHandoff } from "../../community/screenerHandoff";
import { assessArchiveProofDraft } from "../../community/archiveScoreBinding";
import { ArchiveScoreProvenance } from "./ArchiveScoreProvenance";
import React, { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, useId } from "react";
import {
  Users,
  ShieldCheck,
  MessageCircle,
  Bell,
  BellOff,
  CalendarCheck,
  Clock3,
  BookOpen,
  Settings,
  X,
  Plus,
  ArrowLeft,
  ImagePlus,
  Smile,
  Send,
  ChartNoAxesCombined,
  Copy,
  Check,
  Gift,
  Bookmark,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useArchive } from "../../context/ArchiveContext";
import { apiJson } from "../../utils/apiFetch";
import { parseWatchlistKey } from "../../utils/watchlistUtils";
import {
  captureChartDocument,
  cloneChartDocument,
  type ChartDocument,
} from "../../community/chartDocument";
import type {
  ArchivedFormation,
  DetectedFormation,
  Timeframe,
} from "../../types";
import { ChartPreview } from "./ChartPreview";
import { PublicSetupGalleryToolbar } from "../../community/PublicSetupGalleryToolbar";
import { DEFAULT_PUBLIC_SETUP_FILTERS, filterPublicSetupGallery, type PublicSetupGalleryFilters } from "../../community/publicSetupGalleryModel";
import { CommunityItemEditor } from "./CommunityItemEditor";
import { CommunityReactions } from "./CommunityReactions";
import { CommunityPhotoGallery } from "./CommunityPhotoGallery";
import "./community.css";
import "./social-friends-settings.css";
import "./social-chat-workspace.css";
import { filterConversations, conversationDisplayTitle } from "./chatModel";
import { buildFriendDirectory, type CommunityFriend, type FriendFilter } from "./friendsModel";
import { canSendCommunityContent, communityAudienceHint, validateCommunityPhoto, MAX_COMMUNITY_PHOTOS } from "./composerPolicy";
import { canShareReplyWithAudience, normalizeReplyAudience, replyAudienceOptions, replyBody, replyPreviewText, type ReplySource, type CommentAudience } from "./commentReplyModel";
import "./social-composer-posts.css";
import "./social-quality-proof.css";
import "./social-edit-items.css";
import "./social-photo-gallery.css";
import "./social-profile-actions.css";
import "./social-profile-tabs.css";
import "./social-profile-gallery.css";
import "./social-profile-hero.css";
import "./social-resource-library.css";
import "./social-concept-layout.css";
const SharedHookChart = lazy(() => import("./SharedHookChart"));
type Tab =
  | "feed"
  | "day"
  | "sessions"
  | "strategies"
  | "trades"
  | "learning"
  | "chats"
  | "friends"
  | "profile"
  | "settings";
type Target = {
  kind: "post" | "comment" | "message";
  audience?: CommentAudience;
  parentId?: string;
  conversationId?: string;
  replyTo?: ReplySource;
};
type DraftChart = {
  // Unique for each editor opening, even if the source chart and candle time
  // match. Never let an earlier editor's proof text or savedId leak through.
  editorSessionId: string;
  document: ChartDocument;
  parentId?: string;
  historyId?: string;
  target: Target;
};
type ChatInvite = { id: string; name: string };
const emojis = ["👍", "🔥", "🤔", "📈", "📉", "✅", "💡", "🙂"];
function Audience({
  value,
  onChange,
  id,
  allowedValues = ["private", "friends", "public"],
}: {
  value: string;
  onChange: (value: CommentAudience) => void;
  id?: string;
  allowedValues?: readonly CommentAudience[];
}) {
  const labels: Record<CommentAudience, string> = {
    private: "Лише я",
    friends: "Друзі",
    public: "Публічно",
  };
  return (
    <select
      id={id}
      aria-label="Аудиторія"
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        if (next === "private" || next === "friends" || next === "public") onChange(next);
      }}
    >
      {allowedValues.map((scope) => (
        <option key={scope} value={scope}>{labels[scope]}</option>
      ))}
    </select>
  );
}
function useResource(key: string, loader: () => Promise<any>) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [version, update] = useState(0),
    fn = useRef(loader);
  fn.current = loader;
  useEffect(() => {
    let active = true;
    setError("");
    setData(null);
    void fn
      .current()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [key, version]);
  return { data, error, refresh: () => update((v) => v + 1) };
}
const post = (url: string, body: unknown) =>
  apiJson(url, { method: "POST", body: JSON.stringify(body) });
const api = "/api/community";

export function CommunityPage({ onReplay }: { onReplay: () => void }) {
  const { user, profile } = useAuth();
  const { archivedFormations } = useArchive();
  const [tab, setTab] = useState<Tab>(() => {
      const section = new URLSearchParams(location.hash.split("?")[1] ?? "").get("section");
      return (["feed","day","sessions","strategies","trades","learning","chats","friends","profile","settings"] as string[]).includes(section ?? "") ? section as Tab : "feed";
    }),
    [notice, setNotice] = useState(""),
    [picker, setPicker] = useState<Target | null>(null),
    [draft, setDraft] = useState<DraftChart | null>(null);
  const [chatInvite, setChatInvite] = useState<ChatInvite | null>(null);
  const [awardRecipient, setAwardRecipient] = useState<{ id: string; name: string } | null>(null);
  const [viewProfile, setViewProfile] = useState<string | null>(() => {
    const owner = new URLSearchParams(location.hash.split("?")[1] ?? "").get("owner");
    return owner && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(owner) ? owner : null;
  }),
    [revision, bump] = useState(0);
  async function run(fn: () => Promise<unknown>) {
    setNotice("");
    try {
      await fn();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Не вдалося виконати дію",
      );
    }
  }
  const changed = () => bump((v) => v + 1);
  const [chatUnread, setChatUnread] = useState(0);
  useEffect(() => {
    if (!user?.uid) { setChatUnread(0); return; }
    let active = true, inFlight = false;
    const refresh = () => {
      if (!active || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      void apiJson(api + "/conversations/unread")
        .then(result => {
          if (active && Number.isFinite(result.unread))
            setChatUnread(Math.max(0, Math.min(100, result.unread)));
        })
        .catch(() => { /* A transient failure must not block Community navigation. */ })
        .finally(() => { inFlight = false; });
    };
    refresh();
    const timer = setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("community:chat-read", refresh);
    window.addEventListener("community:chat-muted", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("community:chat-read", refresh);
      window.removeEventListener("community:chat-muted", refresh);
    };
  }, [user?.uid]);
  useEffect(() => {
    const jump = () => {
      const query = new URLSearchParams(location.hash.split("?")[1] ?? "");
      const section = query.get("section");
      if (section && (["feed","day","sessions","strategies","trades","learning","chats","friends","profile","settings"] as string[]).includes(section)) {
        if (section === "profile") {
          const owner = query.get("owner");
          setViewProfile(owner && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(owner) ? owner : null);
        } else {
          setViewProfile(null);
        }
        setTab(section as Tab);
      }
      if (query.has("post")) setTab("feed");
    };
    window.addEventListener("hashchange", jump);
    return () => window.removeEventListener("hashchange", jump);
  }, []);
  // Import is explicit on h00k.top. Clear the fragment before placing any
  // market bars in React state, and NEVER publish without user confirmation.
  useEffect(() => {
    const query = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
    const packet = query.get("handoff");
    if (!packet) return;
    query.delete("handoff");
    const safeHash = "#community?" + (query.toString() || "section=feed");
    window.history.replaceState(window.history.state, "", window.location.pathname +
      window.location.search + safeHash);
    try {
      const document = chartFromScreenerHandoff(packet);
      setTab("feed");
      setViewProfile(null);
      setDraft({
        editorSessionId: crypto.randomUUID(), document, target: { kind: "post" } });
      setNotice("Чернетку за посиланням підготовлено. Походження свічок у посиланні не перевірене незалежно. Перевірте рівні; опублікувати її можете тільки ви.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Не вдалося імпортувати форму графіка.");
    }
  }, []);

  const openChart = (item: any, target?: Target) =>
    run(async () => {
      const data = await apiJson(api + "/charts/" + item.chart_id);
      setDraft({
        editorSessionId: crypto.randomUUID(),
        document: cloneChartDocument(data.document),
        parentId: item.chart_id,
        historyId: item.chart_id,
        target: target ?? { kind: "comment", parentId: item.id },
      });
    });
  const pickArchive = async (item: ArchivedFormation) => {
    const target = picker!;
    setPicker(null);
    if (item.chartDocument) {
      setDraft({
        editorSessionId: crypto.randomUUID(),
        document: cloneChartDocument(item.chartDocument),
        parentId: item.sourceChartId,
        historyId: item.sourceChartId,
        target,
      });
      return;
    }
    if (item.hasChartDocument) {
      await run(async () => {
        const full = await apiJson(
          api + "/archives/" + encodeURIComponent(item.id),
        );
        setDraft({
        editorSessionId: crypto.randomUUID(),
          document: cloneChartDocument(full.item.chartDocument),
          parentId: full.item.sourceChartId,
          historyId: full.item.sourceChartId,
          target,
        });
      });
      return;
    }
    await run(async () => {
      const before = Math.floor(item.savedAtTimestamp / 1000),
        params = new URLSearchParams({
          symbol: item.symbol,
          exchange: item.exchange,
          marketType: item.marketType,
          timeframe: item.timeframe,
          before: String(before),
        });
      const data = await apiJson(api + "/history?" + params);
      setDraft({
        editorSessionId: crypto.randomUUID(),
        document: captureChartDocument({
          symbol: item.symbol,
          exchange: item.exchange,
          marketType: item.marketType,
          timeframe: item.timeframe,
          capturedAt: item.savedAtTimestamp,
          candles: data.rows,
          markers: item.markers,
          drawings: [],
        }),
        target,
      });
    });
  };
  const pickCoin = async (key: string) => {
    const target = picker!,
      coin = parseWatchlistKey(key);
    setPicker(null);
    await run(async () => {
      const timeframe: Timeframe = profile?.defaultTimeframe ?? "1h",
        params = new URLSearchParams({
          ...coin,
          timeframe,
          before: String(Math.floor(Date.now() / 1000)),
        });
      const data = await apiJson(api + "/history?" + params);
      setDraft({
        editorSessionId: crypto.randomUUID(),
        document: captureChartDocument({
          ...coin,
          timeframe,
          candles: data.rows,
          markers: [],
          drawings: [],
        }),
        target,
      });
    });
  };
  const nav: [Tab, string, React.ReactNode][] = [
    ["feed", "Стрічка", <Users size={16} />],
    ["day", "Мій день", <CalendarCheck size={16} />],
    ["sessions", "Торгові сесії", <Clock3 size={16} />],
    ["strategies", "Стратегії", <BookOpen size={16} />],
    ["trades", "Угоди та статистика", <ShieldCheck size={16} />],
    ["learning", "Навчання", <BookOpen size={16} />],
    ["chats", "Чати", <MessageCircle size={16} />],
    ["friends", "Друзі", <Users size={16} />],
    ["profile", "Профіль", <Users size={16} />],
    ["settings", "Налаштування", <Settings size={16} />],
  ];
  if (!user)
    return (
      <section className="community-shell">
        <p>Увійдіть у h00k, щоб відкрити спільноту.</p>
      </section>
    );
  return (
    <section className="community-shell community-workspace">
      <header className="community-intro">
        <div>
          <span className="community-eyebrow">h00k COMMUNITY</span>
          <h1>Досвід, який можна обговорити й перевірити.</h1>
          <p>
            Плануйте день, працюйте зі стратегіями та діліться власним розбором.
            Ви визначаєте, хто бачить ваші дані.
          </p>
        </div>
        <div className="community-intro-actions">
          <CommunityNotificationCenter
            key={user.uid}
            onOpenSettings={() => {
              setViewProfile(null);
              setTab("settings");
            }}
            onNavigate={(destination) => {
              setViewProfile(null);
              setTab(destination.section);
              const params = new URLSearchParams({ section: destination.section });
              if (destination.section === "feed") params.set("post", destination.postId);
              if (destination.section === "chats") params.set("conversation", destination.conversationId);
              // The existing Feed/Chats endpoints enforce current account membership.
              location.hash = "community?" + params.toString();
            }}
            showChatNotices={profile?.community?.notificationChatInbox !== false}
            showSocialNotices={profile?.community?.notificationSocialInbox !== false}
          />
          <button type="button" className="community-chat-unread-shortcut" onClick={() => { setTab("chats"); setViewProfile(null); }}>
            <MessageCircle size={17} aria-hidden="true" /> Повідомлення
            {chatUnread > 0 && <span className="community-chat-unread-count" aria-label={"Непрочитані повідомлення: " + chatUnread}>{chatUnread >= 100 ? "99+" : chatUnread}</span>}
          </button>
          <button type="button" onClick={() => setTab("settings")}>
            <ShieldCheck size={18} /> Прозорість і захист
          </button>
        </div>
      </header>
      <div className={"community-dashboard" + (tab === "feed" ? " community-dashboard-feed" : "")}>
        <div className="community-sidebar">
          <CommunityConceptProfile
            version={revision}
            onProfile={() => { setViewProfile(null); setTab("profile"); }}
            onFriends={() => setTab("friends")}
            onSettings={() => setTab("settings")}
          />
        <details className="community-concept-navigation">
          <summary>Усі розділи Community</summary>
        <nav className="community-nav" aria-label="Розділи спільноти">
        {nav.map(([id, title, icon]) => (
          <button
            type="button"
            key={id}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => {
              setTab(id);
              setViewProfile(null);
            }}
          >
            {icon}
            {title}
            {id === "chats" && chatUnread > 0 && <span className="community-chat-unread-count" aria-label={"Непрочитані повідомлення: " + chatUnread}>{chatUnread >= 100 ? "99+" : chatUnread}</span>}
          </button>
        ))}
        </nav>
        </details>
        </div>
        <div className="community-main-pane">
      {notice && (
        <div className="community-notice" role="status">
          {notice}
          <button
            type="button"
            aria-label="Закрити повідомлення"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div className="community-content" key={user.uid}>
        {tab === "feed" && (
          <Feed
            key={"feed" + revision}
            onPick={setPicker}
            onChart={openChart}
            run={run}
            onProfile={(id) => {
              setViewProfile(id);
              setTab("profile");
            }}
            onAward={(id, name) => setAwardRecipient({ id, name })}
          />
        )}
        {tab === "sessions" && <CommunityTradingSessions variant="page" />}
        {tab === "day" && (
          <Workspace
            kind="plan"
            title="Мій день"
            onReplay={onReplay}
            run={run}
          />
        )}
        {tab === "strategies" && (
          <Workspace
            kind="strategy"
            title="Стратегії"
            onReplay={onReplay}
            run={run}
          />
        )}
        {tab === "learning" && (
          <>
            <Workspace
              kind="lesson"
              title="Уроки та знання"
              onReplay={onReplay}
              run={run}
            />
            <Workspace
              kind="test"
              title="Лабораторія спільних тестів"
              onReplay={onReplay}
              run={run}
            />
          </>
        )}
        {tab === "trades" && <Trades run={run} />}
        {tab === "chats" && (
          <Chats
            revision={revision}
            onPick={setPicker}
            onChart={openChart}
            run={run}
            inviteTarget={chatInvite}
            onInviteHandled={() => setChatInvite(null)}
          />
        )}
        {tab === "friends" && (
          <Friends
            run={run}
            onProfile={(id) => {
              setViewProfile(id);
              setTab("profile");
            }}
          />
        )}
        {tab === "profile" && (
          <Profile
            id={viewProfile ?? user.uid}
            onChart={openChart}
            onPick={setPicker}
            run={run}
            onChatInvite={(id, name) => {
              setChatInvite({ id, name });
              setTab("chats");
            }}
          />
        )}
        {tab === "settings" && <CommunitySettings run={run} />}
      </div>
        </div>
        {tab === "feed" && (
          <aside className="community-context-rail" aria-label="Швидкі переходи Community">
            <CommunityTradingSessions variant="sidebar" />
            <CommunityAwardPanel
              recipient={awardRecipient}
              onClear={() => setAwardRecipient(null)}
              onGifted={changed}
            />
            <div className="community-context-card">
              <span className="community-page-kicker">СПІЛЬНОТА</span>
              <h3>Ваш простір трейдера</h3>
              <p>Розбирайте ринок, діліться власними формаціями та спілкуйтеся з друзями.</p>
              <div className="community-context-actions">
                <button type="button" onClick={() => { setViewProfile(null); setTab("profile"); }}>
                  <Users size={16} /> Моя стіна
                </button>
                <button type="button" onClick={() => setTab("friends")}>
                  <Users size={16} /> Знайти друзів
                </button>
                <button type="button" onClick={() => setTab("chats")}>
                  <MessageCircle size={16} /> Мої повідомлення
                </button>
              </div>
            </div>
            <div className="community-context-card community-privacy-tip">
              <ShieldCheck size={19} aria-hidden="true" />
              <h3>Контроль приватності</h3>
              <p>Для кожної публікації можна вибрати аудиторію. Параметри профілю керуються окремо.</p>
              <button type="button" onClick={() => setTab("settings")}>
                Налаштувати приватність
              </button>
            </div>
          </aside>
        )}
      </div>
      {picker && (
        <div className="community-backdrop">
          <section
            className="community-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Додати графік із збережень"
          >
            <header>
              <h2>Виберіть збережений інструмент</h2>
              <button
                type="button"
                aria-label="Закрити"
                onClick={() => setPicker(null)}
              >
                <X />
              </button>
            </header>
            <p>
              Формації використовують уже збережений знімок. Для старого архіву
              або монети без свічок історія завантажується один раз через
              спільний кеш.
            </p>
            <h3>Обрані формації</h3>
            <div className="community-picker">
              {archivedFormations.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => void pickArchive(item)}
                >
                  <b>{item.symbol}</b>
                  <span>
                    {item.formationName} · {item.timeframe}
                  </span>
                </button>
              ))}
              {!archivedFormations.length && (
                <p>Збережіть формацію іконкою на графіку скрінера.</p>
              )}
            </div>
            <h3>Обрані монети</h3>
            <div className="community-picker">
              {(profile?.watchlist ?? []).map((key) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => void pickCoin(key)}
                >
                  {key}
                </button>
              ))}
              {!profile?.watchlist?.length && (
                <p>Додайте монети до наявного списку обраного у скрінері.</p>
              )}
            </div>
          </section>
        </div>
      )}
      {draft && (
        <ChartDialog
          key={draft.editorSessionId}
          draft={draft}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          notice={notice}
          onSaved={() => {
            setDraft(null);
            changed();
          }}
          run={run}
        />
      )}
    </section>
  );
}

type Run = (fn: () => Promise<unknown>) => Promise<void>;
function Composer({
  target,
  onPick,
  onSent,
  run,
  presetCategory,
}: {
  target: Target;
  onPick: (target: Target) => void;
  onSent: () => void;
  run: Run;
  presetCategory?: "education";
}) {
  const { user, profile } = useAuth();
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState(() => target.replyTo ? normalizeReplyAudience(target.replyTo.audience) : target.audience ? normalizeReplyAudience(target.audience) : target.kind === "post" ? "public" : "private");
  const [category, setCategory] = useState(presetCategory ?? "general");
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const inFlight = useRef(false);
  const clientId = useRef(crypto.randomUUID());
  const emojiPanelId = useId();
  const audienceId = useId();
  const canSubmit = canSendCommunityContent(text, photos.length, busy) &&
    canShareReplyWithAudience(target.replyTo, audience) &&
    (presetCategory !== "education" || title.trim().length > 0);
  const kindLabel = target.kind === "post" ? "Нова публікація" :
    target.kind === "comment" ? "Написати коментар" : "Нове повідомлення";

  function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !canSendCommunityContent(text, photos.length, false) ||
      !canShareReplyWithAudience(target.replyTo, audience) ||
      (presetCategory === "education" && !title.trim())) return;
    inFlight.current = true;
    setBusy(true);
    setPhotoError("");
    void run(async () => {
      await post(api + "/items", {
        kind: target.kind,
        parentId: target.parentId,
        conversationId: target.conversationId,
        audience,
        clientId: clientId.current,
        body: { ...replyBody(text, photos, target.replyTo), ...(target.kind === "post"
          ? { category: presetCategory ?? category, ...(title.trim() ? { title: title.trim() } : {}) }
          : {}) },
      });
      setText("");
      setTitle("");
      setPhotos([]);
      setShowEmojis(false);
      clientId.current = crypto.randomUUID();
      onSent();
    }).finally(() => {
      inFlight.current = false;
      setBusy(false);
    });
  }

  function uploadPhoto(file: File) {
    const error = validateCommunityPhoto(file, photos.length);
    if (error) {
      setPhotoError(error);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setPhotoError("");
    void run(async () => {
      const data = await apiJson(api + "/media", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (typeof data.id !== "string" || !data.id) {
        throw new Error("Не вдалося додати фото до публікації");
      }
      setPhotos((prev) => [...prev, data.id]);
    }).finally(() => {
      inFlight.current = false;
      setBusy(false);
    });
  }

  return (
    <form
      className={"community-composer community-composer-" + target.kind}
      onSubmit={send}
      aria-label={kindLabel}
    >
      {target.kind === "post" && (
        <header className="community-composer-head">
          <span className="community-composer-avatar" aria-hidden="true">
            {ownerAvatarUrl(profile?.community)
              ? <img src={ownerAvatarUrl(profile?.community)!} alt="" />
              : (profile?.displayName ?? user?.displayName ?? "Т").trim().slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>{profile?.displayName ?? user?.displayName ?? "Трейдер"}</strong>
            <small>Поділіться ідеєю з обраною аудиторією</small>
          </div>
          <span className="community-composer-kind">h00k Community</span>
        </header>
      )}
      {target.kind !== "post" && (
        <div className="community-composer-context">
          <span className="community-page-kicker">{kindLabel}</span>
        </div>
      )}
      {target.kind === "comment" && target.replyTo && (
        <blockquote className="community-reply-composer-quote">
          <span>Відповідь на коментар {target.replyTo.displayName}</span>
          <p>{replyPreviewText(target.replyTo.text) || "Коментар із вкладенням"}</p>
          <small>Відповідь залишиться в обговоренні цього допису.</small>
        </blockquote>
      )}
      {target.kind === "post" && (presetCategory === "education" || category === "education") && (
        <label className="community-article-title-label">Назва статті
          <input type="text" aria-label="Назва статті" maxLength={200} value={title}
            placeholder="Про що цей навчальний розбір?" disabled={busy}
            required={presetCategory === "education"}
            onChange={event => setTitle(event.target.value)} />
        </label>
      )}
      <textarea
        aria-label={
          target.kind === "comment"
            ? "Текст коментаря"
            : target.kind === "message"
              ? "Текст повідомлення"
              : "Текст публікації"
        }
        placeholder={
          target.kind === "post"
            ? "Поділіться формацією, аналізом ринку або торговою ідеєю…"
            : target.kind === "comment"
              ? "Ваша відповідь на публікацію…"
              : "Ваше повідомлення…"
        }
        value={text}
        maxLength={20_000}
        disabled={busy}
        onChange={(event) => setText(event.target.value)}
        required={!photos.length}
      />
      <div className="community-composer-meta">
        <span>{communityAudienceHint(target.kind, audience)}</span>
        <span>{text.length.toLocaleString("uk-UA")} / 20 000</span>
      </div>
      <div className="community-composer-tools">
        <div className="community-composer-attachments">
          <button
            type="button"
            className="community-composer-tool"
            disabled={busy}
            aria-label="Обрати графік із збережень"
            onClick={() => onPick(target)}
          >
            <ChartNoAxesCombined size={17} aria-hidden="true" /> <span>Графік</span>
          </button>
          <label className="community-file community-composer-file">
            <ImagePlus size={17} aria-hidden="true" /> <span>Фото</span>
            <input
              aria-label="Додати фото"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={photos.length >= MAX_COMMUNITY_PHOTOS || busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadPhoto(file);
                event.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            className="community-composer-tool"
            disabled={busy}
            aria-expanded={showEmojis}
            aria-controls={emojiPanelId}
            onClick={() => setShowEmojis((value) => !value)}
          >
            <Smile size={17} aria-hidden="true" /> <span>Емодзі</span>
          </button>
        </div>
        {target.kind === "post" && !presetCategory && (
          <label className="community-concept-category-label">Розділ
            <select aria-label="Категорія публікації" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="general">Стрічка</option>
              <option value="idea">Ідеї</option>
              <option value="analysis">Аналіз</option>
              <option value="education">Навчання</option>
            </select>
          </label>
        )}
        {target.kind !== "message" && (
          <div className="community-composer-audience">
            <label htmlFor={audienceId}>
              Аудиторія
            </label>
            <Audience id={audienceId} value={audience} onChange={setAudience} allowedValues={replyAudienceOptions(target.replyTo)} />
          </div>
        )}
        <button type="submit" className="community-primary community-composer-send" disabled={!canSubmit}>
          <Send size={16} aria-hidden="true" />
          {busy ? "Зберігаємо…" : target.kind === "post" ? "Опублікувати" : "Надіслати"}
        </button>
      </div>
      {showEmojis && (
        <div className="community-composer-emojis" id={emojiPanelId} aria-label="Вибір емодзі">
          {emojis.map((emoji) => (
            <button
              type="button"
              key={emoji}
              disabled={busy}
              aria-label={`Додати ${emoji}`}
              onClick={() => setText((value) => value + emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      {photoError && <p className="community-composer-error" role="alert">{photoError}</p>}
      {!!photos.length && (
        <div className="community-composer-uploaded" aria-label="Завантажені фото">
          <span>{photos.length} з {MAX_COMMUNITY_PHOTOS} фото</span>
          <div className="community-photo-strip">
            {photos.map((id) => (
              <button
                type="button"
                key={id}
                className="community-composer-photo"
                aria-label="Прибрати фото з публікації"
                disabled={busy}
                onClick={() => setPhotos((prev) => prev.filter((item) => item !== id))}
              >
                <img alt="Завантажене фото" src={api + "/media/" + id} />
                <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
function Feed({
  onPick,
  onChart,
  run,
  onProfile,
  onAward,
}: {
  onPick: (t: Target) => void;
  onChart: (item: any, target?: Target) => Promise<void>;
  run: Run;
  onProfile: (id: string) => void;
  onAward: (id: string, name: string) => void;
}) {
  const { user } = useAuth();
  const [category, setCategory] = useState("all");
  const [mode, setMode] = useState(
    () => localStorage.getItem("h00k-community-feed:" + user?.uid) ?? "public",
  );
  const [data, setData] = useState<any[]>([]),
    [next, setNext] = useState<string | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const currentMode = useRef(mode);
  const currentCategory = useRef(category);
  const requestNumber = useRef(0);
  currentMode.current = mode;
  currentCategory.current = category;
  const [linkedId, setLinkedId] = useState(
    () =>
      new URLSearchParams(location.hash.split("?")[1] ?? "").get("post") ?? "",
  );
  const linked = useResource("linked-post:" + linkedId, () =>
    linkedId
      ? apiJson(api + "/items/" + encodeURIComponent(linkedId))
      : Promise.resolve({ item: null }),
  );
  useEffect(() => {
    const jump = () =>
      setLinkedId(
        new URLSearchParams(location.hash.split("?")[1] ?? "").get("post") ??
          "",
      );
    window.addEventListener("hashchange", jump);
    return () => window.removeEventListener("hashchange", jump);
  }, []);
  async function load(before?: string) {
    const startedMode = mode;
    const startedCategory = category;
    const request = ++requestNumber.current;
    setLoading(true);
    try {
      const d = await apiJson(
        api +
          (mode === "saved" ? "/saved?" : "/feed?") +
          new URLSearchParams({ ...(mode !== "saved" ? { mode, ...(category !== "all" ? { category } : {}) } : {}), ...(before ? { before } : {}) }),
      );
      if (
        currentMode.current !== startedMode ||
        currentCategory.current !== startedCategory ||
        requestNumber.current !== request
      )
        return;
      setData((old) => (before ? [...old, ...d.items] : d.items));
      setNext(d.next);
      setError("");
    } catch (e) {
      if (
        currentMode.current !== startedMode ||
        currentCategory.current !== startedCategory ||
        requestNumber.current !== request
      )
        return;
      setError(e instanceof Error ? e.message : "Стрічка недоступна");
    } finally {
      if (
        currentMode.current === startedMode &&
        currentCategory.current === startedCategory &&
        requestNumber.current === request
      )
        setLoading(false);
    }
  }
  useEffect(() => {
    setData([]);
    setNext(null);
    void load();
    localStorage.setItem("h00k-community-feed:" + user?.uid, mode);
  }, [mode, category, user?.uid]);
  return (
    <section className="community-feed-view" aria-label="Стрічка спільноти">
      <div className="community-section-heading community-feed-heading">
        <div className="community-feed-title">
          <span className="community-page-kicker">ТРЕЙДЕРСЬКА СПІЛЬНОТА</span>
          <h2>Стрічка</h2>
        </div>
        <div className="community-segment">
          <button
            type="button"
            aria-pressed={mode === "friends"}
            onClick={() => setMode("friends")}
          >
            Друзі
          </button>
          <button
            type="button"
            aria-pressed={mode === "public"}
            onClick={() => setMode("public")}
          >
            Публічні
          </button>
          <button type="button" aria-pressed={mode === "saved"} onClick={() => { setCategory("all"); setMode("saved"); }}>
            <Bookmark size={14} aria-hidden="true" /> Збережені
          </button>
        </div>
      </div>
      {mode !== "saved" && <nav className="community-concept-feed-tabs" aria-label="Категорії публікацій">
        {([["all", "Стрічка"], ["idea", "Ідеї"], ["analysis", "Аналіз"], ["education", "Навчання"]] as const).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={category === id} onClick={() => setCategory(id)}>{label}</button>
        ))}
        <span className="community-concept-feed-order">Найновіші ↓</span>
      </nav>}
      <Composer
        target={{ kind: "post" }}
        onPick={onPick}
        onSent={() => { if (mode === "saved") setMode("public"); else void load(); }}
        run={run}
      />
      {linkedId && (
        <section aria-label="Дописи за посиланням">
          <button
            type="button"
            onClick={() => {
              setLinkedId("");
              history.replaceState(null, "", "#community");
            }}
          >
            Закрити допис за посиланням
          </button>
          {linked.error && <p role="status">{linked.error}</p>}
          {linked.data?.item && (
            <ItemCard
              item={linked.data.item}
              onChart={onChart}
              onPick={onPick}
              run={run}
              refresh={linked.refresh}
              onProfile={onProfile}
              onAward={onAward}
            />
          )}
        </section>
      )}
      {error && <p role="status">{error}</p>}
      {loading && !data.length && <p>Завантаження…</p>}
      {!loading && !data.length && !error && (
        <div className="community-empty">
          Тут будуть{" "}
          {mode === "saved" ? "ваші збережені дописи" : mode === "friends" ? "дописи ваших друзів" : "публічні дописи"}.
          Збережіть формацію у скрінері й поділіться своїм першим розбором.
        </div>
      )}
      {data
        .filter((item) => item.id !== linked.data?.item?.id)
        .map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            onChart={onChart}
            onPick={onPick}
            run={run}
            refresh={() => void load()}
            onProfile={onProfile}
            onAward={onAward}
          />
        ))}
      {next && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void load(next)}
        >
          Завантажити ще
        </button>
      )}
    </section>
  );
}

function ItemCard({
  item,
  onChart,
  onPick,
  run,
  refresh,
  onProfile,
  onAward,
}: {
  item: any;
  onChart: (item: any, target?: Target) => Promise<void>;
  onPick: (t: Target) => void;
  run: Run;
  refresh: () => void;
  onProfile?: (id: string) => void;
  onAward?: (id: string, name: string) => void;
}) {
  const { user } = useAuth();
  const [reply, setReply] = useState(false);
  const [editing, setEditing] = useState(false);
  const [bookmarked, setBookmarked] = useState(Boolean(item.saved));
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  useEffect(() => { setBookmarked(Boolean(item.saved)); }, [item.id, item.saved]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [selectedReply, setSelectedReply] = useState<ReplySource | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  async function copyPostLink() {
    try {
      await navigator.clipboard.writeText(
        location.origin + "/#community?post=" + encodeURIComponent(item.id),
      );
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }
  const thread = useResource((reply ? "open:" : "closed:") + item.id, () =>
    reply
      ? apiJson(api + "/items/" + item.id + "/comments")
      : Promise.resolve(null),
  );
  const [moreComments, setMoreComments] = useState<any[]>([]),
    [nextComment, setNextComment] = useState<string | null>(null);
  useEffect(() => {
    setMoreComments([]);
    setNextComment(thread.data?.next ?? null);
  }, [thread.data]);
  useEffect(() => { if (!reply) setSelectedReply(null); }, [reply]);
  const target: Target =
    item.kind === "message"
      ? { kind: "message", conversationId: item.conversation_id }
      : { kind: "comment", parentId: item.id, audience: normalizeReplyAudience(item.audience) };
  return (
    <article className={"community-card community-post-card" + (item.kind === "message" ? " community-message-card" : "")}>
      <header>
        <button
          type="button"
          className="community-author"
          onClick={() => onProfile?.(item.owner_id)}
        >
          <span className="community-avatar">
            {(item.author?.displayName ?? "T").slice(0, 1)}
          </span>
          <span>
            <b>{item.author?.displayName ?? "Трейдер"}</b>
            <small>
              {new Date(item.created_at).toLocaleString("uk-UA")} ·{" "}
              {item.kind === "message"
                ? "Учасникам чату"
                : item.audience === "public"
                  ? "Публічно"
                  : item.audience === "friends"
                    ? "Друзям"
                    : "Лише автору"}
              {item.revision > 1 ? " · змінено" : ""}
            </small>
          </span>
        </button>
        <div>
          {item.owner_id === user?.uid ? (
            <>
              {item.kind === "post" && (
                <button
                  type="button"
                  aria-expanded={editing}
                  aria-label="Редагувати свій допис"
                  onClick={() => setEditing((current) => !current)}
                >
                  {editing ? "Закрити редактор" : "Редагувати"}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm("Видалити цей матеріал без можливості відновлення?")) return;
                  void run(async () => {
                    await apiJson(api + "/items/" + item.id, {
                      method: "DELETE",
                    });
                    refresh();
                  });
                }}
              >
                Видалити
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                const reason = window.prompt("Причина скарги");
                if (reason)
                  void run(async () => {
                    await post(api + "/reports", { itemId: item.id, reason });
                  });
              }}
            >
              Скарга
            </button>
          )}
        </div>
      </header>
      {editing && item.kind === "post" && (
        <CommunityItemEditor
          item={item}
          onCancel={() => setEditing(false)}
          onSaved={() => { setEditing(false); refresh(); }}
        />
      )}
      {!editing && (
        <>
      {item.kind === "post" && <span className="community-concept-post-category">{({ idea: "Ідея", analysis: "Аналіз", education: "Навчання", general: "Публікація" } as Record<string, string>)[item.body?.category] ?? "Публікація"}</span>}
      {item.body?.title && <h3>{item.body.title}</h3>}
      <p className="community-text">{item.body?.text}</p>
      {item.source && (
        <blockquote>
          <b>Поширений матеріал</b>
          <p>{item.source.text}</p>
        </blockquote>
      )}
      {item.chart && (
        <ChartPreview
          document={item.chart}
          authorizedServerSnapshot
          onOpen={() => void onChart(item, target)}
        />
      )}
      {!!item.body?.photos?.length && (
        <CommunityPhotoGallery
          ids={item.body.photos}
          label="Фото допису"
        />
      )}
      <footer className="community-card-actions" aria-label="Дії з публікацією">
        <CommunityReactions
          itemId={item.id}
          reactions={item.reactions}
          run={run}
          refresh={refresh}
          variant={item.kind === "message" ? "message" : "post"}
        />
        {item.kind === "post" && (
          <button type="button" aria-pressed={bookmarked} disabled={bookmarkBusy}
            onClick={() => {
              setBookmarkBusy(true);
              void run(async () => {
                const result = await post(api + "/items/" + item.id + "/save", {});
                setBookmarked(Boolean(result.saved));
                refresh();
              }).finally(() => setBookmarkBusy(false));
            }}>
            <Bookmark size={15} aria-hidden="true" /> {bookmarked ? "Збережено" : "Зберегти"}
          </button>
        )}
        {item.kind === "post" && onAward && item.owner_id !== user?.uid && (
          <button type="button" className="community-concept-gift-author" onClick={() => onAward(item.owner_id, item.author?.displayName ?? "Трейдер")}>
            <Gift size={15} aria-hidden="true" /> Нагородити
          </button>
        )}
        {item.kind === "post" && (
          <button
            type="button"
            aria-expanded={reply}
            onClick={() => setReply((v) => !v)}
          >
            <MessageCircle size={15} aria-hidden="true" />
            {reply ? "Згорнути коментарі" : "Коментарі"}
          </button>
        )}
        {item.chart && (
          <button type="button" onClick={() => void onChart(item, target)}>
            Відповісти графіком
          </button>
        )}
        {item.kind === "post" && (
          <button
            type="button"
            onClick={() =>
              void run(async () => {
                await post(api + "/items", {
                  kind: "post",
                  audience: item.audience,
                  body: {
                    text: "",
                    title: "Поширений розбір",
                    sourceItemId: item.id,
                  },
                });
                refresh();
              })
            }
          >
            На свою стіну
          </button>
        )}
        {item.audience === "public" && item.kind === "post" && (
          <button
            type="button"
            className="community-post-copy"
            onClick={() => void copyPostLink()}
          >
            {copyStatus === "copied" ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
            {copyStatus === "copied" ? "Посилання скопійовано" : "Копіювати посилання"}
          </button>
        )}
        {copyStatus === "error" && (
          <span className="community-copy-error" role="status">Не вдалося скопіювати посилання</span>
        )}
        {item.audience === "public" && item.kind === "post" && (
          <a
            target="_blank"
            rel="noopener noreferrer"
            href={
              "https://t.me/share/url?" +
              new URLSearchParams({
                url: location.origin + "/#community?post=" + item.id,
                text: item.body.text?.slice(0, 500) ?? "",
              })
            }
          >
            Telegram ↗
          </a>
        )}
      </footer>
        </>
      )}
      {reply && (
        <div className="community-comments">
          {thread.error && <p role="status">{thread.error}</p>}
          {[...(thread.data?.items ?? []), ...moreComments].map(
            (comment: any) => (
              <article className="community-comment" key={comment.id}>
                <header className="community-comment-head">
                  <span className="community-comment-avatar" aria-hidden="true">
                    {(comment.author?.displayName ?? "Т").trim().slice(0, 1).toUpperCase()}
                  </span>
                  <div className="community-comment-identity">
                    <strong>{comment.author?.displayName ?? "Трейдер"}</strong>
                    <time dateTime={comment.created_at}>
                      {new Date(comment.created_at).toLocaleString("uk-UA")}
                    </time>
                  </div>
                  {comment.owner_id === user?.uid && (
                    <button
                      type="button"
                      aria-expanded={editingCommentId === comment.id}
                      onClick={() => setEditingCommentId((current) => current === comment.id ? null : comment.id)}
                    >
                      {editingCommentId === comment.id ? "Закрити редактор" : "Редагувати"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      void run(async () => {
                        if (comment.owner_id === user?.uid) {
                          if (!window.confirm("Видалити коментар без можливості відновлення?")) return;
                          await apiJson(api + "/items/" + comment.id, { method: "DELETE" });
                        } else {
                          const reason = window.prompt(
                            "Причина скарги на коментар",
                          );
                          if (!reason) return;
                          await post(api + "/reports", {
                            itemId: comment.id,
                            reason,
                          });
                        }
                        thread.refresh();
                      })
                    }
                  >
                    {comment.owner_id === user?.uid ? "Видалити" : "Скарга"}
                  </button>
                </header>
                {editingCommentId === comment.id ? (
                  <CommunityItemEditor
                    item={comment}
                    onCancel={() => setEditingCommentId(null)}
                    onSaved={() => { setEditingCommentId(null); thread.refresh(); }}
                  />
                ) : (
                  <p>{comment.body.text}</p>
                )}
                {comment.source && (
                  <blockquote className="community-comment-quoted">
                    <span>У відповідь на коментар</span>
                    <p>{replyPreviewText(comment.source.text) || "Коментар із вкладенням"}</p>
                  </blockquote>
                )}
                {comment.chart && (
                  <ChartPreview
                    document={comment.chart}
                    authorizedServerSnapshot
                    onOpen={() =>
                      void onChart(comment, {
                        kind: "comment",
                        parentId: item.id,
                        replyTo: {
                          id: comment.id,
                          displayName: comment.author?.displayName ?? "Трейдер",
                          text: comment.body?.text ?? "",
                          audience: comment.audience,
                        },
                      })
                    }
                  />
                )}
                {!!comment.body.photos?.length && (
                  <CommunityPhotoGallery
                    ids={comment.body.photos}
                    label="Фото коментаря"
                  />
                )}
                <CommunityReactions
                  itemId={comment.id}
                  reactions={comment.reactions}
                  run={run}
                  refresh={thread.refresh}
                  variant="comment"
                />
                <div className="community-comment-reply-actions">
                  <button
                    type="button"
                    aria-expanded={selectedReply?.id === comment.id}
                    onClick={() => {
                      setSelectedReply((current) =>
                        current?.id === comment.id
                          ? null
                          : {
                              id: comment.id,
                              displayName: comment.author?.displayName ?? "Трейдер",
                              text: comment.body?.text ?? "",
                              audience: comment.audience,
                            },
                      );
                    }}
                  >
                    {selectedReply?.id === comment.id ? "Скасувати відповідь" : "Відповісти"}
                  </button>
                </div>
                {selectedReply?.id === comment.id && (
                  <Composer
                    key={comment.id}
                    target={{ ...target, replyTo: selectedReply }}
                    onPick={onPick}
                    onSent={() => {
                      setSelectedReply(null);
                      thread.refresh();
                      refresh();
                    }}
                    run={run}
                  />
                )}
              </article>
            ),
          )}
          {nextComment && (
            <button
              type="button"
              onClick={() =>
                void run(async () => {
                  const data = await apiJson(
                    api +
                      "/items/" +
                      item.id +
                      "/comments?after=" +
                      nextComment,
                  );
                  setMoreComments((old) => [
                    ...new Map(
                      [...old, ...data.items].map((comment: any) => [
                        comment.id,
                        comment,
                      ]),
                    ).values(),
                  ]);
                  setNextComment(data.next);
                })
              }
            >
              Наступні коментарі
            </button>
          )}
          <Composer
            target={target}
            onPick={onPick}
            onSent={() => {
              thread.refresh();
              refresh();
            }}
            run={run}
          />
        </div>
      )}
    </article>
  );
}

function ChartDialog({
  draft,
  onChange,
  onClose,
  onSaved,
  run,
  notice,
}: {
  notice: string;
  draft: DraftChart;
  onChange: (v: DraftChart) => void;
  onClose: () => void;
  onSaved: () => void;
  run: Run;
}) {
  const { user } = useAuth();
  const [qualityProofText, setQualityProofText] = useState(() => !draft.parentId && draft.document.qualityProof ? JSON.stringify(draft.document.qualityProof) : "");
  const [text, setText] = useState(""),
    [category, setCategory] = useState("analysis"),
    [audience, setAudience] = useState(() => draft.target.replyTo ? normalizeReplyAudience(draft.target.replyTo.audience) : "private"),
    [target, setTarget] = useState(draft.target),
    [busy, setBusy] = useState(false),
    [savedId, setSavedId] = useState<string | null>(draft.historyId ?? null);
  const conversations = useResource("chart-conversations", () =>
    apiJson(api + "/conversations"),
  );
  // This only checks structure and correspondence with the edited HookChart;
  // Ed25519 verification remains exclusively on the Community server.
  const [, refreshProofStatus] = useState(0);
  const scoreAssessment = assessArchiveProofDraft(qualityProofText, draft.document);
  const scoreBlocked = scoreAssessment.status !== "none" && scoreAssessment.status !== "ready";
  const proofExpiry = scoreAssessment.status === "ready" ? scoreAssessment.proof.payload.expiresAt : null;
  useEffect(() => {
    if (proofExpiry === null) return;
    // Refresh a ready proof immediately after expiry. A suspended mobile tab
    // also rechecks on resume. Neither operation sends network requests.
    const delay = Math.max(0, Math.min(2_147_483_647, proofExpiry + 1 - Date.now()));
    const timeout = window.setTimeout(() => refreshProofStatus(n => n + 1), delay);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshProofStatus(n => n + 1);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [proofExpiry]);
  function currentProof() {
    if (draft.parentId && qualityProofText.trim())
      throw new Error("Оцінку з архіву можна додати лише до нового власного графіка.");
    const result = assessArchiveProofDraft(qualityProofText, draft.document);
    if (result.status === "invalid" || result.status === "mismatch" || result.status === "expired")
      throw new Error(result.message);
    return result.status === "ready" ? result.proof : undefined;
  }
  const removeProof = () => {
    setQualityProofText("");
    const { qualityProof: _discardedProof, ...cleanDocument } = draft.document;
    onChange({ ...draft, document: cleanDocument });
  };
  async function chartId() {
    // A fork must not inherit the original author's signed provenance.
    // Only an explicit fresh export may be imported on a new source chart.
    const { qualityProof: _oldProof, ...chartWithoutProof } = draft.document;
    const qualityProof = currentProof();
    const d = await post(api + "/charts", {
      document: { ...chartWithoutProof, ...(qualityProof ? { qualityProof } : {}) },
      parentId: draft.parentId,
    });
    setSavedId(d.id);
    return d.id as string;
  }
  const saveArchive = () =>
    run(async () => {
      // Local favourites use the same preflight; never retain a stale score
      // when the user explicitly removes its provenance from this draft.
      const { qualityProof: _oldProof, ...cleanDocument } = draft.document;
      const qualityProof = currentProof();
      await saveChartArchive({
        ...cleanDocument, ...(qualityProof ? { qualityProof } : {}),
      }, user!.uid, text, draft.parentId);
      window.dispatchEvent(new Event("h00k:archive-saved"));
      onSaved();
    });
  return (
    <div className="community-backdrop">
      <section
        className="community-dialog community-chart-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Ваш варіант HookChart"
      >
        <header>
          <div>
            <h2>Ваш варіант розбору</h2>
            <p>Оригінальний матеріал зберігається без змін</p>
          </div>
          <button type="button" aria-label="Закрити редактор" onClick={onClose}>
            <X />
          </button>
        </header>
        {!savedId && <p className="community-chart-draft-privacy-note" role="note">
          Це ще не опублікована чернетка. Завантаження додаткової історії вимкнено:
          графік не надсилатиметься на сервер до вашої явної дії «Надіслати розбір».
          Наявні свічки, таймфрейми та розмітку можна переглядати й редагувати.
        </p>}
        <Suspense fallback={<p>Завантаження рушія HookChart…</p>}>
          <SharedHookChart
            value={draft.document}
            onChange={(document) => onChange({ ...draft, document })}
            onHistory={savedId ? async (timeframe, before) => (
              await apiJson(
                api + "/charts/" + savedId + "/history?" +
                new URLSearchParams({ timeframe, before: String(before) }),
              )
            ).rows : undefined}
          />
        </Suspense>
        {notice && (
          <p role="alert" className="community-notice">
            {notice}
          </p>
        )}
        <textarea
          aria-label="Пояснення розмітки"
          placeholder="Поясніть свій варіант…"
          value={text}
          maxLength={20_000}
          onChange={(e) => setText(e.target.value)}
        />
        {!draft.parentId && <label className="community-chart-quality-proof">
          <span>Оцінка з архіву h00k.top (необов’язково)</span>
          <textarea rows={3} maxLength={3000} value={qualityProofText}
            onChange={e => setQualityProofText(e.target.value)}
            placeholder="Вставте підписаний JSON із архіву h00k.top" />
          <small>Скопіюйте «Оцінка для Community» в архіві скрінера та вставте сюди протягом 10 хвилин. Підпис підтверджує походження архівного запису, але не правильність оцінки чи виконання угоди.</small>
        </label>}
        {!draft.parentId && scoreAssessment.status !== "none" &&
          <ArchiveScoreProvenance
            proofText={qualityProofText}
            assessment={scoreAssessment}
            onRemove={removeProof}
          />}
        <div className="community-composer-tools">
          {target.kind === "post" && <label className="community-concept-category-label">
            Розділ
            <select aria-label="Категорія графіка" value={category}
              onChange={(event) => setCategory(event.target.value)}>
              <option value="analysis">Аналіз</option>
              <option value="idea">Ідея</option>
              <option value="education">Навчання</option>
              <option value="general">Стрічка</option>
            </select>
          </label>}
          <select
            aria-label="Куди надіслати розбір"
            value={
              target.kind === "message"
                ? "message:" + target.conversationId
                : target.kind
            }
            onChange={(e) => {
              if (e.target.value.startsWith("message:"))
                setTarget({
                  kind: "message",
                  conversationId: e.target.value.slice(8),
                });
              else if (e.target.value === "comment") setTarget(draft.target);
              else setTarget({ kind: "post" });
            }}
          >
            <option value="post">На свою стіну</option>
            {draft.target.kind === "comment" && (
              <option value="comment">Коментарем до оригіналу</option>
            )}
            {conversations.data?.items?.map((c: any) => (
              <option key={c.id} value={"message:" + c.id}>
                {c.is_group ? "Група" : "Чат"}: {c.title}
              </option>
            ))}
          </select>
          {target.kind !== "message" && (
            <Audience value={audience} onChange={setAudience} allowedValues={replyAudienceOptions(target.replyTo)} />
          )}
          <button
            type="button"
            disabled={busy || scoreBlocked}
            onClick={() => void saveArchive()}
          >
            Зберегти до обраних формацій
          </button>
          <button
            type="button"
            className="community-primary"
            disabled={busy || scoreBlocked || !canShareReplyWithAudience(target.replyTo, audience)}
            onClick={() => {
              setBusy(true);
              void run(async () => {
                const id = await chartId();
                await post(api + "/items", {
                  ...target,
                  audience,
                  chartId: id,
                  body: {
                    text: text.trim() || (target.kind === "post" ? "" : "Мій варіант розбору графіка"),
                    ...(target.kind === "post" ? { category } : {}),
                    ...(target.replyTo ? { sourceItemId: target.replyTo.id } : {}),
                  },
                });
                onSaved();
              }).finally(() => setBusy(false));
            }}
          >
            Надіслати розбір
          </button>
        </div>
      </section>
    </div>
  );
}

function Workspace({
  kind,
  title,
  onReplay,
  run,
}: {
  kind: "plan" | "strategy" | "lesson" | "test";
  title: string;
  onReplay: () => void;
  run: Run;
}) {
  const { user } = useAuth();
  const resource = useResource(kind, () =>
    apiJson(api + "/items?kind=" + kind),
  );
  const [editing, setEditing] = useState<any>(null),
    [name, setName] = useState(""),
    [text, setText] = useState(""),
    [audience, setAudience] = useState("private"),
    [checklist, setChecklist] = useState(""),
    [fields, setFields] = useState<Record<string, string>>({}),
    [mode, setMode] = useState("replay"),
    [busy, setBusy] = useState(false),
    [showEditor, setShowEditor] = useState(false),
    [view, setView] = useState<"available" | "mine">("available");
  const reset = () => {
    setEditing(null);
    setName("");
    setText("");
    setChecklist("");
    setFields({});
    setAudience("private");
    setMode("replay");
    setShowEditor(false);
  };
  const loadedItems: any[] = resource.data?.items ?? [];
  const visibleItems = view === "mine" ? loadedItems.filter((item) => item.owner_id === user?.uid) : loadedItems;
  const ownCount = loadedItems.filter((item) => item.owner_id === user?.uid).length;
  return (
    <section className={"community-resource-view community-resource-" + kind}>
      <header className="community-section-heading community-resource-heading">
        <div>
          <span className="community-page-kicker">ОСОБИСТИЙ ПРОСТІР · h00k COMMUNITY</span>
          <h2>{title}</h2>
        </div>
        <div className="community-resource-heading-actions">
          {(kind === "test" || kind === "strategy") && (
            <button type="button" onClick={onReplay}>Відкрити Replay ↗</button>
          )}
          <button
            type="button"
            className="community-primary"
            aria-expanded={showEditor}
            onClick={() => {
              if (showEditor) reset();
              else setShowEditor(true);
            }}
          >
            {showEditor ? "Закрити редактор" : kind === "plan" ? "Новий план" : kind === "strategy" ? "Нова стратегія" : kind === "lesson" ? "Новий матеріал" : "Новий тест"}
          </button>
        </div>
      </header>
      <p className="community-hint">
        {kind === "plan"
          ? "Плануйте спостереження, навчання та відпочинок. День без угод також є повноцінним. Відмітки задач — ваша самооцінка."
          : kind === "strategy"
            ? "Правила зберігаються версіями. Зміна не переписує старі плани та результати."
            : kind === "test"
              ? "Результати тут — авторські навчальні звіти, окремі від підтверджених API-угод. Для спільної практики створіть групову переписку."
              : "Діліться поясненнями, прикладами й вправами. Указуйте джерела та обмеження."}
      </p>
      {showEditor && (
      <form
        className="community-card community-form community-resource-editor"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void run(async () => {
            const body: any = { title: name, text, ...fields };
            if (kind === "strategy")
              body.checklist = checklist
                .split("\n")
                .map((v) => v.trim())
                .filter(Boolean);
            if (kind === "plan")
              body.tasks = checklist
                .split("\n")
                .map((v) => ({ text: v.trim(), done: false }))
                .filter((v) => v.text);
            if (kind === "test") body.mode = mode;
            if (editing)
              await apiJson(api + "/items/" + editing.id, {
                method: "PATCH",
                body: JSON.stringify({
                  body,
                  audience,
                  revision: editing.revision,
                }),
              });
            else await post(api + "/items", { kind, audience, body });
            reset();
            resource.refresh();
          }).finally(() => setBusy(false));
        }}
      >
        <h3>{editing ? "Нова версія" : "Створити матеріал"}</h3>
        <input
          aria-label="Назва матеріалу"
          placeholder="Назва"
          value={name}
          maxLength={200}
          required
          onChange={(e) => setName(e.target.value)}
        />
        <textarea
          aria-label="Опис матеріалу"
          placeholder={
            kind === "lesson"
              ? "Мета, пояснення, приклади, вправа та джерела"
              : "План, правила або пояснення"
          }
          value={text}
          maxLength={20_000}
          onChange={(e) => setText(e.target.value)}
        />
        {kind === "strategy" && (
          <div className="community-fields">
            {[
              ["market", "Ринки й інструменти"],
              ["session", "Сесії й таймфрейми"],
              ["setup", "Передумови ситуації"],
              ["entry", "Умови входу"],
              ["invalidation", "Коли ідея не діє"],
              ["exit", "Супровід і вихід"],
              ["risk", "Особисті правила ризику"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <textarea
                  value={fields[key] ?? ""}
                  maxLength={3000}
                  onChange={(e) =>
                    setFields((f) => ({ ...f, [key]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
        )}
        {(kind === "plan" || kind === "strategy") && (
          <textarea
            aria-label="Чекліст"
            placeholder="Задачі або перевірки — кожна з нового рядка"
            value={checklist}
            maxLength={15_000}
            onChange={(e) => setChecklist(e.target.value)}
          />
        )}
        {kind === "test" && (
          <select
            aria-label="Режим тесту"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="replay">Replay</option>
            <option value="paper">Paper / forward</option>
            <option value="historical">Історичний тест</option>
          </select>
        )}
        <div className="community-composer-tools">
          <Audience value={audience} onChange={setAudience} />
          <button disabled={busy} className="community-primary">
            {busy ? "Збереження…" : "Зберегти"}
          </button>
          {editing && (
            <button type="button" onClick={reset}>
              Скасувати редагування
            </button>
          )}
        </div>
      </form>
      )}
      {kind === "strategy" && (
        <details className="community-card community-resource-presets">
          <summary>Почати з шаблона стратегії</summary>
          <h3>Шаблони правил HookChart</h3>
          <p>Шаблон структурує ваші правила й не є обіцянкою прибутковості.</p>
          {STRATEGY_PRESETS.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => {
                reset();
                setName(template.name);
                setText(
                  template.description +
                    "\n\n" +
                    (template.futuresNote
                      ? "Потребує даних futures/OI/funding. Replay не підтверджує відсутні дані."
                      : "") +
                    "\nЦе копія наявного пресету HookChart для формулювання власних правил.",
                );
                setFields({
                  sourcePreset: template.id,
                  session: template.requiredTfs.join(", "),
                });
                setChecklist(template.bullets.join("\n"));
                setShowEditor(true);
              }}
            >
              {template.name}
            </button>
          ))}
        </details>
      )}
      <div className="community-resource-library-heading">
        <div>
          <span className="community-page-kicker">ЗБЕРЕЖЕНІ МАТЕРІАЛИ</span>
          <h3>Ваша бібліотека</h3>
        </div>
        <div className="community-resource-filter" role="group" aria-label="Фільтр матеріалів">
          <button type="button" aria-pressed={view === "available"} onClick={() => setView("available")}>
            Доступні {resource.data?.items ? "(" + loadedItems.length + ")" : ""}
          </button>
          <button type="button" aria-pressed={view === "mine"} onClick={() => setView("mine")}>
            Мої {resource.data?.items ? "(" + ownCount + ")" : ""}
          </button>
        </div>
      </div>
      {resource.error && <p role="status">{resource.error}</p>}
      {!resource.data && !resource.error && <p role="status">Завантажуємо матеріали…</p>}
      {resource.data && !visibleItems.length && (
        <div className="community-empty community-resource-empty">
          {view === "mine" ? "У вас поки немає власних матеріалів." : "Поки немає доступних матеріалів. Можете створити свій перший."}
        </div>
      )}
      <div className="community-resource-grid">
      {visibleItems.map((item: any) => (
        <article className="community-card community-resource-card" key={item.id}>
          <header>
            <h3>{item.body.title}</h3>
            <small>
              Версія {item.revision} · {item.author?.displayName ?? "Трейдер"} ·{" "}
              {item.audience === "public" ? "Публічно" : item.audience === "friends" ? "Для друзів" : "Приватно"}
            </small>
          </header>
          <p className="community-text">{item.body.text}</p>
          {kind === "strategy" && (
            <dl className="community-strategy-rules">
              {[
                "market",
                "session",
                "setup",
                "entry",
                "invalidation",
                "exit",
                "risk",
              ].map(
                (key) =>
                  item.body[key] && (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{item.body[key]}</dd>
                    </div>
                  ),
              )}
            </dl>
          )}
          {kind === "test" && (
            <span className="community-badge">
              Симуляція · {item.body.mode} · звіт автора
            </span>
          )}
          {item.body.checklist?.map((task: string, i: number) => (
            <p key={i}>□ {task}</p>
          ))}
          {item.body.tasks?.map((task: any, i: number) => (
            <label className="community-task" key={i}>
              <input
                type="checkbox"
                checked={!!task.done}
                disabled={item.owner_id !== user?.uid}
                onChange={() =>
                  void run(async () => {
                    const tasks = item.body.tasks.map(
                      (t: any, index: number) =>
                        index === i ? { ...t, done: !t.done } : t,
                    );
                    await apiJson(api + "/items/" + item.id, {
                      method: "PATCH",
                      body: JSON.stringify({
                        revision: item.revision,
                        body: { ...item.body, tasks },
                      }),
                    });
                    resource.refresh();
                  })
                }
              />
              {task.text}
            </label>
          ))}
          <footer className="community-resource-actions">
            {item.owner_id === user?.uid ? (
              <>
              <button
                type="button"
                onClick={() => {
                  setEditing(item);
                  setName(item.body.title);
                  setText(item.body.text);
                  setAudience(item.audience);
                  setFields(item.body);
                  setChecklist(
                    (
                      item.body.checklist ??
                      item.body.tasks?.map((t: any) => t.text) ??
                      []
                    ).join("\n"),
                  );
                  setMode(item.body.mode ?? "replay");
                  setShowEditor(true);
                }}
              >
                Редагувати з історією версій
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm("Видалити цей матеріал зі своєї бібліотеки?")) return;
                  void run(async () => {
                    await apiJson(api + "/items/" + item.id, { method: "DELETE" });
                    if (editing?.id === item.id) reset();
                    resource.refresh();
                  });
                }}
              >
                Видалити
              </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() =>
                  void run(async () => {
                    await post(api + "/items", {
                      kind,
                      audience: "private",
                      body: {
                        ...item.body,
                        sourceItemId: item.id,
                        title: "Копія: " + item.body.title,
                      },
                    });
                    resource.refresh();
                  })
                }
              >
                Додати власну приватну копію
              </button>
            )}
          </footer>
        </article>
      ))}
      </div>
    </section>
  );
}

function Friends({
  run,
  onProfile,
}: {
  run: Run;
  onProfile: (id: string) => void;
}) {
  const resource = useResource("friends", () => apiJson(api + "/friends"));
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<CommunityFriend[]>([]);
  const [searched, setSearched] = useState(false);
  const [filter, setFilter] = useState<FriendFilter>("all");

  const relationships: CommunityFriend[] = resource.data?.people ?? [];
  const { rows: visible, friendsCount, requestsCount } = buildFriendDirectory(
    relationships, people, filter,
  );

  function changeFriend(person: CommunityFriend, action: "send" | "accept" | "cancel" | "remove") {
    if (action === "remove" && !window.confirm("Видалити цього користувача з друзів?")) return;
    void run(async () => {
      if (action === "cancel" || action === "remove") {
        await apiJson(api + "/friends/" + person.id, { method: "DELETE" });
      } else {
        await post(api + "/friends/" + person.id, {});
      }
      setPeople([]);
      resource.refresh();
    });
  }

  return (
    <section className="community-friends-view" aria-label="Друзі та запити">
      <header className="community-section-heading community-friends-heading">
        <div>
          <span className="community-page-kicker">ЛЮДИ ТА СПІЛКУВАННЯ</span>
          <h2>Друзі та запити</h2>
          <p>Знайомтеся з трейдерами, керуйте запитами та своїм колом спілкування.</p>
        </div>
      </header>
      <form
        className="community-card community-friends-search"
        onSubmit={(e) => {
          e.preventDefault();
          const query = q.trim();
          if (query.length < 2) return;
          void run(async () => {
            const result = await apiJson(api + "/people?q=" + encodeURIComponent(query));
            setPeople(result.people ?? []);
            setSearched(true);
            setFilter("all");
          });
        }}
      >
        <label htmlFor="community-friends-query">Пошук трейдерів</label>
        <div className="community-friends-search-row">
          <input
            id="community-friends-query"
            aria-label="Пошук трейдера"
            value={q}
            minLength={2}
            maxLength={80}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Введіть ім’я або псевдонім"
          />
          <button type="submit" className="community-primary" disabled={q.trim().length < 2}>
            Шукати
          </button>
          {searched && (
            <button
              type="button"
              onClick={() => {
                setPeople([]);
                setQ("");
                setSearched(false);
              }}
            >
              Очистити
            </button>
          )}
        </div>
      </form>

      <div className="community-friends-tabs" role="group" aria-label="Фільтр контактів">
        {(
          [
            ["all", "Усі", null],
            ["friends", "Мої друзі", friendsCount],
            ["requests", "Запити", requestsCount],
          ] as const
        ).map(([id, title, count]) => (
          <button
            type="button"
            key={id}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            {title}{count !== null && <span>{count}</span>}
          </button>
        ))}
      </div>

      {resource.error && <p role="status">{resource.error}</p>}
      {!visible.length && !resource.error && (
        <div className="community-empty community-friends-empty">
          {filter === "friends"
            ? "У вас поки немає підтверджених друзів."
            : filter === "requests"
              ? "Немає нових або очікуваних запитів."
              : searched
                ? "За цим запитом трейдерів не знайдено."
                : "Знайдіть трейдера за іменем, щоб надіслати запит дружби."}
        </div>
      )}

      <div className="community-friends-grid">
        {visible.map((person) => {
          const accepted = person.isAccepted;
          const incoming = person.isIncoming;
          const outgoing = person.isOutgoing;
          const state = person.statusText;
          const name = person.displayName?.trim() || "Трейдер";

          return (
            <article className="community-card community-friend-card" key={person.id}>
              <div className="community-friend-identity">
                <span className="community-friend-avatar" aria-hidden="true">
                  {name.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <button type="button" className="community-friend-name" onClick={() => onProfile(person.id)}>
                    {name}
                  </button>
                  <span className={"community-friend-state" + (accepted ? " community-friend-state-accepted" : incoming ? " community-friend-state-incoming" : "")}>
                    {state}
                  </span>
                </div>
              </div>
              <div className="community-friend-actions">
                {accepted ? (
                  <button type="button" onClick={() => changeFriend(person, "remove")}>
                    Видалити з друзів
                  </button>
                ) : incoming ? (
                  <button type="button" className="community-primary" onClick={() => changeFriend(person, "accept")}>
                    Прийняти
                  </button>
                ) : outgoing ? (
                  <button type="button" onClick={() => changeFriend(person, "cancel")}>
                    Відкликати запит
                  </button>
                ) : (
                  <button type="button" className="community-primary" onClick={() => changeFriend(person, "send")}>
                    Додати в друзі
                  </button>
                )}
                <button
                  type="button"
                  className="community-friend-block"
                  onClick={() => {
                    if (!window.confirm("Заблокувати цього користувача? Він не зможе бути вашим другом.")) return;
                    void run(async () => {
                      await post(api + "/blocks/" + person.id, {});
                      setPeople([]);
                      resource.refresh();
                    });
                  }}
                >
                  Заблокувати
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <p className="community-hint community-friends-hint">
        Незнайомці не можуть автоматично додавати вас у групи. Запрошувати до розмов можна лише підтверджених друзів.
      </p>
    </section>
  );
}

function Chats({
  revision,
  onPick,
  onChart,
  run,
  inviteTarget,
  onInviteHandled,
}: {
  revision: number;
  onPick: (t: Target) => void;
  onChart: (item: any, target?: Target) => Promise<void>;
  run: Run;
  inviteTarget: ChatInvite | null;
  onInviteHandled: () => void;
}) {
  const { user } = useAuth();
  const list = useResource("chats:" + revision, () =>
      apiJson(api + "/conversations"),
    ),
    friends = useResource("chat-friends", () => apiJson(api + "/friends"));
  const [id, setId] = useState(""),
    [requestedConversationId, setRequestedConversationId] = useState(() => {
      const requested = new URLSearchParams(location.hash.split("?")[1] ?? "").get("conversation") ?? "";
      return /^[a-f0-9-]{36}$/i.test(requested) ? requested : "";
    }),
    [name, setName] = useState(""),
    [members, setMembers] = useState<string[]>([]),
    [messages, setMessages] = useState<any[]>([]),
    [before, setBefore] = useState<string | null>(null),
    [chatSearch, setChatSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createGroup, setCreateGroup] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [muteMenuOpen, setMuteMenuOpen] = useState(false);
  const [groupNotice, setGroupNotice] = useState("");
  const [inviteMember, setInviteMember] = useState("");
  const [pollError, setPollError] = useState("");
  const inFlightPoll = useRef(false);
  const acknowledged = useRef<Map<string, string>>(new Map());
  const reading = useRef<Set<string>>(new Set());
  async function acknowledgeRead(conversationId: string, messageId: string) {
    if (acknowledged.current.get(conversationId) === messageId || reading.current.has(conversationId)) return;
    reading.current.add(conversationId);
    try {
      await post(api + "/conversations/" + encodeURIComponent(conversationId) + "/read", { messageId });
      acknowledged.current.set(conversationId, messageId);
      if (activeId.current === conversationId) list.refresh();
      window.dispatchEvent(new Event("community:chat-read"));
    } finally {
      reading.current.delete(conversationId);
    }
  }
  useEffect(() => {
    if (!inviteTarget) return;
    setCreateOpen(true);
    setMembers([inviteTarget.id]);
    setName("Діалог із " + inviteTarget.name);
  }, [inviteTarget?.id, inviteTarget?.name]);
  const activeId = useRef(id);
  const latestMessages = useRef(messages);
  const threadRef = useRef<HTMLDivElement>(null);
  const stayAtBottom = useRef(true);
  const restoreOlderOffset = useRef<number | null>(null);
  activeId.current = id;
  latestMessages.current = messages;
  useLayoutEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    if (restoreOlderOffset.current !== null) {
      thread.scrollTop = Math.max(0, thread.scrollHeight - restoreOlderOffset.current);
      restoreOlderOffset.current = null;
    } else if (stayAtBottom.current) {
      thread.scrollTop = thread.scrollHeight;
    }
  }, [id, messages]);
  const conversations: any[] = Array.isArray(list.data?.items) ? list.data.items : [];
  // Navigate only to conversations the authenticated server actually returned.
  useEffect(() => {
    const jump = () => {
      const requested = new URLSearchParams(location.hash.split("?")[1] ?? "").get("conversation") ?? "";
      setRequestedConversationId(/^[a-f0-9-]{36}$/i.test(requested) ? requested : "");
    };
    window.addEventListener("hashchange", jump);
    return () => window.removeEventListener("hashchange", jump);
  }, []);
  useEffect(() => {
    if (!requestedConversationId || !list.data) return;
    if (conversations.some(chat => chat.id === requestedConversationId)) {
      setId(requestedConversationId);
      setChatSearch("");
    } else {
      setId("");
      setPollError("Розмова недоступна або ви не є її учасником.");
    }
    setRequestedConversationId("");
  }, [requestedConversationId, list.data]);
  // The server enforces expiry. Refresh the active list once when the nearest
  // timed mute expires, without a background polling worker.
  useEffect(() => {
    const expiry = conversations
      .filter(chat => chat.muted === true && typeof chat.muted_until === "string")
      .map(chat => Date.parse(chat.muted_until))
      .filter(time => Number.isFinite(time) && time > Date.now());
    if (!expiry.length) return;
    const delay = Math.min(2_147_483_647, Math.max(1000, Math.min(...expiry) - Date.now() + 250));
    const timer = window.setTimeout(() => {
      list.refresh();
      window.dispatchEvent(new Event("community:chat-muted"));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [list.data]);
  const filteredConversations = filterConversations(conversations, chatSearch);
  const currentConversation = conversations.find((c) => c.id === id);
  const currentTitle = conversationDisplayTitle(currentConversation);
  const myRole = currentConversation?.role as "owner" | "admin" | "member" | undefined;
  const canManageGroup = currentConversation?.is_group && (myRole === "owner" || myRole === "admin");
  const groupMembers = useResource("chat-members:" + id + ":" + groupOpen, () =>
    id && groupOpen && currentConversation?.is_group
      ? apiJson(api + "/conversations/" + encodeURIComponent(id) + "/members")
      : Promise.resolve({ items: [] }),
  );
  const currentMembers: Array<{ id:string; displayName:string; role:string; joined_at:string; username?:string|null }> =
    Array.isArray(groupMembers.data?.items) ? groupMembers.data.items : [];
  const memberIds = new Set(currentMembers.map(member => member.id));
  const eligibleFriends: Array<{ id:string; displayName:string }> =
    (friends.data?.people ?? []).filter((person: any) => person.accepted && !memberIds.has(person.id));
  useEffect(() => {
    setGroupOpen(false);
    setMuteMenuOpen(false);
    setGroupNotice("");
    setInviteMember("");
  }, [id]);
  async function load(older = false, replace = false) {
    if (!id) return;
    const startedId = id;
    const after = !older && !replace ? latestMessages.current.at(-1)?.id : null;
    const data = await apiJson(
      api +
        "/conversations/" +
        id +
        "/messages" +
        (older && before
          ? "?before=" + before
          : after
            ? "?after=" + after
            : ""),
    );
    if (activeId.current !== startedId) return;
    if (older && threadRef.current) {
      // Record position just before prepending; concurrent polling cannot steal it.
      restoreOlderOffset.current = threadRef.current.scrollHeight - threadRef.current.scrollTop;
    }
    setMessages((old) => {
      const combined = older
        ? [...data.items, ...old]
        : after
          ? [...old, ...data.items]
          : data.items;
      return [
        ...new Map(combined.map((item: any) => [item.id, item])).values(),
      ];
    });
    if (!after) setBefore(data.next);
    // Do not mark a new arrival as read while the user is browsing older messages.
    if (!older && document.visibilityState === "visible" && stayAtBottom.current) {
      const lastSeenId = data.items.at(-1)?.id ?? latestMessages.current.at(-1)?.id;
      if (lastSeenId)
        void acknowledgeRead(startedId, lastSeenId)
          .catch(error => setPollError(error instanceof Error ? error.message : "Не вдалося позначити повідомлення прочитаним"));
    }
  }
  useEffect(() => {
    setMessages([]);
    latestMessages.current = [];
    setBefore(null);
    stayAtBottom.current = true;
    restoreOlderOffset.current = null;
    setPollError("");
    if (!id) return;
    let active = true;
    const pull = () => {
      if (!active || document.visibilityState !== "visible" || inFlightPoll.current) return;
      inFlightPoll.current = true;
      void load().then(() => { if (active) setPollError(""); })
        .catch((error) => {
          if (active) setPollError(error instanceof Error ? error.message : "Не вдалося оновити повідомлення");
        }).finally(() => { inFlightPoll.current = false; });
    };
    pull();
    // One visible, active conversation per user. No polling for hidden tabs.
    const timer = setInterval(pull, 12000);
    document.addEventListener("visibilitychange", pull);
    window.addEventListener("focus", pull);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", pull);
      window.removeEventListener("focus", pull);
    };
  }, [id, revision]);
  return (
    <>
      <div className="community-section-heading community-chat-heading">
        <div>
          <span className="community-page-kicker">СПІЛКУВАННЯ</span>
          <h2>Приватні та групові розмови</h2>
        </div>
      </div>
      <details
        className="community-card community-chat-create"
        open={createOpen}
        onToggle={(event) => setCreateOpen(event.currentTarget.open)}
      >
        <summary>Створити розмову</summary>
        <label className="community-chat-group-toggle">
          <input type="checkbox" checked={createGroup || members.length > 1}
            disabled={members.length > 1}
            onChange={(event) => setCreateGroup(event.target.checked)} />
          Групова розмова — можна додавати друзів пізніше
        </label>
        {inviteTarget && (
          <p className="community-chat-invite-notice" role="status">
            Обрано трейдера {inviteTarget.name}. Підтвердіть створення розмови — вона не відкривається автоматично.
          </p>
        )}
        <input
          aria-label="Назва розмови"
          placeholder="Назва групи або розмови"
          value={name}
          maxLength={100}
          onChange={(e) => setName(e.target.value)}
        />
        {friends.data?.people
          ?.filter((f: any) => f.accepted)
          .map((f: any) => (
            <label className="community-task" key={f.id}>
              <input
                type="checkbox"
                checked={members.includes(f.id)}
                onChange={() =>
                  setMembers((old) =>
                    old.includes(f.id)
                      ? old.filter((v) => v !== f.id)
                      : [...old, f.id],
                  )
                }
              />
              {f.displayName}
            </label>
          ))}
        <button
          type="button"
          disabled={!members.length}
          onClick={() =>
            void run(async () => {
              const d = await post(api + "/conversations", {
                title: name || "Розмова",
                members,
                isGroup: createGroup || members.length > 1,
              });
              setId(d.id);
              list.refresh();
              setMembers([]);
              setName("");
              setChatSearch("");
              setCreateOpen(false);
              setCreateGroup(false);
              onInviteHandled();
            })
          }
        >
          Створити
        </button>
      </details>
      <div className="community-chat-layout">
        <aside className="community-chat-list" aria-label="Список розмов">
          <h3>Ваші розмови</h3>
          <label className="community-chat-search-label" htmlFor="community-chat-search">
            Пошук розмови
          </label>
          <input
            id="community-chat-search"
            className="community-chat-search"
            type="search"
            value={chatSearch}
            onChange={(e) => setChatSearch(e.target.value)}
            placeholder="Назва групи або діалогу"
          />
          {list.error && <p role="status">{list.error}</p>}
          {!list.error && !conversations.length && (
            <p className="community-chat-list-empty">Тут з’являться ваші особисті та групові розмови.</p>
          )}
          {conversations.length > 0 && filteredConversations.length === 0 && (
            <p className="community-chat-list-empty">За цією назвою розмов немає.</p>
          )}
          <div className="community-chat-channels">
            {filteredConversations.map((c: any) => (
              <button
                type="button"
                key={c.id}
                aria-pressed={id === c.id}
                aria-label={(c.is_group ? "Група: " : "Діалог: ") + conversationDisplayTitle(c) + (Number(c.unread_count) ? ". Непрочитаних: " + c.unread_count : "")}
                onClick={() => { setId(c.id); setRequestedConversationId(""); }}
              >
                <span className="community-chat-channel-symbol" aria-hidden="true">
                  {c.is_group ? "👥" : "✉"}
                </span>
                <span className="community-chat-channel-label">
                  <strong>{conversationDisplayTitle(c)}</strong>
                  <small>{c.is_group ? "Групова розмова" : "Особистий діалог"}{c.muted === true ? (c.muted_until ? " · Тимчасово без звуку" : " · Без звуку") : ""}</small>
                </span>
                {c.muted === true && <BellOff size={15} className="community-chat-muted-icon" aria-label="Сповіщення розмови приглушені" />}
                {Number(c.unread_count) > 0 && (
                  <span className="community-chat-unread-count" aria-hidden="true">
                    {Number(c.unread_count) >= 100 ? "99+" : Number(c.unread_count)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </aside>
        <div className="community-chat-panel">
          {id ? (
            <>
              <header className="community-chat-active-header">
                <span className="community-chat-active-avatar" aria-hidden="true">
                  {currentConversation?.is_group ? "👥" : "✉"}
                </span>
                <div>
                  <span className="community-page-kicker">
                    {currentConversation?.is_group ? "ГРУПОВА РОЗМОВА" : "ОСОБИСТЕ ЛИСТУВАННЯ"}
                  </span>
                  <h3>{currentTitle}</h3>
                </div>
                {currentConversation && (
                  <div className="community-chat-mute-control">
                    <button type="button"
                      className="community-chat-mute-toggle"
                      aria-pressed={currentConversation.muted === true}
                      aria-expanded={muteMenuOpen && currentConversation.muted !== true}
                      onClick={() => {
                        if (currentConversation.muted === true) {
                          void run(async () => {
                            await post(api + "/conversations/" + encodeURIComponent(currentConversation.id) + "/mute", { muted: false });
                            setMuteMenuOpen(false);
                            list.refresh();
                            window.dispatchEvent(new Event("community:chat-muted"));
                          });
                        } else setMuteMenuOpen(open => !open);
                      }}>
                      {currentConversation.muted === true ? <Bell size={15} aria-hidden="true" /> : <BellOff size={15} aria-hidden="true" />}
                      {currentConversation.muted === true ? "Увімкнути сповіщення" : "Приглушити"}
                    </button>
                    {muteMenuOpen && currentConversation.muted !== true && (
                      <div className="community-chat-mute-options" role="group" aria-label="Час приглушення">
                        {[
                          { label: "На 1 годину", minutes: 60 },
                          { label: "На 8 годин", minutes: 480 },
                          { label: "Назавжди", minutes: null },
                        ].map(option => (
                          <button type="button" key={option.label}
                            onClick={() => void run(async () => {
                              await post(api + "/conversations/" + encodeURIComponent(currentConversation.id) + "/mute",
                                option.minutes === null ? { muted: true } : { muted: true, durationMinutes: option.minutes });
                              setMuteMenuOpen(false);
                              list.refresh();
                              window.dispatchEvent(new Event("community:chat-muted"));
                            })}>
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                    {currentConversation.muted === true && currentConversation.muted_until && (
                      <small className="community-chat-muted-until">
                        Без звуку до {new Date(currentConversation.muted_until).toLocaleString("uk-UA", { dateStyle: "short", timeStyle: "short" })}
                      </small>
                    )}
                  </div>
                )}
                {currentConversation?.is_group && (
                  <button type="button"
                    className="community-chat-mentions-toggle"
                    aria-pressed={currentConversation.mentions_only === true}
                    title="Отримувати сповіщення тільки коли інший учасник напише @ваша-адреса-профілю"
                    onClick={() => void run(async () => {
                      const next = currentConversation.mentions_only !== true;
                      await post(api + "/conversations/" + encodeURIComponent(currentConversation.id) + "/mentions-only",
                        { enabled: next });
                      list.refresh();
                      window.dispatchEvent(new Event("community:chat-muted"));
                    })}>
                    @ {currentConversation.mentions_only === true ? "Лише згадки" : "Усі повідомлення"}
                  </button>
                )}
                {currentConversation?.is_group && (
                  <button type="button" className="community-chat-members-toggle" aria-expanded={groupOpen}
                    onClick={() => setGroupOpen(open => !open)}>
                    <Users size={15} aria-hidden="true" /> {groupOpen ? "Сховати учасників" : "Учасники групи"}
                  </button>
                )}
                <button
                  className="community-chat-jump"
                  type="button"
                  onClick={() => {
                    if (!threadRef.current) return;
                    stayAtBottom.current = true;
                    threadRef.current.scrollTop = threadRef.current.scrollHeight;
                  }}
                >
                  До останніх
                </button>
              </header>
              {currentConversation?.is_group && currentConversation.mentions_only === true && (
                <p className="community-chat-mention-hint" role="status">
                  <strong>Лише @згадки.</strong> Загальні повідомлення залишаються у чаті, але не збільшують лічильник сповіщень. Для згадки потрібна зарезервована адреса профілю.
                </p>
              )}
              {groupOpen && currentConversation?.is_group && (
                <section className="community-chat-members-panel" aria-label="Учасники групової розмови">
                  <div className="community-chat-members-title">
                    <h4>Учасники групи{groupMembers.data ? " · " + currentMembers.length : ""}</h4>
                    <span>{myRole === "owner" ? "Власник" : myRole === "admin" ? "Адміністратор" : "Учасник"}</span>
                  </div>
                  {groupMembers.error && <p role="alert">{groupMembers.error}</p>}
                  {groupNotice && <p role="status">{groupNotice}</p>}
                  <div className="community-chat-members-list">
                    {currentMembers.map(member => (
                      <div key={member.id} className="community-chat-member-row">
                        <span className="community-chat-member-avatar" aria-hidden="true">{member.displayName.slice(0,1).toUpperCase()}</span>
                        <span className="community-chat-member-info">
                          <strong>{member.displayName}</strong>
                          <small>{member.role === "owner" ? "Власник" : member.role === "admin" ? "Адміністратор" : "Учасник"}</small>
                          {member.username && <small className="community-chat-mention-handle">@{member.username}</small>}
                        </span>
                        {myRole === "owner" && member.id !== user?.uid && (
                          <button type="button" onClick={() => {
                            if (!window.confirm("Передати керування групою користувачу " + member.displayName + "?")) return;
                            void run(async () => {
                              await post(api + "/conversations/" + id + "/transfer", { targetId: member.id });
                              setGroupNotice("Новий власник групи: " + member.displayName);
                              groupMembers.refresh();
                              list.refresh();
                            });
                          }}>Передати права</button>
                        )}
                        {canManageGroup && member.id !== user?.uid && member.role !== "owner" && (
                          <button type="button" onClick={() => {
                            if (!window.confirm("Видалити " + member.displayName + " з групи?")) return;
                            void run(async () => {
                              await apiJson(api + "/conversations/" + id + "/members/" + member.id, { method: "DELETE" });
                              setGroupNotice("Учасника видалено");
                              groupMembers.refresh();
                            });
                          }}>Видалити</button>
                        )}
                      </div>
                    ))}
                  </div>
                  {canManageGroup && (
                    <div className="community-chat-add-member">
                      <label htmlFor="community-chat-add-member">Запросити підтвердженого друга</label>
                      <select id="community-chat-add-member" value={inviteMember}
                        onChange={event => setInviteMember(event.target.value)}>
                        <option value="">Оберіть друга</option>
                        {eligibleFriends.map(friend => <option value={friend.id} key={friend.id}>{friend.displayName}</option>)}
                      </select>
                      <button type="button" disabled={!inviteMember} onClick={() => void run(async () => {
                        await post(api + "/conversations/" + id + "/members", { id: inviteMember });
                        setInviteMember("");
                        setGroupNotice("Учасника додано до групи");
                        groupMembers.refresh();
                      })}>Додати</button>
                    </div>
                  )}
                  {myRole && myRole !== "owner" && (
                    <button className="community-chat-leave" type="button" onClick={() => {
                      if (!window.confirm("Вийти з групи? Нові повідомлення стануть недоступними.")) return;
                      void run(async () => {
                        await apiJson(api + "/conversations/" + id + "/members/" + user?.uid, { method: "DELETE" });
                        setId("");
                        setGroupOpen(false);
                        list.refresh();
                      });
                    }}>Вийти з групи</button>
                  )}
                  <p className="community-chat-members-hint">
                    Для згадки учасника напишіть його адресу профілю через @, наприклад @ivan. Тільки точний збіг активної адреси учасника створить сповіщення.
                  </p>
                  {myRole === "owner" && <p className="community-chat-members-hint">Щоб вийти з групи, спочатку передайте права іншому учаснику.</p>}
                </section>
              )}
              {pollError && <p className="community-chat-poll-error" role="status">{pollError}</p>}
              <div
                className="community-chat-thread"
                role="log"
                aria-label="Повідомлення розмови"
                aria-live="off"
                ref={threadRef}
                onScroll={(event) => {
                  const thread = event.currentTarget;
                  stayAtBottom.current =
                    thread.scrollHeight - thread.scrollTop - thread.clientHeight < 80;
                  if (stayAtBottom.current && document.visibilityState === "visible") {
                    const lastSeen = latestMessages.current.at(-1)?.id;
                    if (lastSeen) void acknowledgeRead(id, lastSeen)
                      .catch(error => setPollError(error instanceof Error ? error.message : "Не вдалося позначити повідомлення прочитаним"));
                  }
                }}
              >
                {before && (
                  <button
                    className="community-chat-older"
                    type="button"
                    onClick={() => void run(() => load(true))}
                  >
                    Показати попередні повідомлення
                  </button>
                )}
                {!messages.length && !before && (
                  <div className="community-chat-thread-empty">
                    Напишіть перше повідомлення або поділіться збереженою формацією.
                  </div>
                )}
                {messages.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onChart={onChart}
                    onPick={onPick}
                    run={run}
                    refresh={() => void load(false, true)}
                  />
                ))}
              </div>
              <Composer
                key={id}
                target={{ kind: "message", conversationId: id }}
                onPick={onPick}
                onSent={() => void load()}
                run={run}
              />
            </>
          ) : (
            <div className="community-empty community-chat-welcome">
              <MessageCircle size={28} aria-hidden="true" />
              <h3>Ваші повідомлення</h3>
              <p>Виберіть розмову або створіть нову з підтвердженими друзями.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Trades({ run, owner }: { run: Run; owner?: string }) {
  const resource = useResource("trades:" + owner, () =>
    apiJson(api + "/trades" + (owner ? "?owner=" + owner : "")),
  );
  const [more, setMore] = useState<any[]>([]),
    [next, setNext] = useState<string | null>(null);
  useEffect(() => {
    setMore([]);
    setNext(resource.data?.next ?? null);
  }, [resource.data]);
  const [selected, setSelected] = useState<any>(null),
    [reason, setReason] = useState(""),
    [review, setReview] = useState("");
  return (
    <>
      <h2>Угоди та статистика</h2>
      <p className="community-hint">
        Реальна API-історія відокремлена від Replay. Метрики першого конектора
        стосуються закритих ордерів Bybit; це не дохідність всього рахунка.
        Нотатки — твердження автора з часом збереження.
      </p>
      {resource.error && <p role="status">{resource.error}</p>}
      {resource.data && (
        <>
          <p>{resource.data.method}</p>
          <div className="community-stats">
            {Object.entries(resource.data.summary ?? {}).map(
              ([currency, v]: [string, any]) => (
                <div className="community-card" key={currency}>
                  <h3>{currency}</h3>
                  <b>{v.pnl ?? "Суми приховані"}</b>
                  <p>
                    Виграшні: {v.wins} · збиткові: {v.losses} · беззбиткові:{" "}
                    {v.flat}
                  </p>
                  <p>
                    Win rate:{" "}
                    {v.winRate === null
                      ? "Недостатньо даних"
                      : v.winRate.toFixed(1) + "%"}
                  </p>
                </div>
              ),
            )}
          </div>
          {!resource.data.items.length && (
            <div className="community-empty">
              Підключіть підтримуваний читальний ключ у налаштуваннях. Ручні
              числа не отримають статус API-підтвердження.
            </div>
          )}
          {[...resource.data.items, ...more].map((trade: any, i: number) => (
            <article className="community-card" key={trade.source_id ?? i}>
              <header>
                <h3>{trade.symbol}</h3>
                <small>
                  {new Date(trade.closed_at).toLocaleString("uk-UA")}
                </small>
              </header>
              <p>
                Вхід: {trade.entry} · Вихід: {trade.exit} · PnL:{" "}
                {trade.pnl ?? "Приховано"} {trade.currency}
              </p>
              <p>{trade.notes?.reason}</p>
              {trade.source_id && (
                <button
                  type="button"
                  onClick={() => {
                    setSelected(trade);
                    setReason(trade.notes?.reason ?? "");
                    setReview(trade.notes?.review ?? "");
                  }}
                >
                  Причина входу й підсумок
                </button>
              )}
            </article>
          ))}
        </>
      )}
      {next && (
        <button
          type="button"
          onClick={() =>
            void run(async () => {
              const d = await apiJson(
                api +
                  "/trades?" +
                  new URLSearchParams({
                    before: next,
                    ...(owner ? { owner } : {}),
                  }),
              );
              setMore((old) => [...old, ...d.items]);
              setNext(d.next);
            })
          }
        >
          Раніші угоди
        </button>
      )}
      {resource.data?.coverage?.map((c: any, i: number) => (
        <p className="community-hint" key={i}>
          Стан джерела: {c.status} · покриття від{" "}
          {c.covered_from
            ? new Date(c.covered_from).toLocaleString("uk-UA")
            : "невідомо"}{" "}
          · оновлено{" "}
          {c.synced_at
            ? new Date(c.synced_at).toLocaleString("uk-UA")
            : "ще не синхронізовано"}
        </p>
      ))}
      {selected && (
        <form
          className="community-card community-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await post(api + "/trades/notes", {
                connectionId: selected.connection_id,
                sourceId: selected.source_id,
                reason,
                review,
              });
              setSelected(null);
              resource.refresh();
            });
          }}
        >
          <h3>{selected.symbol}: нотатки після факту</h3>
          <textarea
            aria-label="Причина входу"
            placeholder="Чому ви відкрили угоду?"
            value={reason}
            maxLength={5000}
            onChange={(e) => setReason(e.target.value)}
          />
          <textarea
            aria-label="Підсумок угоди"
            placeholder="Що виконано і що змінити?"
            value={review}
            maxLength={5000}
            onChange={(e) => setReview(e.target.value)}
          />
          <button>Зберегти нотатки</button>
        </form>
      )}
    </>
  );
}

function Profile({
  id,
  onChart,
  onPick,
  run,
  onChatInvite,
}: {
  id: string;
  onChart: (item: any, target?: Target) => Promise<void>;
  onPick: (t: Target) => void;
  run: Run;
  onChatInvite: (id: string, name: string) => void;
}) {
  const { user, profile, updateProfileData } = useAuth();
  const resource = useResource("profile:" + id, () =>
    apiJson(api + "/profiles/" + id),
  );
  const friendships = useResource("profile-friends:" + id + ":" + user?.uid, () =>
    user?.uid === id ? Promise.resolve({ people: [] }) : apiJson(api + "/friends"),
  );
  type Section = "wall" | "articles" | "setups" | "about" | "trades";
  const requestedProfileSection = (): Section => {
    const value = new URLSearchParams(location.hash.split("?")[1] ?? "").get("profileTab");
    return value === "hookchart" || value === "setups" ? "setups"
      : value === "about" || value === "articles" || value === "trades" ? value : "wall";
  };
  const [profileSection, setProfileSection] = useState<Section>(requestedProfileSection);
  const [showArticleComposer, setShowArticleComposer] = useState(false);
  const [setupFilters, setSetupFilters] = useState<PublicSetupGalleryFilters>(() => ({ ...DEFAULT_PUBLIC_SETUP_FILTERS }));
  const navigateProfileSection = (section: Section) => {
    const params = new URLSearchParams(location.hash.split("?")[1] ?? "");
    params.set("section", "profile");
    params.set("owner", id);
    params.set("profileTab", section === "setups" ? "hookchart" : section);
    params.delete("post");
    params.delete("contact");
    const nextHash = "#community?" + params.toString();
    if (location.hash !== nextHash) history.pushState(history.state, "", nextHash);
    setProfileSection(section);
  };
  useEffect(() => {
    setProfileSection(requestedProfileSection());
    const jump = () => {
      const params = new URLSearchParams(location.hash.split("?")[1] ?? "");
      if (params.get("section") === "profile" && params.get("owner") === id)
        setProfileSection(requestedProfileSection());
    };
    window.addEventListener("hashchange", jump);
    window.addEventListener("popstate", jump);
    return () => {
      window.removeEventListener("hashchange", jump);
      window.removeEventListener("popstate", jump);
    };
  }, [id]);
  const [form, setForm] = useState<any>({ ...profile?.community }),
    [displayName, setName] = useState(profile?.displayName ?? "");
  const hydratedFor = useRef<string | null>(profile && user?.uid === id ? id : null);
  useEffect(() => {
    // Restore persisted settings once when account data arrives; never erase a draft on refresh.
    if (id === user?.uid && profile && hydratedFor.current !== id) {
      setForm({ ...profile.community });
      setName(profile.displayName ?? "");
      hydratedFor.current = id;
    }
  }, [id, user?.uid, profile]);
  const wall = useResource("wall:" + id + ":" + (profileSection === "wall"), () =>
    profileSection === "wall"
      ? apiJson(api + "/feed?mode=wall&owner=" + id)
      : Promise.resolve(null),
  );
  // The educational feed is lazy and server-filtered: old wall pages cannot
  // conceal older articles, and no private content becomes public.
  const articles = useResource("profile-articles:" + id + ":" + (profileSection === "articles"), () =>
    profileSection === "articles"
      ? apiJson(api + "/feed?mode=wall&owner=" + id + "&category=education")
      : Promise.resolve(null),
  );
  const setups = useResource("profile-setups:" + id + ":" + (profileSection === "setups"), () =>
    profileSection === "setups"
      ? apiJson(api + "/feed?mode=wall&owner=" + id + "&withChart=1")
      : Promise.resolve(null),
  );
  const [setupPages, setSetupPages] = useState<any[]>([]);
  const [setupNext, setSetupNext] = useState<string | null>(null);
  const [setupsBusy, setSetupsBusy] = useState(false);
  const [setupsError, setSetupsError] = useState("");
  const [articlePages, setArticlePages] = useState<any[]>([]);
  const [articleNext, setArticleNext] = useState<string | null>(null);
  const [articlesBusy, setArticlesBusy] = useState(false);
  const [articlesError, setArticlesError] = useState("");
  const currentProfileRef = useRef(id);
  currentProfileRef.current = id;
  useEffect(() => {
    setSetupPages([]);
    setSetupNext(setups.data?.next ?? null);
    setSetupsError("");
  }, [id, setups.data]);
  const loadMoreSetups = async () => {
    const cursor = setupNext;
    if (!cursor || setupsBusy || !setups.data) return;
    const requestedId = id;
    setSetupsBusy(true);
    setSetupsError("");
    try {
      const page = await apiJson(api + "/feed?mode=wall&owner=" + requestedId +
        "&withChart=1&before=" + encodeURIComponent(cursor));
      if (currentProfileRef.current !== requestedId) return;
      setSetupPages(old => [...new Map([...old, ...page.items].map((item: any) => [item.id, item])).values()]);
      setSetupNext(page.next);
    } catch (error) {
      if (currentProfileRef.current === requestedId)
        setSetupsError(error instanceof Error ? error.message : "Не вдалося завантажити графіки");
    } finally {
      if (currentProfileRef.current === requestedId) setSetupsBusy(false);
    }
  };
  const loadedSetups: any[] = [...new Map([...(setups.data?.items ?? []), ...setupPages]
    .filter((item: any) => item.owner_id === id && !!item.chart)
    .map((item: any) => [item.id, item])).values()];
  const visibleSetups = filterPublicSetupGallery(loadedSetups, setupFilters);
  useEffect(() => {
    setArticlePages([]);
    setArticleNext(articles.data?.next ?? null);
    setArticlesError("");
  }, [id, articles.data]);
  const loadMoreArticles = async () => {
    const cursor = articleNext;
    if (!cursor || articlesBusy || !articles.data) return;
    const requestedId = id;
    setArticlesBusy(true);
    setArticlesError("");
    try {
      const result = await apiJson(api + "/feed?mode=wall&owner=" + requestedId +
        "&category=education&before=" + encodeURIComponent(cursor));
      if (currentProfileRef.current !== requestedId) return;
      setArticlePages(old => [...new Map([...old, ...result.items].map((item: any) => [item.id, item])).values()]);
      setArticleNext(result.next);
    } catch (error) {
      if (currentProfileRef.current === requestedId)
        setArticlesError(error instanceof Error ? error.message : "Не вдалося завантажити статті");
    } finally {
      if (currentProfileRef.current === requestedId) setArticlesBusy(false);
    }
  };
  const p = resource.data?.profile;
  const requestedContact = new URLSearchParams(location.hash.split("?")[1] ?? "").get("contact");
  const friends: CommunityFriend[] | undefined = friendships.data?.people;
  const relation = friends?.find((person) => person.id === id);
  useEffect(() => {
    if (!p || !friends || user?.uid === id || !["friend", "message"].includes(requestedContact ?? "")) return;
    const frame = requestAnimationFrame(() => {
      // The visitor chose an action on the public page. Focus the permitted
      // authenticated control, but never send an unconfirmed friend request or message.
      const controlId = requestedContact === "message" && relation?.accepted
        ? "community-profile-message-action" : "community-profile-friend-action";
      const button = document.getElementById(controlId);
      (button ?? document.getElementById("community-profile-contact"))?.scrollIntoView({
        block: "start", behavior: "smooth",
      });
      button?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [id, p, requestedContact, user?.uid, !!friends, relation?.accepted, relation?.incoming]);
  function changeFriend(action: "send" | "accept" | "cancel" | "remove") {
    if (action === "remove" && !window.confirm("Видалити цього трейдера з друзів?")) return;
    void run(async () => {
      if (action === "cancel" || action === "remove") {
        await apiJson(api + "/friends/" + id, { method: "DELETE" });
      } else {
        await post(api + "/friends/" + id, {});
      }
      friendships.refresh();
    });
  }
  return (
    <>
      {resource.error && <p role="status">{resource.error}</p>}
      {!p && <h2>Профіль трейдера</h2>}
      {p && (
        <article className="community-card community-profile-hero">
          <div className="community-profile-cover" aria-hidden="true">
            {p.coverUrl && <img className="community-profile-cover-photo" src={p.coverUrl} alt=""
              onError={event => { event.currentTarget.hidden = true; }} />}
            <span>h00k Community</span>
          </div>
          <div className="community-profile-identity">
            <span className="community-profile-avatar" aria-hidden="true">
              <span>{(p.displayName ?? "Т").trim().slice(0, 1).toUpperCase()}</span>
              {p.avatarUrl && <img className="community-profile-avatar-photo" src={p.avatarUrl} alt=""
                onError={event => { event.currentTarget.hidden = true; }} />}
            </span>
            <div className="community-profile-heading">
              <span className="community-page-kicker">ПРОФІЛЬ ТРЕЙДЕРА</span>
              <h2>{p.displayName ?? "Трейдер"}</h2>
              {p.username && <p className="community-profile-handle">@{p.username}</p>}
              {p.status?.text && <p className="community-profile-status">{p.status.text}</p>}
              {p.joinedAt && !Number.isNaN(new Date(p.joinedAt).getTime()) && <p className="community-profile-joined">
                У спільноті з {new Date(p.joinedAt).toLocaleDateString("uk-UA", { year: "numeric", month: "long" })}
              </p>}
            </div>
            <div className="community-profile-hero-actions">
              {id === user?.uid && <button type="button" className="community-profile-edit-appearance"
                onClick={() => navigateProfileSection("about")}>Налаштувати профіль</button>}
              {p.publicUrl && (
                <a className="community-profile-link" href={p.publicUrl} target="_blank" rel="noopener noreferrer">
                  Персональна сторінка ↗
                </a>
              )}
            </div>
          </div>
          <div className="community-profile-description">
            {p.bio && <p className="community-profile-bio">{p.bio}</p>}
            {p.interests && <p><b>Інтереси:</b> {p.interests}</p>}
            {p.lifestyle && <p><b>Про себе:</b> {p.lifestyle}</p>}
            <div className="community-profile-meta">
              {typeof p.points === "number" && (
                <span>Досягнення участі: {p.points} · не торговий рейтинг</span>
              )}
              {p.telegram &&
                /^https:\/\/t\.me\/[A-Za-z0-9_]+$/.test(p.telegram) && (
                  <a href={p.telegram} target="_blank" rel="noopener noreferrer">
                    Telegram-канал ↗
                  </a>
                )}
            </div>
          </div>
        </article>
      )}
      {id !== user?.uid && p && (
        <section id="community-profile-contact" className="community-profile-connect" data-contact-focus={["friend", "message"].includes(requestedContact ?? "") ? "true" : undefined} aria-label="Зв'язок із трейдером">
          {friendships.error ? (
            <p role="status">{friendships.error}</p>
          ) : !friends ? (
            <p role="status">Перевіряємо запити дружби…</p>
          ) : (
            <>
              <span className="community-page-kicker">КОНТАКТИ</span>
              {requestedContact === "message" && !relation?.accepted && (
                <p className="community-profile-contact-hint">Для особистих повідомлень спочатку потрібно підтвердити дружбу.</p>
              )}
              {relation?.accepted ? (
                <>
                  <span className="community-profile-friend-status">Ви друзі</span>
                  <button
                    className="community-primary"
                    id="community-profile-message-action"
                    type="button"
                    onClick={() => onChatInvite(id, p.displayName ?? "Трейдер")}
                  >
                    <MessageCircle size={16} aria-hidden="true" />
                    Написати повідомлення
                  </button>
                  <button type="button" onClick={() => changeFriend("remove")}>Видалити з друзів</button>
                </>
              ) : relation?.incoming ? (
                <>
                  <span className="community-profile-request-status">Вхідний запит дружби</span>
                  <button id="community-profile-friend-action" className="community-primary" type="button" onClick={() => changeFriend("accept")}>
                    Прийняти запит
                  </button>
                </>
              ) : relation ? (
                <>
                  <span className="community-profile-request-status">Очікується відповідь</span>
                  <button id="community-profile-friend-action" type="button" onClick={() => changeFriend("cancel")}>Відкликати запит</button>
                </>
              ) : (
                <button id="community-profile-friend-action" className="community-primary" type="button" onClick={() => changeFriend("send")}>
                  <Users size={16} aria-hidden="true" />
                  Додати в друзі
                </button>
              )}
            </>
          )}
        </section>
      )}
      <nav className="community-profile-tabs" aria-label="Розділи профілю">
        {(
          [
            ["wall", "Стіна"],
            ["articles", "Статті та розбори"],
            ["setups", "HookChart"],
            ["about", "Про трейдера"],
            ["trades", "Статистика"],
          ] as const
        ).map(([key, label]) => (
          <button
            type="button"
            key={key}
            aria-pressed={profileSection === key}
            onClick={() => navigateProfileSection(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {profileSection === "articles" && (
        <section className="community-profile-articles" aria-label="Статті та розбори трейдера">
          <header className="community-section-heading">
            <div>
              <span className="community-page-kicker">БАЗА ЗНАНЬ ТРЕЙДЕРА</span>
              <h3>Статті та практичні розбори</h3>
              <p className="community-hint">Лише доступні вам навчальні дописи автора. Права доступу перевіряє Community.</p>
            </div>
          </header>
          {id === user?.uid && <>
            <button type="button" className="community-profile-write-article"
              aria-expanded={showArticleComposer} aria-controls="community-profile-article-composer"
              onClick={() => setShowArticleComposer(open => !open)}>
              {showArticleComposer ? "Закрити редактор статті" : "Написати статтю або навчальний розбір"}
            </button>
            {showArticleComposer && <div id="community-profile-article-composer">
              <Composer target={{ kind: "post" }} presetCategory="education"
                onPick={onPick} onSent={() => { articles.refresh(); setShowArticleComposer(false); }} run={run} />
            </div>}
          </>}
          {articles.error && <p role="status" className="community-profile-articles-error">{articles.error}</p>}
          {!articles.data && !articles.error && <p role="status">Завантажуємо навчальні матеріали…</p>}
          {articles.data && ![...articles.data.items, ...articlePages].some((item: any) => item.owner_id === id) &&
            <p className="community-empty">Доступних навчальних дописів поки немає.</p>}
          <div className="community-profile-article-list">
            {[...new Map([...(articles.data?.items ?? []), ...articlePages]
              .filter((item: any) => item.owner_id === id && item.body?.category === "education")
              .map((item: any) => [item.id, item])).values()].map((item: any) =>
                <ItemCard key={item.id} item={item} onChart={onChart}
                  onPick={onPick} run={run} refresh={articles.refresh} />)}
          </div>
          {articlesError && <p role="status" className="community-profile-articles-error">{articlesError}</p>}
          {articleNext && <button type="button" className="community-profile-articles-more"
            disabled={articlesBusy} onClick={() => void loadMoreArticles()}>
            {articlesBusy ? "Завантажуємо…" : "Ще статті та розбори"}
          </button>}
        </section>
      )}
      {profileSection === "setups" && (
        <section className="community-profile-setups" aria-label="HookChart трейдера">
          <header className="community-section-heading">
            <div>
              <span className="community-page-kicker">ЗБЕРЕЖЕНІ РОЗБОРИ</span>
              <h3>HookChart · формації та графіки</h3>
              <p className="community-hint">Тільки графіки, до яких ви маєте доступ. Приватні матеріали інших трейдерів не показуються.</p>
            </div>
          </header>
          <PublicSetupGalleryToolbar scope="authorized" filters={setupFilters}
            totalLoaded={loadedSetups.length} matches={visibleSetups.length}
            hasNextPage={!!setupNext} onChange={setSetupFilters} />
          {setups.error && <p className="community-profile-gallery-error" role="alert">{setups.error}</p>}
          {!setups.data && !setups.error && <p role="status">Завантажуємо доступні HookChart…</p>}
          {setups.data && !loadedSetups.length &&
            <div className="community-empty">Доступних графіків ще немає. Збережіть HookChart і прикріпіть його до допису.</div>}
          {loadedSetups.length > 0 && !visibleSetups.length &&
            <div className="community-empty">У завантажених графіках немає збігів із фільтрами.
              <button type="button" onClick={() => setSetupFilters({ ...DEFAULT_PUBLIC_SETUP_FILTERS })}>Очистити фільтри</button>
            </div>}
          <div className="community-profile-gallery-list">
            {visibleSetups.map((item: any) => (
              <ItemCard key={item.id} item={item} onChart={onChart} onPick={onPick}
                run={run} refresh={setups.refresh} />
            ))}
          </div>
          {setupsError && <p role="alert" className="community-profile-gallery-error">{setupsError}</p>}
          {setupNext && <button type="button" className="community-profile-gallery-more"
            disabled={setupsBusy} onClick={() => void loadMoreSetups()}>
            {setupsBusy ? "Завантажуємо…" : "Ще графіки"}
          </button>}
        </section>
      )}
      {profileSection === "about" && (
        <section className="community-profile-about" aria-label="Інформація про трейдера">
          <header className="community-section-heading">
            <div>
              <span className="community-page-kicker">ОСОБИСТИЙ ПРОСТІР</span>
              <h3>{id === user?.uid ? "Ваш профіль і приватність" : "Про трейдера"}</h3>
            </div>
          </header>
          {id === user?.uid ? (
            <>
        <form
          className="community-card community-form community-profile-editor"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const { publicProfileEnabled: _publicVisibility, ...fields } = form;
              await updateProfileData({ displayName, community: fields });
              resource.refresh();
            });
          }}
        >
          <h3>Що можуть бачити інші</h3>
          <label>
            Псевдонім
            <input
              value={displayName ?? ""}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {(
            [
              ["bio", "Про себе"],
              ["interests", "Інтереси"],
              ["lifestyle", "Звички й спосіб життя"],
              ["telegram", "Telegram-канал"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <textarea
                value={form[key] ?? ""}
                maxLength={2000}
                onChange={(e) =>
                  setForm((f: any) => ({ ...f, [key]: e.target.value }))
                }
              />
              <Audience
                value={
                  form[key + "Audience"] ??
                  (key === "bio" ? "public" : "private")
                }
                onChange={(value) =>
                  setForm((f: any) => ({ ...f, [key + "Audience"]: value }))
                }
              />
            </label>
          ))}
          <label>
            Мій статус
            <input
              value={form.status?.text ?? ""}
              placeholder="Аналізую 🔎 — сьогодні працюю за планом"
              maxLength={280}
              onChange={(e) =>
                setForm((f: any) => ({
                  ...f,
                  status: { ...f.status, text: e.target.value },
                }))
              }
            />
            <Audience
              value={form.status?.audience ?? "private"}
              onChange={(audience) =>
                setForm((f: any) => ({
                  ...f,
                  status: { ...f.status, audience },
                }))
              }
            />
          </label>
          <p className="community-hint">
            Особистий стан — ваш самоопис, не психологічний діагноз або доказ
            надійності. Не вказуйте адресу й точний побутовий розклад.
          </p>
          <button className="community-primary">Зберегти профіль</button>
        </form>
              <PublicProfileSettings />
            </>
          ) : (
            <div className="community-card community-profile-readonly">
              <p className="community-hint">Відображаються лише дані, до яких автор профілю відкрив доступ.</p>
              {p?.bio && <p><b>Про себе</b><span>{p.bio}</span></p>}
              {p?.interests && <p><b>Інтереси</b><span>{p.interests}</span></p>}
              {p?.lifestyle && <p><b>Звички та стиль життя</b><span>{p.lifestyle}</span></p>}
              {!p?.bio && !p?.interests && !p?.lifestyle && (
                <div className="community-empty">Трейдер поки не відкрив додаткову інформацію про себе.</div>
              )}
            </div>
          )}
        </section>
      )}
      {profileSection === "trades" && (
        <section className="community-profile-trades" aria-label="Угоди й статистика">
          <header className="community-section-heading">
            <div>
              <span className="community-page-kicker">ТОРГОВИЙ ЩОДЕННИК</span>
              <h3>Угоди та статистика</h3>
              <p className="community-hint">Відображаються лише доступні дані, отримані з підтверджених джерел, а не вигадані результати.</p>
            </div>
          </header>
          <Trades owner={id} run={run} />
        </section>
      )}
      {profileSection === "wall" && (
        <section className="community-profile-wall" aria-label="Стіна трейдера">
          <div className="community-section-heading">
            <div>
              <span className="community-page-kicker">ПУБЛІКАЦІЇ</span>
              <h3>Стіна</h3>
            </div>
          </div>
          {id === user?.uid && (
            <Composer
              target={{ kind: "post" }}
              onPick={onPick}
              onSent={wall.refresh}
              run={run}
            />
          )}
          {wall.error && <p role="status">{wall.error}</p>}
          {!wall.data && !wall.error && <p role="status">Завантажуємо публікації…</p>}
          {wall.data?.items &&
            !wall.data.items.some((item: any) => item.owner_id === id) && (
              <div className="community-empty">
                {id === user?.uid
                  ? "На вашій стіні поки немає дописів. Опублікуйте першу ідею!"
                  : "Тут поки немає доступних вам публікацій."}
              </div>
            )}
          {wall.data?.items
            ?.filter((item: any) => item.owner_id === id)
            .map((item: any) => (
              <ItemCard
                key={item.id}
                item={item}
                onChart={onChart}
                onPick={onPick}
                run={run}
                refresh={wall.refresh}
              />
            ))}
        </section>
      )}
    </>
  );
}

function CommunitySettings({ run }: { run: Run }) {
  const { profile, updateProfileData } = useAuth();
  const connections = useResource("connections", () =>
      apiJson(api + "/connections"),
    ),
    risk = useResource("risk", () => apiJson(api + "/risk")),
    notifications = useResource("notifications", () =>
      apiJson(api + "/notifications"),
    );
  const [key, setKey] = useState(""),
    [apiSecret, setApiSecret] = useState(""),
    [limits, setLimits] = useState<any>({
      hourly: "",
      daily: "",
      monthly: "",
      currency: "USDT",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  useEffect(() => {
    if (risk.data?.risk?.rule) setLimits(risk.data.risk.rule);
  }, [risk.data]);
  const savePrivacy = (key: string, value: string) =>
    run(() =>
      updateProfileData({ community: { ...profile?.community, [key]: value } }),
    );
  return (
    <section className="community-settings-view" aria-label="Налаштування Community">
      <header className="community-section-heading community-settings-heading">
        <div>
          <span className="community-page-kicker">КОНТРОЛЬ І БЕЗПЕКА</span>
          <h2>Налаштування спільноти</h2>
          <p>Керуйте приватністю, захистом акаунта та лише читальними підключеннями бірж.</p>
        </div>
      </header>
      <section className="community-card community-settings-intro">
        <h3>Прозорість і захист</h3>
        <p>
          Підтверджені біржові факти не редагуються користувачем. Джерело та
          охоплення показуються окремо; бейдж не означає, що автору можна
          передавати гроші або секрети.
        </p>
        <p>
          Ключ застосовується для читання. Надмірні права відхиляються.
          Read-only сервіс не закриває позиції й не може зупинити торгівлю на
          біржі. Підтримка не просить ключі в чатах, пароль біржі чи seed
          phrase.
        </p>
      </section>
      <AccountSecuritySettings />
      <section className="community-card community-form community-settings-exchanges">
        <h3>Біржі та API · Bybit Global / linear</h3>
        <p>
          Перший конектор читає закриті ордери реального рахунка. EU та інші
          непідтримувані типи ключів не обходяться альтернативними адресами.
        </p>
        <ol>
          <li>На біржі створіть окремий ключ для h00k.</li>
          <li>
            Виберіть тільки читання. Не дозволяйте торгівлю, перекази або
            виведення.
          </li>
          <li>
            Укажіть IP сервісу, наданий адміністратором. Не підключайте ключ,
            доки цей крок не налаштований.
          </li>
          <li>
            Підтвердіть email і 2FA h00k, введіть ключ і секрет лише в цій
            формі.
          </li>
          <li>
            Перевірте охоплення імпорту. Ключ можна відкликати на біржі
            будь-коли.
          </li>
        </ol>
        <a
          href="https://bybit-exchange.github.io/docs/v5/user/apikey-info"
          target="_blank"
          rel="noreferrer"
        >
          Офіційне пояснення дозволів Bybit ↗
        </a>
        <input
          aria-label="API-ключ Bybit"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="API-ключ"
        />
        <input
          aria-label="API-секрет Bybit"
          type="password"
          autoComplete="new-password"
          value={apiSecret}
          onChange={(e) => setApiSecret(e.target.value)}
          placeholder="Секрет"
        />
        <button
          type="button"
          onClick={() =>
            void run(async () => {
              await post(api + "/connections", { key, secret: apiSecret });
              setKey("");
              setApiSecret("");
              connections.refresh();
            })
          }
        >
          Перевірити читальні права й підключити
        </button>
        {connections.error && <p>{connections.error}</p>}
        {connections.data?.items?.map((c: any) => (
          <div key={c.id}>
            <b>
              {c.exchange} · {c.status}
            </b>
            <p>
              Дані:{" "}
              {c.synced_at
                ? new Date(c.synced_at).toLocaleString("uk-UA")
                : "ще не синхронізовано"}{" "}
              · покриття від{" "}
              {c.covered_from
                ? new Date(c.covered_from).toLocaleDateString("uk-UA")
                : "невідомо"}
            </p>
            <button
              type="button"
              onClick={() =>
                void run(async () => {
                  await post(api + "/connections/" + c.id + "/sync", {});
                  connections.refresh();
                  risk.refresh();
                })
              }
            >
              Синхронізувати
            </button>
            <button
              type="button"
              onClick={() =>
                void run(async () => {
                  await apiJson(api + "/connections/" + c.id, {
                    method: "DELETE",
                  });
                  connections.refresh();
                })
              }
            >
              Видалити ключ із h00k
            </button>
          </div>
        ))}
      </section>
      <form
        className="community-card community-form community-settings-risk"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await post(api + "/risk", limits);
            risk.refresh();
            notifications.refresh();
          });
        }}
      >
        <h3>Ліміти суми збиткових закриттів</h3>
        <p>
          Прибуткові закриття не компенсують використаний ліміт. Ураховуються
          придатні імпортовані дані. Сповіщення не є блокуванням біржі.
        </p>
        <div className="community-fields">
          {[
            ["hourly", "За останні 60 хвилин"],
            ["daily", "За місцевий день"],
            ["monthly", "За календарний місяць"],
          ].map(([field, label]) => (
            <label key={field}>
              {label}
              <input
                type="number"
                step="any"
                min="0"
                value={limits[field] ?? ""}
                onChange={(e) =>
                  setLimits((s: any) => ({ ...s, [field]: e.target.value }))
                }
              />
            </label>
          ))}
        </div>
        <label>
          Часова зона
          <input
            value={limits.timezone}
            onChange={(e) =>
              setLimits((s: any) => ({ ...s, timezone: e.target.value }))
            }
          />
        </label>
        <select
          aria-label="Валюта ліміту"
          value={limits.currency}
          onChange={(e) =>
            setLimits((s: any) => ({ ...s, currency: e.target.value }))
          }
        >
          <option>USDT</option>
          <option>USDC</option>
        </select>
        <button className="community-primary">Зберегти правила</button>
        {risk.error && <p>{risk.error}</p>}
        {Object.entries(risk.data?.risk?.windows ?? {}).map(
          ([name, w]: [string, any]) => (
            <p key={name}>
              {name}: {w.used} / {w.limit ?? "не задано"} {limits.currency} ·{" "}
              {w.complete
                ? "повне актуальне покриття"
                : "дані неповні або оновлення затримане"}
            </p>
          ),
        )}
      </form>
      <section className="community-card community-form community-settings-notifications">
        <h3>Показ сповіщень</h3>
        <p>Виберіть, які події бачити у центрі сповіщень. Налаштування синхронізуються між вашими пристроями. Критичні повідомлення безпеки залишаються доступними.</p>
        <label className="community-notification-preference">
          <input type="checkbox"
            checked={profile?.community?.notificationChatInbox !== false}
            onChange={(event) => void run(() => updateProfileData({
              community: { notificationChatInbox: event.target.checked },
            }))} />
          <span><strong>Непрочитані особисті та групові чати</strong>
            <small>Показувати кількість непрочитаних і перехід до розмови. Самі тексти повідомлень не відображаються у сповіщеннях.</small>
          </span>
        </label>
        <label className="community-notification-preference">
          <input type="checkbox"
            checked={profile?.community?.notificationSocialInbox !== false}
            onChange={(event) => void run(() => updateProfileData({
              community: { notificationSocialInbox: event.target.checked },
            }))} />
          <span><strong>Друзі, коментарі та нагороди</strong>
            <small>Показувати соціальні події у центрі сповіщень. Це не видаляє вже збережені події.</small>
          </span>
        </label>
        <p className="community-hint">Ці перемикачі керують лише центром сповіщень, а не доставкою push або роботою чатів. Лічильники непрочитаних у списку чатів залишаються доступними.</p>
      </section>
      <section className="community-card community-settings-privacy">
        <h3>Фінансова приватність</h3>
        {[
          ["statisticsAudience", "Загальні показники"],
          ["tradesAudience", "Список угод"],
          ["amountsAudience", "Суми й обсяги"],
          ["notesAudience", "Причини входу й нотатки"],
        ].map(([field, label]) => (
          <label className="community-privacy-row" key={field}>
            {label}
            <Audience
              value={(profile?.community as any)?.[field] ?? "private"}
              onChange={(value) => void savePrivacy(field, value)}
            />
          </label>
        ))}
      </section>
      <Rankings run={run} />
      <section className="community-card">
        <h3>Особисті сповіщення</h3>
        {notifications.data?.items?.map((n: any) => (
          <p key={n.id}>
            {new Date(n.created_at).toLocaleString("uk-UA")} ·{" "}
            {n.type === "risk"
              ? `Досягнуто ліміт ${n.body.window}: ${n.body.used} / ${n.body.limit} ${n.body.currency}`
              : (n.body?.text ?? n.type)}
          </p>
        ))}
        {!notifications.data?.items?.length && <p>Сповіщень поки немає.</p>}
      </section>
    </section>
  );
}

function Rankings({ run }: { run: Run }) {
  const { profile, updateProfileData } = useAuth();
  const resource = useResource("rankings", () => apiJson(api + "/rankings"));
  return (
    <section className="community-card">
      <h3>Рейтинг за win rate закриттів</h3>
      <p>{resource.data?.method}</p>
      <p>
        Участь добровільна. Абсолютні суми й капітал у таблицю не потрапляють.
        Показник не засвідчує дохідність або надійність особистих пропозицій
        автора.
      </p>
      <label className="community-task">
        <input
          type="checkbox"
          checked={profile?.community?.rankingPublic === true}
          onChange={(e) => {
            const rankingPublic = e.target.checked;
            void run(async () => {
              await updateProfileData({
                community: { ...profile?.community, rankingPublic },
              });
              resource.refresh();
            });
          }}
        />
        Брати участь у публічному порівнянні
      </label>
      {resource.data?.items?.map((r: any, i: number) => (
        <p key={r.id}>
          {i + 1}. {r.name} · {r.count} закриттів ·{" "}
          {r.winRate === null ? "—" : r.winRate.toFixed(1) + "%"}
        </p>
      ))}
      {!resource.data?.items?.length && (
        <p>
          Ще немає учасників із достатньою підтвердженою історією поточного
          періоду.
        </p>
      )}
    </section>
  );
}
