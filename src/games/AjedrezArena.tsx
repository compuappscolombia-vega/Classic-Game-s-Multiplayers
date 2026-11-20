import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Brain,
  Crown,
  Flag,
  LogOut,
  RotateCcw,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import {
  applyChessMove,
  createChessGame,
  getLegalChessMoves,
  resignChessGame,
  sqToCoord,
} from '../shared/chessEngine.ts';
import {
  analyzeOpponentStyle,
  chooseArthurChessMove,
  DEFAULT_LEARNING_PROFILE,
  type OpponentLearningProfile,
} from '../shared/chessArthurAi.ts';
import { audioVoice } from '../lib/audioVoice.ts';
import type {
  ChessColor,
  ChessDifficulty,
  ChessPiece,
  ChessPieceType,
  ChessState,
  GameMode,
  Language,
  PlayerInfo,
} from '../shared/types.ts';

interface AjedrezArenaProps {
  mode: GameMode;
  language: Language;
  localPlayer: PlayerInfo;
  players: PlayerInfo[];
  onlineState?: ChessState;
  onOnlineAction?: (action: Record<string, unknown>) => void;
  onMatchFinished: (outcome: 'win' | 'loss' | 'draw', score: number) => void;
  onExit: () => void;
}

const ARTHUR_ID = 'ai_arthur_gm';
const LEARNING_STORAGE_KEY = 'mr_arthur_learning_v1';

const PIECE_VALUE_MAP: Record<ChessPieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const DIFFICULTIES: {
  id: ChessDifficulty;
  labelEn: string;
  labelEs: string;
  eloLabel: string;
}[] = [
  { id: 'easy', labelEn: 'Easy', labelEs: 'Fácil', eloLabel: '900' },
  { id: 'medium', labelEn: 'Medium', labelEs: 'Medio', eloLabel: '1400' },
  { id: 'hard', labelEn: 'Hard', labelEs: 'Difícil', eloLabel: '1950' },
  { id: 'very_hard', labelEn: 'Very Hard', labelEs: 'Muy Difícil', eloLabel: '2450' },
  { id: 'very_very_hard', labelEn: 'Very Very Hard', labelEs: 'Muy Muy Difícil', eloLabel: '2900+' },
];

function loadLearningProfile(): OpponentLearningProfile {
  try {
    const raw = localStorage.getItem(LEARNING_STORAGE_KEY);
    if (!raw) return DEFAULT_LEARNING_PROFILE;
    const parsed = JSON.parse(raw) as Partial<OpponentLearningProfile>;
    return { ...DEFAULT_LEARNING_PROFILE, ...parsed };
  } catch {
    return DEFAULT_LEARNING_PROFILE;
  }
}

function saveLearningProfile(profile: OpponentLearningProfile): void {
  try {
    localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage limits
  }
}

