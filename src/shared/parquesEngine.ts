import type {
  ParquesColor,
  ParquesMoveOption,
  ParquesPlayerState,
  ParquesState,
} from './types.ts';

export const PARQUES_COLORS: ParquesColor[] = ['red', 'blue', 'yellow', 'green'];

// 68-square outer track (0..67)
export const EXIT_SQUARE: Record<ParquesColor, number> = {
  red: 0,
  blue: 17,
  yellow: 34,
  green: 51,
};

export const HOME_ENTRY_SQUARE: Record<ParquesColor, number> = {
  red: 63,
  blue: 12,
  yellow: 29,
  green: 46,
};

// Safe squares (Salidas & Seguros)
export const SAFE_SQUARES = new Set<number>([
  0, 7, 12, 17, 24, 29, 34, 41, 46, 51, 58, 63,
]);

export function createParquesGame(
  playerIds: string[],
  playerNames: Record<string, string>
): ParquesState {
  const players: ParquesPlayerState[] = playerIds.slice(0, 4).map((pid, idx) => ({
    playerId: pid,
    color: PARQUES_COLORS[idx],
    pawns: [0, 1, 2, 3].map((id) => ({ id, pos: -1 })),
    doublesStreak: 0,
    jailAttempts: 0,
  }));

  return {
    players,
    turnOrder: players.map((p) => p.playerId),
    currentTurnIndex: 0,
    dice: null,
    diceRemaining: [],
    hasRolled: false,
    bonusRollPending: false,
    winnerId: null,
    lastActionText: `${playerNames[players[0].playerId] ?? 'Red'} rolls first!`,
    lastCaptureText: null,
  };
}

function advancePos(color: ParquesColor, pos: number, steps: number): number | null {
  if (pos === -1 || pos === 107) return null;
  if (pos >= 100) {
    const target = pos + steps;
    return target <= 107 ? target : null;
  }

  const entry = HOME_ENTRY_SQUARE[color];
  let current = pos;
  for (let s = 0; s < steps; s++) {
    if (current === entry) {
      // Step onto home stretch square 100
      const remaining = steps - s - 1;
      const homeTarget = 100 + remaining;
      return homeTarget <= 107 ? homeTarget : null;
    }
    current = (current + 1) % 68;
  }
  return current;
}

export function getLegalParquesMoves(state: ParquesState, playerId: string): ParquesMoveOption[] {
  if (state.winnerId || !state.hasRolled || state.diceRemaining.length === 0) return [];
  if (state.turnOrder[state.currentTurnIndex] !== playerId) return [];

  const player = state.players.find((p) => p.playerId === playerId);
  if (!player) return [];

  const options: ParquesMoveOption[] = [];
  const isDoubles = state.dice !== null && state.dice[0] === state.dice[1];
  const jailPawns = player.pawns.filter((p) => p.pos === -1);

  // If doubles and any pawn is in jail, releasing from jail is allowed!
  if (isDoubles && jailPawns.length > 0 && state.diceRemaining.length > 0) {
    const exit = EXIT_SQUARE[player.color];
    const captures: { playerId: string; pawnId: number }[] = [];
    // Even if exit is safe, normal rules don't capture on exit unless full; exit is safe!
    options.push({
      pawnId: jailPawns[0].id,
      dieValue: state.diceRemaining[0],
      dieIndex: 0,
      fromPos: -1,
      toPos: exit,
      captures,
      isReleaseFromJail: true,
    });
  }

  // Standard moves for pawns already on board
  const seenDie = new Set<number>();
  state.diceRemaining.forEach((dieVal, dieIndex) => {
    if (seenDie.has(dieVal)) return;
    seenDie.add(dieVal);

    for (const pawn of player.pawns) {
      if (pawn.pos === -1 || pawn.pos === 107) continue;
      const toPos = advancePos(player.color, pawn.pos, dieVal);
      if (toPos === null) continue;

      const captures: { playerId: string; pawnId: number }[] = [];
      if (toPos < 100 && !SAFE_SQUARES.has(toPos)) {
        for (const opp of state.players) {
          if (opp.playerId === playerId) continue;
          for (const opPawn of opp.pawns) {
            if (opPawn.pos === toPos) {
              captures.push({ playerId: opp.playerId, pawnId: opPawn.id });
            }
          }
        }
      }

      options.push({
        pawnId: pawn.id,
        dieValue: dieVal,
        dieIndex,
        fromPos: pawn.pos,
        toPos,
        captures,
      });
    }
  });

  // Also allow combined two-dice move on a single pawn if both dice remain and at least one pawn is on board
  if (state.diceRemaining.length === 2) {
    const sum = state.diceRemaining[0] + state.diceRemaining[1];
    for (const pawn of player.pawns) {
      if (pawn.pos === -1 || pawn.pos === 107) continue;
      const toPos = advancePos(player.color, pawn.pos, sum);
      if (toPos === null) continue;
      const captures: { playerId: string; pawnId: number }[] = [];
      if (toPos < 100 && !SAFE_SQUARES.has(toPos)) {
        for (const opp of state.players) {
          if (opp.playerId === playerId) continue;
          for (const opPawn of opp.pawns) {
            if (opPawn.pos === toPos) {
              captures.push({ playerId: opp.playerId, pawnId: opPawn.id });
            }
          }
        }
      }
      options.push({
        pawnId: pawn.id,
        dieValue: sum,
        dieIndex: 'combo',
        fromPos: pawn.pos,
        toPos,
        captures,
      });
    }
  }

  return options;
}

