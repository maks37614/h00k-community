import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filterConversations } from "../src/components/community/chatModel";

const page = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
const style = readFileSync(new URL("../src/components/community/social-chat-workspace.css", import.meta.url), "utf8");

test("conversation search is local, case insensitive and does not mutate conversations", () => {
  const conversations = [
    { id: "1", title: "Лондонські трейдери", is_group: true },
    { id: "2", title: "Private BTC", is_group: false },
    { id: "3", title: null, is_group: false },
  ];
  assert.deepEqual(filterConversations(conversations, " лОНдон "), [conversations[0]]);
  assert.deepEqual(filterConversations(conversations, "BTC"), [conversations[1]]);
  assert.deepEqual(filterConversations(conversations, "none"), []);
  assert.deepEqual(filterConversations(conversations, ""), conversations);
  assert.deepEqual(conversations.map((v) => v.id), ["1", "2", "3"]);
});

test("live chat UI keeps authenticated conversations and API-backed messages", () => {
  const chat = page.split("function Chats({")[1]?.split("function Trades(")[0] ?? "";
  assert.ok(chat, "Chats component must exist");
  assert.match(chat, /apiJson\(api \+ "\/conversations"\)/);
  assert.match(chat, /api \+\s*"\/conversations\/" \+/);
  assert.match(chat, /post\(api \+ "\/conversations"/);
  assert.match(chat, /filterConversations\(conversations, chatSearch\)/);
  assert.match(chat, /aria-label="Список розмов"/);
  assert.match(chat, /aria-label="Повідомлення розмови"/);
  assert.match(chat, /className="community-chat-active-header"/);
  assert.match(chat, /className="community-chat-thread"/);
  assert.match(chat, /className="community-chat-list"/);
  assert.match(chat, /className="community-chat-panel"/);
  assert.match(chat, /target=\{\{ kind: "message", conversationId: id \}\}/);
  assert.match(chat, /setInterval\(pull, 5000\)/);
  assert.match(chat, /stayAtBottom = useRef\(true\)/);
  assert.match(chat, /restoreOlderOffset = useRef<number \| null>\(null\)/);
  assert.match(chat, /useLayoutEffect\(\(\) => \{/);
  assert.match(chat, /className="community-chat-jump"/);
  assert.match(chat, /ref=\{threadRef\}/);
  assert.match(chat, /onScroll=\{\(event\) => \{/);
  assert.match(chat, /setName\(""/);
  assert.match(chat, /setChatSearch\(""/);
  assert.doesNotMatch(chat, /INITIAL_CHAT_MESSAGES|mockData|unreadCount\s*=\s*2/);
});

test("chat styles keep full conversation titles and responsive composer visible", () => {
  assert.match(style, /\.community-workspace \.community-chat-layout/);
  assert.match(style, /\.community-workspace \.community-chat-channels/);
  assert.match(style, /\.community-workspace \.community-chat-active-header/);
  assert.match(style, /\.community-workspace \.community-chat-thread/);
  assert.match(style, /\.community-workspace \.community-chat-panel \.community-composer-message/);
  assert.match(style, /\.community-workspace \.community-chat-jump/);
  assert.match(style, /@media \(max-width: 700px\)/);
  assert.match(style, /font-size: 16px !important/);
  assert.doesNotMatch(style, /(^|\n)\s*(html|body)\s*\{/);
});
