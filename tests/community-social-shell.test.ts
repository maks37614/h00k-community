import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/components/community/CommunityPage.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/components/community/community.css', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server/community/routes.ts', import.meta.url), 'utf8');

test('social-inspired Community shell retains its original live section handlers', () => {
  assert.match(page, /className="community-shell community-workspace"/);
  assert.match(page, /className="community-dashboard"/);
  assert.match(page, /className="community-main-pane"/);
  assert.match(page, /className="community-nav" aria-label="Розділи спільноти"/);
  for (const section of ['feed', 'chats', 'friends', 'profile', 'settings']) {
    assert.match(page, new RegExp('tab === "' + section + '"'));
  }
  assert.match(page, /apiJson\(/);
  assert.match(page, /setTab\(id\)/);
  assert.match(page, /<Feed/);
  assert.match(page, /<Chats/);
  assert.match(page, /<Profile/);
  assert.match(server, /route\("get", "\/feed"/);
  assert.match(server, /route\("get", "\/friends"/);
  assert.doesNotMatch(page, /INITIAL_PROFILES|INITIAL_POSTS|INITIAL_CHAT_MESSAGES/);
});

test('desktop sidebar and mobile rail use scoped styles without touching global charts', () => {
  assert.match(css, /\.community-shell\.community-workspace/);
  assert.match(css, /\.community-workspace \.community-dashboard/);
  assert.match(css, /\.community-workspace \.community-nav/);
  assert.match(css, /grid-template-columns: minmax\(216px, 265px\) minmax\(0, 1fr\)/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /flex-direction: row/);
  assert.match(css, /#00e5bf/);
});
