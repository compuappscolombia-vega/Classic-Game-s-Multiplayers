import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Anchor,
  Compass,
  Crosshair,
  LogOut,
  RotateCw,
  RefreshCw,
  Shuffle,
  ShieldCheck,
  Ship,
} from 'lucide-react';
import {
  BARCOS_GRID_SIZE,
  barcosCoordLabel,
  canPlaceBarcosShip,
  chooseAiBarcosTarget,
  confirmBarcosFleet,
  createBarcosGame,
  fireBarcosShot,
  getShipCells,
  placeBarcosShip,
  randomizeBarcosFleet,
} from '../shared/barcosEngine.ts';
import { audioVoice } from '../lib/audioVoice.ts';
import type {
  BarcosOrientation,
  BarcosShip,
  BarcosShipId,
  BarcosShot,
  BarcosState,
  GameMode,
  Language,
  PlayerInfo,
} from '../shared/types.ts';

interface BarcosArenaProps {
  mode: GameMode;
  language: Language;
  localPlayer: PlayerInfo;
  players: PlayerInfo[];
  onlineState?: BarcosState;
  onOnlineAction?: (action: Record<string, unknown>) => void;
  onMatchFinished: (outcome: 'win' | 'loss' | 'draw', score: number) => void;
  onExit: () => void;
}

const AI_ADMIRAL_ID = 'ai_admiral_barcos';
const COL_HEADERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

