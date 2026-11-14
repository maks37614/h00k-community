import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID, randomBytes, generateKeyPairSync, sign } from "node:crypto";
import { archiveScoreSigningMessage, type ArchiveScorePayload } from "../src/community/archiveScoreProof";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { request } from "node:http";
import * as OTPAuth from "otpauth";
import { migrate } from "../server/community/db";
import { installAccountRoutes } from "../server/community/account";
import { installCommunityRoutes, installMediaRoutes } from "../server/community/routes";
import { installPublicProfiles } from "../server/community/publicProfiles";
import { nameFromHost, profileName, NAME_CHANGE_INTERVAL } from "../server/community/profileNames";
import { testDatabase } from "./fixtures/community-db";
import { captureChartDocument } from "../src/community/chartDocument";
import { createItem, policy, saveChart } from "../server/community/content";

const engine = new PGlite(), db = testDatabase(engine), password = "correct horse profile password";
const saved = { ...process.env };
let server: any, base: string, directory: string, now = Date.now(), requests = 0;
type Actor = { id: string; cookie: string };
async function call(url: string, actor?: Actor, method = "GET", body?: unknown, headers: Record<string, string> = {}) {
  const requestHeaders = {
    "X-H00K-Request": "1", "X-Forwarded-For": "192.0.2." + (++requests % 250 + 1),
    ...(actor ? { Cookie: actor.cookie } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers,
  };
  const payload = body === undefined ? undefined : JSON.stringify(body);
  // Node fetch normalizes Host. Use actual HTTP headers for virtual-host boundary tests.
  const res = headers.Host ? await new Promise<Response>((resolve, reject) => {
    const req = request(base + url, { method, headers: requestHeaders }, incoming => {
      const chunks: Buffer[] = []; incoming.on("data", chunk => chunks.push(chunk));
      incoming.on("end", () => {
        const responseHeaders = new Headers();
        for (let i = 0; i < incoming.rawHeaders.length; i += 2) responseHeaders.append(incoming.rawHeaders[i], incoming.rawHeaders[i + 1]);
        resolve(new Response(Buffer.concat(chunks), { status: incoming.statusCode, headers: responseHeaders }));
      });
    });
    req.on("error", reject); req.end(payload);
  }) : await fetch(base + url, { method, headers: requestHeaders, ...(payload === undefined ? {} : { body: payload }) });
  const text = await res.text(); let data: any;
  try { data = JSON.parse(text); } catch { data = null; }
  return { res, data, text };
}
async function actor(verified = true): Promise<Actor> {
  const result = await call("/api/account/register", undefined, "POST", { email: randomUUID() + "@example.test", password, displayName: "Trader" });
  assert.equal(result.res.status, 201, result.text);
  const a = { id: result.data.user.uid, cookie: result.res.headers.getSetCookie()[0].split(";")[0] };
  if (verified) await db.query("UPDATE hc_users SET email_verified=true WHERE id=$1", [a.id]);
  return a;
}
async function claim(a: Actor, username: string) {
  return call("/api/account/username", a, "POST", { username, password });
}
async function enable(a: Actor, community: any = {}) {
  const result = await call("/api/account/profile", a, "PATCH", { community: { publicProfileEnabled: true, ...community } });
  assert.equal(result.res.status, 200, result.text);
}
async function named(name: string) { const a = await actor(); assert.equal((await claim(a, name)).res.status, 200); await enable(a); return a; }
async function post(a: Actor, body: any, audience = "public", chartId?: string) {
  const rules = await policy(db, a.id);
  return createItem(db, rules, { kind: "post", audience, body, ...(chartId ? { chartId } : {}) });
}
function snapshot() {
  const start = Math.floor(Date.now() / 60000) * 60 - 3600;
  return captureChartDocument({ symbol: "BTCUSDT", exchange: "binance", marketType: "futures", timeframe: "1m",
    candles: Array.from({ length: 50 }, (_, i) => ({ time: start + i * 60, open: 100, high: 110, low: 90, close: 102, volume: 20 })),
    markers: [{ id: "entry", type: "entry", label: "Entry", price: 100, color: "#38bdf8" }], drawings: [] });
}
test.before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "h00k-public-profiles-"));
  process.env.COMMUNITY_PROFILE_DOMAIN = "h00k.test";
  process.env.COMMUNITY_STANDALONE_ENABLED = "1";
  process.env.COMMUNITY_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.COMMUNITY_MEDIA_DIR = directory;
  await fs.writeFile(path.join(directory, "profile.html"), '<!doctype html><html><head><title>Generic</title><meta name="description" content="Generic"></head><body><div id="profile-root">public entry</div></body></html>');
  await fs.writeFile(path.join(directory, "community.html"), "<!doctype html><div id='community-root'>community entry</div>");
  await fs.mkdir(path.join(directory, "assets"));
  await fs.writeFile(path.join(directory, "assets", "fixture-123456.js"), "/* public build asset */");
  await migrate(db);
  const app = express(); app.set("trust proxy", "loopback");
  installPublicProfiles(app, () => db, directory);
  app.use(express.json());
  installAccountRoutes(app, () => db, async () => {}, () => now);
  installCommunityRoutes(app, () => db);
  installMediaRoutes(app, () => db);
  server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  base = "http://127.0.0.1:" + server.address().port; process.env.APP_ORIGIN = base;
});
test.after(async () => {
  if (server) await new Promise<void>(resolve => server.close(resolve));
  await engine.close(); await fs.rm(directory, { recursive: true, force: true });
  for (const key of ["APP_ORIGIN", "COMMUNITY_PROFILE_DOMAIN", "COMMUNITY_STANDALONE_ENABLED", "COMMUNITY_ENCRYPTION_KEY", "COMMUNITY_MEDIA_DIR"])
    if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
});

test("profile names normalize case, reject reserved/service/Unicode labels and nested or forged hosts", () => {
  assert.equal(profileName(" IvAn "), "ivan");
  for (const name of ["admin", "support", "admin-team", "support-123", "official1", "api", "mail", "www", "community-stage", "xn--alice", "h00k-owner", "іvan", "alice.", "ab", "-ivan", "ivan-"])
    assert.throws(() => profileName(name));
  assert.equal(nameFromHost("IVAN.h00k.test:443"), "ivan");
  for (const host of ["ivan.h00k.test.evil.test", "ivan.evil.h00k.test", "ivan.h00k.test@evil.test", "ivan.h00k.test,evil.test", "admin.h00k.test"])
    assert.equal(nameFromHost(host), null);
});

test("claim requires verified email, fresh credentials and cannot be forged through profile JSON", async () => {
  const a = await actor(false);
  assert.equal((await claim(a, "credential-test")).res.status, 403);
  await db.query("UPDATE hc_users SET email_verified=true WHERE id=$1", [a.id]);
  assert.equal((await call("/api/account/username", a, "POST", { username: "credential-test", password: "wrong" })).res.status, 401);
  assert.equal((await claim(a, "credential-test")).res.status, 200);
  await call("/api/account/profile", a, "PATCH", { username: "forged-name", community: { username: "forged-name" } });
  assert.equal((await call("/api/account/username", a)).data.username, "credential-test");
  assert.equal((await call("/api/public/profiles/credential-test")).res.status, 404);
  assert.equal((await call("/api/account/profile", a, "PATCH", { community: { publicProfileEnabled: "true" } })).res.status, 400);
});

test("two users cannot claim the same case-insensitive name", async () => {
  const a = await actor(), b = await actor();
  const results = await Promise.all([claim(a, "shared-name"), claim(b, "SHARED-NAME")]);
  assert.deepEqual(results.map(r => r.res.status).sort(), [200, 409]);
  assert.equal((await db.query("SELECT count(*)::integer AS n FROM hc_profile_names WHERE username='shared-name'")).rows[0].n, 1);
});

