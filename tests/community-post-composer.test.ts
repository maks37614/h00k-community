import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canSendCommunityContent,
  communityAudienceHint,
  MAX_COMMUNITY_PHOTO_BYTES,
  MAX_COMMUNITY_PHOTOS,
  validateCommunityPhoto,
} from "../src/components/community/composerPolicy";

const page = readFileSync(
  new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8",
);
const css = readFileSync(
  new URL("../src/components/community/social-composer-posts.css", import.meta.url), "utf8",
);

test("composer checks actual server photo types, 5 MiB and four attachments", () => {
  assert.equal(MAX_COMMUNITY_PHOTOS, 4);
  assert.equal(MAX_COMMUNITY_PHOTO_BYTES, 5 * 1024 * 1024);
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    assert.equal(validateCommunityPhoto({ type, size: MAX_COMMUNITY_PHOTO_BYTES }, 0), null);
  }
  assert.match(validateCommunityPhoto({ type: "image/svg+xml", size: 1000 }, 0)!, /JPEG/);
  assert.match(validateCommunityPhoto({ type: "image/png", size: MAX_COMMUNITY_PHOTO_BYTES + 1 }, 0)!, /5 МіБ/);
  assert.match(validateCommunityPhoto({ type: "image/png", size: 0 }, 0)!, /5 МіБ/);
  assert.match(validateCommunityPhoto({ type: "image/png", size: 100 }, 4)!, /4 фото/);
});

test("post validation never sends empty content or while an upload is active", () => {
  assert.equal(canSendCommunityContent("  ", 0, false), false);
  assert.equal(canSendCommunityContent("", 1, false), true);
  assert.equal(canSendCommunityContent("Торговий план", 0, false), true);
  assert.equal(canSendCommunityContent("Торговий план", 0, true), false);
  assert.equal(canSendCommunityContent("", 2, true), false);
});

test("privacy text states actual privacy intersection for public, friends and private comments", () => {
  assert.match(communityAudienceHint("post", "private"), /лише для вас/);
  assert.match(communityAudienceHint("post", "friends"), /підтверджених друзів/);
  assert.match(communityAudienceHint("post", "public"), /Публічний/);
  assert.match(communityAudienceHint("comment", "private"), /лише для вас/);
  assert.match(communityAudienceHint("comment", "friends"), /також можуть переглядати допис/);
  assert.match(communityAudienceHint("comment", "public"), /основний допис/);
  assert.match(communityAudienceHint("message", "private"), /учасникам розмови/);
});

test("new composer keeps live PostgreSQL-backed APIs, photo access and saved HookChart picker", () => {
  assert.match(page, /className=\{"community-composer community-composer-" \+ target\.kind\}/);
  assert.match(page, /onSubmit=\{send\}/);
  assert.match(page, /await post\(api \+ "\/items", \{/);
  assert.match(page, /clientId: clientId\.current/);
  assert.match(page, /body: replyBody\(text, photos, target\.replyTo\)/);
  assert.match(page, /if \(inFlight\.current/);
  assert.match(page, /validateCommunityPhoto\(file, photos\.length\)/);
  assert.match(page, /api \+ "\/media"/);
  assert.match(page, /"Content-Type": file\.type/);
  assert.match(page, /onPick\(target\)/);
  assert.match(page, /aria-expanded=\{showEmojis\}/);
  assert.match(page, /const emojiPanelId = useId\(\)/);
  assert.match(page, /const audienceId = useId\(\)/);
  assert.match(page, /id=\{audienceId\}/);
  assert.match(page, /id=\{emojiPanelId\}/);
  assert.match(page, /community-composer-photo/);
  assert.doesNotMatch(page, /MOCK_POSTS|INITIAL_TRADES|DUMMY_PNL/);
});

test("post cards keep real reactions, threaded replies and copied links only for public posts", () => {
  assert.match(page, /item\.audience === "public" && item\.kind === "post"/);
  assert.match(page, /navigator\.clipboard\.writeText\(/);
  assert.match(page, /await post\(api \+ "\/items\/" \+ item\.id \+ "\/reaction", \{ emoji \}\)/);
  assert.match(page, /api \+ "\/items\/" \+ item\.id \+ "\/comments"/);
  assert.match(page, /community-comment-head/);
  assert.match(page, /dateTime=\{comment\.created_at\}/);
  assert.match(page, /comment\.chart &&/);
  assert.match(page, /ids=\{comment\.body\.photos\}/);
  assert.match(page, /community-post-copy/);
  assert.match(css, /\.community-workspace \.community-composer/);
  assert.match(css, /@media \(max-width: 410px\)/);
  assert.match(css, /font-size: 16px; \/\* Prevent Safari focus zoom on iOS/);
});
