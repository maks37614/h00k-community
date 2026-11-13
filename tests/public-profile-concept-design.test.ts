import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
const concept = readFileSync(new URL("../src/community/publicProfileConcept.css", import.meta.url), "utf8");
const publicApi = readFileSync(new URL("../server/community/publicProfiles.ts", import.meta.url), "utf8");

test("public trader profile uses social reference three-column layout with compact cover and real API data", () => {
  assert.match(view, /import "\.\/publicProfileConcept\.css"/);
  assert.match(view, /className="public-profile-columns public-profile-social-layout"/);
  assert.match(view, /className="public-profile-insights"/);
  assert.match(view, /className="public-profile-aside"/);
  assert.match(view, /className="public-profile-main"/);
  assert.match(view, /profile\.coverUrl &&/);
  assert.match(view, /profile\.avatarUrl &&/);
  assert.match(view, /profile\.statistics \?/);
  assert.match(view, /profile\.statistics &&/);
  assert.match(view, /item\.chart && <ChartPreview/);
  assert.match(concept, /\.public-profile-cover\s*\{[\s\S]*?height:108px/);
  assert.match(concept, /\.public-profile-columns\.public-profile-social-layout\s*\{[\s\S]*?grid-template-columns:minmax\(220px,270px\) minmax\(0,1fr\) minmax\(260px,300px\)/);
  assert.match(concept, /@media \(max-width:900px\)/);
  assert.match(concept, /@media \(max-width:670px\)/);
  assert.doesNotMatch(view, /INITIAL_PROFILES|MOCK_TRADES|fakeFollowers|DUMMY_PNL/);
});

test("public guest interactions remain safe, read-only, and lead to authenticated actions", () => {
  assert.match(view, /data-network-mode="public-snapshot"/);
  assert.match(view, /credentials: "omit", cache: "no-store"/);
  assert.match(view, /Запити дружби доступні після входу в Community/);
  assert.match(view, /Повідомлення доступні підтвердженим друзям у Community/);
  assert.match(view, /communityPostUrl\(profile\.communityOrigin, item\.id\)/);
  assert.match(view, /aria-controls=\{"public-comments-" \+ item\.id\}/);
  assert.match(view, /publicProfileSetups\(wall\)/);
  assert.match(view, /postCategory === id/);
  assert.match(publicApi, /category: \["idea", "analysis", "education"\]\.includes\(row\.body\?\.category\)/);
  assert.match(publicApi, /await rules\.visible\(row\)/);
  assert.match(publicApi, /c\.statisticsAudience === "public"/);
  assert.match(publicApi, /c\.amountsAudience === "public"/);
});
