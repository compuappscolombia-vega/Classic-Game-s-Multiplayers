import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Dices, RotateCcw, Trophy } from 'lucide-react';
import {
  applyParquesMove,
  chooseAiParquesMove,
  createParquesGame,
  getLegalParquesMoves,
  rollParquesDice,
  SAFE_SQUARES,
} from '../shared/parquesEngine.ts';
import type {
  GameMode,
  Language,
  ParquesColor,
  ParquesMoveOption,
  ParquesState,
  PlayerInfo,
} from '../shared/types.ts';
import { audioVoice } from '../lib/audioVoice.ts';

interface ParquesArenaProps {
  mode: GameMode;
  language: Language;
  localPlayer: PlayerInfo;
  players: PlayerInfo[];
  onlineState?: ParquesState;
  onOnlineAction?: (action: Record<string, unknown>) => void;
  onMatchFinished: (outcome: 'win' | 'loss' | 'draw', score: number) => void;
  onExit: () => void;
}

const COLOR_HEX: Record<ParquesColor, { fill: string; stroke: string; label: string }> = {
  red: { fill: '#E11D48', stroke: '#FECDD3', label: 'Crimson' },
  blue: { fill: '#2563EB', stroke: '#BFDBFE', label: 'Cobalt' },
  yellow: { fill: '#D97706', stroke: '#FDE68A', label: 'Amber' },
  green: { fill: '#059669', stroke: '#A7F3D0', label: 'Emerald' },
};

// Build 19x19 grid coordinates (row, col) for all 68 outer track squares
function buildTrackCoords(): [number, number][] {
  const coords: [number, number][] = new Array(68);
  // 63 = (9,0), 64..67 = (8,0..3), 0..3 = (8,4..7)
  coords[63] = [9, 0];
  coords[64] = [8, 0];
  coords[65] = [8, 1];
  coords[66] = [8, 2];
  coords[67] = [8, 3];
  coords[0] = [8, 4];
  coords[1] = [8, 5];
  coords[2] = [8, 6];
  coords[3] = [8, 7];

  // 4..11 = col 8, rows 7..0
  for (let i = 0; i < 8; i++) coords[4 + i] = [7 - i, 8];
  // 12 = (0,9)
  coords[12] = [0, 9];
  // 13..20 = col 10, rows 0..7
  for (let i = 0; i < 8; i++) coords[13 + i] = [i, 10];
  // 21..28 = row 8, cols 11..18
  for (let i = 0; i < 8; i++) coords[21 + i] = [8, 11 + i];
  // 29 = (9,18)
  coords[29] = [9, 18];
  // 30..37 = row 10, cols 18..11
  for (let i = 0; i < 8; i++) coords[30 + i] = [10, 18 - i];
  // 38..45 = col 10, rows 11..18
  for (let i = 0; i < 8; i++) coords[38 + i] = [11 + i, 10];
  // 46 = (18,9)
  coords[46] = [18, 9];
  // 47..54 = col 8, rows 18..11
  for (let i = 0; i < 8; i++) coords[47 + i] = [18 - i, 8];
  // 55..62 = row 10, cols 7..0
  for (let i = 0; i < 8; i++) coords[55 + i] = [10, 7 - i];

  return coords;
}

const TRACK_COORDS = buildTrackCoords();

function getHomeStretchCoord(color: ParquesColor, pos: number): [number, number] {
  const step = pos - 100; // 0..6, 7 = goal
  if (pos === 107) {
    if (color === 'red') return [9, 8.2];
    if (color === 'blue') return [8.2, 9];
    if (color === 'yellow') return [9, 9.8];
    return [9.8, 9];
  }
  if (color === 'red') return [9, 1 + step];
  if (color === 'blue') return [1 + step, 9];
  if (color === 'yellow') return [9, 17 - step];
  return [17 - step, 9];
}

