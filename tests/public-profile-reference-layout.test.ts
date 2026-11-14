import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
const style = readFileSync(new URL("../src/community/publicProfileReferenceLayout.css", import.meta.url), "utf8");
const model = readFileSync(new URL("../src/community/publicProfileSocialModel.ts", import.meta.url), "utf8");
const publicApi = readFileSync(new URL("../server/community/publicProfiles.ts", import.meta.url), "utf8");

test("public page uses a final overriding reference layout instead of conflicting two-column CSS", () => {
  const social = page.indexOf('import "./socialTraderProfile.css";');
  const finalSkin = page.indexOf('import "./publicProfileReferenceLayout.css";');
  assert.ok(social >= 0 && finalSkin > social, "reference CSS must override the earlier two-column skin");
  assert.match(style, /\.public-profile \.public-profile-columns\.public-profile-social-layout\s*\{/);
  assert.match(style, /grid-template-columns: minmax\(214px, 260px\) minmax\(0, 1fr\) minmax\(265px, 310px\)/);
  assert.match(style, /grid-template-areas: "trader feed insights"/);
  assert.match(style, /\.public-profile \.public-profile-social-layout > \.public-profile-aside\s*\{[\s\S]*?grid-area: trader/);
  assert.match(style, /\.public-profile \.public-profile-social-layout > \.public-profile-main\s*\{[\s\S]*?grid-area: feed/);
  assert.match(style, /\.public-profile \.public-profile-social-layout > \.public-profile-insights\s*\{[\s\S]*?grid-area: insights/);
  assert.match(style, /@media \(max-width: 1190px\)/);
  assert.match(style, /grid-template-areas: "trader feed" "insights feed"/);
  assert.match(style, /@media \(max-width: 860px\)/);
  assert.match(style, /grid-template-areas: "trader" "feed" "insights"/);
  assert.match(style, /@media \(max-width: 640px\)/);
  assert.doesNotMatch(style, /^\s*(?:html|body)\s*\{/m);
});

test("trader info is left, actual public HookChart posts center, sessions and achievements right", () => {
  assert.match(page, /className="public-profile-sidebar-identity"/);
  assert.match(page, /className="public-profile-sidebar-avatar"/);
  assert.match(page, /profile\.avatarUrl && <img src=\{profile\.avatarUrl\}/);
  assert.match(page, /profile\.displayName/);
  assert.match(page, /className="public-profile-main"/);
  assert.match(page, /<ChartPreview document=\{item\.chart\} onOpen=\{\(\) => void openChart\(item\.id\)\} \/>/);
  assert.match(page, /className="public-profile-insights"/);
  const insightsStart = page.indexOf('<aside className="public-profile-insights"');
  const aboutStart = page.indexOf('<aside className="public-profile-aside"');
  assert.ok(insightsStart >= 0 && aboutStart > insightsStart);
  const publicSessions = page.indexOf('<PublicSessionPanel ids={profile.sessions} />');
  assert.ok(publicSessions > insightsStart && publicSessions < aboutStart, "session panel must be in insights, not left profile");
  assert.equal(page.split('<PublicSessionPanel ids={profile.sessions} />').length - 1, 1);
  assert.match(page, /className="public-profile-achievements public-profile-panel"/);
  assert.match(page, /className="public-profile-overview public-profile-panel"/);
  assert.match(style, /\.public-profile \.public-profile-insights \.public-profile-achievements\s*\{[\s\S]*?order: 1/);
  assert.match(style, /\.public-profile \.public-profile-insights \.public-profile-overview\s*\{[\s\S]*?order: 2/);
});

test("visual port keeps actual privacy-aware API data and does not invent trades or trophies", () => {
  assert.match(page, /data-network-mode="public-snapshot"/);
  assert.match(page, /profile\.statistics \?/);
  assert.match(page, /profile\.awards \?/);
  assert.match(page, /profile\.sessions !== null/);
  assert.match(page, /profile\.coverUrl &&/);
  assert.match(page, /profile\.avatarUrl &&/);
  assert.match(model, /PnL across different currencies must never be added/);
  assert.match(publicApi, /publicProfilePolicy\(db\)/);
  assert.match(publicApi, /c\.statisticsAudience === "public"/);
  assert.doesNotMatch(page + style, /INITIAL_PROFILES|MOCK_TRADES|FAKE_AWARDS|SAMPLE_PNL/);
});
