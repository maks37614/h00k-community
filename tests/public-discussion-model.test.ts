import test from "node:test";
import assert from "node:assert/strict";
import { groupPublicComments, publicTelegramShareUrl } from "../src/community/publicDiscussionModel";

test("public thread view groups quoted replies and nested quoted replies without duplicates", () => {
  const root = { id: "root", text: "A" };
  const second = { id: "second", replyToId: "root", text: "B" };
  const third = { id: "third", replyToId: "second", text: "C" };
  const independent = { id: "independent", text: "D" };
  const grouped = groupPublicComments([root, second, third, independent]);
  assert.deepEqual(grouped.roots.map(item => item.id), ["root", "independent"]);
  assert.deepEqual(grouped.repliesByRoot.get("root")?.map(item => item.id), ["second", "third"]);
});

test("privacy-filtered comment collections never fetch or invent hidden parents", () => {
  const hiddenParent = { id: "public-reply", replyToId: "not-returned", text: "visible response" };
  const items = [hiddenParent, { id: "another" }];
  const grouped = groupPublicComments(items);
  assert.deepEqual(grouped.roots, items);
  assert.equal(grouped.repliesByRoot.size, 0);
  const cycle = groupPublicComments([{ id: "one", replyToId: "two" }, { id: "two", replyToId: "one" }]);
  assert.equal(cycle.roots.length, 2);
});

test("public Telegram shares use canonical public links and encode titles", () => {
  const link = publicTelegramShareUrl("https://community-stage.h00k.top/u/trader?post=abc", "Ідея BTC & ETH");
  const url = new URL(link);
  assert.equal(url.hostname, "t.me");
  assert.equal(url.pathname, "/share/url");
  assert.equal(url.searchParams.get("url"), "https://community-stage.h00k.top/u/trader?post=abc");
  assert.equal(url.searchParams.get("text"), "Ідея BTC & ETH");
  assert.throws(() => publicTelegramShareUrl("javascript:alert(1)", "x"));
  assert.throws(() => publicTelegramShareUrl("https://user@h00k.top/x", "x"));
});
