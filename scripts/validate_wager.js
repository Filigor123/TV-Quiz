const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = { window: {} };
vm.runInNewContext(fs.readFileSync('game-model.js', 'utf8'), context);
const model = context.window.QuizGameModel;

assert.equal(model.answerScore(true, false), 1, 'ordinary correct answer stays +1');
assert.equal(model.answerScore(false, false), 0, 'ordinary wrong answer stays 0');
assert.equal(model.answerScore(true, true), 2, 'wagered correct answer is +2 total');
assert.equal(model.answerScore(false, true), -1, 'wagered wrong answer is -1');

const secondRound = { roundIndex: 1 };
assert.equal(model.canUseWager(secondRound, false, true), true);
assert.equal(model.canUseWager({ roundIndex: 0 }, false, true), false, 'round one cannot wager');
assert.equal(model.canUseWager({ roundIndex: 2 }, false, true), false, 'round three cannot wager');
assert.equal(model.canUseWager(secondRound, true, true), false, 'used wager cannot be reused');
assert.equal(model.canUseWager(secondRound, false, false), false, 'not requested wager is ordinary');

const internal = { id: 'p1', name: 'Игрок', score: -1, answer: 'secret', wagerUsed: true, currentWager: true, awarded: -1, isCorrect: false };
const beforeReveal = JSON.parse(JSON.stringify(model.toPublicRoster([internal])))[0];
assert.equal(beforeReveal.score, -1);
for (const key of ['answer', 'wagerUsed', 'currentWager', 'wager', 'awarded', 'isCorrect']) {
  assert.equal(Object.hasOwn(beforeReveal, key), false, `${key} stays hidden before reveal`);
}
const afterReveal = JSON.parse(JSON.stringify(model.toPublicRoster([internal], true)))[0];
assert.equal(afterReveal.wager, true);
assert.equal(afterReveal.awarded, -1);
assert.equal(afterReveal.isCorrect, false);
assert.equal(Object.hasOwn(afterReveal, 'answer'), false, 'free-text answer is still private roster data');

const playerQuestion = model.toPlayerQuestion({ type: 'free-text', roundIndex: 1, allowWager: true, correctAnswer: 'answer', explanation: 'secret' });
assert.equal(playerQuestion.allowWager, true);
assert.equal(Object.hasOwn(playerQuestion, 'correctAnswer'), false);
assert.equal(Object.hasOwn(playerQuestion, 'explanation'), false);

console.log('Wager rules and pre-reveal privacy passed.');
