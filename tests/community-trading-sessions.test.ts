import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  TRADING_SESSIONS,
  getSessionWindow,
  formatZonedTime,
  resolveTimeZone,
} from "../src/utils/tradingSessions";

const component = readFileSync(
  new URL("../src/components/community/CommunityTradingSessions.tsx", import.meta.url),
  "utf8",
);
const css = readFileSync(
  new URL("../src/components/community/social-trading-sessions.css", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../src/components/community/CommunityPage.tsx", import.meta.url),
  "utf8",
);
const account = readFileSync(new URL("../server/community/account.ts", import.meta.url), "utf8");

test("Community uses the existing four real regional sessions and IANA DST calendar", () => {
  assert.deepEqual(TRADING_SESSIONS.map((s) => s.id), ["sydney", "tokyo", "london", "new-york"]);
  assert.match(component, /getSessionWindow\(session, now\)/);
  assert.match(component, /formatZonedTime\(window\.startsAt, zone\)/);
  assert.match(component, /formatTimeZoneOffset\(now, zone\)/);
  assert.match(component, /sessionDateLabel\(window\.startsAt, window\.endsAt, zone\)/);
  assert.match(component, /resolveTimeZone\(profile\?\.timeZone\)/);
  assert.equal(resolveTimeZone("Europe/Warsaw"), "Europe/Warsaw");
  const london = TRADING_SESSIONS.find((session) => session.id === "london")!;
  const date = new Date("2026-07-06T07:30:00Z");
  assert.equal(getSessionWindow(london, date).active, true);
  assert.equal(formatZonedTime(date, "Europe/Warsaw"), "09:30");
});

test("users select sessions through persisted account preferences rather than browser-only mock data", () => {
  assert.match(component, /profile\?\.community\?\.tradingSessionIds/);
  assert.match(component, /await updateProfileData\(\{ community: \{ tradingSessionIds: next \} \}\)/);
  assert.match(component, /disabled=\{!profile \|\| !!busyId\}/);
  assert.match(component, /checked=\{checked\}/);
  assert.match(component, /setError\(cause instanceof Error/);
  assert.match(account, /raw\.tradingSessionIds !== undefined/);
  assert.match(account, /new Set\(\["sydney", "tokyo", "london", "new-york"\]\)/);
  assert.match(account, /clean\.tradingSessionIds = values/);
  assert.doesNotMatch(component, /localStorage|INITIAL_SESSIONS|MOCK_SESSIONS/);
});

test("desktop sidebar and mobile page both expose the same real session UI", () => {
  assert.match(page, /\["sessions", "Торгові сесії", <Clock3/);
  assert.match(page, /tab === "sessions" && <CommunityTradingSessions variant="page"/);
  assert.match(page, /<CommunityTradingSessions variant="sidebar"/);
  assert.match(component, /variant\?: "page" \| "sidebar"/);
  assert.match(css, /\.community-workspace \.community-sessions-sidebar/);
  assert.match(css, /\.community-workspace \.community-sessions-page/);
  assert.match(css, /@media \(max-width: 700px\)/);
});

test("Community sessions do not request exchange data or simulate proof of trading", () => {
  assert.match(component, /не години роботи криптобірж/);
  assert.match(component, /не підтвердження обсягу торгів/);
  assert.match(component, /window\.setInterval/);
  assert.match(component, /document\.visibilityState === "visible"/);
  assert.match(component, /window\.clearInterval/);
  assert.doesNotMatch(component, /fetch\(|apiJson\(|binance|bybit|websocket|setTimeout/gi);
  assert.doesNotMatch(css, /^(?:html|body|\*)\s*\{/m);
});
