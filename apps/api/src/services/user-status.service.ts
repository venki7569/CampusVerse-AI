import type { PrismaClient } from '@prisma/client';
import { cacheService } from './cache.service';
import { createLogger } from '../utils/logger';

const log = createLogger('UserStatus');
const CACHE_TTL_SECONDS = 60;

let db: PrismaClient | null = null;

export function initUserStatusService(prisma: PrismaClient): void {
  db = prisma;
}

/**
 * Returns whether a user account is active. Cached briefly to limit DB load on every request.
 * On cache/DB failure, returns false (fail closed for deactivated check).
 */
export async function isUserActive(userId: string): Promise<boolean | null> {
  if (!db) {
    log.warn('UserStatusService not initialized');
    return null;
  }

  const cacheKey = `user:active:${userId}`;
  const cached = await cacheService.get<boolean>(cacheKey, { prefix: 'cv' });
  if (cached !== null) {
    return cached;
  }

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { isActive: true },
    });
    const active = user?.isActive ?? false;
    await cacheService.set(cacheKey, active, { prefix: 'cv', ttlSeconds: CACHE_TTL_SECONDS });
    return active;
  } catch (err) {
    log.warn('Failed to check user active status', { userId, err });
    return null;
  }
}

/** Call after deactivating a user so cached status is cleared immediately. */
export async function invalidateUserStatus(userId: string): Promise<void> {
  await cacheService.del(`user:active:${userId}`, { prefix: 'cv' });
}
