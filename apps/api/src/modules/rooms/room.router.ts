import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { RoomRepository } from './room.repository';
import { RoomService } from './room.service';
import { RoomController } from './room.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { createRoomSchema, updateRoomSchema, updateOccupancySchema, listRoomsSchema } from './room.dto';
import { config } from '../../config/env';

export function roomRouter(db: PrismaClient): Router {
  const repo = new RoomRepository(db);
  const service = new RoomService(repo, db);
  const controller = new RoomController(service);

  const router = Router();

  /**
   * @openapi
   * /api/v1/rooms:
   *   get:
   *     summary: List rooms with filtering by floor, building, department, type, and occupancy
   *     tags: [Classrooms]
   */
  router.get('/', authenticate, validate(listRoomsSchema), controller.list);

  /**
   * @openapi
   * /api/v1/rooms/occupancy-summary:
   *   get:
   *     summary: Get occupancy count summary grouped by status and room type
   *     tags: [Classrooms]
   */
  router.get('/occupancy-summary', authenticate, controller.getOccupancySummary);

  if (config.occupancySimulation.enabled && !config.isProduction) {
    /**
     * @openapi
     * /api/v1/rooms/simulate-occupancy:
     *   post:
     *     summary: Development-only occupancy simulation tick
     *     tags: [Classrooms]
     *     security:
     *       - bearerAuth: []
     */
    router.post(
      '/simulate-occupancy',
      authenticate,
      requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN'),
      controller.simulateOccupancy,
    );
  }

  router.get('/:id', authenticate, controller.getById);

  router.post(
    '/',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN'),
    validate(createRoomSchema),
    controller.create,
  );

  router.patch(
    '/:id',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN'),
    validate(updateRoomSchema),
    controller.update,
  );

  /**
   * @openapi
   * /api/v1/rooms/{id}/occupancy:
   *   patch:
   *     summary: Update room occupancy status (MANUAL, SIMULATED, or IOT_SENSOR source)
   *     tags: [Classrooms]
   */
  router.patch(
    '/:id/occupancy',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'MAINTENANCE_STAFF'),
    validate(updateOccupancySchema),
    controller.updateOccupancy,
  );

  router.delete(
    '/:id',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN'),
    controller.delete,
  );

  return router;
}
