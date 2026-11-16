const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const context=vm.createContext({window:{},URL});
for(const file of ['questions.js','catalog-collections.js','room-link.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
const {QUIZ_QUESTIONS:bank,QUIZ_CATALOG_COLLECTIONS:collections,QuizRoomLink}=context.window;
assert.equal(bank.length,336,'original bank retained');
assert.equal(collections.length,9);
for(const collection of collections){
 assert.equal(new Set(collection.collection.map(record=>record.text)).size,collection.collection.length);
 assert.ok(fs.existsSync(path.join(root,'assets/catalog',collection.cover+'.webp')));
 for(const record of collection.collection){
  const matches=bank.filter(question=>question.text===record.text);
  assert.equal(matches.length,1,record.text);
  const question=matches[0];
  assert.equal(question.answers[question.correct],record.expectedAnswer,record.text);
  assert.equal(question.answers.length,4,record.text);
 }
}
const expected='https://filigor123.github.io/TV-Quiz/join.html?host=a%2Bb%26c';
for(const url of ['file:///H:/TV-Quiz/index.html','http://localhost:8000/','http://127.0.0.1:8000/','http://[::1]:8000/index.html','https://filigor123.github.io/TV-Quiz/']){
 assert.equal(QuizRoomLink.build('a+b&c',url),expected,url);
}
assert.equal(QuizRoomLink.build('room','http://192.168.1.10:8000/index.html'),'http://192.168.1.10:8000/join.html?host=room');
assert.equal(QuizRoomLink.build('room','https://example.org/quiz/index.html#editor'),'https://example.org/quiz/join.html?host=room');
console.log('PASS: 9 explicit collections match unchanged question bank; artwork paths; phone-safe QR URLs for file, localhost, LAN and HTTPS.');
