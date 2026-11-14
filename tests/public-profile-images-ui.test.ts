import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const publicPage = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
const publicCss = readFileSync(new URL("../src/community/publicProfile.css", import.meta.url), "utf8");
const settings = readFileSync(new URL("../src/components/community/PublicProfileMediaSettings.tsx", import.meta.url), "utf8");
const address = readFileSync(new URL("../src/components/community/PublicProfileSettings.tsx", import.meta.url), "utf8");
const backend = readFileSync(new URL("../server/community/publicProfiles.ts", import.meta.url), "utf8");
const account = readFileSync(new URL("../server/community/account.ts", import.meta.url), "utf8");

test("public profile images come only from owner-linked anonymous endpoints", () => {
  assert.match(backend, /avatarUrl: c\.avatarAudience === "public"/);
  assert.match(backend, /coverUrl: c\.coverAudience === "public"/);
  assert.match(backend, /for \(const kind of \["avatar", "cover"\]/);
  assert.match(backend, /SELECT id FROM hc_media WHERE id=\$1 AND owner_id=\$2/);
  assert.match(backend, /mediaRoot\(\), mediaId \+ "\.webp"/);
  assert.match(account, /for \(const field of \["avatarMediaId", "coverMediaId"\]/);
  assert.match(account, /if \(!media\.rows\.length\) fail/);
  assert.match(account, /"avatarAudience"/);
  assert.match(account, /"coverAudience"/);
});

test("owner must explicitly publish each new upload; removing photo hides it", () => {
  assert.match(address, /<PublicProfileMediaSettings publicUrl=\{info\?\.url \?\? undefined\} \/>/);
  assert.match(settings, /validateCommunityPhoto\(file, 0\)/);
  assert.match(settings, /"\/api\/community\/media"/);
  assert.match(settings, /\[kind \+ "Audience"\]: "private"/);
  assert.match(settings, /\[kind \+ "MediaId"\]: null/);
  assert.match(settings, /<option value="private">Лише я<\/option>/);
  assert.match(settings, /<option value="public">Усі відвідувачі \/u\/<\/option>/);
  assert.match(settings, /<input[\s\S]*type="file"/);
  assert.doesNotMatch(settings, /fakeImage|mockAvatar|images\.unsplash/);
});

test("public /u/ uses only provided images with fallback initials and mobile layout", () => {
  assert.match(publicPage, /profile\.avatarUrl && <img/);
  assert.match(publicPage, /profile\.coverUrl && <img/);
  assert.match(publicPage, /className="public-profile-avatar-image"/);
  assert.match(publicPage, /className="public-profile-cover-image"/);
  assert.match(publicPage, /onError=\{e => \{ e\.currentTarget\.hidden = true; \}\}/);
  assert.match(publicCss, /\.public-profile-cover-image/);
  assert.match(publicCss, /\.public-profile-avatar-image/);
  assert.match(publicCss, /@media \(max-width: 640px\)/);
});