test("claim consumes the configured second factor atomically and rejects replay", async () => {
  const a = await actor();
  const setup = await call("/api/account/mfa/setup", a, "POST", { password });
  assert.equal(setup.res.status, 200, setup.text);
  const totp = new OTPAuth.TOTP({ secret: setup.data.secret });
  const previous = now; now += 30_000;
  assert.equal((await call("/api/account/mfa/confirm", a, "POST", { code: totp.generate({ timestamp: now }) })).res.status, 200);
  assert.equal((await claim(a, "mfa-person")).res.status, 401);
  now += 30_000;
  const code = totp.generate({ timestamp: now });
  assert.equal((await call("/api/account/username", a, "POST", { username: "mfa-person", password, code })).res.status, 200);
  assert.equal((await call("/api/account/username", a, "POST", { username: "mfa-person", password, code })).res.status, 401);
  now = previous;
});

test("rename observes cooldown; retired addresses cannot be reassigned and failed claims preserve the current name", async () => {
  const a = await named("old-address"), b = await named("occupied-address");
  assert.equal((await claim(a, "new-address")).res.status, 409);
  const previous = now; now += NAME_CHANGE_INTERVAL + 1;
  assert.equal((await claim(a, "occupied-address")).res.status, 409);
  assert.equal((await call("/api/account/username", a)).data.username, "old-address");
  assert.equal((await claim(a, "new-address")).res.status, 200);
  assert.equal((await call("/api/public/profiles/old-address")).res.status, 404);
  const c = await actor(); assert.equal((await claim(c, "old-address")).res.status, 409);
  const retired = (await db.query("SELECT username,owner_id FROM hc_profile_names WHERE retired_at IS NOT NULL")).rows;
  assert.ok(retired.some(row => row.username === null && row.owner_id === null));
  now = previous;
});

test("anonymous profile is a whitelist and independent opt-in; partial privacy updates preserve settings", async () => {
  const a = await named("privacy-person");
  await call("/api/account/profile", a, "PATCH", { balance: "PRIVATE_BALANCE", secret: "PRIVATE_SECRET", community: {
    bio: "private biography", bioAudience: "private", interests: "friends interests", interestsAudience: "friends",
    lifestyle: "public routine", lifestyleAudience: "public", telegram: "https://t.me/private_channel", telegramAudience: "private",
    status: { text: "private mood", audience: "private" },
  } });
  const result = await call("/api/public/profiles/privacy-person");
  assert.equal(result.res.status, 200); assert.equal(result.data.profile.lifestyle, "public routine");
  assert.equal(result.data.profile.bio, ""); assert.equal(result.data.profile.interests, ""); assert.equal(result.data.profile.telegram, "");
  assert.equal(result.data.profile.status, ""); assert.equal(result.data.profile.statistics, null);
  const shareHtml = await call("/u/privacy-person");
  assert.equal(shareHtml.res.status, 200);
  assert.match(shareHtml.text, /property="og:type" content="profile"/);
  assert.match(shareHtml.text, /name="twitter:card" content="summary"/);
  assert.match(shareHtml.text, /rel="canonical" href="https:\/\/privacy-person.h00k.test\/"/);
  assert.doesNotMatch(shareHtml.text, /PRIVATE_|private biography|friends interests|private_channel|@example.test|password_hash|mfa_secret/);
  assert.doesNotMatch(result.text, /PRIVATE_|private biography|friends interests|private_channel|@example.test|password_hash|mfa_secret/);
  assert.equal(result.res.headers.get("cache-control"), "private, no-store"); assert.equal(result.res.headers.getSetCookie().length, 0);
  assert.equal((await call("/api/account/me", a)).data.profile.community.publicProfileEnabled, true);
  await enable(a, { publicProfileEnabled: false });
  assert.equal((await call("/api/public/profiles/privacy-person")).res.status, 404);
});

