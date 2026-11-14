import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PublicSocialReferenceStats, sourceProfileKpis,
} from "../src/community/PublicSocialReferenceStats";

const page = readFileSync(new URL("../src/community/publicProfile.tsx", import.meta.url), "utf8");
const style = readFileSync(new URL("../src/community/publicProfileSocialSourceClone.css", import.meta.url), "utf8");
const server = readFileSync(new URL("../server/community/publicProfiles.ts", import.meta.url), "utf8");
const source = readFileSync(new URL("../src/community/PublicSocialReferenceStats.tsx", import.meta.url), "utf8");

test("source-aligned social profile only changes /u/maks, preserving all other public profiles", () => {
  assert.match(page, /data-social-source-clone=\{profile\?\.username === "maks" \? "maks" : undefined\}/);
  assert.match(page, /import "\.\/publicProfileSocialSourceClone\.css";/);
  assert.ok(page.indexOf('import "./publicProfileSocialSourceClone.css"') >
    page.indexOf('import "./publicProfileReferenceLayout.css"'), "overrides must load after the existing layout");
  assert.match(page, /<PublicSocialReferenceStats statistics=\{profile\.statistics\} \/>/);
  assert.match(page, /: profile\.statistics \? \(/); // older layout remains unchanged
  assert.match(style, /\.public-profile\[data-social-source-clone="maks"\]/);
  assert.match(style, /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(style, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(style, /@media \(max-width: 560px\)/);
  assert.match(style, /public-profile-social-layout > \.public-profile-insights/);
  assert.match(style, /public-profile-social-layout > \.public-profile-main/);
  assert.match(style, /public-profile-identity/);
  assert.match(style, /public-profile-avatar/);
  assert.match(server, /app\.get\("\/u\/:username"/);
  assert.match(server, /publicOwner\(db, req\.params\.username\)/);
});

test("source six KPI cards use genuine 30d totals, not social/mock data", () => {
  const statistics = {
    coverage: [],
    windows: [
      { days: 7, totals: [{currency:"USDT",count:1,wins:1,losses:0,flat:0,winRate:100,pnl:"7.5"}] },
      { days: 30, totals: [{currency:"USDT",count:9,wins:5,losses:3,flat:1,winRate:62.5,pnl:"31.25"}] },
    ],
  };
  const kpi = sourceProfileKpis(statistics);
  assert.equal(kpi.count,9);
  assert.equal(kpi.winRate,62.5);
  assert.equal(kpi.pnl,"31.25");
  assert.equal(kpi.currency,"USDT");
  const html = renderToStaticMarkup(React.createElement(PublicSocialReferenceStats,{statistics}));
  assert.match(html, /Win Rate/);
  assert.match(html, /62\.5%/);
  assert.match(html, /PnL \(30d\)/);
  assert.match(html, /31\.25 USDT/);
  assert.match(html, /Середній R:R/);
  assert.match(html, /Profit Factor/);
  assert.match(html, /Топ трейд/);
  assert.match(html, /Улюблені пари/);
  assert.equal((html.match(/class="public-profile-social-source-kpi/g)??[]).length,6);
  assert.doesNotMatch(html,/428 угод|Profit Factor[^]*?2\.4|142 друзів|fake/i);
  assert.match(source,/Не оприлюднено у Community/);
});

test("hidden or missing statistics never become fictitious returns or zero win rate",()=>{
  assert.deepEqual(sourceProfileKpis(null),{count:null,winRate:null,pnl:null,currency:null});
  assert.deepEqual(sourceProfileKpis({coverage:[]}),{count:null,winRate:null,pnl:null,currency:null});
  const html=renderToStaticMarkup(React.createElement(PublicSocialReferenceStats,{statistics:null}));
  assert.doesNotMatch(html,/\+\d+%|\$\d+|Win Rate[^]*?100%|Улюблені пари[^]*?BTC/);
  assert.match(html,/Порожні показники означають відсутність або обмеження даних/);
  assert.match(html,/>—<\/dd>/);
});

test("PnL of different currencies or amounts hidden by the owner must not be merged or inferred",()=>{
  const multi={coverage:[],windows:[{days:30,totals:[
    {currency:"USDT",count:4,wins:2,losses:1,flat:1,winRate:66.6,pnl:"100"},
    {currency:"USD",count:3,wins:1,losses:2,flat:0,winRate:33.3,pnl:"200"},
  ]}]};
  const kpi=sourceProfileKpis(multi);
  assert.equal(kpi.count,7);
  assert.equal(kpi.winRate,50);
  assert.equal(kpi.pnl,null);
  const noAmount={coverage:[],windows:[{days:30,totals:[
    {currency:"USDT",count:5,wins:3,losses:2,flat:0,winRate:60},
  ]}]};
  assert.equal(sourceProfileKpis(noAmount).pnl,null);
  assert.equal(sourceProfileKpis({coverage:[],windows:[{days:30,totals:[]}]}).winRate,null);
});

test("social demo statistics and photos never enter Community's public profile code",()=>{
  assert.doesNotMatch(page,/INITIAL_PROFILES|INITIAL_ARTICLES|TRADING_ATLAS_PROFILE|mockData|demoPnl/);
  assert.doesNotMatch(source,/mockData|user_maks|friendCount:|followersCount:|pnl30dPercent|winRate: 87|avatar: 'https/);
  assert.match(server,/c\.statisticsAudience === "public"/);
  assert.match(server,/c\.amountsAudience === "public"/);
  assert.match(server,/c\.avatarAudience === "public"/);
  assert.match(server,/c\.coverAudience === "public"/);
});
