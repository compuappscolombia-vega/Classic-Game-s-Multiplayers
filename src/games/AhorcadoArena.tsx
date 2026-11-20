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

function Gallows3DStage({ wrongCount }: { wrongCount: number }) {
  return (
    <div className="relative px-6 py-4 rounded-2xl bg-gradient-to-b from-[#0b100e]/90 to-[#060908]/95 border border-amber-500/25 shadow-[inset_0_4px_18px_rgba(0,0,0,0.85),0_16px_30px_rgba(0,0,0,0.65)]">
      <svg
        viewBox="0 0 220 220"
        className="w-44 h-48 sm:w-52 sm:h-56 mx-auto"
        aria-label={`Hangman gallows with ${wrongCount} of 6 misses`}
      >
        <defs>
          {/* Warm overhead salon spotlight cone */}
          <radialGradient id="stageSpotlight" cx="56%" cy="18%" r="72%">
            <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.22" />
            <stop offset="55%" stopColor="#D97706" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          {/* 3D Oak Timber Gradients */}
          <linearGradient id="timberVert3d" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#B87D44" />
            <stop offset="35%" stopColor="#7C4B21" />
            <stop offset="100%" stopColor="#2F1807" />
          </linearGradient>
          <linearGradient id="timberHoriz3d" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#C4894D" />
            <stop offset="45%" stopColor="#7F4C22" />
            <stop offset="100%" stopColor="#2D1606" />
          </linearGradient>
          {/* Braided Hemp Rope Gradient */}
          <linearGradient id="hempRope3d" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="48%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#78350F" />
          </linearGradient>
          {/* Volumetric Carved Ivory Mannequin Gradients */}
          <radialGradient id="figureHead3d" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#FFFDF8" />
            <stop offset="45%" stopColor="#E9DABF" />
            <stop offset="88%" stopColor="#9C8462" />
            <stop offset="100%" stopColor="#5C4930" />
          </radialGradient>
          <linearGradient id="figureLimb3d" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFDF8" />
            <stop offset="50%" stopColor="#DECBAE" />
            <stop offset="100%" stopColor="#8B7352" />
          </linearGradient>
          <filter id="gallows3dShadow" x="-25%" y="-20%" width="150%" height="150%">
            <feDropShadow dx="4" dy="8" stdDeviation="4" floodColor="#000000" floodOpacity="0.72" />
          </filter>
        </defs>

        {/* Overhead Lamp Cone & Floor Platform Shadow */}
        <ellipse cx="118" cy="105" rx="96" ry="96" fill="url(#stageSpotlight)" />
        <ellipse cx="110" cy="201" rx="76" ry="11" fill="#000000" fillOpacity="0.65" />

        {/* 3D Timber Platform, Post, Crossbeam, Diagonal Brace, Forged Iron Brackets */}
        <g filter="url(#gallows3dShadow)">
          {/* 3D Extruded Oak Base */}
          <rect x="20" y="186" width="130" height="14" rx="4" fill="url(#timberHoriz3d)" stroke="#1E0E04" strokeWidth="1.5" />
          <rect x="26" y="181" width="118" height="6" rx="2" fill="#A66E38" stroke="#2D1606" strokeWidth="1" />

          {/* Vertical Timber Post */}
          <rect x="46" y="18" width="14" height="168" rx="3" fill="url(#timberVert3d)" stroke="#1E0E04" strokeWidth="1.5" />
          {/* Top Crossbeam */}
          <rect x="42" y="16" width="112" height="14" rx="3" fill="url(#timberHoriz3d)" stroke="#1E0E04" strokeWidth="1.5" />
          {/* Angled Timber Support Brace */}
          <polygon points="60,64 60,48 92,30 104,30" fill="url(#timberHoriz3d)" stroke="#1E0E04" strokeWidth="1.5" />

          {/* Forged Iron Corner Straps & Brass Rivets */}
          <path d="M46 18 H68 V34 H58 V28 H46 Z" fill="#27272A" stroke="#52525B" strokeWidth="1" />
          <circle cx="53" cy="23" r="2.3" fill="#FBBF24" />
          <circle cx="62" cy="23" r="1.8" fill="#FBBF24" />
          <circle cx="142" cy="23" r="2.3" fill="#FBBF24" />

          {/* Braided Rope & Coiled Knot */}
          <line x1="142" y1="30" x2="142" y2="54" stroke="url(#hempRope3d)" strokeWidth="5.5" strokeLinecap="round" />
          <rect x="137" y="42" width="10" height="4" rx="2" fill="#B45309" stroke="#451A03" strokeWidth="1" />
          <rect x="137" y="47" width="10" height="4" rx="2" fill="#D97706" stroke="#451A03" strokeWidth="1" />
        </g>

        {/* Volumetric 3D Sculpted Ivory Figure */}
        <g filter="url(#gallows3dShadow)">
          {/* 1. 3D Sculpted Head */}
          {wrongCount >= 1 && (
            <g>
              <circle cx="142" cy="69" r="17" fill="url(#figureHead3d)" stroke="#4A3A25" strokeWidth="1.6" />
              <ellipse cx="136" cy="62" rx="5" ry="3" transform="rotate(-25 136 62)" fill="#FFFFFF" fillOpacity="0.6" />
            </g>
          )}
          {/* 2. Sculpted 3D Torso */}
          {wrongCount >= 2 && (
            <g>
              <rect x="134.5" y="85" width="15" height="50" rx="7.5" fill="url(#figureLimb3d)" stroke="#4A3A25" strokeWidth="1.5" />
              {/* Collar ring */}
              <ellipse cx="142" cy="87" rx="8" ry="3" fill="#B45309" />
            </g>
          )}
          {/* 3. Left Sculpted Arm */}
          {wrongCount >= 3 && (
            <g>
              <line x1="136" y1="95" x2="112" y2="122" stroke="#4A3A25" strokeWidth="10" strokeLinecap="round" />
              <line x1="136" y1="95" x2="112" y2="122" stroke="url(#figureLimb3d)" strokeWidth="7.5" strokeLinecap="round" />
            </g>
          )}
          {/* 4. Right Sculpted Arm */}
          {wrongCount >= 4 && (
            <g>
              <line x1="148" y1="95" x2="172" y2="122" stroke="#4A3A25" strokeWidth="10" strokeLinecap="round" />
              <line x1="148" y1="95" x2="172" y2="122" stroke="url(#figureLimb3d)" strokeWidth="7.5" strokeLinecap="round" />
            </g>
          )}
          {/* 5. Left Sculpted Leg */}
          {wrongCount >= 5 && (
            <g>
              <line x1="138" y1="132" x2="118" y2="170" stroke="#4A3A25" strokeWidth="11" strokeLinecap="round" />
              <line x1="138" y1="132" x2="118" y2="170" stroke="url(#figureLimb3d)" strokeWidth="8.5" strokeLinecap="round" />
            </g>
          )}
          {/* 6. Right Sculpted Leg + Final Expression */}
          {wrongCount >= 6 && (
            <g>
              <line x1="146" y1="132" x2="166" y2="170" stroke="#4A3A25" strokeWidth="11" strokeLinecap="round" />
              <line x1="146" y1="132" x2="166" y2="170" stroke="url(#figureLimb3d)" strokeWidth="8.5" strokeLinecap="round" />
              <path d="M135 65 L139 69 M139 65 L135 69 M145 65 L149 69 M149 65 L145 69" stroke="#BE123C" strokeWidth="2.4" strokeLinecap="round" />
            </g>
          )}
        </g>
      </svg>
    </div>
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
      <div className="surface-3d-panel flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExit}
            className="min-h-[40px] px-3 rounded-lg bg-white/8 hover:bg-white/14 border border-white/10 text-xs font-medium text-stone-200 flex items-center gap-1.5 cursor-pointer"
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

      {/* Main Oak Tabletop -> 3D Mahogany Frame -> Brass Bezel -> Slate Stage */}
      <div className="flex-1 wood-tabletop tabletop-3d-stage rounded-2xl p-2.5 sm:p-4 border border-amber-900/45 flex flex-col">
        <div className="flex-1 tabletop-3d-cabinet rounded-2xl p-2.5 sm:p-4 flex flex-col">
          <div className="p-[2px] rounded-xl brass-bezel flex-1 flex flex-col">
            <div className="flex-1 rounded-[10px] slate-chalkboard border border-stone-900 p-4 sm:p-6 flex flex-col justify-between gap-5 relative overflow-hidden">
              {/* Opponent Race Bars */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {Object.values(state.progress).map((pr) => {
                  const mask = state.revealedMask[pr.playerId] || [];
                  const foundCount = mask.filter(Boolean).length;
                  return (
                    <div
                      key={pr.playerId}
                      className={`px-3 py-2.5 rounded-xl border shadow-md ${
                        pr.playerId === localPlayer.id
                          ? 'bg-emerald-500/15 border-emerald-400/50'
                          : 'bg-black/40 border-white/12'
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

              {/* 3D Illuminated Gallows + Carved Ivory Word Tiles */}
              <div className="flex flex-col items-center justify-center gap-5">
                <Gallows3DStage wrongCount={myProgress?.wrongCount || 0} />

                {showHint && (
                  <p className="text-sm text-amber-200 bg-amber-500/15 border border-amber-400/35 px-4 py-2 rounded-xl text-center max-w-lg shadow-lg">
                    Clue: {state.hint}
                  </p>
                )}

                <div className="walnut-trim px-4 py-3 rounded-2xl border border-amber-500/20 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
                  {myMask.map((ch, idx) => {
                    const revealed = ch || (state.status === 'finished' ? state.secretWord[idx] : '');
                    const missedReveal = !ch && state.status === 'finished';
                    return (
                      <div
                        key={idx}
                        className={`w-10 h-12 sm:w-12 sm:h-14 rounded-xl flex items-center justify-center text-xl sm:text-2xl font-display font-extrabold transition-transform duration-150 ${
                          revealed
                            ? missedReveal
                              ? 'bg-gradient-to-b from-rose-800 to-rose-950 border-2 border-rose-400 text-rose-100 shadow-[0_5px_0_#4c0519,0_8px_14px_rgba(0,0,0,0.65)]'
                              : 'ivory-tile-3d border border-[#b9a585] text-[#1e1712]'
                            : 'bg-black/55 border-2 border-[#4a3423] shadow-[inset_0_4px_10px_rgba(0,0,0,0.85)] text-transparent'
                        }`}
                      >
                        {revealed || '_'}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tactile 3D Mechanical Typewriter Keycaps */}
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
                          className={`min-w-[32px] sm:min-w-[44px] min-h-[44px] px-2 rounded-lg font-mono-num font-bold text-sm sm:text-base transition-transform cursor-pointer ${
                            isHit
                              ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 text-white border border-emerald-300/70 shadow-[0_4px_0_#064e3b,0_6px_12px_rgba(0,0,0,0.55)]'
                              : used
                              ? 'bg-rose-950/65 text-rose-300/50 border border-rose-500/20 cursor-not-allowed shadow-inner translate-y-[2px]'
                              : 'keycap-3d text-[#f4f1ea] border border-white/15 hover:brightness-115'
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
                  <div className="w-full max-w-sm surface-3d-panel rounded-2xl p-6 text-center space-y-4">
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
    </div>
  );
}
