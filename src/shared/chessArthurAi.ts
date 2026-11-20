import {
  applyRawBoardMove,
  findKingSquare,
  getLegalChessMoves,
  isSquareAttacked,
  oppositeColor,
  sqToCoord,
} from './chessEngine.ts';
import type {
  ChessCastlingRights,
  ChessColor,
  ChessDifficulty,
  ChessHistoryEntry,
  ChessMove,
  ChessPiece,
  ChessPieceType,
  ChessState,
} from './types.ts';

export interface OpponentLearningProfile {
  gamesPlayed: number;
  favoriteWhiteOpening: 'e4' | 'd4' | 'flank' | 'unknown';
  aggressionScore: number; // 0..100
  queensideTendency: number; // 0..100
  tradeWillingness: number; // 0..100
  lastInsightEn: string;
  lastInsightEs: string;
}

export const DEFAULT_LEARNING_PROFILE: OpponentLearningProfile = {
  gamesPlayed: 0,
  favoriteWhiteOpening: 'unknown',
  aggressionScore: 50,
  queensideTendency: 50,
  tradeWillingness: 50,
  lastInsightEn: 'Observing your opening structure and tactical tempo.',
  lastInsightEs: 'Observando tu estructura de apertura y ritmo táctico.',
};

const PIECE_VALUE: Record<ChessPieceType, number> = {
  p: 100,
  n: 320,
  b: 335,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-square tables from White perspective (row 0 = rank 8, row 7 = rank 1)
const PST_PAWN = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  12, 16, 24, 34, 34, 24, 16, 12,
  6,  8, 16, 28, 28, 16,  8,  6,
  2,  4, 10, 22, 22, 10,  4,  2,
  4, -4,-10,  0,  0,-10, -4,  4,
  4, 10, 10,-22,-22, 10, 10,  4,
  0,  0,  0,  0,  0,  0,  0,  0,
];

const PST_KNIGHT = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  4,  4,  0,-20,-40,
  -30,  4, 14, 18, 18, 14,  4,-30,
  -30,  6, 16, 22, 22, 16,  6,-30,
  -30,  2, 16, 20, 20, 16,  2,-30,
  -30,  6, 12, 14, 14, 12,  6,-30,
  -40,-20,  0,  6,  6,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];

const PST_BISHOP = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  4,  0,  0,  0,  0,  4,-10,
  -10,  8, 10, 12, 12, 10,  8,-10,
  -10,  2, 10, 14, 14, 10,  2,-10,
  -10,  4, 12, 12, 12, 12,  4,-10,
  -10, 10,  8,  8,  8,  8, 10,-10,
  -10,  8,  0,  0,  0,  0,  8,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
];

const PST_ROOK = [
  0,  0,  4,  8,  8,  4,  0,  0,
  12, 16, 16, 18, 18, 16, 16, 12,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  0,  0,  4, 10, 10,  4,  0,  0,
];

const PST_QUEEN = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  6,  6,  6,  6,  0,-10,
  -5,   0,  6,  8,  8,  6,  0, -5,
  0,    0,  6,  8,  8,  6,  0, -5,
  -10,  5,  6,  6,  6,  6,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20,
];

const PST_KING_MID = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
  20,  20,  0,  0,  0,  0, 20, 20,
  20,  32, 12,  0,  0, 12, 32, 20,
];

const PST_KING_END = [
  -50,-40,-30,-20,-20,-30,-40,-50,
  -30,-20,-10,  0,  0,-10,-20,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-10, 30, 42, 42, 30,-10,-30,
  -30,-10, 30, 42, 42, 30,-10,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-30,  0,  0,  0,  0,-30,-30,
  -50,-30,-30,-30,-30,-30,-30,-50,
];

// Master Opening Book (UCI sequences -> Arthur replies)
const OPENING_BOOK: Record<string, string[]> = {
  '': ['e2e4', 'd2d4', 'c2c4'],
  'e2e4': ['c7c5', 'e7e5', 'e7e6'], // Sicilian, Open Game, French
  'd2d4': ['g8f6', 'd7d5'],         // Indian, Queen's Gambit Declined
  'c2c4': ['e7e5', 'g8f6'],
  'g1f3': ['d7d5', 'g8f6'],
  'e2e4,c7c5': ['g1f3'],
  'e2e4,c7c5,g1f3': ['d7d6', 'b8c6', 'e7e6'],
  'e2e4,c7c5,g1f3,d7d6,d2d4': ['c5d4'],
  'e2e4,e7e5,g1f3': ['b8c6'],
  'e2e4,e7e5,g1f3,b8c6': ['f1b5', 'f1c4'],
  'e2e4,e7e5,g1f3,b8c6,f1b5': ['a7a6', 'g8f6'],
  'd2d4,g8f6,c2c4': ['g7g6', 'e7e6'],
  'd2d4,d7d5,c2c4': ['e7e6', 'c7c6'],
};

