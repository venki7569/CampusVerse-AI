import jwt from 'jsonwebtoken';
import type { Socket } from 'socket.io';
import { config } from '../../config/env';
import { createLogger } from '../../utils/logger';
import type { JwtPayload } from '../../types';
import { isUserActive } from '../../services/user-status.service';

const log = createLogger('SocketAuth');

export interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
}

function extractToken(socket: Socket): string | undefined {
  const authToken = socket.handshake.auth?.['token'];
  if (typeof authToken === 'string' && authToken.length > 0) {
    return authToken;
  }

  const header = socket.handshake.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.substring(7);
  }

  return undefined;
}

export function authenticateSocket(socket: AuthenticatedSocket, next: (err?: Error) => void): void {
  const token = extractToken(socket);
  if (!token) {
    log.warn('Socket connection rejected — missing token', { socketId: socket.id });
    next(new Error('Authentication required'));
    return;
  }

  void (async () => {
    try {
      const decoded = jwt.verify(token, config.jwt.accessSecret) as JwtPayload;
      const active = await isUserActive(decoded.sub);
      if (active === false) {
        log.warn('Socket connection rejected — deactivated user', { socketId: socket.id, userId: decoded.sub });
        next(new Error('Account has been deactivated'));
        return;
      }
      if (active === null) {
        next(new Error('Unable to verify account status'));
        return;
      }
      socket.user = decoded;
      next();
    } catch (err) {
      log.warn('Socket connection rejected — invalid token', {
        socketId: socket.id,
        err: err instanceof Error ? err.message : String(err),
      });
      next(new Error('Invalid access token'));
    }
  })();
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export const CAMPUS_ROOM = 'campus:updates';

export const ROLE_ROOM_PREFIX = 'role:';

export function roleRoom(role: string): string {
  return `${ROLE_ROOM_PREFIX}${role}`;
}
