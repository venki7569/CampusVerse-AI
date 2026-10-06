import Redis from 'ioredis';
import { config } from '../config/env';
import { createLogger } from '../utils/logger';

const log = createLogger('Redis');

let client: Redis | null = null;
let available = false;

export async function connectRedis(): Promise<boolean> {
  if (!config.redis.enabled) {
    log.info('Redis disabled via configuration');
    return false;
  }

  if (client && available) {
    return true;
  }

  try {
    const redis = new Redis(config.db.redisUri, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
      connectTimeout: config.redis.connectTimeoutMs,
      retryStrategy: (times) => (times > 2 ? null : Math.min(times * 200, 1000)),
    });

    redis.on('error', (err) => {
      log.warn('Redis client error', { message: err.message });
    });

    await redis.connect();
    await redis.ping();

    client = redis;
    available = true;
    log.info('Redis connected');
    return true;
  } catch (err) {
    log.warn('Redis unavailable — API continues without cache/distributed rate limiting', { err });
    client = null;
    available = false;
    return false;
  }
}

export function isRedisAvailable(): boolean {
  return available && client !== null;
}

export function getRedisClient(): Redis | null {
  return available ? client : null;
}

export async function pingRedis(): Promise<boolean> {
  if (!client || !available) return false;
  try {
    const result = await client.ping();
    return result === 'PONG';
  } catch {
    available = false;
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    client.disconnect();
  } finally {
    client = null;
    available = false;
    log.info('Redis disconnected');
  }
}
