(() => {
  'use strict';

  if (window.QuizAudio) return;

  const SETTINGS_KEY = 'tvQuizAudioSettings';
  const SOUND_PATTERNS = {
    start: [
      { frequency: 523.25, offset: 0, duration: 0.13, volume: 0.055 },
      { frequency: 659.25, offset: 0.12, duration: 0.13, volume: 0.06 },
      { frequency: 783.99, offset: 0.24, duration: 0.2, volume: 0.065 },
    ],
    question: [
      { frequency: 587.33, offset: 0, duration: 0.14, volume: 0.045 },
      { frequency: 698.46, offset: 0.12, duration: 0.19, volume: 0.05 },
    ],
    correct: [
      { frequency: 659.25, offset: 0, duration: 0.16, volume: 0.055 },
      { frequency: 880, offset: 0.1, duration: 0.23, volume: 0.065 },
    ],
    wrong: [
      { frequency: 246.94, offset: 0, duration: 0.16, volume: 0.05, wave: 'triangle' },
      { frequency: 185, offset: 0.13, duration: 0.23, volume: 0.045, wave: 'triangle' },
    ],
    reveal: [
      { frequency: 392, offset: 0, duration: 0.18, volume: 0.05 },
      { frequency: 523.25, offset: 0.14, duration: 0.22, volume: 0.055 },
    ],
    results: [
      { frequency: 392, offset: 0, duration: 0.22, volume: 0.05 },
      { frequency: 493.88, offset: 0.17, duration: 0.22, volume: 0.055 },
      { frequency: 587.33, offset: 0.34, duration: 0.22, volume: 0.06 },
      { frequency: 783.99, offset: 0.51, duration: 0.42, volume: 0.065 },
    ],
  };

  const MUSIC_CHORDS = [
    [130.81, 196, 261.63, 329.63],
    [146.83, 220, 293.66, 349.23],
    [110, 164.81, 220, 261.63],
    [130.81, 196, 261.63, 329.63],
  ];
  const MUSIC_SECTION_SECONDS = 2;
  const MUSIC_DURATION_SECONDS = MUSIC_SECTION_SECONDS * MUSIC_CHORDS.length;

  function loadSettings() {
    const defaults = { effects: true, music: false };

    try {
      const stored = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || 'null');
      if (!stored || typeof stored !== 'object') return defaults;
      return {
        effects: typeof stored.effects === 'boolean' ? stored.effects : defaults.effects,
        music: typeof stored.music === 'boolean' ? stored.music : defaults.music,
      };
    } catch (_) {
      return defaults;
    }
  }

  const settings = loadSettings();
  let context = null;
  let effectsBus = null;
  let musicBus = null;
  let musicBuffer = null;
  let musicSource = null;
  let musicGain = null;
  let musicStartPromise = null;
  let musicRequestId = 0;
  let userGestureGranted = false;
  let currentUtterance = null;
  let currentSpeechResolve = null;

  function saveSettings() {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (_) {
      // Settings still work for this page even when storage is unavailable.
    }
  }

  function createAudioContext() {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return null;

    try {
      context = new AudioContextConstructor();
      effectsBus = context.createGain();
      effectsBus.gain.value = settings.effects ? 0.8 : 0;
      effectsBus.connect(context.destination);

      musicBus = context.createGain();
      musicBus.gain.value = 1;
      musicBus.connect(context.destination);
      return context;
    } catch (_) {
      context = null;
      effectsBus = null;
      musicBus = null;
      return null;
    }
  }

  function getContext() {
    if (context && context.state !== 'closed') return context;
    return createAudioContext();
  }

  async function unlock() {
    userGestureGranted = true;
    const audioContext = getContext();
    if (!audioContext) return false;

    try {
      if (audioContext.state === 'suspended') await audioContext.resume();
      return audioContext.state === 'running';
    } catch (_) {
      return false;
    }
  }

  function setBusEnabled(bus, enabled, normalGain) {
    if (!bus || !context || context.state === 'closed') return;

    const now = context.currentTime;
    try {
      bus.gain.cancelScheduledValues(now);
      bus.gain.setTargetAtTime(enabled ? normalGain : 0, now, 0.025);
    } catch (_) {
      bus.gain.value = enabled ? normalGain : 0;
    }
  }

  function setEffectsEnabled(enabled) {
    settings.effects = Boolean(enabled);
    saveSettings();
    setBusEnabled(effectsBus, settings.effects, 0.8);
    return settings.effects;
  }

  function setMusicEnabled(enabled) {
    settings.music = Boolean(enabled);
    saveSettings();
    if (!settings.music) stopMusic();
    return settings.music;
  }

  function scheduleTone(audioContext, note) {
    const oscillator = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    const startAt = audioContext.currentTime + note.offset;
    const endAt = startAt + note.duration;
    const peak = Math.max(0.001, note.volume);

    oscillator.type = note.wave || 'sine';
    oscillator.frequency.setValueAtTime(note.frequency, startAt);
    envelope.gain.setValueAtTime(0.0001, startAt);
    envelope.gain.exponentialRampToValueAtTime(peak, startAt + Math.min(0.025, note.duration / 3));
    envelope.gain.exponentialRampToValueAtTime(0.0001, endAt);
    oscillator.connect(envelope);
    envelope.connect(effectsBus);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(startAt);
    oscillator.stop(endAt + 0.015);
  }

  function play(name) {
    const pattern = SOUND_PATTERNS[name];
    if (!settings.effects || !pattern || !userGestureGranted || !context || context.state !== 'running') {
      return false;
    }

    try {
      pattern.forEach((note) => scheduleTone(context, note));
      return true;
    } catch (_) {
      return false;
    }
  }

  function createMusicBuffer(audioContext) {
    if (musicBuffer) return musicBuffer;

    const sampleRate = audioContext.sampleRate;
    const frameCount = Math.ceil(sampleRate * MUSIC_DURATION_SECONDS);
    const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
    const samples = buffer.getChannelData(0);
    const fadeSeconds = 0.22;

    for (let frame = 0; frame < frameCount; frame += 1) {
      const time = frame / sampleRate;
      const section = Math.min(MUSIC_CHORDS.length - 1, Math.floor(time / MUSIC_SECTION_SECONDS));
      const sectionTime = time - section * MUSIC_SECTION_SECONDS;
      const chord = MUSIC_CHORDS[section];
      const fadeIn = Math.min(1, sectionTime / fadeSeconds);
      const fadeOut = Math.min(1, (MUSIC_SECTION_SECONDS - sectionTime) / fadeSeconds);
      const sectionEnvelope = Math.min(fadeIn, fadeOut);
      const gentlePulse = 0.88 + 0.12 * Math.sin((2 * Math.PI * time) / 4);
      let sample = 0;

      chord.forEach((frequency, index) => {
        const phase = 2 * Math.PI * frequency * sectionTime;
        const voice = Math.sin(phase) + 0.22 * Math.sin(phase * 2);
        sample += voice * (index === 0 ? 0.28 : 0.18);
      });

      samples[frame] = sample * sectionEnvelope * gentlePulse * 0.22;
    }

    musicBuffer = buffer;
    return musicBuffer;
  }

  function startMusic() {
    if (!settings.music) return Promise.resolve(false);
    if (musicSource && context && context.state !== 'closed') return Promise.resolve(true);
    if (musicStartPromise) return musicStartPromise;

    const requestId = ++musicRequestId;
    const startPromise = (async () => {
      const ready = await unlock();
      if (!ready || !settings.music || requestId !== musicRequestId || !musicBus) return false;

      try {
        const source = context.createBufferSource();
        const volume = context.createGain();
        const now = context.currentTime;
        source.buffer = createMusicBuffer(context);
        source.loop = true;
        volume.gain.setValueAtTime(0.0001, now);
        volume.gain.exponentialRampToValueAtTime(0.13, now + 0.8);
        source.connect(volume);
        volume.connect(musicBus);
        source.onended = () => {
          source.disconnect();
          volume.disconnect();
        };
        source.start(now);
        musicSource = source;
        musicGain = volume;
        return true;
      } catch (_) {
        musicSource = null;
        musicGain = null;
        return false;
      }
    })();

    musicStartPromise = startPromise;
    startPromise.finally(() => {
      if (musicStartPromise === startPromise) musicStartPromise = null;
    });
    return startPromise;
  }

  function stopMusic() {
    musicRequestId += 1;
    musicStartPromise = null;
    if (!musicSource) return false;

    const source = musicSource;
    const volume = musicGain;
    musicSource = null;
    musicGain = null;

    try {
      const now = context.currentTime;
      volume.gain.cancelScheduledValues(now);
      volume.gain.setValueAtTime(Math.max(0.0001, volume.gain.value), now);
      volume.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      source.stop(now + 0.09);
    } catch (_) {
      try {
        source.stop();
      } catch (_) {
        // The source may already have stopped.
      }
    }
    return true;
  }

  function speechSupported() {
    return typeof window.speechSynthesis !== 'undefined'
      && typeof window.SpeechSynthesisUtterance !== 'undefined';
  }

  function stopSpeech() {
    if (speechSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch (_) {
        // Speech cancellation is best effort across browsers.
      }
    }

    if (currentSpeechResolve) {
      const resolve = currentSpeechResolve;
      currentUtterance = null;
      currentSpeechResolve = null;
      resolve(false);
      return true;
    }
    return false;
  }

  function speakQuestion(text) {
    if (!userGestureGranted || !speechSupported() || typeof text !== 'string' || !text.trim()) {
      return Promise.resolve(false);
    }

    stopSpeech();

    return new Promise((resolve) => {
      try {
        const utterance = new window.SpeechSynthesisUtterance(text.trim());
        const voices = window.speechSynthesis.getVoices();
        const russianVoice = voices.find((voice) => /^ru([_-]|$)/i.test(voice.lang));
        utterance.lang = 'ru-RU';
        utterance.rate = 0.96;
        utterance.pitch = 1;
        if (russianVoice) utterance.voice = russianVoice;

        currentUtterance = utterance;
        currentSpeechResolve = resolve;
        const finish = (spoken) => {
          if (currentUtterance !== utterance) return;
          currentUtterance = null;
          currentSpeechResolve = null;
          resolve(spoken);
        };
        utterance.onend = () => finish(true);
        utterance.onerror = () => finish(false);
        window.speechSynthesis.speak(utterance);
      } catch (_) {
        currentUtterance = null;
        currentSpeechResolve = null;
        resolve(false);
      }
    });
  }

  window.QuizAudio = Object.freeze({
    unlock,
    play,
    playStart: () => play('start'),
    playQuestion: () => play('question'),
    playCorrect: () => play('correct'),
    playWrong: () => play('wrong'),
    playReveal: () => play('reveal'),
    playResults: () => play('results'),
    startMusic,
    stopMusic,
    setEffectsEnabled,
    setMusicEnabled,
    getSettings: () => ({ effects: settings.effects, music: settings.music }),
    isSpeechSupported: speechSupported,
    speakQuestion,
    stopSpeech,
  });
})();
