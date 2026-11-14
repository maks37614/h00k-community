import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sidebar = readFileSync(new URL("../src/components/community/CommunityConceptProfile.tsx", import.meta.url), "utf8");
const sidebarCss = readFileSync(new URL("../src/components/community/social-concept-layout.css", import.meta.url), "utf8");
const server = readFileSync(new URL("../server/community/account.ts", import.meta.url), "utf8");
const publicView = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
const publicRoutes = readFileSync(new URL("../server/community/publicProfiles.ts", import.meta.url), "utf8");
const publicStyles = readFileSync(new URL("../src/community/publicProfile.css", import.meta.url), "utf8");

test("social sidebar inline status/bio save via authenticated profile PATCH, not a fake local state", () => {
  assert.match(sidebar, /const \{ user, profile, updateProfileData \} = useAuth\(\)/);
  assert.match(sidebar, /<form className="community-concept-inline-editor"/);
  assert.match(sidebar, /async function saveInline\(event: React\.FormEvent<HTMLFormElement>\)/);
  assert.match(sidebar, /await updateProfileData\(\{ community: \{ bio: value \} \}\)/);
  assert.match(sidebar, /await updateProfileData\(\{ community: \{/);
  assert.match(sidebar, /status: \{ text: value, audience: currentStatus\?\.audience \?\? "private" \}/);
  assert.match(sidebar, /"Аналізую ринок", "Шукаю формації"/);
  assert.match(sidebar, /не підтвердження присутності онлайн чи відкритої угоди/);
  assert.match(sidebar, /const bio = profile\?\.community\?\.bio \?\? info\?\.bio/);
  assert.match(sidebar, /setEditing\(null\)/);
  assert.match(sidebar, /\}, \[user\?\.uid\]\)/);
  assert.match(sidebar, /role="alert"/);
  assert.match(sidebar, /role="status"/);
  assert.doesNotMatch(sidebar, /localStorage|sessionStorage|mockData|Math\.random|fetch\("https:/);
  assert.match(server, /"bio", "interests", "lifestyle", "telegram"/);
  assert.match(server, /text: bounded\(raw\.status\.text \?\? "", 280\)/);
  assert.match(server, /"private", "friends", "public"/);
  assert.match(sidebarCss, /\.community-workspace \.community-concept-inline-editor/);
  assert.match(sidebarCss, /@media\(max-width: 640px\)/);
});

test("public comment avatar route requires author public consent and media ownership", () => {
  assert.match(publicRoutes, /type PublicCommentWithAvatar = Item/);
  assert.match(publicRoutes, /LEFT JOIN hc_media m ON m\.owner_id=c\.owner_id AND m\.id::text=\(u\.profile->'community'->>'avatarMediaId'\)/);
  assert.match(publicRoutes, /authorAvatarUrl: row\.author_profile\?\.community\?\.publicProfileEnabled === true/);
  assert.match(publicRoutes, /avatarAudience === "public"/);
  assert.match(publicRoutes, /route\("\/posts\/:id\/comments\/:comment\/avatar"/);
  assert.match(publicRoutes, /await publicPost\(db, rules, owner\.id, req\.params\.id\)/);
  assert.match(publicRoutes, /await rules\.visible\(row\)/);
  assert.match(publicRoutes, /await rules\.canReadChart\(row\.chart_id\)/);
  assert.match(publicView, /authorAvatarUrl\?: string \| null/);
  assert.match(publicView, /comment\.authorAvatarUrl && <img src=\{comment\.authorAvatarUrl\}/);
  assert.match(publicView, /loading="lazy" decoding="async"/);
  assert.match(publicView, /onError=\{e => \{ e\.currentTarget\.hidden = true; \}\}/);
  assert.match(publicStyles, /\.public-profile-post-avatar img/);
  assert.doesNotMatch(publicView, /images\.unsplash\.com|MOCK_AVATAR|faker\.image/);
});
