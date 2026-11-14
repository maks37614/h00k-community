import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicProfileImportFreshness, PublicProfileVerifiedAwards } from "../src/community/PublicProfileVerifiedHighlights";
import { publicAwardCards, publicStatsFreshness } from "../src/community/publicProfileVerifiedModel";

const publicView = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/community/publicProfileHighlights.css", import.meta.url), "utf8");
const api = readFileSync(new URL("../server/community/publicProfiles.ts", import.meta.url), "utf8");

test("real public award categories render only positive counts, without inferred rarity or made-up ranks", () => {
  const actual = { received: 7, thanks: 5, analysis: 2, topTrader: 0 };
  assert.deepEqual(publicAwardCards(actual).map(card => [card.id,card.count]), [["thanks",5],["analysis",2]]);
  const html = renderToStaticMarkup(React.createElement(PublicProfileVerifiedAwards, { awards: actual }));
  assert.match(html, /Отримані нагороди Community/);
  assert.match(html, /Подяка/);
  assert.match(html, /Крутий аналіз/);
  assert.doesNotMatch(html, /Топ трейдер/);
  assert.doesNotMatch(html, /legendary|epic|rank|badgeLevel|fake/i);
  const top = renderToStaticMarkup(React.createElement(PublicProfileVerifiedAwards, {
    awards: { received: 1, thanks: 0, analysis: 0, topTrader: 1 },
  }));
  assert.match(top, /Топ трейдер/);
  assert.doesNotMatch(top, /Подяка/);
  assert.deepEqual(publicAwardCards({ received: 0, thanks: -4, analysis: 1.2, topTrader: 0 }), []);
  const empty = renderToStaticMarkup(React.createElement(PublicProfileVerifiedAwards, {
    awards: { received: 0, thanks: 0, analysis: 0, topTrader: 0 },
  }));
  assert.match(empty, /Нагороди ще не отримані/);
  assert.doesNotMatch(empty, /public-profile-verified-award-count/);
});

test("freshness summary is based only on actual sync coverage and ignores invalid timestamps", () => {
  const coverage = [
    { status: "ok", synced_at: "2026-11-08T13:30:00Z", covered_from: "2026-10-01T00:00:00Z" },
    { status: "pending", synced_at: "2026-11-13T11:00:00Z", covered_from: "2026-09-01T00:00:00Z" },
    { status: "broken", synced_at: "not-a-date", covered_from: null },
  ];
  assert.deepEqual(publicStatsFreshness(coverage), {
    lastSyncedAt: "2026-11-13T11:00:00.000Z",
    earliestCoveredFrom: "2026-09-01T00:00:00.000Z",
  });
  assert.deepEqual(publicStatsFreshness([{ status: "no", synced_at: "invalid", covered_from: "" }]), {
    lastSyncedAt: null, earliestCoveredFrom: null,
  });
  const html = renderToStaticMarkup(React.createElement(PublicProfileImportFreshness, { coverage }));
  assert.match(html, /Остання синхронізація/);
  assert.match(html, /2026-11-13T11:00:00.000Z/);
  assert.match(html, /Покриття підключення від/);
  assert.match(html, /не гарантує повноту історії/);
  const empty = renderToStaticMarkup(React.createElement(PublicProfileImportFreshness, { coverage: [] }));
  assert.match(empty, /Дата синхронізації біржі наразі недоступна/);
  assert.doesNotMatch(empty, /Остання синхронізація/);
});

test("public trader profile integrates opt-in cards without fetching private accounts or inventing 30-day PnL", () => {
  assert.match(publicView, /import \{ PublicProfileImportFreshness, PublicProfileVerifiedAwards \} from "\.\/PublicProfileVerifiedHighlights"/);
  assert.match(publicView, /<PublicProfileImportFreshness coverage=\{profile\.statistics\.coverage\}/);
  assert.match(publicView, /<PublicProfileVerifiedAwards awards=\{profile\.awards\}/);
  assert.match(publicView, /profile\.statistics \? \(/);
  assert.match(publicView, /profile\.awards \? \(/);
  assert.match(publicView, /import "\.\/publicProfileHighlights\.css"/);
  assert.match(api, /if \(c\.publicAwardsEnabled === true\)/);
  assert.match(api, /if \(c\.statisticsAudience === "public"\)/);
  assert.match(api, /\(c\.amountsAudience === "public" \? \{ pnl: row\.pnl \} : \{\}\)/);
  assert.doesNotMatch(publicView + css, /pnl30dPercent|profitFactor|avgRR|fakeFollowers|INITIAL_BADGES|FAKE_PNL/);
});

test("verified badge and sync-time styles stay scoped and responsive", () => {
  assert.match(css, /\.public-profile \.public-profile-verified-awards\s*\{/);
  assert.match(css, /\.public-profile \.public-profile-import-freshness\s*\{/);
  assert.match(css, /@media \(max-width: 860px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.doesNotMatch(css, /^\s*(?:html|body|:root|\.community-workspace)\s*\{/m);
});
