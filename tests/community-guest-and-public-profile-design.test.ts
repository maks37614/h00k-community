import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const guest = readFileSync(new URL("../src/community/standalone.tsx", import.meta.url), "utf8");
const guestCss = readFileSync(new URL("../src/community/standalone.css", import.meta.url), "utf8");
const publicProfile = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
const profileCss = readFileSync(new URL("../src/community/publicProfile.css", import.meta.url), "utf8");
const publicRoutes = readFileSync(new URL("../server/community/publicProfiles.ts", import.meta.url), "utf8");

test("guest page advertises real Community capabilities while keeping auth gated", () => {
  assert.match(guest, /function GuestLanding\(/);
  assert.match(guest, /className="community-guest-hero"/);
  assert.match(guest, /className="community-guest-product"/);
  assert.match(guest, /className="community-guest-features"/);
  assert.match(guest, /className="community-guest-privacy"/);
  assert.match(guest, /onAuth\("signup"\)/);
  assert.match(guest, /onAuth\("signin"\)/);
  assert.match(guest, /initialMode=\{authMode\}/);
  assert.match(guest, /<AuthModal/);
  assert.match(guest, /isOpen=\{!loading && \(resetting \|\| \(!user && open\)\)\}/);
  assert.match(guest, /user && !resetting \?/);
  assert.match(guest, /<Community onReplay=/);
  assert.match(guest, /data-network-mode="community-only"/);
  assert.doesNotMatch(guest, /fetch\(|apiJson\(|INITIAL_POSTS|MOCK_PROFILES|Math\.random/);
});

test("guest design uses independent responsive CSS, not changes to global screener or authenticated API", () => {
  assert.match(guestCss, /\.community-standalone-header/);
  assert.match(guestCss, /\.community-guest-product-tiles/);
  assert.match(guestCss, /\.community-guest-feature-grid/);
  assert.match(guestCss, /\.community-guest-privacy/);
  assert.match(guestCss, /@media \(max-width: 520px\)/);
  assert.match(guestCss, /@media \(max-width: 760px\)/);
  assert.match(guestCss, /prefers-reduced-motion/);
  assert.doesNotMatch(guestCss, /^\s*(?:body|html|\*)\s*\{/m);
});

test("public profile remains server-controlled read-only and renders only returned fields", () => {
  assert.match(publicProfile, /data-network-mode="public-snapshot"/);
  assert.match(publicProfile, /fetch\(url, \{ credentials: "omit", cache: "no-store", signal \}\)/);
  assert.match(publicProfile, /Promise\.all\(\[read\(base, controller\.signal\), read\(base \+ "\/posts", controller\.signal\)\]\)/);
  assert.match(publicProfile, /profile && <>/);
  assert.match(publicProfile, /profile\.communityOrigin \?\? "https:\/\/h00k\.top\/"/);
  assert.match(publicProfile, /className="public-profile-cover"/);
  assert.match(publicProfile, /className="public-profile-identity"/);
  assert.match(publicProfile, /className="public-profile-columns"/);
  assert.match(publicProfile, /className="public-profile-wall"/);
  assert.match(publicProfile, /profile\.statistics &&/);
  assert.match(publicProfile, /profile\.bio &&/);
  assert.match(publicProfile, /profile\.telegram/);
  assert.match(publicProfile, /<ChartPreview document=\{item\.chart\}/);
  assert.match(publicProfile, /public-profile-workspace/);
  assert.doesNotMatch(publicProfile, /INITIAL_PROFILES|DUMMY_PNL|liveTicker|marketFeed/);
  assert.match(publicRoutes, /\/api\/public\/profiles/);
});

test("public profile responsive styles retain optional panels and mobile UI", () => {
  assert.match(profileCss, /\.public-profile-cover/);
  assert.match(profileCss, /\.public-profile-columns/);
  assert.match(profileCss, /\.public-profile-stats/);
  assert.match(profileCss, /\.public-profile-post/);
  assert.match(profileCss, /@media \(max-width: 760px\)/);
  assert.match(profileCss, /@media \(max-width: 640px\)/);
});
