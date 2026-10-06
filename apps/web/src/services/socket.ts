import { io, type Socket } from 'socket.io-client';
import { notifyDashboardEvent, type DashboardClientEvent } from './dashboardEvents';
import { notifyNotificationEvent, type NotificationClientEvent } from './notificationEvents';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api/v1';
const SOCKET_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, '');
const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH ?? '/socket.io';

let socket: Socket | null = null;
let currentToken: string | null = null;

export type RealtimeChannel =
  | 'dashboard'
  | 'notification'
  | 'parking'
  | 'analytics'
  | 'maintenance'
  | 'ai'
  | 'announcement'
  | 'digital-twin'
  | 'iot';

export interface RealtimeEnvelope {
  channel: RealtimeChannel;
  event: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}

type RealtimeHandler = (envelope: RealtimeEnvelope) => void;

const channelHandlers = new Set<RealtimeHandler>();

export function subscribeToRealtime(handler: RealtimeHandler): () => void {
  channelHandlers.add(handler);
  return () => channelHandlers.delete(handler);
}

function dispatchEnvelope(envelope: RealtimeEnvelope): void {
  for (const handler of channelHandlers) {
    handler(envelope);
  }

  if (envelope.channel === 'dashboard') {
    notifyDashboardEvent(envelope.event as DashboardClientEvent);
  }
  if (envelope.channel === 'notification') {
    notifyNotificationEvent(envelope.event as NotificationClientEvent);
  }
}

export function connectSocket(accessToken: string): void {
  if (!accessToken) return;

  if (socket?.connected && currentToken === accessToken) {
    return;
  }

  disconnectSocket();
  currentToken = accessToken;

  socket = io(SOCKET_ORIGIN, {
    path: SOCKET_PATH,
    auth: { token: accessToken },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    autoConnect: true,
  });

  socket.on('connect', () => {
    console.info('[realtime] connected');
  });

  socket.on('disconnect', (reason) => {
    console.info('[realtime] disconnected', reason);
  });

  socket.on('connect_error', (err) => {
    console.warn('[realtime] connection error — REST APIs remain available', err.message);
  });

  socket.on('realtime', (envelope: RealtimeEnvelope) => {
    dispatchEnvelope(envelope);
  });
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  currentToken = null;
}

export function isSocketConnected(): boolean {
  return Boolean(socket?.connected);
}
