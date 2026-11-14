import React from "react";
import { ListFilter, RotateCcw, Search } from "lucide-react";
import type { PublicSetupGalleryFilters as Filters } from "./publicSetupGalleryModel";
import { DEFAULT_PUBLIC_SETUP_FILTERS } from "./publicSetupGalleryModel";

type Props = {
  filters: Filters;
  totalLoaded: number;
  matches: number;
  hasNextPage: boolean;
  onChange: (next: Filters) => void;
};

/** Client-only presentation; filtering never sends the viewer's search to an API. */
export function PublicSetupGalleryToolbar({ filters, totalLoaded, matches, hasNextPage, onChange }: Props) {
  const reset = filters.symbol !== "" || filters.exchange !== "all" ||
    filters.timeframe !== "all" || filters.levels !== "all";
  return <section className="public-setup-gallery-toolbar" aria-label="Фільтри публічних HookChart">
    <div className="public-setup-gallery-toolbar-top">
      <h3><ListFilter size={16} aria-hidden="true" /> Фільтри галереї</h3>
      <span role="status" aria-live="polite">{matches} із {totalLoaded} завантажених графіків</span>
    </div>
    <div className="public-setup-gallery-toolbar-fields">
      <label className="public-setup-gallery-symbol">
        <span>Монета</span>
        <span className="public-setup-gallery-input-wrap">
          <Search size={15} aria-hidden="true" />
          <input type="search" autoComplete="off" maxLength={32}
            placeholder="BTCUSDT, ETH…" value={filters.symbol}
            onChange={e => onChange({ ...filters, symbol: e.target.value })}
          />
        </span>
      </label>
      <label><span>Біржа</span>
        <select value={filters.exchange} onChange={e => onChange({
          ...filters, exchange: e.target.value as Filters["exchange"],
        })}>
          <option value="all">Усі біржі</option>
          <option value="binance">Binance</option>
          <option value="bybit">Bybit</option>
        </select>
      </label>
      <label><span>Таймфрейм</span>
        <select value={filters.timeframe} onChange={e => onChange({
          ...filters, timeframe: e.target.value as Filters["timeframe"],
        })}>
          <option value="all">Усі TF</option>
          {(["1m", "5m", "15m", "1h", "4h", "1d"] as const).map(tf =>
            <option value={tf} key={tf}>{tf}</option>)}
        </select>
      </label>
      <label><span>Розмітка</span>
        <select value={filters.levels} onChange={e => onChange({
          ...filters, levels: e.target.value as Filters["levels"],
        })}>
          <option value="all">Усі знімки</option>
          <option value="marked">Є рівні Entry, SL або TP</option>
          <option value="complete">Є Entry + SL + TP</option>
        </select>
      </label>
    </div>
    <div className="public-setup-gallery-toolbar-bottom">
      {reset && <button type="button" className="public-setup-gallery-reset"
        onClick={() => onChange({ ...DEFAULT_PUBLIC_SETUP_FILTERS })}>
        <RotateCcw size={14} aria-hidden="true" /> Очистити фільтри
      </button>}
      <small>Пошук серед уже завантажених публічних графіків.
        {hasNextPage ? " Нижче можна завантажити наступні сторінки." : ""}
        {" "}Наявність Entry/SL/TP не є перевіркою якості або виконання угоди.
      </small>
    </div>
  </section>;
}
