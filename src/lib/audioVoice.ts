import type { GameType, Language } from '../shared/types.ts';

export type MusicTheme = 'salon' | GameType;

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (Ctor) audioCtx = new Ctor();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

interface MusicTrackSpec {
  stepMs: number;
  labelEn: string;
  labelEs: string;
  bassFreqs: number[];
  leadFreqs: number[];
  padChords: number[][];
  waveform: OscillatorType;
  leadWave: OscillatorType;
  percussionEvery?: number;
}

const MUSIC_TRACKS: Record<MusicTheme, MusicTrackSpec> = {
  salon: {
    stepMs: 340,
    labelEn: 'Velvet Lounge Jazz',
    labelEs: 'Jazz Lounge del Salón',
    bassFreqs: [130.81, 0, 146.83, 0, 110.0, 0, 123.47, 0, 87.31, 0, 98.0, 0, 98.0, 0, 123.47, 0],
    leadFreqs: [392.0, 0, 493.88, 523.25, 0, 440.0, 392.0, 0, 349.23, 0, 440.0, 523.25, 493.88, 0, 392.0, 0],
    padChords: [
      [261.63, 329.63, 392.0, 493.88],
      [220.0, 261.63, 329.63, 392.0],
      [174.61, 220.0, 261.63, 329.63],
      [196.0, 246.94, 293.66, 349.23],
    ],
    waveform: 'sine',
    leadWave: 'triangle',
  },
  domino: {
    stepMs: 285,
    labelEn: 'Caribbean Acoustic Son',
    labelEs: 'Son Acústico del Caribe',
    bassFreqs: [146.83, 0, 0, 110.0, 146.83, 0, 130.81, 0, 110.0, 0, 0, 164.81, 110.0, 0, 130.81, 0],
    leadFreqs: [587.33, 440.0, 523.25, 440.0, 659.25, 0, 587.33, 523.25, 440.0, 523.25, 659.25, 523.25, 554.37, 0, 440.0, 0],
    padChords: [
      [293.66, 349.23, 440.0],
      [293.66, 349.23, 440.0],
      [220.0, 277.18, 329.63],
      [220.0, 277.18, 329.63],
    ],
    waveform: 'triangle',
    leadWave: 'triangle',
    percussionEvery: 2,
  },
  parques: {
    stepMs: 255,
    labelEn: 'Festive Marimba Groove',
    labelEs: 'Marimba Festiva Tropical',
    bassFreqs: [130.81, 0, 196.0, 0, 174.61, 0, 196.0, 0, 130.81, 0, 164.81, 0, 196.0, 0, 146.83, 0],
    leadFreqs: [523.25, 659.25, 783.99, 659.25, 698.46, 880.0, 783.99, 0, 523.25, 587.33, 659.25, 783.99, 880.0, 783.99, 659.25, 587.33],
    padChords: [
      [261.63, 329.63, 392.0],
      [174.61, 220.0, 261.63],
      [261.63, 329.63, 392.0],
      [196.0, 246.94, 293.66],
    ],
    waveform: 'sine',
    leadWave: 'sine',
    percussionEvery: 4,
  },
  ahorcado: {
    stepMs: 390,
    labelEn: 'Noir Mystery Piano',
    labelEs: 'Piano de Misterio Noir',
    bassFreqs: [110.0, 0, 0, 0, 130.81, 0, 0, 0, 116.54, 0, 0, 0, 82.41, 0, 98.0, 0],
    leadFreqs: [440.0, 523.25, 659.25, 523.25, 440.0, 0, 622.25, 523.25, 349.23, 440.0, 523.25, 0, 329.63, 415.3, 493.88, 0],
    padChords: [
      [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63],
      [146.83, 174.61, 220.0],
      [164.81, 207.65, 246.94],
    ],
    waveform: 'sine',
    leadWave: 'sine',
  },
  bingo: {
    stepMs: 240,
    labelEn: 'Parlor Swing Showtime',
    labelEs: 'Swing Alegre de Bingo',
    bassFreqs: [196.0, 0, 246.94, 0, 293.66, 0, 246.94, 0, 130.81, 0, 164.81, 0, 196.0, 0, 146.83, 0],
    leadFreqs: [783.99, 0, 659.25, 587.33, 659.25, 783.99, 987.77, 0, 523.25, 659.25, 783.99, 0, 659.25, 587.33, 523.25, 0],
    padChords: [
      [196.0, 246.94, 293.66, 349.23],
      [261.63, 329.63, 392.0, 440.0],
      [220.0, 261.63, 329.63, 392.0],
      [146.83, 196.0, 246.94, 293.66],
    ],
    waveform: 'triangle',
    leadWave: 'triangle',
    percussionEvery: 2,
  },
  ajedrez: {
    stepMs: 360,
    labelEn: 'Grandmaster Baroque Strings',
    labelEs: 'Cuerdas Barrocas de Ajedrez',
    bassFreqs: [146.83, 0, 220.0, 0, 130.81, 0, 196.0, 0, 116.54, 0, 174.61, 0, 110.0, 0, 164.81, 0],
    leadFreqs: [587.33, 659.25, 698.46, 587.33, 523.25, 587.33, 659.25, 523.25, 466.16, 523.25, 587.33, 466.16, 440.0, 554.37, 659.25, 440.0],
    padChords: [
      [146.83, 220.0, 293.66, 349.23],
      [130.81, 196.0, 261.63, 329.63],
      [116.54, 174.61, 233.08, 293.66],
      [110.0, 164.81, 220.0, 277.18],
    ],
    waveform: 'sawtooth',
    leadWave: 'triangle',
  },
};