export function rollParquesDice(
  state: ParquesState,
  playerId: string,
  playerName: string
): ParquesState {
  if (state.winnerId || state.hasRolled) return state;
  if (state.turnOrder[state.currentTurnIndex] !== playerId) return state;

  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const isDoubles = d1 === d2;

  const playerIdx = state.players.findIndex((p) => p.playerId === playerId);
  const player = state.players[playerIdx];
  const allInJail = player.pawns.every((p) => p.pos === -1 || p.pos === 107);
  const nextStreak = isDoubles ? player.doublesStreak + 1 : 0;

  // 3 consecutive doubles -> send furthest active pawn to jail and pass turn
  if (nextStreak >= 3) {
    const activePawns = player.pawns.filter((p) => p.pos >= 0 && p.pos < 107);
    let updatedPawns = player.pawns;
    if (activePawns.length > 0) {
      const targetPawn = activePawns[activePawns.length - 1];
      updatedPawns = player.pawns.map((p) => (p.id === targetPawn.id ? { ...p, pos: -1 } : p));
    }
    const updatedPlayers = state.players.map((p, i) =>
      i === playerIdx ? { ...p, pawns: updatedPawns, doublesStreak: 0, jailAttempts: 0 } : p
    );
    return {
      ...state,
      players: updatedPlayers,
      dice: [d1, d2],
      diceRemaining: [],
      hasRolled: false,
      bonusRollPending: false,
      currentTurnIndex: (state.currentTurnIndex + 1) % state.turnOrder.length,
      lastActionText: `${playerName} rolled 3 doubles in a row! A pawn returns to jail.`,
      lastCaptureText: null,
    };
  }

  // If all remaining unfinished pawns are in jail and no doubles: allow up to 3 attempts
  const unfinishedInJail = player.pawns.some((p) => p.pos === -1) && player.pawns.every((p) => p.pos === -1 || p.pos === 107);
  if (unfinishedInJail && !isDoubles) {
    const attempts = player.jailAttempts + 1;
    if (attempts < 3) {
      const updatedPlayers = state.players.map((p, i) =>
        i === playerIdx ? { ...p, jailAttempts: attempts, doublesStreak: 0 } : p
      );
      return {
        ...state,
        players: updatedPlayers,
        dice: [d1, d2],
        diceRemaining: [],
        hasRolled: false,
        bonusRollPending: false,
        lastActionText: `${playerName} rolled ${d1} & ${d2}. Try again for doubles (${attempts}/3).`,
        lastCaptureText: null,
      };
    } else {
      const updatedPlayers = state.players.map((p, i) =>
        i === playerIdx ? { ...p, jailAttempts: 0, doublesStreak: 0 } : p
      );
      return {
        ...state,
        players: updatedPlayers,
        dice: [d1, d2],
        diceRemaining: [],
        hasRolled: false,
        bonusRollPending: false,
        currentTurnIndex: (state.currentTurnIndex + 1) % state.turnOrder.length,
        lastActionText: `${playerName} rolled ${d1} & ${d2} (no doubles). Next turn.`,
        lastCaptureText: null,
      };
    }
  }

  // Normal roll (or doubles!)
  const updatedPlayers = state.players.map((p, i) =>
    i === playerIdx ? { ...p, doublesStreak: nextStreak, jailAttempts: 0 } : p
  );

  const tentativeState: ParquesState = {
    ...state,
    players: updatedPlayers,
    dice: [d1, d2],
    diceRemaining: [d1, d2],
    hasRolled: true,
    bonusRollPending: isDoubles,
    lastActionText: `${playerName} rolled ${d1} + ${d2}${isDoubles ? ' (DOUBLES!)' : ''}.`,
    lastCaptureText: null,
  };

  // Check if any legal moves exist
  const legalMoves = getLegalParquesMoves(tentativeState, playerId);
  if (legalMoves.length === 0) {
    if (isDoubles) {
      return {
        ...tentativeState,
        diceRemaining: [],
        hasRolled: false,
        bonusRollPending: false,
        lastActionText: `${playerName} rolled doubles ${d1}-${d1} with no legal move — roll again!`,
      };
    }
    return {
      ...tentativeState,
      diceRemaining: [],
      hasRolled: false,
      bonusRollPending: false,
      currentTurnIndex: (state.currentTurnIndex + 1) % state.turnOrder.length,
      lastActionText: `${playerName} rolled ${d1} & ${d2} — no legal moves available.`,
    };
  }

  return tentativeState;
}

