const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const relay=await (await import('./relay-test-server.mjs')).startRelay();
 const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(e,data)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream');if(file.endsWith('relay-transport.js'))data=data.toString().replace('https://tv-quiz-rooms.cleverpineapple8.chatgpt.site',relay.url);res.end(data);});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext();
  await context.addInitScript(()=>{window.RTCPeerConnection=undefined;window.webkitRTCPeerConnection=undefined;});
  await context.route('https://unpkg.com/**',r=>r.abort());
  await context.route('https://cdnjs.cloudflare.com/**',r=>r.fulfill({contentType:'text/javascript',body:'window.QRCode=class {static CorrectLevel={M:0};constructor(el,options){el.dataset.url=options.text}}'}));
  const host=await context.newPage();await host.setViewportSize({width:1920,height:1080});await host.goto(base);
  await host.keyboard.press('Enter');await host.waitForFunction(()=>peer?.id?.startsWith('r1-')&&!document.getElementById('joinLink').hidden);
  const id=await host.evaluate(()=>peer.id),phones=[];
  for(let i=0;i<2;i++){
   const phone=await context.newPage();phones.push(phone);await phone.setViewportSize({width:390,height:844});await phone.goto(base+'/join.html?host='+id);
   await phone.locator('#playerName').fill('HTTPS '+i);await phone.locator('#connectBtn').click();await phone.locator('#readyBtn').waitFor({state:'visible'});await phone.locator('#readyBtn').click();
  }
  await host.waitForFunction(()=>!document.getElementById('startGame').disabled);
  await host.keyboard.press('ArrowDown');await host.keyboard.press('ArrowDown');await host.keyboard.press('Enter');
  await host.waitForFunction(()=>answerWindowOpen||!document.getElementById('continueQuestionBtn').hidden,{},{timeout:20000});
  if(await host.locator('#continueQuestionBtn').isVisible())await host.keyboard.press('Enter');
  await phones[0].waitForFunction(()=>document.querySelector('.choice')&&!document.querySelector('.choice').disabled);
  const correct=await host.evaluate(()=>deck[round].correct);
  await phones[0].locator('.choice').nth((correct+1)%4).click();await phones[1].locator('.choice').nth(correct).click();
  await host.waitForFunction(()=>document.getElementById('answers').dataset.revealed==='1');
  await phones[1].waitForFunction(()=>document.getElementById('phoneTimer').textContent==='Раунд завершён');
  assert.deepEqual(await host.evaluate(()=>roster().map(p=>p.score)),[0,1]);
  assert.match(await phones[1].locator('#answerMessage').innerText(),/Правильно/);
  await host.evaluate(()=>finish());await phones[1].getByRole('heading',{name:'🏆 Игра завершена'}).waitFor();
  await host.evaluate(()=>peer.destroy());
  await phones[0].locator('#profile').waitFor({state:'visible'});
  assert.equal((await relay.DB.prepare('SELECT COUNT(*) AS n FROM rooms').first()).n,0);
  console.log('PASS: WebRTC and PeerJS disabled; real HTTP room, two clients, readiness, remote start, answers, 0/1 scores, close and cleanup.');
 }finally{await browser.close();await new Promise(r=>server.close(r));await relay.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
