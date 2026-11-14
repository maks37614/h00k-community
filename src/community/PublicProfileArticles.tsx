import React from "react";
import {
  ArrowLeft, ArrowUpRight, BookOpenText, CalendarDays, Check, Clock3, Copy,
  MessageCircle, ShieldCheck, ChartNoAxesCombined, Send,
} from "lucide-react";
import type { ChartDocument } from "./chartDocument";
import { ChartPreview } from "../components/community/ChartPreview";
import { PublicProfileChartContext } from "./PublicProfileChartContext";
import { PublicProfileChartLevels } from "./PublicProfileChartLevels";
import { PublicProfilePhotoGallery } from "./PublicProfilePhotoGallery";
import { publicPhotoIds, publicPhotoUrl } from "./publicProfilePhotosModel";
import {
  communityPostUrl, publicArticleExcerpt, publicArticleReadMinutes, publicArticleUrl,
  publicArticlesUrl, type PublicReactionSummary,
} from "./publicProfileViewModel";
import { publicTelegramShareUrl } from "./publicDiscussionModel";
import "./publicProfileArticles.css";

export type PublicEducationalPost = {
  id: string;
  createdAt: string;
  title: string;
  text: string;
  category?: "general" | "idea" | "analysis" | "education";
  photos: string[];
  chart: ChartDocument | null;
  reactions?: PublicReactionSummary[];
};

type PublicAuthor = {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  url: string;
  communityOrigin: string;
};

type Props = {
  posts: PublicEducationalPost[];
  selected: PublicEducationalPost | null;
  pending: boolean;
  profile: PublicAuthor;
  base: string;
  copied: string;
  onShare: (id: string) => void;
  onOpenChart: (id: string) => void;
};

function coverPhotoUrl(base: string, post: PublicEducationalPost): string | null {
  const id = publicPhotoIds(post.photos)[0];
  return id ? publicPhotoUrl(base, post.id, id) : null;
}

function actualReactions(post: PublicEducationalPost) {
  return post.reactions?.filter(row => Number.isInteger(row.count) && row.count > 0) ?? [];
}

/** Design port of social/ArticlesView, intentionally using only public API data. */
export function PublicProfileArticles({ posts, selected, pending, profile, base, copied, onShare, onOpenChart }: Props) {
  const articles = posts.filter(post => post.category === "education");
  if (pending) return <p className="public-profile-loading" role="status">Відкриваємо публічну статтю…</p>;
  if (selected && selected.category === "education") {
    return <article className="public-article-reader" id={"post-" + selected.id}>
      <a className="public-article-back" href={publicArticlesUrl(profile.url)}>
        <ArrowLeft size={16} aria-hidden="true" /> Назад до списку статей
      </a>
      <PublicProfilePhotoGallery ids={selected.photos} postId={selected.id} base={base}
        label={"Стаття: " + (selected.title || "Розбір трейдера")}
        variant="article" readMinutes={publicArticleReadMinutes(selected.text)} />
      <div className="public-article-reader-head">
        <span className="public-profile-post-kind">Навчальна публікація</span>
        <h2>{selected.title || "Розбір трейдера"}</h2>
        <div className="public-article-author">
          <span className="public-profile-post-avatar" aria-hidden="true">
            {profile.displayName.slice(0, 1).toUpperCase()}
            {profile.avatarUrl && <img src={profile.avatarUrl} alt="" onError={event => { event.currentTarget.hidden = true; }} />}
          </span>
          <span><strong>{profile.displayName}</strong><small>@{profile.username}</small></span>
          <time dateTime={selected.createdAt}><CalendarDays size={14} aria-hidden="true" /> {new Date(selected.createdAt).toLocaleDateString("uk-UA")}</time>
        </div>
      </div>
      <div className="public-article-reader-body">{selected.text || "Автор не додав текст до цієї публікації."}</div>
      {selected.chart && <div className="public-article-chart">
        <h3><ChartNoAxesCombined size={18} aria-hidden="true" /> Збережений розбір HookChart</h3>
        <PublicProfileChartContext document={selected.chart} />
        <ChartPreview document={selected.chart} onOpen={() => onOpenChart(selected.id)} />
        <PublicProfileChartLevels document={selected.chart} />
        <p>Публічний знімок графіка без живого підключення до біржі.</p>
      </div>}
      <div className="public-article-actions">
        <span><ShieldCheck size={16} aria-hidden="true" /> Показано лише дані, відкриті автором</span>
        {actualReactions(selected).length > 0 && <div className="public-profile-reactions" aria-label="Реакції">
          {actualReactions(selected).map(row => <span key={row.emoji}>{row.emoji} {row.count}</span>)}
        </div>}
        <button type="button" onClick={() => onShare(selected.id)}>
          {copied === "article:" + selected.id ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
          {copied === "article:" + selected.id ? "Посилання скопійовано" : "Поділитися статтею"}
        </button>
        <a href={publicTelegramShareUrl(publicArticleUrl(profile.url, selected.id), selected.title || selected.text.slice(0, 120))}
          target="_blank" rel="noopener noreferrer"><Send size={16} aria-hidden="true" /> Telegram</a>
        <a href={communityPostUrl(profile.communityOrigin, selected.id)}>
          <MessageCircle size={16} aria-hidden="true" /> Обговорити у Community <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      </div>
      {copied === "error:article:" + selected.id && <p className="public-profile-error" role="status">Не вдалося скопіювати посилання на статтю.</p>}
    </article>;
  }

  if (!articles.length) return null;
  return <div className="public-article-grid" aria-label="Навчальні матеріали трейдера">
    {articles.map(post => <article className="public-article-card" key={post.id}>
      <a className="public-article-card-link" href={publicArticleUrl(profile.url, post.id)}
        aria-label={"Читати статтю: " + (post.title || "Розбір трейдера")}>
        <div className="public-article-card-image">
          {coverPhotoUrl(base, post) ? <img src={coverPhotoUrl(base, post) ?? undefined}
            loading="lazy" alt="" /> : <BookOpenText size={45} aria-hidden="true" />}
          <span><Clock3 size={13} aria-hidden="true" /> ≈ {publicArticleReadMinutes(post.text)} хв читання</span>
        </div>
        <div className="public-article-card-content">
          <small>ПУБЛІЧНИЙ РОЗБІР</small>
          <h3>{post.title || "Розбір трейдера"}</h3>
          <p>{publicArticleExcerpt(post.text)}</p>
        </div>
        <div className="public-article-card-footer">
          <strong>{profile.displayName}</strong>
          <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleDateString("uk-UA")}</time>
          <span>Читати <ArrowUpRight size={14} aria-hidden="true" /></span>
        </div>
      </a>
    </article>)}
  </div>;
}
