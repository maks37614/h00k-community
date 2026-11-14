import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/components/community/social-profile-hero.css", import.meta.url), "utf8");
const routes = readFileSync(new URL("../server/community/routes.ts", import.meta.url), "utf8");
const concept = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");

test("authenticated social profiles display real cover and avatar without mock online status", () => {
  assert.match(page, /import "\.\/social-profile-hero\.css"/);
  assert.match(page, /p\.coverUrl && <img className="community-profile-cover-photo"/);
  assert.match(page, /p\.avatarUrl && <img className="community-profile-avatar-photo"/);
  assert.match(page, /onError=\{event => \{ event\.currentTarget\.hidden = true; \}\}/);
  assert.match(page, /p\.username && <p className="community-profile-handle"/);
  assert.match(page, /p\.joinedAt && !Number\.isNaN/);
  assert.match(page, /id === user\?\.uid && <button type="button" className="community-profile-edit-appearance"/);
  assert.match(css, /\.community-workspace \.community-profile-cover-photo/);
  assert.match(css, /\.community-workspace \.community-profile-avatar-photo/);
  assert.match(css, /@media \(max-width:760px\)/);
  assert.match(css, /@media \(max-width:390px\)/);
  assert.doesNotMatch(css, /^\s*body\s*\{|^\s*html\s*\{/m);
  assert.doesNotMatch(page, /MOCK_PROFILE|fakeFollower|isVerifiedTrader|syntheticOnlineStatus/);
});

test("the profile API only reveals private photos to their owner, public photos to opted-in visitors", () => {
  assert.match(routes, /const hasPublicAddress = communityFields\.publicProfileEnabled === true/);
  assert.match(routes, /const profileMediaUrl = \(kind: "avatar" \| "cover"\)/);
  assert.match(routes, /if \(id === a\.id\) return "\/api\/community\/media\/" \+ mediaId/);
  assert.match(routes, /hasPublicAddress && communityFields\[kind \+ "Audience"\] === "public"/);
  assert.match(routes, /return "\/api\/public\/profiles\/" \+ rows\[0\]\.username \+ "\/" \+ kind/);
  assert.match(routes, /username: hasPublicAddress \? rows\[0\]\.username : null/);
  assert.match(routes, /avatarUrl: profileMediaUrl\("avatar"\)/);
  assert.match(routes, /coverUrl: profileMediaUrl\("cover"\)/);
  assert.match(routes, /if \(!allowed\) fail\("Недоступно", 404\)/);
  assert.match(concept, /profile\.coverUrl && <img/);
});

test("educational profile tab is backed by filtered, cursor-paginated authenticated feed", () => {
  assert.match(page, /type Section = "wall" \| "articles" \| "about" \| "trades"/);
  assert.match(page, /profileSection === "articles"/);
  assert.match(page, /"\/feed\?mode=wall&owner=" \+ id \+ "&category=education"/);
  assert.match(page, /"&category=education&before=" \+ encodeURIComponent\(cursor\)/);
  assert.match(page, /currentProfileRef\.current !== requestedId/);
  assert.match(page, /item\.body\?\.category === "education"/);
  assert.match(page, /<ItemCard key=\{item\.id\} item=\{item\}/);
  assert.match(page, /disabled=\{articlesBusy\}/);
  assert.match(page, /<Composer/);
  assert.match(routes, /AND \(\$4::text IS NULL OR body->>'category'=\$4\)/);
  assert.match(routes, /const item = await presentItem\(db, p, row\)/);
  assert.match(css, /\.community-workspace \.community-profile-article-list/);
  assert.doesNotMatch(page, /INITIAL_ARTICLES|MOCK_ARTICLE|FAKE_EDUCATION/);
});
