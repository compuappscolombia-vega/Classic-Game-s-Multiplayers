import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Lightbulb, RotateCcw, Trophy } from 'lucide-react';
import {
  chooseAiAhorcadoLetter,
  createAhorcadoGame,
  guessAhorcadoLetter,
} from '../shared/ahorcadoEngine.ts';
import type {
  AhorcadoCategory,
  AhorcadoState,
  GameMode,
  Language,
  PlayerInfo,
} from '../shared/types.ts';
import { audioVoice } from '../lib/audioVoice.ts';

interface AhorcadoArenaProps {
  mode: GameMode;
  language: Language;
  localPlayer: PlayerInfo;
  players: PlayerInfo[];
  onlineState?: AhorcadoState;
  onOnlineAction?: (action: Record<string, unknown>) => void;
  onMatchFinished: (outcome: 'win' | 'loss' | 'draw', score: number) => void;
  onExit: () => void;
}

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

function GallowsSvg({ wrongCount }: { wrongCount: number }) {
  return (
    <svg viewBox="0 0 180 200" className="w-40 h-44 sm:w-48 sm:h-52 mx-auto" aria-label={`Hangman gallows with ${wrongCount} of 6 misses`}>
      <defs>
        <linearGradient id="timberVert" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8B5A2B" />
          <stop offset="45%" stopColor="#653B17" />
          <stop offset="100%" stopColor="#3B200B" />
        </linearGradient>
        <linearGradient id="timberHoriz" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#9C6937" />
          <stop offset="50%" stopColor="#6D411B" />
          <stop offset="100%" stopColor="#3B200B" />
        </linearGradient>
        <linearGradient id="hempRope" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="50%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#92400E" />
        </linearGradient>
        <filter id="gallowsShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="5" stdDeviation="3" floodColor="#000000" floodOpacity="0.65" />
        </filter>
      </defs>

      <g filter="url(#gallowsShadow)">
        {/* Carved timber base, post, beam, and brace */}
        <rect x="16" y="180" width="102" height="10" rx="4" fill="url(#timberHoriz)" stroke="#2A1506" strokeWidth="1.5" />
        <rect x="44" y="16" width="10" height="168" rx="3" fill="url(#timberVert)" stroke="#2A1506" strokeWidth="1.5" />
        <rect x="44" y="16" width="84" height="10" rx="3" fill="url(#timberHoriz)" stroke="#2A1506" strokeWidth="1.5" />
        <line x1="50" y1="52" x2="78" y2="23" stroke="url(#timberHoriz)" strokeWidth="7" strokeLinecap="round" />
        {/* Forged brass/iron corner rivets */}
        <circle cx="49" cy="21" r="2.2" fill="#F59E0B" />
        <circle cx="122" cy="21" r="2.2" fill="#F59E0B" />
        {/* Braided hemp rope */}
        <line x1="122" y1="26" x2="122" y2="45" stroke="url(#hempRope)" strokeWidth="4.5" strokeLinecap="round" />
      </g>

      {/* Sculpted Chalk/Ivory Figure */}
      <g filter="url(#gallowsShadow)">
        {/* 1. Head */}
        {wrongCount >= 1 && (
          <circle cx="122" cy="61" r="15.5" fill="rgba(250,246,238,0.08)" stroke="#F7F1E5" strokeWidth="4" />
        )}
        {/* 2. Torso */}
        {wrongCount >= 2 && (
          <line x1="122" y1="77" x2="122" y2="126" stroke="#F7F1E5" strokeWidth="4.5" strokeLinecap="round" />
        )}
        {/* 3. Left Arm */}
        {wrongCount >= 3 && (
          <line x1="122" y1="88" x2="98" y2="111" stroke="#F7F1E5" strokeWidth="4" strokeLinecap="round" />
        )}
        {/* 4. Right Arm */}
        {wrongCount >= 4 && (
          <line x1="122" y1="88" x2="146" y2="111" stroke="#F7F1E5" strokeWidth="4" strokeLinecap="round" />
        )}
        {/* 5. Left Leg */}
        {wrongCount >= 5 && (
          <line x1="122" y1="126" x2="102" y2="158" stroke="#F7F1E5" strokeWidth="4.2" strokeLinecap="round" />
        )}
        {/* 6. Right Leg + expression */}
        {wrongCount >= 6 && (
          <>
            <line x1="122" y1="126" x2="142" y2="158" stroke="#F7F1E5" strokeWidth="4.2" strokeLinecap="round" />
            <path d="M116 56 L120 60 M120 56 L116 60 M124 56 L128 60 M128 56 L124 60" stroke="#FB7185" strokeWidth="2.4" strokeLinecap="round" />
          </>
        )}
      </g>
    </svg>
  );
}

