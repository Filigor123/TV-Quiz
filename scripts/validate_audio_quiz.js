const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'game-model.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'audio-quiz.js'), 'utf8'), context);
const quiz = context.window.QUIZ_AUDIO;
const model = context.window.QuizGameModel;

assert.equal(quiz.rounds.length, 3, 'audio pilot has three rounds');
assert.deepEqual(Array.from(quiz.rounds, (round) => round.questions.length), [5, 5, 5]);
assert.deepEqual(Array.from(quiz.rounds, (round) => round.type), ['choice', 'free-text', 'choice']);
assert.equal(quiz.rounds[1].questions.every((question) => question.allowWager === false), true,
  'wager availability is controlled by the game round, not content input');

const questions = Array.from(quiz.rounds).flatMap((round) => Array.from(round.questions));
const ids = questions.map((question) => question.id);
assert.equal(new Set(ids).size, ids.length, 'recording IDs are unique across rounds');
for (const question of questions) {
  const file = path.join(root, 'assets', 'quiz-media', `${question.id}.mp3`);
  assert.ok(fs.existsSync(file), `missing audio asset ${question.id}`);
  assert.ok(fs.statSync(file).size > 1000, `audio asset looks empty: ${question.id}`);
  assert.equal(fs.readFileSync(file).subarray(0, 3).toString(), 'ID3', `audio asset has an MP3 ID3 header: ${question.id}`);
  assert.ok(question.media.src.endsWith(`${question.id}.mp3`));
  if (question.type === 'choice') {
    assert.equal(question.answers[question.correct], question.correctAnswer,
      `correct option index is wrong: ${question.id}`);
  }
  const playerQuestion = model.toPlayerQuestion(question);
  for (const key of ['correct', 'correctAnswer', 'acceptableAnswers', 'explanation', 'source']) {
    assert.equal(Object.hasOwn(playerQuestion, key), false, `${key} leaked to player for ${question.id}`);
  }
  assert.equal(Object.hasOwn(playerQuestion.media, 'src'), false, 'player must not receive host audio URL');
}

const free = quiz.rounds[1].questions;
assert.equal(model.isFreeTextCorrect(free[0], '  НОКИА! '), true);
assert.equal(model.isFreeTextCorrect(free[1], 'windows xp'), true);
assert.equal(model.isFreeTextCorrect(free[2], 'BRUH'), true);
assert.equal(model.isFreeTextCorrect(free[4], 'to-be continued'), true);
assert.equal(model.isFreeTextCorrect(free[1], 'Windows 11'), false);
assert.equal(model.isFreeTextCorrect(free[1], 'WIndwos XP'), true, 'one adjacent transposition is accepted');
assert.equal(model.isFreeTextCorrect({ correctAnswer: 'Windows XP' }, 'WIndwos XP'), false, 'typo matching is opt-in for audio questions');
assert.equal(model.isFreeTextCorrect(free[1], 'Winodws 11'), false, 'unrelated typo is rejected');
assert.equal(model.isFreeTextCorrect(free[1], ''), false);

const wagerQuestion = { roundIndex: 1 };
assert.equal(model.canUseWager(wagerQuestion, false, true), true);
assert.equal(model.canUseWager(wagerQuestion, true, true), false, 'wager is single use');
assert.equal(model.canUseWager({ roundIndex: 2 }, false, true), false, 'round three has no wager');
assert.equal(model.answerScore(true, true), 2);
assert.equal(model.answerScore(false, true), -1);
assert.equal(model.answerScore(true, false), 1);
assert.equal(model.answerScore(false, false), 0);

// Simulate two players completing every question, including a correct and a wrong second-round wager.
const scores = { Mira: 0, Tolik: 0 };
for (const [roundIndex, round] of Array.from(quiz.rounds).entries()) {
  for (const question of Array.from(round.questions)) {
    const miraAnswer = question.type === 'free-text' ? question.acceptableAnswers[0] : question.correct;
    const tolIkAnswer = roundIndex === 0 && question === round.questions[0] ? (question.correct + 1) % question.answers.length
      : roundIndex === 1 && question === round.questions[0] ? 'not this answer'
        : question.type === 'free-text' ? question.acceptableAnswers[0] : question.correct;
    scores.Mira += model.answerScore(question.type === 'free-text'
      ? model.isFreeTextCorrect(question, miraAnswer) : miraAnswer === question.correct, roundIndex === 1 && question === round.questions[0]);
    scores.Tolik += model.answerScore(question.type === 'free-text'
      ? model.isFreeTextCorrect(question, tolIkAnswer) : tolIkAnswer === question.correct, roundIndex === 1 && question === round.questions[0]);
  }
}
assert.deepEqual(scores, { Mira: 16, Tolik: 12 }, 'scoring carries across rounds and ranks the winner');
assert.deepEqual(Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([name]) => name), ['Mira', 'Tolik']);

const host = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const phone = fs.readFileSync(path.join(root, 'join.html'), 'utf8');
assert.match(host, /answerWindowOpen&&players\.has\(conn\.peer\)/, 'host rejects early answers');
assert.match(host, /type:'answer-open'/, 'host opens answers after clip playback');
assert.match(host, /q\.mediaLoadFailed[\s\S]*?skipped:true/, 'failed media skips without score');
assert.match(phone, /answer-open/, 'phone opens controls after host playback');

for (const [file, source] of [['index.html', host], ['join.html', phone]]) {
  const inlineScripts = [...source.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
  for (const [index, script] of inlineScripts.entries()) {
    new Function(script); // eslint-disable-line no-new-func
    assert.ok(index >= 0);
  }
}

console.log(`Audio pilot validation passed: ${questions.length} unique clips, 3 rounds, privacy, answer matching, wager, score and results.`);