function getJailCoord(color: ParquesColor, pawnId: number): [number, number] {
  const offsets: [number, number][] = [
    [2.3, 2.3],
    [2.3, 4.7],
    [4.7, 2.3],
    [4.7, 4.7],
  ];
  const [dr, dc] = offsets[pawnId] || [3, 3];
  if (color === 'red') return [dr, dc];
  if (color === 'blue') return [dr, dc + 11];
  if (color === 'yellow') return [dr + 11, dc + 11];
  return [dr + 11, dc];
}

function DieFace({ value }: { value: number }) {
  const pips: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[28, 28], [50, 50], [72, 72]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
    6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
  };
  return (
    <svg width="44" height="44" viewBox="0 0 100 100" className="rounded-lg bg-[#faf6ee] border-2 border-stone-400 shadow">
      {(pips[value] || []).map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={10} fill="#1C1917" />
      ))}
    </svg>
  );
}

export function ParquesArena({
  mode,
  language,
  localPlayer,
  players,
  onlineState,
  onOnlineAction,
  onMatchFinished,
  onExit,
}: ParquesArenaProps) {
  const aiPlayers = useMemo<PlayerInfo[]>(() => {
    if (mode === 'online') return players;
    return [
      localPlayer,
      { id: 'ai_valeria', name: 'Valeria (IA)', avatarUrl: '', elo: 1160, isAi: true },
      { id: 'ai_carlos', name: 'Carlos (IA)', avatarUrl: '', elo: 1200, isAi: true },
      { id: 'ai_elena', name: 'Elena (IA)', avatarUrl: '', elo: 1110, isAi: true },
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

  const [localState, setLocalState] = useState<ParquesState>(() =>
    createParquesGame(
      aiPlayers.map((p) => p.id),
      playerNames
    )
  );
  const [selectedPawnId, setSelectedPawnId] = useState<number | null>(null);
  const reportedRef = useRef(false);

  const state = mode === 'online' && onlineState ? onlineState : localState;
  const activePlayerId = state.turnOrder[state.currentTurnIndex];
  const isMyTurn = activePlayerId === localPlayer.id && !state.winnerId;

  const legalMoves = useMemo(
    () => (isMyTurn ? getLegalParquesMoves(state, localPlayer.id) : []),
    [isMyTurn, state, localPlayer.id]
  );

  const movesForSelectedPawn = useMemo(() => {
    if (selectedPawnId === null) return [];
    return legalMoves.filter((m) => m.pawnId === selectedPawnId);
  }, [selectedPawnId, legalMoves]);

  // Announce captures and victory
  useEffect(() => {
    if (state.lastCaptureText) {
      audioVoice.playCaptureBoom();
      audioVoice.speak(state.lastCaptureText, language);
    }
  }, [state.lastCaptureText, language]);

  useEffect(() => {
    if (state.winnerId && !reportedRef.current) {
      reportedRef.current = true;
      const won = state.winnerId === localPlayer.id;
      const myP = state.players.find((p) => p.playerId === localPlayer.id);
      const goalCount = myP ? myP.pawns.filter((pw) => pw.pos === 107).length : 0;
      audioVoice.playVictoryFanfare();
      audioVoice.speak(
        language === 'es'
          ? `¡Parqués! ${playerNames[state.winnerId] || 'Jugador'} llegó al cielo.`
          : `Parqués! ${playerNames[state.winnerId] || 'Player'} reached the center goal!`,
        language
      );
      onMatchFinished(won ? 'win' : 'loss', won ? 100 : goalCount * 20);
    }
  }, [state.winnerId, state.players, localPlayer.id, playerNames, language, onMatchFinished]);

  // Offline AI turn automation
  useEffect(() => {
    if (mode !== 'ai' || state.winnerId) return;
    const current = playerMap[activePlayerId];
    if (!current?.isAi) return;

    const timer = setTimeout(() => {
      if (!state.hasRolled) {
        audioVoice.playDiceRoll();
        setLocalState((prev) => rollParquesDice(prev, current.id, current.name));
      } else {
        const move = chooseAiParquesMove(state, current.id);
        if (move) {
          audioVoice.playPawnHop();
          setLocalState((prev) => applyParquesMove(prev, current.id, move, playerNames));
        }
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [mode, state, activePlayerId, playerMap, playerNames]);

  const handleRoll = () => {
    if (!isMyTurn || state.hasRolled) return;
    audioVoice.playDiceRoll();
    setSelectedPawnId(null);
    if (mode === 'online' && onOnlineAction) {
      onOnlineAction({ kind: 'roll' });
    } else {
      setLocalState((prev) => rollParquesDice(prev, localPlayer.id, localPlayer.name));
    }
  };

  const executeMove = (move: ParquesMoveOption) => {
    audioVoice.playPawnHop();
    setSelectedPawnId(null);
    if (mode === 'online' && onOnlineAction) {
      onOnlineAction({ kind: 'move', move });
    } else {
      setLocalState((prev) => applyParquesMove(prev, localPlayer.id, move, playerNames));
    }
  };

  const handlePawnClick = (pawnId: number) => {
    if (!isMyTurn || !state.hasRolled) return;
    const pawnMoves = legalMoves.filter((m) => m.pawnId === pawnId);
    if (pawnMoves.length === 0) return;
    if (pawnMoves.length === 1) {
      executeMove(pawnMoves[0]);
    } else {
      setSelectedPawnId((prev) => (prev === pawnId ? null : pawnId));
    }
  };

  const handleRestartAi = () => {
    reportedRef.current = false;
    setSelectedPawnId(null);
    setLocalState(
      createParquesGame(
        aiPlayers.map((p) => p.id),
        playerNames
      )
    );
  };

  // Group pawns by rounded cell coordinate so stacked pawns offset cleanly
  const pawnRenderList = useMemo(() => {
    const items: {
      playerId: string;
      color: ParquesColor;
      pawnId: number;
      pos: number;
      row: number;
      col: number;
      canMove: boolean;
    }[] = [];

    for (const pl of state.players) {
      for (const pw of pl.pawns) {
        let coord: [number, number];
        if (pw.pos === -1) {
          coord = getJailCoord(pl.color, pw.id);
        } else if (pw.pos >= 100) {
          coord = getHomeStretchCoord(pl.color, pw.pos);
        } else {
          coord = TRACK_COORDS[pw.pos] || [9, 9];
        }
        const canMove =
          isMyTurn &&
          pl.playerId === localPlayer.id &&
          legalMoves.some((m) => m.pawnId === pw.id);
        items.push({
          playerId: pl.playerId,
          color: pl.color,
          pawnId: pw.id,
          pos: pw.pos,
          row: coord[0],
          col: coord[1],
          canMove,
        });
      }
    }
    return items;
  }, [state.players, isMyTurn, localPlayer.id, legalMoves]);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header HUD */}
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
            <h2 className="text-base font-bold text-[#f4f1ea]">Parqués Clásico</h2>
            <p className="text-xs text-stone-400">{state.lastActionText}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono-num">
          <span className="text-emerald-400 font-semibold">
            Turn: {playerNames[activePlayerId] || 'Player'}
          </span>
        </div>
      </div>

      {/* Main Board + Controls Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start flex-1">
        {/* 8 cols: Interactive 19x19 SVG Parqués Board */}
        <div className="lg:col-span-8 walnut-trim p-2.5 sm:p-4 rounded-2xl flex items-center justify-center relative">
          <div className="w-full max-w-[600px] aspect-square bg-[#F4EFE4] rounded-xl border-2 border-amber-900/60 overflow-hidden shadow-inner">
            <svg viewBox="0 0 1900 1900" className="w-full h-full select-none">
              {/* Corner Jails */}
              <rect x="0" y="0" width="800" height="800" fill="#FFE4E6" stroke="#BE123C" strokeWidth="8" />
              <rect x="1100" y="0" width="800" height="800" fill="#DBEAFE" stroke="#1D4ED8" strokeWidth="8" />
              <rect x="1100" y="1100" width="800" height="800" fill="#FEF3C7" stroke="#B45309" strokeWidth="8" />
              <rect x="0" y="1100" width="800" height="800" fill="#D1FAE5" stroke="#047857" strokeWidth="8" />

              {/* Center Goal */}
              <rect x="800" y="800" width="300" height="300" fill="#1C1917" stroke="#F59E0B" strokeWidth="8" />
              <polygon points="800,800 950,950 800,1100" fill="#E11D48" opacity="0.85" />
              <polygon points="800,800 1100,800 950,950" fill="#2563EB" opacity="0.85" />
              <polygon points="1100,800 1100,1100 950,950" fill="#D97706" opacity="0.85" />
              <polygon points="800,1100 1100,1100 950,950" fill="#059669" opacity="0.85" />

              {/* Home Stretches (7 squares each) */}
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <g key={`hs-${i}`}>
                  <rect x={(1 + i) * 100} y={900} width="100" height="100" fill="#FDA4AF" stroke="#881337" strokeWidth="3" />
                  <rect x={900} y={(1 + i) * 100} width="100" height="100" fill="#93C5FD" stroke="#1E3A8A" strokeWidth="3" />
                  <rect x={(17 - i) * 100} y={900} width="100" height="100" fill="#FCD34D" stroke="#78350F" strokeWidth="3" />
                  <rect x={900} y={(17 - i) * 100} width="100" height="100" fill="#6EE7B7" stroke="#064E3B" strokeWidth="3" />
                </g>
              ))}

              {/* 68 Outer Track Squares */}
              {TRACK_COORDS.map(([r, c], idx) => {
                const isSafe = SAFE_SQUARES.has(idx);
                let fill = '#FAF6EE';
                if (idx === 0) fill = '#FDA4AF';
                else if (idx === 17) fill = '#93C5FD';
                else if (idx === 34) fill = '#FCD34D';
                else if (idx === 51) fill = '#6EE7B7';
                else if (isSafe) fill = '#E7E5E4';

                return (
                  <g key={`sq-${idx}`}>
                    <rect
                      x={c * 100}
                      y={r * 100}
                      width="100"
                      height="100"
                      fill={fill}
                      stroke="#78716C"
                      strokeWidth="3"
                    />
                    {isSafe && (
                      <circle cx={c * 100 + 50} cy={r * 100 + 50} r="14" fill="none" stroke="#57534E" strokeWidth="3" />
                    )}
                  </g>
                );
              })}

              {/* Highlighted Target Squares for Selected Pawn */}
              {movesForSelectedPawn.map((m, idx) => {
                const myColor = state.players.find((p) => p.playerId === localPlayer.id)?.color || 'red';
                const [r, c] =
                  m.toPos >= 100
                    ? getHomeStretchCoord(myColor, m.toPos)
                    : TRACK_COORDS[m.toPos] || [9, 9];
                return (
                  <g
                    key={`target-${idx}`}
                    onClick={() => executeMove(m)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={c * 100 + 6}
                      y={r * 100 + 6}
                      width="88"
                      height="88"
                      rx="16"
                      fill="#10B981"
                      fillOpacity="0.38"
                      stroke="#059669"
                      strokeWidth="6"
                    />
                  </g>
                );
              })}

              {/* Pawns */}
              {pawnRenderList.map((pw, idx) => {
                // Slight offset if multiple pawns share same cell
                const sameCell = pawnRenderList.filter(
                  (o, oIdx) => oIdx < idx && Math.abs(o.row - pw.row) < 0.2 && Math.abs(o.col - pw.col) < 0.2
                ).length;
                const ox = (sameCell % 2 === 0 ? -1 : 1) * (sameCell > 0 ? 14 : 0);
                const oy = sameCell >= 2 ? 14 : 0;

                const cx = pw.col * 100 + 50 + ox;
                const cy = pw.row * 100 + 50 + oy;
                const style = COLOR_HEX[pw.color];
                const isSelected = selectedPawnId === pw.pawnId && pw.playerId === localPlayer.id;

                return (
                  <g
                    key={`${pw.playerId}-${pw.pawnId}`}
                    onClick={() => pw.canMove && handlePawnClick(pw.pawnId)}
                    className={pw.canMove ? 'cursor-pointer' : 'cursor-default'}
                  >
                    {pw.canMove && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r="42"
                        fill="none"
                        stroke={isSelected ? '#F59E0B' : '#10B981'}
                        strokeWidth="7"
                      />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r="31"
                      fill={style.fill}
                      stroke={style.stroke}
                      strokeWidth="6"
                    />
                    <circle cx={cx} cy={cy} r="13" fill="#FFFFFF" fillOpacity="0.35" />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* 4 cols: Dice Tray, Legal Move Buttons & Player Standings */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-[#141b18] border border-white/10 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#f4f1ea]">Dice & Move Control</span>
              {state.dice && (
                <span className="text-xs font-mono-num text-amber-300">
                  Remaining: {state.diceRemaining.join(', ') || 'Done'}
                </span>
              )}
            </div>

            <div className="flex items-center justify-center gap-4 py-2">
              {state.dice ? (
                <>
                  <DieFace value={state.dice[0]} />
                  <DieFace value={state.dice[1]} />
                </>
              ) : (
                <div className="text-xs text-stone-400 py-3">Roll twin dice to begin turn</div>
              )}
            </div>

            <button
              type="button"
              disabled={!isMyTurn || state.hasRolled}
              onClick={handleRoll}
              className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-stone-400 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Dices className="w-5 h-5" />
              {isMyTurn ? (state.hasRolled ? 'Select a highlighted pawn' : 'Roll Dice') : 'Opponent Turn'}
            </button>

            {/* Explicit Move Choice Buttons when a pawn has multiple die options */}
            {isMyTurn && state.hasRolled && legalMoves.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="text-xs text-stone-400">
                  {selectedPawnId !== null
                    ? `Moves for Pawn #${selectedPawnId + 1}:`
                    : 'Tap a highlighted pawn on the board, or pick a move:'}
                </div>
                <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto">
                  {(selectedPawnId !== null ? movesForSelectedPawn : legalMoves).map((m, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => executeMove(m)}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg bg-white/8 hover:bg-emerald-600/30 border border-white/10 text-left text-xs text-stone-100 flex items-center justify-between cursor-pointer"
                    >
                      <span>
                        {m.isReleaseFromJail
                          ? `Free Pawn #${m.pawnId + 1} from Jail`
                          : `Pawn #${m.pawnId + 1} → +${m.dieValue} steps`}
                      </span>
                      {m.captures && m.captures.length > 0 && (
                        <span className="text-amber-300 font-bold">CAPTURE!</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Player Goal Progress */}
          <div className="bg-[#141b18] border border-white/10 rounded-2xl p-4 space-y-2.5">
            <h3 className="text-xs font-semibold text-stone-400">Seated Players</h3>
            {state.players.map((pl) => {
              const goalCount = pl.pawns.filter((pw) => pw.pos === 107).length;
              const active = activePlayerId === pl.playerId && !state.winnerId;
              return (
                <div
                  key={pl.playerId}
                  className={`p-2.5 rounded-xl border flex items-center justify-between ${
                    active ? 'bg-white/10 border-amber-400/45' : 'bg-black/25 border-white/8'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: COLOR_HEX[pl.color].fill }}
                    />
                    <span className="text-xs font-semibold text-[#f4f1ea] truncate">
                      {playerNames[pl.playerId] || COLOR_HEX[pl.color].label}
                    </span>
                  </div>
                  <span className="text-xs font-mono-num text-stone-300">{goalCount}/4 Goal</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Victory Modal */}
      {state.winnerId && (
        <div className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#141b18] border border-white/15 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <Trophy className="w-10 h-10 text-amber-400 mx-auto" />
            <div>
              <h3 className="text-xl font-bold text-[#f4f1ea]">
                {state.winnerId === localPlayer.id
                  ? 'Parqués Champion!'
                  : `${playerNames[state.winnerId] || 'Opponent'} Wins`}
              </h3>
              <p className="text-xs text-stone-400 mt-1">{state.lastActionText}</p>
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
  );
}
