import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { PublicProfileTradeWindows } from "../src/community/PublicProfileTradeWindows";
import { publicClosedOrderOverview } from "../src/community/publicProfileSocialModel";

const page = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
const component = readFileSync(new URL("../src/community/PublicProfileTradeWindows.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/community/publicProfileTradeWindows.css", import.meta.url), "utf8");
const api = readFileSync(new URL("../server/community/publicProfiles.ts", import.meta.url), "utf8");

const rows = [
  { currency: "USDT", count: 3, wins: 1, losses: 1, flat: 1, winRate: 50, pnl: "80.000000000000000000" },
  { currency: "USDC", count: 2, wins: 1, losses: 1, flat: 0, winRate: 50 },
];
const windows = [
  { days: 7 as const, totals: [{ currency: "USDT", count: 2, wins: 1, losses: 1, flat: 0, winRate: 50 }] },
  { days: 30 as const, totals: rows },
];

test("7/30-day public results display real counts and never sum amounts across currencies", () => {
  const html = renderToStaticMarkup(React.createElement(PublicProfileTradeWindows, { windows }));
  assert.match(html, /Результати за період/);
  assert.match(html, /aria-pressed="true">30 днів/);
  assert.match(html, /aria-pressed="false">7 днів/);
  assert.match(html, /за останні 30 днів/);
  assert.match(html, /Закриттів/);
  assert.match(html, /USDT/);
  assert.match(html, /USDC/);
  assert.match(html, /80\.000000000000000000/);
  assert.match(html, /Сумарний PnL: 80/);
  assert.doesNotMatch(html, /USDC.*Сумарний PnL:.*USDC/s);
  assert.match(html, /Із 5 закриттів: прибуткових 2, збиткових 2, беззбиткових 1/);
  assert.match(html, /не дохідність рахунку/);
  assert.equal(publicClosedOrderOverview(rows).pnl, null);
  assert.equal(publicClosedOrderOverview(rows).winRate, 50);
});

test("empty recent trade periods render an honest empty state, not fake returns", () => {
  const html = renderToStaticMarkup(React.createElement(PublicProfileTradeWindows, {
    windows: [{ days: 7, totals: [] }, { days: 30, totals: [] }],
  }));
  assert.match(html, /імпортованих закриттів немає/);
  assert.doesNotMatch(html, /public-profile-trade-window-distribution/);
  assert.doesNotMatch(html, /Сумарний PnL/);
});

test("only opt-in aggregated statistics and amounts are passed to the client, no exchange polling", () => {
  assert.match(page, /type PublicTradeWindow/);
  assert.match(page, /profile\.statistics\.windows\?\.length \? <PublicProfileTradeWindows windows=\{profile\.statistics\.windows\}/);
  assert.match(page, /tab === "statistics" && profile\.statistics/);
  assert.match(api, /if \(c\.statisticsAudience === "public"\)/);
  assert.match(api, /c\.amountsAudience === "public" && row\["pnl" \+ days\] !== null/);
  assert.match(api, /closed_at >= now\(\) - interval '7 days'/);
  assert.match(api, /closed_at >= now\(\) - interval '30 days'/);
  assert.match(api, /\{ days: 7, totals: recentTotals\(7\) \}/);
  assert.match(api, /\{ days: 30, totals: recentTotals\(30\) \}/);
  assert.doesNotMatch(component, /fetch\(|new WebSocket\(|setInterval\(|liveTicker|MOCK_TRADES/);
  assert.doesNotMatch(component + api, /pnl30dPercent|profitFactor|avgRR/);
});

test("result period uses a native accessible selector and responsive static distribution", () => {
  assert.match(component, /useState<7 \| 30>\(30\)/);
  assert.match(component, /onClick=\{\(\) => setDays\(period\)\}/);
  assert.match(component, /role="group" aria-label="Період закриття ордерів"/);
  assert.match(component, /role="img"/);
  assert.match(css, /\.public-profile \.public-profile-trade-window-distribution/);
  assert.match(css, /@media \(max-width: 1160px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.doesNotMatch(css, /^\s*(?:html|body|:root)\s*\{/m);
});
