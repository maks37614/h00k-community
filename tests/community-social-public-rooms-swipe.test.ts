import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COMMUNITY_PUBLIC_ROOMS, getCommunityPublicRoom } from "../src/community/publicRooms";
import { swipeCommunityPane } from "../src/components/community/socialMobileSwipe";

const routes = readFileSync(new URL("../server/community/routes.ts", import.meta.url), "utf8");
const schema = readFileSync(new URL("../server/community/schema.sql", import.meta.url), "utf8");
const page = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
const roomUI = readFileSync(new URL("../src/components/community/CommunityPublicRooms.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/components/community/social-public-rooms.css", import.meta.url), "utf8");

test("public room identifiers are an explicit allowlist, not user-supplied SQL", () => {
  assert.deepEqual(COMMUNITY_PUBLIC_ROOMS.map(room => room.slug), ["general","setups"]);
  assert.equal(getCommunityPublicRoom("general")?.slug, "general");
  assert.equal(getCommunityPublicRoom("setups")?.slug, "setups");
  for (const bad of ["../conversations", "private", "", null, 1, "GENERAL"])
    assert.equal(getCommunityPublicRoom(bad), null);
  assert.match(schema, /slug text NOT NULL CHECK\(slug IN \('general','setups'\)\)/);
});

test("public chat records cannot read the private conversations table or return deleted and blocked posts", () => {
  const section = routes.slice(
    routes.indexOf('route("get", "/rooms/:slug/messages"'),
    routes.indexOf('route("post", "/rooms/:slug/messages"'),
  );
  assert.ok(section);
  assert.match(section, /getCommunityPublicRoom\(req.params.slug\)/);
  assert.match(section, /FROM hc_room_messages m JOIN hc_users u/);
  assert.match(section, /m\.slug=\$1 AND NOT m\.deleted AND u\.deleted_at IS NULL/);
  assert.match(section, /NOT \(m\.owner_id=ANY\(\$3::uuid\[\]\)\)/);
  assert.match(section, /\[\.\.\.p\.blocked\]/);
  assert.match(section, /publicTraderAvatarPath\(row\)/);
  assert.match(section, /LIMIT 40/);
  assert.match(section, /next: !after && rows.length===40/);
  assert.doesNotMatch(section, /hc_conversations|hc_members|SELECT \* FROM hc_items/);
  assert.match(schema, /CREATE INDEX IF NOT EXISTS hc_room_messages_recent/);
});

test("public messages are bounded, authenticated, rate-limited and moderated", () => {
  assert.match(routes, /route\("post", "\/rooms\/:slug\/messages"/);
  assert.match(routes, /const text = bounded\(req.body\?\.text, 2000\)/);
  assert.match(routes, /INSERT INTO hc_room_messages\(id,slug,owner_id,text\)/);
  assert.match(routes, /res.status\(201\)\.json\(\{ success:true, id \}\);\s*\}, 10\)/);
  assert.match(routes, /route\("delete", "\/rooms\/:slug\/messages\/:id"/);
  assert.match(routes, /AND \(owner_id=\$3 OR \$4::boolean\) RETURNING id/);
  assert.match(routes, /route\("post", "\/rooms\/:slug\/messages\/:id\/report"/);
  assert.match(routes, /ON CONFLICT\(message_id,reporter_id\) DO NOTHING/);
  assert.match(routes, /route\("get", "\/rooms\/reports"/);
  assert.match(routes, /route\("post", "\/rooms\/reports\/:id\/resolve"/);
  assert.match(routes, /COMMUNITY_MODERATOR_IDS/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS hc_room_reports/);
  assert.match(schema, /UNIQUE\(message_id,reporter_id\)/);
  assert.match(schema, /owner_id uuid NOT NULL REFERENCES hc_users\(id\) ON DELETE CASCADE/);
});

test("room UI keeps public and private conversations separate and polls only the visible room", () => {
  assert.match(page, /import \{ CommunityPublicRooms \}/);
  assert.match(page, /const \[chatArea, setChatArea\] = useState<"direct" \| "rooms">\("direct"\)/);
  assert.match(page, /chatArea === "rooms" \? <CommunityPublicRooms key=\{user\?\.uid\}/);
  assert.match(page, /if \(!id \|\| chatArea !== "direct"\) return/);
  assert.match(roomUI, /document\.visibilityState !== "visible"/);
  assert.match(roomUI, /window\.setInterval\(pull, 12000\)/);
  assert.match(roomUI, /window\.clearInterval\(timer\)/);
  assert.match(roomUI, /after \? "\?after="/);
  assert.match(roomUI, /"\?before="/);
  assert.match(page, /<CommunityPublicRooms key=\{user\?\.uid\}/);
  assert.doesNotMatch(roomUI, /new WebSocket\(|new EventSource\(|INITIAL_CHAT_MESSAGES|fakePnL/);
  assert.match(css, /\.community-workspace \.community-rooms-layout/);
  assert.match(css, /@media\(max-width:700px\)/);
});

test("swipe navigation respects edges, speed, direction, and native vertical scroll", () => {
  assert.equal(swipeCommunityPane("profile",-100,5,250),"feed");
  assert.equal(swipeCommunityPane("feed",-100,5,250),"sessions");
  assert.equal(swipeCommunityPane("sessions",-100,5,250),"sessions");
  assert.equal(swipeCommunityPane("sessions",100,5,250),"feed");
  assert.equal(swipeCommunityPane("feed",100,5,250),"profile");
  assert.equal(swipeCommunityPane("profile",100,5,250),"profile");
  assert.equal(swipeCommunityPane("feed",35,0,200),"feed");
  assert.equal(swipeCommunityPane("feed",100,200,200),"feed");
  assert.equal(swipeCommunityPane("feed",-120,1,1400),"feed");
  assert.equal(swipeCommunityPane("feed",NaN,0,200),"feed");
  assert.match(page, /onTouchStart=\{event => \{/);
  assert.match(page, /onTouchEnd=\{event => \{/);
  assert.match(page, /onTouchCancel=\{\(\) => \{ mobileSwipeStart\.current = null; \}\}/);
  assert.match(page, /setMobileFeedColumn\(current => swipeCommunityPane/);
  assert.match(page, /window\.innerWidth > 760/);
  assert.match(page, /target\.closest\('button,a,input,textarea,select,canvas,/);
});
