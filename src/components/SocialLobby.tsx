import { useEffect, useRef, useState } from 'react';
import { Users, Plus, Send, Lock, Unlock, ArrowRight, CheckCircle2, Play, LogOut } from 'lucide-react';
import type {
  AhorcadoCategory,
  BingoPattern,
  ChatMessage,
  GameType,
  Language,
  PlayerInfo,
  RoomState,
  RoomSummary,
} from '../shared/types.ts';

interface SocialLobbyProps {
  connected: boolean;
  onlineCount: number;
  player: PlayerInfo;
  rooms: RoomSummary[];
  lobbyChat: ChatMessage[];
  currentRoom: RoomState | null;
  roomChat: ChatMessage[];
  socketError: string | null;
  language: Language;
  onSendLobbyChat: (text: string, kind?: 'chat' | 'emote') => void;
  onSendRoomChat: (roomId: string, text: string, kind?: 'chat' | 'emote') => void;
  onCreateRoom: (name: string, game: GameType, maxPlayers: number, isPrivate: boolean) => void;
  onJoinRoomById: (roomId: string) => void;
  onJoinRoomByCode: (code: string) => void;
  onLeaveRoom: (roomId: string) => void;
  onToggleReady: (roomId: string) => void;
  onStartGame: (
    roomId: string,
    options?: { language?: Language; category?: AhorcadoCategory; pattern?: BingoPattern }
  ) => void;
}

const GAME_LABELS: Record<GameType, string> = {
  domino: 'Dominó',
  parques: 'Parqués',
  ahorcado: 'Ahorcado',
  bingo: 'Bingo 75',
  ajedrez: 'Ajedrez',
};

const QUICK_EMOTES = ['👏', '🎲', '🔥', '🏆', '😅', '🎯'];

