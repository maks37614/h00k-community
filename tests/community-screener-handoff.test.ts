import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chartFromScreenerHandoff } from "../src/community/screenerHandoff";
import { normalizeChartDocument } from "../src/community/chartDocument";

const source = readFileSync(new URL("../src/components/community/CommunityPage.tsx",import.meta.url),"utf8");
const quality = readFileSync(new URL("../server/community/content.ts",import.meta.url),"utf8");
const now = Math.floor(Date.now()/60_000)*60_000 - 60_000;
const step=60;
function packet(){
  const capturedAt=now-60_000, latest=capturedAt/1000-step;
  return {
    version:1,source:"h00k.top",issuedAt:now,expiresAt:now+600_000,
    capturedAt,symbol:"BTCUSDT",exchange:"binance",marketType:"futures",timeframe:"1m",
    candles:Array.from({length:40},(_,i)=>[latest-(39-i)*step,100,110,90,101,100+i]),
    markers:[
      {type:"entry",price:101},{type:"stop_loss",price:96},{type:"target",price:109},{type:"neckline",price:99},
    ],
  };
}
function token(value:any){return Buffer.from(JSON.stringify(value),"utf8").toString("base64url");}

test("handoff builds an unpublished, normalized HookChart snapshot from actual closed OHLC and curated markers",()=>{
  const doc=chartFromScreenerHandoff(token(packet()),now+10_000);
  assert.equal(doc.symbol,"BTCUSDT");
  assert.equal(doc.exchange,"binance");
  assert.equal(doc.marketType,"futures");
  assert.equal(doc.timeframe,"1m");
  assert.equal(doc.capturedAt,packet().capturedAt);
  assert.equal(doc.series["1m"]?.length,40);
  assert.deepEqual(doc.markers.map(m=>m.type),["entry","stop_loss","target","neckline"]);
  assert.deepEqual(doc.markers.map(m=>m.price),[101,96,109,99]);
  assert.deepEqual(doc.drawings,[]);
  assert.equal(doc.qualityProof,undefined);
  assert.deepEqual(normalizeChartDocument(doc),doc);
  assert.ok(doc.series["1m"]!.every(c=>(c.time+step)*1000<=doc.capturedAt));
});

test("handoff refuses expired, modified, malformed, duplicate, future or incomplete snapshots",()=>{
  assert.throws(()=>chartFromScreenerHandoff(token(packet()),now+600_001),/термін дії/);
  assert.throws(()=>chartFromScreenerHandoff(token({...packet(),expiresAt:now+900_000}),now));
  assert.throws(()=>chartFromScreenerHandoff(token({...packet(),source:"evil.example"}),now));
  assert.throws(()=>chartFromScreenerHandoff(token({...packet(),symbol:"BTC/USDT"}),now));
  assert.throws(()=>chartFromScreenerHandoff(token({...packet(),candles:[]}),now));
  assert.throws(()=>chartFromScreenerHandoff(token({...packet(),candles:packet().candles.slice(-4)}),now));
  assert.throws(()=>chartFromScreenerHandoff(token({...packet(),candles:[...packet().candles,packet().candles.at(-1)]}),now),/некоректні/);
  assert.throws(()=>chartFromScreenerHandoff(token({...packet(),candles:packet().candles.map((v,i)=>i===0?[v[0],100,109,90,110,v[5]]:v)}),now));
  assert.throws(()=>chartFromScreenerHandoff(token({...packet(),candles:packet().candles.map((v,i)=>i===39?[Math.floor(packet().capturedAt/1000),100,110,90,101,100]:v)}),now),/незакриті/);
  assert.throws(()=>chartFromScreenerHandoff(token({...packet(),markers:packet().markers.filter(m=>m.type!=="target")}),now));
  assert.throws(()=>chartFromScreenerHandoff(token({...packet(),markers:[...packet().markers,packet().markers[0]]}),now));
  assert.throws(()=>chartFromScreenerHandoff("bad",now));
  assert.throws(()=>chartFromScreenerHandoff("A".repeat(24001),now));
});

test("handoff is an opt-in non-publishing preview and scrubs fragment before rendering",()=>{
  const start=source.indexOf("// Import is explicit on h00k.top.");
  const finish=source.indexOf("  const openChart =",start);
  assert.ok(start>0&&finish>start);
  const hook=source.slice(start,finish);
  assert.match(hook,/query\.get\("handoff"\)/);
  assert.match(hook,/query\.delete\("handoff"\)/);
  assert.match(hook,/history\.replaceState\(/);
  assert.match(hook,/chartFromScreenerHandoff\(packet\)/);
  assert.match(hook,/setDraft\(\{ document, target: \{ kind: "post" \} \}\)/);
  assert.match(hook,/опублікувати її можете тільки ви/);
  assert.match(hook,/Походження свічок у посиланні не перевірене незалежно/);
  assert.doesNotMatch(hook,/post\(|apiJson\(|saveChart\(|qualityScore:|fetch\(/);
  assert.match(source,/useState\(\(\) => draft\.document\.qualityProof \? JSON\.stringify\(draft\.document\.qualityProof\) : ""\)/);
  assert.match(quality,/verifyArchiveScoreProof\(document\.qualityProof, document, process\.env\.H00K_QUALITY_VERIFY_KEY_B64\)/);
});
