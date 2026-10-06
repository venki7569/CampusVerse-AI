import 'dotenv/config';
import http from 'http';
import { config } from './config/env';
import { validateEnvironment } from './config/env.validation';
import { logger } from './utils/logger';
import { createApp } from './app';
import { createPrismaClient, disconnectPrismaClient } from './database/prisma.client';
import { initializeMongoConnection } from './modules/database/mongodb/connection';
import { OccupancySimulationService } from './modules/rooms/occupancy.service';
import { connectRedis, disconnectRedis } from './services/redis.service';
import { initSocketServer, shutdownSocketServer } from './modules/realtime/socket.server';
import { registerEventBridge } from './modules/realtime/event-bridge';
import { getConfigDiagnostics } from './config/config-diagnostics';

const db = createPrismaClient();

const app = createApp(db);
const httpServer = http.createServer(app);

let occupancySimulation: OccupancySimulationService | null = null;
let shuttingDown = false;

async function start(): Promise<void> {
  validateEnvironment();

  try {
    await db.$connect();
    logger.info('PostgreSQL connected');
  } catch (err) {
    logger.warn('PostgreSQL not available (expected in dev without Docker)', { err });
  }

  await initializeMongoConnection();
  await connectRedis();
  initSocketServer(httpServer);
  registerEventBridge();

  if (config.occupancySimulation.enabled && !config.isProduction) {
    occupancySimulation = new OccupancySimulationService(db);
    occupancySimulation.start(config.occupancySimulation.intervalMs);
    logger.warn('Occupancy simulation ENABLED (development/demo only)', {
      intervalMs: config.occupancySimulation.intervalMs,
    });
  }

  httpServer.listen(config.port, () => {
    const diagnostics = getConfigDiagnostics();
    logger.info(`CampusVerse API running on http://localhost:${config.port}`);
    logger.info(`Swagger docs: http://localhost:${config.port}/api/v1/docs`);
    logger.info('Startup configuration', {
      env: diagnostics.environment,
      isProduction: diagnostics.isProduction,
      postgresConfigured: diagnostics.integrations.postgres.configured,
      mongodbConfigured: diagnostics.integrations.mongodb.configured,
      redisEnabled: diagnostics.integrations.redis.enabled,
      socketEnabled: diagnostics.integrations.socket.enabled,
      geminiConfigured: diagnostics.integrations.gemini.configured,
      jwtFromEnv: diagnostics.security.jwtSecretsFromEnv,
    });
  });
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Shutdown initiated (${signal})`);

  occupancySimulation?.stop();

  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });

  await shutdownSocketServer();
  await disconnectRedis();

  try {
    await disconnectPrismaClient(db);
    logger.info('PostgreSQL disconnected');
  } catch (err) {
    logger.warn('Error disconnecting PostgreSQL', { err });
  }

  process.exit(0);
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

if (require.main === module) {
  void start();
}

export { app, db, httpServer, createApp };
