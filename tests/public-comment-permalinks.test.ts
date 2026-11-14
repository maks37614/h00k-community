import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { publicCommentIdFromSearch, publicCommentUrl } from "../src/community/publicProfileViewModel";

const site = "https://community-stage.h00k.top/u/maks";
const post = "5374264b-c679-40e4-918f-1ef1f187684c";
const comment = "d0733af5-698c-4f16-a4ca-79c3c7f489ee";

test("guest comment links are canonical, independent of chart mode and only accept UUID pairs", () => {
  const direct = new URL(publicCommentUrl(site+"?tab=hookchart&view=chart", post, comment));
  assert.equal(direct.origin, "https://community-stage.h00k.top");
  assert.equal(direct.pathname, "/u/maks");
  assert.equal(direct.searchParams.get("post"), post);
  assert.equal(direct.searchParams.get("comment"), comment);
  assert.equal(direct.searchParams.has("view"), false);
  assert.equal(direct.searchParams.has("tab"), false);
  assert.equal(publicCommentIdFromSearch(direct.search), comment);
  assert.equal(publicCommentIdFromSearch("?comment=" + comment), null);
  assert.equal(publicCommentIdFromSearch("?post=" + post + "&view=chart&comment=" + comment), null);
  assert.equal(publicCommentIdFromSearch("?post=" + post + "&comment=javascript%3Aalert%281%29"), null);
  assert.throws(() => publicCommentUrl(site, post, "nope"));
  assert.throws(() => publicCommentUrl("javascript:alert(1)", post, comment));
  assert.throws(() => publicCommentUrl("https://intruder@h00k.top/u/maks", post, comment));
});

test("read-only comment links use a privacy-checked API and keep older linked comments visible", () => {
  const api = readFileSync(new URL("../server/community/publicProfiles.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
  const style = readFileSync(new URL("../src/community/publicProfileConcept.css", import.meta.url), "utf8");
  assert.match(api, /route\("\/posts\/:id\/comments\/:comment"/);
  assert.match(api, /const parent = await publicPost\(db, rules, owner\.id, req\.params\.id\)/);
  assert.match(api, /c\.id=\$1 AND c\.parent_id=\$2 AND c\.kind='comment' AND c\.audience='public'/);
  assert.match(api, /await rules\.visible\(comment\)/);
  assert.match(api, /await rules\.canReadChart\(comment\.chart_id\)/);
  assert.match(api, /publicCommentCard\(db, rules, comment, parent\.id\)/);
  assert.match(page, /publicCommentIdFromSearch\(navigationSearch\)/);
  assert.match(page, /setFocusedCommentId\(result\.item\.id\)/);
  assert.match(page, /setExpandedComments\(linkedPostId\)/);
  assert.match(page, /linkedCommentId && linkedPostId === id/);
  assert.match(page, /publicCommentUrl\(profile\.url, postId, commentId\)/);
  assert.match(page, /Коментар за посиланням/);
  assert.match(page, /Поділитися коментарем/);
  assert.match(page, /public-comment-".*focusedCommentId/s);
  assert.match(style, /\.public-profile-comment-focused/);
  assert.match(style, /@media\(max-width:670px\)/);
  assert.doesNotMatch(page, /new WebSocket\(|fakeComments|mockReplies/);
});
