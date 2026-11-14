import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  publicClosedOrderOverview, publicProfileSetups,
} from "../src/community/publicProfileSocialModel";

const view = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
const style = readFileSync(new URL("../src/community/publicProfile.css", import.meta.url), "utf8");
const api = readFileSync(new URL("../server/community/publicProfiles.ts", import.meta.url), "utf8");

test("public /u/ profile moves statistics into a visible social dashboard without fake PnL", () => {
  const empty = publicClosedOrderOverview([]);
  assert.deepEqual(empty, { count: 0, wins: 0, losses: 0, flat: 0, winRate: null, pnl: null, currency: null });
  const only = publicClosedOrderOverview([{ currency: "USDT", count: 9, wins: 5, losses: 3, flat: 1, winRate: 62.5, pnl: "125.90" }]);
  assert.equal(only.count, 9);
  assert.equal(only.winRate, 62.5);
  assert.equal(only.pnl, "125.90");
  assert.equal(only.currency, "USDT");

  // Adding PnL denominated in USDT to PnL denominated in BTC would be false.
  const mixed = publicClosedOrderOverview([
    { currency: "USDT", count: 9, wins: 5, losses: 3, flat: 1, winRate: 62.5, pnl: "125.90" },
    { currency: "BTC", count: 2, wins: 1, losses: 1, flat: 0, winRate: 50, pnl: "-0.03" },
  ]);
  assert.equal(mixed.count, 11);
  assert.equal(mixed.winRate, 60);
  assert.equal(mixed.pnl, null);
  assert.equal(mixed.currency, null);
  const hiddenAmounts = publicClosedOrderOverview([
    { currency: "USDT", count: 4, wins: 1, losses: 2, flat: 1, winRate: 33.3 },
  ]);
  assert.equal(hiddenAmounts.pnl, null);
});

test("real HookChart breakdowns never substitute mock articles or unpublished setups", () => {
  const rows = [
    { id: "public-chart", chart: { symbol: "BTCUSDT" } },
    { id: "ordinary-post", chart: null },
    { id: "another-chart", chart: { symbol: "ETHUSDT" } },
  ];
  assert.deepEqual(publicProfileSetups(rows).map(x => x.id), ["public-chart", "another-chart"]);
  assert.deepEqual(publicProfileSetups([]), []);
  assert.match(view, /type PublicTab = "wall" \| "articles" \| "setups" \| "statistics" \| "about"/);
  assert.match(view, /visibleWall = tab === "setups" \? publicProfileSetups\(wall\)/);
  assert.match(view, /tab === "articles" \? wall\.filter\(item => item\.category === "education"\)/);
  assert.match(view, /Публічні розбори HookChart/);
  assert.doesNotMatch(view, /MOCK_ARTICLE|fakeFollowers|hardcodedBadge|PNL_30D/);
});

test("public profile mirrors social reference layout with real privacy-aware actions and feed", () => {
  assert.match(view, /className="public-profile-hero"/);
  assert.match(view, /className="public-profile-cover"/);
  assert.match(view, /className="public-profile-avatar"/);
  assert.match(view, /className="public-profile-hero-bio"/);
  assert.match(view, /className="public-profile-hero-actions"/);
  assert.match(view, /Додати в друзі/);
  assert.match(view, /Повідомлення/);
  assert.match(view, /title="Запити дружби доступні після входу в Community"/);
  assert.match(view, /className="public-profile-overview public-profile-panel"/);
  assert.match(view, /className="public-profile-kpi-grid"/);
  assert.match(view, /className="public-profile-achievements public-profile-panel"/);
  assert.match(view, /поки ще не опубліковані|ще не опубліковані/);
  assert.match(view, /className="public-profile-tabs"/);
  assert.match(view, /className=\{"public-profile-wall"/);
  assert.match(view, /aria-expanded=\{expandedComments === item\.id\}/);
  assert.match(view, /className="public-profile-post-actions"/);
  assert.match(view, /className="public-profile-reactions"/);
  assert.match(view, /navigator\.share/);
  assert.match(view, /navigator\.clipboard\.writeText/);
  assert.match(view, /requestAnimationFrame\(/);
  assert.match(view, /profile\.statistics \?/);
  assert.match(view, /overview\.pnl !== null &&/);
  assert.match(view, /profile\.coverUrl &&/);
  assert.match(view, /profile\.avatarUrl &&/);
  assert.match(api, /publicProfilePolicy\(db\)/);
  assert.match(api, /c\.statisticsAudience === "public"/);
  assert.match(api, /c\.amountsAudience === "public"/);
  assert.match(style, /\.public-profile-kpi-grid/);
  assert.match(style, /\.public-profile-achievement-grid/);
  assert.match(style, /\.public-profile-columns/);
  assert.match(style, /@media \(max-width: 640px\)/);
  assert.match(style, /@media \(max-width: 390px\)/);
});
