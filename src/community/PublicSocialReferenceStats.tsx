import React from "react";

/**
 * Mirrors social/src/components/TraderProfileView.tsx six-card KPI presentation,
 * but uses ONLY the fields the public Community API has explicitly released.
 * Never manufacture R:R, PF, top trades, favourite pairs, PnL or social counts.
 */
export type SocialPublicTradeWindow = {
  days: number;
  totals: Array<{
    currency: string;
    count: number;
    wins: number;
    losses: number;
    flat: number;
    winRate: number | null;
    pnl?: string;
  }>;
};

export type SocialPublicStatistics = {
  coverage: Array<{ status: string; synced_at?: string; covered_from?: string }>;
  windows?: SocialPublicTradeWindow[];
} | null;

function numberFromCounts(n: number): number {
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function sourceProfileKpis(statistics: SocialPublicStatistics) {
  const totals = statistics?.windows?.find(w => w.days === 30)?.totals;
  // No windows or no public statistics means unavailable, NOT zero.
  if (!totals) return { count: null, winRate: null, pnl: null, currency: null };
  const count = totals.reduce((sum, t) => sum + numberFromCounts(t.count), 0);
  const wins = totals.reduce((sum, t) => sum + numberFromCounts(t.wins), 0);
  const losses = totals.reduce((sum, t) => sum + numberFromCounts(t.losses), 0);
  const winRate = wins + losses > 0 ? wins / (wins + losses) * 100 : null;
  // We may show an amount only when the server explicitly opted into releasing
  // it and the entire 30-day total is expressed in ONE currency.
  const oneCurrency = totals.length === 1 ? totals[0] : null;
  const pnl = oneCurrency && typeof oneCurrency.pnl === "string" &&
    /^-?\d+(?:\.\d+)?$/.test(oneCurrency.pnl) ? oneCurrency.pnl : null;
  return { count, winRate, pnl, currency: pnl ? oneCurrency!.currency : null };
}

const unavailable = "Не оприлюднено у Community; демонстраційні показники не використовуються.";

export function PublicSocialReferenceStats({ statistics }: { statistics: SocialPublicStatistics }) {
  const kpi = sourceProfileKpis(statistics);
  const cards = [
    { id: "win-rate", label: "Win Rate", value: kpi.winRate === null ? "—" : kpi.winRate.toFixed(1) + "%",
      detail: kpi.count === null ? unavailable : "Прибуткові / (прибуткові + збиткові) закриття за 30 днів" },
    { id: "pnl", label: "PnL (30d)",
      value: kpi.pnl === null ? "—" : kpi.pnl + " " + kpi.currency,
      detail: kpi.pnl === null ? "Сума недоступна або вимкнена власником; різні валюти не об'єднуються." : "Лише імпортовані закриття, не дохідність усього рахунку" },
    { id: "risk-reward", label: "Середній R:R", value: "—",
      detail: "Ризик/прибуток не можна відновити лише з сумарних закритих ордерів." },
    { id: "profit-factor", label: "Profit Factor", value: "—",
      detail: "Для розрахунку потрібні роздільні суми прибутків і збитків; API їх не публікує." },
    { id: "best-trade", label: "Топ трейд", value: "—",
      detail: "Профіль не публікує окремі угоди без дозволу власника." },
    { id: "favourite-pairs", label: "Улюблені пари", value: "—",
      detail: "Перелік торгових пар не передається до публічного профілю." },
  ];
  return <div className="public-profile-social-source-stats">
    <div className="public-profile-social-source-head">
      <strong>Трейдерська статистика &amp; Результати (30 днів)</strong>
      <span>Bybit linear · закриті ордери · за дозволом власника</span>
    </div>
    <dl className="public-profile-social-source-grid">
      {cards.map(card => <div className={"public-profile-social-source-kpi public-profile-social-source-" + card.id} key={card.id}>
        <dt>{card.label}</dt>
        <dd>{card.value}</dd>
        <small>{card.detail}</small>
      </div>)}
    </dl>
    <p className="public-profile-social-source-caveat" role="note">
      Дані 30-денного вікна беруться лише з дозволеного публічного імпорту.
      Порожні показники означають відсутність або обмеження даних, не нульові результати.
    </p>
  </div>;
}
