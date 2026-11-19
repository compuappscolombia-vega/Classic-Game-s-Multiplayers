import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Globe,
  LogIn,
  LogOut,
  MessageSquare,
  Send,
  Trophy,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  ensureAndLoadUserProfile,
  recordMatchOutcome,
  signOutAccount,
  subscribeAuth,
  updateUserPreferences,
  type UserProfile,
} from './lib/firebase.ts';
import { audioVoice } from './lib/audioVoice.ts';
import { useMultiplayerSocket } from './lib/useMultiplayerSocket.ts';
import { AuthModal } from './components/AuthModal.tsx';
import { SocialLobby } from './components/SocialLobby.tsx';
import { LeaderboardView } from './components/LeaderboardView.tsx';
import { VoiceAnnouncerHUD } from './components/VoiceAnnouncerHUD.tsx';
import { DominoArena } from './games/DominoArena.tsx';
import { ParquesArena } from './games/ParquesArena.tsx';
import { AhorcadoArena } from './games/AhorcadoArena.tsx';
import { BingoArena } from './games/BingoArena.tsx';
import type { GameType, Language, PlayerInfo } from './shared/types.ts';

type TabView = 'games' | 'multiplayer' | 'leaderboard' | 'profile';

interface GameCatalogItem {
  id: GameType;
  title: string;
  subtitle: string;
  playersLabel: string;
  image: string;
  description: string;
}

const GAME_CATALOG: GameCatalogItem[] = [
  {
    id: 'domino',
    title: 'Dominó Clásico',
    subtitle: 'Double-Six · Strategic Chain',
    playersLabel: '2–4 Players',
    image: '/src/assets/images/game_domino_art_1795057510287.jpg',
    description:
      'Classic 28-tile Double-Six dominoes with boneyard draws, spinner doubles, and blocked-board pip tie-breakers.',
  },
  {
    id: 'parques',
    title: 'Parqués',
    subtitle: '68-Track · Safe Zones & Captures',
    playersLabel: '2–4 Players',
    image: '/assets/aistudio/image_2cd5d3ec.png',
    description:
      'Authentic 4-corner Colombian Parqués with twin dice, jail-break doubles, safe squares, and home-stretch captures.',
  },
  {
    id: 'ahorcado',
    title: 'Ahorcado',
    subtitle: 'Bilingual Word Duel · EN / ES',
    playersLabel: '1–4 Players',
    image: '/src/assets/images/game_ahorcado_art_1795057508724.jpg',
    description:
      'Solve curated English and Spanish mystery words across 5 categories before six misses complete the gallows.',
  },
  {
    id: 'bingo',
    title: 'Bingo 75',
    subtitle: 'Voice Caller · Live Patterns',
    playersLabel: '1–4 Players',
    image: '/src/assets/images/game_bingo_art_1795057509157.jpg',
    description:
      '75-ball lottery caller with animated voice announcements, Line, 4 Corners, X, and Blackout winning patterns.',
  },
];

