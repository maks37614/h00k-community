import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicSetupGalleryToolbar } from "../src/community/PublicSetupGalleryToolbar";
import { DEFAULT_PUBLIC_SETUP_FILTERS } from "../src/community/publicSetupGalleryModel";

const sourceSkin = readFileSync(new URL("../src/community/publicProfileSocialSourceClone.css", import.meta.url), "utf8");
const authSkin = readFileSync(new URL("../src/components/community/social-concept-layout.css", import.meta.url), "utf8");
const authHero = readFileSync(new URL("../src/components/community/social-profile-hero.css", import.meta.url), "utf8");
const gallerySkin = readFileSync(new URL("../src/community/publicSetupGalleryToolbar.css", import.meta.url), "utf8");
const publicPage = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
const sourceStats = readFileSync(new URL("../src/community/PublicSocialReferenceStats.tsx", import.meta.url), "utf8");
const windowComponent = readFileSync(new URL("../src/community/PublicProfileTradeWindows.tsx", import.meta.url), "utf8");

test("maks public profile width, cover, avatar and corner radius mirror social desktop dimensions", () => {
  // social/src/App.tsx: max-w-[1720px]; TraderProfileView: h-40 sm:h-52,
  // w-28 h-28 sm:w-32 sm:h-32 and rounded-3xl cards.
  assert.match(sourceSkin, /max-width: 1720px/);
  assert.match(sourceSkin, /height: 208px;\s*min-height: 208px !important/);
  assert.match(sourceSkin, /grid-template-columns: 128px minmax\(0, 1fr\) auto/);
  assert.match(sourceSkin, /width: 128px;\s*height: 128px;\s*flex-basis: 128px/);
  assert.match(sourceSkin, /border-radius: 24px/);
  assert.match(sourceSkin, /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(sourceSkin, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(sourceSkin, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(publicPage, /data-social-source-clone=\{profile\?\.username === "maks" \? "maks" : undefined\}/);
});

test("mobile social profile avoids desktop cover and avatar shrink at <=640px", () => {
  assert.match(sourceSkin, /@media \(max-width: 640px\)/);
  assert.match(sourceSkin, /height: 160px; min-height: 160px !important/);
  assert.match(sourceSkin, /grid-template-columns: 112px minmax\(0, 1fr\)/);
  assert.match(sourceSkin, /width: 112px; height: 112px; flex-basis: 112px/);
  assert.match(sourceSkin, /@media \(max-width: 560px\)/);
  assert.match(sourceSkin, /min-width: 0/);
  assert.match(sourceSkin, /flex-wrap:nowrap;overflow-x:auto/);
});

test("authenticated Community layout and sidebar scale follow the same 1720px design grid", () => {
  assert.match(authSkin, /max-width: 1720px/);
  assert.match(authSkin, /grid-template-columns: minmax\(248px, 350px\) minmax\(0,1fr\) minmax\(263px,364px\)/);
  assert.match(authSkin, /flex:0 0 64px;width:64px;height:64px/);
  assert.match(authSkin, /@media \(max-width: 900px\)/);
  assert.match(authSkin, /@media \(max-width: 660px\)/);
  assert.match(authHero, /width:128px;height:128px;flex-basis:128px/);
  assert.match(authHero, /width:112px;height:112px;flex-basis:112px/);
  assert.match(authHero, /min-height:160px;padding:12px/);
  assert.doesNotMatch(authSkin + sourceSkin + authHero, /(^|\n)\s*html\s*\{|(^|\n)\s*body\s*\{/m);
});

test("public gallery filter controls and share are reachable with focus and mobile-safe inputs", () => {
  const html = renderToStaticMarkup(React.createElement(PublicSetupGalleryToolbar, {
    filters: DEFAULT_PUBLIC_SETUP_FILTERS, totalLoaded: 0, matches: 0,
    hasNextPage: false, onChange() {},
  }));
  assert.match(html, /id="public-setup-filters"/);
  assert.match(html, /tabindex="-1"/i);
  assert.match(html, /Фільтри публічних HookChart/);
  assert.match(html, /Пошук серед уже завантажених публічних графіків/);
  assert.match(publicPage, /className="public-profile-gallery-jump"/);
  assert.match(publicPage, /aria-controls="public-setup-filters"/);
  assert.match(publicPage, /scrollIntoView\(\{ block: "center", behavior: "smooth" \}\)/);
  assert.match(publicPage, /panel\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(publicPage, /Поділитися галереєю/);
  assert.match(gallerySkin, /min-height:44px; font-size: 16px/);
  assert.match(gallerySkin, /scroll-margin-block:20px/);
  assert.doesNotMatch(gallerySkin, /display:\s*none|visibility:\s*hidden/);
});

test("tabs and period selector retain real interactions without demo figures or live exchange traffic", () => {
  for(const tab of ["wall", "articles", "setups", "statistics", "about"]) {
    assert.match(publicPage, new RegExp('navigateProfile\\("' + tab + '"\\)'));
  }
  assert.match(publicPage, /window\.addEventListener\("popstate", onBackForward\)/);
  assert.match(publicPage, /history\.pushState\(null, "", next\)/);
  assert.match(publicPage, /tab === "articles" && <PublicProfileArticles/);
  assert.match(windowComponent, /const \[days, setDays\] = useState<7 \| 30>\(30\)/);
  assert.match(windowComponent, /aria-pressed=\{days === period\} onClick=\{\(\) => setDays\(period\)\}/);
  assert.match(windowComponent, /За останні \{days\} днів імпортованих закриттів немає/);
  assert.match(sourceStats, /Ризик\/прибуток не можна відновити лише з сумарних закритих ордерів/);
  assert.doesNotMatch(publicPage + sourceStats, /INITIAL_PROFILES|MOCK_STATS|fakeFollowers|new WebSocket\(/);
});
