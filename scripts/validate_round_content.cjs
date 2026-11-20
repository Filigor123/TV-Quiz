const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={window:{}};
for(const f of ['questions.js','slang-quiz.js','scrambled-words.js','audio-quiz.js','facts-quiz.js','closest-quiz.js','media-preview-quiz.js','question-review.js','finale-extras.js','bank-supplements.js','licensed-media.js','game-model.js','round-plans.js'])vm.runInNewContext(fs.readFileSync(f,'utf8'),context);
const w=context.window,excluded=JSON.parse(fs.readFileSync('content/question-exclusions.json'));
assert.deepEqual([...w.QUIZ_EXCLUDED_TEXTS],excluded.map(r=>r.text));
for(const r of excluded)assert.equal(w.QUIZ_QUESTIONS.filter(q=>q.text===r.text).length,1);
const finals=[...new Map(Object.values(w.QuizRoundPlans.finales).flatMap(r=>r.questions.map(q=>[q.id,{...q,type:r.type}]))).values()];
for(const q of finals){
 assert(q.text&&q.explanation,q.id);
 if(q.type==='closest')assert(Number.isFinite(Number(q.correctValue)),q.id);
 else {assert.equal(q.answers.length,q.type==='true-false'?2:4,q.id);assert.equal(new Set(q.answers).size,q.answers.length,q.id);assert(q.correct>=0&&q.correct<q.answers.length,q.id);assert(q.source,q.id);}
}
for(const [pattern,answer] of [['образовалась группа Oasis','Манчестер'],['контрабандист Хан Соло','Звёздные войны'],['археолога Индиану Джонса','Харрисон Форд']]){
 const q=w.QUIZ_QUESTIONS.find(q=>q.text.includes(pattern));assert.equal(q.answers[q.correct],answer);
}
assert.equal(w.QUIZ_AUDIO.rounds[2].shortClip,true);
assert(w.QUIZ_MEDIA_PREVIEW.rounds.every(r=>!r.shortClip),'third round does not automatically trim media');
assert.deepEqual(Array.from(w.QuizRoundPlans.counts([{questions:Array(12)},{questions:Array(5)},{questions:Array(7)}])),[10,5,7]);
console.log(`PASS: ${finals.length} unique finale questions, explicit exclusions, fixed keys, independent counts and clip rules.`);
for(const [key,finale] of Object.entries(w.QuizRoundPlans.finales)){
 const rounds=[{questions:[]},{questions:[]},{...finale,questionLimit:10}];
 const picks=[0,1].map(()=>w.QuizRoundPlans.select(rounds,key,()=>0.5)[2]);
 const [first,second]=picks.map(list=>list.map(q=>q.id).sort());
 assert.notDeepEqual(first,second,key+' replay must change the question set');
 assert.equal(new Set(first).size,10);
 if(finale.requireMedia)assert(picks.every(list=>list.some(q=>q.media)),key+' always has a licensed clip');
}
console.log('PASS: replay changes every ordinary finale, including identical random draws.');
for(const quiz of [{id:'slang',multiRound:true},...[w.QUIZ_FACTS,w.QUIZ_AUDIO,w.QUIZ_MEDIA_PREVIEW,w.QUIZ_SCRAMBLED].map(multiQuiz=>({id:multiQuiz.title,multiQuiz})),{id:'closest-numbers'}]){
 const rounds=w.QuizRoundPlans.plan(quiz,Array.from({length:10},(_,i)=>({id:'number-'+i})));
 const sets=[0,1].map(()=>w.QuizRoundPlans.select(rounds,quiz.id,()=>0.5)[2].map(q=>q.id).sort());
 assert.notDeepEqual(sets[0],sets[1],quiz.id+' dynamic finale');
 assert.equal(new Set(sets[0]).size,sets[0].length);
}
const firstRounds=[...new Map(Object.values(w.QUIZ_BANK_SUPPLEMENTS).flat().map(q=>[q.id,q])).values()];
assert.equal(new Set(firstRounds.map(q=>q.text+'\0'+(q.media?.src||''))).size,firstRounds.length);
for(const q of firstRounds){
 assert(q.text&&q.explanation&&q.answers.length===4&&new Set(q.answers).size===4,q.id);
 if(q.media)assert(fs.existsSync(q.media.src)&&q.source,q.id);
}
const words=w.QUIZ_SCRAMBLED.rounds.flatMap(r=>r.questions);
assert.equal(new Set(words.map(q=>q.correctAnswer||q.answers[q.correct])).size,32);
assert.equal(new Set(words.map(q=>q.id)).size,32);
assert.deepEqual(Array.from(w.QuizRoundPlans.counts(w.QUIZ_SCRAMBLED.rounds)),[10,10,10]);
const word={...words.find(q=>q.id==='scramble-thermos'),type:'free-text'};
assert(w.QuizGameModel.isFreeTextCorrect(word,'  ТЕРМОС  '));
assert(!w.QuizGameModel.isFreeTextCorrect(word,'ТЕРМСО'));
assert(!w.QuizGameModel.toPlayerQuestion(word).correctAnswer);
console.log(`PASS: ${firstRounds.length} first-round additions and exact matching of scrambled words.`);
for(const item of JSON.parse(fs.readFileSync('content/licensed-media.json','utf8'))){
 const data=fs.readFileSync(item.file);
 assert.equal(data.length,item.bytes);
 assert.equal(require('node:crypto').createHash('sha256').update(data).digest('hex'),item.sha256);
 assert(item.sourceEndSeconds>item.sourceStartSeconds&&item.licenseUrl&&item.attribution&&item.downloadUrl);
}
console.log('PASS: all special finales change their set; licensed media hashes and provenance.');
