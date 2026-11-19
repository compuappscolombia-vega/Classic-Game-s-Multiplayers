import type { BingoCard, BingoPattern, BingoPlayerState, BingoState } from './types.ts';

export function generateBingoCard(): BingoCard {
  const ranges: [number, number][] = [
    [1, 15],   // B
    [16, 30],  // I
    [31, 45],  // N
    [46, 60],  // G
    [61, 75],  // O
  ];

  const cols: number[][] = ranges.map(([min, max]) => {
    const pool: number[] = [];
    for (let n = min; n <= max; n++) pool.push(n);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    return pool.slice(0, 5);
  });

  const grid: number[][] = [];
  for (let r = 0; r < 5; r++) {
    const row: number[] = [];
    for (let c = 0; c < 5; c++) {
      row.push(r === 2 && c === 2 ? 0 : cols[c][r]);
    }
    grid.push(row);
  }
  return { grid };
}

export function createEmptyDaubed(): boolean[][] {
  return Array.from({ length: 5 }, (_, r) =>
    Array.from({ length: 5 }, (_, c) => r === 2 && c === 2)
  );
}

export function formatBingoBall(num: number): string {
  if (num <= 15) return `B-${num}`;
  if (num <= 30) return `I-${num}`;
  if (num <= 45) return `N-${num}`;
  if (num <= 60) return `G-${num}`;
  return `O-${num}`;
}

export function createBingoGame(playerIds: string[], pattern: BingoPattern = 'line'): BingoState {
  const pool: number[] = [];
  for (let n = 1; n <= 75; n++) pool.push(n);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }

  const players: Record<string, BingoPlayerState> = {};
  for (const pid of playerIds) {
    players[pid] = {
      playerId: pid,
      card: generateBingoCard(),
      daubed: createEmptyDaubed(),
      progressPct: 4, // Free space
      claimedBingo: false,
    };
  }

  return {
    pattern,
    calledNumbers: [],
    currentBall: null,
    remainingPool: pool,
    players,
    winnerId: null,
    status: 'playing',
    lastActionText: 'Bingo cage ready! First ball drawing soon.',
  };
}

export function computeCardProgress(daubed: boolean[][], pattern: BingoPattern): number {
  if (pattern === 'full') {
    let count = 0;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (daubed[r][c]) count++;
    return Math.round((count / 25) * 100);
  }
  if (pattern === 'corners') {
    const corners = [daubed[0][0], daubed[0][4], daubed[4][0], daubed[4][4]];
    const hit = corners.filter(Boolean).length;
    return Math.round((hit / 4) * 100);
  }
  if (pattern === 'x') {
    let hit = 0;
    for (let i = 0; i < 5; i++) {
      if (daubed[i][i]) hit++;
      if (i !== 2 && daubed[i][4 - i]) hit++;
    }
    return Math.round((hit / 9) * 100);
  }

  // 'line': max line completion
  let maxLine = 0;
  for (let r = 0; r < 5; r++) {
    maxLine = Math.max(maxLine, daubed[r].filter(Boolean).length);
  }
  for (let c = 0; c < 5; c++) {
    let colCount = 0;
    for (let r = 0; r < 5; r++) if (daubed[r][c]) colCount++;
    maxLine = Math.max(maxLine, colCount);
  }
  let d1 = 0;
  let d2 = 0;
  for (let i = 0; i < 5; i++) {
    if (daubed[i][i]) d1++;
    if (daubed[i][4 - i]) d2++;
  }
  maxLine = Math.max(maxLine, d1, d2);
  return Math.round((maxLine / 5) * 100);
}