export function SocialLobby({
  connected,
  onlineCount,
  player,
  rooms,
  lobbyChat,
  currentRoom,
  roomChat,
  socketError,
  language,
  onSendLobbyChat,
  onSendRoomChat,
  onCreateRoom,
  onJoinRoomById,
  onJoinRoomByCode,
  onLeaveRoom,
  onToggleReady,
  onStartGame,
}: SocialLobbyProps) {
  const [filterGame, setFilterGame] = useState<GameType | 'all'>('all');
  const [roomName, setRoomName] = useState('');
  const [selectedGame, setSelectedGame] = useState<GameType>('domino');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [isPrivate, setIsPrivate] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [ahorcadoCat, setAhorcadoCat] = useState<AhorcadoCategory>('animals');
  const [bingoPat, setBingoPat] = useState<BingoPattern>('line');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const activeChat = currentRoom ? roomChat : lobbyChat;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat.length]);

  const filteredRooms = rooms.filter((r) => filterGame === 'all' || r.game === filterGame);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const label = roomName.trim() || `${player.name}'s ${GAME_LABELS[selectedGame]}`;
    onCreateRoom(label, selectedGame, selectedGame === 'ajedrez' ? 2 : maxPlayers, isPrivate);
    setRoomName('');
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    if (currentRoom) {
      onSendRoomChat(currentRoom.id, text, 'chat');
    } else {
      onSendLobbyChat(text, 'chat');
    }
    setChatInput('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Left 7 cols: Multiplayer Tables OR Active Waiting Room */}
      <div className="lg:col-span-7 surface-3d-panel rounded-2xl p-5 flex flex-col gap-5">
        {socketError && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/30 text-xs text-rose-200">
            {socketError}
          </div>
        )}

        {currentRoom && currentRoom.status === 'waiting' ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2 text-xs text-stone-400">
                  <span>{GAME_LABELS[currentRoom.game]}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num text-amber-300">Code: {currentRoom.code}</span>
                  <span aria-hidden="true">·</span>
                  <span>{currentRoom.isPrivate ? 'Private Table' : 'Public Table'}</span>
                </div>
                <h3 className="text-xl font-bold text-[#f4f1ea] mt-1">{currentRoom.name}</h3>
              </div>

              <button
                type="button"
                onClick={() => onLeaveRoom(currentRoom.id)}
                className="min-h-[40px] px-3.5 py-2 rounded-lg bg-white/5 hover:bg-rose-500/20 border border-white/10 text-xs font-medium text-stone-200 flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Leave Table
              </button>
            </div>

            {/* Seated Players */}
            <div>
              <div className="flex items-center justify-between text-xs text-stone-400 mb-3">
                <span>
                  Seated Players ({currentRoom.players.length}/{currentRoom.maxPlayers})
                </span>
                <span>Need at least 2 players to begin</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentRoom.players.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-[#0e1412] border border-white/10 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {p.avatarUrl ? (
                        <img
                          src={p.avatarUrl}
                          alt={p.name}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded-full object-cover border border-white/15"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-emerald-700/50 border border-emerald-400/30 flex items-center justify-center text-sm font-bold text-emerald-100 shrink-0">
                          {p.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#f4f1ea] truncate">
                          {p.name}
                          {p.id === currentRoom.hostId ? ' (Host)' : ''}
                        </div>
                        <div className="text-xs text-stone-400 font-mono-num">ELO {p.elo}</div>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        p.ready ? 'text-emerald-400' : 'text-stone-400'
                      }`}
                    >
                      {p.ready ? 'Ready' : 'Waiting'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Game-specific Host Options */}
            {currentRoom.hostId === player.id && currentRoom.game === 'ahorcado' && (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <span className="text-xs text-stone-400">Word Category:</span>
                {(['animals', 'geography', 'science', 'cuisine', 'cinema'] as AhorcadoCategory[]).map(
                  (cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setAhorcadoCat(cat)}
                      className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium capitalize cursor-pointer ${
                        ahorcadoCat === cat
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white/5 text-stone-300 hover:bg-white/10'
                      }`}
                    >
                      {cat}
                    </button>
                  )
                )}
              </div>
            )}

            {currentRoom.hostId === player.id && currentRoom.game === 'bingo' && (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <span className="text-xs text-stone-400">Winning Pattern:</span>
                {(['line', 'corners', 'x', 'full'] as BingoPattern[]).map((pat) => (
                  <button
                    key={pat}
                    type="button"
                    onClick={() => setBingoPat(pat)}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium uppercase cursor-pointer ${
                      bingoPat === pat
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white/5 text-stone-300 hover:bg-white/10'
                    }`}
                  >
                    {pat === 'full' ? 'Blackout' : pat}
                  </button>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onToggleReady(currentRoom.id)}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/8 hover:bg-white/14 border border-white/12 text-sm font-semibold text-[#f4f1ea] flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Toggle Ready
              </button>

              {currentRoom.hostId === player.id && (
                <button
                  type="button"
                  disabled={currentRoom.players.length < 2}
                  onClick={() =>
                    onStartGame(currentRoom.id, {
                      language,
                      category: ahorcadoCat,
                      pattern: bingoPat,
                    })
                  }
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  Start Online Match
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Create Room Form */}
            <form
              onSubmit={handleCreate}
              className="p-4 rounded-xl bg-[#0e1412] border border-white/8 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#f4f1ea]">Open a Multiplayer Table</h3>
                <span className="text-xs text-stone-400 font-mono-num">
                  {connected ? `${onlineCount} online` : 'Connecting...'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Table name (optional)"
                  maxLength={40}
                  className="sm:col-span-5 min-h-[44px] px-3 rounded-lg bg-black/40 border border-white/10 text-sm text-[#f4f1ea] placeholder:text-stone-500 focus:outline-none focus:border-emerald-400"
                />
                <select
                  value={selectedGame}
                  onChange={(e) => {
                    const nextGame = e.target.value as GameType;
                    setSelectedGame(nextGame);
                    if (nextGame === 'ajedrez') setMaxPlayers(2);
                  }}
                  className="sm:col-span-3 min-h-[44px] px-3 rounded-lg bg-black/40 border border-white/10 text-sm text-[#f4f1ea] focus:outline-none focus:border-emerald-400"
                >
                  <option value="domino">Dominó</option>
                  <option value="parques">Parqués</option>
                  <option value="ahorcado">Ahorcado</option>
                  <option value="bingo">Bingo 75</option>
                  <option value="ajedrez">Ajedrez</option>
                </select>
                <select
                  value={selectedGame === 'ajedrez' ? 2 : maxPlayers}
                  disabled={selectedGame === 'ajedrez'}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                  className="sm:col-span-2 min-h-[44px] px-2.5 rounded-lg bg-black/40 border border-white/10 text-sm text-[#f4f1ea] focus:outline-none focus:border-emerald-400 disabled:opacity-60"
                >
                  <option value={2}>2 Seats</option>
                  <option value={3}>3 Seats</option>
                  <option value={4}>4 Seats</option>
                </select>
                <button
                  type="button"
                  onClick={() => setIsPrivate((v) => !v)}
                  className={`sm:col-span-2 min-h-[44px] px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer ${
                    isPrivate
                      ? 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                      : 'bg-white/5 border-white/10 text-stone-300'
                  }`}
                  title="Toggle Public or Private Invite Code"
                >
                  {isPrivate ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  {isPrivate ? 'Private' : 'Public'}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Room Code"
                    maxLength={5}
                    className="w-28 min-h-[40px] px-3 rounded-lg bg-black/40 border border-white/10 text-xs font-mono-num uppercase text-[#f4f1ea] placeholder:text-stone-500 focus:outline-none focus:border-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (joinCode.trim().length >= 4) {
                        onJoinRoomByCode(joinCode.trim());
                        setJoinCode('');
                      }
                    }}
                    className="min-h-[40px] px-3 rounded-lg bg-white/8 hover:bg-white/14 text-xs font-semibold text-stone-200 cursor-pointer"
                  >
                    Join Code
                  </button>
                </div>

                <button
                  type="submit"
                  className="min-h-[42px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  Create Table
                </button>
              </div>
            </form>

            {/* Filter Bar + Open Tables List */}
            <div className="space-y-3 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 p-1 bg-black/30 rounded-lg border border-white/8 overflow-x-auto">
                  {(['all', 'domino', 'parques', 'ahorcado', 'bingo', 'ajedrez'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setFilterGame(g)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        filterGame === g
                          ? 'bg-emerald-600 text-white'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      {g === 'all' ? 'All Tables' : GAME_LABELS[g]}
                    </button>
                  ))}
                </div>
              </div>

              {filteredRooms.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-white/10 text-stone-400 text-sm">
                  No open tables yet. Create a table above or share your 5-character room code with a friend.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                  {filteredRooms.map((r) => (
                    <div
                      key={r.id}
                      className="p-3.5 rounded-xl bg-[#0e1412] border border-white/10 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-stone-400">
                          <span className="text-emerald-400 font-semibold">{GAME_LABELS[r.game]}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-num">
                            {r.players.length}/{r.maxPlayers} seats
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-num">#{r.code}</span>
                        </div>
                        <div className="text-sm font-semibold text-[#f4f1ea] truncate mt-0.5">
                          {r.name}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={r.status !== 'waiting' || r.players.length >= r.maxPlayers}
                        onClick={() => onJoinRoomById(r.id)}
                        className="min-h-[40px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-stone-400 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        {r.status === 'playing' ? 'In Play' : 'Join'}
                        {r.status === 'waiting' && <ArrowRight className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Right 5 cols: Real-Time Social Chat */}
      <div className="lg:col-span-5 surface-3d-panel rounded-2xl p-5 flex flex-col h-[520px]">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <h3 className="text-base font-bold text-[#f4f1ea]">
              {currentRoom ? `${currentRoom.name} Chat` : 'Social Lobby Chat'}
            </h3>
          </div>
          <span className="text-xs text-stone-400 font-mono-num">
            {connected ? `${onlineCount} connected` : 'Offline'}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
          {activeChat.length === 0 ? (
            <div className="text-xs text-stone-500 text-center py-8">
              Say hello to other players in the salon.
            </div>
          ) : (
            activeChat.map((m) => (
              <div
                key={m.id}
                className={`text-sm ${
                  m.kind === 'system'
                    ? 'text-xs text-amber-300/90 italic py-1'
                    : 'flex items-start gap-2.5'
                }`}
              >
                {m.kind !== 'system' && (
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-stone-200 shrink-0 mt-0.5 overflow-hidden">
                    {m.senderAvatar ? (
                      <img
                        src={m.senderAvatar}
                        alt={m.senderName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      m.senderName.slice(0, 1).toUpperCase()
                    )}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {m.kind !== 'system' && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-emerald-300 truncate">
                        {m.senderName}
                      </span>
                      <span className="text-[11px] text-stone-500 font-mono-num">
                        {new Date(m.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}
                  <p className={`${m.kind === 'emote' ? 'text-xl' : 'text-sm text-stone-200 break-words'}`}>
                    {m.text}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick Emote Bar */}
        <div className="flex items-center gap-1.5 py-2 border-t border-white/8">
          {QUICK_EMOTES.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() =>
                currentRoom
                  ? onSendRoomChat(currentRoom.id, em, 'emote')
                  : onSendLobbyChat(em, 'emote')
              }
              className="min-h-[36px] min-w-[36px] rounded-lg bg-white/5 hover:bg-white/12 text-base flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
            >
              {em}
            </button>
          ))}
        </div>

        <form onSubmit={handleSendChat} className="flex items-center gap-2 pt-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={currentRoom ? 'Message table...' : 'Message global lobby...'}
            maxLength={240}
            className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-[#f4f1ea] placeholder:text-stone-500 focus:outline-none focus:border-emerald-400"
          />
          <button
            type="submit"
            className="min-h-[44px] min-w-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center cursor-pointer"
            aria-label="Send chat message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
