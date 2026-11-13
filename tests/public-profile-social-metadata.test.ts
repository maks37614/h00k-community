import test from "node:test";
import assert from "node:assert/strict";
import { escapePublicHtml, injectPublicShareMetadata, safePublicShareText } from "../server/community/publicProfileMeta";

const html = '<!doctype html><html lang="uk"><head><title>Default profile</title><meta name="description" content="generic" /></head><body><main id="profile-root"></main></body></html>';

test("social OG metadata escapes dangerous text and never adds arbitrary scripts", () => {
  const title = '<img src=x onerror=alert("x")>';
  const description = 'Hello "world" <script>alert(1)</script> & news';
  const output = injectPublicShareMetadata(html, {
    title,
    description,
    canonicalUrl: "https://ivan.h00k.top/?post=cb59d0d9-bacf-4dce-b1c1-9876e70078d1",
    type: "article",
  });
  assert.match(output, /&lt;img src=x onerror=alert\(&quot;x&quot;\)&gt;/);
  assert.match(output, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(output, /&quot;world&quot;/);
  assert.match(output, /&amp; news/);
  assert.match(output, /property="og:type" content="article"/);
  assert.match(output, /rel="canonical" href="https:\/\/ivan.h00k.top\/\?post=/);
  assert.doesNotMatch(output, /<script>alert\(1\)<\/script>/);
  assert.equal((output.match(/<title>/g) ?? []).length, 1);
  assert.equal((output.match(/name="description"/g) ?? []).length, 1);
  assert.match(output, /id="profile-root"/);
});

test("public image preview is accepted only from the profile's own origin", () => {
  const preview = injectPublicShareMetadata(html, {
    title: "Published trader", description: "Open account",
    canonicalUrl: "https://ivan.h00k.top",
    imageUrl: "https://ivan.h00k.top/api/public/profiles/ivan/cover",
    type: "profile",
  });
  assert.match(preview, /property="og:image" content="https:\/\/ivan.h00k.top\/api\/public\/profiles\/ivan\/cover"/);
  assert.match(preview, /name="twitter:image" content="https:\/\/ivan.h00k.top/);
  assert.match(preview, /name="twitter:card" content="summary_large_image"/);
  assert.throws(() => injectPublicShareMetadata(html, {
    title: "Attack", description: "",
    canonicalUrl: "https://ivan.h00k.top",
    imageUrl: "https://example.evil.test/photo.jpg",
    type: "profile",
  }));
  assert.throws(() => injectPublicShareMetadata(html, {
    title: "Attack", description: "",
    canonicalUrl: "https://ivan.h00k.top",
    imageUrl: "javascript:alert(1)",
    type: "profile",
  }));
});

test("metadata helper rejects unsafe URLs and omits private-like control characters", () => {
  assert.equal(escapePublicHtml("a&b<c>d\"e'f"), "a&amp;b&lt;c&gt;d&quot;e&#39;f");
  assert.equal(safePublicShareText(" A\n   B\tC ", 100), "A B C");
  assert.equal(safePublicShareText({ secret: "foo" }, 100), "");
  assert.throws(() => injectPublicShareMetadata(html, {
    title: "bad", description: "bad", canonicalUrl: "javascript:alert(1)", type: "profile",
  }));
  assert.throws(() => injectPublicShareMetadata(html, {
    title: "bad", description: "bad", canonicalUrl: "https://bad@h00k.top", type: "profile",
  }));
  assert.equal(injectPublicShareMetadata("<div>no head</div>", {
    title: "X", description: "", canonicalUrl: "https://h00k.top", type: "profile",
  }), "<div>no head</div>");
});
