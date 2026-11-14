import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  publicChartGalleryUrl,
  publicChartPostUrl,
  publicPostUrl,
  publicProfileDeepLink,
} from "../src/community/publicProfileViewModel";

const id = "5374264b-c679-40e4-918f-1ef1f187684c";
const site = "https://community-stage.h00k.top/u/maks";

test("public HookChart links round-trip a valid post ID and an explicit chart view", () => {
  const chartUrl = new URL(publicChartPostUrl(site, id));
  assert.equal(chartUrl.origin, "https://community-stage.h00k.top");
  assert.equal(chartUrl.pathname, "/u/maks");
  assert.deepEqual(publicProfileDeepLink(chartUrl.search), {
    tab: "setups", postId: id, openChart: true,
  });
  assert.deepEqual(publicProfileDeepLink("?post=" + id), {
    tab: "wall", postId: id, openChart: false,
  });
  assert.deepEqual(publicProfileDeepLink("?tab=hookchart"), {
    tab: "setups", postId: null, openChart: false,
  });
  assert.equal(publicPostUrl(site,id),site + "?post=" + id);
});

test("malformed post links never automatically load arbitrary chart IDs or URLs", () => {
  assert.deepEqual(publicProfileDeepLink("?tab=hookchart&view=chart&post=javascript:alert(1)"), {
    tab: "setups", postId: null, openChart: false,
  });
  assert.deepEqual(publicProfileDeepLink("?tab=bogus&view=chart&post=" + id), {
    tab: "wall", postId: id, openChart: false,
  });
  assert.deepEqual(publicProfileDeepLink("?tab=hookchart&post=" + id), {
    tab: "setups", postId: id, openChart: false,
  });
  assert.deepEqual(publicProfileDeepLink("?tab=about"), {
    tab: "about", postId: null, openChart: false,
  });
  assert.throws(() => publicChartPostUrl(site,"not-a-uuid"));
  assert.throws(() => publicChartPostUrl("javascript:alert(1)",id));
  assert.throws(() => publicChartGalleryUrl("https://user:password@community-stage.h00k.top/u/maks"));
});

test("the gallery share link removes old post/view query parameters, keeping only a public tab", () => {
  const gallery = new URL(publicChartGalleryUrl(site + "?post=" + id + "&view=chart"));
  assert.equal(gallery.pathname, "/u/maks");
  assert.equal(gallery.searchParams.get("tab"), "hookchart");
  assert.equal(gallery.searchParams.has("post"), false);
  assert.equal(gallery.searchParams.has("view"), false);
  assert.equal(publicProfileDeepLink(gallery.search).openChart,false);
});

test("chart navigation loads each saved snapshot through the authorization-checked endpoint", () => {
  const view = readFileSync(new URL("../src/community/publicProfile.tsx",import.meta.url),"utf8");
  const api = readFileSync(new URL("../server/community/publicProfiles.ts",import.meta.url),"utf8");
  const css = readFileSync(new URL("../src/community/publicProfileConcept.css",import.meta.url),"utf8");
  assert.match(view,/publicProfileDeepLink\(location\.search\)\.tab/);
  assert.match(view,/if \(feedKey === "wall:all"\) return/);
  assert.match(view,/initialLink\.openChart/);
  assert.match(view,/read\(base \+ "\/posts\/" \+ encodeURIComponent\(linkedPostId\) \+ "\/chart"/);
  assert.match(view,/setChartPostId\(linkedPostId\)/);
  assert.match(view,/setChartPostId\(id\)/);
  assert.match(view,/publicChartPostUrl\(profile\.url, item\.id\)/);
  assert.match(view,/publicChartGalleryUrl\(profile\.url\)/);
  assert.match(view,/aria-label="Попередній публічний HookChart"/);
  assert.match(view,/aria-label="Наступний публічний HookChart"/);
  assert.match(view,/previousChartId && void openChart\(previousChartId\)/);
  assert.match(view,/followingChartId && void openChart\(followingChartId\)/);
  assert.match(view,/publicPostUrl\(profile\.url, chartPostId\)/);
  assert.match(view,/setChart\(null\); setChartPostId\(null\)/);
  assert.match(api,/route\("\/posts\/:id\/chart"/);
  assert.match(api,/await publicPost\(db, rules, owner\.id, req\.params\.id\)/);
  assert.match(css,/\.public-profile-chart-navigation-move/);
  assert.match(css,/@media\(max-width:670px\)/);
  assert.doesNotMatch(view,/new WebSocket\(|api\/exchange\/|directExchangeClient/);
});
