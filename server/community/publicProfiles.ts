import express, { type Express, type Request, type Response } from "express";
import path from "node:path";
import fs from "node:fs/promises";
import type { Database } from "./db";
import { fail, RequestLimits, uuid } from "./security";
import { getChart, type Item, type Policy } from "./content";
import { communityOrigin, nameFromHost, profileDomain, profileName, publicProfileUrl } from "./profileNames";
import { mediaRoot } from "./accountData";
import { injectPublicShareMetadata, safePublicShareText, type PublicShareMetadata } from "./publicProfileMeta";

/** Anonymous readers never inherit an owner's private/friend/session permissions. */
export function publicProfilePolicy(db: Database): Policy {
  const users = new Map<string, Promise<boolean>>();
  const items = new Map<string, Promise<Item | null>>();
  const charts = new Map<string, Promise<any>>();
  const optedIn = (id: string) => {
    if (!users.has(id)) users.set(id, db.query(
      "SELECT id FROM hc_users WHERE id=$1 AND deleted_at IS NULL AND profile->'community'->'publicProfileEnabled'='true'::jsonb", [id],
    ).then(r => r.rows.length > 0));
    return users.get(id)!;
  };
  const item = (id: string) => {
    if (!items.has(id)) items.set(id, db.query<Item>("SELECT * FROM hc_items WHERE id=$1", [id]).then(r => r.rows[0] ?? null));
    return items.get(id)!;
  };
  const chart = (id: string) => {
    if (!charts.has(id)) charts.set(id, db.query("SELECT * FROM hc_charts WHERE id=$1", [id]).then(r => r.rows[0]));
    return charts.get(id)!;
  };
  async function visible(row: Item | null, depth = 0): Promise<boolean> {
    if (!row || row.deleted || row.audience !== "public" || row.conversation_id || depth > 12 || !(await optedIn(row.owner_id))) return false;
    if (row.parent_id && !(await visible(await item(row.parent_id), depth + 1))) return false;
    if (row.body?.sourceItemId && !(await visible(await item(row.body.sourceItemId), depth + 1))) return false;
    return true;
  }
  async function canReadChart(id: string, depth = 0): Promise<boolean> {
    if (depth > 12) return false;
    const row = await chart(id);
    if (!row || row.deleted || !(await optedIn(row.owner_id))) return false;
    if (row.parent_id && !(await canReadChart(row.parent_id, depth + 1))) return false;
    const links = await db.query<Item>(
      "SELECT * FROM hc_items WHERE chart_id=$1 AND audience='public' AND conversation_id IS NULL AND NOT deleted ORDER BY created_at DESC LIMIT 100", [id],
    );
    for (const link of links.rows) if (await visible(link)) return true;
    return false;
  }
  return { viewer: "", accepted: new Set(), blocked: new Set(), member: new Map(), item, visible, chart, canReadChart };
}
const text = (value: unknown, max: number) => typeof value === "string" ? value.slice(0, max) : "";
async function publicOwner(db: Database, input: unknown) {
  let name: string;
  try { name = profileName(input); } catch { fail("Профіль недоступний", 404); }
  const { rows } = await db.query(
    `SELECT u.id,u.profile,u.created_at FROM hc_profile_names n JOIN hc_users u ON u.id=n.owner_id
    WHERE n.username=$1 AND u.deleted_at IS NULL AND u.profile->'community'->'publicProfileEnabled'='true'::jsonb`, [name],
  );
  if (!rows[0]) fail("Профіль недоступний", 404);
  return { ...rows[0], username: name };
}
async function publicPost(db: Database, rules: Policy, owner: string, id: string) {
  const row = await rules.item(uuid(id));
  if (!row || row.owner_id !== owner || row.kind !== "post" || !(await rules.visible(row)) ||
      (row.chart_id && !(await rules.canReadChart(row.chart_id)))) fail("Публікація недоступна", 404);
  return row;
}

