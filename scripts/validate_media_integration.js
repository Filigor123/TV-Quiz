const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const window = {};
const context = vm.createContext({ window });
vm.runInContext(fs.readFileSync(path.join(root, 'media-preview-quiz.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'game-model.js'), 'utf8'), context);
const quiz = window.QUIZ_MEDIA_PREVIEW;
const model = window.QuizGameModel;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'content/media-pack/manifest.json'), 'utf8'));
const byId = new Map(manifest.items.map((item) => [item.id, item]));

assert.equal(quiz.previewOnly, true, 'the unreviewed pack is an explicit preview, not ordinary random content');
assert.deepEqual(Array.from(quiz.rounds, (round) => round.questions.length), [5, 5, 5]);
assert.deepEqual(Array.from(quiz.rounds, (round) => round.type), ['choice', 'free-text', 'choice']);
const questions = quiz.rounds.flatMap((round) => Array.from(round.questions));
assert.equal(new Set(questions.map((question) => question.id)).size, 15, 'preview sources are unique');

for (const question of questions) {
  const item = byId.get(question.id);
  assert.ok(item, `manifest record exists: ${question.id}`);
  assert.equal(item.status, 'file_prepared');
  assert.ok(item.editorialStatus !== 'source_only' && item.editorialStatus !== 'rejected_asset');
  assert.equal(question.answers[question.correct], question.correctAnswer, `correct option is preserved: ${question.id}`);
  const file = path.join(root, question.media.src);
  assert.ok(fs.existsSync(file), `media file exists: ${question.id}`);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), item.sha256,
    `asset matches media-pack manifest: ${question.id}`);
  const playerQuestion = model.toPlayerQuestion(question);
  for (const key of ['correct', 'correctAnswer', 'acceptableAnswers', 'explanation', 'source', 'media.src']) {
    if (key === 'media.src') assert.equal(Object.hasOwn(playerQuestion.media, 'src'), false, `host asset URL is private: ${question.id}`);
    else assert.equal(Object.hasOwn(playerQuestion, key), false, `${key} is hidden: ${question.id}`);
  }
  if (question.media.type === 'audio' || question.media.type === 'video') {
    assert.ok(question.media.endSeconds > 0, `playable clip has an end: ${question.id}`);
  }
}

const audioQuizSource = fs.readFileSync(path.join(root, 'audio-quiz.js'), 'utf8');
for (const question of questions) assert.doesNotMatch(audioQuizSource, new RegExp(question.id),
  `preview does not duplicate audio pilot source: ${question.id}`);

const host = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const phone = fs.readFileSync(path.join(root, 'join.html'), 'utf8');
assert.match(host, /media-preview-quiz\.js/);
assert.match(host, /timerAfterPlayback:playback/,
  'only audio/video media waits for playback; image questions do not try to play');
assert.match(host, /q\.media\.type==='video'[\s\S]*?finishVideoClip/,
  'video ends its media phase before the answer timer');
assert.match(host, /media\.addEventListener\('error'[\s\S]*?mediaLoadFailed=true[\s\S]*?reveal\(\)/,
  'failed media reveals a no-score skip instead of hanging the room');
assert.match(host, /answerWindowOpen&&players\.has\(conn\.peer\)/,
  'early answers remain blocked');
assert.match(phone, /answer-open/);

for (const [file, source] of [['index.html', host], ['join.html', phone]]) {
  for (const match of source.matchAll(/<script>([\s\S]*?)<\/script>/gi)) new Function(match[1]);
}
console.log('Media preview passed: 15 distinct prepared items, privacy, matching asset hashes, video gate, error path and inline scripts.');