function ChessPieceSvg({
  piece,
  sizeClass = 'w-[82%] h-[82%]',
}: {
  piece: ChessPiece;
  sizeClass?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const isWhite = piece.color === 'w';
  const bodyGradId = `chessBody_${uid}`;
  const baseGradId = `chessBase_${uid}`;
  const goldGradId = `chessGold_${uid}`;
  const stroke = isWhite ? '#412a18' : '#d6b67d';
  const detail = isWhite ? '#b68344' : '#e5b869';

  return (
    <svg
      viewBox="0 0 45 45"
      className={`${sizeClass} drop-shadow-[0_4px_4px_rgba(0,0,0,0.68)] select-none pointer-events-none`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={bodyGradId} x1="15%" y1="10%" x2="90%" y2="90%">
          {isWhite ? (
            <>
              <stop offset="0%" stopColor="#FFFDF8" />
              <stop offset="48%" stopColor="#F1E0BE" />
              <stop offset="100%" stopColor="#B9935D" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#52463F" />
              <stop offset="42%" stopColor="#221B17" />
              <stop offset="100%" stopColor="#090706" />
            </>
          )}
        </linearGradient>
        <linearGradient id={baseGradId} x1="0%" y1="0%" x2="100%" y2="0%">
          {isWhite ? (
            <>
              <stop offset="0%" stopColor="#E9D3AD" />
              <stop offset="50%" stopColor="#FFF9EC" />
              <stop offset="100%" stopColor="#A67F4A" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#3B312B" />
              <stop offset="50%" stopColor="#1B1512" />
              <stop offset="100%" stopColor="#080605" />
            </>
          )}
        </linearGradient>
        <linearGradient id={goldGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="50%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>
      </defs>

      {/* Felt Base Ground Shadow */}
      <ellipse cx="22.5" cy="40.5" rx="14.5" ry="3.2" fill="#000000" fillOpacity="0.48" />

      {piece.type === 'p' && (
        <g>
          <path
            d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"
            fill={`url(#${bodyGradId})`}
            stroke={stroke}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <ellipse cx="22.5" cy="39.2" rx="11.8" ry="1.8" fill={`url(#${baseGradId})`} stroke={stroke} strokeWidth="0.9" />
          <ellipse cx="21" cy="12" rx="1.6" ry="1.1" fill="#FFFFFF" fillOpacity={isWhite ? 0.8 : 0.32} />
        </g>
      )}

      {piece.type === 'r' && (
        <g fill={`url(#${bodyGradId})`} stroke={stroke} strokeWidth="1.6" strokeLinejoin="round">
          <path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5" />
          <path d="M34 14l-3 3H14l-3-3" />
          <path d="M31 17v12.5H14V17" />
          <path d="M31 29.5l1.5 2.5h-20l1.5-2.5" />
          <path d="M11 14h23" fill="none" stroke={detail} strokeWidth="1.2" />
          <rect x="9" y="36" width="27" height="3" fill={`url(#${baseGradId})`} />
        </g>
      )}

      {piece.type === 'n' && (
        <g fill={`url(#${bodyGradId})`} stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" />
          <path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" />
          <circle cx="15" cy="15.5" r="1.15" fill={`url(#${goldGradId})`} stroke="none" />
          <path d="M14 39h24" stroke={detail} strokeWidth="1.4" />
        </g>
      )}

      {piece.type === 'b' && (
        <g fill={`url(#${bodyGradId})`} stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z" />
          <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z" />
          <circle cx="22.5" cy="8" r="2.6" fill={`url(#${goldGradId})`} />
          <path d="M17.5 26h10M15 30h15M22.5 15.5v5M20 18h5" stroke={detail} fill="none" />
        </g>
      )}

      {piece.type === 'q' && (
        <g fill={`url(#${bodyGradId})`} stroke={stroke} strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="12" r="2.2" fill={`url(#${goldGradId})`} />
          <circle cx="14" cy="9" r="2.2" fill={`url(#${goldGradId})`} />
          <circle cx="22.5" cy="8" r="2.4" fill={`url(#${goldGradId})`} />
          <circle cx="31" cy="9" r="2.2" fill={`url(#${goldGradId})`} />
          <circle cx="39" cy="12" r="2.2" fill={`url(#${goldGradId})`} />
          <path d="M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-.3-14.1-5.2 13.6-3-14.5-3 14.5-5.2-13.6L14 25 6.5 13.5 9 26z" />
          <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" />
          <path d="M11 33.5h23M12 36.5h21" stroke={detail} strokeWidth="1.1" fill="none" />
        </g>
      )}

      {piece.type === 'k' && (
        <g fill={`url(#${bodyGradId})`} stroke={stroke} strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22.5 11.63V6M20 8h5" stroke={`url(#${goldGradId})`} strokeWidth="2.1" />
          <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" />
          <path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z" />
          <path d="M11.5 30c5.5-3 15.5-3 21 0M11.5 33.5c5.5-3 15.5-3 21 0M11.5 37c5.5-3 15.5-3 21 0" stroke={detail} fill="none" />
        </g>
      )}
    </svg>
  );
}

export function AjedrezArena({
  mode,
  language,
  localPlayer,
  players,
  onlineState,
  onOnlineAction,
  onMatchFinished,
  onExit,
}: AjedrezArenaProps) {
  const [difficulty, setDifficulty] = useState<ChessDifficulty>('hard');
  const [humanSide, setHumanSide] = useState<ChessColor>('w');
  const [learning, setLearning] = useState<OpponentLearningProfile>(() => loadLearningProfile());
  const learningRef = useRef(learning);
  learningRef.current = learning;

  const [arthurComment, setArthurComment] = useState<string>('');
  const [arthurThinking, setArthurThinking] = useState(false);

  const [aiState, setAiState] = useState<ChessState>(() =>
    createChessGame(localPlayer.id, ARTHUR_ID, localPlayer.name)
  );
  const [selectedSq, setSelectedSq] = useState<number | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: number; to: number } | null>(null);
  const [flipped, setFlipped] = useState(false);

  const reportedMatchRef = useRef<string | null>(null);

  const state = mode === 'online' ? onlineState : aiState;

  const myColor: ChessColor = useMemo(() => {
    if (!state) return 'w';
    if (state.blackId === localPlayer.id) return 'b';
    return 'w';
  }, [state, localPlayer.id]);

  useEffect(() => {
    if (mode === 'ai') {
      setFlipped(humanSide === 'b');
    } else if (state) {
      setFlipped(state.blackId === localPlayer.id);
    }
  }, [mode, humanSide, localPlayer.id, state?.whiteId, state?.blackId]);

  const legalMoves = useMemo(() => {
    if (!state || state.status !== 'playing') return [];
    return getLegalChessMoves(state.board, state.turn, state.castling, state.enPassantSquare);
  }, [state]);

  const legalForSelected = useMemo(() => {
    if (selectedSq === null) return [];
    return legalMoves.filter((m) => m.from === selectedSq);
  }, [legalMoves, selectedSq]);

  const isMyTurn = useMemo(() => {
    if (!state || state.status !== 'playing') return false;
    return (state.turn === 'w' ? state.whiteId : state.blackId) === localPlayer.id;
  }, [state, localPlayer.id]);

  const whiteName = useMemo(() => {
    if (!state) return localPlayer.name;
    if (state.whiteId === ARTHUR_ID) return 'Arthur (World Champion AI)';
    return players.find((p) => p.id === state.whiteId)?.name || localPlayer.name;
  }, [state, players, localPlayer.name]);

  const blackName = useMemo(() => {
    if (!state) return 'Arthur';
    if (state.blackId === ARTHUR_ID) return 'Arthur (World Champion AI)';
    return players.find((p) => p.id === state.blackId)?.name || 'Opponent';
  }, [state, players]);

  const startNewAiMatch = (nextSide: ChessColor = humanSide, nextDiff: ChessDifficulty = difficulty) => {
    setHumanSide(nextSide);
    setDifficulty(nextDiff);
    setSelectedSq(null);
    setPendingPromotion(null);
    setArthurThinking(false);
    reportedMatchRef.current = null;
    const whiteId = nextSide === 'w' ? localPlayer.id : ARTHUR_ID;
    const blackId = nextSide === 'w' ? ARTHUR_ID : localPlayer.id;
    const wName = nextSide === 'w' ? localPlayer.name : 'Arthur GM';
    setAiState(createChessGame(whiteId, blackId, wName));
    setArthurComment(
      language === 'es'
        ? 'Arthur analiza tu estilo de apertura y busca el dominio central.'
        : 'Arthur is analyzing your opening repertoire and central control.'
    );
    audioVoice.speak(
      language === 'es'
        ? 'Nueva partida de ajedrez contra el gran maestro Arthur.'
        : 'New chess match against Grandmaster Arthur.',
      language
    );
  };

  useEffect(() => {
    if (mode !== 'ai' || !state || state.status !== 'playing') return;
    const activeId = state.turn === 'w' ? state.whiteId : state.blackId;
    if (activeId !== ARTHUR_ID) return;

    setArthurThinking(true);
    const delayMs = difficulty === 'very_very_hard' ? 420 : difficulty === 'very_hard' ? 360 : 280;
    const timer = setTimeout(() => {
      const updatedProfile = analyzeOpponentStyle(state.history, humanSide, learningRef.current);
      setLearning(updatedProfile);
      saveLearningProfile(updatedProfile);

      const decision = chooseArthurChessMove(state, difficulty, updatedProfile);
      if (decision) {
        const next = applyChessMove(
          state,
          ARTHUR_ID,
          {
            from: decision.move.from,
            to: decision.move.to,
            promotion: decision.move.promotion,
          },
          'Arthur GM'
        );
        setAiState(next);
        setArthurComment(language === 'es' ? decision.commentEs : decision.commentEn);
        if (decision.move.captured || next.inCheck) {
          audioVoice.playCaptureBoom();
        } else {
          audioVoice.playDominoClack();
        }
        if (next.status === 'checkmate') {
          audioVoice.speak(
            language === 'es' ? 'Jaque mate de Arthur.' : 'Checkmate by Arthur.',
            language
          );
        } else if (next.inCheck) {
          audioVoice.speak(language === 'es' ? 'Jaque.' : 'Check.', language);
        }
      }
      setArthurThinking(false);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [mode, state, difficulty, humanSide, language]);

  useEffect(() => {
    if (!state || state.status === 'playing') return;
    const finishKey = `${state.status}_${state.history.length}_${state.winnerId || 'draw'}`;
    if (reportedMatchRef.current === finishKey) return;
    reportedMatchRef.current = finishKey;

    if (mode === 'ai') {
      const nextLearning = { ...learningRef.current, gamesPlayed: learningRef.current.gamesPlayed + 1 };
      setLearning(nextLearning);
      saveLearningProfile(nextLearning);
    }

    const isDraw = state.status === 'stalemate' || state.status === 'draw';
    const outcome: 'win' | 'loss' | 'draw' = isDraw
      ? 'draw'
      : state.winnerId === localPlayer.id
      ? 'win'
      : 'loss';

    const score =
      outcome === 'win'
        ? Math.max(120, 600 - state.history.length * 4)
        : outcome === 'draw'
        ? 180
        : 60;

    if (outcome === 'win') {
      audioVoice.playVictoryFanfare();
      audioVoice.speak(
        language === 'es' ? '¡Victoria magistral en ajedrez!' : 'Masterful chess victory!',
        language
      );
    }
    onMatchFinished(outcome, score);
  }, [state, mode, localPlayer.id, onMatchFinished, language]);

  if (!state) {
    return (
      <div className="p-8 text-center text-stone-400">
        {language === 'es' ? 'Preparando tablero de ajedrez...' : 'Preparing chessboard...'}
      </div>
    );
  }

  const executeHumanMove = (from: number, to: number, promotion?: ChessPieceType) => {
    setSelectedSq(null);
    setPendingPromotion(null);

    if (mode === 'online') {
      onOnlineAction?.({ kind: 'move', from, to, promotion });
      audioVoice.playDominoClack();
      return;
    }

    const next = applyChessMove(
      state,
      localPlayer.id,
      { from, to, promotion },
      localPlayer.name
    );
    setAiState(next);
    const updatedProfile = analyzeOpponentStyle(next.history, humanSide, learningRef.current);
    setLearning(updatedProfile);
    saveLearningProfile(updatedProfile);

    const lastMove = next.history[next.history.length - 1];
    if (lastMove?.san.includes('x') || next.inCheck) {
      audioVoice.playCaptureBoom();
    } else {
      audioVoice.playDominoClack();
    }
    if (next.inCheck && next.status === 'playing') {
      audioVoice.speak(language === 'es' ? 'Jaque.' : 'Check.', language);
    }
  };

  const handleSquareClick = (sq: number) => {
    if (!isMyTurn || arthurThinking || pendingPromotion) return;

    const targetMoveMatches = legalForSelected.filter((m) => m.to === sq);
    if (targetMoveMatches.length > 0) {
      if (targetMoveMatches.some((m) => Boolean(m.promotion))) {
        setPendingPromotion({ from: selectedSq!, to: sq });
        return;
      }
      executeHumanMove(selectedSq!, sq);
      return;
    }

    const piece = state.board[sq];
    if (piece && piece.color === state.turn) {
      setSelectedSq(sq === selectedSq ? null : sq);
    } else {
      setSelectedSq(null);
    }
  };

  const handleResign = () => {
    if (state.status !== 'playing') return;
    if (mode === 'online') {
      onOnlineAction?.({ kind: 'resign' });
    } else {
      setAiState(resignChessGame(state, localPlayer.id, localPlayer.name));
    }
  };

  const whiteCapturedPts = state.capturedByWhite.reduce((acc, p) => acc + PIECE_VALUE_MAP[p], 0);
  const blackCapturedPts = state.capturedByBlack.reduce((acc, p) => acc + PIECE_VALUE_MAP[p], 0);
  const materialDelta = whiteCapturedPts - blackCapturedPts;

  const moveRows: { num: number; w?: string; b?: string }[] = [];
  for (let i = 0; i < state.history.length; i += 2) {
    moveRows.push({
      num: Math.floor(i / 2) + 1,
      w: state.history[i]?.san,
      b: state.history[i + 1]?.san,
    });
  }

  const displaySquares: number[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const boardRow = flipped ? 7 - r : r;
      const boardCol = flipped ? 7 - c : c;
      displaySquares.push(boardRow * 8 + boardCol);
    }
  }

  const activeTurnName = state.turn === 'w' ? whiteName : blackName;

  return (
    <div className="wood-tabletop border border-[#5a3b28]/60 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-2xl">
      {/* Header Control Bar */}
      <div className="surface-3d-panel rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-amber-200/85">
            <Crown className="w-4 h-4 text-amber-400" />
            <span>
              {mode === 'online'
                ? language === 'es'
                  ? 'Ajedrez Clásico Online'
                  : 'Ajedrez Online Match'
                : language === 'es'
                ? 'Duelo de Gran Maestro vs Arthur AI'
                : 'Grandmaster Duel vs Arthur AI'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">
              {language === 'es' ? `Jugada ${state.fullMoveNumber}` : `Move ${state.fullMoveNumber}`}
            </span>
          </div>
          <h2 className="text-lg font-display font-bold text-[#f7f2e8] mt-0.5">
            {state.status === 'playing'
              ? isMyTurn
                ? language === 'es'
                  ? 'Tu turno — mueve una pieza'
                  : 'Your Turn — Move a Piece'
                : arthurThinking
                ? language === 'es'
                  ? 'Arthur está calculando...'
                  : 'Arthur is calculating...'
                : `${activeTurnName} ${language === 'es' ? 'mueve' : 'to move'}`
              : state.lastActionText}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFlipped((v) => !v)}
            className="min-h-[40px] px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 border border-white/15 text-xs font-semibold text-stone-200 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
            {language === 'es' ? 'Girar' : 'Flip'}
          </button>

          {mode === 'ai' && (
            <button
              type="button"
              onClick={() => startNewAiMatch(humanSide, difficulty)}
              className="min-h-[40px] px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 border border-white/15 text-xs font-semibold text-stone-200 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-300" />
              {language === 'es' ? 'Reiniciar' : 'New Match'}
            </button>
          )}

          {state.status === 'playing' && (
            <button
              type="button"
              onClick={handleResign}
              className="min-h-[40px] px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 border border-rose-400/30 text-xs font-semibold text-rose-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Flag className="w-3.5 h-3.5" />
              {language === 'es' ? 'Rendirse' : 'Resign'}
            </button>
          )}

          <button
            type="button"
            onClick={onExit}
            className="min-h-[40px] px-3 py-1.5 rounded-lg bg-white/8 hover:bg-rose-500/20 border border-white/12 text-xs font-semibold text-stone-200 flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            {language === 'es' ? 'Salir' : 'Exit'}
          </button>
        </div>
      </div>

      {/* Main Chess Workspace: Left 3D Tournament Board + Right Arthur AI & Move Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Chessboard Column */}
        <div className="lg:col-span-7 flex flex-col items-center gap-3">
          {/* Top Opponent Bar */}
          <div className="w-full max-w-[548px] flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-black/45 border border-white/12 text-xs shadow-md">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-3.5 h-3.5 rounded-sm border ${
                  flipped
                    ? 'bg-[#faf6ec] border-stone-500'
                    : 'bg-[#1b1715] border-amber-300/60'
                }`}
              />
              <span className="font-semibold text-[#f4f1ea] truncate">
                {flipped ? whiteName : blackName}
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono-num text-stone-300 shrink-0">
              <span>
                {(flipped ? state.capturedByWhite : state.capturedByBlack)
                  .map((p) => p.toUpperCase())
                  .join(' ')}
              </span>
              {(flipped ? materialDelta > 0 : materialDelta < 0) && (
                <span className="text-emerald-300 font-bold">
                  +{Math.abs(materialDelta)}
                </span>
              )}
            </div>
          </div>

          {/* 3D Extruded Mahogany Cabinet + Brass Bezel + Volumetric Staunton Pieces */}
          <div className="tabletop-3d-stage w-full max-w-[548px]">
            <div className="relative w-full tabletop-3d-cabinet board-3d-tilt p-3 sm:p-4 rounded-xl">
              <div className="p-[2.5px] rounded-sm brass-bezel">
                <div className="grid grid-cols-8 aspect-square w-full border border-[#2c1509] shadow-[inset_0_2px_12px_rgba(0,0,0,0.68)] overflow-hidden">
                  {displaySquares.map((sq) => {
                    const row = Math.floor(sq / 8);
                    const col = sq % 8;
                    const isLight = (row + col) % 2 === 0;
                    const piece = state.board[sq];
                    const isSelected = selectedSq === sq;
                    const isLastMove =
                      state.lastMove && (state.lastMove.from === sq || state.lastMove.to === sq);
                    const legalTarget = legalForSelected.find((m) => m.to === sq);
                    const isKingInCheck =
                      state.inCheck && piece?.type === 'k' && piece.color === state.turn;

                    const showRankLabel = flipped ? col === 7 : col === 0;
                    const showFileLabel = flipped ? row === 0 : row === 7;

                    return (
                      <button
                        key={sq}
                        type="button"
                        onClick={() => handleSquareClick(sq)}
                        aria-label={`Square ${sqToCoord(sq)}`}
                        className={`relative flex items-center justify-center aspect-square cursor-pointer transition-colors ${
                          isKingInCheck
                            ? 'bg-rose-600/90 shadow-inner'
                            : isSelected
                            ? 'bg-emerald-500/85 ring-2 ring-inset ring-emerald-200'
                            : isLastMove
                            ? isLight
                              ? 'bg-[#ebd78a]'
                              : 'bg-[#aa8d3c]'
                            : isLight
                            ? 'chess-square-light hover:brightness-105'
                            : 'chess-square-dark hover:brightness-110'
                        }`}
                      >
                        {showRankLabel && (
                          <span
                            className={`absolute top-0.5 left-1 text-[9px] font-mono-num font-bold leading-none ${
                              isLight ? 'text-[#6c462d]/90' : 'text-[#ecd9b9]/90'
                            }`}
                          >
                            {8 - row}
                          </span>
                        )}
                        {showFileLabel && (
                          <span
                            className={`absolute bottom-0.5 right-1 text-[9px] font-mono-num font-bold leading-none ${
                              isLight ? 'text-[#6c462d]/90' : 'text-[#ecd9b9]/90'
                            }`}
                          >
                            {'abcdefgh'[col]}
                          </span>
                        )}

                        {piece && <ChessPieceSvg piece={piece} />}

                        {legalTarget && !piece && (
                          <span className="w-3.5 h-3.5 rounded-full bg-emerald-500/90 shadow-md ring-2 ring-emerald-100/85" />
                        )}
                        {legalTarget && piece && (
                          <span className="absolute inset-1 rounded-full border-[3px] border-emerald-400/95 shadow-sm pointer-events-none" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {pendingPromotion && (
                <div className="absolute inset-0 bg-black/75 flex items-center justify-center p-4 rounded-xl z-20">
                  <div className="surface-3d-panel rounded-2xl p-4 space-y-3 text-center">
                    <div className="text-sm font-bold text-[#f7f2e8]">
                      {language === 'es' ? 'Elige promoción del peón' : 'Choose Pawn Promotion'}
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {(['q', 'r', 'b', 'n'] as ChessPieceType[]).map((promo) => (
                        <button
                          key={promo}
                          type="button"
                          onClick={() =>
                            executeHumanMove(pendingPromotion.from, pendingPromotion.to, promo)
                          }
                          className="w-14 h-14 rounded-xl bg-[#2c1f16] hover:bg-emerald-700/60 border border-amber-300/35 flex items-center justify-center cursor-pointer shadow-lg"
                        >
                          <ChessPieceSvg piece={{ color: myColor, type: promo }} sizeClass="w-11 h-11" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Local Player Bar */}
          <div className="w-full max-w-[548px] flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-black/45 border border-white/12 text-xs shadow-md">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`w-3.5 h-3.5 rounded-sm border ${
                  flipped
                    ? 'bg-[#1b1715] border-amber-300/60'
                    : 'bg-[#faf6ec] border-stone-500'
                }`}
              />
              <span className="font-semibold text-[#f4f1ea] truncate">
                {flipped ? blackName : whiteName}
              </span>
              {state.inCheck && state.status === 'playing' && (
                <span className="text-rose-400 font-bold flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {language === 'es' ? 'Jaque' : 'Check'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 font-mono-num text-stone-300 shrink-0">
              <span>
                {(flipped ? state.capturedByBlack : state.capturedByWhite)
                  .map((p) => p.toUpperCase())
                  .join(' ')}
              </span>
              {(flipped ? materialDelta < 0 : materialDelta > 0) && (
                <span className="text-emerald-300 font-bold">
                  +{Math.abs(materialDelta)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Arthur Champion AI Adaptive Brain & Move Ledger */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {mode === 'ai' && (
            <div className="surface-3d-panel rounded-2xl p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/45 flex items-center justify-center text-amber-300 shrink-0 shadow-inner">
                    <Brain className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#f4f1ea]">
                      Arthur — World Champion AI
                    </h3>
                    <p className="text-[11px] text-amber-300/90 font-mono-num">
                      {DIFFICULTIES.find((d) => d.id === difficulty)?.eloLabel} ELO ·{' '}
                      {language === 'es' ? 'Aprendizaje Adaptativo' : 'Adaptive Engine'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/10">
                  {(['w', 'b'] as ChessColor[]).map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => startNewAiMatch(side, difficulty)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                        humanSide === side
                          ? 'bg-emerald-600 text-white'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      {side === 'w'
                        ? language === 'es'
                          ? 'Blancas'
                          : 'White'
                        : language === 'es'
                        ? 'Negras'
                        : 'Black'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 5 Difficulty Levels */}
              <div className="space-y-1.5">
                <div className="text-[11px] text-stone-400">
                  {language === 'es' ? 'Nivel de Arthur' : 'Arthur Difficulty'}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDifficulty(d.id)}
                      className={`min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        difficulty === d.id
                          ? 'bg-gradient-to-b from-amber-400 to-amber-600 text-[#120d06] shadow-[0_3px_0_#78350f]'
                          : 'bg-white/6 text-stone-300 hover:bg-white/12 border border-white/8'
                      }`}
                    >
                      {language === 'es' ? d.labelEs : d.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              {/* Adaptive Telemetry Readout */}
              <div className="p-3 rounded-xl bg-black/45 border border-white/10 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {language === 'es'
                      ? 'Lectura Táctica sobre tu Juego'
                      : 'Live Pattern Learning on Your Play'}
                  </span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed">
                  {arthurComment ||
                    (language === 'es' ? learning.lastInsightEs : learning.lastInsightEn)}
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] font-mono-num">
                  <div className="p-2 rounded-lg bg-white/[0.04]">
                    <div className="text-stone-400">
                      {language === 'es' ? 'Agresión' : 'Aggression'}
                    </div>
                    <div className="text-amber-300 font-bold mt-0.5">
                      {learning.aggressionScore}%
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/[0.04]">
                    <div className="text-stone-400">
                      {language === 'es' ? 'Flanco Dama' : 'Queenside'}
                    </div>
                    <div className="text-emerald-300 font-bold mt-0.5">
                      {learning.queensideTendency}%
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/[0.04]">
                    <div className="text-stone-400">
                      {language === 'es' ? 'Cambios' : 'Exchanges'}
                    </div>
                    <div className="text-stone-200 font-bold mt-0.5">
                      {learning.tradeWillingness}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Move Notation Ledger */}
          <div className="surface-3d-panel rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#f4f1ea]">
                {language === 'es' ? 'Registro de Jugadas' : 'Match Notation'}
              </h3>
              <span className="text-xs text-stone-400 font-mono-num">
                {state.history.length} {language === 'es' ? 'movs' : 'plies'}
              </span>
            </div>

            {moveRows.length === 0 ? (
              <div className="py-8 text-center text-xs text-stone-400">
                {language === 'es'
                  ? 'Toca cualquier pieza iluminada para abrir la partida.'
                  : 'Tap any piece on your rank to begin the opening.'}
              </div>
            ) : (
              <div className="max-h-[250px] overflow-y-auto space-y-1 pr-1 text-xs font-mono-num">
                {moveRows.map((row) => (
                  <div
                    key={row.num}
                    className="grid grid-cols-12 items-center px-2.5 py-1.5 rounded-lg bg-black/35"
                  >
                    <span className="col-span-2 text-stone-500">{row.num}.</span>
                    <span className="col-span-5 text-[#f4f1ea] font-semibold">{row.w || ''}</span>
                    <span className="col-span-5 text-amber-200">{row.b || ''}</span>
                  </div>
                ))}
              </div>
            )}

            {state.status !== 'playing' && (
              <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-400/35 text-center space-y-2">
                <div className="text-sm font-bold text-emerald-200">{state.lastActionText}</div>
                {mode === 'ai' && (
                  <button
                    type="button"
                    onClick={() => startNewAiMatch(humanSide, difficulty)}
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    {language === 'es' ? 'Jugar Revancha' : 'Play Rematch'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
