import mongoose from 'mongoose';
import type { PrismaClient } from '@prisma/client';
import { config } from '../../config/env';
import { isRedisAvailable, pingRedis } from '../../services/redis.service';
import { isSocketReady } from '../realtime/socket.server';

export type HealthStatus = 'ok' | 'degraded' | 'unavailable';

export interface DependencyHealth {
  status: HealthStatus;
  latencyMs?: number;
}

export interface ReadinessReport {
  status: 'ready' | 'degraded' | 'not_ready';
  timestamp: string;
  uptime: number;
  env: string;
  version: string;
  dependencies: {
    postgres: DependencyHealth;
    mongodb: DependencyHealth;
    redis: DependencyHealth;
    socket: DependencyHealth;
    gemini: DependencyHealth;
  };
}

async function checkPostgres(db: PrismaClient): Promise<DependencyHealth> {
  const start = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch {
    return { status: 'unavailable', latencyMs: Date.now() - start };
  }
}

async function checkMongo(): Promise<DependencyHealth> {
  const start = Date.now();
  if (mongoose.connection.readyState !== 1) {
    return { status: 'unavailable', latencyMs: Date.now() - start };
  }
  try {
    if (!mongoose.connection.db) {
      return { status: 'unavailable', latencyMs: Date.now() - start };
    }
    await mongoose.connection.db.admin().ping();
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch {
    return { status: 'unavailable', latencyMs: Date.now() - start };
  }
}

async function checkRedis(): Promise<DependencyHealth> {
  const start = Date.now();
  if (!config.redis.enabled) {
    return { status: 'unavailable', latencyMs: Date.now() - start };
  }
  if (!isRedisAvailable()) {
    return { status: 'degraded', latencyMs: Date.now() - start };
  }
  const ok = await pingRedis();
  return {
    status: ok ? 'ok' : 'degraded',
    latencyMs: Date.now() - start,
  };
}

function checkSocket(): DependencyHealth {
  if (!config.socket.enabled) {
    return { status: 'unavailable' };
  }
  return { status: isSocketReady() ? 'ok' : 'degraded' };
}

function checkGemini(): DependencyHealth {
  if (!config.gemini.apiKey) {
    return { status: 'degraded' };
  }
  return { status: 'ok' };
}

export async function getReadinessReport(db: PrismaClient): Promise<ReadinessReport> {
  const [postgres, mongodb, redis] = await Promise.all([
    checkPostgres(db),
    checkMongo(),
    checkRedis(),
  ]);

  const socket = checkSocket();
  const gemini = checkGemini();

  const criticalOk = postgres.status === 'ok';
  const status: ReadinessReport['status'] = criticalOk
    ? mongodb.status === 'unavailable' || redis.status === 'degraded' || gemini.status === 'degraded'
      ? 'degraded'
      : 'ready'
    : 'not_ready';

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: config.env,
    version: process.env['npm_package_version'] ?? '1.0.0',
    dependencies: {
      postgres,
      mongodb,
      redis,
      socket,
      gemini,
    },
  };
}

export function getLivenessReport() {
  return {
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: config.env,
    version: process.env['npm_package_version'] ?? '1.0.0',
  };
}
