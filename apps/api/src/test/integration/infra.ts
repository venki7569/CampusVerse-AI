import mongoose from 'mongoose';
import Redis from 'ioredis';
import { config } from '../../config/env';
import { createPrismaClient, disconnectPrismaClient } from '../../database/prisma.client';

export interface InfraStatus {
  postgres: 'ok' | 'unavailable';
  mongodb: 'ok' | 'unavailable';
  redis: 'ok' | 'unavailable' | 'degraded';
  postgresError?: string;
  mongodbError?: string;
  redisError?: string;
}

export async function probeInfrastructure(): Promise<InfraStatus> {
  const status: InfraStatus = {
    postgres: 'unavailable',
    mongodb: 'unavailable',
    redis: 'unavailable',
  };

  const prisma = createPrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    status.postgres = 'ok';
  } catch (err) {
    status.postgresError = err instanceof Error ? err.message : String(err);
  } finally {
    await disconnectPrismaClient(prisma);
  }

  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(config.db.mongoUri, { serverSelectionTimeoutMS: 3000 });
    }
    await mongoose.connection.db?.admin().ping();
    status.mongodb = 'ok';
  } catch (err) {
    status.mongodbError = err instanceof Error ? err.message : String(err);
  }

  if (config.redis.enabled) {
    const redis = new Redis(config.db.redisUri, {
      connectTimeout: config.redis.connectTimeoutMs,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    redis.on('error', () => undefined);
    try {
      await redis.connect();
      const pong = await redis.ping();
      status.redis = pong === 'PONG' ? 'ok' : 'degraded';
      await redis.quit();
    } catch (err) {
      status.redis = 'degraded';
      status.redisError = err instanceof Error ? err.message : String(err);
      try {
        redis.disconnect();
      } catch {
        /* ignore */
      }
    }
  }

  return status;
}

export function integrationReady(status: InfraStatus): boolean {
  return status.postgres === 'ok' && status.mongodb === 'ok';
}

export async function teardownMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
