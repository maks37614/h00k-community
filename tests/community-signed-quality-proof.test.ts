import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  archiveScoreSigningMessage, normalizeArchiveScoreProof,
  type ArchiveScorePayload, type SignedArchiveScoreProof,
} from "../src/community/archiveScoreProof";
import { captureChartDocument, normalizeChartDocument } from "../src/community/chartDocument";
import { verifyArchiveScoreProof } from "../server/community/qualityProof";
import { PublicProfileChartContext } from "../src/community/PublicProfileChartContext";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicKeyBase64 = Buffer.from(publicKey.export({ format: "pem", type: "spki" })).toString("base64");
const now = Date.now();

const payload = (): ArchiveScorePayload => ({
  version: 1, issuer: "h00k.top", purpose: "archive-score-record", rubric: "regular-flow-72-13-15-v1",
  archiveId: "arch_btc_signal_20261114", symbol: "BTCUSDT",
  exchange: "bybit", marketType: "futures", timeframe: "1m",
  score: 82, entry: 100, stop: 95, target: 108,
  assessedAt: now - 120_000, issuedAt: now, expiresAt: now + 600_000,
});
function proof(p = payload()): SignedArchiveScoreProof {
  return {
    payload: p,
    signature: sign(null, Buffer.from(archiveScoreSigningMessage(p)), privateKey).toString("base64url"),
  };
}
function snapshot() {
  const t = Math.floor(Date.now() / 60000) * 60 - 120;
  return captureChartDocument({
    symbol: "BTCUSDT", exchange: "bybit", marketType: "futures", timeframe: "1m",
    candles: [{ time: t, open: 100, high: 110, low: 94, close: 102, volume: 50 }],
    markers: [
      { id: "e", type: "entry", label: "Entry", price: 100, color: "#38bdf8" },
      { id: "s", type: "stop_loss", label: "SL", price: 95, color: "#ff0000" },
      { id: "t", type: "target", label: "TP", price: 108, color: "#00ff00" },
    ], drawings: [],
  });
}

test("signed h00k archive record binds to exact public chart market and Entry/SL/TP", () => {
  const doc = normalizeChartDocument({ ...snapshot(), qualityProof: proof() });
  const verified = verifyArchiveScoreProof(doc.qualityProof, doc, publicKeyBase64, now + 5_000);
  assert.equal(verified.payload.score, 82);
  assert.equal(verified.payload.purpose, "archive-score-record");
  assert.equal(doc.qualityProof?.signature, verified.signature);
  assert.throws(() => verifyArchiveScoreProof(verified, doc, undefined, now), /не налаштована/);
  assert.throws(() => verifyArchiveScoreProof(verified, doc, "broken", now), /недоступна/);
  assert.throws(() => verifyArchiveScoreProof(verified, doc, publicKeyBase64, now + 600_001), /Термін дії/);
  assert.throws(() => verifyArchiveScoreProof(verified, { ...doc, symbol: "ETHUSDT" }, publicKeyBase64, now), /не відповідає/);
  assert.throws(() => verifyArchiveScoreProof(verified, { ...doc, timeframe: "5m" }, publicKeyBase64, now), /не відповідає/);
  assert.throws(() => verifyArchiveScoreProof(verified, { ...doc, markers: doc.markers.filter(m => m.type !== "stop_loss") }, publicKeyBase64, now), /не відповідає/);
  assert.throws(() => verifyArchiveScoreProof(verified, { ...doc, markers: doc.markers.map(m => m.type === "target" ? {...m, price: 120}:m) }, publicKeyBase64, now), /не відповідає/);
});

test("any edited score, time, source, signature or injected fields are rejected", () => {
  const doc = snapshot(), signed = proof();
  assert.throws(() => verifyArchiveScoreProof({
    ...signed, payload: { ...signed.payload, score: 100 },
  }, doc, publicKeyBase64, now), /недійсний/);
  assert.throws(() => verifyArchiveScoreProof({
    ...signed, signature: (signed.signature.startsWith("A") ? "B" : "A") + signed.signature.slice(1),
  }, doc, publicKeyBase64, now), /недійсний/);
  assert.throws(() => verifyArchiveScoreProof({
    ...signed, payload: { ...signed.payload, issuer: "h00k-community" },
  }, doc, publicKeyBase64, now), /Неправильний формат/);
  assert.throws(() => normalizeArchiveScoreProof({
    ...signed, payload: { ...signed.payload, verified: true },
  }), /Некоректний/);
  assert.throws(() => normalizeArchiveScoreProof({ ...signed, privateKey: "SECRET_SHOULD_NOT_LEAK" }), /Некоректний/);
  assert.throws(() => normalizeChartDocument({
    ...doc, qualityProof: { ...signed, signature: "fake" },
  }));
  assert.throws(() => verifyArchiveScoreProof(proof({
    ...payload(), issuedAt: now + 90_000, expiresAt: now + 690_000,
  }), doc, publicKeyBase64, now), /Термін дії/);
});

test("UI says signed archive value, never claims independent scanner or trade verification", () => {
  const doc = normalizeChartDocument({ ...snapshot(), qualityProof: proof() });
  const html = renderToStaticMarkup(React.createElement(PublicProfileChartContext, { document: doc }));
  assert.match(html, /Оцінка з архіву h00k:/);
  assert.match(html, /82\/100/);
  assert.match(html, /Підпис підтверджує походження архівного запису/);
  assert.match(html, /не точність алгоритму/);
  assert.doesNotMatch(html, /перевірений торговий сигнал|підтверджений PnL|гарантований/i);
  const missing = renderToStaticMarkup(React.createElement(PublicProfileChartContext, {
    document: snapshot(),
  }));
  assert.match(missing, /Оцінка з архіву: недоступна/);
  assert.doesNotMatch(missing, /82\/100/);
});

test("only server path authorizes proof and chart paste is explicit and does not inherit source claims", () => {
  const server = readFileSync(new URL("../server/community/content.ts", import.meta.url), "utf8");
  const editor = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
  const verifier = readFileSync(new URL("../server/community/qualityProof.ts", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/components/community/social-quality-proof.css", import.meta.url), "utf8");
  assert.match(server, /verifyArchiveScoreProof\(document\.qualityProof, document, process\.env\.H00K_QUALITY_VERIFY_KEY_B64\)/);
  assert.match(server, /if \(parentId\) fail\("Підписаний запис оцінки/);
  assert.match(editor, /const \{ qualityProof: _oldProof, \.\.\.chartWithoutProof \} = draft\.document/);
  assert.match(editor, /Вставте підписаний JSON із архіву h00k\.top/);
  assert.match(editor, /qualityProofText\.trim\(\)/);
  assert.match(verifier, /verify\(null,/);
  assert.match(verifier, /archiveScoreBindingIssues\(p, document\)\.length/);
  const binding = readFileSync(new URL("../src/community/archiveScoreBinding.ts", import.meta.url), "utf8");
  assert.match(binding, /\["entry", payload\.entry, "Entry"\]/);
  assert.match(binding, /\["stop_loss", payload\.stop, "Stop Loss"\]/);
  assert.match(binding, /\["target", payload\.target, "Take Profit"\]/);
  assert.match(css, /\.community-workspace \.community-chart-quality-proof/);
  assert.doesNotMatch(editor, /QUALITY_SIGNING_KEY_B64|createPrivateKey|generateKeyPairSync/);
});
