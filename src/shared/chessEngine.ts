import type {
  ChessCastlingRights,
  ChessColor,
  ChessHistoryEntry,
  ChessMove,
  ChessPiece,
  ChessPieceType,
  ChessState,
} from './types.ts';

const FILES = 'abcdefgh';
const PIECE_LETTER: Record<ChessPieceType, string> = {
  p: '',
  n: 'N',
  b: 'B',
  r: 'R',
  q: 'Q',
  k: 'K',
};

export function sqToCoord(sq: number): string {
  const row = Math.floor(sq / 8);
  const col = sq % 8;
  return `${FILES[col]}${8 - row}`;
}

export function createInitialBoard(): (ChessPiece | null)[] {
  const b: (ChessPiece | null)[] = new Array(64).fill(null);
  const backRank: ChessPieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

  for (let c = 0; c < 8; c++) {
    b[c] = { color: 'b', type: backRank[c] };
    b[8 + c] = { color: 'b', type: 'p' };
    b[48 + c] = { color: 'w', type: 'p' };
    b[56 + c] = { color: 'w', type: backRank[c] };
  }
  return b;
}

export function createChessGame(
  whiteId: string,
  blackId: string,
  whiteName: string
): ChessState {
  return {
    board: createInitialBoard(),
    turn: 'w',
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    enPassantSquare: null,
    halfMoveClock: 0,
    fullMoveNumber: 1,
    whiteId,
    blackId,
    inCheck: false,
    status: 'playing',
    winnerId: null,
    lastMove: null,
    history: [],
    capturedByWhite: [],
    capturedByBlack: [],
    lastActionText: `${whiteName} opens with White pieces.`,
  };
}

export function oppositeColor(c: ChessColor): ChessColor {
  return c === 'w' ? 'b' : 'w';
}

export function isSquareAttacked(
  board: (ChessPiece | null)[],
  targetSq: number,
  byColor: ChessColor
): boolean {
  const tr = Math.floor(targetSq / 8);
  const tc = targetSq % 8;

  // Pawn attacks
  const pawnDir = byColor === 'w' ? 1 : -1;
  for (const dc of [-1, 1]) {
    const pr = tr + pawnDir;
    const pc = tc + dc;
    if (pr >= 0 && pr < 8 && pc >= 0 && pc < 8) {
      const p = board[pr * 8 + pc];
      if (p && p.color === byColor && p.type === 'p') return true;
    }
  }

  // Knight attacks
  const knightSteps = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1],
  ];
  for (const [dr, dc] of knightSteps) {
    const nr = tr + dr;
    const nc = tc + dc;
    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      const p = board[nr * 8 + nc];
      if (p && p.color === byColor && p.type === 'n') return true;
    }
  }

  // King attacks
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const kr = tr + dr;
      const kc = tc + dc;
      if (kr >= 0 && kr < 8 && kc >= 0 && kc < 8) {
        const p = board[kr * 8 + kc];
        if (p && p.color === byColor && p.type === 'k') return true;
      }
    }
  }

  // Orthogonal rays (Rook / Queen)
  const ortho = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of ortho) {
    let r = tr + dr;
    let c = tc + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const p = board[r * 8 + c];
      if (p) {
        if (p.color === byColor && (p.type === 'r' || p.type === 'q')) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }

  // Diagonal rays (Bishop / Queen)
  const diag = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  for (const [dr, dc] of diag) {
    let r = tr + dr;
    let c = tc + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const p = board[r * 8 + c];
      if (p) {
        if (p.color === byColor && (p.type === 'b' || p.type === 'q')) return true;
        break;
      }
      r += dr;
      c += dc;
    }
  }

  return false;
}

export function findKingSquare(board: (ChessPiece | null)[], color: ChessColor): number {
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && p.color === color && p.type === 'k') return i;
  }
  return -1;
}

