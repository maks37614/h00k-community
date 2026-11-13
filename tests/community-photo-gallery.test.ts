import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
const gallery = readFileSync(new URL("../src/components/community/CommunityPhotoGallery.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/components/community/social-photo-gallery.css", import.meta.url), "utf8");
const routes = readFileSync(new URL("../server/community/routes.ts", import.meta.url), "utf8");

test("real Community post and comment attachments use the same image gallery", () => {
  assert.match(page, /import \{ CommunityPhotoGallery \}/);
  assert.match(page, /ids=\{item\.body\.photos\}/);
  assert.match(page, /ids=\{comment\.body\.photos\}/);
  assert.match(page, /label="Фото допису"/);
  assert.match(page, /label="Фото коментаря"/);
  assert.match(page, /import "\.\/social-photo-gallery\.css"/);
});

test("gallery uses existing protected media endpoint, not data URLs or mock assets", () => {
  assert.match(gallery, /\/api\/community\/media\//);
  assert.match(gallery, /encodeURIComponent\(id\)/);
  assert.match(gallery, /aria-label=\{label\}/);
  assert.match(gallery, /loading="lazy"/);
  assert.match(gallery, /target="_blank" rel="noopener noreferrer"/);
  assert.match(gallery, /useRef<HTMLDialogElement>/);
  assert.match(gallery, /dialog\.showModal\(\)/);
  assert.match(gallery, /onClose=\{\(\) => setActiveIndex\(null\)\}/);
  assert.match(gallery, /Наступне фото/);
  assert.match(gallery, /Попереднє фото/);
  assert.match(gallery, /Закрити перегляд/);
  assert.doesNotMatch(gallery, /MOCK_PHOTOS|DUMMY_URL|localStorage|fetch\(/);
  assert.match(routes, /app\.get\("\/api\/community\/media\/:id"/);
});

test("lightbox is responsive, accessible and does not override HookChart rendering", () => {
  assert.match(css, /\.community-workspace \.community-photo-gallery/);
  assert.match(css, /\.community-workspace \.community-photo-dialog::backdrop/);
  assert.match(css, /max-height: 100%/);
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.doesNotMatch(css, /^\s*(?:body|html)\s*\{/m);
});
