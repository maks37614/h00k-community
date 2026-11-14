import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
const guest = readFileSync(new URL("../src/community/standalone.tsx", import.meta.url), "utf8");
const guestCss = readFileSync(new URL("../src/community/standalone.css", import.meta.url), "utf8");
const editorCss = readFileSync(new URL("../src/components/community/social-quality-proof.css", import.meta.url), "utf8");

test("new imported draft has no server history path before an explicit save", () => {
  const start = source.indexOf("function ChartDialog({");
  const end = source.indexOf("function Workspace({", start);
  assert.ok(start > 0 && end > start);
  const editor = source.slice(start, end);
  // The history button can only request history of an already saved source.
  assert.match(editor, /onHistory=\{savedId \? async \(timeframe, before\)/);
  assert.match(editor, /"\/charts\/" \+ savedId \+ "\/history\?"/);
  assert.doesNotMatch(editor, /onHistory=\{async/);
  assert.doesNotMatch(editor, /savedId \?\? \(await chartId\(\)\)/);
  assert.match(editor, /!savedId && <p className="community-chart-draft-privacy-note"/);
  assert.match(editor, /графік не надсилатиметься на сервер/);
  assert.match(editor, /const id = await chartId\(\);\s*await post\(api \+ "\/items"/);
  // Explicitly sharing a chart is still a user action and still authorizes a save.
  assert.match(editor, /Надіслати розбір/);
  assert.match(editor, /disabled=\{busy \|\| !canShareReplyWithAudience/);
  assert.match(editorCss, /\.community-workspace \.community-chart-draft-privacy-note/);
});

test("guest can sign in to continue handoff without exposing the token on the landing page", () => {
  assert.match(guest, /function GuestLanding\(\{ onAuth, pendingHandoff \}/);
  assert.match(guest, /pendingHandoff && <aside className="community-guest-handoff" role="status">/);
  assert.match(guest, /Графік із h00k\.top готовий до імпорту/);
  assert.match(guest, /Посилання діє 10 хвилин/);
  assert.match(guest, /Увійти й відкрити чернетку/);
  assert.match(guest, /const pendingHandoff = location\.hash\.startsWith\("#community\?"\)/);
  assert.match(guest, /new URLSearchParams\(location\.hash\.split\("\?"\)\[1\] \?\? ""\)\.has\("handoff"\)/);
  assert.match(guest, /<GuestLanding onAuth=\{openAuth\} pendingHandoff=\{pendingHandoff\} \/>/);
  const header = guest.slice(guest.indexOf("function GuestLanding("), guest.indexOf("function Workspace()"));
  assert.doesNotMatch(header, /decodeURIComponent|atob\(|JSON\.parse\(|sessionStorage|localStorage/);
  assert.match(guestCss, /\.community-guest-handoff/);
  assert.match(guestCss, /@media \(max-width: 640px\)/);
});
