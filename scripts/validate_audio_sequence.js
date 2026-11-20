const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const audio = fs.readFileSync(path.join(root, 'audio.js'), 'utf8');

(async () => {
  const host = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const phone = fs.readFileSync(path.join(root, 'join.html'), 'utf8');
  assert.doesNotMatch(host.match(/function openRoom\([\s\S]*?\n\}/)?.[0] || '', /startMusic/,
    'lobby stays silent');
  assert.match(host, /answerWindowOpen&&players\.has\(conn\.peer\)/,
    'host rejects answers before the host opens the window');
  assert.match(host, /broadcast\(\{type:'answer-open'/,
    'the host broadcasts the answer-open phase');
  assert.doesNotMatch(host + audio, /speakQuestion|speechSynthesis|announceStartCue/);
  assert.match(host, /function questionTime[\s\S]*?scaledPosition<=3\?40:scaledPosition<=6\?30:scaledPosition<=9\?20:15/,
    'staged timer follows the agreed 40/30/20/15 schedule');
  assert.match(host, /Math\.min\(60,base\+10\)/,
    'free response gets extra time');
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
  console.log('Audio sequence without voice, timer phases, and inline scripts passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