function getPst(type: ChessPieceType, sq: number, color: ChessColor, isEndgame: boolean): number {
  const idx = color === 'w' ? sq : (7 - Math.floor(sq / 8)) * 8 + (sq % 8);
  switch (type) {
    case 'p': return PST_PAWN[idx];
    case 'n': return PST_KNIGHT[idx];
    case 'b': return PST_BISHOP[idx];
    case 'r': return PST_ROOK[idx];
    case 'q': return PST_QUEEN[idx];
    case 'k': return isEndgame ? PST_KING_END[idx] : PST_KING_MID[idx];
  }
}

export function analyzeOpponentStyle(
  history: ChessHistoryEntry[],
  humanColor: ChessColor,
  prevProfile: OpponentLearningProfile
): OpponentLearningProfile {
  const humanMoves = history.filter((h) => h.color === humanColor);
  if (humanMoves.length === 0) return prevProfile;

  let opening = prevProfile.favoriteWhiteOpening;
  if (humanColor === 'w' && humanMoves[0]) {
    if (humanMoves[0].uci.startsWith('e2e4')) opening = 'e4';
    else if (humanMoves[0].uci.startsWith('d2d4')) opening = 'd4';
    else opening = 'flank';
  }

  let forwardAttacks = 0;
  let captures = 0;
  let queenside = 0;
  for (const hm of humanMoves) {
    if (hm.san.includes('x')) captures++;
    if (hm.san.includes('+') || hm.san.includes('Q')) forwardAttacks++;
    if (hm.to % 8 <= 2) queenside++;
  }

  const ratioAgg = Math.min(100, Math.round(((captures + forwardAttacks) / Math.max(1, humanMoves.length)) * 115));
  const ratioQ = Math.min(100, Math.round((queenside / Math.max(1, humanMoves.length)) * 150));

  const aggressionScore = Math.round(prevProfile.aggressionScore * 0.65 + ratioAgg * 0.35);
  const queensideTendency = Math.round(prevProfile.queensideTendency * 0.65 + ratioQ * 0.35);
  const tradeWillingness = Math.round(
    prevProfile.tradeWillingness * 0.6 +
      Math.min(100, Math.round((captures / Math.max(1, humanMoves.length)) * 160)) * 0.4
  );

  let lastInsightEn = 'Balancing central control and piece coordination.';
  let lastInsightEs = 'Equilibrando el control central y la coordinación de piezas.';

  if (aggressionScore >= 65) {
    lastInsightEn = 'Detected aggressive attacking tempo — Arthur is fortifying king safety and preparing a central counterstrike.';
    lastInsightEs = 'Detectado ritmo agresivo — Arthur refuerza su rey y prepara un contragolpe central.';
  } else if (queensideTendency >= 62) {
    lastInsightEn = 'Noticed queenside flank pressure — Arthur is redirecting knights and rooks to contest the c-file.';
    lastInsightEs = 'Detectada presión en el flanco de dama — Arthur redirige sus torres y caballos a la columna c.';
  } else if (tradeWillingness >= 60) {
    lastInsightEn = 'High exchange rate observed — Arthur is steering into a favorable pawn endgame.';
    lastInsightEs = 'Alto intercambio táctico detectado — Arthur conduce hacia un final de peones superior.';
  } else if (opening === 'e4') {
    lastInsightEn = 'Adapting to your 1.e4 repertoire with Sicilian / Ruy Lopez master structures.';
    lastInsightEs = 'Adaptándose a tu repertorio 1.e4 con estructuras magistrales Siciliana / Ruy López.';
  } else if (opening === 'd4') {
    lastInsightEn = 'Countering your 1.d4 setup with hypermodern King’s Indian tension.';
    lastInsightEs = 'Contrarrestando tu apertura 1.d4 con tensión hipermoderna India de Rey.';
  }

  return {
    gamesPlayed: prevProfile.gamesPlayed,
    favoriteWhiteOpening: opening,
    aggressionScore,
    queensideTendency,
    tradeWillingness,
    lastInsightEn,
    lastInsightEs,
  };
}

