import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/components/community/social-profile-actions.css", import.meta.url), "utf8");
const routes = readFileSync(new URL("../server/community/routes.ts", import.meta.url), "utf8");

test("other trader profile loads accepted and pending friendships from its real server route", () => {
  assert.match(page, /apiJson\(api \+ "\/friends"\)/);
  assert.match(page, /"profile-friends:" \+ id \+ ":" \+ user\?\.uid/);
  assert.match(page, /const relation = friends\?\.find\(\(person\) => person\.id === id\)/);
  assert.match(page, /relation\?\.accepted/);
  assert.match(page, /relation\?\.incoming/);
  assert.match(page, /Вхідний запит дружби/);
  assert.match(page, /Очікується відповідь/);
  assert.match(page, /Прийняти запит/);
  assert.match(page, /Відкликати запит/);
  assert.match(page, /Додати в друзі/);
  assert.match(page, /Видалити з друзів/);
  assert.match(page, /id !== user\?\.uid && p &&/);
  assert.match(page, /friendships\.refresh\(\)/);
});

test("friend changes reuse protected API and do not create dialogs for strangers", () => {
  assert.match(page, /await post\(api \+ "\/friends\/" \+ id, \{\}\)/);
  assert.match(page, /await apiJson\(api \+ "\/friends\/" \+ id, \{ method: "DELETE" \}\)/);
  assert.match(page, /onChatInvite\(id, p\.displayName \?\? "Трейдер"\)/);
  assert.match(page, /onChatInvite: \(id: string, name: string\) => void/);
  assert.match(routes, /route\("get", "\/friends"/);
  assert.match(routes, /"post",\s*\n\s*"\/friends\/:id"/);
  assert.match(routes, /if \(!p\.accepted\.has\(id\) \|\| p\.blocked\.has\(id\)\)/);
  assert.doesNotMatch(page, /INITIAL_PROFILES|MOCK_RELATIONS|FAKE_FRIEND_COUNT/);
});

test("profile messaging preselects one friend but needs user confirmation before creating conversation", () => {
  assert.match(page, /const \[chatInvite, setChatInvite\] = useState<ChatInvite \| null>\(null\)/);
  assert.match(page, /setChatInvite\(\{ id, name \}\)/);
  assert.match(page, /setTab\("chats"\)/);
  assert.match(page, /inviteTarget=\{chatInvite\}/);
  assert.match(page, /open=\{createOpen\}/);
  assert.match(page, /onToggle=\{\(event\) => setCreateOpen\(event\.currentTarget\.open\)\}/);
  assert.match(page, /setMembers\(\[inviteTarget\.id\]\)/);
  assert.match(page, /setName\("Діалог із " \+ inviteTarget\.name\)/);
  assert.match(page, /Підтвердіть створення розмови/);
  assert.match(page, /disabled=\{!members\.length\}/);
  assert.match(page, /const d = await post\(api \+ "\/conversations", \{/);
  assert.match(page, /onInviteHandled\(\)/);
});

test("new profile and invitation UI is responsive and does not edit global chart CSS", () => {
  assert.match(page, /import "\.\/social-profile-actions\.css"/);
  assert.match(page, /className="community-profile-connect"/);
  assert.match(page, /className="community-chat-invite-notice"/);
  assert.match(css, /\.community-workspace \.community-profile-connect/);
  assert.match(css, /\.community-workspace \.community-chat-invite-notice/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.doesNotMatch(css, /^\s*body\s*\{|^\s*html\s*\{/m);
});
