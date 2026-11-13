import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildFriendDirectory,
  type CommunityFriend,
} from "../src/components/community/friendsModel";

const contacts: CommunityFriend[] = [
  { id: "alice", displayName: "Alice", accepted: true, incoming: false },
  { id: "bob", displayName: "Bob", accepted: false, incoming: true },
  { id: "cora", displayName: "Cora", accepted: false, incoming: false },
];

test("directory distinguishes accepted friends, incoming and outgoing requests", () => {
  const { rows, friendsCount, requestsCount } = buildFriendDirectory(contacts, []);
  assert.equal(friendsCount, 1);
  assert.equal(requestsCount, 2);
  assert.deepEqual(rows.map(({ id, statusText }) => [id, statusText]), [
    ["alice", "Друзі"],
    ["bob", "Вхідний запит"],
    ["cora", "Запит надіслано"],
  ]);
  assert.deepEqual(buildFriendDirectory(contacts, [], "friends").rows.map((x) => x.id), ["alice"]);
  assert.deepEqual(buildFriendDirectory(contacts, [], "requests").rows.map((x) => x.id), ["bob", "cora"]);
});

test("a search hit never duplicates an existing friend or overrides an active relationship", () => {
  const search: CommunityFriend[] = [
    { id: "alice", displayName: "Alice search", friend: false },
    { id: "bob", displayName: "Bob search", friend: true },
    { id: "dora", displayName: "Dora", friend: false },
    { id: "dora", displayName: "Dora", friend: false },
  ];
  const { rows } = buildFriendDirectory(contacts, search);
  assert.deepEqual(rows.map((x) => x.id), ["alice", "bob", "cora", "dora"]);
  assert.equal(rows[0].displayName, "Alice");
  assert.equal(rows[0].isAccepted, true);
  assert.equal(rows[1].isIncoming, true);
  assert.equal(rows[1].isAccepted, false);
  assert.equal(rows[3].statusText, "Трейдер");
});

test("search-only accepted friendship hint is shown but not counted as a confirmed loaded connection", () => {
  const { rows, friendsCount } = buildFriendDirectory([], [{ id: "e", friend: true }], "friends");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].isAccepted, true);
  assert.equal(friendsCount, 0);
});

test("invalid empty contact IDs do not become selectable contact rows", () => {
  const { rows, friendsCount } = buildFriendDirectory(
    [{ id: "", accepted: true }],
    [{ id: "" }, { id: "valid", displayName: "Valid" }],
  );
  assert.deepEqual(rows.map((x) => x.id), ["valid"]);
  assert.equal(friendsCount, 0);
});

test("friends UI retains real server mutations and settings retain privacy controls", () => {
  const page = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/components/community/social-friends-settings.css", import.meta.url), "utf8");
  assert.match(page, /buildFriendDirectory\(/);
  assert.match(page, /className="community-friends-view"/);
  assert.match(page, /community-friends-tabs/);
  assert.match(page, /api \+ "\/people\?q="/);
  assert.match(page, /method: "DELETE"/);
  assert.match(page, /post\(api \+ "\/friends\/" \+ person\.id/);
  assert.match(page, /post\(api \+ "\/blocks\/" \+ person\.id/);
  assert.match(page, /window\.confirm\("Заблокувати/);
  assert.match(page, /className="community-settings-view"/);
  assert.match(page, /<AccountSecuritySettings \/>/);
  assert.match(page, /<Rankings run=\{run\} \/>/);
  assert.match(page, /savePrivacy\(field, value\)/);
  assert.match(css, /font-size: 16px; \/\* prevents iOS Safari focus zoom \*\//);
  assert.match(css, /\.community-workspace \.community-friends-view/);
  assert.match(css, /@media \(max-width: 700px\)/);
});
