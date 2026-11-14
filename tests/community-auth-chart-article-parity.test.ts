import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
const profile = page.slice(page.indexOf("function Profile({"), page.indexOf("\nfunction CommunitySettings("));
const server = readFileSync(new URL("../server/community/routes.ts", import.meta.url), "utf8");
const toolbar = readFileSync(new URL("../src/community/PublicSetupGalleryToolbar.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/components/community/social-profile-gallery.css", import.meta.url), "utf8");

test("signed-in profile has a real HookChart tab and independently paginated owner feed", () => {
  assert.match(profile, /"setups", "HookChart"/);
  assert.match(profile, /value === "hookchart" \|\| value === "setups"/);
  assert.match(profile, /apiJson\(api \+ "\/feed\?mode=wall&owner=" \+ id \+ "&withChart=1"\)/);
  assert.match(profile, /"&withChart=1&before=" \+ encodeURIComponent\(cursor\)/);
  assert.match(profile, /currentProfileRef\.current !== requestedId/);
  assert.match(profile, /item\.owner_id === id && !!item\.chart/);
  assert.match(profile, /filterPublicSetupGallery\(loadedSetups, setupFilters\)/);
  assert.match(profile, /<PublicSetupGalleryToolbar scope="authorized"/);
  assert.match(profile, /refresh=\{setups\.refresh\}/);
  assert.match(profile, /disabled=\{setupsBusy\}/);
});

test("the backend filters chart items in SQL BEFORE pagination and retains access checks", () => {
  assert.match(server, /req\.query\.withChart !== undefined && req\.query\.withChart !== "1"/);
  assert.match(server, /AND \(NOT \$7::boolean OR chart_id IS NOT NULL\)/);
  assert.match(server, /\[before, mode, wallOwner, categoryRaw, _a\.id, \[\.\.\.p\.accepted\], withChart\]/);
  assert.match(server, /const item = await presentItem\(db, p, row\)/);
  assert.match(toolbar, /scope === "public" \? "Фільтри публічних HookChart" : "Фільтри доступних HookChart"/);
  assert.match(toolbar, /"Пошук серед уже завантажених доступних вам графіків\."/);
  assert.doesNotMatch(profile, /new WebSocket\(|fetch\("https:\/\/api\.(?:binance|bybit)/);
});

test("educational authoring stays in Articles, adds a title and submits education category", () => {
  assert.match(page, /presetCategory\?: "education"/);
  assert.match(page, /category: presetCategory \?\? category/);
  assert.match(page, /maxLength=\{200\} value=\{title\}/);
  assert.match(page, /presetCategory === "education" && !title\.trim\(\)/);
  assert.match(profile, /aria-expanded=\{showArticleComposer\}/);
  assert.match(profile, /<Composer target=\{\{ kind: "post" \}\} presetCategory="education"/);
  assert.match(profile, /articles\.refresh\(\); setShowArticleComposer\(false\)/);
  assert.match(server, /AND \(\$4::text IS NULL OR body->>'category'=\$4\)/);
  assert.doesNotMatch(page, /INITIAL_ARTICLES|MOCK_ARTICLES|FAKE_PNL/);
});

test("profile tabs preserve URL state, back/forward and touch-safe gallery inputs", () => {
  assert.match(profile, /params\.set\("profileTab", section === "setups" \? "hookchart" : section\)/);
  assert.match(profile, /history\.pushState\(history\.state, "", nextHash\)/);
  assert.match(profile, /window\.addEventListener\("popstate", jump\)/);
  assert.match(profile, /window\.addEventListener\("hashchange", jump\)/);
  assert.match(css, /\.community-workspace \.community-profile-setups \.public-setup-gallery-toolbar/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /font-size: 16px; \/\* prevent iOS focus zoom \*\//);
  assert.doesNotMatch(css, /(^|\n)\s*(body|html)\s*\{/);
});
