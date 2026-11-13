import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  replyAudienceOptions,
  normalizeReplyAudience,
  canShareReplyWithAudience,
  replyPreviewText,
  replyBody,
  type ReplySource,
} from "../src/components/community/commentReplyModel";

const publicReply: ReplySource = {
  id: "9e9c39a8-4306-4070-8e64-d20d5dc30999",
  displayName: "Трейдер",
  text: "Зверніть увагу на рівень",
  audience: "public",
};

test("quote replies cannot widen an existing comment's privacy", () => {
  assert.deepEqual(replyAudienceOptions({ ...publicReply, audience: "public" }), ["private", "friends", "public"]);
  assert.deepEqual(replyAudienceOptions({ ...publicReply, audience: "friends" }), ["private", "friends"]);
  assert.deepEqual(replyAudienceOptions({ ...publicReply, audience: "private" }), ["private"]);
  assert.deepEqual(replyAudienceOptions(), ["private", "friends", "public"]);
  assert.equal(normalizeReplyAudience("unrecognized"), "private");
  assert.equal(normalizeReplyAudience("friends"), "friends");
  assert.equal(canShareReplyWithAudience({ ...publicReply, audience: "friends" }, "public"), false);
  assert.equal(canShareReplyWithAudience({ ...publicReply, audience: "friends" }, "friends"), true);
  assert.equal(canShareReplyWithAudience({ ...publicReply, audience: "private" }, "public"), false);
  assert.equal(canShareReplyWithAudience(undefined, "public"), true);
});

test("quote text is short, avoids line breaks and doesn't duplicate source content", () => {
  assert.equal(replyPreviewText(" Підтримка\n  $105.00   рівень  "), "Підтримка $105.00 рівень");
  assert.equal(replyPreviewText("x".repeat(400)).length, 180);
  assert.equal(replyPreviewText("x".repeat(400)).at(-1), "…");
  assert.equal(replyPreviewText(undefined), "");
  assert.deepEqual(replyBody("Мій коментар", [], publicReply), {
    text: "Мій коментар",
    photos: [],
    sourceItemId: publicReply.id,
  });
  assert.deepEqual(replyBody("Звичайний коментар", []), {
    text: "Звичайний коментар",
    photos: [],
  });
});

test("real comments get a reply composer with source lineage and chart attachments", () => {
  const page = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
  const style = readFileSync(new URL("../src/components/community/social-composer-posts.css", import.meta.url), "utf8");
  const backend = readFileSync(new URL("../server/community/content.ts", import.meta.url), "utf8");
  assert.match(page, /const \[selectedReply, setSelectedReply\]/);
  assert.match(page, /className="community-comment-reply-actions"/);
  assert.match(page, /Скасувати відповідь/);
  assert.match(page, /selectedReply\?\.id === comment\.id && \(/);
  assert.match(page, /target=\{\{ \.\.\.target, replyTo: selectedReply \}\}/);
  assert.match(page, /replyBody\(text, photos, target\.replyTo\)/);
  assert.match(page, /className="community-comment-quoted"/);
  assert.match(page, /sourceItemId: target\.replyTo\.id/);
  assert.match(page, /allowedValues=\{replyAudienceOptions\(target\.replyTo\)\}/);
  assert.match(page, /<ChartPreview/);
  assert.match(page, /<CommunityPhotoGallery/);
  assert.match(style, /\.community-comment-reply-actions/);
  assert.match(style, /@media \(max-width: 700px\)/);
  assert.match(backend, /if \(kind === "comment" && \(!parent \|\| parent\.kind !== "post"\)\)/);
  assert.match(backend, /if \(body\.sourceItemId\)/);
  assert.match(backend, /await enforceSource\(db, rules, source, audience, conversationId\)/);
});
