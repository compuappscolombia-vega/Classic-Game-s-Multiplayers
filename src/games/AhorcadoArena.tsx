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
      {/* Timber frame */}
      <line x1="20" y1="185" x2="110" y2="185" stroke="#D6D3D1" strokeWidth="5" strokeLinecap="round" />
      <line x1="48" y1="185" x2="48" y2="20" stroke="#D6D3D1" strokeWidth="5" strokeLinecap="round" />
      <line x1="48" y1="20" x2="122" y2="20" stroke="#D6D3D1" strokeWidth="5" strokeLinecap="round" />
      <line x1="48" y1="48" x2="76" y2="20" stroke="#A8A29E" strokeWidth="4" strokeLinecap="round" />
      <line x1="122" y1="20" x2="122" y2="44" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />

      {/* 1. Head */}
      {wrongCount >= 1 && (
        <circle cx="122" cy="60" r="16" fill="none" stroke="#F4F1EA" strokeWidth="3.5" />
      )}
      {/* 2. Torso */}
      {wrongCount >= 2 && (
        <line x1="122" y1="76" x2="122" y2="126" stroke="#F4F1EA" strokeWidth="3.5" strokeLinecap="round" />
      )}
      {/* 3. Left Arm */}
      {wrongCount >= 3 && (
        <line x1="122" y1="88" x2="98" y2="110" stroke="#F4F1EA" strokeWidth="3.5" strokeLinecap="round" />
      )}
      {/* 4. Right Arm */}
      {wrongCount >= 4 && (
        <line x1="122" y1="88" x2="146" y2="110" stroke="#F4F1EA" strokeWidth="3.5" strokeLinecap="round" />
      )}
      {/* 5. Left Leg */}
      {wrongCount >= 5 && (
        <line x1="122" y1="126" x2="102" y2="158" stroke="#F4F1EA" strokeWidth="3.5" strokeLinecap="round" />
      )}
      {/* 6. Right Leg + expression */}
      {wrongCount >= 6 && (
        <>
          <line x1="122" y1="126" x2="142" y2="158" stroke="#F4F1EA" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M116 55 L120 59 M120 55 L116 59 M124 55 L128 59 M128 55 L124 59" stroke="#FB7185" strokeWidth="2" />
        </>
      )}
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
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[#141b18] border border-white/10">
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

      {/* Main Chalkboard Arena */}
      <div className="flex-1 rounded-2xl bg-[#161e1b] border border-white/10 p-4 sm:p-6 flex flex-col justify-between gap-5 relative overflow-hidden">
        {/* Opponent Race Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {Object.values(state.progress).map((pr) => {
            const mask = state.revealedMask[pr.playerId] || [];
            const foundCount = mask.filter(Boolean).length;
            return (
              <div
                key={pr.playerId}
                className={`px-3 py-2 rounded-xl border ${
                  pr.playerId === localPlayer.id
                    ? 'bg-emerald-500/10 border-emerald-400/40'
                    : 'bg-black/25 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#f4f1ea] truncate">
                    {playerNames[pr.playerId] || 'Player'}
                  </span>
                  <span className="font-mono-num text-stone-400">
                    {foundCount}/{state.wordLength} · {pr.wrongCount}/{state.maxWrong} misses
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Gallows + Secret Word Slots */}
        <div className="flex flex-col items-center justify-center gap-5">
          <GallowsSvg wrongCount={myProgress?.wrongCount || 0} />

          {showHint && (
            <p className="text-sm text-amber-200 bg-amber-500/10 border border-amber-400/25 px-4 py-2 rounded-xl text-center max-w-lg">
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
                  className={`w-10 h-12 sm:w-12 sm:h-14 rounded-xl border-b-4 flex items-center justify-center text-xl sm:text-2xl font-display font-extrabold transition-transform duration-150 ${
                    revealed
                      ? missedReveal
                        ? 'bg-rose-950/60 border-rose-500 text-rose-300'
                        : 'bg-[#faf6ee] border-stone-400 text-stone-900 shadow-md'
                      : 'bg-black/35 border-stone-500/60 text-transparent'
                  }`}
                >
                  {revealed || '_'}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tactile >=44px On-Screen Keyboard */}
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
                    className={`min-w-[32px] sm:min-w-[44px] min-h-[44px] px-2 rounded-lg font-mono-num font-bold text-sm sm:text-base transition-transform active:scale-95 cursor-pointer ${
                      isHit
                        ? 'bg-emerald-600 text-white border border-emerald-400'
                        : used
                        ? 'bg-rose-950/60 text-rose-300/60 border border-rose-500/20 cursor-not-allowed'
                        : 'bg-[#232d29] hover:bg-[#2d3a35] text-[#f4f1ea] border border-white/12'
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
  );
}
