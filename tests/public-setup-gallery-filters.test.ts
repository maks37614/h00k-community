import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { captureChartDocument, type ChartDocument } from "../src/community/chartDocument";
import {
  DEFAULT_PUBLIC_SETUP_FILTERS, filterPublicSetupGallery, hasPublicSetupEntryStopTarget,
} from "../src/community/publicSetupGalleryModel";
import { PublicSetupGalleryToolbar } from "../src/community/PublicSetupGalleryToolbar";

const view = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
const toolbar = readFileSync(new URL("../src/community/PublicSetupGalleryToolbar.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/community/publicSetupGalleryToolbar.css", import.meta.url), "utf8");
const api = readFileSync(new URL("../server/community/publicProfiles.ts", import.meta.url), "utf8");

function snapshot(symbol: string, exchange: "binance" | "bybit", timeframe: "1m" | "15m",
  types: Array<"entry"|"stop_loss"|"target">): ChartDocument {
  const t = Math.floor(Date.now() / 60000) * 60 - 120;
  return captureChartDocument({
    symbol, exchange, timeframe, marketType: "futures",
    candles: [{ time: t, open: 100, high: 110, low: 90, close: 101, volume: 100 }],
    markers: types.map((type, i) => ({
      id: type + i, type, price: 100 + i, label: type, color: "#38bdf8",
    })),
    drawings: [],
  });
}

const posts = [
  { id: "a", chart: snapshot("BTCUSDT", "binance", "1m", ["entry","stop_loss","target"]) },
  { id: "b", chart: snapshot("ETHUSDT", "bybit", "15m", ["entry"]) },
  { id: "c", chart: snapshot("BTCUSDC", "bybit", "15m", []) },
  { id: "private-should-not-be-in-gallery", chart: null },
];

test("search is case insensitive and combines exchange timeframe and real saved marker filters", () => {
  assert.deepEqual(filterPublicSetupGallery(posts, DEFAULT_PUBLIC_SETUP_FILTERS).map(p => p.id), ["a","b","c"]);
  assert.deepEqual(filterPublicSetupGallery(posts, { ...DEFAULT_PUBLIC_SETUP_FILTERS, symbol:" btc " }).map(p => p.id), ["a","c"]);
  assert.deepEqual(filterPublicSetupGallery(posts, { ...DEFAULT_PUBLIC_SETUP_FILTERS, symbol:"ETH" }).map(p => p.id), ["b"]);
  assert.deepEqual(filterPublicSetupGallery(posts, { ...DEFAULT_PUBLIC_SETUP_FILTERS, exchange:"bybit" }).map(p => p.id), ["b","c"]);
  assert.deepEqual(filterPublicSetupGallery(posts, { ...DEFAULT_PUBLIC_SETUP_FILTERS, timeframe:"1m" }).map(p => p.id), ["a"]);
  assert.deepEqual(filterPublicSetupGallery(posts, { ...DEFAULT_PUBLIC_SETUP_FILTERS, levels:"marked" }).map(p => p.id), ["a","b"]);
  assert.deepEqual(filterPublicSetupGallery(posts, { ...DEFAULT_PUBLIC_SETUP_FILTERS, levels:"complete" }).map(p => p.id), ["a"]);
  assert.deepEqual(filterPublicSetupGallery(posts, {
    ...DEFAULT_PUBLIC_SETUP_FILTERS, symbol:"btc", exchange:"bybit", levels:"complete",
  }), []);
  assert.deepEqual(posts.map(p => p.id), ["a","b","c","private-should-not-be-in-gallery"]);
});

test("complete Entry, SL and TP refers to finite authored marker levels, not pattern quality", () => {
  assert.equal(hasPublicSetupEntryStopTarget(posts[0].chart!), true);
  assert.equal(hasPublicSetupEntryStopTarget(posts[1].chart!), false);
  assert.equal(hasPublicSetupEntryStopTarget(posts[2].chart!), false);
  assert.equal(hasPublicSetupEntryStopTarget({
    ...posts[0].chart!, markers: posts[0].chart!.markers.map(marker =>
      marker.type === "target" ? { ...marker, price: 0 } : marker),
  }), false);
  assert.equal(hasPublicSetupEntryStopTarget({
    ...posts[0].chart!, markers: posts[0].chart!.markers.map(marker =>
      marker.type === "stop_loss" ? { ...marker, price: Number.POSITIVE_INFINITY } : marker),
  }), false);
});

test("toolbar communicates loaded-only search honestly with accessible selectors, safe empty and reset state", () => {
  const html = renderToStaticMarkup(React.createElement(PublicSetupGalleryToolbar, {
    filters: { ...DEFAULT_PUBLIC_SETUP_FILTERS, symbol:"BTC", levels:"complete" },
    totalLoaded: 7, matches: 2, hasNextPage: true, onChange() {},
  }));
  assert.match(html, /Фільтри галереї/);
  assert.match(html, /2 із 7 завантажених графіків/);
  assert.match(html, /BTC/);
  assert.match(html, /Пошук серед уже завантажених публічних графіків/);
  assert.match(html, /завантажити наступні сторінки/);
  assert.match(html, /не є перевіркою якості/);
  assert.match(html, /Очистити фільтри/);
  assert.match(html, /Є Entry \+ SL \+ TP/);
  assert.match(html, /Binance/);
  assert.match(html, /Bybit/);
  const initial = renderToStaticMarkup(React.createElement(PublicSetupGalleryToolbar, {
    filters: DEFAULT_PUBLIC_SETUP_FILTERS, totalLoaded: 0, matches: 0, hasNextPage: false, onChange() {},
  }));
  assert.doesNotMatch(initial, /Очистити фільтри/);
});

test("gallery filters are client-only and preserve original server-authorized pagination and chart links", () => {
  assert.match(view, /import \{ PublicSetupGalleryToolbar \} from "\.\/PublicSetupGalleryToolbar"/);
  assert.match(view, /const filteredGallerySetups = filterPublicSetupGallery\(wall, setupFilters\)/);
  assert.match(view, /tab === "setups" \? filteredGallerySetups/);
  assert.match(view, /matches=\{filteredGallerySetups\.length\}/);
  assert.match(view, /hasNextPage=\{!!loadedNext\}/);
  assert.match(view, /tab === "setups" \? filteredGallerySetups : allGallerySetups/);
  assert.match(view, /setSetupFilters\(\{ \.\.\.DEFAULT_PUBLIC_SETUP_FILTERS \}\)/);
  assert.match(view, /publicChartPostUrl\(profile\.url, item\.id\)/);
  assert.match(view, /tab === "setups" \? "Ще розбори HookChart"/);
  assert.match(api, /await rules\.canReadChart\(row\.chart_id\)/);
  assert.match(api, /await rules\.visible\(row\)/);
  assert.doesNotMatch(toolbar, /fetch\(|WebSocket\(|setInterval\(|navigator\.sendBeacon|API_TOKEN/);
  assert.doesNotMatch(view, /MOCK_SETUPS|FAKE_QUALITY_SCORE/);
});

test("filter design is scoped to public pages and supports iPhone input without focus zoom", () => {
  assert.match(css, /\.public-profile \.public-setup-gallery-toolbar/);
  assert.match(css, /grid-column: 1 \/ -1/);
  assert.match(css, /@media \(max-width: 1190px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /min-height: 44px; font-size: 16px/);
  assert.doesNotMatch(css, /^\s*(?:html|body|:root|\.community-workspace)\s*\{/m);
});
