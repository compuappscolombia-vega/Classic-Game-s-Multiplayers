export type GameType = 'domino' | 'parques' | 'ahorcado' | 'bingo' | 'ajedrez' | 'barcos';
export type GameMode = 'online' | 'ai';
export type Language = 'en' | 'es';

export interface PlayerInfo {
  id: string;
  name: string;
  avatarUrl: string;
  elo: number;
  isAi?: boolean;
  ready?: boolean;
  connected?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  roomId: string; // 'lobby' or specific roomId
  timestamp: number;
  kind?: 'chat' | 'system' | 'emote';
}

// --- DAILY MISSIONS ---
export interface DailyMissionDef {
  id: string;
  titleEn: string;
  titleEs: string;
  game: GameType | 'any';
  kind: 'win' | 'play';
  target: number;
  rewardElo: number;
}

export interface DailyMissionSlot {
  def: DailyMissionDef;
  progress: number;
  claimed: boolean;
}

// --- DOMINO ---
export interface DominoTile {
  id: string;
  a: number;
  b: number;
}

export interface PlacedDomino {
  id: string;
  left: number;
  right: number;
  isDouble: boolean;
  playedBy: string;
}

export interface DominoState {
  board: PlacedDomino[];
  leftEnd: number | null;
  rightEnd: number | null;
  hands: Record<string, DominoTile[]>;
  handCounts: Record<string, number>;
  boneyard: DominoTile[];
  boneyardCount: number;
  turnOrder: string[];
  currentTurnIndex: number;
  consecutivePasses: number;
  winnerId: string | null;
  winReason: 'emptied' | 'blocked' | null;
  scores: Record<string, number>;
  lastActionText: string;
}

// --- PARQUES ---
export type ParquesColor = 'red' | 'blue' | 'yellow' | 'green';

export interface ParquesPawn {
  id: number; // 0..3
  pos: number; // -1 = jail, 0..67 = main track, 100..106 = home stretch, 107 = goal
}

export interface ParquesPlayerState {
  playerId: string;
  color: ParquesColor;
  pawns: ParquesPawn[];
  doublesStreak: number;
  jailAttempts: number;
}

export interface ParquesMoveOption {
  pawnId: number;
  dieValue: number;
  dieIndex: number | 'combo';
  fromPos: number;
  toPos: number;
  captures?: { playerId: string; pawnId: number }[];
  isReleaseFromJail?: boolean;
}

export interface ParquesState {
  players: ParquesPlayerState[];
  turnOrder: string[];
  currentTurnIndex: number;
  dice: [number, number] | null;
  diceRemaining: number[]; // e.g., [4, 2] or [6]
  hasRolled: boolean;
  bonusRollPending: boolean;
  winnerId: string | null;
  lastActionText: string;
  lastCaptureText: string | null;
}

// --- AHORCADO ---
export type AhorcadoCategory = 'animals' | 'geography' | 'science' | 'cuisine' | 'cinema';

export interface AhorcadoPlayerProgress {
  playerId: string;
  guessedLetters: string[];
  wrongCount: number;
  solved: boolean;
  eliminated: boolean;
  score: number;
  finishedAt: number | null;
}

export interface AhorcadoState {
  language: Language;
  category: AhorcadoCategory;
  hint: string;
  wordLength: number;
  secretWord: string; // masked on client until round over
  revealedMask: Record<string, string[]>; // per player: array of char or ''
  progress: Record<string, AhorcadoPlayerProgress>;
  maxWrong: number;
  roundNumber: number;
  winnerId: string | null;
  status: 'playing' | 'finished';
  lastActionText: string;
}

// --- BINGO ---
export type BingoPattern = 'line' | 'corners' | 'x' | 'full';

export interface BingoCard {
  grid: number[][]; // 5x5; center [2][2] is 0 (FREE)
}

export interface BingoPlayerState {
  playerId: string;
  card: BingoCard;
  daubed: boolean[][];
  progressPct: number;
  claimedBingo: boolean;
}

export interface BingoState {
  pattern: BingoPattern;
  calledNumbers: number[];
  currentBall: number | null;
  remainingPool: number[];
  players: Record<string, BingoPlayerState>;
  winnerId: string | null;
  status: 'playing' | 'finished';
  lastActionText: string;
}

// --- AJEDREZ (CHESS) ---
export type ChessColor = 'w' | 'b';
export type ChessPieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type ChessDifficulty = 'easy' | 'medium' | 'hard' | 'very_hard' | 'very_very_hard';

export interface ChessPiece {
  color: ChessColor;
  type: ChessPieceType;
}