function evaluateBoard(
  board: (ChessPiece | null)[],
  arthurColor: ChessColor,
  learning: OpponentLearningProfile
): number {
  let whiteMaterial = 0;
  let blackMaterial = 0;
  let whiteScore = 0;
  let blackScore = 0;
  let whiteBishops = 0;
  let blackBishops = 0;

  const whitePawnsByCol = [0, 0, 0, 0, 0, 0, 0, 0];
  const blackPawnsByCol = [0, 0, 0, 0, 0, 0, 0, 0];

  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p) continue;
    if (p.type !== 'k') {
      if (p.color === 'w') whiteMaterial += PIECE_VALUE[p.type];
      else blackMaterial += PIECE_VALUE[p.type];
    }
    if (p.type === 'b') {
      if (p.color === 'w') whiteBishops++;
      else blackBishops++;
    }
    if (p.type === 'p') {
      if (p.color === 'w') whitePawnsByCol[i % 8]++;
      else blackPawnsByCol[i % 8]++;
    }
  }

  const isEndgame = whiteMaterial <= 1400 && blackMaterial <= 1400;

  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p) continue;
    const val = PIECE_VALUE[p.type] + getPst(p.type, i, p.color, isEndgame);
    if (p.color === 'w') whiteScore += val;
    else blackScore += val;
  }

  // Bishop pair bonus
  if (whiteBishops >= 2) whiteScore += 32;
  if (blackBishops >= 2) blackScore += 32;

  // Doubled pawn penalty & open file rook awareness
  for (let col = 0; col < 8; col++) {
    if (whitePawnsByCol[col] > 1) whiteScore -= 14 * (whitePawnsByCol[col] - 1);
    if (blackPawnsByCol[col] > 1) blackScore -= 14 * (blackPawnsByCol[col] - 1);
  }

  // Adaptive bonus: if opponent is aggressive, reward Arthur slightly more for solid king safety & center pawns
  if (learning.aggressionScore >= 60) {
    const centerSquares = [27, 28, 35, 36];
    for (const cSq of centerSquares) {
      const p = board[cSq];
      if (p && p.color === arthurColor) {
        if (arthurColor === 'w') whiteScore += 10;
        else blackScore += 10;
      }
    }
  }

  const raw = whiteScore - blackScore;
  return arthurColor === 'w' ? raw : -raw;
}

function orderMoves(moves: ChessMove[], board: (ChessPiece | null)[]): ChessMove[] {
  return moves.sort((a, b) => {
    const scoreMove = (m: ChessMove) => {
      let s = 0;
      if (m.captured) {
        const victim = PIECE_VALUE[m.captured];
        const attacker = PIECE_VALUE[board[m.from]?.type || 'p'];
        s += 10000 + victim * 10 - attacker;
      }
      if (m.promotion) s += 9000 + PIECE_VALUE[m.promotion];
      if (m.isCastle) s += 300;
      return s;
    };
    return scoreMove(b) - scoreMove(a);
  });
}

function updateCast(
  castling: ChessCastlingRights,
  move: ChessMove,
  moving: ChessPiece
): ChessCastlingRights {
  const next = { ...castling };
  if (moving.type === 'k') {
    if (moving.color === 'w') {
      next.wK = false;
      next.wQ = false;
    } else {
      next.bK = false;
      next.bQ = false;
    }
  }
  if (move.from === 63 || move.to === 63) next.wK = false;
  if (move.from === 56 || move.to === 56) next.wQ = false;
  if (move.from === 7 || move.to === 7) next.bK = false;
  if (move.from === 0 || move.to === 0) next.bQ = false;
  return next;
}

