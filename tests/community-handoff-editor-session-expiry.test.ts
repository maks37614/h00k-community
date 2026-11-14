import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { captureChartDocument } from "../src/community/chartDocument";
import { assessArchiveProofDraft } from "../src/community/archiveScoreBinding";
import type { SignedArchiveScoreProof } from "../src/community/archiveScoreProof";

const file = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
const editorStart = file.indexOf("function ChartDialog({");
const editorEnd = file.indexOf("function Workspace({", editorStart);
const editor = file.slice(editorStart, editorEnd);

test("every editor opening uses a fresh identity, independent of candle time and chart ID", () => {
  assert.match(file, /type DraftChart = \{[\s\S]*?editorSessionId: string;/);
  const openings = file.match(/setDraft\(\{/g) ?? [];
  const newSessions = file.match(/setDraft\(\{\s*editorSessionId: crypto\.randomUUID\(\),/g) ?? [];
  assert.equal(openings.length, 6, "source chart, saved archive and handoff open paths");
  assert.equal(newSessions.length, openings.length, "each new draft must get a fresh identity");
  assert.match(file, /key=\{draft\.editorSessionId\}/);
  assert.doesNotMatch(file, /key=\{draft\.parentId \?\? draft\.document\.capturedAt\}/);
  assert.match(file, /onChange=\{setDraft\}/);
  assert.match(editor, /onChange=\{\(document\) => onChange\(\{ \.\.\.draft, document \}\)\}/);
  assert.notEqual(randomUUID(), randomUUID());
});

test("an idle signed proof expires in the editor without a request or a save", () => {
  assert.ok(editorStart > 0 && editorEnd > editorStart);
  assert.match(editor, /const \[, refreshProofStatus\] = useState\(0\)/);
  assert.match(editor, /const proofExpiry = scoreAssessment\.status === "ready" \? scoreAssessment\.proof\.payload\.expiresAt : null/);
  assert.match(editor, /proofExpiry \+ 1 - Date\.now\(\)/);
  assert.match(editor, /window\.setTimeout\(\(\) => refreshProofStatus\(n => n \+ 1\), delay\)/);
  assert.match(editor, /window\.clearTimeout\(timeout\)/);
  assert.match(editor, /document\.addEventListener\("visibilitychange", onVisibility\)/);
  assert.match(editor, /document\.removeEventListener\("visibilitychange", onVisibility\)/);
  assert.match(editor, /const scoreBlocked = scoreAssessment\.status !== "none" && scoreAssessment\.status !== "ready"/);
  assert.match(editor, /disabled=\{busy \|\| scoreBlocked\}/);
  assert.match(editor, /disabled=\{busy \|\| scoreBlocked \|\|/);
  assert.doesNotMatch(editor, /setInterval\(|fetch\(.*proofExpiry|apiJson\(.*proofExpiry/);
});

test("boundary: proof is ready at its expiry timestamp, then blocked one millisecond later", () => {
  const expiresAt = Math.floor(Date.now() / 60000) * 60000 + 600000;
  const p = {
    version: 1, issuer: "h00k.top", purpose: "archive-score-record",
    rubric: "regular-flow-72-13-15-v1", archiveId: "archive_123",
    symbol: "BTCUSDT", exchange: "binance", marketType: "futures",
    timeframe: "1m", score: 82, entry: 100, stop: 90, target: 120,
    assessedAt: expiresAt - 720000, issuedAt: expiresAt - 600000,
    expiresAt,
  } as const;
  const proof: SignedArchiveScoreProof = { payload: p, signature: "A".repeat(86) };
  const t = Math.floor(Date.now() / 60000) * 60 - 120;
  const doc = captureChartDocument({
    symbol: "BTCUSDT", exchange: "binance", marketType: "futures", timeframe: "1m",
    candles: [{ time: t, open: 100, high: 121, low: 85, close: 105, volume: 10 }],
    markers: [
      { id: "e", type: "entry", label: "Entry", price: 100, color: "#38bdf8" },
      { id: "s", type: "stop_loss", label: "SL", price: 90, color: "#ef4444" },
      { id: "t", type: "target", label: "TP", price: 120, color: "#10b981" },
    ], drawings: [],
  });
  assert.equal(assessArchiveProofDraft(JSON.stringify(proof), doc, expiresAt).status, "ready");
  assert.equal(assessArchiveProofDraft(JSON.stringify(proof), doc, expiresAt + 1).status, "expired");
});
