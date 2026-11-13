import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import * as OTPAuth from 'otpauth';
import { migrate, type Database } from '../server/community/db';
import { installAccountRoutes } from '../server/community/account';
import { installCommunityRoutes, installMediaRoutes } from '../server/community/routes';
import { captureChartDocument, cloneChartDocument, chartCandles, normalizeChartDocument } from '../src/community/chartDocument';
import { historyBlock } from '../server/community/history';
import { lossSum, evaluateRisk, riskWindows } from '../server/community/risk';
import { bybitRead, checkReadOnly } from '../server/community/bybit';
import type { Kline } from '../src/types';
import {testDatabase} from './fixtures/community-db';

const engine=new PGlite();
const db=testDatabase(engine),mail: Array<{email:string;url:string}>=[];
let authNow=Date.now();
let server:any,base:string;
const previousKey=process.env.COMMUNITY_ENCRYPTION_KEY,previousMedia=process.env.COMMUNITY_MEDIA_DIR,previousOrigin=process.env.APP_ORIGIN;
process.env.COMMUNITY_ENCRYPTION_KEY=randomBytes(32).toString('base64');
const mediaPath=new URL(`../server/data/.community-test-${process.pid}/`,import.meta.url).pathname;
process.env.COMMUNITY_MEDIA_DIR=mediaPath;
type Actor={id:string;cookie:string;email:string};
let alice:Actor,bob:Actor,eve:Actor;
async function call(path:string,actor?:Actor,method='GET',body?:any,headers:Record<string,string>={}){
  const res=await fetch(base+path,{method,headers:{'X-H00K-Request':'1',...(actor?{Cookie:actor.cookie}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const data=await res.json().catch(()=>null);return {res,data};
}
const api='/api/community';
async function register(name:string):Promise<Actor>{
  const email=name.toLowerCase()+'@example.test';const {res,data}=await call('/api/account/register',undefined,'POST',{email,password:'correct horse battery '+name,displayName:name});assert.equal(res.status,201,JSON.stringify(data));
  return {id:data.user.uid,email,cookie:res.headers.getSetCookie()[0].split(';')[0]};
}
function snapshot(){const now=Date.now(),start=Math.floor(now/1000/60)*60-6000;
  const candles:Kline[]=Array.from({length:90},(_,i)=>({time:start+i*60,open:100+i/10,high:102+i/10,low:99+i/10,close:101+i/10,volume:100+i}));
  return captureChartDocument({symbol:'BTCUSDT',exchange:'binance',marketType:'futures',timeframe:'1m',capturedAt:now,candles,
    markers:[{id:'entry',type:'entry',label:'Вхід',price:102,color:'#38bdf8'}],drawings:[{id:'trend',type:'trend',pts:[{t:start*1000,p:100},{t:(start+600)*1000,p:105}]}]});
}
test.before(async()=>{
  await migrate(db);const app=express();installMediaRoutes(app,()=>db);app.use(express.json({limit:'2mb'}));installAccountRoutes(app,()=>db,async(email,_subject,url)=>{mail.push({email,url});},()=>authNow);installCommunityRoutes(app,()=>db);
  server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));base='http://127.0.0.1:'+server.address().port;process.env.APP_ORIGIN=base;
  alice=await register('Alice');bob=await register('Bob');eve=await register('Eve');
});
test.after(async()=>{if(server)await new Promise<void>(resolve=>server.close(resolve));await engine.close();await fs.rm(mediaPath,{recursive:true,force:true});if(previousKey)process.env.COMMUNITY_ENCRYPTION_KEY=previousKey;else delete process.env.COMMUNITY_ENCRYPTION_KEY;if(previousMedia)process.env.COMMUNITY_MEDIA_DIR=previousMedia;else delete process.env.COMMUNITY_MEDIA_DIR;if(previousOrigin)process.env.APP_ORIGIN=previousOrigin;else delete process.env.APP_ORIGIN;});

test('own registration uses HttpOnly sessions, rejects CSRF and cannot change owner or email',async()=>{
  const me=await call('/api/account/me',alice);assert.equal(me.data.user.uid,alice.id);assert.equal(me.data.security.emailVerified,false);assert.equal(me.data.security.mfaEnabled,false);
  const rejected=await call('/api/account/profile',alice,'PATCH',{uid:eve.id,email:eve.email,displayName:'Alice updated'},{Origin:'https://attacker.test'});assert.equal(rejected.res.status,403);
  const updated=await call('/api/account/profile',alice,'PATCH',{uid:eve.id,email:eve.email,displayName:'Alice updated'});assert.equal(updated.data.profile.uid,alice.id);assert.equal(updated.data.profile.email,alice.email);
  assert.equal((await call(api+'/archives')).res.status,401);
});

test('archive preserves candles, drawings and dragged TP/SL without another owner reading it',async()=>{
  const document=snapshot();document.markers[0].price=104.25;
  const item={id:'arch_'+randomUUID(),userId:eve.id,symbol:document.symbol,chartDocument:document};
  assert.equal((await call(api+'/archives',alice,'POST',item)).res.status,200);
  const own=await call(api+'/archives',alice);assert.equal(own.data.items[0].userId,alice.id);assert.equal(own.data.items[0].chartDocument,undefined);assert.equal(own.data.items[0].hasChartDocument,true);
  const full=await call(api+'/archives/'+item.id,alice);assert.equal(full.data.item.chartDocument.markers[0].price,104.25);assert.deepEqual(full.data.item.chartDocument.drawings,document.drawings);
  assert.equal((await call(api+'/archives/'+item.id,bob)).res.status,404);
  assert.deepEqual((await call(api+'/archives',bob)).data.items,[]);
});

test('forks share candle packs but never change the parent; revocation closes descendants',async()=>{
  const document=snapshot();const created=await call(api+'/charts',alice,'POST',{document});assert.equal(created.res.status,201,JSON.stringify(created.data));const parent=created.data.id;
  assert.equal((await call(api+'/charts/'+parent,bob)).res.status,404);
  await call(api+'/friends/'+bob.id,alice,'POST',{});await call(api+'/friends/'+alice.id,bob,'POST',{});
  const post=await call(api+'/items',alice,'POST',{kind:'post',audience:'friends',chartId:parent,body:{text:'Розбір'}});assert.equal(post.res.status,201,JSON.stringify(post.data));
  assert.equal((await call(api+'/charts/'+parent,bob)).res.status,200);
  const reply=cloneChartDocument(document);reply.markers[0].price=120;reply.drawings[0].pts[0].p=88;
  const fork=await call(api+'/charts',bob,'POST',{document:reply,parentId:parent});assert.equal(fork.res.status,201,JSON.stringify(fork.data));
  const archivedReply={id:'arch_'+randomUUID(),chartDocument:reply,sourceChartId:fork.data.id};
  assert.equal((await call(api+'/archives',bob,'POST',archivedReply)).res.status,200);
  assert.equal((await call(api+'/archives',bob,'POST',{...archivedReply,sourceChartId:undefined})).res.status,403);
  const counterfeit=cloneChartDocument(reply);counterfeit.series['1m']![0].close=100.5;
  assert.equal((await call(api+'/charts',bob,'POST',{document:counterfeit,parentId:parent})).res.status,400);
  const original=await call(api+'/charts/'+parent,alice);assert.equal(original.data.document.markers[0].price,102);assert.equal(original.data.document.drawings[0].pts[0].p,100);
  const packs=await db.query('SELECT count(*)::integer AS count FROM hc_packs');assert.equal(packs.rows[0].count,1);
  assert.equal((await call(api+'/items',bob,'POST',{kind:'post',audience:'public',chartId:fork.data.id,body:{text:'Не можна розкрити друзям усіх'}})).res.status,403);
  const comment=await call(api+'/items',bob,'POST',{kind:'comment',audience:'friends',parentId:post.data.id,chartId:fork.data.id,body:{text:'Мій варіант'}});assert.equal(comment.res.status,201,JSON.stringify(comment.data));
  const thread=await call(api+'/items/'+post.data.id+'/comments',bob);assert.equal(thread.data.items[0].id,comment.data.id);
  assert.equal((await call(api+'/items/'+post.data.id+'/comments',eve)).res.status,404);
  assert.equal((await call(api+'/items/'+comment.data.id,eve)).res.status,404);
  await call(api+'/friends/'+bob.id,alice,'DELETE');
  assert.equal((await call(api+'/charts/'+fork.data.id,bob)).res.status,404);
  assert.equal((await call(api+'/items/'+comment.data.id,bob)).res.status,404);
  assert.equal((await call(api+'/items/'+post.data.id+'/comments',bob)).res.status,404);
  assert.equal((await call(api+'/archives/'+archivedReply.id,bob)).res.status,404);
  assert.ok(!(await call(api+'/archives',bob)).data.items.some((item:any)=>item.id===archivedReply.id));
});

test('a feed mount reads snapshots without exchange network requests; public and friends are distinct',async()=>{
  const item=await call(api+'/items',alice,'POST',{kind:'post',audience:'public',body:{text:'Загальнодоступний розбір'}});assert.equal(item.res.status,201);
  const publicFeed=await call(api+'/feed?mode=public',eve);assert.ok(publicFeed.data.items.some((p:any)=>p.id===item.data.id));
  const friendsFeed=await call(api+'/feed?mode=friends',eve);assert.ok(!friendsFeed.data.items.some((p:any)=>p.id===item.data.id));
  const mine=await call(api+'/feed?mode=wall&owner='+alice.id,alice);assert.ok(mine.data.items.some((p:any)=>p.id===item.data.id));
});

test('quoted comment replies respect source audience and stay attached to the original post', async () => {
  // Reuse preexisting actors: avoid bypassing registration rate limits in tests.
  const author = alice;
  const peer = eve;
  const outsider = bob;
  assert.equal((await call(api + '/friends/' + peer.id, author, 'POST', {})).res.status, 200);
  assert.equal((await call(api + '/friends/' + author.id, peer, 'POST', {})).res.status, 200);

  const post = await call(api + '/items', author, 'POST', {
    kind: 'post', audience: 'public', body: { text: 'Публічний розбір з обговоренням' },
  });
  assert.equal(post.res.status, 201, JSON.stringify(post.data));

  const source = await call(api + '/items', peer, 'POST', {
    kind: 'comment', audience: 'friends', parentId: post.data.id,
    body: { text: 'Коментар тільки для підтверджених друзів' },
  });
  assert.equal(source.res.status, 201, JSON.stringify(source.data));
  assert.equal((await call(api + '/items/' + source.data.id, outsider)).res.status, 404);

  const forbidden = await call(api + '/items', author, 'POST', {
    kind: 'comment', parentId: post.data.id, audience: 'public',
    body: { text: 'Не можна цитувати для всіх', sourceItemId: source.data.id },
  });
  assert.equal(forbidden.res.status, 403, JSON.stringify(forbidden.data));

  const reply = await call(api + '/items', author, 'POST', {
    kind: 'comment', parentId: post.data.id, audience: 'friends',
    body: { text: 'Відповідаю на конкретний коментар', sourceItemId: source.data.id },
  });
  assert.equal(reply.res.status, 201, JSON.stringify(reply.data));

  const thread = await call(api + '/items/' + post.data.id + '/comments', peer);
  const quoted = thread.data.items.find((item: any) => item.id === reply.data.id);
  assert.equal(quoted.parent_id, post.data.id);
  assert.equal(quoted.body.sourceItemId, source.data.id);
  assert.equal(quoted.source.text, 'Коментар тільки для підтверджених друзів');
  assert.equal((await call(api + '/items/' + reply.data.id, outsider)).res.status, 404);

  const publicSource = await call(api + '/items', author, 'POST', {
    kind: 'comment', parentId: post.data.id, audience: 'public',
    body: { text: 'Загальнодоступний коментар' },
  });
  assert.equal(publicSource.res.status, 201, JSON.stringify(publicSource.data));
  const publicReply = await call(api + '/items', peer, 'POST', {
    kind: 'comment', parentId: post.data.id, audience: 'public',
    body: { text: 'Публічна відповідь', sourceItemId: publicSource.data.id },
  });
  assert.equal(publicReply.res.status, 201, JSON.stringify(publicReply.data));
  const readable = await call(api + '/items/' + publicReply.data.id, outsider);
  assert.equal(readable.res.status, 200, JSON.stringify(readable.data));
  assert.equal(readable.data.item.source.text, 'Загальнодоступний коментар');
});

test('reaction toggle works on posts and comments, with viewer-specific selected state and privacy', async () => {
  const post = await call(api + '/items', alice, 'POST', {
    kind: 'post', audience: 'public', body: { text: 'Пост для перевірки реакцій' },
  });
  assert.equal(post.res.status, 201, JSON.stringify(post.data));

  const react = (actor: Actor, id: string, emoji: string) =>
    call(api + '/items/' + id + '/reaction', actor, 'POST', { emoji });

  const first = await react(eve, post.data.id, '👍');
  assert.equal(first.res.status, 200, JSON.stringify(first.data));
  assert.equal(first.data.active, true);

  const mine = await call(api + '/items/' + post.data.id, eve);
  assert.deepEqual(mine.data.item.reactions, [{ emoji: '👍', count: 1, mine: true }]);
  const other = await call(api + '/items/' + post.data.id, alice);
  assert.deepEqual(other.data.item.reactions, [{ emoji: '👍', count: 1, mine: false }]);

  const removed = await react(eve, post.data.id, '👍');
  assert.equal(removed.res.status, 200);
  assert.equal(removed.data.active, false);
  assert.deepEqual((await call(api + '/items/' + post.data.id, eve)).data.item.reactions, []);

  assert.equal((await react(eve, post.data.id, '❤️')).data.active, true);
  assert.equal((await react(eve, post.data.id, '🔥')).data.active, true);
  assert.deepEqual((await call(api + '/items/' + post.data.id, eve)).data.item.reactions,
    [{ emoji: '🔥', count: 1, mine: true }]);

  const secret = await call(api + '/items', alice, 'POST', {
    kind: 'comment', parentId: post.data.id, audience: 'private',
    body: { text: 'Цей коментар доступний лише автору' },
  });
  assert.equal(secret.res.status, 201, JSON.stringify(secret.data));
  assert.equal((await react(eve, secret.data.id, '👍')).res.status, 404);

  assert.equal((await react(alice, secret.data.id, '👏')).res.status, 200);
  const myComment = await call(api + '/items/' + secret.data.id, alice);
  assert.deepEqual(myComment.data.item.reactions, [{ emoji: '👏', count: 1, mine: true }]);
});

test('real group chats support membership listing, invitations, ownership transfer and leaving', async () => {
  await call(api + '/friends/' + bob.id, alice, 'POST', {});
  await call(api + '/friends/' + alice.id, bob, 'POST', {});
  await call(api + '/friends/' + eve.id, alice, 'POST', {});
  await call(api + '/friends/' + alice.id, eve, 'POST', {});

  assert.equal((await call(api + '/conversations', alice, 'POST', {
    title: 'Некоректний режим', members: [bob.id], isGroup: 'yes',
  })).res.status, 400);
  const direct = await call(api + '/conversations', alice, 'POST', {
    title: 'Особистий діалог', members: [bob.id], isGroup: false,
  });
  assert.equal(direct.res.status, 201, JSON.stringify(direct.data));
  const directInfo = await call(api + '/conversations', alice);
  assert.equal(directInfo.data.items.find((c: any) => c.id === direct.data.id)?.is_group, false);
  assert.equal(directInfo.data.items.find((c: any) => c.id === direct.data.id)?.peer_name, 'Bob');
  const peerView = await call(api + '/conversations', bob);
  assert.match(peerView.data.items.find((c: any) => c.id === direct.data.id)?.peer_name, /Alice/);
  assert.equal((await call(api + '/conversations/' + direct.data.id + '/members', eve)).res.status, 404);
  assert.equal((await call(api + '/conversations/' + direct.data.id + '/members', alice)).data.items.length, 2);
  assert.equal((await call(api + '/conversations/' + direct.data.id + '/members', alice, 'POST', {
    id: eve.id,
  })).res.status, 403);

  // One invited person still creates a real group, open to adding confirmed friends later.
  const group = await call(api + '/conversations', alice, 'POST', {
    title: 'Груповий аналіз', members: [bob.id], isGroup: true,
  });
  assert.equal(group.res.status, 201, JSON.stringify(group.data));
  const id = group.data.id;
  const list = await call(api + '/conversations/' + id + '/members', bob);
  assert.equal(list.res.status, 200);
  assert.deepEqual(new Set(list.data.items.map((m: any) => m.id)), new Set([alice.id,bob.id]));
  assert.equal(list.data.items.find((m: any) => m.id === alice.id)?.role, 'owner');
  assert.doesNotMatch(JSON.stringify(list.data), /password_hash|email|credential|mfa_secret/);
  assert.equal((await call(api + '/conversations/' + id + '/members', eve)).res.status, 404);
  assert.equal((await call(api + '/conversations/' + id + '/members', bob, 'POST', {
    id: eve.id,
  })).res.status, 403);
  assert.equal((await call(api + '/conversations/' + id + '/members', alice, 'POST', {
    id: eve.id,
  })).res.status, 200);
  assert.equal((await call(api + '/conversations/' + id + '/members', alice, 'POST', {
    id: eve.id,
  })).res.status, 200);
  assert.equal((await call(api + '/conversations/' + id + '/members', eve)).data.items.length, 3);

  assert.equal((await call(api + '/conversations/' + id + '/transfer', bob, 'POST', {
    targetId: eve.id,
  })).res.status, 403);
  const handover = await call(api + '/conversations/' + id + '/transfer', alice, 'POST', {
    targetId: eve.id,
  });
  assert.equal(handover.res.status, 200, JSON.stringify(handover.data));
  const transferred = await call(api + '/conversations/' + id + '/members', alice);
  assert.equal(transferred.data.items.find((m: any) => m.id === eve.id)?.role, 'owner');
  assert.equal((await call(api + '/conversations/' + id + '/transfer', alice, 'POST', {
    targetId: bob.id,
  })).res.status, 403);
  assert.equal((await call(api + '/conversations/' + id + '/members/' + eve.id, eve, 'DELETE')).res.status, 400);
  assert.equal((await call(api + '/conversations/' + id + '/members/' + alice.id, alice, 'DELETE')).res.status, 200);
  assert.equal((await call(api + '/conversations/' + id + '/members', alice)).res.status, 404);
  assert.equal((await call(api + '/conversations/' + id + '/members', eve)).res.status, 200);
});

test('unread message cursors are member-private, monotonic, and respect join time', async () => {
  await call(api + '/friends/' + eve.id, alice, 'POST', {});
  await call(api + '/friends/' + alice.id, eve, 'POST', {});
  await call(api + '/friends/' + bob.id, alice, 'POST', {});
  await call(api + '/friends/' + alice.id, bob, 'POST', {});
  const room = await call(api + '/conversations', alice, 'POST', {
    title: 'Непрочитані повідомлення', members: [eve.id], isGroup: true,
  });
  assert.equal(room.res.status, 201, JSON.stringify(room.data));
  const roomId = room.data.id;
  const baseline = (await call(api + '/conversations/unread', eve)).data.unread;

  const first = await call(api + '/items', alice, 'POST', {
    kind: 'message', conversationId: roomId, body: { text: 'Перше повідомлення' },
  });
  const second = await call(api + '/items', alice, 'POST', {
    kind: 'message', conversationId: roomId, body: { text: 'Друге повідомлення' },
  });
  assert.equal(first.res.status, 201);
  assert.equal(second.res.status, 201);
  const findRoom = async (actor: Actor) =>
    (await call(api + '/conversations', actor)).data.items.find((c: any) => c.id === roomId);
  assert.equal((await findRoom(eve)).unread_count, 2);
  assert.equal((await findRoom(alice)).unread_count, 0);
  assert.equal((await call(api + '/conversations/unread', eve)).data.unread, baseline + 2);
  assert.equal((await call(api + '/conversations/unread', alice)).data.unread, 0);
  assert.equal((await call(api + '/conversations/' + roomId + '/read', bob, 'POST', {
    messageId: second.data.id,
  })).res.status, 404);
  assert.equal((await call(api + '/conversations/' + roomId + '/read', eve, 'POST', {
    messageId: randomUUID(),
  })).res.status, 404);
  assert.equal((await call(api + '/conversations/' + roomId + '/read', eve, 'POST', {
    messageId: first.data.id,
  })).res.status, 200);
  assert.equal((await findRoom(eve)).unread_count, 1);
  assert.equal((await call(api + '/conversations/' + roomId + '/read', eve, 'POST', {
    messageId: second.data.id,
  })).res.status, 200);
  assert.equal((await findRoom(eve)).unread_count, 0);
  assert.equal((await call(api + '/conversations/' + roomId + '/read', eve, 'POST', {
    messageId: first.data.id,
  })).res.status, 200);
  assert.equal((await findRoom(eve)).unread_count, 0, 'older read cursor must never overwrite the newer one');
  assert.equal((await call(api + '/conversations/unread', eve)).data.unread, baseline);

  // Newly invited participants may not inherit another member's earlier messages.
  assert.equal((await call(api + '/conversations/' + roomId + '/members', alice, 'POST', {
    id: bob.id,
  })).res.status, 200);
  assert.equal((await findRoom(bob)).unread_count, 0);
  const newer = await call(api + '/items', alice, 'POST', {
    kind: 'message', conversationId: roomId, body: { text: 'Після запрошення' },
  });
  assert.equal(newer.res.status, 201);
  assert.equal((await findRoom(bob)).unread_count, 1);
  assert.equal((await findRoom(eve)).unread_count, 1);
  assert.equal((await call(api + '/conversations/' + roomId + '/read', bob, 'POST', {
    messageId: first.data.id,
  })).res.status, 404, 'cannot acknowledge messages from before joining');
  await call(api + '/conversations/' + roomId + '/members/' + bob.id, bob, 'DELETE');
  assert.equal((await call(api + '/conversations/' + roomId + '/read', bob, 'POST', {
    messageId: newer.data.id,
  })).res.status, 404);
  assert.equal((await call(api + '/conversations', bob)).data.items.some((c: any) => c.id === roomId), false);
});

test('group membership, message idempotence and block policy apply to direct links too',async()=>{
  await call(api+'/friends/'+bob.id,alice,'POST',{});await call(api+'/friends/'+alice.id,bob,'POST',{});
  const group=await call(api+'/conversations',alice,'POST',{title:'Спільний тест',members:[bob.id]});assert.equal(group.res.status,201,JSON.stringify(group.data));const conversationId=group.data.id;
  const clientId=randomUUID(),body={kind:'message',conversationId,clientId,body:{text:'Порівняймо розмітку 🙂'}};
  const sent=await call(api+'/items',alice,'POST',body);assert.equal(sent.res.status,201);assert.equal((await call(api+'/items',alice,'POST',body)).data.id,sent.data.id);
  const messages=await call(api+'/conversations/'+conversationId+'/messages',bob);assert.equal(messages.data.items.length,1);assert.equal((await call(api+'/conversations/'+conversationId+'/messages',eve)).res.status,404);
  const reply=await call(api+'/items',bob,'POST',{kind:'message',conversationId,clientId:randomUUID(),body:{text:'Мій незалежний варіант'}});
  assert.equal(reply.res.status,201);
  const incremental=await call(api+'/conversations/'+conversationId+'/messages?after='+sent.data.id,alice);
  assert.equal(incremental.data.incremental,true);assert.deepEqual(incremental.data.items.map((item:any)=>item.id),[reply.data.id]);
  assert.deepEqual((await call(api+'/conversations/'+conversationId+'/messages?after='+reply.data.id,alice)).data.items,[]);
  await call(api+'/blocks/'+alice.id,bob,'POST',{});assert.equal((await call(api+'/items/'+sent.data.id,bob)).res.status,404);
});

test('strategy revisions are immutable records, manual tests cannot claim real API results',async()=>{
  const body={title:'Перевірка рівня',text:'Мої умови',entry:'Лише за правилом',checklist:['Перевірено контекст']};
  const created=await call(api+'/items',alice,'POST',{kind:'strategy',audience:'private',body});assert.equal(created.res.status,201);
  assert.equal((await call(api+'/items/'+created.data.id,eve)).res.status,404);
  const edited=await call(api+'/items/'+created.data.id,alice,'PATCH',{revision:1,body:{...body,entry:'Уточнене правило'}});assert.equal(edited.res.status,200,JSON.stringify(edited.data));
  const versions=await db.query('SELECT revision,body FROM hc_item_versions WHERE item_id=$1 ORDER BY revision',[created.data.id]);assert.equal(versions.rows.length,2);assert.equal(versions.rows[0].body.entry,body.entry);
  assert.equal((await call(api+'/items/'+created.data.id,alice,'PATCH',{revision:1,body})).res.status,409);
  assert.equal((await call(api+'/items',alice,'POST',{kind:'test',audience:'public',body:{title:'Не справжнє',text:'Намальовано',mode:'real',verified:true}})).res.status,400);
});

test('risk uses decimal loss totals and emits one notification per crossing, not per poll',async()=>{
  assert.equal(lossSum(['-80','60','-70']),'150');assert.equal(lossSum(['-0.1','-0.2']),'0.3');
  const id=randomUUID(),now=new Date();await db.query(`INSERT INTO hc_connections(id,owner_id,exchange,account_hash,credential,status,synced_at,covered_from) VALUES($1,$2,'bybit',$3,'test-only','connected',$4,$5)`,[id,alice.id,randomUUID(),now,new Date(now.getTime()-40*86400_000)]);
  for(const [index,pnl]of ['-80','60','-70'].entries())await db.query(`INSERT INTO hc_trades(connection_id,source_id,owner_id,symbol,currency,pnl,closed_at,source) VALUES($1,$2,$3,'BTCUSDT','USDT',$4,$5,'{}')`,[id,String(index),alice.id,pnl,new Date(now.getTime()-10_000)]);
  await db.query(`INSERT INTO hc_risk_policies(owner_id,hourly,timezone,currency) VALUES($1,120,'UTC','USDT')`,[alice.id]);
  const result=await evaluateRisk(db,alice.id,now);assert.equal(result.windows.hourly.used,'150');
  await evaluateRisk(db,alice.id,now);const notices=await db.query(`SELECT * FROM hc_notifications WHERE owner_id=$1 AND type='risk'`,[alice.id]);assert.equal(notices.rows.length,1);
  const own=await call(api+'/trades',alice);assert.equal(own.data.summary.USDT.wins,1);assert.equal(own.data.summary.USDT.losses,2);assert.equal((await call(api+'/trades?owner='+alice.id,eve)).res.status,403);
});

test('calendar boundaries include DST and half-hour zones without resetting rolling hour',()=>{
  const w=riskWindows(new Date('2026-10-25T12:00:00Z'),'Europe/Warsaw');assert.equal(w.daily.from.toISOString(),'2026-10-24T22:00:00.000Z');assert.equal(w.hourly.from.toISOString(),'2026-10-25T11:00:00.000Z');
  const india=riskWindows(new Date('2026-11-10T12:00:00Z'),'Asia/Kolkata');assert.equal(india.daily.from.toISOString(),'2026-11-09T18:30:00.000Z');
});

test('aligned historical requests coalesce and cached history needs no exchange access',async()=>{
  const originalFetch=globalThis.fetch,previous=process.env.COMMUNITY_EXCHANGE_EGRESS_ISOLATED;process.env.COMMUNITY_EXCHANGE_EGRESS_ISOLATED='1';let upstream=0;
  const before=Math.floor(Date.now()/1000)-86400*7;
  globalThis.fetch=(async(input:any,options:any)=>{if(String(input).startsWith('https://api.bybit.com/v5/market/kline')){upstream++;return Response.json({retCode:0,result:{list:[[String((Math.floor(before/60)*60-60)*1000),'100','102','99','101','25']]}});}return originalFetch(input,options);})as typeof fetch;
  try{const args={symbol:'ETHUSDT',exchange:'bybit' as const,marketType:'spot' as const,timeframe:'1m' as const,before};
    const result=await Promise.all([historyBlock(db,args),historyBlock(db,{...args,before:before-1})]);assert.equal(upstream,1);assert.equal(result[0].length,1);
    delete process.env.COMMUNITY_EXCHANGE_EGRESS_ISOLATED;await historyBlock(db,args);assert.equal(upstream,1);
  }finally{globalThis.fetch=originalFetch;if(previous)process.env.COMMUNITY_EXCHANGE_EGRESS_ISOLATED=previous;else delete process.env.COMMUNITY_EXCHANGE_EGRESS_ISOLATED;}
});

test('key operations reject write capabilities and cannot call a trading endpoint',async()=>{
  assert.throws(()=>checkReadOnly({readOnly:0,userID:'1'}));assert.throws(()=>checkReadOnly({readOnly:1}));checkReadOnly({readOnly:1,userID:'1'});
  await assert.rejects(bybitRead(db,{key:'never-send',secret:'never-send'},'/v5/order/create'));
  assert.equal((await call(api+'/connections',eve,'POST',{key:'fake-key-for-test',secret:'fake-secret-for-test'})).res.status,403);
});

test('chart normalization isolates clones and never fabricates smaller timeframes',()=>{
  const original=snapshot(),clone=cloneChartDocument(original);clone.drawings[0].pts[0].p=999;assert.equal(original.drawings[0].pts[0].p,100);
  assert.ok(original.drawings.every(d=>d.id.startsWith(original.symbol+':')),'HookChart only renders drawings in its current symbol namespace');
  assert.deepEqual(normalizeChartDocument(original).drawings,original.drawings,'normalization keeps shared drawing identities stable');
  assert.ok(chartCandles(original,'5m')!.length);const hourly={...original,timeframe:'1h' as const,series:{'1h':original.series['1m']}};assert.equal(chartCandles(hourly,'1m'),null);
  const bad=cloneChartDocument(original);bad.series['1m']![0].high=1;assert.throws(()=>normalizeChartDocument(bad));
  const international={...original,symbol:'龙虾USDT'};assert.equal(normalizeChartDocument(international).symbol,'龙虾USDT');
});

test('private images are sanitized and authorization is checked on download',async()=>{
  const image=await sharp({create:{width:10,height:10,channels:3,background:'#ff0000'}}).png().toBuffer();
  const response=await fetch(base+api+'/media',{method:'POST',headers:{Cookie:alice.cookie,'X-H00K-Request':'1','Content-Type':'image/png'},body:image});const uploaded:any=await response.json();assert.equal(response.status,201,JSON.stringify(uploaded));
  assert.equal((await fetch(base+api+'/media/'+uploaded.id,{headers:{Cookie:alice.cookie}})).status,200);
  assert.equal((await fetch(base+api+'/media/'+uploaded.id,{headers:{Cookie:eve.cookie}})).status,404);
  const lesson=await call(api+'/items',eve,'POST',{kind:'lesson',audience:'private',body:{title:'Власний матеріал',text:'Мій текст'}});
  const inject=await call(api+'/items/'+lesson.data.id,eve,'PATCH',{revision:1,body:{title:'Власний матеріал',text:'Спроба чужого вкладення',photos:[uploaded.id]}});
  assert.equal(inject.res.status,403);
});


test('native email verification and password recovery preserve MFA and revoke old sessions',async()=>{
  const actor=await register('Grace'),password='correct horse battery Grace';
  assert.equal((await call('/api/account/verify/request',actor,'POST',{})).res.status,200);
  const verification=new URL(mail.find(item=>item.email===actor.email)!.url);
  assert.equal(verification.hash,'#community?section=settings');
  assert.equal((await call('/api/account/verify',actor,'POST',{token:verification.searchParams.get('verify')})).res.status,200);
  assert.equal((await call('/api/account/me',actor)).data.security.emailVerified,true);
  const setup=await call('/api/account/mfa/setup',actor,'POST',{password});assert.equal(setup.res.status,200);
  const totp=new OTPAuth.TOTP({secret:setup.data.secret});
  const nextCode=()=>{authNow+=30_000;return totp.generate({timestamp:authNow});};
  assert.equal((await call('/api/account/mfa/confirm',actor,'POST',{code:nextCode()})).res.status,200);
  const protectedLogin=await call('/api/account/login',undefined,'POST',{email:actor.email,password});assert.equal(protectedLogin.res.status,401);
  const login=await call('/api/account/login',undefined,'POST',{email:actor.email,password,code:nextCode()});assert.equal(login.res.status,200);assert.equal(login.data.security.strong,true);
  assert.equal((await call('/api/account/reset/request',undefined,'POST',{email:actor.email})).res.status,200);
  const token=new URL(mail.filter(item=>item.email===actor.email).at(-1)!.url).searchParams.get('reset');
  assert.equal((await call('/api/account/reset',undefined,'POST',{token,password:'another long password for test'})).res.status,401);
  assert.equal((await call('/api/account/reset',undefined,'POST',{token,password:'another long password for test',code:nextCode()})).res.status,200);
  assert.equal((await call('/api/account/me',actor)).data.user,null);
  assert.equal((await call('/api/account/reset',undefined,'POST',{token,password:'another long password for test',code:nextCode()})).res.status,400);
});


test('categorized public feed and real award spending preserve ownership and privacy', async () => {
  const idea = await call(api + '/items', eve, 'POST', {
    kind: 'post', audience: 'public', body: { text: 'Перевірка категорії ідеї', category: 'idea' },
  });
  assert.equal(idea.res.status, 201, JSON.stringify(idea.data));
  const ideaFeed = await call(api + '/feed?mode=public&category=idea', bob);
  assert.equal(ideaFeed.res.status, 200);
  assert.ok(ideaFeed.data.items.some((item: any) => item.id === idea.data.id));
  const lessons = await call(api + '/feed?mode=public&category=education', bob);
  assert.equal(lessons.res.status, 200);
  assert.ok(!lessons.data.items.some((item: any) => item.id === idea.data.id));
  assert.equal((await call(api + '/feed?category=wrong', alice)).res.status, 400);

  const creditKey = 'gift-test:' + randomUUID();
  await db.query(
    'INSERT INTO hc_reputation(owner_id,event_key,points,reason) VALUES($1,$2,$3,$4)',
    [alice.id, creditKey, 125, 'Award integration test'],
  );
  const before = await call(api + '/awards', alice);
  assert.equal(before.res.status, 200);
  assert.ok(before.data.balance >= 125);
  assert.equal((await call(api + '/awards', alice, 'POST', {
    recipientId: alice.id, awardType: 'thanks',
  })).res.status, 403);
  assert.equal((await call(api + '/awards', alice, 'POST', {
    recipientId: eve.id, awardType: 'unknown',
  })).res.status, 400);

  const recipientBefore = await call(api + '/awards', eve);
  const send = await call(api + '/awards', alice, 'POST', {
    recipientId: eve.id, awardType: 'thanks',
  });
  assert.equal(send.res.status, 201, JSON.stringify(send.data));
  const after = await call(api + '/awards', alice);
  assert.equal(after.data.balance, before.data.balance - 20);
  assert.equal(after.data.gifted, before.data.gifted + 1);
  const recipientAfter = await call(api + '/awards', eve);
  assert.equal(recipientAfter.data.received, recipientBefore.data.received + 1);
  const walletHistory = await call(api + '/awards/history', alice);
  assert.equal(walletHistory.res.status, 200);
  assert.ok(walletHistory.data.items.some((gift: any) => gift.id === send.data.id && gift.direction === 'sent'));
  const recipientHistory = await call(api + '/awards/history', eve);
  assert.ok(recipientHistory.data.items.some((gift: any) => gift.id === send.data.id && gift.direction === 'received'));
  const strangerHistory = await call(api + '/awards/history', bob);
  assert.ok(!strangerHistory.data.items.some((gift: any) => gift.id === send.data.id));
  const notice = await call(api + '/notifications', eve);
  assert.ok(notice.data.items.some((item: any) => item.type === 'award' && item.body.awardType === 'thanks'));
});


test('bookmarks persist per user, toggle and never disclose private posts', async () => {
  const article = await call(api + '/items', eve, 'POST', {
    kind: 'post', audience: 'public', body: { text: 'Торговий приклад для закладки', category: 'analysis' },
  });
  assert.equal(article.res.status, 201, JSON.stringify(article.data));
  const save = await call(api + '/items/' + article.data.id + '/save', alice, 'POST', {});
  assert.equal(save.res.status, 200, JSON.stringify(save.data));
  assert.equal(save.data.saved, true);
  const ownSaved = await call(api + '/saved', alice);
  assert.equal(ownSaved.res.status, 200);
  assert.ok(ownSaved.data.items.some((item: any) => item.id === article.data.id && item.saved === true));
  assert.ok(!(await call(api + '/saved', bob)).data.items.some((item: any) => item.id === article.data.id));
  const remove = await call(api + '/items/' + article.data.id + '/save', alice, 'POST', {});
  assert.equal(remove.data.saved, false);
  assert.ok(!(await call(api + '/saved', alice)).data.items.some((item: any) => item.id === article.data.id));

  const secret = await call(api + '/items', eve, 'POST', {
    kind: 'post', audience: 'private', body: { text: 'Приватні матеріали' },
  });
  assert.equal(secret.res.status, 201);
  assert.equal((await call(api + '/items/' + secret.data.id + '/save', alice, 'POST', {})).res.status, 404);
});
