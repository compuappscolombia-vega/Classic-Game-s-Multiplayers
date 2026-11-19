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
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

function PipFace({ value, size = 36 }: { value: number; size?: number }) {
  const pips = PIP_COORDS[value] || [];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0" aria-hidden="true">
      {pips.map(([cx, cy], idx) => (
        <circle
          key={idx}
          cx={cx}
          cy={cy}
          r={10.5}
          fill={value === 6 ? '#991B1B' : value === 5 ? '#1E3A8A' : '#1C1917'}
        />
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
  const faceSize = compact ? 30 : 38;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-lg bg-[#faf6ee] border-2 shadow-md transition-transform duration-150 flex items-center justify-center select-none ${
        horizontal ? 'flex-row px-1.5 py-1 gap-1' : 'flex-col py-1.5 px-1 gap-1'
      } ${
        selected
          ? 'border-amber-400 -translate-y-2 ring-2 ring-amber-400/50 cursor-pointer'
          : playable
          ? 'border-emerald-500 hover:-translate-y-1.5 cursor-pointer'
          : onClick
          ? 'border-stone-400/70 opacity-55 cursor-not-allowed'
          : 'border-stone-300 cursor-default'
      }`}
      aria-label={`Domino ${a}-${b}`}
    >
      <PipFace value={a} size={faceSize} />
      <div
        className={
          horizontal
            ? 'w-[2px] h-7 bg-stone-400/70 rounded-full'
            : 'h-[2px] w-7 bg-stone-400/70 rounded-full'
        }
      />
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
            <h2 className="text-base font-bold text-[#f4f1ea]">Dominó Clásico</h2>
            <p className="text-xs text-stone-400">{state.lastActionText}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono-num">
          <span className="text-stone-300">Boneyard: {state.boneyardCount}</span>
          <span className="text-emerald-400 font-semibold">
            Turn: {playerNames[activePlayerId] || 'Player'}
          </span>
        </div>
      </div>

      {/* Main Baize Table */}
      <div className="flex-1 min-h-[440px] rounded-2xl walnut-trim p-2.5 sm:p-4 flex flex-col">
        <div className="flex-1 rounded-xl baize-surface border border-emerald-950/80 p-3 sm:p-5 flex flex-col justify-between gap-4 relative overflow-hidden">
          {/* Opponents Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {opponents.map((oppId) => {
              const p = playerMap[oppId];
              const isTurn = activePlayerId === oppId && !state.winnerId;
              const count = state.handCounts[oppId] ?? 0;
              return (
                <div
                  key={oppId}
                  className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                    isTurn
                      ? 'bg-amber-500/15 border-amber-400/50'
                      : 'bg-black/25 border-white/10'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#f4f1ea] truncate">
                      {p?.name || 'Opponent'}
                    </div>
                    <div className="text-[11px] text-stone-400">
                      {isTurn ? 'Thinking...' : 'Waiting'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 font-mono-num text-xs font-bold text-amber-200">
                    <span>{count}</span>
                    <span className="text-stone-400 font-normal">tiles</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Center Domino Chain */}
          <div className="flex-1 flex flex-col items-center justify-center gap-3 min-h-[170px]">
            {state.board.length === 0 ? (
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-emerald-100/80">
                  Table is open — select any tile in your hand to start the chain
                </p>
                <p className="text-xs text-emerald-200/55">Double-6 opens in classic play</p>
              </div>
            ) : (
              <div className="w-full flex flex-wrap items-center justify-center gap-1.5 max-h-[240px] overflow-y-auto p-2">
                {selectedSides.includes('left') && (
                  <button
                    type="button"
                    onClick={() => selectedTileId && executePlay(selectedTileId, 'left')}
                    className="min-h-[44px] px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold cursor-pointer"
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
                    className="min-h-[44px] px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold cursor-pointer"
                  >
                    Place Right ({state.rightEnd})
                  </button>
                )}
              </div>
            )}

            {state.leftEnd !== null && state.rightEnd !== null && (
              <div className="flex items-center gap-4 text-xs font-mono-num text-emerald-100/80">
                <span>Left End: {state.leftEnd}</span>
                <span aria-hidden="true">·</span>
                <span>Right End: {state.rightEnd}</span>
              </div>
            )}
          </div>

          {/* Local Player Tray & Actions */}
          <div className="bg-black/30 border border-white/10 rounded-xl p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-[#f4f1ea]">
                Your Hand ({myHand.length} tiles) ·{' '}
                <span className={isMyTurn ? 'text-emerald-400' : 'text-stone-400'}>
                  {isMyTurn ? 'Your Turn — tap a highlighted tile' : 'Waiting for turn'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!isMyTurn || playableMoves.length > 0 || state.boneyardCount === 0}
                  onClick={handleDraw}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-35 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Draw ({state.boneyardCount})
                </button>

                <button
                  type="button"
                  disabled={!isMyTurn || playableMoves.length > 0 || state.boneyardCount > 0}
                  onClick={handlePass}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-35 text-stone-100 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  Pass
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
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
              <div className="w-full max-w-sm bg-[#141b18] border border-white/15 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
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
  );
}
