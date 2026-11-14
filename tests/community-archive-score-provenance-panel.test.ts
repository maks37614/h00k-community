import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ArchiveScoreProvenance } from "../src/components/community/ArchiveScoreProvenance";
import {
  assessArchiveProofDraft, type ArchiveProofDraftAssessment,
} from "../src/community/archiveScoreBinding";
import type { ArchiveScorePayload, SignedArchiveScoreProof } from "../src/community/archiveScoreProof";
import { captureChartDocument } from "../src/community/chartDocument";

const editor = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/components/community/social-quality-proof.css", import.meta.url), "utf8");
const server = readFileSync(new URL("../server/community/content.ts", import.meta.url), "utf8");
const now = Math.floor(Date.now() / 60000) * 60000;
const payload: ArchiveScorePayload = {
  version: 1, issuer: "h00k.top", purpose: "archive-score-record",
  rubric: "regular-flow-72-13-15-v1", archiveId: "archive_src_1",
  symbol: "BTCUSDT", exchange: "bybit", marketType: "futures", timeframe: "1m",
  score: 83, entry: 100, stop: 95, target: 110,
  assessedAt: now - 120_000, issuedAt: now, expiresAt: now + 600_000,
};
const proof: SignedArchiveScoreProof = { payload, signature: "A".repeat(86) };
const text = JSON.stringify(proof);
function chart() {
  const t = Math.floor(Date.now() / 60000) * 60 - 180;
  return captureChartDocument({
    symbol: "BTCUSDT", exchange: "bybit", marketType: "futures", timeframe: "1m",
    candles: [{ time: t, open: 100, high: 115, low: 90, close: 101, volume: 10 }],
    markers: [
      { id: "entry", type: "entry", label: "Entry", price: 100, color: "#38bdf8" },
      { id: "stop", type: "stop_loss", label: "SL", price: 95, color: "#ef4444" },
      { id: "target", type: "target", label: "TP", price: 110, color: "#10b981" },
    ], drawings: [],
  });
}
function render(assessment: ArchiveProofDraftAssessment, proofText = text) {
  return renderToStaticMarkup(React.createElement(ArchiveScoreProvenance, {
    proofText, assessment, onRemove() {},
  }));
}

test("panel shows record provenance, score, rubric and archived detection/signing/expiry timestamps", () => {
  const result = assessArchiveProofDraft(text, chart(), now + 1000);
  assert.equal(result.status, "ready");
  const html = render(result);
  assert.match(html, /Походження архівної оцінки/);
  assert.match(html, /83\/100/);
  assert.match(html, /Заявлене джерело/);
  assert.match(html, /h00k\.top · власний архів формацій/);
  assert.match(html, /Стандартна 72\/13\/15 · v1/);
  assert.match(html, /Час виявлення в архіві/);
  assert.match(html, /Час підписання запису/);
  assert.match(html, /Використати до/);
  assert.match(html, /dateTime=|datetime=/);
  assert.match(html, /BTCUSDT · BYBIT · futures · 1m/);
  assert.match(html, /Параметри збігаються · підпис ще не перевірено/);
  assert.match(html, /Лише сервер перевіряє цифровий підпис Ed25519/);
  assert.doesNotMatch(html, /верифікований трейдер|підтверджений торговий сигнал|гарантований прибуток/i);
  assert.doesNotMatch(html, /Вилучити архівну оцінку й залишити графік/);
  assert.doesNotMatch(html, /archive_src_1/);
  // A syntactically valid fake signature must NOT cause "verified" UI.
  assert.match(html, /підпис ще не перевірено/);
});

test("edited Entry/SL/TP shows mismatch and preserves the remove-score recovery action", () => {
  const edited = chart();
  edited.markers = edited.markers.map(m =>
    m.type === "stop_loss" ? { ...m, price: 94 } : m,
  );
  const assessment = assessArchiveProofDraft(text, edited, now);
  assert.equal(assessment.status, "mismatch");
  const html = render(assessment);
  assert.match(html, /Рівні або ринок змінено/);
  assert.match(html, /Stop Loss/);
  assert.match(html, /Вилучити архівну оцінку й залишити графік/);
  assert.match(html, /role="alert"/);
  assert.match(html, /Час виявлення в архіві/);
  assert.match(html, /83\/100/);
});

test("expired proof still shows historical metadata but blocks sharing", () => {
  const assessment = assessArchiveProofDraft(text, chart(), now + 600_001);
  assert.equal(assessment.status, "expired");
  const html = render(assessment);
  assert.match(html, /Строк дії закінчився/);
  assert.match(html, /Використати до/);
  assert.match(html, /Вилучити архівну оцінку й залишити графік/);
  assert.match(html, /Експортуйте новий доказ/);
});

test("invalid/malformed proof never renders attacker-supplied metadata or claims verification", () => {
  const poisoned = JSON.stringify({ ...proof, payload: { ...proof.payload, score: 100, verified: true } });
  const result = assessArchiveProofDraft(poisoned, chart(), now);
  assert.equal(result.status, "invalid");
  const html = render(result, poisoned);
  assert.match(html, /Неправильний запис/);
  assert.match(html, /Вставте повний JSON/);
  assert.doesNotMatch(html, /100\/100|Час виявлення в архіві|verified/);
  assert.match(html, /Вилучити архівну оцінку й залишити графік/);
  assert.equal(render({ status: "none", message: "" }, ""), "");
});

test("editor exposes provenance without network, and keeps the server as the only signature authority", () => {
  const start = editor.indexOf("function ChartDialog({");
  const end = editor.indexOf("function Workspace({", start);
  assert.ok(start >= 0 && end > start);
  const dialog = editor.slice(start, end);
  assert.match(dialog, /<ArchiveScoreProvenance/);
  assert.match(dialog, /proofText=\{qualityProofText\}/);
  assert.match(dialog, /assessment=\{scoreAssessment\}/);
  assert.match(dialog, /onRemove=\{removeProof\}/);
  assert.match(dialog, /disabled=\{busy \|\| scoreBlocked/);
  assert.match(server, /verifyArchiveScoreProof\(document\.qualityProof, document, process\.env\.H00K_QUALITY_VERIFY_KEY_B64\)/);
  const component = readFileSync(new URL("../src/components/community/ArchiveScoreProvenance.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(component, /fetch\(|new WebSocket\(|setInterval\(|createPublicKey|verify\(null|post\(/);
  assert.match(component, /role=\{blocked \? "alert" : "status"\}/);
  assert.match(css, /\.community-workspace \.community-chart-provenance/);
  assert.match(css, /@media \(max-width: 640px\)/);
});
