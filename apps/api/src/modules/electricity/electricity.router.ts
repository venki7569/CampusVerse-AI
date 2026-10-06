import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { ElectricityRepository } from './electricity.repository';
import { ElectricityAuditService } from './electricity.audit.service';
import { ElectricityService } from './electricity.service';
import { ElectricityController } from './electricity.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import {
  createElectricityMeterSchema,
  updateElectricityMeterSchema,
  listElectricityMetersSchema,
  createElectricityReadingSchema,
  listElectricityReadingsSchema,
  electricityAnalyticsQuerySchema,
} from './electricity.dto';

export function electricityRouter(db: PrismaClient): Router {
  const repo = new ElectricityRepository(db);
  const audit = new ElectricityAuditService();
  const service = new ElectricityService(repo, audit, db);
  const controller = new ElectricityController(service);

  const router = Router();

  /**
   * @openapi
   * /api/v1/electricity/analytics:
   *   get:
   *     summary: Get electricity consumption analytics grouped by day, week, month, meter, building, or department
   *     tags: [Electricity]
   */
  router.get(
    '/analytics',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'),
    validate(electricityAnalyticsQuerySchema),
    controller.getConsumptionAnalytics,
  );

  /**
   * @openapi
   * /api/v1/electricity/meters:
   *   get:
   *     summary: List electricity meters with search and filters
   *     tags: [Electricity]
   */
  router.get(
    '/meters',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'),
    validate(listElectricityMetersSchema),
    controller.listMeters,
  );

  /**
   * @openapi
   * /api/v1/electricity/meters/{id}:
   *   get:
   *     summary: Get electricity meter details by ID
   *     tags: [Electricity]
   */
  router.get(
    '/meters/:id',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'),
    controller.getMeterById,
  );

  /**
   * @openapi
   * /api/v1/electricity/meters:
   *   post:
   *     summary: Register a new electricity meter
   *     tags: [Electricity]
   */
  router.post(
    '/meters',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN'),
    validate(createElectricityMeterSchema),
    controller.createMeter,
  );

  /**
   * @openapi
   * /api/v1/electricity/meters/{id}:
   *   patch:
   *     summary: Update an electricity meter
   *     tags: [Electricity]
   */
  router.patch(
    '/meters/:id',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN'),
    validate(updateElectricityMeterSchema),
    controller.updateMeter,
  );

  /**
   * @openapi
   * /api/v1/electricity/meters/{id}:
   *   delete:
   *     summary: Deactivate/archive an electricity meter
   *     tags: [Electricity]
   */
  router.delete(
    '/meters/:id',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN'),
    controller.archiveMeter,
  );

  /**
   * @openapi
   * /api/v1/electricity/meters/{id}/readings:
   *   get:
   *     summary: List historical readings for an electricity meter
   *     tags: [Electricity]
   */
  router.get(
    '/meters/:id/readings',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'),
    validate(listElectricityReadingsSchema),
    controller.getReadings,
  );

  /**
   * @openapi
   * /api/v1/electricity/meters/{id}/readings/latest:
   *   get:
   *     summary: Get the latest reading for an electricity meter
   *     tags: [Electricity]
   */
  router.get(
    '/meters/:id/readings/latest',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF', 'FACULTY'),
    controller.getLatestReading,
  );

  /**
   * @openapi
   * /api/v1/electricity/meters/{id}/readings:
   *   post:
   *     summary: Add a manual consumption reading for a meter
   *     tags: [Electricity]
   */
  router.post(
    '/meters/:id/readings',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF'),
    validate(createElectricityReadingSchema),
    controller.createReading,
  );

  return router;
}
