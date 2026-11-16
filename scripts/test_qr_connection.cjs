// Real network smoke: requires Playwright, pngjs and jsqr (or TV_QR_DECODER path).
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const decode=require(process.env.TV_QR_DECODER||'jsqr');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(path.resolve(root)+path.sep)){res.writeHead(403).end();return}fs.readFile(file,(e,data)=>{if(e){res.writeHead(404).end();return}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(data)})});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const local='http://127.0.0.1:'+server.address().port+'/';
  const host=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
  host.on('pageerror',e=>console.log('HOST ERROR',e.message));
  await host.goto(require('node:url').pathToFileURL(path.join(root,'index.html')).href);await host.keyboard.press('Enter');
  await host.waitForFunction(()=>peer&&peer.id&&!document.getElementById('joinLink').hidden,{},{timeout:20000});
  const id=await host.evaluate(()=>peer.id);
  const qr=PNG.sync.read(await host.locator('#qr').screenshot());
  const scanned=decode(new Uint8ClampedArray(qr.data),qr.width,qr.height);
  assert.ok(scanned,'QR must decode from the actual rendered image');
  const scannedUrl=new URL(scanned.data);
  assert.equal(scannedUrl.origin,'https://filigor123.github.io');
  assert.equal(scannedUrl.pathname,'/TV-Quiz/join.html');
  assert.equal(scannedUrl.searchParams.get('host'),id);
  console.log('PASS: QR image decoded from file-launched host; valid published phone URL and exact room ID.');
  const phones=[];
  for(let i=0;i<2;i++){
   const phone=await browser.newPage({viewport:{width:390,height:844}});phones.push(phone);
   // First phone really visits the URL decoded from the QR, without routes/mocks.
   // Second uses this branch's phone client to verify its corrected player identity.
   await phone.goto(i===0?scanned.data:local+'join.html?host='+encodeURIComponent(id));
   await phone.locator('#playerName').fill('Проверка '+(i+1));
   await phone.locator('#connectBtn').click();await phone.locator('#readyBtn').waitFor({state:'visible',timeout:20000});await phone.locator('#readyBtn').click();
   assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  assert.equal(await phones[1].evaluate(()=>localPlayerId===peer.id),true,'local player uses its own ID, not the host ID');
  await host.waitForFunction(()=>!document.getElementById('startGame').disabled);
  await host.keyboard.press('ArrowDown');await host.keyboard.press('ArrowDown');await host.keyboard.press('Enter');
  await host.waitForFunction(()=>answerWindowOpen||!document.getElementById('continueQuestionBtn').hidden,{},{timeout:20000});
  if(await host.locator('#continueQuestionBtn').isVisible()){console.log('No headless voice: remote continuation');await host.keyboard.press('Enter')}
  await phones[0].waitForFunction(()=>!document.querySelector('.choice').disabled);
  const correct=await host.evaluate(()=>deck[round].correct);
  await phones[0].locator('.choice').nth((correct+1)%4).click();await phones[1].locator('.choice').nth(correct).click();
  await host.waitForFunction(()=>document.getElementById('answers').dataset.revealed==='1',{},{timeout:7000});
  await phones[1].waitForFunction(()=>document.getElementById('phoneTimer').textContent==='Раунд завершён');
  assert.deepEqual(await host.evaluate(()=>roster().map(p=>p.score)),[0,1]);
  assert.match(await phones[1].locator('#answerMessage').innerText(),/Правильно!/);
  console.log('PASS real PeerJS: scanned public URL opens phone, two clients join/ready, direct catalog→QR, keyboard-only launch, dynamic first timer, answers/reveal and 0/1 scores.');
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
