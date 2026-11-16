// Run with Playwright available in NODE_PATH; uses an installed Edge by default.
// PeerJS is stubbed here: this verifies UI/protocol integration, not real networking.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const peerStub = `
window.testPeers=[];
window.Peer=class {
 constructor(){this.handlers={};this.destroyed=false;testPeers.push(this);setTimeout(()=>this.handlers.open?.('test-room'),10)}
 on(name,fn){this.handlers[name]=fn}
 destroy(){this.destroyed=true}
};
window.testJoin=(id)=>{
 const conn={peer:id,open:true,handlers:{},sent:[],on(name,fn){this.handlers[name]=fn},send(data){this.sent.push(data)},close(){this.open=false;this.handlers.close?.()}};
 testPeers[testPeers.length-1].handlers.connection(conn);
 conn.handlers.data({type:'join',name:id,avatar:'🎮'});
 conn.handlers.data({type:'ready',ready:true});
 return conn;
};`;
const audioStub = `
window.audioCalls=[];
window.QuizAudio={...window.QuizAudio};
for(const name of ['startMusic','playStart','playTick','playReveal','playResults','speakQuestion']){
 QuizAudio[name]=(...args)=>{audioCalls.push([name,...args]);return Promise.resolve(true)};
}
QuizAudio.isSpeechSupported=()=>true;`;

async function main() {
 const server = http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
  fs.readFile(file,(error,data)=>{
   if(error){res.writeHead(404);res.end();return}
   res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream');
   res.end(data);
  });
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:process.env.TV_TEST_BROWSER||'msedge',headless:true});
 try {
  const context=await browser.newContext({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
  await context.route('https://unpkg.com/**',route=>route.fulfill({contentType:'text/javascript',body:peerStub}));
  await context.route('https://cdnjs.cloudflare.com/**',route=>route.fulfill({contentType:'text/javascript',body:'window.QRCode=class {static CorrectLevel={M:0};constructor(el,options){el.dataset.url=options.text}}'}));
  await context.route('**/audio.js',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'audio.js'),'utf8')+audioStub}));
  const page=await context.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const url=`http://127.0.0.1:${server.address().port}/`;
  await page.goto(url);
  const focused=()=>page.locator(':focus');
  const key=async name=>{await page.keyboard.press(name);await page.waitForTimeout(35)};
  const legacy=async code=>{await page.evaluate(code=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Unidentified',keyCode:code,bubbles:true,cancelable:true})),code);await page.waitForTimeout(35)};
  assert.equal(await page.locator('.catalog-card').count(),105);
  assert.equal(await page.locator('.audio-controls').count(),0);
  assert.equal(await page.locator('#customRoundOpen').count(),0);
  assert.match(await focused().getAttribute('data-card-id'),/Музыка.*easy/);
  assert.deepEqual(await page.evaluate(()=>audioCalls),[],'catalog is silent');
  // Three complete rows and no page-wide horizontal overflow at both TV sizes.
  const out=process.env.TV_TEST_ARTIFACTS||path.join(require('node:os').tmpdir(),'tv-quiz-test-artifacts');fs.mkdirSync(out,{recursive:true});
  for(const [width,height] of [[1920,1080],[3840,2160]]){
   await page.setViewportSize({width,height});
   await page.waitForTimeout(60);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const third=await page.locator('.shelf').nth(2).boundingBox();
   assert.ok(third.y+third.height<=height,`third shelf fits ${width}: ${third.y+third.height}`);
   await page.screenshot({path:path.join(out,`tv-catalog-${width}.png`)});
  }
  await page.setViewportSize({width:1920,height:1080});
  assert.equal(await page.locator('#gameSettings,#questionCount,#timeLimit,#timerMode').count(),0,'no setup controls');
  assert.equal(await page.locator('.hero,.level-legend,.remote-hint').count(),0,'approved clean header');
  await legacy(39);assert.match(await focused().getAttribute('data-card-id'),/Queen-medium$/);
  await legacy(39);assert.match(await focused().getAttribute('data-card-id'),/Мировые хиты-hard$/);
  await legacy(39);await legacy(39);await legacy(39);
  assert.match(await focused().getAttribute('data-card-id'),/Queen-easy$/,'skip unavailable expert/extreme');
  await legacy(40);assert.match(await focused().getAttribute('data-card-id'),/^Кино/);
  const selected=await focused().getAttribute('data-card-id');
  await legacy(13);assert.equal(await focused().getAttribute('id'),'backLobby','card opens QR directly');
  assert.equal(await page.locator('#startGame').isDisabled(),true);
  await key('ArrowDown');assert.equal(await focused().getAttribute('id'),'joinLink');
  await key('ArrowDown');assert.equal(await focused().getAttribute('id'),'joinLink','skip disabled start');
  assert.equal(await page.locator('#qr').getAttribute('data-url'),'https://filigor123.github.io/TV-Quiz/join.html?host=test-room');
  assert.equal(await page.locator('#joinLink').getAttribute('href'),await page.locator('#qr').getAttribute('data-url'));
  assert.deepEqual(await page.evaluate(()=>audioCalls),[],'lobby is silent');
  await legacy(461);assert.equal(await focused().getAttribute('data-card-id'),selected,'LG Back restores card');
  assert.equal(await page.evaluate(()=>testPeers[0].destroyed),true,'Back destroys old room');
  await key('Enter');await page.goBack();await page.waitForTimeout(60);
  assert.equal(await focused().getAttribute('data-card-id'),selected,'browser Back restores card');
  await key('Enter');
  await page.evaluate(()=>{window.p1=testJoin('Первый');window.p2=testJoin('Второй')});
  await key('ArrowDown');await key('ArrowDown');assert.equal(await focused().getAttribute('id'),'startGame');await key('Enter');
  await page.waitForFunction(()=>document.getElementById('game').style.display==='block');
  await page.waitForFunction(()=>p1.sent.some(message=>message.type==='answer-open'));
  assert.ok(await page.evaluate(()=>audioCalls.some(call=>call[0]==='startMusic')),'music starts with game');
  assert.ok(await page.evaluate(()=>audioCalls.some(call=>call[0]==='speakQuestion')),'voice starts with game');
  assert.equal(await page.evaluate(()=>p1.sent.filter(m=>m.type==='question').some(m=>'correct' in m.question)),false);
  await page.evaluate(()=>{p1.handlers.data({type:'answer',answer:0});p2.handlers.data({type:'answer',answer:1})});
  await page.waitForFunction(()=>p1.sent.some(message=>message.type==='reveal'),{},{timeout:6000});
  assert.equal(await page.evaluate(()=>p1.sent.filter(message=>message.type==='reveal').length),1);
  // Numeric quiz is a prepared catalog item, not the question editor.
  await page.goto(url);await page.waitForTimeout(60);
  await page.locator('.catalog-card[data-card-id="Эрудиция-Кто ближе?-easy"]').click();
  assert.deepEqual(await page.evaluate(()=>deck.map(q=>q.type)),Array(10).fill('closest'));
  await page.evaluate(()=>{window.p1=testJoin('Первый');window.p2=testJoin('Второй')});
  await key('ArrowDown');await key('ArrowDown');await key('Enter');
  await page.waitForFunction(()=>answerWindowOpen);
  await page.evaluate(()=>{
   p1.handlers.data({type:'answer',value:'1430',unit:''});
   p2.handlers.data({type:'answer',value:'1450',unit:''});
  });
  assert.equal(await page.evaluate(()=>p1.sent.some(message=>message.type==='reveal')),false,'closest stays hidden until timeout');
  await page.evaluate(()=>reveal());
  assert.deepEqual(await page.evaluate(()=>roster().map(p=>p.score)),[1,1],'equidistant answers both earn one');
  // Every playable card opens a room directly and uses a descending automatic timer.
  await page.goto(url);await page.waitForTimeout(60);
  const cardIds=await page.locator('.catalog-card:not(:disabled)').evaluateAll(cards=>cards.map(card=>card.dataset.cardId));
  for(const id of cardIds){
   await page.locator('[data-card-id='+JSON.stringify(id)+']').click();
   const result=await page.evaluate(()=>({mode:config.timerMode,count:deck.length,types:deck.map(q=>q.type),times:deck.map(q=>questionTime(q)),rounds:deck.map(q=>q.roundIndex),numbers:deck.map(q=>q.roundQuestionNumber)}));
   assert.equal(result.mode,'staged',id);assert.ok(result.count>0,id);
   for(let n=0;n<result.times.length;n++){
    if(result.numbers[n]===1)assert.equal(result.times[n],result.types[n]==='free-text'?50:40,id+' starts with ample time');
    if(n&&result.rounds[n]===result.rounds[n-1])assert.ok(result.times[n]<=result.times[n-1],id+' descending timer');
   }
   await legacy(461);
  }
  console.log('Verified direct room launch and automatic timers for '+cardIds.length+' playable cards.');
  // Missing voice APIs and blocked storage cannot remove the catalog/focus.
  const fallback=await context.newPage();
  await fallback.addInitScript(()=>{
   Object.defineProperty(window,'speechSynthesis',{value:undefined});
   Storage.prototype.getItem=()=>{throw new Error('Storage blocked')};
   Storage.prototype.setItem=()=>{throw new Error('Storage blocked')};
  });
  await fallback.goto(url);await fallback.waitForTimeout(60);
  assert.equal(await fallback.locator('.catalog-card').count(),105);
  assert.match(await fallback.locator(':focus').getAttribute('data-card-id'),/^Музыка/);
  await fallback.setViewportSize({width:390,height:844});
  assert.ok(await fallback.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'narrow host has no horizontal overflow');
  await fallback.screenshot({path:path.join(out,'tv-catalog-mobile.png')});
  assert.deepEqual(errors,[]);
  console.log('PASS: catalog 1080p/4K/mobile, initial focus, arrows and LG key codes, Back/history, room cleanup, two simulated players, launch/audio, reveal, prepared closest quiz, unavailable voice/storage.');
 } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1});
