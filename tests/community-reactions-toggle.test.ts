import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COMMUNITY_REACTION_CHOICES } from "../src/components/community/CommunityReactions";

const page = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
const component = readFileSync(new URL("../src/components/community/CommunityReactions.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/components/community/social-reactions.css", import.meta.url), "utf8");
const contentServer = readFileSync(new URL("../server/community/content.ts", import.meta.url), "utf8");
const routes = readFileSync(new URL("../server/community/routes.ts", import.meta.url), "utf8");

test("reactions share the server's supported set in posts and comments", () => {
  assert.deepEqual(COMMUNITY_REACTION_CHOICES, ["👍", "❤️", "🔥", "🤔", "👏"]);
  assert.match(page, /<CommunityReactions/);
  assert.match(page, /itemId=\{item\.id\}/);
  assert.match(page, /itemId=\{comment\.id\}/);
  assert.match(page, /refresh=\{thread\.refresh\}/);
  assert.match(page, /variant="comment"/);
});

test("reaction buttons expose selected state and avoid duplicate rapid requests", () => {
  assert.match(component, /const \[busy, setBusy\] = useState\(false\)/);
  assert.match(component, /if \(busy\) return/);
  assert.match(component, /\.finally\(\(\) => setBusy\(false\)\)/);
  assert.match(component, /aria-pressed=\{pressed\}/);
  assert.match(component, /Прибрати реакцію/);
  assert.match(component, /itemId\) \+ "\/reaction"/);
  assert.match(css, /community-reaction-active/);
  assert.match(css, /@media \(max-width: 700px\)/);
});

test("reaction API includes viewer's selection without exposing other viewers' IDs", () => {
  assert.match(contentServer, /bool_or\(user_id=\$2\)::boolean AS mine/);
  assert.match(routes, /SELECT emoji FROM hc_reactions WHERE item_id=\$1 AND user_id=\$2/);
  assert.match(routes, /DELETE FROM hc_reactions WHERE item_id=\$1 AND user_id=\$2 AND emoji=\$3/);
  assert.match(routes, /ON CONFLICT\(item_id,user_id\) DO UPDATE SET emoji=excluded\.emoji/);
  assert.match(routes, /if \(!\(await p\.visible\(item\)\)/);
  assert.match(routes, /limits\.take\("reaction:" \+ a\.id, 100\)/);
  assert.doesNotMatch(contentServer, /reactionUserEmail|reactionUserIds/);
});
