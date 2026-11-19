import type { Language } from '../shared/types.ts';

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (Ctor) audioCtx = new Ctor();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

class SoundAndVoiceEngine {
  soundEnabled = true;
  voiceEnabled = true;
  private speakingListeners = new Set<(speaking: boolean, caption: string) => void>();
  private currentCaption = '';

  subscribeVoice(cb: (speaking: boolean, caption: string) => void): () => void {
    this.speakingListeners.add(cb);
    return () => {
      this.speakingListeners.delete(cb);
    };
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
