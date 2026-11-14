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
      : question.type === 'media-choice' ? 'media-choice' : 'choice';
    const normalized = { ...question, type };
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

  function toPlayerQuestion(question) {
    const q = normalizeQuestion(question);
    if (!q) return null;
    if (q.media) {
      const { src, file, objectUrl, ...publicMedia } = q.media;
      q.media = publicMedia;
    }
    return q;
  }

  window.QuizGameModel = Object.freeze({
    normalizeQuestion,
    parseNumber,
    parseQuantity,
    parseDate,
    unitOptions,
    answerDistance,
    closestWinners,
    toPlayerQuestion,
  });
})();
