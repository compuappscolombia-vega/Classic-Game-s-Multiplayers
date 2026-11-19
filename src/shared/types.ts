export type GameType = 'domino' | 'parques' | 'ahorcado' | 'bingo';
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
