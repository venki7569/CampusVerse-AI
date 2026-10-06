import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import type { PrismaClient } from '@prisma/client';
import { config } from './config/env';
import { setupSwagger } from './config/swagger';
import { requestLogger } from './middleware/requestLogger.middleware';
import { globalRateLimiter } from './middleware/rateLimiter.middleware';
import { notFoundHandler } from './middleware/notFound.middleware';
import { errorHandler } from './middleware/error.middleware';
import { getHealth, createReadinessHandler, getConfigDiagnosticsHandler } from './modules/health/health.controller';
import { authRouter } from './modules/auth/auth.router';
import { buildingRouter } from './modules/buildings/building.router';
import { departmentRouter } from './modules/departments/department.router';
import { floorRouter } from './modules/floors/floor.router';
import { roomRouter } from './modules/rooms/room.router';
import { assetRouter } from './modules/assets/asset.router';
import { maintenanceRouter } from './modules/maintenance/maintenance.router';
import { electricityRouter } from './modules/electricity/electricity.router';
import { waterRouter } from './modules/water/water.router';
import { dashboardRouter } from './modules/dashboard/dashboard.router';
import { notificationRouter } from './modules/notifications/notification.router';
import { adminRouter } from './modules/admin/admin.router';
import { parkingRouter } from './modules/parking/parking.router';
import { analyticsRouter } from './modules/analytics/analytics.router';
import { aiRouter } from './modules/ai/ai.router';
import { announcementRouter } from './modules/announcements/announcement.router';
import { digitalTwinRouter } from './modules/digital-twin/digital-twin.router';
import { iotRouter } from './modules/iot/iot.router';
import { initAuthorizationService } from './modules/admin/authorization.service';
import { initUserStatusService } from './services/user-status.service';

/**
 * Builds the Express application without starting HTTP/Socket listeners.
 * Used by server bootstrap and HTTP integration tests.
 */
export function createApp(db: PrismaClient): express.Application {
  initAuthorizationService(db);
  initUserStatusService(db);

  const app = express();

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    cors({
      origin: config.cors.origin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Device-Key'],
    }),
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(compression() as express.RequestHandler);
  app.use(requestLogger);
  app.use('/api/', globalRateLimiter);
  setupSwagger(app);

  const v1 = express.Router();
  v1.get('/health', getHealth);
  v1.get('/health/ready', createReadinessHandler(db));
  v1.get('/health/config', getConfigDiagnosticsHandler);
  v1.use('/auth', authRouter(db));
  v1.use('/buildings', buildingRouter(db));
  v1.use('/departments', departmentRouter(db));
  v1.use('/floors', floorRouter(db));
  v1.use('/rooms', roomRouter(db));
  v1.use('/assets', assetRouter(db));
  v1.use('/maintenance', maintenanceRouter(db));
  v1.use('/electricity', electricityRouter(db));
  v1.use('/water', waterRouter(db));
  v1.use('/dashboard', dashboardRouter(db));
  v1.use('/notifications', notificationRouter());
  v1.use('/admin', adminRouter(db));
  v1.use('/parking', parkingRouter(db));
  v1.use('/analytics', analyticsRouter(db));
  v1.use('/ai', aiRouter(db));
  v1.use('/announcements', announcementRouter(db));
  v1.use('/digital-twin', digitalTwinRouter(db));
  v1.use('/iot', iotRouter(db));
  app.use('/api/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