export function AhorcadoArena({
  mode,
  language,
  localPlayer,
  players,
  onlineState,
  onOnlineAction,
  onMatchFinished,
  onExit,
}: AhorcadoArenaProps) {
  const [category, setCategory] = useState<AhorcadoCategory>('animals');
  const [showHint, setShowHint] = useState(false);

  const aiPlayers = useMemo<PlayerInfo[]>(() => {
    if (mode === 'online') return players;
    return [
      localPlayer,
      { id: 'ai_lexicon', name: 'Lexi (IA)', avatarUrl: '', elo: 1180, isAi: true },
    ];
  }, [mode, localPlayer, players]);

  const playerNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of aiPlayers) map[p.id] = p.name;
    return map;
  }, [aiPlayers]);

  const [localState, setLocalState] = useState<AhorcadoState>(() =>
    createAhorcadoGame(
      aiPlayers.map((p) => p.id),
      language,
      category
    )
  );
  const reportedRef = useRef(false);

  const state = mode === 'online' && onlineState ? onlineState : localState;
  const myProgress = state.progress[localPlayer.id];
  const myMask = state.revealedMask[localPlayer.id] || [];

  const submitLetter = useCallback(
    (letter: string) => {
      if (state.status !== 'playing') return;
      if (!myProgress || myProgress.solved || myProgress.eliminated) return;
      if (myProgress.guessedLetters.includes(letter)) return;

      if (mode === 'online' && onOnlineAction) {
        audioVoice.playKeyTap(true);
        onOnlineAction({ kind: 'guess', letter });
      } else {
        const hit = state.secretWord.includes(letter);
        audioVoice.playKeyTap(hit);
        setLocalState((prev) => guessAhorcadoLetter(prev, localPlayer.id, letter, localPlayer.name));
      }
    },
    [state.status, state.secretWord, myProgress, mode, onOnlineAction, localPlayer.id, localPlayer.name]
  );

  // Physical keyboard support
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toUpperCase();
      if (/^[A-ZÑ]$/.test(key)) {
        submitLetter(key);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submitLetter]);

  // AI opponent guesses progressively every 2.2s in offline practice
  useEffect(() => {
    if (mode !== 'ai' || state.status !== 'playing') return;
    const timer = setInterval(() => {
      const aiLetter = chooseAiAhorcadoLetter(state, 'ai_lexicon');
      if (aiLetter) {
        setLocalState((prev) => guessAhorcadoLetter(prev, 'ai_lexicon', aiLetter, 'Lexi (IA)'));
      }
    }, 2200);
    return () => clearInterval(timer);
  }, [mode, state]);

  // Report completion
  useEffect(() => {
    if (state.status === 'finished' && !reportedRef.current) {
      reportedRef.current = true;
      const won = state.winnerId === localPlayer.id;
      const score = myProgress?.score || 0;
      if (won) {
        audioVoice.playVictoryFanfare();
      }
      audioVoice.speak(
        won
          ? language === 'es'
            ? `¡Excelente! Descubriste la palabra ${state.secretWord}.`
            : `Brilliant! You solved ${state.secretWord}.`
          : language === 'es'
          ? `Ronda terminada. La palabra era ${state.secretWord}.`
          : `Round finished. The word was ${state.secretWord}.`,
        language
      );
      onMatchFinished(won ? 'win' : 'loss', score);
    }
  }, [state.status, state.winnerId, state.secretWord, localPlayer.id, myProgress?.score, language, onMatchFinished]);

  const handleRestartAi = (nextCat: AhorcadoCategory = category) => {
    reportedRef.current = false;
    setShowHint(false);
    setCategory(nextCat);
    setLocalState(
      createAhorcadoGame(
        aiPlayers.map((p) => p.id),
        language,
        nextCat
      )
    );
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[#16120f] border border-amber-500/20 shadow-lg">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExit}
            className="min-h-[40px] px-3 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-stone-200 flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Salon
          </button>
          <div>
            <h2 className="text-base font-bold text-[#f4f1ea]">Ahorcado Word Duel</h2>
            <p className="text-xs text-stone-400 capitalize">
              Category: {state.category} · {state.wordLength} letters
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mode === 'ai' && (
            <select
              value={category}
              onChange={(e) => handleRestartAi(e.target.value as AhorcadoCategory)}
              className="min-h-[38px] px-2.5 rounded-lg bg-black/40 border border-white/10 text-xs text-stone-200"
            >
              <option value="animals">Animals</option>
              <option value="geography">Geography</option>
              <option value="science">Science</option>
              <option value="cuisine">Cuisine</option>
              <option value="cinema">Cinema</option>
            </select>
          )}
          <button
            type="button"
            onClick={() => setShowHint((v) => !v)}
            className="min-h-[38px] px-3 rounded-lg bg-amber-500/15 border border-amber-400/35 text-amber-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            {showHint ? 'Hide Clue' : 'Show Clue'}
          </button>
        </div>
      </div>

      {/* Main Oak Tabletop -> Mahogany Frame -> Slate Chalkboard */}
      <div className="flex-1 wood-tabletop rounded-2xl p-2.5 sm:p-4 border border-amber-900/40 flex flex-col">
        <div className="flex-1 mahogany-frame rounded-2xl p-3 sm:p-4 flex flex-col">
          <div className="flex-1 rounded-xl slate-chalkboard border border-stone-900 p-4 sm:p-6 flex flex-col justify-between gap-5 relative overflow-hidden">
            {/* Opponent Race Bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {Object.values(state.progress).map((pr) => {
                const mask = state.revealedMask[pr.playerId] || [];
                const foundCount = mask.filter(Boolean).length;
                return (
                  <div
                    key={pr.playerId}
                    className={`px-3 py-2 rounded-xl border shadow-inner ${
                      pr.playerId === localPlayer.id
                        ? 'bg-emerald-500/12 border-emerald-400/45'
                        : 'bg-black/35 border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#f4f1ea] truncate">
                        {playerNames[pr.playerId] || 'Player'}
                      </span>
                      <span className="font-mono-num text-stone-300">
                        {foundCount}/{state.wordLength} · {pr.wrongCount}/{state.maxWrong} misses
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Gallows + Carved Ivory Secret Word Slots */}
            <div className="flex flex-col items-center justify-center gap-5">
              <GallowsSvg wrongCount={myProgress?.wrongCount || 0} />

              {showHint && (
                <p className="text-sm text-amber-200 bg-amber-500/12 border border-amber-400/30 px-4 py-2 rounded-xl text-center max-w-lg shadow">
                  Clue: {state.hint}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
                {myMask.map((ch, idx) => {
                  const revealed = ch || (state.status === 'finished' ? state.secretWord[idx] : '');
                  const missedReveal = !ch && state.status === 'finished';
                  return (
                    <div
                      key={idx}
                      className={`w-10 h-12 sm:w-12 sm:h-14 rounded-xl flex items-center justify-center text-xl sm:text-2xl font-display font-extrabold transition-transform duration-150 ${
                        revealed
                          ? missedReveal
                            ? 'bg-gradient-to-b from-rose-900 to-rose-950 border-2 border-rose-500 text-rose-200 shadow-[0_4px_0_#4c0519]'
                            : 'ivory-3d border border-[#b9a585] text-[#1e1712]'
                          : 'bg-black/45 border-2 border-[#4d3726] shadow-[inset_0_3px_8px_rgba(0,0,0,0.8)] text-transparent'
                      }`}
                    >
                      {revealed || '_'}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tactile 3D Beveled Mechanical/Ivory On-Screen Keyboard */}
            <div className="space-y-2 max-w-2xl w-full mx-auto">
              {KEYBOARD_ROWS.map((row, rIdx) => (
                <div key={rIdx} className="flex items-center justify-center gap-1.5">
                  {row.map((letter) => {
                    const used = myProgress?.guessedLetters.includes(letter) ?? false;
                    const isHit = used && myMask.includes(letter);
                    return (
                      <button
                        key={letter}
                        type="button"
                        disabled={used || state.status !== 'playing' || myProgress?.eliminated}
                        onClick={() => submitLetter(letter)}
                        className={`min-w-[32px] sm:min-w-[44px] min-h-[44px] px-2 rounded-lg font-mono-num font-bold text-sm sm:text-base transition-transform active:translate-y-0.5 cursor-pointer ${
                          isHit
                            ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 text-white border border-emerald-300/60 shadow-[0_3px_0_#064e3b,0_4px_8px_rgba(0,0,0,0.5)]'
                            : used
                            ? 'bg-rose-950/60 text-rose-300/55 border border-rose-500/20 cursor-not-allowed shadow-inner'
                            : 'bg-gradient-to-b from-[#333c38] to-[#202623] hover:from-[#3d4843] hover:to-[#272f2b] text-[#f4f1ea] border border-white/15 shadow-[0_3px_0_#0d110f,0_4px_10px_rgba(0,0,0,0.55)]'
                        }`}
                      >
                        {letter}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* End State Modal */}
            {state.status === 'finished' && (
              <div className="absolute inset-0 bg-black/75 flex items-center justify-center p-4 z-20">
                <div className="w-full max-w-sm bg-[#141b18] border border-white/15 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
                  <Trophy className="w-10 h-10 text-amber-400 mx-auto" />
                  <div>
                    <h3 className="text-xl font-bold text-[#f4f1ea]">
                      {state.winnerId === localPlayer.id ? 'Word Solved!' : 'Round Complete'}
                    </h3>
                    <p className="text-sm text-emerald-300 font-mono-num font-bold mt-1">
                      Word: {state.secretWord}
                    </p>
                    <p className="text-xs text-stone-400 mt-1">{state.lastActionText}</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {mode === 'ai' && (
                      <button
                        type="button"
                        onClick={() => handleRestartAi(category)}
                        className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Next Word
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onExit}
                      className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-stone-100 text-sm font-semibold cursor-pointer"
                    >
                      Exit Table
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