/** SEO and social preview metadata come from the same public-only authorization as /u/. */
async function publicShareMeta(db: Database, owner: any, possiblePost: unknown): Promise<PublicShareMetadata> {
  const c = owner.profile?.community ?? {};
  const displayName = safePublicShareText(owner.profile?.displayName, 100) || "Трейдер";
  const bio = (c.bioAudience ?? "public") === "public" ? safePublicShareText(c.bio, 170) : "";
  let imageUrl: string | undefined;
  for (const kind of ["cover", "avatar"] as const) {
    const candidate = c[kind + "MediaId"];
    if (c[kind + "Audience"] !== "public" || typeof candidate !== "string") continue;
    let id: string;
    try { id = uuid(candidate); } catch { continue; }
    const media = await db.query("SELECT id FROM hc_media WHERE id=$1 AND owner_id=$2", [id, owner.id]);
    if (!media.rows.length) continue;
    imageUrl = new URL("/api/public/profiles/" + owner.username + "/" + kind, publicProfileUrl(owner.username)).toString();
    break;
  }
  const fallback: PublicShareMetadata = {
    title: displayName + " (@" + owner.username + ") · h00k Community",
    description: bio || "Публічний профіль трейдера @" + owner.username + " у h00k Community. Власник сам обирає, чим ділитися.",
    canonicalUrl: publicProfileUrl(owner.username),
    ...(imageUrl ? { imageUrl } : {}),
    type: "profile",
  };
  if (typeof possiblePost !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(possiblePost))
    return fallback;
  let post: Item;
  try {
    post = await publicPost(db, publicProfilePolicy(db), owner.id, possiblePost);
  } catch (error: any) {
    if (error?.status === 404) return fallback;
    throw error;
  }
  const link = new URL(fallback.canonicalUrl);
  link.searchParams.set("post", post.id);
  const postTitle = safePublicShareText(post.body?.title, 110);
  return {
    title: (postTitle || "Публікація " + displayName) + " · h00k Community",
    description: safePublicShareText(post.body?.text, 170) || "Публічний розбір трейдера @" + owner.username + " у h00k Community.",
    canonicalUrl: link.toString(),
    ...(imageUrl ? { imageUrl } : {}),
    type: "article",
  };
}

/** Public wall exposes a fixed set of fields; never serialize body or actor data. */
async function publicPostCard(db: Database, rules: Policy, row: Item) {
  const reactions = await db.query(
    "SELECT emoji,count(*)::integer AS count FROM hc_reactions WHERE item_id=$1 GROUP BY emoji ORDER BY emoji",
    [row.id],
  );
  return {
    id: row.id,
    createdAt: row.created_at,
    text: text(row.body?.text, 20_000),
    title: text(row.body?.title, 200),
    category: ["idea", "analysis", "education"].includes(row.body?.category)
      ? row.body.category as "idea" | "analysis" | "education"
      : "general",
    photos: Array.isArray(row.body?.photos)
      ? row.body.photos.slice(0, 4).filter((id: unknown) => typeof id === "string" && /^[a-f0-9-]{36}$/.test(id))
      : [],
    chart: row.chart_id ? await getChart(db, rules, row.chart_id, true) : null,
    reactions: reactions.rows,
  };
}

