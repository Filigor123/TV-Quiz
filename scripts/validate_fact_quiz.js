const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ window: {} });
for (const file of ['game-model.js', 'facts-quiz.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
}
const quiz = context.window.QUIZ_FACTS;
const model = context.window.QuizGameModel;
const rounds = Array.from(quiz.rounds);
const questions = rounds.flatMap((round) => Array.from(round.questions));

assert.equal(rounds.length, 3);
assert.deepEqual(rounds.map((round) => round.questions.length), [5, 5, 5]);
assert.deepEqual(rounds.map((round) => round.type), ['choice', 'free-text', 'true-false']);
assert.equal(new Set(questions.map((question) => question.id)).size, 15, 'IDs are stable and unique');

for (const [roundIndex, round] of rounds.entries()) {
  for (const question of Array.from(round.questions)) {
    assert.ok(question.id && question.text && question.explanation && question.source,
      `incomplete source or explanation: ${question.id}`);
    const normalized = model.normalizeQuestion(question);
    assert.equal(normalized.type, round.type, `question type was not preserved: ${question.id}`);
    if (roundIndex === 0) {
      assert.equal(question.answers.length, 4, `expected four options: ${question.id}`);
      assert.ok(Number.isInteger(question.correct) && question.correct >= 0 && question.correct < 4);
      assert.equal(new Set(question.answers).size, 4, `duplicate options: ${question.id}`);
    } else if (roundIndex === 1) {
      assert.ok(question.correctAnswer && question.acceptableAnswers.length >= 2);
      assert.equal(model.isFreeTextCorrect(question, question.acceptableAnswers[0]), true);
      assert.equal(model.isFreeTextCorrect(question, 'unrelated answer'), false);
    } else {
      assert.deepEqual(Array.from(question.answers), ['Правда', 'Вымысел']);
      assert.ok(question.correct === 0 || question.correct === 1);
      assert.equal(normalized.answers[normalized.correct], question.answers[question.correct]);
    }
    const playerQuestion = model.toPlayerQuestion(question);
    for (const key of ['correct', 'correctAnswer', 'acceptableAnswers', 'explanation', 'source']) {
      assert.equal(Object.hasOwn(playerQuestion, key), false, `${key} leaked before reveal: ${question.id}`);
    }
  }
}

// Exercise the whole three-round scoring/result calculation with a good and a weak game.
const scores = { A: 0, B: 0 };
for (const [roundIndex, round] of rounds.entries()) {
  for (const question of Array.from(round.questions)) {
    const wager = roundIndex === 1 && question === round.questions[0];
    const answerA = question.type === 'free-text' ? question.acceptableAnswers[0] : question.correct;
    const answerB = roundIndex === 0 && question === round.questions[0]
      ? (question.correct + 1) % question.answers.length
      : roundIndex === 1 && wager ? 'not correct'
        : question.type === 'free-text' ? question.acceptableAnswers[0] : question.correct;
    const correctA = question.type === 'free-text'
      ? model.isFreeTextCorrect(question, answerA) : answerA === question.correct;
    const correctB = question.type === 'free-text'
      ? model.isFreeTextCorrect(question, answerB) : answerB === question.correct;
    scores.A += model.answerScore(correctA, wager);
    scores.B += model.answerScore(correctB, wager);
  }
}
assert.deepEqual(scores, { A: 16, B: 12 });
assert.deepEqual(Object.entries(scores).sort((left, right) => right[1] - left[1]).map(([name]) => name), ['A', 'B']);

const host = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const phone = fs.readFileSync(path.join(root, 'join.html'), 'utf8');
assert.match(host, /facts-quiz\.js/);
assert.match(host, /multiQuiz:window\.QUIZ_FACTS/);
assert.match(phone, /answer-open/);
for (const [file, html] of [['index.html', host], ['join.html', phone]]) {
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/gi)) new Function(match[1]); // eslint-disable-line no-new-func
}

console.log('Fact quiz validation passed: 15 source-backed questions, three mechanics, hidden answers, scoring and final ranking.');
