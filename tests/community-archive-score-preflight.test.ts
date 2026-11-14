import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { captureChartDocument } from "../src/community/chartDocument";
import type { ArchiveScorePayload, SignedArchiveScoreProof } from "../src/community/archiveScoreProof";
import {
  archiveScoreBindingIssues, archivedPriceMatches, assessArchiveProofDraft,
} from "../src/community/archiveScoreBinding";

const page = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
const server = readFileSync(new URL("../server/community/qualityProof.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/components/community/social-quality-proof.css", import.meta.url), "utf8");
const now = Math.floor(Date.now() / 60000) * 60000;

const payload = (): ArchiveScorePayload => ({
  version: 1, issuer: "h00k.top", purpose: "archive-score-record",
  rubric: "regular-flow-72-13-15-v1", archiveId: "arch_example_123",
  symbol: "BTCUSDT", exchange: "bybit", marketType: "futures", timeframe: "1m",
  score: 83, entry: 100, stop: 95, target: 110,
  assessedAt: now - 60_000, issuedAt: now, expiresAt: now + 600_000,
});
function proof(p = payload()): SignedArchiveScoreProof {
  return { payload: p, signature: "A".repeat(86) };
}
function chart() {
  const t = Math.floor(Date.now() / 60000) * 60 - 120;
  return captureChartDocument({
    symbol: "BTCUSDT", exchange: "bybit", marketType: "futures", timeframe: "1m",
    candles: [{ time: t, open: 100, high: 111, low: 93, close: 102, volume: 50 }],
    markers: [
      { id: "e", type: "entry", label: "Entry", price: 100, color: "#38bdf8" },
      { id: "s", type: "stop_loss", label: "SL", price: 95, color: "#f43f5e" },
      { id: "t", type: "target", label: "TP", price: 110, color: "#10b981" },
    ], drawings: [],
  });
}

test("matches unchanged signed archive levels without pretending to verify the signature", () => {
  const doc = chart(), signed = proof();
  assert.deepEqual(archiveScoreBindingIssues(signed.payload, doc), []);
  const assessment = assessArchiveProofDraft(JSON.stringify(signed), doc, now + 5000);
  assert.equal(assessment.status, "ready");
  assert.equal(assessment.status === "ready" && assessment.proof.signature, signed.signature);
  assert.match(assessment.message, /Цифровий підпис перевірить сервер/);
  assert.match(assessment.message, /не підтвердження торгового сигналу/);
});

test("precise mismatch names all changed or removed Entry SL TP and market parameters", () => {
  const doc = chart(), signed = proof();
  const changed = {
    ...doc, symbol: "ETHUSDT", exchange: "binance" as const,
    marketType: "spot" as const, timeframe: "5m" as const,
    markers: doc.markers.filter(m => m.type !== "entry").map(m =>
      m.type === "stop_loss" ? { ...m, price: 94 } :
      m.type === "target" ? { ...m, price: 111 } : m),
  };
  assert.deepEqual(archiveScoreBindingIssues(signed.payload, changed), [
    "монета", "біржа", "тип ринку", "таймфрейм", "Entry", "Stop Loss", "Take Profit",
  ]);
  const result = assessArchiveProofDraft(JSON.stringify(signed), changed, now);
  assert.equal(result.status, "mismatch");
  assert.match(result.message, /Entry, Stop Loss, Take Profit/);
  assert.match(result.message, /вилучіть оцінку/);
  assert.equal(assessArchiveProofDraft(JSON.stringify(signed), {
    ...doc, markers: doc.markers.filter(m => m.type !== "target"),
  }, now).status, "mismatch");
});

test("uses exact server tolerance for very small markets and rejects changed real levels", () => {
  assert.equal(archivedPriceMatches(0.00000035, 0.00000035), true);
  assert.equal(archivedPriceMatches(100 + 1e-9, 100), true);
  assert.equal(archivedPriceMatches(100.01, 100), false);
  assert.equal(archivedPriceMatches(0, 100), false);
  assert.equal(archivedPriceMatches(Number.NaN, 100), false);
});

test("rejects expired proof and malformed JSON before client POST without changing the graph", () => {
  const doc = chart(), before = JSON.stringify(doc);
  assert.equal(assessArchiveProofDraft("", doc, now).status, "none");
  assert.equal(assessArchiveProofDraft("wrong JSON", doc, now).status, "invalid");
  assert.equal(assessArchiveProofDraft(JSON.stringify({ ...proof(), signature: "bad" }), doc, now).status, "invalid");
  assert.equal(assessArchiveProofDraft(JSON.stringify(proof()), doc, now + 600_001).status, "expired");
  assert.equal(assessArchiveProofDraft(JSON.stringify(proof({
    ...payload(), issuedAt: now + 90_000, expiresAt: now + 690_000,
  })), doc, now).status, "expired");
  assert.equal(JSON.stringify(doc), before);
});

test("editor preflights both publication and local favorites, supports removing stale score", () => {
  const start = page.indexOf("function ChartDialog({");
  const end = page.indexOf("function Workspace({", start);
  assert.ok(start >= 0 && end > start);
  const editor = page.slice(start, end);
  assert.match(editor, /assessArchiveProofDraft\(qualityProofText, draft\.document\)/);
  assert.match(editor, /function currentProof\(\)/);
  assert.match(editor, /const qualityProof = currentProof\(\)/g);
  assert.match(editor, /scoreAssessment\.status !== "none"/);
  assert.match(editor, /<ArchiveScoreProvenance/);
  assert.match(editor, /proofText=\{qualityProofText\}/);
  assert.match(editor, /assessment=\{scoreAssessment\}/);
  assert.match(editor, /onRemove=\{removeProof\}/);
  assert.match(editor, /setQualityProofText\(""\)/);
  assert.match(editor, /disabled=\{busy \|\| scoreBlocked \|\|/);
  assert.match(editor, /disabled=\{busy \|\| scoreBlocked\}/);
  assert.match(editor, /const \{ qualityProof: _oldProof, \.\.\.chartWithoutProof \} = draft\.document/);
  assert.match(editor, /const \{ qualityProof: _oldProof, \.\.\.cleanDocument \} = draft\.document/);
  assert.match(server, /archiveScoreBindingIssues\(p, document\)\.length/);
  assert.match(css, /\.community-workspace \.community-chart-provenance/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.doesNotMatch(editor, /createPublicKey|verify\(null|QUALITY_VERIFY_KEY_B64/);
});
