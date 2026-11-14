import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { publicProfileDeepLink } from "../src/community/publicProfileViewModel";

const page = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
const skin = readFileSync(new URL("../src/community/socialTraderProfile.css", import.meta.url), "utf8");

test("social profile view is integrated into the real Community public URL", () => {
  assert.match(page, /import "\.\/socialTraderProfile\.css"/);
  assert.match(page, /public-profile-cover-status/);
  assert.match(page, /public-profile-wall-compose/);
  assert.match(page, /Публічні статті та розбори/);
  assert.match(page, /tab === "articles" \? "articles"/);
  assert.match(page, /feedKey === "articles" \? "\?category=education"/);
  assert.match(page, /requestedKey === "articles" \? \{ category: "education" \}/);
  assert.match(skin, /grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
  assert.match(skin, /\.public-profile-cover-status/);
  assert.match(skin, /@media \(max-width:700px\)/);
});

test("article section uses only public educational posts and never social mock data", () => {
  assert.deepEqual(publicProfileDeepLink("?tab=articles"), { tab: "articles", postId: null, openChart: false });
  assert.equal(publicProfileDeepLink("?tab=hookchart").tab, "setups");
  assert.match(page, /tab === "articles" \? wall\.filter\(item => item\.category === "education"\)/);
  assert.match(page, /credentials: "omit", cache: "no-store"/);
  assert.match(page, /profile\.statistics \?/);
  assert.doesNotMatch(page, /INITIAL_PROFILES|INITIAL_ARTICLES|TRADING_ATLAS_PROFILE|fakeFollowers/);
});
