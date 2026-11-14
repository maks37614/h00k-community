import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicProfileChartContext } from "../src/community/PublicProfileChartContext";
import type { ChartDocument } from "../src/community/chartDocument";
import { publicClosedOrderOverview } from "../src/community/publicProfileSocialModel";

const view = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
const article = readFileSync(new URL("../src/community/PublicProfileArticles.tsx", import.meta.url), "utf8");
const context = readFileSync(new URL("../src/community/PublicProfileChartContext.tsx", import.meta.url), "utf8");
const style = readFileSync(new URL("../src/community/publicProfileCards.css", import.meta.url), "utf8");
const api = readFileSync(new URL("../server/community/publicProfiles.ts", import.meta.url), "utf8");

test("real snapshot context renders authorized exchange, market, timeframe, symbol and capture time", () => {
  const capturedAt = Date.UTC(2026, 10, 11, 12, 30);
  const document = {
    version: 1,
    symbol: "BTCUSDT",
    exchange: "bybit",
    marketType: "futures",
    timeframe: "15m",
    capturedAt,
    cutoff: Math.floor(capturedAt / 1000),
    series: {},
    markers: [],
    drawings: [],
  } as ChartDocument;
  const html = renderToStaticMarkup(React.createElement(PublicProfileChartContext, { document }));
  assert.match(html, /BTCUSDT/);
  assert.match(html, /15m/);
  assert.match(html, /Bybit/);
  assert.match(html, /Futures/);
  assert.match(html, /2026/);
  assert.match(html, /2026-11-11T12:30:00\.000Z/);
  assert.match(html, /Без live-даних/);
  const spot = renderToStaticMarkup(React.createElement(PublicProfileChartContext, {
    document: { ...document, exchange: "binance", marketType: "spot", timeframe: "1h" },
  }));
  assert.match(spot, /Binance/);
  assert.match(spot, /Spot/);
  assert.match(spot, /1h/);
  assert.doesNotMatch(context, /fetch\(|WebSocket|subscribe\(|setInterval\(/);
});

test("wall and article cards share their visual snapshot context without mounting a new HookChart or exchange feed", () => {
  assert.match(view, /import \{ PublicProfileChartContext \} from "\.\/PublicProfileChartContext"/);
  assert.match(article, /import \{ PublicProfileChartContext \} from "\.\/PublicProfileChartContext"/);
  assert.match(view, /<PublicProfileChartContext document=\{item\.chart\}/);
  assert.match(article, /<PublicProfileChartContext document=\{selected\.chart\}/);
  assert.match(view, /<ChartPreview document=\{item\.chart\} onOpen=\{\(\) => void openChart\(item\.id\)\} \/>/);
  assert.match(article, /<ChartPreview document=\{selected\.chart\} onOpen=\{\(\) => onOpenChart\(selected\.id\)\} \/>/);
  assert.match(view, /className="public-profile-chart-card"/);
  assert.match(view, /tab === "setups" \? " public-profile-setup-gallery"/);
  assert.match(view, /import "\.\/publicProfileCards\.css"/);
  assert.match(view, /publicChartPostUrl\(profile\.url, item\.id\)/);
  assert.match(api, /await rules\.canReadChart\(row\.chart_id\)/);
  assert.match(api, /await rules\.visible\(row\)/);
  assert.doesNotMatch(context, /INITIAL_CHARTS|MOCK_CHART|liveTicker|externalExchange|Math\.random/);
});

test("real win rate uses only permitted closed-order totals, not fabricated marketing numbers", () => {
  assert.equal(publicClosedOrderOverview([]).winRate, null);
  assert.equal(publicClosedOrderOverview([
    { currency: "USDT", count: 10, wins: 7, losses: 2, flat: 1, winRate: 77.8 },
  ]).winRate, 700 / 9);
  assert.match(view, /overview\.winRate !== null && <div className="public-profile-winrate-band"/);
  assert.match(view, /<meter min=\{0\} max=\{100\} value=\{overview\.winRate\}/);
  assert.match(view, /profile\.statistics \? \(/);
  assert.match(view, /profile\.awards \? \(/);
  assert.match(api, /c\.statisticsAudience === "public"/);
  assert.match(style, /\.public-profile \.public-profile-winrate-band meter/);
});

test("social card styles are isolated to the anonymous page and respect narrow displays", () => {
  assert.match(style, /\.public-profile \.public-profile-post \{/);
  assert.match(style, /\.public-profile \.public-profile-chart-card \{/);
  assert.match(style, /\.public-profile \.public-profile-chart-context \{/);
  assert.match(style, /\.public-profile \.public-profile-insights \.public-profile-achievement-card/);
  assert.match(style, /@media \(min-width: 1440px\)/);
  assert.match(style, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(style, /@media \(max-width: 640px\)/);
  assert.match(style, /@media \(max-width: 390px\)/);
  assert.doesNotMatch(style, /^\s*(?:body|html|:root|\.community-workspace)\s*\{/m);
});
