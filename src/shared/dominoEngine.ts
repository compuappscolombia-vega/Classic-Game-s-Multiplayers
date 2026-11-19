import type { DominoState, DominoTile, PlacedDomino } from './types.ts';

export function createDeck(): DominoTile[] {
  const tiles: DominoTile[] = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      tiles.push({ id: `${a}-${b}`, a, b });
    }
  }
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = tiles[i];
    tiles[i] = tiles[j];
    tiles[j] = tmp;
  }
  return tiles;
}

export function tilePips(tile: DominoTile): number {
  return tile.a + tile.b;
}

export function createDominoGame(playerIds: string[], playerNames: Record<string, string>): DominoState {
  const deck = createDeck();
  const hands: Record<string, DominoTile[]> = {};
  const handCounts: Record<string, number> = {};
  const scores: Record<string, number> = {};

  const tilesPerPlayer = 7;
  let offset = 0;
  for (const pid of playerIds) {
    hands[pid] = deck.slice(offset, offset + tilesPerPlayer);
    handCounts[pid] = hands[pid].length;
    scores[pid] = 0;
    offset += tilesPerPlayer;
  }

  const boneyard = deck.slice(offset);

  // Find starter: highest double, else highest pip tile
  let starterIndex = 0;
  let bestScore = -1;
  playerIds.forEach((pid, idx) => {
    for (const t of hands[pid]) {
      const rank = t.a === t.b ? 100 + t.a : tilePips(t);
      if (rank > bestScore) {
        bestScore = rank;
        starterIndex = idx;
      }
    }
  });

  return {
    board: [],
    leftEnd: null,
    rightEnd: null,
    hands,
    handCounts,
    boneyard,
    boneyardCount: boneyard.length,
    turnOrder: [...playerIds],
    currentTurnIndex: starterIndex,
    consecutivePasses: 0,
    winnerId: null,
    winReason: null,
    scores,
    lastActionText: `${playerNames[playerIds[starterIndex]] ?? 'Player'} opens the round.`,
  };
}

export interface DominoPlayOption {
  tileId: string;
  side: 'left' | 'right';
}

export function getPlayableDominoMoves(
  hand: DominoTile[],
  leftEnd: number | null,
  rightEnd: number | null
): DominoPlayOption[] {
  if (leftEnd === null || rightEnd === null) {
    return hand.map((t) => ({ tileId: t.id, side: 'right' as const }));
  }
  const moves: DominoPlayOption[] = [];
  for (const t of hand) {
    if (t.a === leftEnd || t.b === leftEnd) {
      moves.push({ tileId: t.id, side: 'left' });
    }
    if ((t.a === rightEnd || t.b === rightEnd) && leftEnd !== rightEnd) {
      moves.push({ tileId: t.id, side: 'right' });
    } else if ((t.a === rightEnd || t.b === rightEnd) && leftEnd === rightEnd) {
      // Allow right side option too if board has >0 tiles
      moves.push({ tileId: t.id, side: 'right' });
    }
  }
  return moves;
}

function resolveBlockedWinner(state: DominoState): string {
  let bestId = state.turnOrder[0];
  let lowestSum = Number.MAX_SAFE_INTEGER;
  for (const pid of state.turnOrder) {
    const sum = (state.hands[pid] || []).reduce((acc, t) => acc + tilePips(t), 0);
    if (sum < lowestSum) {
      lowestSum = sum;
      bestId = pid;
    }
  }
  return bestId;
}

function calculateWinPoints(state: DominoState, winnerId: string): number {
  let points = 0;
  for (const pid of state.turnOrder) {
    if (pid !== winnerId) {
      points += (state.hands[pid] || []).reduce((acc, t) => acc + tilePips(t), 0);
    }
  }
  return Math.max(points, 10);
}

