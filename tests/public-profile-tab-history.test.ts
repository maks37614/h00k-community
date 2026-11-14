import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  publicProfileTabUrl, publicProfileCategoryUrl, publicProfileCategoryFromSearch,
  publicProfileDeepLink, publicCommentIdFromSearch,
} from "../src/community/publicProfileViewModel";

const post = "cb59d0d9-bacf-4dce-b1c1-9876e70078d1";
const comment = "a4d2ee6b-7ca0-4762-9aa8-588c89be909a";
const profile = "https://community-stage.h00k.top/u/maks";

test("all public trader tabs have stable shareable URLs, including HookChart", () => {
  const old = profile + "?tab=articles&post=" + post + "&comment=" + comment + "&view=chart&category=idea";
  assert.equal(publicProfileTabUrl(old, "wall"), profile);
  assert.equal(publicProfileTabUrl(old, "articles"), profile + "?tab=articles");
  assert.equal(publicProfileTabUrl(old, "setups"), profile + "?tab=hookchart");
  assert.equal(publicProfileTabUrl(old, "statistics"), profile + "?tab=statistics");
  assert.equal(publicProfileTabUrl(old, "about"), profile + "?tab=about");
  assert.equal(publicProfileTabUrl(publicProfileTabUrl(old, "setups"), "setups"), profile + "?tab=hookchart");
  assert.equal(publicProfileDeepLink("?tab=hookchart").tab, "setups");
  assert.equal(publicProfileDeepLink("?tab=articles").tab, "articles");
  assert.equal(publicCommentIdFromSearch(new URL(publicProfileTabUrl(old, "wall")).search), null);
  assert.throws(() => publicProfileTabUrl("javascript:alert(1)", "wall"));
  assert.throws(() => publicProfileTabUrl("https://hacker@community-stage.h00k.top/u/maks", "wall"));
});

test("wall categories have canonical URLs and ignore invalid category input", () => {
  assert.equal(publicProfileCategoryFromSearch("?category=idea"), "idea");
  assert.equal(publicProfileCategoryFromSearch("?category=education"), "education");
  assert.equal(publicProfileCategoryFromSearch("?category=analysis"), "analysis");
  for (const bad of ["", "?category=invalid", "?category=../private", "?tab=statistics"]) {
    assert.equal(publicProfileCategoryFromSearch(bad), "all");
  }
  assert.equal(publicProfileCategoryUrl(profile + "?tab=hookchart&post=" + post, "all"), profile);
  assert.equal(publicProfileCategoryUrl(profile + "?tab=articles&post=" + post, "education"),
    profile + "?category=education");
  assert.equal(publicProfileDeepLink(new URL(publicProfileCategoryUrl(profile, "analysis")).search).tab, "wall");
});

test("profile page pushes user-tab selection and restores real deep links on back-forward without fake feeds", () => {
  const view = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
  const publicApi = readFileSync(new URL("../server/community/publicProfiles.ts", import.meta.url), "utf8");
  assert.match(view, /const \[navigationSearch, setNavigationSearch\] = useState/);
  assert.match(view, /const initialLink = publicProfileDeepLink\(navigationSearch\)/);
  assert.match(view, /const linkedCommentId = publicCommentIdFromSearch\(navigationSearch\)/);
  assert.match(view, /history\.pushState\(null, "", next\)/);
  assert.match(view, /window\.addEventListener\("popstate", onBackForward\)/);
  assert.match(view, /window\.removeEventListener\("popstate", onBackForward\)/);
  assert.match(view, /setFocusedPost\(null\)/);
  assert.match(view, /setChartPostId\(null\)/);
  assert.match(view, /const navigateProfile = \(section: PublicTab, category: PublicPostCategory = "all"\)/);
  assert.match(view, /onClick=\{\(\) => navigateProfile\("articles"\)\}/);
  assert.match(view, /onClick=\{\(\) => navigateProfile\("setups"\)\}/);
  assert.match(view, /onClick=\{\(\) => navigateProfile\("statistics"\)\}/);
  assert.match(view, /onClick=\{\(\) => navigateProfile\("about"\)\}/);
  assert.match(view, /navigateProfile\("wall", id\)/);
  assert.match(view, /read\(base \+ "\/posts\/" \+ encodeURIComponent\(linkedPostId\)/);
  assert.match(view, /base \+ "\/posts\/" \+ encodeURIComponent\(linkedPostId\) \+ "\/chart"/);
  assert.match(publicApi, /await rules\.visible\(row\)/);
  assert.match(publicApi, /await rules\.canReadChart\(row\.chart_id\)/);
  assert.doesNotMatch(view, /MOCK_TABS|FAKE_COMMENTS|INITIAL_TRADERS/);
});
