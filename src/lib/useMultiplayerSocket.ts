import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AhorcadoCategory,
  BingoPattern,
  ChatMessage,
  ClientWsMessage,
  GameType,
  Language,
  PlayerInfo,
  RoomState,
  RoomSummary,
  ServerWsMessage,
} from '../shared/types.ts';

export function useMultiplayerSocket(player: PlayerInfo) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [clientId, setClientId] = useState<string>('');
  const [onlineCount, setOnlineCount] = useState(1);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [lobbyChat, setLobbyChat] = useState<ChatMessage[]>([]);
  const [currentRoom, setCurrentRoom] = useState<RoomState | null>(null);
  const [roomChat, setRoomChat] = useState<ChatMessage[]>([]);
  const [socketError, setSocketError] = useState<string | null>(null);

  const playerRef = useRef(player);
  playerRef.current = player;

  const send = useCallback((msg: ClientWsMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    let closedByCleanup = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pingTimer: ReturnType<typeof setInterval> | null = null;

    const connect = () => {
      if (closedByCleanup) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${window.location.host}/ws`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setSocketError(null);
        ws.send(JSON.stringify({ type: 'auth_hello', player: playerRef.current }));
      };

      ws.onmessage = (evt) => {
        let data: ServerWsMessage;
        try {
          data = JSON.parse(evt.data) as ServerWsMessage;
        } catch {
          return;
        }

        if (data.type === 'welcome') {
          setClientId(data.clientId);
          setOnlineCount(data.onlineCount);
          setRooms(data.rooms);
          setLobbyChat(data.lobbyChat);
        } else if (data.type === 'online_count') {
          setOnlineCount(data.onlineCount);
        } else if (data.type === 'rooms_list') {
          setRooms(data.rooms);
        } else if (data.type === 'lobby_chat_msg') {
          setLobbyChat((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev.slice(-59), data.message];
          });
        } else if (data.type === 'room_state') {
          setCurrentRoom(data.room);
          if (data.roomChat) {
            setRoomChat(data.roomChat);
          }
        } else if (data.type === 'room_chat_msg') {
          setRoomChat((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev.slice(-49), data.message];
          });
        } else if (data.type === 'room_left') {
          setCurrentRoom(null);
          setRoomChat([]);
        } else if (data.type === 'error') {
          setSocketError(data.message);
          setTimeout(() => setSocketError(null), 4000);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!closedByCleanup) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };
    };

    connect();
    pingTimer = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);

    return () => {
      closedByCleanup = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pingTimer) clearInterval(pingTimer);
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (connected) {
      send({ type: 'auth_hello', player });
    }
  }, [connected, player, send]);

  return {
    connected,
    clientId,
    onlineCount,
    rooms,
    lobbyChat,
    currentRoom,
    roomChat,
    socketError,
    sendLobbyChat: (text: string, kind: 'chat' | 'emote' = 'chat') =>
      send({ type: 'lobby_chat', text, kind }),
    sendRoomChat: (roomId: string, text: string, kind: 'chat' | 'emote' = 'chat') =>
      send({ type: 'room_chat', roomId, text, kind }),
    createRoom: (
      name: string,
      game: GameType,
      maxPlayers: number,
      isPrivate: boolean
    ) => send({ type: 'create_room', name, game, maxPlayers, isPrivate }),
    joinRoomById: (roomId: string) => send({ type: 'join_room', roomId }),
    joinRoomByCode: (code: string) => send({ type: 'join_room', code }),
    leaveRoom: (roomId: string) => send({ type: 'leave_room', roomId }),
    toggleReady: (roomId: string) => send({ type: 'toggle_ready', roomId }),
    startGame: (
      roomId: string,
      options?: { language?: Language; category?: AhorcadoCategory; pattern?: BingoPattern }
    ) => send({ type: 'start_game', roomId, options }),
    sendGameAction: (roomId: string, action: Record<string, unknown>) =>
      send({ type: 'game_action', roomId, action }),
  };
}
