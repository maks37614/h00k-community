import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChartPreview } from "../src/components/community/ChartPreview";
import { captureChartDocument, type ChartDocument } from "../src/community/chartDocument";
import type { ArchiveScorePayload, SignedArchiveScoreProof } from "../src/community/archiveScoreProof";

const page = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
const publicPage = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
const server = readFileSync(new URL("../server/community/content.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/components/community/community.css", import.meta.url), "utf8");

function chart(withProof = false): ChartDocument {
  const t = Math.floor(Date.now() / 60000) * 60 - 120;
  const assessedAt = t * 1000;
  const payload: ArchiveScorePayload = {
    version: 1, issuer: "h00k.top", purpose: "archive-score-record",
    rubric: "regular-flow-72-13-15-v1", archiveId: "arch_btc_001",
    symbol: "BTCUSDT", exchange: "binance", marketType: "futures", timeframe: "1m",
    score: 84, entry: 102, stop: 98, target: 110,
    assessedAt, issuedAt: assessedAt + 1000, expiresAt: assessedAt + 601000,
  };
  const proof: SignedArchiveScoreProof = { payload, signature: "A".repeat(86) };
  return captureChartDocument({
    symbol: "BTCUSDT", exchange: "binance", marketType: "futures", timeframe: "1m",
    candles: [{ time: t, open: 100, high: 110, low: 97, close: 103, volume: 55 }],
    markers: [{ id:"e", type:"entry", label:"Entry", price:102, color:"#38bdf8" }],
    drawings: [], ...(withProof ? { qualityProof: proof } : {}),
  });
}
const markup = (document: ChartDocument, authorizedServerSnapshot?: boolean) =>
  renderToStaticMarkup(React.createElement(ChartPreview, {
    document, authorizedServerSnapshot, onOpen() {},
  }));

test("a server-authorized signed chart shows archived source, score, time and proper limitations", () => {
  const html = markup(chart(true), true);
  assert.match(html, /Оцінка з архіву h00k: 84\/100/);
  assert.match(html, /підпис перевірено під час збереження/i);
  assert.match(html, /рубрика 72\/13\/15 \(v1\)/);
  assert.match(html, /аналіз/);
  assert.match(html, /Не є незалежною перевіркою сигналу чи виконання угоди/);
  assert.match(html, /aria-label="Відкрити HookChart BTCUSDT[^"]*84 зі 100/);
  assert.match(html, /<svg/);
});

test("a server-authorized authored chart never fabricates an archive score", () => {
  const html = markup(chart(false), true);
  assert.match(html, /Авторська розмітка · архівна оцінка відсутня/);
  assert.match(html, /не поточний торговий сигнал/);
  assert.doesNotMatch(html, /84\/100|100\/100|підпис перевірено|Наявний рейтинг/);
  assert.match(html, /aria-label="Відкрити HookChart BTCUSDT · без архівної оцінки"/);
});

test("a raw unsigned client draft cannot acquire a trust label merely by having qualityProof", () => {
  const html = markup(chart(true));
  assert.doesNotMatch(html, /Оцінка з архіву h00k|підпис перевірено|72\/13\/15|community-chart-preview-origin/);
  assert.match(html, /aria-label="Відкрити HookChart BTCUSDT"/);
});

test("server-saved post and comment cards opt in; public profile already displays provenance separately", () => {
  assert.equal((page.match(/authorizedServerSnapshot/g) ?? []).length, 2);
  assert.match(page, /document=\{item\.chart\}\s+authorizedServerSnapshot/);
  assert.match(page, /document=\{comment\.chart\}\s+authorizedServerSnapshot/);
  assert.match(server, /verifyArchiveScoreProof\(document\.qualityProof, document, process\.env\.H00K_QUALITY_VERIFY_KEY_B64\)/);
  assert.match(publicPage, /<PublicProfileChartContext document=\{item\.chart\}/);
  assert.match(publicPage, /<ChartPreview document=\{item\.chart\} onOpen=/);
  assert.doesNotMatch(publicPage, /authorizedServerSnapshot/);
});

test("adding provenance does not fetch market feeds or mount HookChart for the feed", () => {
  const previousFetch = globalThis.fetch, previousWS = globalThis.WebSocket;
  let count = 0;
  globalThis.fetch = async () => { count++; throw new Error("No network in feed card"); };
  globalThis.WebSocket = class { constructor() { count++; throw new Error("No WS in feed card"); } } as any;
  try {
    const html = markup(chart(true), true);
    assert.match(html, /community-chart-preview-origin/);
    assert.equal(count, 0);
    assert.doesNotMatch(html, /data-network-mode="live"|hookchart-settings/);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.WebSocket = previousWS;
  }
  assert.match(css, /\.community-workspace \.community-chart-preview \.community-chart-preview-origin/);
  assert.match(css, /@media \(max-width: 640px\)/);
});
