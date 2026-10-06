import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { config } from '../../config/env';
import { createLogger } from '../../utils/logger';
import {
  authenticateSocket,
  CAMPUS_ROOM,
  roleRoom,
  userRoom,
  type AuthenticatedSocket,
} from './socket.auth';

const log = createLogger('SocketIO');

let io: Server | null = null;

export function initSocketServer(httpServer: HttpServer): Server | null {
  if (!config.socket.enabled) {
    log.info('Socket.IO disabled via configuration');
    return null;
  }

  io = new Server(httpServer, {
    cors: {
      origin: config.cors.origin,
      credentials: true,
    },
    path: config.socket.path,
    transports: ['websocket', 'polling'],
  });

  io.use(authenticateSocket);

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    socket.join(userRoom(user.sub));
    socket.join(CAMPUS_ROOM);
    for (const role of user.roles ?? []) {
      socket.join(roleRoom(role));
    }

    log.info('Socket connected', {
      socketId: socket.id,
      userId: user.sub,
      roles: user.roles,
    });

    socket.on('disconnect', (reason) => {
      log.info('Socket disconnected', { socketId: socket.id, userId: user.sub, reason });
    });
  });

  log.info('Socket.IO server initialized', { path: config.socket.path });
  return io;
}

export function getSocketServer(): Server | null {
  return io;
}

export function isSocketReady(): boolean {
  return io !== null;
}

export interface RealtimeEnvelope {
  channel: string;
  event: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}

export function emitToUser(userId: string, envelope: RealtimeEnvelope): void {
  if (!io) return;
  try {
    io.to(userRoom(userId)).emit('realtime', envelope);
  } catch (err) {
    log.warn('Failed to emit user realtime event', { userId, event: envelope.event, err });
  }
}

export function emitToCampus(envelope: RealtimeEnvelope): void {
  if (!io) return;
  try {
    io.to(CAMPUS_ROOM).emit('realtime', envelope);
  } catch (err) {
    log.warn('Failed to emit campus realtime event', { event: envelope.event, err });
  }
}

export function emitToRole(role: string, envelope: RealtimeEnvelope): void {
  if (!io) return;
  try {
    io.to(roleRoom(role)).emit('realtime', envelope);
  } catch (err) {
    log.warn('Failed to emit role realtime event', { role, event: envelope.event, err });
  }
}

export async function shutdownSocketServer(): Promise<void> {
  if (!io) return;
  await new Promise<void>((resolve) => {
    io!.close(() => {
      io = null;
      log.info('Socket.IO server closed');
      resolve();
    });
  });
}
