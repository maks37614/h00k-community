import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sidebar = readFileSync(new URL("../src/components/community/CommunityConceptProfile.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/components/community/social-mobile-articles-parity.css", import.meta.url), "utf8");

test("real social sidebar shows only accepted friends, never guessed online indicators", () => {
  assert.match(sidebar, /apiJson\("\/api\/community\/friends"\)/);
  assert.match(sidebar, /friend\.accepted === true/);
  assert.match(sidebar, /setFriendRows\(accepted\)/);
  assert.match(sidebar, /friendRows\.slice\(0, 6\)/);
  assert.match(sidebar, /person\.avatarUrl && <img src=\{person\.avatarUrl\}/);
  assert.match(sidebar, /person\.username && <small>@\{person\.username\}<\/small>/);
  assert.match(sidebar, /onFriendProfile\(person\.id\)/);
  assert.match(sidebar, /onFriendChat\(person\.id, person\.displayName \|\| "Трейдер"\)/);
  assert.doesNotMatch(sidebar, /isOnline|FAKE_ONLINE|friend\.status === "online"/);
});

test("friend card and profile changes refresh left sidebar without adding polling", () => {
  assert.match(sidebar, /window\.addEventListener\("community:friends-changed", refresh\)/);
  assert.match(sidebar, /window\.removeEventListener\("community:friends-changed", refresh\)/);
  assert.match(sidebar, /\[user\?\.uid, version, friendVersion\]/);
  assert.match(page, /onFriendProfile=\{id => \{ setViewProfile\(id\); setTab\("profile"\); \}\}/);
  assert.match(page, /<CommunityConceptProfile\s+key=\{user\.uid\}/);
  assert.match(page, /onFriendChat=\{\(id, name\) => \{/);
  assert.match(page, /window\.dispatchEvent\(new Event\("community:friends-changed"\)\)/);
  assert.doesNotMatch(sidebar, /setInterval\(|new WebSocket\(|new EventSource\(/);
});

test("social friend shortcut block remains responsive and scoped to Community", () => {
  assert.match(sidebar, /className="community-concept-sidebar-section community-concept-friend-shortcuts"/);
  assert.match(sidebar, /className="community-concept-friends-list"/);
  assert.match(sidebar, /className="community-concept-friend-message"/);
  assert.match(css, /\.community-workspace \.community-concept-friend-row/);
  assert.match(css, /\.community-workspace \.community-concept-friend-avatar img/);
  assert.match(css, /\.community-workspace \.community-concept-friend-message:hover/);
  assert.doesNotMatch(css, /(^|\n)\s*(html|body)\s*\{/);
});
