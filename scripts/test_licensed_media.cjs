const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+(req.url==='/'?'/index.html':req.url.split('?')[0]));
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.mp3')?'audio/mpeg':file.endsWith('.mp4')?'video/mp4':file.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');res.end(data)});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://unpkg.com/**',r=>r.abort());await page.route('https://cdnjs.cloudflare.com/**',r=>r.abort());
  await page.goto('http://127.0.0.1:'+server.address().port);
  assert.equal(await page.evaluate(()=>'speakQuestion' in QuizAudio),false);
  await page.evaluate(()=>{document.getElementById('setup').style.display='none';document.getElementById('game').style.display='block';QuizAudio.setEffectsEnabled(false);phase='game'});
  await page.locator('#musicEnabled').uncheck();await page.locator('#musicEnabled').check();
  await page.waitForFunction(()=>QuizAudio.getSettings().musicTrack==='Carefree — Kevin MacLeod');
  await page.locator('#musicVolume').focus();
  await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Unidentified',keyCode:39,bubbles:true,cancelable:true})));
  assert.equal(await page.evaluate(()=>QuizAudio.getSettings().musicVolume),0.14);
  await page.locator('#musicVolume').fill('23');await page.locator('#musicVolume').dispatchEvent('input');
  assert.equal(await page.evaluate(()=>QuizAudio.getSettings().musicVolume),0.23);
  await page.locator('#musicEnabled').uncheck();assert.equal(await page.evaluate(()=>QuizAudio.getSettings().music),false);
  const ids=await page.evaluate(()=>[...QUIZ_LICENSED_AUDIO,...QUIZ_LICENSED_VIDEO].map(q=>q.id));
  for(const id of ids){
   await page.evaluate(id=>{
    const raw=[...QUIZ_LICENSED_AUDIO,...QUIZ_LICENSED_VIDEO].find(q=>q.id===id);
    deck=[QuizGameModel.normalizeQuestion({...raw,type:'choice',roundIndex:0,roundQuestionNumber:1,roundQuestionCount:1,media:{...raw.media,timerAfterPlayback:true}})];
    round=0;lastPresentedRound=0;roundBreakActive=false;config={time:40};ask();
    const publicQ=QuizGameModel.toPlayerQuestion(deck[0]);if(publicQ.correct!==undefined||publicQ.source||publicQ.media.src)throw Error('Answer or source leak');
   },id);
   assert.equal(await page.evaluate(()=>answerWindowOpen),false);
   await page.locator('#clipVolume').fill('42');await page.locator('#clipVolume').dispatchEvent('input');
   await page.locator('#hostMedia audio,#hostMedia video').evaluate(m=>{if(m.volume!==0.42)throw Error('Clip volume');m.playbackRate=4});
   await page.waitForFunction(()=>answerWindowOpen,{}, {timeout:20000});
   assert.equal(await page.locator('#hostMedia audio,#hostMedia video').evaluate(m=>m.error),null);
   assert(await page.locator('#hostMedia audio,#hostMedia video').evaluate(m=>m.currentTime>0&&m.duration>8));
   await page.evaluate(()=>{reveal();clearTimeout(revealTimeout);clearInterval(timer)});
   assert.equal(await page.locator('#explanation a').getAttribute('href'),'media-credits.html');
   await page.evaluate(()=>{const m=document.querySelector('#hostMedia audio, #hostMedia video');m.dispatchEvent(new Event('ended'));if(answerWindowOpen)throw Error('Late media event reopened answer window')});
   console.log('PASS decoded clip, timer gate, volume, source and late-event guard:',id);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: recorded background, mute/volume, no voice, all four licensed clips.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
