import React, { useState } from "react";
import { ChartNoAxesColumnIncreasing, ShieldCheck, TrendingUp } from "lucide-react";
import { publicClosedOrderOverview, type ClosedOrderSummary } from "./publicProfileSocialModel";

export type PublicTradeWindow = {
  days: 7 | 30;
  totals: ClosedOrderSummary[];
};

type Props = {
  windows: PublicTradeWindow[];
};

/**
 * Only server-aggregated public closed orders. Switching windows is local:
 * no chart engine, no exchange request, no pagination over private trades.
 */
export function PublicProfileTradeWindows({ windows }: Props) {
  const [days, setDays] = useState<7 | 30>(30);
  const selected = windows.find(window => window.days === days);
  const totals = selected?.totals ?? [];
  const overview = publicClosedOrderOverview(totals);
  const count = overview.count;
  const share = (amount: number) => count > 0 ? 100 * amount / count : 0;

  return <section className="public-profile-trade-windows public-profile-panel"
    aria-labelledby="public-profile-trade-windows-title">
    <div className="public-profile-trade-windows-header">
      <div>
        <span className="public-profile-kicker">ІМПОРТОВАНІ ЗАКРИТТЯ</span>
        <h3 id="public-profile-trade-windows-title">
          <ChartNoAxesColumnIncreasing size={18} aria-hidden="true" />
          Результати за період
        </h3>
      </div>
      <div className="public-profile-trade-windows-switch" role="group" aria-label="Період закриття ордерів">
        {([7, 30] as const).map(period => <button key={period} type="button"
          aria-pressed={days === period} onClick={() => setDays(period)}>
          {period} днів
        </button>)}
      </div>
    </div>
    <p className="public-profile-muted">Лише імпортовані закриті ордери за останні {days} днів. Дані можуть охоплювати не весь період або не всі рахунки.</p>
    {count ? <>
      <div className="public-profile-trade-window-metrics">
        <div><span>Закриттів</span><strong>{count}</strong></div>
        <div><span>Win rate</span><strong>{overview.winRate === null ? "—" : overview.winRate.toFixed(1) + "%"}</strong></div>
        <div><span>Прибуткові</span><strong>{overview.wins}</strong></div>
        <div><span>Збиткові</span><strong>{overview.losses}</strong></div>
        <div><span>Беззбиткові</span><strong>{overview.flat}</strong></div>
      </div>
      <div className="public-profile-trade-window-distribution" role="img"
        aria-label={`Із ${count} закриттів: прибуткових ${overview.wins}, збиткових ${overview.losses}, беззбиткових ${overview.flat}`}>
        {overview.wins > 0 && <span className="public-profile-trade-window-wins" style={{ width: share(overview.wins) + "%" }} />}
        {overview.losses > 0 && <span className="public-profile-trade-window-losses" style={{ width: share(overview.losses) + "%" }} />}
        {overview.flat > 0 && <span className="public-profile-trade-window-flat" style={{ width: share(overview.flat) + "%" }} />}
      </div>
      <div className="public-profile-trade-window-legend">
        <span><i className="public-profile-trade-window-wins" /> Прибуткові</span>
        <span><i className="public-profile-trade-window-losses" /> Збиткові</span>
        <span><i className="public-profile-trade-window-flat" /> Беззбиткові</span>
      </div>
      <div className="public-profile-trade-window-currencies">
        {totals.map(row => <section key={row.currency} className="public-profile-trade-window-currency">
          <strong>{row.currency}</strong>
          <span>{row.count} закриттів · Win rate {row.winRate === null ? "—" : row.winRate.toFixed(1) + "%"}</span>
          {row.pnl !== undefined && <small>Сумарний PnL: {row.pnl} {row.currency}</small>}
        </section>)}
      </div>
    </> : <p className="public-profile-trade-window-empty" role="status">
      За останні {days} днів імпортованих закриттів немає.
    </p>}
    <p className="public-profile-trade-window-disclaimer">
      <ShieldCheck size={15} aria-hidden="true" />
      <span>Win rate не враховує беззбиткові закриття. PnL видно лише з окремого дозволу трейдера, по кожній валюті незалежно. Це не дохідність рахунку.</span>
    </p>
  </section>;
}
