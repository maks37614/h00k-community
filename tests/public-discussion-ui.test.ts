import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const view = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../server/community/publicProfiles.ts", import.meta.url), "utf8");
const settings = readFileSync(new URL("../src/components/community/PublicProfileSettings.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/community/publicProfileConcept.css", import.meta.url), "utf8");

test("public profile groups quote-linked comments instead of displaying only a flat feed", () => {
  assert.match(view, /groupPublicComments\(items\)/);
  assert.match(view, /<PublicCommentThreads items=\{comments\[item\.id\]\?\.items \?\? \[\]\}/);
  assert.match(view, /className="public-profile-comment-thread-reply"/);
  assert.match(api, /replyToId: visibleSource\?\.kind === "comment"/);
  assert.match(api, /visibleSource\.parent_id === parent\.id/);
  assert.match(css, /\.public-profile-comment-thread-reply/);
});

test("public post Telegram action shares only canonical post link, not private account data", () => {
  assert.match(view, /publicTelegramShareUrl\(publicPostUrl\(profile\.url, item\.id\)/);
  assert.match(view, /rel="noopener noreferrer" className="public-profile-telegram-share"/);
  assert.match(api, /publicProfilePolicy\(db\)/);
  assert.match(view, /data-network-mode="public-snapshot"/);
});

test("public session widget uses separate consent and DST-aware visitor local times", () => {
  assert.match(settings, /publicSessionsEnabled/);
  assert.match(settings, /Показувати обрані торгові сесії в публічному профілі/);
  assert.match(view, /profile\.sessions !== null && <PublicSessionPanel/);
  assert.match(view, /getSessionWindow\(session, now\)/);
  assert.match(view, /resolveTimeZone\(\)/);
  assert.match(view, /sessionDateLabel\(window\.startsAt, window\.endsAt, viewerZone\)/);
  assert.match(api, /sessions: c\.publicSessionsEnabled === true/);
  assert.doesNotMatch(api, /sessions: p\.timeZone/);
});