export function installPublicProfiles(app: Express, getDb: () => Database, buildRoot = path.resolve("dist-profile")) {
  const limits = new RequestLimits();
  let active = 0;
  const headers = (res: Response) => res.set({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  });
  const root = buildRoot;
  const read = async (req: Request, res: Response, run: () => Promise<void>) => {
    let slot = false;
    try {
      limits.take("public:" + req.ip, 120);
      if (active >= 8) fail("Профілі тимчасово зайняті", 503);
      active++; slot = true;
      await run();
    } catch (error: any) {
      if (res.headersSent) res.destroy();
      else res.status(error.status ?? 503).json({ success: false, error: error.status ? error.message : "Профіль тимчасово недоступний" });
    } finally { if (slot) active--; }
  };
  const page = async (res: Response, file: string, meta?: PublicShareMetadata) => {
    try {
      const html = await fs.readFile(path.join(root, file), "utf8");
      res.type("html").send(meta ? injectPublicShareMetadata(html, meta) : html);
    } catch {
      res.status(503).type("text").send("Інтерфейс ще не зібрано. Виконайте npm run build.");
    }
  };
  // Personal hosts are read-only. They cannot log in, set sessions or call private APIs.
  app.use((req, res, next) => {
    headers(res);
    let domain: string | null;
    let originHost: string;
    try { domain = profileDomain(); originHost = new URL(communityOrigin()).hostname; } catch { res.status(503).end(); return; }
    const host = (req.headers.host ?? "").toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
    if (!domain || host === originHost || !host.endsWith("." + domain)) { next(); return; }
    const name = nameFromHost(host, domain);
    if (!name) { res.status(404).end(); return; }
    if (!["GET", "HEAD"].includes(req.method)) { res.set("Allow", "GET, HEAD").status(405).end(); return; }
    if (req.path === "/") {
      void read(req, res, async () => {
        const db = getDb(), owner = await publicOwner(db, name);
        await page(res, "profile.html", await publicShareMeta(db, owner, req.query.post));
      });
      return;
    }
    if (req.path.startsWith("/profile-assets/assets/") ||
        req.path === `/api/public/profiles/${name}` || req.path.startsWith(`/api/public/profiles/${name}/`)) { next(); return; }
    res.status(404).end();
  });
  app.use("/profile-assets/assets", express.static(path.join(root, "assets"), {
    index: false, dotfiles: "deny", immutable: true, maxAge: "1y",
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    },
  }));
  app.get("/u/:username", (req, res) => {
    void read(req, res, async () => {
      const db = getDb(), owner = await publicOwner(db, req.params.username);
      await page(res, "profile.html", await publicShareMeta(db, owner, req.query.post));
    });
  });
  app.get("/", (req, res, next) => {
    if (process.env.COMMUNITY_STANDALONE_ENABLED !== "1" ||
        (req.headers.host ?? "").toLowerCase() !== new URL(communityOrigin()).host.toLowerCase()) { next(); return; }
    void page(res, "community.html");
  });

  const route = (suffix: string, run: (req: Request, res: Response, db: Database, owner: any, rules: Policy) => Promise<void>) => {
    app.get("/api/public/profiles/:username" + suffix, (req, res) => {
      if (req.method !== "GET") { res.set("Allow", "GET").status(405).end(); return; }
      void read(req, res, async () => {
        const db = getDb(), owner = await publicOwner(db, req.params.username);
        await run(req, res, db, owner, publicProfilePolicy(db));
      });
    });
  };
  route("", async (_req, res, db, owner) => {
    const p = owner.profile, c = p.community ?? {};
    const status = c.status?.audience === "public" && (!c.status.expiresAt || Date.parse(c.status.expiresAt) > Date.now())
      ? text(c.status.text, 280) : "";
    let statistics = null;
    if (c.statisticsAudience === "public") {
      const totals = await db.query(
        `SELECT currency,count(*)::integer AS count,count(*) FILTER(WHERE pnl>0)::integer AS wins,
        count(*) FILTER(WHERE pnl<0)::integer AS losses,count(*) FILTER(WHERE pnl=0)::integer AS flat,sum(pnl)::text AS pnl
        FROM hc_trades WHERE owner_id=$1 GROUP BY currency ORDER BY currency`, [owner.id],
      );
      const coverage = await db.query("SELECT status,synced_at,covered_from FROM hc_connections WHERE owner_id=$1 ORDER BY synced_at DESC NULLS LAST", [owner.id]);
      statistics = { basis: "bybit-linear-closed-orders", totals: totals.rows.map(row => ({
        currency: row.currency, count: row.count, wins: row.wins, losses: row.losses, flat: row.flat,
        winRate: row.wins + row.losses ? row.wins / (row.wins + row.losses) * 100 : null,
        ...(c.amountsAudience === "public" ? { pnl: row.pnl } : {}),
      })), coverage: coverage.rows };
    }
    res.json({ success: true, profile: {
      id: owner.id, username: owner.username, displayName: text(p.displayName, 100) || "Трейдер",
      joinedAt: owner.created_at, url: publicProfileUrl(owner.username), communityOrigin: communityOrigin(),
      bio: (c.bioAudience ?? "public") === "public" ? text(c.bio, 2000) : "",
      interests: c.interestsAudience === "public" ? text(c.interests, 2000) : "",
      lifestyle: c.lifestyleAudience === "public" ? text(c.lifestyle, 2000) : "",
      telegram: c.telegramAudience === "public" && /^https:\/\/t\.me\/[A-Za-z0-9_]+$/.test(c.telegram ?? "") ? c.telegram : "",
      status, statistics,
      avatarUrl: c.avatarAudience === "public" && typeof c.avatarMediaId === "string"
        ? "/api/public/profiles/" + owner.username + "/avatar" : null,
      coverUrl: c.coverAudience === "public" && typeof c.coverMediaId === "string"
        ? "/api/public/profiles/" + owner.username + "/cover" : null,
    } });
  });
  // Avatar and cover are explicit opt-in media. No other files become public.
  for (const kind of ["avatar", "cover"] as const) {
    route("/" + kind, async (_req, res, db, owner) => {
      const c = owner.profile?.community ?? {};
      const id = c[kind + "MediaId"];
      if (c[kind + "Audience"] !== "public" || typeof id !== "string")
        fail("Зображення недоступне", 404);
      const mediaId = uuid(id);
      const rows = await db.query(
        "SELECT id FROM hc_media WHERE id=$1 AND owner_id=$2",
        [mediaId, owner.id],
      );
      if (!rows.rows.length) fail("Зображення недоступне", 404);
      try { res.type("image/webp").send(await fs.readFile(path.join(mediaRoot(), mediaId + ".webp"))); }
      catch { fail("Зображення недоступне", 404); }
    });
  }
  route("/posts", async (req, res, db, owner, rules) => {
    const before = req.query.before ? uuid(req.query.before) : null;
    const { rows } = await db.query<Item>(
      `SELECT * FROM hc_items WHERE owner_id=$1 AND kind='post' AND audience='public' AND conversation_id IS NULL AND NOT deleted
      AND ($2::uuid IS NULL OR (created_at,id)<(SELECT created_at,id FROM hc_items WHERE id=$2 AND owner_id=$1 AND kind='post' AND audience='public' AND NOT deleted))
      ORDER BY created_at DESC,id DESC LIMIT 16`, [owner.id, before],
    );
    const output = [];
    for (const row of rows.slice(0, 15)) {
      if (!(await rules.visible(row)) || (row.chart_id && !(await rules.canReadChart(row.chart_id)))) continue;
      output.push(await publicPostCard(db, rules, row));
    }
    res.json({ success: true, items: output, next: rows.length > 15 ? rows[14].id : null });
  });
  // A shareable link loads one post without requiring users to scroll through earlier pages.
  route("/posts/:id", async (req, res, db, owner, rules) => {
    const row = await publicPost(db, rules, owner.id, req.params.id);
    res.json({ success: true, item: await publicPostCard(db, rules, row) });
  });
  // Anonymous comments are intentionally read-only and restricted to public opt-in authors.
  route("/posts/:id/comments", async (req, res, db, owner, rules) => {
    const parent = await publicPost(db, rules, owner.id, req.params.id);
    const after = req.query.after ? uuid(req.query.after) : null;
    const { rows } = await db.query<(Item & { author_profile: Record<string, any> })>(
      `SELECT c.*,u.profile AS author_profile FROM hc_items c JOIN hc_users u ON u.id=c.owner_id
       WHERE c.parent_id=$1 AND c.kind='comment' AND c.audience='public' AND c.conversation_id IS NULL AND NOT c.deleted
       AND ($2::uuid IS NULL OR (c.created_at,c.id)>(SELECT created_at,id FROM hc_items
         WHERE id=$2 AND parent_id=$1 AND kind='comment' AND audience='public' AND NOT deleted))
       ORDER BY c.created_at,c.id LIMIT 21`,
      [parent.id, after],
    );
    const items = [];
    for (const row of rows.slice(0, 20)) {
      if (!(await rules.visible(row)) || (row.chart_id && !(await rules.canReadChart(row.chart_id)))) continue;
      const source = row.body?.sourceItemId ? await rules.item(row.body.sourceItemId) : null;
      const quoted = source && (await rules.visible(source)) ? text(source.body?.text, 180) : "";
      const reactions = await db.query(
        "SELECT emoji,count(*)::integer AS count FROM hc_reactions WHERE item_id=$1 GROUP BY emoji ORDER BY emoji",
        [row.id],
      );
      items.push({
        id: row.id,
        createdAt: row.created_at,
        author: text(row.author_profile?.displayName, 100) || "Трейдер",
        text: text(row.body?.text, 20_000),
        quote: quoted,
        photosCount: Array.isArray(row.body?.photos) ? Math.min(row.body.photos.length, 4) : 0,
        hasChart: Boolean(row.chart_id),
        reactions: reactions.rows,
      });
    }
    res.json({ success: true, items, next: rows.length > 20 ? rows[19].id : null });
  });
  route("/posts/:id/chart", async (req, res, db, owner, rules) => {
    const row = await publicPost(db, rules, owner.id, req.params.id);
    if (!row.chart_id) fail("Графік недоступний", 404);
    res.json({ success: true, document: await getChart(db, rules, row.chart_id) });
  });
  route("/posts/:id/media/:media", async (req, res, db, owner, rules) => {
    const row = await publicPost(db, rules, owner.id, req.params.id), id = uuid(req.params.media);
    if (!Array.isArray(row.body?.photos) || !row.body.photos.includes(id)) fail("Фото недоступне", 404);
    const asset = await db.query("SELECT id FROM hc_media WHERE id=$1 AND owner_id=$2", [id, owner.id]);
    if (!asset.rows.length) fail("Фото недоступне", 404);
    try { res.type("image/webp").send(await fs.readFile(path.join(mediaRoot(), id + ".webp"))); }
    catch { fail("Фото недоступне", 404); }
  });
}
