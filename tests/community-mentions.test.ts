import test from "node:test";
import assert from "node:assert/strict";
import { extractMentionHandles } from "../server/community/mentions";
import { readFileSync } from "node:fs";

test("canonical @profile names parse case-insensitively without substring or email matches", () => {
  assert.deepEqual(extractMentionHandles("Привіт @Ivan і @ANNA-LEE! @ivan"), ["ivan","anna-lee"]);
  assert.deepEqual(extractMentionHandles("test@ivan.com @ivan-lee @ivanka"), ["ivan-lee","ivanka"]);
  assert.deepEqual(extractMentionHandles("user@ivan @ivan-more @a @a_abc"), ["ivan-more"]);
  assert.deepEqual(extractMentionHandles("@ivan, @anna. (@ivan)"), ["ivan","anna"]);
  assert.deepEqual(extractMentionHandles(null), []);
  assert.deepEqual(extractMentionHandles("нічого без згадок"), []);
  assert.deepEqual(extractMentionHandles("@ivan @anna @mark",2), ["ivan","anna"]);
});

test("group mention preferences do not alter full unread message counts", () => {
  const routes=readFileSync(new URL("../server/community/routes.ts",import.meta.url),"utf8");
  const schema=readFileSync(new URL("../server/community/schema.sql",import.meta.url),"utf8");
  const page=readFileSync(new URL("../src/components/community/CommunityPage.tsx",import.meta.url),"utf8");
  const style=readFileSync(new URL("../src/components/community/social-chat-workspace.css",import.meta.url),"utf8");
  const model=readFileSync(new URL("../src/components/community/notificationModel.ts",import.meta.url),"utf8");
  assert.match(schema,/hc_message_mentions\s*\(/);
  assert.match(schema,/ALTER TABLE hc_members ADD COLUMN IF NOT EXISTS mentions_only boolean/);
  assert.match(routes,/route\("post", "\/conversations\/:id\/mentions-only"/);
  assert.match(routes,/c\.is_group=true/);
  assert.match(routes,/pn\.username=ANY\(\$3::text\[\]\)/);
  assert.match(routes,/ON CONFLICT DO NOTHING/);
  assert.match(routes,/AND \$\{mentionPredicate\} LIMIT 100/);
  assert.match(routes,/alert_unread_count/);
  assert.match(routes,/unread_count/);
  assert.match(page,/community-chat-mentions-toggle/);
  assert.match(page,/@\{member\.username\}/);
  assert.match(style,/\.community-chat-mentions-toggle\[aria-pressed="true"\]/);
  assert.match(model,/item\.alert_unread_count \?\? item\.unread_count/);
  assert.doesNotMatch(routes,/setInterval\(|setTimeout\(/);
});
