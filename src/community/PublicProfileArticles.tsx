import React from "react";
import {
  ArrowLeft, ArrowUpRight, BookOpenText, CalendarDays, Check, Clock3, Copy,
  MessageCircle, ShieldCheck, ChartNoAxesCombined, Send,
} from "lucide-react";
import type { ChartDocument } from "./chartDocument";
import { ChartPreview } from "../components/community/ChartPreview";
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

function photoUrl(base: string, postId: string, mediaId: string): string {
  return base + "/posts/" + encodeURIComponent(postId) + "/media/" + encodeURIComponent(mediaId);
}

function actualReactions(post: PublicEducationalPost) {
  return post.reactions?.filter(row => Number.isInteger(row.count) && row.count > 0) ?? [];
}

/** Design port of social/ArticlesView, intentionally using only public API data. */
export function PublicProfileArticles({ posts, selected, pending, profile, base, copied, onShare, onOpenChart }: Props) {
  const articles = posts.filter(post => post.category === "education");
  if (pending) return <p className="public-profile-loading" role="status">Відкриваємо публічну статтю…</p>;
  if (selected && selected.category === "education") {
    const cover = selected.photos?.[0];
    return <article className="public-article-reader" id={"post-" + selected.id}>
      <a className="public-article-back" href={publicArticlesUrl(profile.url)}>
        <ArrowLeft size={16} aria-hidden="true" /> Назад до списку статей
      </a>
      <div className="public-article-reader-cover">
        {cover ? <img src={photoUrl(base, selected.id, cover)} alt="" loading="eager" /> :
          <BookOpenText size={62} aria-hidden="true" />}
        <span className="public-article-readtime"><Clock3 size={14} aria-hidden="true" /> ≈ {publicArticleReadMinutes(selected.text)} хв читання</span>
      </div>
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
      {selected.photos.length > 1 && <div className="public-article-reader-gallery" aria-label="Фотографії до статті">
        {selected.photos.slice(1).map(mediaId => <img key={mediaId}
          loading="lazy" alt="Ілюстрація до статті" src={photoUrl(base, selected.id, mediaId)} />)}
      </div>}
      {selected.chart && <div className="public-article-chart">
        <h3><ChartNoAxesCombined size={18} aria-hidden="true" /> Збережений розбір HookChart</h3>
        <ChartPreview document={selected.chart} onOpen={() => onOpenChart(selected.id)} />
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
          {post.photos?.[0] ? <img src={photoUrl(base, post.id, post.photos[0])}
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
