import type {
  BarcosBoardState,
  BarcosOrientation,
  BarcosShip,
  BarcosShipId,
  BarcosState,
} from './types.ts';

export const BARCOS_GRID_SIZE = 10;

interface ShipSpec {
  id: BarcosShipId;
  nameEn: string;
  nameEs: string;
  size: number;
}

export const BARCOS_FLEET_SPECS: ShipSpec[] = [
  { id: 'carrier', nameEn: 'Aircraft Carrier', nameEs: 'Portaaviones', size: 5 },
  { id: 'battleship', nameEn: 'Battleship', nameEs: 'Acorazado', size: 4 },
  { id: 'cruiser', nameEn: 'Cruiser', nameEs: 'Crucero', size: 3 },
  { id: 'submarine', nameEn: 'Submarine', nameEs: 'Submarino', size: 3 },
  { id: 'destroyer', nameEn: 'Destroyer', nameEs: 'Destructor', size: 2 },
];

export function barcosCoordLabel(row: number, col: number): string {
  const colLetter = String.fromCharCode(65 + col);
  return `${colLetter}${row + 1}`;
}

export function getShipCells(
  ship: Pick<BarcosShip, 'row' | 'col' | 'orientation' | 'size' | 'placed'>
): { row: number; col: number }[] {
  if (!ship.placed || ship.row < 0 || ship.col < 0) return [];
  const cells: { row: number; col: number }[] = [];
  for (let i = 0; i < ship.size; i++) {
    cells.push({
      row: ship.orientation === 'V' ? ship.row + i : ship.row,
      col: ship.orientation === 'H' ? ship.col + i : ship.col,
    });
  }
  return cells;
}

export function canPlaceBarcosShip(
  ships: BarcosShip[],
  shipId: BarcosShipId,
  row: number,
  col: number,
  orientation: BarcosOrientation,
  gridSize = BARCOS_GRID_SIZE
): boolean {
  const target = ships.find((s) => s.id === shipId);
  if (!target) return false;

  if (row < 0 || col < 0) return false;
  if (orientation === 'H' && col + target.size > gridSize) return false;
  if (orientation === 'V' && row + target.size > gridSize) return false;
  if (orientation === 'H' && row >= gridSize) return false;
  if (orientation === 'V' && col >= gridSize) return false;

  const occupied = new Set<string>();
  for (const s of ships) {
    if (s.id === shipId || !s.placed) continue;
    for (const c of getShipCells(s)) {
      occupied.add(`${c.row},${c.col}`);
    }
  }

  for (let i = 0; i < target.size; i++) {
    const r = orientation === 'V' ? row + i : row;
    const c = orientation === 'H' ? col + i : col;
    if (occupied.has(`${r},${c}`)) return false;
  }
  return true;
}

export function generateRandomFleet(gridSize = BARCOS_GRID_SIZE): BarcosShip[] {
  let ships: BarcosShip[] = BARCOS_FLEET_SPECS.map((spec) => ({
    id: spec.id,
    nameEn: spec.nameEn,
    nameEs: spec.nameEs,
    size: spec.size,
    row: -1,
    col: -1,
    orientation: 'H',
    placed: false,
    hits: [],
    sunk: false,
  }));

  for (const spec of BARCOS_FLEET_SPECS) {
    let placed = false;
    for (let attempt = 0; attempt < 250; attempt++) {
      const orientation: BarcosOrientation = Math.random() < 0.5 ? 'H' : 'V';
      const maxRow = orientation === 'V' ? gridSize - spec.size : gridSize - 1;
      const maxCol = orientation === 'H' ? gridSize - spec.size : gridSize - 1;
      const row = Math.floor(Math.random() * (maxRow + 1));
      const col = Math.floor(Math.random() * (maxCol + 1));
      if (canPlaceBarcosShip(ships, spec.id, row, col, orientation, gridSize)) {
        ships = ships.map((s) =>
          s.id === spec.id ? { ...s, row, col, orientation, placed: true } : s
        );
        placed = true;
        break;
      }
    }
    if (!placed) {
      return generateRandomFleet(gridSize);
    }
  }

  return ships;
}

