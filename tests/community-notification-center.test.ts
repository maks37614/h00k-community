import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  describeCommunityNotice,
  communityNoticeDestination,
  filterCommunityNotices,
  visibleCommunityNotices,
  unreadChatNotices,
  safeNoticeDate,
  unreadNoticeCount,
  type CommunityNotice,
} from "../src/components/community/notificationModel";

const alerts: CommunityNotice[] = [
  {
    id: "first",
    type: "risk",
    created_at: "2026-11-13T08:00:00Z",
    read_at: null,
    body: { window: "daily", used: "150", limit: "100", currency: "USDT" },
  },
  {
    id: "second",
    type: "security",
    created_at: "2026-11-12T08:00:00Z",
    read_at: "2026-11-12T09:00:00Z",
    body: { text: "Перевірте доступ до акаунта." },
  },
  {
    id: "third",
    type: "update",
    created_at: "not-a-date",
    read_at: null,
    body: { text: "Доступно нове повідомлення." },
  },
];

test("personal inbox separates unread and read entries without mutating the server list", () => {
  const original = alerts.slice();
  assert.equal(unreadNoticeCount(alerts), 2);
  assert.deepEqual(filterCommunityNotices(alerts, "unread").map((n) => n.id), ["first", "third"]);
  assert.deepEqual(filterCommunityNotices(alerts, "all").map((n) => n.id), ["first", "second", "third"]);
  assert.deepEqual(alerts, original);
  assert.equal(unreadNoticeCount([]), 0);
});

test("risk events explain the actual personal limit, without promising exchange order blocking", () => {
  const detail = describeCommunityNotice(alerts[0]);
  assert.equal(detail.title, "Особистий ліміт збитку");
  assert.equal(detail.isImportant, true);
  assert.match(detail.description, /150 \/ 100 USDT/);
  assert.match(detail.description, /не зупиняє торгівлю/);
  const missing = describeCommunityNotice({
    id: "no-details", type: "risk", created_at: "2026-11-13", body: null,
  });
  assert.match(missing.description, /Перевірте ліміти ризику/);
});

test("security and unknown events display only server-delivered user content", () => {
  const security = describeCommunityNotice(alerts[1]);
  assert.equal(security.title, "Безпека акаунта");
  assert.equal(security.isImportant, true);
  assert.equal(security.description, "Перевірте доступ до акаунта.");
  const generic = describeCommunityNotice(alerts[2]);
  assert.equal(generic.title, "Подія Community");
  assert.equal(generic.description, "Доступно нове повідомлення.");
  const malformed = describeCommunityNotice({
    id: "bad", type: "other", created_at: "", body: { text: { secret: "hidden" } },
  });
  assert.equal(malformed.description, "Нове сповіщення у вашій спільноті.");
});

test("dates do not crash the inbox for malformed timestamps", () => {
  assert.equal(safeNoticeDate("invalid"), "Час невідомий");
  assert.notEqual(safeNoticeDate("2026-11-13T10:00:00Z"), "Час невідомий");
});