function generatePseudoMoves(
  board: (ChessPiece | null)[],
  turn: ChessColor,
  castling: ChessCastlingRights,
  enPassantSquare: number | null
): ChessMove[] {
  const moves: ChessMove[] = [];
  const enemy = oppositeColor(turn);

  for (let sq = 0; sq < 64; sq++) {
    const piece = board[sq];
    if (!piece || piece.color !== turn) continue;
    const r = Math.floor(sq / 8);
    const c = sq % 8;

    if (piece.type === 'p') {
      const dir = turn === 'w' ? -1 : 1;
      const startRow = turn === 'w' ? 6 : 1;
      const promoRow = turn === 'w' ? 0 : 7;

      const oneStep = (r + dir) * 8 + c;
      if (r + dir >= 0 && r + dir < 8 && !board[oneStep]) {
        if (r + dir === promoRow) {
          for (const promo of ['q', 'r', 'b', 'n'] as ChessPieceType[]) {
            moves.push({ from: sq, to: oneStep, promotion: promo });
          }
        } else {
          moves.push({ from: sq, to: oneStep });
          if (r === startRow) {
            const twoStep = (r + 2 * dir) * 8 + c;
            if (!board[twoStep]) {
              moves.push({ from: sq, to: twoStep });
            }
          }
        }
      }

      for (const dc of [-1, 1]) {
        const nc = c + dc;
        const nr = r + dir;
        if (nc < 0 || nc >= 8 || nr < 0 || nr >= 8) continue;
        const capSq = nr * 8 + nc;
        const target = board[capSq];
        if (target && target.color === enemy) {
          if (nr === promoRow) {
            for (const promo of ['q', 'r', 'b', 'n'] as ChessPieceType[]) {
              moves.push({ from: sq, to: capSq, promotion: promo, captured: target.type });
            }
          } else {
            moves.push({ from: sq, to: capSq, captured: target.type });
          }
        } else if (enPassantSquare === capSq) {
          moves.push({ from: sq, to: capSq, isEnPassant: true, captured: 'p' });
        }
      }
    } else if (piece.type === 'n') {
      const steps = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1],
      ];
      for (const [dr, dc] of steps) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
        const to = nr * 8 + nc;
        const target = board[to];
        if (!target) {
          moves.push({ from: sq, to });
        } else if (target.color === enemy) {
          moves.push({ from: sq, to, captured: target.type });
        }
      }
    } else if (piece.type === 'b' || piece.type === 'r' || piece.type === 'q') {
      const dirs: [number, number][] = [];
      if (piece.type === 'b' || piece.type === 'q') {
        dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
      }
      if (piece.type === 'r' || piece.type === 'q') {
        dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
      }
      for (const [dr, dc] of dirs) {
        let nr = r + dr;
        let nc = c + dc;
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const to = nr * 8 + nc;
          const target = board[to];
          if (!target) {
            moves.push({ from: sq, to });
          } else {
            if (target.color === enemy) {
              moves.push({ from: sq, to, captured: target.type });
            }
            break;
          }
          nr += dr;
          nc += dc;
        }
      }
    } else if (piece.type === 'k') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) continue;
          const to = nr * 8 + nc;
          const target = board[to];
          if (!target) {
            moves.push({ from: sq, to });
          } else if (target.color === enemy) {
            moves.push({ from: sq, to, captured: target.type });
          }
        }
      }

      // Castling
      if (turn === 'w' && sq === 60 && !isSquareAttacked(board, 60, 'b')) {
        if (
          castling.wK &&
          !board[61] &&
          !board[62] &&
          board[63]?.type === 'r' &&
          board[63]?.color === 'w' &&
          !isSquareAttacked(board, 61, 'b') &&
          !isSquareAttacked(board, 62, 'b')
        ) {
          moves.push({ from: 60, to: 62, isCastle: 'K' });
        }
        if (
          castling.wQ &&
          !board[59] &&
          !board[58] &&
          !board[57] &&
          board[56]?.type === 'r' &&
          board[56]?.color === 'w' &&
          !isSquareAttacked(board, 59, 'b') &&
          !isSquareAttacked(board, 58, 'b')
        ) {
          moves.push({ from: 60, to: 58, isCastle: 'Q' });
        }
      } else if (turn === 'b' && sq === 4 && !isSquareAttacked(board, 4, 'w')) {
        if (
          castling.bK &&
          !board[5] &&
          !board[6] &&
          board[7]?.type === 'r' &&
          board[7]?.color === 'b' &&
          !isSquareAttacked(board, 5, 'w') &&
          !isSquareAttacked(board, 6, 'w')
        ) {
          moves.push({ from: 4, to: 6, isCastle: 'K' });
        }
        if (
          castling.bQ &&
          !board[3] &&
          !board[2] &&
          !board[1] &&
          board[0]?.type === 'r' &&
          board[0]?.color === 'b' &&
          !isSquareAttacked(board, 3, 'w') &&
          !isSquareAttacked(board, 2, 'w')
        ) {
          moves.push({ from: 4, to: 2, isCastle: 'Q' });
        }
      }
    }
  }

  return moves;
}