export function verifyBingoPattern(
  card: BingoCard,
  daubed: boolean[][],
  calledNumbers: number[],
  pattern: BingoPattern
): boolean {
  const calledSet = new Set(calledNumbers);
  const validCell = (r: number, c: number) => {
    if (r === 2 && c === 2) return true;
    return daubed[r][c] && calledSet.has(card.grid[r][c]);
  };

  if (pattern === 'corners') {
    return validCell(0, 0) && validCell(0, 4) && validCell(4, 0) && validCell(4, 4);
  }

  if (pattern === 'x') {
    for (let i = 0; i < 5; i++) {
      if (!validCell(i, i) || !validCell(i, 4 - i)) return false;
    }
    return true;
  }

  if (pattern === 'full') {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (!validCell(r, c)) return false;
      }
    }
    return true;
  }

  // 'line': any row, column, or diagonal
  for (let r = 0; r < 5; r++) {
    if ([0, 1, 2, 3, 4].every((c) => validCell(r, c))) return true;
  }
  for (let c = 0; c < 5; c++) {
    if ([0, 1, 2, 3, 4].every((r) => validCell(r, c))) return true;
  }
  if ([0, 1, 2, 3, 4].every((i) => validCell(i, i))) return true;
  if ([0, 1, 2, 3, 4].every((i) => validCell(i, 4 - i))) return true;
  return false;
}

export function drawNextBingoBall(state: BingoState, aiIds: string[] = []): BingoState {
  if (state.status !== 'playing' || state.remainingPool.length === 0) return state;

  const ball = state.remainingPool[0];
  const nextPool = state.remainingPool.slice(1);
  const calledNumbers = [...state.calledNumbers, ball];

  // Auto-daub AI players' cards
  const updatedPlayers: Record<string, BingoPlayerState> = { ...state.players };
  let aiWinner: string | null = null;

  for (const aiId of aiIds) {
    const ps = updatedPlayers[aiId];
    if (!ps) continue;
    const nextDaubed = ps.daubed.map((row, r) =>
      row.map((val, c) => val || ps.card.grid[r][c] === ball)
    );
    const pct = computeCardProgress(nextDaubed, state.pattern);
    updatedPlayers[aiId] = {
      ...ps,
      daubed: nextDaubed,
      progressPct: pct,
    };
    if (!aiWinner && verifyBingoPattern(ps.card, nextDaubed, calledNumbers, state.pattern)) {
      aiWinner = aiId;
    }
  }

  if (aiWinner) {
    updatedPlayers[aiWinner] = { ...updatedPlayers[aiWinner], claimedBingo: true };
    return {
      ...state,
      calledNumbers,
      currentBall: ball,
      remainingPool: nextPool,
      players: updatedPlayers,
      winnerId: aiWinner,
      status: 'finished',
      lastActionText: `${formatBingoBall(ball)} drawn — Opponent called BINGO!`,
    };
  }

  return {
    ...state,
    calledNumbers,
    currentBall: ball,
    remainingPool: nextPool,
    players: updatedPlayers,
    lastActionText: `Ball ${formatBingoBall(ball)} called!`,
  };
}

export function daubBingoCell(
  state: BingoState,
  playerId: string,
  row: number,
  col: number
): BingoState {
  if (state.status !== 'playing') return state;
  const ps = state.players[playerId];
  if (!ps) return state;

  const num = ps.card.grid[row]?.[col];
  if (num === undefined) return state;
  if (num !== 0 && !state.calledNumbers.includes(num)) return state;

  const nextDaubed = ps.daubed.map((rArr, r) =>
    rArr.map((val, c) => (r === row && c === col ? true : val))
  );
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...ps,
        daubed: nextDaubed,
        progressPct: computeCardProgress(nextDaubed, state.pattern),
      },
    },
  };
}

export function claimBingoWin(
  state: BingoState,
  playerId: string,
  playerName: string
): BingoState {
  if (state.status !== 'playing') return state;
  const ps = state.players[playerId];
  if (!ps) return state;

  const isValid = verifyBingoPattern(ps.card, ps.daubed, state.calledNumbers, state.pattern);
  if (!isValid) {
    return {
      ...state,
      lastActionText: `${playerName} called false BINGO — pattern not yet complete!`,
    };
  }

  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...ps, claimedBingo: true, progressPct: 100 },
    },
    winnerId: playerId,
    status: 'finished',
    lastActionText: `BINGO! ${playerName} wins the round!`,
  };
}

export function sanitizeBingoForClient(state: BingoState): BingoState {
  return {
    ...state,
    remainingPool: [], // hide upcoming ball sequence from clients
  };
}
