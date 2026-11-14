import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { publicPhotoIds, publicPhotoUrl } from "../src/community/publicProfilePhotosModel";
import { communityProfileContactUrl } from "../src/community/publicProfileViewModel";

const gallery = readFileSync(new URL("../src/community/PublicProfilePhotoGallery.tsx", import.meta.url), "utf8");
const photoCss = readFileSync(new URL("../src/community/publicProfilePhotos.css", import.meta.url), "utf8");
const publicPage = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
const articlePage = readFileSync(new URL("../src/community/PublicProfileArticles.tsx", import.meta.url), "utf8");
const communityPage = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
const routes = readFileSync(new URL("../server/community/publicProfiles.ts", import.meta.url), "utf8");
const postId = "cb59d0d9-bacf-4dce-b1c1-9876e70078d1";
const photoId = "0f4d75a5-938a-4eab-8c2f-7f77fc56ac21";
const base = "/api/public/profiles/maks";

test("anonymous galleries use only canonical authorized post-scoped media URLs", () => {
  assert.deepEqual(publicPhotoIds([photoId, "../secret", "", 55, photoId]), [photoId, photoId]);
  assert.equal(publicPhotoIds("not-an-array").length, 0);
  assert.equal(publicPhotoIds(Array.from({ length: 9 }, () => photoId)).length, 4);
  assert.equal(publicPhotoUrl(base, postId, photoId), base + "/posts/" + postId + "/media/" + photoId);
  assert.throws(() => publicPhotoUrl(base, "../private", photoId));
  assert.throws(() => publicPhotoUrl(base, postId, "javascript:alert(1)"));
  assert.throws(() => publicPhotoUrl("https://attacker.example/u/maks", postId, photoId));
});

test("public modal is read-only, native-accessible and does not copy authenticated media paths", () => {
  assert.match(gallery, /<dialog ref=\{dialogRef\}/);
  assert.match(gallery, /onClose=\{onClosed\}/);
  assert.match(gallery, /dialog\.showModal\(\)/);
  assert.match(gallery, /event\.key === "ArrowLeft"/);
  assert.match(gallery, /event\.key === "ArrowRight"/);
  assert.match(gallery, /aria-label="Закрити фотографію"/);
  assert.match(gallery, /openedByRef\.current\?\.focus/);
  assert.match(gallery, /loading=\{cover \? "eager" : "lazy"\}/);
  assert.match(photoCss, /@media \(max-width:640px\)/);
  assert.match(publicPage, /<PublicProfilePhotoGallery/);
  assert.match(articlePage, /<PublicProfilePhotoGallery ids=\{selected\.photos\}/);
  assert.match(routes, /route\("\/posts\/:id\/media\/:media"/);
  assert.match(routes, /const row = await publicPost\(db, rules, owner\.id, req\.params\.id\)/);
  assert.match(routes, /!row\.body\.photos\.includes\(id\)/);
  assert.doesNotMatch(gallery, /apiJson|fetch\(|method: "POST"|INITIAL_POSTS|MOCK_IMAGES|Math\.random/);
});

test("contact links focus real logged-in actions but never auto-create requests or chats", () => {
  const expected = "https://community-stage.h00k.top/#community?section=profile&owner=" + postId;
  assert.equal(communityProfileContactUrl("https://community-stage.h00k.top", postId), expected);
  assert.equal(communityProfileContactUrl("https://community-stage.h00k.top", postId, "friend"), expected + "&contact=friend");
  assert.equal(communityProfileContactUrl("https://community-stage.h00k.top", postId, "message"), expected + "&contact=message");
  assert.throws(() => communityProfileContactUrl("javascript:alert(1)", postId, "friend"));
  assert.throws(() => communityProfileContactUrl("https://bad@community-stage.h00k.top", postId, "friend"));
  assert.throws(() => communityProfileContactUrl("https://community-stage.h00k.top", "not-a-uuid", "message"));
  assert.match(publicPage, /communityProfileContactUrl\(profile\.communityOrigin, profile\.id, "friend"\)/);
  assert.match(publicPage, /communityProfileContactUrl\(profile\.communityOrigin, profile\.id, "message"\)/);
  assert.match(communityPage, /community-profile-message-action/);
  assert.match(communityPage, /community-profile-friend-action/);
  assert.match(communityPage, /button\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(communityPage, /await post\(api \+ "\/friends\/" \+ id, \{\}\)/);
  assert.doesNotMatch(communityPage, /if \(requestedContact === "friend"\) changeFriend\("send"\)/);
});