export function chooseArthurChessMove(
  state: ChessState,
  difficulty: ChessDifficulty,
  learning: OpponentLearningProfile
): { move: ChessMove; commentEn: string; commentEs: string } | null {
  const arthurColor = state.turn;
  const legal = getLegalChessMoves(state.board, arthurColor, state.castling, state.enPassantSquare);
  if (legal.length === 0) return null;

  // 1. Opening book lookup on hard+ difficulties
  if (difficulty !== 'easy' && state.history.length <= 6) {
    const seq = state.history.map((h) => h.uci).join(',');
    const candidates = OPENING_BOOK[seq];
    if (candidates && candidates.length > 0) {
      // Adaptive book pick: if opponent is aggressive, prefer Sicilian/Counterattacking lines
      const pickIdx =
        learning.aggressionScore >= 60
          ? 0
          : Math.floor(Math.random() * candidates.length);
      const uciTarget = candidates[pickIdx] || candidates[0];
      const bookMove = legal.find(
        (m) => `${sqToCoord(m.from)}${sqToCoord(m.to)}` === uciTarget
      );
      if (bookMove) {
        return {
          move: bookMove,
          commentEn: 'Playing classical master theory.',
          commentEs: 'Jugando teoría clásica de gran maestro.',
        };
      }
    }
  }

  // Easy mode: shallow lookahead with occasional tactical imperfection
  if (difficulty === 'easy') {
    const ordered = orderMoves([...legal], state.board);
    const pool = ordered.slice(0, Math.min(ordered.length, 5));
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    return {
      move: chosen,
      commentEn: 'Testing your tactical alertness.',
      commentEs: 'Probando tu atención táctica.',
    };
  }

  const maxDepth =
    difficulty === 'medium'
      ? 2
      : difficulty === 'hard'
      ? 3
      : difficulty === 'very_hard'
      ? 3
      : 4; // 'very_very_hard' reaches depth 4 + deep quiescence

  const useQuiescence = difficulty !== 'medium';
  const quiescenceDepthLimit =
    difficulty === 'very_very_hard' ? 4 : difficulty === 'very_hard' ? 3 : 2;
  const startTime = Date.now();
  const timeBudgetMs =
    difficulty === 'very_very_hard' ? 950 : difficulty === 'very_hard' ? 650 : 400;
  let nodes = 0;
  let timedOut = false;

  const quiescence = (
    board: (ChessPiece | null)[],
    turn: ChessColor,
    castling: ChessCastlingRights,
    ep: number | null,
    alpha: number,
    beta: number,
    qDepth: number
  ): number => {
    nodes++;
    if ((nodes & 255) === 0 && Date.now() - startTime > timeBudgetMs) {
      timedOut = true;
    }
    const standPat = evaluateBoard(board, arthurColor, learning) * (turn === arthurColor ? 1 : -1);
    if (qDepth <= 0 || timedOut) return standPat;
    if (standPat >= beta) return beta;
    if (alpha < standPat) alpha = standPat;

    const captures = orderMoves(
      getLegalChessMoves(board, turn, castling, ep).filter((m) => m.captured || m.promotion),
      board
    );

    for (const m of captures) {
      const moving = board[m.from]!;
      const nextBoard = applyRawBoardMove(board, m);
      const nextCast = updateCast(castling, m, moving);
      const score = -quiescence(nextBoard, oppositeColor(turn), nextCast, null, -beta, -alpha, qDepth - 1);
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  };

  const negamax = (
    board: (ChessPiece | null)[],
    turn: ChessColor,
    castling: ChessCastlingRights,
    ep: number | null,
    depth: number,
    alpha: number,
    beta: number,
    ply: number
  ): number => {
    nodes++;
    if ((nodes & 255) === 0 && Date.now() - startTime > timeBudgetMs) {
      timedOut = true;
      return evaluateBoard(board, arthurColor, learning) * (turn === arthurColor ? 1 : -1);
    }

    const moves = getLegalChessMoves(board, turn, castling, ep);
    if (moves.length === 0) {
      const kingSq = findKingSquare(board, turn);
      const inCheck = kingSq !== -1 && isSquareAttacked(board, kingSq, oppositeColor(turn));
      return inCheck ? -100000 + ply : 0; // Checkmate vs Stalemate
    }

    if (depth <= 0) {
      if (useQuiescence) {
        return quiescence(board, turn, castling, ep, alpha, beta, quiescenceDepthLimit);
      }
      return evaluateBoard(board, arthurColor, learning) * (turn === arthurColor ? 1 : -1);
    }

    const ordered = orderMoves(moves, board);
    let best = -Infinity;

    for (const m of ordered) {
      const moving = board[m.from]!;
      const nextBoard = applyRawBoardMove(board, m);
      const nextCast = updateCast(castling, m, moving);
      const nextEp =
        moving.type === 'p' && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : null;
      const val = -negamax(
        nextBoard,
        oppositeColor(turn),
        nextCast,
        nextEp,
        depth - 1,
        -beta,
        -alpha,
        ply + 1
      );
      if (val > best) best = val;
      if (best > alpha) alpha = best;
      if (alpha >= beta || timedOut) break;
    }
    return best;
  };

  const orderedRoot = orderMoves([...legal], state.board);
  let bestMove = orderedRoot[0];
  let bestScore = -Infinity;

  for (const m of orderedRoot) {
    const moving = state.board[m.from]!;
    const nextBoard = applyRawBoardMove(state.board, m);
    const nextCast = updateCast(state.castling, m, moving);
    const nextEp =
      moving.type === 'p' && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : null;
    const score = -negamax(
      nextBoard,
      oppositeColor(arthurColor),
      nextCast,
      nextEp,
      maxDepth - 1,
      -Infinity,
      Infinity,
      1
    );
    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
    if (timedOut) break;
  }

  let commentEn = 'Calculating multi-move positional pressure.';
  let commentEs = 'Calculando presión posicional a múltiples jugadas.';

  if (bestScore > 250) {
    commentEn = 'Arthur sees a decisive tactical advantage.';
    commentEs = 'Arthur detecta una ventaja táctica decisiva.';
  } else if (bestMove.captured) {
    commentEn = 'Eliminating active defenders to simplify the board.';
    commentEs = 'Eliminando defensores activos para simplificar el tablero.';
  } else if (bestMove.isCastle) {
    commentEn = 'Securing the king and activating the rook.';
    commentEs = 'Asegurando al rey y activando la torre.';
  }

  return { move: bestMove, commentEn, commentEs };
}
