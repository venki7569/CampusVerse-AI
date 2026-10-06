import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { ParkingRepository } from './parking.repository';
import { ParkingService } from './parking.service';
import { ParkingController } from './parking.controller';
import { ParkingAuditService } from './parking.audit.service';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import {
  allocateParkingSlotSchema,
  createParkingAreaSchema,
  createParkingSlotSchema,
  listParkingAreasSchema,
  listParkingSlotsSchema,
  parkingAvailabilityQuerySchema,
  parkingIdParamSchema,
  updateParkingAreaSchema,
  updateParkingSlotSchema,
} from './parking.dto';

export function parkingRouter(db: PrismaClient): Router {
  const repo = new ParkingRepository(db);
  const audit = new ParkingAuditService();
  const service = new ParkingService(repo, audit);
  const controller = new ParkingController(service);
  const router = Router();

  router.use(authenticate);

  /**
   * @openapi
   * /api/v1/parking/availability:
   *   get:
   *     summary: Parking availability summary
   *     tags: [Parking]
   *     security:
   *       - bearerAuth: []
   */
  router.get(
    '/availability',
    requirePermission('parking.view'),
    validate(parkingAvailabilityQuerySchema),
    controller.getAvailability,
  );

  /**
   * @openapi
   * /api/v1/parking/areas:
   *   get:
   *     summary: List parking areas
   *     tags: [Parking]
   *     security:
   *       - bearerAuth: []
   */
  router.get(
    '/areas',
    requirePermission('parking.view'),
    validate(listParkingAreasSchema),
    controller.listAreas,
  );

  /**
   * @openapi
   * /api/v1/parking/areas/{id}:
   *   get:
   *     summary: Get parking area by id
   *     tags: [Parking]
   */
  router.get(
    '/areas/:id',
    requirePermission('parking.view'),
    validate(parkingIdParamSchema),
    controller.getArea,
  );

  /**
   * @openapi
   * /api/v1/parking/areas:
   *   post:
   *     summary: Create parking area
   *     tags: [Parking]
   */
  router.post(
    '/areas',
    requirePermission('parking.create'),
    validate(createParkingAreaSchema),
    controller.createArea,
  );

  /**
   * @openapi
   * /api/v1/parking/areas/{id}:
   *   patch:
   *     summary: Update parking area
   *     tags: [Parking]
   */
  router.patch(
    '/areas/:id',
    requirePermission('parking.update'),
    validate(parkingIdParamSchema),
    validate(updateParkingAreaSchema),
    controller.updateArea,
  );

  /**
   * @openapi
   * /api/v1/parking/areas/{id}:
   *   delete:
   *     summary: Delete empty parking area
   *     tags: [Parking]
   */
  router.delete(
    '/areas/:id',
    requirePermission('parking.delete'),
    validate(parkingIdParamSchema),
    controller.deleteArea,
  );

  /**
   * @openapi
   * /api/v1/parking/slots:
   *   get:
   *     summary: List parking slots
   *     tags: [Parking]
   */
  router.get(
    '/slots',
    requirePermission('parking.view'),
    validate(listParkingSlotsSchema),
    controller.listSlots,
  );

  /**
   * @openapi
   * /api/v1/parking/slots/{id}:
   *   get:
   *     summary: Get parking slot by id
   *     tags: [Parking]
   */
  router.get(
    '/slots/:id',
    requirePermission('parking.view'),
    validate(parkingIdParamSchema),
    controller.getSlot,
  );

  /**
   * @openapi
   * /api/v1/parking/slots:
   *   post:
   *     summary: Create parking slot
   *     tags: [Parking]
   */
  router.post(
    '/slots',
    requirePermission('parking.create'),
    validate(createParkingSlotSchema),
    controller.createSlot,
  );

  /**
   * @openapi
   * /api/v1/parking/slots/{id}:
   *   patch:
   *     summary: Update parking slot
   *     tags: [Parking]
   */
  router.patch(
    '/slots/:id',
    requirePermission('parking.update'),
    validate(parkingIdParamSchema),
    validate(updateParkingSlotSchema),
    controller.updateSlot,
  );

  /**
   * @openapi
   * /api/v1/parking/slots/{id}/archive:
   *   patch:
   *     summary: Mark parking slot under maintenance
   *     tags: [Parking]
   */
  router.patch(
    '/slots/:id/archive',
    requirePermission('parking.delete'),
    validate(parkingIdParamSchema),
    controller.archiveSlot,
  );

  /**
   * @openapi
   * /api/v1/parking/slots/{id}:
   *   delete:
   *     summary: Delete parking slot
   *     tags: [Parking]
   */
  router.delete(
    '/slots/:id',
    requirePermission('parking.delete'),
    validate(parkingIdParamSchema),
    controller.deleteSlot,
  );

  /**
   * @openapi
   * /api/v1/parking/slots/{id}/allocate:
   *   post:
   *     summary: Allocate parking slot to a user
   *     tags: [Parking]
   */
  router.post(
    '/slots/:id/allocate',
    requirePermission('parking.allocate'),
    validate(parkingIdParamSchema),
    validate(allocateParkingSlotSchema),
    controller.allocateSlot,
  );

  /**
   * @openapi
   * /api/v1/parking/slots/{id}/release:
   *   post:
   *     summary: Release parking slot allocation
   *     tags: [Parking]
   */
  router.post(
    '/slots/:id/release',
    requirePermission('parking.allocate'),
    validate(parkingIdParamSchema),
    controller.releaseSlot,
  );

  return router;
}
