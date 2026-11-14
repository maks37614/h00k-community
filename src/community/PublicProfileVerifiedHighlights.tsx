import React from "react";
import { Award, CalendarClock, CheckCircle2, ShieldCheck, Star, Trophy } from "lucide-react";
import {
  publicAwardCards, publicStatsFreshness,
  type PublicAwardsAggregate, type PublicStatsCoverage,
} from "./publicProfileVerifiedModel";

/** Badge showcase driven exclusively by public opt-in gift aggregates. */
export function PublicProfileVerifiedAwards({ awards }: { awards: PublicAwardsAggregate }) {
  const cards = publicAwardCards(awards);
  if (!cards.length) {
    return <p className="public-profile-verified-empty">
      <Award size={17} aria-hidden="true" /> Нагороди ще не отримані. Демонстраційні відзнаки не показуються.
    </p>;
  }
  return <ul className="public-profile-verified-awards" aria-label="Отримані нагороди Community">
    {cards.map(card => {
      const Icon = card.id === "thanks" ? Trophy : card.id === "analysis" ? Star : Award;
      return <li className={"public-profile-verified-award public-profile-verified-award-" + card.id}
        key={card.id}>
        <span className="public-profile-verified-award-icon"><Icon size={19} aria-hidden="true" /></span>
        <div className="public-profile-verified-award-info">
          <strong>{card.title}</strong>
          <small>{card.description}</small>
        </div>
        <span className="public-profile-verified-award-count"
          aria-label={card.title + ": " + card.count}>{card.count}</span>
      </li>;
    })}
  </ul>;
}

/** Clarifies the verified import window without claiming arbitrary 30-day returns. */
export function PublicProfileImportFreshness({ coverage }: { coverage: PublicStatsCoverage[] }) {
  const status = publicStatsFreshness(coverage);
  if (!status.lastSyncedAt && !status.earliestCoveredFrom) {
    return <div className="public-profile-import-freshness" role="note">
      <ShieldCheck size={15} aria-hidden="true" />
      <span>Дата синхронізації біржі наразі недоступна.</span>
    </div>;
  }
  return <div className="public-profile-import-freshness" role="note">
    <CheckCircle2 size={17} aria-hidden="true" />
    <div>
      <strong>Дані з підключеної біржі</strong>
      {status.lastSyncedAt && <time dateTime={status.lastSyncedAt}>
        <CalendarClock size={13} aria-hidden="true" />
        Остання синхронізація: {new Date(status.lastSyncedAt).toLocaleString("uk-UA")}
      </time>}
      {status.earliestCoveredFrom && <time dateTime={status.earliestCoveredFrom}>
        Покриття підключення від {new Date(status.earliestCoveredFrom).toLocaleDateString("uk-UA")}
      </time>}
      <small>Час синхронізації не гарантує повноту історії угод.</small>
    </div>
  </div>;
}
