import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/components/community/CommunityPage.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/components/community/community.css', import.meta.url), 'utf8');

test('social feed visuals preserve live public/friends requests, real posts and mutations', () => {
  assert.match(page, /className="community-feed-view"/);
  assert.match(page, /community-feed-heading/);
  assert.match(page, /community-post-card/);
  assert.match(page, /community-composer-"\s*\+\s*target\.kind/);
  assert.match(page, /onClick=\{\(\) => setMode\("friends"\)\}/);
  assert.match(page, /onClick=\{\(\) => setMode\("public"\)\}/);
  assert.match(page, /mode === "saved" \? "\/saved\?" : "\/feed\?"/);
  assert.match(page, /onClick=\{\(\) => \{ setCategory\("all"\); setMode\("saved"\); \}\}/);
  assert.match(page, /<CommunityReactions/);
  assert.match(page, /item\.body\?\.text/);
  assert.match(page, /item\.author\?\.displayName/);
  assert.match(page, /<ChartPreview/);
  assert.match(page, /<Composer/);
  assert.doesNotMatch(page, /INITIAL_POSTS|INITIAL_PROFILES|INITIAL_CHAT_MESSAGES/);
});

test('profile visuals read from account API without demo statistics, preserve audience and editing', () => {
  assert.match(page, /community-profile-hero/);
  assert.match(page, /community-profile-cover/);
  assert.match(page, /p\.displayName \?\? "Трейдер"/);
  assert.match(page, /p\.status\?\.text/);
  assert.match(page, /typeof p\.points === "number"/);
  assert.match(page, /не торговий рейтинг/);
  assert.match(page, /p\.publicUrl/);
  assert.match(page, /community-profile-editor/);
  assert.match(page, /await updateProfileData\(\{ displayName, community: fields \}\)/);
  assert.match(page, /apiJson\(api \+ "\/profiles\/" \+ id\)/);
  assert.match(page, /apiJson\(api \+ "\/feed\?mode=wall&owner=" \+ id\)/);
  assert.match(page, /<PublicProfileSettings/);
  assert.match(page, /<Trades owner=\{id\} run=\{run\}/);
  assert.doesNotMatch(page, /TradingAtlas|INITIAL_PROFILES/);
});

test('chat visuals retain real conversations, group creation, pagination and message delivery', () => {
  assert.match(page, /className="community-chat-layout"/);
  assert.match(page, /className="community-chat-list"/);
  assert.match(page, /className="community-chat-panel"/);
  assert.match(page, /apiJson\(api \+ "\/conversations"\)/);
  assert.match(page, /post\(api \+ "\/conversations"/);
  assert.match(page, /target=\{\{ kind: "message", conversationId: id \}\}/);
  assert.match(page, /setInterval\(pull, 5000\)/);
  assert.match(page, /className=\{"community-composer community-composer-" \+ target\.kind\}/);
});

test('feed profile chat design is scoped and mobile adaptive', () => {
  for (const selector of [
    '.community-feed-view', '.community-post-card', '.community-profile-hero',
    '.community-profile-cover', '.community-profile-meta', '.community-chat-list',
    '.community-chat-panel',
  ]) assert.ok(css.includes(selector), selector);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /#00e5bf/);
  assert.doesNotMatch(css, /\bhtml\s*\{|\bbody\s*\{/);
});
