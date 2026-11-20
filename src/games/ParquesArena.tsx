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
  coords[63] = [9, 0];
  coords[64] = [8, 0];
  coords[65] = [8, 1];
  coords[66] = [8, 2];
  coords[67] = [8, 3];
  coords[0] = [8, 4];
  coords[1] = [8, 5];
  coords[2] = [8, 6];
  coords[3] = [8, 7];

  for (let i = 0; i < 8; i++) coords[4 + i] = [7 - i, 8];
  coords[12] = [0, 9];
  for (let i = 0; i < 8; i++) coords[13 + i] = [i, 10];
  for (let i = 0; i < 8; i++) coords[21 + i] = [8, 11 + i];
  coords[29] = [9, 18];
  for (let i = 0; i < 8; i++) coords[30 + i] = [10, 18 - i];
  for (let i = 0; i < 8; i++) coords[38 + i] = [11 + i, 10];
  coords[46] = [18, 9];
  for (let i = 0; i < 8; i++) coords[47 + i] = [18 - i, 8];
  for (let i = 0; i < 8; i++) coords[55 + i] = [10, 7 - i];

  return coords;
}

const TRACK_COORDS = buildTrackCoords();

function getHomeStretchCoord(color: ParquesColor, pos: number): [number, number] {
  const step = pos - 100;
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

function DieFace({ value, rollAnimKey }: { value: number; rollAnimKey: number }) {
  const pips: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[28, 28], [50, 50], [72, 72]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
    6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
  };
  return (
    <div
      key={rollAnimKey}
      className="dice-roll-anim relative p-[3px] rounded-xl bg-gradient-to-br from-[#ede0c8] via-[#b89f79] to-[#6e5a3e] shadow-[0_6px_0_#5b4930,0_12px_20px_rgba(0,0,0,0.72)]"
    >
      <svg width="52" height="52" viewBox="0 0 100 100" className="rounded-[10px] block">
        <defs>
          <linearGradient id="ivoryDieGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFDF9" />
            <stop offset="52%" stopColor="#F2E6CE" />
            <stop offset="100%" stopColor="#D3BE98" />
          </linearGradient>
          <radialGradient id="ivoryFaceBevel" cx="42%" cy="36%" r="58%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="80%" stopColor="#E9DABF" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#AE9772" stopOpacity="0.48" />
          </radialGradient>
        </defs>
        <rect x="2" y="2" width="96" height="96" rx="20" fill="url(#ivoryDieGrad)" stroke="#C6B18D" strokeWidth="3" />
        <circle cx="50" cy="50" r="42" fill="url(#ivoryFaceBevel)" />
        {(pips[value] || []).map(([cx, cy], i) => (
          <g key={i}>
            <circle cx={cx} cy={cy + 2} r={10.5} fill="#FFFDF8" opacity="0.65" />
            <circle cx={cx} cy={cy} r={9.6} fill={value === 1 ? '#9F1239' : '#1E1712'} />
            <circle cx={cx - 2.2} cy={cy - 2.2} r={2.8} fill="#FFFFFF" opacity="0.26" />
          </g>
        ))}
      </svg>
    </div>
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
  const [rollAnimKey, setRollAnimKey] = useState(0);
  const reportedRef = useRef(false);
  const prevDiceKeyRef = useRef<string>('');

  const state = mode === 'online' && onlineState ? onlineState : localState;
  const activePlayerId = state.turnOrder[state.currentTurnIndex];
  const isMyTurn = activePlayerId === localPlayer.id && !state.winnerId;

  useEffect(() => {
    if (state.dice) {
      const k = `${state.currentTurnIndex}_${state.dice[0]}_${state.dice[1]}_${state.hasRolled}`;
      if (k !== prevDiceKeyRef.current) {
        prevDiceKeyRef.current = k;
        setRollAnimKey((n) => n + 1);
      }
    }
  }, [state.dice, state.currentTurnIndex, state.hasRolled]);

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
            <h2 className="text-base font-bold text-[#f4f1ea]">Parqués Clásico</h2>
            <p className="text-xs text-stone-400">{state.lastActionText}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono-num">
          <span className="text-amber-300 font-semibold">
            Turn: {playerNames[activePlayerId] || 'Player'}
          </span>
        </div>
      </div>

      {/* Main Board + Controls Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start flex-1">
        {/* 8 cols: 3D Mahogany & Inlaid Oak Parqués Cabinet with Turned Conical Pawns */}
        <div className="lg:col-span-8 wood-tabletop p-3 sm:p-5 rounded-2xl border border-amber-900/45 flex items-center justify-center relative tabletop-3d-stage">
          <div className="tabletop-3d-cabinet board-3d-tilt p-3 sm:p-4 rounded-2xl w-full max-w-[630px]">
            <div className="p-[2.5px] rounded-xl brass-bezel">
              <div className="w-full aspect-square rounded-[10px] border-2 border-[#2a1308] overflow-hidden shadow-[inset_0_2px_12px_rgba(0,0,0,0.68)] relative">
                <svg viewBox="0 0 1900 1900" className="w-full h-full select-none">
                  <defs>
                    <linearGradient id="oakBoardBase" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#EAD09D" />
                      <stop offset="48%" stopColor="#D6AE72" />
                      <stop offset="100%" stopColor="#B88645" />
                    </linearGradient>
                    <linearGradient id="lacquerSheen" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.18" />
                      <stop offset="42%" stopColor="#FFFFFF" stopOpacity="0.02" />
                      <stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
                    </linearGradient>
                    <pattern id="woodGrainPattern" width="120" height="120" patternUnits="userSpaceOnUse">
                      <rect width="120" height="120" fill="none" />
                      <path d="M0 18 Q 60 12 120 18 M0 52 Q 60 60 120 52 M0 88 Q 60 80 120 88" stroke="#6E441A" strokeWidth="2" strokeOpacity="0.14" fill="none" />
                      <path d="M0 34 Q 60 39 120 34 M0 70 Q 60 65 120 70 M0 106 Q 60 112 120 106" stroke="#FFF3DA" strokeWidth="1.5" strokeOpacity="0.15" fill="none" />
                    </pattern>

                    <radialGradient id="jailRed" cx="42%" cy="38%" r="60%">
                      <stop offset="0%" stopColor="#E11D48" />
                      <stop offset="72%" stopColor="#9F1239" />
                      <stop offset="100%" stopColor="#650B23" />
                    </radialGradient>
                    <radialGradient id="jailBlue" cx="42%" cy="38%" r="60%">
                      <stop offset="0%" stopColor="#2563EB" />
                      <stop offset="72%" stopColor="#1E40AF" />
                      <stop offset="100%" stopColor="#132568" />
                    </radialGradient>
                    <radialGradient id="jailYellow" cx="42%" cy="38%" r="60%">
                      <stop offset="0%" stopColor="#F59E0B" />
                      <stop offset="72%" stopColor="#B45309" />
                      <stop offset="100%" stopColor="#713104" />
                    </radialGradient>
                    <radialGradient id="jailGreen" cx="42%" cy="38%" r="60%">
                      <stop offset="0%" stopColor="#10B981" />
                      <stop offset="72%" stopColor="#047857" />
                      <stop offset="100%" stopColor="#024431" />
                    </radialGradient>

                    <radialGradient id="pawnRed" cx="34%" cy="28%" r="70%">
                      <stop offset="0%" stopColor="#FECDD3" />
                      <stop offset="28%" stopColor="#E11D48" />
                      <stop offset="82%" stopColor="#881337" />
                      <stop offset="100%" stopColor="#4C0519" />
                    </radialGradient>
                    <radialGradient id="pawnBlue" cx="34%" cy="28%" r="70%">
                      <stop offset="0%" stopColor="#BFDBFE" />
                      <stop offset="28%" stopColor="#2563EB" />
                      <stop offset="82%" stopColor="#1E3A8A" />
                      <stop offset="100%" stopColor="#0F1F52" />
                    </radialGradient>
                    <radialGradient id="pawnYellow" cx="34%" cy="28%" r="70%">
                      <stop offset="0%" stopColor="#FEF08A" />
                      <stop offset="28%" stopColor="#D97706" />
                      <stop offset="82%" stopColor="#92400E" />
                      <stop offset="100%" stopColor="#451A03" />
                    </radialGradient>
                    <radialGradient id="pawnGreen" cx="34%" cy="28%" r="70%">
                      <stop offset="0%" stopColor="#A7F3D0" />
                      <stop offset="28%" stopColor="#059669" />
                      <stop offset="82%" stopColor="#064E3B" />
                      <stop offset="100%" stopColor="#022C22" />
                    </radialGradient>

                    <linearGradient id="pawnConeRed" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#FB7185" />
                      <stop offset="45%" stopColor="#E11D48" />
                      <stop offset="100%" stopColor="#5E0822" />
                    </linearGradient>
                    <linearGradient id="pawnConeBlue" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#60A5FA" />
                      <stop offset="45%" stopColor="#2563EB" />
                      <stop offset="100%" stopColor="#12245C" />
                    </linearGradient>
                    <linearGradient id="pawnConeYellow" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#FCD34D" />
                      <stop offset="45%" stopColor="#D97706" />
                      <stop offset="100%" stopColor="#632B06" />
                    </linearGradient>
                    <linearGradient id="pawnConeGreen" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#34D399" />
                      <stop offset="45%" stopColor="#059669" />
                      <stop offset="100%" stopColor="#033B2C" />
                    </linearGradient>

                    <filter id="pawnShadow" x="-45%" y="-35%" width="190%" height="190%">
                      <feDropShadow dx="6" dy="14" stdDeviation="7" floodColor="#180A03" floodOpacity="0.68" />
                    </filter>
                    <filter id="insetShadow" x="-10%" y="-10%" width="120%" height="120%">
                      <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#2C1608" floodOpacity="0.52" />
                    </filter>
                  </defs>

                  <rect x="0" y="0" width="1900" height="1900" fill="url(#oakBoardBase)" />
                  <rect x="0" y="0" width="1900" height="1900" fill="url(#woodGrainPattern)" />

                  {/* Corner Decorative Wood & Lacquer Inlays + Circular Jail Medallions */}
                  {[
                    { x: 0, y: 0, cx: 360, cy: 360, fill: 'url(#jailRed)', accent: '#E11D48', coords: [[2.3, 2.3], [2.3, 4.7], [4.7, 2.3], [4.7, 4.7]] },
                    { x: 1100, y: 0, cx: 1460, cy: 360, fill: 'url(#jailBlue)', accent: '#2563EB', coords: [[2.3, 13.3], [2.3, 15.7], [4.7, 13.3], [4.7, 15.7]] },
                    { x: 1100, y: 1100, cx: 1460, cy: 1460, fill: 'url(#jailYellow)', accent: '#D97706', coords: [[13.3, 13.3], [13.3, 15.7], [15.7, 13.3], [15.7, 15.7]] },
                    { x: 0, y: 1100, cx: 360, cy: 1460, fill: 'url(#jailGreen)', accent: '#059669', coords: [[13.3, 2.3], [13.3, 4.7], [15.7, 2.3], [15.7, 4.7]] },
                  ].map((q, qIdx) => (
                    <g key={`corner-${qIdx}`}>
                      <rect x={q.x + 12} y={q.y + 12} width="776" height="776" rx="28" fill="#B58142" fillOpacity="0.34" stroke="#5A3114" strokeWidth="6" />
                      <polygon points={`${q.x + 36},${q.y + 36} ${q.x + 170},${q.y + 36} ${q.x + 36},${q.y + 170}`} fill={q.accent} fillOpacity="0.72" stroke="#3D1E0A" strokeWidth="4" />
                      <polygon points={`${q.x + 764},${q.y + 36} ${q.x + 630},${q.y + 36} ${q.x + 764},${q.y + 170}`} fill="#D97706" fillOpacity="0.65" stroke="#3D1E0A" strokeWidth="4" />
                      <polygon points={`${q.x + 36},${q.y + 764} ${q.x + 170},${q.y + 764} ${q.x + 36},${q.y + 630}`} fill="#D97706" fillOpacity="0.65" stroke="#3D1E0A" strokeWidth="4" />
                      <polygon points={`${q.x + 764},${q.y + 764} ${q.x + 630},${q.y + 764} ${q.x + 764},${q.y + 630}`} fill={q.accent} fillOpacity="0.72" stroke="#3D1E0A" strokeWidth="4" />
                      <circle cx={q.cx} cy={q.cy} r="318" fill="#3C1C09" />
                      <circle cx={q.cx} cy={q.cy} r="304" fill={q.fill} stroke="#F59E0B" strokeWidth="7" filter="url(#insetShadow)" />
                      <circle cx={q.cx} cy={q.cy} r="278" fill="none" stroke="#FFFBEB" strokeOpacity="0.24" strokeWidth="3" />
                      {q.coords.map(([sr, sc], sIdx) => (
                        <circle
                          key={`sock-${sIdx}`}
                          cx={sc * 100 + 50}
                          cy={sr * 100 + 50}
                          r="48"
                          fill="#160903"
                          fillOpacity="0.4"
                          stroke="#FFFBEB"
                          strokeOpacity="0.32"
                          strokeWidth="3"
                        />
                      ))}
                    </g>
                  ))}

                  {/* Center Marquetry Star Goal ("Cielo") */}
                  <g>
                    <rect x="800" y="800" width="300" height="300" fill="#291408" stroke="#D97706" strokeWidth="8" />
                    <polygon points="800,800 950,950 800,1100" fill="#BE123C" stroke="#FCD34D" strokeWidth="3" />
                    <polygon points="800,800 1100,800 950,950" fill="#1D4ED8" stroke="#FCD34D" strokeWidth="3" />
                    <polygon points="1100,800 1100,1100 950,950" fill="#D97706" stroke="#FCD34D" strokeWidth="3" />
                    <polygon points="800,1100 1100,1100 950,950" fill="#047857" stroke="#FCD34D" strokeWidth="3" />
                    <polygon
                      points="950,860 976,924 1040,950 976,976 950,1040 924,976 860,950 924,924"
                      fill="#F59E0B"
                      stroke="#3B1A06"
                      strokeWidth="5"
                    />
                    <circle cx="950" cy="950" r="24" fill="#FFFBEB" stroke="#78350F" strokeWidth="4" />
                  </g>

                  {/* Stained Wood Home Stretches */}
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <g key={`hs-${i}`}>
                      <rect x={(1 + i) * 100} y={900} width="100" height="100" fill="#D94862" stroke="#4C1D13" strokeWidth="4" />
                      <rect x={(1 + i) * 100 + 8} y={908} width="84" height="84" fill="none" stroke="#FFE4E6" strokeOpacity="0.34" strokeWidth="2" />

                      <rect x={900} y={(1 + i) * 100} width="100" height="100" fill="#3B82F6" stroke="#1E293B" strokeWidth="4" />
                      <rect x={908} y={(1 + i) * 100 + 8} width="84" height="84" fill="none" stroke="#DBEAFE" strokeOpacity="0.34" strokeWidth="2" />

                      <rect x={(17 - i) * 100} y={900} width="100" height="100" fill="#EAB308" stroke="#4C2B08" strokeWidth="4" />
                      <rect x={(17 - i) * 100 + 8} y={908} width="84" height="84" fill="none" stroke="#FEF3C7" strokeOpacity="0.35" strokeWidth="2" />

                      <rect x={900} y={(17 - i) * 100} width="100" height="100" fill="#10B981" stroke="#063B2C" strokeWidth="4" />
                      <rect x={908} y={(17 - i) * 100 + 8} width="84" height="84" fill="none" stroke="#D1FAE5" strokeOpacity="0.34" strokeWidth="2" />
                    </g>
                  ))}

                  {/* 68 Engraved Wood Outer Track Squares */}
                  {TRACK_COORDS.map(([r, c], idx) => {
                    const isSafe = SAFE_SQUARES.has(idx);
                    let fill = '#EED4A3';
                    const stroke = '#5C3818';
                    if (idx === 0) fill = '#E11D48';
                    else if (idx === 17) fill = '#2563EB';
                    else if (idx === 34) fill = '#D97706';
                    else if (idx === 51) fill = '#059669';
                    else if (isSafe) fill = '#D4B079';

                    const cx = c * 100 + 50;
                    const cy = r * 100 + 50;

                    return (
                      <g key={`sq-${idx}`}>
                        <rect
                          x={c * 100}
                          y={r * 100}
                          width="100"
                          height="100"
                          fill={fill}
                          stroke={stroke}
                          strokeWidth="4"
                        />
                        <rect
                          x={c * 100 + 6}
                          y={r * 100 + 6}
                          width="88"
                          height="88"
                          fill="none"
                          stroke="#FFF8EA"
                          strokeOpacity="0.3"
                          strokeWidth="2"
                        />
                        {isSafe && (
                          <g>
                            <circle cx={cx} cy={cy} r="22" fill="none" stroke="#5A3114" strokeWidth="3.5" strokeOpacity="0.65" />
                            <polygon
                              points={`${cx},${cy - 18} ${cx + 5},${cy - 5} ${cx + 18},${cy} ${cx + 5},${cy + 5} ${cx},${cy + 18} ${cx - 5},${cy + 5} ${cx - 18},${cy} ${cx - 5},${cy - 5}`}
                              fill={idx === 0 || idx === 17 || idx === 34 || idx === 51 ? '#FFFBEB' : '#92400E'}
                              fillOpacity="0.82"
                            />
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {/* Glass Lacquer Board Reflection Overlay */}
                  <rect x="0" y="0" width="1900" height="1900" fill="url(#lacquerSheen)" pointerEvents="none" />

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
                          x={c * 100 + 8}
                          y={r * 100 + 8}
                          width="84"
                          height="84"
                          rx="16"
                          fill="#10B981"
                          fillOpacity="0.48"
                          stroke="#FDE047"
                          strokeWidth="7"
                        />
                      </g>
                    );
                  })}

                  {/* Volumetric 3D Turned Conical Pawns */}
                  {pawnRenderList.map((pw, idx) => {
                    const sameCell = pawnRenderList.filter(
                      (o, oIdx) => oIdx < idx && Math.abs(o.row - pw.row) < 0.2 && Math.abs(o.col - pw.col) < 0.2
                    ).length;
                    const ox = (sameCell % 2 === 0 ? -1 : 1) * (sameCell > 0 ? 15 : 0);
                    const oy = sameCell >= 2 ? 15 : 0;

                    const cx = pw.col * 100 + 50 + ox;
                    const cy = pw.row * 100 + 50 + oy;
                    const gradId =
                      pw.color === 'red'
                        ? 'url(#pawnRed)'
                        : pw.color === 'blue'
                        ? 'url(#pawnBlue)'
                        : pw.color === 'yellow'
                        ? 'url(#pawnYellow)'
                        : 'url(#pawnGreen)';
                    const coneId =
                      pw.color === 'red'
                        ? 'url(#pawnConeRed)'
                        : pw.color === 'blue'
                        ? 'url(#pawnConeBlue)'
                        : pw.color === 'yellow'
                        ? 'url(#pawnConeYellow)'
                        : 'url(#pawnConeGreen)';
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
                            cy={cy + 3}
                            r="46"
                            fill="none"
                            stroke={isSelected ? '#FACC15' : '#34D399'}
                            strokeWidth="7"
                          />
                        )}
                        {/* Elliptical contact ground shadow */}
                        <ellipse cx={cx + 5} cy={cy + 14} rx="32" ry="18" fill="#120602" fillOpacity="0.52" />
                        <g filter="url(#pawnShadow)">
                          {/* Wide turned wooden/lacquer pedestal base */}
                          <ellipse cx={cx} cy={cy + 10} rx="31" ry="20" fill={coneId} stroke="#190B05" strokeWidth="3" />
                          <ellipse cx={cx} cy={cy + 5} rx="27" ry="16" fill="none" stroke="#FFFFFF" strokeOpacity="0.24" strokeWidth="2" />
                          {/* Tapered 3D cone stem */}
                          <path
                            d={`M ${cx - 22} ${cy + 5} L ${cx - 12} ${cy - 14} L ${cx + 12} ${cy - 14} L ${cx + 22} ${cy + 5} Z`}
                            fill={coneId}
                            stroke="#190B05"
                            strokeWidth="2.5"
                          />
                          {/* Brass collar ring */}
                          <ellipse cx={cx} cy={cy - 13} rx="14" ry="5" fill="#FBBF24" stroke="#451A03" strokeWidth="1.5" />
                          {/* Raised spherical finial head */}
                          <circle cx={cx} cy={cy - 22} r="17.5" fill={gradId} stroke="#190B05" strokeWidth="2.5" />
                          {/* Glossy specular highlight */}
                          <ellipse
                            cx={cx - 6}
                            cy={cy - 28}
                            rx="6.5"
                            ry="4"
                            transform={`rotate(-28 ${cx - 6} ${cy - 28})`}
                            fill="#FFFFFF"
                            fillOpacity="0.72"
                          />
                        </g>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* 4 cols: Carved 3D Tray Dice Control & Player Standings */}
        <div className="lg:col-span-4 space-y-4">
          <div className="surface-3d-panel rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#f4f1ea]">3D Ivory Dice Tray</span>
              {state.dice && (
                <span className="text-xs font-mono-num text-amber-300">
                  Remaining: {state.diceRemaining.join(', ') || 'Done'}
                </span>
              )}
            </div>

            <div className="tabletop-3d-cabinet p-2 rounded-xl">
              <div className="baize-felt-hd rounded-lg border border-amber-500/25 flex items-center justify-center gap-6 py-5">
                {state.dice ? (
                  <>
                    <DieFace value={state.dice[0]} rollAnimKey={rollAnimKey} />
                    <DieFace value={state.dice[1]} rollAnimKey={rollAnimKey} />
                  </>
                ) : (
                  <div className="text-xs text-emerald-100/75 py-3">Roll twin 3D ivory dice to begin turn</div>
                )}
              </div>
            </div>

            <button
              type="button"
              disabled={!isMyTurn || state.hasRolled}
              onClick={handleRoll}
              className="w-full min-h-[48px] px-4 py-2.5 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 disabled:from-white/10 disabled:to-white/10 disabled:text-stone-400 text-white font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_0_#064e3b] disabled:shadow-none"
            >
              <Dices className="w-5 h-5" />
              {isMyTurn ? (state.hasRolled ? 'Select a highlighted pawn' : 'Roll Dice') : 'Opponent Turn'}
            </button>

            {isMyTurn && state.hasRolled && legalMoves.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="text-xs text-stone-400">
                  {selectedPawnId !== null
                    ? `Moves for Pawn #${selectedPawnId + 1}:`
                    : 'Tap a highlighted 3D pawn on the board, or pick a move:'}
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

          <div className="surface-3d-panel rounded-2xl p-4 space-y-2.5">
            <h3 className="text-xs font-semibold text-stone-400">Seated Players</h3>
            {state.players.map((pl) => {
              const goalCount = pl.pawns.filter((pw) => pw.pos === 107).length;
              const active = activePlayerId === pl.playerId && !state.winnerId;
              return (
                <div
                  key={pl.playerId}
                  className={`p-2.5 rounded-xl border flex items-center justify-between ${
                    active ? 'bg-amber-500/14 border-amber-400/55' : 'bg-black/35 border-white/8'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-4 h-4 rounded-full shrink-0 shadow-[inset_0_2px_2px_rgba(255,255,255,0.5),0_2px_4px_rgba(0,0,0,0.6)]"
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

      {state.winnerId && (
        <div className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-4">
          <div className="w-full max-w-sm surface-3d-panel rounded-2xl p-6 text-center space-y-4">
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