function useUiAudioFeedback(soundEnabled: boolean, activeTab: TabView) {
  const prevTabRef = useRef<TabView>(activeTab);

  // Play a distinct rising UI chirp when navigating between tabs
  useEffect(() => {
    if (prevTabRef.current !== activeTab) {
      prevTabRef.current = activeTab;
      if (soundEnabled) {
        audioVoice.playTabNav();
      }
    }
  }, [activeTab, soundEnabled]);

  // Play a tactile short pop when clicking enabled buttons (skipping tab switches handled above)
  useEffect(() => {
    if (!soundEnabled) return;

    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const btn = target?.closest('button, [role="button"]') as HTMLButtonElement | null;
      if (!btn) return;
      if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return;
      if (btn.dataset.uiSound === 'tab') return;
      audioVoice.playUiClick();
    };

    document.addEventListener('click', handleGlobalClick, true);
    return () => document.removeEventListener('click', handleGlobalClick, true);
  }, [soundEnabled]);
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabView>('games');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Guest fallback preferences (persisted locally for offline practice)
  const [guestName, setGuestName] = useState<string>(() => {
    return localStorage.getItem('mr_guest_name') || `Guest_${Math.floor(1000 + Math.random() * 9000)}`;
  });
  const [guestId] = useState<string>(() => {
    const existing = localStorage.getItem('mr_guest_id');
    if (existing) return existing;
    const created = `guest_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('mr_guest_id', created);
    return created;
  });

  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [language, setLanguage] = useState<Language>('en');

  // Offline AI match state
  const [activeAiGame, setActiveAiGame] = useState<GameType | null>(null);

  // Online in-game chat drawer
  const [tableChatOpen, setTableChatOpen] = useState(false);
  const [tableChatInput, setTableChatInput] = useState('');

  // Profile edit state
  const [editName, setEditName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Firebase Auth listener & cross-device sync
  useEffect(() => {
    localStorage.setItem('mr_guest_name', guestName);
  }, [guestName]);

  useEffect(() => {
    const unsub = subscribeAuth(async (user) => {
      if (!user) {
        setProfile(null);
        return;
      }
      const loaded = await ensureAndLoadUserProfile(user);
      setProfile(loaded);
      setVoiceEnabled(loaded.voiceEnabled);
      setSoundEnabled(loaded.soundEnabled);
      setLanguage(loaded.language);
      setEditName(loaded.displayName);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    audioVoice.voiceEnabled = voiceEnabled;
    audioVoice.soundEnabled = soundEnabled;
  }, [voiceEnabled, soundEnabled]);

  useUiAudioFeedback(soundEnabled, activeTab);

  const localPlayer = useMemo<PlayerInfo>(() => {
    if (profile) {
      return {
        id: profile.uid,
        name: profile.displayName,
        avatarUrl: profile.photoURL,
        elo: profile.elo,
        ready: true,
        connected: true,
      };
    }
    return {
      id: guestId,
      name: guestName,
      avatarUrl: '',
      elo: 1000,
      ready: true,
      connected: true,
    };
  }, [profile, guestId, guestName]);

  const socket = useMultiplayerSocket(localPlayer);

  const inOnlineMatch = Boolean(
    socket.currentRoom &&
      (socket.currentRoom.status === 'playing' || socket.currentRoom.status === 'finished')
  );

  const handleToggleVoice = async () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    if (!next) audioVoice.stopVoice();
    if (profile) {
      const updated = { ...profile, voiceEnabled: next };
      setProfile(updated);
      await updateUserPreferences(profile.uid, { voiceEnabled: next });
    }
  };

  const handleToggleSound = async () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (profile) {
      const updated = { ...profile, soundEnabled: next };
      setProfile(updated);
      await updateUserPreferences(profile.uid, { soundEnabled: next });
    }
  };

  const handleToggleLanguage = async () => {
    const next: Language = language === 'en' ? 'es' : 'en';
    setLanguage(next);
    if (profile) {
      const updated = { ...profile, language: next };
      setProfile(updated);
      await updateUserPreferences(profile.uid, { language: next });
    }
  };

  const handleMatchFinished = useCallback(
    async (game: GameType, mode: 'online' | 'ai', outcome: 'win' | 'loss' | 'draw', score: number) => {
      if (!profile) return;
      const updated = await recordMatchOutcome(profile, { game, mode, outcome, score });
      setProfile(updated);
    },
    [profile]
  );

  const handleSaveProfileName = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = editName.trim().slice(0, 40);
    if (!clean) return;
    if (profile) {
      setSavingProfile(true);
      try {
        await updateUserPreferences(profile.uid, { displayName: clean });
        setProfile({ ...profile, displayName: clean });
      } finally {
        setSavingProfile(false);
      }
    } else {
      setGuestName(clean);
    }
  };

  const startOnlineQuickTable = (game: GameType) => {
    setActiveAiGame(null);
    setActiveTab('multiplayer');
    socket.createRoom(`${localPlayer.name}'s ${game.toUpperCase()}`, game, 4, false);
  };

  const launchAiGame = (game: GameType) => {
    setActiveAiGame(game);
    audioVoice.speak(
      language === 'es' ? `Iniciando práctica de ${game}.` : `Starting ${game} AI practice.`,
      language
    );
  };

  // --- FULL-VIEWPORT ACTIVE GAME ARENA ---
  if (inOnlineMatch && socket.currentRoom) {
    const room = socket.currentRoom;
    return (
      <div className="min-h-screen bg-[#0c1110] text-[#f4f1ea] flex flex-col p-3 sm:p-5 gap-3 max-w-[1440px] mx-auto">
        {/* Top Utility Strip inside Active Play */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-stone-400">
            <span className="font-semibold text-emerald-400">Live Online Room</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">#{room.code}</span>
            <span aria-hidden="true">·</span>
            <span>{room.players.length} players</span>
          </div>

          <div className="flex items-center gap-2">
            <VoiceAnnouncerHUD
              voiceEnabled={voiceEnabled}
              soundEnabled={soundEnabled}
              language={language}
              onToggleVoice={handleToggleVoice}
              onToggleSound={handleToggleSound}
              onToggleLanguage={handleToggleLanguage}
            />
            <button
              type="button"
              onClick={() => setTableChatOpen((v) => !v)}
              className="min-h-[40px] px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-stone-200 flex items-center gap-1.5 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span>Chat</span>
            </button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div className={tableChatOpen ? 'lg:col-span-9' : 'lg:col-span-12'}>
            {room.game === 'domino' && (
              <DominoArena
                mode="online"
                language={language}
                localPlayer={localPlayer}
                players={room.players}
                onlineState={room.domino}
                onOnlineAction={(action) => socket.sendGameAction(room.id, action)}
                onMatchFinished={(outcome, score) =>
                  void handleMatchFinished('domino', 'online', outcome, score)
                }
                onExit={() => socket.leaveRoom(room.id)}
              />
            )}
            {room.game === 'parques' && (
              <ParquesArena
                mode="online"
                language={language}
                localPlayer={localPlayer}
                players={room.players}
                onlineState={room.parques}
                onOnlineAction={(action) => socket.sendGameAction(room.id, action)}
                onMatchFinished={(outcome, score) =>
                  void handleMatchFinished('parques', 'online', outcome, score)
                }
                onExit={() => socket.leaveRoom(room.id)}
              />
            )}
            {room.game === 'ahorcado' && (
              <AhorcadoArena
                mode="online"
                language={language}
                localPlayer={localPlayer}
                players={room.players}
                onlineState={room.ahorcado}
                onOnlineAction={(action) => socket.sendGameAction(room.id, action)}
                onMatchFinished={(outcome, score) =>
                  void handleMatchFinished('ahorcado', 'online', outcome, score)
                }
                onExit={() => socket.leaveRoom(room.id)}
              />
            )}
            {room.game === 'bingo' && (
              <BingoArena
                mode="online"
                language={language}
                localPlayer={localPlayer}
                players={room.players}
                onlineState={room.bingo}
                onOnlineAction={(action) => socket.sendGameAction(room.id, action)}
                onMatchFinished={(outcome, score) =>
                  void handleMatchFinished('bingo', 'online', outcome, score)
                }
                onExit={() => socket.leaveRoom(room.id)}
              />
            )}
          </div>

          {tableChatOpen && (
            <div className="lg:col-span-3 bg-[#141b18] border border-white/10 rounded-2xl p-4 flex flex-col max-h-[600px]">
              <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
                <span className="text-sm font-bold">Table Chat</span>
                <button
                  type="button"
                  onClick={() => setTableChatOpen(false)}
                  className="p-1 text-stone-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-3 space-y-2 text-xs">
                {socket.roomChat.map((m) => (
                  <div key={m.id}>
                    {m.kind === 'system' ? (
                      <span className="text-amber-300/80 italic">{m.text}</span>
                    ) : (
                      <p className="text-stone-200 break-words">
                        <span className="font-semibold text-emerald-300">{m.senderName}: </span>
                        {m.text}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!tableChatInput.trim()) return;
                  socket.sendRoomChat(room.id, tableChatInput.trim(), 'chat');
                  setTableChatInput('');
                }}
                className="flex items-center gap-2 pt-2 border-t border-white/10"
              >
                <input
                  type="text"
                  value={tableChatInput}
                  onChange={(e) => setTableChatInput(e.target.value)}
                  placeholder="Say something..."
                  className="flex-1 min-h-[40px] px-3 rounded-lg bg-black/40 border border-white/10 text-xs text-white"
                />
                <button
                  type="submit"
                  className="min-h-[40px] min-w-[40px] rounded-lg bg-emerald-600 text-white flex items-center justify-center cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activeAiGame) {
    return (
      <div className="min-h-screen bg-[#0c1110] text-[#f4f1ea] flex flex-col p-3 sm:p-5 gap-3 max-w-[1440px] mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-stone-400">
            <Bot className="w-4 h-4 text-amber-400" />
            <span>Offline AI Practice Arena</span>
          </div>
          <VoiceAnnouncerHUD
            voiceEnabled={voiceEnabled}
            soundEnabled={soundEnabled}
            language={language}
            onToggleVoice={handleToggleVoice}
            onToggleSound={handleToggleSound}
            onToggleLanguage={handleToggleLanguage}
          />
        </div>

        <div className="flex-1">
          {activeAiGame === 'domino' && (
            <DominoArena
              mode="ai"
              language={language}
              localPlayer={localPlayer}
              players={[localPlayer]}
              onMatchFinished={(outcome, score) =>
                void handleMatchFinished('domino', 'ai', outcome, score)
              }
              onExit={() => setActiveAiGame(null)}
            />
          )}
          {activeAiGame === 'parques' && (
            <ParquesArena
              mode="ai"
              language={language}
              localPlayer={localPlayer}
              players={[localPlayer]}
              onMatchFinished={(outcome, score) =>
                void handleMatchFinished('parques', 'ai', outcome, score)
              }
              onExit={() => setActiveAiGame(null)}
            />
          )}
          {activeAiGame === 'ahorcado' && (
            <AhorcadoArena
              mode="ai"
              language={language}
              localPlayer={localPlayer}
              players={[localPlayer]}
              onMatchFinished={(outcome, score) =>
                void handleMatchFinished('ahorcado', 'ai', outcome, score)
              }
              onExit={() => setActiveAiGame(null)}
            />
          )}
          {activeAiGame === 'bingo' && (
            <BingoArena
              mode="ai"
              language={language}
              localPlayer={localPlayer}
              players={[localPlayer]}
              onMatchFinished={(outcome, score) =>
                void handleMatchFinished('bingo', 'ai', outcome, score)
              }
              onExit={() => setActiveAiGame(null)}
            />
          )}
        </div>
      </div>
    );
  }

  // --- MAIN SALON SHELL (3-Zone Top Bar + Hero / Lobby / Leaderboard / Profile) ---
  return (
    <div className="min-h-screen bg-[#0c1110] text-[#f4f1ea] flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="border-b border-white/10 bg-[#0f1513]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            data-ui-sound={activeTab !== 'games' ? 'tab' : undefined}
            onClick={() => setActiveTab('games')}
            className="flex items-center gap-2.5 text-lg font-display font-extrabold tracking-tight text-[#f4f1ea] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="28" height="28" rx="7" fill="#0B4632" stroke="#D97706" strokeWidth="2" />
              <circle cx="11" cy="11" r="2.6" fill="#FAF6EE" />
              <circle cx="21" cy="21" r="2.6" fill="#FAF6EE" />
              <line x1="7" y1="22" x2="25" y2="10" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>Mesa Real</span>
          </button>

          {/* Zone 2: Clean Single-Line Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
            {(
              [
                ['games', 'Game Salon'],
                ['multiplayer', 'Multiplayer & Chat'],
                ['leaderboard', 'Leaderboard'],
                ['profile', 'Account'],
              ] as [TabView, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                data-ui-sound="tab"
                onClick={() => setActiveTab(id)}
                className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === id
                    ? 'border-emerald-400 text-[#f4f1ea]'
                    : 'border-transparent text-stone-400 hover:text-stone-200'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            {profile ? (
              <button
                type="button"
                data-ui-sound={activeTab !== 'profile' ? 'tab' : undefined}
                onClick={() => setActiveTab('profile')}
                className="min-h-[40px] px-3.5 py-2 rounded-lg bg-white/8 hover:bg-white/14 border border-white/12 text-xs font-semibold text-[#f4f1ea] flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {profile.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt={profile.displayName}
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <UserIcon className="w-4 h-4 text-emerald-400" />
                )}
                <span className="max-w-[110px] truncate">{profile.displayName}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Secondary Tab Bar (keeps mobile touch targets >= 44px) */}
        <div className="flex md:hidden border-t border-white/8 overflow-x-auto px-3 py-1.5 gap-2">
          {(
            [
              ['games', 'Games'],
              ['multiplayer', 'Lobby'],
              ['leaderboard', 'Ranks'],
              ['profile', 'Account'],
            ] as [TabView, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              data-ui-sound="tab"
              onClick={() => setActiveTab(id)}
              className={`min-h-[40px] px-3.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === id
                  ? 'bg-emerald-600 text-white'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Workspace Utility Strip (Voice Animate, Sound, Language, Live Count) */}
      <div className="border-b border-white/6 bg-[#0c1110]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-stone-400">
            <span>{socket.connected ? `${socket.onlineCount} Players Online` : 'Connecting to Salon'}</span>
            <span aria-hidden="true">·</span>
            <span>{socket.rooms.length} Open Tables</span>
            {profile && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num text-amber-300">ELO {profile.elo}</span>
              </>
            )}
          </div>

          <VoiceAnnouncerHUD
            voiceEnabled={voiceEnabled}
            soundEnabled={soundEnabled}
            language={language}
            onToggleVoice={handleToggleVoice}
            onToggleSound={handleToggleSound}
            onToggleLanguage={handleToggleLanguage}
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 py-6 space-y-8">
        {activeTab === 'games' && (
          <>
            {/* Key-Art Atmospheric Title Banner */}
            <section className="relative rounded-2xl overflow-hidden border border-white/10 min-h-[300px] sm:min-h-[340px] flex items-center">
              <img
                src="/src/assets/images/salon_hero_backdrop_1795057509654.jpg"
                alt="Mesa Real Emerald Felt Salon Table"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#090d0c]/95 via-[#090d0c]/80 to-[#090d0c]/30" />

              <div className="relative z-10 p-6 sm:p-10 max-w-2xl space-y-4">
                <div className="text-xs text-amber-300 font-medium">
                  Real-Time Multiplayer · Offline AI Practice · Voice Announcer
                </div>
                <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-[#f4f1ea] leading-tight text-balance">
                  Classic Tabletop Rivals, Live on Every Screen
                </h1>
                <p className="text-sm sm:text-base text-stone-300 max-w-xl leading-relaxed">
                  Compete across Dominó, Parqués, Ahorcado, and Bingo 75 in real time or sharpen your strategy offline against adaptive AI opponents.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    data-ui-sound="tab"
                    onClick={() => setActiveTab('multiplayer')}
                    className="min-h-[46px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    <Globe className="w-4 h-4" />
                    Enter Multiplayer Lobby
                  </button>
                  <button
                    type="button"
                    onClick={() => launchAiGame('domino')}
                    className="min-h-[46px] px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/16 border border-white/15 text-[#f4f1ea] text-sm font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    <Bot className="w-4 h-4 text-amber-300" />
                    Quick AI Practice
                  </button>
                </div>

                <p className="text-xs text-stone-400 pt-1">
                  Tap or Click to Play · Physical Keyboard Supported in Ahorcado · Cross-Device Google & Apple Sync
                </p>
              </div>
            </section>

            {/* 4-Game Salon Grid */}
            <section className="space-y-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl sm:text-2xl font-display font-bold text-[#f4f1ea]">
                  Choose Your Table
                </h2>
                <span className="text-xs text-stone-400">4 Classic Titles</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                {GAME_CATALOG.map((g) => (
                  <article
                    key={g.id}
                    className="bg-[#141b18] border border-white/10 rounded-2xl overflow-hidden flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5"
                  >
                    <div>
                      <div className="aspect-[4/3] bg-[#0e1412] overflow-hidden">
                        <img
                          src={g.image}
                          alt={g.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="p-4 space-y-2">
                        <div className="text-xs text-stone-400">
                          {g.subtitle} · {g.playersLabel}
                        </div>
                        <h3 className="text-lg font-display font-bold text-[#f4f1ea]">{g.title}</h3>
                        <p className="text-xs text-stone-300 leading-relaxed">{g.description}</p>
                      </div>
                    </div>

                    <div className="px-4 pb-4 pt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => launchAiGame(g.id)}
                        className="flex-1 min-h-[42px] px-3 py-2 rounded-xl bg-white/8 hover:bg-white/14 border border-white/10 text-xs font-semibold text-[#f4f1ea] flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Bot className="w-3.5 h-3.5 text-amber-300" />
                        Practice AI
                      </button>
                      <button
                        type="button"
                        onClick={() => startOnlineQuickTable(g.id)}
                        className="flex-1 min-h-[42px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        Play Online
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {activeTab === 'multiplayer' && (
          <SocialLobby
            connected={socket.connected}
            onlineCount={socket.onlineCount}
            player={localPlayer}
            rooms={socket.rooms}
            lobbyChat={socket.lobbyChat}
            currentRoom={socket.currentRoom}
            roomChat={socket.roomChat}
            socketError={socket.socketError}
            language={language}
            onSendLobbyChat={socket.sendLobbyChat}
            onSendRoomChat={socket.sendRoomChat}
            onCreateRoom={socket.createRoom}
            onJoinRoomById={socket.joinRoomById}
            onJoinRoomByCode={socket.joinRoomByCode}
            onLeaveRoom={socket.leaveRoom}
            onToggleReady={socket.toggleReady}
            onStartGame={socket.startGame}
          />
        )}

        {activeTab === 'leaderboard' && (
          <LeaderboardView profile={profile} onOpenAuth={() => setAuthModalOpen(true)} />
        )}

        {activeTab === 'profile' && (
          <div className="max-w-2xl mx-auto bg-[#141b18] border border-white/10 rounded-2xl p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-white/10">
              <div className="flex items-center gap-3.5">
                {profile?.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt={profile.displayName}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-full object-cover border border-white/15"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-emerald-700/40 border border-emerald-400/30 flex items-center justify-center text-xl font-bold">
                    {localPlayer.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold text-[#f4f1ea]">{localPlayer.name}</h2>
                  <p className="text-xs text-stone-400">
                    {profile
                      ? `Synced via ${profile.provider === 'apple' ? 'Apple ID' : 'Google'} · ELO ${profile.elo}`
                      : 'Guest Session — Sign in to sync across devices'}
                  </p>
                </div>
              </div>

              {profile ? (
                <button
                  type="button"
                  onClick={() => void signOutAccount()}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-white/8 hover:bg-rose-500/20 border border-white/10 text-xs font-semibold text-stone-200 flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  Connect Google / Apple ID
                </button>
              )}
            </div>

            {profile && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ['Total Wins', `${profile.totalWins}/${profile.totalGames}`],
                  ['Dominó Wins', String(profile.dominoWins)],
                  ['Parqués Wins', String(profile.parquesWins)],
                  ['Ahorcado + Bingo', String(profile.ahorcadoWins + profile.bingoWins)],
                ].map(([label, val]) => (
                  <div key={label} className="p-3.5 rounded-xl bg-[#0e1412] border border-white/8">
                    <div className="text-xs text-stone-400">{label}</div>
                    <div className="text-lg font-mono-num font-bold text-emerald-300 mt-1">{val}</div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSaveProfileName} className="space-y-3">
              <label className="block text-xs font-medium text-stone-300">
                Table Display Name
              </label>
              <div className="flex items-center gap-2.5">
                <input
                  type="text"
                  value={profile ? editName : guestName}
                  onChange={(e) =>
                    profile ? setEditName(e.target.value) : setGuestName(e.target.value)
                  }
                  maxLength={40}
                  className="flex-1 min-h-[44px] px-3.5 rounded-xl bg-black/40 border border-white/10 text-sm text-[#f4f1ea]"
                />
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="min-h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold cursor-pointer"
                >
                  {savingProfile ? 'Saving...' : 'Save Name'}
                </button>
              </div>
            </form>

            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-stone-400">
              <span className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-400" />
                Online wins grant +25 ELO · AI wins grant +10 ELO
              </span>
            </div>
          </div>
        )}
      </main>

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSignedIn={() => {
          audioVoice.speak(
            language === 'es' ? 'Cuenta sincronizada con éxito.' : 'Account synchronized.',
            language
          );
        }}
      />
    </div>
  );
}