test("public wall excludes private/friends material and does not serialize arbitrary body fields", async () => {
  const a = await named("wall-owner");
  const visible = await post(a, { text: "public text <script>alert(1)</script>", unknownPrivateField: "DO_NOT_SERIALIZE" });
  const friends = await post(a, { text: "friends post" }, "friends"); await post(a, { text: "private post" }, "private");
  const share = await call("/u/wall-owner?post=" + visible);
  assert.equal(share.res.status, 200);
  assert.match(share.text, /property="og:type" content="article"/);
  assert.match(share.text, /name="description" content="public text &lt;script&gt;alert\(1\)&lt;\/script&gt;"/);
  assert.match(share.text, /rel="canonical" href="https:\/\/wall-owner.h00k.test\/\?post=/);
  assert.doesNotMatch(share.text, /<script>alert\(1\)<\/script>|DO_NOT_SERIALIZE/);
  const privateLink = await call("/u/wall-owner?post=" + friends);
  assert.equal(privateLink.res.status, 200);
  assert.match(privateLink.text, /property="og:type" content="profile"/);
  assert.doesNotMatch(privateLink.text, /friends post|private post|DO_NOT_SERIALIZE/);
  const result = await call("/api/public/profiles/wall-owner/posts");
  assert.deepEqual(result.data.items.map((i: any) => i.id), [visible]);
  assert.doesNotMatch(result.text, /DO_NOT_SERIALIZE|friends post|private post|owner_id|revision/);
});

test("guest /u/ wall shows only opt-in public comments, post deep links and aggregate reactions", async () => {
  const owner = await named("social-wall-owner");
  const writer = await named("social-wall-writer");
  const hidden = await actor();
  const id = await post(owner, { text: "Public trading plan", internalNote: "SECRET_NOT_FOR_PUBLIC" });
  const root = "/api/public/profiles/social-wall-owner/posts/" + id;

  assert.equal((await call(root)).res.status, 200);
  assert.equal((await call(root + "/missing")).res.status, 404);
  assert.doesNotMatch((await call(root)).text, /SECRET_NOT_FOR_PUBLIC|owner_id|internalNote/);

  const visible = await call("/api/community/items", writer, "POST", {
    kind: "comment", audience: "public", parentId: id, body: { text: "Відкритий коментар", internalNote: "SECRET_COMMENT" },
  });
  assert.equal(visible.res.status, 201, visible.text);
  const privateComment = await call("/api/community/items", writer, "POST", {
    kind: "comment", audience: "private", parentId: id, body: { text: "НЕ ПУБЛІКУВАТИ КОМЕНТАР" },
  });
  assert.equal(privateComment.res.status, 201, privateComment.text);
  const noConsent = await call("/api/community/items", hidden, "POST", {
    kind: "comment", audience: "public", parentId: id, body: { text: "НЕ ЗГОДЕН НА ПУБЛІЧНИЙ ПРОФІЛЬ" },
  });
  assert.equal(noConsent.res.status, 201, noConsent.text);

  const quoted = await call("/api/community/items", owner, "POST", {
    kind: "comment", audience: "public", parentId: id,
    body: { text: "Дякую за аналіз", sourceItemId: visible.data.id },
  });
  assert.equal(quoted.res.status, 201, quoted.text);
  const react = await call("/api/community/items/" + id + "/reaction", writer, "POST", { emoji: "❤️" });
  assert.equal(react.res.status, 200, react.text);

  const page = await call("/api/public/profiles/social-wall-owner/posts");
  assert.equal(page.res.status, 200);
  const listed = page.data.items.find((item: any) => item.id === id);
  assert.ok(listed);
  assert.deepEqual(listed.reactions, [{ emoji: "❤️", count: 1 }]);

  const single = await call(root);
  assert.equal(single.res.status, 200, single.text);
  assert.deepEqual(single.data.item.reactions, [{ emoji: "❤️", count: 1 }]);
  assert.doesNotMatch(single.text, /user_id|email|internalNote/);

  const discussion = await call(root + "/comments");
  assert.equal(discussion.res.status, 200, discussion.text);
  assert.equal(discussion.data.items.length, 2);
  assert.deepEqual(discussion.data.items.map((item: any) => item.text), ["Відкритий коментар", "Дякую за аналіз"]);
  assert.equal(discussion.data.items[1].quote, "Відкритий коментар");
  assert.equal(discussion.data.items[0].replyToId, null);
  assert.equal(discussion.data.items[1].replyToId, visible.data.id);
  assert.doesNotMatch(discussion.text, /SECRET_COMMENT|НЕ ПУБЛІКУВАТИ|НЕ ЗГОДЕН|owner_id|cookie|email|internalNote/);

  // The data model intentionally keeps all comments attached to the post.
  // Nested discussion is represented by a privacy-checked sourceItemId.
  const nested = await call("/api/community/items", writer, "POST", {
    kind: "comment", audience: "public", parentId: id,
    body: { text: "Друга відповідь у гілці", sourceItemId: quoted.data.id },
  });
  assert.equal(nested.res.status, 201, nested.text);
  const grouped = await call(root + "/comments");
  assert.equal(grouped.data.items.length, 3);
  assert.equal(grouped.data.items[2].replyToId, quoted.data.id);
  assert.doesNotMatch(grouped.text, /SECRET_COMMENT|НЕ ПУБЛІКУВАТИ|НЕ ЗГОДЕН|email|password_hash/);

  // Direct links must enforce the same privacy policy and safe allowlist as a page.
  const direct = await call(root + "/comments/" + visible.data.id);
  assert.equal(direct.res.status, 200, direct.text);
  assert.equal(direct.data.item.text, "Відкритий коментар");
  assert.deepEqual(direct.data.item, grouped.data.items[0]);
  assert.doesNotMatch(direct.text, /SECRET_COMMENT|owner_id|email|password_hash|internalNote/);
  const nestedDirect = await call(root + "/comments/" + nested.data.id);
  assert.equal(nestedDirect.res.status, 200);
  assert.equal(nestedDirect.data.item.replyToId, quoted.data.id);
  assert.equal((await call(root + "/comments/" + privateComment.data.id)).res.status, 404);
  assert.equal((await call(root + "/comments/" + noConsent.data.id)).res.status, 404);
  assert.equal((await call(root + "/comments/" + randomUUID())).res.status, 404);
  assert.equal((await call(root + "/comments/not-a-uuid")).res.status, 400);

  // An older comment is reachable without walking all paginated comments.
  await db.query(
    `INSERT INTO hc_items(id, owner_id, kind, audience, parent_id, body, created_at)
       SELECT gen_random_uuid(), $1, 'comment', 'public', $2,
              jsonb_build_object('text','Older discussion '||n),
              now() + n * INTERVAL '1 second'
       FROM generate_series(1,25) n`,
    [writer.id,id],
  );
  const late = (await db.query(
    "SELECT id FROM hc_items WHERE parent_id=$1 AND body->>'text'='Older discussion 25'",
    [id],
  )).rows[0].id;
  const firstPage = await call(root + "/comments");
  assert.ok(firstPage.data.items.length > 0 && firstPage.data.items.length <= 20);
  // Hidden/private authors are filtered from the bounded SQL page.
  assert.doesNotMatch(firstPage.text, /НЕ ПУБЛІКУВАТИ КОМЕНТАР|НЕ ЗГОДЕН НА ПУБЛІЧНИЙ ПРОФІЛЬ/);
  assert.ok(!firstPage.data.items.some((item: any) => item.id === late));
  assert.equal((await call(root + "/comments/" + late)).data.item.text, "Older discussion 25");

  await enable(writer, { publicProfileEnabled: false });
  const revoked = await call(root + "/comments");
  assert.equal(revoked.res.status, 200);
  assert.deepEqual(revoked.data.items, []); // quoted descendants close with their source
  assert.equal((await call(root + "/comments/" + visible.data.id)).res.status, 404);
  assert.equal((await call(root + "/comments/" + late)).res.status, 404);
  assert.equal((await call(root + "/comments/" + nested.data.id)).res.status, 404);
  assert.equal((await call(root)).res.status, 200); // owner's post remains public
  await enable(owner, { publicProfileEnabled: false });
  assert.equal((await call(root)).res.status, 404);
  assert.equal((await call(root + "/comments")).res.status, 404);
});

test("social public comments show only consented same-owner media, with revocation and wildcard-host checks", async () => {
  const owner = await named("portrait-comments-owner");
  const author = await named("portrait-comments-author");
  const another = await named("portrait-comments-foreign");
  const id = await post(owner, { text: "Публічний розбір" });
  const visible = await call("/api/community/items", author, "POST", {
    kind: "comment", audience: "public", parentId: id, body: { text: "Мій коментар" },
  });
  assert.equal(visible.res.status, 201, visible.text);
  const privateComment = await call("/api/community/items", author, "POST", {
    kind: "comment", audience: "private", parentId: id, body: { text: "Лише я" },
  });
  assert.equal(privateComment.res.status, 201, privateComment.text);
  const root = "/api/public/profiles/portrait-comments-owner/posts/" + id;
  const image = root + "/comments/" + visible.data.id + "/avatar";
  const foreignImage = randomUUID();
  const avatar = randomUUID();
  await db.query("INSERT INTO hc_media(id,owner_id,bytes) VALUES($1,$2,4),($3,$4,4)",
    [avatar, author.id, foreignImage, another.id]);
  await fs.writeFile(path.join(directory, avatar + ".webp"), Buffer.from("RIFF"));
  await fs.writeFile(path.join(directory, foreignImage + ".webp"), Buffer.from("RIFF"));

  assert.equal((await call("/api/account/profile", author, "PATCH", {
    community: { avatarMediaId: foreignImage, avatarAudience: "public" },
  })).res.status, 403);
  await enable(author, { avatarMediaId: avatar, avatarAudience: "private" });
  let comments = await call(root + "/comments");
  assert.equal(comments.data.items[0].authorAvatarUrl, null);
  assert.equal((await call(image)).res.status, 404);

  await enable(author, { avatarAudience: "public" });
  comments = await call(root + "/comments");
  assert.equal(comments.res.status, 200, comments.text);
  assert.equal(comments.data.items[0].authorAvatarUrl, image);
  assert.doesNotMatch(comments.text, new RegExp(avatar + "|" + foreignImage));
  const result = await call(image);
  assert.equal(result.res.status, 200);
  assert.match(result.res.headers.get("content-type") ?? "", /image\/webp/);
  assert.equal(result.res.headers.get("cache-control"), "private, no-store");
  assert.equal((await call(image, undefined, "GET", undefined, {
    Host: "portrait-comments-owner.h00k.test",
  })).res.status, 200);
  assert.equal((await call(image, undefined, "GET", undefined, {
    Host: "portrait-comments-author.h00k.test",
  })).res.status, 404);

  assert.equal((await call(root + "/comments/" + privateComment.data.id + "/avatar")).res.status, 404);
  await enable(author, { avatarAudience: "private" });
  assert.equal((await call(image)).res.status, 404);
  assert.equal((await call(root + "/comments")).data.items[0].authorAvatarUrl, null);
  await enable(author, { avatarAudience: "public", publicProfileEnabled: false });
  assert.equal((await call(image)).res.status, 404);
  assert.equal((await call(root + "/comments")).data.items.length, 0);
});

test("owner can feature only own public posts and revocation hides the pinned post immediately", async () => {
  const owner = await named("featured-trader");
  const another = await named("featured-other");
  const featuredId = await post(owner, { title: "Перевірений відкритий розбір", text: "Реальна ідея, без прихованих полів" });
  const privateId = await post(owner, { title: "Секретний розбір", text: "PRIVATE_FEATURED_CONTENT" }, "private");
  const foreignId = await post(another, { title: "Чужий допис", text: "Інший власник" });

  const endpoint = "/api/account/profile";
  const pin = (actor: Actor, id: any) => call(endpoint, actor, "PATCH", {
    community: { featuredPublicPostId: id },
  });
  assert.equal((await pin(owner, "not-a-uuid")).res.status, 400);
  assert.equal((await pin(owner, foreignId)).res.status, 403);
  assert.equal((await pin(owner, privateId)).res.status, 403);
  assert.equal((await pin(another, featuredId)).res.status, 403);
  const result = await pin(owner, featuredId);
  assert.equal(result.res.status, 200, result.text);
  assert.equal(result.data.profile.community.featuredPublicPostId, featuredId);

  const publicUrl = "/api/public/profiles/featured-trader";
  const first = await call(publicUrl);
  assert.equal(first.res.status, 200, first.text);
  assert.equal(first.data.profile.featuredPost.id, featuredId);
  assert.equal(first.data.profile.featuredPost.title, "Перевірений відкритий розбір");
  assert.doesNotMatch(first.text, /PRIVATE_FEATURED_CONTENT|password_hash|privateId|mfa_secret/);

  // Direct SQL audience change represents an independent edit outside the pin UI.
  await db.query("UPDATE hc_items SET audience='private' WHERE id=$1", [featuredId]);
  const hidden = await call(publicUrl);
  assert.equal(hidden.res.status, 200);
  assert.equal(hidden.data.profile.featuredPost, null);
  assert.doesNotMatch(hidden.text, /Реальна ідея/);
  await db.query("UPDATE hc_items SET audience='public' WHERE id=$1", [featuredId]);
  assert.equal((await call(publicUrl)).data.profile.featuredPost?.id, featuredId);
  await db.query("UPDATE hc_items SET deleted=true WHERE id=$1", [featuredId]);
  assert.equal((await call(publicUrl)).data.profile.featuredPost, null);

  const unpin = await pin(owner, null);
  assert.equal(unpin.res.status, 200, unpin.text);
  assert.equal(unpin.data.profile.community.featuredPublicPostId, null);
  assert.equal((await call(publicUrl)).data.profile.featuredPost, null);
});

test("saved public chart is fetched only explicitly and revocation closes direct chart links", async () => {
  const a = await named("chart-owner"), document = snapshot();
  const id = await saveChart(db, await policy(db, a.id), document), item = await post(a, { text: "saved setup" }, "public", id);
  const wall = await call("/api/public/profiles/chart-owner/posts");
  assert.equal(wall.data.items[0].chart.symbol, "BTCUSDT");
  const full = await call(`/api/public/profiles/chart-owner/posts/${item}/chart`);
  assert.equal(full.res.status, 200); assert.equal(full.data.document.markers[0].price, 100);
  full.data.document.markers[0].price = 900;
  assert.equal((await call(`/api/public/profiles/chart-owner/posts/${item}/chart`)).data.document.markers[0].price, 100);
  await db.query("UPDATE hc_items SET audience='friends' WHERE id=$1", [item]);
  assert.equal((await call(`/api/public/profiles/chart-owner/posts/${item}/chart`)).res.status, 404);
  assert.equal((await call("/api/public/profiles/chart-owner/posts")).data.items.length, 0);
});

test("chart-only setups publish to the public gallery without synthetic text or quality scores", async () => {
  const owner = await named("chart-only-owner"), other = await named("chart-only-other");
  const chartId = await saveChart(db, await policy(db, owner.id), snapshot());
  const foreignChartId = await saveChart(db, await policy(db, other.id), snapshot());

  // Empty ordinary posts must remain forbidden. An unauthorized chart
  // attachment cannot bypass this validation or another user's ownership.
  await assert.rejects(() => post(owner, { text: "", category: "analysis" }), /Додайте текст/);
  await assert.rejects(
    () => post(owner, { text: "", category: "analysis" }, "public", foreignChartId),
    /Спершу створіть власну відповідь графіком/,
  );
  await assert.rejects(
    () => post(owner, { text: "" }, "public", "invalid-chart-id"),
  );

  const id = await post(owner, {
    text: "", title: "", category: "analysis",
    qualityScore: 99, verified: true, hiddenNotes: "SECRET_CHART_ONLY_NOTE",
  }, "public", chartId);

  const list = await call("/api/public/profiles/chart-only-owner/posts?withChart=1&category=analysis");
  assert.equal(list.res.status, 200, list.text);
  assert.deepEqual(list.data.items.map((item: any) => item.id), [id]);
  const card = list.data.items[0];
  assert.equal(card.text, "");
  assert.equal(card.title, "");
  assert.equal(card.category, "analysis");
  assert.equal(card.chart.symbol, "BTCUSDT");
  assert.equal(card.chart.markers[0].type, "entry");
  assert.equal(card.chart.markers[0].price, 100);
  assert.equal(card.qualityScore, undefined);
  assert.equal(card.verified, undefined);
  assert.doesNotMatch(list.text, /SECRET_CHART_ONLY_NOTE|qualityScore|verified|confidence/);

  const full = await call("/api/public/profiles/chart-only-owner/posts/" + id + "/chart");
  assert.equal(full.res.status, 200, full.text);
  assert.equal(full.data.document.symbol, "BTCUSDT");

  // The same source becomes inaccessible as soon as its post is not public.
  await db.query("UPDATE hc_items SET audience='friends' WHERE id=$1", [id]);
  const revoked = await call("/api/public/profiles/chart-only-owner/posts?withChart=1");
  assert.deepEqual(revoked.data.items, []);
  assert.equal((await call("/api/public/profiles/chart-only-owner/posts/" + id + "/chart")).res.status, 404);
});

test("signed h00k archive score survives an authorized public chart, then disappears on privacy revocation", async () => {
  const owner = await named("signed-quality-owner"), now = Date.now();
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicBase64 = Buffer.from(publicKey.export({ type: "spki", format: "pem" })).toString("base64");
  const oldKey = process.env.H00K_QUALITY_VERIFY_KEY_B64;
  process.env.H00K_QUALITY_VERIFY_KEY_B64 = publicBase64;
  try {
    const source = snapshot();
    source.markers.push(
      { id: "saved-s", type: "stop_loss", label: "SL", price: 95, color: "#ff0000" },
      { id: "saved-t", type: "target", label: "TP", price: 110, color: "#00ff00" },
    );
    const payload: ArchiveScorePayload = {
      version: 1, issuer: "h00k.top", purpose: "archive-score-record", rubric: "regular-flow-72-13-15-v1",
      archiveId: "arch_approved_1", symbol: "BTCUSDT", exchange: "binance",
      marketType: "futures", timeframe: "1m", score: 83,
      entry: 100, stop: 95, target: 110,
      assessedAt: now - 60_000, issuedAt: now, expiresAt: now + 600_000,
    };
    const qualityProof = {
      payload, signature: sign(null, Buffer.from(archiveScoreSigningMessage(payload)), privateKey).toString("base64url"),
    };
    const rules = await policy(db, owner.id);
    const id = await saveChart(db, rules, { ...source, qualityProof });
    const published = await post(owner, { text: "", category: "analysis" }, "public", id);
    const publicUrl = "/api/public/profiles/signed-quality-owner/posts";
    const list = await call(publicUrl + "?withChart=1");
    assert.equal(list.res.status, 200, list.text);
    assert.equal(list.data.items[0].chart.qualityProof.payload.score, 83);
    assert.equal(list.data.items[0].chart.qualityProof.payload.issuer, "h00k.top");
    assert.equal(list.data.items[0].chart.qualityProof.payload.purpose, "archive-score-record");
    const full = await call(publicUrl + "/" + published + "/chart");
    assert.equal(full.res.status, 200, full.text);
    assert.equal(full.data.document.qualityProof.payload.score, 83);
    assert.doesNotMatch(full.text, /PRIVATE_SIGNING_KEY|passphrase|accountId/);

    await assert.rejects(() => saveChart(db, rules, {
      ...source, qualityProof: { ...qualityProof, payload: { ...payload, score: 100 } },
    }), /Підпис архівної оцінки недійсний/);
    await assert.rejects(() => saveChart(db, rules, {
      ...source, qualityProof,
      markers: source.markers.filter(row => row.type !== "target"),
    }), /Оцінка не відповідає/);
    await assert.rejects(() => saveChart(db, rules, { ...source, qualityProof }, id),
      /лише для нового власного графіка/);

    await db.query("UPDATE hc_items SET audience='friends' WHERE id=$1", [published]);
    assert.deepEqual((await call(publicUrl + "?withChart=1")).data.items, []);
    assert.equal((await call(publicUrl + "/" + published + "/chart")).res.status, 404);
  } finally {
    if (oldKey === undefined) delete process.env.H00K_QUALITY_VERIFY_KEY_B64;
    else process.env.H00K_QUALITY_VERIFY_KEY_B64 = oldKey;
  }
});

test("private source charts and disabled source owners cannot be exposed by public descendants", async () => {
  const source = await named("source-person"), reply = await named("reply-person"), document = snapshot();
  const parent = await saveChart(db, await policy(db, source.id), document);
  const parentPost = await post(source, { text: "original" }, "public", parent);
  const fork = await saveChart(db, await policy(db, reply.id), document, parent);
  const replyPost = await post(reply, { text: "alternative" }, "public", fork);
  await post(reply, { text: "repost commentary", sourceItemId: parentPost });
  assert.equal((await call(`/api/public/profiles/reply-person/posts/${replyPost}/chart`)).res.status, 200);
  await db.query("UPDATE hc_items SET audience='private' WHERE id=$1", [parentPost]);
  assert.equal((await call(`/api/public/profiles/reply-person/posts/${replyPost}/chart`)).res.status, 404);
  assert.equal((await call("/api/public/profiles/reply-person/posts")).data.items.length, 0);
  await db.query("UPDATE hc_items SET audience='public' WHERE id=$1", [parentPost]);
  await enable(source, { publicProfileEnabled: false });
  assert.equal((await call(`/api/public/profiles/reply-person/posts/${replyPost}/chart`)).res.status, 404);
});

test("public photos require both a visible post and its owner's media, checked on every read", async () => {
  const a = await named("photo-person"), media = randomUUID(), unlinked = randomUUID();
  await db.query("INSERT INTO hc_media(id,owner_id,bytes) VALUES($1,$3,4),($2,$3,4)", [media, unlinked, a.id]);
  await fs.writeFile(path.join(directory, media + ".webp"), Buffer.from("RIFF"));
  const item = await post(a, { text: "photo", photos: [media] });
  const url = `/api/public/profiles/photo-person/posts/${item}/media/`;
  assert.equal((await call(url + media)).res.status, 200);
  assert.equal((await call(url + unlinked)).res.status, 404);
  await db.query("UPDATE hc_items SET audience='private' WHERE id=$1", [item]);
  assert.equal((await call(url + media)).res.status, 404);
});

test("media library lists only own photos, is bounded, paginated and cannot publish on selection", async () => {
  const owner = await actor(), another = await actor();
  const ids = Array.from({ length: 23 }, () => randomUUID());
  const foreign = randomUUID();
  for (let index = 0; index < ids.length; index++) {
    await db.query(
      "INSERT INTO hc_media(id,owner_id,bytes,created_at) VALUES($1,$2,123,now()-($3 * interval '1 minute'))",
      [ids[index], owner.id, index],
    );
  }
  await db.query("INSERT INTO hc_media(id,owner_id,bytes) VALUES($1,$2,456)", [foreign, another.id]);

  assert.equal((await call("/api/community/media/library")).res.status, 401);
  const first = await call("/api/community/media/library", owner);
  assert.equal(first.res.status, 200, first.text);
  assert.equal(first.data.items.length, 18);
  assert.equal(first.data.items[0].id, ids[0]);
  assert.equal(first.data.items[17].id, ids[17]);
  assert.equal(first.data.next, ids[17]);
  assert.equal(first.res.headers.get("cache-control"), "private, no-store");
  assert.equal(first.data.items.some((item: any) => item.id === foreign), false);
  assert.doesNotMatch(first.text, /owner_id|ownerId|email|password|profile/);

  const second = await call("/api/community/media/library?before=" + first.data.next, owner);
  assert.equal(second.res.status, 200, second.text);
  assert.deepEqual(second.data.items.map((item: any) => item.id), ids.slice(18));
  assert.equal(second.data.next, null);
  assert.deepEqual((await call("/api/community/media/library?before=" + foreign, owner)).data.items, []);
  assert.equal((await call("/api/community/media/library?before=wrong", owner)).res.status, 400);
  assert.equal((await call("/api/community/media/" + foreign, owner)).res.status, 404);

  // Selecting an existing photo still relies on the account PATCH ownership
  // gate and remains private until explicitly opened.
  assert.equal((await call("/api/account/profile", owner, "PATCH", {
    community: { avatarMediaId: ids[0], avatarAudience: "private" },
  })).res.status, 200);
  assert.equal((await call("/api/account/profile", owner, "PATCH", {
    community: { coverMediaId: foreign, coverAudience: "public" },
  })).res.status, 403);
  const mine = await call("/api/account/me", owner);
  assert.equal(mine.data.profile.community.avatarMediaId, ids[0]);
  assert.equal(mine.data.profile.community.avatarAudience, "private");
});

test("public /u/ avatar and cover require same-owner media and explicit public consent", async () => {
  const owner = await named("portrait-owner"), other = await named("portrait-other");
  const avatar = randomUUID(), cover = randomUUID(), foreign = randomUUID();
  await db.query(
    "INSERT INTO hc_media(id,owner_id,bytes) VALUES($1,$3,4),($2,$3,4)",
    [avatar, cover, owner.id],
  );
  await db.query("INSERT INTO hc_media(id,owner_id,bytes) VALUES($1,$2,4)", [foreign, other.id]);
  for (const id of [avatar, cover, foreign])
    await fs.writeFile(path.join(directory, id + ".webp"), Buffer.from("RIFF"));

  const foreignAttempt = await call("/api/account/profile", owner, "PATCH", {
    community: { avatarMediaId: foreign, avatarAudience: "public" },
  });
  assert.equal(foreignAttempt.res.status, 403, foreignAttempt.text);
  assert.equal((await call("/api/account/me", owner)).data.profile.community.avatarMediaId, undefined);
  assert.equal((await call("/api/account/profile", owner, "PATCH", {
    community: { coverMediaId: "not-a-uuid" },
  })).res.status, 400);

  const saved = await call("/api/account/profile", owner, "PATCH", {
    community: { avatarMediaId: avatar, coverMediaId: cover },
  });
  assert.equal(saved.res.status, 200, saved.text);
  const prefix = "/api/public/profiles/portrait-owner";
  const privateProfile = await call(prefix);
  assert.equal(privateProfile.data.profile.avatarUrl, null);
  assert.equal(privateProfile.data.profile.coverUrl, null);
  assert.equal((await call(prefix + "/avatar")).res.status, 404);
  assert.equal((await call(prefix + "/cover")).res.status, 404);

  const exposed = await call("/api/account/profile", owner, "PATCH", {
    community: { avatarAudience: "public", coverAudience: "public" },
  });
  assert.equal(exposed.res.status, 200, exposed.text);
  const publicProfile = await call(prefix);
  assert.equal(publicProfile.data.profile.avatarUrl, prefix + "/avatar");
  assert.equal(publicProfile.data.profile.coverUrl, prefix + "/cover");
  assert.doesNotMatch(publicProfile.text, new RegExp(avatar + "|" + cover + "|" + foreign));

  const avatarImage = await call(prefix + "/avatar");
  assert.equal(avatarImage.res.status, 200);
  assert.match(avatarImage.res.headers.get("content-type") || "", /image\/webp/);
  assert.equal(avatarImage.res.headers.get("cache-control"), "private, no-store");
  assert.equal(avatarImage.res.headers.getSetCookie().length, 0);
  assert.equal((await call(prefix + "/cover")).res.status, 200);
  const withCover = await call("/u/portrait-owner");
  assert.match(withCover.text, /property="og:image" content="https:\/\/portrait-owner.h00k.test\/api\/public\/profiles\/portrait-owner\/cover"/);
  assert.match(withCover.text, /name="twitter:card" content="summary_large_image"/);
  assert.equal((await call(prefix + "/avatar", undefined, "GET", undefined, {
    Host: "portrait-owner.h00k.test",
  })).res.status, 200);

  await call("/api/account/profile", owner, "PATCH", { community: { coverAudience: "private" } });
  assert.equal((await call(prefix + "/cover")).res.status, 404);
  assert.equal((await call(prefix + "/avatar")).res.status, 200);
  assert.match((await call("/u/portrait-owner")).text, /property="og:image" content="https:\/\/portrait-owner.h00k.test\/api\/public\/profiles\/portrait-owner\/avatar"/);

  await call("/api/account/profile", owner, "PATCH", { community: { avatarMediaId: null } });
  assert.equal((await call(prefix + "/avatar")).res.status, 404);
  assert.doesNotMatch((await call("/u/portrait-owner")).text, /property="og:image"/);

  await call("/api/account/profile", owner, "PATCH", { community: { coverAudience: "public" } });
  await enable(owner, { publicProfileEnabled: false });
  assert.equal((await call(prefix + "/cover")).res.status, 404);
  assert.equal((await call(prefix)).res.status, 404);
});

test("statistics and amounts have independent opt-ins, with no trade rows, notes or account credentials", async () => {
  const a = await named("stats-person"), connection = randomUUID();
  await db.query("INSERT INTO hc_connections(id,owner_id,exchange,account_hash,credential) VALUES($1,$2,'bybit',$3,'SECRET_CREDENTIAL')", [connection, a.id, randomUUID()]);
  for (const [i, pnl] of [10, 20, -5, 0].entries()) await db.query(
    "INSERT INTO hc_trades(connection_id,source_id,owner_id,symbol,currency,pnl,closed_at,source) VALUES($1,$2,$3,'BTCUSDT','USDT',$4,now(),$5)",
    [connection, "order-" + i, a.id, pnl, { privateAccount: "PRIVATE_ACCOUNT" }],
  );
  assert.equal((await call("/api/public/profiles/stats-person")).data.profile.statistics, null);
  await enable(a, { statisticsAudience: "public", amountsAudience: "private", tradesAudience: "public", notesAudience: "public" });
  const response = await call("/api/public/profiles/stats-person");
  const total = response.data.profile.statistics.totals[0];
  assert.equal(total.count, 4); assert.equal(total.winRate, 2 / 3 * 100); assert.equal(total.pnl, undefined);
  assert.doesNotMatch(response.text, /SECRET_CREDENTIAL|PRIVATE_ACCOUNT|order-|BTCUSDT|connection_id|notes|balance/);
  await enable(a, { amountsAudience: "public" });
  assert.match((await call("/api/public/profiles/stats-person")).data.profile.statistics.totals[0].pnl, /^25(?:\.0+)?$/);
});

test("public trade periods aggregate only real closed orders and honor independent amount privacy", async () => {
  const a = await named("stats-windows-person"), connection = randomUUID();
  await db.query(
    "INSERT INTO hc_connections(id,owner_id,exchange,account_hash,credential) VALUES($1,$2,'bybit',$3,'HIDDEN_WINDOW_CREDENTIAL')",
    [connection, a.id, randomUUID()],
  );
  const rows: Array<[string, number, number]> = [
    ["USDT", 100, 1], ["USDT", -20, 5], ["USDT", 0, 12], ["USDT", 10, 45],
    ["USDC", -7, 2], ["USDC", 12, 20], ["USDC", 55, 60],
    ["BTC", 2, 100],
  ];
  for (const [i, [currency, pnl, daysAgo]] of rows.entries()) {
    await db.query(
      `INSERT INTO hc_trades(connection_id,source_id,owner_id,symbol,currency,pnl,closed_at,source)
       VALUES($1,$2,$3,'HIDDEN_ORDER_SYMBOL',$4,$5,now()-($6::integer * interval '1 day'),$7)`,
      [connection, "private-window-order-" + i, a.id, currency, pnl, daysAgo, { privateAccount: "PRIVATE_WINDOW_ACCOUNT" }],
    );
  }
  // A malformed future-dated imported close must never count in rolling 7/30-day windows.
  await db.query(
    `INSERT INTO hc_trades(connection_id,source_id,owner_id,symbol,currency,pnl,closed_at,source)
     VALUES($1,'future-window-order',$2,'HIDDEN_ORDER_SYMBOL','USDT',9999,now()+interval '3 days',$3)`,
    [connection, a.id, { privateAccount: "PRIVATE_WINDOW_ACCOUNT" }],
  );
  assert.equal((await call("/api/public/profiles/stats-windows-person")).data.profile.statistics, null);
  await enable(a, { statisticsAudience: "public", amountsAudience: "private", tradesAudience: "public" });
  const first = await call("/api/public/profiles/stats-windows-person");
  assert.equal(first.res.status, 200, first.text);
  const statistics = first.data.profile.statistics;
  assert.equal(statistics.basis, "bybit-linear-closed-orders");
  assert.equal(statistics.totals.length, 3);
  assert.deepEqual(statistics.windows.map((x: any) => x.days), [7, 30]);
  const seven = statistics.windows[0].totals;
  const thirty = statistics.windows[1].totals;
  assert.deepEqual(seven.map((x: any) => [x.currency, x.count]), [["USDC", 1], ["USDT", 2]]);
  assert.deepEqual(thirty.map((x: any) => [x.currency, x.count]), [["USDC", 2], ["USDT", 3]]);
  const sUSDT = seven.find((x: any) => x.currency === "USDT");
  assert.equal(sUSDT.wins, 1); assert.equal(sUSDT.losses, 1); assert.equal(sUSDT.flat, 0);
  assert.equal(sUSDT.winRate, 50);
  const thirtyUSDT = thirty.find((x: any) => x.currency === "USDT");
  assert.equal(thirtyUSDT.count, 3); assert.equal(thirtyUSDT.flat, 1);
  assert.equal(thirtyUSDT.winRate, 50);
  assert.ok(statistics.totals.every((x: any) => x.pnl === undefined));
  assert.ok(statistics.windows.every((w: any) => w.totals.every((x: any) => x.pnl === undefined)));
  assert.doesNotMatch(first.text, /PRIVATE_WINDOW_ACCOUNT|HIDDEN_WINDOW_CREDENTIAL|HIDDEN_ORDER_SYMBOL|private-window-order-|connection_id|source_id/);

  await enable(a, { amountsAudience: "public" });
  const permitted = await call("/api/public/profiles/stats-windows-person");
  const permittedUSDT7 = permitted.data.profile.statistics.windows[0].totals.find((x: any) => x.currency === "USDT");
  const permittedUSDT30 = permitted.data.profile.statistics.windows[1].totals.find((x: any) => x.currency === "USDT");
  const permittedUSDC7 = permitted.data.profile.statistics.windows[0].totals.find((x: any) => x.currency === "USDC");
  assert.equal(Number(permittedUSDT7.pnl), 80);
  assert.equal(Number(permittedUSDT30.pnl), 80);
  assert.equal(Number(permittedUSDC7.pnl), -7);
  assert.ok(permitted.data.profile.statistics.windows[0].totals.every((x: any) => x.currency !== "BTC"));
  assert.doesNotMatch(permitted.text, /PRIVATE_WINDOW_ACCOUNT|HIDDEN_WINDOW_CREDENTIAL|HIDDEN_ORDER_SYMBOL|private-window-order-/);

  await enable(a, { statisticsAudience: "private" });
  const revoked = await call("/api/public/profiles/stats-windows-person");
  assert.equal(revoked.data.profile.statistics, null);
  assert.doesNotMatch(revoked.text, /"windows":|"pnl":/);
});

test("public daily history is lazy, owner-scoped, UTC-bounded and never exposes trade sums or private rows", async () => {
  const a = await named("daily-history-person"), other = await named("daily-other-person");
  const connection = randomUUID(), foreign = randomUUID();
  await db.query(
    "INSERT INTO hc_connections(id,owner_id,exchange,account_hash,credential) VALUES($1,$2,'bybit',$3,'SECRET_DAILY_CREDENTIAL')",
    [connection, a.id, randomUUID()],
  );
  await db.query(
    "INSERT INTO hc_connections(id,owner_id,exchange,account_hash,credential) VALUES($1,$2,'bybit',$3,'FOREIGN_DAILY_CREDENTIAL')",
    [foreign, other.id, randomUUID()],
  );
  const rows: Array<[string, string, string]> = [
    ["daily-positive", "USDT", "10"],
    ["daily-negative", "USDC", "-5"],
    ["daily-zero", "USDT", "0"],
  ];
  for (const [sourceId,currency,pnl] of rows) await db.query(
    `INSERT INTO hc_trades(connection_id,source_id,owner_id,symbol,currency,pnl,closed_at,source)
      VALUES($1,$2,$3,'SECRET_DAILY_SYMBOL',$4,$5,now(),$6)`,
    [connection, sourceId, a.id, currency, pnl, { privateAccount:"PRIVATE_DAILY_NOTES" }],
  );
  await db.query(
    `INSERT INTO hc_trades(connection_id,source_id,owner_id,symbol,currency,pnl,closed_at,source)
      VALUES($1,'daily-old',$2,'SECRET_DAILY_SYMBOL','USDT',300,now()-interval '40 days','{}')`,
    [connection, a.id],
  );
  await db.query(
    `INSERT INTO hc_trades(connection_id,source_id,owner_id,symbol,currency,pnl,closed_at,source)
      VALUES($1,'daily-future',$2,'SECRET_DAILY_SYMBOL','USDT',100,now()+interval '5 days','{}')`,
    [connection, a.id],
  );
  await db.query(
    `INSERT INTO hc_trades(connection_id,source_id,owner_id,symbol,currency,pnl,closed_at,source)
      VALUES($1,'daily-foreign',$2,'SECRET_DAILY_SYMBOL','USDT',999,now(),'{}')`,
    [foreign, other.id],
  );
  const url = "/api/public/profiles/daily-history-person/statistics/daily";
  assert.equal((await call(url)).res.status, 404);
  await enable(a, { statisticsAudience: "public", amountsAudience: "public", tradesAudience: "private" });
  const response = await call(url);
  assert.equal(response.res.status, 200, response.text);
  assert.equal(response.data.success, true);
  assert.equal(response.data.days, 30);
  assert.equal(response.data.timezone, "UTC");
  assert.match(response.data.through, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(response.data.items.length, 1);
  const day = response.data.items[0];
  assert.equal(day.day, response.data.through);
  assert.deepEqual([day.count, day.wins, day.losses, day.flat], [3,1,1,1]);
  assert.equal(day.pnl, undefined);
  assert.deepEqual(Object.keys(day).sort(), ["count","day","flat","losses","wins"]);
  assert.doesNotMatch(response.text, /SECRET_DAILY_|PRIVATE_DAILY_|FOREIGN_DAILY_|daily-positive|daily-negative|daily-zero|daily-old|daily-future|daily-foreign|USDT|USDC|connection_id|source_id|pnl/);
  // A viewer must not query another owner's daily data via a personal subdomain.
  assert.equal((await call(url, undefined, "GET", undefined, { Host: "daily-other-person.h00k.test" })).res.status, 404);

  await enable(a, { statisticsAudience: "private" });
  assert.equal((await call(url)).res.status, 404);
});

test("personal hosts cannot mutate, use private APIs, impersonate another host or receive session cookies", async () => {
  const a = await named("host-person");
  assert.equal((await call("/", undefined, "GET", undefined, { Host: "host-person.h00k.test" })).res.status, 200);
  assert.equal((await call("/api/account/me", a, "GET", undefined, { Host: "host-person.h00k.test" })).res.status, 404);
  const mutation = await call("/api/account/logout", a, "POST", {}, { Host: "host-person.h00k.test" });
  assert.equal(mutation.res.status, 405); assert.equal(mutation.res.headers.getSetCookie().length, 0);
  assert.equal((await call("/api/account/me", a)).data.user.uid, a.id);
  assert.equal((await call("/api/public/profiles/chart-owner", undefined, "GET", undefined, { Host: "host-person.h00k.test" })).res.status, 404);
  const spoof = await call("/", undefined, "GET", undefined, { Host: "unknown-person.h00k.test", "X-Forwarded-Host": "host-person.h00k.test" });
  assert.equal(spoof.res.status, 404);
  assert.equal((await call("/", undefined, "GET", undefined, { Host: "admin.h00k.test" })).res.status, 404);
});

test("standalone workspace and fallback profile paths use independent entries", async () => {
  assert.match((await call("/")).text, /community-root/);
  assert.match((await call("/u/host-person")).text, /profile-root/);
  const root = await call("/", undefined, "GET", undefined, { Host: "host-person.h00k.test" });
  assert.match(root.text, /profile-root/); assert.doesNotMatch(root.text, /community-root/);
  assert.match(root.res.headers.get("content-security-policy")!, /connect-src 'self'/);
  assert.equal(root.res.headers.get("cache-control"), "private, no-store");
  const asset = await call("/profile-assets/assets/fixture-123456.js", undefined, "GET", undefined, { Host: "host-person.h00k.test" });
  assert.equal(asset.res.status, 200); assert.match(asset.res.headers.get("cache-control")!, /public.*immutable/);
});

test("public wall is bounded and paginated without exposing another owner's cursor", async () => {
  const a = await named("page-person");
  await db.query("INSERT INTO hc_items(id,owner_id,kind,audience,body,created_at) SELECT gen_random_uuid(),$1,'post','public',jsonb_build_object('text','entry '||n),now()+n*interval '1 second' FROM generate_series(1,17) n", [a.id]);
  const first = (await call("/api/public/profiles/page-person/posts")).data;
  assert.equal(first.items.length, 15); assert.ok(first.next);
  const second = (await call("/api/public/profiles/page-person/posts?before=" + first.next)).data;
  assert.equal(second.items.length, 2); assert.equal(second.next, null);
  assert.equal(new Set([...first.items, ...second.items].map(i => i.id)).size, 17);
  const foreign = (await db.query("SELECT id FROM hc_items WHERE owner_id<>$1 LIMIT 1", [a.id])).rows[0];
  assert.deepEqual((await call("/api/public/profiles/page-person/posts?before=" + foreign.id)).data.items, []);
});

test("deletion immediately hides the profile and retires its address without retaining an owner mapping", async () => {
  const a = await named("deleted-person");
  const result = await call("/api/account/delete", a, "POST", { password, confirm: "DELETE" });
  assert.equal(result.res.status, 200, result.text);
  assert.equal((await call("/api/public/profiles/deleted-person")).res.status, 404);
  assert.equal((await call("/u/deleted-person")).res.status, 404);
  const b = await actor(); assert.equal((await claim(b, "deleted-person")).res.status, 409);
  assert.equal((await db.query("SELECT count(*)::integer AS n FROM hc_profile_names WHERE owner_id=$1 OR username='deleted-person'", [a.id])).rows[0].n, 0);
});

test("Community session selections persist per-account and stay out of the anonymous public profile", async () => {
  const owner = await actor();
  const other = await actor();

  const save = await call("/api/account/profile", owner, "PATCH", {
    community: { tradingSessionIds: ["london", "new-york"] },
  });
  assert.equal(save.res.status, 200, save.text);
  assert.deepEqual(save.data.profile.community.tradingSessionIds, ["london", "new-york"]);

  const account = await call("/api/account/me", owner);
  assert.deepEqual(account.data.profile.community.tradingSessionIds, ["london", "new-york"]);
  assert.equal((await call("/api/account/me", other)).data.profile.community?.tradingSessionIds, undefined);

  for (const invalid of [
    "london", null, ["london", "unknown"], ["tokyo", "tokyo"],
    ["sydney", "tokyo", "london", "new-york", "london"],
  ]) {
    const result = await call("/api/account/profile", owner, "PATCH", {
      community: { tradingSessionIds: invalid },
    });
    assert.equal(result.res.status, 400, JSON.stringify({ invalid, error: result.data }));
  }
  assert.deepEqual((await call("/api/account/me", owner)).data.profile.community.tradingSessionIds, ["london", "new-york"]);

  await db.query("UPDATE hc_users SET email_verified=true WHERE id=$1", [owner.id]);
  assert.equal((await claim(owner, "trader-with-sessions")).res.status, 200);
  await enable(owner);
  const publicResult = await call("/api/public/profiles/trader-with-sessions");
  assert.equal(publicResult.res.status, 200, publicResult.text);
  assert.doesNotMatch(JSON.stringify(publicResult.data.profile), /tradingSessionIds/);

  const clear = await call("/api/account/profile", owner, "PATCH", {
    community: { tradingSessionIds: [] },
  });
  assert.equal(clear.res.status, 200, clear.text);
  assert.deepEqual(clear.data.profile.community.tradingSessionIds, []);
});

test("social friend counts are opt-in, accepted only, excluding blocks and deleted peers", async () => {
  const owner = await named("public-friends-count");
  const allowed = await actor(), blocked = await actor(), deleted = await actor(), pending = await actor();
  const url = "/api/public/profiles/public-friends-count";
  await db.query(
    `INSERT INTO hc_friendships(sender,recipient,accepted) VALUES
     ($1,$2,true),($3,$1,true),($1,$4,true),($5,$1,false)`,
    [owner.id, allowed.id, blocked.id, deleted.id, pending.id],
  );
  await db.query("INSERT INTO hc_blocks(owner_id,target_id) VALUES($1,$2)", [owner.id, blocked.id]);
  await db.query("UPDATE hc_users SET deleted_at=now() WHERE id=$1", [deleted.id]);

  const before = await call(url);
  assert.equal(before.res.status, 200);
  assert.equal(before.data.profile.friendsCount, null);
  assert.doesNotMatch(before.text, new RegExp(allowed.id + "|" + blocked.id + "|" + pending.id));

  const invalid = await call("/api/account/profile", owner, "PATCH", {
    community: { publicFriendsCountEnabled: "yes" },
  });
  assert.equal(invalid.res.status, 400);
  assert.equal((await call(url)).data.profile.friendsCount, null);

  const saved = await call("/api/account/profile", owner, "PATCH", {
    community: { publicFriendsCountEnabled: true },
  });
  assert.equal(saved.res.status, 200, saved.text);
  const visible = await call(url);
  assert.equal(visible.data.profile.friendsCount, 1);
  assert.doesNotMatch(visible.text, new RegExp(allowed.id + "|" + blocked.id + "|" + deleted.id));

  await db.query("UPDATE hc_friendships SET accepted=true WHERE sender=$1 AND recipient=$2", [pending.id, owner.id]);
  assert.equal((await call(url)).data.profile.friendsCount, 2);

  const hidden = await call("/api/account/profile", owner, "PATCH", {
    community: { publicFriendsCountEnabled: false },
  });
  assert.equal(hidden.res.status, 200);
  assert.equal((await call(url)).data.profile.friendsCount, null);
});

test("public award counts require an explicit owner toggle", async () => {
  const owner = await named("rewards-visible-test");
  const sender = await actor();
  const url = "/api/public/profiles/rewards-visible-test";
  await db.query(
    "INSERT INTO hc_award_gifts(id,sender_id,recipient_id,award_type,cost) VALUES($1,$2,$3,$4,$5)",
    [randomUUID(), sender.id, owner.id, "thanks", 20],
  );
  const defaultView = await call(url);
  assert.equal(defaultView.res.status, 200);
  assert.equal(defaultView.data.profile.awards, null);

  const rejected = await call("/api/account/profile", owner, "PATCH", {
    community: { publicAwardsEnabled: "yes" },
  });
  assert.equal(rejected.res.status, 400);
  const allowed = await call("/api/account/profile", owner, "PATCH", {
    community: { publicAwardsEnabled: true },
  });
  assert.equal(allowed.res.status, 200);
  const publicView = await call(url);
  assert.deepEqual(publicView.data.profile.awards, {
    received: 1, thanks: 1, analysis: 0, topTrader: 0,
  });
  const hidden = await call("/api/account/profile", owner, "PATCH", {
    community: { publicAwardsEnabled: false },
  });
  assert.equal(hidden.res.status, 200);
  assert.equal((await call(url)).data.profile.awards, null);
});

test("public post categories are filtered by the server before pagination", async () => {
  const owner = await named("classified-posts-test");
  const idea = await post(owner, { text: "Idea article", category: "idea" });
  const analysis = await post(owner, { text: "Analysis article", category: "analysis" });
  await post(owner, { text: "Not open", category: "idea" }, "private");
  const url = "/api/public/profiles/classified-posts-test/posts";
  const ideas = await call(url + "?category=idea");
  assert.equal(ideas.res.status, 200);
  assert.deepEqual(ideas.data.items.map((item: any) => item.id), [idea]);
  assert.equal(ideas.data.items[0].category, "idea");
  const analyses = await call(url + "?category=analysis");
  assert.deepEqual(analyses.data.items.map((item: any) => item.id), [analysis]);
  assert.equal((await call(url + "?category=bogus")).res.status, 400);
  assert.deepEqual((await call(url + "?category=education")).data.items, []);
});

test("public HookChart tab fetches older setups independently of normal posts and paginates", async () => {
  const owner = await named("chart-archive-owner");
  const chartId = await saveChart(db, await policy(db, owner.id), snapshot());
  const oldestChart = await post(owner, { text: "Old authorized HookChart", category: "analysis" }, "public", chartId);
  const hiddenChart = await post(owner, { text: "Private strategy chart" }, "private", chartId);
  for (let i = 0; i < 18; i++) {
    await post(owner, { text: "Ordinary newer post #" + i });
  }
  // A regular wall page has no reason to include the older chart.
  const url = "/api/public/profiles/chart-archive-owner/posts";
  const wall = await call(url);
  assert.equal(wall.res.status, 200);
  assert.equal(wall.data.items.length, 15);
  assert.ok(!wall.data.items.some((item: any) => item.id === oldestChart));

  for (let i = 0; i < 16; i++) {
    await post(owner, { text: "Newer chart #" + i, category: "idea" }, "public", chartId);
  }
  const charts = await call(url + "?withChart=1");
  assert.equal(charts.res.status, 200, charts.text);
  assert.equal(charts.data.items.length, 15);
  assert.ok(charts.data.items.every((item: any) => item.chart !== null));
  assert.ok(charts.data.items.every((item: any) => item.id !== hiddenChart));
  assert.ok(charts.data.next);
  const next = await call(url + "?withChart=1&before=" + encodeURIComponent(charts.data.next));
  assert.equal(next.res.status, 200, next.text);
  assert.equal(next.data.items.length, 2);
  assert.ok(next.data.items.some((item: any) => item.id === oldestChart));
  assert.equal(next.data.next, null);
  assert.ok(!next.data.items.some((item: any) => charts.data.items.some((first: any) => first.id === item.id)));
  const category = await call(url + "?withChart=1&category=analysis");
  assert.deepEqual(category.data.items.map((item: any) => item.id), [oldestChart]);
  assert.equal((await call(url + "?withChart=0")).res.status, 400);
  assert.equal((await call(url + "?withChart=bogus")).res.status, 400);

  await db.query("UPDATE hc_items SET audience='private' WHERE id=$1", [oldestChart]);
  const revoked = await call(url + "?withChart=1&category=analysis");
  assert.equal(revoked.res.status, 200);
  assert.deepEqual(revoked.data.items, []);
});

test("public trading sessions are opt-in and never reveal the owner's timezone", async () => {
  const owner = await named("session-visibility-user");
  const url = "/api/public/profiles/session-visibility-user";
  const privateView = await call(url);
  assert.equal(privateView.res.status, 200);
  assert.equal(privateView.data.profile.sessions, null);
  const invalid = await call("/api/account/profile", owner, "PATCH", {
    community: { publicSessionsEnabled: "public" },
  });
  assert.equal(invalid.res.status, 400);
  const enabled = await call("/api/account/profile", owner, "PATCH", {
    timeZone: "Europe/Warsaw",
    community: {
      tradingSessionIds: ["london", "new-york"],
      publicSessionsEnabled: true,
    },
  });
  assert.equal(enabled.res.status, 200);
  const publicView = await call(url);
  assert.equal(publicView.res.status, 200);
  assert.deepEqual(publicView.data.profile.sessions, ["london", "new-york"]);
  assert.doesNotMatch(publicView.text, /Europe\/Warsaw|email|password_hash|mfa_secret/);
  const hidden = await call("/api/account/profile", owner, "PATCH", {
    community: { publicSessionsEnabled: false },
  });
  assert.equal(hidden.res.status, 200);
  assert.equal((await call(url)).data.profile.sessions, null);
});
