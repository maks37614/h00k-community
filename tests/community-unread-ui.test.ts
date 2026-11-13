import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
const style = readFileSync(new URL("../src/components/community/social-chat-workspace.css", import.meta.url), "utf8");
const routes = readFileSync(new URL("../server/community/routes.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../server/community/schema.sql", import.meta.url), "utf8");

test("unread indicators poll only visible Community and avoid server broadcasts", () => {
  assert.match(page, /api \+ "\/conversations\/unread"/);
  assert.match(page, /setInterval\(refresh, 60000\)/);
  assert.match(page, /document\.visibilityState !== "visible"/);
  assert.match(page, /community:chat-read/);
  assert.match(page, /className="community-chat-unread-shortcut"/);
  assert.match(page, /className="community-chat-unread-count"/);
  assert.match(page, /Number\(c\.unread_count\)/);
  assert.match(style, /\.community-workspace \.community-chat-unread-count/);
  assert.match(style, /@media\(max-width:700px\)/);
  assert.doesNotMatch(page, /new WebSocket\(|new EventSource\(/);
});

test("only observed messages are marked read and read requests are deduplicated", () => {
  const chats = page.split("function Chats({")[1]?.split("function Trades(")[0] ?? "";
  assert.ok(chats);
  assert.match(chats, /acknowledged\.current\.get\(conversationId\) === messageId/);
  assert.match(chats, /reading\.current\.has\(conversationId\)/);
  assert.match(chats, /\/read", \{ messageId \}/);
  assert.match(chats, /!older && document\.visibilityState === "visible" && stayAtBottom\.current/);
  assert.match(chats, /if \(stayAtBottom\.current && document\.visibilityState === "visible"\)/);
  assert.match(chats, /setInterval\(pull, 12000\)/);
  assert.match(chats, /window\.dispatchEvent\(new Event\("community:chat-read"\)\)/);
});

test("unread API is a membership-scoped cursor with capped indexed counts", () => {
  assert.match(schema, /ALTER TABLE hc_members ADD COLUMN IF NOT EXISTS last_read_message_id uuid/);
  assert.match(schema, /CREATE INDEX IF NOT EXISTS hc_messages_unread/);
  assert.match(routes, /route\("get", "\/conversations\/unread"/);
  assert.match(routes, /route\("post", "\/conversations\/:id\/read"/);
  assert.match(routes, /msg\.owner_id<>\$1/);
  assert.match(routes, /msg\.created_at>=m\.joined_at/);
  assert.match(routes, /m\.last_read_message_id IS NULL/);
  assert.match(routes, /LIMIT 100/);
  assert.match(routes, /SELECT joined_at FROM hc_members WHERE conversation_id=\$1 AND user_id=\$2 FOR UPDATE/);
  assert.match(routes, /newer\.created_at,newer\.id/);
});

test("muted chats keep their unread bubbles but are excluded from notification aggregates", () => {
  assert.match(schema, /ALTER TABLE hc_members ADD COLUMN IF NOT EXISTS muted boolean NOT NULL DEFAULT false/);
  assert.match(routes, /route\("post", "\/conversations\/:id\/mute"/);
  assert.match(routes, /typeof req\.body\?\.muted !== "boolean"/);
  assert.match(routes, /UPDATE hc_members SET muted=\$3/);
  assert.match(routes, /WHERE conversation_id=\$1 AND user_id=\$2 RETURNING muted/);
  assert.match(routes, /AND NOT m\.muted AND \$\{unreadPredicate\}/);
  assert.match(routes, /SELECT c\.\*,m\.role,m\.muted/);
  assert.match(page, /className="community-chat-mute-toggle"/);
  assert.match(page, /currentConversation\.muted === true/);
  assert.match(page, /community:chat-muted/);
  assert.match(page, /Без звуку/);
  assert.match(page, /Number\(c\.unread_count\) > 0/);
  assert.match(style, /\.community-chat-mute-toggle\[aria-pressed="true"\]/);
});
