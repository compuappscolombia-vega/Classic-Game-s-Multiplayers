import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, RotateCcw, Trophy, Layers, SkipForward } from 'lucide-react';
import {
  applyDominoPlay,
  chooseAiDominoAction,
  createDominoGame,
  drawDominoFromBoneyard,
  getPlayableDominoMoves,
  passDominoTurn,
} from '../shared/dominoEngine.ts';
import type { DominoState, DominoTile, GameMode, Language, PlayerInfo } from '../shared/types.ts';
import { audioVoice } from '../lib/audioVoice.ts';

interface DominoArenaProps {
  mode: GameMode;
  language: Language;
  localPlayer: PlayerInfo;
  players: PlayerInfo[];
  onlineState?: DominoState;
  onOnlineAction?: (action: Record<string, unknown>) => void;
  onMatchFinished: (outcome: 'win' | 'loss' | 'draw', score: number) => void;
  onExit: () => void;
}

const PIP_COORDS: Record<number, [number, number][]> = {
  0: [],
  1: [[50, 50]],
  2: [[27, 27], [73, 73]],
  3: [[27, 27], [50, 50], [73, 73]],
  4: [[27, 27], [73, 27], [27, 73], [73, 73]],
  5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
  6: [[27, 23], [73, 23], [27, 50], [73, 50], [27, 77], [73, 77]],
};

function PipFace({ value, size = 36 }: { value: number; size?: number }) {
  const pips = PIP_COORDS[value] || [];
  const pipFill =
    value === 6
      ? '#9F1239'
      : value === 5
      ? '#1D4ED8'
      : value === 4
      ? '#065F46'
      : value === 3
      ? '#B45309'
      : '#1B140F';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0" aria-hidden="true">
      {pips.map(([cx, cy], idx) => (
        <g key={idx}>
          {/* Recessed bevel rim */}
          <circle cx={cx} cy={cy + 2.4} r={11.8} fill="#FFFDF8" opacity="0.72" />
          <circle cx={cx} cy={cy - 1.2} r={11.4} fill="#8D7656" opacity="0.52" />
          {/* Glossy colored enamel pip */}
          <circle cx={cx} cy={cy} r={10.5} fill={pipFill} />
          <circle cx={cx - 2.6} cy={cy - 2.6} r={3.1} fill="#FFFFFF" opacity="0.32" />
        </g>
      ))}
    </svg>
  );
}