class SoundAndVoiceEngine {
  soundEnabled = true;
  voiceEnabled = true;
  musicEnabled = true;

  private speakingListeners = new Set<(speaking: boolean, caption: string) => void>();
  private themeListeners = new Set<(theme: MusicTheme) => void>();
  private currentCaption = '';
  private currentTheme: MusicTheme = 'salon';
  private musicStep = 0;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private unlockBound = false;

  constructor() {
    this.bindAudioUnlock();
  }

  private bindAudioUnlock() {
    if (typeof window === 'undefined' || this.unlockBound) return;
    this.unlockBound = true;
    const unlock = () => {
      const ctx = getCtx();
      if (ctx && ctx.state === 'suspended') {
        void ctx.resume();
      }
      if (this.musicEnabled && !this.musicTimer) {
        this.startMusicLoop();
      }
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  subscribeVoice(cb: (speaking: boolean, caption: string) => void): () => void {
    this.speakingListeners.add(cb);
    return () => {
      this.speakingListeners.delete(cb);
    };
  }

  subscribeMusicTheme(cb: (theme: MusicTheme) => void): () => void {
    this.themeListeners.add(cb);
    cb(this.currentTheme);
    return () => {
      this.themeListeners.delete(cb);
    };
  }

  getMusicTrackLabel(theme: MusicTheme, lang: Language): string {
    const spec = MUSIC_TRACKS[theme];
    return lang === 'es' ? spec.labelEs : spec.labelEn;
  }

  setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (!enabled) {
      this.stopMusicLoop();
    } else {
      this.startMusicLoop();
    }
  }

  setMusicTheme(theme: MusicTheme) {
    if (this.currentTheme === theme) {
      if (this.musicEnabled && !this.musicTimer) {
        this.startMusicLoop();
      }
      return;
    }
    this.currentTheme = theme;
    this.musicStep = 0;
    for (const cb of this.themeListeners) cb(theme);
    if (this.musicEnabled) {
      this.startMusicLoop();
    }
  }

  private stopMusicLoop() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private startMusicLoop() {
    if (typeof window === 'undefined') return;
    this.stopMusicLoop();
    if (!this.musicEnabled) return;

    const spec = MUSIC_TRACKS[this.currentTheme];
    this.musicTimer = setInterval(() => {
      if (!this.musicEnabled) return;
      const ctx = getCtx();
      if (!ctx || ctx.state !== 'running') return;

      const step = this.musicStep % 16;
      const bar = Math.floor(step / 4) % spec.padChords.length;

      // Soft warm chord pad on the downbeat of each 4-step bar
      if (step % 4 === 0) {
        const chord = spec.padChords[bar];
        const padDur = (spec.stepMs * 3.8) / 1000;
        for (const freq of chord) {
          this.playFilteredNote(ctx, freq, padDur, spec.waveform, 0.014, 760);
        }
      }

      // Bass voice
      const bass = spec.bassFreqs[step];
      if (bass > 0) {
        this.playFilteredNote(ctx, bass, (spec.stepMs * 1.4) / 1000, 'triangle', 0.036, 480);
      }

      // Melodic voice
      const lead = spec.leadFreqs[step];
      if (lead > 0) {
        this.playFilteredNote(ctx, lead, (spec.stepMs * 0.9) / 1000, spec.leadWave, 0.025, 1900);
      }

      // Subtle wooden percussive tap if configured
      if (spec.percussionEvery && step % spec.percussionEvery === 0) {
        this.playSoftBrush(ctx, step % 4 === 0 ? 0.015 : 0.008);
      }

      this.musicStep = (this.musicStep + 1) % 16;
    }, spec.stepMs);
  }

  private playFilteredNote(
    ctx: AudioContext,
    freq: number,
    durationSec: number,
    wave: OscillatorType,
    peakGain: number,
    cutoffHz: number
  ) {
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = wave;
      osc.frequency.setValueAtTime(freq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoffHz, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(peakGain, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + durationSec + 0.02);
    } catch {
      // Ignore audio limits
    }
  }

  private playSoftBrush(ctx: AudioContext, level: number) {
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1600, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.028);
      gain.gain.setValueAtTime(level, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.032);
    } catch {
      // Ignore audio limits
    }
  }

  private notifySpeaking(speaking: boolean, caption: string) {
    this.currentCaption = caption;
    for (const cb of this.speakingListeners) {
      cb(speaking, caption);
    }
  }

  playTone(freq: number, duration = 0.09, type: OscillatorType = 'triangle', volume = 0.14) {
    if (!this.soundEnabled) return;
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Ignore audio context autoplay limits
    }
  }

  playDominoClack() {
    this.playTone(210, 0.05, 'square', 0.11);
    setTimeout(() => this.playTone(135, 0.08, 'triangle', 0.13), 24);
  }

  playDiceRoll() {
    if (!this.soundEnabled) return;
    [320, 440, 280, 510].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 0.045, 'square', 0.07), i * 55);
    });
  }

  playPawnHop() {
    this.playTone(520, 0.07, 'sine', 0.12);
    setTimeout(() => this.playTone(680, 0.08, 'sine', 0.1), 50);
  }

  playCaptureBoom() {
    this.playTone(170, 0.18, 'sawtooth', 0.14);
    setTimeout(() => this.playTone(95, 0.24, 'triangle', 0.18), 70);
  }

  playKeyTap(correct: boolean) {
    if (correct) {
      this.playTone(620, 0.07, 'sine', 0.1);
      setTimeout(() => this.playTone(840, 0.1, 'sine', 0.09), 50);
    } else {
      this.playTone(180, 0.14, 'sawtooth', 0.08);
    }
  }

  playBingoPop() {
    this.playTone(460, 0.08, 'sine', 0.12);
    setTimeout(() => this.playTone(690, 0.12, 'triangle', 0.12), 60);
  }

  playVictoryFanfare() {
    if (!this.soundEnabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, 0.22, 'triangle', 0.15), idx * 110);
    });
  }

  playUiClick() {
    if (!this.soundEnabled) return;
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(760, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.038);
      gain.gain.setValueAtTime(0.065, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.042);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.045);
    } catch {
      // Ignore audio context autoplay limits
    }
  }

  playTabNav() {
    if (!this.soundEnabled) return;
    const ctx = getCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(720, now + 0.055);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // Ignore audio context autoplay limits
    }
  }

  speak(text: string, lang: Language = 'en', interrupt = true) {
    if (!text.trim()) return;
    this.notifySpeaking(this.voiceEnabled, text);

    if (!this.voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setTimeout(() => {
        if (this.currentCaption === text) this.notifySpeaking(false, text);
      }, 1600);
      return;
    }

    try {
      const synth = window.speechSynthesis;
      if (interrupt) synth.cancel();

      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang === 'es' ? 'es-ES' : 'en-US';
      utter.rate = 1.04;
      utter.pitch = 1.06;

      const voices = synth.getVoices();
      const targetPrefix = lang === 'es' ? 'es' : 'en';
      const preferred = voices.find((v) => v.lang.toLowerCase().startsWith(targetPrefix));
      if (preferred) utter.voice = preferred;

      utter.onstart = () => this.notifySpeaking(true, text);
      utter.onend = () => this.notifySpeaking(false, text);
      utter.onerror = () => this.notifySpeaking(false, text);

      synth.speak(utter);
    } catch {
      this.notifySpeaking(false, text);
    }
  }

  stopVoice() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.notifySpeaking(false, '');
  }
}

export const audioVoice = new SoundAndVoiceEngine();
