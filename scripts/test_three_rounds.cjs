const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const artifacts=process.env.TV_TEST_ARTIFACTS||path.join(process.env.TEMP,'tvquiz-rounds');
fs.mkdirSync(artifacts,{recursive:true});
(async()=>{
 const relay=await (await import('./relay-test-server.mjs')).startRelay();
 const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(e,data)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.mp3')?'audio/mpeg':file.endsWith('.mp4')?'video/mp4':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.jpg')?'image/jpeg':file.endsWith('.png')?'image/png':'application/octet-stream');if(file.endsWith('relay-transport.js'))data=data.toString().replace('https://tv-quiz-rooms.cleverpineapple8.chatgpt.site',relay.url);res.end(data);});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext();
  context.setDefaultTimeout(15000);
  await context.route('https://unpkg.com/**',r=>r.abort());
  await context.route('https://cdnjs.cloudflare.com/**',r=>r.fulfill({contentType:'text/javascript',body:'window.QRCode=class {static CorrectLevel={M:0};constructor(el,options){el.dataset.url=options.text}}'}));
  const host=await context.newPage(),errors=[];host.on('pageerror',e=>errors.push(e.message));
  await host.setViewportSize({width:1920,height:1080});await host.goto(base);
  await host.evaluate(()=>{QuizAudio.setMusicEnabled(false);QuizAudio.setEffectsEnabled(false)});
  await host.clock.install();
  // Verify every actual card uses three nonempty rounds, with exact advertised counts.
  const coverage=await host.evaluate(()=>shelves.flatMap(shelf=>catalogEntries(shelf).map(({q,level})=>{
   const rounds=quizPlan(q,level.legacy),sizes=QuizRoundPlans.counts(rounds);
   const playable=sizes.length===3&&sizes.every(n=>n>0);
   if(playable){
    selectedQuiz=q;selectedDifficulty=(q.multiQuiz||q.multiRound)?'multi':level.legacy;
    if(!makeDeck()||deck.length!==sizes.reduce((a,b)=>a+b,0))throw Error(q.id+' deck mismatch');
    if(deck.some(item=>item.allowWager&&(item.roundIndex!==1||item.type==='closest')))throw Error(q.id+' invalid wager');
    const keys=deck.map(item=>item.id||item.text);
    if(new Set(keys).size!==keys.length)throw Error(q.id+' duplicated question');
    for(const index of [0,1,2]){
     const group=deck.filter(item=>item.roundIndex===index);
     if(group.length!==sizes[index]||group[0].roundQuestionNumber!==1)throw Error(q.id+' round mismatch');
     if(questionTime(group[0])!==(group[0].type==='free-text'?50:40))throw Error(q.id+' timer not reset');
    }
   }
   return {id:q.id,title:q.title,level:level.label,sizes,types:rounds.map(r=>r.type),playable};
  })));
  fs.writeFileSync(path.join(artifacts,'coverage.json'),JSON.stringify(coverage,null,2));
  assert(coverage.filter(c=>c.playable).every(c=>c.sizes.length===3));
  await host.screenshot({path:path.join(artifacts,'catalog.png')});
  const games=process.env.TV_TEST_COVERAGE_ONLY==='1'?[]:process.env.TV_TEST_QUIZZES?process.env.TV_TEST_QUIZZES.split(','):['slang-chat','rock-legends','auto-cars','geo-globe','audio-recognition','closest-numbers'];
  for(const id of games){
   console.log('START',id);
   if(await host.evaluate(()=>phase!=='setup'))await host.reload();
   await host.evaluate(()=>{QuizAudio.setMusicEnabled(false);QuizAudio.setEffectsEnabled(false)});
   const qi=await host.evaluate(id=>quizzes.findIndex(q=>q.id===id),id);
   await host.locator(`[data-qi="${qi}"]:not(:disabled)`).first().click();
   await host.waitForFunction(()=>peer?.id?.startsWith('r1-')&&!document.getElementById('joinLink').hidden);
   const room=await host.evaluate(()=>peer.id),phones=[];
   for(let i=0;i<2;i++){
    const phone=await context.newPage();phones.push(phone);phone.on('pageerror',e=>errors.push(e.message));await phone.setViewportSize({width:390,height:844});await phone.goto(base+'/join.html?host='+room);
    await phone.locator('#playerName').fill('Игрок '+i);await phone.locator('#connectBtn').click();await phone.locator('#readyBtn').waitFor({state:'visible'});await phone.locator('#readyBtn').click();
   }
   await host.waitForFunction(()=>!document.getElementById('startGame').disabled);await host.locator('#startGame').click();
   if(process.env.TV_TEST_MEDIA_FAILURE==='1'){
    await host.route('**/sound-001.mp3',route=>route.abort());
    await host.locator('#beginRound').click();
    await host.waitForFunction(()=>document.getElementById('answers').dataset.revealed==='1');
    await phones[0].waitForFunction(()=>document.getElementById('answerMessage').textContent.includes('пропущен'));
    assert.deepEqual(await host.evaluate(()=>roster().map(p=>[p.score,p.wagerUsed])),[[0,false],[0,false]]);
    assert.equal(await host.evaluate(()=>answerWindowOpen),false);
    await host.clock.fastForward(5501);await host.waitForFunction(()=>round===1);
    await host.locator('#hostMedia audio').evaluate(media=>{media.playbackRate=16});
    await host.waitForFunction(()=>answerWindowOpen,{},{timeout:20000}).catch(async error=>{console.log(await host.evaluate(()=>({question:deck[round]?.id,failed:deck[round]?.mediaLoadFailed,phase,status:document.getElementById('mediaStatus').textContent,media:[...document.querySelectorAll('#hostMedia img,#hostMedia audio,#hostMedia video')].map(m=>({tag:m.tagName,complete:m.complete,width:m.naturalWidth,ready:m.readyState,paused:m.paused,time:m.currentTime,error:m.error?.code}))})));throw error});
    console.log('PASS: failed clip skipped without score/wager, next real clip opens answers.');
    await host.evaluate(()=>{clearInterval(timer);clearTimeout(revealTimeout);peer.destroy()});for(const phone of phones)await phone.close();
    continue;
   }
   let expected=[0,0],boundaries=[],count=await host.evaluate(()=>deck.length);
   for(let i=0;i<count;i++){
    console.log('QUESTION',id,i+1,'/',count);
    const q=await host.evaluate(i=>deck[i],i);
    if(q.roundQuestionNumber===1){
     await host.locator('#roundBreak').waitFor({state:'visible'});boundaries.push(q.roundIndex);
     await phones[0].locator('#roundWait').waitFor({state:'visible'});
     assert.deepEqual(await host.evaluate(()=>roster().map(p=>p.score)),expected);
     assert.equal(await host.evaluate(()=>answerWindowOpen),false);
     await phones[0].evaluate(()=>send({type:'answer',answer:0,wager:true}));
     assert.deepEqual(await host.evaluate(()=>roster().map(p=>p.score)),expected);
     if(q.roundIndex===1){await host.screenshot({path:path.join(artifacts,id+'-scores.png')});await phones[0].screenshot({path:path.join(artifacts,id+'-phone.png')});}
     await host.locator('#beginRound').focus();await host.keyboard.press('Enter');
    }
    await host.waitForFunction(i=>round===i&&!roundBreakActive,i);
    if(q.media?.timerAfterPlayback){
     assert.equal(await host.evaluate(()=>answerWindowOpen),false);
     await host.locator('#hostMedia audio,#hostMedia video').evaluate(media=>{media.playbackRate=16});
    }
    await host.waitForFunction(()=>answerWindowOpen,{},{timeout:20000});
    for(const phone of phones)await phone.waitForFunction(text=>currentQuestion?.text===text&&currentQuestion.answerOpen===true,q.text);
    const wager=q.allowWager&&q.roundQuestionNumber===1;
    for(let p=0;p<2;p++){
     const phone=phones[p];
     assert.equal(await phone.locator('#wagerOption').isVisible(),!!q.allowWager&&(q.roundQuestionNumber===1));
     if(wager)await phone.locator('#wagerCheckbox').check();
     if(q.type==='free-text'){await phone.locator('#freeAnswer').fill(p===0?q.correctAnswer:'совсем неверно');await phone.locator('#sendFreeAnswer').click();}
     else if(q.type==='closest'){
      await phone.locator('#closestValue').fill(q.correctValue);
      await phone.locator('#submitClosest').click({timeout:5000}).catch(async error=>{
       console.error('Numeric submit:',q.id,await host.evaluate(()=>({round,seconds,answerWindowOpen})),
        await phone.evaluate(()=>({id:currentQuestion?.id,open:currentQuestion?.answerOpen,answered,disabled:document.getElementById('submitClosest').disabled,timer:document.getElementById('phoneTimer').textContent})));
       throw error;
      });
     }
     else await phone.locator('.choice').nth(p===0?q.correct:(q.correct+1)%q.answers.length).click();
     await host.waitForFunction(p=>roster()[p].answer!==null,p);
     // Before closing, nobody's choice or wager appears on the TV or in public roster.
     assert.equal(await host.locator('.vote-chip').count(),0);
     assert.equal(await host.locator('.picked').filter({hasText:'Ответ: '}).count(),0);
     assert.equal(await host.evaluate(()=>publicRoster().some(p=>'answer'in p||'currentWager'in p)),false);
     await phone.evaluate(()=>send({type:'answer',answer:0,wager:true}));
    }
    if(q.type==='closest'){const ticks=await host.evaluate(()=>seconds);for(let t=0;t<ticks;t++)await host.clock.fastForward(1000);expected=expected.map(x=>x+1);}
    else{await host.clock.fastForward(2501);expected[0]+=wager?2:1;expected[1]+=wager?-1:0;}
    await host.waitForFunction(()=>document.getElementById('answers').dataset.revealed==='1');
    assert.deepEqual(await host.evaluate(()=>roster().map(p=>p.score)),expected);
    await host.evaluate(()=>reveal());assert.deepEqual(await host.evaluate(()=>roster().map(p=>p.score)),expected);
    assert.equal(await host.evaluate(()=>answerWindowOpen),false);
    await phones[0].waitForFunction(()=>document.getElementById('phoneTimer').textContent==='Раунд завершён');
    if(q.media?.revealEndSeconds)await host.waitForFunction(()=>!document.querySelector('#hostMedia audio,#hostMedia video')||document.querySelector('#hostMedia audio,#hostMedia video').paused,{},{timeout:20000});
    await host.clock.fastForward(5501);
   }
   await host.locator('#results').waitFor({state:'visible'});await phones[0].locator('#phoneResults').waitFor({state:'visible'});
   assert.deepEqual(boundaries,[0,1,2]);assert.deepEqual(await host.evaluate(()=>roster().map(p=>p.score)),expected);
   if(id==='slang-chat'){
    await host.locator('#playAgain').click();for(const phone of phones){await phone.locator('#readyBtn').waitFor({state:'visible'});await phone.locator('#readyBtn').click();}
    await host.waitForFunction(()=>!document.getElementById('startGame').disabled);await host.locator('#startGame').click();await host.locator('#beginRound').click();
    assert.deepEqual(await host.evaluate(()=>roster().map(p=>[p.score,p.wagerUsed])),[[0,false],[0,false]]);
    await phones[0].locator('.choice').first().waitFor({state:'visible'});
   }
   console.log('PASS',id,count,'questions; boundaries',boundaries,'scores',expected);
   await host.evaluate(()=>{clearInterval(timer);clearTimeout(revealTimeout);peer.destroy()});for(const phone of phones)await phone.close();
  }
  assert.deepEqual(errors,[]);console.log('PASS: selected scenarios; all playable card decks/counts/timers. Artifacts:',artifacts);
 }finally{await browser.close();await new Promise(r=>server.close(r));await relay.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
