import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/components/community/CommunityPage.tsx", import.meta.url), "utf8");
const library = source.slice(source.indexOf("function Workspace({"), source.indexOf("\nfunction Friends({"));
const css = readFileSync(new URL("../src/components/community/social-resource-library.css", import.meta.url), "utf8");

test("real day, strategy, lesson and replay-test resources share an accessible library", () => {
  assert.match(library, /kind: "plan" \| "strategy" \| "lesson" \| "test"/);
  assert.match(library, /className=\{"community-resource-view community-resource-" \+ kind\}/);
  assert.match(library, /className="community-resource-library-heading"/);
  assert.match(library, /className="community-resource-filter"/);
  assert.match(library, /aria-pressed=\{view === "available"\}/);
  assert.match(library, /aria-pressed=\{view === "mine"\}/);
  assert.match(library, /loadedItems\.filter\(\(item\) => item\.owner_id === user\?\.uid\)/);
  assert.match(library, /visibleItems\.map\(\(item: any\) =>/);
  assert.match(library, /Завантажуємо матеріали/);
  assert.match(library, /Немає|немає власних матеріалів/);
});

test("resource editor preserves real API and versioned updates, with templates and Replay", () => {
  assert.match(library, /apiJson\(api \+ "\/items\?kind=" \+ kind\)/);
  assert.match(library, /await apiJson\(api \+ "\/items\/" \+ editing\.id/);
  assert.match(library, /revision: editing\.revision/);
  assert.match(library, /else await post\(api \+ "\/items", \{ kind, audience, body \}\)/);
  assert.match(library, /const \[editing, setEditing\] = useState<any>\(null\)/);
  assert.match(library, /aria-expanded=\{showEditor\}/);
  assert.match(library, /\{showEditor && \(/);
  assert.match(library, /setShowEditor\(true\)/);
  assert.match(library, /<details className="community-card community-resource-presets">/);
  assert.match(library, /STRATEGY_PRESETS\.map/);
  assert.match(library, /onClick=\{onReplay\}/);
  assert.match(library, /item\.body\.tasks\?\.map/);
});

test("owners can delete their own resources only, via existing server checks", () => {
  assert.match(library, /item\.owner_id === user\?\.uid \? \(/);
  assert.match(library, /window\.confirm\("Видалити цей матеріал/);
  assert.match(library, /method: "DELETE"/);
  assert.match(library, /resource\.refresh\(\)/);
  assert.match(library, /Додати власну приватну копію/);
  assert.match(library, /audience: "private"/);
  assert.doesNotMatch(library, /INITIAL_LESSONS|FAKE_PNL|DUMMY_TEST/);
});

test("resource views are scoped, touch-friendly and avoid automatic iOS page zoom", () => {
  assert.match(source, /import "\.\/social-resource-library\.css"/);
  assert.match(css, /\.community-workspace \.community-resource-view/);
  assert.match(css, /\.community-workspace \.community-resource-editor/);
  assert.match(css, /\.community-workspace \.community-resource-grid/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /font-size: 16px; \/\* Prevent unwanted Safari focus zoom/);
  assert.doesNotMatch(css, /^\s*(body|html)\s*\{/m);
});
