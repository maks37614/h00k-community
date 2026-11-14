import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/community/publicProfileConcept.css", import.meta.url), "utf8");
const settings = readFileSync(new URL("../src/components/community/PublicProfileSettings.tsx", import.meta.url), "utf8");
const picker = readFileSync(new URL("../src/components/community/PublicFeaturedPostSettings.tsx", import.meta.url), "utf8");
const account = readFileSync(new URL("../server/community/account.ts", import.meta.url), "utf8");
const publicApi = readFileSync(new URL("../server/community/publicProfiles.ts", import.meta.url), "utf8");
const profilePage = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");

test("anonymous public profile highlights only the real server-authorized featured post", () => {
  assert.match(page, /featuredPost: PublicPost \| null/);
  assert.match(page, /profile\?\.featuredPost \?\? null/);
  assert.match(page, /className="public-profile-pinned-post"/);
  assert.match(page, /eligiblePinned/);
  assert.match(page, /new Map\(\[/);
  assert.match(page, /publicProfileSetups\(wall\)/);
  assert.match(publicApi, /await rules\.visible\(pinned\)/);
  assert.match(publicApi, /await rules\.canReadChart\(pinned\.chart_id\)/);
  assert.match(publicApi, /featuredPost = await publicPostCard\(db, rules, pinned\)/);
  assert.match(css, /\.public-profile-pinned-post/);
  assert.doesNotMatch(page, /MOCK_FEATURED_POST|fakePinned|sampleTrade/);
});

test("empty wall explains consent and links to authorized editing instead of inventing posts", () => {
  assert.match(page, /public-profile-empty-actions/);
  assert.match(page, /section=feed/);
  assert.match(page, /profileTab=about/);
  assert.match(page, /Перший допис, фото та HookChart з'являться тут лише після публікації/);
  assert.match(profilePage, /get\("profileTab"\) === "about"/);
  assert.match(css, /@media\(max-width:670px\)/);
});

test("featured post picker shows public posts only, supports older pages and owner-only updates", () => {
  assert.match(settings, /PublicFeaturedPostSettings/);
  assert.match(settings, /featuredPublicPostId: id/);
  assert.match(picker, /credentials: "omit"/);
  assert.match(picker, /\/api\/public\/profiles\//);
  assert.match(picker, /new URLSearchParams\(\{ before: next \}\)/);
  assert.match(picker, /Нічого не закріплено/);
  assert.match(account, /featuredPublicPostId/);
  assert.match(account, /owner_id=\$2 AND kind='post'/);
  assert.match(account, /audience='public' AND conversation_id IS NULL AND NOT deleted/);
  assert.doesNotMatch(picker, /\/api\/community\/feed|mockPosts/);
});
