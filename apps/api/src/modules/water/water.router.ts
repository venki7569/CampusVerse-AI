import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { WaterRepository } from './water.repository';
import { WaterAuditService } from './water.audit.service';
import { WaterService } from './water.service';
import { WaterController } from './water.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import {
  createWaterMeterSchema,
  updateWaterMeterSchema,
  listWaterMetersSchema,
  createWaterReadingSchema,
  listWaterReadingsSchema,
  waterAnalyticsQuerySchema,
} from './water.dto';

export function waterRouter(db: PrismaClient): Router {
  const repo = new WaterRepository(db);
  const audit = new WaterAuditService();
  const service = new WaterService(repo, audit, db);
  const controller = new WaterController(service);

  const router = Router();

  /**
   * @openapi
   * /api/v1/water/analytics:
   *   get:
   *     summary: Get water consumption analytics grouped by day, week, month, meter, or building
   *     tags: [Water]
   */
  router.get(
    '/analytics',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'),
    validate(waterAnalyticsQuerySchema),
    controller.getConsumptionAnalytics,
  );

  /**
   * @openapi
   * /api/v1/water/meters:
   *   get:
   *     summary: List water meters with search and filters
   *     tags: [Water]
   */
  router.get(
    '/meters',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'),
    validate(listWaterMetersSchema),
    controller.listMeters,
  );

  /**
   * @openapi
   * /api/v1/water/meters/{id}:
   *   get:
   *     summary: Get water meter details by ID
   *     tags: [Water]
   */
  router.get(
    '/meters/:id',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'),
    controller.getMeterById,
  );

  /**
   * @openapi
   * /api/v1/water/meters:
   *   post:
   *     summary: Register a new water meter
   *     tags: [Water]
   */
  router.post(
    '/meters',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN'),
    validate(createWaterMeterSchema),
    controller.createMeter,
  );

  /**
   * @openapi
   * /api/v1/water/meters/{id}:
   *   patch:
   *     summary: Update a water meter
   *     tags: [Water]
   */
  router.patch(
    '/meters/:id',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN'),
    validate(updateWaterMeterSchema),
    controller.updateMeter,
  );

  /**
   * @openapi
   * /api/v1/water/meters/{id}:
   *   delete:
   *     summary: Deactivate/archive a water meter
   *     tags: [Water]
   */
  router.delete(
    '/meters/:id',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN'),
    controller.archiveMeter,
  );

  /**
   * @openapi
   * /api/v1/water/meters/{id}/readings:
   *   get:
   *     summary: List historical readings for a water meter
   *     tags: [Water]
   */
  router.get(
    '/meters/:id/readings',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'),
    validate(listWaterReadingsSchema),
    controller.getReadings,
  );

  /**
   * @openapi
   * /api/v1/water/meters/{id}/readings/latest:
   *   get:
   *     summary: Get the latest reading for a water meter
   *     tags: [Water]
   */
  router.get(
    '/meters/:id/readings/latest',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'),
    controller.getLatestReading,
  );

  /**
   * @openapi
   * /api/v1/water/meters/{id}/readings:
   *   post:
   *     summary: Add a manual consumption reading for a water meter
   *     tags: [Water]
   */
  router.post(
    '/meters/:id/readings',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF'),
    validate(createWaterReadingSchema),
    controller.createReading,
  );

  return router;
}
