import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { profileCropGeometry, PROFILE_CROP_SIZE } from "../src/components/community/profileMediaCrop";
import { ownerAvatarUrl } from "../src/components/community/profileMediaAvatar";

const mediaPage = readFileSync(new URL("../src/components/community/PublicProfileMediaSettings.tsx", import.meta.url), "utf8");
const cropDialog = readFileSync(new URL("../src/components/community/ProfilePhotoCropDialog.tsx", import.meta.url), "utf8");
const backend = readFileSync(new URL("../server/community/routes.ts", import.meta.url), "utf8");
const account = readFileSync(new URL("../server/community/account.ts", import.meta.url), "utf8");
const socialSkin = readFileSync(new URL("../src/community/publicProfileSocialSourceClone.css", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/components/community/public-profile-media.css", import.meta.url), "utf8");
const composer = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("../src/components/community/CommunityConceptProfile.tsx", import.meta.url), "utf8");
const id = "af56b75e-9276-4b30-8e18-a8af9d2fa451";
const other = "cc9e4055-fffa-4ed3-b2ae-cb062ed4cd11";

test("crop source bounds match the output canvas and never leave the original photo", () => {
  const g = profileCropGeometry(200, 100, 100, 100, { zoom: 1, x: 50, y: 50 });
  assert.deepEqual(g, { x: 50, y: 0, width: 100, height: 100 });
  assert.deepEqual(PROFILE_CROP_SIZE.avatar, { width: 512, height: 512 });
  assert.deepEqual(PROFILE_CROP_SIZE.cover, { width: 1440, height: 540 });
  const cover = profileCropGeometry(1200, 800, 1440, 540, { zoom: 2, x: 50, y: 50 });
  assert.ok(Math.abs(cover.width - 600) < 1e-8);
  assert.ok(Math.abs(cover.height - 225) < 1e-8);
  assert.ok(Math.abs(cover.x - 300) < 1e-8);
  assert.ok(Math.abs(cover.y - 287.5) < 1e-8);
  const edge = profileCropGeometry(1200, 800, 1440, 540, { zoom: 2, x: -10, y: 110 });
  assert.equal(edge.x, 0);
  assert.ok(Math.abs(edge.y - 575) < 1e-8);
  assert.throws(() => profileCropGeometry(0, 10, 10, 10, { zoom: 1, x: 50, y: 50 }), /Некоректні/);
  assert.throws(() => profileCropGeometry(20, 10, Infinity, 10, { zoom: 1, x: 50, y: 50 }), /Некоректні/);
});

test("owner preview matches social avatar and banner, with private-by-default media controls", () => {
  assert.match(mediaPage, /Оформлення профілю у стилі social/);
  assert.match(mediaPage, /community-public-social-preview/);
  assert.match(mediaPage, /community-public-social-cover/);
  assert.match(mediaPage, /community-public-social-avatar/);
  assert.match(mediaPage, /ownerUrl\(cover\)/);
  assert.match(mediaPage, /ownerUrl\(avatar\)/);
  assert.match(mediaPage, /Вибрати файл і кадрувати/);
  assert.match(mediaPage, /Мої завантажені фото/);
  assert.match(mediaPage, /<option value="private">Лише я<\/option>/);
  assert.match(mediaPage, /<option value="public">Усі відвідувачі \/u\/<\/option>/);
  assert.match(mediaPage, /Відкрити свою публічну сторінку/);
  assert.match(mediaPage, /приватний попередній перегляд/);
  assert.doesNotMatch(mediaPage, /unsplash|mockData|data:image\/svg/i);
  assert.match(socialSkin, /\.public-profile\[data-social-source-clone="maks"\] \.public-profile-avatar/);
  assert.match(css, /\.community-public-social-avatar/);
  assert.match(css, /@media\(max-width: 700px\)/);
});

test("owner-selected avatar is shown in their sidebar and post composer, never an arbitrary URL", () => {
  assert.equal(ownerAvatarUrl({ avatarMediaId: id }), "/api/community/media/" + id);
  assert.equal(ownerAvatarUrl({ avatarMediaId: "../../etc/passwd" }), null);
  assert.equal(ownerAvatarUrl({ avatarMediaId: "https://evil.test/img" }), null);
  assert.equal(ownerAvatarUrl(null), null);
  assert.match(sidebar, /ownerAvatarUrl\(profile\?\.community\) \?\? user\?\.photoURL/);
  assert.match(composer, /ownerAvatarUrl\(profile\?\.community\)/);
});

test("image choices are cropped locally and uploaded only after explicit save", () => {
  assert.match(mediaPage, /setCrop\(\{ kind, file \}\)/);
  assert.match(mediaPage, /<ProfilePhotoCropDialog/);
  assert.match(cropDialog, /URL\.createObjectURL\(file\)/);
  assert.match(cropDialog, /URL\.revokeObjectURL\(url\)/);
  assert.match(cropDialog, /canvas\.toBlob\(/);
  assert.match(cropDialog, /drawProfileCrop\(canvas, image, crop\)/);
  assert.match(cropDialog, /validateCommunityPhoto\(output, 0\)/);
  assert.match(cropDialog, /if \(await onSave\(output\)\) onClose\(\)/);
  assert.match(mediaPage, /\[kind \+ "Audience"\]: "private"/);
  assert.match(mediaPage, /\[kind \+ "MediaId"\]: null/);
  assert.match(mediaPage, /"POST"/);
  assert.match(mediaPage, /"\/api\/community\/media"/);
  assert.match(mediaPage, /ownerRef\.current !== owner/);
  assert.match(mediaPage, /document\.body\.style\.overflow = "hidden"/);
  assert.doesNotMatch(mediaPage, /localStorage|sessionStorage|mockAvatar|images\.unsplash|fetch\("https:/);
});

test("the paginated private media library and selection require account ownership", () => {
  assert.match(backend, /app\.get\("\/api\/community\/media\/library"/);
  assert.match(backend, /accountFor\(db, req\)/);
  assert.match(backend, /limits\.take\("media-library:" \+ a\.id, 30\)/);
  assert.match(backend, /WHERE owner_id=\$1 AND/);
  assert.match(backend, /LIMIT 19/);
  assert.match(backend, /rows\.slice\(0, 18\)/);
  assert.match(backend, /"Cache-Control": "private, no-store"/);
  assert.match(account, /"SELECT id FROM hc_media WHERE id=\$1 AND owner_id=\$2"/);
  assert.match(mediaPage, /\/api\/community\/media\/library/);
  assert.match(mediaPage, /\[kind \+ "MediaId"\]: id, \[kind \+ "Audience"\]: "private"/);
  assert.match(mediaPage, /Зображення опубліковано/);
});
