import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  AhorcadoCategory,
  BingoPattern,
  ChatMessage,
  ClientWsMessage,
  Language,
  PlayerInfo,
  RoomState,
  RoomSummary,
  ServerWsMessage,
} from './src/shared/types.ts';
import {
  applyDominoPlay,
  createDominoGame,
  drawDominoFromBoneyard,
  passDominoTurn,
  sanitizeDominoForPlayer,
} from './src/shared/dominoEngine.ts';
import {
  applyParquesMove,
  createParquesGame,
  rollParquesDice,
} from './src/shared/parquesEngine.ts';
import {
  createAhorcadoGame,
  guessAhorcadoLetter,
  sanitizeAhorcadoForPlayer,
} from './src/shared/ahorcadoEngine.ts';
import {
  claimBingoWin,
  createBingoGame,
  daubBingoCell,
  drawNextBingoBall,
  sanitizeBingoForClient,
} from './src/shared/bingoEngine.ts';

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  player: PlayerInfo;
  roomId: string | null;
}

const clients = new Map<string, ConnectedClient>();
const rooms = new Map<string, RoomState>();
const roomChats = new Map<string, ChatMessage[]>();
const bingoTimers = new Map<string, ReturnType<typeof setInterval>>();
const lobbyChat: ChatMessage[] = [];

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(4).toString('hex')}`;
}

function makeRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 5; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function sendTo(ws: WebSocket, payload: ServerWsMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastAll(payload: ServerWsMessage): void {
  const raw = JSON.stringify(payload);
  for (const c of clients.values()) {
    if (c.ws.readyState === WebSocket.OPEN) {
      c.ws.send(raw);
    }
  }
}

function getRoomSummaries(): RoomSummary[] {
  const list: RoomSummary[] = [];
  for (const r of rooms.values()) {
    if (!r.isPrivate || r.status === 'waiting') {
      list.push({
        id: r.id,
        code: r.code,
        name: r.name,
        game: r.game,
        hostId: r.hostId,
        hostName: r.hostName,
        maxPlayers: r.maxPlayers,
        players: r.players,
        status: r.status,
        isPrivate: r.isPrivate,
        createdAt: r.createdAt,
      });
    }
  }
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

function sanitizeRoomForViewer(room: RoomState, viewerId: string): RoomState {
  const copy: RoomState = {
    id: room.id,
    code: room.code,
    name: room.name,
    game: room.game,
    hostId: room.hostId,
    hostName: room.hostName,
    maxPlayers: room.maxPlayers,
    players: room.players,
    status: room.status,
    isPrivate: room.isPrivate,
    createdAt: room.createdAt,
  };
  if (room.domino) {
    copy.domino = sanitizeDominoForPlayer(room.domino, viewerId);
  }
  if (room.parques) {
    copy.parques = room.parques;
  }
  if (room.ahorcado) {
    copy.ahorcado = sanitizeAhorcadoForPlayer(room.ahorcado, viewerId);
  }
  if (room.bingo) {
    copy.bingo = sanitizeBingoForClient(room.bingo);
  }
  return copy;
}

function broadcastRoomState(room: RoomState, includeChat = false): void {
  const chat = includeChat ? roomChats.get(room.id) || [] : undefined;
  for (const c of clients.values()) {
    if (c.roomId === room.id) {
      sendTo(c.ws, {
        type: 'room_state',
        room: sanitizeRoomForViewer(room, c.player.id),
        roomChat: chat,
      });
    }
  }
}

function stopBingoTimer(roomId: string): void {
  const timer = bingoTimers.get(roomId);
  if (timer) {
    clearInterval(timer);
    bingoTimers.delete(roomId);
  }
}

function startBingoTimer(roomId: string): void {
  stopBingoTimer(roomId);
  const timer = setInterval(() => {
    const room = rooms.get(roomId);
    if (!room || !room.bingo || room.status !== 'playing') {
      stopBingoTimer(roomId);
      return;
    }
    if (room.bingo.remainingPool.length === 0 || room.bingo.status === 'finished') {
      room.status = 'finished';
      stopBingoTimer(roomId);
      broadcastRoomState(room);
      broadcastAll({ type: 'rooms_list', rooms: getRoomSummaries() });
      return;
    }
    room.bingo = drawNextBingoBall(room.bingo);
    if (room.bingo.status === 'finished') {
      room.status = 'finished';
      stopBingoTimer(roomId);
      broadcastAll({ type: 'rooms_list', rooms: getRoomSummaries() });
    }
    broadcastRoomState(room);
  }, 3200);
  bingoTimers.set(roomId, timer);
}

function leaveCurrentRoom(client: ConnectedClient): void {
  if (!client.roomId) return;
  const roomId = client.roomId;
  const room = rooms.get(roomId);
  client.roomId = null;
  sendTo(client.ws, { type: 'room_left', roomId });

  if (!room) return;
  room.players = room.players.filter((p) => p.id !== client.player.id);

  if (room.players.length === 0) {
    stopBingoTimer(roomId);
    rooms.delete(roomId);
    roomChats.delete(roomId);
  } else {
    if (room.hostId === client.player.id) {
      room.hostId = room.players[0].id;
      room.hostName = room.players[0].name;
    }
    const sysMsg: ChatMessage = {
      id: makeId('msg'),
      senderId: 'system',
      senderName: 'Salon',
      senderAvatar: '',
      text: `${client.player.name} left the table.`,
      roomId,
      timestamp: Date.now(),
      kind: 'system',
    };
    const chats = roomChats.get(roomId) || [];
    chats.push(sysMsg);
    if (chats.length > 50) chats.shift();
    roomChats.set(roomId, chats);
    broadcastRoomState(room);
    for (const c of clients.values()) {
      if (c.roomId === roomId) {
        sendTo(c.ws, { type: 'room_chat_msg', roomId, message: sysMsg });
      }
    }
  }
  broadcastAll({ type: 'rooms_list', rooms: getRoomSummaries() });
}

function startRoomGame(
  room: RoomState,
  options?: { language?: Language; category?: AhorcadoCategory; pattern?: BingoPattern }
): void {
  const playerIds = room.players.map((p) => p.id);
  const playerNames: Record<string, string> = {};
  for (const p of room.players) {
    playerNames[p.id] = p.name;
  }

  room.status = 'playing';
  room.domino = undefined;
  room.parques = undefined;
  room.ahorcado = undefined;
  room.bingo = undefined;
  stopBingoTimer(room.id);

  if (room.game === 'domino') {
    room.domino = createDominoGame(playerIds, playerNames);
  } else if (room.game === 'parques') {
    room.parques = createParquesGame(playerIds, playerNames);
  } else if (room.game === 'ahorcado') {
    room.ahorcado = createAhorcadoGame(
      playerIds,
      options?.language || 'en',
      options?.category || 'animals'
    );
  } else if (room.game === 'bingo') {
    room.bingo = createBingoGame(playerIds, options?.pattern || 'line');
    // Draw first ball after brief moment
    room.bingo = drawNextBingoBall(room.bingo);
    startBingoTimer(room.id);
  }

  broadcastRoomState(room);
  broadcastAll({ type: 'rooms_list', rooms: getRoomSummaries() });
}

function handleGameAction(
  room: RoomState,
  client: ConnectedClient,
  action: Record<string, unknown>
): void {
  const pid = client.player.id;
  const pname = client.player.name;
  const playerNames: Record<string, string> = {};
  for (const p of room.players) playerNames[p.id] = p.name;

  if (room.game === 'domino' && room.domino) {
    if (action.kind === 'play' && typeof action.tileId === 'string') {
      const side = action.side === 'left' ? 'left' : 'right';
      room.domino = applyDominoPlay(room.domino, pid, action.tileId, side, pname);
    } else if (action.kind === 'draw') {
      room.domino = drawDominoFromBoneyard(room.domino, pid, pname);
    } else if (action.kind === 'pass') {
      room.domino = passDominoTurn(room.domino, pid, pname);
    }
    if (room.domino.winnerId) {
      room.status = 'finished';
      broadcastAll({ type: 'rooms_list', rooms: getRoomSummaries() });
    }
    broadcastRoomState(room);
    return;
  }

  if (room.game === 'parques' && room.parques) {
    if (action.kind === 'roll') {
      room.parques = rollParquesDice(room.parques, pid, pname);
    } else if (action.kind === 'move' && action.move && typeof action.move === 'object') {
      room.parques = applyParquesMove(room.parques, pid, action.move as never, playerNames);
    }
    if (room.parques.winnerId) {
      room.status = 'finished';
      broadcastAll({ type: 'rooms_list', rooms: getRoomSummaries() });
    }
    broadcastRoomState(room);
    return;
  }

  if (room.game === 'ahorcado' && room.ahorcado) {
    if (action.kind === 'guess' && typeof action.letter === 'string') {
      room.ahorcado = guessAhorcadoLetter(room.ahorcado, pid, action.letter, pname);
      if (room.ahorcado.status === 'finished') {
        room.status = 'finished';
        broadcastAll({ type: 'rooms_list', rooms: getRoomSummaries() });
      }
      broadcastRoomState(room);
    }
    return;
  }

  if (room.game === 'bingo' && room.bingo) {
    if (action.kind === 'daub' && typeof action.row === 'number' && typeof action.col === 'number') {
      room.bingo = daubBingoCell(room.bingo, pid, action.row, action.col);
      broadcastRoomState(room);
    } else if (action.kind === 'claim_bingo') {
      room.bingo = claimBingoWin(room.bingo, pid, pname);
      if (room.bingo.status === 'finished') {
        room.status = 'finished';
        stopBingoTimer(room.id);
        broadcastAll({ type: 'rooms_list', rooms: getRoomSummaries() });
      }
      broadcastRoomState(room);
    }
  }
}

async function bootstrap() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, online: clients.size, rooms: rooms.size });
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const clientId = makeId('cli');
    const client: ConnectedClient = {
      id: clientId,
      ws,
      player: {
        id: clientId,
        name: `Guest_${clientId.slice(-4)}`,
        avatarUrl: '',
        elo: 1000,
        ready: true,
        connected: true,
      },
      roomId: null,
    };
    clients.set(clientId, client);

    sendTo(ws, {
      type: 'welcome',
      clientId,
      onlineCount: clients.size,
      rooms: getRoomSummaries(),
      lobbyChat: lobbyChat.slice(-50),
    });
    broadcastAll({ type: 'online_count', onlineCount: clients.size });

    ws.on('message', (raw) => {
      let msg: ClientWsMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientWsMessage;
      } catch {
        return;
      }

      if (msg.type === 'ping') {
        sendTo(ws, { type: 'pong' });
        return;
      }

      if (msg.type === 'auth_hello') {
        const cleanName = String(msg.player.name || 'Player').trim().slice(0, 32) || 'Player';
        client.player = {
          id: String(msg.player.id || clientId).slice(0, 128),
          name: cleanName,
          avatarUrl: String(msg.player.avatarUrl || '').slice(0, 500),
          elo: typeof msg.player.elo === 'number' ? msg.player.elo : 1000,
          ready: true,
          connected: true,
        };
        if (client.roomId) {
          const room = rooms.get(client.roomId);
          if (room) {
            room.players = room.players.map((p) =>
              p.id === client.player.id ? { ...p, ...client.player } : p
            );
            broadcastRoomState(room);
          }
        }
        return;
      }

      if (msg.type === 'lobby_chat') {
        const text = String(msg.text || '').trim().slice(0, 280);
        if (!text) return;
        const chatMsg: ChatMessage = {
          id: makeId('msg'),
          senderId: client.player.id,
          senderName: client.player.name,
          senderAvatar: client.player.avatarUrl,
          text,
          roomId: 'lobby',
          timestamp: Date.now(),
          kind: msg.kind === 'emote' ? 'emote' : 'chat',
        };
        lobbyChat.push(chatMsg);
        if (lobbyChat.length > 60) lobbyChat.shift();
        broadcastAll({ type: 'lobby_chat_msg', message: chatMsg });
        return;
      }

      if (msg.type === 'room_chat') {
        const room = rooms.get(msg.roomId);
        if (!room || client.roomId !== room.id) return;
        const text = String(msg.text || '').trim().slice(0, 280);
        if (!text) return;
        const chatMsg: ChatMessage = {
          id: makeId('msg'),
          senderId: client.player.id,
          senderName: client.player.name,
          senderAvatar: client.player.avatarUrl,
          text,
          roomId: room.id,
          timestamp: Date.now(),
          kind: msg.kind === 'emote' ? 'emote' : 'chat',
        };
        const list = roomChats.get(room.id) || [];
        list.push(chatMsg);
        if (list.length > 50) list.shift();
        roomChats.set(room.id, list);
        for (const c of clients.values()) {
          if (c.roomId === room.id) {
            sendTo(c.ws, { type: 'room_chat_msg', roomId: room.id, message: chatMsg });
          }
        }
        return;
      }

      if (msg.type === 'create_room') {
        leaveCurrentRoom(client);
        const roomId = makeId('room');
        const code = makeRoomCode();
        const maxPlayers = Math.min(Math.max(Number(msg.maxPlayers) || 4, 2), 4);
        const room: RoomState = {
          id: roomId,
          code,
          name: String(msg.name || `${client.player.name}'s Table`).trim().slice(0, 40),
          game: msg.game,
          hostId: client.player.id,
          hostName: client.player.name,
          maxPlayers,
          players: [{ ...client.player, ready: true }],
          status: 'waiting',
          isPrivate: Boolean(msg.isPrivate),
          createdAt: Date.now(),
        };
        rooms.set(roomId, room);
        roomChats.set(roomId, [
          {
            id: makeId('msg'),
            senderId: 'system',
            senderName: 'Salon',
            senderAvatar: '',
            text: `Table created. Share code ${code} to invite friends.`,
            roomId,
            timestamp: Date.now(),
            kind: 'system',
          },
        ]);
        client.roomId = roomId;
        broadcastRoomState(room, true);
        broadcastAll({ type: 'rooms_list', rooms: getRoomSummaries() });
        return;
      }

      if (msg.type === 'join_room') {
        let target: RoomState | undefined;
        if (msg.roomId) {
          target = rooms.get(msg.roomId);
        } else if (msg.code) {
          const upper = msg.code.trim().toUpperCase();
          for (const r of rooms.values()) {
            if (r.code === upper) {
              target = r;
              break;
            }
          }
        }
        if (!target) {
          sendTo(ws, { type: 'error', message: 'Table not found or already closed.' });
          return;
        }
        if (target.status === 'playing' && !target.players.some((p) => p.id === client.player.id)) {
          sendTo(ws, { type: 'error', message: 'Match already in progress at this table.' });
          return;
        }
        if (
          target.players.length >= target.maxPlayers &&
          !target.players.some((p) => p.id === client.player.id)
        ) {
          sendTo(ws, { type: 'error', message: 'Table is already full.' });
          return;
        }

        if (client.roomId && client.roomId !== target.id) {
          leaveCurrentRoom(client);
        }

        client.roomId = target.id;
        const alreadyIn = target.players.some((p) => p.id === client.player.id);
        if (!alreadyIn) {
          target.players.push({ ...client.player, ready: false });
          const sysMsg: ChatMessage = {
            id: makeId('msg'),
            senderId: 'system',
            senderName: 'Salon',
            senderAvatar: '',
            text: `${client.player.name} joined the table.`,
            roomId: target.id,
            timestamp: Date.now(),
            kind: 'system',
          };
          const chats = roomChats.get(target.id) || [];
          chats.push(sysMsg);
          if (chats.length > 50) chats.shift();
          roomChats.set(target.id, chats);
          for (const c of clients.values()) {
            if (c.roomId === target.id && c.id !== client.id) {
              sendTo(c.ws, { type: 'room_chat_msg', roomId: target.id, message: sysMsg });
            }
          }
        }
        broadcastRoomState(target, true);
        broadcastAll({ type: 'rooms_list', rooms: getRoomSummaries() });
        return;
      }

      if (msg.type === 'leave_room') {
        leaveCurrentRoom(client);
        return;
      }

      if (msg.type === 'toggle_ready') {
        const room = rooms.get(msg.roomId);
        if (!room || client.roomId !== room.id || room.status !== 'waiting') return;
        room.players = room.players.map((p) =>
          p.id === client.player.id ? { ...p, ready: !p.ready } : p
        );
        broadcastRoomState(room);
        return;
      }

      if (msg.type === 'start_game') {
        const room = rooms.get(msg.roomId);
        if (!room || room.hostId !== client.player.id) return;
        if (room.players.length < 2) {
          sendTo(ws, { type: 'error', message: 'Need at least 2 players to start an online match.' });
          return;
        }
        startRoomGame(room, msg.options);
        return;
      }

      if (msg.type === 'game_action') {
        const room = rooms.get(msg.roomId);
        if (!room || client.roomId !== room.id || room.status !== 'playing') return;
        handleGameAction(room, client, msg.action);
      }
    });

    ws.on('close', () => {
      leaveCurrentRoom(client);
      clients.delete(clientId);
      broadcastAll({ type: 'online_count', onlineCount: clients.size });
    });
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build not found');
      }
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Mesa Real multiplayer server listening on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Server failed to start:', err);
  process.exit(1);
});