function WarshipHullSvg({
  ship,
  sunk = false,
}: {
  ship: BarcosShip;
  sunk?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const hullGrad = `hull_${uid}`;
  const deckGrad = `deck_${uid}`;
  const isVertical = ship.orientation === 'V';

  // Build SVG in canonical horizontal coordinate space (width = ship.size * 100, height = 100)
  // Rotate neatly if vertical.
  const len = ship.size * 100;
  const viewW = isVertical ? 100 : len;
  const viewH = isVertical ? len : 100;

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      preserveAspectRatio="none"
      className={`w-full h-full pointer-events-none select-none ${
        sunk
          ? 'opacity-80 drop-shadow-[0_2px_4px_rgba(220,38,38,0.55)]'
          : 'drop-shadow-[0_4px_6px_rgba(0,0,0,0.75)]'
      }`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={hullGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          {sunk ? (
            <>
              <stop offset="0%" stopColor="#6b3434" />
              <stop offset="55%" stopColor="#3c1b1b" />
              <stop offset="100%" stopColor="#1e0b0b" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#9aa7b4" />
              <stop offset="48%" stopColor="#5a6877" />
              <stop offset="100%" stopColor="#2c3540" />
            </>
          )}
        </linearGradient>
        <linearGradient id={deckGrad} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={sunk ? '#522525' : '#4a5663'} />
          <stop offset="100%" stopColor={sunk ? '#291212' : '#26303a'} />
        </linearGradient>
      </defs>

      <g transform={isVertical ? `translate(100, 0) rotate(90)` : undefined}>
        {/* Water Wake Shadow */}
        <path
          d={`M 18 52 C 18 24, 58 14, 108 14 L ${len - 72} 14 C ${len - 28} 14, ${len - 12} 36, ${
            len - 8
          } 52 C ${len - 12} 68, ${len - 28} 88, ${len - 72} 88 L 108 88 C 58 88, 18 78, 18 52 Z`}
          fill="#000000"
          fillOpacity="0.42"
          transform="translate(2, 5)"
        />

        {/* Main 3D Steel Hull */}
        <path
          d={`M 16 50 C 16 22, 56 13, 106 13 L ${len - 74} 13 C ${len - 26} 13, ${len - 10} 36, ${
            len - 7
          } 50 C ${len - 10} 64, ${len - 26} 87, ${len - 74} 87 L 106 87 C 56 87, 16 78, 16 50 Z`}
          fill={`url(#${hullGrad})`}
          stroke={sunk ? '#ef4444' : '#cbd5e1'}
          strokeOpacity={sunk ? 0.65 : 0.45}
          strokeWidth="2.5"
        />

        {/* Inner Flight Deck / Main Deck */}
        {ship.id === 'carrier' ? (
          <>
            <rect
              x="44"
              y="22"
              width={len - 96}
              height="56"
              rx="6"
              fill={`url(#${deckGrad})`}
              stroke="#e2e8f0"
              strokeOpacity="0.28"
              strokeWidth="1.5"
            />
            <line
              x1="60"
              y1="50"
              x2={len - 64}
              y2="50"
              stroke="#fbbf24"
              strokeOpacity="0.72"
              strokeWidth="3"
              strokeDasharray="16 12"
            />
            {/* Island Tower */}
            <rect
              x={len * 0.52}
              y="18"
              width="58"
              height="18"
              rx="4"
              fill="#334155"
              stroke="#e2e8f0"
              strokeOpacity="0.55"
              strokeWidth="1.5"
            />
          </>
        ) : ship.id === 'submarine' ? (
          <>
            <ellipse
              cx={len / 2}
              cy="50"
              rx={len * 0.4}
              ry="20"
              fill={`url(#${deckGrad})`}
              stroke="#94a3b8"
              strokeOpacity="0.35"
              strokeWidth="1.5"
            />
            {/* Conning Tower */}
            <rect
              x={len * 0.42}
              y="36"
              width="48"
              height="28"
              rx="10"
              fill="#475569"
              stroke="#e2e8f0"
              strokeOpacity="0.5"
              strokeWidth="1.8"
            />
            <circle cx={len * 0.5} cy="50" r="6" fill="#0f172a" />
          </>
        ) : (
          <>
            <rect
              x="48"
              y="26"
              width={len - 102}
              height="48"
              rx="14"
              fill={`url(#${deckGrad})`}
              stroke="#94a3b8"
              strokeOpacity="0.3"
              strokeWidth="1.4"
            />
            {/* Fore Gun Turret */}
            <circle cx={len - 82} cy="50" r="14" fill="#334155" stroke="#cbd5e1" strokeWidth="1.5" />
            <line x1={len - 72} y1="47" x2={len - 46} y2="47" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" />
            <line x1={len - 72} y1="53" x2={len - 46} y2="53" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" />
            {/* Central Bridge Superstructure */}
            <rect
              x={len * 0.38}
              y="32"
              width={Math.max(44, len * 0.22)}
              height="36"
              rx="6"
              fill="#64748b"
              stroke="#f1f5f9"
              strokeOpacity="0.45"
              strokeWidth="1.5"
            />
            {/* Aft Turret on Battleship & Cruiser */}
            {ship.size >= 3 && (
              <>
                <circle cx="84" cy="50" r="12" fill="#334155" stroke="#cbd5e1" strokeWidth="1.5" />
                <line x1="74" y1="50" x2="50" y2="50" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" />
              </>
            )}
          </>
        )}
      </g>
    </svg>
  );
}

export function BarcosArena({
  mode,
  language,
  localPlayer,
  players,
  onlineState,
  onOnlineAction,
  onMatchFinished,
  onExit,
}: BarcosArenaProps) {
  const isEs = language === 'es';

  const [aiState, setAiState] = useState<BarcosState>(() =>
    createBarcosGame(
      [localPlayer.id, AI_ADMIRAL_ID],
      { [localPlayer.id]: localPlayer.name, [AI_ADMIRAL_ID]: 'Almirante IA' },
      [AI_ADMIRAL_ID]
    )
  );

  const state = mode === 'online' && onlineState ? onlineState : aiState;

  const [selectedShipId, setSelectedShipId] = useState<BarcosShipId>('carrier');
  const [orientation, setOrientation] = useState<BarcosOrientation>('H');
  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null);

  const reportedMatchRef = useRef<string | null>(null);
  const lastSoundTurnRef = useRef<number>(-1);

  const myBoard = state.boards[localPlayer.id];
  const opponentId = useMemo(
    () => state.turnOrder.find((id) => id !== localPlayer.id) || state.turnOrder[1],
    [state.turnOrder, localPlayer.id]
  );
  const opponentBoard = state.boards[opponentId];
  const opponentName = useMemo(() => {
    if (mode === 'ai') return isEs ? 'Almirante IA' : 'Admiral AI';
    const found = players.find((p) => p.id === opponentId);
    return found?.name || (isEs ? 'Rival' : 'Opponent');
  }, [mode, isEs, players, opponentId]);

  const activePlayerId = state.turnOrder[state.currentTurnIndex];
  const isMyTurn = state.phase === 'battle' && activePlayerId === localPlayer.id;
  const inSetup = state.phase === 'setup' && Boolean(myBoard && !myBoard.ready);

  // Sync ship orientation when selecting a ship on dock
  const handleSelectShip = (ship: BarcosShip) => {
    setSelectedShipId(ship.id);
    setOrientation(ship.orientation);
  };

  // Keyboard 'R' shortcut during setup to rotate selected ship
  useEffect(() => {
    if (!inSetup) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        setOrientation((prev) => (prev === 'H' ? 'V' : 'H'));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inSetup]);

  // Play naval audio & voice callouts whenever turnCount increments
  useEffect(() => {
    if (state.turnCount === 0 || state.turnCount === lastSoundTurnRef.current) return;
    lastSoundTurnRef.current = state.turnCount;

    const shot = state.lastShot;
    if (!shot) return;

    if (shot.result === 'miss') {
      audioVoice.playTorpedoSplash();
    } else {
      audioVoice.playNavalExplosion(shot.result === 'sunk');
    }

    if (shot.result === 'sunk' && shot.sunkShipId) {
      const targetBoard = state.boards[shot.targetId];
      const ship = targetBoard?.ships.find((s) => s.id === shot.sunkShipId);
      const shipLabel = ship ? (isEs ? ship.nameEs : ship.nameEn) : '';
      const shooterIsMe = shot.shooterId === localPlayer.id;
      audioVoice.speak(
        shooterIsMe
          ? isEs
            ? `¡Hundiste su ${shipLabel}!`
            : `You sank their ${shipLabel}!`
          : isEs
          ? `¡Hundieron tu ${shipLabel}!`
          : `They sank your ${shipLabel}!`,
        language
      );
    }
  }, [state.turnCount, state.lastShot, state.boards, localPlayer.id, isEs, language]);

  // Report completed match once
  useEffect(() => {
    if (state.phase !== 'finished' || !state.winnerId) return;
    const matchSignature = `${state.winnerId}_${state.turnCount}`;
    if (reportedMatchRef.current === matchSignature) return;
    reportedMatchRef.current = matchSignature;

    const won = state.winnerId === localPlayer.id;
    const myIntactSegments =
      myBoard?.ships.reduce((acc, s) => acc + Math.max(0, s.size - s.hits.length), 0) || 0;
    const score = won ? 180 + myIntactSegments * 12 : Math.max(20, 90 - state.turnCount);

    if (won) {
      audioVoice.playVictoryFanfare();
      audioVoice.speak(
        isEs ? '¡Victoria naval! Toda la flota enemiga ha sido hundida.' : 'Naval victory! Enemy fleet destroyed.',
        language
      );
    } else {
      audioVoice.speak(
        isEs ? 'Flota perdida. Prepara una revancha.' : 'Fleet lost. Ready for a rematch.',
        language
      );
    }

    onMatchFinished(won ? 'win' : 'loss', score);
  }, [state.phase, state.winnerId, state.turnCount, localPlayer.id, myBoard, isEs, language, onMatchFinished]);

  // AI turn loop
  useEffect(() => {
    if (mode !== 'ai') return;
    if (state.phase !== 'battle' || activePlayerId !== AI_ADMIRAL_ID || state.winnerId) return;

    const timer = setTimeout(() => {
      const { row, col } = chooseAiBarcosTarget(state, AI_ADMIRAL_ID);
      setAiState((prev) =>
        fireBarcosShot(prev, AI_ADMIRAL_ID, row, col, isEs ? 'Almirante IA' : 'Admiral AI')
      );
    }, 760);

    return () => clearTimeout(timer);
  }, [mode, state, activePlayerId, isEs]);

  const handlePlaceShipAt = (row: number, col: number) => {
    if (!inSetup) return;
    if (mode === 'online') {
      onOnlineAction?.({ kind: 'place_ship', shipId: selectedShipId, row, col, orientation });
    } else {
      setAiState((prev) => placeBarcosShip(prev, localPlayer.id, selectedShipId, row, col, orientation));
    }
  };

  const handleRandomizeFleet = () => {
    if (!inSetup) return;
    if (mode === 'online') {
      onOnlineAction?.({ kind: 'randomize' });
    } else {
      setAiState((prev) => randomizeBarcosFleet(prev, localPlayer.id));
    }
  };

  const handleDeployFleet = () => {
    if (!inSetup) return;
    audioVoice.playPawnHop();
    if (mode === 'online') {
      onOnlineAction?.({ kind: 'ready_fleet' });
    } else {
      setAiState((prev) => confirmBarcosFleet(prev, localPlayer.id, localPlayer.name));
    }
  };

  const handleFireAt = (row: number, col: number) => {
    if (!isMyTurn || !opponentBoard) return;
    if (opponentBoard.incomingShots.some((s) => s.row === row && s.col === col)) return;

    if (mode === 'online') {
      onOnlineAction?.({ kind: 'fire', row, col });
    } else {
      setAiState((prev) => fireBarcosShot(prev, localPlayer.id, row, col, localPlayer.name));
    }
  };

  const handlePlayAgainAi = () => {
    if (mode !== 'ai') return;
    reportedMatchRef.current = null;
    lastSoundTurnRef.current = -1;
    setSelectedShipId('carrier');
    setOrientation('H');
    setAiState(
      createBarcosGame(
        [localPlayer.id, AI_ADMIRAL_ID],
        { [localPlayer.id]: localPlayer.name, [AI_ADMIRAL_ID]: 'Almirante IA' },
        [AI_ADMIRAL_ID]
      )
    );
  };

  // Precompute shot maps
  const myIncomingMap = useMemo(() => {
    const map = new Map<string, BarcosShot>();
    for (const s of myBoard?.incomingShots || []) map.set(`${s.row},${s.col}`, s);
    return map;
  }, [myBoard]);

  const oppIncomingMap = useMemo(() => {
    const map = new Map<string, BarcosShot>();
    for (const s of opponentBoard?.incomingShots || []) map.set(`${s.row},${s.col}`, s);
    return map;
  }, [opponentBoard]);

  // Precompute hover footprint validity on My Fleet grid during setup
  const previewCells = useMemo(() => {
    if (!inSetup || !hoverCell || !myBoard) return null;
    const ship = myBoard.ships.find((s) => s.id === selectedShipId);
    if (!ship) return null;
    const valid = canPlaceBarcosShip(
      myBoard.ships,
      selectedShipId,
      hoverCell.row,
      hoverCell.col,
      orientation,
      BARCOS_GRID_SIZE
    );
    const cells = new Set<string>();
    for (let i = 0; i < ship.size; i++) {
      const r = orientation === 'V' ? hoverCell.row + i : hoverCell.row;
      const c = orientation === 'H' ? hoverCell.col + i : hoverCell.col;
      if (r >= 0 && r < BARCOS_GRID_SIZE && c >= 0 && c < BARCOS_GRID_SIZE) {
        cells.add(`${r},${c}`);
      }
    }
    return { valid, cells };
  }, [inSetup, hoverCell, myBoard, selectedShipId, orientation]);

  // Quick lookup: if player clicks an existing ship cell on My Fleet during setup, select that ship
  const myShipAtCell = useMemo(() => {
    const map = new Map<string, BarcosShip>();
    for (const s of myBoard?.ships || []) {
      for (const c of getShipCells(s)) {
        map.set(`${c.row},${c.col}`, s);
      }
    }
    return map;
  }, [myBoard]);

  const myShipsAlive = myBoard ? myBoard.ships.filter((s) => !s.sunk).length : 0;
  const oppShipsAlive = opponentBoard ? opponentBoard.ships.filter((s) => !s.sunk).length : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Top Command HUD */}
      <div className="surface-3d-panel rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExit}
            className="min-h-[40px] px-3.5 rounded-lg bg-white/8 hover:bg-white/14 border border-white/10 text-xs font-medium text-stone-200 flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            {isEs ? 'Salón' : 'Salon'}
          </button>
          <div>
            <h2 className="text-base sm:text-lg font-display font-bold text-[#f4f1ea] flex items-center gap-2">
              <Anchor className="w-4 h-4 text-sky-400" />
              <span>Barcos de Guerra · {mode === 'online' ? 'Online 1v1' : isEs ? 'Contra Almirante IA' : 'vs Admiral AI'}</span>
            </h2>
            <p className="text-xs text-amber-200/85">{state.lastActionText}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="font-mono-num text-stone-300">
            {isEs ? 'Tu Flota' : 'Your Fleet'}:{' '}
            <span className="font-bold text-emerald-300">{myShipsAlive}/5</span>
          </div>
          <div className="font-mono-num text-stone-300">
            {opponentName}:{' '}
            <span className="font-bold text-rose-300">{oppShipsAlive}/5</span>
          </div>
          {state.phase === 'battle' && (
            <div
              className={`font-semibold ${
                isMyTurn ? 'text-emerald-300' : 'text-amber-300'
              }`}
            >
              {isMyTurn
                ? isEs
                  ? 'Tu Salva — Elige Coordenada'
                  : 'Your Turn — Fire Torpedo'
                : isEs
                ? `Turno de ${opponentName}`
                : `${opponentName}'s Turn`}
            </div>
          )}
        </div>
      </div>

      {/* Main 3D Mahogany & Brass Naval Table */}
      <div className="wood-tabletop rounded-3xl p-2.5 sm:p-4 tabletop-3d-stage">
        <div className="tabletop-3d-cabinet rounded-2xl p-[3px]">
          <div className="brass-bezel rounded-[14px] p-[2px]">
            <div className="ocean-radar-hd rounded-[12px] p-4 sm:p-6 space-y-5">
              {/* Setup Toolbar */}
              {state.phase === 'setup' && (
                <div className="rounded-xl bg-black/35 border border-sky-400/20 p-3.5 space-y-3">
                  {inSetup ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-sky-200">
                          <Compass className="w-4 h-4 text-amber-300" />
                          <span>
                            {isEs
                              ? 'Selecciona un barco y haz clic en Tu Flota para reubicarlo (Tecla R rota):'
                              : 'Select a ship and click your Fleet grid to reposition it (Press R to rotate):'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setOrientation((prev) => (prev === 'H' ? 'V' : 'H'))}
                            className="min-h-[38px] px-3 rounded-lg bg-white/8 hover:bg-white/14 border border-white/15 text-xs font-semibold text-[#f4f1ea] flex items-center gap-1.5 cursor-pointer"
                          >
                            <RotateCw className="w-3.5 h-3.5 text-sky-300" />
                            {orientation === 'H'
                              ? isEs
                                ? 'Horizontal'
                                : 'Horizontal'
                              : isEs
                              ? 'Vertical'
                              : 'Vertical'}
                          </button>
                          <button
                            type="button"
                            onClick={handleRandomizeFleet}
                            className="min-h-[38px] px-3 rounded-lg bg-white/8 hover:bg-white/14 border border-white/15 text-xs font-semibold text-[#f4f1ea] flex items-center gap-1.5 cursor-pointer"
                          >
                            <Shuffle className="w-3.5 h-3.5 text-amber-300" />
                            {isEs ? 'Aleatoria' : 'Randomize'}
                          </button>
                          <button
                            type="button"
                            onClick={handleDeployFleet}
                            className="min-h-[38px] px-4 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-[0_3px_0_#064e3b]"
                          >
                            <ShieldCheck className="w-4 h-4" />
                            {isEs ? '¡Desplegar Flota!' : 'Deploy Fleet'}
                          </button>
                        </div>
                      </div>

                      {/* Selectable 5-Ship Dock */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {myBoard?.ships.map((s) => {
                          const selected = s.id === selectedShipId;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => handleSelectShip(s)}
                              className={`min-h-[44px] px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                                selected
                                  ? 'bg-sky-500/25 border-sky-300 text-white'
                                  : 'bg-black/30 border-white/10 text-stone-300 hover:border-white/25'
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs font-semibold">
                                <span className="truncate">{isEs ? s.nameEs : s.nameEn}</span>
                                <span className="font-mono-num text-amber-300">{s.size}</span>
                              </div>
                              <div className="flex items-center gap-1 mt-1.5">
                                {Array.from({ length: s.size }).map((_, idx) => (
                                  <span
                                    key={idx}
                                    className={`h-1.5 flex-1 rounded-sm ${
                                      selected ? 'bg-sky-300' : 'bg-stone-500'
                                    }`}
                                  />
                                ))}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-2 text-sm text-emerald-300 font-medium">
                      {isEs
                        ? `Flota desplegada. Esperando a que ${opponentName} confirme su formación...`
                        : `Fleet deployed. Waiting for ${opponentName} to lock formation...`}
                    </div>
                  )}
                </div>
              )}

              {/* Dual 10×10 3D Naval Boards */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                {/* LEFT BOARD: ENEMY TARGET RADAR */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 text-sm font-display font-bold text-[#f4f1ea]">
                      <Crosshair className="w-4 h-4 text-rose-400" />
                      <span>
                        {isEs ? `Radar Enemigo (${opponentName})` : `Enemy Radar (${opponentName})`}
                      </span>
                    </div>
                    <span className="text-xs font-mono-num text-sky-200/80">
                      {oppShipsAlive}/5 {isEs ? 'a flote' : 'afloat'}
                    </span>
                  </div>

                  <div className="rounded-xl bg-[#04141f]/90 border border-sky-400/25 p-2.5 sm:p-3 shadow-[inset_0_4px_14px_rgba(0,0,0,0.85)]">
                    {/* Column Headers A-J */}
                    <div className="grid grid-cols-[24px_repeat(10,minmax(0,1fr))] gap-1 mb-1">
                      <div />
                      {COL_HEADERS.map((col) => (
                        <div
                          key={col}
                          className="text-center text-[11px] font-mono-num font-bold text-sky-300/75"
                        >
                          {col}
                        </div>
                      ))}
                    </div>

                    {/* 10x10 Grid Wrapper with Relative Overlay for Revealed Sunken Enemy Ships */}
                    <div className="grid grid-cols-[24px_minmax(0,1fr)] gap-1 items-stretch">
                      {/* Row Numbers 1-10 */}
                      <div className="grid grid-rows-10 gap-1">
                        {Array.from({ length: BARCOS_GRID_SIZE }).map((_, r) => (
                          <div
                            key={r}
                            className="flex items-center justify-center text-[11px] font-mono-num font-bold text-sky-300/75"
                          >
                            {r + 1}
                          </div>
                        ))}
                      </div>

                      <div className="relative grid grid-cols-10 grid-rows-10 gap-1 aspect-square">
                        {/* Revealed / Sunken Enemy Ships (plus remaining ships when phase === 'finished') */}
                        {opponentBoard?.ships
                          .filter((s) => s.placed && (s.sunk || state.phase === 'finished'))
                          .map((ship) => {
                            const leftPct = (ship.col / BARCOS_GRID_SIZE) * 100;
                            const topPct = (ship.row / BARCOS_GRID_SIZE) * 100;
                            const widthPct =
                              ((ship.orientation === 'H' ? ship.size : 1) / BARCOS_GRID_SIZE) * 100;
                            const heightPct =
                              ((ship.orientation === 'V' ? ship.size : 1) / BARCOS_GRID_SIZE) * 100;
                            return (
                              <div
                                key={ship.id}
                                className="absolute pointer-events-none z-10 p-0.5"
                                style={{
                                  left: `${leftPct}%`,
                                  top: `${topPct}%`,
                                  width: `${widthPct}%`,
                                  height: `${heightPct}%`,
                                }}
                              >
                                <WarshipHullSvg ship={ship} sunk={ship.sunk} />
                              </div>
                            );
                          })}

                        {Array.from({ length: BARCOS_GRID_SIZE * BARCOS_GRID_SIZE }).map((_, idx) => {
                          const row = Math.floor(idx / BARCOS_GRID_SIZE);
                          const col = idx % BARCOS_GRID_SIZE;
                          const shot = oppIncomingMap.get(`${row},${col}`);
                          const canFire = isMyTurn && !shot;
                          const isLast =
                            state.lastShot &&
                            state.lastShot.targetId === opponentId &&
                            state.lastShot.row === row &&
                            state.lastShot.col === col;

                          return (
                            <button
                              key={`${row}-${col}`}
                              type="button"
                              disabled={!canFire}
                              onClick={() => handleFireAt(row, col)}
                              aria-label={`Fire ${barcosCoordLabel(row, col)}`}
                              className={`relative rounded-[4px] border flex items-center justify-center transition-all ${
                                shot?.result === 'hit' || shot?.result === 'sunk'
                                  ? 'bg-rose-950/75 border-rose-500/45'
                                  : shot?.result === 'miss'
                                  ? 'bg-sky-950/60 border-sky-400/20'
                                  : canFire
                                  ? 'bg-[#0b3349]/80 hover:bg-sky-500/35 border-sky-300/20 hover:border-amber-300 cursor-crosshair'
                                  : 'bg-[#0a2a3c]/75 border-sky-400/15 cursor-default'
                              } ${isLast ? 'ring-2 ring-amber-300 z-20' : ''}`}
                            >
                              {shot?.result === 'miss' && (
                                <span className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-gradient-to-br from-white via-sky-100 to-sky-400 shadow-[0_2px_4px_rgba(0,0,0,0.75)] z-20" />
                              )}
                              {(shot?.result === 'hit' || shot?.result === 'sunk') && (
                                <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-gradient-to-br from-amber-300 via-rose-500 to-red-800 shadow-[0_0_10px_rgba(244,63,94,0.9),0_2px_4px_rgba(0,0,0,0.85)] z-20" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Enemy Fleet Roster */}
                  <div className="grid grid-cols-5 gap-1.5 text-[11px]">
                    {opponentBoard?.ships.map((s) => (
                      <div
                        key={s.id}
                        className={`px-2 py-1.5 rounded-lg border text-center truncate ${
                          s.sunk
                            ? 'bg-rose-950/45 border-rose-500/30 text-rose-300 line-through'
                            : 'bg-black/30 border-white/10 text-stone-300'
                        }`}
                      >
                        {isEs ? s.nameEs : s.nameEn} ({s.size})
                      </div>
                    ))}
                  </div>
                </div>

                {/* RIGHT BOARD: MY FLEET GRID */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 text-sm font-display font-bold text-[#f4f1ea]">
                      <Ship className="w-4 h-4 text-emerald-400" />
                      <span>{isEs ? 'Tu Flota Naval' : 'Your Naval Fleet'}</span>
                    </div>
                    <span className="text-xs font-mono-num text-emerald-300">
                      {myShipsAlive}/5 {isEs ? 'intactos' : 'intact'}
                    </span>
                  </div>

                  <div className="rounded-xl bg-[#04141f]/90 border border-emerald-400/25 p-2.5 sm:p-3 shadow-[inset_0_4px_14px_rgba(0,0,0,0.85)]">
                    {/* Column Headers A-J */}
                    <div className="grid grid-cols-[24px_repeat(10,minmax(0,1fr))] gap-1 mb-1">
                      <div />
                      {COL_HEADERS.map((col) => (
                        <div
                          key={col}
                          className="text-center text-[11px] font-mono-num font-bold text-emerald-300/75"
                        >
                          {col}
                        </div>
                      ))}
                    </div>

                    <div
                      className="grid grid-cols-[24px_minmax(0,1fr)] gap-1 items-stretch"
                      onMouseLeave={() => setHoverCell(null)}
                    >
                      {/* Row Numbers 1-10 */}
                      <div className="grid grid-rows-10 gap-1">
                        {Array.from({ length: BARCOS_GRID_SIZE }).map((_, r) => (
                          <div
                            key={r}
                            className="flex items-center justify-center text-[11px] font-mono-num font-bold text-emerald-300/75"
                          >
                            {r + 1}
                          </div>
                        ))}
                      </div>

                      <div className="relative grid grid-cols-10 grid-rows-10 gap-1 aspect-square">
                        {/* Placed Player Ships SVG Layer */}
                        {myBoard?.ships
                          .filter((s) => s.placed)
                          .map((ship) => {
                            const leftPct = (ship.col / BARCOS_GRID_SIZE) * 100;
                            const topPct = (ship.row / BARCOS_GRID_SIZE) * 100;
                            const widthPct =
                              ((ship.orientation === 'H' ? ship.size : 1) / BARCOS_GRID_SIZE) * 100;
                            const heightPct =
                              ((ship.orientation === 'V' ? ship.size : 1) / BARCOS_GRID_SIZE) * 100;
                            const isSelected = inSetup && selectedShipId === ship.id;
                            return (
                              <div
                                key={ship.id}
                                className={`absolute pointer-events-none z-10 p-0.5 rounded-md transition-all ${
                                  isSelected ? 'ring-2 ring-amber-300 bg-amber-400/15' : ''
                                }`}
                                style={{
                                  left: `${leftPct}%`,
                                  top: `${topPct}%`,
                                  width: `${widthPct}%`,
                                  height: `${heightPct}%`,
                                }}
                              >
                                <WarshipHullSvg ship={ship} sunk={ship.sunk} />
                              </div>
                            );
                          })}

                        {Array.from({ length: BARCOS_GRID_SIZE * BARCOS_GRID_SIZE }).map((_, idx) => {
                          const row = Math.floor(idx / BARCOS_GRID_SIZE);
                          const col = idx % BARCOS_GRID_SIZE;
                          const shot = myIncomingMap.get(`${row},${col}`);
                          const inPreview = previewCells?.cells.has(`${row},${col}`);
                          const existingShip = myShipAtCell.get(`${row},${col}`);
                          const isLast =
                            state.lastShot &&
                            state.lastShot.targetId === localPlayer.id &&
                            state.lastShot.row === row &&
                            state.lastShot.col === col;

                          return (
                            <button
                              key={`${row}-${col}`}
                              type="button"
                              disabled={!inSetup}
                              onMouseEnter={() => {
                                if (inSetup) setHoverCell({ row, col });
                              }}
                              onClick={() => {
                                if (!inSetup) return;
                                if (existingShip && existingShip.id !== selectedShipId) {
                                  handleSelectShip(existingShip);
                                } else {
                                  handlePlaceShipAt(row, col);
                                }
                              }}
                              aria-label={`Fleet cell ${barcosCoordLabel(row, col)}`}
                              className={`relative rounded-[4px] border flex items-center justify-center transition-colors ${
                                inPreview
                                  ? previewCells?.valid
                                    ? 'bg-emerald-500/40 border-emerald-300'
                                    : 'bg-rose-500/45 border-rose-400'
                                  : inSetup
                                  ? 'bg-[#09293b]/80 hover:bg-[#0f3f59] border-sky-400/20 cursor-pointer'
                                  : 'bg-[#082433]/80 border-sky-400/15 cursor-default'
                              } ${isLast ? 'ring-2 ring-amber-300 z-20' : ''}`}
                            >
                              {shot?.result === 'miss' && (
                                <span className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-gradient-to-br from-white via-sky-100 to-sky-400 shadow-[0_2px_4px_rgba(0,0,0,0.75)] z-20" />
                              )}
                              {(shot?.result === 'hit' || shot?.result === 'sunk') && (
                                <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-gradient-to-br from-amber-300 via-rose-500 to-red-800 shadow-[0_0_10px_rgba(244,63,94,0.9),0_2px_4px_rgba(0,0,0,0.85)] z-20" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* My Fleet Roster */}
                  <div className="grid grid-cols-5 gap-1.5 text-[11px]">
                    {myBoard?.ships.map((s) => (
                      <div
                        key={s.id}
                        className={`px-2 py-1.5 rounded-lg border text-center truncate ${
                          s.sunk
                            ? 'bg-rose-950/45 border-rose-500/30 text-rose-300 line-through'
                            : 'bg-black/30 border-emerald-500/20 text-emerald-200'
                        }`}
                      >
                        {isEs ? s.nameEs : s.nameEn} ({s.size - s.hits.length}/{s.size})
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Match Completed Overlay Banner */}
              {state.phase === 'finished' && (
                <div className="rounded-xl bg-black/55 border border-amber-400/35 p-5 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-display font-bold text-[#f4f1ea]">
                      {state.winnerId === localPlayer.id
                        ? isEs
                          ? '¡Victoria Naval!'
                          : 'Naval Victory!'
                        : isEs
                        ? 'Flota Derrotada'
                        : 'Fleet Defeated'}
                    </h3>
                    <p className="text-xs text-stone-300 mt-0.5">{state.lastActionText}</p>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {mode === 'ai' && (
                      <button
                        type="button"
                        onClick={handlePlayAgainAi}
                        className="min-h-[42px] px-4 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-4 h-4" />
                        {isEs ? 'Nueva Batalla' : 'Play Again'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onExit}
                      className="min-h-[42px] px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-stone-100 cursor-pointer"
                    >
                      {isEs ? 'Volver al Salón' : 'Return to Salon'}
                    </button>
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
