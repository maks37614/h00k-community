import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { PublicProfileDailyHistory } from "../src/community/PublicProfileDailyHistory";
import {
  publicDailyTimeline, type PublicDailyHistoryPayload,
} from "../src/community/publicProfileDailyHistoryModel";

const view = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
const chart = readFileSync(new URL("../src/community/PublicProfileDailyHistory.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/community/publicProfileDailyHistory.css", import.meta.url), "utf8");
const api = readFileSync(new URL("../server/community/publicProfiles.ts", import.meta.url), "utf8");

const payload: PublicDailyHistoryPayload = {
  days: 30, timezone: "UTC", through: "2026-11-14",
  items: [
    { day: "2026-11-12", count: 2, wins: 1, losses: 1, flat: 0 },
    { day: "2026-11-14", count: 3, wins: 1, losses: 1, flat: 1 },
  ],
};
test("daily activity generates exactly 30 real UTC calendar points and never fabricates trades", () => {
  const timeline = publicDailyTimeline(payload);
  assert.equal(timeline.length, 30);
  assert.equal(timeline[0].day, "2026-10-16");
  assert.equal(timeline.at(-1)?.day, "2026-11-14");
  assert.deepEqual(timeline.find(day => day.day === "2026-11-13"), {
    day: "2026-11-13", count: 0, wins: 0, losses: 0, flat: 0,
  });
  assert.deepEqual(timeline.find(day => day.day === "2026-11-12"), payload.items[0]);
  assert.equal(timeline.reduce((sum, d) => sum + d.count, 0), 5);
  assert.deepEqual(publicDailyTimeline({ ...payload, days: 31 as 30 }), []);
  assert.deepEqual(publicDailyTimeline({ ...payload, through: "2026-02-30" }), []);
  const filtered = publicDailyTimeline({ ...payload, items: [
    ...payload.items,
    { day: "2026-11-15", count: 1, wins: 1, losses: 0, flat: 0 },
    { day: "2026-10-01", count: 1, wins: 1, losses: 0, flat: 0 },
    { day: "2026-11-13", count: 3, wins: 2, losses: 0, flat: 0 },
    { day: "2026-11-13", count: 2, wins: 1, losses: 1, flat: 0 },
  ] });
  assert.equal(filtered.reduce((sum, d) => sum + d.count, 0), 5);
  assert.equal(filtered.find(day => day.day === "2026-11-13")?.count, 0);
});

test("history chart renders exact imported count distribution without claiming profits or rendering live HookChart", () => {
  const html = renderToStaticMarkup(React.createElement(PublicProfileDailyHistory, { data: payload }));
  assert.match(html, /Динаміка за 30 днів/);
  assert.match(html, /5.*закриттів/);
  assert.match(html, /2026-11-12: 2 закриттів/);
  assert.match(html, /2026-11-14: 3 закриттів/);
  assert.match(html, /30/);
  assert.match(html, /UTC/);
  assert.match(html, /public-daily-history-bars/);
  assert.equal((html.match(/class="public-daily-history-bar-slot"/g) ?? []).length, 30);
  assert.doesNotMatch(html, /PnL:|USDT|USDC|ROI|symbol|баланс/);
  const empty = renderToStaticMarkup(React.createElement(PublicProfileDailyHistory, {
    data: { days: 30, timezone: "UTC", through: "2026-11-14", items: [] },
  }));
  assert.match(empty, /імпортованих закриттів немає/);
  assert.doesNotMatch(empty, /public-daily-history-bars/);
});

test("history fetch is lazily bound to Results and only authorized server daily counts are returned", () => {
  assert.match(view, /tab !== "statistics" \|\| !profile\?\.statistics \|\| dailyHistory/);
  assert.match(view, /read\(base \+ "\/statistics\/daily", controller\.signal\)/);
  assert.match(view, /return \(\) => controller\.abort\(\)/);
  assert.match(view, /dailyHistory && <PublicProfileDailyHistory data=\{dailyHistory\}/);
  assert.match(view, /setDailyHistoryRetry\(v => v \+ 1\)/);
  assert.match(api, /route\("\/statistics\/daily"/);
  assert.match(api, /statisticsAudience !== "public"/);
  assert.match(api, /owner_id=\$1/);
  assert.match(api, /closed_at <= now\(\)/);
  assert.match(api, /FILTER\(WHERE pnl>0\)/);
  assert.match(api, /FILTER\(WHERE pnl<0\)/);
  assert.match(api, /FILTER\(WHERE pnl=0\)/);
  assert.doesNotMatch(chart + css, /fetch\(|WebSocket\(|setInterval\(|MOCK_|fakeTrade/);
  assert.doesNotMatch(api.slice(api.indexOf('route("/statistics/daily"'),api.indexOf('// Avatar and cover are explicit')), /sum\(pnl\)|\bconnection_id\b|\bsource_id\b/);
});

test("daily chart remains scoped to public trader page and mobile layout scrolls horizontally", () => {
  assert.match(css, /\.public-profile \.public-daily-history-bars/);
  assert.match(css, /overflow-x: auto/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.doesNotMatch(css, /^\s*(?:html|body|:root|\.community-workspace)\s*\{/m);
});