export function applyRawBoardMove(
  board: (ChessPiece | null)[],
  move: ChessMove
): (ChessPiece | null)[] {
  const next = board.slice();
  const moving = next[move.from];
  if (!moving) return next;

  next[move.from] = null;
  next[move.to] = move.promotion ? { color: moving.color, type: move.promotion } : moving;

  if (move.isEnPassant) {
    const capRow = Math.floor(move.from / 8);
    const capCol = move.to % 8;
    next[capRow * 8 + capCol] = null;
  }

  if (move.isCastle === 'K') {
    const rowBase = move.from === 60 ? 56 : 0;
    next[rowBase + 5] = next[rowBase + 7];
    next[rowBase + 7] = null;
  } else if (move.isCastle === 'Q') {
    const rowBase = move.from === 60 ? 56 : 0;
    next[rowBase + 3] = next[rowBase + 0];
    next[rowBase + 0] = null;
  }

  return next;
}

export function getLegalChessMoves(
  board: (ChessPiece | null)[],
  turn: ChessColor,
  castling: ChessCastlingRights,
  enPassantSquare: number | null
): ChessMove[] {
  const pseudo = generatePseudoMoves(board, turn, castling, enPassantSquare);
  const enemy = oppositeColor(turn);
  const legal: ChessMove[] = [];

  for (const m of pseudo) {
    const after = applyRawBoardMove(board, m);
    const kingSq = findKingSquare(after, turn);
    if (kingSq !== -1 && !isSquareAttacked(after, kingSq, enemy)) {
      legal.push(m);
    }
  }
  return legal;
}

function isInsufficientMaterial(board: (ChessPiece | null)[]): boolean {
  const minors: { color: ChessColor; type: ChessPieceType; sq: number }[] = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || p.type === 'k') continue;
    if (p.type === 'p' || p.type === 'r' || p.type === 'q') return false;
    minors.push({ color: p.color, type: p.type, sq: i });
  }
  if (minors.length <= 1) return true;
  if (minors.length === 2 && minors[0].type === 'b' && minors[1].type === 'b') {
    const c0 = (Math.floor(minors[0].sq / 8) + (minors[0].sq % 8)) % 2;
    const c1 = (Math.floor(minors[1].sq / 8) + (minors[1].sq % 8)) % 2;
    return c0 === c1;
  }
  return false;
}

