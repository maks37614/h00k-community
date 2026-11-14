import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  publicArticleUrl, publicArticlesUrl, publicArticleReadMinutes,
  publicArticleExcerpt, publicProfileDeepLink,
} from "../src/community/publicProfileViewModel";

const publicPage = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
const articleView = readFileSync(new URL("../src/community/PublicProfileArticles.tsx", import.meta.url), "utf8");
const articleCss = readFileSync(new URL("../src/community/publicProfileArticles.css", import.meta.url), "utf8");
const api = readFileSync(new URL("../server/community/publicProfiles.ts", import.meta.url), "utf8");
const post = "cb59d0d9-bacf-4dce-b1c1-9876e70078d1";

test("article links keep the right profile, reject invalid IDs and support back navigation", () => {
  assert.equal(
    publicArticleUrl("https://community-stage.h00k.top/u/ivan?tab=wall", post),
    "https://community-stage.h00k.top/u/ivan?tab=articles&post=" + post,
  );
  assert.equal(publicArticlesUrl("https://ivan.h00k.top/?post=" + post),
    "https://ivan.h00k.top/?tab=articles");
  assert.throws(() => publicArticleUrl("https://community-stage.h00k.top/u/ivan", "../private"));
  assert.throws(() => publicArticleUrl("javascript:alert(1)", post));
  assert.throws(() => publicArticlesUrl("https://outsider@h00k.top/u/ivan"));
  assert.equal(publicProfileDeepLink("?tab=articles&post=" + post).tab, "articles");
  assert.equal(publicProfileDeepLink("?tab=articles&post=" + post).postId, post);
});

test("reading time and excerpts are bounded estimates based on public text only", () => {
  assert.equal(publicArticleReadMinutes(""), 1);
  assert.equal(publicArticleReadMinutes(null), 1);
  assert.equal(publicArticleReadMinutes("word ".repeat(201)), 2);
  assert.equal(publicArticleReadMinutes("word ".repeat(500)), 3);
  assert.equal(publicArticleExcerpt("hello world again", 11), "hello world…");
  assert.equal(publicArticleExcerpt("short"), "short");
  assert.equal(publicArticleExcerpt(null), "");
});

test("articles have a responsive gallery and full reader without synthetic views, PnL, likes or API writes", () => {
  assert.match(publicPage, /import \{ PublicProfileArticles \} from "\.\/PublicProfileArticles"/);
  assert.match(publicPage, /result\.item\.category !== "education"/);
  assert.match(publicPage, /setTab\("articles"\)/);
  assert.match(publicPage, /tab !== "articles" && visibleWall\.map/);
  assert.match(articleView, /posts\.filter\(post => post\.category === "education"\)/);
  assert.match(articleView, /publicArticleUrl\(profile\.url, post\.id\)/);
  assert.match(articleView, /publicArticlesUrl\(profile\.url\)/);
  assert.match(articleView, /selected\.photos\.slice\(1\)/);
  assert.match(articleView, /<ChartPreview document=\{selected\.chart\}/);
  assert.match(articleView, /communityPostUrl\(profile\.communityOrigin, selected\.id\)/);
  assert.match(articleView, /loading="lazy"/);
  assert.match(articleCss, /@media \(max-width:640px\)/);
  assert.doesNotMatch(articleView, /INITIAL_ARTICLES|INITIAL_PROFILES|mockData|fakeViews|isVerified/);
  assert.match(api, /category !== null.*\["idea", "analysis", "education"\]/);
  assert.match(api, /await rules\.visible\(row\)/);
  assert.match(api, /await rules\.canReadChart\(row\.chart_id\)/);
});
