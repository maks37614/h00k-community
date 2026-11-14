import React from "react";
import { CalendarClock, ChartNoAxesCombined, ShieldCheck } from "lucide-react";
import type { ChartDocument } from "./chartDocument";

/**
 * Metadata displayed only for chart snapshots already authorized by the
 * public profile API. This is a static header — no exchange calls or live data.
 */
export function PublicProfileChartContext({ document }: { document: ChartDocument }) {
  const captured = Number.isFinite(document.capturedAt)
    ? new Date(document.capturedAt) : null;
  const capturedAt = captured && !Number.isNaN(captured.getTime())
    ? captured.toLocaleString("uk-UA", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;
  const exchange = document.exchange === "bybit" ? "Bybit" : "Binance";
  const market = document.marketType === "spot" ? "Spot" : "Futures";
  const archiveScore = document.qualityProof?.payload;

  return <div className="public-profile-chart-context">
    <div className="public-profile-chart-context-heading">
      <ChartNoAxesCombined size={17} aria-hidden="true" />
      <strong>{document.symbol}</strong>
      <span className="public-profile-chart-context-pill">{document.timeframe}</span>
      <span className="public-profile-chart-context-exchange">{exchange} · {market}</span>
    </div>
    <div className="public-profile-chart-context-info">
      {capturedAt && <time dateTime={captured!.toISOString()}>
        <CalendarClock size={13} aria-hidden="true" /> Знімок: {capturedAt}
      </time>}
      <span><ShieldCheck size={13} aria-hidden="true" /> Без live-даних</span>
      {archiveScore
        ? <span className="public-profile-chart-archive-score"
            title="Сервер перевірив підпис архівного запису під час збереження цього графіка">
            Оцінка з архіву h00k: <strong>{archiveScore.score}/100</strong>
          </span>
        : <span title="Знімок не містить підписаного архівного запису з оцінкою">Оцінка з архіву: недоступна</span>}
    </div>
    {archiveScore && <p className="public-profile-chart-archive-disclaimer">
      Підпис підтверджує походження архівного запису h00k.top, а не точність алгоритму,
      актуальність ринку чи виконання угоди. Рубрика: standard 72/13/15 (v1).
      Час у записі: {new Date(archiveScore.assessedAt).toLocaleString("uk-UA")}.
    </p>}
  </div>;
}
