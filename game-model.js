(() => {
  'use strict';

  const DAY_MS = 24 * 60 * 60 * 1000;
  const UNITS = Object.freeze({
    mm: { family: 'length', factor: 0.001 }, 'мм': { family: 'length', factor: 0.001 },
    cm: { family: 'length', factor: 0.01 }, 'см': { family: 'length', factor: 0.01 },
    m: { family: 'length', factor: 1 }, 'м': { family: 'length', factor: 1 },
    km: { family: 'length', factor: 1000 }, 'км': { family: 'length', factor: 1000 },
    mg: { family: 'mass', factor: 0.001 }, 'мг': { family: 'mass', factor: 0.001 },
    g: { family: 'mass', factor: 1 }, 'г': { family: 'mass', factor: 1 },
    kg: { family: 'mass', factor: 1000 }, 'кг': { family: 'mass', factor: 1000 },
    ml: { family: 'volume', factor: 0.001 }, 'мл': { family: 'volume', factor: 0.001 },
    l: { family: 'volume', factor: 1 }, 'л': { family: 'volume', factor: 1 },
    s: { family: 'time', factor: 1 }, 'с': { family: 'time', factor: 1 },
    min: { family: 'time', factor: 60 }, 'мин': { family: 'time', factor: 60 },
    h: { family: 'time', factor: 3600 }, 'ч': { family: 'time', factor: 3600 },
  });
  const UNIT_OPTIONS = Object.freeze({
    length: ['мм', 'см', 'м', 'км'], mass: ['мг', 'г', 'кг'],
    volume: ['мл', 'л'], time: ['с', 'мин', 'ч'],
  });

  function normalizeQuestion(question) {
    if (!question || typeof question !== 'object') return null;
    const type = question.type === 'closest' ? 'closest'
      : question.type === 'media-choice' ? 'media-choice'
      : question.type === 'free-text' ? 'free-text'
      : question.type === 'true-false' ? 'true-false' : 'choice';
    const normalized = { ...question, type };
    if (type === 'free-text') return normalized;
    if (type !== 'closest') {
      normalized.answers = Array.isArray(question.answers) ? question.answers : [];
      normalized.correct = Number.isInteger(question.correct) ? question.correct : 0;
      return normalized;
    }
    normalized.answerMode = question.answerMode === 'date' ? 'date' : 'number';
    normalized.correctValue = String(question.correctValue ?? '').trim();
    normalized.unit = String(question.unit || '').trim();
    return normalized;
  }

  function parseNumber(value) {
    const match = String(value ?? '').trim().replace(',', '.').match(/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/);
    if (!match) return null;
    const number = Number(match[0]);
    return Number.isFinite(number) ? number : null;
  }

  function parseQuantity(value, defaultUnit) {
    const match = String(value ?? '').trim().replace(',', '.').match(/^([-+]?(?:\d+(?:\.\d*)?|\.\d+))\s*([a-zа-яё]+)?$/i);
    if (!match) return null;
    const amount = Number(match[1]);
    const unit = (match[2] || defaultUnit || '').toLowerCase();
    if (!Number.isFinite(amount)) return null;
    if (!unit) return { amount, unit: '' };
    const definition = UNITS[unit];
    const target = UNITS[String(defaultUnit || '').toLowerCase()];
    if (!target && definition) return { amount: amount * definition.factor, unit: definition.family };
    if (!target && !definition && !defaultUnit) return { amount, unit: 'custom:' + unit };
    if (!definition || !target) {
      return unit === String(defaultUnit || '').toLowerCase() ? { amount, unit: 'custom:' + unit } : null;
    }
    if (definition.family !== target.family) return null;
    return { amount: amount * definition.factor, unit: definition.family };
  }

  function parseDate(value) {
    const text = String(value ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    const [year, month, day] = text.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return Math.trunc(date.getTime() / DAY_MS);
  }

  function unitOptions(defaultUnit) {
    const unit = String(defaultUnit || '').toLowerCase();
    const definition = UNITS[unit];
    if (!unit) return [];
    if (!definition) return [String(defaultUnit)];
    const options = UNIT_OPTIONS[definition.family] || [];
    return [String(defaultUnit), ...options.filter((option) => option !== unit)];
  }

  function answerDistance(question, answer) {
    const q = normalizeQuestion(question);
    if (!q || q.type !== 'closest') return null;
    if (answer === null || answer === undefined) return null;
    if (q.answerMode === 'date') {
      const target = parseDate(q.correctValue);
      const value = parseDate(typeof answer === 'object' ? answer.value : answer);
      return target === null || value === null ? null : Math.abs(value - target);
    }
    const target = parseQuantity(q.correctValue, q.unit);
    const rawAnswer = typeof answer === 'object' && answer.unit
      ? String(answer.value) + ' ' + String(answer.unit)
      : typeof answer === 'object' ? answer.value : answer;
    const value = parseQuantity(rawAnswer, q.unit);
    return target && value && target.unit === value.unit ? Math.abs(value.amount - target.amount) : null;
  }

  function closestWinners(question, players) {
    const scored = players.map((player) => ({ player, distance: answerDistance(question, player.answer) }))
      .filter((entry) => entry.distance !== null);
    if (!scored.length) return [];
    const best = Math.min(...scored.map((entry) => entry.distance));
    return scored.filter((entry) => Math.abs(entry.distance - best) < 1e-9).map((entry) => entry.player.id);
  }

  function canUseWager(question, wagerUsed, requested) {
    return Boolean(requested === true && wagerUsed !== true && question && question.roundIndex === 1
      && question.allowWager === true && question.type !== 'closest');
  }

  function answerScore(isCorrect, wagered) {
    if (wagered) return isCorrect ? 2 : -1;
    return isCorrect ? 1 : 0;
  }

  function isFreeTextCorrect(question, answer) {
    if (typeof answer !== 'string' || !question) return false;
    const normalize = (value) => String(value).normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/[’'`]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
    const submitted = normalize(answer);
    const accepted = [question.correctAnswer, ...(question.acceptableAnswers || [])].filter(Boolean).map(normalize);
    if (!submitted) return false;
    if (accepted.includes(submitted)) return true;
    if (question.allowTypos !== true) return false;
    const distance = (left, right) => {
      const matrix = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
      for (let i = 0; i <= left.length; i++) matrix[i][0] = i;
      for (let j = 0; j <= right.length; j++) matrix[0][j] = j;
      for (let i = 1; i <= left.length; i++) {
        for (let j = 1; j <= right.length; j++) {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
          );
          if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
            matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
          }
        }
      }
      return matrix[left.length][right.length];
    };
    return accepted.some((candidate) => {
      const threshold = candidate.length >= 12 ? 2 : candidate.length >= 5 ? 1 : 0;
      return threshold > 0 && Math.abs(candidate.length - submitted.length) <= threshold
        && distance(submitted, candidate) <= threshold;
    });
  }

  function toPublicRoster(players, revealWagers = false) {
    return players.map((player) => {
      const { answer, wagerUsed, currentWager, awarded, isCorrect, ...publicPlayer } = player;
      if (!revealWagers) return publicPlayer;
      return {
        ...publicPlayer,
        wager: currentWager === true,
        awarded: Number.isFinite(awarded) ? awarded : 0,
        isCorrect: isCorrect === true,
      };
    });
  }

  function toPlayerQuestion(question) {
    const q = normalizeQuestion(question);
    if (!q) return null;
    const { correct, correctValue, correctAnswer, acceptableAnswers, allowTypos, explanation, source, ...publicQuestion } = q;
    if (publicQuestion.media) {
      const { src, file, objectUrl, ...publicMedia } = publicQuestion.media;
      publicQuestion.media = publicMedia;
    }
    return publicQuestion;
  }

  window.QuizGameModel = Object.freeze({
    normalizeQuestion,
    parseNumber,
    parseQuantity,
    parseDate,
    unitOptions,
    answerDistance,
    closestWinners,
    canUseWager,
    answerScore,
    isFreeTextCorrect,
    toPublicRoster,
    toPlayerQuestion,
  });
})();
