import { createLogger } from '../utils/logger';
import { getRedisClient, isRedisAvailable } from './redis.service';

const log = createLogger('Cache');

export interface CacheOptions {
  ttlSeconds?: number;
  prefix?: string;
}

const DEFAULT_TTL = 60;

function buildKey(prefix: string, key: string): string {
  return `${prefix}:${key}`;
}

/**
 * Lightweight Redis-backed cache with graceful no-op fallback.
 */
export class CacheService {
  constructor(private readonly defaultPrefix = 'cv') {}

  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const client = getRedisClient();
    if (!isRedisAvailable() || !client) return null;

    const cacheKey = buildKey(options.prefix ?? this.defaultPrefix, key);
    try {
      const raw = await client.get(cacheKey);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      log.warn('Cache get failed', { key: cacheKey, err });
      return null;
    }
  }

  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const client = getRedisClient();
    if (!isRedisAvailable() || !client) return;

    const cacheKey = buildKey(options.prefix ?? this.defaultPrefix, key);
    const ttl = options.ttlSeconds ?? DEFAULT_TTL;
    try {
      await client.setex(cacheKey, ttl, JSON.stringify(value));
    } catch (err) {
      log.warn('Cache set failed', { key: cacheKey, err });
    }
  }

  async del(key: string, options: CacheOptions = {}): Promise<void> {
    const client = getRedisClient();
    if (!isRedisAvailable() || !client) return;

    const cacheKey = buildKey(options.prefix ?? this.defaultPrefix, key);
    try {
      await client.del(cacheKey);
    } catch (err) {
      log.warn('Cache del failed', { key: cacheKey, err });
    }
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {},
  ): Promise<T> {
    const cached = await this.get<T>(key, options);
    if (cached !== null) return cached;

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }
}

export const cacheService = new CacheService();
