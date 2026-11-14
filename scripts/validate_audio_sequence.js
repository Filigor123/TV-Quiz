const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const stored = new Map();
const spoken = [];
const voices = [
  { name: 'English', lang: 'en-US', voiceURI: 'en' },
  { name: 'Russian', lang: 'ru-RU', voiceURI: 'ru' },
];
class Utterance {
  constructor(text) { this.text = text; }
}
const window = {
  localStorage: {
    getItem: (key) => stored.get(key) || null,
    setItem: (key, value) => stored.set(key, value),
  },
  SpeechSynthesisUtterance: Utterance,
  speechSynthesis: {
    getVoices: () => voices,
    speak: (utterance) => { spoken.push(utterance); queueMicrotask(() => utterance.onend()); },
    cancel: () => {},
  },
  setTimeout,
  clearTimeout,
};
const context = { window };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'audio.js'), 'utf8'), context);

(async () => {
  const audio = window.QuizAudio;
  assert.deepEqual(Array.from(audio.getSpeechVoices(), (voice) => voice.voiceURI), ['ru']);
  audio.setSpeechVoice('ru');
  assert.equal(audio.getSettings().voiceURI, 'ru');
  await audio.unlock();
  assert.equal(await audio.speakQuestion('Вопрос и варианты'), true);
  assert.equal(spoken[0].text, 'Вопрос и варианты');
  assert.equal(spoken[0].voice.voiceURI, 'ru');
  assert.equal(await audio.speakQuestion(''), false);

  const host = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const phone = fs.readFileSync(path.join(root, 'join.html'), 'utf8');
  assert.doesNotMatch(host.match(/function openRoom\([\s\S]*?\n\}/)?.[0] || '', /startMusic/,
    'lobby stays silent');
  assert.match(host, /answerWindowOpen&&players\.has\(conn\.peer\)/,
    'host rejects answers before the host opens the window');
  assert.match(host, /broadcast\(\{type:'answer-open'/,
    'the host broadcasts the answer-open phase only after host narration');
  assert.match(host, /async function announceStartCue[\s\S]*?speakQuestion\('Время пошло!'\)[\s\S]*?openAnswerWindow/,
    'the timer cue is spoken before answers open');
  assert.match(host, /function questionTime[\s\S]*?scaledPosition<=3\?40:scaledPosition<=6\?30:scaledPosition<=9\?20:15/,
    'staged timer follows the agreed 40/30/20/15 schedule');
  assert.match(host, /Math\.min\(60,base\+10\)/,
    'free response gets extra time');
  assert.match(host, /revealSpeech[\s\S]*?speakQuestion\(revealSpeech\)[\s\S]*?replayRevealClip/,
    'answer and available explanation are narrated after reveal');
  assert.match(phone, /answer-open/,
    'the phone unlocks answering only after the host phase message');
  assert.match(host, /QuizAudio\.playTick\(\)/,
    'host gives a final-five-second cue');

  for (const [file, source] of [['index.html', host], ['join.html', phone]]) {
    for (const [index, match] of [...source.matchAll(/<script>([\s\S]*?)<\/script>/gi)].entries()) {
      const script = match[1];
      try { new Function(script); } catch (error) {
        console.error(`Could not parse inline ${file} script ${index}: ${script.slice(0, 100)}`);
        throw error;
      }
      assert.ok(index >= 0);
    }
  }
  console.log('Audio sequence, voice selection, timer phases, and inline scripts passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
