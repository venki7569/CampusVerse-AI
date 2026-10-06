import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { MaintenanceRepository } from './maintenance.repository';
import { MaintenanceAuditService } from './maintenance.audit.service';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceController } from './maintenance.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import {
  createMaintenanceRequestSchema,
  updateMaintenanceRequestSchema,
  listMaintenanceRequestsSchema,
  assignMaintenanceRequestSchema,
  resolveMaintenanceRequestSchema,
  closeMaintenanceRequestSchema,
  cancelOrRejectMaintenanceRequestSchema,
  createMaintenanceCommentSchema,
} from './maintenance.dto';

export function maintenanceRouter(db: PrismaClient): Router {
  const repo = new MaintenanceRepository(db);
  const audit = new MaintenanceAuditService();
  const service = new MaintenanceService(repo, audit, db);
  const controller = new MaintenanceController(service);

  const router = Router();

  /**
   * @openapi
   * /api/v1/maintenance/metrics:
   *   get:
   *     summary: Get maintenance KPI metrics overview
   *     tags: [Maintenance]
   */
  router.get('/metrics', authenticate, controller.getMetrics);

  /**
   * @openapi
   * /api/v1/maintenance/technicians:
   *   get:
   *     summary: List available maintenance technicians
   *     tags: [Maintenance]
   */
  router.get(
    '/technicians',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF'),
    controller.getTechnicians,
  );

  /**
   * @openapi
   * /api/v1/maintenance:
   *   get:
   *     summary: List maintenance requests with filtering, pagination, and search
   *     tags: [Maintenance]
   */
  router.get(
    '/',
    authenticate,
    validate(listMaintenanceRequestsSchema),
    controller.list,
  );

  /**
   * @openapi
   * /api/v1/maintenance/{id}:
   *   get:
   *     summary: Get maintenance request by ID
   *     tags: [Maintenance]
   */
  router.get('/:id', authenticate, controller.getById);

  /**
   * @openapi
   * /api/v1/maintenance:
   *   post:
   *     summary: Report a new maintenance issue
   *     tags: [Maintenance]
   */
  router.post(
    '/',
    authenticate,
    validate(createMaintenanceRequestSchema),
    controller.create,
  );

  /**
   * @openapi
   * /api/v1/maintenance/{id}:
   *   patch:
   *     summary: Update maintenance request details
   *     tags: [Maintenance]
   */
  router.patch(
    '/:id',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF'),
    validate(updateMaintenanceRequestSchema),
    controller.update,
  );

  /**
   * @openapi
   * /api/v1/maintenance/{id}/assign:
   *   post:
   *     summary: Assign technician to request
   *     tags: [Maintenance]
   */
  router.post(
    '/:id/assign',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF'),
    validate(assignMaintenanceRequestSchema),
    controller.assign,
  );

  /**
   * @openapi
   * /api/v1/maintenance/{id}/start:
   *   post:
   *     summary: Start work on maintenance request
   *     tags: [Maintenance]
   */
  router.post(
    '/:id/start',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF'),
    controller.start,
  );

  /**
   * @openapi
   * /api/v1/maintenance/{id}/resolve:
   *   post:
   *     summary: Mark maintenance request as RESOLVED
   *     tags: [Maintenance]
   */
  router.post(
    '/:id/resolve',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF'),
    validate(resolveMaintenanceRequestSchema),
    controller.resolve,
  );

  /**
   * @openapi
   * /api/v1/maintenance/{id}/close:
   *   post:
   *     summary: Close maintenance request
   *     tags: [Maintenance]
   */
  router.post(
    '/:id/close',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN'),
    validate(closeMaintenanceRequestSchema),
    controller.close,
  );

  /**
   * @openapi
   * /api/v1/maintenance/{id}/cancel:
   *   post:
   *     summary: Cancel maintenance request
   *     tags: [Maintenance]
   */
  router.post(
    '/:id/cancel',
    authenticate,
    validate(cancelOrRejectMaintenanceRequestSchema),
    controller.cancel,
  );

  /**
   * @openapi
   * /api/v1/maintenance/{id}/reject:
   *   post:
   *     summary: Reject maintenance request
   *     tags: [Maintenance]
   */
  router.post(
    '/:id/reject',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN'),
    validate(cancelOrRejectMaintenanceRequestSchema),
    controller.reject,
  );

  /**
   * @openapi
   * /api/v1/maintenance/{id}/comments:
   *   get:
   *     summary: Get comments for a maintenance request
   *     tags: [Maintenance]
   */
  router.get('/:id/comments', authenticate, controller.getComments);

  /**
   * @openapi
   * /api/v1/maintenance/{id}/comments:
   *   post:
   *     summary: Add a comment to a maintenance request
   *     tags: [Maintenance]
   */
  router.post(
    '/:id/comments',
    authenticate,
    validate(createMaintenanceCommentSchema),
    controller.addComment,
  );

  return router;
}
