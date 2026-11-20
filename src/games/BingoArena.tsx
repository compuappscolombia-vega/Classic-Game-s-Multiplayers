import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import {
  claimBingoWin,
  createBingoGame,
  daubBingoCell,
  drawNextBingoBall,
  formatBingoBall,
  verifyBingoPattern,
} from '../shared/bingoEngine.ts';
import type {
  BingoPattern,
  BingoState,
  GameMode,
  Language,
  PlayerInfo,
} from '../shared/types.ts';
import { audioVoice } from '../lib/audioVoice.ts';

interface BingoArenaProps {
  mode: GameMode;
  language: Language;
  localPlayer: PlayerInfo;
  players: PlayerInfo[];
  onlineState?: BingoState;
  onOnlineAction?: (action: Record<string, unknown>) => void;
  onMatchFinished: (outcome: 'win' | 'loss' | 'draw', score: number) => void;
  onExit: () => void;
}

const HEADERS = ['B', 'I', 'N', 'G', 'O'];

function getBallColor(num: number): string {
  if (num <= 15) return 'bg-rose-600 border-rose-300/80';
  if (num <= 30) return 'bg-blue-600 border-blue-300/80';
  if (num <= 45) return 'bg-amber-600 border-amber-200/80';
  if (num <= 60) return 'bg-emerald-600 border-emerald-300/80';
  return 'bg-indigo-600 border-indigo-300/80';
}

function BrassLotteryCage3D({ spinning }: { spinning: boolean }) {
  return (
    <svg viewBox="0 0 130 130" className="w-24 h-24 sm:w-28 sm:h-28 shrink-0" aria-hidden="true">
      <defs>
        <linearGradient id="brassStrut" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="45%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>
        <radialGradient id="glassSphereBg" cx="38%" cy="32%" r="65%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.24" />
          <stop offset="55%" stopColor="#0F4C36" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#041911" stopOpacity="0.88" />
        </radialGradient>
      </defs>

      {/* Mahogany Pedestal & Brass A-Frame Stand */}
      <rect x="20" y="114" width="90" height="10" rx="4" fill="#3D1C0B" stroke="#D97706" strokeWidth="1.5" />
      <line x1="34" y1="114" x2="22" y2="62" stroke="url(#brassStrut)" strokeWidth="4" strokeLinecap="round" />
      <line x1="96" y1="114" x2="108" y2="62" stroke="url(#brassStrut)" strokeWidth="4" strokeLinecap="round" />

      {/* Rotating Brass Wire Drum */}
      <g className={spinning ? 'lottery-cage-spin origin-[65px_62px]' : ''}>
        <circle cx="65" cy="62" r="39" fill="url(#glassSphereBg)" stroke="url(#brassStrut)" strokeWidth="3.2" />
        <ellipse cx="65" cy="62" rx="39" ry="15" fill="none" stroke="url(#brassStrut)" strokeWidth="1.8" opacity="0.7" />
        <ellipse cx="65" cy="62" rx="16" ry="39" fill="none" stroke="url(#brassStrut)" strokeWidth="1.8" opacity="0.7" />
        {/* Miniature colorful balls tumbling inside */}
        <circle cx="52" cy="70" r="6" fill="#E11D48" />
        <circle cx="67" cy="74" r="6" fill="#2563EB" />
        <circle cx="78" cy="65" r="6" fill="#D97706" />
        <circle cx="59" cy="56" r="5.5" fill="#10B981" />
        <circle cx="72" cy="51" r="5.5" fill="#6366F1" />
        {/* Glass specular glint */}
        <ellipse cx="50" cy="44" rx="11" ry="5" transform="rotate(-32 50 44)" fill="#FFFFFF" fillOpacity="0.4" />
      </g>

      {/* Crank Handle & Brass Axle Bearings */}
      <circle cx="22" cy="62" r="4.5" fill="#FBBF24" stroke="#451A03" strokeWidth="1.2" />
      <circle cx="108" cy="62" r="4.5" fill="#FBBF24" stroke="#451A03" strokeWidth="1.2" />
      <path d="M108 62 H119 V48" fill="none" stroke="url(#brassStrut)" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="119" cy="46" r="3.5" fill="#FEF08A" />
    </svg>
  );
}

