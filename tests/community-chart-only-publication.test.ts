import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicProfileChartContext } from "../src/community/PublicProfileChartContext";
import type { ChartDocument } from "../src/community/chartDocument";

const source = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
const server = readFileSync(new URL("../server/community/content.ts", import.meta.url), "utf8");
const api = readFileSync(new URL("../server/community/publicProfiles.ts", import.meta.url), "utf8");

test("ChartDialog publishes an authored snapshot as Analysis without synthetic filler text", () => {
  const start = source.indexOf("function ChartDialog({");
  const end = source.indexOf("function Workspace({", start);
  assert.ok(start >= 0 && end > start);
  const editor = source.slice(start, end);
  assert.match(editor, /\[category, setCategory\] = useState\("analysis"\)/);
  assert.match(editor, /aria-label="Категорія графіка"/);
  assert.match(editor, /<option value="analysis">Аналіз<\/option>/);
  assert.match(editor, /<option value="idea">Ідея<\/option>/);
  assert.match(editor, /<option value="education">Навчання<\/option>/);
  assert.match(editor, /chartId: id/);
  assert.match(editor, /target\.kind === "post" \? "" : "Мій варіант розбору графіка"/);
  assert.match(editor, /target\.kind === "post" \? \{ category \} : \{\}/);
  assert.doesNotMatch(editor, /verified:\s*true|qualityScore\s*:|score:\s*100|Math\.random\(/);
});

test("server requires an authorized chart before accepting a text-free post", () => {
  assert.match(server, /function bodyFor\(raw: any, kind: string, hasChartAttachment = false\)/);
  assert.match(server, /!\(kind === "post" && hasChartAttachment\)/);
  assert.match(server, /bodyFor\(input\.body, kind, Boolean\(input\.chartId\)\)/);
  assert.match(server, /c\.owner_id !== rules\.viewer/);
  assert.match(server, /await rules\.canReadChart\(id\)/);
  assert.match(api, /row\.chart_id && !\(await rules\.canReadChart\(row\.chart_id\)\)/);
  assert.match(api, /await rules\.visible\(row\)/);
});

test("public snapshot metadata labels unverified quality without leaking a fake 0/100", () => {
  const capturedAt = Date.UTC(2026, 10, 12, 14, 0);
  const snapshot = {
    version: 1, symbol: "BTCUSDT", exchange: "bybit",
    marketType: "futures", timeframe: "5m", capturedAt,
    cutoff: Math.floor(capturedAt / 1000), series: {}, markers: [], drawings: [],
  } as ChartDocument;
  const html = renderToStaticMarkup(React.createElement(PublicProfileChartContext, { document: snapshot }));
  assert.match(html, /BTCUSDT/);
  assert.match(html, /Bybit/);
  assert.match(html, /Оцінка з архіву: недоступна/);
  assert.doesNotMatch(html, /0\/100|100\/100|перевірений сигнал|profitFactor|qualityScore/i);
});
