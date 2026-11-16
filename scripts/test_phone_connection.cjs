// Deterministic failure/retry tests. The real network smoke is test_qr_connection.cjs.
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const stub = `
window.testPeers=[];window.testTimeouts=[];
const realTimeout=window.setTimeout;
window.setTimeout=(fn,ms,...args)=>{const id=realTimeout(fn,ms,...args);if(ms>=8000&&ms<=45000)testTimeouts.push({id,fn});return id};
class Events{constructor(){this.events={}}on(k,fn){(this.events[k]??=[]).push(fn)}emit(k,...args){for(const fn of this.events[k]||[])fn(...args)}}
window.Peer=class extends Events{
 constructor(){super();this.id='phone-'+testPeers.length;this.destroyed=false;testPeers.push(this)}
 connect(){const c=new Events();c.peer='host';c.open=false;c.sent=[];c.send=data=>c.sent.push(data);c.close=()=>{c.open=false;c.closed=true;c.emit('close')};this.connection=c;return c}
 destroy(){this.destroyed=true;this.connection?.close()}
};`;
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('https://unpkg.com/**',route=>route.fulfill({contentType:'text/javascript',body:stub}));
  await page.goto(pathToFileURL(path.resolve(__dirname,'../join.html')).href+'?host=host');
  await page.locator('#playerName').fill('Игрок');
  await page.locator('#connectBtn').click();
  await page.evaluate(()=>testPeers[0].emit('error',{type:'network'}));
  assert.equal(await page.evaluate(()=>testPeers[0].destroyed),true,'a failed attempt must release its peer');
  await page.locator('#connectBtn').click();
  await page.evaluate(()=>{testPeers[0].emit('open');testPeers[0].emit('error',{type:'peer-unavailable'});testPeers[0].connection?.emit('data',{type:'state',players:[]})});
  assert.equal(await page.locator('#connectBtn').isDisabled(),true,'old callbacks must not reset the new attempt');
  await page.evaluate(()=>{testPeers[1].emit('open');const c=testPeers[1].connection;c.open=true;c.emit('open')});
  assert.equal(await page.locator('#profile').isVisible(),true,'wait for the host to acknowledge joining');
  await page.evaluate(()=>testPeers[1].connection.emit('data',{type:'state',players:[{id:'someone-else'}]}));
  assert.equal(await page.locator('#profile').isVisible(),true,'a state without our player is not an acknowledgement');
  await page.evaluate(()=>testPeers[1].connection.emit('data',{type:'state',players:[{id:testPeers[1].id,name:'Игрок',avatar:'🎮',ready:false}]}));
  assert.equal(await page.locator('#lobby').isVisible(),true);
  await page.evaluate(()=>testPeers[1].connection.emit('close'));
  assert.equal(await page.locator('#profile').isVisible(),true,'lost connection must show the retry button');
  assert.equal(await page.locator('#connectBtn').isEnabled(),true);
  assert.equal(await page.locator('#playerName').inputValue(),'Игрок');
  await page.locator('#connectBtn').click();
  await page.evaluate(()=>testTimeouts[testTimeouts.length-1].fn());
  assert.match(await page.locator('#message').innerText(),/служб|сети|интернет/i);
  assert.equal(await page.evaluate(()=>testPeers[2].destroyed),true);
  await page.locator('#connectBtn').click();
  await page.evaluate(()=>{testPeers[3].emit('open');testTimeouts[testTimeouts.length-1].fn()});
  assert.match(await page.locator('#message').innerText(),/прямое соединение/i);
  await page.locator('#connectBtn').click();
  await page.evaluate(()=>{testPeers[4].emit('open');const c=testPeers[4].connection;c.open=true;c.emit('open');testTimeouts[testTimeouts.length-1].fn()});
  assert.match(await page.locator('#message').innerText(),/не подтвердил/i);
  assert.equal(await page.locator('#connectBtn').isEnabled(),true);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  console.log('PASS: failed-peer cleanup, stale callbacks, host acknowledgement, visible retry, preserved name and distinct stage timeouts.');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
