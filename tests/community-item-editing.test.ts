import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  allowedEditAudiences,
  audienceLabel,
  buildEditedItemPayload,
  canSaveEditedContent,
} from "../src/components/community/editItemPolicy";

const page = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
const editor = readFileSync(new URL("../src/components/community/CommunityItemEditor.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/components/community/social-edit-items.css", import.meta.url), "utf8");
const server = readFileSync(new URL("../server/community/content.ts", import.meta.url), "utf8");
const routes = readFileSync(new URL("../server/community/routes.ts", import.meta.url), "utf8");

test("audience can only remain unchanged or become more restrictive", () => {
  assert.deepEqual(allowedEditAudiences("public"), ["private", "friends", "public"]);
  assert.deepEqual(allowedEditAudiences("friends"), ["private", "friends"]);
  assert.deepEqual(allowedEditAudiences("private"), ["private"]);
  assert.deepEqual(allowedEditAudiences("other" as never), []);
  assert.equal(audienceLabel("friends"), "Лише друзям");
});

test("existing attachments, source and immutable references survive edits", () => {
  const body = {
    text: "До змін",
    photos: ["aa", "bb"],
    sourceItemId: "source-1",
    strategyId: "strategy-2",
    title: "Розбір ринку",
  };
  const payload = buildEditedItemPayload(
    { revision: 5, audience: "public", body },
    "  Після змін  ",
    "friends",
  );
  assert.equal(payload.revision, 5);
  assert.equal(payload.audience, "friends");
  assert.deepEqual(payload.body, { ...body, text: "Після змін" });
  assert.deepEqual(body.photos, ["aa", "bb"]);
  assert.equal(body.text, "До змін");
});

test("editing cannot widen audience, invent revision or save empty content", () => {
  const oldItem = { revision: 2, audience: "private" as const, body: { text: "Старий допис" } };
  assert.throws(() => buildEditedItemPayload(oldItem, "Нове", "public"), /Розширення аудиторії/);
  assert.throws(() => buildEditedItemPayload({ ...oldItem, revision: 0 }, "Нове", "private"), /версію/);
  assert.throws(() => buildEditedItemPayload(oldItem, "   ", "private"), /Додайте текст/);
  assert.equal(canSaveEditedContent(" ", { title: "Назва" }, false), true);
  assert.equal(canSaveEditedContent("", { photos: ["uuid"] }, false), true);
  assert.equal(canSaveEditedContent("text", {}, true), false);
  assert.equal(canSaveEditedContent("x".repeat(20001), {}, false), false);
});

test("post and comments edit via server PATCH, not client-only fake changes", () => {
  assert.match(page, /import \{ CommunityItemEditor \} from "\.\/CommunityItemEditor"/);
  assert.match(page, /item\.owner_id === user\?\.uid/);
  assert.match(page, /comment\.owner_id === user\?\.uid && \(/);
  assert.match(page, /editingCommentId === comment\.id/);
  assert.match(page, /thread\.refresh\(\)/);
  assert.match(page, /community-item-editor/);
  assert.match(editor, /method: "PATCH"/);
  assert.match(editor, /buildEditedItemPayload\(item, text, audience\)/);
  assert.match(editor, /onSaved\(\)/);
  assert.match(editor, /onCancel/);
  assert.match(editor, /role="alert"/);
  assert.match(editor, /const inFlight = useRef\(false\)/);
  assert.match(editor, /maxLength=\{20_000\}/);
  assert.match(routes, /"patch",\s*"\/items\/:id"/);
  assert.match(server, /UPDATE hc_items SET body=\$2,revision=revision\+1,audience=\$4/);
  assert.match(server, /item\.owner_id !== rules\.viewer/);
  assert.match(server, /Для розширення аудиторії створіть окрему публікацію/);
});

test("responsive editor prevents input focus zoom and does not affect screener", () => {
  assert.match(css, /\.community-workspace \.community-item-editor/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(css, /font-size: 16px; \/\* prevent input zoom in iOS Safari \*\//);
  assert.doesNotMatch(css, /(?:^|\n)\s*(?:html|body)\s*\{/);
});
