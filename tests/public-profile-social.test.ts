import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  publicPostId, publicPostUrl, communityPostUrl,
  publicProfileDate, visibleReactionSummary,
} from "../src/community/publicProfileViewModel";

const id = "cb59d0d9-bacf-4dce-b1c1-9876e70078d1";

test("/u/ share links use public canonical URL and link to exact authenticated post", () => {
  assert.equal(publicPostId(id), id);
  for (const bad of [null, "", "abc", "../private", "alert(1)", "0".repeat(80), "AA_AA", 1])
    assert.equal(publicPostId(bad), null);
  assert.equal(
    publicPostUrl("https://ivan.h00k.top", id),
    "https://ivan.h00k.top/?post=" + id,
  );
  assert.equal(
    publicPostUrl("https://community-stage.h00k.top/u/ivan", id),
    "https://community-stage.h00k.top/u/ivan?post=" + id,
  );
  assert.equal(
    communityPostUrl("https://community-stage.h00k.top", id),
    "https://community-stage.h00k.top/#community?post=" + id,
  );
  assert.throws(() => publicPostUrl("javascript:alert(1)", id));
  assert.throws(() => publicPostUrl("https://attacker@h00k.top", id));
  assert.throws(() => communityPostUrl("javascript:alert(1)", id));
});

test("a guest only sees actual aggregate reactions and a real join date", () => {
  assert.deepEqual(visibleReactionSummary([{ emoji: "❤️", count: 2 }, { emoji: "👍", count: 0 }]),
    [{ emoji: "❤️", count: 2 }]);
  assert.deepEqual(visibleReactionSummary([{ emoji: "👍", count: 2, user_id: "SECRET" }]),
    [{ emoji: "👍", count: 2 }]); // Never retain extra user fields
  assert.deepEqual(visibleReactionSummary(null), []);
  assert.equal(publicProfileDate("not a date"), "");
  assert.ok(publicProfileDate("2026-11-01T00:00:00.000Z").includes("2026"));
});

test("social public profile renders tabs, real API discussion, actions and no placeholder trading stats", () => {
  const view = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/community/publicProfile.css", import.meta.url), "utf8");
  const api = readFileSync(new URL("../server/community/publicProfiles.ts", import.meta.url), "utf8");
  assert.match(view, /type PublicTab = "wall" \| "statistics" \| "about"/);
  assert.match(view, /className="public-profile-tabs"/);
  assert.match(view, /className="public-profile-post-actions"/);
  assert.match(view, /aria-expanded=\{expandedComments === item\.id\}/);
  assert.match(view, /const toggleComments =/);
  assert.match(view, /navigator\.clipboard\.writeText/);
  assert.match(view, /publicPostUrl\(profile\.url, id\)/);
  assert.match(view, /navigator\.share/);
  assert.match(view, /const sharePost = async/);
  assert.match(view, /communityPostUrl\(profile\.communityOrigin, item\.id\)/);
  assert.match(view, /base \+ "\/posts\/" \+ encodeURIComponent\(linkedPostId\)/);
  assert.match(view, /credentials: "omit", cache: "no-store"/);
  assert.match(view, /profile\.statistics &&/);
  assert.match(view, /s\.pnl !== undefined &&/);
  assert.match(view, /profile\.bio &&/);
  assert.match(view, /className="public-profile-comments"/);
  assert.match(api, /route\("\/posts\/:id\/comments"/);
  assert.match(api, /await rules\.visible\(row\)/);
  assert.match(api, /author: text\(row\.author_profile\?\.displayName, 100\)/);
  assert.match(api, /route\("\/posts\/:id"/);
  assert.match(css, /\.public-profile-tabs/);
  assert.match(css, /\.public-profile-reactions/);
  assert.match(css, /\.public-profile-comments/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.doesNotMatch(view, /MOCK_|fakeTrade|followersCount|onlineStatus|PNL_30D/);
});
