import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  conversationPreview, conversationPreviewTime,
  filterConversations, conversationDisplayTitle,
} from "../src/components/community/chatModel";
import { buildFriendDirectory } from "../src/components/community/friendsModel";
import { publicTraderAvatarPath } from "../server/community/profileNames";

const page = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
const routes = readFileSync(new URL("../server/community/routes.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/components/community/social-chat-messenger-parity.css", import.meta.url), "utf8");

const chat = page.slice(page.indexOf("function Chats({"), page.indexOf("\nfunction Trades("));
const friends = page.slice(page.indexOf("function Friends({"), page.indexOf("\nfunction Chats({"));

test("social-like inbox uses the last actual authorized message, never fabricated online/trade statuses", () => {
  const incoming = {
    id: "c1", peer_name: "Олена", last_message_text: "Привіт! BTC",
    last_message_created_at: "2026-11-14T12:00:00Z", last_message_mine: false,
  };
  const outgoing = { ...incoming, id: "c2", last_message_mine: true };
  const attachment = { ...incoming, id: "c3", last_message_text: "", last_message_mine: true };
  assert.equal(conversationPreview(incoming), "Привіт! BTC");
  assert.equal(conversationPreview(outgoing), "Ви: Привіт! BTC");
  assert.equal(conversationPreview(attachment), "Ви: Вкладення");
  assert.equal(conversationPreview({ id: "empty" }), "Особистий діалог");
  assert.equal(conversationPreview({ id: "group", is_group: true }), "Групова розмова");
  assert.equal(conversationDisplayTitle(incoming), "Олена");
  assert.deepEqual(filterConversations([incoming, outgoing], "олена").length, 2);
  assert.ok(conversationPreviewTime(incoming, new Date("2026-11-14T14:00:00Z")));
  assert.equal(conversationPreviewTime({ ...incoming, last_message_created_at: "bad" }), "");
  assert.doesNotMatch(page, /INITIAL_CHAT_MESSAGES|FAKE_ONLINE_STATUS/);
});

test("conversation API returns only member-scoped indexed previews and never scans market streams", () => {
  assert.match(routes, /last_message\.last_text/);
  assert.match(routes, /last_message\.last_sender=\$1/);
  assert.match(routes, /msg\.conversation_id=c\.id AND msg\.kind='message'/);
  assert.match(routes, /NOT msg\.deleted AND msg\.created_at>=m\.joined_at/);
  assert.match(routes, /ORDER BY msg\.created_at DESC,msg\.id DESC LIMIT 1/);
  assert.match(routes, /WHERE m\.user_id=\$1 ORDER BY c\.created_at DESC LIMIT 100/);
  assert.match(routes, /END AS peer_id/);
  assert.doesNotMatch(routes, /socket\.emit\("chat:preview"/);
});

test("friend search allows claimed @handle only with explicit public-profile permission", () => {
  assert.match(routes, /const search = q\.trim\(\)\.replace\(\/\^@\/, ""\)/);
  assert.match(routes, /LEFT JOIN hc_profile_names pn ON pn\.owner_id=u\.id/);
  assert.match(routes, /u\.profile->'community'->>'publicProfileEnabled'='true'/);
  assert.match(routes, /pn\.username ILIKE \$2/);
  assert.match(routes, /username: r\.username \?\? null/);
  assert.match(friends, /person\.username && <small className="community-friend-handle">@\{person\.username\}<\/small>/);
  const { rows } = buildFriendDirectory(
    [{ id: "a", displayName: "Олена", accepted: true, username: "olena" }],
    [{ id: "a", displayName: "fake", friend: false, username: null }],
  );
  assert.equal(rows[0].username, "olena");
  assert.equal(rows[0].isAccepted, true);
});

test("friends can accept, reject, cancel, open real profile and start a private chat", () => {
  assert.match(friends, /onChat: \(id: string, name: string\) => void/);
  assert.match(friends, /onChat\(person\.id, name\)/);
  assert.match(friends, /changeFriend\(person, "accept"\)/);
  assert.match(friends, /changeFriend\(person, "cancel"\)/);
  assert.match(friends, /changeFriend\(person, "remove"\)/);
  assert.match(friends, /changeFriend\(person, "send"\)/);
  assert.match(friends, /Відхилити/);
  assert.match(friends, /onProfile\(person\.id\)/);
  assert.match(friends, /pendingFriendId/);
  assert.match(page, /setChatInvite\(\{ id, name \}\)/);
  assert.match(chat, /chat\.peer_id === inviteTarget\.id/);
  assert.match(chat, /onInviteHandled\(\)/);
  assert.match(chat, /setMembers\(\[inviteTarget\.id\]\)/);
  assert.match(routes, /if \(!p\.accepted\.has\(id\) \|\| p\.blocked\.has\(id\)\)/);
});

test("inbox has live unread filtering, social bubble alignment and keyboard sending", () => {
  assert.match(chat, /filterConversations\(conversations, chatSearch\)/);
  assert.match(chat, /Number\(chat\.unread_count\) > 0/);
  assert.match(chat, /conversationPreview\(c\)/);
  assert.match(chat, /conversationPreviewTime\(c\)/);
  assert.match(chat, /onProfile=\{onProfile\}/);
  assert.match(page, /community-message-own/);
  assert.match(page, /community-message-other/);
  assert.match(page, /event\.currentTarget\.form\?\.requestSubmit\(\)/);
  assert.match(page, /!event\.nativeEvent\.isComposing/);
  assert.match(page, /Shift\+Enter — новий рядок/);
  assert.match(css, /\.community-workspace \.community-chat-thread > \.community-message-card\.community-message-own/);
  assert.match(css, /align-self:flex-end/);
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /font-size:16px/);
  assert.doesNotMatch(css, /(^|\n)\s*(html|body)\s*\{/);
});

test("only explicitly public profile avatars reach social friend and chat surfaces", () => {
  const person = {
    username: "maks",
    profile: { community: {
      publicProfileEnabled: true, avatarAudience: "public",
      avatarMediaId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    } },
  };
  assert.equal(publicTraderAvatarPath(person), "/api/public/profiles/maks/avatar");
  assert.equal(publicTraderAvatarPath({
    ...person, profile: { community: { ...person.profile.community, avatarAudience: "friends" } },
  }), null);
  assert.equal(publicTraderAvatarPath({
    ...person, profile: { community: { ...person.profile.community, publicProfileEnabled: false } },
  }), null);
  assert.equal(publicTraderAvatarPath({ ...person, username: null }), null);
  assert.equal(publicTraderAvatarPath({
    ...person, profile: { community: { ...person.profile.community, avatarMediaId: "javascript:alert(1)" } },
  }), null);
  assert.match(routes, /avatarUrl: publicTraderAvatarPath\(r\)/);
  assert.match(page, /person\.avatarUrl && <img src=\{person\.avatarUrl\}/);
  assert.match(chat, /const friendAvatar =/);
  assert.match(chat, /friendAvatar\(c\.peer_id\)/);
  assert.match(chat, /friendAvatar\(item\.owner_id\)/);
  assert.match(css, /\.community-workspace \.community-friend-avatar img/);
});