export function BingoArena({
  mode,
  language,
  localPlayer,
  players,
  onlineState,
  onOnlineAction,
  onMatchFinished,
  onExit,
}: BingoArenaProps) {
  const [pattern, setPattern] = useState<BingoPattern>('line');
  const [autoDaub, setAutoDaub] = useState(false);

  const aiPlayers = useMemo<PlayerInfo[]>(() => {
    if (mode === 'online') return players;
    return [
      localPlayer,
      { id: 'ai_camila', name: 'Camila (IA)', avatarUrl: '', elo: 1150, isAi: true },
      { id: 'ai_diego', name: 'Diego (IA)', avatarUrl: '', elo: 1120, isAi: true },
    ];
  }, [mode, localPlayer, players]);

  const playerNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of aiPlayers) map[p.id] = p.name;
    return map;
  }, [aiPlayers]);

  const [localState, setLocalState] = useState<BingoState>(() =>
    createBingoGame(
      aiPlayers.map((p) => p.id),
      pattern
    )
  );
  const reportedRef = useRef(false);
  const lastAnnouncedBallRef = useRef<number | null>(null);

  const state = mode === 'online' && onlineState ? onlineState : localState;
  const myCardState = state.players[localPlayer.id];
  const calledSet = useMemo(() => new Set(state.calledNumbers), [state.calledNumbers]);

  // Voice Animate callout whenever a new ball drops
  useEffect(() => {
    if (state.currentBall && state.currentBall !== lastAnnouncedBallRef.current) {
      lastAnnouncedBallRef.current = state.currentBall;
      const formatted = formatBingoBall(state.currentBall);
      audioVoice.playBingoPop();
      audioVoice.speak(formatted.replace('-', ' '), language);

      if (autoDaub && myCardState && state.status === 'playing') {
        for (let r = 0; r < 5; r++) {
          for (let c = 0; c < 5; c++) {
            if (myCardState.card.grid[r][c] === state.currentBall && !myCardState.daubed[r][c]) {
              if (mode === 'online' && onOnlineAction) {
                onOnlineAction({ kind: 'daub', row: r, col: c });
              } else {
                setLocalState((prev) => daubBingoCell(prev, localPlayer.id, r, c));
              }
            }
          }
        }
      }
    }
  }, [state.currentBall, state.status, autoDaub, myCardState, mode, onOnlineAction, localPlayer.id, language]);

  // Offline AI Practice ball caller (every 2.8 seconds)
  useEffect(() => {
    if (mode !== 'ai' || state.status !== 'playing') return;
    const aiIds = aiPlayers.filter((p) => p.isAi).map((p) => p.id);
    const timer = setInterval(() => {
      setLocalState((prev) => drawNextBingoBall(prev, aiIds));
    }, 2800);
    return () => clearInterval(timer);
  }, [mode, state.status, aiPlayers]);

  // Victory report
  useEffect(() => {
    if (state.status === 'finished' && !reportedRef.current) {
      reportedRef.current = true;
      const won = state.winnerId === localPlayer.id;
      const winnerName = (state.winnerId && playerNames[state.winnerId]) || 'Player';
      audioVoice.playVictoryFanfare();
      audioVoice.speak(
        language === 'es'
          ? `¡Bingo! ${winnerName} ganó la partida.`
          : `Bingo! ${winnerName} wins the round!`,
        language
      );
      onMatchFinished(won ? 'win' : 'loss', won ? 120 : myCardState?.progressPct || 0);
    }
  }, [state.status, state.winnerId, localPlayer.id, playerNames, myCardState?.progressPct, language, onMatchFinished]);

  const canClaimNow = useMemo(() => {
    if (!myCardState || state.status !== 'playing') return false;
    return verifyBingoPattern(
      myCardState.card,
      myCardState.daubed,
      state.calledNumbers,
      state.pattern
    );
  }, [myCardState, state.status, state.calledNumbers, state.pattern]);

  const handleDaub = (r: number, c: number) => {
    if (!myCardState || state.status !== 'playing') return;
    const num = myCardState.card.grid[r][c];
    if (num !== 0 && !calledSet.has(num)) return;
    audioVoice.playKeyTap(true);
    if (mode === 'online' && onOnlineAction) {
      onOnlineAction({ kind: 'daub', row: r, col: c });
    } else {
      setLocalState((prev) => daubBingoCell(prev, localPlayer.id, r, c));
    }
  };

  const handleClaim = () => {
    if (state.status !== 'playing') return;
    if (mode === 'online' && onOnlineAction) {
      onOnlineAction({ kind: 'claim_bingo' });
    } else {
      setLocalState((prev) => claimBingoWin(prev, localPlayer.id, localPlayer.name));
    }
  };

  const handleRestartAi = (nextPattern: BingoPattern = pattern) => {
    reportedRef.current = false;
    lastAnnouncedBallRef.current = null;
    setPattern(nextPattern);
    setLocalState(
      createBingoGame(
        aiPlayers.map((p) => p.id),
        nextPattern
      )
    );
  };

  const recentBalls = state.calledNumbers.slice(-6).reverse();

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header HUD */}
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
            <h2 className="text-base font-bold text-[#f4f1ea]">Bingo 75 Caller</h2>
            <p className="text-xs text-stone-400">
              Pattern: <span className="uppercase text-amber-300 font-semibold">{state.pattern}</span> · {state.calledNumbers.length}/75 drawn
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mode === 'ai' && (
            <select
              value={pattern}
              onChange={(e) => handleRestartAi(e.target.value as BingoPattern)}
              className="min-h-[38px] px-2.5 rounded-lg bg-black/40 border border-white/10 text-xs text-stone-200"
            >
              <option value="line">Line (Row/Col/Diag)</option>
              <option value="corners">4 Corners</option>
              <option value="x">X Pattern</option>
              <option value="full">Blackout Full Card</option>
            </select>
          )}
          <button
            type="button"
            onClick={() => setAutoDaub((v) => !v)}
            className={`min-h-[38px] px-3 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
              autoDaub
                ? 'bg-emerald-600/25 border-emerald-400/50 text-emerald-200'
                : 'bg-white/5 border-white/10 text-stone-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Auto-Daub {autoDaub ? 'On' : 'Off'}
          </button>
        </div>
      </div>

      {/* Main Split: 3D Brass Lottery Cage & Ball Chute + Mahogany & Ivory 5x5 Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start flex-1">
        {/* Left 5 cols: 3D Brass Cage + Glossy Phenolic Sphere + Walnut Ball Chute */}
        <div className="lg:col-span-5 space-y-4">
          <div className="surface-3d-panel rounded-2xl p-5 flex flex-col items-center gap-4 text-center">
            <span className="text-xs text-stone-400">3D Brass Cage & Current Phenolic Ball</span>

            <div className="w-full baize-felt-hd rounded-2xl border border-amber-500/25 p-4 flex items-center justify-center gap-5 shadow-[inset_0_6px_18px_rgba(0,0,0,0.82)]">
              <BrassLotteryCage3D spinning={state.status === 'playing'} />

              {state.currentBall ? (
                <div className="relative p-2.5 rounded-full bg-black/35 border border-amber-400/35 shadow-[inset_0_4px_12px_rgba(0,0,0,0.85)]">
                  <div
                    className={`w-28 h-28 rounded-full border-2 lottery-ball-shine shadow-[0_14px_26px_rgba(0,0,0,0.8)] flex flex-col items-center justify-center text-white transition-transform duration-200 ${getBallColor(
                      state.currentBall
                    )}`}
                  >
                    <div className="w-16 h-16 rounded-full bg-gradient-to-b from-[#fffdf7] to-[#e0d2b4] border border-stone-400/70 shadow-inner flex flex-col items-center justify-center text-stone-900">
                      <span className="text-[10px] font-extrabold tracking-widest leading-none text-stone-600">
                        {formatBingoBall(state.currentBall).split('-')[0]}
                      </span>
                      <span className="text-2xl font-mono-num font-extrabold leading-none mt-0.5">
                        {state.currentBall}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-28 h-28 rounded-full border-2 border-dashed border-amber-400/35 flex items-center justify-center text-xs text-stone-300">
                  Spinning...
                </div>
              )}
            </div>

            <div className="w-full pt-3 border-t border-white/10">
              <div className="text-[11px] text-stone-400 mb-2">Walnut Ball Chute</div>
              <div className="walnut-trim rounded-xl p-2.5 border border-amber-900/60 flex flex-wrap items-center justify-center gap-2 min-h-[54px]">
                {recentBalls.length === 0 ? (
                  <span className="text-xs text-stone-400">Waiting for first draw</span>
                ) : (
                  recentBalls.map((b) => (
                    <span
                      key={b}
                      className={`w-10 h-10 rounded-full lottery-ball-shine text-[10px] font-mono-num font-extrabold text-white border flex items-center justify-center shadow-[0_5px_10px_rgba(0,0,0,0.68)] ${getBallColor(
                        b
                      )}`}
                    >
                      <span className="w-6 h-6 rounded-full bg-[#fffdf7]/92 text-stone-900 flex items-center justify-center leading-none">
                        {b}
                      </span>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="surface-3d-panel rounded-2xl p-4 space-y-2.5">
            <h3 className="text-xs font-semibold text-stone-400">Table Contenders</h3>
            {Object.values(state.players).map((ps) => (
              <div key={ps.playerId} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#f4f1ea]">
                    {playerNames[ps.playerId] || 'Player'}
                  </span>
                  <span className="font-mono-num text-amber-300">{ps.progressPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-black/50 border border-white/8 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-200"
                    style={{ width: `${ps.progressPct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 7 cols: Oak Tabletop -> 3D Mahogany Tray -> Brass Bezel -> Embossed Linen 5x5 Bingo Card */}
        <div className="lg:col-span-7 wood-tabletop tabletop-3d-stage p-3 sm:p-5 rounded-2xl border border-amber-900/45 flex flex-col items-center justify-center gap-4 relative">
          <div className="tabletop-3d-cabinet board-3d-tilt p-3 sm:p-4 rounded-2xl w-full max-w-[500px] flex flex-col items-center gap-4">
            <div className="p-[2px] rounded-xl brass-bezel w-full">
              <div className="baize-felt-hd w-full rounded-[10px] p-3 sm:p-4 border border-emerald-950/90 flex flex-col items-center gap-4">
                {myCardState && (
                  <div className="w-full ivory-tile-3d rounded-2xl p-3 sm:p-4 border border-[#bda782] space-y-2">
                    <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                      {HEADERS.map((h) => (
                        <div
                          key={h}
                          className="h-10 rounded-lg bg-gradient-to-b from-[#0f5b38] to-[#072c1a] border border-amber-300/45 text-amber-200 font-display font-extrabold text-xl flex items-center justify-center shadow-[0_3px_0_#041a0f]"
                        >
                          {h}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                      {myCardState.card.grid.map((row, r) =>
                        row.map((num, c) => {
                          const isFree = r === 2 && c === 2;
                          const daubed = myCardState.daubed[r][c];
                          const isCalled = isFree || calledSet.has(num);

                          return (
                            <button
                              key={`${r}-${c}`}
                              type="button"
                              onClick={() => handleDaub(r, c)}
                              disabled={!isCalled || daubed || state.status !== 'playing'}
                              className={`min-h-[54px] sm:min-h-[64px] rounded-xl border-2 font-mono-num font-bold text-lg sm:text-xl flex items-center justify-center relative transition-transform active:scale-95 ${
                                daubed
                                  ? 'bg-[#efe4ce] border-[#b79d76] text-stone-900 shadow-inner'
                                  : isCalled
                                  ? 'bg-amber-100 border-amber-500 text-stone-900 ring-2 ring-amber-400/70 cursor-pointer shadow-[0_3px_0_#b45309]'
                                  : 'bg-[#fffdf8] border-[#d7c6a9] text-stone-800 cursor-default shadow-[0_2px_0_#cbb693]'
                              }`}
                            >
                              <span className={daubed ? 'relative z-10 text-white drop-shadow' : ''}>
                                {isFree ? (
                                  <span className="text-[11px] font-display font-extrabold tracking-tight">
                                    FREE
                                  </span>
                                ) : (
                                  num
                                )}
                              </span>
                              {daubed && (
                                <span
                                  aria-hidden="true"
                                  className="absolute inset-1 rounded-full lottery-ball-shine bg-rose-600/92 border-2 border-rose-200/80 shadow-[0_5px_10px_rgba(0,0,0,0.55)]"
                                />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleClaim}
                  disabled={state.status !== 'playing'}
                  className={`w-full min-h-[50px] px-6 py-3 rounded-xl font-display font-extrabold text-lg tracking-wide flex items-center justify-center gap-2 transition-transform active:translate-y-0.5 cursor-pointer ${
                    canClaimNow
                      ? 'bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-stone-950 shadow-[0_4px_0_#78350f,0_10px_20px_rgba(0,0,0,0.6)]'
                      : 'bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white shadow-[0_4px_0_#064e3b,0_10px_20px_rgba(0,0,0,0.6)]'
                  }`}
                >
                  <Check className="w-5 h-5" />
                  Call BINGO!
                </button>
              </div>
            </div>
          </div>

          {state.status === 'finished' && (
            <div className="absolute inset-0 bg-black/75 rounded-2xl flex items-center justify-center p-4 z-20">
              <div className="w-full max-w-sm surface-3d-panel rounded-2xl p-6 text-center space-y-4">
                <Trophy className="w-10 h-10 text-amber-400 mx-auto" />
                <div>
                  <h3 className="text-xl font-bold text-[#f4f1ea]">
                    {state.winnerId === localPlayer.id
                      ? 'BINGO! You Won!'
                      : `${(state.winnerId && playerNames[state.winnerId]) || 'Opponent'} Called Bingo`}
                  </h3>
                  <p className="text-xs text-stone-400 mt-1">{state.lastActionText}</p>
                </div>

                <div className="flex items-center gap-2.5">
                  {mode === 'ai' && (
                    <button
                      type="button"
                      onClick={() => handleRestartAi(pattern)}
                      className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Play Again
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
  );
}