export function applyDominoPlay(
  state: DominoState,
  playerId: string,
  tileId: string,
  side: 'left' | 'right',
  playerName: string
): DominoState {
  if (state.winnerId) return state;
  const activeId = state.turnOrder[state.currentTurnIndex];
  if (activeId !== playerId) return state;

  const hand = state.hands[playerId] || [];
  const tileIdx = hand.findIndex((t) => t.id === tileId);
  if (tileIdx === -1) return state;
  const tile = hand[tileIdx];

  let placed: PlacedDomino;
  let newLeft = state.leftEnd;
  let newRight = state.rightEnd;
  let newBoard: PlacedDomino[];

  if (state.board.length === 0 || state.leftEnd === null || state.rightEnd === null) {
    placed = {
      id: tile.id,
      left: tile.a,
      right: tile.b,
      isDouble: tile.a === tile.b,
      playedBy: playerId,
    };
    newLeft = placed.left;
    newRight = placed.right;
    newBoard = [placed];
  } else if (side === 'left') {
    if (tile.b === state.leftEnd) {
      placed = { id: tile.id, left: tile.a, right: tile.b, isDouble: tile.a === tile.b, playedBy: playerId };
    } else if (tile.a === state.leftEnd) {
      placed = { id: tile.id, left: tile.b, right: tile.a, isDouble: tile.a === tile.b, playedBy: playerId };
    } else {
      return state;
    }
    newLeft = placed.left;
    newBoard = [placed, ...state.board];
  } else {
    if (tile.a === state.rightEnd) {
      placed = { id: tile.id, left: tile.a, right: tile.b, isDouble: tile.a === tile.b, playedBy: playerId };
    } else if (tile.b === state.rightEnd) {
      placed = { id: tile.id, left: tile.b, right: tile.a, isDouble: tile.a === tile.b, playedBy: playerId };
    } else {
      return state;
    }
    newRight = placed.right;
    newBoard = [...state.board, placed];
  }

  const nextHand = hand.filter((_, idx) => idx !== tileIdx);
  const nextHands = { ...state.hands, [playerId]: nextHand };
  const nextCounts = { ...state.handCounts, [playerId]: nextHand.length };

  if (nextHand.length === 0) {
    const pts = calculateWinPoints({ ...state, hands: nextHands }, playerId);
    return {
      ...state,
      board: newBoard,
      leftEnd: newLeft,
      rightEnd: newRight,
      hands: nextHands,
      handCounts: nextCounts,
      consecutivePasses: 0,
      winnerId: playerId,
      winReason: 'emptied',
      scores: { ...state.scores, [playerId]: (state.scores[playerId] || 0) + pts },
      lastActionText: `${playerName} played [${tile.a}|${tile.b}] and Dominoed for +${pts} pts!`,
    };
  }

  return {
    ...state,
    board: newBoard,
    leftEnd: newLeft,
    rightEnd: newRight,
    hands: nextHands,
    handCounts: nextCounts,
    currentTurnIndex: (state.currentTurnIndex + 1) % state.turnOrder.length,
    consecutivePasses: 0,
    lastActionText: `${playerName} played [${tile.a}|${tile.b}].`,
  };
}

export function drawDominoFromBoneyard(
  state: DominoState,
  playerId: string,
  playerName: string
): DominoState {
  if (state.winnerId) return state;
  if (state.turnOrder[state.currentTurnIndex] !== playerId) return state;
  if (state.boneyard.length === 0) return state;

  const drawn = state.boneyard[0];
  const nextBoneyard = state.boneyard.slice(1);
  const nextHand = [...(state.hands[playerId] || []), drawn];

  return {
    ...state,
    hands: { ...state.hands, [playerId]: nextHand },
    handCounts: { ...state.handCounts, [playerId]: nextHand.length },
    boneyard: nextBoneyard,
    boneyardCount: nextBoneyard.length,
    lastActionText: `${playerName} drew a tile from the boneyard.`,
  };
}

export function passDominoTurn(
  state: DominoState,
  playerId: string,
  playerName: string
): DominoState {
  if (state.winnerId) return state;
  if (state.turnOrder[state.currentTurnIndex] !== playerId) return state;

  const nextPasses = state.consecutivePasses + 1;
  if (nextPasses >= state.turnOrder.length && state.boneyard.length === 0) {
    const winnerId = resolveBlockedWinner(state);
    const pts = calculateWinPoints(state, winnerId);
    return {
      ...state,
      consecutivePasses: nextPasses,
      winnerId,
      winReason: 'blocked',
      scores: { ...state.scores, [winnerId]: (state.scores[winnerId] || 0) + pts },
      lastActionText: `Game blocked! Lowest pip count wins +${pts} pts.`,
    };
  }

  return {
    ...state,
    currentTurnIndex: (state.currentTurnIndex + 1) % state.turnOrder.length,
    consecutivePasses: nextPasses,
    lastActionText: `${playerName} passed.`,
  };
}

export function chooseAiDominoAction(
  state: DominoState,
  aiId: string
): { action: 'play'; tileId: string; side: 'left' | 'right' } | { action: 'draw' } | { action: 'pass' } {
  const hand = state.hands[aiId] || [];
  const moves = getPlayableDominoMoves(hand, state.leftEnd, state.rightEnd);

  if (moves.length > 0) {
    // Score moves: prefer doubles & high-pip tiles & matching numbers we have more of
    const pipFreq: Record<number, number> = {};
    for (const t of hand) {
      pipFreq[t.a] = (pipFreq[t.a] || 0) + 1;
      pipFreq[t.b] = (pipFreq[t.b] || 0) + 1;
    }

    let bestMove = moves[0];
    let bestValue = -999;
    for (const m of moves) {
      const tile = hand.find((t) => t.id === m.tileId)!;
      const doubleBonus = tile.a === tile.b ? 14 : 0;
      const pipScore = tile.a + tile.b;
      const freqScore = (pipFreq[tile.a] || 0) + (pipFreq[tile.b] || 0);
      const total = doubleBonus + pipScore + freqScore * 1.5;
      if (total > bestValue) {
        bestValue = total;
        bestMove = m;
      }
    }
    return { action: 'play', tileId: bestMove.tileId, side: bestMove.side };
  }

  if (state.boneyard.length > 0) {
    return { action: 'draw' };
  }
  return { action: 'pass' };
}

export function sanitizeDominoForPlayer(state: DominoState, viewerId: string): DominoState {
  const maskedHands: Record<string, DominoTile[]> = {};
  for (const pid of state.turnOrder) {
    maskedHands[pid] = pid === viewerId || state.winnerId ? state.hands[pid] || [] : [];
  }
  return {
    ...state,
    hands: maskedHands,
    boneyard: [], // hide boneyard tile order from clients
  };
}