export function createBarcosGame(
  playerIds: [string, string],
  playerNames: Record<string, string>,
  autoReadyIds: string[] = []
): BarcosState {
  const [p1, p2] = playerIds;
  const p1Ready = autoReadyIds.includes(p1);
  const p2Ready = autoReadyIds.includes(p2);
  const bothReady = p1Ready && p2Ready;

  const boards: Record<string, BarcosBoardState> = {
    [p1]: {
      playerId: p1,
      ready: p1Ready,
      ships: generateRandomFleet(BARCOS_GRID_SIZE),
      incomingShots: [],
    },
    [p2]: {
      playerId: p2,
      ready: p2Ready,
      ships: generateRandomFleet(BARCOS_GRID_SIZE),
      incomingShots: [],
    },
  };

  return {
    gridSize: BARCOS_GRID_SIZE,
    boards,
    turnOrder: [p1, p2],
    currentTurnIndex: 0,
    phase: bothReady ? 'battle' : 'setup',
    winnerId: null,
    lastShot: null,
    turnCount: 0,
    lastActionText: bothReady
      ? `Naval battle begins — ${playerNames[p1] || 'Admiral'} fires first.`
      : 'Position your fleet and press Deploy Fleet to begin.',
  };
}

export function placeBarcosShip(
  state: BarcosState,
  playerId: string,
  shipId: BarcosShipId,
  row: number,
  col: number,
  orientation: BarcosOrientation
): BarcosState {
  if (state.phase !== 'setup') return state;
  const board = state.boards[playerId];
  if (!board || board.ready) return state;

  if (!canPlaceBarcosShip(board.ships, shipId, row, col, orientation, state.gridSize)) {
    return state;
  }

  const nextShips = board.ships.map((s) =>
    s.id === shipId ? { ...s, row, col, orientation, placed: true } : s
  );

  return {
    ...state,
    boards: {
      ...state.boards,
      [playerId]: {
        ...board,
        ships: nextShips,
      },
    },
  };
}

export function randomizeBarcosFleet(state: BarcosState, playerId: string): BarcosState {
  if (state.phase !== 'setup') return state;
  const board = state.boards[playerId];
  if (!board || board.ready) return state;

  return {
    ...state,
    boards: {
      ...state.boards,
      [playerId]: {
        ...board,
        ships: generateRandomFleet(state.gridSize),
      },
    },
    lastActionText: 'Fleet repositioned to new coordinates.',
  };
}

export function confirmBarcosFleet(
  state: BarcosState,
  playerId: string,
  playerName: string
): BarcosState {
  if (state.phase !== 'setup') return state;
  const board = state.boards[playerId];
  if (!board || board.ready) return state;
  if (!board.ships.every((s) => s.placed)) return state;

  const updatedBoards: Record<string, BarcosBoardState> = {
    ...state.boards,
    [playerId]: {
      ...board,
      ready: true,
    },
  };

  const allReady = state.turnOrder.every((id) => updatedBoards[id]?.ready);

  return {
    ...state,
    boards: updatedBoards,
    phase: allReady ? 'battle' : 'setup',
    lastActionText: allReady
      ? 'Both fleets deployed! Battle stations — open fire!'
      : `${playerName} deployed fleet. Awaiting opponent...`,
  };
}