export function applyParquesMove(
  state: ParquesState,
  playerId: string,
  move: ParquesMoveOption,
  playerNames: Record<string, string>
): ParquesState {
  if (state.winnerId || !state.hasRolled) return state;
  if (state.turnOrder[state.currentTurnIndex] !== playerId) return state;

  const legal = getLegalParquesMoves(state, playerId);
  const valid = legal.find(
    (m) => m.pawnId === move.pawnId && m.toPos === move.toPos && m.dieIndex === move.dieIndex
  );
  if (!valid) return state;

  let captureText: string | null = null;
  let capturedSomeone = false;

  const updatedPlayers = state.players.map((p) => {
    if (p.playerId === playerId) {
      // If releasing from jail on doubles, optionally release up to 2 pawns if 2+ in jail and doubles
      if (valid.isReleaseFromJail) {
        const exit = EXIT_SQUARE[p.color];
        let released = 0;
        const maxRelease = state.dice && state.dice[0] === state.dice[1] ? 2 : 1;
        const pawns = p.pawns.map((pawn) => {
          if (pawn.pos === -1 && released < maxRelease) {
            released++;
            return { ...pawn, pos: exit };
          }
          return pawn;
        });
        return { ...p, pawns };
      }
      return {
        ...p,
        pawns: p.pawns.map((pawn) =>
          pawn.id === valid.pawnId ? { ...pawn, pos: valid.toPos } : pawn
        ),
      };
    }

    // Apply captures on opponent pawns
    if (valid.captures && valid.captures.length > 0) {
      const capIds = new Set(
        valid.captures.filter((c) => c.playerId === p.playerId).map((c) => c.pawnId)
      );
      if (capIds.size > 0) {
        capturedSomeone = true;
        captureText = `${playerNames[playerId] ?? 'Player'} captured ${playerNames[p.playerId] ?? 'opponent'}!`;
        return {
          ...p,
          pawns: p.pawns.map((pawn) => (capIds.has(pawn.id) ? { ...pawn, pos: -1 } : pawn)),
        };
      }
    }
    return p;
  });

  // Update remaining dice
  let nextDiceRemaining: number[] = [];
  if (valid.isReleaseFromJail) {
    // Releasing on doubles consumes both dice (they get a bonus roll for doubles!)
    nextDiceRemaining = [];
  } else if (valid.dieIndex === 'combo') {
    nextDiceRemaining = [];
  } else {
    nextDiceRemaining = state.diceRemaining.filter((_, idx) => idx !== valid.dieIndex);
  }

  const mover = updatedPlayers.find((p) => p.playerId === playerId)!;
  const won = mover.pawns.every((p) => p.pos === 107);
  if (won) {
    return {
      ...state,
      players: updatedPlayers,
      diceRemaining: [],
      hasRolled: false,
      bonusRollPending: false,
      winnerId: playerId,
      lastActionText: `${playerNames[playerId] ?? 'Player'} brought all 4 pawns to the center Goal!`,
      lastCaptureText: captureText,
    };
  }

  const bonusRoll = state.bonusRollPending || capturedSomeone;
  const nextState: ParquesState = {
    ...state,
    players: updatedPlayers,
    diceRemaining: nextDiceRemaining,
    hasRolled: nextDiceRemaining.length > 0,
    bonusRollPending: bonusRoll,
    lastActionText: valid.isReleaseFromJail
      ? `${playerNames[playerId] ?? 'Player'} freed pawns from Jail!`
      : valid.toPos === 107
      ? `${playerNames[playerId] ?? 'Player'} reached the Goal!`
      : `${playerNames[playerId] ?? 'Player'} moved ${valid.dieValue} spaces.`,
    lastCaptureText: captureText,
  };

  if (nextDiceRemaining.length > 0) {
    const remainingMoves = getLegalParquesMoves(nextState, playerId);
    if (remainingMoves.length > 0) {
      return nextState;
    }
  }

  // Turn finished (or bonus roll!)
  if (bonusRoll) {
    return {
      ...nextState,
      diceRemaining: [],
      hasRolled: false,
      bonusRollPending: false,
      lastActionText: `${nextState.lastActionText} Roll again!`,
    };
  }

  return {
    ...nextState,
    diceRemaining: [],
    hasRolled: false,
    bonusRollPending: false,
    currentTurnIndex: (state.currentTurnIndex + 1) % state.turnOrder.length,
  };
}

export function chooseAiParquesMove(state: ParquesState, aiId: string): ParquesMoveOption | null {
  const moves = getLegalParquesMoves(state, aiId);
  if (moves.length === 0) return null;

  let best = moves[0];
  let bestScore = -999;

  for (const m of moves) {
    let score = 0;
    if (m.captures && m.captures.length > 0) score += 120;
    if (m.isReleaseFromJail) score += 90;
    if (m.toPos === 107) score += 100;
    if (m.toPos >= 100) score += 60;
    if (m.toPos < 100 && SAFE_SQUARES.has(m.toPos)) score += 30;
    if (m.dieIndex === 'combo') score += 8;
    score += m.dieValue;
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}