function updateCastlingRights(
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

function formatSan(
  boardBefore: (ChessPiece | null)[],
  legalBefore: ChessMove[],
  move: ChessMove,
  inCheckAfter: boolean,
  isCheckmateAfter: boolean
): string {
  if (move.isCastle === 'K') return isCheckmateAfter ? 'O-O#' : inCheckAfter ? 'O-O+' : 'O-O';
  if (move.isCastle === 'Q') return isCheckmateAfter ? 'O-O-O#' : inCheckAfter ? 'O-O-O+' : 'O-O-O';

  const moving = boardBefore[move.from]!;
  const isCapture = Boolean(move.captured || move.isEnPassant);
  let san = '';

  if (moving.type === 'p') {
    if (isCapture) {
      san += `${FILES[move.from % 8]}x`;
    }
    san += sqToCoord(move.to);
    if (move.promotion) {
      san += `=${move.promotion.toUpperCase()}`;
    }
  } else {
    san += PIECE_LETTER[moving.type];
    const ambig = legalBefore.filter(
      (o) =>
        o.from !== move.from &&
        o.to === move.to &&
        boardBefore[o.from]?.type === moving.type
    );
    if (ambig.length > 0) {
      const sameFile = ambig.some((o) => o.from % 8 === move.from % 8);
      const sameRank = ambig.some((o) => Math.floor(o.from / 8) === Math.floor(move.from / 8));
      if (!sameFile) san += FILES[move.from % 8];
      else if (!sameRank) san += String(8 - Math.floor(move.from / 8));
      else san += sqToCoord(move.from);
    }
    if (isCapture) san += 'x';
    san += sqToCoord(move.to);
  }

  if (isCheckmateAfter) san += '#';
  else if (inCheckAfter) san += '+';
  return san;
}

export function applyChessMove(
  state: ChessState,
  playerId: string,
  moveInput: { from: number; to: number; promotion?: ChessPieceType },
  playerName: string
): ChessState {
  if (state.status !== 'playing') return state;
  const expectedId = state.turn === 'w' ? state.whiteId : state.blackId;
  if (expectedId !== playerId) return state;

  const legal = getLegalChessMoves(state.board, state.turn, state.castling, state.enPassantSquare);
  const move = legal.find(
    (m) =>
      m.from === moveInput.from &&
      m.to === moveInput.to &&
      (m.promotion ? m.promotion === (moveInput.promotion || 'q') : true)
  );
  if (!move) return state;

  const moving = state.board[move.from]!;
  const nextBoard = applyRawBoardMove(state.board, move);
  const nextCastling = updateCastlingRights(state.castling, move, moving);

  let nextEnPassant: number | null = null;
  if (moving.type === 'p' && Math.abs(move.to - move.from) === 16) {
    nextEnPassant = (move.from + move.to) / 2;
  }

  const nextTurn = oppositeColor(state.turn);
  const nextLegal = getLegalChessMoves(nextBoard, nextTurn, nextCastling, nextEnPassant);
  const oppKingSq = findKingSquare(nextBoard, nextTurn);
  const inCheck = oppKingSq !== -1 && isSquareAttacked(nextBoard, oppKingSq, state.turn);

  let status: ChessState['status'] = 'playing';
  let winnerId: string | null = null;
  const isCheckmate = nextLegal.length === 0 && inCheck;

  if (isCheckmate) {
    status = 'checkmate';
    winnerId = playerId;
  } else if (nextLegal.length === 0) {
    status = 'stalemate';
  } else if (state.halfMoveClock + 1 >= 100 || isInsufficientMaterial(nextBoard)) {
    status = 'draw';
  }

  const san = formatSan(state.board, legal, move, inCheck, isCheckmate);
  const uci = `${sqToCoord(move.from)}${sqToCoord(move.to)}${move.promotion || ''}`;
  const entry: ChessHistoryEntry = {
    san,
    uci,
    color: state.turn,
    from: move.from,
    to: move.to,
  };

  const capturedByWhite = [...state.capturedByWhite];
  const capturedByBlack = [...state.capturedByBlack];
  if (move.captured) {
    if (state.turn === 'w') capturedByWhite.push(move.captured);
    else capturedByBlack.push(move.captured);
  }

  const nextHalfClock =
    moving.type === 'p' || move.captured || move.isEnPassant ? 0 : state.halfMoveClock + 1;
  const nextFullMove = state.turn === 'b' ? state.fullMoveNumber + 1 : state.fullMoveNumber;

  let lastActionText = `${playerName}: ${san}`;
  if (status === 'checkmate') lastActionText = `Checkmate! ${playerName} wins (${san}).`;
  else if (status === 'stalemate') lastActionText = `Stalemate — Draw.`;
  else if (status === 'draw') lastActionText = `Draw by rule.`;
  else if (inCheck) lastActionText = `${playerName} plays ${san} — Check!`;

  return {
    ...state,
    board: nextBoard,
    turn: nextTurn,
    castling: nextCastling,
    enPassantSquare: nextEnPassant,
    halfMoveClock: nextHalfClock,
    fullMoveNumber: nextFullMove,
    inCheck,
    status,
    winnerId,
    lastMove: { from: move.from, to: move.to },
    history: [...state.history, entry],
    capturedByWhite,
    capturedByBlack,
    lastActionText,
  };
}

export function resignChessGame(
  state: ChessState,
  playerId: string,
  playerName: string
): ChessState {
  if (state.status !== 'playing') return state;
  const winnerId = playerId === state.whiteId ? state.blackId : state.whiteId;
  return {
    ...state,
    status: 'resigned',
    winnerId,
    lastActionText: `${playerName} resigned.`,
  };
}