export function fireBarcosShot(
  state: BarcosState,
  shooterId: string,
  row: number,
  col: number,
  shooterName: string
): BarcosState {
  if (state.phase !== 'battle') return state;
  if (state.turnOrder[state.currentTurnIndex] !== shooterId) return state;
  if (row < 0 || row >= state.gridSize || col < 0 || col >= state.gridSize) return state;

  const targetId = state.turnOrder[state.currentTurnIndex === 0 ? 1 : 0];
  const targetBoard = state.boards[targetId];
  if (!targetBoard) return state;

  if (targetBoard.incomingShots.some((s) => s.row === row && s.col === col)) {
    return state;
  }

  let hitShip: BarcosShip | null = null;
  let hitOffset = -1;

  for (const ship of targetBoard.ships) {
    if (!ship.placed) continue;
    for (let i = 0; i < ship.size; i++) {
      const r = ship.orientation === 'V' ? ship.row + i : ship.row;
      const c = ship.orientation === 'H' ? ship.col + i : ship.col;
      if (r === row && c === col) {
        hitShip = ship;
        hitOffset = i;
        break;
      }
    }
    if (hitShip) break;
  }

  let result: 'miss' | 'hit' | 'sunk' = 'miss';
  let sunkShipId: BarcosShipId | undefined;

  if (hitShip) {
    const nextHitsCount = hitShip.hits.includes(hitOffset)
      ? hitShip.hits.length
      : hitShip.hits.length + 1;
    const nowSunk = nextHitsCount >= hitShip.size;
    result = nowSunk ? 'sunk' : 'hit';
    if (nowSunk) sunkShipId = hitShip.id;
  }

  const nextShips = targetBoard.ships.map((s) => {
    if (!hitShip || s.id !== hitShip.id) return s;
    const nextHits = s.hits.includes(hitOffset) ? s.hits : [...s.hits, hitOffset];
    const nowSunk = nextHits.length >= s.size;
    return {
      ...s,
      hits: nextHits,
      sunk: nowSunk,
    };
  });

  const nextShots = [
    ...targetBoard.incomingShots,
    { row, col, result, ...(sunkShipId ? { sunkShipId } : {}) },
  ];

  const allSunk = nextShips.every((s) => s.sunk);
  const coord = barcosCoordLabel(row, col);
  const nextTurnIndex =
    result === 'miss' && !allSunk ? (state.currentTurnIndex === 0 ? 1 : 0) : state.currentTurnIndex;

  let actionText = `${shooterName} fired at ${coord} — Splash (Miss).`;
  if (result === 'hit') {
    actionText = `${shooterName} hit enemy hull at ${coord}! Bonus shot.`;
  } else if (result === 'sunk' && hitShip) {
    actionText = allSunk
      ? `${shooterName} sank the ${hitShip.nameEn} at ${coord} — Total Naval Victory!`
      : `${shooterName} sank the ${hitShip.nameEn} at ${coord}! Bonus shot.`;
  }

  return {
    ...state,
    boards: {
      ...state.boards,
      [targetId]: {
        ...targetBoard,
        ships: nextShips,
        incomingShots: nextShots,
      },
    },
    currentTurnIndex: nextTurnIndex,
    phase: allSunk ? 'finished' : 'battle',
    winnerId: allSunk ? shooterId : null,
    lastShot: {
      shooterId,
      targetId,
      row,
      col,
      result,
      ...(sunkShipId ? { sunkShipId } : {}),
    },
    turnCount: state.turnCount + 1,
    lastActionText: actionText,
  };
}

