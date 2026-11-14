import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
const style = readFileSync(new URL("../src/community/publicProfileConcept.css", import.meta.url), "utf8");
const api = readFileSync(new URL("../server/community/publicProfiles.ts", import.meta.url), "utf8");

test("mobile HookChart uses one view and a keyboard-accessible full viewport mode", () => {
  assert.match(page, /const \[chartExpanded, setChartExpanded\] = useState\(false\)/);
  assert.match(page, /chartWorkspaceRef = useRef<HTMLElement \| null>\(null\)/);
  assert.match(page, /public-profile-workspace-expanded/);
  assert.match(page, /role=\{chartExpanded \? "dialog" : undefined\}/);
  assert.match(page, /aria-modal=\{chartExpanded \? true : undefined\}/);
  assert.match(page, /aria-labelledby="public-chart-workspace-title"/);
  assert.match(page, /ref=\{chartExpandButtonRef\} aria-expanded=\{chartExpanded\}/);
  assert.match(page, /\{chartExpanded \? "Згорнути" : "На весь екран"\}/);
  assert.match(page, /event\.key === "Escape"/);
  assert.match(page, /event\.key === "Tab"/);
  assert.match(page, /chartExpandButtonRef\.current\?\.focus\(\)/);
  assert.match(page, /document\.body\.style\.overflow = "hidden"/);
  assert.match(page, /document\.body\.style\.overflow = oldOverflow/);
  assert.match(page, /document\.removeEventListener\("keydown", onKeyDown\)/);
  assert.equal((page.match(/<HookChart value=\{chart\} onChange=\{setChart\}/g) ?? []).length, 1,
    "full-screen mode should not double-render a heavy chart engine");
  assert.match(style, /\.public-profile-workspace-expanded\s*\{/);
  assert.match(style, /position:fixed;z-index:1100;inset:0/);
  assert.match(style, /height:100dvh/);
  assert.match(style, /env\(safe-area-inset-top\)/);
  assert.match(style, /@media\(orientation:landscape\) and \(max-height:480px\)/);
});

test("opening chart discussion retrieves the exact public post before revealing its comments", () => {
  assert.match(page, /const openChartDiscussion = async \(id: string\) =>/);
  assert.match(page, /const result = await read\(base \+ "\/posts\/" \+ encodeURIComponent\(id\)\)/);
  assert.match(page, /setFocusedPost\(result\.item\)/);
  assert.match(page, /setTab\("wall"\)/);
  assert.match(page, /setPostCategory\("all"\)/);
  assert.match(page, /setExpandedComments\(id\)/);
  assert.match(page, /if \(!comments\[id\]\) void loadComments\(id\)/);
  assert.match(page, /void openChartDiscussion\(chartPostId\)/);
  assert.match(page, /Переглянути обговорення/);
  assert.match(page, /document\.getElementById\("public-comments-" \+ expandedComments\)\?\.scrollIntoView/);
  assert.match(page, /communityPostUrl\(profile\.communityOrigin, item\.id\)/);
  assert.match(page, /chartExpanded \? " public-profile-workspace-expanded"/);
  assert.match(api, /route\("\/posts\/:id", async/);
  assert.match(api, /route\("\/posts\/:id\/comments", async/);
  assert.match(api, /await publicPost\(db, rules, owner\.id, req\.params\.id\)/);
  assert.doesNotMatch(page, /new WebSocket\(|directExchangeClient|fakeComments/);
});
