import { useEffect, useState } from 'react';
import { Disc3, Mic, MicOff, Music, Volume2, VolumeX } from 'lucide-react';
import { audioVoice, type MusicTheme } from '../lib/audioVoice.ts';
import type { Language } from '../shared/types.ts';

interface VoiceAnnouncerHUDProps {
  voiceEnabled: boolean;
  soundEnabled: boolean;
  musicEnabled: boolean;
  language: Language;
  onToggleVoice: () => void;
  onToggleSound: () => void;
  onToggleMusic: () => void;
  onToggleLanguage: () => void;
}

export function VoiceAnnouncerHUD({
  voiceEnabled,
  soundEnabled,
  musicEnabled,
  language,
  onToggleVoice,
  onToggleSound,
  onToggleMusic,
  onToggleLanguage,
}: VoiceAnnouncerHUDProps) {
  const [speaking, setSpeaking] = useState(false);
  const [caption, setCaption] = useState('');
  const [musicTheme, setMusicTheme] = useState<MusicTheme>('salon');

  useEffect(() => {
    const unsubVoice = audioVoice.subscribeVoice((isSpeaking, text) => {
      setSpeaking(isSpeaking);
      if (text) setCaption(text);
    });
    const unsubMusic = audioVoice.subscribeMusicTheme((theme) => {
      setMusicTheme(theme);
    });
    return () => {
      unsubVoice();
      unsubMusic();
    };
  }, []);

  const trackLabel = audioVoice.getMusicTrackLabel(musicTheme, language);

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
      {/* Live Voice Waveform & Caption */}
      {caption && (
        <div
          className="hidden lg:flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-black/45 border border-white/10 max-w-xs shadow-inner"
          aria-live="polite"
        >
          <div className="flex items-center gap-0.5 h-4 shrink-0">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                style={{ animationDelay: `${i * 0.11}s` }}
                className={`w-0.5 rounded-full transition-all duration-150 ${
                  speaking && voiceEnabled
                    ? 'h-3.5 bg-amber-400 voice-bar'
                    : 'h-1.5 bg-stone-500'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-stone-200 truncate">{caption}</span>
        </div>
      )}

      {/* Language Switch */}
      <button
        type="button"
        onClick={onToggleLanguage}
        className="min-h-[40px] px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono-num font-semibold text-stone-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        title="Switch Voice & Game Language"
      >
        {language.toUpperCase()}
      </button>

      {/* Game Soundtrack Toggle */}
      <button
        type="button"
        onClick={onToggleMusic}
        className={`min-h-[40px] px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
          musicEnabled
            ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
            : 'bg-white/5 border-white/10 text-stone-400 hover:text-stone-200'
        }`}
        title={musicEnabled ? `Mute Music (${trackLabel})` : `Play Music (${trackLabel})`}
      >
        {musicEnabled ? <Disc3 className="w-4 h-4 text-emerald-300" /> : <Music className="w-4 h-4" />}
        <span className="hidden sm:inline max-w-[140px] truncate">
          {musicEnabled ? trackLabel : language === 'es' ? 'Música Off' : 'Music Off'}
        </span>
      </button>

      {/* Voice Announcer Toggle */}
      <button
        type="button"
        onClick={onToggleVoice}
        className={`min-h-[40px] min-w-[40px] px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
          voiceEnabled
            ? 'bg-amber-500/15 border-amber-400/40 text-amber-300'
            : 'bg-white/5 border-white/10 text-stone-400 hover:text-stone-200'
        }`}
        title={voiceEnabled ? 'Mute Voice Announcer' : 'Enable Voice Announcer'}
      >
        {voiceEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
        <span className="hidden sm:inline">{voiceEnabled ? 'Voice On' : 'Voice Off'}</span>
      </button>

      {/* Sound FX Toggle */}
      <button
        type="button"
        onClick={onToggleSound}
        className={`min-h-[40px] min-w-[40px] px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
          soundEnabled
            ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
            : 'bg-white/5 border-white/10 text-stone-400 hover:text-stone-200'
        }`}
        title={soundEnabled ? 'Mute Audio FX' : 'Enable Audio FX'}
      >
        {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
      </button>
    </div>
  );
}
