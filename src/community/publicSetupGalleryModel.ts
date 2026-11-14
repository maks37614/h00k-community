import type { ChartDocument } from "./chartDocument";
import { publicProfileSetups } from "./publicProfileSocialModel";

/** Search only the already-authorized, currently loaded gallery page(s). */
export type PublicSetupGalleryFilters = {
  symbol: string;
  exchange: "all" | "binance" | "bybit";
  timeframe: "all" | ChartDocument["timeframe"];
  levels: "all" | "complete" | "marked";
};
export type PublicSetupGalleryItem = { id: string; chart: ChartDocument | null };

export const DEFAULT_PUBLIC_SETUP_FILTERS: PublicSetupGalleryFilters = {
  symbol: "", exchange: "all", timeframe: "all", levels: "all",
};

export function hasPublicSetupEntryStopTarget(document: ChartDocument): boolean {
  const markers = document.markers;
  const has = (type: string) => markers.some(marker =>
    marker.type === type && Number.isFinite(marker.price) && marker.price > 0,
  );
  return has("entry") && has("stop_loss") && has("target");
}

function hasAnyTradeLevel(document: ChartDocument): boolean {
  return document.markers.some(marker =>
    (marker.type === "entry" || marker.type === "stop_loss" || marker.type === "target") &&
    Number.isFinite(marker.price) && marker.price > 0,
  );
}

/**
 * "Complete" means an author's saved Entry + SL + TP annotations are present,
 * NOT that a detector verified the pattern or that the trade is profitable.
 * This function never fetches data, mutates snapshots or infers a 0-100 score.
 */
export function filterPublicSetupGallery<T extends PublicSetupGalleryItem>(
  posts: readonly T[], filters: PublicSetupGalleryFilters,
): T[] {
  const search = filters.symbol.trim().toLocaleUpperCase().replace(/\s+/g, "").slice(0, 32);
  return publicProfileSetups(posts).filter(item => {
    const chart = item.chart!;
    if (search && !chart.symbol.toLocaleUpperCase().includes(search)) return false;
    if (filters.exchange !== "all" && chart.exchange !== filters.exchange) return false;
    if (filters.timeframe !== "all" && chart.timeframe !== filters.timeframe) return false;
    if (filters.levels === "complete" && !hasPublicSetupEntryStopTarget(chart)) return false;
    if (filters.levels === "marked" && !hasAnyTradeLevel(chart)) return false;
    return true;
  });
}
