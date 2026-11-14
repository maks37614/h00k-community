import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
const routes = readFileSync(new URL("../server/community/publicProfiles.ts", import.meta.url), "utf8");

test("guest HookChart tab fetches chart-filtered server pages instead of filtering only the first wall page", () => {
  assert.match(routes, /req\.query\.withChart === "1"/);
  assert.match(routes, /NOT \$4::boolean OR chart_id IS NOT NULL/);
  assert.match(routes, /await rules\.visible\(row\)/);
  assert.match(routes, /await rules\.canReadChart\(row\.chart_id\)/);
  assert.match(view, /feedKey === "setups" \? "\?withChart=1"/);
  assert.match(view, /requestedKey === "setups" \? \{ withChart: "1" \}/);
  assert.match(view, /requestedKey === "setups"/);
  assert.match(view, /loadedFeedKey === feedKey/);
  assert.match(view, /currentFeedKey\.current !== requestedKey/);
  assert.match(view, /feedRequestVersion/);
  assert.match(view, /controller\.signal\.aborted/);
  assert.match(view, /Ще розбори HookChart/);
  assert.match(view, /Шукаємо відкриті розбори HookChart/);
  assert.match(view, /visibleWall = tab === "setups" \? publicProfileSetups\(wall\)/);
  assert.doesNotMatch(view, /MOCK_ARTICLE|fakeSetup|mockChartList/);
});

test("empty state does not claim there are no charts before a remote page has loaded", () => {
  assert.match(view, /pendingFeedKey !== feedKey && loadedFeedKey === feedKey && !error/);
  assert.match(view, /loadedNext && <button/);
  assert.match(view, /Завантажуємо публікації/);
});
