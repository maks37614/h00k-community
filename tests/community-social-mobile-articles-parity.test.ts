import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/components/community/social-mobile-articles-parity.css", import.meta.url), "utf8");
const routes = readFileSync(new URL("../server/community/routes.ts", import.meta.url), "utf8");

const articles = page.slice(page.indexOf("function CommunityArticles({"), page.indexOf("\nfunction ItemCard({"));
const workspace = page.slice(page.indexOf("export function CommunityPage("), page.indexOf("\ntype Run ="));

test("Social mobile panes reuse the real feed/sidebar/sessions without creating new workers", () => {
  assert.match(workspace, /const \[mobileFeedColumn, setMobileFeedColumn\]/);
  assert.match(workspace, /className="community-social-mobile-columns"/);
  assert.match(workspace, /data-mobile-column=\{tab === "feed" \? mobileFeedColumn : undefined\}/);
  assert.match(workspace, /"profile","Профіль"/);
  assert.match(workspace, /"feed","Стрічка"/);
  assert.match(workspace, /"sessions","Сесії й нагороди"/);
  assert.match(workspace, /<CommunityConceptProfile/);
  assert.match(workspace, /<CommunityTradingSessions variant="sidebar" \/>/);
  assert.match(workspace, /<CommunityAwardPanel/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /data-mobile-column="profile"/);
  assert.match(css, /data-mobile-column="sessions"/);
  assert.match(css, /data-mobile-column="feed"/);
  assert.doesNotMatch(css, /(^|\n)\s*(body|html)\s*\{/);
});

test("Top nav makes the most used social areas available without the overflow drawer", () => {
  assert.match(workspace, /className="community-social-topbar"/);
  assert.match(workspace, /"chats","Повідомлення"/);
  assert.match(workspace, /"friends","Друзі"/);
  assert.match(workspace, /"articles","Статті"/);
  assert.match(workspace, /"profile","Мій профіль"/);
  assert.match(workspace, /aria-current=\{tab === key \? "page" : undefined\}/);
  assert.match(workspace, /setTab\(key\); setViewProfile\(null\)/);
  assert.match(css, /overflow-x:auto/);
  assert.match(css, /-webkit-overflow-scrolling:touch/);
});

test("ArticlesView parity: real public/friends education posts, pagination and reader", () => {
  assert.match(workspace, /\["articles", "Статті та аналітика", <BookOpen/);
  assert.match(workspace, /tab === "articles" &&/);
  assert.match(articles, /apiJson\(api \+ "\/feed\?mode=" \+ audience \+ "&category=education"\)/);
  assert.match(articles, /&category=education&before=/);
  assert.match(articles, /currentAudience\.current !== requestedAudience/);
  assert.match(articles, /item\.body\?\.category === "education"/);
  assert.match(articles, /presetCategory="education"/);
  assert.match(articles, /onSent=\{resource\.refresh\}/);
  assert.match(articles, /<ItemCard key=\{selected\.id\}/);
  assert.match(articles, /onClick=\{\(\) => setSelectedId\(null\)\}/);
  assert.match(articles, /Завантажити|Завантажуємо/);
  assert.match(routes, /AND \(\$4::text IS NULL OR body->>'category'=\$4\)/);
  assert.match(routes, /const item = await presentItem\(db, p, row\)/);
  assert.doesNotMatch(articles, /INITIAL_ARTICLES|MOCK_ARTICLES|FAKE_PNL|localStorage/);
});

test("Article and mobile styles stay scoped, adapt to iPhone and avoid layout shifts", () => {
  assert.match(css, /\.community-workspace \.community-articles-grid/);
  assert.match(css, /\.community-workspace \.community-articles-reader/);
  assert.match(css, /grid-template-columns:minmax\(0,1fr\)/);
  assert.match(css, /font-size:16px/);
  assert.match(css, /@media\(max-width:390px\)/);
  assert.match(css, /prefers-reduced-motion|community-social-topbar/);
  assert.doesNotMatch(css, /\.community-chart\b|\.screener-/);
});