function DominoPiece({
  a,
  b,
  horizontal = false,
  playable = false,
  selected = false,
  compact = false,
  onClick,
}: {
  a: number;
  b: number;
  horizontal?: boolean;
  playable?: boolean;
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  const faceSize = compact ? 30 : 40;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-xl ivory-tile-3d border transition-transform duration-150 flex items-center justify-center select-none relative ${
        horizontal ? 'flex-row px-2.5 py-1.5 gap-2' : 'flex-col py-2.5 px-2 gap-1.5'
      } ${
        selected
          ? 'border-amber-300 -translate-y-3 scale-[1.04] ring-2 ring-amber-400/80 cursor-pointer'
          : playable
          ? 'border-emerald-400 hover:-translate-y-2 ring-2 ring-emerald-400/55 cursor-pointer'
          : onClick
          ? 'border-[#b9a585] opacity-60 cursor-not-allowed'
          : 'border-[#c8b698] cursor-default'
      }`}
      aria-label={`Domino ${a}-${b}`}
    >
      {/* Subtle carved inner ivory face rim */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[3px] rounded-[9px] border border-[#b59d78]/45"
      />
      <PipFace value={a} size={faceSize} />
      <div className="relative flex items-center justify-center">
        <div
          className={
            horizontal
              ? 'w-[2.5px] h-7 bg-gradient-to-b from-[#6e5a40] to-[#3f3120] rounded-full shadow-[1px_0_0_rgba(255,255,255,0.65)]'
              : 'h-[2.5px] w-7 bg-gradient-to-r from-[#6e5a40] to-[#3f3120] rounded-full shadow-[0_1px_0_rgba(255,255,255,0.65)]'
          }
        />
        <span
          className="absolute w-2.5 h-2.5 rounded-full border border-[#6e4914]/80 shadow"
          style={{
            background: 'radial-gradient(circle at 30% 30%, #fef9c3 0%, #eab308 55%, #78350f 100%)',
          }}
        />
      </div>
      <PipFace value={b} size={faceSize} />
    </button>
  );
}

export function DominoArena({
  mode,
  language,
  localPlayer,
  players,
  onlineState,
  onOnlineAction,
  onMatchFinished,
  onExit,
}: DominoArenaProps) {
  const aiPlayers = useMemo<PlayerInfo[]>(() => {
    if (mode === 'online') return players;
    return [
      localPlayer,
      { id: 'ai_mateo', name: 'Mateo (IA)', avatarUrl: '', elo: 1140, isAi: true },
      { id: 'ai_sofia', name: 'Sofía (IA)', avatarUrl: '', elo: 1210, isAi: true },
      { id: 'ai_lucas', name: 'Lucas (IA)', avatarUrl: '', elo: 1090, isAi: true },
    ];
  }, [mode, localPlayer, players]);

  const playerMap = useMemo(() => {
    const map: Record<string, PlayerInfo> = {};
    for (const p of aiPlayers) map[p.id] = p;
    return map;
  }, [aiPlayers]);

  const playerNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of aiPlayers) map[p.id] = p.name;
    return map;
  }, [aiPlayers]);

  const [localState, setLocalState] = useState<DominoState>(() =>
    createDominoGame(
      aiPlayers.map((p) => p.id),
      playerNames
    )
  );
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const reportedRef = useRef(false);

  const state = mode === 'online' && onlineState ? onlineState : localState;
  const activePlayerId = state.turnOrder[state.currentTurnIndex];
  const isMyTurn = activePlayerId === localPlayer.id && !state.winnerId;
  const myHand: DominoTile[] = state.hands[localPlayer.id] || [];

  const playableMoves = useMemo(
    () => (isMyTurn ? getPlayableDominoMoves(myHand, state.leftEnd, state.rightEnd) : []),
    [isMyTurn, myHand, state.leftEnd, state.rightEnd]
  );

  const playableTileIds = useMemo(
    () => new Set(playableMoves.map((m) => m.tileId)),
    [playableMoves]
  );

  const selectedSides = useMemo(() => {
    if (!selectedTileId) return [];
    return playableMoves.filter((m) => m.tileId === selectedTileId).map((m) => m.side);
  }, [selectedTileId, playableMoves]);

  // Announce victory once
  useEffect(() => {
    if (state.winnerId && !reportedRef.current) {
      reportedRef.current = true;
      const won = state.winnerId === localPlayer.id;
      const winnerName = playerNames[state.winnerId] || 'Player';
      const score = state.scores[localPlayer.id] || (won ? 40 : 0);
      audioVoice.playVictoryFanfare();
      audioVoice.speak(
        language === 'es'
          ? `¡Dominó! ${winnerName} gana la ronda.`
          : `Domino! ${winnerName} wins the round.`,
        language
      );
      onMatchFinished(won ? 'win' : 'loss', score);
    }
  }, [state.winnerId, state.scores, localPlayer.id, playerNames, language, onMatchFinished]);

  // Offline AI turn loop
  useEffect(() => {
    if (mode !== 'ai' || state.winnerId) return;
    const current = playerMap[activePlayerId];
    if (!current?.isAi) return;

    const timer = setTimeout(() => {
      const decision = chooseAiDominoAction(state, current.id);
      if (decision.action === 'play') {
        audioVoice.playDominoClack();
        setLocalState((prev) =>
          applyDominoPlay(prev, current.id, decision.tileId, decision.side, current.name)
        );
      } else if (decision.action === 'draw') {
        audioVoice.playTone(340, 0.06, 'sine', 0.08);
        setLocalState((prev) => drawDominoFromBoneyard(prev, current.id, current.name));
      } else {
        audioVoice.playTone(220, 0.08, 'triangle', 0.07);
        setLocalState((prev) => passDominoTurn(prev, current.id, current.name));
      }
    }, 750);

    return () => clearTimeout(timer);
  }, [mode, state, activePlayerId, playerMap]);

  const executePlay = (tileId: string, side: 'left' | 'right') => {
    audioVoice.playDominoClack();
    setSelectedTileId(null);
    if (mode === 'online' && onOnlineAction) {
      onOnlineAction({ kind: 'play', tileId, side });
    } else {
      setLocalState((prev) => applyDominoPlay(prev, localPlayer.id, tileId, side, localPlayer.name));
    }
  };

  const handleTileClick = (tileId: string) => {
    if (!isMyTurn || !playableTileIds.has(tileId)) return;
    const sides = playableMoves.filter((m) => m.tileId === tileId).map((m) => m.side);
    if (sides.length === 1 || state.board.length === 0) {
      executePlay(tileId, sides[0] || 'right');
    } else {
      setSelectedTileId((prev) => (prev === tileId ? null : tileId));
    }
  };

  const handleDraw = () => {
    if (!isMyTurn || state.boneyardCount === 0) return;
    audioVoice.playTone(360, 0.06, 'sine', 0.08);
    if (mode === 'online' && onOnlineAction) {
      onOnlineAction({ kind: 'draw' });
    } else {
      setLocalState((prev) => drawDominoFromBoneyard(prev, localPlayer.id, localPlayer.name));
    }
  };

  const handlePass = () => {
    if (!isMyTurn) return;
    audioVoice.playTone(210, 0.08, 'triangle', 0.07);
    if (mode === 'online' && onOnlineAction) {
      onOnlineAction({ kind: 'pass' });
    } else {
      setLocalState((prev) => passDominoTurn(prev, localPlayer.id, localPlayer.name));
    }
  };

  const handleRestartAi = () => {
    reportedRef.current = false;
    setSelectedTileId(null);
    setLocalState(
      createDominoGame(
        aiPlayers.map((p) => p.id),
        playerNames
      )
    );
    audioVoice.speak(
      language === 'es' ? 'Nueva ronda de dominó.' : 'New Domino round started.',
      language
    );
  };

  const opponents = state.turnOrder.filter((id) => id !== localPlayer.id);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Compact Perimeter HUD */}
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
            <h2 className="text-base font-bold text-[#f4f1ea]">Dominó Clásico</h2>
            <p className="text-xs text-stone-400">{state.lastActionText}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono-num">
          <span className="text-stone-300">Boneyard: {state.boneyardCount}</span>
          <span className="text-amber-300 font-semibold">
            Turn: {playerNames[activePlayerId] || 'Player'}
          </span>
        </div>
      </div>

      {/* 3D Perspective Salon Table -> Extruded Mahogany Cabinet -> Brass Bezel -> Overhead Lit Felt Baize */}
      <div className="flex-1 min-h-[480px] wood-tabletop tabletop-3d-stage rounded-2xl p-2.5 sm:p-4 border border-amber-900/45 flex flex-col">
        <div className="flex-1 rounded-2xl tabletop-3d-cabinet p-2.5 sm:p-4 flex flex-col relative">
          <div className="p-[2px] rounded-xl brass-bezel flex-1 flex flex-col">
            <div className="flex-1 rounded-[10px] baize-felt-hd border border-emerald-950/90 p-3 sm:p-5 flex flex-col justify-between gap-4 relative overflow-hidden">
              {/* Opponents 3D Seated Racks */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {opponents.map((oppId) => {
                  const p = playerMap[oppId];
                  const isTurn = activePlayerId === oppId && !state.winnerId;
                  const count = state.handCounts[oppId] ?? 0;
                  return (
                    <div
                      key={oppId}
                      className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 transition-colors shadow-lg ${
                        isTurn
                          ? 'bg-gradient-to-b from-amber-500/25 to-amber-900/30 border-amber-300/70'
                          : 'bg-black/45 border-white/12'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#f4f1ea] truncate">
                          {p?.name || 'Opponent'}
                        </div>
                        <div className="text-[11px] text-stone-300">
                          {isTurn ? 'Thinking...' : 'Seated'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex -space-x-1.5" aria-hidden="true">
                          {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
                            <span
                              key={i}
                              className="w-3 h-5 rounded-[3px] ivory-tile-3d-back border border-amber-400/35"
                            />
                          ))}
                        </div>
                        <span className="font-mono-num text-xs font-bold text-amber-200">
                          {count}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Center 3D Domino Chain + Stacked Visual Boneyard */}
              <div className="flex-1 flex flex-col items-center justify-center gap-3 min-h-[195px] relative">
                {state.boneyardCount > 0 && (
                  <div
                    className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-black/35 border border-amber-400/20 shadow-lg self-end"
                    title="Remaining Boneyard Stack"
                  >
                    <div className="flex -space-x-2" aria-hidden="true">
                      {Array.from({ length: Math.min(state.boneyardCount, 4) }).map((_, i) => (
                        <span
                          key={i}
                          className="w-4 h-7 rounded-[4px] ivory-tile-3d border border-[#9f8965]"
                        />
                      ))}
                    </div>
                    <span className="text-[11px] font-mono-num text-amber-200">
                      {state.boneyardCount}
                    </span>
                  </div>
                )}

                {state.board.length === 0 ? (
                  <div className="text-center space-y-1.5 py-6">
                    <p className="text-sm font-medium text-emerald-100/90 drop-shadow">
                      Table is open — select any 3D ivory tile in your rack to start the chain
                    </p>
                    <p className="text-xs text-emerald-200/60">Double-Six opens in classic play</p>
                  </div>
                ) : (
                  <div className="w-full flex flex-wrap items-center justify-center gap-2.5 max-h-[260px] overflow-y-auto p-3">
                    {selectedSides.includes('left') && (
                      <button
                        type="button"
                        onClick={() => selectedTileId && executePlay(selectedTileId, 'left')}
                        className="min-h-[44px] px-3.5 py-2 rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-stone-950 text-xs font-bold cursor-pointer shadow-[0_4px_0_#78350f,0_8px_16px_rgba(0,0,0,0.6)]"
                      >
                        Place Left ({state.leftEnd})
                      </button>
                    )}

                    {state.board.map((placed) => (
                      <DominoPiece
                        key={placed.id}
                        a={placed.left}
                        b={placed.right}
                        horizontal={!placed.isDouble}
                        compact
                      />
                    ))}

                    {selectedSides.includes('right') && (
                      <button
                        type="button"
                        onClick={() => selectedTileId && executePlay(selectedTileId, 'right')}
                        className="min-h-[44px] px-3.5 py-2 rounded-lg bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-stone-950 text-xs font-bold cursor-pointer shadow-[0_4px_0_#78350f,0_8px_16px_rgba(0,0,0,0.6)]"
                      >
                        Place Right ({state.rightEnd})
                      </button>
                    )}
                  </div>
                )}

                {state.leftEnd !== null && state.rightEnd !== null && (
                  <div className="flex items-center gap-4 text-xs font-mono-num text-emerald-100/90 drop-shadow">
                    <span>Left End: {state.leftEnd}</span>
                    <span aria-hidden="true">·</span>
                    <span>Right End: {state.rightEnd}</span>
                  </div>
                )}
              </div>

              {/* Recessed 3D Walnut Tile Rack & Actions */}
              <div className="walnut-trim border border-amber-500/25 rounded-xl p-3.5 sm:p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-[#f4f1ea]">
                    Your Hand ({myHand.length} tiles) ·{' '}
                    <span className={isMyTurn ? 'text-emerald-300' : 'text-stone-400'}>
                      {isMyTurn ? 'Your Turn — tap a highlighted tile' : 'Waiting for turn'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!isMyTurn || playableMoves.length > 0 || state.boneyardCount === 0}
                      onClick={handleDraw}
                      className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-gradient-to-b from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 disabled:opacity-35 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-[0_3px_0_#78350f]"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Draw ({state.boneyardCount})
                    </button>

                    <button
                      type="button"
                      disabled={!isMyTurn || playableMoves.length > 0 || state.boneyardCount > 0}
                      onClick={handlePass}
                      className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-35 text-stone-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                      Pass
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1 pb-1">
                  {myHand.map((t) => {
                    const canPlay = isMyTurn && playableTileIds.has(t.id);
                    return (
                      <DominoPiece
                        key={t.id}
                        a={t.a}
                        b={t.b}
                        playable={canPlay}
                        selected={selectedTileId === t.id}
                        onClick={() => handleTileClick(t.id)}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Victory / Round Summary Modal */}
              {state.winnerId && (
                <div className="absolute inset-0 bg-black/75 flex items-center justify-center p-4 z-20">
                  <div className="w-full max-w-sm surface-3d-panel rounded-2xl p-6 text-center space-y-4">
                    <Trophy className="w-10 h-10 text-amber-400 mx-auto" />
                    <div>
                      <h3 className="text-xl font-bold text-[#f4f1ea]">
                        {state.winnerId === localPlayer.id
                          ? 'Victory!'
                          : `${playerNames[state.winnerId] || 'Opponent'} Wins`}
                      </h3>
                      <p className="text-xs text-stone-400 mt-1">{state.lastActionText}</p>
                    </div>

                    <div className="space-y-1.5 text-sm border-y border-white/10 py-3">
                      {state.turnOrder.map((pid) => (
                        <div key={pid} className="flex items-center justify-between">
                          <span className="text-stone-300">{playerNames[pid]}</span>
                          <span className="font-mono-num font-bold text-emerald-300">
                            {state.scores[pid] || 0} pts
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2.5">
                      {mode === 'ai' && (
                        <button
                          type="button"
                          onClick={handleRestartAi}
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
      </div>
    </div>
  );
}