export function chooseAiBarcosTarget(
  state: BarcosState,
  aiPlayerId: string
): { row: number; col: number } {
  const opponentId = state.turnOrder.find((id) => id !== aiPlayerId) || state.turnOrder[0];
  const oppBoard = state.boards[opponentId];
  const size = state.gridSize;

  const shotMap = new Map<string, 'miss' | 'hit' | 'sunk'>();
  const sunkCoords = new Set<string>();
  for (const s of oppBoard.ships) {
    if (s.sunk) {
      for (const c of getShipCells(s)) {
        sunkCoords.add(`${c.row},${c.col}`);
      }
    }
  }
  for (const shot of oppBoard.incomingShots) {
    shotMap.set(`${shot.row},${shot.col}`, shot.result);
  }

  // Active hits on unsunk ships
  const activeHits = oppBoard.incomingShots.filter(
    (s) => (s.result === 'hit' || s.result === 'sunk') && !sunkCoords.has(`${s.row},${s.col}`)
  );

  const inBounds = (r: number, c: number) => r >= 0 && r < size && c >= 0 && c < size;
  const isUnshot = (r: number, c: number) => inBounds(r, c) && !shotMap.has(`${r},${c}`);

  // If 2+ active hits align, prioritize extending along that axis
  if (activeHits.length >= 2) {
    const activeSet = new Set(activeHits.map((h) => `${h.row},${h.col}`));
    const alignedCandidates: { row: number; col: number }[] = [];

    for (const h of activeHits) {
      if (activeSet.has(`${h.row},${h.col + 1}`) || activeSet.has(`${h.row},${h.col - 1}`)) {
        if (isUnshot(h.row, h.col - 1)) alignedCandidates.push({ row: h.row, col: h.col - 1 });
        if (isUnshot(h.row, h.col + 1)) alignedCandidates.push({ row: h.row, col: h.col + 1 });
      }
      if (activeSet.has(`${h.row + 1},${h.col}`) || activeSet.has(`${h.row - 1},${h.col}`)) {
        if (isUnshot(h.row - 1, h.col)) alignedCandidates.push({ row: h.row - 1, col: h.col });
        if (isUnshot(h.row + 1, h.col)) alignedCandidates.push({ row: h.row + 1, col: h.col });
      }
    }

    if (alignedCandidates.length > 0) {
      return alignedCandidates[Math.floor(Math.random() * alignedCandidates.length)];
    }
  }

  // Target mode around any active hit
  if (activeHits.length > 0) {
    const orthogonal: { row: number; col: number }[] = [];
    const dirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];
    for (const h of activeHits) {
      for (const [dr, dc] of dirs) {
        const nr = h.row + dr;
        const nc = h.col + dc;
        if (isUnshot(nr, nc)) orthogonal.push({ row: nr, col: nc });
      }
    }
    if (orthogonal.length > 0) {
      return orthogonal[Math.floor(Math.random() * orthogonal.length)];
    }
  }

  // Hunt mode with checkerboard parity biased slightly toward central sectors
  const parityPool: { row: number; col: number; weight: number }[] = [];
  const fallbackPool: { row: number; col: number }[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isUnshot(r, c)) continue;
      fallbackPool.push({ row: r, col: c });
      if ((r + c) % 2 === 0) {
        const centerDist = Math.abs(r - 4.5) + Math.abs(c - 4.5);
        parityPool.push({ row: r, col: c, weight: Math.max(1, Math.round(10 - centerDist)) });
      }
    }
  }

  if (parityPool.length > 0) {
    const totalWeight = parityPool.reduce((acc, p) => acc + p.weight, 0);
    let pick = Math.random() * totalWeight;
    for (const cell of parityPool) {
      pick -= cell.weight;
      if (pick <= 0) return { row: cell.row, col: cell.col };
    }
    return { row: parityPool[0].row, col: parityPool[0].col };
  }

  return fallbackPool[Math.floor(Math.random() * fallbackPool.length)] || { row: 0, col: 0 };
}

export function sanitizeBarcosForPlayer(state: BarcosState, viewerId: string): BarcosState {
  if (state.phase === 'finished') {
    return state;
  }

  const sanitizedBoards: Record<string, BarcosBoardState> = {};
  for (const [pid, board] of Object.entries(state.boards)) {
    if (pid === viewerId) {
      sanitizedBoards[pid] = board;
    } else {
      sanitizedBoards[pid] = {
        playerId: board.playerId,
        ready: board.ready,
        incomingShots: board.incomingShots,
        ships: board.ships.map((s) =>
          s.sunk
            ? s
            : {
                id: s.id,
                nameEn: s.nameEn,
                nameEs: s.nameEs,
                size: s.size,
                row: -1,
                col: -1,
                orientation: 'H',
                placed: false,
                hits: [],
                sunk: false,
              }
        ),
      };
    }
  }

  return {
    ...state,
    boards: sanitizedBoards,
  };
}
