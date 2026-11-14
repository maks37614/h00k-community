import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/components/community/social-profile-tabs.css", import.meta.url), "utf8");

const profile = page.slice(page.indexOf("function Profile({"), page.indexOf("\nfunction CommunitySettings("));

test("real trader profiles separate wall, about, and API statistics without mock data", () => {
  assert.match(profile, /type Section = "wall" \| "articles" \| "setups" \| "about" \| "trades"/);
  assert.match(profile, /new URLSearchParams\(location\.hash\.split\("\?"\)\[1\] \?\? ""\)\.get\("profileTab"\)/);
  assert.match(profile, /window\.addEventListener\("hashchange", jump\)/);
  assert.match(profile, /window\.addEventListener\("popstate", jump\)/);
  assert.match(profile, /className="community-profile-tabs"/);
  assert.match(profile, /aria-pressed=\{profileSection === key\}/);
  for (const name of ["Стіна", "Статті та розбори", "HookChart", "Про трейдера", "Статистика"]) {
    assert.ok(profile.includes('"' + name + '"'));
  }
  assert.match(profile, /profileSection === "wall" && \(/);
  assert.match(profile, /profileSection === "articles" && \(/);
  assert.match(profile, /profileSection === "setups" && \(/);
  assert.match(profile, /profileSection === "about" && \(/);
  assert.match(profile, /profileSection === "trades" && \(/);
  assert.doesNotMatch(profile, /INITIAL_PROFILES|MOCK_STATS|FAKE_PNL/);
});

test("owner alone can edit profile, status, visibility, and personal address", () => {
  assert.match(profile, /id === user\?\.uid \? \(/);
  assert.match(profile, /await updateProfileData\(\{ displayName, community: fields \}\)/);
  assert.match(profile, /const \{ publicProfileEnabled: _publicVisibility, \.\.\.fields \} = form/);
  assert.match(profile, /<PublicProfileSettings \/>/);
  assert.match(profile, /form\.status\?\.text/);
  assert.match(profile, /<Audience/);
  assert.match(profile, /community-profile-readonly/);
  assert.match(profile, /p\?\.interests/);
  assert.match(profile, /p\?\.lifestyle/);
});

test("existing real API routes and friendship/chat actions are preserved", () => {
  assert.match(profile, /apiJson\(api \+ "\/profiles\/" \+ id\)/);
  assert.match(profile, /apiJson\(api \+ "\/friends"\)/);
  assert.match(profile, /apiJson\(api \+ "\/feed\?mode=wall&owner=" \+ id\)/);
  assert.match(profile, /<Trades owner=\{id\} run=\{run\} \/>/);
  assert.match(profile, /onChatInvite\(id, p\.displayName \?\? "Трейдер"\)/);
  assert.match(profile, /<Composer/);
  assert.match(profile, /<ItemCard/);
  assert.match(profile, /wall\.error/);
  assert.match(profile, /<div className="community-empty">/);
});

test("profile navigation is scoped, touch friendly and prevents iOS input zoom", () => {
  assert.match(page, /import "\.\/social-profile-tabs\.css"/);
  assert.match(css, /\.community-workspace \.community-profile-tabs/);
  assert.match(css, /\.community-workspace \.community-profile-readonly/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /font-size: 16px; \/\* Prevent Safari zoom/);
  assert.doesNotMatch(css, /^\s*body\s*\{|^\s*html\s*\{/m);
});
