import rateLimit, { type Options, type Store } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { config } from '../config/env';
import { getRedisClient, isRedisAvailable } from '../services/redis.service';

const RATE_LIMIT_MESSAGE = {
  success: false,
  error: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please try again later.',
    details: [],
  },
};

function createStore(prefix: string): Store | undefined {
  const client = getRedisClient();
  if (!isRedisAvailable() || !client) {
    return undefined;
  }

  return new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: (command: string, ...args: string[]) =>
      client.call(command, ...args) as Promise<number>,
  });
}

function buildLimiter(name: string, options: Partial<Options>): ReturnType<typeof rateLimit> {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
    store: createStore(name),
    // Local dev + integration tests exceed production limits quickly.
    skip: () => !config.isProduction,
    ...options,
  });
}

/**
 * Global rate limiter — applied to all /api routes.
 */
export const globalRateLimiter = buildLimiter('global', {
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
});

/**
 * Stricter limiter for auth routes (login, register, password reset).
 */
export const authRateLimiter = buildLimiter('auth', {
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please wait 15 minutes.',
      details: [],
    },
  },
});

/**
 * Stricter limiter for AI chat endpoint.
 */
export const aiRateLimiter = buildLimiter('ai', {
  windowMs: config.ai.chatRateLimitWindowMs,
  max: config.ai.chatRateLimitMax,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many AI requests. Please try again later.',
      details: [],
    },
  },
});

/**
 * Admin management APIs — higher ceiling but still bounded.
 */
export const adminRateLimiter = buildLimiter('admin', {
  windowMs: config.rateLimitAdmin.windowMs,
  max: config.rateLimitAdmin.max,
});

/**
 * Notification endpoints — prevent abuse of list/mark-read operations.
 */
export const notificationRateLimiter = buildLimiter('notifications', {
  windowMs: config.rateLimitNotification.windowMs,
  max: config.rateLimitNotification.max,
});

/**
 * IoT telemetry ingestion — bounded to prevent abuse.
 */
export const iotIngestRateLimiter = buildLimiter('iot-ingest', {
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env['IOT_INGEST_RATE_LIMIT_MAX'] ?? '300', 10),
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many telemetry submissions. Please try again later.',
      details: [],
    },
  },
});