test("notification inbox is an on-demand authenticated UI and uses existing personal API", () => {
  const component = readFileSync(
    new URL("../src/components/community/CommunityNotificationCenter.tsx", import.meta.url),
    "utf8",
  );
  const page = readFileSync(
    new URL("../src/components/community/CommunityPage.tsx", import.meta.url),
    "utf8",
  );
  const backend = readFileSync(
    new URL("../server/community/routes.ts", import.meta.url),
    "utf8",
  );
  assert.match(component, /apiJson\("\/api\/community\/notifications"\)/);
  assert.match(component, /onClick=\{toggle\}/);
  assert.match(component, /void refresh\(\)/);
  assert.match(component, /visibleCommunityNotices\(items, filter, showSocialNotices\)/);
  assert.match(component, /aria-pressed=\{filter === "unread"\}/);
  assert.match(component, /apiJson\("\/api\/community\/notifications\/" \+ encodeURIComponent\(id\) \+ "\/read"/);
  assert.match(component, /method: "POST"/);
  assert.match(component, /await apiJson\(/);
  assert.match(component, /setItems\(\(old\) =>/);
  assert.doesNotMatch(component, /setInterval\(|setTimeout\(|MOCK_NOTIFICATIONS|INITIAL_NOTICES/);
  assert.match(page, /<CommunityNotificationCenter/);
  assert.match(page, /key=\{user\.uid\}/);
  assert.match(backend, /SELECT \* FROM hc_notifications WHERE owner_id=\$1/);
  assert.match(backend, /UPDATE hc_notifications SET read_at=now\(\) WHERE id=\$1 AND owner_id=\$2/);
});

test("mobile and desktop notification panel is scoped to Community", () => {
  const css = readFileSync(
    new URL("../src/components/community/social-notification-center.css", import.meta.url),
    "utf8",
  );
  assert.match(css, /\.community-workspace \.community-notification-panel/);
  assert.match(css, /max-height: min\(74dvh, 680px\)/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /\.community-workspace \.community-notification-count/);
  assert.doesNotMatch(css, /^(?:html|body|\*)\s*\{/m);
});

test("social inbox classifies friend requests, accepted invites, comments and earned awards", () => {
  assert.equal(describeCommunityNotice({ id: "a", type: "friend_request", created_at: "" }).title, "Нова заявка у друзі");
  assert.equal(describeCommunityNotice({ id: "b", type: "friend_accepted", created_at: "" }).title, "Запит у друзі прийнято");
  assert.equal(describeCommunityNotice({ id: "c", type: "comment", created_at: "" }).title, "Нове обговорення");
  const award = describeCommunityNotice({
    id: "d", type: "award", created_at: "", body: { awardType: "thanks" },
  });
  assert.match(award.description, /Подяка/);
  assert.equal(award.isImportant, false);
  assert.doesNotMatch(award.description, /senderId|postId/);
});

test("notification actions accept only canonical internal destinations, never untrusted URLs", () => {
  assert.deepEqual(communityNoticeDestination({ id: "f", type: "friend_request", created_at: "" }),
    { section: "friends" });
  assert.deepEqual(communityNoticeDestination({ id: "a", type: "friend_accepted", created_at: "" }),
    { section: "friends" });
  const postId = "51c340e3-a176-4124-bd64-12896d96886a";
  assert.deepEqual(communityNoticeDestination({
    id: "p", type: "comment", created_at: "", body: { postId },
  }), { section: "feed", postId });
  assert.equal(communityNoticeDestination({
    id: "x", type: "comment", created_at: "", body: { postId: "javascript:alert(1)" },
  }), null);
  assert.equal(communityNoticeDestination({ id: "x", type: "security", created_at: "",
    body: { postId } }), null);
  assert.equal(communityNoticeDestination({ id: "x", type: "award", created_at: "",
    body: { postId } }), null);
});

test("social notification navigation uses actual Community feed/friends views and no external links", () => {
  const component = readFileSync(new URL("../src/components/community/CommunityNotificationCenter.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
  const backend = readFileSync(new URL("../server/community/routes.ts", import.meta.url), "utf8");
  assert.match(component, /communityNoticeDestination\(notice\)/);
  assert.match(component, /onNavigate\(destination\)/);
  assert.match(component, /community-notification-open/);
  assert.match(page, /onNavigate=\{\(destination\) =>/);
  assert.match(page, /params\.set\("post", destination\.postId\)/);
  assert.match(backend, /'friend_request'/);
  assert.match(backend, /'friend_accepted'/);
  assert.match(backend, /'comment'/);
  assert.match(backend, /ON CONFLICT\(dedup_key\) DO NOTHING/);
  assert.doesNotMatch(component, /window\.open\(|location\.href\s*=|dangerouslySetInnerHTML/);
});

test("chat inbox uses only member-scoped unread counts and never includes message bodies", () => {
  const a = "461389af-8e24-4537-afda-56b10b18ae00";
  const b = "3cd24f86-2a71-4a20-80bc-07a0917fb7be";
  const result = unreadChatNotices([
    { id: a, is_group: true, title: "Група крипто", unread_count: 4, text: "Секрет" },
    { id: b, is_group: false, peer_name: "Друг", unread_count: "2" },
    { id: "bad", is_group: false, unread_count: 9 },
    { id: "98e83729-c035-4509-b98a-630fb877603e", unread_count: 0 },
  ]);
  assert.deepEqual(result.map(chat => [chat.id,chat.count,chat.displayName]), [
    [a,4,"Група крипто"], [b,2,"Друг"],
  ]);
  assert.doesNotMatch(JSON.stringify(result), /Секрет/);
  assert.equal(unreadChatNotices(null).length, 0);
  assert.equal(unreadChatNotices([{ id: a, unread_count: Infinity }]).length, 0);
  assert.equal(unreadChatNotices([{ id: a, unread_count: 100000 }])[0].count, 100);
});

test("social display preferences hide only social activity, never risk and security events", () => {
  const rows = [
    { id: "friend", type: "friend_request", created_at: "", read_at: null },
    { id: "reply", type: "comment", created_at: "", read_at: null },
    { id: "award", type: "award", created_at: "", read_at: null },
    { id: "risk", type: "risk", created_at: "", read_at: null },
    { id: "security", type: "security", created_at: "", read_at: null },
  ];
  assert.deepEqual(visibleCommunityNotices(rows,"unread",false).map(item=>item.id),["risk","security"]);
  assert.equal(visibleCommunityNotices(rows,"all",true).length,5);
});

test("unread group chat links are on-demand, authorized and settings are saved", () => {
  const component=readFileSync(new URL("../src/components/community/CommunityNotificationCenter.tsx", import.meta.url),"utf8");
  const page=readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url),"utf8");
  const account=readFileSync(new URL("../server/community/account.ts", import.meta.url),"utf8");
  assert.match(component,/apiJson\("\/api\/community\/conversations"\)/);
  assert.match(component,/Promise\.allSettled\(/);
  assert.match(component,/unreadChatNotices\(conversations\.value\?\.items\)/);
  assert.match(component,/onNavigate\(\{ section: "chats", conversationId: chat\.id \}\)/);
  assert.doesNotMatch(component,/setInterval\(|setTimeout\(|new WebSocket\(/);
  assert.match(page,/params\.set\("conversation", destination\.conversationId\)/);
  assert.match(page,/conversations\.some\(chat => chat\.id === requestedConversationId\)/);
  assert.match(page,/notificationChatInbox: event\.target\.checked/);
  assert.match(page,/notificationSocialInbox: event\.target\.checked/);
  assert.match(account,/notificationChatInbox", "notificationSocialInbox"/);
  assert.match(account,/typeof raw\[key\] !== "boolean"/);
});