export interface ChessCastlingRights {
  wK: boolean;
  wQ: boolean;
  bK: boolean;
  bQ: boolean;
}

export interface ChessMove {
  from: number; // 0..63 (row*8 + col, row 0 = rank 8)
  to: number;
  promotion?: ChessPieceType;
  isCastle?: 'K' | 'Q';
  isEnPassant?: boolean;
  captured?: ChessPieceType;
}

export interface ChessHistoryEntry {
  san: string;
  uci: string;
  color: ChessColor;
  from: number;
  to: number;
}

export interface ChessState {
  board: (ChessPiece | null)[]; // 64 squares
  turn: ChessColor;
  castling: ChessCastlingRights;
  enPassantSquare: number | null;
  halfMoveClock: number;
  fullMoveNumber: number;
  whiteId: string;
  blackId: string;
  inCheck: boolean;
  status: 'playing' | 'checkmate' | 'stalemate' | 'draw' | 'resigned';
  winnerId: string | null;
  lastMove: { from: number; to: number } | null;
  history: ChessHistoryEntry[];
  capturedByWhite: ChessPieceType[];
  capturedByBlack: ChessPieceType[];
  lastActionText: string;
}

// --- BARCOS DE GUERRA (BATTLESHIP) ---
export type BarcosShipId = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';
export type BarcosOrientation = 'H' | 'V';
export type BarcosShotResult = 'miss' | 'hit' | 'sunk';

export interface BarcosShip {
  id: BarcosShipId;
  nameEn: string;
  nameEs: string;
  size: number;
  row: number;
  col: number;
  orientation: BarcosOrientation;
  placed: boolean;
  hits: number[];
  sunk: boolean;
}

export interface BarcosShot {
  row: number;
  col: number;
  result: BarcosShotResult;
  sunkShipId?: BarcosShipId;
}

export interface BarcosBoardState {
  playerId: string;
  ready: boolean;
  ships: BarcosShip[];
  incomingShots: BarcosShot[];
}

export interface BarcosState {
  gridSize: number;
  boards: Record<string, BarcosBoardState>;
  turnOrder: [string, string];
  currentTurnIndex: number;
  phase: 'setup' | 'battle' | 'finished';
  winnerId: string | null;
  lastShot: {
    shooterId: string;
    targetId: string;
    row: number;
    col: number;
    result: BarcosShotResult;
    sunkShipId?: BarcosShipId;
  } | null;
  turnCount: number;
  lastActionText: string;
}

// --- ROOM & MULTIPLAYER ---
export interface RoomSummary {
  id: string;
  code: string;
  name: string;
  game: GameType;
  hostId: string;
  hostName: string;
  maxPlayers: number;
  players: PlayerInfo[];
  status: 'waiting' | 'playing' | 'finished';
  isPrivate: boolean;
  createdAt: number;
}

export interface RoomState extends RoomSummary {
  domino?: DominoState;
  parques?: ParquesState;
  ahorcado?: AhorcadoState;
  bingo?: BingoState;
  ajedrez?: ChessState;
  barcos?: BarcosState;
}

export type ClientWsMessage =
  | { type: 'auth_hello'; player: PlayerInfo }
  | { type: 'lobby_chat'; text: string; kind?: 'chat' | 'emote' }
  | { type: 'room_chat'; roomId: string; text: string; kind?: 'chat' | 'emote' }
  | { type: 'create_room'; name: string; game: GameType; maxPlayers: number; isPrivate: boolean; options?: { language?: Language; category?: AhorcadoCategory; pattern?: BingoPattern } }
  | { type: 'join_room'; roomId?: string; code?: string }
  | { type: 'leave_room'; roomId: string }
  | { type: 'toggle_ready'; roomId: string }
  | { type: 'start_game'; roomId: string; options?: { language?: Language; category?: AhorcadoCategory; pattern?: BingoPattern } }
  | { type: 'game_action'; roomId: string; action: Record<string, unknown> }
  | { type: 'ping' };

export type ServerWsMessage =
  | { type: 'welcome'; clientId: string; onlineCount: number; rooms: RoomSummary[]; lobbyChat: ChatMessage[] }
  | { type: 'online_count'; onlineCount: number }
  | { type: 'rooms_list'; rooms: RoomSummary[] }
  | { type: 'lobby_chat_msg'; message: ChatMessage }
  | { type: 'room_chat_msg'; roomId: string; message: ChatMessage }
  | { type: 'room_state'; room: RoomState; roomChat?: ChatMessage[] }
  | { type: 'room_left'; roomId: string }
  | { type: 'error'; message: string }
  | { type: 'pong' };
