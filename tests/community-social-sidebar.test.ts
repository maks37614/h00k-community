import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/components/community/CommunityPage.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/components/community/community.css', import.meta.url), 'utf8');
const concept = readFileSync(new URL('../src/components/community/CommunityConceptProfile.tsx', import.meta.url), 'utf8');
const conceptCss = readFileSync(new URL('../src/components/community/social-concept-layout.css', import.meta.url), 'utf8');

test('Community sidebar displays the authenticated user, not hardcoded mock traders', () => {
  assert.match(page, /className="community-sidebar"/);
  assert.match(page, /<CommunityConceptProfile/);
  assert.match(concept, /profile\?\.displayName \?\? user\?\.displayName/);
  assert.match(concept, /const currentStatus = profile\?\.community\?\.status/);
  assert.match(concept, /currentStatus\?\.text \?\? info\?\.status\?\.text/);
  assert.match(concept, /updateProfileData\(\{ community: \{ bio: value \} \}\)/);
  assert.match(concept, /status: \{ text: value, audience: currentStatus\?\.audience \?\? "private" \}/);
  assert.match(concept, /Змінити свій статус/);
  assert.match(concept, /Редагувати опис/);
  assert.match(concept, /apiJson\("\/api\/community\/awards"\)/);
  assert.match(page, /setViewProfile\(null\); setTab\("profile"\);/);
  assert.doesNotMatch(page, /TradingAtlas|INITIAL_PROFILES/);
});

test('feed context rail links to real Community actions only on the feed', () => {
  assert.match(page, /\{tab === "feed" && \(\s*<aside className="community-context-rail"/);
  for (const target of ['profile', 'friends', 'chats', 'settings']) {
    assert.match(page, new RegExp('setTab\\("' + target + '"\\)'));
  }
  assert.match(page, /className=\{"community-dashboard" \+ \(tab === "feed" \? " community-dashboard-feed" : ""\)\}/);
  assert.doesNotMatch(page, /friendsCount:\s*125|unreadMessagesCount=\{3\}/);
});

test('real profile sidebar and optional third column remain responsive', () => {
  assert.match(css, /\.community-workspace \.community-sidebar/);
  assert.match(css, /\.community-workspace \.community-sidebar-account/);
  assert.match(css, /\.community-workspace \.community-context-rail/);
  assert.match(css, /@media \(min-width: 1380px\)/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /\.community-dashboard-feed \.community-context-rail/);
  assert.match(conceptCss, /grid-template-columns: minmax\(248px, 350px\)/);
  assert.match(conceptCss, /\.community-concept-profile/);
  assert.match(conceptCss, /@media \(max-width: 1180px\)/);
});
