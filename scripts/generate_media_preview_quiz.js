const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'content/media-pack/manifest.json'), 'utf8'));
const rounds = [
  { title: 'Кино и короткая сцена', type: 'choice', ids: ['film-i01', 'film-i02', 'film-v01', 'film-i04', 'film-i05'] },
  { title: 'Мемы: ответ своими словами', type: 'free-text', ids: ['meme-i02', 'meme-i03', 'meme-i05', 'meme-i06', 'auto-i02'] },
  { title: 'Музыкальные фрагменты', type: 'choice', ids: ['music-008', 'music-009', 'music-010', 'music-011', 'music-012'] },
];
const byId = new Map(manifest.items.map((item) => [item.id, item]));

for (const round of rounds) {
  for (const id of round.ids) {
    const item = byId.get(id);
    if (!item || item.status !== 'file_prepared' || !item.media) {
      throw new Error(`Missing prepared media item ${id}`);
    }
    if (item.editorialStatus === 'rejected_asset' || item.editorialStatus === 'source_only') {
      throw new Error(`Non-playable editorial status for ${id}`);
    }
    if (!Array.isArray(item.options) || item.options.length !== 4 || !item.options.includes(item.answer)) {
      throw new Error(`Invalid options or answer for ${id}`);
    }
  }
}

const quiz = {
  category: 'Медиапакет',
  topic: 'Редакторский предпросмотр',
  title: 'Предпросмотр медиапакета',
  description: '15 вопросов с кадрами, видео и звуком · редакторский пилот',
  cover: 'film-cinema',
  previewOnly: true,
  rounds: rounds.map((round) => ({
    title: round.title,
    type: round.type,
    questions: round.ids.map((id) => {
      const item = byId.get(id);
      const duration = Number(item.clipDurationSeconds || 0);
      return {
        id: item.id,
        category: item.category,
        topic: item.topic,
        text: item.prompt,
        answers: item.options,
        correct: item.options.indexOf(item.answer),
        correctAnswer: item.answer,
        acceptableAnswers: item.acceptedAnswers,
        explanation: item.explanation,
        source: item.sourcePage,
        editorialStatus: item.editorialStatus,
        media: {
          ...item.media,
          ...(item.media.type === 'audio' || item.media.type === 'video'
            ? { endSeconds: duration, revealEndSeconds: duration }
            : {}),
        },
      };
    }),
  })),
};

const output = `(() => {\n  'use strict';\n  window.QUIZ_MEDIA_PREVIEW = Object.freeze(${JSON.stringify(quiz, null, 2)});\n})();\n`;
fs.writeFileSync(path.join(root, 'media-preview-quiz.js'), output);
console.log(`Wrote ${quiz.rounds.reduce((sum, round) => sum + round.questions.length, 0)} media-preview questions.`);
