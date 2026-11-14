import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { captureChartDocument, type ChartDocument } from "../src/community/chartDocument";
import {
  publicSnapshotLevels, formatPublicSnapshotPrice,
} from "../src/community/publicProfileLevelsModel";
import { PublicProfileChartLevels } from "../src/community/PublicProfileChartLevels";

const wall = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
const article = readFileSync(new URL("../src/community/PublicProfileArticles.tsx", import.meta.url), "utf8");
const component = readFileSync(new URL("../src/community/PublicProfileChartLevels.tsx", import.meta.url), "utf8");
const style = readFileSync(new URL("../src/community/publicProfileLevels.css", import.meta.url), "utf8");
const api = readFileSync(new URL("../server/community/publicProfiles.ts", import.meta.url), "utf8");

function snapshot(): ChartDocument {
  const time = Math.floor(Date.now() / 60000) * 60 - 120;
  return captureChartDocument({
    symbol: "BTCUSDT", exchange: "bybit", marketType: "futures", timeframe: "1m",
    candles: [{ time, open: 100, high: 104, low: 96, close: 101, volume: 5 }],
    markers: [
      { id: "entry-1", type: "entry", label: "Some entry", price: 101, color: "#38bdf8" },
      { id: "stop-1", type: "stop_loss", label: "Stop", price: 95, color: "#ff0000" },
      { id: "target-1", type: "target", label: "Target", price: 104, color: "#00ff00" },
      { id: "target-2", type: "target", label: "Target", price: 108.2, color: "#00ff00" },
      { id: "target-3", type: "target", label: "Target", price: 112, color: "#00ff00" },
      { id: "target-4", type: "target", label: "Target", price: 116, color: "#00ff00" },
      { id: "neckline-1", type: "neckline", label: "Neckline", price: 99, color: "#aaaaaa" },
      { id: "resistance", type: "resistance", label: "Not a trade level", price: 110, color: "#aaaaaa" },
      { id: "custom", type: "custom", label: "Not a trade level", price: 123, color: "#aaaaaa" },
    ],
    drawings: [],
  });
}

test("levels are sourced only from real normalized markers, grouped and bounded for cards", () => {
  const doc = snapshot();
  const actual = publicSnapshotLevels(doc);
  assert.deepEqual(actual.levels.map(row => [row.kind, row.label, row.price]), [
    ["entry", "Entry", 101], ["stop_loss", "SL", 95],
    ["target", "TP1", 104], ["target", "TP2", 108.2], ["target", "TP3", 112],
    ["neckline", "Neckline", 99],
  ]);
  assert.equal(actual.extra, 1);
  assert.equal(actual.levels.some(row => row.price === 110 || row.price === 123), false);
  const html = renderToStaticMarkup(React.createElement(PublicProfileChartLevels, { document: doc }));
  assert.match(html, /Рівні на збереженому графіку/);
  assert.match(html, /Авторська розмітка/);
  for (const label of ["Entry", "SL", "TP1", "TP2", "TP3", "Neckline"])
    assert.ok(html.includes(label), label);
  assert.match(html, /108\.2/);
  assert.match(html, /Ще 1 рівень/);
  assert.match(html, /не є перевіреним торговим сигналом/);
  assert.doesNotMatch(html, /Profit Factor|qualityScore|score:|PnL|win rate/i);
});

test("no level markers means no level card; prices cannot be silently rounded to zero", () => {
  const doc = snapshot();
  assert.equal(renderToStaticMarkup(React.createElement(PublicProfileChartLevels, {
    document: { ...doc, markers: [] },
  })), "");
  assert.deepEqual(publicSnapshotLevels({ markers: [
    { id: "custom", type: "custom", label: "", color: "#aaaaaa", price: 1 },
    { id: "bad", type: "entry", label: "", color: "#aaaaaa", price: Number.POSITIVE_INFINITY },
    { id: "zero", type: "target", label: "", color: "#aaaaaa", price: 0 },
  ] }), { levels: [], extra: 0 });
  assert.equal(formatPublicSnapshotPrice(0.000000000001), "0.000000000001");
  assert.equal(formatPublicSnapshotPrice(0.00001234), "0.00001234");
  assert.equal(formatPublicSnapshotPrice(101.25), "101.25");
  assert.equal(formatPublicSnapshotPrice(NaN), "—");
});

test("wall, gallery and educational articles share snapshot levels without a chart-engine mount", () => {
  assert.match(wall, /import \{ PublicProfileChartLevels \} from "\.\/PublicProfileChartLevels"/);
  assert.match(article, /import \{ PublicProfileChartLevels \} from "\.\/PublicProfileChartLevels"/);
  assert.match(wall, /<PublicProfileChartLevels document=\{item\.chart\} \/>/);
  assert.match(article, /<PublicProfileChartLevels document=\{selected\.chart\} \/>/);
  assert.match(wall, /<ChartPreview document=\{item\.chart\} onOpen=\{\(\) => void openChart\(item\.id\)\} \/>/);
  assert.match(wall, /publicChartPostUrl\(profile\.url, item\.id\)/);
  assert.match(wall, /import "\.\/publicProfileLevels\.css"/);
  assert.match(api, /await rules\.canReadChart\(row\.chart_id\)/);
  assert.match(api, /await rules\.visible\(row\)/);
  assert.doesNotMatch(component, /fetch\(|new WebSocket\(|setInterval\(|Math\.random\(|getLiveSignal/);
});

test("snapshot level cards are scoped to public profiles and mobile-friendly", () => {
  assert.match(style, /\.public-profile \.public-profile-chart-levels/);
  assert.match(style, /\.public-profile \.public-profile-chart-level-entry/);
  assert.match(style, /\.public-profile \.public-profile-chart-level-stop_loss/);
  assert.match(style, /\.public-profile \.public-profile-chart-level-target/);
  assert.match(style, /@media \(max-width: 640px\)/);
  assert.match(style, /@media \(max-width: 360px\)/);
  assert.doesNotMatch(style, /^\s*(?:body|html|:root|\.community-workspace)\s*\{/m);
});
